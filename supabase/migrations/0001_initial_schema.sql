-- 0001_baseline_schema.sql
-- Fresh, consolidated baseline for the fahsion-mvp schema, written for a
-- clean database (post-wipe). Replaces migrations 0001-0009 from the prior
-- history — do not run this against a database that still has the old
-- incremental migrations applied; run the wipe script first.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. users — extends auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id                        uuid references auth.users on delete cascade not null primary key,
  has_completed_calibration boolean not null default false,
  created_at                timestamptz default now() not null
);

-- ---------------------------------------------------------------------------
-- 2. fashion_dna — one style vector per user
-- ---------------------------------------------------------------------------
create table public.fashion_dna (
  user_id     uuid references public.users on delete cascade not null primary key,
  vector      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now() not null
);

-- ---------------------------------------------------------------------------
-- 3. wardrobe_items — shared curated catalog + user-uploaded items
-- ---------------------------------------------------------------------------
create table public.wardrobe_items (
  id                uuid primary key default gen_random_uuid(),
  category          text check (category in ('top', 'bottom', 'outerwear', 'footwear', 'accessory')),
  subcategory       text,
  display_name      text,
  image_url         text not null,
  color             jsonb not null default '{}'::jsonb,
  material          jsonb not null default '{}'::jsonb,
  fit               jsonb not null default '{}'::jsonb,
  pattern           text,
  style_tags        jsonb not null default '{}'::jsonb,
  formality_score   numeric,
  season_weights    jsonb default '{}'::jsonb,
  layer_role        text,
  model_confidence  numeric,
  source            text not null default 'curated' check (source in ('curated', 'user_upload')),
  created_at        timestamptz default now()
);

create index wardrobe_items_category_idx on public.wardrobe_items (category);

-- ---------------------------------------------------------------------------
-- 4. user_wardrobe_items — ownership join, with soft-delete + notes
-- ---------------------------------------------------------------------------
create table public.user_wardrobe_items (
  user_id     uuid references public.users on delete cascade not null,
  item_id     uuid references public.wardrobe_items on delete cascade not null,
  added_at    timestamptz default now() not null,
  retired_at  timestamptz,
  notes       text,
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------------
-- 5. outfits — generated or manually-built outfits
-- ---------------------------------------------------------------------------
create table public.outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users on delete cascade not null,
  item_ids    jsonb not null default '[]'::jsonb,
  reasoning   jsonb,
  styling_tip text,
  confidence  numeric,
  source      text not null default 'engine' check (source in ('engine', 'daily_ai', 'daily_fallback', 'manual')),
  created_at  timestamptz default now() not null
);

-- ---------------------------------------------------------------------------
-- 6. feedback — like/dislike signal per outfit
-- ---------------------------------------------------------------------------
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users on delete cascade not null,
  outfit_id   uuid references public.outfits on delete cascade not null,
  liked       boolean not null,
  source      text not null default 'daily' check (source in ('daily', 'calibration')),
  created_at  timestamptz default now() not null
);

-- ---------------------------------------------------------------------------
-- 7. extraction_log — audit trail for every AI extraction attempt
--    (both the offline batch script and the in-app single-photo upload path)
-- ---------------------------------------------------------------------------
create table public.extraction_log (
  id             uuid primary key default gen_random_uuid(),
  photo_filename text not null,
  photo_hash     text not null,
  raw_response   jsonb not null,
  status         text not null check (status in ('pending', 'processing', 'accepted', 'rejected')),
  source_hint    text check (source_hint is null or source_hint in ('curated', 'user_upload')),
  problems       jsonb,
  extracted_at   timestamptz default now()
);

create index extraction_log_photo_hash_idx on public.extraction_log (photo_hash);

-- ---------------------------------------------------------------------------
-- 8. Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('wardrobe-images', 'wardrobe-images', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------------
-- 9. Auth trigger — sync new auth.users into public.users + fashion_dna
-- ---------------------------------------------------------------------------
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
create policy "users: owner all"
  on public.users for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter table public.fashion_dna enable row level security;
create policy "fashion_dna: owner all"
  on public.fashion_dna for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.wardrobe_items enable row level security;

-- Anyone authenticated can read the full catalog (curated + everyone's uploads).
create policy "wardrobe_items: authenticated select"
  on public.wardrobe_items for select
  using (auth.role() = 'authenticated');

-- A user may only insert rows tagged as their own upload, never as curated.
create policy "wardrobe_items: authenticated insert user_upload"
  on public.wardrobe_items for insert
  to authenticated
  with check (source = 'user_upload');

-- A user may only update a row if it's a user_upload item they actually own
-- via user_wardrobe_items. Curated rows are never updatable by end users.
create policy "wardrobe_items: owner structured update"
  on public.wardrobe_items for update
  using (
    source = 'user_upload'
    and exists (
      select 1 from public.user_wardrobe_items uwi
      where uwi.item_id = wardrobe_items.id and uwi.user_id = auth.uid()
    )
  )
  with check (
    source = 'user_upload'
    and exists (
      select 1 from public.user_wardrobe_items uwi
      where uwi.item_id = wardrobe_items.id and uwi.user_id = auth.uid()
    )
  );

alter table public.user_wardrobe_items enable row level security;
create policy "user_wardrobe_items: owner all"
  on public.user_wardrobe_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.outfits enable row level security;
create policy "outfits: owner all"
  on public.outfits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.feedback enable row level security;
create policy "feedback: owner all"
  on public.feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- extraction_log: RLS enabled, no policies for authenticated/anon.
-- Only the service_role key (which bypasses RLS) can read/write this table —
-- used exclusively by extract_and_upload.py and the in-app upload action.
alter table public.extraction_log enable row level security;