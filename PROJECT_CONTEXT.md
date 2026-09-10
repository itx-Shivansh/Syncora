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

### Demo Login & First-Login Recruiter Experience

- **Demo user:** `demo@syncora.app`
- **Password:** `SyncoraDemo!2026`
- **Seed behavior:** `prisma/seed.ts` performs a clean reset of the demo database before re-creating deterministic data so re-running the seed is safe and idempotent.

After signing in with the demo account, a reviewer lands on a fully populated Acme workspace dashboard that already reads like a real operating command center: the high-priority "Launch Recovery Sprint" is visibly at risk, workload concentration is surfaced as a bottleneck, notifications and activity feed entries are already populated, and the project cards use meaningful labels and due-date pressure to tell a believable operational story without any manual setup.

### Production Deployment

- **Live URL:** [https://syncora-sr-codez.vercel.app](https://syncora-sr-codez.vercel.app)
- **Source:** GitHub repository `itx-Shivansh/Syncora`, connected to the Vercel project `sr-codez/syncora` for production deployments from `main`.
- **Application hosting:** Vercel hosts the Next.js 14 App Router application and serverless API route handlers.
- **Database hosting:** Neon PostgreSQL is provisioned through the Vercel Marketplace integration and connected to the Vercel project. Runtime queries use the pooled `DATABASE_URL`; Prisma migration commands use the non-pooling `DIRECT_URL`.
- **Authentication configuration:** Production uses a generated `JWT_SECRET`. Auth cookies are `httpOnly`, `secure` when `NODE_ENV=production`, `SameSite=Lax`, and scoped to `/`; no cookie domain override is used, so cookies are correctly host-only for the Vercel domain.
- **Release flow:** `prisma migrate deploy` applies committed migrations to Neon, `prisma/seed.ts` resets and repopulates the demo dataset, and Vercel runs the successful `npm run build` deployment pipeline.
- **Production verification:** The live homepage, registration, workspace creation, project creation, task creation, task reorder (`TODO` -> `IN_PROGRESS`), logout, demo login, dashboard health cards, notifications, and grounded AI project-health query were exercised against the deployed domain.

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
- Chunk 4 complete — Implemented multi-tenant workspace tenancy and RBAC authorization engine. Added canonical `requireWorkspaceMember` authorization utility in `lib/workspace-auth.ts` with role rank hierarchy (VIEWER < MEMBER < ADMIN < OWNER) returning 404 on uninvited cross-tenant access to prevent tenant existence probing. Implemented workspace API surface: `POST /api/workspaces` (creation + OWNER assignment + audit event), `GET /api/workspaces` (active memberships with role and project/member counts), `GET /api/workspaces/active` (switcher payload), `POST /api/workspaces/:id/invite` (ADMIN/OWNER invite flow with existing-user direct activation, pending state for non-existing users, and role escalation guard), `GET /api/workspaces/:id/invites` (member listing with status filter), and `POST /api/workspaces/invites/accept`. Built UI components: `WorkspaceSwitcher` dropdown, `WorkspaceOnboarding` flow, and `/app/workspaces/new` page. Authored comprehensive isolation test suite in `tests/workspace.test.ts` with 100% pass rate (24/24 passing across full test suite).
- Design System & App Shell complete — Engineered Syncora's bespoke visual design system, design tokens, typography pairing (Plus Jakarta Sans + JetBrains Mono), 13 accessible UI primitives in `components/ui/`, responsive authenticated `AppShell` with desktop sidebar and mobile drawer/bottom navigation, and retrofitted all existing screens (/login, /register, onboarding, workspace switcher, and dashboard). Verified with 30 passing tests and 0 ESLint warnings.
- Chunk 6 complete — Implemented Project Management Engine & Project Settings as a first-class feature. Ground-truth Prisma enums confirmed and enforced: `ProjectStatus` (PLANNING, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED), `ProjectRole` (LEAD, MEMBER, VIEWER), and `ProjectVisibility` (PUBLIC_TO_WORKSPACE, PRIVATE). Implemented shared Zod schemas (`createProjectSchema` with uppercase alphanumeric key validation / auto-derivation, `updateProjectSchema`, `addProjectMemberSchema`, `updateProjectMemberRoleSchema`). Built full API surface with canonical `requireWorkspaceMember` guard: `POST /api/workspaces/:id/projects` (creates project, assigns creator as LEAD, logs PROJECT_CREATED ActivityEvent), `GET /api/workspaces/:id/projects` (lists projects with strict PRIVATE visibility filtering and task completion metrics), `GET /api/projects/:id` (detail with task summary and private visibility guard returning 404), `PATCH /api/projects/:id` (updates settings/status, gated to project LEAD or workspace ADMIN+), `DELETE /api/projects/:id` (deletes project, gated to project LEAD or workspace ADMIN+), and project membership management (`POST /api/projects/:id/members`, `PATCH /api/projects/:id/members/:userId`, `DELETE /api/projects/:id/members/:userId`). Configured TanStack Query with `QueryProvider`. Built frontend views: `/app/projects` (grid of Card components with progress bar, member avatars, status badges, and New Project dialog) and `/app/projects/[id]` (project overview, editable status, timeline, member management, and task status velocity cards). Authored 15-case integration test suite in `tests/project.test.ts`. Full test suite passing at 45/45 tests with zero ESLint errors.
- Chunk 13 complete — Event-Driven In-App Notifications Engine & Notification Center. Real, event-driven notification rows (zero fake or decorative notifications) hooked into existing mutation logic across projects, tasks, comments, and workspaces.
  - **Notification Trigger Matrix**:
    1. `TASK_ASSIGNED` (resourceType: `TASK`): Fired on task creation (`POST /api/projects/:id/tasks`) and task update (`PATCH /api/tasks/:id`) when `assigneeId` is set or modified to another user. Self-assignment is suppressed.
    2. `TASK_STATUS_CHANGED` (resourceType: `TASK`): Fired on task update (`PATCH /api/tasks/:id`) and board drag-and-drop reorder (`PATCH /api/tasks/:id/reorder`) to notify the task's assignee when status changes. Suppressed if actor is assignee.
    3. `COMMENT_REPLY` / `MENTION` (resourceType: `TASK`): Fired on comment creation (`POST /api/tasks/:id/comments`) to notify task stakeholders (task creator, assignee, and prior distinct commenters on that task). Comment author is suppressed.
    4. `PROJECT_INVITE` (resourceType: `PROJECT`): Fired on adding project member (`POST /api/projects/:id/members`) to notify added user.
    5. `PROJECT_INVITE` (resourceType: `WORKSPACE`): Fired on inviting user to workspace (`POST /api/workspaces/:id/invite`).
  - **API Surface**:
    - `GET /api/notifications`: Paginated listing (default 20, max 50), scoped to current authenticated user (`recipientId === user.id`), with unread filter, workspace filter, actor profiles, and unreadCount.
    - `GET /api/notifications/unread-count`: Lightweight polling endpoint returning `{ unreadCount }`.
    - `PATCH /api/notifications/:id/read` & `PATCH /api/notifications/:id`: Marks single notification read. Strict 404 anti-probing isolation for non-owned notifications.
    - `POST /api/notifications/mark-all-read`: Marks all unread notifications for current user as read.
  - **App Shell Integration & UI**:
    - `NotificationBell` in `components/features/notifications/NotificationBell.tsx` mounted in desktop sidebar brand header and mobile header in `AppShell.tsx`.
    - Unread badge pill counter with glowing accent.
    - TanStack Query polling at 15-second interval (`refetchInterval: 15000`) for seamless real-time background synchronization.
    - Dropdown panel with All / Unread filter pills, "Mark all read" button, relative timestamps, type icons, actor avatars, and deep links to `/app/tasks/:id` and `/app/projects/:id`.
    - Sensible empty state ("You're all caught up").
  - **Testing**: 8 integration tests in `tests/notification.test.ts` verifying all trigger types, authorization boundaries, pagination, and read toggles. Full suite passing at 11 test files, 137 tests. Live server end-to-end verified with real seeded users (Alex Chen -> Sarah Jenkins).
- Chunk 15 complete — Differentiating Engine I: Computed Project Health & Operational Risk Scoring. Replaced placeholder heuristic with a multi-vector 0–100 Health Index computed server-side in `lib/project-health.ts`:
  - **4 Balanced Vectors**:
    1. Overdue Task Burden (35% weight): Ratio of overdue active tasks to total active tasks, penalizing escalating missed deadlines.
    2. Workload Concentration & Bottlenecks (25% weight): Detects if an individual assignee holds >45% (warning) or >65% (critical bottleneck) of active work, or if >45% of tasks are unassigned.
    3. Completion Velocity & Milestone Momentum (20% weight): Rates completed tasks in the last 14 days and evaluates proximity to target milestone dates.
    4. Activity Recency (20% weight): Measures elapsed days since the latest task modification or activity event.
  - **Status Modifiers**: -25 penalty applied if project status is `ON_HOLD`. Score 100 for completed projects.
  - **Categorical Tiers**: `ON_TRACK` (75–100), `NEEDS_ATTENTION` (50–74), `AT_RISK` (0–49).
  - **Honest Driver Explanations**: Produces top human-readable reasons (e.g. *"Project status is explicitly On Hold"*, *"3 overdue tasks (25% of active work past due date)"*, *"Workload concentration: Sarah Jenkins holds 47% of active tasks"*).
  - **API Surface & UI Integration**: Integrated into `GET /api/dashboard/:workspaceId/projects`, `GET /api/projects/:id`, `GET /api/workspaces/:id/projects`, dashboard `ProjectsSection.tsx`, and project overview page `/app/projects/[id]`. Preserved backward-compatible `isAtRisk: boolean` flag.
  - **Testing**: 5 unit tests in `tests/project-health.test.ts`, verified across all existing dashboard/project tests.
- Chunk 16 complete — Differentiating Engine II: Workspace-Grounded AI Assistant & Operational Querying.
  - **Secure Scoping & Multi-Tenant Isolation**: Implemented `POST /api/workspaces/:id/ai-assistant` strictly gated via canonical `requireWorkspaceMember(user.id, workspaceId, "VIEWER")` (returning 404 for non-members). Filters projects based on `PUBLIC_TO_WORKSPACE` and membership visibility.
  - **Rate Limiting**: Sliding-window in-memory rate limiter enforcing maximum 15 requests/minute per user/workspace, returning HTTP 429 when exceeded.
  - **Data Grounding & Factual Synthesizer**: Queries real workspace records (projects, tasks, due dates, statuses, assignees, workload, health scores). Supports external LLM providers (`GEMINI_API_KEY`, `OPENAI_API_KEY`) and features an exact factual local synthesizer that answers specific questions (e.g., Marcus Vance overdue tasks `CORE-2` and `BILL-14`, project health overviews, member workloads) with zero hallucination.
  - **Frontend UI**: Built `components/features/ai/WorkspaceAiAssistant.tsx` directly mounted on `/app` command center with suggested query chips, collapsible drawer, streaming pulse indicator, markdown formatting, and resilient error handling.
- Chunk 17.5 complete — Bugfix & Polish Pass (Sidebar Layout, Timeline Seeding, Workspace Cleanup, Kanban Affordances):
  - **Issue 1 ("Sign out" Button Text Wrapping Fixed):** Resolved layout bug where "Sign out" wrapped across two lines in the desktop sidebar footer. Root cause: `size="icon"` paired with fixed `w-7` constrained the button to a 28px width box, forcing the text to wrap. Changed to `size="sm"` with `shrink-0 px-2 text-xs whitespace-nowrap` and added `whitespace-nowrap` defensively in `LogoutButton.tsx`.
  - **Issue 2 (Project Activity Timeline Root Cause & Backfill):** Investigated the missing timeline on the Legacy Data Migration project.
    - *Root Cause:* Confirmed as a **seed-data gap** in `prisma/seed.ts`. During initial seeding, audit events and comments were only generated for `createdTasks.slice(0, 8)`—which only sampled tasks from the first seeded project (`Core Platform 2.0`), leaving all other 6 projects (including Legacy Data Migration) with 0 ActivityEvents.
    - *Remediation:* Refactored `prisma/seed.ts` to iterate across all projects when generating `PROJECT_CREATED`, `TASK_CREATED`, `STATUS_CHANGED`, and threaded discussion comments. Backfilled 40 rich activity events for existing tasks in Legacy Data Migration (and across all other projects) in the development database. Additionally hardened `/api/projects/:id/activity` with an `OR: [{ projectId: project.id }, { task: { projectId: project.id } }]` query filter and added fallback parsing for `from`/`to` and `previousStatus`/`newStatus` in `TaskActivityFeed.tsx`.
  - **Issue 3 (Workspace Hygiene & Leftover Test Task Deletion):** Permanently deleted leftover manual testing tasks (`CORE-18` through `CORE-21` titled "sarah ka kaam h", "sara u have new work", "sarah work", "saraaaaaaaaaaa") and their associated notifications from the `Core Platform 2.0` project in the dev database.
  - **Issue 4 (Kanban Horizontal Scroll Edge-Fade Affordances):** Implemented dynamic left and right edge-fade gradient overlays (`bg-gradient-to-r` and `bg-gradient-to-l` with `pointer-events-none`) for the desktop Kanban board. Monitored via a `ResizeObserver` and `onScroll` handler measuring `scrollLeft` and `scrollWidth`, seamlessly fading in/out to visually alert users when additional columns lie off-screen.
  - **Testing & Verification:** 160 Vitest integration tests passing (100%), all 5 Playwright E2E browser tests passing (32.6s), and clean development database verified with zero test pollution.

---

## 6. Known Issues / Open Questions

- **Manual Testing Data Hygiene:** Avoid leaving manually-created test data (e.g. ad-hoc tasks, scrap labels, or test comments) in the shared demo workspace (`Acme Corporation` or `Nova Labs`). Future developer/agent sessions should either conduct manual browser verification in an isolated throwaway workspace created specifically for testing, or clean up all test entities from the database upon completion of the manual verification session.

---

## 7. Remaining Chunks (True Status Audit)

### Completed Core & Differentiating Feature Engines
- Chunk 1: Project Scaffolding, Tooling & Design Token Foundation [DONE]
- Chunk 2: Database Schema, Prisma Migrations & Seed Harness [DONE]
- Chunk 3: Custom JWT Authentication & Session Infrastructure [DONE]
- Chunk 4: User Profile, Onboarding & Workspace Tenancy Management [DONE]
- Chunk 5: Workspace Members, RBAC & Invitation Pipeline [DONE]
- Chunk 6: Project Management Engine & Project Settings [DONE]
- Chunk 7: Task Core Model, CRUD Operations & Server Actions [DONE]
- Chunk 8: Interactive Kanban Board View & Drag-and-Drop Workflow [DONE]
- Chunk 9: High-Density List View, Grouping & Batch Actions [DONE]
- Chunk 10: Task Detail Modal, Rich Markdown & Custom Fields [DONE]
- Chunk 11: Real-time Comments, Mentions & Collaboration Threads [DONE]
- Chunk 12: Activity Feed, Event Ledger & Audit Stream [DONE]
- Chunk 13: In-App & Notification Center Infrastructure [DONE]
- Chunk 14: Search Engine, Filter Matrix & Saved Views [DONE]
- Feature Engine A (Health Engine): Project Health Scoring & Predictive Analytics [DONE]
- Feature Engine B (AI Assistant): Workspace-Grounded AI Assistant & Semantic Querying [DONE]
- Quality Pass (Test Harness): Test DB Isolation (`syncora_test`), 160 Vitest tests + 5 Playwright E2E tests [DONE]
- Visual Design Polish: 4-Level Surface Elevation, Typography Scale, Micro-transitions, Muted Pills [DONE]

### Original Release Chunks (Remaining Status)
- **Original Chunk 15 (Security & Performance Audit): [NOT DONE / PENDING]**
  - Secrets/API key scan across codebase.
  - API error response sanitization (prevent stack trace & raw Prisma/DB error leaks).
  - Markdown XSS sanitization (rehype-sanitize on task descriptions/comments).
  - N+1 query audit & pagination on unbounded list endpoints.
- **Original Chunk 16 (Seed & Demo Data Polish): [PARTIALLY DONE / PENDING]**
  - Rich project and task data exist, but lacks idempotent upsert re-seed execution and README documentation of demo logins.
- **Original Chunk 17 (Production Deployment to Vercel + Neon): [NOT DONE / PENDING]**
  - Real production deployment to Vercel.
  - Production Neon PostgreSQL database connection.
  - Production migrations run (`prisma migrate deploy`).
  - Live smoke test against deployed production URL.
- **Original Chunk 18 (Final README & Submission Package): [NOT DONE / PENDING]**
  - README is currently a 10-line Chunk 0 stub. Needs full rewrite (architecture, credentials, interview walkthrough, setup).


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

---

## 11. Workspace Authorization Pattern (Chunk 4 — Canonical)

### Core Helper: `requireWorkspaceMember`

**File:** `lib/workspace-auth.ts`

Every route handler that touches workspace-owned resources **MUST** call `requireWorkspaceMember()` as its first authorization step after resolving the current user. This is the single, canonical RBAC enforcement point.

```ts
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return apiError("Authentication required.", "UNAUTHORIZED", 401);

  const auth = await requireWorkspaceMember(user.id, params.id, "MEMBER"); // or "VIEWER", "ADMIN", "OWNER"
  if (!auth.authorized) return apiError(auth.message, auth.code, auth.status);

  // auth.role is now safe — proceed with handler logic
}
```

**Security rule:** When a user is not a member of a workspace, the function returns **`status: 404`** (not 403) to avoid leaking workspace existence to non-members. Only ACTIVE-status memberships are authorized.

### Numeric Role Rank Map (`ROLE_RANK`)

```ts
{ VIEWER: 1, MEMBER: 2, ADMIN: 3, OWNER: 4 }
```

### Invite Role Elevation Guard

ADMINs (rank 3) may only invite users up to MEMBER (rank 2). The `POST /api/workspaces/:id/invite` handler enforces that `auth.role === "ADMIN" && invitedRole === "ADMIN"` → 403.

---

## 12. Workspace API Surface (Chunk 4)

| Method | Path                             | Min Role      | Description                                                                                        |
| ------ | -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/workspaces`                | — (auth only) | List all workspaces user is ACTIVE member of, with role and counts                                 |
| `POST` | `/api/workspaces`                | — (auth only) | Create workspace; creator becomes OWNER; logs WORKSPACE_CREATED ActivityEvent                      |
| `GET`  | `/api/workspaces/active`         | — (auth only) | Workspace switcher payload: `{ hasWorkspaces, workspaces[] }`                                      |
| `POST` | `/api/workspaces/:id/invite`     | ADMIN         | Invite by email. Existing user → 201 ACTIVE membership + notification. Unknown email → 202 pending |
| `GET`  | `/api/workspaces/:id/invites`    | VIEWER        | List all workspace members (filterable by `?status=`)                                              |
| `POST` | `/api/workspaces/invites/accept` | — (auth only) | Accept a pending invite; activates INVITED → ACTIVE membership                                     |

### UI Components

- **`components/features/WorkspaceSwitcher.tsx`** — Client component dropdown for switching between workspaces. Fetches from `/api/workspaces/active`. Navigates to `/app/workspace/[slug]`.
- **`components/features/WorkspaceOnboarding.tsx`** — `CreateWorkspaceForm` (reusable) + `WorkspaceOnboarding` (full-page shell). Shown to users with `hasWorkspaces: false`.
- **`app/app/workspaces/new/page.tsx`** — Server page at `/app/workspaces/new` guarded by `getCurrentUser()`.

### Workspace Isolation Test

**File:** `tests/workspace.test.ts` — 8-case isolation suite. Critical assertions:

- Cross-tenant invite attempt → **404** (not 403).
- Cross-tenant member list → **404**.
- ADMIN escalation to ADMIN role → **403**.
- Unauthenticated access → **401**.

---

## 13. Visual Design System & Design Tokens

### Brand & Aesthetic Direction

Syncora's visual personality is **authoritative, calm, and exquisitely precise**:

- **Dark-First Architecture:** Default dark theme utilizes deep obsidian surfaces (`#09090b` / `240 10% 4%`), elevated translucent card panels (`#111116` with glassmorphic backdrop blur), and fine white borders (`rgba(255,255,255,0.08)`).
- **Electric Brand Accent:** Primary brand indigo/violet (`#6366f1` / `239 84% 67%`) with radiant hover and focus glow effects.
- **Dual Light/Dark Engine:** Seamless CSS variable switching through `.dark` and `.light` classes with high-contrast text ratios conforming to WCAG AA.

### Typography Pairing via `next/font`

- **Primary Interface Font:** `Plus Jakarta Sans` (`var(--font-sans)`) — Modern, geometric, editorial sans-serif optimized for crisp rendering at dense spatial scales.
- **Monospace & Numeric Font:** `JetBrains Mono` (`var(--font-mono)`) — Used for project/task keys (e.g. `SYNC-104`), hour estimations, timestamps, and code metadata.

### Border Radius Philosophy

- `rounded-md` (`0.375rem` / 6px): Badges, status pills, tooltip overlays.
- `rounded-lg` (`0.5rem` / 8px): Inputs, buttons, dropdown menu items.
- `rounded-xl` (`0.75rem` / 12px): Cards, dropdown menus, modal panels.
- `rounded-2xl` (`1rem` / 16px): Large dialogs, onboarding containers, page shells.

### Semantic Task Status Tokens (`TaskStatus` Prisma Enum)

Every task status has a dedicated, distinctive semantic color token set (`bg`, `fg`, `border`):

| Prisma `TaskStatus` | Color Family          | Semantic Class Pattern                                                              | Preview                |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| `BACKLOG`           | Slate / Charcoal      | `bg-status-backlog-bg text-status-backlog-fg border-status-backlog-border`          | Muted Gray             |
| `TODO`              | Sky / Cyan            | `bg-status-todo-bg text-status-todo-fg border-status-todo-border`                   | Cool Sky               |
| `IN_PROGRESS`       | Amber / Electric Gold | `bg-status-inprogress-bg text-status-inprogress-fg border-status-inprogress-border` | Vibrant Gold (pulsing) |
| `IN_REVIEW`         | Iris / Purple         | `bg-status-inreview-bg text-status-inreview-fg border-status-inreview-border`       | Royal Purple           |
| `DONE`              | Mint / Emerald        | `bg-status-done-bg text-status-done-fg border-status-done-border`                   | Crisp Emerald          |
| `CANCELLED`         | Muted Rose            | `bg-status-cancelled-bg text-status-cancelled-fg border-status-cancelled-border`    | Soft Crimson           |

### Semantic Task Priority Tokens (`TaskPriority` Prisma Enum)

| Prisma `TaskPriority` | Color Family  | Styling                                     |
| --------------------- | ------------- | ------------------------------------------- |
| `LOW`                 | Zinc / Slate  | Subdued gray badge                          |
| `MEDIUM`              | Blue          | Informational blue badge                    |
| `HIGH`                | Orange        | Warning amber badge                         |
| `URGENT`              | Red / Crimson | Urgent red badge with active pulsing beacon |

---

## 14. Core UI Primitives Catalog (`components/ui/`)

All future chunks **MUST** reuse these standard primitives instead of writing ad hoc markup:

1. **`Button` (`components/ui/button.tsx`)**
   - Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`.
   - Sizes: `sm` (h-8), `md` (h-9), `lg` (h-11), `icon` (h-9 w-9).
   - Features: Built-in `isLoading` SVG spinner, visible focus ring, active micro-scaling.
2. **`Input` (`components/ui/input.tsx`)**
   - Features: `startIcon`, `endIcon`, `error` helper text with icon, accessible `aria-invalid`.
3. **`Select` (`components/ui/select.tsx`)**
   - Features: Accessible custom select with keyboard arrow navigation, Enter selection, Escape dismissal, and checkmark indicators.
4. **`Dialog` (`components/ui/dialog.tsx`)**
   - Subcomponents: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`.
   - Features: Accessible backdrop, Escape dismissal, body scroll locking, focus trap.
5. **`DropdownMenu` (`components/ui/dropdown-menu.tsx`)**
   - Subcomponents: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`.
   - Features: Alignments (`left`, `right`, `center`), destructive item variant, click-outside listener.
6. **`Badge` (`components/ui/badge.tsx`)**
   - Variants: `default`, `secondary`, `outline`, `destructive`, plus `StatusBadge` and `PriorityBadge` convenience helpers with live status dots.
7. **`Avatar` (`components/ui/avatar.tsx`)**
   - Features: Image loading with error fallback, 2-letter uppercase initials extraction, deterministic background hue calculated from user's name.
8. **`Card` (`components/ui/card.tsx`)**
   - Subcomponents: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
   - Features: `glass` prop for translucent backdrop blur.
9. **`Toast` (`components/ui/toast.tsx`)**
   - Features: `ToastProvider`, `useToast` hook (`toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`), stacking viewport, auto-dismiss.
10. **`Skeleton` (`components/ui/skeleton.tsx`)**
    - Features: Pulse animation for loading placeholders.
11. **`Tabs` (`components/ui/tabs.tsx`)**
    - Subcomponents: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
    - Features: Accessible tab selection with keyboard controls.
12. **`Tooltip` (`components/ui/tooltip.tsx`)**
    - Features: Hover/focus triggers, directional sides (`top`, `bottom`, `left`, `right`), configurable delay.
13. **`EmptyState` (`components/ui/empty-state.tsx`)**
    - Features: Centered empty state container with glowing icon container, title, description, and primary/secondary action buttons.

---

## 15. Authenticated App Shell & Navigation Architecture

**Component:** `components/features/app-shell/AppShell.tsx`  
**Route Layout:** `app/app/layout.tsx`

- **Desktop Experience ($\ge 768\text{px}$):**
  - Fixed 256px (`w-64`) glassmorphic sidebar.
  - Brand header with animated glowing emblem.
  - Embedded `WorkspaceSwitcher` for rapid tenant switching.
  - Navigation links (`Dashboard`, `Projects`, `Tasks`, `Search`) with active route highlighting.
  - User footer with `Avatar`, name, email, and accessible `LogoutButton`.
- **Mobile Experience ($< 768\text{px}$):**
  - Sticky top header with brand mark, mobile hamburger trigger, and user avatar.
  - Slide-over drawer with full navigation, workspace switcher, and logout.
  - Fixed bottom navigation bar with 4 quick-tap destinations for thumb-friendly ergonomics (no awkward shrunk sidebar).

---

## 16. Project Management Engine & Settings Reference (Chunk 6)

### Confirmed Schema Enums (Ground Truth from `prisma/schema.prisma`)

```prisma
enum ProjectStatus {
  PLANNING
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}

enum ProjectRole {
  LEAD
  MEMBER
  VIEWER
}

enum ProjectVisibility {
  PUBLIC_TO_WORKSPACE
  PRIVATE
}
```

### Authorization & Private Visibility Enforcement

Every project route handler begins with canonical workspace authorization:

```ts
const auth = await requireWorkspaceMember(user.id, project.workspaceId, "VIEWER");
```

**Security Rules:**

1. **Private Project Visibility:**
   - When `visibility === "PRIVATE"`, non-members receive **`status: 404`** (not 403) on `GET /api/projects/:id` to prevent private project discovery.
   - `GET /api/workspaces/:id/projects` filters projects so workspace peers only see public projects or private projects they belong to (workspace `OWNER` can access all).
2. **Project Mutation & Deletion:**
   - Gated to `callerProjectRole === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"]`.
   - General workspace `MEMBER` or project `VIEWER` attempting `DELETE` receives **403 Forbidden**.
3. **Project Member Management:**
   - `POST /api/projects/:id/members` verifies that the invited user is an active member of the project's parent workspace.
   - Cannot demote or remove the last `LEAD` while other members exist.

### Project API Surface (Chunk 6)

| Method   | Path                                | Min Auth / Role               | Description                                                                                                              |
| -------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/api/workspaces/:id/projects`      | Workspace `MEMBER`+           | Creates project; assigns creator as `LEAD`; checks `[workspaceId, key]` uniqueness; logs `PROJECT_CREATED` ActivityEvent |
| `GET`    | `/api/workspaces/:id/projects`      | Workspace `VIEWER`+           | Lists projects respecting `PRIVATE` visibility; computes task count & progress %                                         |
| `GET`    | `/api/projects/:id`                 | Project member or Public      | Returns full detail, creator, member list, and task counts by status                                                     |
| `PATCH`  | `/api/projects/:id`                 | Project `LEAD` or WS `ADMIN`+ | Updates settings, description, target dates, or status transitions                                                       |
| `DELETE` | `/api/projects/:id`                 | Project `LEAD` or WS `ADMIN`+ | Deletes project and cascades associated records                                                                          |
| `POST`   | `/api/projects/:id/members`         | Project `LEAD` or WS `ADMIN`+ | Adds an active workspace member to the project with initial role                                                         |
| `GET`    | `/api/projects/:id/members`         | Project member or Public      | Lists members of the project                                                                                             |
| `PATCH`  | `/api/projects/:id/members/:userId` | Project `LEAD` or WS `ADMIN`+ | Updates member role (`LEAD`, `MEMBER`, `VIEWER`)                                                                         |
| `DELETE` | `/api/projects/:id/members/:userId` | `LEAD`, WS `ADMIN`+, or Self  | Removes member from project                                                                                              |

### UI Routes & Components

- **`app/app/projects/page.tsx`** — Responsive project cards grid using `Card`, `ProjectStatusBadge`, progress bar, member `Avatar` cluster, and `Dialog` for project creation.
- **`app/app/projects/[id]/page.tsx`** — Project overview, inline status switcher, settings modal, member assignment dialog, and task velocity matrix.
- **`components/providers/QueryProvider.tsx`** — Application-wide TanStack Query client provider.
- **`tests/project.test.ts`** — 15-case security and isolation test suite.

---

## 17. Tasks & Interactive Kanban Architecture (Chunk 7)

### Confirmed Schema Enums (Ground Truth from `prisma/schema.prisma`)

```prisma
enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

### Monotonic Key Derivation & Reordering Philosophy

1. **Monotonic Key Generation:**
   - Every task is automatically assigned an incrementing integer `taskNumber = (lastTask?.taskNumber ?? 0) + 1` scoped per project (`@@unique([projectId, taskNumber])`).
   - Human-readable `taskKey = `${project.key}-${taskNumber}`` (e.g. `SYNC-104`).
2. **Column Spacing & Reordering:**
   - Initial `orderIndex` is spaced by `1000` (`(lastInColumn?.orderIndex ?? 0) + 1000`).
   - Reordering uses fractional midpoints `(prevOrderIndex + nextOrderIndex) / 2` when inserted between cards, or `(firstOrderIndex / 2)` at the top, and `+ 1000` at the bottom.
   - Reorder changes are sent to `PATCH /api/tasks/:id/reorder` which updates both `status` and `orderIndex`, persisting to Postgres and surviving page reload.
3. **Activity Logging:**
   - Tasks generate granular `ActivityEvent` audit logs:
     - `TASK_CREATED` on creation.
     - `STATUS_CHANGED` when transitioning across Kanban columns.
     - `PRIORITY_CHANGED`, `ASSIGNEE_CHANGED`, `DUE_DATE_CHANGED`, `TASK_UPDATED` on field modifications.

### Tasks API Surface

| Method   | Path                         | Min Auth / Boundary            | Description                                                                                           |
| -------- | ---------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/projects/:id/tasks`    | Workspace VIEWER + Proj Member | Lists tasks for project; supports `status`, `priority`, `assigneeId`, `labelId`, and `search` filters |
| `POST`   | `/api/projects/:id/tasks`    | Workspace MEMBER + Proj Member | Creates task with next monotonic `taskKey`, column `orderIndex`, and `TASK_CREATED` event             |
| `GET`    | `/api/tasks/:id`             | Project member or Public       | Retrieves single task detail with assignee, creator, labels, subtasks/comments counts                 |
| `PATCH`  | `/api/tasks/:id`             | Workspace MEMBER + Proj Member | Updates title, description, status, priority, due date, labels; logs specific audit events            |
| `DELETE` | `/api/tasks/:id`             | Creator, Lead, or WS ADMIN+    | Role-gated task deletion                                                                              |
| `PATCH`  | `/api/tasks/:id/reorder`     | Workspace MEMBER + Proj Member | Updates `status` and float `orderIndex` for drag-and-drop reordering; logs `STATUS_CHANGED`           |
| `GET`    | `/api/workspaces/:id/labels` | Workspace VIEWER+              | Lists workspace labels                                                                                |
| `POST`   | `/api/workspaces/:id/labels` | Workspace MEMBER+              | Creates custom workspace label with name and color hex                                                |

### Components & Routes

- **`components/features/tasks/TaskCard.tsx`** — Draggable card with `@dnd-kit/sortable`, displaying monospace `taskKey`, `PriorityBadge`, title, description snippet, colored label chips, overdue badge (`due < now`), subtask/comment indicators, and assignee `Avatar`.
- **`components/features/tasks/KanbanColumn.tsx`** — Droppable container with `@dnd-kit/sortable` (`SortableContext`, `verticalListSortingStrategy`), count pill, quick "+ Add Task" button, and internal scrolling for 100+ tasks.
- **`components/features/tasks/CreateTaskDialog.tsx`** — Fast modal dialog to create tasks with title, description, status, priority, project member assignee, due date, estimated hours, and workspace labels.
- **`app/app/projects/[id]/board/page.tsx`** — Interactive Kanban workspace using `@dnd-kit/core` with `DndContext`, `DragOverlay`, `PointerSensor` (5px threshold), live column drag over, search bar, priority filter, assignee filter, and optimistic TanStack Query cache updates.
- **`app/app/tasks/page.tsx`** — Tasks & Kanban hub with project progress summaries and direct links to project Kanban boards.
- **`tests/task.test.ts`** — 10 integration and security tests for tasks, reordering, label attachments, and tenant isolation.

---

## 18. Focused Task Workspace, Comments & Collaborative Activity (Chunk 8)

### Subtask Hierarchy Architectural Decision

- **Explicit Choice: Option A (Interactive Checklist)**
- `Task.parentId` is surfaced minimally as an interactive checklist within the task detail view (`/app/tasks/[id]`), providing:
  1. Subtask checklist with instant status toggle (`TODO` <-> `DONE`).
  2. Monotonic child key allocation (`${project.key}-${taskNumber}`) with `parentId` referencing the active task.
  3. Inline quick creation without polluting high-level board columns with nested trees.

### ActivityAction Enum & Commenting Audit Rules

- `ActivityAction.COMMENT_ADDED` was confirmed already present in the schema enum.
- Every comment creation automatically records an `ActivityEvent` (`action: "COMMENT_ADDED"`, metadata `{ taskKey, commentId, isReply }`).
- Activity descriptions are converted into human-readable sentences (`[Actor] moved status from [old] to [new]`, `[Actor] changed priority to [new]`, etc.) — never raw JSON diffs.

### API Surface (Chunk 8)

| Method   | Path                         | Min Auth / Role                | Description                                                                        |
| -------- | ---------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `GET`    | `/api/tasks/:id/comments`    | Workspace VIEWER + Proj Member | Lists comments in chronological order with author details                          |
| `POST`   | `/api/tasks/:id/comments`    | Workspace MEMBER + Proj Member | Posts root comment or threaded reply; writes `COMMENT_ADDED` ActivityEvent         |
| `DELETE` | `/api/comments/:id`          | Author, LEAD, or WS ADMIN+     | Role-gated comment deletion; unauthorized members receive **403 Forbidden**        |
| `POST`   | `/api/tasks/:id/subtasks`    | Workspace MEMBER + Proj Member | Creates child subtask under parent; allocates project monotonic key                |
| `GET`    | `/api/tasks/:id/activity`    | Workspace VIEWER + Proj Member | Returns chronological activity history for the task with actor details             |
| `GET`    | `/api/projects/:id/activity` | Workspace VIEWER + Proj Member | Returns aggregated recent activities across the whole project with task references |

### UI Components & Routes (Chunk 8)

- **`app/app/tasks/[id]/page.tsx`** — Focused task detail workspace supporting deep-linking on cold loads, inline title editing, markdown description with Write/Preview tabs, subtask checklist, threaded comments, human-readable activity timeline, and properties sidebar.
- **`components/features/tasks/TaskSubtasks.tsx`** — Interactive subtask checklist with completion ratios, instant status toggles, and inline quick-add input.
- **`components/features/tasks/TaskComments.tsx`** — Threaded comments feed with author avatars, relative timestamps, reply affordances, and role-gated deletion.
- **`components/features/tasks/TaskActivityFeed.tsx`** — Human-readable activity history with conversational status and priority translations.
- **`app/app/projects/[id]/page.tsx`** — Added "Project Activity Timeline" card aggregating actions across all project tasks.
- **`tests/comment-activity.test.ts`** — 12-case integration security suite verifying comments, threaded replies, role-gated deletion, activity logging, subtasks, and cross-tenant isolation.

---

## 19. Command Center Dashboard (Chunk 9)

### Architecture & Caching Strategy

The main dashboard (`/app` and `/app/dashboard`) serves as the single most critical screen in the product — an actionable command center built on real queries rather than placeholders.
Each section on the dashboard is decoupled into independent React Query (`@tanstack/react-query`) client components with their own query keys (`["dashboard", workspaceId, section]`), ensuring fast partial-rendering with skeleton fallbacks rather than a monolithic blocking fetch:

1. **`DashboardStatsBar`** — 4 high-level metric cards: My Active Tasks, Overdue Tasks, Active Projects, and At-Risk Projects.
2. **`MyTasksSection`** — Tasks assigned to current user across all projects in the active workspace. Supports sorting by Priority (`URGENT` → `LOW`) or Due Date (soonest first), and grouping by Priority or Due Date with distinct overdue styling and empty states.
3. **`ProjectsSection`** — Workspace projects grid with status badge, progress percentage bar, task status pills, member avatar cluster, and at-risk badge indicator.
4. **`UpcomingSection`** — Dual-tab / dual-list timeline showing tasks due within the next 7 days (soonest first) and tasks recently marked `DONE` or `CANCELLED` within the past 7 days.
5. **`ActivitySection`** — Workspace-wide activity feed displaying the 40 most recent `ActivityEvents` with actor avatars, human-friendly action descriptions, and relative time stamps.

### Placeholder At-Risk Heuristic & Chunk 15 Interface Note

```typescript
// Current placeholder heuristic in GET /api/dashboard/:workspaceId/projects:
const isAtRisk =
  totalTasks > 0 &&
  (overdueCount / totalTasks > 0.25 ||
    (doneCount === 0 && daysUntilTarget !== null && daysUntilTarget <= 7));
```

> **TODO(Chunk 15 — Project Health Scoring):** This rule is an explicitly documented placeholder. In Chunk 15, it will be superseded by the full Project Health Scoring engine factoring in velocity momentum, overdue volume, blocked task dwell times, and scope-creep drift into a composite 0–100 health score with explanation drivers.

### API Surface (Chunk 9)

| Method | Path                                   | Min Auth / Role   | Description                                                                                                    |
| ------ | -------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/dashboard/:workspaceId/my-tasks` | Workspace VIEWER+ | Returns up to 50 active tasks assigned to the caller, sorted overdue first, then by priority/due date          |
| `GET`  | `/api/dashboard/:workspaceId/projects` | Workspace VIEWER+ | Returns active projects with task status breakdowns, progress percentage, overdue counts, and at-risk flags    |
| `GET`  | `/api/dashboard/:workspaceId/activity` | Workspace VIEWER+ | Workspace-wide audit stream (up to 40 events) with actor profiles, project tags, and human-readable formatting |
| `GET`  | `/api/dashboard/:workspaceId/upcoming` | Workspace VIEWER+ | Returns two lists: upcoming tasks due in next 7 days and recently completed/cancelled tasks in past 7 days     |

### Verification & Testing

- **`tests/dashboard.test.ts`** — 21 integration tests verifying:
  - Auth guards (401 unauthenticated across all 4 endpoints)
  - Cross-tenant isolation (404 for non-members, preventing resource discovery)
  - My Tasks overdue prioritization and project attribution
  - Project progress calculations and at-risk heuristic triggers
  - 7-day upcoming deadline filtering and overdue exclusion
  - Workspace-wide activity feed ordering and actor resolution
- **Full Suite Status:** 9 test files, 88 tests passing. Clean TypeScript (`tsc --noEmit`), formatted via Prettier.

---

## 20. Real-Time Notifications & Cross-User Alerts (Chunk 10)

- **Purpose & Scope:** Real-time event notifications for task assignments, status changes, comments, and mentions.
- **Architecture:** Polling-based notification drawer in the top navigation bar with unread counters and granular mark-as-read/mark-all-as-read capabilities.
- **Isolation:** Strict per-user scoping ensures users only see notifications triggered for or directed at their own account.
- **Testing:** `tests/notification.test.ts` (8 integration tests verifying delivery, read state mutations, and multi-tenant user isolation).

---

## 21. Multi-Tenant Private Project Isolation & Search Engine (Chunk 11)

- **Purpose & Scope:** Universal command-palette search (`Cmd+K` / `Ctrl+K`) and dedicated search page (`/app/search`) indexing projects, tasks, and comments across workspaces.
- **Security Boundary:** Project visibility model (`PUBLIC_TO_WORKSPACE` vs `PRIVATE`). Private projects and their child tasks/comments are completely hidden from search queries executed by workspace members who are not explicit project members.
- **Testing:** `tests/search.test.ts` (41 tests covering exact match, prefix match, typo tolerance, task status/priority filters, and rigorous negative isolation assertions).

---

## 22. Workspace AI Assistant & Grounded Operational Intelligence (Chunk 12 & 16)

- **Purpose & Scope:** Natural-language conversational copilot embedded in workspace command center (`/app`) providing contextual intelligence on active projects, blocker analysis, task status distribution, and teammate workload.
- **Grounding Architecture:** Grounded strictly in real-time Postgres workspace data. Prompts dynamically extract relevant project summaries, overdue tasks, and workload distributions without cross-tenant hallucination.
- **Rate Limiting:** Sliding-window rate limiter restricting users to 15 requests per 60 seconds per user, returning HTTP 429 when exceeded.
- **UI Bugs Discovered & Resolved:**
  1. *Markdown Rendering Bug:* AI responses were originally displayed as raw markdown text with visible `###` and `**bold**` syntax. Resolved by integrating `react-markdown` with bespoke typography and slate color tokens.
  2. *Scroll Jump Bug:* Triggering assistant expansion or sending a prompt caused unexpected viewport scroll jumps down to the Active Projects section. Resolved by removing disruptive `autoFocus` DOM shifts, adding explicit `type="button"` attributes to all non-form trigger elements, and preventing scroll-into-view behavior during state transitions.
- **Testing:** `tests/ai-assistant.test.ts` (7 tests verifying context grounding, workspace isolation, rate limiting threshold enforcement, and HTTP 429 response codes).

---

## 23. Dedicated Responsive & Accessibility Hardening Pass (Chunk 14)

- **Mobile Kanban Architecture:** Replaced horizontal drag-and-drop on mobile screens (< 768px) with stacked, collapsible accordion columns and an inline per-card status `<select>` dropdown, enabling seamless task progression on touch devices without gesture conflicts.
- **Panel & Modal Ergonomics:** Optimized all dialogs, drawers, and the AI assistant panel across 375px (mobile), 768px (tablet), and 1280px+ (desktop) viewports. Ensured zero horizontal overflow, thumb-accessible hit targets (min 44px), and proper keyboard accessibility (`focus-visible` rings).
- **Accessibility:** Added full ARIA labels, live regions, accessible modal dialog descriptions, and keyboard shortcuts (`Enter`/`Space`) for all interactive card elements.

---

## 24. Project Health Scoring & Operational Risk Engine (Chunk 15)

- **Algorithm Design:** Replaced placeholder at-risk flags with an analytical 0–100 multi-vector scoring algorithm evaluating:
  1. *Overdue Burden (35% weight):* Ratio of overdue tasks to total active tasks, with a dedicated crisis penalty for 100% overdue projects.
  2. *Workload Distribution (25% weight):* Gini-style concentration metric detecting whether a single contributor holds > 50% of active tasks.
  3. *Velocity Momentum (25% weight):* 14-day completion cadence compared against active task volume.
  4. *Activity Freshness (15% weight):* Days elapsed since the most recent task creation, status transition, or comment.
- **Status Classification:**
  - `ON_TRACK` (80–100): Healthy pace, low overdue ratio, balanced delegation.
  - `NEEDS_ATTENTION` (50–79): Moderate overdue burden or emerging workload bottleneck.
  - `AT_RISK` (0–49): Severe overdue backlog, stale project activity, or extreme workload concentration.
- **Boundary Handling:** Correctly handles projects with 0 tasks (defaults to neutral 80 ON_TRACK), all completed tasks (100 ON_TRACK), perfectly even distribution across assignees, and 100% overdue crises (drops score to AT_RISK with explicit urgent driver explanations).
- **Testing:** `tests/project-health.test.ts` (10 tests validating mathematical formulas, driver text explanations, and boundary edge cases).

---

## 25. Comprehensive Quality Assurance, Test Hardening & Past Bug Audit (Chunk 17)

### Test Database Isolation (`syncora_test`)

- **Problem Addressed:** Previously, running tests locally risked modifying, wiping, or polluting the development database (`syncora`) containing realistic demo seed data.
- **Solution:** Configured strict test database isolation:
  - Dedicated Postgres database: `syncora_test` running locally alongside `syncora`.
  - Dedicated environment file: `.env.test` pointing `DATABASE_URL` and `DIRECT_URL` to `syncora_test`.
  - Vitest test runner configuration: `vitest.config.ts` injects `test.env` mapping to `syncora_test` and restricts test discovery to `tests/**/*.test.ts` (excluding E2E specs).
  - Automated preparation script: `scripts/setup-test-db.ts` (`npm run db:test:prepare`) creates `syncora_test` if missing, deploys migrations, and runs clean seed fixtures.
  - Guarantees that local developer and demo workflows in `syncora` are never corrupted by integration test suites.

### Integration Test Additions (160 Vitest Tests Passing)

1. **Comment Permissions (`tests/comment-activity.test.ts`):**
   - Verified that workspace `VIEWER` cannot post comments (returns 403 `INSUFFICIENT_ROLE`).
   - Verified that `VIEWER` cannot delete comments authored by other users (returns 403).
   - Verified that outside users cannot delete comments (returns 404).
   - Verified comment validation rules (empty string rejection 422, non-existent parent comment ID 400).
2. **Project Health Scoring Edge Cases (`tests/project-health.test.ts`):**
   - Zero active tasks: returns 80 (`ON_TRACK`) with "No active tasks in project" driver.
   - 100% overdue boundary: triggers overdue crisis penalty reducing score to `AT_RISK` (15/100).
   - Perfectly even workload across multiple assignees: scores full 25/25 for workload balance.
   - Unassigned workload distribution: avoids false concentration penalties when tasks have no assignees.
   - 100% completed tasks: awards 100/100 (`ON_TRACK`).
3. **AI Assistant Rate Limiting (`tests/ai-assistant.test.ts`):**
   - Verified sliding-window rate limit logic (`checkAiRateLimit`).
   - Verified that the 16th prompt in a 60-second window receives HTTP 429 (`TOO_MANY_REQUESTS`).

### End-to-End Test Suite (Playwright - 5 Tests Passing)

Implemented end-to-end browser tests using local Google Chrome (`channel: "chrome"` in `playwright.config.ts`):
1. **`e2e/smoke.spec.ts`:**
   - Health check endpoint verification (`/api/health` returns 200).
   - Unauthenticated entry point rendering (`/login` loads with brand layout and inputs).
2. **`e2e/negative-security.spec.ts`:**
   - Unauthenticated redirect: accessing protected `/app` redirects to `/login?redirect=%2Fapp`.
   - Cross-workspace search isolation: User in Workspace A searching for unique project keys or tasks in Workspace B receives zero results.
3. **`e2e/critical-journey.spec.ts`:**
   - Full critical user flow executed end-to-end:
     1. User registration (`/register`)
     2. Workspace creation (`/app/workspaces/new`)
     3. Project initialization (`/app/projects`)
     4. Direct board navigation (`/app/projects/:id/board`)
     5. Task creation via modal dialog with assignee selection
     6. Navigation to task detail view (`/app/tasks/:id`)
     7. Status transition to `IN_PROGRESS`
     8. Collaborative threaded comment posting
     9. Return to Dashboard (`/app`) confirming task reflection in command center

### Test Suite Execution Scripts (`package.json`)

- `npm test` — Runs Vitest integration suite (160 tests, ~3.8s).
- `npm run test:e2e` — Runs Playwright browser suite (5 tests, ~13.7s).
- `npm run test:all` — Runs Vitest suite followed by Playwright suite (~17.5s total).
- `npm run db:test:prepare` — Prepares isolated `syncora_test` database.

---

### Honest Audit: Why Past Bugs Slipped Past Previous API Tests

During development, several user-facing bugs occurred despite passing test suites. The following audit details the exact technical reasons why each bug existed and why previous tests failed to detect it:

| Past Bug / Symptom | Root Cause | Why API Integration Tests Missed It | How It Is Now Prevented |
| :--- | :--- | :--- | :--- |
| **Assignee Dropdown "Invalid assignee ID" Validation Error** | HTML `<select>` elements send empty string `""` for the default "Unassigned" option. On the server, Zod validated `assigneeId: z.string().uuid()`. Empty string failed UUID parsing with HTTP 422. | API tests constructed request payloads directly in JavaScript (`{ assigneeId: user.id }` or `{ assigneeId: null }`), never passing `""` like a real browser form. | 1. Server schemas now use `.nullish()` and normalize `""` to `null`.<br>2. Playwright E2E fills real browser forms and selects options natively. |
| **Cross-User Notification Cache Leak** | When User A logged out and User B logged in within the same browser session, User B briefly saw User A's cached notifications. | API tests authenticated isolated HTTP requests using clean headers/cookies without persistent client memory. They correctly proved backend isolation, but could not test browser memory. | Client-side TanStack Query keys are now scoped to the authenticated user ID and explicitly cleared (`queryClient.clear()`) upon logout/session change. |
| **AI Assistant Scroll-Jump Bug** | Clicking "Open Assistant" or pressing Enter scrolled the viewport down to the Active Projects section. | The bug was caused by browser layout shifts: expanding the assistant panel changed dashboard height, and DOM focus operations caused native browser scroll-into-view. Node HTTP tests have no layout engine or viewport. | 1. Removed disruptive `autoFocus` triggers.<br>2. Replaced form submits with explicit `type="button"`.<br>3. Playwright browser tests run with real viewports and scroll tracking. |
| **Private Project Search Leakage** | Non-members could see private project search results when global search queries lacked workspace tenancy filters. | Unit tests tested search logic with isolated mock arrays or synthetic fixtures where only one tenant existed in the mock database table. | Integration tests now populate multi-tenant fixtures in `syncora_test` and explicitly assert zero matches across tenant boundaries. |
| **Markdown Syntax Printed as Raw Text** | AI assistant responses displayed raw `###` and `**bold**` plain text. | API tests asserted on the JSON response payload (`res.body.content.length > 0`), which correctly contains markdown text. The failure was purely a presentation layer omission in React JSX. | Component now uses `react-markdown` with strict typography styling, verified via visual and browser inspections. |

---

## 26. Visual Design System Polish, Elevation System & Micro-Interactions (Chunk 18)

### Theming Implementation Audit

- **Approach Found:** Syncora strictly follows the **shadcn-style semantic HSL CSS variable token system** declared in `app/globals.css` (e.g., `--background`, `--card`, `--primary`, `--border`, `--muted-foreground`) mapped to Tailwind utilities in `tailwind.config.ts` (`bg-background`, `bg-card`, `border-border`, etc.). Spacing and layout follow Tailwind core utility scales (`p-4`, `gap-3.5`).
- **Architectural Policy:** Rather than introducing ad-hoc arbitrary hex codes or mixing divergent patterns, all visual polish work was executed by extending the semantic token layer in `tailwind.config.ts` and `app/globals.css`, ensuring full cross-screen consistency and automated light/dark theme scalability.

### Design System Decisions & Deliverables

1. **4-Level Surface & Elevation System:**
   - **Canvas / Background (`surface-base`):** `240 10% 3.6%` — Deep, neutral base canvas.
   - **Navigation / App Shell (`surface-sidebar`):** `240 9% 5.8%` — Distinct intermediate surface for the left navigation rail, with subtle right border and backdrop blur.
   - **Card / Primary Container (`surface-card` / `card`):** `240 8% 8.5%` — Standard elevation for dashboard KPI widgets, project cards, health score cards, and search filters.
   - **Nested / Interactive Surface (`surface-nested`):** `240 7% 11.8%` — Explicit step-up surface for task rows, vector metric sub-blocks, and Kanban cards.
   - **Hover / Active Surface (`surface-hover`):** `240 7% 14.5%` — Interactive feedback state.
   - **Elevation Shadows:** Replaced purely 1px border separation with layered shadow tokens:
     - `shadow-subtle`: `0 1px 4px -1px rgba(0, 0, 0, 0.3)`
     - `shadow-card`: `0 2px 8px -2px rgba(0, 0, 0, 0.4), 0 1px 3px -1px rgba(0, 0, 0, 0.2)`
     - `shadow-card-hover`: `0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px -2px rgba(0, 0, 0, 0.3)`

2. **Refined Typography Scale & Hierarchy:**
   - **Hero Stat Numerals:** `font-mono text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums` (applied to the Project Health Score `100/100` and Dashboard KPI summary bars).
   - **Section Headers:** `text-sm font-semibold tracking-tight text-foreground`.
   - **Subsection Labels & Column Headers:** `text-xs font-semibold uppercase tracking-wider text-muted-foreground`.
   - **Task Identifiers & Metadata:** `font-mono text-[11px] font-semibold tracking-wider text-muted-foreground/80` (with hover transitions to `text-primary`).

3. **Subtle Micro-Motion & Interactive Transitions:**
   - Standardized fast, understated transitions: `transition-all duration-150 ease-out`.
   - Applied smooth `-translate-y-0.5` vertical lift with `shadow-card-hover` on interactive cards (Dashboard projects, My Tasks rows, Projects list, Kanban task cards, Search result rows).
   - Sidebar navigation links and header buttons utilize smooth 150ms background transitions.

4. **Label & Status Pill Visual De-Noising:**
   - **Status & Priority Badges:** Preserved at full, crisp saturation (`To Do`, `In Progress`, `Done`, `High`, `Urgent`, etc.) to carry immediate operational signal.
   - **Category & Feature Labels:** Muted to a lower-contrast, neutral pill treatment (`border border-border/40 bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground`) accented by a discrete 75%-opacity color indicator dot (`1.5px`), eliminating visual competition and cognitive noise.

5. **Kanban Horizontal Scroll Edge-Fade:**
   - Enhanced dynamic gradient masks (`w-14 bg-gradient-to-r from-background via-background/80 to-transparent` and `bg-gradient-to-l`) tracked via `ResizeObserver` on the Kanban scroll container, providing clear visual affordance when columns extend beyond the active viewport.

