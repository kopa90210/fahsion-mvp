# AI Daily Outfit Generation — Implementation Plan

## Architecture decision (do not deviate without discussion)

The AI generation step runs **out of band** as a scheduled Python job
(`generate_daily_outfit.py`), not synchronously inside a Next.js request.
The job writes one `outfits` row per user per day, tagged via
`source` (`daily_ai` | `daily_fallback`). `getDailyOutfit()` in
`src/app/actions/outfit.ts` checks for today's pre-generated row first;
if none exists, it falls through to the existing live
`recommendOutfits()` engine unchanged (which continues to insert
`source = 'engine'` rows as it does today).

This keeps Groq entirely off the request path — a slow or failing AI
call can never make a page load hang.

Work through the phases below in order. Each phase has its own
acceptance criteria; do not start the next phase until the current
one's criteria are met.

---

## Phase 0 — Schema migration

**Task**
Apply `supabase/migrations/0005_ai_outfit_reasoning.sql` (already
drafted): adds `reasoning jsonb`, `styling_tip text`, `confidence
numeric`, `source text not null default 'engine'` to `public.outfits`,
plus a check constraint on `source`.

**Files**
- `supabase/migrations/0005_ai_outfit_reasoning.sql`

**Acceptance criteria**
- [ ] Migration applies cleanly against the current schema with no
      manual intervention (`if not exists` guards present).
- [ ] Existing rows in `outfits` are unaffected — `source` backfills to
      `'engine'` for all pre-existing rows, no nulls, no errors.
- [ ] `alter table ... add constraint` uses `drop constraint if
      exists` first so the migration is re-runnable.
- [ ] No existing TypeScript code breaks — `outfits` reads elsewhere in
      the codebase (`outfitKey`, `getShownOutfitKeys`, etc.) don't
      select `*` and aren't affected by new columns.

---

## Phase 1 — Harden the Python generator

**Task**
Take `generate_daily_outfit.py` (already drafted) from "working script"
to "safe to run unattended daily." Add:
- A `pytest` suite mocking the Supabase client and Groq client (follow
  the mocking style already used in `tests/test_extract_and_upload.py`
  — fixture-based fakes, no real network calls).
- One retry with a short backoff on Groq timeout/5xx before falling
  back to `deterministic_fallback`.
- A small delay between users in `--all-users` mode to stay under Groq
  rate limits.
- Distinct process exit codes: `0` for a run that completed (even with
  some per-user failures logged), non-zero only for fatal config
  errors (missing env vars, DB unreachable).

**Files**
- `generate_daily_outfit.py`
- `tests/test_generate_daily_outfit.py` (new)
- `requirements.txt` (add `pytest` if not already present as a dev
  dependency)

**Acceptance criteria**
- [ ] `pytest tests/test_generate_daily_outfit.py` passes locally with
      no network access.
- [ ] Tests cover: `score_item` (known-vector cosine check),
      `validate_ai_response` (valid response, id not in pool,
      malformed reasoning, out-of-range confidence — each rejected or
      accepted correctly), `deterministic_fallback` (returns None when
      a required category pool is empty, returns valid picks
      otherwise), `has_outfit_today` (true/false branches).
- [ ] `--dry-run` never calls `persist_outfit` — verify via a mock
      assertion, not just log inspection.
- [ ] A simulated Groq timeout results in a `daily_fallback`-sourced
      result, not a crash and not a skipped user.
