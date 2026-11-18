/* Standalone, session-only practice with one character per question. */
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

  function nextQuestion() {
    if (!deck.length) {
      deck = shuffle([...cards.values()]);
      if (deck[0] === current) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    if (gradedResult) {
      answeredCount++;
      if (gradedResult.correct) correctCount++;
    }
    current = deck.shift();
    result = gradedResult = null;
    render();
  }

  function render() {
    const question = current;
    const score = correctCount + Number(!!gradedResult?.correct);
    const total = answeredCount + Number(!!gradedResult);
    const samples = extras.tracingStyles?.[question.word];
    const canTeach = result && !result.correct && !result.skipped && QuizHandwriting.canSaveSample(result.ink[0]);
    const verdict = result ? result.skipped ? 'Skipped' : result.correct ? result.assisted ? 'Correct with help' : 'Correct' : 'Incorrect' : '';
    panel.innerHTML = `<article class="card tracing-card">
      <div class="tracing-heading">
        <h2>Tracing</h2>
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
        ${result?.readAs && !result.correct ? `<p class="small tracing-read-as">Read as <span lang="zh-Hans">${escapeHtml(result.readAs)}</span></p>` : ''}
        <p class="small tracing-error" role="status" data-ink-status></p>
        <div class="tracing-actions${result ? '' : ' tracing-entry-actions'}">${result ?
          `${result.correct ? '' : '<button id="tracingRetry">Retry</button>'}<button id="tracingNext" class="primary">Next character</button>` :
          '<button id="tracingSkip">Skip</button><button type="button" data-ink-undo aria-label="Undo last stroke">Undo</button><button type="button" data-ink-clear>Clear</button><button type="button" data-ink-check class="primary">Check</button>'}</div>
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

    const card = panel.firstElementChild;
    const valid = () => panel.firstElementChild === card && current === question && !result;
    const guesses = card.querySelector('.tracing-guesses');
    const status = card.querySelector('[data-ink-status]');
    const unclear = $('tracingUnclear');
    function teachSample(ink) {
      if (!confirm(`Is this your handwritten form of ${question.word}? This will count as correct and teach Tracing to accept similar writing next time.`)) return;
      const next = [...(samples || []), ink[0]].slice(-3);
      if (saveStyle(question.word, next)) finish(true, ink);
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
        $('tracingPrompt').focus({preventScroll: true});
      };
    } else {
      $('tracingSkip').onclick = () => finish(false, readInk(), {skipped: true});
    }
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

  function finish(correct, ink, {skipped = false, readAs, assisted = false} = {}) {
    result = gradedResult = {correct, ink, skipped, readAs, assisted};
    render();
    if (panel.classList.contains('active')) panel.querySelector('.tracing-feedback').focus({preventScroll: true});
  }

  window.openTracingPractice = () => {
    if (!current) nextQuestion();
  };
  window.resetTracingPractice = () => {
    deck = [];
    current = result = gradedResult = null;
    panel.replaceChildren();
    correctCount = answeredCount = 0;
    if (panel.classList.contains('active')) nextQuestion();
  };
})();
