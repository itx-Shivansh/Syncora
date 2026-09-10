"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SanitizedMarkdown } from "@/components/ui/sanitized-markdown";
import { cn } from "@/lib/utils";

export interface CommentAuthor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface CommentItem {
  id: string;
  content: string;
  parentId?: string | null;
  createdAt: string;
  isEdited?: boolean;
  author: CommentAuthor;
}

interface TaskCommentsProps {
  taskId: string;
  comments: CommentItem[];
  currentUserId: string;
  isLeadOrAdmin: boolean;
  onUpdated?: () => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function TaskComments({
  taskId,
  comments,
  currentUserId,
  isLeadOrAdmin,
  onUpdated,
}: TaskCommentsProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [content, setContent] = React.useState("");
  const [replyingTo, setReplyingTo] = React.useState<{ id: string; authorName: string } | null>(
    null
  );

  // Group threaded replies
  const { rootComments, repliesByParent } = React.useMemo(() => {
    const roots: CommentItem[] = [];
    const replies: Record<string, CommentItem[]> = {};

    comments.forEach((c) => {
      if (!c.parentId) {
        roots.push(c);
      } else {
        if (!replies[c.parentId]) {
          replies[c.parentId] = [];
        }
        replies[c.parentId].push(c);
      }
    });

    return { rootComments: roots, repliesByParent: replies };
  }, [comments]);

  // Post comment mutation
  const postMutation = useMutation({
    mutationFn: async (payload: { content: string; parentId?: string | null }) => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to post comment");
      return json.data;
    },
    onSuccess: () => {
      setContent("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] });
      toast.success("Comment posted");
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error("Failed to post comment", err.message);
    },
  });

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to delete comment");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      toast.success("Comment deleted");
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error("Failed to delete comment", err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    postMutation.mutate({
      content: content.trim(),
      parentId: replyingTo?.id || null,
    });
  };

  const renderCommentCard = (comment: CommentItem, isReply = false) => {
    const canDelete = comment.author.id === currentUserId || isLeadOrAdmin;
    return (
      <div
        key={comment.id}
        className={cn(
          "group flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-3 transition-colors",
          isReply && "ml-8 border-l-2 border-l-primary/40 bg-card/20"
        )}
      >
        <Avatar
          name={comment.author.name}
          src={comment.author.avatarUrl}
          size="sm"
          className="shadow-xs mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{comment.author.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              {!isReply && (
                <button
                  type="button"
                  onClick={() => setReplyingTo({ id: comment.id, authorName: comment.author.name })}
                  className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
                >
                  Reply
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(comment.id)}
                  disabled={deleteMutation.isPending}
                  className="ml-1 text-[11px] text-rose-400/80 transition-colors hover:text-rose-400"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <SanitizedMarkdown content={comment.content} className="mt-1" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3">
        {rootComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
            <svg
              className="mb-2 h-8 w-8 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            No comments yet. Start the conversation below.
          </div>
        ) : (
          rootComments.map((root) => (
            <div key={root.id} className="space-y-2">
              {renderCommentCard(root)}
              {repliesByParent[root.id]?.map((reply) => renderCommentCard(reply, true))}
            </div>
          ))
        )}
      </div>

      {/* New Comment Input Box */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2">
        {replyingTo && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
            <span>
              Replying to <strong>{replyingTo.authorName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="relative rounded-xl border border-border/60 bg-card/60 p-2 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
          <textarea
            rows={3}
            placeholder={
              replyingTo
                ? `Write a reply to ${replyingTo.authorName}...`
                : "Add a comment... (markdown supported)"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none bg-transparent px-1.5 py-1 font-sans text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />

          <div className="flex items-center justify-between border-t border-border/30 pt-2">
            <span className="text-[10px] text-muted-foreground">Markdown supported</span>

            <Button
              type="submit"
              size="sm"
              disabled={postMutation.isPending || !content.trim()}
              className="shadow-xs h-7 px-3 text-xs"
            >
              {postMutation.isPending ? "Posting..." : replyingTo ? "Reply" : "Comment"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
