# HSK Reader 1.8

The Reader now opens a sentence-first study space with 1,410 bilingual practice sentences (340 HSK 2 and 1,070 HSK 3), pasted-text reading, remembered word-level pinyin choices, translation reveal/pinning, sentence and word favourites, and progress saved in backups. Choose a quiz interval of 10–30 read sentences in Reader options. Quick quiz opens a word-selection popup, then starts multiple-choice questions directly; choose question count, meaning/pinyin mode and optional sentence reconstruction. Flashcard review stays separate. Finished quizzes reset the sentence interval, and unfinished quizzes can be resumed. Quiz types include meaning/pinyin recognition and sentence reconstruction. The supplemental 5,131-entry CC-CEDICT reading dictionary is separately licensed CC BY-SA 4.0; see vendor/READING-DICTIONARY-NOTICE.txt. Pasted text uses dictionary segmentation and default pronunciations, which can be wrong for ambiguous words. The expanded bank uses 55 reviewed sentence patterns with controlled variants; it is practice material, not an official HSK syllabus or a native-teacher-certified corpus. Regenerate it with `python tools/build-sentence-bank.py`; representative patterns and counts are in `tools/sentence-bank-audit.json`. Original sentence IDs are preserved for saved progress. Preset translations are bundled; full-sentence translations for arbitrary pasted text are not bundled.

A static, local-first Chinese reading and study app. No build step, account, backend, paid hosting or API key is required. All six original areas remain: Reader, Vocabulary, Lessons, Flashcards, Quiz and Settings.

## Deploy to your existing GitHub Pages repository

1. In the **old app**, use **Settings → Download backup** before replacing files. Keep this JSON on your device. Do not clear Safari or browser website data.
2. Extract the release ZIP. Upload **its contents** to the existing Pages publishing directory, replacing `index.html`, `manifest.json`, `sw.js` and matching assets. The ZIP has no extra parent folder. Keep the `assets/` and `vendor/` folders intact. Keep the same GitHub account, repository and Pages address.
3. If your repository publishes from `main / (root)`, place the files in the repository root. If it publishes from `/docs`, put all these files in `/docs` instead. Do not put the ZIP itself on Pages as the app.
4. In GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, your existing branch, and the directory from step 3. Save. If Pages is already configured this way, leave its configuration unchanged.
5. Wait for the Pages deployment to finish, then open your existing HTTPS Pages URL. Refresh once after the first upgrade if the old app remains visible. The app supports a subdirectory such as `https://username.github.io/hsk-reader/`; paths are relative.
6. Open **Settings → Install & offline**. Keep the app open until it says **Offline copy ready**. This includes the app, vocabulary, writing library and all 622 characters. Then close and reopen it in airplane mode as a real-device check.
7. Check your Known/Learning totals and lesson history. The total now counts **601 entries** instead of 600 written forms because both pronunciations of 长 are included. Import the JSON backup if you deliberately changed browser/origin or moved between browser and installed-app storage.

The three existing icons are retained. Their previously broken `/icons/` references are corrected to the actual root filenames. `.nojekyll` is included; it is optional for these plain static assets.

## Install on iPhone or iPad

Open the **HTTPS Pages URL in Safari**, tap **Share → Add to Home Screen**, and open the installed icon. Finish the first online load before relying on offline access. A file opened from Files, an attachment preview, and a Safari-installed app may have different storage. Export/import a backup to transfer progress; no cloud synchronization is provided.

Do not test the PWA by double-clicking `index.html`: `file://` does not provide reliable service workers or JSON fetching. For local desktop development, serve this directory with a static server, for example `python -m http.server 8000`, then open `http://localhost:8000/`.

## What to use

