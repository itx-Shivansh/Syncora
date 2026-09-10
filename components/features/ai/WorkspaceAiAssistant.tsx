"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface WorkspaceAiAssistantProps {
  workspaceId: string;
  workspaceName: string;
}

export function WorkspaceAiAssistant({ workspaceId, workspaceName }: WorkspaceAiAssistantProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputMessage, setInputMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: `Hello! I'm your **Syncora AI Intelligence Assistant**, grounded directly in the live projects, tasks, and members of **${workspaceName}**.\n\nAsk me anything about active deadlines, team assignments, overdue work, or project health.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Ref on the scrollable MESSAGE CONTAINER (the div with overflow-y-auto),
  // NOT on a sentinel element. We use scrollTop directly so scroll is always
  // scoped to this element and can never cause the page to jump.
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const toast = useToast();

  const scrollToBottom = React.useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Direct DOM property: scrolls only within this element, never the page.
    el.scrollTop = el.scrollHeight;
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame so the DOM has fully painted the new
      // content (expanded panel or new message bubble) before we measure
      // scrollHeight. Without this, scrollHeight can lag one render.
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages, isOpen, scrollToBottom]);

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errorMsg = json.error?.message || "Failed to process request";
        toast.error("AI Assistant", errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "assistant",
            text: `⚠️ **Unable to complete request:** ${errorMsg}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        return;
      }

      const answer = json.data?.answer || "No response received.";
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      toast.error("AI Assistant Error", msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: "⚠️ A connection error occurred while querying the workspace. Please check your connection and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // BUG 2 FIX: toggle handler is only called from type="button" elements,
  // so no form submission or anchor jump can trigger.
  const handleToggle = () => setIsOpen((prev) => !prev);

  const sampleQuestions = [
    "What tasks does Marcus have overdue?",
    "Which projects are at risk?",
    "What tasks are overdue?",
    "Summarize project health",
  ];

  return (
    <Card glass className="overflow-hidden border-primary/20 bg-card/60 shadow-subtle">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary shadow-xs">
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Syncora Workspace AI
              </h2>
              <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-primary">
                Grounded
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Natural-language questions grounded in real {workspaceName} operational data
            </p>
          </div>
        </div>

        {/* BUG 2 FIX: explicit type="button" prevents any implicit form submission */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isOpen ? "Collapse" : "Open Assistant"}
          <svg
            className={`ml-1.5 h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </div>

      {/* Collapsed view: quick prompt chips */}
      {!isOpen ? (
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <span className="text-xs text-muted-foreground">Quick queries:</span>
          {sampleQuestions.map((q) => (
            /* BUG 2 FIX: explicit type="button" on every chip */
            <button
              key={q}
              type="button"
              onClick={() => {
                setIsOpen(true);
                handleSend(q);
              }}
              className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground/80 transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        /* Expanded Chat Panel */
        <div className="flex flex-col">
          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/30 bg-secondary/20 px-4 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">Suggested:</span>
            {sampleQuestions.map((q) => (
              /* BUG 2 FIX: explicit type="button" on every chip */
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className="rounded-md border border-border/40 bg-card/60 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages Stream — overflow-y-auto container; scroll is driven by
              scrollTop on messagesContainerRef, never by scrollIntoView. */}
          <div
            ref={messagesContainerRef}
            className="max-h-96 min-h-64 space-y-3 overflow-y-auto p-4 sm:p-5"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{msg.sender === "user" ? "You" : "Syncora AI"}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-2xl rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "rounded-tr-none bg-primary text-primary-foreground shadow-sm"
                      : "rounded-tl-none border border-border/60 bg-card/90 text-foreground backdrop-blur-sm"
                  }`}
                >
                  {msg.sender === "user" ? (
                    /* User messages: plain text is fine, they don't contain markdown */
                    <span className="whitespace-pre-wrap">{msg.text}</span>
                  ) : (
                    /* Assistant messages rendered through sanitized ReactMarkdown */
                    <ReactMarkdown
                      rehypePlugins={[rehypeSanitize]}
                      components={{
                        // Headings
                        h1: ({ children }) => (
                          <h1 className="mb-1.5 mt-2 text-sm font-bold text-foreground first:mt-0">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="mb-1 mt-2 text-xs font-bold text-foreground first:mt-0">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="mb-1 mt-1.5 text-xs font-semibold text-foreground first:mt-0">
                            {children}
                          </h3>
                        ),
                        // Paragraphs
                        p: ({ children }) => (
                          <p className="mb-1.5 last:mb-0">{children}</p>
                        ),
                        // Emphasis
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-muted-foreground">{children}</em>
                        ),
                        // Lists
                        ul: ({ children }) => (
                          <ul className="mb-1.5 ml-3 list-disc space-y-0.5 last:mb-0">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mb-1.5 ml-3 list-decimal space-y-0.5 last:mb-0">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed">{children}</li>
                        ),
                        // Inline code
                        code: ({ children, className }) => {
                          // Block code (has a language class) vs inline code
                          const isBlock = className?.startsWith("language-");
                          if (isBlock) {
                            return (
                              <code className="block overflow-x-auto rounded-md bg-secondary/60 px-3 py-2 font-mono text-[10px] text-foreground">
                                {children}
                              </code>
                            );
                          }
                          return (
                            <code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[10px] text-foreground">
                              {children}
                            </code>
                          );
                        },
                        // Horizontal rule
                        hr: () => <hr className="my-2 border-border/40" />,
                        // Block quote
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start" aria-live="polite" aria-label="Syncora AI is thinking">
                <div className="mb-1 text-[10px] text-muted-foreground">Syncora AI</div>
                <div className="flex items-center gap-2 rounded-xl rounded-tl-none border border-primary/30 bg-card/90 px-4 py-3 text-xs text-muted-foreground shadow-xs">
                  <span className="flex h-2 w-2 rounded-full bg-primary motion-safe:animate-ping" aria-hidden="true" />
                  <span className="font-medium text-foreground">
                    Synthesizing real workspace data...
                  </span>
                </div>
              </div>
            )}
            {/* sentinel div removed — scroll driven by container.scrollTop instead */}
          </div>

          {/* Input Box */}
          {/*
            BUG 2 FIX: The <form> onSubmit already calls e.preventDefault() so pressing
            Enter sends the message without any page navigation or scroll jump.
            The submit <Button> inside a <form> is intentionally type="submit" for
            Enter-key support — that's correct. All OTHER buttons above use type="button".
          */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-border/40 bg-card/40 p-3 sm:px-4"
          >
            <Input
              id="ai-assistant-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask a question about ${workspaceName} tasks, overdue work, or project health...`}
              disabled={isLoading}
              className="h-9 flex-1 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !inputMessage.trim()}
              className="gap-1 px-3 shadow-xs"
            >
              <span>Ask</span>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
