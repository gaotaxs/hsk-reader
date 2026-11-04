## 1.15.1

- Removed native pinyin hover tooltips and full-button hover/pressed fills; keyboard focus uses a small underline or mask accent.
- Learning now uses a muted rose fill in both themes. Upward word pulls mark Learning globally with a downward spring return and Undo; downward pulls retain the Known/Unknown toggle. Only the Chinese word moves.
- Reader, vocabulary/workspace word popups, and flashcard writing guides use a compact word-left, metadata-right header. Tracing pads are 20% smaller.
- Read-and-next uses an accessible double-chevron icon. On phones, the sentence frame uses the available viewport height independently of the vocabulary disclosure; the expanded list scrolls below instead of shrinking or clipping the sentence.

## 1.15.0

- Reader is first and opens by default. Removed decorative headings, eyebrow copy and slogans while retaining accessible page names.
- Lesson starts/resumes the matching flashcard plan and displays the correct level and card count. Study totals, daily review and writing progress now live on Lessons.
- Pinyin buttons no longer enter pointer capture; taps reveal individual syllables without grading. Quiz close/resume restores the reading place, invalid legacy track types normalize, and stale review IDs cannot leave the preset reader empty.
- Reader progress measures read sentences across the selected track. Quick quizzes default to blocks of 20 sentences (10/20/30 configurable), with all vocabulary eligible and question count configured separately. Old word-based cadence migrates without removing read history or word progress.
- Vocabulary filters, count and search stay above the scrolling rows. Known/learning rows use themed fills; status pills are removed and reset uses an accessible icon.
- Settings use compact disclosure groups. The reader uses a centered gear icon. Quiz landing no longer shows an empty score card; fixed quiz shells reserve feedback space, enlarge choices, highlight incorrect and correct answers, and place the next arrow alongside feedback.
- Root npm test now runs the complete tests directory. Expanded regression coverage for pointer targeting, sentence cadence, vocabulary pools, quiz return/resume, and lesson navigation. Cache version: 1.15.0.

## 1.14.0

- Slimmed hidden-pinyin masks to 15px on compact screens / 16px on larger screens while retaining the full tap target. Replaced night-mode sage Known fills with a pale icy blue.
- Moved Known/Unknown feedback and Undo to a dedicated fixed-height row outside the translation area, so translation reveal/pinning cannot move it.
- Increased default Chinese and pinyin sizes modestly. Added measured syllable-width protection and responsive paired font fitting so longer sentences remain legible without overlap. Very narrow screens use a taller fixed card to retain the static sentence pane.

## 1.13.4

- Changed the night-mode Known-word fill to a soft sage green against the navy background. Day-mode blue fills and border-free styling remain unchanged.

## 1.13.3

- Increased Reader pinyin to 12px on compact screens and 14px on larger screens, with matching hint height and row clearance.
- Translation uses accessible eye and pin icon buttons with clear active states, eliminating long/unbalanced pin labels.
- Strengthened the blue Known fill in both themes and removed the curved token underlines.
- Downward pulls now toggle Known ↔ Unknown for the contextual word entry; Undo restores the previous status. Pinyin toggles remain display-only.

## 1.13.2

- Wrapped sentence rows share one left edge within a centred text block. Matching pinyin/Chinese column gaps and token insets centre each syllable over its character.
- Word pull uses elastic visual travel capped at 12px, retaining the deliberate 34px finger threshold. Increased row spacing protects the next row’s hints; the return bounce is limited to 2px above baseline.
- Removed the remaining inset border from Known/ready words in both themes; only the subtle blue fill remains.

## 1.13.1

- Known words use a faint light-blue cell fill and subtle inset border instead of a green outline, with a corresponding dark-theme tint.
- Pulling moves only the Chinese word button; pinyin stays anchored above its original position.
- Replaced inline line-breaking with measured, balanced flex rows. Each row aligns Chinese words on the same baseline with reserved spacing for the next row’s pinyin. Compound words and punctuation remain intact.

## 1.13.0

- Added downward word-pull grading: 34px threshold, direction locking, cancellation, spring-back animation, persistent green Known outline and an eight-second Undo action. Compound words and contextual pronunciations use shared app statuses.
- Horizontal phrase swipes navigate with a 55px threshold and preserve unread progress. Tap still opens definitions; pointer drags suppress accidental popup clicks. Pinyin toggles no longer grade vocabulary.
- Sentence view is static with native balanced line wrapping and font fitting for longer phrases. Card dimensions remain fixed; explicit passage view retains its longer-text reading behavior. Reduced-motion preferences skip the bounce animation.

