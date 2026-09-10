"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface SanitizedMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders user-generated or AI-generated markdown safely.
 * Armed with rehype-sanitize to prevent stored-XSS attacks,
 * malicious script tags, iframes, and dangerous href protocols.
 */
export function SanitizedMarkdown({ content, className }: SanitizedMarkdownProps) {
  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className={cn("text-xs leading-relaxed text-foreground/90 break-words", className)}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-base font-bold tracking-tight text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-2.5 text-sm font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-xs font-semibold text-foreground first:mt-0">
              {children}
            </h3>
          ),
          // Paragraphs
          p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
          // Links — safe external attributes
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
            >
              {children}
            </a>
          ),
          // Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
          // Lists
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // Code blocks & inline code
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-lg border border-border/50 bg-secondary/60 p-2.5 font-mono text-[11px] text-foreground">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded border border-border/40 bg-secondary/60 px-1 py-0.5 font-mono text-[11px] text-primary">
                {children}
              </code>
            );
          },
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="my-2.5 border-border/40" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
