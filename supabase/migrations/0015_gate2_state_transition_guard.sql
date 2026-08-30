-- 0015_gate2_state_transition_guard.sql
-- Phase 4B Gate 2: Enforce database-level state transition invariant on wardrobe_items
--
-- Invariant:
-- Direct updates to pipeline state columns (processing_status, prettify_status)
-- by authenticated client sessions are forbidden. State transitions must occur
-- exclusively via backend service_role / orchestrator RPCs.

-- 1. Create guard trigger function
create or replace function public.guard_wardrobe_item_pipeline_transitions()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Restrict direct updates coming from authenticated client sessions
  if (auth.role() = 'authenticated') then
    if (new.processing_status is distinct from old.processing_status) then
      raise exception 'Direct update of processing_status is forbidden. Pipeline state transitions must use backend orchestrator RPCs.';
    end if;

    if (new.prettify_status is distinct from old.prettify_status) then
      raise exception 'Direct update of prettify_status is forbidden. Prettify state transitions must use backend orchestrator RPCs.';
    end if;
  end if;

  return new;
end;
$$;

-- 2. Attach before update trigger on wardrobe_items
drop trigger if exists trg_guard_wardrobe_item_pipeline_transitions on public.wardrobe_items;

create trigger trg_guard_wardrobe_item_pipeline_transitions
  before update on public.wardrobe_items
  for each row
  execute function public.guard_wardrobe_item_pipeline_transitions();

comment on function public.guard_wardrobe_item_pipeline_transitions is
  'Enforces Phase 4B Gate 2 invariant: clients cannot tamper with processing_status or prettify_status directly.';
