import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ASCII fight: jose the schema-monk mage vs a bug, rendered as shaded ASCII on a canvas.
// The demo is the same engine driven by a bot.

// ---- engine (world units: arena is W wide, jump height in rows) ----
// Positions are centers; either fighter can be on either side.

const W = 60;
const J_HALF = 5; // jose's half width
const B_HALF = 7.8; // bug's half length
const CONTACT = J_HALF + B_HALF; // center distance when touching
const J_START = 9;
const B_START = 52;
const TICK_MS = 70;
const INTRO = 15;
const JUMP_V = 2.0;
const GRAVITY = 0.32;
const TELEPORT_CD = 30;
// secret finisher (Z), played as a cutscene:
// close-up on the mage's face -> the sphere erases the bug -> a quiet moment by the lake
// (ticks are 70ms: the whole thing runs about 13 seconds)
const VOID_CLOSEUP = 6;
const VOID_ZOOM_IN = 40; // how long the push-in on his face takes
const VOID_LINE = 50;
const VOID_ZOOM = 84;
const VOID_FIRE = 96;
const VOID_PEACE = 140;
const VOID_END = 190;
const VOID_SPEED = 4;
const VOID_SAYS = "You're gonna get... DEBUGGED.";

interface Keys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

interface Game {
  t: number;
  jc: number;
  php: number;
  y: number;
  vy: number;
  moving: boolean;
  blocking: boolean;
  punchT: number;
  punchCd: number;
  blastCd: number;
  shot: number | null;
  shotDir: number;
  tpCd: number;
  tpFrom: number | null;
  youHitT: number;
  bc: number;
  bhp: number;
  biteT: number;
  biteCd: number;
  spit: number | null;
  spitDir: number;
  spitCd: number;
  bugHitT: number;
  fx: { text: string; x: number; t: number } | null;
  wantJump: boolean;
  wantPunch: boolean;
  wantBlast: boolean;
  wantTeleport: boolean;
  wantVoid: boolean;
  voidT: number;
  voidDir: number;
  voidFrom: number;
  voidUsed: boolean;
  bugGoneT: number;
  over: "" | "win" | "lose";
  prev: { jc: number; bc: number; y: number; shot: number | null; spit: number | null };
}

const newGame = (): Game => ({
  t: 0,
  jc: J_START,
  php: 10,
  y: 0,
  vy: 0,
  moving: false,
  blocking: false,
  punchT: 0,
  punchCd: 0,
  blastCd: 0,
  shot: null,
  shotDir: 1,
  tpCd: 0,
  tpFrom: null,
  youHitT: 0,
  bc: B_START,
  bhp: 10,
  biteT: 0,
  biteCd: 0,
  spit: null,
  spitDir: -1,
  spitCd: 20,
  bugHitT: 0,
  fx: null,
  wantJump: false,
  wantPunch: false,
  wantBlast: false,
  wantTeleport: false,
  wantVoid: false,
  voidT: 0,
  voidDir: 1,
  voidFrom: 0,
  voidUsed: false,
  bugGoneT: 0,
  over: "",
  prev: { jc: J_START, bc: B_START, y: 0, shot: null, spit: null },
});

// +1 when the bug is to jose's right
const facing = (g: Game) => (g.bc >= g.jc ? 1 : -1);
const gapOf = (g: Game) => Math.abs(g.bc - g.jc) - CONTACT;
const clampJ = (x: number) => Math.max(J_HALF, Math.min(W - J_HALF, x));
const clampB = (x: number) => Math.max(B_HALF, Math.min(W - B_HALF, x));

const step = (g: Game, keys: Keys) => {
  g.prev = { jc: g.jc, bc: g.bc, y: g.y, shot: g.shot, spit: g.spit };
  if (g.over) {
    if (g.voidT) g.voidT++;
    return;
  }
  g.t++;
  const intro = g.t < INTRO;

  // the secret finisher freezes the fight and erases the bug outright
  if (g.wantVoid && !g.voidUsed && !intro) {
    g.voidUsed = true;
    g.voidT = 1;
    g.voidDir = facing(g);
    g.voidFrom = g.jc + g.voidDir * 6;
    g.shot = g.spit = null;
    g.biteT = g.bugHitT = g.youHitT = 0;
    g.blocking = g.moving = false;
  }
  g.wantVoid = false;
  if (g.voidT) {
    g.voidT++;
    const front = g.voidFrom + g.voidDir * Math.max(0, g.voidT - VOID_FIRE) * VOID_SPEED;
    if (!g.bugGoneT && g.voidT > VOID_FIRE && (front - g.bc) * g.voidDir >= -B_HALF) {
      g.bugGoneT = g.voidT;
      g.bhp = 0;
    }
    if (g.voidT >= VOID_END) g.over = "win";
    return;
  }

  const hitBug = (dmg: number, knockback: number, text: string) => {
    g.bhp = Math.max(0, g.bhp - dmg);
    g.bugHitT = 3;
    g.biteT = 0;
    g.bc = clampB(g.bc + facing(g) * knockback);
    g.fx = { text, x: g.bc, t: 5 };
  };
  const hitYou = (text: string) => {
    if (g.blocking) {
      g.fx = { text: "BLOCK", x: g.jc, t: 5 };
      return;
    }
    g.php = Math.max(0, g.php - 1);
    g.youHitT = 3;
    g.jc = clampJ(g.jc - facing(g) * 2);
    g.fx = { text, x: g.jc, t: 5 };
  };
  // never let jose walk through the bug
  const keepApart = () => {
    const dir = facing(g);
    if (dir > 0) g.jc = Math.min(g.jc, g.bc - CONTACT);
    else g.jc = Math.max(g.jc, g.bc + CONTACT);
    g.jc = clampJ(g.jc);
  };

  // player
  const airborne = g.y > 0 || g.vy > 0;
  g.blocking = keys.down && !airborne;
  g.moving = false;
  if (!g.blocking && g.youHitT === 0) {
    if (keys.left) { g.jc--; g.moving = true; }
    if (keys.right) { g.jc++; g.moving = true; }
  }
  keepApart();

  if (g.wantJump && !airborne && !g.blocking) g.vy = JUMP_V;
  if (g.vy !== 0 || g.y > 0) {
    g.y += g.vy;
    g.vy -= GRAVITY;
    if (g.y <= 0) g.y = g.vy = 0;
  }

  // blink to the same distance on the other side of the bug
  if (g.wantTeleport && g.tpCd === 0 && !g.blocking) {
    const dir = facing(g);
    let to = clampJ(2 * g.bc - g.jc);
    if (Math.abs(to - g.bc) < CONTACT) to = g.bc + dir * CONTACT;
    if (to >= J_HALF && to <= W - J_HALF) {
      g.tpFrom = g.jc;
      g.jc = to;
      g.prev.jc = to;
      g.tpCd = TELEPORT_CD;
      g.biteT = 0;
      g.fx = { text: "BLINK", x: to, t: 5 };
    } else {
      g.fx = { text: "NO ROOM", x: g.jc, t: 5 };
    }
  }

  const gap = gapOf(g);
  if (g.wantPunch && g.punchCd === 0 && !g.blocking) {
    g.punchT = 3;
    g.punchCd = 6;
    if (gap <= 4 && g.y < 3) {
      // the bug guards some punches when it isn't already reeling, then snaps back
      if (g.bugHitT === 0 && Math.random() < 0.4) {
        g.fx = { text: "GUARD", x: g.bc, t: 5 };
        g.biteT = 2;
      } else hitBug(1, 2, "POW!");
    }
  }
  if (g.wantBlast && g.blastCd === 0 && g.shot === null && !g.blocking) {
    g.shotDir = facing(g);
    g.shot = g.jc + g.shotDir * 6;
    g.blastCd = 20;
  }
  g.wantJump = g.wantPunch = g.wantBlast = g.wantTeleport = false;

  if (g.shot !== null) {
    g.shot += 2 * g.shotDir;
    if (Math.abs(g.shot - g.bc) <= B_HALF + 1) {
      g.shot = null;
      hitBug(1, 1, "BOOM!");
    } else if (g.shot < 0 || g.shot >= W) g.shot = null;
  }

  // bug: always turns to face jose
  const toJose = -facing(g);
  if (!intro && g.bugHitT === 0) {
    const bugGap = gapOf(g);
    if (g.biteT > 0) {
      if (--g.biteT === 0 && bugGap <= 1 && g.y < 1.5) hitYou("CHOMP");
    } else if (bugGap <= 1 && g.biteCd === 0) {
      g.biteT = 4;
      g.biteCd = 14;
    } else if (bugGap > 1 && (g.bhp <= 5 || g.t % 2 === 0)) {
      g.bc = clampB(g.bc + toJose);
    }
    if (g.spit === null && g.spitCd === 0 && bugGap > 6 && Math.random() < 0.1) {
      g.spitDir = toJose;
      g.spit = g.bc + toJose * (B_HALF + 1);
      g.spitCd = 16;
    }
  }
  keepApart();

  if (g.spit !== null) {
    g.spit += g.spitDir;
    if (Math.abs(g.spit - g.jc) <= 3) {
      g.spit = null;
      if (g.y < 3) hitYou("SPLAT");
    } else if (g.spit < 0 || g.spit >= W) g.spit = null;
  }

  for (const k of ["punchT", "punchCd", "blastCd", "tpCd", "youHitT", "bugHitT", "biteCd", "spitCd"] as const) {
    if (g[k] > 0) g[k]--;
  }
  if (g.tpCd < TELEPORT_CD - 8) g.tpFrom = null;
  if (g.fx && --g.fx.t <= 0) g.fx = null;

  if (g.bhp === 0) g.over = "win";
  else if (g.php === 0) g.over = "lose";
};

// ---- ascii renderer ----

// The character grid. The arena always uses the base size; in fullscreen the open world
// grows it to fill the screen, so the same-size characters show far more land.
const BASE_COLS = 120;
const BASE_ROWS = 50;
let COLS = BASE_COLS;
let ROWS = BASE_ROWS;
const CW = 5;
const CH = 9;
let N = COLS * ROWS;
const PX_PER_X = (BASE_COLS * CW) / W; // world x -> pixels
const PX_PER_Y = 26; // world jump height -> pixels
const GROUND_Y = 44 * CH;
const HORIZON = 25;

const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const GRASS = ",.'`;:|\"il";
const STONE = "$@B%8&WM#*oahkbdpq";

type RGB = [number, number, number];

interface Frame {
  ch: string[];
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  solid: Uint8Array;
  shake: number;
  // what part of the grid is shown: the world builds one spare row and column and slides
  // the view by a fraction of a cell, so scrolling is smooth instead of jumping cell by cell
  viewCols: number;
  viewRows: number;
  offX: number;
  offY: number;
  // 0 for the arena; 1 in the open world: soft glow around bright things and a dreamy grade
  dream: number;
}

// The frame the screen is built into is reused every render: allocating fresh arrays
// 60 times a second makes the garbage collector pause the game.
let liveFrame: Frame | null = null;
const takeFrame = (): Frame => {
  if (!liveFrame || liveFrame.ch.length !== N) liveFrame = newFrame();
  const f = liveFrame;
  f.ch.fill(" ");
  f.r.fill(0);
  f.g.fill(0);
  f.b.fill(0);
  f.solid.fill(0);
  f.shake = 0;
  f.viewCols = COLS;
  f.viewRows = ROWS;
  f.offX = 0;
  f.offY = 0;
  f.dream = 0;
  return f;
};

const newFrame = (): Frame => ({
  ch: Array(N).fill(" "),
  r: new Float32Array(N),
  g: new Float32Array(N),
  b: new Float32Array(N),
  solid: new Uint8Array(N),
  shake: 0,
  viewCols: COLS,
  viewRows: ROWS,
  offX: 0,
  offY: 0,
  dream: 0,
});

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lumChar = (l: number) => RAMP[6 + Math.floor(clamp01(l) * (RAMP.length - 7))];

const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = (x - xi) * (x - xi) * (3 - 2 * (x - xi));
  const v = (y - yi) * (y - yi) * (3 - 2 * (y - yi));
  const a = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const b = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
  return a + (b - a) * v;
};

const setCell = (f: Frame, i: number, ch: string, c: RGB) => {
  f.ch[i] = ch;
  f.r[i] = c[0];
  f.g[i] = c[1];
  f.b[i] = c[2];
};

// Night field: sky, moon, hills, a lake, two stone monoliths and grass, built once.
// The lake's cells are only marked here; the water itself is animated per frame.
const MOON_COL = 96;
const LAKE_COL = 75;
let background: Frame | null = null;
const water = new Uint8Array(N);
const getBackground = () => {
  if (background) return background;
  const f = newFrame();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const rnd = hash(col, row);
      const hillTop = 19 + Math.round(2.5 * Math.sin(col * 0.05) + 1.5 * Math.sin(col * 0.13 + 1));

      if (row < hillTop) {
        const mx = (col - MOON_COL) * CW;
        const my = (row - 6) * CH;
        const md = Math.hypot(mx, my);
        if (md < 30) {
          const nz = Math.sqrt(1 - (md / 30) ** 2);
          const l = 0.35 + 0.65 * clamp01((-mx / 30) * 0.5 + (-my / 30) * 0.3 + nz * 0.6);
          setCell(f, i, lumChar(l), [190 * l + 40, 195 * l + 40, 210 * l + 40]);
        } else if (rnd < 0.012) {
          const s = 90 + 130 * hash(row, col);
          setCell(f, i, rnd < 0.003 ? "*" : ".", [s, s, s + 20]);
        }
      } else if (row < HORIZON) {
        const l = 0.1 + 0.15 * vnoise(col * 0.3, row * 0.5);
        setCell(f, i, lumChar(l * 0.6), [25 + 60 * l, 40 + 80 * l, 38 + 60 * l]);
      } else {
        const t = (row - HORIZON) / (ROWS - HORIZON);
        const k = 0.55 + 0.6 * rnd;
        const lakeHalf = 58 - (row - HORIZON) * 3 + vnoise(col * 0.3, row) * 2;
        const lakeBottom = 32 + Math.round(1.2 * Math.sin(col * 0.09) + vnoise(col * 0.2, 1));
        if (row <= lakeBottom && Math.abs(col - LAKE_COL) < lakeHalf) {
          water[i] = 1;
        } else if (row === lakeBottom + 1 && Math.abs(col - LAKE_COL) < lakeHalf + 3 && rnd < 0.45) {
          // reeds along the shore
          setCell(f, i, "|!/i"[Math.floor(hash(col, 9) * 4)], [30 + 30 * rnd, 60 + 40 * rnd, 38 + 20 * rnd]);
        } else if (hash(row * 7, col * 3) < 0.03) {
          const s = (150 + 80 * t) * (0.7 + 0.3 * rnd);
          setCell(f, i, ".o*"[Math.floor(rnd * 3)], [s, s + 8, s]);
        } else {
          setCell(f, i, GRASS[Math.floor(hash(col * 5, row * 11) * GRASS.length)], [
            (22 + 40 * t) * k,
            (55 + 75 * t) * k,
            (30 + 35 * t) * k,
          ]);
        }
      }

      for (const [x0, x1, top] of [[4, 14, 11], [104, 112, 15]]) {
        const ragged = vnoise(col * 0.7, row * 0.4) * 1.6;
        if (col >= x0 + ragged && col <= x1 - ragged * 0.5 && row >= top + Math.abs(col - (x0 + x1) / 2) * 0.35 && row <= 41) {
          const side = 1 - (col - x0) / (x1 - x0);
          const l = 0.18 + 0.3 * side + 0.25 * vnoise(col * 0.9, row * 0.6);
          setCell(f, i, STONE[Math.floor(hash(col, row * 3) * STONE.length)], [110 * l + 20, 115 * l + 20, 125 * l + 25]);
          water[i] = 0;
        }
      }
    }
  }
  background = f;
  return f;
};

const LIGHT: RGB = (() => {
  const v: RGB = [-0.55, -0.65, 0.52];
  const m = Math.hypot(...v);
  return [v[0] / m, v[1] / m, v[2] / m];
})();

interface Mat {
  c: RGB;
  spec?: number;
  glow?: boolean;
  stripes?: number;
  folds?: boolean;
  rough?: number;
}

const ROBE: Mat = { c: [48, 45, 52], spec: 0.3, folds: true };
const ROBE_BACK: Mat = { c: [30, 28, 34], spec: 0.15, folds: true };
const FACE: Mat = { c: [150, 112, 98] };
const BEARD: Mat = { c: [175, 170, 165] };
const SKIN: Mat = { c: [190, 150, 130] };
const SKIN_BACK: Mat = { c: [135, 105, 92] };
const BOOTS: Mat = { c: [30, 24, 26] };
const STAFF: Mat = { c: [100, 68, 42], spec: 0.2 };
const GEM: Mat = { c: [255, 45, 60], glow: true };
const MAGE_EYE: Mat = { c: [255, 70, 60], glow: true };
const STITCH_RED: RGB = [220, 40, 48];
const STITCH_WHITE: RGB = [232, 226, 214];
const SHELL: Mat = { c: [160, 55, 38], spec: 0.8, stripes: 22 };
const SHELL_FRONT: Mat = { c: [135, 45, 34], spec: 0.8 };
const LEG: Mat = { c: [60, 35, 28], spec: 0.3 };
const LEG_BACK: Mat = { c: [38, 22, 18] };
const MANDIBLE: Mat = { c: [150, 110, 70], spec: 0.5 };
const EYE: Mat = { c: [255, 215, 90], glow: true };
const BLAST_MAT: Mat = { c: [255, 60, 85], glow: true };
const SPIT_MAT: Mat = { c: [170, 255, 90], glow: true };

// flipAt mirrors every shape around that x, so a figure can face either way
// while the light still comes from the same side.
interface Paint {
  f: Frame;
  flash: number;
  flipAt?: number;
  // cutscene camera: world point (x, y) lands in the screen center, scaled by s
  cam?: { x: number; y: number; s: number };
  speak?: number;
}

let SCREEN_CX = (COLS * CW) / 2;
let SCREEN_CY = (ROWS * CH) / 2;

const setGrid = (cols: number, rows: number) => {
  if (cols === COLS && rows === ROWS) return;
  COLS = cols;
  ROWS = rows;
  N = cols * rows;
  SCREEN_CX = (COLS * CW) / 2;
  SCREEN_CY = (ROWS * CH) / 2;
};

const fx = (p: Paint, x: number) => (p.flipAt === undefined ? x : 2 * p.flipAt - x);
const toScreen = (p: Paint, x: number, y: number): [number, number] => {
  const sx = fx(p, x);
  return p.cam ? [(sx - p.cam.x) * p.cam.s + SCREEN_CX, (y - p.cam.y) * p.cam.s + SCREEN_CY] : [sx, y];
};
const zoom = (p: Paint) => p.cam?.s ?? 1;

// Shades one surface point with normal (nx, ny, nz) and writes the cell.
const shadeCell = (p: Paint, col: number, row: number, nx: number, ny: number, nz: number, m: Mat, px: number) => {
  const i = row * COLS + col;
  const d = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  let l = m.glow ? 0.6 + 0.4 * nz : 0.12 + 0.88 * d;
  if (m.stripes && ((px % m.stripes) + m.stripes) % m.stripes < 3) l *= 0.45;
  if (m.rough) l *= 1 - m.rough + m.rough * hash(col * 3, row * 7);
  // hanging cloth: soft vertical folds
  if (m.folds) l *= 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(px * 0.21 + 4 * vnoise(px * 0.04, 0.5)));
  const s = m.spec ? m.spec * Math.pow(Math.max(0, 2 * d * nz - LIGHT[2]), 16) : 0;
  // cool moonlight catching the edges
  const rim = m.glow ? 0 : Math.pow(1 - nz, 3) * 0.45;
  const k = 0.25 + 0.95 * l;
  const RIM: RGB = [70, 82, 115];
  const mix = (v: number, ch: number) => {
    const lit = Math.min(255, v * k + 255 * s + RIM[ch] * rim);
    return lit + (255 - lit) * p.flash;
  };
  setCell(p.f, i, lumChar(l + s + rim * 0.4), [mix(m.c[0], 0), mix(m.c[1], 1), mix(m.c[2], 2)]);
  p.f.solid[i] = 1;
};

const cellsAround = (x0: number, y0: number, x1: number, y1: number, fn: (col: number, row: number, x: number, y: number) => void) => {
  const c0 = Math.max(0, Math.floor(x0 / CW));
  const c1 = Math.min(COLS - 1, Math.ceil(x1 / CW));
  const r0 = Math.max(0, Math.floor(y0 / CH));
  const r1 = Math.min(ROWS - 1, Math.ceil(y1 / CH));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) fn(col, row, (col + 0.5) * CW, (row + 0.5) * CH);
  }
};

// A capsule whose radius goes from r0 to r1; trim paints the edges and/or the end band,
// and flatEnd cuts the far end square (a hem or a cuff).
const taper = (
  p: Paint,
  ax0: number,
  ay0: number,
  bx0: number,
  by0: number,
  r0w: number,
  r1w: number,
  m: Mat,
  trim?: { m: Mat; edge?: boolean; end?: number },
  flatEnd = false,
) => {
  const [ax, ay] = toScreen(p, ax0, ay0);
  const [bx, by] = toScreen(p, bx0, by0);
  const r0 = r0w * zoom(p);
  const r1 = r1w * zoom(p);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const rm = Math.max(r0, r1);
  cellsAround(Math.min(ax, bx) - rm, Math.min(ay, by) - rm, Math.max(ax, bx) + rm, Math.max(ay, by) + rm, (col, row, x, y) => {
    const raw = ((x - ax) * dx + (y - ay) * dy) / len2;
    if (flatEnd && raw > 1) return;
    const t = clamp01(raw);
    const r = r0 + (r1 - r0) * t;
    const ex = x - (ax + dx * t);
    const ey = y - (ay + dy * t);
    const d2 = (ex * ex + ey * ey) / (r * r);
    if (d2 >= 1) return;
    const onTrim = trim && ((trim.edge && r - Math.sqrt(d2) * r < 3.5) || (trim.end !== undefined && t > trim.end));
    shadeCell(p, col, row, ex / r, ey / r, Math.sqrt(1 - d2), onTrim ? trim.m : m, x);
  });
};

const capsule = (p: Paint, ax: number, ay: number, bx: number, by: number, r: number, m: Mat) =>
  taper(p, ax, ay, bx, by, r, r, m);

const ellipse = (p: Paint, cx0: number, cy0: number, rxw: number, ryw: number, m: Mat) => {
  const [cx, cy] = toScreen(p, cx0, cy0);
  const rx = rxw * zoom(p);
  const ry = ryw * zoom(p);
  cellsAround(cx - rx, cy - ry, cx + rx, cy + ry, (col, row, x, y) => {
    const ex = (x - cx) / rx;
    const ey = (y - cy) / ry;
    const d2 = ex * ex + ey * ey;
    if (d2 < 1) shadeCell(p, col, row, ex, ey, Math.sqrt(1 - d2), m, x - cx);
  });
};

const ball = (p: Paint, cx: number, cy: number, r: number, m: Mat) => ellipse(p, cx, cy, r, r, m);

// Soft halo of dim characters around glowing things, behind solid shapes.
const glow = (f: Frame, cx: number, cy: number, r: number, c: RGB, strength = 0.5) => {
  cellsAround(cx - r, cy - r, cx + r, cy + r, (col, row, x, y) => {
    const i = row * COLS + col;
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d < 1 && !f.solid[i]) {
      const l = (1 - d) * strength;
      setCell(f, i, lumChar(l * 0.5), [c[0] * l + f.r[i] * (1 - l), c[1] * l + f.g[i] * (1 - l), c[2] * l + f.b[i] * (1 - l)]);
    }
  });
};

const glowAt = (p: Paint, x: number, y: number, r: number, c: RGB, strength = 0.5) =>
  glow(p.f, ...toScreen(p, x, y), r * zoom(p), c, strength);

const shadow = (f: Frame, cx: number, rx: number) => {
  const ry = rx * 0.18;
  cellsAround(cx - rx, GROUND_Y - ry, cx + rx, GROUND_Y + ry, (col, row, x, y) => {
    const i = row * COLS + col;
    const d = ((x - cx) / rx) ** 2 + ((y - GROUND_Y) / ry) ** 2;
    if (d < 1) {
      const k = 0.35 + 0.65 * d;
      f.r[i] *= k;
      f.g[i] *= k;
      f.b[i] *= k;
    }
  });
};

const text = (f: Frame, s: string, cx: number, cy: number, c: RGB) => {
  const row = Math.round(cy / CH);
  const col0 = Math.round(cx / CW - s.length / 2);
  if (row < 0 || row >= ROWS) return;
  [...s].forEach((ch, k) => {
    const col = col0 + k;
    if (col >= 0 && col < COLS) setCell(f, row * COLS + col, ch, c);
  });
};

// ---- jose the mage: a jointed figure, posed and blended smoothly ----

const JOINTS = ["hip", "neck", "head", "eF", "hF", "eB", "hB", "kF", "fF", "kB", "fB"] as const;
type Pose = Record<(typeof JOINTS)[number], [number, number]>;

const pose = (...v: number[]): Pose =>
  Object.fromEntries(JOINTS.map((j, k) => [j, [v[k * 2], v[k * 2 + 1]]])) as Pose;

//                hip        neck        head        elbowF      handF       elbowB      handB       kneeF      footF     kneeB       footB
const P_IDLE = pose(0, -88, 6, -150, 10, -170, 26, -128, 34, -152, 14, -122, 22, -146, 16, -46, 22, 0, -12, -44, -18, 0);
const P_IDLE2 = pose(0, -84, 6, -146, 10, -166, 26, -124, 34, -148, 14, -118, 22, -142, 18, -44, 22, 0, -14, -42, -18, 0);
const P_WALK1 = pose(0, -88, 8, -150, 12, -170, 26, -128, 34, -152, 14, -122, 22, -146, 20, -46, 32, 0, -6, -44, -22, -4);
const P_WALK2 = pose(0, -86, 8, -148, 12, -168, 26, -126, 34, -150, 14, -120, 22, -144, 4, -44, -10, -2, 14, -46, 26, 0);
const P_PUNCH = pose(4, -88, 16, -148, 22, -166, 48, -136, 84, -138, 10, -120, 18, -140, 24, -46, 32, 0, -14, -42, -22, 0);
const P_BLAST = pose(-2, -86, 4, -146, 8, -166, 30, -122, 56, -118, 28, -112, 54, -108, 20, -44, 30, 0, -16, -40, -26, 0);
const P_BLOCK = pose(-4, -80, 0, -140, 4, -160, 22, -140, 18, -170, 18, -130, 14, -162, 14, -40, 18, 0, -16, -38, -22, 0);
const P_RISE = pose(0, -96, 4, -156, 6, -176, 22, -176, 28, -202, -10, -174, -14, -200, 22, -72, 10, -42, -4, -68, -16, -38);
const P_FALL = pose(0, -90, 6, -150, 10, -170, 30, -150, 44, -160, -14, -140, -28, -150, 16, -50, 18, -8, -10, -48, -16, -6);
const P_HIT = pose(-6, -86, -18, -144, -24, -162, 0, -150, 10, -170, -30, -130, -40, -150, 10, -44, 18, 0, -14, -44, -20, 0);
const P_WIN = pose(0, -88, 2, -150, 2, -172, 18, -176, 22, -204, -14, -176, -18, -204, 12, -46, 18, 0, -12, -46, -18, 0);
const P_KO = pose(10, -16, -50, -16, -72, -16, -30, -8, -10, -6, -46, -22, -60, -32, 40, -30, 70, -8, 36, -22, 64, -4);

const blendPose = (from: Pose, to: Pose, k: number): Pose =>
  Object.fromEntries(
    JOINTS.map((j) => [j, [from[j][0] + (to[j][0] - from[j][0]) * k, from[j][1] + (to[j][1] - from[j][1]) * k]]),
  ) as Pose;

const targetPose = (g: Game): Pose => {
  if (g.over === "lose") return P_KO;
  if (g.over === "win") return P_WIN;
  if (g.youHitT) return P_HIT;
  if (g.blocking) return P_BLOCK;
  if (g.punchT) return P_PUNCH;
  if (g.blastCd > 17) return P_BLAST;
  if (g.y > 0) return g.vy > 0 ? P_RISE : P_FALL;
  if (g.moving) return (g.t >> 1) % 2 ? P_WALK1 : P_WALK2;
  return g.t % 16 < 8 ? P_IDLE : P_IDLE2;
};

