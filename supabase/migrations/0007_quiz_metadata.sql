alter table public.fashion_dna
  add column if not exists shopping_motivation text,
  add column if not exists risk_tolerance text;

alter table public.fashion_dna
  drop constraint if exists shopping_motivation_check;

alter table public.fashion_dna
  add constraint shopping_motivation_check
  check (shopping_motivation in ('matches-wardrobe', 'looks-unique', 'quality-worth-it', 'price-is-right'));

alter table public.fashion_dna
  drop constraint if exists risk_tolerance_check;

alter table public.fashion_dna
  add constraint risk_tolerance_check
  check (risk_tolerance in ('safe-combinations', 'sometimes-different', 'love-experimenting', 'depends-on-mood'));
