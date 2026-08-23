alter table public.wardrobe_items add column if not exists brand text;
alter table public.wardrobe_items add column if not exists status text not null default 'confirmed';
alter table public.wardrobe_items add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.wardrobe_items drop constraint if exists wardrobe_items_status_check;
alter table public.wardrobe_items add constraint wardrobe_items_status_check check (status in ('draft', 'confirmed', 'rejected'));
alter table public.user_wardrobe_items add column if not exists quantity integer not null default 1;
alter table public.user_wardrobe_items drop constraint if exists user_wardrobe_items_quantity_check;
alter table public.user_wardrobe_items add constraint user_wardrobe_items_quantity_check check (quantity >= 1);
create index if not exists wardrobe_items_status_idx on public.wardrobe_items (status);
drop policy if exists "wardrobe_items: authenticated select" on public.wardrobe_items;
drop policy if exists "wardrobe_items: select curated or own" on public.wardrobe_items;
create policy "wardrobe_items: select curated or own" on public.wardrobe_items for select to authenticated
  using (source = 'curated' or owner_id = auth.uid());