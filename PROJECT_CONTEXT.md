# Syncora — Project Context & Architecture Blueprint

## 1. Product Definition & Brand Personality

**Syncora** is a premium, full-stack team project-management and operational-intelligence platform engineered for high-velocity software, design, and product organizations. Guided by the tagline _"Keep work in sync,"_ Syncora bridges strategic oversight and granular task execution without the cognitive overload and clutter typical of legacy enterprise trackers. Its brand personality is authoritative, calm, and exquisitely precise: editorial typography (such as crisp geometric sans paired with tabular numerals), high-contrast balanced dark and light themes, subtle translucent glassmorphic surfaces, fluid micro-interactions, and tight spatial density. Unlike generic, cartoonish project tools, Syncora feels like a bespoke high-performance instrument—delivering instant responsiveness, executive clarity, and frictionless developer ergonomics.

---

## 2. Finalized Tech Stack Assessment

- **Framework & Language:** Next.js 14 (App Router) + TypeScript (strict mode)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Authentication:** Custom JWT authentication persisted via secure, `httpOnly`, `sameSite=lax` cookies with cryptographic signing and rotation
- **Schema Validation:** Zod (shared end-to-end between client forms and server route handlers / server actions)
- **Design System & Styling:** Tailwind CSS + shadcn/ui customized with bespoke design tokens (semantic HSL color variables, refined radii, custom elevations)
- **Client State & Data Fetching:** TanStack Query (React Query v5) for server cache synchronization + Zustand for lightweight transient UI state (drawers, modals, filter bars)
- **Testing:** Vitest (unit & integration) + Playwright (end-to-end critical flows)
- **Deployment & Infrastructure:** Vercel (frontend & edge/serverless compute) + Neon (Serverless Postgres)

### Stack Soundness & Single Architectural Flag

The chosen stack is exceptionally solid, modern, and production-ready for an enterprise-grade project management application.

**Flagged Architectural Concern:**  
_Neon Serverless Connection Pooling with Prisma in Vercel Serverless Functions._  
In high-concurrency serverless environments, Next.js route handlers and server actions spin up ephemeral stateless containers. Without connection pooling, Prisma can rapidly exhaust Neon's maximum Postgres connection ceiling. **Mitigation:** Ensure Prisma is configured with the Neon pooled connection string (`?sslmode=require&pgbouncer=true`) via direct environment configuration (`DATABASE_URL` for runtime queries via pooler, and `DIRECT_URL` for Prisma CLI migrations), or leverage `@prisma/adapter-neon` via the Prisma driver adapter preview feature.

---

## 3. Conceptual Entity & Data Model

### User

Represents an individual account holder in the system.

- **Key Fields:** Unique identifier, email address, password hash, full name, avatar URL, global role/status, timestamp tracking (created, updated, last active).
- **Relationships:** Belongs to many Workspaces (via `WorkspaceMember`), assigned to many Tasks, authors many Comments, creates ActivityEvents, and receives Notifications.

### Workspace

The top-level multi-tenant container for all organizational assets, teams, and data isolation.

- **Key Fields:** Unique identifier, name, URL slug, logo URL, plan/tier, timestamps.
- **Relationships:** Has many WorkspaceMembers, contains many Projects, holds workspace-wide Labels, and logs Workspace ActivityEvents.

### WorkspaceMember

Join entity defining a User's participation, governance, and privilege level within a specific Workspace.