- **Reader:** paste text, open a word, mark its status or practise writing. Reading preferences offer pinyin, meanings, text size and line spacing. Focus hides the surrounding controls. Review unfamiliar words creates a flashcard deck from the passage.
- **Saved passages:** give the current text a title and save it. Open and delete stored passages from the collection. Replacing an existing title asks first; opening another passage keeps an Undo copy of the previous draft. Limit: 100 passages, 200,000 characters each, subject to browser storage quota.
- **Vocabulary:** search Chinese, pinyin with or without tone marks, and English. Filter by level/status and study the results. Both 长 entries appear independently.
- **Lessons:** preserve the existing daily plans, complete/undo a study day, change daily size without re-counting already covered words, and study the current lesson.
- **Flashcards:** the exact deck, current position and reveal state resume after reopening. Reveal both pinyin and meaning to use **Again / Remembered**. Existing Known/Learning buttons remain available as manual labels.
- **Review schedule:** Remembered schedules the next review in 1, 3, 7, 14, 30, then 60 days. Again schedules 10 minutes later and resets the next successful interval to one day. This is a simple optional schedule, not FSRS or a validated mastery model. Daily progress counts distinct rated entries. Unscheduled Learning entries join the due queue. If none are due, daily practice introduces up to your goal of unseen, unscheduled entries.
- **Quiz:** retains every original direction, with explicit correct-answer feedback and missed-word retries. A wrong answer marks a New entry Learning; it does not demote a Known entry or independently change the review schedule.
- **Writing:** choose Trace practice for a larger, viewport-sized pad. Multi-character words use previous/next character controls on every screen size. Hide/show the guide, retry or leave tracing. Completed-character counts and mistakes are saved. Rotating/resizing during tracing restarts the current trace attempt.

## Data and compatibility

The exact supplied dataset is retained: **303 HSK 2 records + 298 HSK 3 records = 601 records / 600 written forms**. It is a curated list, not a claim about the current official HSK syllabus.

Existing storage keys are retained: `hskReaderSettings.v01`, `hskReaderStatuses.v01`, `hskReaderLessons.v01`, `hskReaderDraft.v01`, `hskReaderLastTab.v01`, `hskReaderTranslationConsent.v01`, and the sidebar preference. New state uses `hskReaderStudio.v1`. The first run also preserves the raw legacy settings/statuses/lessons/draft/tab in `hskReaderPreStudioBackup.v1` for manual recovery. Reset progress explicitly removes both old and new study state after confirmation.

A legacy status on 长 initially applies to both readings. Later edits use `长::cháng` and `长::zhǎng` independently. New exports retain the old `settings`, `statuses`, `lessons` and `readerText` fields, add full `entryStatuses` and `studio` fields, and declare schema version 2. The legacy aggregate for 长 is Known only when both senses are Known; otherwise it is Learning when either is engaged. Older apps cannot represent separate senses, schedules or saved passages, so use the new app for a lossless round trip.

Old JSON backups remain importable. Fields absent from an old backup leave the saved-passage/review collection intact. Imports validate before changing live state and roll back persisted keys if a write fails. Browser storage is best-effort; download backups regularly. Quota failures are shown instead of claiming a save succeeded. Progress is not shared across devices or browsers. Avoid editing the app simultaneously in multiple tabs; cross-tab conflict resolution is not implemented.

## Offline and updates

The service worker downloads an entire release before installing it. A new release waits for **Update ready**, which saves the draft and reloads when you choose. **Check for updates** requests a check. **Repair offline copy** refreshes only this app's scoped cache and retains local study data. Export a backup first if the browser reports storage errors.

For future releases, increment `VERSION` in `sw.js` whenever any cached asset changes. Upload the complete release in one commit. Cache names include the Pages path, so different installations do not delete each other's caches. Unrelated requests, including online translation, are not intercepted or stored.

No application telemetry, third-party fonts, or runtime CDN dependency is included. Online translation is off for fresh installs; existing preferences are preserved. Enabling it asks for consent before sending text to MyMemory. Requests are not cached by this app, have a timeout, and are limited to 500 UTF-8 bytes; longer text falls back to the local glossary. That glossary is a word list, not a sentence translation. MyMemory's own handling of received text is outside this app's control. Speech uses the device/browser speech engine and may depend on downloaded voices or an online service.

## Files and optional developer tests

`index.html` contains the UI; `assets/app.css` its responsive design; `assets/vocabulary.js` the unaltered records; `assets/app.js` study behaviour; `assets/pwa.js` update UI; `sw.js` offline caching. `vendor/` contains the pinned writing library, character bundle and required notices. See `CHANGELOG.md`, `TESTING.md`, `LIMITATIONS.md`, and `vendor/NOTICE.md`.

No tests or package installation are required to deploy. Developers can run `node tests/sw-regression.cjs` with Node 22+. To run the DOM regression suite, run `npm install` inside `tests/`, then `npm test` there. Do not upload the resulting `node_modules/` folder. Tests use isolated fake storage and sample text, not user data.
