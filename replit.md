# FlowDeck

A full-stack productivity web app — goals, habits, tasks, focus timer, mood logging, and a unified daily dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/flowdeck run dev` — run the frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages (run `typecheck:libs` first if DB types are stale)
- `pnpm run typecheck:libs` — build composite libs (db, api-spec, api-client-react, api-zod)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Wouter (routing) + TanStack Query
- Auth: Clerk (`@clerk/react` + `@clerk/express`)
- API: Express 5 (port 8080, path prefix `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

```
artifacts/
  api-server/src/
    app.ts              — Express app, Clerk middleware, CORS
    routes/             — One file per resource: categories, goals, tasks, habits,
                          moodLogs, focusSessions, tags, dashboard
    middlewares/
      requireAuth.ts    — Extracts Clerk userId from session
      clerkProxyMiddleware.ts — Proxies Clerk calls through /api/__clerk
  flowdeck/src/
    App.tsx             — ClerkProvider, Wouter router, QueryClientProvider
    pages/              — Dashboard, Goals, GoalDetail, Tasks, Habits, HabitDetail,
                          Categories, Focus, Settings, LandingPage
    components/         — Layout (sidebar nav)
    lib/queryClient.ts  — TanStack Query client

lib/
  db/src/schema/        — Drizzle ORM tables: categories, goals, tasks, habits,
                          habitLogs, moodLogs, focusSessions, tags
  api-spec/             — OpenAPI spec (source of truth for API contract)
  api-client-react/     — Generated React Query hooks + custom-fetch.ts
  api-zod/              — Generated Zod validators (used by API server)
```

## Architecture decisions

- **Contract-first API**: OpenAPI spec in `lib/api-spec` drives code generation for both the React client (hooks) and server (Zod validators). Run codegen after any spec change.
- **Clerk auth proxy**: Clerk JS calls are proxied through `/api/__clerk` so the same domain is used for both auth and API — avoids third-party cookie issues.
- **Auth token via setAuthTokenGetter**: `ClerkQueryClientCacheInvalidator` in App.tsx registers `useAuth().getToken` so every API call includes a Bearer token.
- **userId injected server-side**: The `requireAuth` middleware reads the Clerk session and injects `userId`; frontend payloads never include it.
- **Composite libs, leaf artifacts**: `lib/*` packages emit declarations via `tsc --build`; artifact packages use `--noEmit`. Always run `typecheck:libs` before `typecheck` when DB schema or API spec changes.

## Product

- **Dashboard** — daily summary: habits done today, tasks due, active goals, focus time, mood prompt
- **Goals** — quantitative / milestone / habit goals with progress bars; drill-in to linked tasks and habit logs
- **Tasks** — per-goal to-do lists with priority, due date, subtask support
- **Habits** — daily habit tracker with streak calculation and log calendar
- **Focus** — Pomodoro-style timer (25/5 + long break); saves sessions to DB; links to a task
- **Mood** — daily mood log (1–5 scale) with optional notes
- **Categories** — color-coded buckets shared across goals and tasks
- **Tags** — free-form labels for cross-cutting organization

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/db/src/schema/**`, run `pnpm --filter @workspace/db run push` (dev) then `pnpm run typecheck:libs`.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck`.
- Do **not** run `pnpm dev` at workspace root — use individual workflow restarts.
- The `dist/index.mjs` bundle is ~2.6 MB (pino + drizzle + clerk). This is expected; no splitting needed for a server bundle.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB schema source of truth: `lib/db/src/schema/`
- API contract source of truth: `lib/api-spec/openapi.yaml`
- Teal theme: primary `hsl(189, 88%, 28%)` — defined in `artifacts/flowdeck/src/index.css`