- **Key Fields:** Unique identifier, workspace ID, user ID, role (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`), invitation status (`INVITED`, `ACTIVE`, `SUSPENDED`), joined timestamp.
- **Relationships:** Belongs to one Workspace, belongs to one User, may be associated with multiple ProjectMemberships.

### Project

A dedicated initiative, repository, or workstream within a Workspace.

- **Key Fields:** Unique identifier, workspace ID, name, key/prefix (e.g., "SYNC"), description, status (`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`), target start date, target due date, color accent/icon, visibility (`PUBLIC_TO_WORKSPACE`, `PRIVATE`).
- **Relationships:** Belongs to one Workspace, has many ProjectMembers, contains many Tasks, belongs to one owner/creator User.

### ProjectMember

Represents explicit access grants, notification preferences, and project-specific roles.

- **Key Fields:** Unique identifier, project ID, user ID, project role (`LEAD`, `CONTRIBUTOR`, `VIEWER`), joined timestamp.
- **Relationships:** Belongs to one Project, belongs to one User.

### Task

The atomic unit of work and collaboration.

- **Key Fields:** Unique identifier, project ID, workspace ID, short task key (e.g., "SYNC-104"), title, rich description (Markdown/JSON), status (`BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`), priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), order index (for kanban/list ordering), start date, due date, estimated hours, creator ID, parent task ID (for subtasks).
- **Relationships:** Belongs to one Project, belongs to one Workspace, created by one User, optionally assigned to an assignee User, optionally has a parent Task and multiple sub-Tasks, has many Comments, associated with many Labels (via `TaskLabel`), generates ActivityEvents.

### Label

Categorical tags and taxonomies used for slicing, filtering, and cross-project indexing.

- **Key Fields:** Unique identifier, workspace ID, name, color hex code, description.
- **Relationships:** Belongs to one Workspace, linked to Tasks through `TaskLabel`.

### TaskLabel

Join model linking Tasks and Labels (many-to-many relationship).

- **Key Fields:** Unique identifier, task ID, label ID, attached timestamp.
- **Relationships:** Belongs to one Task, belongs to one Label.

### Comment

Threaded collaborative discussions on a specific Task.

- **Key Fields:** Unique identifier, task ID, author ID, parent comment ID (for nested replies), content body (Markdown/rich text), edited flag, timestamps.
- **Relationships:** Belongs to one Task, authored by one User, optionally belongs to a parent Comment and contains child Comments.

### ActivityEvent

An immutable append-only audit trail and event ledger capturing changes across projects and tasks.

- **Key Fields:** Unique identifier, workspace ID, project ID (optional), task ID (optional), actor ID (User), action type (e.g., `TASK_CREATED`, `STATUS_CHANGED`, `ASSIGNEE_UPDATED`, `DUE_DATE_SHIFTED`), metadata payload (JSON snapshot of before/after delta), timestamp.
- **Relationships:** Belongs to a Workspace, optionally associated with a Project, Task, and actor User.

### Notification

Targeted alerts notifying users of mentions, status changes, assignments, and risks.

- **Key Fields:** Unique identifier, recipient User ID, actor User ID (optional), workspace ID, resource type (`TASK`, `PROJECT`, `COMMENT`), resource ID, message title, message excerpt, read status (boolean), read timestamp, created timestamp.
- **Relationships:** Belongs to one recipient User, references triggering actors and workspace resources.

---

## 4. Differentiating Features

### Feature 1: Project Health Scoring

- **Justification:** Most project management tools reduce oversight to raw counts of completed versus open tickets, which blinds leaders to latent failure modes until milestones are missed. Syncora's Project Health Scoring runs a real-time predictive algorithm evaluating four balanced vectors: velocity momentum (completion rate vs. historical average), overdue volume, blocked/stale task duration, and scope creep drift. By aggregating these metrics into a 0–100 Health Index (categorized as _Thriving_, _At Risk_, or _Critical_) accompanied by actionable driver explanations, engineering leads and product managers can pinpoint failing projects in seconds without manual status reporting or spreadsheet audits.

### Feature 2: AI Assistant Answering Questions from Real Workspace Data

- **Justification:** Project knowledge typically becomes fragmented across hundreds of nested tasks, comment threads, and activity logs, forcing team members to spend hours hunting for status updates, decisions, and blockers. Syncora’s embedded AI Assistant acts as an always-on contextual intelligence layer grounded directly in the workspace’s live operational graph. By synthesizing data from project metadata, task descriptions, recent comments, and audit events, users can ask natural-language queries (e.g., _"What issues are currently blocking the checkout revamp?", "Which tasks assigned to Sarah are due this week?", "Summarize why the API migration date slipped"_) and receive instant, source-attributed briefings that turn raw task data into decisive executive action.

---

## 5. Build Log

- Chunk 0 complete — architecture defined.
- Chunk 1 complete — Next.js 14 App Router scaffolded in TypeScript strict mode with Tailwind CSS, ESLint, Prettier, Prisma client singleton and PostgreSQL datasource, folder architecture (app, components/ui, components/features, lib, types), GET /api/health route handler, and passing Vitest test suite. (Deviation: A minimal SystemHealth placeholder model was included in schema.prisma to enable Prisma Client generation ahead of Chunk 2 domain modeling).
- Chunk 2 complete — Implemented full production Prisma schema across all 11 entities (User, Workspace, WorkspaceMember, Project, ProjectMember, Task, Label, TaskLabel, Comment, ActivityEvent, Notification). Removed temporary SystemHealth model completely and updated /api/health to query domain models. Implemented enums for roles, statuses, priorities, visibility, and audit actions. Applied migration `20260906123049_init_domain_schema` to PostgreSQL. Authored and executed `prisma/seed.ts` populating 6 demo users, 2 multi-tenant workspaces, 7 projects, 117 realistic tasks with varied due dates/assignees/labels, threaded comments, audit activity events, and notifications. Confirmed data population via Prisma Studio (HTTP 200) and automated Vitest suite.
  - _Schema refinements noted:_ Added `taskNumber` (Int) + `@@unique([projectId, taskNumber])` to generate monotonic project-scoped keys (e.g. `CORE-12`); added `estimatedHours` and `actualHours` to Task; added `isEdited` to Comment; added `readAt` to Notification; added `ProjectVisibility` and `WorkspaceInvitationStatus` enums for future RBAC and team invitation workflows.
- Chunk 3 complete — Implemented production-quality custom JWT authentication. Added `RefreshToken` model via migration `20260906123430_add_refresh_token` for server-side token revocation and rotation. Created `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, and `/api/auth/me` with Zod validation, bcrypt password hashing, and secure httpOnly cookies. Implemented `getCurrentUser()` server-side helper verifying JWT signature and expiry. Configured Edge-compatible `middleware.ts` guarding `/app/*` routes and redirecting authenticated users away from `/login` and `/register`. Built responsive client pages for `/login`, `/register`, and `/app` session dashboard with loading states and error handling. Verified test coverage with 11 passing Vitest tests.

---

## 6. Known Issues / Open Questions

_(None currently identified)_

---

## 7. Remaining Chunks

- Chunk 1: Project Scaffolding, Tooling & Design Token Foundation
- Chunk 2: Database Schema, Prisma Migrations & Seed Harness
- Chunk 3: Custom JWT Authentication & Session Infrastructure
- Chunk 4: User Profile, Onboarding & Workspace Tenancy Management
- Chunk 5: Workspace Members, RBAC & Invitation Pipeline
- Chunk 6: Project Management Engine & Project Settings
- Chunk 7: Task Core Model, CRUD Operations & Server Actions
- Chunk 8: Interactive Kanban Board View & Drag-and-Drop Workflow
- Chunk 9: High-Density List View, Grouping & Batch Actions
- Chunk 10: Task Detail Modal, Rich Markdown & Custom Fields
- Chunk 11: Real-time Comments, Mentions & Collaboration Threads
- Chunk 12: Activity Feed, Event Ledger & Audit Stream
- Chunk 13: In-App & Notification Center Infrastructure
- Chunk 14: Search Engine, Filter Matrix & Saved Views
- Chunk 15: Differentiating Engine I: Project Health Scoring & Predictive Analytics
- Chunk 16: Differentiating Engine II: Workspace-Grounded AI Assistant & Semantic Querying
- Chunk 17: End-to-End Test Harness, Security Hardening & Edge Optimizations
- Chunk 18: Production Polish, Vercel/Neon Deployment Validation & Handoff

---

## 8. Repository Folder Architecture Rules

All future chunks must strictly follow this folder organization:

- `app/`: Next.js 14 App Router routes, layouts, error boundaries, and API route handlers (`app/api/*`).
- `components/ui/`: Reusable atomic UI primitives (buttons, dialogs, dropdowns, inputs, badges) built on shadcn/Radix tokens.
- `components/features/`: Domain composite components (e.g., Kanban boards, task lists, health score widgets, AI assistant drawer) organized by feature.
- `lib/`: Core shared libraries, singletons, and utility modules:
  - `lib/db.ts`: Prisma client singleton.
  - `lib/auth.ts`: Custom JWT signing, cookie management, and session extraction.
  - `lib/validation.ts`: Zod request and form validation schemas.
  - `lib/api.ts`: Standard API response formatting and status helpers.
- `types/`: Global TypeScript interfaces, database entity types, and utility types.
- `prisma/`: Prisma schema (`schema.prisma`), migrations, and database seed harnesses.
- `tests/`: Vitest unit and integration test suites.

---

## 9. Authentication & Session Strategy Reference

- **Cookie Names:**
  - `syncora_access_token`: Short-lived JWT access token.
    - **Expiry:** 15 minutes (`ACCESS_TOKEN_MAX_AGE = 900` seconds).
    - **Payload:** `{ sub: string, email: string, name: string, iat: number, exp: number }`.
  - `syncora_refresh_token`: Longer-lived JWT refresh token with unique `jti`.
    - **Expiry:** 7 days (`REFRESH_TOKEN_MAX_AGE = 604800` seconds).
    - **Payload:** `{ sub: string, email: string, name: string, jti: string, iat: number, exp: number }`.
- **Cookie Security Options:**
  - `httpOnly: true` (inaccessible to browser JavaScript / XSS protection).
  - `secure: process.env.NODE_ENV === "production"` (enforced HTTPS in production).
  - `sameSite: "lax"` (CSRF defense while supporting top-level navigation).
  - `path: "/"`.
- **Token Invalidation & Rotation Flow:**
  - Refresh tokens are hashed via SHA-256 (`tokenHash`) and stored in the database `RefreshToken` model.
  - When `POST /api/auth/refresh` is invoked, the incoming token is verified and matched against the database. If valid, the old record is set to `revoked: true` and a new token pair is issued and persisted.
  - When `POST /api/auth/logout` is called, the matching DB token record is revoked and both browser cookies are cleared (`maxAge: 0`).
- **Single Source of Truth for Session User:**
  - Use `getCurrentUser()` from `@/lib/auth` across all Server Components, Route Handlers, and Server Actions.
  - Returns `SafeUser` (`{ id, email, name, avatarUrl, createdAt }`) or `null`.
  - In route handlers or tests, pass the `Request` instance (`getCurrentUser(request)`) for explicit cookie header extraction.

---

## 10. WorkspaceRole Hierarchy & Authorization Reference

For RBAC checks in Chunk 4 and subsequent authorization layers, the strict privilege ordering is:

$$\text{VIEWER (1)} < \text{MEMBER (2)} < \text{ADMIN (3)} < \text{OWNER (4)}$$

- **`VIEWER` (Level 1):** Read-only visibility into workspace projects, tasks, and members.
- **`MEMBER` (Level 2):** Standard contributor. Can create and edit tasks, comments, and task labels within assigned or public projects.
- **`ADMIN` (Level 3):** Management tier. Can create projects, invite new members, change member roles (up to Admin), and modify project settings.
- **`OWNER` (Level 4):** Root organization authority. Can manage workspace billing, transfer ownership, delete workspace, and administer all roles.