## 1.12.5

- Replaced press-and-hold pinyin with a native tap toggle: Show pinyin / Hide pinyin. New sentences still begin concealed; individual hint pins and explicit Known grading remain separate.
- Sentence cards use a viewport-sized fixed frame with reserved translation space. Longer sentences, passages and translations scroll within their areas instead of moving the footer or resizing the card.

## 1.12.4

- Sentences open with pinyin concealed. Hold Pinyin with a pointer or Space/Enter to peek at unfamiliar hints; release, cancellation, lost focus or navigation ends the peek.
- Individual hint taps pin syllables for the current sentence. Default concealment and temporary peeks never grade words. Explicitly hiding every syllable retains the Known action and contextual pronunciation handling.
- Saved hint preferences determine temporary peeks; existing Known statuses are preserved. Updated settings labels explain peek behavior.

## 1.12.3

- Reader punctuation stays on the Chinese text baseline and wraps with the preceding word.
- Each character has its own pinyin toggle; compound words remain one definition/translation target. Hiding every syllable marks the compound Known; showing a hint does not demote it. Existing whole-word hint preferences remain supported.

## 1.12.2

- Hiding a word’s pinyin in Reader also marks its contextual dictionary entry Known. Revealing pinyin again keeps the Known status. Global Hide all remains a display preference. Added persistence and polyphonic grading coverage.

## 1.12.1

- Live verification found a stale update button could do nothing after another window activated the worker. It now saves current work and reloads when no worker is waiting. Added a regression; 96 checks pass.

## 1.12.0

- Fixed reset progress being undone by pagehide/autosave during reload. Reset now verifies deletion, clears pending/transient state and starts a separate storage generation; stale windows cannot resurrect cleared study data. Storage failures retain prior data where rollback succeeds and report failure.
- Update activation waits for both Reader state and draft saves. Imports close obsolete quiz/writing dialogs and cancel pending work.
- Resetting or undoing a lesson invalidates its active card session. Duplicate restored deck IDs, malformed lesson plans and invalid Reader quiz/review state are repaired.
- Reader grading distinguishes the two pronunciations of 长. Unanswered quick quizzes cannot advance; due counts refresh when returning to the app.
- Added 17 lifecycle regressions; 95 automated checks pass. See AUDIT.md for findings and verification limits.

## 1.11.0

- Added 192 original everyday-context sentences: totals are 421 HSK 2 and 1,181 HSK 3. Exact-token audit covers all 601 study entries at least once in their matching track; 203 have three or more examples, with remaining low-frequency entries explicitly reported.
- Balanced study order alternates everyday contexts with interleaved grammar patterns. Existing sentence IDs, read history and the current sentence are preserved; original order remains available.
- Reader settings add finite reviews of earlier sentences and vocabulary missed in quizzes. A simple sentence schedule uses 1/3/7/14/30 days; misses reset relevant material to a ten-minute retry. Review sessions preserve the main reading position and survive backups.
- Context-sensitive 长 and classifier 只 definitions/pronunciations are carried into word details and quiz feedback.

## 1.10.0

- Logo, navigation icons and collapse button share the same fixed horizontal centre in expanded and collapsed desktop navigation.
- Moved passage editing, saved texts, translation tools and dictionary attribution to a separate Workspace tab; Reader contains only the sentence study experience.
- Workspace opens the editor on compact screens, and “Read my text” switches to sentence Reader. Mobile navigation now has seven destinations.

## 1.9.0

- Bottom-anchored sidebar collapse control; removed footer flavour text to avoid collapse reflow.
- Reader track, pinyin, display mode and quiz preferences moved to the top-right settings gear and dialog.
- Sentence vocabulary is a collapsed disclosure card; text tools retain dictionary attribution.
- Quick quiz includes all covered words automatically. Mixed combines four Chinese/English/pinyin directions plus optional sentence order; removed word-selection UI.
- Mobile viewport frame anchors the header and navigation, limits scrolling to overflowing content, compacts reading/lesson/card layouts and hides flashcard deck controls behind Deck options. Long text, vocabulary and settings remain scrollable.

## 1.8.0

