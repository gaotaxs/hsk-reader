/* Compare freehand ink with the bundled character medians, independent of stroke order. */
const QuizHandwriting = (() => {
  function sample(strokes) {
    const points = strokes.flat();
    if (points.length < 2) return [];
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    const extent = Math.max(right - left, bottom - top);
    if (!extent) return [];
    const xCenter = (left + right) / 2, yCenter = (top + bottom) / 2;
    return strokes.flatMap(stroke => {
      const normalized = stroke.map(([x, y]) => [(x - xCenter) / extent, (y - yCenter) / extent]);
      const samples = normalized.slice(0, 1);
      for (let i = 1; i < normalized.length; i++) {
        const [x, y] = normalized[i - 1];
        const dx = normalized[i][0] - x, dy = normalized[i][1] - y;
        const steps = Math.ceil(Math.hypot(dx, dy) / 0.035);
        for (let j = 1; j <= steps; j++) samples.push([x + dx * j / steps, y + dy * j / steps]);
      }
      return samples;
    });
  }

  function fits(points, reference, tolerance) {
    let total = 0, far = 0;
    for (const [x, y] of points) {
      let nearest = Infinity;
      for (const [rx, ry] of reference) nearest = Math.min(nearest, (x - rx) ** 2 + (y - ry) ** 2);
      const distance = Math.sqrt(nearest);
      total += distance;
      if (distance > tolerance * 2) far++;
    }
    return total / points.length <= tolerance && far / points.length <= 0.13;
  }

  function matches(ink, medians) {
    const xs = ink.flat().map(point => point[0]), ys = ink.flat().map(point => point[1]);
    if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 16) return false;
    const drawn = sample(ink);
    const reference = sample(medians.map(stroke => stroke.map(([x, y]) => [x, -y])));
    const tolerance = medians.length >= 8 ? 0.079 : 0.068;
    return drawn.length > 0 && reference.length > 0 &&
      fits(drawn, reference, tolerance) && fits(reference, drawn, tolerance);
  }

  function mount(host, {check, valid}) {
    const pad = host.querySelector('svg'), lines = pad.querySelector('g');
    const clear = host.querySelector('[data-ink-clear]'), submit = host.querySelector('[data-ink-check]');
    const status = host.querySelector('[role="status"]');
    let strokes = [], pointer = null, stroke = null, path = null, busy = false;
    const setControls = () => {
      clear.disabled = busy || !strokes.length;
      submit.disabled = busy || pointer !== null || !strokes.length;
    };
    function point(event) {
      const rect = pad.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top].map(value =>
        Math.min(240, Math.max(0, Math.round(value * 240 / rect.width))));
    }
    function add(event) {
      const next = point(event);
      const previous = stroke.at(-1);
      if (previous && Math.hypot(next[0] - previous[0], next[1] - previous[1]) < 1.5) return;
      if (stroke.length >= 256) return;
      stroke.push(next);
      path.setAttribute('d', 'M' + stroke.map(p => p.join(' ')).join(' L') +
        (stroke.length === 1 ? ' l0.01 0' : ''));
    }
    pad.addEventListener('pointerdown', event => {
      if (busy || pointer !== null || event.button !== 0 || event.isPrimary === false || strokes.length >= 48) return;
      event.preventDefault();
      pointer = event.pointerId;
      pad.setPointerCapture?.(pointer);
      stroke = [];
      strokes.push(stroke);
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lines.append(path);
      add(event);
      status.textContent = '';
      setControls();
    });
    pad.addEventListener('pointermove', event => {
      if (pointer === event.pointerId) add(event);
    });
    function finish(event) {
      if (pointer !== event.pointerId) return;
      if (event.type === 'pointerup') add(event);
      if (event.type === 'pointercancel') {
        strokes.pop();
        path.remove();
      }
      pointer = null;
      setControls();
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, finish);
    clear.onclick = () => {
      strokes = [];
      pointer = null;
      lines.replaceChildren();
      status.textContent = '';
      setControls();
    };
    submit.onclick = async () => {
      if (submit.disabled) return;
      busy = true;
      setControls();
      try {
        await check(strokes);
      } catch {
        if (valid()) status.textContent = 'Writing data unavailable. Try Check again or choose Don’t know.';
      } finally {
        busy = false;
        if (valid()) setControls();
      }
    };
    setControls();
  }

  return {matches, mount};
})();
