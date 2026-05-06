import { useEffect, useState } from "react";

interface BootProps {
  onDone: () => void;
}

const lines = [
  "JOSE-OS v1.0 booting...",
  "Loading kernel.................. OK",
  "Mounting /home/jose............. OK",
  "Starting window manager......... OK",
  "Authenticating user: guest...... OK",
  "Welcome.",
];

export const BootScreen = ({ onDone }: BootProps) => {
  const [shown, setShown] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setShown((s) => [...s, lines[i]]);
      i++;
      if (i >= lines.length) clearInterval(id);
    }, 320);
    const p = setInterval(() => setProgress((v) => Math.min(100, v + 4)), 80);
    const t = setTimeout(() => onDone(), 2600);
    return () => {
      clearInterval(id);
      clearInterval(p);
      clearTimeout(t);
    };
  }, [onDone]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(30_25%_8%)] text-[hsl(var(--primary))] p-6">
      <div className="w-full max-w-xl animate-boot">
        <div className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {">"} system boot
        </div>
        <div className="space-y-1 text-sm font-mono">
          {shown.map((l, i) => (
            <div key={i} className="animate-fade-in">{l}</div>
          ))}
          <div className="inline-block w-2 h-4 bg-[hsl(var(--primary))] animate-blink ml-0.5" />
        </div>
        <div className="mt-8 h-2 w-full bg-[hsl(30_15%_18%)] rounded-sm overflow-hidden border border-[hsl(30_15%_25%)]">
          <div
            className="h-full bg-[hsl(var(--primary))] transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          [ {progress}% ] logging you in...
        </div>
      </div>
    </div>
  );
};
