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
