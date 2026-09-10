import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, startIcon, endIcon, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {startIcon && (
          <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
            {startIcon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          aria-invalid={!!error}
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-card/60 px-3.5 py-2 text-sm text-foreground shadow-subtle transition-all duration-150",
            "placeholder:text-muted-foreground/60",
            "focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            startIcon && "pl-9",
            endIcon && "pr-9",
            error &&
              "border-destructive/80 text-destructive-foreground focus-visible:border-destructive focus-visible:ring-destructive/30",
            className
          )}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
            {endIcon}
          </div>
        )}
        {error && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
