"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoLogin = () => {
    setEmail("demo@syncora.app");
    setPassword("SyncoraDemo!2026");
    setErrors({});
  };

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isLoading) return;

    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data?.error?.code === "INVALID_CREDENTIALS") {
          setErrors({
            general: "Invalid email or password. Please double-check your credentials.",
          });
        } else {
          setErrors({ general: data?.error?.message || "Sign in failed. Please try again." });
        }
        return;
      }

      queryClient.clear();
      router.push(redirect);
      router.refresh();
    } catch {
      setErrors({ general: "Network connection error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <svg
              className="h-6 w-6 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Syncora</h1>
          <p className="mt-1 text-sm text-muted-foreground">Keep work in sync.</p>
        </div>

        <Card glass className="p-6 sm:p-8">
          <CardHeader className="p-0 pb-6 text-center">
            <CardTitle className="text-xl">Sign in to your account</CardTitle>
            <CardDescription className="text-xs">
              Access your workspaces, projects, and execution stream
            </CardDescription>
          </CardHeader>

          {errors.general && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{errors.general}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-foreground">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="demo@syncora.app"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="SyncoraDemo!2026"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              isLoading={isLoading}
              className="mt-2 h-10 w-full font-medium"
            >
              Sign in
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
                Demo access
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                demo@syncora.app / SyncoraDemo!2026
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleDemoLogin}>
              Use demo
            </Button>
          </div>

          <div className="mt-6 border-t border-border/50 pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary-hover"
              >
                Create an account
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="motion-safe:animate-pulse text-sm text-muted-foreground">Loading sign in...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
