-- Restore the insert policy for the app's authenticated wardrobe uploads.
-- Use auth.uid() rather than relying only on the Postgres role name because
-- Supabase server clients can reach PostgREST through a JWT-backed role.
drop policy if exists "wardrobe_items: authenticated insert user_upload" on public.wardrobe_items;
drop policy if exists "wardrobe_items: insert user_upload" on public.wardrobe_items;

create policy "wardrobe_items: insert user_upload"
  on public.wardrobe_items
  for insert
  to public
  with check (
    auth.uid() is not null
    and source = 'user_upload'
  );