// The great-schema front panel: a cross on Golgotha with the spear and sponge,
// and the skull and crossbones beneath. r = red thread, w = white thread.
const SCHEMA = [
  "    =    ",
  "  ==#==  ",
  "w   #   w",
  " w  #  w ",
  "  w # w  ",
  "   _#-   ",
  "    #    ",
  "   /#\\   ",
  "  /###\\  ",
  " /#####\\ ",
  "   ___   ",
  "  (o.o)  ",
  "  X   X  ",
];
const SCHEMA_INK = [
  "    r    ",
  "  rrrrr  ",
  "w   r   w",
  " w  r  w ",
  "  w r w  ",
  "   rrr   ",
  "    r    ",
  "   rrr   ",
  "  rrrrr  ",
  " rrrrrrr ",
  "   www   ",
  "  wwwww  ",
  "  w   w  ",
];

const embroider = (p: Paint, nX: number, nY: number, hemX: number, hemY: number) => {
  const len = Math.hypot(hemX - nX, hemY - nY) || 1;
  const ux = (hemX - nX) / len;
  const uy = (hemY - nY) / len;
  if (p.cam) return;
  const flipped = p.flipAt !== undefined;
  SCHEMA.forEach((line, pr) =>
    [...line].forEach((ch, pc) => {
      if (ch === " ") return;
      const along = 16 + pr * CH;
      const across = (pc - 4) * CW;
      const x = fx(p, nX + ux * along + uy * across);
      const y = nY + uy * along - ux * across;
      const col = Math.floor(x / CW);
      const row = Math.floor(y / CH);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      const i = row * COLS + col;
      if (!p.f.solid[i]) return;
      const glyph = flipped ? (ch === "/" ? "\\" : ch === "\\" ? "/" : ch) : ch;
      setCell(p.f, i, glyph, SCHEMA_INK[pr][pc] === "r" ? STITCH_RED : STITCH_WHITE);
    }),
  );
};

const stitch = (p: Paint, x: number, y: number, ch: string, c: RGB) => {
  const [sx, sy] = toScreen(p, x, y);
  const col = Math.floor(sx / CW);
  const row = Math.floor(sy / CH);
  if (col >= 0 && col < COLS && row >= 0 && row < ROWS) setCell(p.f, row * COLS + col, ch, c);
};

const SHADOW: Mat = { c: [18, 13, 16] };
const EYE_CORE: Mat = { c: [255, 236, 228], glow: true };
const BEARD_DARK: Mat = { c: [120, 116, 112] };

// Fine features that only resolve once the cutscene camera is close.
const faceDetail = (p: Paint, hX: number, hY: number, now: number) => {
  taper(p, hX + 13, hY - 14, hX + 16, hY + 10, 1.6, 1.2, SHADOW);
  capsule(p, hX + 4, hY - 4.6, hX + 12, hY - 3.8, 1.1, SHADOW);
  taper(p, hX + 11, hY - 2, hX + 15, hY + 3, 1.3, 1.9, FACE);
  ball(p, hX + 9.4, hY - 0.3, 1, EYE_CORE);
  for (let k = 0; k < 6; k++) {
    const sway = Math.sin(now / 420 + k) * 0.6;
    capsule(p, hX + 3 + k * 1.7, hY + 8, hX + 2 + k * 1.9 + sway, hY + 19 + (k % 2) * 3, 0.8, k % 2 ? BEARD : BEARD_DARK);
  }
  capsule(p, hX + 9, hY + 5.8, hX + 14, hY + 6.4, 1, BEARD);
  capsule(p, hX + 10, hY + 7.6, hX + 13, hY + 7.6 + (p.speak ?? 0) * 1.8, 0.7, SHADOW);
};

const drawMage = (p: Paint, ps: Pose, cx: number, gy: number, now: number, casting: boolean, ko: boolean) => {
  const J = (j: keyof Pose): [number, number] => [cx + ps[j][0], gy + ps[j][1]];
  const [nX, nY] = J("neck");
  const [hX, hY] = J("head");
  const [fFx, fFy] = J("fF");
  const [fBx, fBy] = J("fB");
  const sX = nX;
  const sY = nY + 8;

  // monastic staff in the back hand, crowned with a cross and a red gem
  const [hBx, hBy] = J("hB");
  if (!ko) {
    const topX = hBx - 5;
    const topY = hBy - 78;
    capsule(p, hBx + 3, hBy + 62, topX, topY - 10, 2.6, STAFF);
    capsule(p, topX - 10, topY, topX + 10, topY, 2.4, STAFF);
    ball(p, topX, topY, 4.5, GEM);
    glowAt(p, topX, topY, 30, GEM.c, 0.45 + 0.15 * Math.sin(now / 200));
  } else {
    capsule(p, cx - 100, gy - 5, cx + 40, gy - 8, 2.6, STAFF);
    capsule(p, cx + 34, gy - 16, cx + 34, gy, 2.4, STAFF);
  }

  // back sleeve and hand
  capsule(p, sX, sY, ...J("eB"), 9, ROBE_BACK);
  taper(p, ...J("eB"), hBx, hBy, 8, 12, ROBE_BACK, undefined, true);
  ball(p, hBx, hBy, 6, SKIN_BACK);

  // boots peek out under the hem
  ellipse(p, fBx + 6, fBy - 3, 10, 5, BOOTS);
  ellipse(p, fFx + 6, fFy - 3, 10, 5, BOOTS);

  // black habit, flaring to the feet, with the schema stitched on the front
  const hemX = (fFx + fBx) / 2 + Math.sin(now / 350) * 3;
  const hemY = Math.max(fFy, fBy) - 4;
  taper(p, nX, nY, hemX, hemY, 15, ko ? 22 : 34, ROBE, undefined, true);
  embroider(p, nX, nY, hemX, hemY);

  // pointed schema cowl with stitched crosses, shadowed face, beard and glowing eyes
  taper(p, hX - 4, hY - 10, hX - 16 + Math.sin(now / 260) * 2, hY - 38, 11, 2, ROBE);
  ball(p, hX, hY, 16, ROBE);
  taper(p, hX - 2, hY + 8, hX - 12, hY + 40, 10, 15, ROBE, undefined, true);
  ellipse(p, hX + 6, hY + 3, 8, 10, FACE);
  ellipse(p, hX + 7, hY + 13, 7, 10, BEARD);
  ball(p, hX + 9, hY, 2.5, MAGE_EYE);
  glowAt(p, hX + 9, hY, 10, MAGE_EYE.c, 0.35);
  if (zoom(p) >= 2) faceDetail(p, hX, hY, now);
  stitch(p, hX - 6, hY - 8, "+", STITCH_RED);
  stitch(p, hX - 12, hY - 28, "+", STITCH_WHITE);
  stitch(p, hX - 8, hY + 22, "+", STITCH_RED);

  // front sleeve last so the guard sits in front of the body
  const [hFx, hFy] = J("hF");
  capsule(p, sX, sY, ...J("eF"), 9, ROBE);
  taper(p, ...J("eF"), hFx, hFy, 8, 13, ROBE, undefined, true);
  ball(p, hFx, hFy, 7, SKIN);
  if (casting) glowAt(p, hFx, hFy, 34, BLAST_MAT.c, 0.6);
};

// ---- the bug: a glossy beetle, drawn from a few smoothed parameters ----

interface BugAnim {
  lunge: number;
  open: number;
  recoil: number;
  legPhase: number;
}

const drawBugLegs = (p: Paint, ox: number, gy: number, phase: number, back: boolean) => {
  const attach = back ? [-12, 16, 44] : [-26, 4, 32];
  const spread = back ? [-24, -6, 16] : [-34, -6, 24];
  attach.forEach((ax, k) => {
    const s = Math.sin(phase + k * 2.1 + (back ? Math.PI : 0));
    const ax0 = ox + ax + (back ? 6 : 0);
    const fx0 = ax0 + spread[k] + s * 7;
    const fy = gy - Math.max(0, s) * 9;
    const kx = ax0 + (fx0 - ax0) * 0.5 + 4;
    const ky = gy - 64;
    capsule(p, ax0, gy - 38, kx, ky, 4, back ? LEG_BACK : LEG);
    capsule(p, kx, ky, fx0, fy, 3.5, back ? LEG_BACK : LEG);
  });
};

// Drawn facing left; flipAt turns it around.
const drawBug = (p: Paint, a: BugAnim, cx: number, gy: number, now: number, ko: boolean) => {
  if (ko) {
    // on its back, legs kicking at the sky
    [-30, -6, 18, 42].forEach((ax, k) => {
      const s = Math.sin(now / 90 + k * 1.7);
      capsule(p, cx + ax, gy - 40, cx + ax - 6, gy - 70, 4, LEG);
      capsule(p, cx + ax - 6, gy - 70, cx + ax + 4 + s * 6, gy - 92, 3.5, LEG);
    });
    ellipse(p, cx + 25, gy - 28, 50, 26, SHELL);
    ellipse(p, cx - 20, gy - 30, 26, 22, SHELL_FRONT);
    ball(p, cx - 48, gy - 24, 16, SHELL_FRONT);
    text(p.f, "x", fx(p, cx - 54), gy - 30, [255, 215, 90]);
    return;
  }

  const ox = cx + a.recoil * 14;
  const raise = a.recoil * 12;
  drawBugLegs(p, ox, gy, a.legPhase, true);
  ellipse(p, ox + 25, gy - 50, 50, 34, SHELL);
  ellipse(p, ox - 20 - a.lunge * 6, gy - 56 - raise * 0.5, 26, 25, SHELL_FRONT);

  const hx = ox - 48 - a.lunge * 18;
  const hy = gy - 54 - raise;
  const wob = Math.sin(now / 300);
  capsule(p, hx - 4, hy - 15, hx - 16, hy - 42 + wob * 4, 2, LEG);
  capsule(p, hx - 16, hy - 42 + wob * 4, hx - 36, hy - 52 + Math.sin(now / 240) * 5, 2, LEG);
  ball(p, hx, hy, 17, SHELL_FRONT);
  ball(p, hx - 6, hy - 6, 4.5, EYE);

  const o = a.open;
  capsule(p, hx - 12, hy + 3, hx - 27, hy + 1 - o * 12, 4, MANDIBLE);
  capsule(p, hx - 27, hy + 1 - o * 12, hx - 32, hy + 8 - o * 10, 3, MANDIBLE);
  capsule(p, hx - 12, hy + 9, hx - 27, hy + 12 + o * 10, 4, MANDIBLE);
  capsule(p, hx - 27, hy + 12 + o * 10, hx - 31, hy + 6 + o * 9, 3, MANDIBLE);

  drawBugLegs(p, ox, gy, a.legPhase, false);
};

// ---- frame assembly ----

interface Anim {
  pose: Pose;
  bug: BugAnim;
  lastBc: number;
  last: number;
}

const newAnim = (): Anim => ({
  pose: P_IDLE,
  bug: { lunge: 0, open: 0, recoil: 0, legPhase: 0 },
  lastBc: B_START,
  last: 0,
});

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Crimson sparks where jose just blinked out of.
const blinkSparks = (f: Frame, x: number, y: number, age: number, now: number) => {
  const fade = 1 - age / 8;
  glow(f, x, y - 90, 70 * fade + 10, BLAST_MAT.c, 0.6 * fade);
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4 + now / 300;
    const r = 20 + age * 9 + hash(k, 7) * 30;
    const col = Math.round((x + Math.cos(a) * r) / CW);
    const row = Math.round((y - 90 + Math.sin(a) * r * 1.4) / CH);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) setCell(f, row * COLS + col, "*+."[k % 3], [255, 90 + 80 * fade, 110]);
  }
};

const VOID_RED: RGB = [255, 70, 70];
const VOID_BLUE: RGB = [80, 150, 255];
const VOID_PURPLE: RGB = [175, 90, 255];
const VOID_MAT: Mat = { c: VOID_PURPLE, glow: true };
const RED_ORB: Mat = { c: VOID_RED, glow: true };
const BLUE_ORB: Mat = { c: VOID_BLUE, glow: true };

// Everything the sphere has passed through is gone: a black trench with a crackling purple rim.
const eraseTrench = (f: Frame, x0: number, x1: number, cy: number, r: number, now: number) => {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  cellsAround(lo, cy - r, hi, cy + r, (col, row, x, y) => {
    const ramp = Math.min(1, Math.abs(x - x0) / 60);
    const rr = r * (0.55 + 0.45 * ramp);
    const d = Math.abs(y - cy);
    if (d > rr) return;
    const i = row * COLS + col;
    if (d > rr - 7) {
      const flicker = 0.6 + 0.4 * vnoise(col * 0.5 + now / 120, row);
      setCell(f, i, "~*:."[Math.floor(hash(col, row + Math.floor(now / 90)) * 4)], [
        VOID_PURPLE[0] * flicker,
        VOID_PURPLE[1] * flicker,
        VOID_PURPLE[2] * flicker,
      ]);
    } else {
      f.ch[i] = " ";
    }
    f.solid[i] = 1;
  });
};

// The bug coming apart: shell-colored fragments flung outward and fading.
const bugFragments = (f: Frame, cx: number, cy: number, age: number, dir: number) => {
  const fade = Math.max(0, 1 - age / 14);
  if (!fade) return;
  for (let k = 0; k < 70; k++) {
    const a = hash(k, 3) * Math.PI * 2;
    const speed = 6 + hash(k, 5) * 16;
    const x = cx + Math.cos(a) * speed * age + dir * age * 10;
    const y = cy + Math.sin(a) * speed * age * 0.6 + age * age * 0.6;
    const col = Math.round(x / CW);
    const row = Math.round(y / CH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    const c = k % 3 ? SHELL.c : VOID_PURPLE;
    setCell(f, row * COLS + col, "#%*+:."[Math.min(5, Math.floor((1 - fade) * 6))], [c[0] * fade, c[1] * fade, c[2] * fade]);
  }
};

const drawVoid = (f: Frame, g: Game, alpha: number, mageX: number, castY: number, now: number) => {
  const t = g.voidT + alpha;
  const dir = g.voidDir;
  const p: Paint = { f, flash: 0 };
  const coreX = mageX + dir * 46;
  const coreY = castY - 120;
  if (t < VOID_FIRE) {
    // red and blue orbs appear at either hand; after the close-up they have fused
    const k = Math.min(1, t / VOID_CLOSEUP) * 0.3;
    const spin = t * 0.7;
    const orbit = 46 * (1 - k);
    const fused = t > VOID_ZOOM;
    if (!fused) {
      const rx = coreX + Math.cos(spin) * orbit;
      const ry = coreY + Math.sin(spin) * orbit * 0.6;
      const bx = coreX - Math.cos(spin) * orbit;
      const by = coreY - Math.sin(spin) * orbit * 0.6;
      glow(f, rx, ry, 34, VOID_RED, 0.6);
      glow(f, bx, by, 34, VOID_BLUE, 0.6);
      ball(p, rx, ry, 8 + 4 * k, RED_ORB);
      ball(p, bx, by, 8 + 4 * k, BLUE_ORB);
    } else {
      const r = 16 + (t - VOID_ZOOM) * 3.2;
      glow(f, coreX, coreY, r * 2.6, VOID_PURPLE, 0.7);
      ball(p, coreX, coreY, r, VOID_MAT);
      f.shake = 1.5;
    }
    return;
  }
  // the sphere tears across the field, leaving nothing behind it
  const r = 48;
  const startX = g.voidFrom * PX_PER_X;
  const travel = Math.max(0, t - VOID_FIRE) * VOID_SPEED * PX_PER_X;
  const sx = startX + dir * travel;
  const sy = GROUND_Y - 64;
  eraseTrench(f, startX, sx - dir * r * 0.4, sy, r + 6, now);
  if (sx > -r * 2 && sx < COLS * CW + r * 2) {
    glow(f, sx, sy, r * 2.4, VOID_PURPLE, 0.8);
    ball(p, sx, sy, r, VOID_MAT);
    for (let k = 0; k < 10; k++) {
      const a = now / 90 + k * 0.63;
      const c = k % 2 ? VOID_RED : VOID_BLUE;
      const col = Math.round((sx + Math.cos(a) * (r + 10)) / CW);
      const row = Math.round((sy + Math.sin(a) * (r + 10) * 0.7) / CH);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) setCell(f, row * COLS + col, "*", c);
    }
    f.shake = 4;
  }
};

// ---- the close-up: a raymarched 3D head, shaded per character ----
// Units are roughly centimeters; the head sits at the origin, +y up, +z toward the camera.

type V3 = [number, number, number];

// plain sqrt: Math.hypot is far slower, and these run millions of times a frame
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
const sdEllipsoid = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
  const k0 = len3(x / rx, y / ry, z / rz);
  const k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return (k0 * (k0 - 1)) / (k1 || 1e-6);
};
const sdSphere = (x: number, y: number, z: number, r: number) => len3(x, y, z) - r;
const sdCapsule = (x: number, y: number, z: number, a: V3, b: V3, r0: number, r1: number) => {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const h = clamp01(((x - a[0]) * bax + (y - a[1]) * bay + (z - a[2]) * baz) / (bax * bax + bay * bay + baz * baz));
  return len3(x - a[0] - bax * h, y - a[1] - bay * h, z - a[2] - baz * h) - (r0 + (r1 - r0) * h);
};
const smin = (a: number, b: number, k: number) => {
  const h = clamp01(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
const noise3 = (x: number, y: number, z: number) => vnoise(x + z * 1.71, y - z * 0.93);

const enum Part { Skin, Eye, Lip, Beard, Hood, Robe }

let hit = Part.Skin;
let mouthOpen = 0;

// The whole head and shoulders as one signed distance field; sets `hit` to the nearest part.
const headSdf = (x: number, y: number, z: number) => {
  // far from the bust: one sphere is close enough
  const bound = len3(x, y + 9, z) - 29;
  if (bound > 2) {
    hit = Part.Robe;
    return bound;
  }
  const ax = Math.abs(x);
  // a long, narrow old skull; sunken cheeks under strong cheekbones
  let d = sdEllipsoid(x, y - 1.6, z + 0.6, 6.5, 8.9, 8.4);
  d = smin(d, sdEllipsoid(x, y + 4.0, z - 1.6, 5.0, 6.6, 5.6), 3);
  d = smin(d, sdEllipsoid(ax - 3.6, y + 0.7, z - 4.2, 2.0, 1.4, 1.8), 1.2);
  d = smax(d, -sdEllipsoid(ax - 4.1, y + 3.1, z - 4.4, 1.5, 2.1, 1.5), 1.2);
  // heavy brow ridge
  d = smin(d, sdEllipsoid(x, y - 2.5, z - 5.4, 5.1, 1.5, 2.1), 1.2);
  // deep sockets, then hooded upper lids and bags beneath (tired, half-closed eyes)
  d = smax(d, -sdSphere(ax - 2.5, y - 1.0, z - 6.6, 2.0), 0.9);
  d = smin(d, sdEllipsoid(ax - 2.5, y - 1.5, z - 6.0, 1.75, 0.8, 1.1), 0.35);
  d = smin(d, sdEllipsoid(ax - 2.6, y + 0.15, z - 5.95, 1.8, 0.55, 0.9), 0.35);
  d = smin(d, sdEllipsoid(ax - 2.7, y + 0.85, z - 5.7, 1.95, 0.5, 0.8), 0.35);
  // a big, slightly hooked nose with a drooping tip
  d = smin(d, sdCapsule(x, y, z, [0, 2.2, 6.6], [0, -2.6, 9.4], 0.85, 1.25), 0.8);
  d = smin(d, sdSphere(x, y - 0.6, z - 7.7, 0.95), 0.6);
  d = smin(d, sdEllipsoid(x, y + 2.9, z - 9.0, 1.3, 1.25, 1.2), 0.6);
  d = smin(d, sdSphere(ax - 1.25, y + 3.0, z - 7.6, 0.9), 0.5);
  // deep forehead furrows
  if (y > 2.8 && y < 6.8 && z > 2.5) d += 0.11 * Math.pow(Math.max(0, Math.sin(y * 5.2 + Math.sin(x * 0.8) * 0.6)), 3) * clamp01((z - 2.5) / 3);
  hit = Part.Skin;

  // the lower lip barely shows under the mustache
  const lip = sdEllipsoid(x, y + 6.1 + mouthOpen * 0.3, z - 6.6, 1.6, 0.55, 0.9);
  if (lip < d) hit = Part.Lip;
  d = smin(d, lip, 0.3);
  if (mouthOpen > 0.05) d = smax(d, -sdEllipsoid(x, y + 5.6, z - 7.0, 1.4, 0.25 + mouthOpen * 0.45, 1.2), 0.2);

  const eye = sdSphere(ax - 2.5, y - 1.0, z - 5.2, 1.4);
  if (eye < d) {
    d = eye;
    hit = Part.Eye;
  }

  // white hair: bushy drooping brows, a long mustache, a beard that flows off the bottom,
  // and long locks falling beside the face. Strands run mostly downward.
  const strands = 0.22 * Math.sin(x * 3.6 + Math.sin(y * 0.35) * 1.6) + 0.1 * Math.sin(x * 9.1 + y * 0.4);
  const hair = Math.min(
    sdCapsule(ax, y, z, [1.2, 2.7, 7.0], [4.8, 1.5, 5.6], 0.5, 0.8),
    sdCapsule(ax, y, z, [0.5, -4.0, 8.2], [3.6, -7.4, 6.6], 0.8, 1.4) + strands * 0.4,
    sdEllipsoid(x, y + 11.5, z - 3.6, 6.0, 9.0, 4.2) + strands,
    sdCapsule(x, y, z, [0, -15, 3.0], [0.4, -34, 2.2], 5.4, 3.6) + strands,
    sdEllipsoid(ax - 5.4, y + 5, z - 2.0, 1.9, 10.5, 2.6) + strands,
  );
  if (hair < d) {
    d = hair;
    hit = Part.Beard;
  }

  // a heavy black hood, pointed at the top, open at the face
  const folds = 0.4 * Math.sin(Math.atan2(y, x) * 8 + x * 0.15) + 0.15 * Math.sin(y * 1.7 + x);
  let hood = sdEllipsoid(x, y - 2.0, z + 1.4, 10.6, 13.2, 11.6) + folds;
  hood = smin(hood, sdCapsule(x, y, z, [0, 10, -2], [-1.6, 17.5, -4.5], 6, 0.8), 2.5);
  hood = smax(hood, -sdEllipsoid(x, y - 0.6, z - 1.2, 8.7, 11.4, 11.0), 0.6);
  // the opening: the hood reaches forward over the brow and falls back beside the face
  hood = smax(hood, z - (3.4 + 3.4 * clamp01((y - 2.5) / 5.5)), 0.8);
  if (hood < d) {
    d = hood;
    hit = Part.Hood;
  }

  const robe = sdEllipsoid(x, y + 22, z + 1, 18, 10, 9.5) + folds * 0.8;
  if (robe < d) {
    d = robe;
    hit = Part.Robe;
  }
  return d;
};

const ALBEDO: Record<Part, RGB> = {
  [Part.Skin]: [182, 164, 152],
  [Part.Eye]: [150, 142, 136],
  [Part.Lip]: [140, 105, 100],
  [Part.Beard]: [214, 212, 206],
  [Part.Hood]: [26, 25, 28],
  [Part.Robe]: [30, 29, 33],
};

// Distance from (x, y) to the segment a-b, for drawing wrinkle lines.
const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return Math.sqrt((x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2);
};

// How deep the creases are at a point on the face (0 = none, 1 = deepest).
const wrinkles = (x: number, y: number) => {
  const ax = Math.abs(x);
  let w = 0;
  // crow's feet fanning from the outer eye corners
  const fx0 = ax - 4.3;
  const fy0 = y - 0.8;
  const fr = Math.sqrt(fx0 * fx0 + fy0 * fy0);
  if (fr < 2.2 && fx0 > -0.4) w = Math.max(w, Math.pow(Math.max(0, Math.sin(Math.atan2(fy0, fx0) * 11)), 6) * (1 - fr / 2.2));
  // folds under the eyes
  w = Math.max(w, Math.max(0, 1 - Math.abs(y + 0.5 + 0.12 * (ax - 2.6) ** 2) / 0.22) * clamp01(1 - Math.abs(ax - 2.7) / 2.2) * 0.8);
  // deep folds from the nose to the mouth corners
  w = Math.max(w, Math.max(0, 1 - segDist(ax, y, 1.7, -2.4, 3.6, -6.2) / 0.32) * 0.9);
  // fine lines over the cheeks and a general crinkle
  if (ax > 2 && y < -0.5 && y > -6) w = Math.max(w, Math.pow(Math.max(0, Math.sin(ax * 6 + y * 1.8)), 8) * 0.35);
  return w;
};

const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

const norm = (v: V3): V3 => {
  const m = len3(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

interface PortraitLight {
  pos: V3;
  c: RGB;
  power: number;
}

// Rows are raymarched in alternating halves; the other half comes from the previous frame.
const portraitCache = { ch: Array<string>(N).fill(" "), r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N), hit: new Uint8Array(N), at: 0, parity: 0 };

// Renders the portrait into every cell the head covers.
const renderPortrait = (f: Frame, camDist: number, yaw: number, speak: number, lights: PortraitLight[], now: number) => {
  mouthOpen = speak;
  const focal = 1.7;
  const half = (ROWS * CH) / 2;
  const ro = rotY([0, -4, camDist], -yaw);
  const moon = norm(rotY([-0.7, 0.55, -0.45], -yaw));
  const ls = lights.map((l) => ({ ...l, pos: rotY(l.pos, -yaw) }));
  const eps = 0.05;
  const key = norm(rotY([-0.5, 0.55, 0.7], -yaw));
  // gentle breathing
  const bob = Math.sin(now / 900) * 0.15;
  const cache = portraitCache;
  const fresh = now - cache.at > 150;
  cache.at = now;
  cache.parity ^= 1;

  for (let row = 0; row < ROWS; row++) {
    if (!fresh && (row & 1) !== cache.parity) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        if (!cache.hit[i]) continue;
        setCell(f, i, cache.ch[i], [cache.r[i], cache.g[i], cache.b[i]]);
        f.solid[i] = 1;
      }
      continue;
    }
    for (let col = 0; col < COLS; col++) {
      cache.hit[row * COLS + col] = 0;
      const u = ((col + 0.5) * CW - SCREEN_CX) / half;
      const v = -((row + 0.5) * CH - SCREEN_CY) / half;
      const rd = norm(rotY([u, v, -focal], -yaw));
      // skip rays that miss the bust entirely
      const ocx = ro[0];
      const ocy = ro[1] + 9 + bob;
      const ocz = ro[2];
      const bq = ocx * rd[0] + ocy * rd[1] + ocz * rd[2];
      const cq = ocx * ocx + ocy * ocy + ocz * ocz - 30 * 30;
      if (bq * bq - cq < 0) continue;

      let t = Math.max(0, -bq - 30);
      let found = false;
      for (let k = 0; k < 48 && t < camDist + 40; k++) {
        const dist = headSdf(ro[0] + rd[0] * t, ro[1] + rd[1] * t - bob, ro[2] + rd[2] * t);
        if (dist < 0.03 * (1 + t * 0.02)) {
          found = true;
          break;
        }
        t += dist * 0.9;
      }
      if (!found) continue;

      const px = ro[0] + rd[0] * t;
      const py = ro[1] + rd[1] * t - bob;
      const pz = ro[2] + rd[2] * t;
      headSdf(px, py, pz);
      const part = hit;
      // tetrahedral normal: four samples instead of six
      const a = headSdf(px + eps, py - eps, pz - eps);
      const b2 = headSdf(px - eps, py - eps, pz + eps);
      const c2 = headSdf(px - eps, py + eps, pz - eps);
      const d2 = headSdf(px + eps, py + eps, pz + eps);
      const n = norm([a - b2 - c2 + d2, -a - b2 + c2 + d2, -a + b2 - c2 + d2]);
      // ambient occlusion from one short probe along the normal
      const ao = 0.4 + 0.6 * clamp01(headSdf(px + n[0] * 1.2, py + n[1] * 1.2, pz + n[2] * 1.2) / 1.2);
      const view: V3 = [-rd[0], -rd[1], -rd[2]];
      const nv = Math.max(0, n[0] * view[0] + n[1] * view[1] + n[2] * view[2]);

      let albedo = ALBEDO[part];
      const emit: RGB = [0, 0, 0];
      let shine = part === Part.Eye ? 1.2 : part === Part.Skin || part === Part.Lip ? 0.18 : 0.05;
      let power = part === Part.Eye ? 120 : 18;
      let cavity = 1;
      if (part === Part.Eye) {
        // tired, downcast eyes: dark iris and pupil with a faint red glint
        const cx = px > 0 ? 2.5 : -2.5;
        const ed = norm([px - cx, py - 1.0, pz - 5.2]);
        const look = ed[0] * 0.15 + ed[1] * -0.35 + ed[2] * 0.92;
        if (look > 0.96) albedo = [14, 10, 10];
        else if (look > 0.85) albedo = [70, 48, 44];
      } else if (part === Part.Beard) {
        // long strands catching light, with dark gaps between them
        const strand = 0.6 + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(px * 6.5 + noise3(px * 0.6, py * 0.12, pz) * 6), 1.5);
        const fade = clamp01(1 + (py + 20) / 18);
        albedo = [albedo[0] * strand * fade, albedo[1] * strand * fade, albedo[2] * strand * fade];
        shine = 0.2;
        power = 10;
      } else if (part === Part.Skin) {
        // weathered skin: blotchy tone, pore grain and deep creases
        const tone = 0.88 + 0.12 * noise3(px * 1.3, py * 1.3, pz);
        const pores = 0.9 + 0.1 * hash(col * 7, row * 13);
        const redness = clamp01(1 - len3(px, py + 2.6, pz - 9) / 1.8) * 0.12;
        cavity = 1 - 0.7 * wrinkles(px, py);
        albedo = [albedo[0] * tone * pores * (1 + redness), albedo[1] * tone * pores, albedo[2] * tone * pores];
      } else if (part === Part.Hood || part === Part.Robe) {
        // rough, painterly cloth
        const weave = 0.75 + 0.25 * noise3(px * 0.9, py * 0.5, pz);
        albedo = [albedo[0] * weave, albedo[1] * weave, albedo[2] * weave];
      }

      const out: V3 = [emit[0], emit[1], emit[2]];
      const aoC = ao * cavity;
      // dim purple fill
      for (let ch = 0; ch < 3; ch++) out[ch] += albedo[ch] * [0.05, 0.035, 0.08][ch] * aoC;
      // moonlight from behind and above, plus a cool rim on the silhouette
      const md = Math.max(0, n[0] * moon[0] + n[1] * moon[1] + n[2] * moon[2]);
      const rim = Math.pow(1 - nv, 3) * 0.9;
      for (let ch = 0; ch < 3; ch++) out[ch] += albedo[ch] * md * [0.35, 0.4, 0.55][ch] * aoC + [70, 85, 120][ch] * rim * aoC;
      // a soft neutral key from the front so skin reads as skin
      const wrapK = part === Part.Skin || part === Part.Lip ? 0.4 : 0.1;
      const kd = Math.max(0, (n[0] * key[0] + n[1] * key[1] + n[2] * key[2] + wrapK) / (1 + wrapK));
      // the hood's overhang keeps the top of the face in shadow
      const overhang = part === Part.Skin || part === Part.Eye ? 1 - 0.65 * clamp01((py - 2.5) / 4) : 1;
      for (let ch = 0; ch < 3; ch++) out[ch] += albedo[ch] * kd * [0.85, 0.8, 0.77][ch] * aoC * overhang;
      // the orbs: wrapped diffuse for skin (light scatters under it) and a highlight
      for (const l of ls) {
        const lx = l.pos[0] - px;
        const ly = l.pos[1] - py;
        const lz = l.pos[2] - pz;
        const ld = Math.hypot(lx, ly, lz);
        const ldir: V3 = [lx / ld, ly / ld, lz / ld];
        const ndl = n[0] * ldir[0] + n[1] * ldir[1] + n[2] * ldir[2];
        const wrap = part === Part.Skin || part === Part.Lip ? 0.35 : 0;
        const diff = Math.max(0, (ndl + wrap) / (1 + wrap));
        const fall = l.power / (1 + ld * ld * 0.004);
        const hx = ldir[0] + view[0];
        const hy = ldir[1] + view[1];
        const hz = ldir[2] + view[2];
        const hm = Math.hypot(hx, hy, hz) || 1;
        const spec = shine * Math.pow(Math.max(0, (n[0] * hx + n[1] * hy + n[2] * hz) / hm), power);
        for (let ch = 0; ch < 3; ch++) out[ch] += (albedo[ch] / 255) * l.c[ch] * diff * fall * aoC + l.c[ch] * spec * fall;
      }

      const i = row * COLS + col;
      // mostly monochrome, like a charcoal study, with just a hint of the orbs' color
      const grey = out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15;
      for (let ch = 0; ch < 3; ch++) out[ch] = lerp(out[ch], grey * [1.02, 1, 0.97][ch], 0.65);
      const lum = grey / 255;
      setCell(f, i, lumChar(Math.min(1, lum * 1.4)), [Math.min(255, out[0]), Math.min(255, out[1]), Math.min(255, out[2])]);
      f.solid[i] = 1;
      cache.hit[i] = 1;
      cache.ch[i] = f.ch[i];
      cache.r[i] = f.r[i];
      cache.g[i] = f.g[i];
      cache.b[i] = f.b[i];
    }
  }
  return { ro, focal, half, yaw };
};

