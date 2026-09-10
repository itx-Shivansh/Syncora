import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          base: "hsl(var(--surface-base))",
          sidebar: "hsl(var(--surface-sidebar))",
          card: "hsl(var(--surface-card))",
          nested: "hsl(var(--surface-nested))",
          hover: "hsl(var(--surface-hover))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Semantic Task Status Colors
        status: {
          backlog: {
            bg: "hsl(var(--status-backlog-bg))",
            fg: "hsl(var(--status-backlog-fg))",
            border: "hsl(var(--status-backlog-border))",
          },
          todo: {
            bg: "hsl(var(--status-todo-bg))",
            fg: "hsl(var(--status-todo-fg))",
            border: "hsl(var(--status-todo-border))",
          },
          inprogress: {
            bg: "hsl(var(--status-inprogress-bg))",
            fg: "hsl(var(--status-inprogress-fg))",
            border: "hsl(var(--status-inprogress-border))",
          },
          inreview: {
            bg: "hsl(var(--status-inreview-bg))",
            fg: "hsl(var(--status-inreview-fg))",
            border: "hsl(var(--status-inreview-border))",
          },
          done: {
            bg: "hsl(var(--status-done-bg))",
            fg: "hsl(var(--status-done-fg))",
            border: "hsl(var(--status-done-border))",
          },
          cancelled: {
            bg: "hsl(var(--status-cancelled-bg))",
            fg: "hsl(var(--status-cancelled-fg))",
            border: "hsl(var(--status-cancelled-border))",
          },
        },
        // Semantic Task Priority Colors
        priority: {
          low: {
            bg: "hsl(var(--priority-low-bg))",
            fg: "hsl(var(--priority-low-fg))",
            border: "hsl(var(--priority-low-border))",
          },
          medium: {
            bg: "hsl(var(--priority-medium-bg))",
            fg: "hsl(var(--priority-medium-fg))",
            border: "hsl(var(--priority-medium-border))",
          },
          high: {
            bg: "hsl(var(--priority-high-bg))",
            fg: "hsl(var(--priority-high-fg))",
            border: "hsl(var(--priority-high-border))",
          },
          urgent: {
            bg: "hsl(var(--priority-urgent-bg))",
            fg: "hsl(var(--priority-urgent-fg))",
            border: "hsl(var(--priority-urgent-border))",
          },
        },
        // Brand palette
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.25)",
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.4), 0 1px 3px -1px rgba(0, 0, 0, 0.3)",
        "card-hover": "0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 3px 8px -2px rgba(0, 0, 0, 0.35)",
        elevated: "0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 4px 12px -2px rgba(0, 0, 0, 0.4)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px -5px rgba(99, 102, 241, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
