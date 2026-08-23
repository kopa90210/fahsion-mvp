-- Allow authenticated users to create only their own uploaded wardrobe items.
-- Ownership is established by the user_wardrobe_items link inserted immediately
-- after the item is created.
drop policy if exists "wardrobe_items: authenticated insert user_upload" on public.wardrobe_items;

create policy "wardrobe_items: authenticated insert user_upload"
  on public.wardrobe_items
  for insert
  to authenticated
  with check (source = 'user_upload');
