# 1.18.0 quiz improvements and sentence-bank assessment

Started from current main `cf337d726a9c7cb4e13d03d38893c804ec265c0d` (1.17.0). The unchanged baseline freshly passed 153 checks. The new in-quiz Restart regression fails on that untouched commit because the control is absent. Implementation preserves existing storage keys, schema-2 backups, pronunciation identities, sentence IDs, read history and checkpoint backlog. New per-question snapshots and history are additive; no reset, reinstall or origin/path change is required.

Reader restart reuses the exact question/options set after confirmation; discarded results are retained as stopped history. Quiz navigation never regrades an answered question. Older reviewed prefixes without per-question outcomes stay locked with unavailable correctness while saved aggregate scores remain unchanged. Missed-material reviews and Unknown Quiz do not claim checkpoint coverage. The latter excludes Known targets and sentence building. Trace callbacks check the active question and generation, preventing stale writing completion after exit, retry or data replacement.

Final verification: 179 passing automated checks, 56 panel/theme/viewport cases, 24 Reader quiz layout cases and 3,204 phone sentence-layout cases. See TESTING.md and tests/quiz-layout-results.json for evidence and device limitations. No merge or deployment was performed during implementation.

## Sentence-bank recommendation (dry run only)

The corpus contains 40 introductory sentences, 192 everyday-context sentences and 1,370 generated variants across 55 pattern families. Exact Reader token coverage reaches all 601 study identities, but only 203 have at least three examples. Blanket percentage cuts could remove the only example for a rare entry.

`node tools/analyze-sentence-redundancy.cjs` ranks generated variants by inverse vocabulary frequency and proposes up to 320 omissions (20%) without editing any content. The dry run retains every study identity in its matching level, a floor of min(3, original exposure count) per identity, all introductory/everyday sentences and at least four variants per pattern family. It leaves 1,282 sentences. This is a coverage proxy, not a linguistic quality assessment or proof that all proposed omissions are low value; grammar variety still needs editorial review. Results are in tests/sentence-redundancy-analysis.json.

Recommendation: offer an optional shorter core route after editorial review, with the complete bank still available and existing sentence IDs/progress retained. No sentence assets or orders are changed in this release.

# 1.17.0 focused audit follow-up

Implemented the Reader quiz, pronunciation identity, backlog, statistics, cadence, touch-target, read-state and offline-diagnostic fixes against main 52bebbc. See CHANGELOG.md for behaviour and migration details, TESTING.md for reproducible checks and verification limits. Storage keys, sentence IDs and entry-specific statuses are retained; no reset or reinstall is required. Left advances and right goes back; backward navigation intentionally does not count as reading.

The historical audit below is retained for context.

# HSK Reader 1.12 audit

Date: 1 November 2026. Scope: reset/persistence and PWA lifecycle, backup/import, lessons and finite card sessions, Reader review/quiz restore and word grading. The audit uses the actual static app, synthetic saved data, failure injection, existing regressions and a desktop Chromium smoke check. No user progress was erased during testing.

## Findings fixed

| Severity | Finding | Correction |
| --- | --- | --- |
| High | Reset deleted stored state, then reload/pagehide autosave wrote the old Reader state and draft back. | Freeze writes, cancel pending saves, clear memory, verify reset and start a new storage generation. Cold launches ignore obsolete generations. |
| High | A suspended older window could save pre-reset data later. | A reset changes the generation; updated stale windows reload and refuse writes, while older versions write obsolete keys. |
| High | Reset storage failures could produce a misleading reset. | Snapshot before changes, verify deletion and marker, roll back partial changes and report errors. If rollback itself fails, keep in-memory data available for export and block further saves. |
| Medium | An update could activate after Reader-state saving failed while the text draft saved successfully. | Require both saves before activation. |
| Medium | Imports could leave old quiz/writing dialogs or pending callbacks active. | Cancel pending work, close dialogs and reset transient models before rendering imported data. |
| Medium | Reset/undo of a lesson could retain a partially graded card session. | Invalidate the matching lesson session and deck. |
| Medium | Duplicate restored card IDs could prevent finite completion. | Deduplicate validated session IDs. |
| Medium | Malformed lesson plans or restored Reader quiz/order/review indexes could break startup or practice. | Normalize plans; validate question answers, options, order indexes and sentence/word references. |
| Medium | Grading 长 in Reader could affect the other pronunciation. | Carry contextual pinyin through details and grading to the distinct entry key. |
| Low | Quick quiz could advance without an answer; empty decks retained stale counters. | Guard next-question actions and reset empty/finished progress labels. |
| Medium | A stale Reload to update button could do nothing after another window activated the waiting worker. | Save current work, then reload directly when the worker is already active. |
| Low | Due counts could remain stale after app resume. | Refresh counts on visibility/pageshow and when opening Reader options. |

## Evidence

96 passing automated checks: 37 application, 16 simulated service-worker, 25 Reader and 18 lifecycle regressions. `tests/lifecycle-regression.cjs` reproduces reset, queued-save/pagehide, cold-launch, old-window and storage-failure cases using synthetic data. It also covers the related findings above. Existing suites cover dataset integrity, migrations, backup rollback, review schedules, finite sessions, safe rendering, writing data and offline-cache behavior. Desktop Chromium smoke checks cover normal navigation and Reader settings.

## Limits and remaining risks

- These checks do not establish that the app is bug-free. Physical iPhone/iPad PWA suspension/resume, storage eviction, touch/Apple Pencil, audio and keyboard behavior require device testing.
- Service-worker failure cases are simulated; OS-specific offline behavior is not certified.
- Concurrent normal edits/imports in multiple windows are not merged. The generation guard specifically protects resets; use one active study window.
- Browser storage has no atomic multi-key transaction. Reset verifies writes and attempts rollback, but a persistent storage failure can also block rollback; the app then reports the error and preserves its in-memory data for export.
- Safari tabs and an installed PWA may use separate storage. Reset affects the current installation; there is no cloud synchronization.

## Updating on iPhone

Load 1.12.1 first: use the app's update control when offered, or Settings → Install & offline to check for an update, then reload. After the updated app opens, use Reset progress again if desired and confirm it. Reopen the PWA to verify cleared totals/history. Export a backup first if any existing progress should be retained. Do not clear all Safari website data as an update step.
