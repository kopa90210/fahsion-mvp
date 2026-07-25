# Phase Gate Report — Soft-Launch MVP Evaluation

> **Purpose**: Permanent decision log for evaluating Phase 1 MVP criteria. This document is filled in manually following the soft-launch test window.

---

## 1. Test Window & Cohort Metadata

- **Testing Window**: `[YYYY-MM-DD]` to `[YYYY-MM-DD]`
- **Total Testers Enrolled**: `[Number of testers]`

---

## 2. Quantitative Phase Gate Metrics

*Populate numbers by running `python scripts/phase_gate_report.py` against Supabase.*

| Metric | Target Benchmark | Recorded Result |
| :--- | :--- | :--- |
| **Daily Outfit Like Rate** | $\ge 60\%$ | `[__]% ([__] swipes)` |
| **Calibration Outfit Like Rate** | $\ge 65\%$ | `[__]% ([__] swipes)` |
| **Day 1 (D1) Return Rate** | $\ge 35\%$ | `[__]%` |
| **Active Users (7d window)** | N/A | `[__] users` |
| **Average Swipes per Active User** | N/A | `[__] swipes/user` |

---

## 3. Qualitative Tester Feedback

- **Theme 1**: `[Summary of recurring tester feedback e.g., recommendations match personal style]`
- **Theme 2**: `[Summary of recurring tester feedback e.g., piece selection onboarding clarity]`
- **Theme 3**: `[Summary of recurring tester feedback e.g., desire for more catalog variety]`

---

## 4. Phase Gate Verdict

- **Verdict**: `[ PASS | ITERATE | NOT READY ]`
- **Justification**: `[One sentence justifying the verdict based on metrics and feedback above.]`

### If "Iterate":
- **Specific Phase 1 Adjustments**:
  - [ ] Quiz Scoring Vector Calculation (`src/lib/quiz/scoring.ts`)
  - [ ] Catalog Depth & Category Variety (`wardrobe_items` table)
  - [ ] Recommendation Matching Logic (`src/lib/outfit/engine.ts`)
- **Action**: Apply the selected Phase 1 adjustment(s) and re-test before re-evaluating.

### If "Pass":
- **Phase 2 Authorization**: *Explicit confirmation that Phase 1 MVP gate metrics have been satisfied and Phase 2 scope is authorized to begin.*
