# Release verification — 1.15.9

127 automated checks pass (37 application, 16 service-worker, 51 reader, 23 lifecycle). A failing duplicate-text regression reproduced two pasted sentences sharing one ID; the fix verifies distinct IDs and 1/2 then 2/2 read totals. Passage-mode regression verifies 10-sentence rendering and return to the same sentence without modifying read history.

Chromium at 402×874 reproduced Passage view overflow (2,600px content, 381px pane, overflow visible). After the fix, overflow is auto with 1,957px content in the 381px pane. Bottom controls stay at Y=662px in Passage and Sentence modes; returning restores one paragraph at 34px. A real quiz answer shows both the wrong and correct choices; closing restores the same Reader position. Physical iOS Safari/PWA remains unverified. The full 1.15.7 single-sentence geometry sweep remains recorded separately.

# Release verification — 1.15.7

125 automated checks pass: 37 application, 16 service-worker, 49 reader workflow, and 23 lifecycle. JavaScript syntax and CSS parsing pass. Reader regressions cover compact accessible icons, saved read state, unique marked-read counts, quiz cadence, pinyin behaviour, fixed completion control order, quiz return, saved progress and vocabulary disclosure animation.

Chinese uses a constant 34px across sentences and viewports, with 13px pinyin. Longer text expands the card and outer reader scrolls; no automatic font reduction is used. The line balancer preserves the greedy minimum number of lines, word groups and trailing punctuation, using the full available column up to 720px. Reserved scrollbar space keeps the column origin stable when content height changes. Translation remains in a fixed 88px slot.

The corpus sweep renders all 1,602 sentences with hints hidden/light and visible/dark at 320×700, 402×874, 768×1024 and 1280×800 (12,816 cases). Results and font ranges are recorded in tests/layout-audit-results.json. This is Chromium viewport testing; physical iPhone 16 Pro Safari/PWA and iOS accessibility text sizing remain unverified. No production study data was cleared.

# Release verification — 1.15.2

116 checks pass (37 core, 16 service-worker, 41 reader workflow, 22 lifecycle). Added asynchronous animation tests for opening/closing, rapid reversal/cancellation, and reduced motion. JavaScript syntax and CSS parsing pass. Browser rendering remains unverified because the browser runtime is unavailable.

# Release verification — 1.15.1

113 automated checks pass: 37 core, 16 service-worker, 41 reader workflow, and 19 lifecycle. New coverage verifies upward pull thresholds/cancellation, global Learning persistence, Undo, stationary pinyin, click suppression, tooltip removal, accessible forward icon, and compact guide/list structure. Existing downward swipe, contextual pronunciation, quiz, reset and backup checks remain passing. JavaScript syntax, HTML IDs and CSS parsing also pass.

The phone sentence frame is now measured independently of the expanded vocabulary list. Browser preview remained unavailable in this environment; actual mobile/iPad rendering and touch animation are unverified. No study progress was reset.

# Release verification — 1.15.0

Run `npm test` from the repository root (install the optional jsdom dependency first). The root command delegates to the full suite in tests/.

Automated release coverage: core vocabulary/application checks, service-worker cache lifecycle checks, reader workflow checks, and cross-window/reset/import lifecycle checks. Tests use synthetic data and preserve the exact original 601 vocabulary records and 1,602 sentences.

New regressions verify a 20-sentence quiz interval rather than a word count, all covered vocabulary remaining eligible independently of the question limit, overall sentence progress, separate pinyin pointer targets, incorrect/correct answer feedback, saved quiz state, reader track and position after exit/resume, recovery from stale review IDs, and lesson launch level/count. HTML ID uniqueness, settings nesting, JavaScript syntax and CSS parsing are also checked.

Browser QA limitation for this release: the supplied browser runtime was unavailable. Automated DOM/state tests do not verify actual phone/iPad rendering, touch hardware or iOS standalone PWA behaviour. Those remain unverified. No production browser storage was cleared or replaced.

## Previous verification history

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

## 1.7 reader polish and expanded bank
37 application, 16 service-worker and 15 reading workflow checks pass. Checks cover all 1,410 unique IDs and Chinese sentences, pinyin/character alignment, separate hint/definition actions, existing progress and backup behaviour, and all newly cached chunks. Representative examples from all 55 generated sentence patterns were reviewed and corrected. This does not establish native-speaker certification or strict official HSK vocabulary compliance. Desktop browser checks cover the collapsed logo, masked hints and word/writing popup; physical touch devices remain unverified.