- [ ] Script exits `0` after a full `--all-users` run even if
      individual users failed (failures are counted and printed in the
      summary line, matching the existing pattern in
      `extract_and_upload.py`'s `main()`).
- [ ] Script exits non-zero immediately if `GROQ_API_KEY`,
      `SUPABASE_URL`, or `SUPABASE_SERVICE_KEY` is missing.

---

## Phase 2 — Next.js read path

**Task**
Modify `getDailyOutfit()` in `src/app/actions/outfit.ts` to check for
an already-generated outfit before running the live engine:

1. Query `outfits` for a row where `user_id` matches, `source` is
   `'daily_ai'` or `'daily_fallback'`, and `created_at` is today
   (reuse the existing `startOfDay` pattern already in this file).
2. If found: resolve each id in `item_ids` against the user's current
   `fetchWardrobeItems()` result to build full `WardrobeItem[]`. If any
   id can't be resolved (item removed/edited since generation), treat
   this as a miss and fall through to step 3 — never throw.
3. If found and fully resolvable: return a `DailyOutfit` using the
   stored `reasoning` column as `reasons` (verbatim — do not regenerate
   via `buildReasons()`), `score` computed via the existing
   `scoreOutfit()` for consistency, and `vector = dna` as today.
4. If not found or not resolvable: run the existing live-engine logic
   completely unchanged (including its own `outfits` insert, which
   remains `source = 'engine'` — no change needed there since the
   column default handles it).

Gate steps 1–3 behind `process.env.ENABLE_AI_DAILY_OUTFITS === 'true'`
— when unset/false, skip straight to step 4 (today's exact current
behavior).

**Files**
- `src/app/actions/outfit.ts`
- `src/app/actions/outfit.test.ts`
- `.env.example` (add `ENABLE_AI_DAILY_OUTFITS=false`)

**Acceptance criteria**
- [ ] All existing tests in `outfit.test.ts` pass unmodified — the
      live-engine path (flag off) is byte-for-byte the current
      behavior.
- [ ] New test: flag on, mock `outfits` table returns a valid
      `source='daily_ai'` row with resolvable `item_ids` and a
      `reasoning` array → `getDailyOutfit()` returns those exact
      reasons and items, and `recommendOutfits()` is never invoked
      (assert via spy/mock call count).
- [ ] New test: flag on, mock row references an item id not present in
      the user's current `fetchWardrobeItems()` result →
      `getDailyOutfit()` falls through to the live-engine path and
      returns a valid outfit with no thrown error.
- [ ] New test: flag on, no row exists for today → falls through to
      live-engine path, identical to flag-off behavior.
- [ ] New test: flag off entirely → the `outfits` table is never
      queried for `source` (assert the read-path query isn't called),
      confirming zero behavior change when disabled.

---

## Phase 3 — Scheduling

**Task**
Add a GitHub Actions scheduled workflow that runs
`generate_daily_outfit.py --all-users` daily, alongside a manual
`workflow_dispatch` trigger for on-demand runs/testing.

**Files**
- `.github/workflows/daily-outfit-generation.yml` (new — separate from
  `ci.yml`, do not modify `ci.yml`)

**Acceptance criteria**
- [ ] Workflow triggers on a daily `cron` schedule (early morning UTC,
      before users' typical wake time) and on `workflow_dispatch`.
- [ ] Installs `requirements.txt` via pip, not npm.
- [ ] Reads `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` from
      GitHub Actions repository secrets — never hardcoded, never
      echoed/printed in logs.
- [ ] Job fails (non-zero step, red check) if the script's fatal exit
      code is non-zero; a run with some per-user failures but overall
      exit 0 shows as a passing check with the failure count visible
      in the job log/summary.
- [ ] Workflow does not touch or depend on `ci.yml`'s Node/npm setup.

---

## Phase 4 — Observability

**Task**
Extend `scripts/phase_gate_report.py` to break down daily like-rate by
`outfits.source`, so `daily_ai` and `daily_fallback` performance can be
compared against the historical `engine` baseline.

**Files**
- `scripts/phase_gate_report.py`

**Acceptance criteria**
- [ ] Report output gains a new section showing like-rate and swipe
      count per distinct `source` value present in the last 7 days of
      `feedback` joined through `outfits`.
- [ ] Existing report sections (daily/calibration like rate, D1 return
      rate, active users) are unchanged in output format — this is
      additive only, verify by diffing output on a fixture with only
      `source='engine'` rows (should match current output plus an
      empty/skipped new section).
- [ ] Script still runs with zero `source`-tagged rows (pre-migration
      or pre-launch state) without crashing.

---

## Phase 5 — Regression pass

**Task**
Full verification pass before considering this done.

**Acceptance criteria**
- [ ] `npm run lint` clean.
- [ ] `npm test` fully green, including all new tests from Phase 2.
- [ ] `pytest` fully green, including all new tests from Phase 1.
- [ ] Manual smoke test (document actual steps taken + results in the
      PR description):
  1. Run `generate_daily_outfit.py --user-id <test-user> --dry-run` →
     confirm printed JSON has valid ids and non-empty reasoning.
  2. Run without `--dry-run` → confirm a row appears in `outfits` with
     `source='daily_ai'` (or `daily_fallback` if Groq was unreachable).
  3. With `ENABLE_AI_DAILY_OUTFITS=true`, load `/outfits` as that user
     → confirm the UI shows the outfit built from that row, and the
     "Why this" explainer shows the stored reasoning text, not
     re-derived `buildReasons()` output.
  4. Delete the row (or wait a day) and reload → confirm it falls back
     to the live engine with no visible error.

---

## Definition of done

- No synchronous Groq call exists anywhere in the Next.js request path.
- Every outfit ever shown in the UI, AI-sourced or not, is composed
  entirely of item ids traceable to the viewing user's own
  `wardrobe_items` rows at render time.
- `ENABLE_AI_DAILY_OUTFITS=false` (or unset) reproduces today's exact
  behavior, verified by unmodified passing tests.
- A Groq outage, malformed model response, or stale/deleted item
  reference degrades silently to the deterministic engine at every
  layer — script-level fallback, and app-level fallback — never a
  user-facing error.
