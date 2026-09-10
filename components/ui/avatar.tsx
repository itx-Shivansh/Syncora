"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);

  const initials = React.useMemo(() => {
    if (!name) return "U";
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [name]);

  // Deterministic palette generation from name
  const hue = React.useMemo(() => {
    if (!name) return 240;
    return Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  }, [name]);

  const sizeClasses = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
    xl: "h-14 w-14 text-lg",
  };

  const hasValidImage = src && !imgError;

  return (
    <div
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-white/10 font-medium shadow-subtle",
        sizeClasses[size],
        className
      )}
      style={
        !hasValidImage
          ? {
              backgroundColor: `hsl(${hue}, 60%, 40%)`,
              color: "#ffffff",
            }
          : undefined
      }
      {...props}
    >
      {hasValidImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