// Where a point near the head lands on screen (for the orbs' glow).
const projectPortrait = (camDist: number, yaw: number, pt: V3): [number, number] => {
  const q = rotY(pt, yaw);
  const depth = camDist - q[2];
  const half = (ROWS * CH) / 2;
  return [SCREEN_CX + (q[0] / depth) * 1.7 * half, SCREEN_CY - ((q[1] + 4) / depth) * 1.7 * half];
};

const smooth = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};

// Scene 1: the camera pushes in on the mage's face while the orbs gather;
// the picture starts noisy and resolves as it gets closer.
const composeCloseup = (f: Frame, dir: number, t: number, now: number) => {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const n = vnoise(col * 0.07 + now / 1600, row * 0.11 - now / 2100);
      const vignette = 1 - Math.min(1, Math.hypot((col - COLS / 2) / COLS, (row - ROWS / 2) / ROWS) * 1.6);
      const l = n * vignette * 0.35;
      const tint = vnoise(col * 0.03 - now / 3000, row * 0.05);
      setCell(f, i, lumChar(l * 0.5), [
        (40 + 140 * tint) * l + 6,
        (20 + 30 * tint) * l + 5,
        (90 + 150 * (1 - tint)) * l + 10,
      ]);
    }
  }

  const z = smooth((t - VOID_CLOSEUP) / VOID_ZOOM_IN);
  const camDist = lerp(150, 31, z);
  const yaw = dir * (0.45 - 0.15 * z);
  const speaking = t > VOID_LINE && t < VOID_LINE + 17 ? Math.abs(Math.sin(now / 90)) : 0;

  // the red and blue orbs circle in front of the face and close in until they touch
  const k = smooth((t - 10) / (VOID_ZOOM - 16));
  const orbit = 16 * (1 - k) + 2;
  const spin = t * 0.45;
  const center: V3 = [dir * 3, -3, 14];
  const redPos: V3 = [center[0] + Math.cos(spin) * orbit, center[1] + Math.sin(spin) * orbit * 0.4, center[2] + Math.sin(spin) * orbit * 0.5];
  const bluePos: V3 = [center[0] - Math.cos(spin) * orbit, center[1] - Math.sin(spin) * orbit * 0.4, center[2] - Math.sin(spin) * orbit * 0.5];
  renderPortrait(f, camDist, yaw, speaking, [
    { pos: redPos, c: VOID_RED, power: 0.55 },
    { pos: bluePos, c: VOID_BLUE, power: 0.55 },
    ...(k > 0.85 ? [{ pos: center, c: VOID_PURPLE, power: (k - 0.85) * 5 }] : []),
  ], now);

  const orbR = (220 / (camDist - 10)) * (1 + k);
  for (const [pos, c] of [[redPos, VOID_RED], [bluePos, VOID_BLUE]] as [V3, RGB][]) {
    const [sx, sy] = projectPortrait(camDist, yaw, pos);
    glow(f, sx, sy, orbR * 3.2, c, 0.6);
    ball({ f, flash: 0 }, sx, sy, orbR, { c, glow: true });
  }
  if (k > 0.85) {
    const [sx, sy] = projectPortrait(camDist, yaw, center);
    glow(f, sx, sy, orbR * 6, VOID_PURPLE, (k - 0.85) * 4);
  }

  // out of focus at first, crisp by the time we're close
  const clarity = smooth((t - VOID_CLOSEUP) / 32);
  const frameSeed = Math.floor(now / 60);
  for (let i = 0; i < N; i++) {
    if (hash(i, frameSeed) > clarity * 1.05) {
      f.ch[i] = RAMP[6 + Math.floor(hash(frameSeed, i) * (RAMP.length - 7))];
      const jitter = 0.5 + hash(i * 3, frameSeed) * 0.6;
      f.r[i] *= jitter;
      f.g[i] *= jitter;
      f.b[i] *= jitter;
    }
  }
  if (t > VOID_ZOOM - 10) f.shake = (t - (VOID_ZOOM - 10)) * 0.35;
};

const FLOWER_COLORS: RGB[] = [
  [255, 120, 185],
  [255, 214, 90],
  [185, 125, 255],
  [255, 85, 95],
  [240, 240, 250],
  [120, 175, 255],
  [255, 160, 90],
];

//                 hip        neck       head        elbowF     handF      elbowB      handB     kneeF     footF    kneeB      footB
//                hip        neck        head        elbowF      handF       elbowB      handB       kneeF      footF      kneeB      footB
const P_RIDE = pose(0, -88, 6, -150, 10, -170, 24, -122, 36, -112, 10, -120, 24, -110, 20, -74, 16, -50, -2, -74, -6, -52);
const P_RIDE_STRIKE = pose(4, -88, 12, -150, 16, -170, 44, -134, 76, -136, 10, -120, 24, -110, 20, -74, 16, -50, -2, -74, -6, -52);
const P_PEACE = pose(0, -88, 4, -150, 9, -172, 12, -112, 18, -86, -2, -114, 2, -92, 8, -46, 10, 0, -6, -46, -10, 0);

// Scene 3: the mage stands by the lake, the moon on the water and flowers in the wind.
const composePeace = (f: Frame, t: number, now: number) => {
  const mageX = 205;
  shadow(f, mageX, 40);
  drawMage({ f, flash: 0 }, P_PEACE, mageX, GROUND_Y, now, false, false);

  const gust = Math.sin(now / 1900) * 0.8;
  for (let k = 0; k < 110; k++) {
    const gx = hash(k, 1) * COLS;
    const base = 38 + Math.floor(hash(k, 2) * 12);
    const height = 2 + Math.floor(hash(k, 3) * 4);
    const c = FLOWER_COLORS[k % FLOWER_COLORS.length];
    let prev = 0;
    for (let h = 0; h <= height; h++) {
      const sway = (Math.sin(now / 650 + gx * 0.25 + k) * 1.4 + gust) * (h / height);
      const col = Math.round(gx + sway);
      const row = base - h;
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
      const i = row * COLS + col;
      if (h === height) {
        const pulse = 0.85 + 0.15 * Math.sin(now / 300 + k);
        setCell(f, i, "@*o%&"[k % 5], [c[0] * pulse, c[1] * pulse, c[2] * pulse]);
        if (k % 4 === 0) glow(f, (col + 0.5) * CW, (row + 0.5) * CH, 12, c, 0.25);
      } else {
        const slope = sway - prev;
        const g = 110 + 60 * hash(k, h);
        setCell(f, i, Math.abs(slope) < 0.25 ? "|" : slope > 0 ? "/" : "\\", [40, g, 60]);
      }
      prev = sway;
    }
  }

  // petals carried across by the wind, and a few fireflies
  for (let k = 0; k < 34; k++) {
    const x = (hash(k, 7) * COLS * CW + now * 0.05 * (0.6 + hash(k, 8))) % (COLS * CW);
    const y = 240 + hash(k, 9) * 200 + Math.sin(now / 500 + k) * 14;
    const c = FLOWER_COLORS[k % FLOWER_COLORS.length];
    const col = Math.floor(x / CW);
    const row = Math.floor(y / CH);
    if (row >= 0 && row < ROWS) setCell(f, row * COLS + col, "'.,`*"[k % 5], c);
  }
  for (let k = 0; k < 12; k++) {
    const x = (vnoise(k * 3.1, now / 4000) * 1.4 - 0.2) * COLS * CW;
    const y = 200 + vnoise(k * 7.3, now / 5000 + 9) * 180;
    const on = Math.sin(now / 400 + k * 1.9);
    if (on > 0.2 && x > 0 && x < COLS * CW) {
      glow(f, x, y, 14, [220, 255, 120], 0.35 * on);
      setCell(f, Math.floor(y / CH) * COLS + Math.floor(x / CW), "*", [230, 255, 140]);
    }
  }

  // fade in from black after the cut
  const fade = smooth((t - VOID_PEACE) / 8);
  for (let i = 0; i < N; i++) {
    f.r[i] *= fade;
    f.g[i] *= fade;
    f.b[i] *= fade;
  }
};

const composeFrame = (g: Game, anim: Anim, alpha: number, now: number, name: string): Frame => {
  setGrid(BASE_COLS, BASE_ROWS);
  const bg = getBackground();
  const f = takeFrame();
  for (let i = 0; i < N; i++) {
    f.ch[i] = bg.ch[i];
    f.r[i] = bg.r[i];
    f.g[i] = bg.g[i];
    f.b[i] = bg.b[i];
  }

  // the lake: drifting ripples and a shimmering path of moonlight that widens toward us
  for (let row = HORIZON; row < HORIZON + 12; row++) {
    const depth = (row - HORIZON) / 10;
    const width = 3 + depth * 10;
    const wobble = Math.sin(row * 1.7 + now / 450) * (1 + depth * 2);
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      if (!water[i]) continue;
      const ripple = vnoise(col * 0.15 - now / 2500, row * 0.9 + now / 5000);
      const shimmer = vnoise(col * 0.35 + now / 700, row * 1.3 - now / 350);
      // light breaks into horizontal streaks, like moonlight on moving ripples
      const streak = 0.35 + 0.65 * vnoise(col * 0.6 - now / 900, row * 2.1);
      const off = Math.abs(col - MOON_COL - wobble) / width;
      const path = clamp01(1 - off) ** 0.7 * (0.5 + 0.7 * shimmer) * streak;
      const halo = clamp01(1 - off / 2.2) * 0.35;
      const base: RGB = [
        22 + 30 * ripple + 60 * halo,
        36 + 40 * ripple + 70 * halo,
        70 + 60 * ripple + 25 * depth + 90 * halo,
      ];
      if (path > 0.18) {
        const l = Math.min(1, path * 1.3);
        const sparkle = shimmer > 0.78 && hash(col, row + Math.floor(now / 160)) > 0.5;
        setCell(f, i, sparkle ? "*" : "-~=#"[Math.floor(l * 3.99)], [
          lerp(base[0], 235, l),
          lerp(base[1], 238, l),
          lerp(base[2], 250, l),
        ]);
      } else {
        setCell(f, i, ripple > 0.62 ? "~" : ripple > 0.4 ? "-" : ".", base);
      }
    }
  }

  // drifting fog over the hills, the lake and the far grass
  for (let row = 8; row < 32; row++) {
    for (let col = 0; col < COLS; col++) {
      const n = vnoise(col * 0.06 + now / 4000, row * 0.18) * vnoise(col * 0.11 - now / 6000, row * 0.3 + 3);
      if (n > 0.3) {
        const i = row * COLS + col;
        const l = Math.min(0.55, (n - 0.3) * 1.6) * (1 - Math.abs(row - 22) / 14) * (water[i] ? 0.5 : 1);
        if (l > 0.05) {
          f.r[i] = lerp(f.r[i], 170, l);
          f.g[i] = lerp(f.g[i], 180, l);
          f.b[i] = lerp(f.b[i], 195, l);
          if (f.ch[i] === " " || l > 0.3) f.ch[i] = lumChar(l * 0.4);
        }
      }
    }
  }

  // smooth everything between engine ticks
  const dt = Math.min(100, now - (anim.last || now));
  anim.last = now;
  const k = 1 - Math.pow(0.0005, dt / 1000);
  anim.pose = blendPose(anim.pose, targetPose(g), Math.min(1, k * 3));
  const b = anim.bug;
  b.lunge = lerp(b.lunge, g.biteT ? 1 : 0, k * 3);
  b.open = lerp(b.open, g.biteT ? 1 : g.over === "" && g.t % 40 < 4 ? 0.4 : 0, k * 3);
  b.recoil = lerp(b.recoil, g.bugHitT ? 1 : 0, k * 4);
  if (g.bc !== anim.lastBc) b.legPhase += 0.9;
  anim.lastBc = g.bc;
  b.legPhase += dt / 400;

  const jc = lerp(g.prev.jc, g.jc, alpha);
  const bc = lerp(g.prev.bc, g.bc, alpha);
  const y = Math.max(0, lerp(g.prev.y, g.y, alpha));
  const mageX = jc * PX_PER_X;
  const bugX = bc * PX_PER_X;
  const lift = y * PX_PER_Y;
  const dir = bc >= jc ? 1 : -1;

  // the secret technique plays as a cutscene
  const voidT = g.voidT ? g.voidT + alpha : 0;
  if (voidT >= VOID_PEACE) {
    composePeace(f, voidT, now);
    return f;
  }
  if (voidT >= VOID_CLOSEUP && voidT < VOID_ZOOM) {
    composeCloseup(f, dir, voidT, now);
    return f;
  }
  if (voidT) {
    const dim = 1 - 0.65 * Math.min(1, voidT / 8) * (voidT > VOID_END - 6 ? Math.max(0, (VOID_END - voidT) / 6) : 1);
    for (let i = 0; i < N; i++) {
      f.r[i] *= dim;
      f.g[i] *= dim;
      f.b[i] *= dim * 1.05;
    }
  }
  const bugGone = g.bugGoneT > 0;
  if (bugGone && voidT > VOID_END) {
    eraseTrench(f, g.voidFrom * PX_PER_X, g.voidDir > 0 ? COLS * CW + 60 : -60, GROUND_Y - 64, 54, now);
  }

  if (!bugGone) shadow(f, bugX - dir * 10, 85);
  shadow(f, mageX, Math.max(18, 46 - lift * 0.12));
  if (g.tpFrom !== null) blinkSparks(f, g.tpFrom * PX_PER_X, GROUND_Y, TELEPORT_CD - g.tpCd, now);

  if (!bugGone) {
    drawBug({ f, flash: g.bugHitT ? 0.45 : 0, flipAt: dir < 0 ? bugX : undefined }, b, bugX, GROUND_Y, now, g.over === "win");
  }
  const blinkFlash = g.tpCd > TELEPORT_CD - 3 ? 0.3 : 0;
  drawMage(
    { f, flash: g.youHitT ? 0.45 : blinkFlash, flipAt: dir > 0 ? undefined : mageX },
    anim.pose,
    mageX,
    GROUND_Y - lift,
    now,
    g.blastCd > 17,
    g.over === "lose",
  );

  if (g.voidT && voidT < VOID_END) drawVoid(f, g, alpha, mageX, GROUND_Y - lift, now);
  if (bugGone) bugFragments(f, bugX, GROUND_Y - 60, voidT - g.bugGoneT, g.voidDir);

  if (g.shot !== null) {
    const sx = lerp(g.prev.shot ?? g.shot, g.shot, alpha) * PX_PER_X;
    const sy = GROUND_Y - 112;
    const p = { f, flash: 0 };
    ball(p, sx, sy, 14, BLAST_MAT);
    capsule(p, sx - g.shotDir * 40, sy, sx - g.shotDir * 12, sy, 5, BLAST_MAT);
    glow(f, sx, sy, 40, BLAST_MAT.c);
  }
  if (g.spit !== null) {
    const sx = lerp(g.prev.spit ?? g.spit, g.spit, alpha) * PX_PER_X;
    const sy = GROUND_Y - 58;
    ball({ f, flash: 0 }, sx, sy, 7, SPIT_MAT);
    glow(f, sx, sy, 20, SPIT_MAT.c);
  }

  text(f, name === "YOU" ? "You" : "Jose", mageX, GROUND_Y - lift - 215, [225, 225, 235]);
  if (!bugGone) text(f, "Bug", bugX + dir * 10, GROUND_Y - 140, [225, 225, 235]);
  return f;
};

const colorCache = new Map<number, string>();
const colorOf = (r: number, g: number, b: number) => {
  const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let s = colorCache.get(key);
  if (!s) {
    s = `rgb(${(key >> 10) << 3},${((key >> 5) & 31) << 3},${(key & 31) << 3})`;
    colorCache.set(key, s);
  }
  return s;
};

// ---- putting the frame on screen ----
// The whole frame (a character and a color per cell) is packed into a 120x50 texture and drawn
// with one WebGL quad: the GPU looks up each cell's glyph in a fixed white glyph sheet and tints it.
// One small upload and one draw call per frame, instead of thousands of text draws.

const BG: RGB = [5, 6, 11];
const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";
// printable ASCII, so a glyph's index is just its char code minus 32
const GLYPHS = Array.from({ length: 95 }, (_, k) => String.fromCharCode(32 + k));
const SHEET_COLS = 16;
const SHEET_ROWS = Math.ceil(GLYPHS.length / SHEET_COLS);

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uCells;
uniform sampler2D uSheet;
uniform vec2 uGrid;
uniform vec2 uView;
uniform vec2 uOffset;
uniform vec2 uSheetGrid;
uniform vec2 uShake;
uniform vec3 uBg;
uniform float uDream;

// a cell's color, weighted toward bright cells so they bleed light into their neighbors
vec3 bright(vec2 cell) {
  vec3 c = texture2D(uCells, (cell + 0.5) / uGrid).rgb;
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  return c * l * l;
}
varying vec2 vUv;
void main() {
  vec2 p = vUv * uView + uOffset + uShake;
  vec2 cell = floor(p);
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.x || cell.y >= uGrid.y) {
    gl_FragColor = vec4(uBg, 1.0);
    return;
  }
  vec4 d = texture2D(uCells, (cell + 0.5) / uGrid);
  float g = floor(d.a * 255.0 + 0.5);
  vec2 slot = vec2(mod(g, uSheetGrid.x), floor(g / uSheetGrid.x));
  float ink = texture2D(uSheet, (slot + fract(p)) / uSheetGrid).a;
  vec3 col = mix(uBg, d.rgb, ink);
  if (uDream > 0.0) {
    // soft glow: light from bright neighbors spills into the dark around them
    vec2 f = fract(p) - 0.5;
    vec3 halo = bright(cell + vec2(1.0, 0.0)) * max(0.0, f.x) + bright(cell - vec2(1.0, 0.0)) * max(0.0, -f.x)
      + bright(cell + vec2(0.0, 1.0)) * max(0.0, f.y) + bright(cell - vec2(0.0, 1.0)) * max(0.0, -f.y)
      + (bright(cell + vec2(1.0, 1.0)) + bright(cell + vec2(-1.0, 1.0)) + bright(cell + vec2(1.0, -1.0)) + bright(cell + vec2(-1.0, -1.0))) * 0.12
      + bright(cell) * 0.35;
    col += halo * 0.55 * uDream * (1.0 - ink * 0.6);
    // a storybook night: shadows lean violet, highlights lean moonlit cream, color softened a touch
    float l = dot(col, vec3(0.3, 0.55, 0.15));
    col = mix(col, vec3(l), 0.1 * uDream);
    col += uDream * (vec3(0.045, 0.025, 0.085) * (1.0 - l) + vec3(0.035, 0.025, 0.0) * l);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

interface GlScreen {
  gl: WebGLRenderingContext;
  cells: WebGLTexture;
  sheet: WebGLTexture;
  grid: WebGLUniformLocation | null;
  view: WebGLUniformLocation | null;
  offset: WebGLUniformLocation | null;
  dream: WebGLUniformLocation | null;
  shake: WebGLUniformLocation | null;
  bytes: Uint8ClampedArray;
  sheetKey: string;
}

const screens = new WeakMap<HTMLCanvasElement, GlScreen | null>();

// Glyphs are drawn at the real device-pixel size of a cell, so small and large characters
// both stay crisp. px = device pixels per grid pixel.
const drawGlyphSheet = (px: number) => {
  const cw = Math.max(1, Math.round(CW * px));
  const ch = Math.max(1, Math.round(CH * px));
  const sheet = document.createElement("canvas");
  sheet.width = SHEET_COLS * cw;
  sheet.height = SHEET_ROWS * ch;
  const ctx = sheet.getContext("2d");
  if (!ctx) return sheet;
  ctx.font = `${8 * px}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  GLYPHS.forEach((g, k) => ctx.fillText(g, (k % SHEET_COLS) * cw + cw / 2, Math.floor(k / SHEET_COLS) * ch + ch / 2));
  return sheet;
};

const setupGl = (canvas: HTMLCanvasElement): GlScreen | null => {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = (unit: number) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const sheet = texture(1);
  const cells = texture(0);
  if (!sheet || !cells) return null;

  gl.uniform1i(gl.getUniformLocation(prog, "uCells"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uSheet"), 1);
  const grid = gl.getUniformLocation(prog, "uGrid");
  gl.uniform2f(gl.getUniformLocation(prog, "uSheetGrid"), SHEET_COLS, SHEET_ROWS);
  gl.uniform3f(gl.getUniformLocation(prog, "uBg"), BG[0] / 255, BG[1] / 255, BG[2] / 255);
  return {
    gl,
    cells,
    sheet,
    grid,
    view: gl.getUniformLocation(prog, "uView"),
    offset: gl.getUniformLocation(prog, "uOffset"),
    dream: gl.getUniformLocation(prog, "uDream"),
    shake: gl.getUniformLocation(prog, "uShake"),
    bytes: new Uint8ClampedArray(N * 4),
    sheetKey: "",
  };
};

// Plain canvas fallback for browsers without WebGL.
const paint2d = (canvas: HTMLCanvasElement, f: Frame, px: number) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(px, 0, 0, px, 0, 0);
  ctx.fillStyle = `rgb(${BG.join(",")})`;
  ctx.fillRect(0, 0, f.viewCols * CW, f.viewRows * CH);
  ctx.translate(-f.offX * CW, -f.offY * CH);
  if (f.shake) ctx.translate((Math.random() - 0.5) * f.shake * 2, (Math.random() - 0.5) * f.shake * 2);
  ctx.font = `8px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let current = "";
  for (let i = 0; i < N; i++) {
    const ch = f.ch[i];
    if (ch === " ") continue;
    const c = colorOf(f.r[i] | 0, f.g[i] | 0, f.b[i] | 0);
    if (c !== current) {
      ctx.fillStyle = c;
      current = c;
    }
    ctx.fillText(ch, (i % COLS) * CW + CW / 2, Math.floor(i / COLS) * CH + CH / 2);
  }
};

const paint = (canvas: HTMLCanvasElement, f: Frame) => {
  // match the canvas to the device pixels it covers, so each character is drawn at its true size
  const dpr = window.devicePixelRatio || 1;
  const gridW = f.viewCols * CW;
  const gridH = f.viewRows * CH;
  const fit = Math.min(canvas.clientWidth / gridW || 1, canvas.clientHeight / gridH || Infinity);
  const px = Math.max(0.25, (Number.isFinite(fit) && fit > 0 ? fit : 1) * dpr);
  const w = Math.round(gridW * px);
  const h = Math.round(gridH * px);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  let screen = screens.get(canvas);
  if (screen === undefined) {
    screen = setupGl(canvas);
    screens.set(canvas, screen);
  }
  if (!screen) {
    paint2d(canvas, f, px);
    return;
  }
  const sheetKey = `${Math.round(CW * px)}x${Math.round(CH * px)}`;
  if (screen.sheetKey !== sheetKey) {
    screen.gl.activeTexture(screen.gl.TEXTURE1);
    screen.gl.bindTexture(screen.gl.TEXTURE_2D, screen.sheet);
    screen.gl.texImage2D(screen.gl.TEXTURE_2D, 0, screen.gl.RGBA, screen.gl.RGBA, screen.gl.UNSIGNED_BYTE, drawGlyphSheet(px));
    screen.sheetKey = sheetKey;
  }
  if (screen.bytes.length !== N * 4) screen.bytes = new Uint8ClampedArray(N * 4);
  const { gl, bytes } = screen;
  for (let i = 0; i < N; i++) {
    const code = f.ch[i].charCodeAt(0) - 32;
    const o = i * 4;
    bytes[o] = f.r[i];
    bytes[o + 1] = f.g[i];
    bytes[o + 2] = f.b[i];
    bytes[o + 3] = code >= 0 && code < GLYPHS.length ? code : 31; // anything unknown shows as "?"
  }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(screen.grid, COLS, ROWS);
  gl.uniform2f(screen.view, f.viewCols, f.viewRows);
  gl.uniform2f(screen.offset, f.offX, f.offY);
  gl.uniform1f(screen.dream, f.dream);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, screen.cells);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(bytes.buffer));
  const shake = f.shake ? f.shake / CW : 0;
  gl.uniform2f(screen.shake, (Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2 * (CW / CH));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

// Fixed-step engine, rendered every display frame with positions interpolated between ticks.
const useAsciiLoop = (
  canvas: React.RefObject<HTMLCanvasElement>,
  tick: () => void,
  render: (alpha: number, now: number) => Frame,
  active: boolean,
) => {
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      if (active) {
        acc += Math.min(250, now - last);
        let ticked = false;
        while (acc >= TICK_MS) {
          tickRef.current();
          acc -= TICK_MS;
          ticked = true;
        }
        if (ticked) redraw();
      }
      last = now;
      if (canvas.current) {
        paint(canvas.current, renderRef.current(active ? acc / TICK_MS : 1, now));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, canvas]);

  return redraw;
};

