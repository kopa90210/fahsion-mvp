-- Create a draft item and its ownership link in one authenticated operation.
create or replace function public.create_draft_wardrobe_item(p_image_url text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  created_item_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.wardrobe_items (image_url, source, status)
  values (p_image_url, 'user_upload', 'draft')
  returning id into created_item_id;

  insert into public.user_wardrobe_items (user_id, item_id, quantity)
  values (current_user_id, created_item_id, 1);

  return created_item_id;
end;
$$;

revoke all on function public.create_draft_wardrobe_item(text) from public;
grant execute on function public.create_draft_wardrobe_item(text) to authenticated;
