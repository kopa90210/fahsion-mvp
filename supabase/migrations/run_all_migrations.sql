-- ============================================================
-- 0001_initial_schema.sql
-- ============================================================

-- 1. Users table (Extends Supabase Auth)
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Fashion DNA (Stores user style vectors)
-- Note: 'vector' is stored as jsonb per requirements, not using pgvector extension yet as no AI infra is needed in Phase 1.
create table if not exists public.fashion_dna (
  user_id uuid references public.users on delete cascade not null primary key,
  vector jsonb not null default '{}'::jsonb, 
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Wardrobe Items (Global catalog of items)
create table if not exists public.wardrobe_items (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  subcategory text not null,
  display_name text not null,
  image_url text,
  color jsonb not null default '{}'::jsonb,
  material jsonb not null default '{}'::jsonb,
  fit jsonb not null default '{}'::jsonb,
  pattern text,
  style_tags jsonb not null default '{}'::jsonb,
  formality_score numeric,
  season_weights jsonb not null default '{}'::jsonb,
  layer_role text,
  source text not null default 'curated'
);

-- 4. User Wardrobe Items (Mapping users to their items)
create table if not exists public.user_wardrobe_items (
  user_id uuid references public.users on delete cascade not null,
  item_id uuid references public.wardrobe_items on delete cascade not null,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, item_id)
);

-- 5. Outfits
create table if not exists public.outfits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  item_ids jsonb not null default '[]'::jsonb, -- Array of wardrobe_item IDs
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Feedback
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  outfit_id uuid references public.outfits on delete cascade not null,
  liked boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Trigger to sync Auth users to public tables
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id) values (new.id);
  insert into public.fashion_dna (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 0002_wardrobe_extraction_pipeline.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  subcategory text,
  display_name text,
  image_url text not null,
  color jsonb not null,
  material jsonb not null,
  fit jsonb not null,
  pattern text,
  style_tags jsonb not null,
  formality_score numeric,
  season_weights jsonb,
  layer_role text,
  model_confidence numeric,
  source text default 'curated',
  created_at timestamptz default now()
);

alter table public.wardrobe_items
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists display_name text,
  add column if not exists image_url text,
  add column if not exists color jsonb,
  add column if not exists material jsonb,
  add column if not exists fit jsonb,
  add column if not exists pattern text,
  add column if not exists style_tags jsonb,
  add column if not exists formality_score numeric,
  add column if not exists season_weights jsonb,
  add column if not exists layer_role text,
  add column if not exists model_confidence numeric,
  add column if not exists source text default 'curated',
  add column if not exists created_at timestamptz default now();

do $$
begin
  alter table public.wardrobe_items
    alter column color drop default,
    alter column material drop default,
    alter column fit drop default,
    alter column style_tags drop default,
    alter column season_weights drop default;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'color'
      and data_type <> 'jsonb'
  ) then
    alter table public.wardrobe_items
      alter column color type jsonb using to_jsonb(color);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'material'
      and data_type <> 'jsonb'
  ) then
    alter table public.wardrobe_items
      alter column material type jsonb using to_jsonb(material);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'fit'
      and data_type <> 'jsonb'
  ) then
    alter table public.wardrobe_items
      alter column fit type jsonb using to_jsonb(fit);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'style_tags'
      and data_type <> 'jsonb'
  ) then
    alter table public.wardrobe_items
      alter column style_tags type jsonb using to_jsonb(style_tags);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'season_weights'
      and data_type <> 'jsonb'
  ) then
    alter table public.wardrobe_items
      alter column season_weights type jsonb using to_jsonb(season_weights);
  end if;
end $$;

update public.wardrobe_items
set
  category = coalesce(category, 'top'),
  image_url = coalesce(image_url, ''),
  color = coalesce(color, '{}'::jsonb),
  material = coalesce(material, '{}'::jsonb),
  fit = coalesce(fit, '{}'::jsonb),
  style_tags = coalesce(style_tags, '{}'::jsonb),
  source = coalesce(source, 'curated');

alter table public.wardrobe_items
  alter column category set not null,
  alter column image_url set not null,
  alter column color set not null,
  alter column material set not null,
  alter column fit set not null,
  alter column style_tags set not null,
  alter column color set default '{}'::jsonb,
  alter column material set default '{}'::jsonb,
  alter column fit set default '{}'::jsonb,
  alter column style_tags set default '{}'::jsonb,
  alter column season_weights set default '{}'::jsonb;

create table if not exists public.extraction_log (
  id uuid primary key default gen_random_uuid(),
  photo_filename text not null,
  photo_hash text not null,
  raw_response jsonb not null,
  status text not null check (status in ('accepted','rejected')),
  problems jsonb,
  extracted_at timestamptz default now()
);

create index if not exists extraction_log_photo_hash_idx
  on public.extraction_log (photo_hash);

