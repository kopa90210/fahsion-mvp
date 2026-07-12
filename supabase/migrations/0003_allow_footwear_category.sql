alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_category_check;

update public.wardrobe_items
set category = case
  when lower(trim(coalesce(layer_role, ''))) in ('outerwear', 'outer_layer', 'outer layer') then 'outerwear'
  when lower(trim(coalesce(subcategory, ''))) like '%blazer%' then 'outerwear'
  when lower(trim(coalesce(display_name, ''))) like '%blazer%' then 'outerwear'
  when lower(trim(coalesce(subcategory, ''))) like '%jacket%' then 'outerwear'
  when lower(trim(coalesce(display_name, ''))) like '%jacket%' then 'outerwear'
  when lower(trim(coalesce(subcategory, ''))) like '%coat%' then 'outerwear'
  when lower(trim(coalesce(display_name, ''))) like '%coat%' then 'outerwear'
  when lower(trim(category)) in ('top', 'tops') then 'top'
  when lower(trim(category)) in ('bottom', 'bottoms') then 'bottom'
  when lower(trim(category)) in ('outerwear', 'outer wear', 'outer_layer', 'outer layer') then 'outerwear'
  when lower(trim(category)) in ('footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'loafer', 'loafers') then 'footwear'
  when lower(trim(category)) in ('accessory', 'accessories') then 'accessory'
  when lower(trim(category)) like '%shoe%' then 'footwear'
  when lower(trim(category)) like '%sneaker%' then 'footwear'
  when lower(trim(category)) like '%boot%' then 'footwear'
  when lower(trim(category)) like '%loafer%' then 'footwear'
  when lower(trim(category)) like '%shirt%' then 'top'
  when lower(trim(category)) like '%blouse%' then 'top'
  when lower(trim(category)) like '%tee%' then 'top'
  when lower(trim(category)) like '%sweater%' then 'top'
  when lower(trim(category)) like '%jacket%' then 'outerwear'
  when lower(trim(category)) like '%coat%' then 'outerwear'
  when lower(trim(category)) like '%blazer%' then 'outerwear'
  when lower(trim(category)) like '%pant%' then 'bottom'
  when lower(trim(category)) like '%trouser%' then 'bottom'
  when lower(trim(category)) like '%jean%' then 'bottom'
  when lower(trim(category)) like '%skirt%' then 'bottom'
  when lower(trim(category)) like '%short%' then 'bottom'
  when lower(trim(category)) like '%bag%' then 'accessory'
  when lower(trim(category)) like '%belt%' then 'accessory'
  when lower(trim(category)) like '%hat%' then 'accessory'
  else 'accessory'
end
where category is null
  or category not in ('top', 'bottom', 'outerwear', 'footwear', 'accessory')
  or lower(trim(coalesce(layer_role, ''))) in ('outerwear', 'outer_layer', 'outer layer')
  or lower(trim(coalesce(subcategory, ''))) like any (array['%blazer%', '%jacket%', '%coat%'])
  or lower(trim(coalesce(display_name, ''))) like any (array['%blazer%', '%jacket%', '%coat%']);

update public.wardrobe_items
set layer_role = case
  when lower(trim(coalesce(layer_role, ''))) in ('outer_layer', 'outer layer') then 'outerwear'
  when category = 'outerwear' then 'outerwear'
  else layer_role
end
where lower(trim(coalesce(layer_role, ''))) in ('outer_layer', 'outer layer')
  or category = 'outerwear';

alter table public.wardrobe_items
  add constraint wardrobe_items_category_check
  check (category in ('top', 'bottom', 'outerwear', 'footwear', 'accessory'));
