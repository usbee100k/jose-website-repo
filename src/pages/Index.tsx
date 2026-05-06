import { useState } from "react";
import { BootScreen } from "@/components/desktop/BootScreen";
import { Window } from "@/components/desktop/Window";
import { Github, Linkedin, Mail, Twitter, FolderGit2, MessageCircle, HelpCircle, Link as LinkIcon } from "lucide-react";

type AppId = "main" | "contact" | "projects" | "links" | "faqs";

interface OpenWindow {
  id: AppId;
  z: number;
}

const Index = () => {
  const [booted, setBooted] = useState(false);
  const [windows, setWindows] = useState<OpenWindow[]>([{ id: "main", z: 1 }]);
  const [topZ, setTopZ] = useState(1);

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
          <span className="opacity-80 hidden sm:inline">guest@portfolio</span>
          <span>{now}</span>
        </div>
      </header>

      {/* Desktop icons */}
      <div className="absolute top-9 left-2 flex flex-col gap-3 p-2 z-0">
        {([
          { id: "projects", label: "Projects", icon: FolderGit2 },
          { id: "contact", label: "Contact", icon: MessageCircle },
          { id: "links", label: "Links", icon: LinkIcon },
          { id: "faqs", label: "FAQs", icon: HelpCircle },
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
            tip: drag windows by the title bar. they stack like a real desktop.
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
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> <a href="mailto:hello@jose.dev" className="hover:underline">hello@jose.dev</a></li>
            <li className="flex items-center gap-2"><Twitter className="h-4 w-4 text-primary" /> @jose</li>
            <li className="flex items-center gap-2"><Linkedin className="h-4 w-4 text-primary" /> linkedin.com/in/jose</li>
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
            {[
              { name: "Terra CLI", desc: "a tiny tool for managing local dev envs." },
              { name: "Mossy", desc: "static site generator, markdown-first." },
              { name: "Foliage", desc: "design tokens for nature-themed UIs." },
              { name: "Compost", desc: "log rotator that actually composts." },
            ].map((p) => (
              <li key={p.name} className="border border-border rounded-sm p-2 hover:bg-secondary transition-colors cursor-pointer">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </li>
            ))}
          </ul>
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
            <li className="flex items-center gap-2"><Github className="h-4 w-4 text-primary" /> github.com/jose</li>
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
              { q: "where are you based?", a: "somewhere with too many trees and not enough wifi." },
              { q: "are you available for work?", a: "open to interesting projects — ping me." },
              { q: "what stack do you use?", a: "typescript, react, go, postgres, and lots of coffee." },
              { q: "why the desktop theme?", a: "i like windows that overlap. don't you?" },
            ].map((f) => (
              <div key={f.q}>
                <div className="font-semibold">› {f.q}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{f.a}</div>
              </div>
            ))}
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
