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

  let deck = [], current, result, correctCount = 0, answeredCount = 0;

  function nextQuestion() {
    if (!deck.length) {
      deck = shuffle([...cards.values()]);
      if (deck[0] === current) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    current = deck.shift();
    result = null;
    render();
  }

  function render() {
    const question = current;
    const verdict = result ? result.skipped ? 'Skipped' : result.correct ? 'Correct' : 'Incorrect' : '';
    panel.innerHTML = `<article class="card tracing-card">
      <div class="tracing-heading">
        <h2>Tracing</h2>
        <p class="small" aria-label="${correctCount} correct out of ${answeredCount}">${correctCount} / ${answeredCount}</p>
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
        <p class="small tracing-error" role="status" data-ink-status></p>
        <div class="tracing-actions">${result ?
          '<button id="tracingNext" class="primary">Next character</button>' :
          '<button id="tracingSkip">Skip</button><button type="button" data-ink-clear>Clear</button><button type="button" data-ink-check class="primary">Check</button>'}</div>
      </div>
    </article>`;

    const valid = () => current === question && !result;
    const readInk = QuizHandwriting.mount($('tracingInput'), {
      savedInk: result?.ink,
      valid,
      check: async ink => {
        const {medians} = await localCharacterLoader(question.word);
        if (valid()) finish(QuizHandwriting.matches(ink[0], medians), QuizHandwriting.snapshot(ink));
      }
    });

    if (result) {
      $('tracingNext').onclick = () => {
        nextQuestion();
        $('tracingPrompt').focus({preventScroll: true});
      };
    } else {
      $('tracingSkip').onclick = () => finish(false, readInk(), true);
    }
  }

  function finish(correct, ink, skipped = false) {
    result = {correct, ink, skipped};
    answeredCount++;
    if (correct) correctCount++;
    render();
    if (panel.classList.contains('active')) panel.querySelector('.tracing-feedback').focus({preventScroll: true});
  }

  window.openTracingPractice = () => {
    if (!current) nextQuestion();
  };
  window.resetTracingPractice = () => {
    deck = [];
    current = result = null;
    correctCount = answeredCount = 0;
    if (panel.classList.contains('active')) nextQuestion();
  };
})();
