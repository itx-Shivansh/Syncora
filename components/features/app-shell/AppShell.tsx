"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/features/auth/LogoutButton";
import { WorkspaceSwitcher } from "@/components/features/WorkspaceSwitcher";
import { NotificationBell } from "@/components/features/notifications/NotificationBell";
import { cn } from "@/lib/utils";

interface AppShellUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface AppShellProps {
  user: AppShellUser;
  children: React.ReactNode;
  activeWorkspaceId?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: string;
}

export function AppShell({ user, children, activeWorkspaceId }: AppShellProps) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  // Close mobile drawer on route navigation
  React.useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  React.useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileDrawerOpen]);

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileDrawerOpen]);

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/app",
      icon: (active) => (
        <svg
          className={cn(
            "h-4 w-4 transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      label: "Projects",
      href: "/app/projects",
      icon: (active) => (
        <svg
          className={cn(
            "h-4 w-4 transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      ),
    },
    {
      label: "Tasks",
      href: "/app/tasks",
      icon: (active) => (
        <svg
          className={cn(
            "h-4 w-4 transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      label: "Search",
      href: "/app/search",
      badge: "⌘K",
      icon: (active) => (
        <svg
          className={cn(
            "h-4 w-4 transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      {/* ------------------------------------------------------------- */}
      {/* Desktop Sidebar (hidden on small viewports)                  */}
      {/* ------------------------------------------------------------- */}
      <aside className="z-40 hidden border-r border-border/70 bg-surface-sidebar/95 backdrop-blur-xl md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col shadow-card">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-5">
          <Link href="/app" className="flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-90" aria-label="Syncora — Go to dashboard">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-glow transition-transform duration-150 group-hover:scale-105">
              <svg
                className="h-4 w-4 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-foreground">Syncora</span>
              <span className="py-0.2 rounded-full bg-primary/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                Pro
              </span>
            </div>
          </Link>
          <NotificationBell workspaceId={activeWorkspaceId} userId={user.id} />
        </div>

        {/* Workspace Switcher */}
        <div className="border-b border-border/40 p-3">
          <WorkspaceSwitcher activeWorkspaceId={activeWorkspaceId} />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main Navigation">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive =
              item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "border border-primary/25 bg-primary/12 font-semibold text-primary shadow-subtle"
                    : "text-muted-foreground hover:bg-surface-nested/70 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  {item.icon(isActive)}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <kbd className="hidden items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:inline-flex">
                    {item.badge}
                  </kbd>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout (Bottom) */}
        <div className="border-t border-border/50 bg-surface-sidebar/80 p-3">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-nested/80 p-2 shadow-card transition-all duration-150 hover:border-border">
            <div className="flex min-w-0 items-center gap-2.5 pr-2">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-[10px] leading-tight text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <LogoutButton
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:bg-destructive/15 hover:text-destructive whitespace-nowrap transition-colors duration-150"
            />
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* Mobile Top Header (visible on < md viewports)                 */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-surface-sidebar/95 px-4 backdrop-blur-xl md:hidden shadow-subtle">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation drawer"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary shadow-glow">
              <svg
                className="h-3.5 w-3.5 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">Syncora</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell workspaceId={activeWorkspaceId} userId={user.id} />
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* Mobile Slide-Over Drawer                                      */}
      {/* ------------------------------------------------------------- */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="animate-in fade-in fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="animate-in slide-in-from-left relative z-50 flex w-full max-w-xs flex-1 flex-col border-r border-border/70 bg-surface-sidebar p-4 shadow-elevated duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                  <svg
                    className="h-4 w-4 text-primary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <span className="text-base font-bold text-foreground">Syncora</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close menu"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Workspace Switcher */}
            <div className="border-b border-border/40 py-4">
              <WorkspaceSwitcher activeWorkspaceId={activeWorkspaceId} />
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex-1 space-y-1 overflow-y-auto py-4">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "border border-primary/25 bg-primary/12 font-semibold text-primary shadow-subtle"
                        : "text-muted-foreground hover:bg-surface-nested/70 hover:text-foreground"
                    )}
                  >
                    {item.icon(isActive)}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile User Profile & Logout */}
            <div className="border-t border-border/60 pt-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-nested/80 p-2 shadow-card">
                <div className="flex min-w-0 items-center gap-2.5 pr-2">
                  <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <LogoutButton
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive whitespace-nowrap"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Main Content Area                                             */}
      {/* ------------------------------------------------------------- */}
      <main className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0 md:pl-64">
        <div className="animate-in fade-in mx-auto w-full max-w-7xl flex-1 p-4 duration-200 sm:p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Mobile Bottom Quick Navigation Bar (< md viewports)           */}
      {/* ------------------------------------------------------------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-border bg-card/90 px-2 backdrop-blur-xl md:hidden"
        aria-label="Mobile Bottom Navigation"
      >
        {navItems.map((item) => {
          const isActive =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg px-3 py-1 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon(isActive)}
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
