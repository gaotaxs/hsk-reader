# Regression report — HSK Reader 1.0

Completed 30 October 2026. Tests were run against the supplied application after the redesign, using synthetic progress data. No real user browser data was available in the source ZIP.

## Automated: 46 checks passed

**30 DOM/state/data checks** ran in Node with JSDOM, using the actual HTML, vocabulary and app JavaScript. They cover:

- Exact equality of every original vocabulary record and ordering; 303/298 level counts; both 长 pronunciations in vocabulary, lesson/custom decks and quizzes.
- Legacy settings, status and lesson migration; independent pronunciation status; preserved raw pre-upgrade snapshot.
- Stable compound matching when hiding known highlights; safe rendering of hostile text; punctuation preservation; explicit HSK3 reading selection.
- Lesson coverage when changing daily counts, completion and undo.
- Distinct quiz choices, answer locking, feedback, missed entries and disambiguated polyphonic prompts.
- One-day and ten-minute review scheduling, due filtering, unique daily counts, and restoration of exact flashcard pronunciation/reveal state.
- Named passage save/load and new/old backup import compatibility.
- Rejection of invalid JSON/field types/newer schemas; rollback after simulated storage quota failure; truthful failed-save feedback; bounded imported settings.
- Complete stroke/median data for all 622 characters; flash writing-panel interactivity; simulated writing completion accounting; document IDs and asset references.
- Over-limit translation sends no network request.

**16 service-worker checks** ran in a Node VM with simulated cache/network APIs. Both `/` and `/hsk-reader/` scopes passed complete installation, offline document and character retrieval, exclusion of translation requests, and explicit update activation. Separate tests verified that old-cache cleanup is scope-specific and a failed new install retains the prior version.

These are state/API simulations, not real-browser service-worker tests. Full results and repeatable test scripts are in `tests/`.

**Syntax:** `node --check` passed for the application, PWA lifecycle and service worker. Vocabulary parses successfully. All manifest icon paths and required local assets resolve within the release package.

## Browser checks performed

Desktop Chromium loaded the application at a nested `/hsk-reader/` URL through the managed preview. The following were exercised through UI controls:

- Six-area navigation, reader highlights and word dialog.
- Writing-library loading from local assets; larger trace mode, guide toggle and multi-character next/previous controls.
- Daily review creation, card reveal and Remembered grading.
- A two-question quiz with one intentionally wrong answer and one correct answer; completion showed 1/2 and offered missed-word retry.
- Vocabulary search for 长 showed both readings alongside 校长; the HSK3 word opened with **zhǎng — to grow; chief**.
- Light/dark theme switching and responsive layouts.

### Responsive measurements

All six areas were measured in **each** of these viewport simulations: 320×568, 375×812, 390×844, 844×390, 768×1024 and 1024×768. **36/36 panel/viewport combinations had document scroll width equal to client width**, with no page-level horizontal overflow. Desktop scrollbars reduce the effective width of some iframe viewports by 15px; these are CSS-size simulations, not device emulators.

Rendered screenshots were inspected for desktop reading, desktop word and trace dialogs, phone reading, phone vocabulary in both themes, and tablet landscape reading. The phone trace UI was also exercised and its accessible state checked. Screenshots are QA intermediates and are not shipped.

## Issues found and fixed during QA

- Reopened flashcard writing shell retained `inert`, blocking its controls.
- Non-trace writing status remained on “Loading” after the data arrived.
- Chinese punctuation could begin a new line after a highlighted word on a narrow screen.
- A broadly inserted “Due for review” option appeared in the stroke-data level selector.
- An initial cache-status check could report readiness before service-worker activation.

The final automated suites passed again after the corrections.

## Not verified

- Physical iPhone/iPad Safari, Apple Pencil input, palm rejection, voice playback, software-keyboard interactions, device safe areas and Home Screen installation.
- Real-browser offline reload and update lifecycle: the preview hostname was HTTP and not a secure context. HTTPS GitHub Pages behaviour was checked structurally and in the simulated worker harness, not in a deployed production browser.
- Successful live MyMemory translation, quality of sentence translation, downloaded Mandarin voices, or third-party service availability.
- VoiceOver/screen-reader certification, comprehensive WCAG compliance, old-browser compatibility, heavy-load performance on older phones, and simultaneous-tab state editing.

See README deployment smoke checks and LIMITATIONS.md before describing this as a physically validated iOS release.


## 1.1 gesture and lessons checks
33 application checks and 16 service-worker checks pass. Desktop browser: all three pointer-drag directions advance once and update status; blue dark theme and collapsed Lessons landing visually checked. Physical touch-device gestures still require device testing.

## 1.2 checks
35 application checks pass, including all 601 pinyin/character counts and idempotent lesson completion with session restoration. Desktop reveal layout inspected; touch-device testing remains outstanding.

## 1.3 checks
36 application and 16 service-worker checks pass. Browser verified modal rendering, tracing controls and backdrop dismissal. Physical touch-device testing remains outstanding.

## 1.6 sentence reader
37 existing application checks, 16 service-worker checks, and 12 new reading workflow checks pass. Reading tests cover original sentence/pinyin alignment, persistent per-word hints, translation pinning, the ten-sentence checkpoint, automatic quizzes after five reviewed cards, sentence reconstruction, backup round trips and pasted-text segmentation. Browser visually checked the new reader and practice entry. Physical touch-device checks remain outstanding.