## 1.8 sidebar and direct quiz
37 application, 16 service-worker and 19 reading workflow checks pass. New checks cover word selection, zero-selection validation, direct questions without flashcards, sentence reconstruction, finite completion, covered-sentence reset, interval bounds including 17/20/30 sentences, 30-question backup/resume, and separate finite flashcard review. Desktop browser measurements confirm identical Y coordinates and heights for the logo, all six navigation rows, header eyebrow and lesson intro before and after collapse. Browser checks exercise the ten-sentence prompt, quiz selection popup and direct question entry. Physical iOS/touch behaviour remains unverified.

## 1.9 compact mobile frame and simplified quiz
37 application, 16 service-worker and 20 reader checks pass. Reader checks cover collapsed vocabulary, settings-dialog controls, all-words quiz entry, five mixed question types, correct English-answer targets, finite results and lossless mixed-quiz backup/resume. Desktop checks confirm the collapse button stays 16px from the bottom in both sidebar states, without footer text. At 390×844 the Lessons, Reader, Flashcards and initial Quiz views fit the content viewport without scrolling; vocabulary and settings scroll for their longer content. All six views at 375×812 and 320×568 were checked for document overflow: the document remains exactly viewport sized with no horizontal overflow, while longer content scrolls inside the main area. These are Chromium iframe viewport simulations, not physical iOS/PWA or keyboard tests; short screens, large type, expanded vocabulary and long text can require scrolling.

## 1.10 alignment and Workspace separation
37 application, 16 service-worker and 21 reading workflow checks pass. The additional workflow check verifies that editing, custom-text entry and credits belong to Workspace, and that opening a passage switches to Reader. Desktop DOM measurements put the logo, every navigation icon and collapse control at X=45px before and after collapse, with unchanged vertical positions. At a 390px phone viewport, all seven navigation targets measure approximately 53px wide, the Workspace editor is accessible and document width remains 390px. Physical iOS/PWA checks remain outstanding.

## 1.11 coverage and reinforcement
37 application, 16 service-worker and 25 reading workflow checks pass (78 total). New reader checks cover all 601 exact-token study entries, balanced-order uniqueness/interleaving and position preservation, finite sentence review and interval scheduling, quiz-miss retry timing, relevant context selection, and persisted review state. All 1,602 sentences have unique IDs/text and aligned pinyin/Chinese-character counts. The contextual builder fails on missing pronunciations and documents selected polyphonic/sandhi overrides. Original examples were drafted/reviewed here, not independently certified by a native-language teacher. Coverage is at least one example per entry; it does not imply three contexts per entry, full coverage of every meaning or validated spaced-repetition effectiveness. Desktop browser exercised Reader settings, the new counts and an early review batch returning to the saved position. Physical iOS/PWA checks remain outstanding.

## 1.12 reset and comprehensive state audit

1 November 2026: **96 automated checks pass**: 37 application, 16 service-worker, 25 Reader and 18 new lifecycle checks. Run `npm test --prefix tests` from the app directory after installing the test dependencies. Lifecycle tests use actual app code and synthetic storage; they cover cold launches after reset, queued/pagehide saves, old-window writes, cancellation, partial deletion rollback, snapshot/marker failures, repeated reset, stale-window guards, update-save failures, import popup cleanup, lesson invalidation, malformed state, duplicate decks, polyphonic grading and unanswered quiz locking.

Desktop Chromium additionally loaded this release, navigated Reader and Settings, and checked the Reader options dialog. Reset itself was verified in the synthetic lifecycle harness rather than by deleting real browser progress. Physical iPhone Home Screen PWA installation, OS suspension, storage eviction, Apple Pencil and device audio remain unverified. See AUDIT.md for the scoped findings and limitations.

## 1.12.2 pinyin grading

97 checks pass: 37 application, 16 service-worker, 25 Reader and 19 lifecycle. Reader tests verify that hiding pinyin marks Known, both changes appear in backups, and revealing preserves Known. A contextual 长 regression verifies only zhǎng is marked when hiding that pronunciation. Global display preferences do not grade vocabulary.

## 1.12.3 reader typesetting and per-character hints

98 checks pass (37 application, 16 service-worker, 26 Reader, 19 lifecycle). The new regression covers independent 面/条 hints, Known only when both are hidden, persistence, compound definition/translation and punctuation grouping. Chromium at 390×844 displayed the reported sentence with 。 attached to 好吃 on its line; word and punctuation bounds shared the same top and bottom. Tapping 面 hid only miàn, leaving tiáo visible. Physical iPhone typography remains unverified.

## 1.12.4 Chinese-first reader

