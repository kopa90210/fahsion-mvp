alter table public.users
  add column if not exists has_completed_calibration boolean not null default false;

alter table public.feedback
  add column if not exists source text not null default 'daily';

alter table public.feedback
  drop constraint if exists feedback_source_check;

alter table public.feedback
  add constraint feedback_source_check
  check (source in ('daily', 'calibration'));
