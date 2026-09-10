"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const triggerEl = triggerRef.current;
      const menuEl = menuRef.current;
      const contentEl = contentRef.current;
      if (triggerEl && triggerEl.contains(target)) return;
      if (menuEl && menuEl.contains(target)) return;
      if (contentEl && contentEl.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div ref={menuRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const { triggerRef, setOpen, open } = context;

  return (
    <button
      type="button"
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      className={className}
      onClick={() => setOpen((prev) => !prev)}
      aria-haspopup="menu"
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  );
}

interface DropdownMenuContentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className" | "align"> {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  sideOffset?: number;
}

interface DropdownPosition {
  top: number;
  left: number;
  width?: number;
}

export function DropdownMenuContent({
  children,
  align = "right",
  className,
  sideOffset = 8,
  ...rest
}: DropdownMenuContentProps) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");

  const { open, triggerRef, contentRef } = context;
  const [pos, setPos] = React.useState<DropdownPosition | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!open) {
      setMounted(false);
      setPos(null);
      return;
    }
    setMounted(true);
  }, [open]);

  React.useLayoutEffect(() => {
    if (!mounted || !open || !triggerRef.current || !contentRef.current) return;

    function recalc() {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;

      const triggerRect = trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = 0;
      if (align === "right") {
        left = triggerRect.right - contentRect.width;
      } else if (align === "left") {
        left = triggerRect.left;
      } else {
        left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
      }

      let top = triggerRect.bottom + sideOffset;

      if (left + contentRect.width > vw - 8) {
        left = vw - contentRect.width - 8;
      }
      if (left < 8) left = 8;

      if (top + contentRect.height > vh - 8) {
        const flipTop = triggerRect.top - contentRect.height - sideOffset;
        if (flipTop >= 8) top = flipTop;
        else top = Math.max(8, vh - contentRect.height - 8);
      }

      setPos({ top, left });
    }

    recalc();

    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [mounted, open, align, sideOffset, triggerRef, contentRef]);

  if (!mounted) return null;

  const style: React.CSSProperties = pos
    ? {
        position: "fixed",
        top: pos.top,
        left: pos.left,
      }
    : { position: "fixed", visibility: "hidden", top: 0, left: 0 };

  const { role: explicitRole, ...otherRest } = rest;
  const content = (
    <div
      ref={contentRef}
      role={explicitRole || "menu"}
      style={style}
      className={cn(
        "animate-in fade-in zoom-in-95 z-[100] min-w-[12rem] rounded-xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-glass backdrop-blur-xl duration-100",
        className
      )}
      {...otherRest}
    >
      {children}
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

export function DropdownMenuItem({
  children,
  className,
  destructive = false,
  onClick,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  destructive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuItem must be used within DropdownMenu");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context.setOpen(false);
  };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/15 focus:bg-destructive/15"
          : "text-foreground hover:bg-accent focus:bg-accent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}
