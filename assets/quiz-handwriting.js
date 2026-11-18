/* Compare freehand ink with bundled character medians without requiring stroke order or direction. */
const QuizHandwriting = (() => {
  const additionalCharacters = '仅价任何修停匙台叶咬堂封尝尤并建彩往戴拍拾支收改散替格案活消湖王精约聊聚迷遍钥随食';
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function lengthOf(stroke) {
    return stroke.reduce((length, point, i) => i ? length + distance(stroke[i - 1], point) : length, 0);
  }

  function sample(stroke, count, length = lengthOf(stroke)) {
    if (!length) return Array(count).fill(stroke[0]);
    let segment = 1, travelled = 0, step = distance(stroke[0], stroke[1]);
    return Array.from({length: count}, (_, i) => {
      const target = length * i / (count - 1);
      while (segment < stroke.length - 1 && (step === 0 || travelled + step < target)) {
        travelled += step;
        segment++;
        step = distance(stroke[segment - 1], stroke[segment]);
      }
      const start = stroke[segment - 1], end = stroke[segment];
      const fraction = step ? Math.max(0, Math.min(1, (target - travelled) / step)) : 0;
      return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
    });
  }

  function normalize(strokes, minimumExtent) {
    if (!strokes.length || strokes.some(stroke => !stroke.length)) return null;
    const points = strokes.flat();
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    const extent = Math.max(right - left, bottom - top);
    if (extent < minimumExtent) return null;
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    return strokes.map(stroke => stroke.map(([x, y]) => [(x - centerX) / extent, (y - centerY) / extent]));
  }

  function describe(stroke) {
    const length = lengthOf(stroke);
    return {length, points: sample(stroke, 16, length)};
  }

  function resembles(stroke, reference) {
    // Limit retracing and loops before comparing the spatial path in both directions.
    if (Math.abs(stroke.length - reference.length) > 0.07 + reference.length * 0.35) return false;
    return [false, true].some(reverse => {
      const errors = stroke.points.map((p, i) =>
        distance(p, reference.points[reverse ? reference.points.length - 1 - i : i]));
      return Math.max(errors[0], errors.at(-1)) <= 0.105 && Math.max(...errors) <= 0.17 &&
        errors.reduce((sum, error) => sum + error, 0) / errors.length <= 0.095;
    });
  }

  function matches(ink, medians) {
    if (ink.length !== medians.length) return false;
    const drawn = normalize(ink, 16);
    const reference = normalize(medians.map(stroke => stroke.map(([x, y]) => [x, -y])), 1);
    if (!drawn || !reference) return false;
    const expected = reference.map(describe);
    const candidates = drawn.map(describe).map(stroke =>
      expected.flatMap((target, i) => resembles(stroke, target) ? [i] : []));
    // Each reference stroke must match a distinct drawn stroke.
    const assigned = Array(expected.length).fill(-1);
    function assign(stroke, visited) {
      for (const i of candidates[stroke]) {
        if (visited.has(i)) continue;
        visited.add(i);
        if (assigned[i] === -1 || assign(assigned[i], visited)) {
          assigned[i] = stroke;
          return true;
        }
      }
      return false;
    }
    return candidates.every((_, i) => assign(i, new Set()));
  }

  function snapshot(ink) {
    return ink.map(strokes => strokes.map(stroke => {
      const points = stroke.length > 24 ? sample(stroke, 24) : stroke;
      return points.map(point => point.map(Math.round));
    }));
  }

  function pathData(stroke) {
    return 'M' + stroke.map(p => p.join(' ')).join(' L') + (stroke.length === 1 ? ' l0.01 0' : '');
  }

  function mount(host, {check, valid, savedInk}) {
    const pads = [...host.querySelectorAll('svg')];
    const groups = pads.map(pad => pad.querySelector('g'));
    const appendStroke = (group, stroke) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      if (stroke.length) path.setAttribute('d', pathData(stroke));
      group.append(path);
      return path;
    };
    if (savedInk) {
      groups.forEach((group, i) => (savedInk[i] || []).forEach(stroke => appendStroke(group, stroke)));
      return;
    }

    const clear = host.querySelector('[data-ink-clear]'), submit = host.querySelector('[data-ink-check]');
    const status = host.querySelector('[data-ink-status]') || host.querySelector('[role="status"]');
    const ink = pads.map(() => []);
    let active = null, busy = false;
    const setControls = () => {
      clear.disabled = busy || active !== null || !ink.some(strokes => strokes.length);
      submit.disabled = busy || active !== null || !ink.every(strokes => strokes.length);
    };
    function add(event, pad) {
      const rect = pad.getBoundingClientRect();
      const size = pad.clientWidth || rect.width;
      const next = [event.clientX - rect.left - pad.clientLeft, event.clientY - rect.top - pad.clientTop]
        .map(value => Math.min(240, Math.max(0, Math.round(value * 240 / size))));
      const {stroke, path} = active;
      const previous = stroke.at(-1);
      if ((previous && distance(previous, next) < 1.5) || stroke.length >= 256) return;
      stroke.push(next);
      path.setAttribute('d', pathData(stroke));
    }
    pads.forEach((pad, i) => {
      const strokes = ink[i];
      pad.addEventListener('pointerdown', event => {
        if (busy || active || event.button !== 0 || event.isPrimary === false || strokes.length >= 48) return;
        event.preventDefault();
        pad.setPointerCapture?.(event.pointerId);
        const stroke = [];
        strokes.push(stroke);
        active = {id: event.pointerId, pad, stroke, path: appendStroke(groups[i], stroke)};
        add(event, pad);
        status.textContent = '';
        setControls();
      });
      pad.addEventListener('pointermove', event => {
        if (active?.id === event.pointerId && active.pad === pad) add(event, pad);
      });
      function finish(event) {
        if (active?.id !== event.pointerId || active.pad !== pad) return;
        if (event.type === 'pointerup') add(event, pad);
        if (event.type === 'pointercancel') {
          strokes.pop();
          active.path.remove();
        }
        active = null;
        setControls();
      }
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, finish);
    });
    clear.onclick = () => {
      ink.forEach(strokes => { strokes.length = 0; });
      groups.forEach(group => group.replaceChildren());
      status.textContent = '';
      setControls();
    };
    submit.onclick = async () => {
      if (submit.disabled) return;
      busy = true;
      setControls();
      try {
        await check(ink);
      } catch {
        if (valid()) status.textContent = 'Writing data unavailable. Try Check again or choose Don’t know.';
      } finally {
        busy = false;
        if (valid()) setControls();
      }
    };
    setControls();
    return () => snapshot(ink);
  }

  return {additionalCharacters, matches, mount, snapshot};
})();
