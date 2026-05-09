import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface WindowProps {
  title: string;
  children: ReactNode;
  initialX: number;
  initialY: number;
  width?: number;
  zIndex: number;
  onFocus: () => void;
  onClose?: () => void;
}

export const Window = ({
  title,
  children,
  initialX,
  initialY,
  width = 420,
  zIndex,
  onFocus,
  onClose,
}: WindowProps) => {
  const isMobile = useIsMobile();
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Responsive width: cap to viewport with side padding
  const sidePadding = isMobile ? 8 : 16;
  const effectiveWidth = Math.min(width, viewport.w - sidePadding * 2);

  /** Space reserved below the window (taskbar + breathing room); must match maxHeight calc. */
  const bottomChromePx = 60;
  /** Minimum total window height so content stays scrollable instead of vanishing. */
  const minWindowHeightPx = 168;
  const maxY = Math.max(32, viewport.h - bottomChromePx - minWindowHeightPx);

  // Clamp initial position so the window stays on-screen
  const clampedInitial = {
    x: Math.max(sidePadding, Math.min(initialX, viewport.w - effectiveWidth - sidePadding)),
    y: Math.max(32, Math.min(initialY, maxY)),
  };

  const [pos, setPos] = useState(clampedInitial);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Re-clamp position when viewport or width changes
  useEffect(() => {
    setPos((p) => ({
      x: Math.max(sidePadding, Math.min(p.x, viewport.w - effectiveWidth - sidePadding)),
      y: Math.max(32, Math.min(p.y, maxY)),
    }));
  }, [viewport.w, viewport.h, effectiveWidth, sidePadding, maxY]);

  useEffect(() => {
    const apply = (clientX: number, clientY: number) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(sidePadding, Math.min(clientX - dragRef.current.dx, viewport.w - effectiveWidth - sidePadding)),
        y: Math.max(32, Math.min(clientY - dragRef.current.dy, maxY)),
      });
    };
    const move = (e: MouseEvent) => apply(e.clientX, e.clientY);
    const tmove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      apply(t.clientX, t.clientY);
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tmove, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", tmove);
      window.removeEventListener("touchend", up);
    };
  }, [viewport.w, viewport.h, effectiveWidth, sidePadding, maxY]);

  const windowVerticalExtent = `calc(100vh - ${pos.y + bottomChromePx}px)`;

  return (
    <div
      className="absolute animate-window-in window-shadow rounded-md overflow-hidden border border-[hsl(var(--window-chrome))] flex flex-col min-h-0"
      style={{
        left: pos.x,
        top: pos.y,
        width: effectiveWidth,
        height: windowVerticalExtent,
        maxHeight: windowVerticalExtent,
        zIndex,
        background: "hsl(var(--window-bg))",
      }}
      onMouseDown={onFocus}
    >
      <div
        className="flex shrink-0 items-center justify-between px-2 py-1.5 cursor-move select-none"
        style={{
          background: "hsl(var(--window-chrome))",
          color: "hsl(var(--window-chrome-foreground))",
        }}
        onMouseDown={(e) => {
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          onFocus();
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          dragRef.current = { dx: t.clientX - pos.x, dy: t.clientY - pos.y };
          onFocus();
        }}
      >
        <div className="flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="h-3 w-3 rounded-full bg-destructive hover:opacity-80"
            aria-label="close"
          />
          <span className="h-3 w-3 rounded-full bg-accent opacity-70" />
          <span className="h-3 w-3 rounded-full bg-primary opacity-70" />
        </div>
        <span className="text-xs tracking-wide font-semibold uppercase truncate px-2">{title}</span>
        <span className="w-12" />
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 text-sm leading-relaxed text-foreground scanlines",
        )}
      >
        {children}
      </div>
    </div>
  );
};
