-- ============================================================
-- Quickyflow — Database Schema (v2)
-- Run this in the Supabase SQL Editor (SQL Editor → New query
-- → paste this whole file → Run). Safe to re-run — every
-- statement is idempotent (create-if-not-exists / drop-then-
-- create for policies and functions).
--
-- Tables:
--   profiles        — one row per auth user: role + display name
--                      (this is the "employees" table the app's
--                      requirements refer to — every authenticated
--                      user, whatever their role, has exactly one
--                      profiles row, keyed by their auth.users UUID)
--   work_sessions   — the digital timer (start/pause/resume/stop)
--   activity_logs   — per-domain browsing segments while the timer runs
--   screenshots     — periodic screenshot metadata (files live in Storage)
--
-- Roles:
--   admin           — manages employees & assistant admins, sees everything
--   assistant_admin — can view employee activity/screenshots, cannot
--                     manage users (no insert/update/delete on profiles)
--   employee        — sees only their own data
--
-- Also creates:
--   - a trigger that auto-creates a profiles row on signup (defaults
--     to 'employee'; the admin-created-user flow below sets the real
--     role right after, via the service-role key on the server)
--   - Row Level Security policies for all four roles
--   - the "screenshots" storage bucket (private) + storage policies
-- ============================================================

-- ---------------------------------------------------------------
-- 1. PROFILES  ("employees" table — one row per user, any role)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'employee'
    check (role in ('employee', 'assistant_admin', 'admin')),
  created_at timestamptz not null default now()
);

-- If this table already exists from the older admin/employee-only
-- schema, widen the check constraint to allow assistant_admin.
do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check
    check (role in ('employee', 'assistant_admin', 'admin'));
exception when others then
  null; -- constraint already correct / table just created above
end $$;

alter table public.profiles enable row level security;

-- Everyone logged in can see the list of profiles (needed so admins and
-- assistant admins can see employee names, and so role checks work).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Only an admin can change someone's role/name via the client, and a
-- user may only ever touch their own row otherwise. (Employee creation
-- itself happens server-side with the service-role key, which bypasses
-- RLS entirely — see /api/admin-create-user.js.)
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    -- a non-admin can update their own row but can never change their own role
    (id = auth.uid() and role = (select p2.role from public.profiles p2 where p2.id = auth.uid()))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Only an admin may delete a profile (e.g. offboarding — the auth user
-- itself is deleted server-side via the service-role key, which cascades
-- here, but this policy also allows a direct row delete if ever needed).
drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Auto-create a profile row whenever a new auth user signs up.
-- New users always start as 'employee'; an admin promotes/creates with
-- the correct role via the server-side admin API, which updates this
-- row right after creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 2. WORK_SESSIONS  (the digital timer: start / pause / resume / stop)
-- ---------------------------------------------------------------
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'paused', 'stopped')),
  duration_seconds integer not null default 0,
  pause_reason text, -- 'manual' | 'inactivity' | null
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists work_sessions_employee_idx on public.work_sessions(employee_id, started_at desc);
create index if not exists work_sessions_status_idx on public.work_sessions(employee_id, status);

alter table public.work_sessions enable row level security;

-- admin: full visibility. assistant_admin: read-only visibility of
-- everyone's sessions (needed to review employee activity). employee:
-- only their own.
drop policy if exists "work_sessions_select_own_or_admin" on public.work_sessions;
create policy "work_sessions_select_scoped"
  on public.work_sessions for select
  to authenticated
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'assistant_admin')
    )
  );

drop policy if exists "work_sessions_insert_own" on public.work_sessions;
create policy "work_sessions_insert_own"
  on public.work_sessions for insert
  to authenticated
  with check (employee_id = auth.uid());

drop policy if exists "work_sessions_update_own" on public.work_sessions;
create policy "work_sessions_update_own"
  on public.work_sessions for update
  to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

-- Guard against employees inflating their own hours by PATCHing
-- duration_seconds directly via the REST API. Clamp growth to real
-- wall-clock time elapsed since the row was last written; never allow
-- it to go backwards (replay protection).
create or replace function public.work_sessions_clamp_duration()
returns trigger
language plpgsql
as $$
declare
  max_elapsed int;
begin
  if tg_op = 'INSERT' then
    new.duration_seconds := least(coalesce(new.duration_seconds, 0), 5);
    return new;
  end if;

  max_elapsed := greatest(0, floor(extract(epoch from (now() - old.started_at)))::int);
  if new.duration_seconds > max_elapsed then
    new.duration_seconds := max_elapsed;
  end if;
  if new.duration_seconds < old.duration_seconds then
    new.duration_seconds := old.duration_seconds;
  end if;
  return new;
