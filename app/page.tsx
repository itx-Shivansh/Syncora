import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6 text-center sm:p-12">
      {/* Subtle background ambient radial gradient */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 motion-safe:animate-pulse rounded-full bg-primary" aria-hidden="true" />
          Syncora v0.1.0 • Enterprise Architecture
        </div>

        <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          Keep work in{" "}
          <span className="bg-gradient-to-r from-primary via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            sync.
          </span>
        </h1>

        <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Syncora is the premium operational-intelligence and project execution platform built for
          high-velocity software, design, and product engineering teams.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
          <Link href="/login">
            <Button size="lg" className="w-full font-semibold sm:w-auto">
              Sign In to Workspace
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" size="lg" className="w-full font-medium sm:w-auto">
              Create New Account
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