99 checks pass: 37 application, 16 service-worker, 27 Reader, 19 lifecycle. Reader checks cover concealed entry, pointer cancellation/release, keyboard hold/release, no grading during peeks, pinned syllables surviving peek release, concealment after sentence navigation and explicit hide-to-Known behavior. Existing compound and contextual pronunciation regressions remain in place.

## 1.12.5 stable reader card and tap pinyin

99 automated checks pass. The Reader interaction regression now verifies native click toggling, truthful button labels, unchanged grading, preserved pinned syllables and reset on sentence navigation. At a Chromium 390×844 iframe viewport, short and wrapped sentences used the same 514px card height and footer Y coordinate (586.58px), including after translation reveal. Card dimensions depend on viewport size, not sentence length; overflow scrolls inside reserved content areas. The mobile long-press interaction has been removed. Physical iOS PWA validation remains outstanding.

## 1.13.0 Reader gestures and line balance

101 automated checks pass (37 application, 16 service-worker, 29 Reader, 19 lifecycle). Gesture regressions cover short pulls, pointer cancellation, successful compound-word grading and backups, Undo, accidental definition-click suppression, horizontal navigation, first-sentence bounds and unchanged read history. The contextual 长 regression now grades by word pull and verifies only zhǎng is Known. Pinyin tests verify that hint toggling no longer grades words.

At Chromium 390×844, the reported sentence wraps as 你星期五有 / 时间游泳吗？; words and closing punctuation remain intact. A real browser pointer drag graded 游泳 and showed Undo with the count changing to 1 Known; a horizontal drag advanced to the next sentence without marking it read. These are mouse/pointer and CSS viewport checks, not physical iPhone/iPad PWA validation. Sentence text uses balanced wrapping and reduces font size down to 18px for constrained space; unusually long pasted sentences may exceed the static view and should be read with the explicit passage view.

## 1.13.1 baseline and word-only movement

102 automated checks pass: 37 application, 16 service-worker, 30 Reader, 19 lifecycle. The gesture regression verifies that only the Chinese button receives a drag transform, while the token containing the pinyin does not. A new balancing check covers row count, order and orphan avoidance. Chromium 390×844 checks show identical word Y coordinates within each row of both reported sentences: 咖啡 aligns with its neighbours; 我已经准备好 / 明天的考试了。 uses two separate rows with no overlapping hints. A real drag marks 咖啡 Known, returns it to its row, and shows the light-blue fill with no green outline. Physical Safari/PWA testing remains unverified.

## 1.13.2 aligned blocks and bounded pulls

102 automated checks pass. The word-pull regression now verifies a 45px pointer movement produces only 12px of visual movement, with no token/pinyin transform. Chromium 390×844 shows both lines of 我已经准备好 / 明天的考试了。 at X=85px, with identical word baselines within each line. Before the final 1px inset adjustment, syllable/character centres differed by only 0.5px; the adjustment matches the hint grid to the Chinese content width. Row spacing leaves clearance below a fully pulled first-row word before the next hint row. Known/ready styling removes outlines and box shadows in both themes. Physical iPhone/iPad PWA checks remain unverified.

## 1.13.3 Reader controls and reversible grading

104 automated checks pass: 37 application, 16 service-worker, 32 Reader, 19 lifecycle. New checks cover pulling a Known compound to Unknown, removing the Known class, Undo back to Known, and accessible icon/pin state. Existing contextual-pronunciation and global backup/status checks pass. Chromium 390×844 exercised eye reveal, active pin and pinyin reveal; computed pinyin is 12px and token bottom border is 0px. The physical iOS PWA remains unverified.

## 1.14.0 slimmer masks, fixed feedback and corpus sweep

105 automated regression checks pass (37 application, 16 service-worker, 33 Reader, 19 lifecycle). The new DOM check verifies the feedback slot sits outside translation flow. A real pointer grade followed by translation reveal measured feedback at Y=550.58px in both states at 390×844.

The full 1,602-sentence bank passed 12,816 Chromium layout cases: 320×568, 390×844, 768×1024 and 1280×800, each with hidden/light and visible/dark hints. Guards reject hidden/unmeasurable panes. Checks cover pane overflow, word clipping, row alignment, top hint clearance and pinyin exceeding its column. All four viewports returned zero failures. Test-only entry points use the actual sentence data, segmenter, markup and fitting functions. Results are in tests/layout-audit-results.json.

Default Chinese is modestly larger (up to 30.81px at 390px wide, 38px on larger screens); long sentences scale Chinese/pinyin together when needed. Font ranges are reported in the JSON. Very narrow 320px screens use a taller 580px fixed card, so the outer main area can scroll while the sentence pane remains static. This is a Chromium geometry sweep and visual spot-check, not physical iPhone/iPad or OS accessibility-text-size certification.
