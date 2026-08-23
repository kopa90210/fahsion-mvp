insert into public.users (id)
select id
from auth.users
on conflict (id) do nothing;

insert into public.fashion_dna (user_id)
select id
from public.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  insert into public.fashion_dna (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;