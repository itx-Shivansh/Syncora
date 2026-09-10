# Syncora

> **Keep work in sync.**

Syncora is a premium full-stack project-management and operational-intelligence platform designed for modern product, engineering, and design teams. Engineered with Next.js 14 App Router, TypeScript, Prisma, and PostgreSQL, Syncora combines high-velocity task execution with executive-level clarity through project health scoring, team workload intelligence, and grounded AI workspace assistance.

## Demo login

Use the pre-seeded recruiter demo account to explore the product immediately:

- Email: `demo@syncora.app`
- Password: `SyncoraDemo!2026`

The login page includes a "Use demo" shortcut so a reviewer can sign in instantly without setting up any workspace or tasks.

## Production deployment

Live app: [https://syncora-sr-codez.vercel.app](https://syncora-sr-codez.vercel.app)

Syncora is deployed as a Next.js App Router application on Vercel, with Vercel Git integration connected to `itx-Shivansh/Syncora` on GitHub. Production serverless route handlers use Prisma against a Vercel Marketplace-provisioned Neon PostgreSQL database. Prisma migrations are applied with `prisma migrate deploy`, and the production Neon database is seeded with the documented demo account. Vercel Production, Preview, and Development environments include the pooled `DATABASE_URL`; `DIRECT_URL` is configured with Neon’s non-pooling connection for migration workflows; and each environment has a dedicated `JWT_SECRET`.

## Reviewer first impression after login

After signing in, a reviewer lands directly in a polished Acme workspace dashboard that already feels complete: the command center shows live project health cards, an at-risk launch recovery sprint, workload concentration signals, a populated activity timeline, and unread notifications waiting for the demo user. The AI assistant is already grounded in real workspace data, the projects glow with meaningful labels and due-date pressure, and the dashboard reads like a real operating view rather than a blank starter template.

## Development

- Install dependencies: `npm install`
- Run the app locally: `npm run dev`
- Reset and reseed demo data: `npm run db:seed`
- Run the test suite: `npm test`

---

This repo contains the full application and the seeded demo dataset used to showcase the platform's end-to-end workflow.