insert into storage.buckets (id, name, public)
values ('wardrobe-images', 'wardrobe-images', true)
on conflict (id) do update set public = true;


-- ============================================================
-- 0003_allow_footwear_category.sql
-- ============================================================

alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_category_check;

update public.wardrobe_items
set category = case
  when lower(trim(coalesce(layer_role, ''))) in ('outerwear', 'outer_layer', 'outer layer') then 'outerwear'
  when lower(trim(coalesce(subcategory, ''))) like '%blazer%' then 'outerwear'
  when lower(trim(coalesce(display_name, ''))) like '%blazer%' then 'outerwear'
  when lower(trim(coalesce(subcategory, ''))) like '%jacket%' then 'outerwear'
  when lower(trim(coalesce(display_name, ''))) like '%jacket%' then 'outerwear'
  when lower(trim(coalesce(subcategory, ''))) like '%coat%' then 'outerwear'
  when lower(trim(coalesce(display_name, ''))) like '%coat%' then 'outerwear'
  when lower(trim(category)) in ('top', 'tops') then 'top'
  when lower(trim(category)) in ('bottom', 'bottoms') then 'bottom'
  when lower(trim(category)) in ('outerwear', 'outer wear', 'outer_layer', 'outer layer') then 'outerwear'
  when lower(trim(category)) in ('footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'loafer', 'loafers') then 'footwear'
  when lower(trim(category)) in ('accessory', 'accessories') then 'accessory'
  when lower(trim(category)) like '%shoe%' then 'footwear'
  when lower(trim(category)) like '%sneaker%' then 'footwear'
  when lower(trim(category)) like '%boot%' then 'footwear'
  when lower(trim(category)) like '%loafer%' then 'footwear'
  when lower(trim(category)) like '%shirt%' then 'top'
  when lower(trim(category)) like '%blouse%' then 'top'
  when lower(trim(category)) like '%tee%' then 'top'
  when lower(trim(category)) like '%sweater%' then 'top'
  when lower(trim(category)) like '%jacket%' then 'outerwear'
  when lower(trim(category)) like '%coat%' then 'outerwear'
  when lower(trim(category)) like '%blazer%' then 'outerwear'
  when lower(trim(category)) like '%pant%' then 'bottom'
  when lower(trim(category)) like '%trouser%' then 'bottom'
  when lower(trim(category)) like '%jean%' then 'bottom'
  when lower(trim(category)) like '%skirt%' then 'bottom'
  when lower(trim(category)) like '%short%' then 'bottom'
  when lower(trim(category)) like '%bag%' then 'accessory'
  when lower(trim(category)) like '%belt%' then 'accessory'
  when lower(trim(category)) like '%hat%' then 'accessory'
  else 'accessory'
end
where category is null
  or category not in ('top', 'bottom', 'outerwear', 'footwear', 'accessory')
  or lower(trim(coalesce(layer_role, ''))) in ('outerwear', 'outer_layer', 'outer layer')
  or lower(trim(coalesce(subcategory, ''))) like any (array['%blazer%', '%jacket%', '%coat%'])
  or lower(trim(coalesce(display_name, ''))) like any (array['%blazer%', '%jacket%', '%coat%']);

update public.wardrobe_items
set layer_role = case
  when lower(trim(coalesce(layer_role, ''))) in ('outer_layer', 'outer layer') then 'outerwear'
  when category = 'outerwear' then 'outerwear'
  else layer_role
end
where lower(trim(coalesce(layer_role, ''))) in ('outer_layer', 'outer layer')
  or category = 'outerwear';

alter table public.wardrobe_items
  add constraint wardrobe_items_category_check
  check (category in ('top', 'bottom', 'outerwear', 'footwear', 'accessory'));


-- ============================================================
-- 0004_outfit_calibration.sql
-- ============================================================

alter table public.users
  add column if not exists has_completed_calibration boolean not null default false;

alter table public.feedback
  add column if not exists source text not null default 'daily';

alter table public.feedback
  drop constraint if exists feedback_source_check;

alter table public.feedback
  add constraint feedback_source_check
  check (source in ('daily', 'calibration'));


-- ============================================================
-- 0005_ai_outfit_reasoning.sql
-- ============================================================

alter table public.outfits
  add column if not exists reasoning jsonb,
  add column if not exists styling_tip text,
  add column if not exists confidence numeric,
  add column if not exists source text not null default 'engine';

update public.outfits
set source = 'engine'
where source is null;

alter table public.outfits
  alter column source set default 'engine',
  alter column source set not null;

alter table public.outfits
  drop constraint if exists outfits_source_check;

alter table public.outfits
  add constraint outfits_source_check
  check (source in ('engine', 'daily_ai', 'daily_fallback'));


-- ============================================================
-- 0006_row_level_security.sql
-- ============================================================

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