const useFightLoop = (
  canvas: React.RefObject<HTMLCanvasElement>,
  game: React.MutableRefObject<Game>,
  tick: () => void,
  active: boolean,
  name: string,
) => {
  const anim = useRef<Anim>(newAnim());
  return useAsciiLoop(canvas, tick, (alpha, now) => composeFrame(game.current, anim.current, alpha, now, name), active);
};

// ---- overlays: hud, banners and hit text in crisp html on top of the canvas ----

const bar = (hp: number) => `[${"#".repeat(hp)}${"-".repeat(10 - hp)}]`;

const Overlay = ({ g, name }: { g: Game; name: string }) => {
  let banner = "";
  if (g.over) banner = g.over === "win" ? `K.O.  ${name} WIN${name === "YOU" ? "" : "S"}` : "K.O.  BUG WINS";
  else if (g.t < INTRO) banner = g.t < 8 ? "ROUND 1" : "FIGHT!";
  const cutscene = g.voidT > 0;
  const secret = cutscene && g.voidT < VOID_END;
  const said = VOID_SAYS.slice(0, Math.max(0, Math.floor((g.voidT - VOID_LINE) * 2.2)));

  return (
    <div className="pointer-events-none absolute inset-0 font-mono">
      {cutscene && (
        <>
          <div className="absolute inset-x-0 top-0 h-[9%] bg-black" />
          <div className="absolute inset-x-0 bottom-0 h-[11%] bg-black" />
        </>
      )}
      {cutscene && g.voidT >= VOID_LINE && g.voidT < VOID_ZOOM && (
        <div className="absolute inset-x-0 bottom-[2.5%] text-center text-[13px] italic text-zinc-100">{said}</div>
      )}
      <div className={`absolute inset-x-3 top-2 flex justify-between text-[11px] ${cutscene ? "hidden" : ""}`}>
        <span>
          <span className="text-green-400">{name}</span> <span className="text-rose-400">{bar(g.php)}</span>
        </span>
        <span>
          <span className="text-orange-400">{bar(g.bhp)}</span> <span className="text-green-400">BUG</span>
        </span>
      </div>
      {secret && g.voidT < VOID_CLOSEUP + 6 && (
        <div className="absolute inset-x-0 top-[12%] text-center text-[10px] tracking-[0.5em] text-zinc-300">SECRET TECHNIQUE</div>
      )}
      {secret && g.voidT >= VOID_ZOOM && g.voidT < VOID_PEACE && (
        <div className="absolute inset-x-0 top-[14%] text-center text-3xl font-bold tracking-[0.6em] text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]">
          VOID
        </div>
      )}
      {banner && !secret && (
        <div className={`absolute inset-x-0 text-center ${cutscene ? "top-[11%]" : "top-[22%]"}`}>
          <div className="text-yellow-300 text-lg font-bold tracking-[0.3em] drop-shadow">{banner}</div>
          {g.over && name === "YOU" && <div className="text-zinc-300 text-[11px] mt-1">press R to play again</div>}
        </div>
      )}
      {!banner && !secret && g.fx && (
        <div
          className="absolute top-[30%] -translate-x-1/2 text-yellow-300 text-sm font-bold"
          style={{ left: `${(g.fx.x / W) * 100}%` }}
        >
          {g.fx.text}
        </div>
      )}
    </div>
  );
};

const Stage = ({
  canvas,
  children,
  grid = [BASE_COLS, BASE_ROWS],
  fill = false,
  boxRef,
}: {
  canvas: React.RefObject<HTMLCanvasElement>;
  children: React.ReactNode;
  grid?: [number, number];
  fill?: boolean;
  boxRef?: React.RefObject<HTMLDivElement>;
}) => (
  <div ref={boxRef} className={`relative overflow-hidden rounded-sm bg-[#05060b] ${fill ? "h-full w-full" : ""}`}>
    <canvas
      ref={canvas}
      className={fill ? "block h-full w-full object-contain" : "block w-full h-auto"}
      style={fill ? undefined : { aspectRatio: `${grid[0] * CW} / ${grid[1] * CH}` }}
    />
    {children}
  </div>
);

// ---- fullscreen ----
// The game lives in its own DOM node so it can move to the top of the page (and into real
// fullscreen) without React remounting it: the fight or the world carries on where it was.

const FullscreenContext = createContext<{ full: boolean; toggle: () => void }>({ full: false, toggle: () => {} });

const FULL_HOST = "fixed inset-0 z-[9999] flex flex-col bg-[#05060b] p-1 sm:p-2";

const GameHost = ({ children }: { children: React.ReactNode }) => {
  const [full, setFull] = useState(false);
  const host = useMemo(() => document.createElement("div"), []);
  const slot = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = full ? document.body : slot.current;
    if (target && host.parentNode !== target) target.appendChild(host);
    host.className = full ? FULL_HOST : "";
    // moving the node drops keyboard focus; hand it back so play continues
    host.querySelector<HTMLElement>("[tabindex='0']")?.focus({ preventScroll: true });
  }, [full, host]);
  useEffect(() => () => host.remove(), [host]);
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      setFull(false);
      return;
    }
    // move first: the browser drops fullscreen if the element moves afterwards.
    // Without the Fullscreen API (iPhone) it still fills the page.
    document.body.appendChild(host);
    host.className = FULL_HOST;
    host.requestFullscreen?.().catch(() => {});
    setFull(true);
  };

  return (
    <FullscreenContext.Provider value={{ full, toggle }}>
      <div ref={slot} />
      {createPortal(children, host)}
    </FullscreenContext.Provider>
  );
};

const FullscreenButton = ({ children }: { children?: React.ReactNode }) => {
  const { full, toggle } = useContext(FullscreenContext);
  return (
    <div className="mb-1 flex shrink-0 items-center justify-end gap-1">
      {children}
      <button
        type="button"
        onClick={toggle}
        className="rounded border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-white/10"
      >
        {full ? "⤡ exit fullscreen" : "⛶ fullscreen"}
      </button>
    </div>
  );
};

// ---- playable mode ----

// One touch/mouse button. Pointer capture keeps a held button held even if the thumb drifts,
// and each finger is tracked separately, so you can hold a direction while attacking.
const Pad = ({
  onDown,
  onUp,
  className,
  children,
  label,
  pressedClass = "scale-90 brightness-125",
}: {
  onDown: () => void;
  onUp?: () => void;
  className: string;
  children: React.ReactNode;
  label: string;
  pressedClass?: string;
}) => {
  const [pressed, setPressed] = useState(false);
  const release = () => {
    setPressed(false);
    onUp?.();
  };
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setPressed(true);
        navigator.vibrate?.(8);
        onDown();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => pressed && release()}
      onContextMenu={(e) => e.preventDefault()}
      className={`select-none touch-none transition duration-75 ${pressed ? pressedClass : ""} ${className}`}
    >
      {children}
    </button>
  );
};

const STICK_DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// A thumbstick in an eight-notch gate: drag from anywhere on it, and the direction snaps
// to the nearest of eight. Pointer capture keeps it tracking even if the thumb leaves the pad.
const Joystick = ({ keys, onUp }: { keys: React.MutableRefObject<Keys>; onUp: () => void }) => {
  const base = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const [sector, setSector] = useState(-1);

  const apply = (dx: number, dy: number) => {
    const k = keys.current;
    const wasUp = k.up;
    if (Math.hypot(dx, dy) < 0.3) {
      k.left = k.right = k.up = k.down = false;
      setSector(-1);
    } else {
      const s8 = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
      const [ex, ey] = STICK_DIRS[s8];
      k.right = ex > 0;
      k.left = ex < 0;
      k.down = ey > 0;
      k.up = ey < 0;
      setSector(s8);
    }
    if (k.up && !wasUp) onUp();
  };
  const track = (e: React.PointerEvent) => {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    const rad = r.width / 2;
    let dx = (e.clientX - (r.left + rad)) / rad;
    let dy = (e.clientY - (r.top + rad)) / rad;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    setKnob([dx, dy]);
    apply(dx, dy);
  };
  const release = () => {
    dragging.current = false;
    setKnob([0, 0]);
    apply(0, 0);
  };

  return (
    <div
      ref={base}
      aria-label="movement stick"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        navigator.vibrate?.(8);
        track(e);
      }}
      onPointerMove={(e) => dragging.current && track(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      className="relative aspect-square w-[34%] max-w-[140px] shrink-0 rounded-full touch-none select-none cursor-grab shadow-[inset_0_3px_8px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.06)]"
      style={{ background: "repeating-conic-gradient(from -22.5deg, #3a3a41 0deg 45deg, #303036 45deg 90deg)" }}
    >
      {/* the eight notches of the gate; the active one lights up */}
      {STICK_DIRS.map(([ex, ey], i) => (
        <span
          key={i}
          className={`absolute h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${sector === i ? "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.9)]" : "bg-zinc-600"}`}
          style={{ left: `${50 + (ex / Math.hypot(ex, ey)) * 41}%`, top: `${50 + (ey / Math.hypot(ex, ey)) * 41}%` }}
        />
      ))}
      <span
        className="absolute left-1/2 top-1/2 h-[46%] w-[46%] rounded-full bg-gradient-to-b from-zinc-500 to-zinc-700 shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,255,255,0.15)] ring-1 ring-black/40"
        style={{ transform: `translate(-50%, -50%) translate(${knob[0] * 62}%, ${knob[1] * 62}%)` }}
      >
        <span className="absolute inset-[22%] rounded-full bg-zinc-800/70 shadow-[inset_0_2px_3px_rgba(0,0,0,0.6)]" />
      </span>
    </div>
  );
};

const ActionButton = ({
  letter,
  name,
  tone,
  onDown,
  dim = false,
}: {
  letter: string;
  name: string;
  tone: string;
  onDown: () => void;
  dim?: boolean;
}) => (
  <Pad
    label={`${letter} ${name}`}
    onDown={onDown}
    className={`h-[88%] w-[88%] rounded-full flex flex-col items-center justify-center font-mono text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.5)] ${tone} ${dim ? "opacity-35" : ""}`}
  >
    <span className="text-base font-bold leading-none">{letter}</span>
    <span className="text-[7px] sm:text-[8px] uppercase tracking-wider opacity-80 leading-none mt-0.5">{name}</span>
  </Pad>
);

type PadAction = "jump" | "punch" | "blast" | "blink" | "void" | "mount";

const Controller = ({ keys, press, voidName, voidDim, restart, onExit, mount }: {
  keys: React.MutableRefObject<Keys>;
  press: (action: PadAction) => void;
  voidName: string;
  voidDim: boolean;
  restart: () => void;
  onExit: () => void;
  // the open world adds a horse button; its label shows whether you're riding
  mount?: string;
}) => (
  <div className="mt-3 rounded-[28px] border border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900 px-3 py-3 sm:px-6 shadow-[0_6px_18px_rgba(0,0,0,0.45)] select-none touch-none">
    {/* sizes are shares of the width so it fits a phone and a desktop window alike */}
    <div className="flex items-center justify-between gap-2">
      {/* 8-way thumbstick: up jumps in the arena, down blocks; in the world it walks */}
      <Joystick keys={keys} onUp={() => press("jump")} />

      {/* select / start */}
      <div className="flex flex-col items-center gap-2 min-w-0">
        <Pad label="restart" onDown={restart} className="rounded-full bg-zinc-600 px-2.5 py-1.5 text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-zinc-200 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]">
          restart
        </Pad>
        <Pad label="exit" onDown={onExit} className="rounded-full bg-zinc-600 px-2.5 py-1.5 text-[8px] sm:text-[9px] font-mono uppercase tracking-wider text-zinc-200 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)]">
          exit
        </Pad>
      </div>

      {/* action buttons in a diamond, the special on the bottom */}
      <div className="grid grid-cols-3 grid-rows-3 place-items-center aspect-square w-[40%] max-w-[168px] shrink-0">
        {mount ? (
          <ActionButton letter="H" name={mount} tone="bg-gradient-to-b from-zinc-200 to-zinc-400 !text-zinc-800" onDown={() => press("mount")} />
        ) : (
          <span />
        )}
        <ActionButton letter="T" name="blink" tone="bg-violet-600" onDown={() => press("blink")} />
        <span />
        <ActionButton letter="V" name="punch" tone="bg-rose-600" onDown={() => press("punch")} />
        <span />
        <ActionButton letter="F" name="blast" tone="bg-red-700" onDown={() => press("blast")} />
        <span />
        <ActionButton
          letter="Z"
          name={voidName}
          tone="bg-gradient-to-br from-blue-500 via-purple-600 to-red-500 ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(168,85,247,0.8)]"
          dim={voidDim}
          onDown={() => press("void")}
        />
        <span />
      </div>
    </div>
  </div>
);

// Both modes share these: buttons and keys just raise "want" flags the engine reads next tick.
interface Wants {
  wantJump: boolean;
  wantPunch: boolean;
  wantBlast: boolean;
  wantTeleport: boolean;
  wantVoid: boolean;
  wantMount?: boolean;
}

const pressOn = (w: Wants, action: PadAction) => {
  if (action === "jump") w.wantJump = true;
  else if (action === "punch") w.wantPunch = true;
  else if (action === "blast") w.wantBlast = true;
  else if (action === "blink") w.wantTeleport = true;
  else if (action === "mount") w.wantMount = true;
  else w.wantVoid = true;
};

// Arrow keys, V F T Z; returns true when the key was one of ours.
const handleKey = (e: React.KeyboardEvent, down: boolean, keys: Keys, w: Wants) => {
  const k = e.key.toLowerCase();
  const tap = down && !e.repeat;
  if (k === "arrowleft") keys.left = down;
  else if (k === "arrowright") keys.right = down;
  else if (k === "arrowdown") keys.down = down;
  else if (k === "arrowup") {
    keys.up = down;
    if (down) w.wantJump = true;
  }
  else if (k === "v") { if (tap) w.wantPunch = true; }
  else if (k === "f") { if (tap) w.wantBlast = true; }
  else if (k === "t") { if (tap) w.wantTeleport = true; }
  else if (k === "z" || k === "4") { if (tap) w.wantVoid = true; }
  else if (k === "h" || k === "5") { if (tap) w.wantMount = true; }
  else if (k === "1") { if (tap) w.wantPunch = true; }
  else if (k === "2") { if (tap) w.wantBlast = true; }
  else if (k === "3") { if (tap) w.wantTeleport = true; }
  else return false;
  return true;
};

const FightGame = ({ onExit, onWorld }: { onExit: () => void; onWorld: () => void }) => {
  const { full } = useContext(FullscreenContext);
  const game = useRef<Game>(newGame());
  const keys = useRef<Keys>({ left: false, right: false, up: false, down: false });
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [focused, setFocused] = useState(false);
  const redraw = useFightLoop(canvas, game, () => step(game.current, keys.current), focused, "YOU");

  useEffect(() => box.current?.focus({ preventScroll: true }), []);

  const restart = () => {
    game.current = newGame();
    redraw();
  };

  // exit waits a beat: three quick taps slip out into the open world instead
  const exitTaps = useRef<number[]>([]);
  const exitTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);
  const tapExit = () => {
    const now = performance.now();
    exitTaps.current = [...exitTaps.current.filter((t) => now - t < 900), now];
    window.clearTimeout(exitTimer.current);
    if (exitTaps.current.length >= 3) {
      exitTaps.current = [];
      onWorld();
    } else {
      exitTimer.current = window.setTimeout(onExit, 400);
    }
  };

  const setKey = (e: React.KeyboardEvent, down: boolean) => {
    const g = game.current;
    const k = e.key.toLowerCase();
    if (handleKey(e, down, keys.current, g)) e.preventDefault();
    else if (k === "r") { if (down && g.over) restart(); e.preventDefault(); }
    else if (k === "escape") { if (down) tapExit(); e.preventDefault(); }
  };

  const releaseAll = () => {
    keys.current = { left: false, right: false, up: false, down: false };
  };

  return (
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={(e) => setKey(e, true)}
      onKeyUp={(e) => setKey(e, false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
          releaseAll();
        }
      }}
      className={`outline-none ${full ? "flex h-full flex-col" : ""}`}
    >
      <FullscreenButton />
      <div className={full ? "min-h-0 flex-1" : ""} onPointerDown={() => box.current?.focus({ preventScroll: true })}>
        <Stage canvas={canvas} fill={full}>
          <Overlay g={game.current} name="YOU" />
          {!focused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-green-400 font-mono text-xs cursor-pointer">
              paused, tap to play
            </div>
          )}
        </Stage>
      </div>

      {/* any press on the controller also resumes a paused game; in fullscreen on a desktop
          it steps aside so the game gets the whole screen */}
      <div className={full ? "hidden shrink-0 [@media(pointer:coarse)]:block" : ""} onPointerDownCapture={() => box.current?.focus({ preventScroll: true })}>
        <Controller
          keys={keys}
          press={(a) => pressOn(game.current, a)}
          voidName={game.current.voidUsed ? "used" : "void"}
          voidDim={game.current.voidUsed}
          restart={restart}
          onExit={tapExit}
        />
      </div>
      <p className={`mt-2 hidden text-[11px] text-muted-foreground ${full ? "" : "sm:block"}`}>
        keyboard: ← → move · ↑ jump (dodge spit) · ↓ block · V punch · F blast · T teleport behind the bug · Z void (once per round) · R restart · ESC exit
      </p>
    </div>
  );
};

// ---- secret open world: tap exit three times quickly in the arena ----
// An endless 3D landscape seen from above at an angle. Terrain height, biomes and scenery all
// come from noise of the world position, so nothing is stored; creatures spawn as you roam.

type Biome = "meadow" | "forest" | "lake" | "ruins" | "snow" | "desert";
type MobKind = "bug" | "slime" | "bat" | "golem";

const BIOMES: Record<Biome, { name: string; ground: RGB; glyphs: string; mobs: MobKind[] }> = {
  meadow: { name: "Moonlit Meadow", ground: [62, 128, 70], glyphs: ",.'`;:\"", mobs: ["slime", "bug", "slime"] },
  forest: { name: "Whispering Forest", ground: [50, 96, 52], glyphs: ",.'`;%&", mobs: ["bat", "bug", "bat"] },
  lake: { name: "Silver Lake", ground: [70, 120, 84], glyphs: ",.'`;:", mobs: ["slime", "bat", "slime"] },
  ruins: { name: "Old Ruins", ground: [96, 104, 88], glyphs: ".,:;o'`", mobs: ["golem", "bat", "golem"] },
  snow: { name: "Frost Peaks", ground: [200, 210, 226], glyphs: "~-.'`,", mobs: ["golem", "bat", "slime"] },
  desert: { name: "Glass Dunes", ground: [206, 170, 116], glyphs: "~-.,'`", mobs: ["bug", "golem", "bug"] },
};

const MOBS: Record<MobKind, { hp: number; r: number; name: string; tint: RGB }> = {
  bug: { hp: 6, r: 3.5, name: "Bug", tint: [200, 80, 50] },
  slime: { hp: 4, r: 1.8, name: "Slime", tint: [110, 230, 140] },
  bat: { hp: 3, r: 1.5, name: "Bat", tint: [170, 120, 210] },
  golem: { hp: 14, r: 3, name: "Golem", tint: [170, 165, 150] },
};

// ---- the land: climate decides the biome, height makes hills, mountains, dunes and lakes ----

const WATER = 1.55;
// Large-scale value noise has contours that follow its grid, which makes boxy lakes and
// straight biome borders. Warping and rotating the coordinates first, and adding a finer
// layer, makes coastlines and borders wander naturally.
const naturalField = (x: number, z: number, f: number, s: number, detail = 0.3) => {
  const wx = x + ((vnoise(x * f * 1.7 + s, z * f * 1.7) - 0.5) * 0.9) / f;
  const wz = z + ((vnoise(x * f * 1.7, z * f * 1.7 + s) - 0.5) * 0.9) / f;
  const u = wx * 0.8 - wz * 0.6;
  const v = wx * 0.6 + wz * 0.8;
  const n = (1 - detail) * vnoise(u * f + s, v * f) + detail * vnoise(u * f * 2.3 - s, v * f * 2.3 + 11);
  return clamp01((n - 0.5) * 1.4 + 0.5);
};

// climate drifts slowly and smoothly: biomes are wide regions with few stray islands
const temperature = (x: number, z: number) => naturalField(x, z, 0.002, 100, 0.12);
const moisture = (x: number, z: number) => naturalField(x, z, 0.0025, -50, 0.12);

// Distance to the centerline of a slow noise's 0.5 contour, in world units (like trails).
const contourDist = (x: number, z: number, f: number, sx: number, sz: number) => {
  const n = vnoise(x * f + sx, z * f + sz);
  const gx = vnoise((x + 1) * f + sx, z * f + sz) - n;
  const gz = vnoise(x * f + sx, (z + 1) * f + sz) - n;
  return Math.abs(n - 0.5) / Math.max(1e-4, Math.sqrt(gx * gx + gz * gz));
};

// ---- castles: rare strongholds on their own coarse grid, each on a raised, flattened mound ----
const CASTLE_GRID = 380;
const CASTLE_R = 24;
const CASTLE_PARTS = {
  a: ["Raven", "Thorn", "Ash", "Wolf", "Moon", "Briar", "Storm", "Elder", "Grey", "Hollow", "Frost", "Amber"],
  b: ["moor", "hold", "crest", "gard", "wick", "fell", "mere", "spire", "haven", "watch", "vale", "ford"],
  c: ["Keep", "Castle", "Hold", "Citadel"],
};
const BANNER_COLORS: RGB[] = [[176, 40, 52], [52, 86, 170], [200, 160, 50], [70, 130, 70], [120, 60, 150]];

interface Castle {
  x: number;
  z: number;
  seed: number;
}

// The castle whose grid cell contains (x, z), if that cell has one.
const castleIn = (gx: number, gz: number): Castle | null => {
  const seed = gx * 48611 + gz * 96221;
  if (hash(seed, 1) > 0.45) return null;
  return { x: (gx + 0.3 + hash(seed, 2) * 0.4) * CASTLE_GRID, z: (gz + 0.3 + hash(seed, 3) * 0.4) * CASTLE_GRID, seed };
};
const castleNear = (x: number, z: number) => castleIn(Math.floor(x / CASTLE_GRID), Math.floor(z / CASTLE_GRID));
const castleSize = (c: Castle) => ({ HX: 15 + Math.floor(hash(c.seed, 12) * 5), HZ: 11 + Math.floor(hash(c.seed, 13) * 4) });

// Whether a castle's stonework stands at (x, z). The gate in the front wall is left open.
const castleBlocks = (x: number, z: number) => {
  const c = castleNear(x, z);
  if (!c) return false;
  const { HX, HZ } = castleSize(c);
  const lx = x - c.x;
  const lz = z - c.z;
  if (Math.abs(lx) > HX + 4 || Math.abs(lz) > HZ + 4) return false;
  const T = 1.4;
  if (Math.abs(lz + HZ) < T && Math.abs(lx) <= HX + T) return true; // back wall
  if (Math.abs(lz - HZ) < T && Math.abs(lx) <= HX + T && Math.abs(lx) > 3.2) return true; // front wall, gate gap
  if (Math.abs(Math.abs(lx) - HX) < T && Math.abs(lz) <= HZ + T) return true; // side walls
  if (Math.hypot(Math.abs(lx) - HX, Math.abs(lz) - HZ) < 3) return true; // corner towers
  if (Math.abs(lx) < 5.5 && Math.abs(lz + HZ * 0.3) < 3) return true; // the keep
  if (Math.hypot(lx + HX * 0.5, lz - HZ * 0.35) < 1.6) return true; // the well
  return false;
};

const castleName = (c: Castle) =>
  `${CASTLE_PARTS.a[Math.floor(hash(c.seed, 7) * 12)]}${CASTLE_PARTS.b[Math.floor(hash(c.seed, 8) * 12)]} ${CASTLE_PARTS.c[Math.floor(hash(c.seed, 9) * 4)]}`;

// Broad landforms first (wide plains, basins that hold big lakes, uplands), then each region's
// own character: rolling plains or rugged highlands with sharp ridges, stepped mesas, ravines,
// and long shallow rivers. Mountains and dunes come in long, wide ranges.
const landHeight = (x: number, z: number) => {
  const land = naturalField(x, z, 0.006, 31);
  const rugged = naturalField(x, z, 0.0035, 77, 0.1);
  const ridge = 1 - Math.abs(2 * vnoise(x * 0.012 + 5, z * 0.012 - 8) - 1);
  let h =
    0.5 +
    3.4 * land * land * (3 - 2 * land) +
    (0.6 + 1.6 * rugged) * vnoise(x * 0.02, z * 0.02) +
    0.3 * vnoise(x * 0.07 + 9, z * 0.07) +
    smooth((rugged - 0.55) / 0.3) * ridge * ridge * 3.2;
  // mesas: in some regions the land rises in flat steps with short cliffs between
  const mesa = smooth((vnoise(x * 0.004 + 300, z * 0.004 - 90) - 0.62) / 0.12);
  if (mesa > 0 && h > WATER + 0.3) {
    const t = h / 0.9;
    const terraced = (Math.floor(t) + smooth((t - Math.floor(t) - 0.72) / 0.28)) * 0.9;
    h = lerp(h, terraced, mesa);
  }
  // ravines cut through the high, rugged country
  const ravine = smooth((0.035 - Math.abs(vnoise(x * 0.01 + 700, z * 0.01) - 0.5)) / 0.035) * smooth((rugged - 0.45) / 0.2);
  if (ravine > 0) h = Math.max(Math.min(h, WATER + 0.25), h - ravine * 2.2);
  // long, winding, shallow rivers you can wade through
  const river = contourDist(x, z, 0.0035, 900, -400);
  if (river < 7) h = Math.min(h, lerp(WATER - 0.1, h, smooth((river - 2.5) / 4.5)));
  return h;
};

const heightAt = (x: number, z: number) => {
  let h = landHeight(x, z);
  const temp = temperature(x, z);
  const cold = smooth((0.34 - temp) / 0.14);
  if (cold > 0) {
    const ridge = 1 - Math.abs(2 * vnoise(x * 0.022 + 7, z * 0.022) - 1);
    h += cold * ridge * ridge * 5;
  }
  const hot = smooth((temp - 0.6) / 0.1);
  if (hot > 0) h += hot * (0.9 + 0.8 * Math.sin(x * 0.11 + vnoise(z * 0.03, x * 0.03) * 4));
  // a castle sits on a raised, flattened mound (an island, if it's in a lake)
  const castle = castleNear(x, z);
  if (castle) {
    const d = Math.hypot(x - castle.x, z - castle.z);
    if (d < CASTLE_R + 8) {
      const top = Math.max(WATER + 0.9, landHeight(castle.x, castle.z) + 0.5);
      h = lerp(h, top, smooth((CASTLE_R + 8 - d) / 8));
    }
  }
  return h;
};

const biomeAt = (x: number, z: number): Biome => {
  if (heightAt(x, z) < WATER + 0.1) return "lake";
  if (naturalField(x, z, 0.0035, 300, 0.12) > 0.84) return "ruins";
  const temp = temperature(x, z);
  if (temp < 0.3) return "snow";
  const wet = moisture(x, z);
  if (temp > 0.62 && wet < 0.55) return "desert";
  if (wet > 0.58) return "forest";
  return "meadow";
};

const isWater = (x: number, z: number) => heightAt(x, z) < WATER;
// rivers and shallows can be waded; only deep water stops you
const isDeepWater = (x: number, z: number) => heightAt(x, z) < WATER - 0.2;
// what stops anyone walking: deep water and castle stonework
const blocked = (x: number, z: number) => isDeepWater(x, z) || castleBlocks(x, z);