- Fixed sidebar row heights and removed the navigation eyebrow in both states; collapsing keeps the logo, header and navigation at the same vertical positions.
- Quick quiz opens vocabulary selection and question settings, then starts questions directly. Separate flashcard review no longer silently switches into a quiz.
- Reader options save a 10–30 sentence interval, maximum question count and meaning/pinyin preference. Completed quiz blocks reset the interval; unfinished quizzes resume and survive backup/import.
- Quiz distractors prefer vocabulary from the covered sentences; sentence reconstruction uses a sentence from the completed block.

## 1.7.0

- Collapsed navigation retains the top-left logo and hides floating labels.
- Separate pinyin hint buttons with theme-aware shaded placeholders; Chinese word buttons open definition and direct writing practice.
- Expanded practice bank to 340 HSK 2 and 1,070 HSK 3 sentences, preserving original IDs. Added reproducible controlled-pattern generator and audit samples.
- Passage view renders ten sentences at a time to keep the larger bank responsive.

## 1.6.0

- Static line navigation replaces distracting animated emoji.
- Sentence-first reader with 40 original bilingual sentences, adaptive pinyin visibility saved per word, pinned translations, favourites, sentence and passage modes, and pasted-text support.
- Supplemental 5,131-entry CC-CEDICT dictionary, separately licensed CC BY-SA 4.0 with attribution.
- Reading checkpoints every ten sentences; vocabulary flashcards feed into integrated meaning/pinyin and sentence-order quizzes every five or ten cards.
- Reading progress and practice sessions included in validated backups.

## 1.3.0

- Stroke-order modal with focus containment and close via X, Escape or backdrop.
- Replay/retry icon controls; underlying card shortcuts disabled while the modal is open.
- Slightly larger Chinese characters centred with navigation arrows.

## 1.2.0

- Compact fixed-height cards with fading bold pinyin per character and bold meaning below.
- Removed the secondary recall rating prompt from the study interface.
- Lessons count classified words, resume partial sessions, stop on a congratulations screen, and save the completed day once.
- Lessons button reflects today’s completion and offers the next day explicitly.

## 1.1.0

- Calming blue dark theme.
- Lessons landing: known-word progress for HSK 2 and 3, one-click study, collapsible planning and word details.
- Flashcards: swipe/drag left to reset as not known, up for learning, right for known; matching accessible buttons. Revisit words are available in the New words deck.
- Gesture cancellation, minimum travel, and click suppression prevent accidental flips.

# Changelog — 1.0

- Replaced stacked legacy CSS with a coherent ivory/green light theme and dark theme, consistent controls and responsive layouts. Phone tabs retain labels; tablet uses a compact labelled rail; desktop uses a reading workspace.
- Reduced phone clutter, improved reading typography, attached punctuation to the preceding highlighted word, and added spacing controls and Focus mode.
- Added named saved passages, passage familiarity counts and one-action unfamiliar-word decks.
- Preserved all 601 vocabulary records exactly. Fixed HSK 3 长 disappearing from vocabulary/decks and custom lesson decks silently substituting its HSK 2 reading. Each sense now supports independent status and scheduling.
- Fixed known-word highlighting filters breaking compound segmentation; added an explicit passage-wide selector for 长's reading.
- Added resumable flashcards, optional spaced review, a daily review goal and completion summaries. Kept existing manual status controls and all quiz directions.
- Added text feedback for correct/incorrect quiz answers and retained missed-question retries. Prevented duplicate keyboard handling on native buttons.
- Enlarged handwriting surfaces without CSS coordinate distortion, added sequential character navigation on tablet and phone, dark-mode ink, persistent completion counts, cancellation of obsolete writing sessions, and reduced-motion handling.
- Bundled Hanzi Writer 3.7.3 and the exact needed 622-character subset of hanzi-writer-data 2.0.1. Included upstream licences and provenance.
- Fixed nonexistent PWA icon paths. Added atomic, scoped offline caches, opt-in update activation, cache repair and installation status.
- Preserved legacy storage keys and captured a pre-upgrade snapshot. Extended JSON backups while retaining legacy fields. Added input validation, bounded settings, import rollback and truthful storage-failure messages.
- Kept translation opt-in for fresh installs, preserved prior settings, added request timeout/size checks and excluded translation from caching.
- Split HTML, CSS, data, app behaviour and PWA lifecycle into maintainable files. No framework, build or backend added.
