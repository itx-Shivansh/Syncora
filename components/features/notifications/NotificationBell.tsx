"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  workspaceId: string;
  recipientId: string;
  actorId: string | null;
  type: "TASK_ASSIGNED" | "TASK_STATUS_CHANGED" | "MENTION" | "COMMENT_REPLY" | "PROJECT_INVITE" | "SYSTEM";
  resourceType: string;
  resourceId: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}

interface NotificationResponse {
  notifications: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 45) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "TASK_ASSIGNED":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </span>
      );
    case "TASK_STATUS_CHANGED":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </span>
      );
    case "COMMENT_REPLY":
    case "MENTION":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </span>
      );
    case "PROJECT_INVITE":
    default:
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </span>
      );
  }
}

interface NotificationBellProps {
  workspaceId?: string;
  userId: string;
  className?: string;
}

export function NotificationBell({ workspaceId, userId, className }: NotificationBellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filterUnread, setFilterUnread] = React.useState(false);

  const { data, isLoading } = useQuery<NotificationResponse>({
    queryKey: ["notifications", userId, workspaceId],
    queryFn: async () => {
      const url = new URL("/api/notifications", window.location.origin);
      if (workspaceId) url.searchParams.set("workspaceId", workspaceId);
      url.searchParams.set("limit", "30");

      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to fetch notifications");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const displayedNotifications = filterUnread
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const notificationQueryKey = ["notifications", userId, workspaceId];

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      return res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKey });
      const previous = queryClient.getQueryData<NotificationResponse>(notificationQueryKey);

      if (previous) {
        queryClient.setQueryData<NotificationResponse>(notificationQueryKey, {
          ...previous,
          unreadCount: Math.max(0, previous.unreadCount - 1),
          notifications: previous.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          ),
        });
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspaceId ? { workspaceId } : {}),
      });
      if (!res.ok) throw new Error("Failed to mark all notifications as read");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKey });
      const previous = queryClient.getQueryData<NotificationResponse>(notificationQueryKey);

      if (previous) {
        queryClient.setQueryData<NotificationResponse>(notificationQueryKey, {
          ...previous,
          unreadCount: 0,
          notifications: previous.notifications.map((n) => ({
            ...n,
            isRead: true,
            readAt: new Date().toISOString(),
          })),
        });
      }

      return { previous };
    },
    onError: (_vars, _err, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        id="notification-bell-button"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className,
          "data-[state=open]:bg-accent data-[state=open]:text-foreground",
          "bg-background/80 text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            id="notification-unread-badge"
            className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-glow animate-in zoom-in-50"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="right"
        sideOffset={6}
        className="!w-80 !p-0 sm:!w-96 !rounded-2xl !bg-card/95 !shadow-2xl"
        role="dialog"
        aria-label="Notifications Panel"
      >
        <NotificationPanelContent
          notifications={displayedNotifications}
          unreadCount={unreadCount}
          filterUnread={filterUnread}
          isLoading={isLoading}
          onToggleFilter={setFilterUnread}
          onMarkAllRead={() => markAllReadMutation.mutate()}
          markAllReadPending={markAllReadMutation.isPending}
          onNotificationClick={(n) => {
            if (!n.isRead) markReadMutation.mutate(n.id);
            const type = (n.resourceType || "").toUpperCase();
            if (type === "TASK") {
              router.push(`/app/tasks/${n.resourceId}`);
            } else if (type === "PROJECT") {
              router.push(`/app/projects/${n.resourceId}`);
            } else {
              router.push("/app");
            }
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PanelContentProps {
  notifications: NotificationItem[];
  unreadCount: number;
  filterUnread: boolean;
  isLoading: boolean;
  onToggleFilter: (v: boolean) => void;
  onMarkAllRead: () => void;
  markAllReadPending: boolean;
  onNotificationClick: (n: NotificationItem) => void;
}

function NotificationPanelContent({
  notifications,
  unreadCount,
  filterUnread,
  isLoading,
  onToggleFilter,
  onMarkAllRead,
  markAllReadPending,
  onNotificationClick,
}: PanelContentProps) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {unreadCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={markAllReadPending}
              className="text-xs text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label="Mark all notifications as read"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 bg-muted/20">
        <button
          type="button"
          onClick={() => onToggleFilter(false)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            !filterUnread
              ? "bg-accent text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onToggleFilter(true)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            filterUnread
              ? "bg-accent text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 motion-safe:animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted/60" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted/60" />
                  <div className="h-2.5 w-1/2 rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 shadow-glow">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">You&apos;re all caught up</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-[14rem]">
              {filterUnread
                ? "No unread notifications at the moment."
                : "No notifications right now. Activity on your tasks and projects will appear here."}
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onNotificationClick(n)}
              className={cn(
                "flex w-full text-left items-start gap-3 p-3.5 transition-colors duration-150 hover:bg-accent/50 focus-visible:outline-none focus-visible:bg-accent/60",
                !n.isRead && "bg-primary/[0.04]"
              )}
            >
              <div className="relative shrink-0 mt-0.5">
                <Avatar
                  name={n.actor?.name || "System"}
                  src={n.actor?.avatarUrl}
                  size="sm"
                />
                <div className="absolute -bottom-1 -right-1">
                  {getTypeIcon(n.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {n.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {n.message}
                </p>
              </div>

              {!n.isRead && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-glow"
                  aria-label="Unread"
                />
              )}
            </button>
          ))
        )}
      </div>
    </>
  );
}
