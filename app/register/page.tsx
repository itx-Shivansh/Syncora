"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errs: typeof errors = {};

    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Name must be at least 2 characters long";
    }

    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters long";
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = "Password must contain at least one letter and one number";
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data?.error?.code === "EMAIL_EXISTS") {
          setErrors({ email: "An account with this email already exists" });
        } else if (data?.error?.details) {
          const firstField = Object.keys(data.error.details)[0];
          setErrors({ general: data.error.details[firstField]?.[0] || data.error.message });
        } else {
          setErrors({ general: data?.error?.message || "Registration failed. Please try again." });
        }
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setErrors({ general: "Network connection error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-neutral-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <div className="flex items-center justify-center space-x-2">
            <span className="h-6 w-6 rounded-md bg-neutral-900 dark:bg-white" />
            <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Syncora
            </span>
          </div>
          <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
            Get your team in sync today.
          </p>
        </div>

        {errors.general && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {errors.general}
          </div>
        )}

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Full name
            </label>
            <div className="mt-1">
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-white ${
                  errors.name
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-200 dark:border-neutral-700 dark:focus:border-white"
                }`}
                placeholder="Alex Chen"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-white ${
                  errors.email
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-200 dark:border-neutral-700 dark:focus:border-white"
                }`}
                placeholder="alex@acme.dev"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-white ${
                  errors.password
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-200 dark:border-neutral-700 dark:focus:border-white"
                }`}
                placeholder="Min. 8 chars, 1 letter, 1 number"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Confirm password
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 shadow-sm focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-white ${
                  errors.confirmPassword
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-200 dark:border-neutral-700 dark:focus:border-white"
                }`}
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-neutral-900 underline hover:text-neutral-700 dark:text-white dark:hover:text-neutral-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
