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
