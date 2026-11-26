/* Standalone handwriting practice with a session score and persistent mastery. */
(() => {
  const panel = $('tracing');
  const cards = new Map();
  for (const entry of VOCAB) {
    if (entry.word.length === 1 && isChineseChar(entry.word) &&
        !entry.english.includes(entry.word) && !cards.has(entry.word)) {
      cards.set(entry.word, entry);
    }
  }

  let deck = [], current, result, gradedResult, correctCount = 0, answeredCount = 0;
  let reviewMastered = false;
  let hsk3Unlocked = false;
  const knownHsk2 = () => HSK2.filter(entry => statusOf(entryKey(entry)) === 'known').length;
  const eligible = entry => entry.level === 2 || hsk3Unlocked;
  const inCurrentMode = entry => eligible(entry) && (traceProgress(entry.word) === 3) === reviewMastered;
  const reviewTime = entry => extras.traceReviewDue[entry.word];
  const icons = {
    skip: '<path d="M8.8 8.3a3.25 3.25 0 0 1 6.5.15c0 2.6-3.3 2.95-3.3 5.55"/><path d="M12 18h.01"/>',
    undo: '<path d="M4 9h10a5 5 0 1 1 0 10h-3M8 5 4 9l4 4"/>',
    clear: '<path d="m7.5 19-4-4a2 2 0 0 1 0-2.8l8.7-8.7a2 2 0 0 1 2.8 0l5.5 5.5a2 2 0 0 1 0 2.8L13.2 19H7.5ZM9 7l8 8m-4 4h8"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  function actionIcon(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  }

  function refreshLevelGate() {
    const unlocked = knownHsk2() === HSK2.length;
    if (unlocked !== hsk3Unlocked) deck = [];
    hsk3Unlocked = unlocked;
  }

  function makeDeck() {
    const today = todayISO();
    const tickets = [];
    for (const entry of cards.values()) {
      if (!inCurrentMode(entry) || reviewTime(entry)) continue;
      const days = extras.traceSuccessDays[entry.word] || [];
      // Shuffle tickets, then visit each eligible character once per round.
      const familiarity = statusOf(entryKey(entry)) === 'known' ? 1 : 5;
      const level = entry.level === 2 ? 2 : 1;
      const credit = reviewMastered ? 1 : days.includes(today) ? 1 : 2 + days.length;
      for (let i = 0; i < familiarity * level * credit; i++) tickets.push(entry);
    }
    return uniq(shuffle(tickets));
  }

  function nextQuestion() {
    refreshLevelGate();
    if (!deck.length) {
      deck = makeDeck();
      if (deck.length > 1 && deck[0] === current) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    if (gradedResult) {
      answeredCount++;
      if (gradedResult.correct) correctCount++;
    }
    const now = Date.now();
    const due = [...cards.values()].filter(entry => inCurrentMode(entry) && reviewTime(entry) <= now)
      .sort((a, b) => reviewTime(a) - reviewTime(b));
    const returning = due.find(entry => entry !== current) || (!deck.length ? due[0] : undefined);
    current = returning || deck.shift();
    result = gradedResult = null;
    render();
  }

  function render() {
    const question = current;
    const score = correctCount + Number(!!gradedResult?.correct);
    const total = answeredCount + Number(!!gradedResult);
    if (!question) {
      const waiting = [...cards.values()].some(entry => inCurrentMode(entry) && reviewTime(entry));
      const message = waiting ? 'The remaining characters are waiting for another review.' :
        reviewMastered ? 'No mastered characters to review.' : hsk3Unlocked ?
        'All Tracing characters are mastered.' : 'All HSK 2 Tracing characters are mastered.';
      panel.innerHTML = `<article class="card tracing-card"><p>${message}</p>${waiting ? '<button id="tracingRecheck" type="button">Check for reviews</button>' : ''}</article>`;
      if (waiting) $('tracingRecheck').onclick = nextQuestion;
      renderPracticeOptions();
      return;
    }
    const samples = extras.tracingStyles?.[question.word];
    const canTeach = result && !result.correct && !result.skipped && QuizHandwriting.canSaveSample(result.ink[0]);
    const verdict = result ? result.skipped ? 'Skipped' : result.correct ? result.assisted ? 'Correct with help' : 'Correct' : 'Incorrect' : '';
    panel.innerHTML = `<article class="card tracing-card">
      <div class="tracing-heading">
        <span class="small trace-progress" data-trace-progress title="Write correctly without help on three different days.">${traceProgressLabel(question.word)}</span>
        <p class="small" aria-label="${score} correct out of ${total}">${score} / ${total}</p>
      </div>
      <div class="tracing-prompt" id="tracingPrompt" tabindex="-1">
        <p lang="zh-Latn">${escapeHtml(question.pinyin)}</p>
        <p>${escapeHtml(question.english)}</p>
      </div>
      <div class="tracing-input" id="tracingInput">
        <svg class="quiz-trace-pad" viewBox="0 0 240 240" role="img" aria-label="${result ? 'Your drawing' : 'Blank handwriting pad'}">
          <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></g>
        </svg>
        <div class="tracing-feedback" role="status" tabindex="-1">${result ?
          `<span class="${result.correct ? 'tracing-correct' : ''}">${verdict}</span><strong lang="zh-Hans">${escapeHtml(question.word)}</strong>` :
          '<p class="small">Write the character from memory.</p>'}</div>
        ${result?.saveFailed ? '<p class="small tracing-read-as" role="status">Tracing progress could not be saved. Export a backup before closing.</p>' : ''}
        ${result?.readAs && !result.correct ? `<p class="small tracing-read-as">Read as <span lang="zh-Hans">${escapeHtml(result.readAs)}</span></p>` : ''}
        <p class="small tracing-error" role="status" data-ink-status></p>
        <div class="tracing-actions${result ? ' tracing-result-actions' : ' tracing-entry-actions'}">${result ?
          `${result.correct ? '' : '<button id="tracingRetry">Retry</button>'}<button id="tracingNext" class="primary" aria-label="Next character">Next</button>` :
          `<button type="button" id="tracingSkip" aria-label="Skip" title="Skip">${actionIcon('skip')}</button>
          <button type="button" data-ink-undo aria-label="Undo last stroke" title="Undo last stroke">${actionIcon('undo')}</button>
          <button type="button" data-ink-clear aria-label="Clear drawing" title="Clear drawing">${actionIcon('clear')}</button>
          <button type="button" data-ink-check class="primary" aria-label="Check drawing" title="Check drawing">${actionIcon('check')}</button>`}</div>
        ${result ? '' : `<section class="tracing-guesses" aria-label="Handwriting choices" hidden>
          <p class="small" tabindex="-1">Which character did you write?</p>
          <div class="tracing-guess-list"></div>
          <button type="button" id="tracingNone">None of these</button>
        </section>
        <div class="tracing-actions tracing-style-actions" id="tracingUnclear" hidden>
          <button type="button" id="tracingTeachUnclear">Save my writing</button>
        </div>` }
        ${canTeach || (result && samples?.length) ? `<div class="tracing-actions tracing-style-actions">
          ${canTeach ? '<button id="tracingTeach" type="button">Save my writing</button>' : ''}
          ${samples?.length ? '<button id="tracingForget" type="button">Forget saved writing</button>' : ''}
        </div>` : ''}
      </div>
    </article>`;

    renderPracticeOptions();
    const card = panel.firstElementChild;
    const valid = () => panel.firstElementChild === card && current === question && !result &&
      (question.level === 2 || knownHsk2() === HSK2.length);
    const guesses = card.querySelector('.tracing-guesses');
    const status = card.querySelector('[data-ink-status]');
    const unclear = $('tracingUnclear');
    function teachSample(ink) {
      if (!confirm(`Is this your handwritten form of ${question.word}? This will count as correct and teach Tracing to accept similar writing next time.`)) return;
      const next = [...(samples || []), ink[0]].slice(-3);
      if (saveStyle(question.word, next)) finish(true, ink, {taught: true});
    }
    function unreadable(ink) {
      guesses.hidden = true;
      unclear.hidden = !QuizHandwriting.canSaveSample(ink[0]);
      status.textContent = 'Couldn’t read that. Add ink or clear the pad and try again.';
      $('tracingTeachUnclear').onclick = () => teachSample(ink);
    }
    const readInk = QuizHandwriting.mount($('tracingInput'), {
      savedInk: result?.ink,
      valid,
      onEdit: () => {
        if (guesses) guesses.hidden = true;
        if (unclear) unclear.hidden = true;
      },
      check: async ink => {
        const bundle = await loadCharacterBundle();
        if (!valid()) return;
        const ranked = QuizHandwriting.rankCharacters(ink[0], bundle, extras.tracingStyles);
        const savedInk = QuizHandwriting.snapshot(ink);
        const [first, second] = ranked;
        if (!first) return unreadable(savedInk);
        const structured = QuizHandwriting.clearStructureMatch(ink[0], bundle, ranked);
        if (structured) {
          finish(structured === question.word, savedInk, {readAs: structured});
          return;
        }
        const clearLead = !second || second.score - first.score >= 0.014;
        if (clearLead && first.score <= 0.055 &&
            (QuizHandwriting.matchesPersonal(ink[0], first.character, extras.tracingStyles) ||
              QuizHandwriting.recognizes(ink[0], first.character, bundle))) {
          finish(first.character === question.word, savedInk, {readAs: first.character});
          return;
        }
        const choices = ranked.slice(0, 3).filter(entry => entry.score - first.score <= 0.045);
        if (choices.length < 2) return unreadable(savedInk);
        guesses.hidden = false;
        unclear.hidden = true;
        status.textContent = '';
        const list = guesses.querySelector('.tracing-guess-list');
        list.replaceChildren(...choices.map(({character}) => {
          const option = document.createElement('button');
          option.type = 'button';
          option.lang = 'zh-Hans';
          option.textContent = character;
          option.onclick = () => finish(character === question.word, savedInk, {readAs: character, assisted: true});
          return option;
        }));
        $('tracingNone').onclick = () => unreadable(savedInk);
        guesses.querySelector('p').focus({preventScroll: true});
        guesses.scrollIntoView({block: 'nearest'});
      }
    });

    if (result) {
      const teach = $('tracingTeach');
      if (teach) teach.onclick = () => teachSample(result.ink);
      const forget = $('tracingForget');
      if (forget) forget.onclick = () => {
        if (confirm(`Forget your saved writing for ${question.word}?`) && saveStyle(question.word, [])) {
          render();
          $('tracingNext').focus({preventScroll:true});
        }
      };
      const retry = $('tracingRetry');
      if (retry) retry.onclick = () => {
        result = null;
        render();
        $('tracingPrompt').focus({preventScroll: true});
      };
      $('tracingNext').onclick = () => {
        nextQuestion();
        $('tracingPrompt')?.focus({preventScroll: true});
      };
    } else {
      $('tracingSkip').onclick = () => finish(false, readInk(), {skipped: true});
    }
  }

  function renderPracticeOptions() {
    panel.querySelector('.tracing-practice-options')?.remove();
    const options = document.createElement('div');
    options.className = 'tracing-practice-options';
    if (!hsk3Unlocked) {
      const hint = document.createElement('p');
      hint.className = 'small';
      hint.textContent = `HSK 3 unlocks when all HSK 2 words are Known (${knownHsk2()}/${HSK2.length}).`;
      options.append(hint);
    }
    if (reviewMastered || [...cards.values()].some(entry => eligible(entry) && traceProgress(entry.word) === 3)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tracing-mode';
      button.textContent = reviewMastered ? 'Practise unmastered' : 'Review mastered';
      button.onclick = () => {
        if (!result && panel.querySelector('.quiz-trace-pad g path') &&
            !confirm('Switch practice and discard the current drawing?')) return;
        reviewMastered = !reviewMastered;
        deck = [];
        nextQuestion();
        (panel.querySelector('#tracingPrompt') || panel.querySelector('.tracing-mode'))?.focus({preventScroll:true});
      };
      options.append(button);
    }
    if (options.childElementCount) panel.append(options);
  }

  function saveStyle(word, samples) {
    const before = extras.tracingStyles;
    const next = {...before};
    if (samples.length) next[word] = samples;
    else delete next[word];
    extras.tracingStyles = next;
    if (saveExtras()) return true;
    if (before) extras.tracingStyles = before;
    else delete extras.tracingStyles;
    panel.querySelector('[data-ink-status]').textContent = 'Could not save your writing.';
    return false;
  }

  function finish(correct, ink, {skipped = false, readAs, assisted = false, taught = false} = {}) {
    const independent = correct && !assisted && !taught;
    const updated = independent && recordTraceSuccess(current.word);
    const hadReview = Boolean(reviewTime(current));
    if (!independent) {
      // Give the learner time away from the answer before prompting it again.
      extras.traceReviewDue[current.word] = Date.now() + 120000 + Math.floor(Math.random() * 240001);
    } else if (hadReview) {
      delete extras.traceReviewDue[current.word];
    }
    const saveFailed = (updated || hadReview || !independent) && !saveExtras();
    result = gradedResult = {correct, ink, skipped, readAs, assisted, saveFailed};
    render();
    if (panel.classList.contains('active')) panel.querySelector('.tracing-feedback').focus({preventScroll: true});
  }

  window.openTracingPractice = () => {
    refreshLevelGate();
    if (!current || !eligible(current)) nextQuestion();
    else {
      panel.querySelector('[data-trace-progress]').textContent = traceProgressLabel(current.word);
      renderPracticeOptions();
    }
  };
  window.resetTracingPractice = () => {
    deck = [];
    reviewMastered = false;
    current = result = gradedResult = null;
    panel.replaceChildren();
    correctCount = answeredCount = 0;
    if (panel.classList.contains('active')) nextQuestion();
  };
})();
