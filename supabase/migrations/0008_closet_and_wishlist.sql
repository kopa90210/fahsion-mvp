-- =============================================================
-- 0008_closet_and_wishlist.sql
--
-- Part 1 — Closet: add owner_id to wardrobe_items so that
-- user-uploaded items are distinguishable from curated catalog
-- items and can be edited/deleted by their owner via RLS.
--
-- Part 2 — Wishlist: new wishlist_items table that mirrors the
-- wardrobe_items attribute schema with a mandatory user_id
-- column, enabling owner-scoped RLS without touching the global
-- catalog.
--
-- Re-runnable: every ALTER/CREATE is guarded by IF NOT EXISTS
-- or DO $$ ... IF NOT EXISTS END $$.
-- =============================================================

-- =============================================================
-- Part 1 — wardrobe_items.owner_id
-- =============================================================

-- Add nullable owner_id; NULL = curated by service_role pipeline.
-- User-uploaded items will have owner_id = auth.uid() at insert time.
alter table public.wardrobe_items
  add column if not exists owner_id uuid
    references public.users (id) on delete set null;

-- Index to support "fetch items I own" queries efficiently.
create index if not exists wardrobe_items_owner_id_idx
  on public.wardrobe_items (owner_id);

-- RLS: authenticated users may UPDATE only rows they own.
drop policy if exists "wardrobe_items: owner update" on public.wardrobe_items;
create policy "wardrobe_items: owner update"
  on public.wardrobe_items
  for update
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- RLS: authenticated users may DELETE only rows they own.
drop policy if exists "wardrobe_items: owner delete" on public.wardrobe_items;
create policy "wardrobe_items: owner delete"
  on public.wardrobe_items
  for delete
  using (auth.uid() = owner_id);

-- RLS: authenticated users may INSERT with their own owner_id.
drop policy if exists "wardrobe_items: owner insert" on public.wardrobe_items;
create policy "wardrobe_items: owner insert"
  on public.wardrobe_items
  for insert
  with check (auth.uid() = owner_id);

-- =============================================================
-- Part 2 — wishlist_items
-- =============================================================

create table if not exists public.wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users (id) on delete cascade not null,

  -- Category taxonomy: WARDROBE_CATEGORIES from normalize.ts is
  -- the single source of truth; this constraint mirrors it exactly.
  category     text not null
    check (category in ('top', 'bottom', 'outerwear', 'footwear', 'accessory')),

  subcategory  text,
  display_name text,
  brand        text,

  -- layer_role mirrors wardrobe_items so normalizeWardrobeItem()
  -- can classify wishlist items the same way as wardrobe items.
  layer_role   text,

  image_url    text,

  -- Structured attributes — same jsonb columns as wardrobe_items
  -- so gap-recommendation matching can compare apples to apples.
  color        jsonb not null default '{}'::jsonb,
  fit          jsonb not null default '{}'::jsonb,
  style_tags   jsonb not null default '{}'::jsonb,

  notes        text,
  created_at   timestamptz default now() not null
);

-- Index for the most common access pattern: all wishlist items per user.
create index if not exists wishlist_items_user_id_idx
  on public.wishlist_items (user_id);

-- Index for category-filtered queries (mirrors wardrobe_items usage).
create index if not exists wishlist_items_user_category_idx
  on public.wishlist_items (user_id, category);

-- =============================================================
-- RLS on wishlist_items
-- Each user may only read/write their own wishlist rows —
-- identical pattern to outfits, feedback, users.
-- =============================================================

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist_items: owner all" on public.wishlist_items;
create policy "wishlist_items: owner all"
  on public.wishlist_items
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- Storage bucket for wishlist photos
-- Mirrors the existing wardrobe-images bucket.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('wishlist-images', 'wishlist-images', true)
on conflict (id) do update set public = true;
