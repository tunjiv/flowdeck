# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FlowDeck — a productivity app (goals, tasks, habits, focus sessions, mood logs). A **pnpm-workspaces monorepo** (Node 24, TypeScript 5.9). `pnpm` is mandatory (the root `preinstall` script aborts other package managers).

Workspace layout:
- `artifacts/flowdeck` — web app (React 19, Vite, Tailwind v4, shadcn/ui, Wouter routing, TanStack Query, Clerk auth)
- `artifacts/api-server` — Express 5 API (`@workspace/api-server`)
- `artifacts/flowdeck-mobile` — Expo / React Native app (Clerk Expo)
- `lib/api-spec` — **OpenAPI 3.0 spec (`openapi.yaml`) is the source of truth for the API contract**
- `lib/api-client-react` — generated React Query hooks + `custom-fetch.ts` (auth-token bridge)
- `lib/api-zod` — generated Zod validators used by the server
- `lib/db` — Drizzle ORM schema + the `pg` Pool (`@workspace/db`)
- `scripts` — one-off TS scripts

## Critical platform constraint

`pnpm-workspace.yaml` **strips every non-Linux native binary** (esbuild, rollup, lightningcss, `@tailwindcss/oxide`, etc.) via `overrides`, because Replit/Vercel run **Linux x64**. Consequences:
- **The frontend/API builds (Vite, esbuild) only run on Linux x64.** On macOS/Windows they fail by design. Validate locally with `tsc` typechecks instead, and let the real build happen on Vercel (or in CI/Replit).
- `minimumReleaseAge: 1440` enforces a 1-day supply-chain delay on newly published packages during install.
- `pnpm install` needs Unix `sh`/`rm` on PATH (the `preinstall` script). On Windows, add Git's `usr/bin` to PATH.

## Common commands

```bash
pnpm install                                   # install (pnpm only)
pnpm run typecheck                             # tsc --build for libs, then artifacts/scripts — the main local check
pnpm run build                                 # typecheck + recursive build (Linux only)

pnpm --filter @workspace/api-spec run codegen  # regenerate hooks + Zod from openapi.yaml (run after ANY spec change)
pnpm --filter @workspace/db run push           # apply lib/db schema to DATABASE_URL (drizzle-kit push); push-force = non-interactive

pnpm --filter @workspace/flowdeck run dev      # web dev server (Vite)
pnpm --filter @workspace/api-server run dev    # API dev (esbuild-bundles to dist/, runs on $PORT)
```

Do **not** run `pnpm dev` at the workspace root — individual artifacts expect `PORT`/`BASE_PATH` wired by the workflow; start them with `--filter` as above. There is no test runner configured.

## Architecture

**Contract-first API.** `lib/api-spec/openapi.yaml` is authoritative. `pnpm --filter @workspace/api-spec run codegen` (Orval) regenerates both `lib/api-client-react/src/generated/api.ts` (React Query hooks the web app calls) and `lib/api-zod/src/generated/` (Zod schemas the server validates with). Editing routes means editing the spec, running codegen, then implementing the route in `artifacts/api-server/src/routes/` and the UI against the new hook — never hand-edit generated files.

**Auth is Clerk on both ends.**
- Web: `@clerk/react` is an alias to `@clerk/clerk-react@5.61.3` (core-2; required because React is pinned to exactly `19.1.0`). `ClerkProvider` is in `src/main.tsx`; `src/App.tsx` derives auth state from Clerk and renders `<SignIn>/<SignUp>`. An `ApiAuthBridge` calls `setAuthTokenGetter(() => getToken())` so every request from the generated client carries the Clerk session JWT (see `lib/api-client-react/src/custom-fetch.ts`, which attaches `Authorization: Bearer`).
- Server: `clerkMiddleware()` from `@clerk/express` is mounted in `artifacts/api-server/src/app.ts`; `src/middlewares/requireAuth.ts` reads `getAuth(req).userId` and exposes it via `getUserId(req)`.
- Sensitive Clerk actions (enable 2FA/TOTP, set password, revoke session) require **step-up reverification** — wrap them in `useReverification` or they fail with "additional verification required".

**Data model.** Drizzle tables in `lib/db/src/schema/*` are all user-scoped by a `user_id` text column holding the Clerk user id; `serial` integer PKs; relations are plain integer columns (no DB-level foreign keys). The DB connects via a `pg` Pool on `DATABASE_URL` (`lib/db/src/index.ts`).

**Request path:** web hook → `/api/*` → (on Vercel) the `api/index.ts` serverless function → Express app → `requireAuth` → Drizzle/Neon.

## Vercel deployment (non-obvious)

Driven by `vercel.json`. Several pieces must stay in sync:
- `buildCommand` builds the **api-server esbuild bundle first**, then the frontend. The serverless function `api/index.ts` imports the prebuilt `artifacts/api-server/dist/app.mjs` — NOT the TS source. This is required because the api-server source uses bundler-style extensionless imports that don't resolve under raw Node ESM. `build.mjs` includes `src/app.ts` as an esbuild entry (it exports the Express `app` without calling `listen`).
- `api/package.json` (`{"type":"module"}`) and `api/tsconfig.json` (`esModuleInterop`, `noEmitOnError: false`) make `@vercel/node` compile the function correctly.
- The Vercel **project settings** must be **Framework Preset = Other** and **Root Directory = repo root**. Vercel tends to auto-misdetect this as an Express app rooted at `artifacts/api-server`, which breaks the build.
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY` (the `VITE_`-prefixed one is baked in at **build** time, so it must be set before the build runs).