// Distance (in world units) to the nearest trail. A trail follows where a slow noise crosses
// one value; dividing by the slope of the noise keeps trails a steady width instead of
// smearing into wide patches where the noise flattens out.
const TRAIL_F = 0.012;
const trailNoise = (x: number, z: number) => vnoise(x * TRAIL_F + 400, z * TRAIL_F - 300);
const trailDist = (x: number, z: number) => {
  const n = trailNoise(x, z);
  const gx = trailNoise(x + 1, z) - n;
  const gz = trailNoise(x, z + 1) - n;
  return Math.abs(n - 0.5) / Math.max(1e-4, Math.sqrt(gx * gx + gz * gz));
};

// ---- engine ----

interface Mob {
  id: number;
  kind: MobKind;
  chunk: string;
  x: number;
  z: number;
  y: number;
  vy: number;
  prevX: number;
  prevZ: number;
  prevY: number;
  hp: number;
  hitT: number;
  atkT: number;
  atkCd: number;
  phase: number;
  deadT: number;
  anim: BugAnim;
}

interface WorldShot {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  dx: number;
  dz: number;
  life: number;
}

type LootKind = "tonic" | "shard" | "coin";

const LOOT: Record<LootKind, { name: string; c: RGB; ch: string }> = {
  tonic: { name: "Health Tonic", c: [255, 90, 110], ch: "o" },
  shard: { name: "Ember Shard", c: [255, 160, 60], ch: "*" },
  coin: { name: "Moon Coins", c: [255, 220, 110], ch: "$" },
};

const MOB_XP: Record<MobKind, number> = { bug: 30, slime: 18, bat: 14, golem: 60 };

interface Loot {
  id: number;
  kind: LootKind;
  x: number;
  z: number;
  age: number;
}

interface World extends Wants {
  t: number;
  px: number;
  pz: number;
  prevPx: number;
  prevPz: number;
  fdx: number;
  fdz: number;
  faceX: number;
  moving: boolean;
  hp: number;
  calmT: number;
  hitT: number;
  downT: number;
  punchT: number;
  punchCd: number;
  blastCd: number;
  tpCd: number;
  tpFrom: { x: number; z: number } | null;
  voidCd: number;
  voidT: number;
  voidX: number;
  voidZ: number;
  voidDx: number;
  voidDz: number;
  shots: WorldShot[];
  mobs: Mob[];
  nextId: number;
  kills: number;
  mounted: boolean;
  mountFx: number;
  summonT: number;
  level: number;
  xp: number;
  maxHp: number;
  power: number;
  coins: number;
  loot: Loot[];
  targetId: number;
  fx: { text: string; x: number; z: number; t: number }[];
  chunks: Set<string>;
  shake: number;
  biome: Biome;
  biomeT: number;
  place: string;
  placeT: number;
  camX: number;
  camZ: number;
  viewCols: number;
  viewRows: number;
}

const WORLD_HP = 20;
const SUMMON_TICKS = 20;
const xpToLevel = (level: number) => Math.round(100 * Math.pow(level, 1.3));
const WORLD_VOID_CD = 280;
const MOVE = 0.9;
const CHUNK = 48;

// start on dry meadow near the origin
const findStart = () => {
  for (let r = 0; r < 1500; r += 6) {
    for (let a = 0; a < 8; a++) {
      const x = Math.cos(a * 0.785) * r;
      const z = Math.sin(a * 0.785) * r;
      if (biomeAt(x, z) === "meadow") return [x, z];
    }
  }
  return [0, 0];
};

const newWorld = (): World => {
  const [x, z] = findStart();
  return {
    t: 0,
    px: x,
    pz: z,
    prevPx: x,
    prevPz: z,
    fdx: 1,
    fdz: 0,
    faceX: 1,
    moving: false,
    hp: WORLD_HP,
    calmT: 0,
    hitT: 0,
    downT: 0,
    punchT: 0,
    punchCd: 0,
    blastCd: 0,
    tpCd: 0,
    tpFrom: null,
    voidCd: 0,
    voidT: 0,
    voidX: 0,
    voidZ: 0,
    voidDx: 1,
    voidDz: 0,
    shots: [],
    mobs: [],
    nextId: 1,
    kills: 0,
    mounted: false,
    mountFx: 0,
    summonT: 0,
    level: 1,
    xp: 0,
    maxHp: WORLD_HP,
    power: 0,
    coins: 0,
    loot: [],
    targetId: 0,
    fx: [],
    chunks: new Set(),
    shake: 0,
    biome: "meadow",
    biomeT: 0,
    place: "",
    placeT: 99,
    camX: x,
    camZ: z,
    viewCols: BASE_COLS,
    viewRows: BASE_ROWS,
    wantJump: false,
    wantPunch: false,
    wantBlast: false,
    wantTeleport: false,
    wantVoid: false,
  };
};

// Fill nearby chunks with creatures that suit their biome; forget far ones so the land
// repopulates (with new creatures) when you come back.
const spawnAround = (w: World) => {
  const cx = Math.floor(w.px / CHUNK);
  const cz = Math.floor(w.pz / CHUNK);
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cz - 1; j <= cz + 1; j++) {
      const key = `${i},${j}`;
      if (w.chunks.has(key)) continue;
      w.chunks.add(key);
      const salt = i * 7919 + j * 104729 + w.nextId * 13;
      // creatures come in packs: a few of one kind around a shared spot (golems roam alone)
      const packX = (i + 0.25 + hash(salt, 11) * 0.5) * CHUNK;
      const packZ = (j + 0.25 + hash(salt, 21) * 0.5) * CHUNK;
      const pool = BIOMES[biomeAt(packX, packZ)].mobs;
      const packKind = pool[Math.floor(hash(salt, 31) * pool.length)];
      // about half the land is quiet; packs are small
      if (hash(salt, 61) > 0.5) continue;
      const count = packKind === "golem" ? 1 : 1 + Math.floor(hash(salt, 5) * 3);
      for (let k = 0; k < count; k++) {
        const a = hash(salt, k + 41) * Math.PI * 2;
        const x = packX + Math.cos(a) * (2 + k * 2.5);
        const z = packZ + Math.sin(a) * (2 + k * 2.5);
        if (Math.hypot(x - w.px, z - w.pz) < 16 || isWater(x, z) || castleBlocks(x, z)) continue;
        const kind = packKind;
        const y = kind === "bat" ? 4 : 0;
        w.mobs.push({
          id: w.nextId++,
          kind,
          chunk: key,
          x,
          z,
          y,
          vy: 0,
          prevX: x,
          prevZ: z,
          prevY: y,
          hp: MOBS[kind].hp,
          hitT: 0,
          atkT: 0,
          atkCd: 10,
          phase: hash(salt, k) * 100,
          deadT: 0,
          anim: { lunge: 0, open: 0, recoil: 0, legPhase: 0 },
        });
      }
    }
  }
  w.mobs = w.mobs.filter((m) => {
    if (Math.hypot(m.x - w.px, m.z - w.pz) < 75) return true;
    w.chunks.delete(m.chunk);
    return false;
  });
  for (const key of w.chunks) {
    const [i, j] = key.split(",").map(Number);
    if (Math.abs(i - cx) > 3 || Math.abs(j - cz) > 3) w.chunks.delete(key);
  }
};

const worldStep = (w: World, keys: Keys) => {
  w.prevPx = w.px;
  w.prevPz = w.pz;
  for (const m of w.mobs) {
    m.prevX = m.x;
    m.prevZ = m.z;
    m.prevY = m.y;
  }
  for (const s of w.shots) {
    s.prevX = s.x;
    s.prevZ = s.z;
  }
  w.t++;
  if (w.shake > 0) w.shake--;
  for (const f of w.fx) f.t--;
  w.fx = w.fx.filter((f) => f.t > 0);
  const say = (text: string, x: number, z: number) => w.fx.push({ text, x, z, t: 6 });

  const near = castleNear(w.px, w.pz);
  const place = near && Math.hypot(w.px - near.x, w.pz - near.z) < CASTLE_R + 6 ? castleName(near) : "";
  if (place !== w.place) {
    w.place = place;
    w.placeT = 0;
  } else w.placeT++;
  const b = biomeAt(w.px, w.pz);
  if (b !== w.biome) {
    w.biome = b;
    w.biomeT = 0;
  } else w.biomeT++;

  if (w.downT) {
    if (--w.downT === 0) {
      w.hp = w.maxHp;
      w.mobs = w.mobs.filter((m) => Math.hypot(m.x - w.px, m.z - w.pz) > 20);
      say("RISE", w.px, w.pz);
    }
    return;
  }

  const distTo = (m: Mob) => Math.hypot(m.x - w.px, m.z - w.pz);
  const gapTo = (m: Mob) => distTo(m) - 1.5 - MOBS[m.kind].r;
  const hurt = (m: Mob, dmg: number, knock: number) => {
    const d = distTo(m) || 1;
    w.hp = Math.max(0, w.hp - dmg);
    w.hitT = 3;
    w.calmT = 0;
    const nx = w.px + ((w.px - m.x) / d) * knock;
    const nz = w.pz + ((w.pz - m.z) / d) * knock;
    if (!blocked(nx, nz)) {
      w.px = nx;
      w.pz = nz;
    }
    say(`-${dmg}`, w.px, w.pz);
    if (w.hp === 0) {
      w.downT = 45;
      say("YOU FELL", w.px, w.pz);
    }
  };
  const damage = (m: Mob, dmg: number, knock: number, text: string) => {
    const d = distTo(m) || 1;
    m.hp -= dmg;
    m.hitT = 3;
    m.atkT = 0;
    m.x += ((m.x - w.px) / d) * knock;
    m.z += ((m.z - w.pz) / d) * knock;
    w.targetId = m.id;
    say(text, m.x, m.z);
    if (m.hp <= 0) {
      m.deadT = 1;
      w.kills++;
      gainXp(MOB_XP[m.kind]);
      // sometimes it drops something
      const roll = hash(m.id, w.t);
      if (roll < 0.5) {
        const kind: LootKind = roll < 0.24 ? "tonic" : roll < 0.36 ? "shard" : "coin";
        w.loot.push({ id: w.nextId++, kind, x: m.x, z: m.z, age: 0 });
      }
    }
  };
  function gainXp(amount: number) {
    w.xp += amount;
    while (w.xp >= xpToLevel(w.level)) {
      w.xp -= xpToLevel(w.level);
      w.level++;
      w.maxHp += 4;
      w.hp = w.maxHp;
      say(`LEVEL ${w.level}`, w.px, w.pz);
    }
  }
  const alive = () => w.mobs.filter((m) => !m.deadT);

  // walk in eight directions; water turns you back, one axis at a time
  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let mz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  w.moving = false;
  if ((mx || mz) && w.hitT === 0 && w.summonT === 0) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    w.fdx = mx;
    w.fdz = mz;
    if (mx) w.faceX = Math.sign(mx);
    // wading through shallow water is slower
    const speed = (w.mounted ? MOVE * 2.3 : MOVE) * (isWater(w.px, w.pz) ? 0.55 : 1);
    if (!blocked(w.px + mx * speed, w.pz)) w.px += mx * speed;
    if (!blocked(w.px, w.pz + mz * speed)) w.pz += mz * speed;
    w.moving = true;
  }

  if (w.wantTeleport && w.tpCd === 0) {
    for (let d = 12; d > 0; d -= 1) {
      const nx = w.px + w.fdx * d;
      const nz = w.pz + w.fdz * d;
      if (blocked(nx, nz)) continue;
      w.tpFrom = { x: w.px, z: w.pz };
      w.px = w.prevPx = nx;
      w.pz = w.prevPz = nz;
      w.tpCd = TELEPORT_CD;
      say("BLINK", nx, nz);
      break;
    }
  }
  // aim assist: attacks turn to face the nearest creature within reach
  if (w.wantPunch || w.wantBlast || w.wantVoid) {
    const near = alive()
      .filter((m) => distTo(m) < 16)
      .sort((a, c) => distTo(a) - distTo(c))[0];
    if (near) {
      const d = distTo(near) || 1;
      w.fdx = (near.x - w.px) / d;
      w.fdz = (near.z - w.pz) / d;
      if (Math.abs(w.fdx) > 0.2) w.faceX = Math.sign(w.fdx);
    }
  }
  // each level and each ember shard adds damage
  const atk = Math.floor((w.level - 1) / 2) + w.power;
  if (w.wantPunch && w.punchCd === 0) {
    w.punchT = 3;
    w.punchCd = 6;
    const target = alive()
      .filter((m) => gapTo(m) <= 2.5 && ((m.x - w.px) * w.fdx + (m.z - w.pz) * w.fdz) / (distTo(m) || 1) > 0.2)
      .sort((a, c) => gapTo(a) - gapTo(c))[0];
    if (target) damage(target, 1 + atk, 2, "POW!");
  }
  if (w.wantBlast && w.blastCd === 0) {
    const x = w.px + w.fdx * 3;
    const z = w.pz + w.fdz * 3;
    w.shots.push({ x, z, prevX: x, prevZ: z, dx: w.fdx, dz: w.fdz, life: 24 });
    w.blastCd = 12;
  }
  if (w.wantVoid && w.voidCd === 0 && !w.voidT) {
    w.voidT = 1;
    w.voidDx = w.fdx;
    w.voidDz = w.fdz;
    w.voidX = w.px + w.fdx * 4;
    w.voidZ = w.pz + w.fdz * 4;
    w.voidCd = WORLD_VOID_CD;
    say("VOID", w.px, w.pz);
  }
  // call the horse (a short summoning), or climb down (it dissolves back into light)
  if (w.wantMount && !w.summonT) {
    if (w.mounted) {
      w.mounted = false;
      w.mountFx = 12;
      say("DISMOUNT", w.px, w.pz);
    } else {
      w.summonT = SUMMON_TICKS;
    }
  }
  if (w.summonT > 0 && --w.summonT === 0) {
    w.mounted = true;
    say("MOUNTED", w.px, w.pz);
  }
  if (w.mountFx > 0) w.mountFx--;
  w.wantJump = w.wantPunch = w.wantBlast = w.wantTeleport = w.wantVoid = w.wantMount = false;

  if (w.voidT) {
    w.voidT++;
    if (w.voidT > 10) {
      w.voidX += w.voidDx * 3;
      w.voidZ += w.voidDz * 3;
      w.shake = 2;
      for (const m of alive()) {
        if (Math.hypot(m.x - w.voidX, m.z - w.voidZ) < MOBS[m.kind].r + 4) damage(m, 99, 0, "ERASED");
      }
    }
    if (w.voidT > 34) w.voidT = 0;
  }

  for (const s of w.shots) {
    s.x += s.dx * 1.8;
    s.z += s.dz * 1.8;
    s.life--;
    const target = alive().find((m) => Math.hypot(m.x - s.x, m.z - s.z) <= MOBS[m.kind].r + 1);
    if (target) {
      damage(target, 2 + atk, 1, "BOOM!");
      s.life = 0;
    }
  }
  w.shots = w.shots.filter((s) => s.life > 0);

  // creatures
  for (const m of alive()) {
    m.phase++;
    if (m.atkCd > 0) m.atkCd--;
    if (m.hitT > 0) {
      m.hitT--;
      continue;
    }
    const d = distTo(m) || 1;
    const ux = (w.px - m.x) / d;
    const uz = (w.pz - m.z) / d;
    const gap = gapTo(m);
    const step = (speed: number) => {
      const nx = m.x + ux * speed;
      const nz = m.z + uz * speed;
      if (!blocked(nx, nz)) {
        m.x = nx;
        m.z = nz;
      }
    };
    if (d > 24) {
      // out of sight: amble about
      const nx = m.x + Math.sin(m.phase * 0.05 + m.id) * 0.15;
      const nz = m.z + Math.cos(m.phase * 0.04 + m.id) * 0.15;
      if (!blocked(nx, nz)) {
        m.x = nx;
        m.z = nz;
      }
      if (m.kind === "bat") m.y = 4 + Math.sin(m.phase * 0.15);
      continue;
    }
    if (m.kind === "bug") {
      if (m.atkT > 0) {
        if (--m.atkT === 0 && gap <= 1.2) hurt(m, 1, 2);
      } else if (gap <= 0.8 && m.atkCd === 0) {
        m.atkT = 4;
        m.atkCd = 14;
      } else if (gap > 0.8) step(0.5);
    } else if (m.kind === "slime") {
      if (m.y > 0 || m.vy > 0) {
        m.y += m.vy;
        m.vy -= 0.3;
        step(0.8);
        if (m.y <= 0) m.y = m.vy = 0;
      } else if (m.atkCd === 0) {
        m.vy = 1.7;
        m.atkCd = 12 + Math.floor(hash(m.id, m.phase) * 10);
      }
      if (m.atkT > 0) m.atkT--;
      else if (gap <= 0.4 && m.y < 1.5) {
        hurt(m, 1, 2);
        m.atkT = 12;
      }
    } else if (m.kind === "bat") {
      const home = 4 + Math.sin(m.phase * 0.15) * 0.8;
      if (m.atkT > 0) {
        m.atkT--;
        m.y += (0.8 - m.y) * 0.35;
        step(0.8);
        if (gap < 0.8 && m.y < 2) {
          hurt(m, 1, 1);
          m.atkT = 0;
          m.atkCd = 22;
        }
      } else {
        m.y += (home - m.y) * 0.2;
        if (d > 6) step(0.55);
        else if (m.atkCd === 0) m.atkT = 12;
      }
    } else {
      if (m.atkT > 0) {
        if (--m.atkT === 0) {
          w.shake = 3;
          say("SLAM", m.x, m.z);
          if (gap <= 2.5) hurt(m, 2, 3);
        }
      } else if (gap <= 1.5 && m.atkCd === 0) {
        m.atkT = 9;
        m.atkCd = 26;
      } else if (gap > 1.5 && w.t % 3 === 0) step(0.7);
    }
  }
  for (const m of w.mobs) if (m.deadT) m.deadT++;
  w.mobs = w.mobs.filter((m) => m.deadT < 16);

  w.calmT++;
  if (w.calmT > 60 && w.t % 25 === 0 && w.hp < w.maxHp) w.hp++;

  // loot drifts to you when you're close, and fades after a while
  for (const l of w.loot) {
    l.age++;
    const d = Math.hypot(l.x - w.px, l.z - w.pz);
    if (d < 6) {
      l.x += (w.px - l.x) * 0.25;
      l.z += (w.pz - l.z) * 0.25;
    }
    if (d < 1.6) {
      l.age = 99999;
      if (l.kind === "tonic") w.hp = Math.min(w.maxHp, w.hp + 8);
      else if (l.kind === "shard") w.power++;
      else w.coins += 5 + Math.floor(hash(l.id, 3) * 11);
      say(`+ ${LOOT[l.kind].name}`, w.px, w.pz);
    }
  }
  w.loot = w.loot.filter((l) => l.age < 900);
  for (const k of ["punchT", "punchCd", "blastCd", "tpCd", "hitT", "voidCd"] as const) if (w[k] > 0) w[k]--;
  if (w.tpCd < TELEPORT_CD - 8) w.tpFrom = null;
  spawnAround(w);
};

// ---- world rendering: an angled camera above the land ----

// How much detail the world gets: how many characters each tree, creature and hill is drawn with.
// This is fixed at the design scale; zooming changes how big the characters are on screen instead.
const worldZoom = 1.5;
const S_X = 7 * worldZoom; // grid pixels per world unit across
const S_Z = S_X * 0.72; // the ground recedes: depth is squashed
const S_H = S_X * 0.65; // grid pixels per unit of height
const FIGURE = 0.5 * worldZoom; // side-view figures are drawn at this scale

// Zoom = how big each character is on screen. Smaller characters fit more of them, so you see
// more land at the same detail; bigger characters show less, up close.
const GLYPH_ZOOMS = [0.5, 0.6, 0.75, 0.9, 1, 1.2, 1.45];
const GLYPH_ZOOM_DEFAULT = 4;
const MOON_DIR: V3 = norm([-0.45, 0.75, -0.5]);
const VIEW_DIR: V3 = norm([0, 0.72, 0.69]);

// A flat polygon (a wall, a roof) lit from one facing direction, with a rough texture.
const poly = (p: Paint, pts: [number, number][], m: Mat, n: V3 = [0, 0, 1]) => {
  const sp = pts.map(([x, y]) => toScreen(p, x, y));
  const xs = sp.map((q) => q[0]);
  const ys = sp.map((q) => q[1]);
  cellsAround(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (col, row, x, y) => {
    let inside = false;
    for (let a = 0, b = sp.length - 1; a < sp.length; b = a++) {
      if (sp[a][1] > y !== sp[b][1] > y && x < ((sp[b][0] - sp[a][0]) * (y - sp[a][1])) / (sp[b][1] - sp[a][1]) + sp[a][0]) inside = !inside;
    }
    if (inside) shadeCell(p, col, row, n[0], n[1], n[2], m, x);
  });
};

const WALL: Mat = { c: [196, 180, 152], rough: 0.25 };
const TIMBER: Mat = { c: [74, 52, 36], rough: 0.3 };
const THATCH: Mat = { c: [168, 132, 78], rough: 0.55 };
const SLATE: Mat = { c: [84, 90, 118], rough: 0.35, spec: 0.2 };
const KEEP: Mat = { c: [138, 134, 126], rough: 0.4 };
const DOOR: Mat = { c: [64, 42, 28], rough: 0.2 };
const WINDOW_LIT: Mat = { c: [255, 196, 116], glow: true };
const BANNER: Mat = { c: [176, 40, 52], rough: 0.1 };
const SAIL: Mat = { c: [214, 204, 180], rough: 0.25 };
const IRON: Mat = { c: [46, 44, 48], spec: 0.3 };
const FLAME: Mat = { c: [255, 182, 92], glow: true };
const ROOF_N: V3 = norm([-0.2, -0.6, 0.8]);

const drawCottage = (p: Paint, seed: number, now: number) => {
  const w2 = 38 + hash(seed, 1) * 10;
  // walls, timber frame, door and warm windows
  poly(p, [[-w2, 0], [w2, 0], [w2, -54], [-w2, -54]], WALL);
  for (const x of [-w2, 0, w2]) capsule(p, x, 0, x, -54, 2.4, TIMBER);
  capsule(p, -w2, -28, w2, -28, 2.2, TIMBER);
  capsule(p, -w2, -54, -w2 / 2, -28, 1.8, TIMBER);
  capsule(p, w2, -54, w2 / 2, -28, 1.8, TIMBER);
  poly(p, [[-8, 0], [8, 0], [8, -24], [-8, -24]], DOOR);
  const flicker = 0.85 + 0.15 * Math.sin(now / 160 + seed);
  for (const x of [-w2 * 0.6, w2 * 0.6]) {
    poly(p, [[x - 6, -36], [x + 6, -36], [x + 6, -46], [x - 6, -46]], WINDOW_LIT);
    glowAt(p, x, -41, 26, WINDOW_LIT.c, 0.4 * flicker);
  }
  // steep thatched roof and a stone chimney
  poly(p, [[-w2 - 10, -54], [w2 + 10, -54], [0, -104]], THATCH, ROOF_N);
  capsule(p, -w2 - 10, -54, w2 + 10, -54, 2.5, TIMBER);
  poly(p, [[w2 * 0.45, -70], [w2 * 0.45 + 9, -70], [w2 * 0.45 + 9, -100], [w2 * 0.45, -100]], KEEP);
};

const drawTower = (p: Paint, seed: number, now: number) => {
  poly(p, [[-24, 0], [24, 0], [22, -170], [-22, -170]], KEEP);
  // battlements
  for (let k = 0; k < 4; k++) poly(p, [[-24 + k * 14, -170], [-16 + k * 14, -170], [-16 + k * 14, -182], [-24 + k * 14, -182]], KEEP);
  poly(p, [[-26, -182], [26, -182], [0, -236]], SLATE, ROOF_N);
  poly(p, [[-3, -96], [3, -96], [3, -120], [-3, -120]], WINDOW_LIT);
  glowAt(p, 0, -108, 22, WINDOW_LIT.c, 0.35);
  poly(p, [[-10, 0], [10, 0], [10, -30], [-10, -30]], DOOR);
  // a banner on the spire, waving
  capsule(p, 0, -236, 0, -268, 1.6, IRON);
  const wave = Math.sin(now / 240 + seed) * 5;
  poly(p, [[0, -268], [26, -262 + wave], [0, -252]], BANNER);
};

const drawWindmill = (p: Paint, seed: number, now: number) => {
  poly(p, [[-26, 0], [26, 0], [15, -128], [-15, -128]], WALL);
  capsule(p, -26, -40, 26, -40, 2, TIMBER);
  poly(p, [[-8, 0], [8, 0], [8, -26], [-8, -26]], DOOR);
  poly(p, [[-20, -128], [20, -128], [0, -160]], THATCH, ROOF_N);
  // four sails, turning slowly
  const hubY = -122;
  const turn = now / 1400 + seed;
  for (let k = 0; k < 4; k++) {
    const a = turn + (k * Math.PI) / 2;
    const ex = Math.cos(a) * 92;
    const ey = hubY + Math.sin(a) * 92;
    capsule(p, 0, hubY, ex, ey, 2.2, TIMBER);
    const px2 = -Math.sin(a) * 14;
    const py2 = Math.cos(a) * 14;
    poly(p, [[ex * 0.25, hubY + (ey - hubY) * 0.25], [ex, ey], [ex + px2, ey + py2], [ex * 0.25 + px2, hubY + (ey - hubY) * 0.25 + py2]], SAIL);
  }
  ball(p, 0, hubY, 6, TIMBER);
};

const drawWell = (p: Paint) => {
  ellipse(p, 0, -10, 24, 12, KEEP);
  ellipse(p, 0, -14, 16, 6, DOOR);
  capsule(p, -20, -10, -20, -58, 2.5, TIMBER);
  capsule(p, 20, -10, 20, -58, 2.5, TIMBER);
  poly(p, [[-28, -56], [28, -56], [0, -78]], THATCH, ROOF_N);
};

// A run of curtain wall: stone with battlements on top and the odd arrow slit.
const drawWall = (p: Paint, width: number, seed: number) => {
  const h = 74;
  poly(p, [[-width / 2, 0], [width / 2, 0], [width / 2, -h], [-width / 2, -h]], KEEP);
  for (let x = -width / 2; x < width / 2 - 4; x += 12) poly(p, [[x, -h], [x + 7, -h], [x + 7, -h - 10], [x, -h - 10]], KEEP);
  if (width > 20 && hash(seed, 3) > 0.5) poly(p, [[-2, -40], [2, -40], [2, -54], [-2, -54]], DOOR);
  if (hash(seed, 4) > 0.6) ellipse(p, width * 0.2, -h * 0.35, width * 0.18, 8, MOSS_MAT);
};

const drawGatehouse = (p: Paint, seed: number, now: number) => {
  poly(p, [[-30, 0], [30, 0], [30, -100], [-30, -100]], KEEP);
  for (let x = -30; x < 26; x += 12) poly(p, [[x, -100], [x + 7, -100], [x + 7, -112], [x, -112]], KEEP);
  // the arch and its portcullis
  poly(p, [[-13, 0], [13, 0], [13, -40], [6, -50], [-6, -50], [-13, -40]], DOOR);
  for (let x = -10; x <= 10; x += 5) capsule(p, x, 0, x, -44, 1.1, IRON);
  for (const y of [-12, -26, -38]) capsule(p, -12, y, 12, y, 1, IRON);
  // torches either side
  for (const x of [-22, 22]) {
    const flick = 0.75 + 0.25 * Math.sin(now / 80 + seed + x) * Math.sin(now / 41 + x);
    ball(p, x, -60, 4.5, FLAME);
    glowAt(p, x, -60, 34, FLAME.c, 0.5 * flick);
  }
};

const drawKeep = (p: Paint, seed: number, now: number, banner: RGB) => {
  poly(p, [[-40, 0], [40, 0], [38, -190], [-38, -190]], KEEP);
  for (let x = -40; x < 36; x += 13) poly(p, [[x, -190], [x + 8, -190], [x + 8, -204], [x, -204]], KEEP);
  // lit windows on two floors
  for (const [x, y] of [[-18, -80], [18, -80], [0, -140]]) {
    poly(p, [[x - 4, y], [x + 4, y], [x + 4, y - 16], [x - 4, y - 16]], WINDOW_LIT);
    glowAt(p, x, y - 8, 22, WINDOW_LIT.c, 0.35);
  }
  poly(p, [[-12, 0], [12, 0], [12, -36], [-12, -36]], DOOR);
  // a corner turret with a spire, and the banner on top
  poly(p, [[22, -204], [42, -204], [42, -240], [22, -240]], KEEP);
  poly(p, [[18, -240], [46, -240], [32, -280], ], SLATE, ROOF_N);
  capsule(p, 32, -280, 32, -308, 1.6, IRON);
  const wave = Math.sin(now / 240 + seed) * 6;
  poly(p, [[32, -308], [64, -301 + wave], [32, -290]], { c: banner, rough: 0.1 });
};

