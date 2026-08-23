-- 0002_phase3_altadaily_patch.sql
-- Adds what Phase 3 (Altadaily-style closet) needs on top of
-- 0001_baseline_schema.sql, and fixes the wardrobe_items SELECT policy,
-- which currently lets any authenticated user read every user's private
-- uploads, not just the shared curated catalog.

-- 1. Brand — nullable; UI falls back to "Unknown Brand" display-side only,
--    never persist that literal string to the row.
alter table public.wardrobe_items
  add column if not exists brand text;

-- 2. Item lifecycle status — required for the draft-review flow.
--    Existing/curated rows default to 'confirmed', so this is safe to add
--    even if rows already exist.
alter table public.wardrobe_items
  add column if not exists status text not null default 'confirmed';

alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_status_check;

alter table public.wardrobe_items
  add constraint wardrobe_items_status_check
  check (status in ('draft', 'confirmed', 'rejected'));

create index if not exists wardrobe_items_status_idx
  on public.wardrobe_items (status);

-- 3. Per-user quantity — a fact about ownership, so it belongs on the join
--    table, not on the shared catalog item.
alter table public.user_wardrobe_items
  add column if not exists quantity integer not null default 1;

alter table public.user_wardrobe_items
  drop constraint if exists user_wardrobe_items_quantity_check;

alter table public.user_wardrobe_items
  add constraint user_wardrobe_items_quantity_check
  check (quantity >= 1);

-- 4. Fix SELECT: restrict user_upload rows to their owner. Mirrors the
--    ownership check the baseline already uses on its UPDATE policy —
--    no owner_id column needed, one source of truth for ownership.
drop policy if exists "wardrobe_items: authenticated select" on public.wardrobe_items;

create policy "wardrobe_items: select curated or own"
  on public.wardrobe_items
  for select
  to authenticated
  using (
    source = 'curated'
    or exists (
      select 1 from public.user_wardrobe_items uwi
      where uwi.item_id = wardrobe_items.id
        and uwi.user_id = auth.uid()
    )
  );