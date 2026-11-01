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