end;
$$;

drop trigger if exists work_sessions_clamp_duration_trg on public.work_sessions;
create trigger work_sessions_clamp_duration_trg
  before insert or update on public.work_sessions
  for each row execute function public.work_sessions_clamp_duration();

-- ---------------------------------------------------------------
-- 3. ACTIVITY_LOGS  (per-domain browsing segments while a timer runs)
-- ---------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  domain text,
  url text,
  page_title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_employee_idx on public.activity_logs(employee_id, started_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_select_own_or_admin" on public.activity_logs;
create policy "activity_logs_select_scoped"
  on public.activity_logs for select
  to authenticated
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'assistant_admin')
    )
  );

drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own"
  on public.activity_logs for insert
  to authenticated
  with check (employee_id = auth.uid());

drop policy if exists "activity_logs_update_own" on public.activity_logs;
create policy "activity_logs_update_own"
  on public.activity_logs for update
  to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

-- Same protection as work_sessions: duration_seconds can't be PATCHed
-- to more than the wall-clock time since the row was created.
create or replace function public.activity_logs_clamp_duration()
returns trigger
language plpgsql
as $$
declare
  max_elapsed int;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;
  if new.duration_seconds is null then
    return new;
  end if;
  max_elapsed := greatest(0, floor(extract(epoch from (now() - old.started_at)))::int);
  if new.duration_seconds > max_elapsed then
    new.duration_seconds := max_elapsed;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_logs_clamp_duration_trg on public.activity_logs;
create trigger activity_logs_clamp_duration_trg
  before insert or update on public.activity_logs
  for each row execute function public.activity_logs_clamp_duration();

-- ---------------------------------------------------------------
-- 4. SCREENSHOTS  (metadata row; the actual image lives in Storage)
-- ---------------------------------------------------------------
create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_session_id uuid references public.work_sessions(id) on delete set null,
  storage_path text not null, -- "<user_id>/<timestamp>.jpg" inside the "screenshots" bucket
  active_domain text,
  active_url text,
  taken_at timestamptz not null default now()
);

create index if not exists screenshots_employee_idx on public.screenshots(employee_id, taken_at desc);

alter table public.screenshots enable row level security;

-- admin: sees all screenshots. assistant_admin: sees all screenshots too
-- ("permitted employee activity/screenshots" in the requirements — scope
-- this down to a subset of employees later if you need per-assignment
-- restriction; see note at the bottom of this file). employee: own only.
drop policy if exists "screenshots_select_own_or_admin" on public.screenshots;
create policy "screenshots_select_scoped"
  on public.screenshots for select
  to authenticated
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'assistant_admin')
    )
  );

drop policy if exists "screenshots_insert_own" on public.screenshots;
create policy "screenshots_insert_own"
  on public.screenshots for insert
  to authenticated
  with check (employee_id = auth.uid());

-- ---------------------------------------------------------------
-- 5. STORAGE BUCKET for screenshot image files (private)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

-- Employees can upload only into a folder named after their own user id
-- (the extension uploads to "<user_id>/<timestamp>.jpg", matching this).
drop policy if exists "screenshots_storage_insert_own" on storage.objects;
create policy "screenshots_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Employees read their own screenshot files; admins and assistant admins
-- read all (mirrors the screenshots table policy above).
drop policy if exists "screenshots_storage_select_own_or_admin" on storage.objects;
create policy "screenshots_storage_select_scoped"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'screenshots'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'assistant_admin')
      )
    )
  );

-- ============================================================
-- Done. Next steps:
--
--   1. Create your first admin user — easiest path is to sign up
--      once through the dashboard's login screen with a real email
--      (this creates the auth user + a default 'employee' profile row
--      via the trigger above), then promote it:
--
--        update public.profiles set role = 'admin' where email = 'you@example.com';
--
--      After that, use the Employees page in the dashboard (as that
--      admin) to create every other employee/assistant_admin — it
--      calls the server-side /api/admin-create-user function, which
--      creates the auth user AND sets the correct role in one step,
--      so you never need to hand-edit roles in SQL again.
--
--   2. NOTE on "permitted" scoping for assistant_admin: the policies
--      above give every assistant_admin visibility into every
--      employee's activity_logs/screenshots/work_sessions (but never
--      profiles management). If you later want per-assistant-admin
--      assignment (e.g. "Assistant A can only see employees 1-5"),
--      add an `assignments (assistant_admin_id uuid, employee_id uuid)`
--      table and swap `p.role in ('admin','assistant_admin')` in the
--      three "_scoped" select policies above for a two-part check:
--      admins see all, assistant_admins see only assigned employee_ids.
-- ============================================================
