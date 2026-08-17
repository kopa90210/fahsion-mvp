alter table public.outfits
  add column if not exists reasoning jsonb,
  add column if not exists styling_tip text,
  add column if not exists confidence numeric,
  add column if not exists source text not null default 'engine';

update public.outfits
set source = 'engine'
where source is null;

alter table public.outfits
  alter column source set default 'engine',
  alter column source set not null;

alter table public.outfits
  drop constraint if exists outfits_source_check;

alter table public.outfits
  add constraint outfits_source_check
  check (source in ('engine', 'daily_ai', 'daily_fallback'));
