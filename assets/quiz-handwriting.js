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

  function nearestSquared(x, y, target) {
    let squared = Infinity;
    for (let i = 0; i < target.length; i++) {
      const point = target[i];
      const dx = x - point[0], dy = y - point[1];
      const gap = dx * dx + dy * dy;
      if (gap < squared) squared = gap;
    }
    return squared;
  }

  function measureCoverage(source, target, relaxed) {
    const farLimit = relaxed ? 0.19 : 0.11;
    const strayLimit = relaxed ? 0.11 : 0.085;
    let total = 0, distant = 0, count = 0;
    for (const stroke of source) {
      let offStroke = 0;
      for (const [x, y] of stroke) {
        const error = Math.sqrt(nearestSquared(x, y, target));
        if (error > (relaxed ? 0.25 : 0.19)) return Infinity;
        if (error > farLimit) distant++;
        if (error > strayLimit) offStroke++;
        total += error;
      }
      // Reject a missing or extra bar even if it is small relative to the character.
      if (offStroke / stroke.length > 0.55) return Infinity;
      count += stroke.length;
    }
    const mean = total / count;
    return mean <= (relaxed ? 0.075 : 0.062) && distant / count <= 0.12 ? mean : Infinity;
  }

  function summarize(strokes) {
    let length = 0;
    const sampled = strokes.map(stroke => {
      const size = lengthOf(stroke);
      length += size;
      return sample(stroke, Math.max(3, Math.ceil(size * 48)), size);
    });
    return {length, strokes: sampled, points: sampled.flat()};
  }

  function silhouetteScore(ink, model, relaxed = false) {
    const ratio = ink.length / model.length;
    if (ratio < 0.75 || ratio > 1.23) return Infinity;
    const excess = measureCoverage(ink.strokes, model.points, relaxed);
    if (!Number.isFinite(excess)) return Infinity;
    const missing = measureCoverage(model.strokes, ink.points, relaxed);
    return (excess + missing) / 2;
  }

  function similarSilhouette(drawn, reference) {
    return reference.length >= 4 && Math.abs(drawn.length - reference.length) <= 1 &&
      Number.isFinite(silhouetteScore(summarize(drawn), summarize(reference)));
  }

  function matches(ink, medians) {
    if (Math.abs(ink.length - medians.length) > 1) return false;
    const drawn = normalize(ink, 16);
    const reference = normalize(medians.map(stroke => stroke.map(([x, y]) => [x, -y])), 1);
    if (!drawn || !reference) return false;
    return (drawn.length === reference.length && matchStrokes(drawn, reference)) ||
      similarSilhouette(drawn, reference);
  }

  function matchStrokes(drawn, reference) {
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

  const rankedModels = new WeakMap();

  function handwritingFeatures(strokes) {
    return strokes.map(stroke => {
      const length = lengthOf(stroke);
      const points = sample(stroke, 12, length);
      const center = [0, 1].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
      const scale = Math.max(0.07, length);
      const straightness = length ? distance(points[0], points.at(-1)) / length : 1;
      return {length, center, points, straightness, shape: points.map(p => p.map((value, axis) => (value - center[axis]) / scale))};
    });
  }

  function featureDistance(a, b) {
    const position = distance(a.center, b.center);
    const size = Math.abs(Math.log((a.length + 0.035) / (b.length + 0.035)));
    if (position > 0.31 || size > 1.3) return Infinity;
    if ((b.straightness > 0.93 && a.straightness < 0.72) ||
        (b.straightness < 0.8 && a.straightness > 0.9)) return Infinity;
    const mean = (from, to) => from.reduce((sum, p) => sum + Math.min(...to.map(q => distance(p, q))), 0) / from.length;
    const shape = Math.max(mean(a.shape, b.shape), mean(b.shape, a.shape));
    if (shape > 0.26) return Infinity;
    return position + 0.12 * size + 0.65 * shape;
  }

  function rankScore(ink, reference) {
    const costs = ink.map(stroke => reference.map(model => featureDistance(stroke, model)));
    // Choose the lowest-cost assignment regardless of stroke order.
    const totals = Array(1 << ink.length).fill(Infinity);
    totals[0] = 0;
    for (let used = 0; used < totals.length - 1; used++) {
      if (!Number.isFinite(totals[used])) continue;
      let row = 0;
      for (let bits = used; bits; bits &= bits - 1) row++;
      for (let i = 0; i < ink.length; i++) {
        if (used & (1 << i)) continue;
        const next = used | (1 << i);
        totals[next] = Math.min(totals[next], totals[used] + costs[row][i]);
      }
    }
    return totals.at(-1) / ink.length;
  }

  const complexModels = new WeakMap();

  function referenceSummary(bundle, character) {
    if (!complexModels.has(bundle)) complexModels.set(bundle, new Map());
    const cache = complexModels.get(bundle);
    if (!cache.has(character)) {
      const medians = bundle[character].medians.map(stroke => stroke.map(([x, y]) => [x, -y]));
      const reference = normalize(medians, 1);
      cache.set(character, reference ? summarize(reference) : null);
    }
    return cache.get(character);
  }

  function recognizesComplex(ink, character, bundle, strictMatch) {
    const delta = Math.abs(ink.length - bundle[character].medians.length);
    if (delta > 2) return false;
    const normalized = normalize(ink, 16);
    if (!normalized) return false;
    const drawn = summarize(normalized);
    function score(key, medians) {
      const model = referenceSummary(bundle, key);
      return model ? silhouetteScore(drawn, model, true) + 0.003 * Math.abs(ink.length - medians.length) : Infinity;
    }
    const expected = score(character, bundle[character].medians);
    if (!Number.isFinite(expected)) return strictMatch;
    const limit = expected + (strictMatch ? -Math.min(0.012, expected / 3) : 0.008);
    for (const [other, {medians}] of Object.entries(bundle)) {
      if (other === character || Math.abs(medians.length - ink.length) > 2) continue;
      if (score(other, medians) < limit) return false;
    }
    return true;
  }

  function shortModels(bundle, count) {
    if (!rankedModels.has(bundle)) rankedModels.set(bundle, new Map());
    const byCount = rankedModels.get(bundle);
    if (!byCount.has(count)) {
      const models = Object.entries(bundle).filter(([, {medians}]) => medians.length === count)
        .map(([key, {medians}]) => [key, handwritingFeatures(normalize(medians.map(s => s.map(([x, y]) => [x, -y])), 1))]);
      byCount.set(count, new Map(models));
    }
    return byCount.get(count);
  }

  function recognizes(ink, character, bundle) {
    const medians = bundle[character].medians;
    const strictMatch = matches(ink, medians);
    if (medians.length >= 7) return recognizesComplex(ink, character, bundle, strictMatch);
    // Short characters benefit most from allowing individual stroke placement
    // and proportions to vary. Require a good fit and a lead over lookalikes.
    if (ink.length < 2 || ink.length > 6 || ink.length !== medians.length) return strictMatch;
    const normalized = normalize(ink, 16);
    if (!normalized || normalized.some(stroke => lengthOf(stroke) < 0.018)) return strictMatch;
    const models = shortModels(bundle, ink.length);
    const drawn = handwritingFeatures(normalized);
    const expected = models.get(character);
    if (!strictMatch && drawn.length === 2) {
      const touches = (strokes, tolerance) => strokes[0].points.some(p =>
        strokes[1].points.some(q => distance(p, q) < tolerance));
      if (touches(expected, 0.04) && !touches(drawn, 0.075)) return false;
    }
    const score = rankScore(drawn, expected);
    if (!Number.isFinite(score) || score > 0.20) return strictMatch;
    const limit = strictMatch ? score - 0.012 : score + 0.018;
    for (const [other, model] of models) {
      if (other !== character && rankScore(drawn, model) < limit) return false;
    }
    return true;
  }

  // Candidate mode ranks the supplied ink without knowing the quiz answer.
  function rankCharacters(ink, bundle, styles = {}) {
    const drawing = normalize(ink, 26);
    if (!drawing) return [];
    const drawn = summarize(drawing);
    const meanGap = (from, to) => from.reduce((sum, [x, y]) =>
      sum + Math.sqrt(nearestSquared(x, y, to)), 0) / from.length;
    function score(model, strokeCount) {
      if (!model || !model.length || Math.abs(ink.length - strokeCount) > Math.max(3, ink.length * 0.4)) return Infinity;
      const lengthGap = Math.abs(Math.log(drawn.length / model.length));
      if (lengthGap > 0.75) return Infinity;
      return (meanGap(drawn.points, model.points) + meanGap(model.points, drawn.points)) / 2 +
        0.035 * lengthGap + 0.005 * Math.abs(ink.length - strokeCount);
    }
    const short = ink.length >= 2 && ink.length <= 6 ? shortModels(bundle, ink.length) : null;
    const features = short ? handwritingFeatures(drawing) : null;
    const ranked = [];
    for (const [character, {medians}] of Object.entries(bundle)) {
      if (Math.abs(ink.length - medians.length) > Math.max(3, ink.length * 0.4) && !styles[character]) continue;
      let best = score(referenceSummary(bundle, character), medians.length);
      if (short?.has(character)) {
        const strokeFit = rankScore(features, short.get(character));
        if (strokeFit <= 0.20) best = Math.min(best, 0.01 + 0.31 * strokeFit);
      }
      for (const inkSample of styles[character] || []) {
        const personal = normalize(inkSample, 26);
        if (personal) best = Math.min(best, score(summarize(personal), inkSample.length));
      }
      if (best <= 0.13) ranked.push({character, score: best});
    }
    return ranked.sort((a, b) => a.score - b.score).slice(0, 3);
  }

  function canSaveSample(ink) {
    return !!normalize(ink, 26);
  }

  function matchesPersonal(ink, character, styles) {
    const samples = styles?.[character];
    if (!samples?.length) return false;
    const drawing = normalize(ink, 26);
    if (!drawing) return false;
    const summary = summarize(drawing);
    function score(sample) {
      if (Math.abs(ink.length - sample.length) > 2) return Infinity;
      const model = normalize(sample, 26);
      return model ? silhouetteScore(summary, summarize(model)) : Infinity;
    }
    const best = Math.min(...samples.map(score));
    if (best > 0.042) return false;
    return Object.entries(styles).every(([other, variants]) =>
      other === character || variants.every(variant => score(variant) > best + 0.008));
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

  function mount(host, {check, onEdit, valid, savedInk}) {
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

    const undo = host.querySelector('[data-ink-undo]');
    const clear = host.querySelector('[data-ink-clear]'), submit = host.querySelector('[data-ink-check]');
    const status = host.querySelector('[data-ink-status]') || host.querySelector('[role="status"]');
    const ink = pads.map(() => []), history = [];
    let active = null, busy = false;
    const setControls = () => {
      clear.disabled = busy || active !== null || !ink.some(strokes => strokes.length);
      if (undo) undo.disabled = busy || active !== null || !history.length;
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
        onEdit?.();
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
        } else history.push(i);
        active = null;
        setControls();
      }
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, finish);
    });
    if (undo) undo.onclick = () => {
      onEdit?.();
      const i = history.pop();
      ink[i].pop();
      groups[i].lastElementChild.remove();
      status.textContent = '';
      setControls();
    };
    clear.onclick = () => {
      onEdit?.();
      history.length = 0;
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
        if (valid()) status.textContent = 'Writing data unavailable. Try Check again.';
      } finally {
        busy = false;
        if (valid()) setControls();
      }
    };
    setControls();
    return () => snapshot(ink);
  }

  return {additionalCharacters, matches, recognizes, rankCharacters, canSaveSample, matchesPersonal, mount, snapshot};
})();
