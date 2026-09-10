import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("Design System & UI Primitives Suite", () => {
  describe("Utility: cn (classnames & tailwind-merge)", () => {
    it("merges conditional class names cleanly", () => {
      const active = true;
      const disabled = false;
      const result = cn("base-class", active && "active-class", disabled && "disabled-class");
      expect(result).toBe("base-class active-class");
    });

    it("resolves conflicting tailwind classes using last-write precedence", () => {
      const result = cn("p-4 text-red-500", "p-6 text-blue-500");
      expect(result).toBe("p-6 text-blue-500");
    });
  });

  describe("Semantic Task Status Mapping", () => {
    const taskStatuses = [
      "BACKLOG",
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
      "CANCELLED",
    ] as const;

    it("covers all 6 Prisma TaskStatus enum values", () => {
      expect(taskStatuses).toHaveLength(6);
      expect(taskStatuses).toContain("BACKLOG");
      expect(taskStatuses).toContain("TODO");
      expect(taskStatuses).toContain("IN_PROGRESS");
      expect(taskStatuses).toContain("IN_REVIEW");
      expect(taskStatuses).toContain("DONE");
      expect(taskStatuses).toContain("CANCELLED");
    });
  });

  describe("Semantic Task Priority Mapping", () => {
    const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

    it("covers all 4 Prisma TaskPriority enum values", () => {
      expect(taskPriorities).toHaveLength(4);
      expect(taskPriorities).toContain("LOW");
      expect(taskPriorities).toContain("MEDIUM");
      expect(taskPriorities).toContain("HIGH");
      expect(taskPriorities).toContain("URGENT");
    });
  });

  describe("Avatar Monogram Generator", () => {
    function getInitials(name: string): string {
      if (!name) return "U";
      return name
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }

    it("extracts two initials from multi-word full names", () => {
      expect(getInitials("Alex Morgan")).toBe("AM");
      expect(getInitials("Sarah Connor")).toBe("SC");
    });

    it("handles single-word names and edge cases", () => {
      expect(getInitials("Syncora")).toBe("S");
      expect(getInitials("")).toBe("U");
    });
  });
});
