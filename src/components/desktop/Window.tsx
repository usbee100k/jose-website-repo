import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, e.clientX - dragRef.current.dx),
        y: Math.max(0, e.clientY - dragRef.current.dy),
      });
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  return (
    <div
      className="absolute animate-window-in window-shadow rounded-md overflow-hidden border border-[hsl(var(--window-chrome))]"
      style={{
        left: pos.x,
        top: pos.y,
        width,
        zIndex,
        background: "hsl(var(--window-bg))",
      }}
      onMouseDown={onFocus}
    >
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-move select-none"
        style={{
          background: "hsl(var(--window-chrome))",
          color: "hsl(var(--window-chrome-foreground))",
        }}
        onMouseDown={(e) => {
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
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
        <span className="text-xs tracking-wide font-semibold uppercase">{title}</span>
        <span className="w-12" />
      </div>
      <div className={cn("p-5 text-sm leading-relaxed text-foreground scanlines")}>
        {children}
      </div>
    </div>
  );
};
