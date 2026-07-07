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
