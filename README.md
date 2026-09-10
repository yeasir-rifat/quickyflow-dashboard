# Quickyflow Dashboard

A React + Vite SaaS dashboard for the Quickyflow Timer Chrome extension.
Talks directly to Supabase (PostgREST + GoTrue) for everything a logged-in
user is allowed to see, and to a small set of Vercel serverless functions
(under `/api`) for anything that requires elevated privilege — creating
employees, changing roles, removing accounts.

## Roles

- **admin** — full visibility (team overview, all activity, all
  screenshots) and the only role that can create/edit/remove people via
  the **Employees** page.
- **assistant_admin** — can view every employee's activity logs and
  screenshots (read-only), but cannot manage users. No Employees page.
- **employee** — sees only their own time (`My Time`), their own
  activity log, and their own screenshots.

Role is read from the `profiles` table after login (see `database.sql`).
`profiles` is the single "employees" table referenced throughout the
app's requirements — every authenticated user has exactly one row here,
whatever their role, keyed by their Supabase Auth UUID.

## Architecture at a glance

```
Browser (dashboard)
   │
   ├─ anon key ──► Supabase PostgREST / GoTrue / Storage
   │                (every read, and the client's own writes —
   │                 RLS enforces who can see/touch what)
   │
   └─ own session token ──► /api/admin-* (Vercel serverless)
                              │
                              └─ service-role key ──► Supabase Admin API
                                 (create/delete auth users, force-patch
                                  a role — bypasses RLS on purpose,
                                  ONLY reachable after re-verifying the
                                  caller is an admin server-side)
```

The service-role key is never sent to the browser. It lives only in the
Vercel project's environment variables and is read only inside
`/api/*.js`.

## Setup

### 1. Database

Run the whole of `database.sql` in the Supabase SQL Editor (SQL Editor →
New query → paste → Run). It's idempotent — safe to re-run any time,
including against a project that already has the older admin/employee-
only version of this schema (it widens the role constraint and RLS
policies without touching existing data).

This creates: `profiles`, `work_sessions`, `activity_logs`,
`screenshots`, all RLS policies for all three roles, the auto-profile
trigger, the duration-clamping triggers (stop employees from inflating
hours via direct PATCH calls), and the private `screenshots` storage
bucket + its policies.

### 2. Environment variables

**Client-side (`.env` locally, or Vercel Project Settings → Environment
Variables):**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Copy `.env.example` → `.env` to get started locally.

**Server-side only (Vercel Project Settings → Environment Variables —
do NOT prefix these with `VITE_`, or they'd be bundled into the
browser build):**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

Find all three under Supabase Dashboard → Project Settings → API.
`SUPABASE_URL` and `SUPABASE_ANON_KEY` are the same values as the
`VITE_`-prefixed ones above — Vercel just needs them under both names
since the `/api` functions and the browser build read environment
variables separately.

### 3. Install & run locally

```bash
npm install
npm run dev
```

The `/api` functions won't run under plain `vite dev` (they need
Vercel's dev server). To test them locally too:

```bash
npm i -g vercel
vercel dev
```

### 4. Deploy

```bash
vercel
```

Or connect the repo in the Vercel dashboard. Either way, add all five
environment variables above under Project Settings → Environment
Variables before your first real deploy.

## Creating the first admin user

1. Sign up once through the dashboard's login screen with a real email
   — wait, there's no public sign-up form by design (only an admin
   creates accounts). For the very first user, either:
   - Create them in Supabase Dashboard → Authentication → Users → Add
     user, or
   - Temporarily add a "Sign up" call yourself, or
   - Insert directly via the SQL editor's auth helpers.
2. Promote that first user to admin:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

3. From then on, sign in as that admin and use the **Employees** page
   to create everyone else — it calls `/api/admin-create-user`, which
   creates the Supabase Auth user (Supabase generates the UUID — the
   app never invents one) and sets their role in the same step.

## Security notes

- **RLS, not localStorage, is the source of truth for access control.**
  Every table has row-level security policies keyed off
  `profiles.role`; the frontend's role checks are for UI/UX only (which
  nav links and buttons to show) — a modified or malicious client still
  can't read or write data it isn't allowed to, because Postgres itself
  enforces it.
- **Screenshots are private.** The storage bucket is not public; every
  image is served through a short-lived signed URL, generated on
  request, scoped by the same role rules as the `screenshots` table.
- **The service-role key only exists in three places:** Vercel's
  environment variables, and inside `api/_lib/requireAdmin.js` /
  `api/admin-*.js` at request time. It is never returned in any
  response body, logged, or reachable from client-side code.
- Every `/api/admin-*` endpoint independently re-verifies the caller is
  a real, currently-valid admin (via their own session token against
  the anon-key API) before touching the service-role key — a stolen or
  forged frontend request can't escalate privilege on its own.

## What's new in this pass vs. the earlier build

- Added the `assistant_admin` role end-to-end (schema, RLS, routing,
  sidebar, Activity/Screenshots scoping).
- Built the Employees management page: create person (email + temp
  password + role), change anyone's role inline, remove a person (with
  a confirm step) — all via the new `/api/admin-*` serverless functions.
- Employees can now view their own screenshots (previously admin-only
  with no employee-facing route at all).
- Fixed a bug where a failed token refresh called `signOut()` without
  awaiting it before reloading the page.
- Added a responsive mobile nav (slide-out drawer + hamburger toggle)
  and reworked tables to scroll horizontally on narrow screens instead
  of overflowing.
- Added loading/error/empty states consistently (banner component) and
  friendlier login error messages (bad credentials vs. timeout vs.
  other).
- Confirmed the full app **actually builds** (`npm install && npm run
  build`) and added a small test harness (`api-tests`, not shipped) that
  exercises every `/api/admin-*` code path against a stubbed Supabase —
  10/10 passing.

## Note on the extension (Quickyflow Timer)

The Chrome extension wasn't touched — it doesn't reference roles at all,
just writes into `work_sessions` / `activity_logs` / `screenshots` under
its own logged-in user's ID, so extending roles on the backend needed no
changes there.
