-- =============================================================
-- 0006_row_level_security.sql
-- Enables Row Level Security on every user-scoped and internal
-- table.  Re-runnable: every policy is preceded by DROP IF EXISTS.
--
-- Service-role behaviour:
--   Supabase grants BYPASSRLS to the service_role PostgreSQL
--   role, so any client initialised with the service_role JWT
--   (used by extract_and_upload.py and generate_daily_outfit.py)
--   is exempt from all policies below without any extra grants.
--   Ref: https://supabase.com/docs/guides/database/postgres/row-level-security
-- =============================================================

-- -------------------------------------------------------------
-- public.users
-- Each user may only read/write their own profile row.
-- -------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists "users: owner all" on public.users;
create policy "users: owner all"
  on public.users
  for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- -------------------------------------------------------------
-- public.fashion_dna
-- Each user may only read/write their own DNA row.
-- -------------------------------------------------------------
alter table public.fashion_dna enable row level security;

drop policy if exists "fashion_dna: owner all" on public.fashion_dna;
create policy "fashion_dna: owner all"
  on public.fashion_dna
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- public.wardrobe_items  (global catalog -- no user_id column)
--
-- SELECT: any authenticated user may read catalog items.
-- INSERT / UPDATE / DELETE: no permissive policy is created for
--   authenticated or anon roles.  Because RLS is enabled and no
--   policy covers those operations for those roles, they are
--   implicitly denied.  The service_role bypasses RLS via
--   BYPASSRLS, so extract_and_upload.py writes freely.
-- -------------------------------------------------------------
alter table public.wardrobe_items enable row level security;

drop policy if exists "wardrobe_items: authenticated select" on public.wardrobe_items;
create policy "wardrobe_items: authenticated select"
  on public.wardrobe_items
  for select
  using (auth.role() = 'authenticated');

-- -------------------------------------------------------------
-- public.user_wardrobe_items
-- Each user may only read/write their own membership rows.
-- -------------------------------------------------------------
alter table public.user_wardrobe_items enable row level security;

drop policy if exists "user_wardrobe_items: owner all" on public.user_wardrobe_items;
create policy "user_wardrobe_items: owner all"
  on public.user_wardrobe_items
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- public.outfits
-- Each user may only read/write their own outfit rows.
-- -------------------------------------------------------------
alter table public.outfits enable row level security;

drop policy if exists "outfits: owner all" on public.outfits;
create policy "outfits: owner all"
  on public.outfits
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- public.feedback
-- Each user may only read/write their own feedback rows.
-- -------------------------------------------------------------
alter table public.feedback enable row level security;

drop policy if exists "feedback: owner all" on public.feedback;
create policy "feedback: owner all"
  on public.feedback
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- public.extraction_log  (internal audit log -- no user_id)
--
-- Written exclusively by extract_and_upload.py via the
-- service_role key.  The app never reads this table directly.
-- Enabling RLS with no permissive policies for authenticated or
-- anon roles means all non-service-role access is implicitly
-- denied.  service_role bypasses via BYPASSRLS.
-- -------------------------------------------------------------
alter table public.extraction_log enable row level security;

-- No policies for authenticated or anon roles -- implicitly denied.
-- service_role bypasses RLS via BYPASSRLS (no extra grant needed).