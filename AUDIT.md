# 1.18.0 quiz, compact History and focused-route follow-up

Started from current main `cf337d726a9c7cb4e13d03d38893c804ec265c0d` (1.17.0). Preserve existing storage keys, schema-2 backups, pronunciation-specific statuses, sentence IDs, read history, quiz snapshots and checkpoint backlog. No reset/reinstall/origin change is required. See TESTING.md for the fresh 200-check result, browser evidence and physical-device limits.

History is a separate main navigation item. Compact rows open a detail screen; missed words and review actions do not occupy index space. Previous answers remain immutable when browsing or retrying mistakes. Legacy individual correctness stays unavailable where not saved, while aggregate scores and reviewed positions remain intact. Accuracy color is supplemented by explicit numeric scores and accessible labels.

## Approved focused route

The full corpus remains 1,602 records: 40 introductory, 192 everyday-context and 1,370 generated variants across 55 pattern families. The default route includes 1,282 sentences: 337 HSK 2 and 945 HSK 3. It omits 84 and 236 generated variants respectively, a 19.98% overall reduction. Complete route is available in Reader settings.

The deterministic selector ranks variants by inverse study-vocabulary frequency, with explicit per-track budgets. Coverage checks retain every one of the 601 study identities in its matching level, at least min(3, original exposure count) examples per identity, all introductory/everyday examples and at least four variants per pattern family. Selected families/examples were inspected for repeated slot substitutions (time, place, person, meal/activity) rather than new grammatical structures. This is a constrained editorial reduction, not a claim of validated mastery, universal sense coverage or native-teacher certification. `node tools/analyze-sentence-redundancy.cjs` analyzes without editing; `--write-route` reproduces assets/sentence-route.js without deleting sentence records.

Stored numeric positions retain their full-bank interpretation. Displayed focused positions are mapped by sentence ID; forward/back/jump actions translate back to full-bank coordinates. A previously open omitted sentence is retained as a continuation anchor, so an existing installation can have a few extra focused rows rather than losing its exact place. Switching routes/orders preserves the current ID, read totals and cadence. Existing pending blocks use full-bank read IDs, preventing old omitted sentences from being starved. Favourites/review schedules/unfinished questions continue using the complete corpus.

Route migration is repeatable and additive. Failed saves keep the original persisted data and exportable in-memory state. Missing route data uses the complete bank without marking migration finished; a later successful load preserves the saved location. The route manifest participates in the shared atomic offline release. No vocabulary labels or mastery are inferred by pruning.

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
