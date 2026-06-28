import { useState, useEffect } from "react";
import { BootScreen } from "@/components/desktop/BootScreen";
import { Window } from "@/components/desktop/Window";
import { Github, Linkedin, Mail, Twitter, FolderGit2, MessageCircle, HelpCircle, Link as LinkIcon, User, Newspaper, Plus } from "lucide-react";
import blogMascot from "@/assets/blog-mascot.jpeg";

type AppId = "main" | "contact" | "projects" | "links" | "faqs" | "more-faqs" | "josetube" | "about" | "blog" | `project:${string}`;

interface BlogPost {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: string;
}

interface VideoMeta {
  title: string;
  src: string;
  poster: string;
  channel: string;
  views: string;
  uploaded: string;
  description: string;
}

interface OpenWindow {
  id: AppId;
  z: number;
}

const makePoster = (label: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#g)"/>
    <circle cx="640" cy="360" r="78" fill="#f8fafc" opacity="0.95"/>
    <polygon points="620,320 620,400 695,360" fill="#111827"/>
    <text x="640" y="490" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#e5e7eb">
      ${label}
    </text>
  </svg>`,
)}`;

const PROJECTS = [
  {
    slug: "multitool",
    name: "Multitool CLI",
    desc: "a tiny tool for managing local applications.",
    body: [
      "Terra CLI is a small command-line tool for spinning up and tearing down local development environments without the usual ceremony.",
      "It wraps docker, devcontainers, and a few sane defaults into one command. Built because i kept rewriting the same bash scripts on every project.",
      "Stack: Go, cobra, a sprinkle of bubbletea for the interactive bits. Cross-compiled for macOS, linux and windows.",
      "Lessons learned: shipping a CLI is 20% code and 80% making the help text not embarrassing.",
    ],
    video: {
      src: `/testfoootage.mp4`,
      poster: `/desktopimg.png`,
      duration: "0:09",
    },
  },
  {
    slug: "wdc-lab",
    name: "Windows Domain Controller Lab",
    desc: "Creating a 'New Forest', documenting my proccess",
    body: [
      "I wanted to simulate working help desk, setting up GPO's, simulating multiple users, and deployment of a domain server.",
      "This taught me hands on more about active directory.",
      "--",
    ],
    video: {
      src: `/testfoootage1.mp4`,
      poster: makePoster("windows-dc-lab.mp4"),
      duration: "10:53",
    },
  },
  {
    slug: "cpt-network",
    name: "Cisco Packet Tracer Network",
    desc: "Recreating enterprise level networks virtually.",
    body: [
      "My goal wiith this project was to be able to show my ability to create a real enterprise network through Cisco Packet Tracer.",
      "With this i learned how to configure a switch, how routers speak to each other, creating Vlans/subnets, ",
      "My goal is to be a network engineer, this project allows me learn, practice, break things, then fix them again, and prove that i understand what im doing.",
      "s",
    ],
    video: {
      src: `/testfoootage2.mp4`,
      poster: makePoster("cisco-packet-tracer.mp4"),
      duration: "0:15",
    },
  },
  {
    slug: "portfolio",
    name: "How I Coded My Portfolio",
    desc: "How did I do this and why?",
    body: [
      "Why? I wanted to learn more about the process of building a website and how to code it. Im passionate about the things I do and this is a cool way to show it.",
      "I get my experience from working hands on with my own projects and learning from my mistakes. I am a quick learner and I'm always looking to improve my skills.",
      "With the ever changing landscape of technology, I am always looking for new ways to learn, and with the rise of AI it can help to learn faster and more efficiently.",
      "We must not rely on it completely, but it can be a great tool to learn. Thats what I did with this website. I used a AI agent to help me code the website and used the combination of inspect in webbrowser along with vscode; I was able to learn about the code that was being used.",
      "As I went through the proccess of wanting to improve my website. I learned and used AI along with offical documentation to understand what was being used and how it works.",
      "This was pretty simple to understand as I already have a background in HTML CSS and more. It just took a little creativity.",
      "You can see my whole thinking proccess through each commits. I loved learning this project, from the site building, to aquiring the website domain, and to deployment through vercel.",
      "Maybe not the most traditional way, but it worked! Through reading and a whole lot of trial and error. hahaha...",
    ],
    video: {
      src: `/testfoootage3.mp4`,
      poster: makePoster("portfolio.mp4"),
      duration: "14:48",
    },
  },
] as const;

const Index = () => {
  const [booted, setBooted] = useState(false);
  const [windows, setWindows] = useState<OpenWindow[]>([{ id: "main", z: 1 }]);
  const [topZ, setTopZ] = useState(1);
  const [activeVideo, setActiveVideo] = useState<VideoMeta | null>(null);
  // Hardcoded blog posts — only the site owner edits these in code.
  const posts: BlogPost[] = [
    {
      id: "post-4",
      title: "test",
      body: "test",
      createdAt: "apr 30, 3000",
    },
    {
      id: "post-3",
      title: "new homelab milestone",
      body: "finally got my windows domain controller talking nicely to my pfsense box. dns, dhcp, and group policy all behaving. felt good to see clients pick up the right policies on first boot.",
      createdAt: "may 2, 2026",
    },
    {
      id: "post-2",
      title: "shipped the portfolio rewrite",
      body: "redid the whole site as a desktop OS. windows, taskbar, draggable everything. it's silly and i love it. blog window included so i can drop updates without leaving the vibe.",
      imageUrl: "/placeholder.svg",
      createdAt: "apr 24, 2026",
    },
    {
      id: "post-1",
      title: "cisco packet tracer deep dive",
      body: "spent the weekend building out a multi-vlan campus topology in packet tracer. inter-vlan routing on a layer 3 switch, dhcp relay, and acls between segments. wrote up the lab in the projects window.",
      videoUrl: "/testfoootage.mp4",
      createdAt: "apr 10, 2026",
    },
  ];


  const openApp = (id: AppId) => {
    setTopZ((z) => z + 1);
    setWindows((ws) => {
      if (ws.find((w) => w.id === id)) {
        return ws.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w));
      }
      return [...ws, { id, z: topZ + 1 }];
    });
  };

  const focusApp = (id: AppId) => {
    setTopZ((z) => z + 1);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)));
  };

  const closeApp = (id: AppId) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  };

  const getZ = (id: AppId) => windows.find((w) => w.id === id)?.z ?? 0;
  const isOpen = (id: AppId) => windows.some((w) => w.id === id);

  if (!booted) return <BootScreen onDone={() => setBooted(true)} />;

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="min-h-screen desktop-bg relative overflow-hidden">
      {/* Top menu bar */}
      <header className="absolute top-0 inset-x-0 h-7 bg-[hsl(var(--window-chrome))] text-[hsl(var(--window-chrome-foreground))] flex items-center justify-between px-3 text-xs z-50 shadow-md">
        <div className="flex items-center gap-4">
          <span className="font-bold">⬢ jose-os</span>
          <span className="opacity-80 hidden sm:inline">File</span>
          <span className="opacity-80 hidden sm:inline">Edit</span>
          <span className="opacity-80 hidden sm:inline">View</span>
          <span className="opacity-80 hidden sm:inline">Help</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-80 hidden sm:inline">welcome@portfolio</span>
          <span>{now}</span>
        </div>
      </header>

      {/* Desktop icons */}
      <div className="absolute top-9 left-2 flex flex-col gap-3 p-2 z-0">
        {([
          { id: "about", label: "About Me", icon: User },
          { id: "projects", label: "Projects", icon: FolderGit2 },
          { id: "contact", label: "Contact", icon: MessageCircle },
          { id: "links", label: "Links", icon: LinkIcon },
          { id: "faqs", label: "FAQs", icon: HelpCircle },
          { id: "blog", label: "Blog", icon: Newspaper },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onDoubleClick={() => openApp(id)}
            onClick={() => openApp(id)}
            className="flex flex-col items-center gap-1 w-20 group"
          >
            <div className="h-12 w-12 rounded-md bg-[hsl(var(--window-bg))] border border-[hsl(var(--window-chrome))] flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors window-shadow">
              <Icon className="h-6 w-6" />
            </div>
            <span className="text-xs text-[hsl(var(--window-chrome-foreground))] bg-[hsl(var(--window-chrome)/0.7)] px-1.5 py-0.5 rounded">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Windows */}
      {isOpen("main") && (
        <Window
          title="readme.txt"
          initialX={typeof window !== "undefined" ? Math.max(140, window.innerWidth / 2 - 240) : 200}
          initialY={80}
          width={480}
          zIndex={getZ("main")}
          onFocus={() => focusApp("main")}
          onClose={() => closeApp("main")}
        >
          <h1 className="text-2xl font-bold mb-2">hi, i'm Jose 👋</h1>
          <p className="text-muted-foreground mb-4">
            welcome to my little corner of the internet. poke around — open the
            folders on the desktop or pick something below.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "projects", label: "📁 Projects" },
              { id: "contact", label: "✉ Contact" },
              { id: "links", label: "🔗 Links" },
              { id: "faqs", label: "? FAQs" },
            ] as const).map((b) => (
              <button
                key={b.id}
                onClick={() => openApp(b.id)}
                className="px-3 py-2 text-left bg-secondary hover:bg-primary hover:text-primary-foreground border border-border rounded-sm transition-colors text-sm"
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
            tip: drag windows by the title bar. they stack like a real desktop. click start button bottom left to open readme.txt again.
          </div>
        </Window>
      )}

      {isOpen("contact") && (
        <Window
          title="contact.app"
          initialX={260}
          initialY={160}
          width={380}
          zIndex={getZ("contact")}
          onFocus={() => focusApp("contact")}
          onClose={() => closeApp("contact")}
        >
          <h2 className="text-lg font-bold mb-3">get in touch</h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> <a href="mailto:josejcorral77.jc@gmail.com" className="hover:underline">josejcorral77.jc@gmail.com</a></li>
            <li className="flex items-center gap-2"><Twitter className="h-4 w-4 text-primary" /> @jose</li>
            <li className="flex items-center gap-2"><Linkedin className="h-4 w-4 text-primary" /> linkedin.com/in/josecorr</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">i usually reply within a day or two.</p>
        </Window>
      )}

      {isOpen("projects") && (
        <Window
          title="projects/"
          initialX={340}
          initialY={120}
          width={460}
          zIndex={getZ("projects")}
          onFocus={() => focusApp("projects")}
          onClose={() => closeApp("projects")}
        >
          <h2 className="text-lg font-bold mb-3">selected work</h2>
          <ul className="space-y-3">
            {PROJECTS.map((p) => (
              <li
                key={p.slug}
                onClick={() => openApp(`project:${p.slug}` as AppId)}
                className="border border-border rounded-sm p-2 hover:bg-secondary transition-colors cursor-pointer"
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </li>
            ))}
          </ul>
        </Window>
      )}

      {PROJECTS.map((p, i) => {
        const id = `project:${p.slug}` as AppId;
        if (!isOpen(id)) return null;
        return (
          <Window
            key={p.slug}
            title={`${p.name.toLowerCase()}.md`}
            initialX={200 + i * 30}
            initialY={140 + i * 20}
            width={520}
            height={420}
            zIndex={getZ(id)}
            onFocus={() => focusApp(id)}
            onClose={() => closeApp(id)}
          >
            <div className="pr-2">
            <h2 className="text-xl font-bold mb-1">{p.name}</h2>
            <p className="text-xs text-muted-foreground mb-4">{p.desc}</p>
            <div className="space-y-3">
              {p.body.map((para, idx) => (
                <p key={idx} className="text-sm">{para}</p>
              ))}
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">demo video</div>
              <button
                onClick={() => {
                  setActiveVideo({
                    title: `${p.name} — demo`,
                    src: p.video.src,
                    poster: p.video.poster,
                    channel: "jose",
                    views: `${(i + 1) * 1234} views`,
                    uploaded: "2 weeks ago",
                    description: p.body[0],
                  });
                  openApp("josetube");
                }}
                className="group relative block w-full overflow-hidden rounded-sm border border-border bg-black"
              >
                <img
                  src={p.video.poster}
                  alt={`${p.name} demo thumbnail`}
                  loading="lazy"
                  className="w-full h-40 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <div className="ml-1 w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-primary-foreground" />
                  </div>
                </div>
                <div className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">{p.video.duration}</div>
              </button>
            </div>
            </div>
          </Window>
        );
      })}

      {isOpen("josetube") && activeVideo && (
        <Window
          title="josetube.com"
          initialX={120}
          initialY={70}
          width={760}
          height={620}
          zIndex={getZ("josetube")}
          onFocus={() => focusApp("josetube")}
          onClose={() => closeApp("josetube")}
        >
          <div className="-m-5">
            <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2 font-bold">
                <span className="h-6 w-6 rounded-sm bg-primary-foreground text-primary flex items-center justify-center text-xs">▶</span>
                <span className="tracking-tight">JoseTube</span>
              </div>
              <input
                placeholder="search josetube..."
                className="hidden sm:block flex-1 mx-4 max-w-xs px-2 py-1 text-xs rounded-sm bg-primary-foreground/20 placeholder:text-primary-foreground/70 outline-none"
              />
              <div className="text-xs opacity-80">🌿 sign in</div>
            </div>
            <div className="bg-black">
              <video
                key={activeVideo.src}
                src={activeVideo.src}
                poster={activeVideo.poster}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[55vh] bg-black"
              />
            </div>
            <div className="p-4 bg-card">
              <h3 className="text-base font-bold mb-1">{activeVideo.title}</h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>{activeVideo.views} • {activeVideo.uploaded}</span>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-primary text-primary-foreground rounded-sm">👍 like</span>
                  <span className="px-2 py-1 bg-secondary rounded-sm">↗ share</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">J</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{activeVideo.channel}</div>
                  <div className="text-xs text-muted-foreground">12.3k subscribers</div>
                </div>
                <button className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-sm">subscribe</button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{activeVideo.description}</p>
            </div>
          </div>
        </Window>
      )}

      {isOpen("about") && (
        <Window
          title="about-me.txt"
          initialX={200}
          initialY={100}
          width={460}
          zIndex={getZ("about")}
          onFocus={() => focusApp("about")}
          onClose={() => closeApp("about")}
        >
          <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-border">
            <div>
              <h2 className="text-xl font-bold">About Me</h2>
              <p className="text-xs text-muted-foreground">a quick intro</p>
            </div>
            <img
              src="/favicon.ico"
              alt="Jose's favicon"
              className="h-10 w-10 rounded-sm border border-border shrink-0"
            />
          </div>
          <div className="pr-2 space-y-3 text-sm">
            <p>
              hi, i'm Jose — a tech enthusiast based in Santa Cruz (originally from Seattle).
              i love building tools, breaking labs, and figuring out how things work under the hood.
            </p>
            <p>
              my interests sit at the crossroads of networking, sysadmin work, and full-stack
              development. lately i've been deep in homelab projects, CLI tooling, and mainly learning
              everything i can about enterprise infrastructure.
            </p>
            <p>
              when i'm not in front of a terminal, you'll find me chasing waves, gaming,
              or just hanging out with my partner.
            </p>
            <p>
              i'm a big family guy, i've been an uncle all my life and i have a lot of experience
              with mentoring and teaching ranging from infants, toddlers, and school-aged children.
            </p>
            <p>
              if you want to know more about me and my work, check out my{" "}
              <button
                type="button"
                onClick={() => openApp("blog")}
                className="inline p-0 border-0 bg-transparent font-inherit text-primary hover:underline cursor-pointer"
              >
                blog
              </button>{" "}
              or{" "}
              <button
                type="button"
                onClick={() => openApp("projects")}
                className="inline p-0 border-0 bg-transparent font-inherit text-primary hover:underline cursor-pointer"
              >
                projects
              </button>
              .
            </p>
          </div>
        </Window>
      )}


      {isOpen("links") && (
        <Window
          title="links.html"
          initialX={420}
          initialY={220}
          width={360}
          zIndex={getZ("links")}
          onFocus={() => focusApp("links")}
          onClose={() => closeApp("links")}
        >
          <h2 className="text-lg font-bold mb-3">around the web</h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2"><Github className="h-4 w-4 text-primary" /> github.com/usbee100k</li>
            <li className="flex items-center gap-2"><Twitter className="h-4 w-4 text-primary" /> twitter.com/jose</li>
            <li className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-primary" /> jose.dev/blog</li>
            <li className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-primary" /> read.cv/jose</li>
          </ul>
        </Window>
      )}

      {isOpen("faqs") && (
        <Window
          title="faqs.md"
          initialX={500}
          initialY={180}
          width={440}
          zIndex={getZ("faqs")}
          onFocus={() => focusApp("faqs")}
          onClose={() => closeApp("faqs")}
        >
          <h2 className="text-lg font-bold mb-3">frequently asked</h2>
          <div className="space-y-3">
            {[
              { q: "where are you based?", a: "Seattle Wa originally but i recently relocated to Santa Cruz." },
              { q: "are you available for work?", a: "hungry for work in tech but will need 2 weeks atleast — ping me." },
              { q: "what stack do you use?", a: "typescript, react, go, postgres, and lots of coffee." },
              { q: "why the desktop theme?", a: "i like windows that overlap. don't you?" },
            ].map((f) => (
              <div key={f.q}>
                <div className="font-semibold">› {f.q}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{f.a}</div>
              </div>
            ))}
          </div>
          {!isOpen("more-faqs") && (
            <div className="mt-4 pt-3 border-t border-border">
              <button
                onClick={() => openApp("more-faqs")}
                className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-opacity"
              >
                more questions? →
              </button>
            </div>
          )}
        </Window>
      )}

      {isOpen("more-faqs") && (
        <Window
          title="more-faqs.md"
          initialX={180}
          initialY={120}
          width={460}
          height={420}
          zIndex={getZ("more-faqs")}
          onFocus={() => focusApp("more-faqs")}
          onClose={() => closeApp("more-faqs")}
        >
          <h2 className="text-lg font-bold mb-3">more questions</h2>
          <div className="pr-2 space-y-3">
            {[
              { q: "what got you into tech?", a: "tinkering with any electronics as a kid, building my own computers, and then eventually getting into programming and networking." },
              { q: "favorite project so far?", a: "creating my homelab, it taught me the most about networking and troubleshooting. it's kind of janky but it works and she'll get an upgrade soon." },
              { q: "mac, windows, or linux?", a: "linux for servers, mac for daily driving, windows for the lab." },
              { q: "favorite editor?", a: "vscode with vim keybindings. fight me." },
              { q: "coffee or tea?", a: "coffee. always coffee. pour-over on weekends." },
              { q: "do you game?", a: "occasionally — mostly strategy and the odd shooter with friends." },
              { q: "what are you learning right now?", a: "deeper networking — subnetting, vlans, and routing protocols." },
              { q: "any certifications?", a: "working toward CompTIA Network+ and eventually CCNA." },
              { q: "open to remote work?", a: "yep, remote or hybrid. bay area in person also works." },
              { q: "favorite spot in santa cruz?", a: "anywhere along west cliff at sunset." },
              { q: "do you blog?", a: "writing more lately — mostly homelab notes and project breakdowns." },
              { q: "how can i contact you?", a: "check the contact window — email is fastest." },
            ].map((f) => (
              <div key={f.q}>
                <div className="font-semibold">› {f.q}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{f.a}</div>
              </div>
            ))}
          </div>
        </Window>
      )}

      {isOpen("blog") && (
        <Window
          title="blog.app"
          initialX={typeof window !== "undefined" ? Math.max(40, window.innerWidth / 2 - 360) : 80}
          initialY={60}
          width={720}
          height={520}
          zIndex={getZ("blog")}
          onFocus={() => focusApp("blog")}
          onClose={() => closeApp("blog")}
        >
          <div className="-m-5">
            {/* Blog header */}
            <div className="px-5 py-4 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">jose's blog</h2>
                  <p className="text-xs opacity-80">notes, builds, and the occasional rant.</p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-primary-foreground text-primary rounded-sm hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  new post
                </button>
              </div>
            </div>

            {/* Sticky mascot + posts */}
            <div className="flex items-start gap-3 p-4 bg-card">
              <aside className="shrink-0 w-40 sticky top-2 self-start hidden sm:block">
                <div className="border border-border rounded-sm bg-background p-2">
                  <img
                    src={blogMascot}
                    alt="blog mascot"
                    className="w-full h-auto animate-float select-none pointer-events-none"
                    draggable={false}
                  />
                  <div className="mt-1 text-center text-[10px] text-primary font-mono animate-flicker">funniest tech blog :P</div>
                </div>
              </aside>

              <div className="flex-1 min-w-0 space-y-4">
                {posts.map((post) => (
                  <article key={post.id} className="border border-border rounded-sm bg-background overflow-hidden">
                    <header className="px-3 pt-3">
                      <h3 className="text-base font-bold leading-tight">{post.title}</h3>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {post.createdAt}
                      </div>
                    </header>
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt={post.title} className="w-full max-h-80 object-cover mt-2" />
                    )}
                    {post.videoUrl && (
                      <video src={post.videoUrl} controls className="w-full max-h-80 mt-2 bg-black" />
                    )}
                    {post.body && (
                      <p className="px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed">{post.body}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Window>
      )}

      {/* Taskbar */}
      <footer className="absolute bottom-0 inset-x-0 h-9 bg-[hsl(var(--window-chrome))] text-[hsl(var(--window-chrome-foreground))] flex items-center gap-1 px-2 z-50 border-t border-[hsl(30_25%_25%)]">
        <button
          onClick={() => openApp("main")}
          className="px-3 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-sm hover:opacity-90"
        >
          ⬢ Start
        </button>
        <div className="h-5 w-px bg-[hsl(30_25%_25%)] mx-1" />
        {windows.map((w) => (
          <button
            key={w.id}
            onClick={() => focusApp(w.id)}
            className="px-2 py-1 text-xs bg-[hsl(30_15%_25%)] hover:bg-[hsl(30_15%_30%)] rounded-sm"
          >
            {w.id}
          </button>
        ))}
      </footer>
    </main>
  );
};

export default Index;