const drawLantern = (p: Paint, seed: number, now: number) => {
  capsule(p, 0, 0, 0, -62, 2.4, IRON);
  capsule(p, 0, -62, 10, -62, 1.6, IRON);
  const flicker = 0.75 + 0.25 * Math.sin(now / 90 + seed) * Math.sin(now / 37 + seed * 2);
  ball(p, 10, -54, 5, FLAME);
  glowAt(p, 10, -54, 40, FLAME.c, 0.45 * flicker);
};

const BARK: Mat = { c: [112, 82, 58], rough: 0.4 };
const LEAVES: Mat = { c: [62, 128, 70], rough: 0.5 };
const AUTUMN: Mat = { c: [190, 92, 48], rough: 0.5 };
const PINE: Mat = { c: [44, 104, 72], rough: 0.45 };
const SNOW_MAT: Mat = { c: [226, 232, 242], rough: 0.2 };
const CACTUS: Mat = { c: [86, 156, 96], rough: 0.3 };
const STONE_MAT: Mat = { c: [132, 128, 120], spec: 0.1, rough: 0.35 };
const ROCK: Mat = { c: [96, 92, 88], rough: 0.4 };
const MOSS_MAT: Mat = { c: [70, 120, 65], rough: 0.4 };
const SLIME_MAT: Mat = { c: [90, 220, 130], spec: 0.9 };
const SLIME_CORE: Mat = { c: [40, 120, 70], spec: 0.4 };
const BAT_MAT: Mat = { c: [78, 58, 98], spec: 0.25 };
const WING_MAT: Mat = { c: [58, 42, 78] };
const EYE_DARK: Mat = { c: [20, 30, 25] };
const BAT_EYE: Mat = { c: [255, 70, 70], glow: true };
const EMBER: Mat = { c: [255, 150, 60], glow: true };

const drawOak = (p: Paint, x: number, gy: number, seed: number, autumn: boolean) => {
  const h = 150 + hash(seed, 2) * 70;
  capsule(p, x, gy, x + 3, gy - h * 0.6, 7, BARK);
  capsule(p, x + 2, gy - h * 0.45, x + 26, gy - h * 0.7, 3.5, BARK);
  capsule(p, x + 1, gy - h * 0.5, x - 22, gy - h * 0.72, 3.5, BARK);
  const leaf = autumn && hash(seed, 9) > 0.5 ? AUTUMN : LEAVES;
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + hash(seed, k) * 0.5;
    ball(p, x + Math.cos(a) * 26, gy - h * 0.8 + Math.sin(a) * 18, 24 + hash(seed, k + 4) * 10, leaf);
  }
  ball(p, x, gy - h * 0.85, 30, leaf);
};

const drawPine = (p: Paint, x: number, gy: number, seed: number, snowy: boolean) => {
  const h = 170 + hash(seed, 3) * 80;
  capsule(p, x, gy, x, gy - h * 0.25, 5, BARK);
  for (let tier = 0; tier < 4; tier++) {
    const base = gy - h * (0.18 + tier * 0.2);
    const top = base - h * 0.32;
    const r = 34 - tier * 7;
    taper(p, x, base, x, top, r, 2, PINE, undefined, true);
    if (snowy) taper(p, x, top + (base - top) * 0.45, x, top, r * 0.55, 1.5, SNOW_MAT, undefined, true);
  }
};

const drawCactus = (p: Paint, x: number, gy: number, seed: number) => {
  const h = 90 + hash(seed, 5) * 60;
  capsule(p, x, gy, x, gy - h, 9, CACTUS);
  const ay = gy - h * (0.45 + hash(seed, 6) * 0.2);
  capsule(p, x - 6, ay, x - 26, ay, 6, CACTUS);
  capsule(p, x - 26, ay, x - 26, ay - 34, 6, CACTUS);
  if (hash(seed, 7) > 0.4) {
    capsule(p, x + 6, ay + 14, x + 24, ay + 14, 6, CACTUS);
    capsule(p, x + 24, ay + 14, x + 24, ay - 12, 6, CACTUS);
  }
};

const drawPillar = (p: Paint, x: number, gy: number, seed: number) => {
  const h = 120 + hash(seed, 8) * 140;
  taper(p, x, gy, x, gy - h, 15, 13, STONE_MAT, undefined, true);
  ellipse(p, x, gy - 6, 20, 8, STONE_MAT);
  if (hash(seed, 9) > 0.5) ellipse(p, x + 4, gy - h * 0.6, 12, 18, MOSS_MAT);
  return h;
};

const drawRock = (p: Paint, x: number, gy: number, seed: number, mat: Mat) => {
  ellipse(p, x, gy - 8, 16 + hash(seed, 1) * 14, 10 + hash(seed, 2) * 8, mat);
};

const drawSlime = (p: Paint, x: number, gy: number, m: Mob, now: number) => {
  const stretch = m.y > 0 ? 0.18 : 0.08 * Math.sin(now / 180 + m.id);
  const rx = 24 * (1 - stretch);
  const ry = 19 * (1 + stretch);
  const cy = gy - m.y * PX_PER_Y - ry;
  ellipse(p, x, cy, rx, ry, SLIME_MAT);
  ball(p, x + 3, cy + 5, 7, SLIME_CORE);
  ball(p, x - 9, cy - 4, 3, EYE_DARK);
  ball(p, x - 1, cy - 5, 3, EYE_DARK);
};

const drawBat = (p: Paint, x: number, gy: number, m: Mob, now: number) => {
  const cy = gy - m.y * PX_PER_Y;
  const flap = Math.sin(now / 55 + m.id);
  const wy = cy - 4 + flap * 16;
  for (const s of [-1, 1]) {
    taper(p, x + s * 4, cy - 2, x + s * 38, wy, 5, 2, WING_MAT);
    taper(p, x + s * 38, wy, x + s * 24, cy + 9, 2, 1.5, WING_MAT);
  }
  ball(p, x, cy, 10, BAT_MAT);
  taper(p, x - 5, cy - 7, x - 7, cy - 18, 3, 1, BAT_MAT);
  taper(p, x + 3, cy - 7, x + 4, cy - 18, 3, 1, BAT_MAT);
  ball(p, x - 5, cy - 2, 2.2, BAT_EYE);
  glowAt(p, x - 5, cy - 2, 10, BAT_EYE.c, 0.3);
};

const drawGolem = (p: Paint, x: number, gy: number, m: Mob, now: number) => {
  const armUp = m.atkT > 0 ? Math.min(1, (10 - m.atkT) / 5) : 0;
  const stride = Math.sin(m.phase * 0.25) * 4;
  capsule(p, x + 16, gy - 40, x + 18 - stride, gy - 4, 11, ROCK);
  capsule(p, x + 30, gy - 96, x + 40, lerp(gy - 40, gy - 170, armUp), 10, ROCK);
  ball(p, x + 40, lerp(gy - 34, gy - 176, armUp), 14, ROCK);
  capsule(p, x - 14, gy - 40, x - 16 + stride, gy - 4, 11, STONE_MAT);
  ellipse(p, x, gy - 80, 38, 42, STONE_MAT);
  ellipse(p, x + 10, gy - 110, 22, 8, MOSS_MAT);
  ball(p, x - 6, gy - 128, 17, STONE_MAT);
  ball(p, x - 15, gy - 130, 3, EMBER);
  glowAt(p, x - 15, gy - 130, 14, EMBER.c, 0.35 + 0.1 * Math.sin(now / 150));
  for (const [cx, cy] of [[-6, -86], [4, -70], [-12, -62]]) stitch(p, x + cx, gy + cy, "#", [255, 140 + 40 * Math.sin(now / 200), 60]);
  capsule(p, x - 30, gy - 96, x - 42, lerp(gy - 40, gy - 170, armUp), 10, STONE_MAT);
  ball(p, x - 42, lerp(gy - 34, gy - 176, armUp), 14, STONE_MAT);
};

// shattering into bits of its own color
const mobBurst = (f: Frame, cx: number, cy: number, age: number, c: RGB) => {
  const fade = Math.max(0, 1 - age / 14);
  for (let k = 0; k < 40; k++) {
    const a = hash(k, 3) * Math.PI * 2;
    const sp = 4 + hash(k, 5) * 12;
    const col = Math.round((cx + Math.cos(a) * sp * age) / CW);
    const row = Math.round((cy + Math.sin(a) * sp * age * 0.6 + age * age * 0.5) / CH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    setCell(f, row * COLS + col, "#%*+:."[Math.min(5, Math.floor((1 - fade) * 6))], [c[0] * fade, c[1] * fade, c[2] * fade]);
  }
};

const worldPose = (w: World): Pose => {
  if (w.downT) return P_KO;
  if (w.mounted) return w.punchT || w.blastCd > 9 || (w.voidT > 0 && w.voidT < 12) ? P_RIDE_STRIKE : P_RIDE;
  if (w.hitT) return P_HIT;
  if (w.punchT) return P_PUNCH;
  if (w.blastCd > 9 || (w.voidT > 0 && w.voidT < 12)) return P_BLAST;
  if (w.moving) return (w.t >> 1) % 2 ? P_WALK1 : P_WALK2;
  return w.t % 16 < 8 ? P_IDLE : P_IDLE2;
};

// ---- the horse: a 3D model rendered straight into the character grid ----
// Raymarched from the world camera's angle (above and in front), so you see its back and near
// side with real light: a bright back, flanks fading to a shadowed belly, thin dark legs. Its
// mane and tail are drawn on top as fine strands of hair, moved by a small physics simulation.

const HORSE_K = 0.9 * worldZoom; // screen pixels per horse unit
// how far the rider is lifted so they sit in the saddle (in the rider's own units)
const RIDER_LIFT = (65 * HORSE_K) / FIGURE - 88;
const HORSE_COAT: RGB = [226, 226, 232];
const HORSE_SOCK: RGB = [150, 152, 162];
const HORSE_MUZZLE: RGB = [118, 114, 122];
const HORSE_HOOF: RGB = [52, 50, 54];
const HORSE_BLANKET: RGB = [156, 38, 52];
const HORSE_SADDLE: RGB = [120, 76, 44];
const HORSE_EYE: RGB = [20, 18, 20];
const HAIR_RGB: RGB = [238, 236, 228];

// light mostly from above, a little from the left and the camera side
const HORSE_LIGHT: V3 = norm([-0.35, 0.85, 0.4]);
const HORSE_VIEW: V3 = norm([0, 0.72, 0.65]);
const HORSE_HALF: V3 = norm([HORSE_LIGHT[0] + HORSE_VIEW[0], HORSE_LIGHT[1] + HORSE_VIEW[1], HORSE_LIGHT[2] + HORSE_VIEW[2]]);

// the rhythm of a gallop: each leg strikes at its own point in the stride
const STRIDE = { foreNear: 0, foreFar: 0.12, hindNear: 0.55, hindFar: 0.67 };

// One leg's joints in the side view (y up): hip, the knee or hock, fetlock, toe. Hind legs
// bend backward at the hock; forelegs fold forward at the knee.
const legJoints = (hx: number, hy: number, phase: number, moving: boolean, hind: boolean): [number, number][] => {
  const a = Math.PI * 2 * phase;
  const swing = moving ? Math.sin(a) * 0.5 : 0;
  const lift = moving ? Math.max(0, Math.cos(a)) : 0;
  const jx = hx + Math.sin(swing) * 16 + (hind ? -10 : 2);
  const jy = hy - 28 + lift * 6;
  const fx = jx + Math.sin(swing) * 6 + (hind ? 4 : 0) + lift * (hind ? -6 : 9);
  const fy = 12 + lift * 14;
  const tx = fx + 3 + lift * (hind ? -2 : 5);
  const ty = 2 + lift * 12;
  return [[hx, hy], [jx, jy], [fx, fy], [tx, ty]];
};

interface HorseModel {
  bob: number;
  neckBase: V3;
  neckTop: V3;
  head: V3;
  muzzle: V3;
  legs: { pts: V3[]; hind: boolean }[];
}

const enum HorsePart { Coat, Hoof, Blanket, Saddle, Eye }
let horseHit = HorsePart.Coat;

const horseModel = (rig: HorseRig, gait: number, moving: boolean): HorseModel => {
  const g = gait / (Math.PI * 2);
  const b = rig.bob;
  const down = Math.max(0, (rig.hy + 124) / 82);
  const leg = (hx: number, hy: number, phase: number, hind: boolean, z: number) => ({
    pts: legJoints(hx, hy, phase, moving, hind).map(([x, y]) => [x, y, z] as V3),
    hind,
  });
  return {
    bob: b,
    neckBase: [28, 86 - b, 0],
    neckTop: [rig.nx, -rig.ny, 0],
    head: [rig.hx, -rig.hy, 0],
    muzzle: [rig.hx + 22 - down * 10, -(rig.hy + 24 + down * 8), 0],
    legs: [
      leg(24, 64 - b, g + STRIDE.foreFar, false, -8),
      leg(-32, 66 - b, g + STRIDE.hindFar, true, -8),
      leg(30, 62 - b, g + STRIDE.foreNear, false, 8),
      leg(-28, 64 - b, g + STRIDE.hindNear, true, 8),
    ],
  };
};

// The horse as one signed distance field (y up, facing +x); sets horseHit to the part hit.
const horseSdf = (m: HorseModel, x: number, y: number, z: number) => {
  const b = m.bob;
  let d = sdEllipsoid(x, y - 72 + b, z, 42, 19, 16);
  d = smin(d, sdEllipsoid(x + 32, y - 78 + b, z, 24, 21, 18), 7);
  d = smin(d, sdEllipsoid(x - 30, y - 76 + b, z, 18, 19, 15), 7);
  d = smin(d, sdEllipsoid(x - 18, y - 93 + b, z, 11, 6, 8), 5);
  // neck and head live in front of the shoulder; behind it they're at least that far away
  if (x > 8) {
    d = smin(d, sdCapsule(x, y, z, m.neckBase, m.neckTop, 12, 8.5), 6);
    d = smin(d, sdCapsule(x, y, z, m.neckTop, m.head, 8.5, 8), 4);
    d = smin(d, sdCapsule(x, y, z, m.head, m.muzzle, 8.5, 5.5), 3);
    d = smin(d, sdEllipsoid(x - m.head[0] - 3, y - m.head[1] + 6, z, 9, 8, 6.5), 3);
    for (const s of [-2.5, 2.5]) {
      d = Math.min(d, sdCapsule(x, y, z, [m.head[0] - 1, m.head[1] + 6, s], [m.head[0] - 2, m.head[1] + 17, s * 1.3], 2.2, 0.8));
    }
  } else d = Math.min(d, 8 - x + 1);
  // legs live below the belly
  let hoof = 1e9;
  if (y < 82) {
    for (const l of m.legs) {
      const [hip, joint, fet, toe] = l.pts;
      d = smin(d, sdCapsule(x, y, z, hip, joint, l.hind ? 10 : 8, 4.5), 4);
      d = Math.min(d, sdCapsule(x, y, z, joint, fet, 4, 3.3));
      d = Math.min(d, sdCapsule(x, y, z, fet, toe, 3, 2.8));
      hoof = Math.min(hoof, sdEllipsoid(x - toe[0] - 1.5, y - toe[1] + 1, z - toe[2], 5, 3.2, 4.5));
    }
  } else d = Math.min(d, y - 82 + 1);
  horseHit = HorsePart.Coat;
  const blanket = sdEllipsoid(x, y - 88 + b, z, 22, 4.5, 17.5);
  const saddle = Math.min(sdEllipsoid(x, y - 95 + b, z, 15, 5, 11), sdSphere(x + 12, y - 99 + b, z, 4.5));
  const eye = sdSphere(x - m.head[0] - 6, y - m.head[1] + 1, z - 6.5, 1.9);
  if (hoof < d) {
    d = hoof;
    horseHit = HorsePart.Hoof;
  }
  if (blanket < d) {
    d = blanket;
    horseHit = HorsePart.Blanket;
  }
  if (saddle < d) {
    d = saddle;
    horseHit = HorsePart.Saddle;
  }
  if (eye < d) {
    d = eye;
    horseHit = HorsePart.Eye;
  }
  return d;
};

// which cells the horse covered this frame, for the outline pass
let horseMask = new Uint8Array(0);
// the last horse image, reused on alternate frames (the horse updates 30 times a second)
const horseCache = { key: "", at: -1e9, ch: [] as string[], r: new Float32Array(0), g: new Float32Array(0), b: new Float32Array(0) };

// Renders the horse standing at screen point (ax, ay), facing `face` (+1 right, -1 left).
const renderHorse3D = (f: Frame, ax: number, ay: number, face: number, m: HorseModel, flash: number, now: number) => {
  const k = HORSE_K;
  const c0 = Math.max(0, Math.floor((ax - 110 * k) / CW));
  const c1 = Math.min(COLS - 1, Math.ceil((ax + 110 * k) / CW));
  const r0 = Math.max(0, Math.floor((ay - 120 * k) / CH));
  const r1 = Math.min(ROWS - 1, Math.ceil((ay + 18 * k) / CH));
  if (c1 < c0 || r1 < r0) return;
  const bw = c1 - c0 + 1;
  const bh = r1 - r0 + 1;
  const key = `${c0},${r0},${bw},${bh},${face},${Math.round(ax % CW)},${Math.round(ay % CH)},${flash.toFixed(2)}`;
  const reuse = horseCache.key === key && now - horseCache.at < 30;
  if (reuse) {
    for (let mi = 0; mi < bw * bh; mi++) {
      if (!horseMask[mi]) continue;
      const i = (r0 + Math.floor(mi / bw)) * COLS + c0 + (mi % bw);
      setCell(f, i, horseCache.ch[mi], [horseCache.r[mi], horseCache.g[mi], horseCache.b[mi]]);
      f.solid[i] = 1;
    }
  } else {
  if (horseMask.length < bw * bh) horseMask = new Uint8Array(bw * bh);
  horseMask.fill(0, 0, bw * bh);
  if (horseCache.r.length < bw * bh) {
    horseCache.r = new Float32Array(bw * bh);
    horseCache.g = new Float32Array(bw * bh);
    horseCache.b = new Float32Array(bw * bh);
  }
  horseCache.key = key;
  horseCache.at = now;
  const dy = -0.7423;
  const dz = -0.6701;
  const eps = 0.35;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const x = (face * ((col + 0.5) * CW - ax)) / k;
      if (x < -95 || x > 105) continue;
      const v = ((row + 0.5) * CH - ay) / k;
      // the ray comes down from above along the view direction; only the stretch that passes
      // through the horse's bounding box (y -2..150, z -22..22) needs marching
      const zTop = (v + 0.65 * 175) / 0.72;
      const tStart = Math.max(0, (175 - 150) / -dy, (zTop - 22) / -dz);
      const tEnd = Math.min((175 + 2) / -dy, (zTop + 22) / -dz);
      if (tStart > tEnd) continue;
      let y = 175 + dy * tStart;
      let z = zTop + dz * tStart;
      let t = tStart;
      let hit = false;
      for (let s = 0; s < 32 && t <= tEnd; s++) {
        const dist = horseSdf(m, x, y, z);
        if (dist < 0.5) {
          hit = true;
          break;
        }
        const st = Math.max(dist * 0.9, 0.6);
        y += dy * st;
        z += dz * st;
        t += st;
      }
      if (!hit) continue;
      horseSdf(m, x, y, z);
      const part = horseHit;
      const a = horseSdf(m, x + eps, y - eps, z - eps);
      const bb = horseSdf(m, x - eps, y - eps, z + eps);
      const c = horseSdf(m, x - eps, y + eps, z - eps);
      const dd = horseSdf(m, x + eps, y + eps, z + eps);
      const n = norm([a - bb - c + dd, -a - bb + c + dd, -a + bb - c + dd]);
      let albedo: RGB =
        part === HorsePart.Hoof ? HORSE_HOOF : part === HorsePart.Blanket ? HORSE_BLANKET : part === HorsePart.Saddle ? HORSE_SADDLE : part === HorsePart.Eye ? HORSE_EYE : HORSE_COAT;
      if (part === HorsePart.Coat) {
        if (y < 24) albedo = HORSE_SOCK;
        else if (Math.hypot(x - m.muzzle[0], y - m.muzzle[1]) < 7) albedo = HORSE_MUZZLE;
        else {
          // dapples over the hindquarters and flank
          const dap = x < 10 ? 0.9 + 0.1 * vnoise(x * 0.22 + z * 0.1, y * 0.22) : 1;
          albedo = [albedo[0] * dap, albedo[1] * dap, albedo[2] * dap];
        }
      }
      // coat: soft wrapped light, a sheen, a cool rim, and a dim fill so the belly isn't black
      const nl = n[0] * HORSE_LIGHT[0] + n[1] * HORSE_LIGHT[1] + n[2] * HORSE_LIGHT[2];
      const diff = Math.max(0, (nl + 0.2) / 1.2);
      const fill = 0.12 + 0.1 * n[1];
      const spec = Math.pow(Math.max(0, n[0] * HORSE_HALF[0] + n[1] * HORSE_HALF[1] + n[2] * HORSE_HALF[2]), 22) * (part === HorsePart.Eye ? 0.9 : 0.3);
      const nv = Math.max(0, n[1] * HORSE_VIEW[1] + n[2] * HORSE_VIEW[2]);
      const rim = Math.pow(1 - nv, 3) * 0.22;
      const l = fill + diff * 0.95;
      const out: RGB = [
        Math.min(255, albedo[0] * l + 255 * spec + 80 * rim),
        Math.min(255, albedo[1] * l + 255 * spec + 90 * rim),
        Math.min(255, albedo[2] * l + 255 * spec + 120 * rim),
      ];
      const lum = (out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15) / 255;
      const i = row * COLS + col;
      setCell(f, i, lumChar(Math.min(1, lum * 1.15)), [lerp(out[0], 255, flash), lerp(out[1], 255, flash), lerp(out[2], 255, flash)]);
      f.solid[i] = 1;
      const mi = (row - r0) * bw + (col - c0);
      horseMask[mi] = 1;
      horseCache.ch[mi] = f.ch[i];
      horseCache.r[mi] = f.r[i];
      horseCache.g[mi] = f.g[i];
      horseCache.b[mi] = f.b[i];
    }
  }
  }
  // a thin dark edge around the silhouette keeps a pale horse readable on snow or sand
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const mi = (row - r0) * bw + (col - c0);
      if (horseMask[mi]) continue;
      const near =
        (col > c0 && horseMask[mi - 1]) || (col < c1 && horseMask[mi + 1]) || (row > r0 && horseMask[mi - bw]) || (row < r1 && horseMask[mi + bw]);
      if (!near) continue;
      const i = row * COLS + col;
      f.r[i] *= 0.35;
      f.g[i] *= 0.35;
      f.b[i] *= 0.4;
    }
  }
};

// Hair drawn as a soft volume: every strand adds coverage to the cells it passes through, and
// each cell's character and brightness come from how much hair covers it. Nothing depends on a
// strand's exact angle, so the hair doesn't flicker as it moves, and many strands read as one
// full, fluffy fall of hair.
let hairCover = new Float32Array(0);
const hairTouched: number[] = [];

const plotHair = (f: Frame, strands: Strand[], ax: number, ay: number, face: number, zOff: number, flash: number) => {
  const k = HORSE_K;
  if (hairCover.length < N) hairCover = new Float32Array(N);
  hairTouched.length = 0;
  for (const st of strands) {
    const n = st.x.length;
    for (let j = 1; j < n; j++) {
      const x0 = ax + face * st.x[j - 1] * k;
      const y0 = ay + (zOff * 0.72 + st.y[j - 1] * 0.65) * k;
      const x1 = ax + face * st.x[j] * k;
      const y1 = ay + (zOff * 0.72 + st.y[j] * 0.65) * k;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0) / CW, Math.abs(y1 - y0) / CH) * 2));
      // thicker and brighter near the root, thinning toward the tip
      const weight = (1 - ((j - 1) / n) * 0.55) / steps;
      for (let s2 = 0; s2 < steps; s2++) {
        const col = Math.floor((x0 + ((x1 - x0) * s2) / steps) / CW);
        const row = Math.floor((y0 + ((y1 - y0) * s2) / steps) / CH);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
        const i = row * COLS + col;
        if (hairCover[i] === 0) hairTouched.push(i);
        hairCover[i] += weight;
      }
    }
  }
  for (const i of hairTouched) {
    const cover = Math.min(1, hairCover[i] * 0.5);
    hairCover[i] = 0;
    const lum = 0.35 + 0.65 * cover;
    setCell(f, i, lumChar(0.18 + cover * 0.62), [
      lerp(HAIR_RGB[0] * lum, 255, flash),
      lerp(HAIR_RGB[1] * lum, 255, flash),
      lerp(HAIR_RGB[2] * lum, 255, flash),
    ]);
  }
};

interface Strand {
  x: Float32Array;
  y: Float32Array;
  px: Float32Array;
  py: Float32Array;
  seg: number;
}

const newStrand = (points: number, seg: number, rx: number, ry: number): Strand => {
  const x = new Float32Array(points);
  const y = new Float32Array(points);
  for (let k = 0; k < points; k++) {
    x[k] = rx - k * seg * 0.3;
    y[k] = ry + k * seg;
  }
  return { x, y, px: x.slice(), py: y.slice(), seg };
};

interface HorseState {
  mane: Strand[];
  tail: Strand[];
  wind: number;
  face: number;
  rest: number;
  // leftover time for the fixed-rate simulation
  acc: number;
  settled: boolean;
}

const newHorseState = (): HorseState => ({
  mane: Array.from({ length: 14 }, (_, k) => newStrand(6, 5, 22 + k * 2, -100 - k * 2)),
  tail: Array.from({ length: 12 }, (_, k) => newStrand(10, 6 + hash(k, 21) * 3, -52, -90)),
  wind: 0,
  face: 1,
  rest: 0,
  acc: 0,
  settled: false,
});

// Where everything attaches this frame: body bob, neck and head (which reach forward at a
// gallop and drop to graze when the horse has stood a while).
interface HorseRig {
  bob: number;
  nx: number;
  ny: number;
  hx: number;
  hy: number;
}

const horseRig = (gait: number, moving: boolean, now: number, rest: number): HorseRig => {
  const bob = moving ? Math.sin(gait * 2) * 3 : Math.sin(now / 1100) * 0.8;
  const reach = moving ? 6 + Math.sin(gait * 2 + 1) * 3 : Math.sin(now / 1300) * 1.5;
  // grazing: after a few seconds still, the head goes down to the grass and back up now and then
  const phase = rest - 3;
  const graze = phase > 0 ? smooth(Math.min(1, phase / 1.2)) * (0.6 + 0.4 * Math.sin(phase * 0.9)) : 0;
  return {
    bob,
    nx: 46 + reach * 0.5 + graze * 6,
    ny: -110 + bob + reach * 0.3 + graze * 34,
    hx: 54 + reach + graze * 16,
    hy: -124 + bob + reach * 0.5 + graze * 82,
  };
};

// One fixed simulation step for a strand pinned at (rx, ry). `force` is a sideways push (wind
// from running, a breeze), rippling down the strand from `phase`; `bend` resists kinks. If a
// dock direction is given, the first segment is held along it, like the bone at a tail's base.
const HAIR_DT = 1 / 120;

