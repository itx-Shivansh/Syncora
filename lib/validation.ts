import { z } from "zod";

/**
 * Registration request validation schema
 */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters long" })
    .max(100, { message: "Name cannot exceed 100 characters" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address" })
    .max(255, { message: "Email cannot exceed 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(128, { message: "Password cannot exceed 128 characters" })
    .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Please provide a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Token refresh request schema
 */
export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// -----------------------------------------------------------------------
// Workspace schemas
// -----------------------------------------------------------------------

/** Slugify a string: lowercase, replace spaces/underscores with hyphens, strip specials */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Workspace name must be at least 2 characters" })
    .max(80, { message: "Workspace name cannot exceed 80 characters" }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug may only contain lowercase letters, numbers, and hyphens",
    })
    .min(2, { message: "Slug must be at least 2 characters" })
    .max(64, { message: "Slug cannot exceed 64 characters" })
    .optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema> & {
  resolvedSlug?: string;
};

/** Derive the slug from name if not provided, and expose it as resolvedSlug */
export function resolveWorkspaceSlug(input: z.infer<typeof createWorkspaceSchema>): string {
  return input.slug || toSlug(input.name);
}

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Please provide a valid email address" }),
  role: z.enum(["VIEWER", "MEMBER", "ADMIN"] as const).default("MEMBER"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// -----------------------------------------------------------------------
// Project schemas
// -----------------------------------------------------------------------

export const projectStatusEnum = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
] as const);

export const projectRoleEnum = z.enum(["LEAD", "MEMBER", "VIEWER"] as const);

export const projectVisibilityEnum = z.enum(["PUBLIC_TO_WORKSPACE", "PRIVATE"] as const);

/** Generate a clean 2-5 character uppercase project key from a name */
export function deriveProjectKey(name: string): string {
  const words = name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    const key = words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 5);
    if (key.length >= 2) return key;
  }

  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (clean.slice(0, 4) || "PRJ").padEnd(3, "X").slice(0, 5);
}

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Project name must be at least 2 characters" })
    .max(100, { message: "Project name cannot exceed 100 characters" }),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, {
      message: "Project key must be 2-10 alphanumeric uppercase characters (e.g. SYNC, CORE)",
    })
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, { message: "Description cannot exceed 1000 characters" })
    .optional()
    .nullable(),
  status: projectStatusEnum.default("ACTIVE"),
  visibility: projectVisibilityEnum.default("PUBLIC_TO_WORKSPACE"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g. #6366f1)" })
    .optional()
    .nullable(),
  targetStartDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  targetEndDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  initialMembers: z
    .array(
      z.object({
        userId: z.string().min(1, { message: "Invalid user ID" }),
        role: projectRoleEnum.default("MEMBER"),
      })
    )
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Project name must be at least 2 characters" })
    .max(100, { message: "Project name cannot exceed 100 characters" })
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, { message: "Description cannot exceed 1000 characters" })
    .optional()
    .nullable(),
  status: projectStatusEnum.optional(),
  visibility: projectVisibilityEnum.optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code" })
    .optional()
    .nullable(),
  targetStartDate: z.string().optional().nullable(),
  targetEndDate: z.string().optional().nullable(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, { message: "Valid user ID is required" }),
  role: projectRoleEnum.default("MEMBER"),
});

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const updateProjectMemberRoleSchema = z.object({
  role: projectRoleEnum,
});

export type UpdateProjectMemberRoleInput = z.infer<typeof updateProjectMemberRoleSchema>;

// -----------------------------------------------------------------------
// Task & Label schemas
// -----------------------------------------------------------------------

export const taskStatusEnum = z.enum([
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
] as const);

export const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"] as const);

export const createLabelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Label name is required" })
    .max(50, { message: "Label name cannot exceed 50 characters" }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code (e.g. #6366f1)" })
    .default("#6366f1"),
  description: z.string().trim().max(200).optional().nullable(),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Task title is required" })
    .max(255, { message: "Task title cannot exceed 255 characters" }),
  description: z
    .string()
    .trim()
    .max(10000, { message: "Description cannot exceed 10000 characters" })
    .optional()
    .nullable(),
  status: taskStatusEnum.default("TODO"),
  priority: taskPriorityEnum.default("MEDIUM"),
  assigneeId: z.string().min(1, { message: "Invalid assignee ID" }).optional().nullable(),
  dueDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  estimatedHours: z.number().min(0).max(1000).optional().nullable(),
  labelIds: z.array(z.string().min(1)).optional(),
  newLabels: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(50),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#6366f1"),
      })
    )
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Task title is required" })
    .max(255, { message: "Task title cannot exceed 255 characters" })
    .optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedHours: z.number().min(0).max(1000).optional().nullable(),
  actualHours: z.number().min(0).max(1000).optional().nullable(),
  labelIds: z.array(z.string().min(1)).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const reorderTaskSchema = z.object({
  status: taskStatusEnum.optional(),
  orderIndex: z.number(),
});

export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