const stepStrand = (st: Strand, rx: number, ry: number, force: number, bend: number, phase: number, dockX = 0, dockY = 0) => {
  const n = st.x.length;
  st.x[0] = st.px[0] = rx;
  st.y[0] = st.py[0] = ry;
  const pinned = dockX || dockY ? 2 : 1;
  if (pinned === 2) {
    st.x[1] = st.px[1] = rx + dockX * st.seg;
    st.y[1] = st.py[1] = ry + dockY * st.seg;
  }
  const dt2 = HAIR_DT * HAIR_DT;
  for (let k = pinned; k < n; k++) {
    // light damping: hair keeps its swing and settles over about a second
    const vx = (st.x[k] - st.px[k]) * 0.993;
    const vy = (st.y[k] - st.py[k]) * 0.993;
    st.px[k] = st.x[k];
    st.py[k] = st.y[k];
    const t = k / n;
    const ripple = 1 + 0.35 * Math.sin(phase - k * 0.9);
    st.x[k] += vx + force * ripple * dt2 * (0.4 + t);
    st.y[k] += vy + 900 * dt2;
  }
  for (let pass = 0; pass < 4; pass++) {
    // keep each segment its own length
    for (let k = pinned; k < n; k++) {
      const dx = st.x[k] - st.x[k - 1];
      const dy = st.y[k] - st.y[k - 1];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (d - st.seg) / d;
      if (k === pinned) {
        st.x[k] -= dx * diff;
        st.y[k] -= dy * diff;
      } else {
        st.x[k - 1] += dx * diff * 0.5;
        st.y[k - 1] += dy * diff * 0.5;
        st.x[k] -= dx * diff * 0.5;
        st.y[k] -= dy * diff * 0.5;
      }
    }
    // a little resistance to kinks, so strands curve instead of folding
    for (let k = pinned + 1; k < n; k++) {
      const tx = st.x[k - 1] + (st.x[k - 1] - st.x[k - 2]);
      const ty = st.y[k - 1] + (st.y[k - 1] - st.y[k - 2]);
      st.x[k] += (tx - st.x[k]) * bend;
      st.y[k] += (ty - st.y[k]) * bend;
    }
  }
};

// Advance the hair by `dt` seconds, in fixed 1/120 s steps so it behaves the same at any frame
// rate. `face` is which way the horse looks in the world.
const stepHair = (hs: HorseState, rig: HorseRig, moving: boolean, face: number, dt: number, now: number) => {
  // turning around: the hair keeps going the way it was, so it swings across the body
  if (face !== hs.face) {
    for (const st of [...hs.mane, ...hs.tail]) {
      for (let k = 1; k < st.x.length; k++) {
        st.x[k] = st.x[0] - (st.x[k] - st.x[0]);
        st.px[k] = st.px[0] - (st.px[k] - st.px[0]);
      }
    }
    hs.face = face;
  }
  hs.wind = lerp(hs.wind, moving ? 1 : 0, Math.min(1, dt * 3));
  hs.acc = Math.min(hs.acc + dt, HAIR_DT * 8);
  if (!hs.settled) {
    // the first time, let the hair fall and settle for a second before it's seen
    hs.settled = true;
    hs.acc += 1;
  }
  // the tail's bone: back and down at rest, lifting and streaming back at a gallop
  const dockX = lerp(-0.6, -0.95, hs.wind);
  const dockY = lerp(0.8, -0.15, hs.wind);
  const dl = Math.hypot(dockX, dockY) || 1;
  while (hs.acc >= HAIR_DT) {
    hs.acc -= HAIR_DT;
    // a slow, smooth breeze; running blows the hair back and sends ripples down it
    const breeze = Math.sin(now / 900) * 140 + Math.sin(now / 1700 + 1) * 90;
    hs.tail.forEach((st, k) => {
      const spread = (k / (hs.tail.length - 1) - 0.5) * 2; // -1..1 across the tail
      const force = -2300 * hs.wind * (0.8 + hash(k, 23) * 0.4) + breeze * (0.6 + 0.4 * hs.wind) + spread * 90;
      stepStrand(st, -50 + spread * 2, -91 + rig.bob * 0.5 + spread * 1.5, force, 0.025, now / 170 + k * 0.7, dockX / dl, dockY / dl);
    });
    hs.mane.forEach((st, k) => {
      const t = k / (hs.mane.length - 1);
      // roots run along the crest, from the withers up to the poll
      const rx = lerp(22, rig.hx - 2, t);
      const ry = lerp(-98 + rig.bob, rig.hy - 6, t);
      stepStrand(st, rx, ry, -2800 * hs.wind + breeze * 0.5, 0.08, now / 150 + k * 0.6);
    });
  }
};

// Motes of light: drawn inward (summoning) or outward and upward (dissolving).
const lightMotes = (f: Frame, cx: number, cy: number, t: number, outward: boolean) => {
  for (let k = 0; k < 36; k++) {
    const a = hash(k, 5) * Math.PI * 2 + t * (outward ? 1.5 : 4);
    const reach = (outward ? t : 1 - t) * (60 + hash(k, 6) * 70) * worldZoom;
    const col = Math.round((cx + Math.cos(a) * reach * 1.4) / CW);
    const row = Math.round((cy - 50 * worldZoom + Math.sin(a) * reach * 0.6 - (outward ? t * 60 * worldZoom : 0)) / CH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    const c: RGB = k % 3 === 0 ? [190, 170, 255] : k % 3 === 1 ? [170, 230, 255] : [245, 245, 255];
    setCell(f, row * COLS + col, k % 4 ? "." : "*", c);
  }
};

// The summoning: a rune circle opens on the ground, motes spiral in, a pillar of light rises.
const summonCircle = (f: Frame, cx: number, cy: number, t: number, now: number) => {
  const open = smooth(t / 0.3);
  const rx = 56 * worldZoom * open;
  const ry = rx * 0.38;
  const RUNES = "*+x#o=";
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2 + now / 900;
    for (const ring of [1, 0.72]) {
      const col = Math.round((cx + Math.cos(a) * rx * ring) / CW);
      const row = Math.round((cy + Math.sin(a) * ry * ring) / CH);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
      const pulse = 0.6 + 0.4 * Math.sin(now / 120 + k);
      const ch = ring === 1 ? RUNES[k % RUNES.length] : k % 2 ? "-" : ".";
      setCell(f, row * COLS + col, ch, [180 * pulse + 40, 150 * pulse + 60, 255 * pulse]);
    }
  }
  glow(f, cx, cy - 60 * worldZoom * t, (40 + 90 * t) * worldZoom, [170, 170, 255], 0.35 + 0.35 * t);
  lightMotes(f, cx, cy, t, false);
};

interface WorldAnim {
  pose: Pose;
  gait: number;
  horse: HorseState;
  last: number;
}

// Draws a side-view figure (mage, creature, tree) small, standing at screen point (sx, sy).
const figurePaint = (f: Frame, sx: number, sy: number, flash = 0, flip = false, scale = FIGURE): Paint => ({
  f,
  flash,
  flipAt: flip ? 0 : undefined,
  cam: { x: -(sx - SCREEN_CX) / scale, y: -(sy - SCREEN_CY) / scale, s: scale },
});

const shadowAt = (f: Frame, cx: number, cy: number, rx: number) => {
  const ry = rx * 0.38;
  cellsAround(cx - rx, cy - ry, cx + rx, cy + ry, (col, row, x, y) => {
    const i = row * COLS + col;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d < 1) {
      const k = 0.3 + 0.7 * d;
      f.r[i] *= k;
      f.g[i] *= k;
      f.b[i] *= k;
    }
  });
};

interface TerrainCell {
  water: boolean;
  // grass is drawn as blades that lean with the wind each frame; lean is this blade's own tilt
  blade: boolean;
  lean: number;
  ch: string;
  c: RGB;
  x: number;
  z: number;
  depth: number;
  frozen: boolean;
  rnd: number;
}

const terrainCache = new Map<number, TerrainCell>();

// What the cell at absolute grid position (cx, rz) shows: find the ground it looks at,
// then light that ground by its slope.
const terrainCell = (cx: number, rz: number): TerrainCell => {
  const sx = (cx + 0.5) * CW;
  const sy = (rz + 0.5) * CH;
  const x = sx / S_X;
  let h = heightAt(x, sy / S_Z);
  let z = (sy + h * S_H) / S_Z;
  // a few refinement passes: the ground height decides which spot of land this cell sees
  for (let pass = 0; pass < 3; pass++) {
    h = heightAt(x, z);
    z = (sy + h * S_H) / S_Z;
  }
  h = heightAt(x, z);
  const rnd = hash(Math.floor(x * 2.5), Math.floor(z * 2.5));
  if (h < WATER) return { water: true, blade: false, lean: 0, ch: " ", c: [0, 0, 0], x, z, depth: WATER - h, frozen: temperature(x, z) < 0.3, rnd };

  const hx = heightAt(x + 0.4, z) - h;
  const hz = heightAt(x, z + 0.4) - h;
  // relief is exaggerated a little so hills read clearly from above
  const n = norm([(-hx / 0.4) * 1.8, 1, (-hz / 0.4) * 1.8]);
  const diff = Math.max(0, n[0] * MOON_DIR[0] + n[1] * MOON_DIR[1] + n[2] * MOON_DIR[2]);
  const biome = biomeAt(x, z);
  const cell = (ch: string, c: RGB, blade = false, lean = 0): TerrainCell => ({ water: false, blade, lean, ch, c, x, z, depth: 0, frozen: false, rnd });
  // Every surface gets its own family of characters, so you can tell what you're looking at
  // by texture alone: grass blades, dense lettered stone, dotted sand, soft snow, paving.
  const l = (0.34 + 0.8 * diff) * (0.9 + 0.04 * h) * 1.05;
  // drifting pools of moonlight: brighter, paler patches that make dark figures stand out
  const pool = smooth((vnoise(x * 0.035 + 11, z * 0.035 - 7) - 0.55) / 0.25);
  const lit = (c: RGB, k = 1): RGB => {
    const v = l * k * 1.3 * (1 + pool * 0.7);
    return [lerp(c[0] * v, 205, pool * 0.38), lerp(c[1] * v, 240, pool * 0.38), lerp(c[2] * v, 230, pool * 0.38)];
  };
  const r2 = hash(Math.floor(x * 5) + 3, Math.floor(z * 5) - 9);
  const pick = (set: string) => set[Math.floor(r2 * set.length)];

  if (n[1] < 0.72) {
    // bare rock on steep slopes: dense, lettered texture
    if (h > 5) return cell(pick("#%&@$8"), lit([200, 208, 222]));
    return cell(pick("#%&$@QOdbpqWM8"), lit([128, 124, 118], 0.9 + 0.2 * rnd));
  }
  if (h > 5 || biome === "snow") {
    // snow: soft dots and glints, cool blue in the shade
    if (rnd < 0.08) return cell(" ", [0, 0, 0]);
    return cell(rnd > 0.95 ? "*" : pick(".'`-,:~"), lit([lerp(170, 222, diff), lerp(186, 230, diff), 244]));
  }
  if (h < WATER + 0.035 && biome !== "desert") return cell(pick(".:,'"), lit([160, 148, 116])); // wet shore
  if (biome === "desert") {
    // sand: fine dots with ripples, gaps of shadow between
    if (rnd < 0.12) return cell(" ", [0, 0, 0]);
    const ripple = Math.sin(x * 1.6 + z * 0.5 + vnoise(x * 0.1, z * 0.1) * 3) > 0.6;
    return cell(ripple ? "~" : pick(".,`'."), lit([214, 178, 122], 0.85 + 0.25 * rnd));
  }
  if (biome === "ruins") {
    const paved = Math.floor(x * 1.2) % 5 === 0 || Math.floor(z * 1.2) % 4 === 0;
    if (paved && rnd < 0.75) return cell(pick("_|=[]"), lit([132, 132, 122]));
    if (rnd < 0.3) return cell(pick(".,:;"), lit([100, 106, 92]));
  }
  // winding dirt trails cross the green lands
  const trail = trailDist(x, z);
  if (trail < 1.8) {
    if (trail > 1.2 && rnd < 0.5) return cell(pick(",'`"), lit([90, 120, 60])); // worn edges
    if (trail <= 1.2) return cell(pick(".:,'."), lit([150, 118, 80], 0.85 + 0.3 * rnd));
  }
  // flowers bloom in fields, each field leaning toward one color
  const field = smooth((vnoise(x * 0.03 + 150, z * 0.03) - 0.58) / 0.2);
  if (biome !== "forest" && hash(Math.floor(x * 3), Math.floor(z * 3) + 7) < 0.012 + field * 0.22) {
    const theme = FLOWER_COLORS[Math.floor(vnoise(x * 0.02 + 500, z * 0.02) * FLOWER_COLORS.length)];
    const fc = rnd < 0.7 ? theme : FLOWER_COLORS[Math.floor(hash(Math.floor(x * 3), 5) * FLOWER_COLORS.length)];
    return cell(rnd > 0.5 ? "*" : "o", [fc[0] * (0.75 + pool * 0.3), fc[1] * (0.75 + pool * 0.3), fc[2] * (0.75 + pool * 0.3)]);
  }
  const gap = biome === "forest" ? 0.18 : 0.08;
  if (rnd < gap) return cell(" ", [0, 0, 0]);
  if (biome === "forest" && rnd < gap + 0.12) return cell(pick(",.'"), lit([120, 80, 46])); // fallen leaves
  // the green drifts slowly across the land, from yellow-green to blue-green
  const hue = vnoise(x * 0.008 + 90, z * 0.008 - 60);
  const shade = 0.6 + 0.6 * r2;
  const green: RGB = [lerp(80, 36, hue), lerp(166, 150, hue), lerp(60, 98, hue)];
  const base: RGB = biome === "forest" ? [green[0] * 0.75 * shade, green[1] * 0.72 * shade, green[2] * 0.75 * shade] : [green[0] * shade, green[1] * shade, green[2] * shade];
  // short, grazed patches break up the tall grass
  if (vnoise(x * 0.05, z * 0.05 + 33) < 0.28) return cell(pick(",'`.,"), lit(base, 0.85));
  return cell("|", lit(base), true, (r2 - 0.5) * 0.9);
};

// The vignette only depends on the grid size, so it's worked out once per size.
let vignette: { cols: number; rows: number; v: Float32Array } | null = null;
const vignetteFor = (cols: number, rows: number) => {
  if (!vignette || vignette.cols !== cols || vignette.rows !== rows) {
    const v = new Float32Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        v[row * cols + col] = 1 - 0.3 * Math.min(1, ((col - cols / 2) / (cols / 2)) ** 2 + ((row - rows / 2) / (rows / 2)) ** 2) ** 2;
      }
    }
    vignette = { cols, rows, v };
  }
  return vignette.v;
};

// Slow banks of mist drift across the land, paling whatever they pass over.
const mistOver = (f: Frame, i: number, x: number, z: number, now: number) => {
  const m = vnoise(x * 0.022 + now / 9000, z * 0.035 - now / 13000);
  if (m < 0.56) return;
  const k = Math.min(0.42, (m - 0.56) * 1.7);
  f.r[i] = lerp(f.r[i], 150, k);
  f.g[i] = lerp(f.g[i], 156, k);
  f.b[i] = lerp(f.b[i], 196, k);
  if (f.ch[i] === " " && m > 0.62) f.ch[i] = ".";
};

// What grows or stands on each patch of land never changes, so it's worked out once per patch
// (the terrain and climate math behind it is heavy) and reused every frame after.
const enum Scenery { ForestTree, SnowPine, Cactus, Pillar, Oak, Rock, Bush, Log, Lantern, Tuft }

interface SceneryInfo {
  kind: Scenery;
  x: number;
  z: number;
  h: number;
  seed: number;
  size: number;
  biome: Biome;
  pine: boolean;
  autumn: boolean;
}

const SCATTER = 4.5;
const sceneryCache = new Map<number, SceneryInfo | null>();

const sceneryAt = (gx: number, gz: number): SceneryInfo | null => {
  const key = gx * 131071 + gz;
  const hit = sceneryCache.get(key);
  if (hit !== undefined) return hit;
  if (sceneryCache.size > 120000) sceneryCache.clear();
  const info = decideScenery(gx, gz);
  sceneryCache.set(key, info);
  return info;
};

const decideScenery = (gx: number, gz: number): SceneryInfo | null => {
  const seed = gx * 7349 + gz * 1931;
  const r = hash(seed, 1);
  if (r > 0.75) return null;
  const x = (gx + 0.2 + hash(seed, 2) * 0.6) * SCATTER;
  const z = (gz + 0.2 + hash(seed, 3) * 0.6) * SCATTER;
  const h = heightAt(x, z);
  if (h < WATER + 0.05) return null;
  // castle grounds are kept clear of wild scenery
  const keep = castleNear(x, z);
  if (keep && Math.hypot(x - keep.x, z - keep.z) < CASTLE_R + 4) return null;
  const b = biomeAt(x, z);
  // a slow density field makes groves and clearings; another groups trees by species;
  // rocks gather in outcrops; each thing gets its own size
  const dense = vnoise(x * 0.025 + 70, z * 0.025 - 40);
  const rr = r / (0.25 + 1.5 * dense * dense);
  const outcrop = vnoise(x * 0.04 + 200, z * 0.04) > 0.62;
  const trail = trailDist(x, z);
  const onTrail = trail < 2.5;
  let kind: Scenery | null = null;
  if (b === "forest" && rr < 0.55 && !onTrail) kind = Scenery.ForestTree;
  else if (b === "snow" && rr < 0.22) kind = Scenery.SnowPine;
  else if (b === "desert" && rr < 0.1) kind = Scenery.Cactus;
  else if (b === "ruins" && rr < 0.28) kind = Scenery.Pillar;
  else if ((b === "meadow" || b === "lake") && rr < 0.05 && !onTrail) kind = Scenery.Oak;
  else if (outcrop ? r < 0.35 : r < 0.04) kind = Scenery.Rock;
  else if ((b === "meadow" || b === "lake") && rr < 0.14 && !onTrail) kind = Scenery.Bush;
  else if (b === "forest" && r > 0.9 && hash(seed, 17) < 0.5) kind = Scenery.Log;
  else if (b !== "desert" && b !== "snow" && trail > 2.4 && trail < 3.6 && hash(seed, 13) < 0.3) kind = Scenery.Lantern;
  else if ((b === "meadow" || b === "lake" || b === "forest") && r < 0.4) kind = Scenery.Tuft;
  if (kind === null) return null;
  return {
    kind,
    x,
    z,
    h,
    seed,
    size: 0.8 + 0.5 * hash(seed, 7),
    biome: b,
    pine: vnoise(x * 0.02 - 5, z * 0.02 + 9) > 0.5,
    autumn: hash(seed, 9) > 0.6,
  };
};

const composeWorld = (w: World, anim: WorldAnim, alpha: number, now: number): Frame => {
  // build one spare row and column so the view can slide by a fraction of a cell
  setGrid(w.viewCols + 1, w.viewRows + 1);
  const f = takeFrame();
  f.viewCols = w.viewCols;
  f.viewRows = w.viewRows;
  const dt = Math.min(100, now - (anim.last || now));
  anim.last = now;
  const k = 1 - Math.pow(0.0005, dt / 1000);
  anim.pose = blendPose(anim.pose, worldPose(w), Math.min(1, k * 3));
  // a natural gallop: about two strides a second
  if (w.mounted && w.moving) anim.gait += dt * 0.0125;
  anim.horse.rest = w.moving ? 0 : anim.horse.rest + dt / 1000;

  const px = lerp(w.prevPx, w.px, alpha);
  const pz = lerp(w.prevPz, w.pz, alpha);
  w.camX = lerp(w.camX, px, Math.min(1, k * 2.5));
  w.camZ = lerp(w.camZ, pz, Math.min(1, k * 2.5));
  // The terrain camera snaps to the character grid (characters can't sit between cells anyway),
  // so each cell of land maps to a fixed spot and can be computed once and reused.
  const viewCx = (w.viewCols * CW) / 2;
  const viewCy = (w.viewRows * CH) / 2;
  const colF = (w.camX * S_X - viewCx) / CW;
  const rowF = (w.camZ * S_Z - viewCy) / CH;
  const camCol = Math.floor(colF);
  const camRow = Math.floor(rowF);
  f.offX = colF - camCol;
  f.offY = rowF - camRow;
  const camX = (camCol * CW + viewCx) / S_X;
  const camZ = (camRow * CH + viewCy) / S_Z;
  const project = (x: number, z: number, h = heightAt(x, z)): [number, number] => [
    viewCx + (x - camX) * S_X,
    viewCy + (z - camZ) * S_Z - h * S_H,
  ];

  // ---- terrain: cached land, live water ----
  if (terrainCache.size > 250000) terrainCache.clear();
  const hv = norm([MOON_DIR[0] + VIEW_DIR[0], MOON_DIR[1] + VIEW_DIR[1], MOON_DIR[2] + VIEW_DIR[2]]);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const cx = camCol + col;
      const rz = camRow + row;
      const key = cx * 131071 + rz;
      let cell = terrainCache.get(key);
      if (!cell) {
        cell = terrainCell(cx, rz);
        terrainCache.set(key, cell);
      }
      if (!cell.water) {
        if (cell.blade) {
          const wind = Math.sin(cell.x * 0.17 + cell.z * 0.06 - now / 750) * 0.85 + cell.lean;
          setCell(f, i, wind < -0.4 ? "\\" : wind > 0.4 ? "/" : "|", cell.c);
        } else setCell(f, i, cell.ch, cell.c);
        mistOver(f, i, cell.x, cell.z, now);
        continue;
      }
      // water: ripples catch the moon; frozen lakes just shimmer faintly
      const { x, z, depth, frozen, rnd } = cell;
      // cheap ripples (sines, not noise): a large view can be mostly lake
      const rx = 0.16 * Math.sin(x * 1.3 + z * 0.4 + now / 520) + 0.09 * Math.sin(z * 2.1 - x * 0.7 - now / 380 + rnd * 6);
      const rzn = 0.16 * Math.sin(z * 1.1 - x * 0.5 + now / 610) + 0.09 * Math.sin(x * 1.9 + now / 430 + rnd * 4);
      const wn = norm([frozen ? 0 : rx, 1, frozen ? 0 : rzn]);
      const spec = Math.pow(Math.max(0, wn[0] * hv[0] + wn[1] * hv[1] + wn[2] * hv[2]), frozen ? 12 : 60) * (frozen ? 0.5 : 1.6);
      const shore = depth < 0.035 && !frozen;
      let c: RGB = frozen ? [150, 180, 210] : [lerp(40, 10, clamp01(depth)), lerp(84, 26, clamp01(depth)), lerp(104, 58, clamp01(depth))];
      if (shore) c = [150, 175, 185];
      const l = Math.min(1, spec);
      const ch = shore ? (rnd > 0.5 ? "~" : "-") : l > 0.55 ? (rnd > 0.7 ? "*" : "=") : frozen ? (rnd > 0.6 ? "-" : ".") : rnd > 0.55 ? "~" : "-";
      setCell(f, i, ch, [lerp(c[0], 230, l), lerp(c[1], 236, l), lerp(c[2], 250, l)]);
      mistOver(f, i, x, z, now);
    }
  }

  // ---- everything standing on the land, drawn back to front ----
  type Thing = { z: number; shadow?: [number, number, number]; draw: () => void };
  const things: Thing[] = [];
  const G = SCATTER;
  const halfW = (COLS * CW) / 2 / S_X + 6;
  const halfD = (ROWS * CH) / 2 / S_Z + 14;
  for (let gx = Math.floor((camX - halfW) / G); gx <= Math.floor((camX + halfW) / G); gx++) {
    for (let gz = Math.floor((camZ - halfD) / G); gz <= Math.floor((camZ + halfD) / G); gz++) {
      const sc = sceneryAt(gx, gz);
      if (!sc) continue;
      const { x, z, seed } = sc;
      const [sx, sy] = project(x, z, sc.h);
      if (sx < -100 || sx > COLS * CW + 100 || sy < -60 || sy > ROWS * CH + 220) continue;
      const size = sc.size;
      const add = (draw: (p: Paint) => void, shadowR: number, scale = FIGURE) =>
        things.push({
          z,
          shadow: [sx + shadowR * size * worldZoom * 0.35, sy + 3, shadowR * size * worldZoom],
          draw: () => draw(figurePaint(f, sx, sy, 0, false, scale * size * worldZoom)),
        });
      switch (sc.kind) {
        case Scenery.ForestTree:
          add((p) => (sc.pine ? drawPine(p, 0, 0, seed, false) : drawOak(p, 0, 0, seed, sc.autumn)), 20, 0.4);
          break;
        case Scenery.SnowPine:
          add((p) => drawPine(p, 0, 0, seed, true), 16, 0.36);
          break;
        case Scenery.Cactus:
          add((p) => drawCactus(p, 0, 0, seed), 12, 0.42);
          break;
        case Scenery.Pillar:
          add((p) => drawPillar(p, 0, 0, seed), 14, 0.4);
          break;
        case Scenery.Oak:
          add((p) => drawOak(p, 0, 0, seed, false), 20, 0.42);
          break;
        case Scenery.Rock:
          add((p) => drawRock(p, 0, 0, seed, sc.biome === "snow" ? SNOW_MAT : sc.biome === "ruins" ? STONE_MAT : ROCK), 12, 0.6);
          break;
        case Scenery.Bush:
          add((p) => {
            for (let k = 0; k < 4; k++) ball(p, (hash(seed, k + 50) - 0.5) * 30, -10 - hash(seed, k + 60) * 10, 10 + hash(seed, k + 70) * 6, LEAVES);
          }, 14, 0.5);
          break;
        case Scenery.Log:
          // a fallen log, going green with moss
          add((p) => {
            capsule(p, -34, -6, 34, -4, 7, BARK);
            ellipse(p, 6, -10, 16, 4, MOSS_MAT);
            ball(p, 34, -4, 6, { c: [150, 112, 74], rough: 0.4 });
          }, 18, 0.55);
          break;
        case Scenery.Lantern:
          // lanterns light the way along the trails
          add((p) => drawLantern(p, seed, now), 6, 0.45);
          break;
        case Scenery.Tuft:
          // a tuft of grass or a few flowers, swaying
          things.push({
            z,
            draw: () => {
              const sway = Math.round(Math.sin(now / 650 + seed) * 0.8);
              const col = Math.floor(sx / CW);
              const row = Math.floor(sy / CH);
              for (let k = 0; k < 3; k++) {
                const cc = col + k - 1 + (k === 1 ? sway : 0);
                const rr = row - (k === 1 ? 1 : 0);
                if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) continue;
                const flower = sc.biome !== "forest" && hash(seed, k) < 0.35;
                setCell(f, rr * COLS + cc, flower ? "*o@"[k] : "|/\\"[k], flower ? FLOWER_COLORS[Math.floor(hash(seed, k + 5) * FLOWER_COLORS.length)] : [50, 140, 70]);
              }
            },
          });
          break;
      }
    }
  }

  // landmarks: rare set pieces that give the land places to remember
  const LM = 140;
  for (let lx = Math.floor((camX - halfW - 20) / LM); lx <= Math.floor((camX + halfW + 20) / LM); lx++) {
    for (let lz = Math.floor((camZ - halfD - 20) / LM); lz <= Math.floor((camZ + halfD + 20) / LM); lz++) {
      const seed = lx * 92821 + lz * 68917;
      if (hash(seed, 1) > 0.55) continue;
      const cx = (lx + 0.25 + hash(seed, 2) * 0.5) * LM;
      const cz = (lz + 0.25 + hash(seed, 3) * 0.5) * LM;
      if (isWater(cx, cz)) continue;
      const nearCastle = castleNear(cx, cz);
      if (nearCastle && Math.hypot(cx - nearCastle.x, cz - nearCastle.z) < CASTLE_R + 30) continue;
      const lb = biomeAt(cx, cz);
      const green = lb === "meadow" || lb === "forest" || lb === "lake";
      // villages, watchtowers and windmills settle the green lands; elsewhere, older stones
      let kind = Math.floor(hash(seed, 4) * 6);
      if (kind === 3 && !green) kind = 0;
      if (kind === 4 && lb === "desert") kind = 2;
      if (kind === 5 && lb !== "meadow") kind = green ? 3 : 1;
      const place = (x: number, z: number, draw: (p: Paint) => void, shadowR: number, scale: number) => {
        if (isWater(x, z)) return;
        const [sx, sy] = project(x, z);
        if (sx < -160 || sx > COLS * CW + 160 || sy < -80 || sy > ROWS * CH + 260) return;
        things.push({
          z,
          shadow: [sx + shadowR * 0.35 * worldZoom, sy + 3, shadowR * worldZoom],
          draw: () => draw(figurePaint(f, sx, sy, 0, false, scale * worldZoom)),
        });
      };
      if (kind === 0) {
        // a ring of standing stones
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          place(cx + Math.cos(a) * 8, cz + Math.sin(a) * 6, (p) => drawPillar(p, 0, 0, seed + k), 14, 0.42);
        }
        place(cx, cz, (p) => drawRock(p, 0, 0, seed, STONE_MAT), 14, 0.9);
      } else if (kind === 1) {
        // an ancient tree, far bigger than the rest, ringed by old stones
        place(cx, cz, (p) => drawOak(p, 0, 0, seed, hash(seed, 6) > 0.5), 44, 0.85);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + 0.4;
          place(cx + Math.cos(a) * 9, cz + Math.sin(a) * 7, (p) => drawRock(p, 0, 0, seed + k, ROCK), 10, 0.5);
        }
      } else if (kind === 3) {
        // a little village: cottages around a well, lanterns between them
        const homes = 3 + Math.floor(hash(seed, 5) * 3);
        for (let k = 0; k < homes; k++) {
          const a = (k / homes) * Math.PI * 2 + hash(seed, 6);
          place(cx + Math.cos(a) * 16, cz + Math.sin(a) * 11, (p) => drawCottage(p, seed + k, now), 44, 0.7);
        }
        place(cx, cz, (p) => drawWell(p), 18, 0.65);
        for (let k = 0; k < homes; k++) {
          const a = ((k + 0.5) / homes) * Math.PI * 2 + hash(seed, 6);
          place(cx + Math.cos(a) * 10, cz + Math.sin(a) * 7, (p) => drawLantern(p, seed + k, now), 6, 0.55);
        }
      } else if (kind === 4) {
        // a lone stone watchtower
        place(cx, cz, (p) => drawTower(p, seed, now), 36, 0.78);
        place(cx + 6, cz + 4, (p) => drawLantern(p, seed, now), 6, 0.45);
      } else if (kind === 5) {
        // a windmill turning over the meadow
        place(cx, cz, (p) => drawWindmill(p, seed, now), 34, 0.8);
      } else {
        // a field of tumbled boulders
        for (let k = 0; k < 10; k++) {
          const a = hash(seed, k + 10) * Math.PI * 2;
          const d = 2 + hash(seed, k + 20) * 11;
          place(cx + Math.cos(a) * d, cz + Math.sin(a) * d * 0.8, (p) => drawRock(p, 0, 0, seed + k, ROCK), 14, 0.6 + hash(seed, k + 30) * 0.7);
        }
      }
    }
  }

  // castles: corner towers, curtain walls, a gatehouse and a keep, on their mound
  for (let gx = Math.floor((camX - halfW - 40) / CASTLE_GRID); gx <= Math.floor((camX + halfW + 40) / CASTLE_GRID); gx++) {
    for (let gz = Math.floor((camZ - halfD - 40) / CASTLE_GRID); gz <= Math.floor((camZ + halfD + 40) / CASTLE_GRID); gz++) {
      const c = castleIn(gx, gz);
      if (!c) continue;
      const banner = BANNER_COLORS[Math.floor(hash(c.seed, 11) * BANNER_COLORS.length)];
      const { HX, HZ } = castleSize(c);
      const piece = (x: number, z: number, draw: (p: Paint) => void, shadowR: number, scale: number) => {
        const [sx, sy] = project(c.x + x, c.z + z);
        if (sx < -220 || sx > COLS * CW + 220 || sy < -120 || sy > ROWS * CH + 320) return;
        things.push({
          z: c.z + z,
          shadow: [sx + shadowR * 0.35 * worldZoom, sy + 3, shadowR * worldZoom],
          draw: () => draw(figurePaint(f, sx, sy, 0, false, scale * worldZoom)),
        });
      };
      // walls along the back and front (with a gap for the gate), then down the sides
      for (let x = -HX + 3; x <= HX - 3; x += 4) {
        piece(x, -HZ, (p) => drawWall(p, 40, c.seed + x), 6, 0.62);
        if (Math.abs(x) > 4) piece(x, HZ, (p) => drawWall(p, 40, c.seed + x + 99), 6, 0.62);
      }
      for (let z = -HZ + 2.5; z <= HZ - 2.5; z += 2.5) {
        piece(-HX, z, (p) => drawWall(p, 14, c.seed + z), 4, 0.62);
        piece(HX, z, (p) => drawWall(p, 14, c.seed + z + 7), 4, 0.62);
      }
      for (const [x, z] of [[-HX, -HZ], [HX, -HZ], [-HX, HZ], [HX, HZ]]) piece(x, z, (p) => drawTower(p, c.seed + x + z, now), 30, 0.85);
      piece(0, HZ + 0.5, (p) => drawGatehouse(p, c.seed, now), 26, 0.72);
      piece(0, -HZ * 0.3, (p) => drawKeep(p, c.seed, now, banner), 44, 0.9);
      piece(-HX * 0.5, HZ * 0.35, (p) => drawWell(p), 14, 0.6);
    }
  }

  // creatures
  for (const m of w.mobs) {
    const mx = lerp(m.prevX, m.x, alpha);
    const mz = lerp(m.prevZ, m.z, alpha);
    const my = lerp(m.prevY, m.y, alpha);
    const [sx, sy] = project(mx, mz);
    if (sx < -130 || sx > COLS * CW + 130 || sy < -100 || sy > ROWS * CH + 130) continue;
    const tint = MOBS[m.kind].tint;
    if (m.deadT) {
      things.push({ z: mz, draw: () => mobBurst(f, sx, sy - 20 * worldZoom, m.deadT, tint) });
      continue;
    }
    const faceRight = w.px > m.x;
    const sizes: Record<MobKind, number> = { bug: 38, slime: 15, bat: 10, golem: 28 };
    things.push({
      z: mz,
      shadow: [sx, sy, sizes[m.kind] * worldZoom],
      draw: () => {
        const p = figurePaint(f, sx, sy, m.hitT ? 0.5 : 0, faceRight);
        if (m.kind === "bug") {
          const a = m.anim;
          a.lunge = lerp(a.lunge, m.atkT ? 1 : 0, k * 3);
          a.open = lerp(a.open, m.atkT ? 1 : 0, k * 3);
          a.recoil = lerp(a.recoil, m.hitT ? 1 : 0, k * 4);
          a.legPhase += Math.hypot(m.x - m.prevX, m.z - m.prevZ) * 0.9 + dt / 400;
          drawBug(p, a, 0, 0, now, false);
        } else if (m.kind === "slime") drawSlime(p, 0, 0, { ...m, y: my }, now);
        else if (m.kind === "bat") drawBat(p, 0, 0, { ...m, y: my }, now);
        else drawGolem(p, 0, 0, m, now);
        if (m.hp < MOBS[m.kind].hp) {
          const filled = Math.ceil((m.hp / MOBS[m.kind].hp) * 6);
          const top = m.kind === "golem" ? 100 : m.kind === "bat" ? 44 + my * 14 : m.kind === "slime" ? 34 : 64;
          text(f, "=".repeat(filled) + "-".repeat(6 - filled), sx, sy - top * worldZoom, tint);
        }
      },
    });
  }

  // the mage
  const [msx, msy] = project(px, pz);
  things.push({
    z: pz,
    shadow: [msx, msy, (w.mounted ? 74 : 20) * worldZoom],
    draw: () => {
      if (w.tpFrom) {
        const [tx, ty] = project(w.tpFrom.x, w.tpFrom.z);
        glow(f, tx, ty - 40, 50, BLAST_MAT.c, 0.5 * (1 - (TELEPORT_CD - w.tpCd) / 8));
      }
      const flash = w.hitT ? 0.45 : w.tpCd > TELEPORT_CD - 3 ? 0.3 : 0;
      const mp = figurePaint(f, msx, msy, flash, w.faceX < 0);
      // summoning: 0 -> 1 over the spell; the horse forms from light in its second half
      const st = w.summonT ? 1 - (w.summonT - alpha) / SUMMON_TICKS : 0;
      const forming = w.summonT > 0 && st > 0.4;
      const dissolving = !w.mounted && w.mountFx > 0;
      const riding = (w.mounted || forming || dissolving) && !w.downT;
      // the horse glows white as it forms or fades, settling into its real colors
      const horseGlow = forming ? 1 - smooth((st - 0.4) / 0.55) : dissolving ? 1 - (w.mountFx - alpha) / 12 : 0;
      const lift = w.mounted && !dissolving ? 1 : forming ? smooth((st - 0.7) / 0.3) : 0;
      if (w.summonT > 0) summonCircle(f, msx, msy, st, now);
      const showHorse = riding && (!dissolving || horseGlow < 0.95);
      const rig = horseRig(anim.gait, w.moving, now, anim.horse.rest);
      if (showHorse) {
        const hglow = Math.max(flash, horseGlow);
        stepHair(anim.horse, rig, w.moving, w.faceX, Math.min(0.05, dt / 1000), now);
        const model = horseModel(rig, anim.gait, w.moving);
        renderHorse3D(f, msx, msy, w.faceX, model, hglow, now);
        plotHair(f, anim.horse.tail, msx, msy, w.faceX, 0, hglow);
        plotHair(f, anim.horse.mane, msx, msy, w.faceX, 3, hglow);
        // reins from the muzzle up to the rider's hands
        const hk = HORSE_K;
        const rx0 = msx + w.faceX * model.muzzle[0] * hk;
        const ry0 = msy - model.muzzle[1] * 0.65 * hk;
        const rx1 = msx + w.faceX * 36 * FIGURE;
        const ry1 = msy + (-112 - RIDER_LIFT * lift) * FIGURE;
        for (let s2 = 0; s2 <= 12; s2++) {
          const col = Math.floor(lerp(rx0, rx1, s2 / 12) / CW);
          const row = Math.floor((lerp(ry0, ry1, s2 / 12) + Math.sin((s2 / 12) * Math.PI) * 6) / CH);
          if (col >= 0 && col < COLS && row >= 0 && row < ROWS) setCell(f, row * COLS + col, ".", [96, 66, 42]);
        }
      }
      drawMage(mp, anim.pose, 0, -RIDER_LIFT * lift, now, w.blastCd > 9, w.downT > 0);
      if (dissolving) lightMotes(f, msx, msy, horseGlow, true);
      if (forming) glow(f, msx, msy - 70 * worldZoom, 80 * worldZoom, [210, 220, 255], 0.5 * horseGlow);
      text(f, "You", msx, msy - (128 + RIDER_LIFT * lift) * worldZoom, [225, 225, 235]);
    },
  });

  // loot glows on the ground with its name floating above
  for (const l of w.loot) {
    const [sx, sy] = project(l.x, l.z);
    if (sx < -40 || sx > COLS * CW + 40 || sy < -20 || sy > ROWS * CH + 20) continue;
    const info = LOOT[l.kind];
    const bob = Math.sin(now / 250 + l.id) * 3;
    things.push({
      z: l.z,
      draw: () => {
        glow(f, sx, sy - 6 + bob, 16 * worldZoom, info.c, 0.45);
        text(f, info.ch, sx, sy - 6 + bob, info.c);
        text(f, info.name, sx, sy - 24 * worldZoom, [info.c[0] * 0.9, info.c[1] * 0.9, info.c[2] * 0.9]);
      },
    });
  }

  // blasts and the void sphere fly at chest height
  for (const s of w.shots) {
    const [sx, sy] = project(lerp(s.prevX, s.x, alpha), lerp(s.prevZ, s.z, alpha));
    things.push({
      z: s.z,
      shadow: [sx, sy, 8 * worldZoom],
      draw: () => {
        const p: Paint = { f, flash: 0 };
        const cy = sy - 40 * worldZoom;
        glow(f, sx, cy, 26 * worldZoom, BLAST_MAT.c);
        ball(p, sx, cy, 7 * worldZoom, BLAST_MAT);
        capsule(p, sx - s.dx * 20 * worldZoom, cy - s.dz * 8 * worldZoom, sx - s.dx * 6 * worldZoom, cy - s.dz * 3 * worldZoom, 3 * worldZoom, BLAST_MAT);
      },
    });
  }
  if (w.voidT) {
    const charging = w.voidT <= 10;
    const vx = charging ? px + w.voidDx * 3 : w.voidX;
    const vz = charging ? pz + w.voidDz * 3 : w.voidZ;
    const [sx, sy] = project(vx, vz);
    const r = (charging ? 4 + w.voidT * 1.6 : 24) * worldZoom;
    things.push({
      z: vz + 0.01,
      shadow: [sx, sy, r],
      draw: () => {
        glow(f, sx, sy - 40 * worldZoom, r * 2.6, VOID_PURPLE, 0.8);
        ball({ f, flash: 0 }, sx, sy - 40 * worldZoom, r, VOID_MAT);
        if (!charging) {
          for (let j = 0; j < 10; j++) {
            const a = now / 90 + j * 0.63;
            const col = Math.round((sx + Math.cos(a) * (r + 8)) / CW);
            const row = Math.round((sy - 40 * worldZoom + Math.sin(a) * (r + 8) * 0.7) / CH);
            if (col >= 0 && col < COLS && row >= 0 && row < ROWS) setCell(f, row * COLS + col, "*", j % 2 ? VOID_RED : VOID_BLUE);
          }
        }
      },
    });
  }

  things.sort((a, c) => a.z - c.z);
  for (const t of things) if (t.shadow) shadowAt(f, t.shadow[0], t.shadow[1], t.shadow[2]);
  for (const t of things) t.draw();

  // weather for where you stand
  const here = biomeAt(px, pz);
  for (let j = 0; j < 70; j++) {
    const seedX = hash(j, 7) * COLS * CW;
    let x = 0;
    let y = 0;
    let ch = ".";
    let c: RGB = [200, 200, 200];
    if (here === "snow") {
      x = seedX + now * 0.01 * (0.5 + hash(j, 8)) + Math.sin(now / 900 + j) * 12 - camX * S_X;
      y = hash(j, 9) * ROWS * CH + now * 0.04 * (0.6 + hash(j, 10)) - camZ * S_Z;
      ch = j % 3 ? "." : "*";
      c = [235, 240, 250];
    } else if (here === "forest" && j < 26) {
      x = seedX + now * 0.02 - camX * S_X;
      y = hash(j, 9) * ROWS * CH + now * 0.025 - camZ * S_Z;
      ch = j % 2 ? "," : "'";
      c = j % 3 ? [200, 110, 50] : [220, 170, 60];
    } else if (here === "desert" && j < 40) {
      x = seedX + now * 0.12 * (0.6 + hash(j, 8)) - camX * S_X;
      y = hash(j, 9) * ROWS * CH - camZ * S_Z;
      ch = "-";
      c = [220, 190, 140];
    } else if ((here === "meadow" || here === "lake") && j < 16) {
      x = vnoise(j * 3.1, now / 4000) * COLS * CW * 1.3 - COLS * CW * 0.15;
      y = vnoise(j * 7.3, now / 5000 + 9) * ROWS * CH;
      if (Math.sin(now / 400 + j * 1.9) < 0.2) continue;
      glow(f, x, y, 14, [220, 255, 120], 0.3);
      ch = "*";
      c = [230, 255, 140];
    } else if (here === "ruins" && j < 20) {
      x = seedX + now * 0.006 - camX * S_X;
      y = hash(j, 9) * ROWS * CH - now * 0.006 - camZ * S_Z;
      c = [160, 160, 150];
    } else continue;
    x = ((x % (COLS * CW)) + COLS * CW) % (COLS * CW);
    y = ((y % (ROWS * CH)) + ROWS * CH) % (ROWS * CH);
    setCell(f, Math.floor(y / CH) * COLS + Math.floor(x / CW), ch, c);
  }

  // motes of light drift upward everywhere green or old; the glow pass makes them shimmer
  if (here !== "snow" && here !== "desert") {
    const MOTES: RGB[] = [[200, 170, 255], [255, 220, 150], [170, 230, 255]];
    for (let j = 0; j < 48; j++) {
      let x = hash(j, 41) * COLS * CW + Math.sin(now / 1700 + j * 1.3) * 18 - camX * S_X * 0.9;
      let y = hash(j, 43) * ROWS * CH - now * 0.012 * (0.5 + hash(j, 47)) - camZ * S_Z * 0.9;
      x = ((x % (COLS * CW)) + COLS * CW) % (COLS * CW);
      y = ((y % (ROWS * CH)) + ROWS * CH) % (ROWS * CH);
      const tw = 0.55 + 0.45 * Math.sin(now / 300 + j * 2.1);
      const c = MOTES[j % 3];
      setCell(f, Math.floor(y / CH) * COLS + Math.floor(x / CW), j % 4 ? "." : "*", [c[0] * tw, c[1] * tw, c[2] * tw]);
    }
  }

  // a soft vignette, like looking down through the night
  const vig = vignetteFor(COLS, ROWS);
  for (let i = 0; i < N; i++) {
    f.r[i] *= vig[i];
    f.g[i] *= vig[i];
    f.b[i] *= vig[i];
  }

  if (w.downT) {
    for (let i = 0; i < N; i++) {
      f.r[i] *= 0.45;
      f.g[i] *= 0.4;
      f.b[i] *= 0.45;
    }
  }
  f.shake = w.shake * 1.5;
  f.dream = 1;
  return f;
};

const WorldOverlay = ({ w }: { w: World }) => {
  const style = BIOMES[w.biome];
  const showName = w.biomeT < 45;
  const toScreenPct = (x: number, z: number): [number, number] => [
    (((w.viewCols * CW) / 2 + (x - w.camX) * S_X) / (w.viewCols * CW)) * 100,
    (((w.viewRows * CH) / 2 + (z - w.camZ) * S_Z - heightAt(x, z) * S_H - 60 * worldZoom) / (w.viewRows * CH)) * 100,
  ];
  const target = w.mobs.find((m) => m.id === w.targetId && !m.deadT && Math.hypot(m.x - w.px, m.z - w.pz) < 30);
  const need = xpToLevel(w.level);
  const slots: { key: string; name: string; cd: number; max: number }[] = [
    { key: "1", name: "punch", cd: w.punchCd, max: 6 },
    { key: "2", name: "blast", cd: w.blastCd, max: 12 },
    { key: "3", name: "blink", cd: w.tpCd, max: TELEPORT_CD },
    { key: "4", name: "void", cd: w.voidCd, max: WORLD_VOID_CD },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 font-mono">
      <div className="absolute inset-x-3 top-2 flex items-start justify-between gap-2 text-[11px]">
        <div>
          <div>
            <span className="text-green-400">YOU</span> <span className="text-zinc-400">Lv {w.level}</span>
          </div>
          <div className="mt-0.5 h-1.5 w-28 sm:w-36 rounded-full bg-black/60 ring-1 ring-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-[width]" style={{ width: `${(w.hp / w.maxHp) * 100}%` }} />
          </div>
          <div className="mt-0.5 text-[9px] text-zinc-400">
            {w.hp}/{w.maxHp} · <span className="text-yellow-300">{w.coins}</span> coins · {w.kills} slain
          </div>
        </div>
        {/* the creature you're fighting */}
        {target && (
          <div className="rounded border border-white/15 bg-black/55 px-2 py-1 text-right">
            <div className="text-[10px] text-zinc-200">
              {MOBS[target.kind].name} {Math.max(0, target.hp)}/{MOBS[target.kind].hp}
            </div>
            <div className="mt-0.5 h-1 w-24 rounded-full bg-black/60 overflow-hidden">
              <div className="h-full bg-orange-400" style={{ width: `${(Math.max(0, target.hp) / MOBS[target.kind].hp) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* xp bar and ability hotbar */}
      <div className="absolute inset-x-2 bottom-1.5">
        <div className="mx-auto max-w-[360px]">
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-400">
            <span>Lv {w.level}</span>
            <div className="h-1 flex-1 rounded-full bg-black/60 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${(w.xp / need) * 100}%` }} />
            </div>
            <span>
              {w.xp}/{need} xp
            </span>
          </div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {slots.map((sl) => (
              <div key={sl.key} className="relative h-6 rounded border border-white/15 bg-black/55 overflow-hidden text-center">
                {sl.cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-white/15" style={{ height: `${(sl.cd / sl.max) * 100}%` }} />}
                <span className="relative text-[9px] leading-6 text-zinc-200">
                  <span className="text-zinc-500">{sl.key}</span> {sl.cd > 0 && sl.max > 40 ? `${Math.ceil(sl.cd * 0.07)}s` : sl.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {w.place && w.placeT < 60 && (
        <div className="absolute inset-x-0 top-[24%] text-center" style={{ opacity: Math.min(1, (60 - w.placeT) / 12) }}>
          <div className="text-[10px] tracking-[0.4em] text-amber-200/80">you approach</div>
          <div className="text-lg tracking-[0.3em] text-amber-100 drop-shadow">{w.place.toUpperCase()}</div>
        </div>
      )}
      {showName && (
        <div className="absolute inset-x-0 top-[16%] text-center" style={{ opacity: Math.min(1, (45 - w.biomeT) / 12) }}>
          {w.t < 60 && <div className="text-[10px] tracking-[0.4em] text-zinc-400">you slipped out of the arena...</div>}
          <div className="text-lg tracking-[0.35em] text-zinc-100 drop-shadow">{style.name.toUpperCase()}</div>
        </div>
      )}
      {w.downT > 0 && (
        <div className="absolute inset-x-0 top-[30%] text-center text-rose-300 text-sm tracking-[0.3em]">you fell... rising again</div>
      )}
      {w.fx.map((fx, k) => {
        const [left, top] = toScreenPct(fx.x, fx.z);
        return (
          <div key={k} className="absolute -translate-x-1/2 text-yellow-300 text-xs font-bold" style={{ left: `${left}%`, top: `${top}%` }}>
            {fx.text}
          </div>
        );
      })}
    </div>
  );
};

const MAX_WORLD_CELLS = 70000;

const OpenWorld = ({ onExit }: { onExit: () => void }) => {
  const world = useRef<World>(newWorld());
  const anim = useRef<WorldAnim>({ pose: P_IDLE, gait: 0, horse: newHorseState(), last: 0 });
  const keys = useRef<Keys>({ left: false, right: false, up: false, down: false });
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [focused, setFocused] = useState(false);
  const redraw = useAsciiLoop(
    canvas,
    () => worldStep(world.current, keys.current),
    (alpha, now) => composeWorld(world.current, anim.current, alpha, now),
    focused,
  );

  useEffect(() => box.current?.focus({ preventScroll: true }), []);

  // The grid size follows the zoom (smaller characters = more of them) and, in fullscreen,
  // the screen. A cell budget keeps very large or very zoomed-out views at 60fps.
  const { full } = useContext(FullscreenContext);
  const stageBox = useRef<HTMLDivElement>(null);
  const [, resized] = useReducer((x: number) => x + 1, 0);
  const [zoomIdx, setZoomIdx] = useState(GLYPH_ZOOM_DEFAULT);
  useEffect(() => {
    const w = world.current;
    const g = GLYPH_ZOOMS[zoomIdx];
    const budget = (cols: number, rows: number) => Math.max(1, Math.sqrt((cols * rows) / MAX_WORLD_CELLS));
    if (!full || !stageBox.current) {
      const cols = BASE_COLS / g;
      const rows = BASE_ROWS / g;
      const k = budget(cols, rows);
      w.viewCols = Math.round(cols / k);
      w.viewRows = Math.round(rows / k);
      resized();
      return;
    }
    const el = stageBox.current;
    const minScale = window.matchMedia("(pointer: coarse)").matches ? 1.2 : 1;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const cols = r.width / (CW * minScale * g);
      const rows = r.height / (CH * minScale * g);
      const k = budget(cols, rows);
      w.viewCols = Math.max(40, Math.floor(cols / k));
      w.viewRows = Math.max(24, Math.floor(rows / k));
      resized();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, zoomIdx]);

  const restart = () => {
    world.current = newWorld();
    redraw();
  };

  // zoom: buttons, the - and = keys, or the mouse wheel over the game
  const zoomRef = useRef(zoomIdx);
  const zoomBy = (step: number) => {
    const next = Math.max(0, Math.min(GLYPH_ZOOMS.length - 1, zoomRef.current + step));
    zoomRef.current = next;
    setZoomIdx(next);
  };
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;
  useEffect(() => {
    const el = stageBox.current;
    if (!el) return;
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel < 120) return;
      lastWheel = now;
      zoomByRef.current(e.deltaY > 0 ? -1 : 1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const setKey = (e: React.KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (k === "-" || k === "=" || k === "+") {
      if (down && !e.repeat) zoomBy(k === "-" ? -1 : 1);
      e.preventDefault();
      return;
    }
    if (handleKey(e, down, keys.current, world.current)) e.preventDefault();
    else if (k === "r") { if (down) restart(); e.preventDefault(); }
    else if (k === "escape") { if (down) onExit(); e.preventDefault(); }
  };

  const w = world.current;
  return (
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={(e) => setKey(e, true)}
      onKeyUp={(e) => setKey(e, false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
          keys.current = { left: false, right: false, up: false, down: false };
        }
      }}
      className={`outline-none ${full ? "flex h-full flex-col" : ""}`}
    >
      <FullscreenButton>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          disabled={zoomIdx === 0}
          className="rounded border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
        >
          − zoom out
        </button>
        <span className="font-mono text-[10px] text-zinc-500">{GLYPH_ZOOMS[zoomIdx]}×</span>
        <button
          type="button"
          onClick={() => zoomBy(1)}
          disabled={zoomIdx === GLYPH_ZOOMS.length - 1}
          className="rounded border border-white/15 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
        >
          + zoom in
        </button>
      </FullscreenButton>
      <div className={full ? "min-h-0 flex-1" : ""} onPointerDown={() => box.current?.focus({ preventScroll: true })}>
        <Stage canvas={canvas} fill={full} grid={[w.viewCols, w.viewRows]} boxRef={stageBox}>
          <WorldOverlay w={w} />
          {!focused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-green-400 font-mono text-xs cursor-pointer">
              paused, tap to play
            </div>
          )}
        </Stage>
      </div>
      <div className={full ? "hidden shrink-0 [@media(pointer:coarse)]:block" : ""} onPointerDownCapture={() => box.current?.focus({ preventScroll: true })}>
        <Controller
          keys={keys}
          press={(a) => pressOn(world.current, a)}
          voidName={w.voidCd ? `${Math.ceil(w.voidCd * 0.07)}s` : "void"}
          voidDim={w.voidCd > 0}
          mount={w.mounted ? "dismount" : "horse"}
          restart={restart}
          onExit={onExit}
        />
      </div>
      <p className={`mt-2 hidden text-[11px] text-muted-foreground ${full ? "" : "sm:block"}`}>
        arrows walk in 8 directions · V / 1 punch · F / 2 blast · T / 3 blink · Z / 4 void · H / 5 horse · attacks aim at the nearest creature · - / = or mouse wheel zoom · R new world · ESC arena
      </p>
    </div>
  );
};


// ---- demo: the same engine, played by a simple bot ----

const demoBot = (g: Game, k: Keys) => {
  const gap = gapOf(g);
  const dir = facing(g);
  if (g.biteT > 0 && g.tpCd === 0 && Math.random() < 0.3) g.wantTeleport = true;
  k.down = g.biteT > 0;
  if (g.spit !== null && Math.abs(g.spit - g.jc) < 9) g.wantJump = true;
  k.right = !k.down && gap > 2 && dir > 0;
  k.left = !k.down && gap > 2 && dir < 0;
  g.wantPunch = !k.down && gap <= 4 && g.t % 3 === 0;
  g.wantBlast = gap > 10;
};

const Demo = () => {
  const game = useRef<Game>(newGame());
  const keys = useRef<Keys>({ left: false, right: false, up: false, down: false });
  const canvas = useRef<HTMLCanvasElement>(null);
  const pause = useRef(0);

  useFightLoop(
    canvas,
    game,
    () => {
      const g = game.current;
      if (g.over) {
        if (++pause.current > 40) {
          game.current = newGame();
          pause.current = 0;
        }
        return;
      }
      demoBot(g, keys.current);
      step(g, keys.current);
    },
    true,
    "JOSE",
  );

  return (
    <Stage canvas={canvas}>
      <Overlay g={game.current} name="JOSE" />
    </Stage>
  );
};

export const AsciiFight = () => {
  const [mode, setMode] = useState<"demo" | "arena" | "world">("demo");

  // on phones, reach into the window's side padding to give the game more room.
  // One host for both modes, so fullscreen carries over between the arena and the world.
  if (mode !== "demo") {
    return (
      <div className="-mx-3 sm:mx-0">
        <GameHost>
          {mode === "arena" ? (
            <FightGame onExit={() => setMode("demo")} onWorld={() => setMode("world")} />
          ) : (
            <OpenWorld onExit={() => setMode("arena")} />
          )}
        </GameHost>
      </div>
    );
  }

  return (
    <div className="-mx-3 sm:mx-0">
      <Demo />
      <button
        type="button"
        onClick={() => setMode("arena")}
        className="mt-2 w-full px-3 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-sm hover:opacity-90"
      >
        ▶ play here
      </button>
    </div>
  );
};
