
  // ===========================
  // Embedded vocabulary data
  // ===========================
  
  // ===========================
  // Utilities and state
  // ===========================
  const $ = id => document.getElementById(id);
  const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const isChineseChar = ch => /[\u3400-\u9FFF]/u.test(ch);
  const uniq = arr => [...new Set(arr)];
  const keyFor = word => word;
  const DEFAULT_SETTINGS = {filter2:true,filter3:true,hideKnown:false,showPinyin:false,showEnglish:false,dark:false,ttsRate:0.85,voiceURI:'',onlineTranslate:false,autoStroke:true,readerFontSize:28,readerLineHeight:2.1,dailyGoal:10,flashSkipKnown:false};
  const BASE_STORE = {settings:'hskReaderSettings.v01',statuses:'hskReaderStatuses.v01',lessons:'hskReaderLessons.v01',draft:'hskReaderDraft.v01',lastTab:'hskReaderLastTab.v01',translationConsent:'hskReaderTranslationConsent.v01',extras:'hskReaderStudio.v1',migration:'hskReaderPreStudioBackup.v1'};
  // A reset starts a new storage generation. Suspended/old windows cannot resurrect it.
  const STATE_EPOCH_KEY='hskReaderStateEpoch.v1';
  let stateEpoch='';try{stateEpoch=localStorage.getItem(STATE_EPOCH_KEY)||'';}catch{}
  const STORE=Object.fromEntries(Object.entries(BASE_STORE).map(([k,v])=>[k,stateEpoch?v+'::'+stateEpoch:v]));
  let resettingStudy=false,staleStudy=false,storageWarned=false;
  function canPersistStudy(){
    if(resettingStudy||staleStudy)return false;
    try{if((localStorage.getItem(STATE_EPOCH_KEY)||'')!==stateEpoch){staleStudy=true;toast('Progress changed in another window. Reopening the app…');setTimeout(()=>location.reload(),0);return false;}}catch{if(!storageWarned){storageWarned=true;setTimeout(()=>toast('Browser storage unavailable. Export a backup before closing.'),0);}return false;}
    return true;
  }
  window.addEventListener('storage',e=>{if(e.key===STATE_EPOCH_KEY&&!resettingStudy){staleStudy=true;location.reload();}});
  function readJSON(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
  function writeJSON(key, value){
    if(!canPersistStudy())return false;
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { if(!storageWarned){storageWarned=true; setTimeout(()=>toast('Browser storage unavailable. Export a backup before closing.'),0);} return false; }
  }
  let toastTimer = 0;
  function toast(message){
    const el=$('appToast'); if(!el) return;
    clearTimeout(toastTimer); el.textContent=message; el.hidden=false;
    toastTimer=setTimeout(()=>{el.hidden=true;},3200);
  }
  const SAMPLE_READER_TEXT = $('inputText').value;
  const lastReaderDraft = readJSON(STORE.draft, null);
  if (typeof lastReaderDraft === 'string') $('inputText').value = lastReaderDraft;
  let settings = {...DEFAULT_SETTINGS, ...readJSON(STORE.settings, {})};
  let statuses = readJSON(STORE.statuses, {});
  if(!statuses||typeof statuses!=='object'||Array.isArray(statuses))statuses={};
  let lessons = readJSON(STORE.lessons, {"2":{wordsPerDay:10,startDate:'',completedDays:0,completedDates:[]},"3":{wordsPerDay:10,startDate:'',completedDays:0,completedDates:[]}});
  if(!lessons||typeof lessons!=='object'||Array.isArray(lessons))lessons={};
  let activeLessonLevel = 2;

  const uniqueByWord = new Map();
  for (const item of RAW_VOCAB) {
    const prior = uniqueByWord.get(item.word);
    if (!prior || item.level < prior.level) uniqueByWord.set(item.word, item);
  }
  const VOCAB = RAW_VOCAB.slice().sort((a,b)=>a.level-b.level || a.pinyin.localeCompare(b.pinyin));
  const BY_WORD = uniqueByWord;
  const entryKey = v => v.word==='长' ? `${v.word}::${v.pinyin}` : v.word;
  const BY_ID = new Map(VOCAB.map(v=>[entryKey(v),v]));
  const resolveEntry = key => BY_ID.get(key) || BY_WORD.get(key);
  let extras = sanitizeExtras(readJSON(STORE.extras, {}));
  // Preserve an untouched legacy snapshot once, before writing expanded progress.
  try { if(!localStorage.getItem(STORE.migration)) {
    const snapshot={}; for(const k of ['settings','statuses','lessons','draft','lastTab']) snapshot[STORE[k]]=localStorage.getItem(STORE[k]);
    localStorage.setItem(STORE.migration,JSON.stringify(snapshot));
  }} catch { setTimeout(()=>toast('Local storage is unavailable. Keep a downloaded backup.'),0); }

  const MATCH_WORDS = [...uniqueByWord.values()].sort((a,b)=>b.word.length-a.word.length || a.level-b.level || a.pinyin.localeCompare(b.pinyin));
  const MATCH_BY_FIRST = new Map();
  MATCH_WORDS.forEach(v => { const first=v.word[0]; if (!MATCH_BY_FIRST.has(first)) MATCH_BY_FIRST.set(first,[]); MATCH_BY_FIRST.get(first).push(v); });
  const HSK2 = RAW_VOCAB.filter(v=>v.level===2).sort((a,b)=>a.pinyin.localeCompare(b.pinyin));
  const HSK3 = RAW_VOCAB.filter(v=>v.level===3).sort((a,b)=>a.pinyin.localeCompare(b.pinyin));

  function statusOf(key){
    const v=resolveEntry(key); if(!v)return 'new';
    const id=entryKey(v), state=Object.prototype.hasOwnProperty.call(statuses,id)?statuses[id]:statuses[v.word];
    return ['known','learning'].includes(state)?state:'new';
  }
  function setStatus(key,status){
    const v=resolveEntry(key);if(!v||!['new','known','learning'].includes(status))return;
    statuses[entryKey(v)]=status;
    writeJSON(STORE.statuses,statuses);
    renderAll();
    if(currentDialogWord===entryKey(v)&&$('wordDialog').open)updateOpenWordStatus();
    updatePopupNavButtons();
  }

  function updateOpenWordStatus(){
    if(!currentDialogWord || !$('wordDialog').open) return;
    const state=statusOf(currentDialogWord);
    const pill=$('wordDetails').querySelector('.status-chip');
    if(pill){pill.textContent=state;pill.className=`status-chip ${state==='known'?'status-known':state==='learning'?'status-learning':''}`;}
    $('wordDetails').querySelectorAll('[data-popup-status]').forEach(btn => btn.setAttribute('aria-pressed',String(btn.dataset.popupStatus===state)));
  }
  function saveSettings(){ writeJSON(STORE.settings, settings); }
  function saveLessons(){ writeJSON(STORE.lessons, lessons); }


  // Pinyin display helpers for the word popup.
  const PINYIN_INITIALS = ['', 'b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'];
  const PINYIN_FINALS = ['a','ai','an','ang','ao','e','ei','en','eng','er','o','ong','ou','i','ia','ian','iang','iao','ie','in','ing','iong','iu','u','ua','uai','uan','uang','ui','un','uo','v','ve','van','vn','ue','uan','un'];
  const VALID_PINYIN = new Set();
  for (const ini of PINYIN_INITIALS) for (const fin of PINYIN_FINALS) VALID_PINYIN.add(ini + fin);
  ['a','ai','an','ang','ao','e','ei','en','eng','er','o','ou','m','n','ng','hm'].forEach(x => VALID_PINYIN.add(x));
  const TONE_MAP = {'ā':'a','á':'a','ǎ':'a','à':'a','ē':'e','é':'e','ě':'e','è':'e','ī':'i','í':'i','ǐ':'i','ì':'i','ō':'o','ó':'o','ǒ':'o','ò':'o','ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v','ü':'v','ń':'n','ň':'n','ǹ':'n'};
  function normalizePinyin(s){ return String(s || '').toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]/g, ch => TONE_MAP[ch] || ch); }
  function splitPinyinSyllables(pinyin, word){
    const chars = Array.from(word).filter(isChineseChar);
    const spaced = String(pinyin || '').trim().split(/\s+/).filter(Boolean);
    if (spaced.length === chars.length) return spaced;
    const raw = String(pinyin || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]/g, '');
    const target = chars.length;
    const memo = new Map();
    function dp(i, k){
      const key = i + ':' + k;
      if (memo.has(key)) return memo.get(key);
      if (i === raw.length && k === target) return [];
      if (i >= raw.length || k >= target) return null;
      for (let end = Math.min(raw.length, i + 7); end > i; end--){
        const piece = raw.slice(i, end);
        if (!VALID_PINYIN.has(normalizePinyin(piece))) continue;
        const rest = dp(end, k + 1);
        if (rest) { const out = [piece, ...rest]; memo.set(key, out); return out; }
      }
      memo.set(key, null);
      return null;
    }
    const parsed = dp(0,0);
    if (parsed && parsed.length === target) return parsed;
    if (target <= 1) return [pinyin];
    return chars.map((_, i) => i === 0 ? pinyin : '');
  }
  function renderWordHero(v){
    const chars = Array.from(v.word);
    const syllables = splitPinyinSyllables(v.pinyin, v.word);
    return `<div class="word-hero">${chars.map((ch,i)=>`<span class="char-stack"><span class="word-char">${escapeHtml(ch)}</span><span class="word-pin">${escapeHtml(syllables[i] || '')}</span></span>`).join('')}</div>`;
  }

  // ===========================
  // Reader and segmentation
  // ===========================
  function vocabAllowed(v){
    if (v.level === 2 && !settings.filter2) return false;
    if (v.level === 3 && !settings.filter3) return false;
    if (settings.hideKnown && statusOf(entryKey(v)) === 'known') return false;
    return true;
  }
  function segmentTextWithPredicate(text, allowedFn){
    const segs = [];
    let i = 0, matches = 0;
    while (i < text.length) {
      let hit = null;
      for (const v of (MATCH_BY_FIRST.get(text[i]) || [])) {
        if (text.startsWith(v.word, i)) { hit = selectedReading(v); break; }
      }
      if (hit) { if(allowedFn(hit)){segs.push({type:'word',text:hit.word,v:hit});matches++;}else segs.push({type:'text',text:hit.word});i+=hit.word.length; }
      else { segs.push({type:'text', text:text[i]}); i++; }
    }
    return {segs, matches};
  }
  function segmentText(text){ return segmentTextWithPredicate(text, vocabAllowed); }
  function vocabAllowedForNav(v){
    if (v.level === 2 && !settings.filter2) return false;
    if (v.level === 3 && !settings.filter3) return false;
    return true;
  }
  let currentReaderAllWords = [];
  function refreshReaderNavWords(){
    const text = $('inputText').value || '';
    currentReaderAllWords = segmentTextWithPredicate(text, vocabAllowedForNav).segs
      .filter(s => s.type === 'word')
      .map(s => entryKey(s.v));
    return currentReaderAllWords;
  }
  function renderReader(){
    const text = $('inputText').value || '';
    refreshReaderNavWords();
    const {segs, matches} = segmentText(text);
    let lastNavIdx = -1;
    const html = segs.map((s,segmentIndex) => {
      if (s.type === 'text') {if(segmentIndex>0&&segs[segmentIndex-1].type==='word'&&/^[。，！？；：、]$/.test(s.text))return '';return escapeHtml(s.text).replace(/\n/g,'<br>');}
      const v = s.v;
      let navIdx=lastNavIdx+1;while(navIdx<currentReaderAllWords.length&&currentReaderAllWords[navIdx]!==entryKey(v))navIdx++;if(navIdx===currentReaderAllWords.length)navIdx=-1;
      if (navIdx >= 0) lastNavIdx = navIdx;
      const punctuation=segs[segmentIndex+1]?.type==='text'&&/^[。，！？；：、]$/.test(segs[segmentIndex+1].text)?segs[segmentIndex+1].text:'';
      return `${punctuation?'<span class="word-unit">':''}<span class="tok hsk${v.level} word-${statusOf(entryKey(v))}" data-word="${escapeHtml(entryKey(v))}" data-token-index="${navIdx}" role="button" tabindex="0" aria-label="${escapeHtml(v.word)}: ${escapeHtml(v.english)}"><span class="zh">${escapeHtml(v.word)}</span>${settings.showPinyin?`<span class="pin">${escapeHtml(v.pinyin)}</span>`:''}${settings.showEnglish?`<span class="eng">${escapeHtml(v.english)}</span>`:''}</span>${punctuation?escapeHtml(punctuation)+'</span>':''}`;
    }).join('');
    $('readerView').innerHTML = html || '<span class="small">Paste text and click Read.</span>';
    const distinct=uniq(segs.filter(x=>x.type==='word').map(x=>entryKey(x.v)));
    const unfamiliar=distinct.filter(w=>statusOf(w)!=='known').length;
    $('matchStats').textContent = matches ? `${matches} matches · ${distinct.length} unique · ${unfamiliar} to review` : '';
    $('readerView').style.fontSize=`${Math.max(18,Math.min(38,Number(settings.readerFontSize)||26))}px`;
    $('readerView').style.lineHeight=String(settings.readerLineHeight||2.1);
    const all=uniq(currentReaderAllWords),known=all.filter(w=>statusOf(w)==='known').length;
    $('passageFamiliarity').textContent=all.length?`${known} of ${all.length} matched entries known`: 'No dictionary matches yet';
    $('reviewPassageBtn').disabled=!all.some(w=>statusOf(w)!=='known');
    $('readingTitle').textContent=extras.passages.find(p=>p.id===extras.activePassage)?.title||($('inputText').value===SAMPLE_READER_TEXT?'A day at school':'Your reading passage');
    updatePopupNavButtons();
  }

  // ===========================
  // Full-text translation
  // ===========================
  function offlineGloss(text){
    const {segs} = segmentTextWithPredicate(text,()=>true);
    const parts = [];
    for (const s of segs) {
      if (s.type === 'word') parts.push(`${s.text} = ${s.v.english}`);
    }
    if (!parts.length) return 'No HSK 2/3 words found for the local gloss.';
    return 'Local glossary translation, not a natural sentence translation:\n' + parts.join(' | ');
  }
  async function onlineTranslate(text){
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=zh-CN|en';
    if(new TextEncoder().encode(text).length>500)throw new Error('Translation service limit: 500 UTF-8 bytes');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    let res;try{res=await fetch(url,{method:'GET',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});}finally{clearTimeout(timeout);}
    if (!res.ok) throw new Error('Translation request failed');
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || Number(data.responseStatus)!==200) throw new Error('Translation unavailable');
    return translated;
  }
  let translationRequestId = 0;
  async function translateInput(){
    const text = $('inputText').value.trim();
    const requestId=++translationRequestId;
    if(text && navigator.onLine && settings.onlineTranslate && !readJSON(STORE.translationConsent, false)){
      if(!confirm('Online translation sends your Chinese text to MyMemory, a third-party service. Continue?')){
        $('translationBox').hidden=false; $('translationModeLabel').textContent='Local glossary'; $('translationOutput').textContent=offlineGloss(text); return;
      }
      writeJSON(STORE.translationConsent,true);
    }
    $('translationBox').hidden = false;
    if (!text) { $('translationModeLabel').textContent = ''; $('translationOutput').textContent = 'Paste Chinese text first.'; return; }
    $('translationOutput').textContent = settings.onlineTranslate ? 'Translating online...' : 'Generating local gloss...';
    if (settings.onlineTranslate && navigator.onLine) {
      try {
        const out = await onlineTranslate(text);
        if(requestId!==translationRequestId || $('inputText').value.trim()!==text) return;
        $('translationModeLabel').textContent = 'Online full-text translation';
        const local = offlineGloss(text).replace(/^Local glossary translation, not a natural sentence translation:\n/, '');
        $('translationOutput').innerHTML = `${escapeHtml(out)}<div class="local-gloss"><strong>Local gloss:</strong><br>${escapeHtml(local)}</div>`;
        return;
      } catch (err) {
        if(requestId!==translationRequestId || $('inputText').value.trim()!==text) return;
        $('translationModeLabel').textContent = new TextEncoder().encode(text).length>500?'Long passage · local glossary (online limit: 500 bytes)':'Online unavailable · local glossary';
        $('translationOutput').textContent = offlineGloss(text);
        return;
      }
    }
    $('translationModeLabel').textContent = 'Local glossary fallback';
    $('translationOutput').textContent = offlineGloss(text);
  }

  // ===========================
  // Word popup and stroke order
  // ===========================
  let currentDialogWord = null;
  let currentNavAnchorIndex = -1;
  let currentStrokeWriters = [];
  let currentStrokeTraceMode = false;
  const POPUP_ANIMATION_MS = 0;

  function nearestIndexForWord(word, preferredIndex){
    refreshReaderNavWords();
    const idx = Number(preferredIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < currentReaderAllWords.length) return idx;
    const found = currentReaderAllWords.indexOf(word);
    return found >= 0 ? found : -1;
  }
  function findAdjacentUnknownIndex(direction){
    if (!currentReaderAllWords.length) refreshReaderNavWords();
    const start = currentNavAnchorIndex >= 0 ? currentNavAnchorIndex : nearestIndexForWord(currentDialogWord, -1);
    if (start < 0) return -1;
    for (let i = start + direction; i >= 0 && i < currentReaderAllWords.length; i += direction) {
      if (statusOf(currentReaderAllWords[i]) !== 'known') return i;
    }
    return -1;
  }
  function updatePopupNavButtons(){
    const prevBtn = $('prevUnknownBtn'), nextBtn = $('nextUnknownBtn');
    if (!prevBtn || !nextBtn || !$('wordDialog')?.open || !currentDialogWord) return;
    refreshReaderNavWords();
    const prevIdx = findAdjacentUnknownIndex(-1);
    const nextIdx = findAdjacentUnknownIndex(1);
    prevBtn.hidden = prevIdx < 0;
    nextBtn.hidden = nextIdx < 0;
    prevBtn.dataset.targetIndex = prevIdx;
    nextBtn.dataset.targetIndex = nextIdx;
  }
  function navigateUnknown(direction){
    const idx = findAdjacentUnknownIndex(direction);
    if (idx < 0) return;
    showWord(currentReaderAllWords[idx], idx, direction);
  }
  function buildWordDetails(v, status, statusClass, safeWord){
    return `
      <div class="word-top">
        ${renderWordHero(v)}
        <div class="word-info-side">
          <div class="word-english">${escapeHtml(v.english)}</div>
          <div class="word-level">HSK ${v.level}</div>
          <span class="status-chip ${statusClass}">${escapeHtml(status)}</span>
        </div>
      </div>
      <div class="word-actions">
        <button class="good" data-popup-status="known" aria-pressed="${status==='known'}" onclick="setStatus('${safeWord}','known')">Known</button>
        <button class="learn" data-popup-status="learning" aria-pressed="${status==='learning'}" onclick="setStatus('${safeWord}','learning')">Learning</button>
        <button data-popup-status="new" aria-pressed="${status==='new'}" onclick="setStatus('${safeWord}','new')">Reset</button>
        <button onclick="speakEntry('${safeWord}')">Speak</button>
      </div>
      ${v.word==='长'?`<div class="sense-choice"><label for="wordSense">Choose the reading for this passage</label><select id="wordSense">${RAW_VOCAB.filter(x=>x.word==='长').map(x=>`<option value="${entryKey(x)}" ${x.pinyin===v.pinyin?'selected':''}>${x.pinyin} · ${escapeHtml(x.english)} · HSK ${x.level}</option>`).join('')}</select><p class="small">This selection applies to all 长 tokens in the current passage. Progress is separate for each reading.</p></div>`:''}
      <div class="stroke-panel">
        <div class="stroke-head row between"><strong>Stroke order</strong><span id="strokeStatus" class="small"></span></div>
        <div id="strokePanel" class="stroke-grid"><span class="small">Loading...</span></div>
        <div class="stroke-controls row"><button id="animateStrokeBtn">Replay animation</button><button id="traceStrokeBtn">Trace practice</button><button id="retryTraceBtn" hidden>Try again</button><button id="traceGuideBtn" hidden>Hide guide</button><button id="exitTraceBtn" type="button" hidden>Done tracing</button></div>
        <p class="stroke-device-tip small">Write inside a pad with your finger or Apple Pencil. Scroll outside the pad.</p>
      </div>`;
  }
  function bindWordPopupControls(){
    if($('wordSense'))$('wordSense').onchange=()=>{const id=$('wordSense').value;extras.readerSense=id;saveExtras();renderReader();showWord(id,currentNavAnchorIndex);};
    $('animateStrokeBtn').onclick = animateStrokes;
    $('traceStrokeBtn').onclick = traceStrokes;
    $('retryTraceBtn').onclick = traceStrokes;
    $('traceGuideBtn').onclick = () => toggleTraceGuide('popup');
    $('exitTraceBtn').onclick=()=>{currentStrokeTraceMode=false;animateStrokes();};
  }
  function clearWordMotionClasses(body){
    body.classList.remove('word-changing','word-exit-next','word-enter-next','word-exit-prev','word-enter-prev');
  }
  function showWord(word, tokenIndex, direction = 0){
    const v = resolveEntry(word);
    if(v)word=entryKey(v);
    if (!v) return;
    const dialog = $('wordDialog');
    const body = $('wordDetails');
    const oldWord = currentDialogWord;
    const shouldAnimate = false;
    const motion = direction < 0 ? 'prev' : 'next';
    const renderNewWord = () => {
      clearWordMotionClasses(body);
      cancelWriters(currentStrokeWriters);
      currentDialogWord = word;
      currentNavAnchorIndex = nearestIndexForWord(word, tokenIndex);
      currentStrokeTraceMode = false;
      currentStrokeGuide = true;
      ++popupStrokeGeneration;
      const status = statusOf(word);
      const statusClass = status === 'known' ? 'status-known' : status === 'learning' ? 'status-learning' : '';
      const safeWord = escapeHtml(entryKey(v));
      body.innerHTML = buildWordDetails(v, status, statusClass, safeWord);
      bindWordPopupControls();
      updatePopupNavButtons();
      setTimeout(updatePopupNavButtons, 0);
      if (settings.autoStroke) renderStrokeOrder(word); else { syncTraceButtons('popup',false,true); $('strokeStatus').textContent='Auto-load off'; $('strokePanel').innerHTML='<span class="small">Tap Replay animation or Trace practice to load stroke data.</span>'; }
      if (shouldAnimate) {
        body.classList.add(`word-enter-${motion}`);
        requestAnimationFrame(()=>body.classList.remove(`word-enter-${motion}`));
      }
    };
    if (!dialog.open){dialogReturnFocus=document.activeElement;dialog.showModal();}
    stopVoice();
    requestAnimationFrame(()=>dialog.classList.add('showing'));
    if (shouldAnimate) {
      clearWordMotionClasses(body);
      body.classList.add(`word-exit-${motion}`);
      setTimeout(renderNewWord, POPUP_ANIMATION_MS);
    } else {
      clearWordMotionClasses(body);
      renderNewWord();
    }
    if(Number(tokenIndex)>=0){extras.readerAnchor={text:$('inputText').value,index:Number(tokenIndex)};saveExtras();}
    $('closeDialog').focus({preventScroll:true});
  }
  function closeWordDialog(){
    const dialog = $('wordDialog');
    ++popupStrokeGeneration;cancelWriters(currentStrokeWriters);currentStrokeWriters=[];
    stopVoice();
    dialog.classList.remove('showing');
    if(dialog.open) dialog.close();
    const previousKey=currentDialogWord;currentDialogWord=null;
    dialog.classList.remove('trace-active');
    if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus({preventScroll:true});else if(previousKey)document.querySelector(`[data-word="${CSS.escape(previousKey)}"]`)?.focus({preventScroll:true});
  }

  let hanziWriterPromise = null,characterDataPromise=null,dialogReturnFocus=null;
  const cancelWriters=writers=>writers.forEach(w=>{try{w.cancelQuiz();w.pauseAnimation();}catch{}});
  function loadCharacterBundle(){if(!characterDataPromise)characterDataPromise=fetch('./vendor/characters.json').then(r=>{if(!r.ok)throw Error('Missing character bundle');return r.json();}).catch(e=>{characterDataPromise=null;throw e;});return characterDataPromise;}
  function localCharacterLoader(ch){return loadCharacterBundle().then(data=>{if(!data[ch])throw Error('Character unavailable');return data[ch];});}
  function ensureHanziWriter(){
    if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
    if (hanziWriterPromise) return hanziWriterPromise;
    hanziWriterPromise = new Promise((resolve,reject)=>{
      const script = document.createElement('script');
      script.src = './vendor/hanzi-writer-3.7.3.min.js';
      script.async = true;
      script.onload = () => window.HanziWriter ? resolve(window.HanziWriter) : reject(new Error('Hanzi Writer unavailable'));
      script.onerror = () => reject(new Error('Writing library unavailable. Check that all application files were uploaded.'));
      document.head.appendChild(script);
    }).catch(err=>{hanziWriterPromise=null;throw err;});
    return hanziWriterPromise;
  }

  function animateElementResize(el, mutate){
    mutate();
  }
  async function playStrokeAnimationsSequentially(writers, baseGap=0, valid=()=>true){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    while(valid()){
      for(const writer of writers){if(!valid())return;await writer.hideCharacter({duration:0});}
      for(const writer of writers){if(!valid())return;try{await writer.animateCharacter();}catch{return;}}
      await new Promise(resolve=>setTimeout(resolve,900));
    }
  }

  let popupStrokeGeneration=0, flashStrokeGeneration=0;
  let currentStrokeGuide=true, flashStrokeGuide=true;
  function getTracePadSize(){return Math.max(160,Math.min(380,window.innerWidth-74,window.innerHeight-310));}
  function syncTraceButtons(area, traceMode, guideVisible){
    const popup = area==='popup';
    const btn=popup?$('traceStrokeBtn'):$('flashTraceBtn');
    const retry=popup?$('retryTraceBtn'):$('flashRetryTraceBtn');
    const guide=popup?$('traceGuideBtn'):$('flashGuideBtn');
    if(btn) btn.classList.toggle('is-set', traceMode);
    if(!popup){$('flashReplayBtn').hidden=true;$('flashTraceBtn').hidden=true;}
    if(retry) retry.hidden=!traceMode;
    if(guide){guide.hidden=!traceMode;guide.innerHTML=guideVisible?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9 5.3c1-.2 2-.3 3-.3 6 0 10 7 10 7a22 22 0 0 1-3 3.5M6 6.5A23 23 0 0 0 2 12s4 7 10 7c2 0 4-.7 5.5-1.7"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';guide.setAttribute('aria-label',guideVisible?'Hide guide':'Show guide');guide.title=guideVisible?'Hide guide':'Show guide';guide.setAttribute('aria-pressed',String(!guideVisible));}
    const done=popup?$('exitTraceBtn'):$('flashExitTraceBtn');if(done)done.hidden=popup?!traceMode:false;
  }
  function toggleTraceGuide(area){
    const popup=area==='popup';
    if(popup) currentStrokeGuide=!currentStrokeGuide; else flashStrokeGuide=!flashStrokeGuide;
    const visible=popup?currentStrokeGuide:flashStrokeGuide;
    const writers=popup?currentStrokeWriters:flashStrokeWriters;
    writers.forEach(w=>{ try{if(visible) w.showOutline();else w.hideOutline();}catch{} });
    syncTraceButtons(area,true,visible);
  }
  function renderStrokeSurfaces({panel,status,wrap,chars,prefix,traceMode,startQuiz,valid,guideVisible}){
    const size=traceMode?getTracePadSize():128;
    const padding=traceMode?12:8;
    if(wrap) wrap.classList.toggle('trace-mode',traceMode);
    let loaded=0;
    panel.style.setProperty('--pad-size',size+'px');
    const single=traceMode && chars.length>1;
    panel.classList.toggle('single-trace',single);
    const nav=single?`<div class="trace-step-nav"><button type="button" data-trace-prev aria-label="Previous character">‹ Prev</button><span class="trace-step-count" aria-live="polite"></span><button type="button" data-trace-next aria-label="Next character">Next ›</button></div>`:'';
    panel.innerHTML=nav+chars.map((ch,i)=>`<div class="stroke-box"><div id="${prefix}${i}" class="stroke-char" aria-label="Practice writing ${escapeHtml(ch)}"></div><div class="stroke-progress-label" id="${prefix}Label${i}">${traceMode?'Ready to trace':escapeHtml(ch)}</div></div>`).join('');
    let visibleIndex=0;
    const showStep=index=>{
      if(!single||!valid())return;
      visibleIndex=Math.max(0,Math.min(chars.length-1,index));
      panel.querySelectorAll('.stroke-box').forEach((box,i)=>{box.hidden=i!==visibleIndex;});
      const text=panel.querySelector('.trace-step-count');
      if(text)text.textContent=`${visibleIndex+1} / ${chars.length} · ${chars[visibleIndex]}`;
      panel.querySelector('[data-trace-prev]').disabled=visibleIndex===0;
      panel.querySelector('[data-trace-next]').disabled=visibleIndex>=chars.length-1||!done.has(visibleIndex);
    };
    const quizStarters=[];
    const writers=[], done=new Set(), errors=new Array(chars.length).fill(0);
    const updateSummary=()=>{
      if(!valid()) return;
      if(!traceMode){status.textContent='';return;}
      const mistakes=errors.reduce((a,b)=>a+b,0);
      status.textContent=`${done.size}/${chars.length} characters complete · ${mistakes} mistakes`;
      if(done.size===chars.length) toast(`Tracing complete: ${chars.length} character${chars.length===1?'':'s'}!`);
    };
    chars.forEach((ch,i)=>{
      const label=()=>$(prefix+'Label'+i);
      const writer=HanziWriter.create(prefix+i,ch,{
        width:size,height:size,padding,showCharacter:!traceMode,
        charDataLoader:localCharacterLoader,
        strokeColor:settings.dark?'#e5edf8':'#253b30',outlineColor:settings.dark?'#4f759e':'#cedbd0',drawingColor:settings.dark?'#90baf0':'#216b54',highlightColor:settings.dark?'#90baf0':'#86b8a0',
        strokeFadeDuration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:180,
        showOutline:traceMode?guideVisible:true,
        strokeAnimationSpeed:1.5,delayBetweenStrokes:190,
        drawingWidth:traceMode?6:4,showHintAfterMisses:2,
        onLoadCharDataSuccess:()=>{loaded++;if(valid()&&!traceMode&&loaded===chars.length)status.textContent='Ready · bundled locally';},
        onLoadCharDataError:()=>{if(valid() && label()){label().textContent='Stroke data unavailable';status.textContent='Could not load character data';}}
      });
      writers.push(writer);
      if(startQuiz){
        quizStarters[i]=()=>writer.quiz({showHintAfterMisses:2,leniency:1.2,highlightOnComplete:true,
          onCorrectStroke:d=>{if(!valid() || !label())return;label().textContent=`${d.strokesRemaining} strokes remaining${errors[i]?' · '+errors[i]+' mistakes':''}`;},
          onMistake:d=>{if(!valid() || !label())return;errors[i]=d.totalMistakes;label().textContent=`Try that stroke again · ${d.totalMistakes} mistake${d.totalMistakes===1?'':'s'}`;updateSummary();},
          onComplete:d=>{
            if(!valid() || !label())return;
            if(!done.has(i)){const stat=extras.writing[ch]||{count:0,mistakes:0};extras.writing[ch]={count:stat.count+1,mistakes:stat.mistakes+d.totalMistakes,last:todayISO()};saveExtras();renderDaily();}
            errors[i]=d.totalMistakes;done.add(i);label().classList.add('completed');
            label().textContent=`Completed${errors[i]?' · '+errors[i]+' mistakes':''}`;updateSummary();
            if(i<chars.length-1)setTimeout(()=>{if(valid()){showStep(i+1);quizStarters[i+1]();}},380);
          }
        });
      }
    });
    if(startQuiz)quizStarters[0]?.();
    if(single){
      panel.querySelector('[data-trace-prev]').onclick=()=>showStep(visibleIndex-1);
      panel.querySelector('[data-trace-next]').onclick=()=>showStep(visibleIndex+1);
      showStep(0);
    }
    if(startQuiz) updateSummary();
    else playStrokeAnimationsSequentially(writers,1300,valid);
    return writers;
  }
  async function renderStrokeOrder(word,opts={}){
    const panel=$('strokePanel'),status=$('strokeStatus');
    if(!panel||!status||!currentDialogWord)return;
    const wrap=panel.closest('.stroke-panel');
    const traceMode=opts.traceMode??currentStrokeTraceMode;
    $('wordDialog').classList.toggle('trace-active',traceMode);
    const startQuiz=!!opts.startQuiz;
    const generation=++popupStrokeGeneration;
    const valid=()=>generation===popupStrokeGeneration && currentDialogWord===word && $('wordDialog').open && $('strokePanel')===panel;
    cancelWriters(currentStrokeWriters);
    const chars=Array.from(resolveEntry(word)?.word||word).filter(isChineseChar).slice(0,8);
    if(!chars.length){panel.textContent='No Chinese characters found.';return;}
    status.textContent='Loading stroke data...';
    syncTraceButtons('popup',traceMode,currentStrokeGuide);
    try{
      await ensureHanziWriter();
      if(!valid())return;
      currentStrokeWriters=renderStrokeSurfaces({panel,status,wrap,chars,prefix:'strokeTarget',traceMode,startQuiz,valid,guideVisible:currentStrokeGuide});
    }catch(err){if(valid()){status.textContent='Unavailable';panel.innerHTML='<span class="small">Writing files could not load. Try again, or use Repair offline copy in Settings when online.</span>';}}
  }
  function replayStrokes(){if(currentDialogWord) animateStrokes();}
  async function animateStrokes(){
    if(!currentDialogWord)return;
    currentStrokeTraceMode=false;
    await renderStrokeOrder(currentDialogWord,{traceMode:false,startQuiz:false});
  }
  async function traceStrokes(){
    if(!currentDialogWord)return;
    currentStrokeTraceMode=true;
    currentStrokeGuide=true;
    await renderStrokeOrder(currentDialogWord,{traceMode:true,startQuiz:true});
  }

  async function preloadStrokeData(){
    const lvl = $('preloadStrokeLevel').value;
    const words = RAW_VOCAB.filter(v => lvl==='all' || String(v.level)===lvl);
    const chars = uniq(words.flatMap(v => Array.from(v.word).filter(isChineseChar)));
    const status = $('strokePreloadStatus');
    status.textContent = `Loading Hanzi Writer and ${chars.length} unique characters...`;
    try {
      await ensureHanziWriter();
      let ok = 0, fail = 0;
      for (let i=0;i<chars.length;i++) {
        try { await localCharacterLoader(chars[i]); ok++; } catch { fail++; }
        if (i % 10 === 0 || i === chars.length-1) status.textContent = `Loaded ${i+1}/${chars.length}. Success: ${ok}. Failed: ${fail}.`;
      }
    } catch (err) { status.textContent = 'Writing library unavailable. Check that all application files were uploaded.'; }
  }

  // ===========================
  // Text-to-speech
  // ===========================
  let voices = [];
  function loadVoices(){
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices();

  }
  function preferredMandarinVoice(){
    if (!voices.length && 'speechSynthesis' in window) voices = window.speechSynthesis.getVoices();
    const score = v => {
      const lang=(v.lang||'').toLowerCase(), name=(v.name||'').toLowerCase();
      let s=0;
      if (lang === 'zh-cn' || lang === 'cmn-cn') s += 100;
      if (lang.startsWith('zh-cn') || lang.includes('hans')) s += 70;
      if (name.includes('mandarin') || name.includes('putonghua') || name.includes('普通话') || name.includes('xiaoxiao') || name.includes('tingting')) s += 50;
      if (lang.includes('zh-hk') || lang.includes('yue') || name.includes('cantonese') || name.includes('粤')) s -= 100;
      if (lang.startsWith('zh')) s += 10;
      return s;
    };
    return voices.filter(v=>/^(zh|cmn)/i.test(v.lang||'')).sort((a,b)=>score(b)-score(a))[0] || null;
  }
  function speakChinese(text){
    if (!('speechSynthesis' in window)) { alert('Text-to-speech is not supported in this browser.'); return; }
    const clean = String(text || '').trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'zh-CN';
    u.rate = Number(settings.ttsRate || 0.85);
    const voice = preferredMandarinVoice();
    if (voice) u.voice = voice;
    window.speechSynthesis.cancel();
    u.onstart=()=>{$('readerQuickStopBtn').hidden=false;};u.onend=u.onerror=()=>{$('readerQuickStopBtn').hidden=true;};
    window.speechSynthesis.speak(u);
  }
  function stopVoice(){ if ('speechSynthesis' in window) window.speechSynthesis.cancel();if($('readerQuickStopBtn'))$('readerQuickStopBtn').hidden=true; }
  function speakEntry(key){const v=resolveEntry(key);if(v)speakChinese(v.word==='长'?(v.pinyin==='cháng'?'长短':'长大'):v.word);}

  // ===========================
  // Vocab browser
  // ===========================
  let vocabVisibleCount=0, lastVocabRows=[];
  const vocabPageSize=()=>window.matchMedia('(max-width:720px)').matches?30:75;
  function filteredVocab(){
    const q=$('vocabSearch').value.trim().toLowerCase();
    const qRoman=normalizePinyin(q).replace(/\s+/g,'');
    const lev=$('vocabLevel').value,stat=$('vocabStatus').value,sort=$('vocabSort').value;
    const tokens=q.split(/\s+/).filter(Boolean);
    let rows=VOCAB.filter(v=>(lev==='all'||String(v.level)===lev)&&(stat==='all'||statusOf(entryKey(v))===stat));
    if(q) rows=rows.filter(v=>{
      const hay=[v.word.toLowerCase(),v.pinyin.toLowerCase(),v.english.toLowerCase(),normalizePinyin(v.pinyin).replace(/\s+/g,'')];
      return hay.some(t=>t.includes(q))||hay[3].includes(qRoman)||tokens.every(part=>hay.some(t=>t.includes(part)));
    });
    rows.sort((a,b)=>sort==='pinyin'?a.pinyin.localeCompare(b.pinyin):sort==='word'?a.word.localeCompare(b.word,'zh-Hans-CN'):(a.level-b.level||a.pinyin.localeCompare(b.pinyin)));
    return rows;
  }
  function renderVocab(resetPage=false){
    const rows=filteredVocab();lastVocabRows=rows;
    if(resetPage||!vocabVisibleCount)vocabVisibleCount=vocabPageSize();
    const shown=rows.slice(0,vocabVisibleCount);
    $('vocabCount').textContent=`${rows.length} / ${VOCAB.length} words`;
    $('vocabShown').textContent=rows.length?`Showing ${shown.length} of ${rows.length}`:'No matching words';
    $('vocabLoadMoreBtn').hidden=shown.length>=rows.length;
    $('vocabStudyResultsBtn').disabled=!rows.length;
    $('vocabTable').innerHTML=shown.map(v=>{
      const st=statusOf(entryKey(v));
      return `<tr><td data-label="Chinese"><button class="word-link" data-word="${escapeHtml(entryKey(v))}" style="font-size:26px;padding:4px 6px;border:0;background:transparent">${escapeHtml(v.word)}</button></td><td data-label="Pinyin">${escapeHtml(v.pinyin)}</td><td data-label="Meaning">${escapeHtml(v.english)}</td><td data-label="Level"><span class="pill">HSK ${v.level}</span></td><td data-label="Status"><span class="status-chip ${st==='known'?'status-known':st==='learning'?'status-learning':''}">${escapeHtml(st)}</span></td><td data-label="Mark"><div class="actions-cell"><button class="good" data-status-word="${escapeHtml(entryKey(v))}" data-status="known" aria-label="Mark ${escapeHtml(v.word)} ${escapeHtml(v.pinyin)} known" ${st==='known'?'aria-pressed="true"':''}>Known</button><button class="learn" data-status-word="${escapeHtml(entryKey(v))}" data-status="learning" aria-label="Mark ${escapeHtml(v.word)} ${escapeHtml(v.pinyin)} learning" ${st==='learning'?'aria-pressed="true"':''}>Learning</button><button data-status-word="${escapeHtml(entryKey(v))}" data-status="new" aria-label="Reset ${escapeHtml(v.word)}">Reset</button></div></td></tr>`;
    }).join('');
  }
  function studyVocabResults(){
    if(!lastVocabRows.length){toast('No vocabulary matches these filters.');return;}
    createCustomDeck(lastVocabRows,'Filtered vocabulary');
    switchTab('flashcards');
    toast(`Studying ${deck.length} filtered words`);
  }

  // ===========================
  // Lessons
  // ===========================
  function planFor(level){
    const k=String(level);
    if (!lessons[k]||typeof lessons[k]!=='object'||Array.isArray(lessons[k])) lessons[k] = {wordsPerDay:10,startDate:'',completedDays:0,completedDates:[],coveredWords:0,daySizes:[]};
    const plan=lessons[k],total=listForLevel(level).length;
    // Migrate v0.30 plans without losing any completed-day or vocabulary progress.
    const n=Math.max(1,Math.min(100,Math.floor(Number(plan.wordsPerDay)||10)));
    plan.wordsPerDay=n;plan.completedDates=Array.isArray(plan.completedDates)?plan.completedDates.filter(x=>typeof x==='string').slice(0,600):[];
    plan.completedDays=Math.max(0,Math.min(600,Math.floor(Number(plan.completedDays)||0)));
    if(!Array.isArray(plan.daySizes)||plan.daySizes.length!==plan.completedDays||plan.daySizes.some(n=>!Number.isInteger(n)||n<0||n>100)){
      plan.daySizes=Array(plan.completedDays).fill(n);
    }
    if(plan.coveredWords==null || !Number.isFinite(Number(plan.coveredWords))){
      plan.coveredWords=Math.min(total,plan.completedDays*n);
    }
    plan.coveredWords=Math.max(0,Math.min(total,Math.floor(Number(plan.coveredWords)||0)));
    return plan;
  }
  function listForLevel(level){ return Number(level)===2 ? HSK2 : HSK3; }
  function currentLessonWords(level){
    const plan = planFor(level), list = listForLevel(level), n = Math.max(1, Number(plan.wordsPerDay||10));
    const start = Math.min(plan.coveredWords, list.length);
    return list.slice(start, start+n);
  }
  function savePlan(level){
    const plan = planFor(level), input = $('lessonDaily'+level);
    plan.wordsPerDay = Math.max(1, Math.min(100, Math.floor(Number(input.value) || 10)));
    if (!plan.startDate) plan.startDate = todayISO();
    saveLessons(); activeLessonLevel = Number(level); renderLessons();
  }
  function resetPlan(level){
    if (!confirm(`Reset HSK ${level} lesson progress? Word statuses will stay unchanged.`)) return;
    lessons[String(level)] = {wordsPerDay:Math.max(1,Math.min(100,Math.floor(Number($('lessonDaily'+level).value)||10))),startDate:'',completedDays:0,completedDates:[],coveredWords:0,daySizes:[]};
    invalidateLessonSession(level);saveLessons(); activeLessonLevel = Number(level); renderLessons();
  }
  function completeLesson(){
    const plan = planFor(activeLessonLevel), words = currentLessonWords(activeLessonLevel);
    if (!words.length) return;
    plan.completedDates = plan.completedDates || [];
    if(plan.completedDates.includes(todayISO()) && !confirm('You have already completed a study day today. Advance another day?'))return;
    plan.completedDays += 1;
    plan.coveredWords=Math.min(listForLevel(activeLessonLevel).length,plan.coveredWords+words.length);
    plan.daySizes.push(words.length);
    plan.completedDates.push(todayISO());
    saveLessons();renderLessons();toast(`HSK ${activeLessonLevel} day completed.`);
  }
  function markLesson(status){
    const words=currentLessonWords(activeLessonLevel);if(!words.length)return;
    if(!confirm(`Mark all ${words.length} lesson words as ${status}?`))return;
    words.forEach(v=>{if(status==='new')delete statuses[entryKey(v)];else statuses[entryKey(v)]=status;});
    writeJSON(STORE.statuses,statuses);renderAll();toast(`${words.length} lesson words marked ${status}.`);
  }
  function undoLessonDay(){
    const plan=planFor(activeLessonLevel);if(!plan.completedDays)return;
    if(!confirm(`Return to the previous HSK ${activeLessonLevel} study day? Word statuses will remain unchanged.`))return;
    plan.completedDays--;if(Array.isArray(plan.completedDates))plan.completedDates.pop();
    const back=(Array.isArray(plan.daySizes)&&plan.daySizes.length)?plan.daySizes.pop():Math.max(1,Number(plan.wordsPerDay)||10);
    plan.coveredWords=Math.max(0,plan.coveredWords-back);
    invalidateLessonSession(activeLessonLevel);saveLessons();renderLessons();toast('Returned to the previous study day.');
  }
  function invalidateLessonSession(level){if(lessonSession?.level!==Number(level))return;lessonSession=null;deck=[];deckIndex=0;deckReviewed=[];deckFinished=false;deckLabel='';flashRevealPinyin=false;flashRevealEnglish=false;toggleFlashStrokePanel(false);renderFlash();}
  function studyLessonWords(){
    if(lessonSession&&!lessonSession.complete&&lessonSession.level===activeLessonLevel&&lessonSession.start===planFor(activeLessonLevel).coveredWords){switchTab('flashcards');renderFlash();return;}
    const words=currentLessonWords(activeLessonLevel);
    if(!words.length){toast('This study plan is complete.');return;}
    createCustomDeck(words,`HSK ${activeLessonLevel} lesson`);
    const plan=planFor(activeLessonLevel);
    lessonSession={level:activeLessonLevel,start:plan.coveredWords,day:plan.completedDays+1,reviewed:[],complete:false};
    renderFlash();
    switchTab('flashcards');
    toast(`Loaded ${words.length} lesson words into flashcards.`);
  }
  function renderLessonMeta(level){
    const plan = planFor(level), list = listForLevel(level), n = Math.max(1, Number(plan.wordsPerDay||10));
    const done=plan.coveredWords,pct=Math.round(done/list.length*100);
    const known=list.filter(v=>statusOf(entryKey(v))==='known').length;
    const learning=list.filter(v=>statusOf(entryKey(v))==='learning').length;
    const knownPct=Math.round(known/list.length*100);
    $('lessonPercent'+level).textContent=knownPct+'% known';
    $('lessonLevelBar'+level).style.width=knownPct+'%';
    $('lessonMeter'+level).setAttribute('aria-valuenow',knownPct);
    $('lessonStats'+level).textContent=`${known} / ${list.length} known · ${learning} learning`;
    const start=document.querySelector(`[data-start-lesson="${level}"]`);
    start.disabled=done>=list.length;
    start.textContent=done>=list.length?'Plan complete':`${plan.completedDates?.includes(todayISO())?'✓ Today complete · Start':'Study'} day ${plan.completedDays+1} · ${currentLessonWords(level).length} words →`;
    $('lessonDaily'+level).value = n;
    $('lessonMeta'+level).textContent = `${done}/${list.length} words covered (${pct}%). Day ${plan.completedDays+1}. ${plan.startDate ? 'Started '+plan.startDate+'.' : 'Not started.'}`;
  }
  function renderLessons(){
    renderLessonMeta(2); renderLessonMeta(3);
    document.querySelectorAll('[data-lesson-load]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.lessonLoad)===activeLessonLevel)));
    const level = activeLessonLevel, plan = planFor(level), list = listForLevel(level), words = currentLessonWords(level);
    const done=plan.coveredWords;
    $('lessonTitle').textContent=`HSK ${level} · Day ${plan.completedDays+1}`;
    $('lessonSummary').textContent = words.length ? `${words.length} words today · ${done}/${list.length} completed` : `HSK ${level} complete`;
    $('lessonProgressBar').style.width = `${Math.round(done/list.length*100)}%`;
    $('lessonUndoBtn').disabled=!(plan.completedDays>0);
    ['lessonMarkLearning','lessonMarkKnown','lessonStudyBtn','lessonComplete'].forEach(id=>$(id).disabled=!words.length);
    $('lessonWords').innerHTML=words.length?words.map(v=>{
      const st=statusOf(entryKey(v));
      return `<div class="lesson-word"><button class="word-link zh" data-word="${escapeHtml(entryKey(v))}">${escapeHtml(v.word)}</button><div><strong>${escapeHtml(v.pinyin)}</strong><br><span class="small">${escapeHtml(v.english)}</span></div><div class="lesson-word-actions"><button class="good ${st==='known'?'is-set':''}" data-status-word="${escapeHtml(entryKey(v))}" data-status="known">Known</button><button class="learn ${st==='learning'?'is-set':''}" data-status-word="${escapeHtml(entryKey(v))}" data-status="learning">Learning</button></div></div>`;
    }).join(''):'<p class="small">This HSK level is complete. Reset the plan to start again.</p>';
  }

  // ===========================
  // Flashcards
  // ===========================
  let deckReviewed=[],deckFinished=false;
  let lessonSession=null;
  let deck=[], deckIndex=0, flashRevealPinyin=false, flashRevealEnglish=false, flashStrokeWriters=[], flashStrokeTraceMode=false, flashStrokeOpen=false, flashStrokeRenderedWord='', deckLabel='';
  function getDeck(sel){
    return sel==='due'?dueEntries():sel==='2'?VOCAB.filter(v=>v.level===2):
      sel==='3'?VOCAB.filter(v=>v.level===3):
      sel==='learning'?VOCAB.filter(v=>statusOf(entryKey(v))==='learning'):
      sel==='new'?VOCAB.filter(v=>statusOf(entryKey(v))==='new'):VOCAB.slice();
  }
  function createCustomDeck(words,label){
    lessonSession=null;deckReviewed=[];deckFinished=false;
    deck=words.map(v=>resolveEntry(entryKey(v))).filter(Boolean);
    deckLabel=label;deckIndex=0;flashRevealPinyin=false;flashRevealEnglish=false;
    flashStrokeTraceMode=false;toggleFlashStrokePanel(false);renderFlash();
  }
  function flipFlash(){
    if(!currentCard())return;
    const reveal=!(flashRevealPinyin&&flashRevealEnglish);
    flashRevealPinyin=reveal;flashRevealEnglish=reveal;renderFlash();
  }
  function flashDeckLimit(){
    const el = $('flashDeckCount');
    const raw = Number(el?.value || 20);
    const n = Number.isFinite(raw) ? Math.max(1, Math.min(VOCAB.length, Math.floor(raw))) : 20;
    if (el) el.value = String(n);
    return n;
  }
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
  function normalizePinyinBasic(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ü/g,'v'); }
  function isValidPinyinSyllableBasic(s){
    const t = normalizePinyinBasic(s);
    return /^(zh|ch|sh|b|p|m|f|d|t|n|l|g|k|h|j|q|x|r|z|c|s|y|w)?(iang|iong|uang|ueng|iao|ian|uan|uai|uei|ang|eng|ong|ing|uo|ua|ui|un|iu|ie|ve|er|ai|ei|ao|ou|an|en|ia|in|ue|a|o|e|i|u|v)$/.test(t);
  }
  function splitTwoSyllablePinyin(pinyin){
    const raw = String(pinyin||'').trim();
    if (!raw || raw.includes(' ')) return raw.replace(/\s+/g,' · ');
    for (let i=1;i<raw.length;i++) {
      const left = raw.slice(0,i), right = raw.slice(i);
      if (isValidPinyinSyllableBasic(left) && isValidPinyinSyllableBasic(right)) return `${left} · ${right}`;
    }
    return raw;
  }
  function displayFlashPinyin(v){
    const chars = Array.from(String(v.word||'')).filter(isChineseChar).length;
    if (chars===2) return splitTwoSyllablePinyin(v.pinyin);
    return String(v.pinyin||'').replace(/\s+/g,' · ');
  }
  function flashBackText(v){
    const parts = [];
    if (flashRevealPinyin) parts.push(displayFlashPinyin(v));
    if (flashRevealEnglish) parts.push(v.english);
    return parts.join(' · ');
  }
  function setFlashReveal(kind){
    if (kind === 'pinyin') flashRevealPinyin = !flashRevealPinyin;
    if (kind === 'english') flashRevealEnglish = !flashRevealEnglish;
    renderFlash();
  }
  function toggleFlashStrokePanel(forceOpen){
    if (typeof forceOpen === 'boolean') flashStrokeOpen = forceOpen; else flashStrokeOpen = !flashStrokeOpen;
    const shell = $('flashStrokeShell');
    if (shell) {
      shell.classList.toggle('open',flashStrokeOpen);shell.inert=!flashStrokeOpen;
      shell.setAttribute('aria-hidden',flashStrokeOpen?'false':'true');
      if(flashStrokeOpen&&!shell.open){shell.showModal();$('flashExitTraceBtn').focus();}
      else if(!flashStrokeOpen&&shell.open){shell.close();$('flashStrokeToggleBtn').focus();}
    }
    const btn = $('flashStrokeToggleBtn');
    if (btn) btn.classList.toggle('active', flashStrokeOpen);
    if (!flashStrokeOpen) {
      ++flashStrokeGeneration;
      cancelWriters(flashStrokeWriters);flashStrokeWriters=[];
      $('flashStrokeStatus').textContent = '';
      $('flashStrokePanel').innerHTML = '';
      $('flashStrokePanel').closest('.stroke-panel')?.classList.remove('trace-mode');
      flashStrokeRenderedWord = '';
      syncTraceButtons('flash',false,true);
      return;
    }
    flashStrokeTraceMode = true;flashStrokeGuide=true;
    flashStrokeRenderedWord = '';
    renderFlashStroke({traceMode:true, startQuiz:true, force:true});
  }
  function newDeck(){
    lessonSession=null;deckReviewed=[];deckFinished=false;
    let candidates=getDeck($('flashLevel').value);
    if($('flashSkipKnown').checked)candidates=candidates.filter(v=>statusOf(entryKey(v))!=='known');
    if($('flashShuffle').checked)shuffle(candidates);
    deck=candidates.slice(0,flashDeckLimit());
    deckLabel=$('flashLevel').value==='due'?'Due review':'';deckIndex=0;flashRevealPinyin=false;flashRevealEnglish=false;
    flashStrokeTraceMode=false;toggleFlashStrokePanel(false);renderFlash();
    if(!deck.length)toast('No words match this deck. Try another deck or disable Skip known.');
  }
  function currentCard(){ return (deckFinished||lessonSession?.complete)?null:deck[deckIndex] || null; }
  async function renderFlashStroke(opts={}){
    const panel=$('flashStrokePanel'),status=$('flashStrokeStatus'),v=currentCard();
    if(!panel||!status||!flashStrokeOpen)return;
    const wrap=panel.closest('.stroke-panel');
    if(!v){panel.textContent='No flashcard selected.';status.textContent='';flashStrokeRenderedWord='';return;}
    const traceMode=opts.traceMode??flashStrokeTraceMode;
    const startQuiz=!!opts.startQuiz;
    if(!opts.force && flashStrokeRenderedWord===v.word && !traceMode)return;
    cancelWriters(flashStrokeWriters);
    const generation=++flashStrokeGeneration;
    const valid=()=>generation===flashStrokeGeneration&&flashStrokeOpen&&currentCard()===v&&$('flashStrokePanel')===panel;
    const chars=Array.from(v.word).filter(isChineseChar).slice(0,8);
    if(!chars.length){panel.textContent='No Chinese characters found.';return;}
    status.textContent='Loading stroke data...';
    syncTraceButtons('flash',traceMode,flashStrokeGuide);
    try{
      await ensureHanziWriter();if(!valid())return;
      flashStrokeWriters=renderStrokeSurfaces({panel,status,wrap,chars,prefix:'flashStrokeTarget',traceMode,startQuiz,valid,guideVisible:flashStrokeGuide});
      flashStrokeRenderedWord=v.word;
    }catch(err){if(valid()){status.textContent='Unavailable';panel.innerHTML='<span class="small">Writing files could not load. Try Repair offline copy in Settings.</span>';flashStrokeRenderedWord='';}}
  }
  function replayFlashStrokes(){if(!flashStrokeOpen)return;flashStrokeTraceMode=false;renderFlashStroke({traceMode:false,startQuiz:false,force:true});}
  async function traceFlashStrokes(){
    if(!flashStrokeOpen)toggleFlashStrokePanel(true);
    flashStrokeTraceMode=true;flashStrokeGuide=true;
    await renderFlashStroke({traceMode:true,startQuiz:true,force:true});
  }
  function cardSyllables(v){
    const chars=Array.from(v.word),raw=v.pinyin.replace(/[’'·\s-]+/g,'');
    const memo=new Map();
    function split(offset,index){
      if(index===chars.length)return offset===raw.length?{parts:[],score:0}:null;
      const key=offset+':'+index;if(memo.has(key))return memo.get(key);
      let best=null;
      for(let n=1;n<=6&&offset+n<=raw.length;n++){
        const part=raw.slice(offset,offset+n);if(!isValidPinyinSyllableBasic(part)&&!(part==='r'&&chars[index]==='儿'))continue;
        const rest=split(offset+n,index+1);if(!rest)continue;
        const match=VOCAB.some(w=>w.word===chars[index]&&normalizePinyinBasic(w.pinyin)===normalizePinyinBasic(part));
        const score=rest.score+(match?10:0)+( /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(part)?1:0);
        if(!best||score>best.score)best={parts:[part,...rest.parts],score};
      }
      memo.set(key,best);return best;
    }
    return split(0,0)?.parts||[v.pinyin];
  }
  function finishLessonSession(){
    if(!lessonSession||lessonSession.complete)return;
    const plan=planFor(lessonSession.level);
    if(plan.coveredWords===lessonSession.start){
      plan.coveredWords=Math.min(listForLevel(lessonSession.level).length,plan.coveredWords+deck.length);
      plan.completedDays++;plan.daySizes.push(deck.length);
      (plan.completedDates ||= []).push(todayISO());saveLessons();
    }
    lessonSession.complete=true;flashStrokeTraceMode=false;toggleFlashStrokePanel(false);
    $('swipeStatus').textContent='';renderAll();$('lessonFinished').focus();
  }
  function renderFlash(){
    const v=currentCard();
    saveFlashSession();
    $('reviewRating').hidden=true;
    const finished=deckFinished||!!lessonSession?.complete;
    $('lessonFinished').querySelector('h2').textContent='Congrats, you’re done!';
    $('backToLessonsBtn').textContent='Back to Lessons';
    $('lessonFinished').hidden=!finished;
    document.querySelector('.flash-stage').hidden=finished;
    document.querySelector('.swipe-actions').hidden=finished;
    $('swipeInstructions').hidden=finished;
    document.querySelector('.flash-control-row').hidden=finished;
    document.querySelector('.flash-top-card').hidden=!!lessonSession;
    $('flashPrevBtn').disabled=!!lessonSession&&deckIndex===0;
    $('flashNextArrowBtn').disabled=!!lessonSession&&deckIndex===deck.length-1;
    if(finished){
      $('lessonFinishedText').textContent=lessonSession?`HSK ${lessonSession.level} · Day ${lessonSession.day} · ${deck.length} words reviewed. Your progress is saved.`:`${deck.length} words reviewed${deckLabel?' · '+deckLabel:''}. Your progress is saved.`;
      $('flashProgress').textContent=`${deck.length} / ${deck.length} reviewed · ${lessonSession?'Lesson':'Review'} complete`;
      $('flashDeckProgressFill').style.width='100%';
      $('sessionProgressText').textContent=`${deck.length} / ${deck.length} reviewed`;
      return;
    }
    $('nextReviewLabel').textContent=v?nextIntervalLabel(v):'1 day';
    $('reviewRatingHint').textContent='How well did you recall this word?';
    $('flashTogglePinyinBtn')?.classList.toggle('active', flashRevealPinyin);
    $('flashToggleEnglishBtn')?.classList.toggle('active', flashRevealEnglish);
    if(!v){ $('sessionProgressText').textContent='0 / 0 reviewed';$('flashPrevBtn').disabled=true;$('flashNextArrowBtn').disabled=true; $('flashDeckProgressFill').style.width='0%'; $('flashFront').textContent='No matching words'; $('flashFront').classList.add('flash-card-empty'); $('flashBack').hidden=true; $('flashBack').textContent=''; $('flashProgress').textContent='Choose another deck, change filters, or mark some words Learning.'; if (!flashStrokeOpen) {$('flashStrokePanel').innerHTML=''; $('flashStrokeStatus').textContent='';} return; }
    $('flashFront').classList.remove('flash-card-empty');
    const syllables=cardSyllables(v);
    $('flashFront').innerHTML=Array.from(v.word).map((ch,i)=>`<span class="han-pair"><span class="card-pinyin" aria-hidden="${!flashRevealPinyin}">${escapeHtml(syllables[i]||'')}</span><span>${escapeHtml(ch)}</span></span>`).join('');
    $('flashFront').classList.toggle('show-pinyin',flashRevealPinyin);
    $('flashBack').textContent=v.english;
    $('flashBack').hidden=false;
    $('flashBack').classList.toggle('show-meaning',flashRevealEnglish);
    $('flashBack').setAttribute('aria-hidden',String(!flashRevealEnglish));
    const reviewed=lessonSession?lessonSession.reviewed.length:deckReviewed.length;
    $('sessionProgressText').textContent=lessonSession?`${reviewed} / ${deck.length} reviewed · Day ${lessonSession.day}`:`${reviewed} / ${deck.length} reviewed`;
    $('flashProgress').textContent = `${reviewed} / ${deck.length} reviewed · HSK ${v.level} · ${statusOf(entryKey(v))}${deckLabel?' · '+deckLabel:''}`;
    $('flashDeckProgressFill').style.width=`${reviewed/deck.length*100}%`;
    if (flashStrokeOpen && flashStrokeRenderedWord !== v.word) renderFlashStroke({traceMode:flashStrokeTraceMode, startQuiz:flashStrokeTraceMode, force:true});
  }
  function nextFlash(){ if(!deck.length) return; deckIndex=lessonSession?Math.min(deckIndex+1,deck.length-1):(deckIndex+1)%deck.length; flashRevealPinyin=false; flashRevealEnglish=false; flashStrokeTraceMode=false; flashStrokeRenderedWord=''; renderFlash(); }
  function prevFlash(){ if(!deck.length) return; deckIndex=lessonSession?Math.max(0,deckIndex-1):(deckIndex-1+deck.length)%deck.length; flashRevealPinyin=false; flashRevealEnglish=false; flashStrokeTraceMode=false; flashStrokeRenderedWord=''; renderFlash(); }

  // ===========================
  // Quiz
  // ===========================
  let quiz={score:0,total:0,current:null,locked:false,max:20,deck:[],index:0,currentDir:'zh-en',missed:[]};
  function quizPool(){return getDeck($('quizLevel').value);}
  function quizCountLimit(){const el=$('quizCount');const raw=Number(el?.value||20);const n=Number.isFinite(raw)?Math.max(1,Math.min(VOCAB.length,Math.floor(raw))):20;if(el)el.value=String(n);return n;}
  function pickQuizDirection(){
    const dir=$('quizDirection').value;
    const pick = arr => arr[Math.floor(Math.random()*arr.length)];
    if (dir === 'mix-zh-en') return pick(['zh-en','en-zh']);
    if (dir === 'mix-py-zh') return pick(['py-zh','zh-py']);
    if (dir === 'mix-py-en') return pick(['py-en','en-py']);
    if (dir === 'supermix') return pick(['zh-en','en-zh','py-zh','zh-py','py-en','en-py']);
    return dir;
  }
  function quizPromptFor(card, dir){
    if (dir==='zh-en') return card.word==='长'?`${card.word} (${card.pinyin})`:card.word;
    if (dir==='en-zh') return card.english;
    if (dir==='py-zh') return displayFlashPinyin(card);
    if (dir==='zh-py') return card.word==='长'?`${card.word} · ${card.english}`:card.word;
    if (dir==='py-en') return displayFlashPinyin(card);
    if (dir==='en-py') return card.english;
    return card.word;
  }
  function quizCorrectFor(card, dir){
    if (dir==='zh-en') return card.english;
    if (dir==='en-zh') return card.word;
    if (dir==='py-zh') return card.word;
    if (dir==='zh-py') return displayFlashPinyin(card);
    if (dir==='py-en') return card.english;
    if (dir==='en-py') return displayFlashPinyin(card);
    return card.english;
  }
  function quizOptionValue(v, dir){
    if (dir==='zh-en') return v.english;
    if (dir==='en-zh') return v.word;
    if (dir==='py-zh') return v.word;
    if (dir==='zh-py') return displayFlashPinyin(v);
    if (dir==='py-en') return v.english;
    if (dir==='en-py') return displayFlashPinyin(v);
    return v.english;
  }
  function startQuiz(poolOverride=null){
    const pool=poolOverride||quizPool();
    if(!pool.length){
      quiz={score:0,total:0,current:null,locked:false,max:0,deck:[],index:0,currentDir:'zh-en',missed:[]};
      $('quizPrompt').textContent='No words in this deck';$('quizPrompt').classList.add('quiz-idle');
      $('quizOptions').innerHTML='';$('quizFeedback').textContent='Select a different deck or mark some words for review.';
      $('quizNextBtn').disabled=true;$('quizRetryMissedBtn').hidden=true;renderQuizScore();return;
    }
    const count=poolOverride?pool.length:Math.min(quizCountLimit(),pool.length);
    quiz={score:0,total:0,current:null,locked:false,max:count,deck:shuffle(pool.slice()).slice(0,count),index:0,currentDir:'zh-en',missed:[]};
    $('quizRetryMissedBtn').hidden=true;renderQuizScore();nextQuiz();
  }
  function nextQuiz(){
    if(!quiz.deck.length||quiz.index>=quiz.deck.length){
      $('quizPrompt').textContent=quiz.total?'Quiz complete':'Press Start Quiz';
      $('quizPrompt').classList.remove('quiz-prompt-latin','quiz-prompt-han');$('quizPrompt').classList.add('quiz-idle');
      $('quizOptions').innerHTML='';
      $('quizFeedback').textContent=quiz.total?`Final score: ${quiz.score} / ${quiz.total} · ${quiz.missed.length} to revisit`:'';
      $('quizNextBtn').disabled=true;
      $('quizRetryMissedBtn').hidden=!quiz.missed.length;
      quiz.current=null;renderQuizScore();return;
    }
    quiz.current=quiz.deck[quiz.index];quiz.currentDir=pickQuizDirection();quiz.locked=false;
    $('quizFeedback').textContent='';$('quizNextBtn').disabled=true;
    const dir=quiz.currentDir;
    $('quizPrompt').textContent=quizPromptFor(quiz.current,dir);
    $('quizPrompt').classList.remove('quiz-idle');
    $('quizPrompt').classList.toggle('quiz-prompt-latin',['en-zh','py-zh','py-en','en-py'].includes(dir));
    $('quizPrompt').classList.toggle('quiz-prompt-han',['zh-en','zh-py'].includes(dir));
    const correct=quizCorrectFor(quiz.current,dir);
    const distractors=[];
    for(const v of shuffle(VOCAB.filter(v=>v.word!==quiz.current.word))){
      const value=quizOptionValue(v,dir);
      if(value===correct||distractors.includes(value))continue;
      distractors.push(value);if(distractors.length>=3)break;
    }
    const options=shuffle([correct,...distractors]);
    $('quizOptions').innerHTML=options.map(o=>`<button class="quiz-option ${Array.from(String(o)).some(isChineseChar)?'quiz-option-han':''}" data-answer="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('');
    $('quizNextBtn').textContent='Next question';renderQuizScore();
  }
  function answerQuiz(answer,btn){
    if(quiz.locked||!quiz.current)return;
    quiz.locked=true;quiz.total++;
    const correct=quizCorrectFor(quiz.current,quiz.currentDir);
    if(answer===correct){quiz.score++;btn.classList.add('correct');}
    else{btn.classList.add('wrong');quiz.missed.push(quiz.current);[...document.querySelectorAll('.quiz-option')].forEach(b=>{if(b.dataset.answer===correct)b.classList.add('correct');});}
    $('quizFeedback').textContent=answer===correct?`Correct · ${quiz.current.word} · ${quiz.current.pinyin} · ${quiz.current.english}`:`Correct answer: ${correct} · ${quiz.current.word} · ${quiz.current.pinyin}`;
    if(answer!==correct&&statusOf(entryKey(quiz.current))!=='known')setStatus(entryKey(quiz.current),'learning');
    quiz.index++;
    [...document.querySelectorAll('.quiz-option')].forEach(b=>b.disabled=true);
    $('quizNextBtn').disabled=false;
    $('quizNextBtn').textContent=quiz.index>=quiz.deck.length?'Finish quiz':'Next question';
    renderQuizScore();
  }
  function renderQuizScore(){ $('quizScore').textContent=`Score: ${quiz.score} / ${quiz.total}`; }

  // ===========================
  // Settings, backup, event bindings
  // ===========================
  function applySettingsToUI(){
    document.documentElement.dataset.theme = settings.dark ? 'dark' : 'light';
    $('darkToggle').textContent = settings.dark ? '☀️' : '🌙';
    $('darkToggle').title = settings.dark ? 'Switch to light mode' : 'Switch to dark mode';
    $('darkToggle').setAttribute('aria-label', $('darkToggle').title);
    ['filter2','filter3','hideKnown','showPinyin','showEnglish','onlineTranslate','autoStroke'].forEach(id=>{ if($(id)) $(id).checked = !!settings[id]; });
    if ($('ttsRate')) { $('ttsRate').value = settings.ttsRate; $('ttsRateLabel').textContent = `${Number(settings.ttsRate).toFixed(2)}x`; }
    $('readerFontSize').value=Math.max(18,Math.min(38,Number(settings.readerFontSize)||26));
    $('readerFontSizeLabel').textContent=`${$('readerFontSize').value}px`;
    $('flashSkipKnown').checked=!!settings.flashSkipKnown;
    $('readerLineHeight').value=settings.readerLineHeight;$('readerLineHeightLabel').textContent=Number(settings.readerLineHeight).toFixed(1);
    $('dailyGoal').value=settings.dailyGoal;
    document.querySelector('meta[name="theme-color"]').content=settings.dark?'#101b2c':'#f5f5f0';
  }
  const SIDEBAR_STORE = 'hskReaderSidebarCollapsed.v01';
  function syncSidebarState(){ try{document.body.classList.toggle('sidebar-collapsed',localStorage.getItem(SIDEBAR_STORE)==='1');}catch{document.body.classList.remove('sidebar-collapsed');} }
  function syncVocabSearchClear(){ const btn = $('clearVocabSearchBtn'); if (!btn) return; btn.style.visibility = $('vocabSearch').value ? 'visible' : 'hidden'; }
  function renderProgressSummary(){
    const known=VOCAB.filter(v=>statusOf(entryKey(v))==='known').length;
    const learning=VOCAB.filter(v=>statusOf(entryKey(v))==='learning').length;
    const fresh=VOCAB.length-known-learning;
    $('headerProgress').textContent=`${known} known · ${learning} learning`;
    const orbit=$('headerProgressOrbit');if(orbit){orbit.style.setProperty('--completion',`${Math.min(100,known/VOCAB.length*100).toFixed(2)}%`);orbit.setAttribute('aria-label',`${known} of ${VOCAB.length} vocabulary words known`);}
    $('progressSummary').innerHTML=[['Known',known],['Learning',learning],['New',fresh]].map(([k,n])=>`<div class="progress-stat"><strong>${n}</strong><small>${k}</small></div>`).join('');
  }
  function renderAll(){window.refreshReadingStudio?.();renderDaily();renderReader();renderVocab();renderLessons();renderFlash();renderProgressSummary();const stats=$('dataStats');if(stats)stats.textContent=`Embedded rows: ${RAW_VOCAB.length}. Reader entries: ${VOCAB.length}. HSK 2: ${HSK2.length}. HSK 3: ${HSK3.length}.`;}
  const APP_TAB_NAMES=['lessons','flashcards','reader','workspace','vocab','quiz','settings'];
  const APP_TAB_DETAILS={workspace:['Workspace','YOUR TEXTS & TOOLS'],reader:['Reader','READ · LEARN · RETAIN'],vocab:['Vocabulary','BROWSE & DISCOVER'],lessons:['Lessons','DAILY STUDY PLAN'],flashcards:['Flashcards','RECALL PRACTICE'],quiz:['Quiz','TEST YOUR KNOWLEDGE'],settings:['Settings','MAKE IT YOURS']};
  function switchTab(name){
    if(!APP_TAB_NAMES.includes(name))return;
    document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
    document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===name));
    $('pageTitle').textContent=APP_TAB_DETAILS[name][0];$('pageKicker').textContent=APP_TAB_DETAILS[name][1];
    document.title=`${APP_TAB_DETAILS[name][0]} · HSK Reader`;
    document.body.classList.remove('focus-reading');$('focusReaderBtn').setAttribute('aria-pressed','false');$('focusReaderBtn').textContent='Focus';
    stopVoice();
    if(name==='workspace'&&compactEditor())showPassageEditor(true);
    if(name!=='flashcards'&&flashStrokeOpen)toggleFlashStrokePanel(false);
    writeJSON(STORE.lastTab,name);
    $('mainContent').scrollTop=0;window.scrollTo({top:0,behavior:'instant'});
  }
  function getBackup(){
    const legacy={};
    for(const word of BY_WORD.keys()){
      const variants=VOCAB.filter(v=>v.word===word),states=variants.map(v=>statusOf(entryKey(v)));
      const state=states.every(s=>s==='known')?'known':states.some(s=>s!=='new')?'learning':'new';
      if(state!=='new')legacy[word]=state;
    }
    return {version:'1.0',schemaVersion:2,exportedAt:new Date().toISOString(),settings,statuses:legacy,entryStatuses:statuses,lessons,readerText:$('inputText').value,studio:extras};
  }
  function importBackup(raw){
    let data;
    try{
      data=JSON.parse(raw);
      if(!data||typeof data!=='object'||Array.isArray(data)||(!data.settings&&!data.statuses&&!data.lessons&&typeof data.readerText!=='string'))throw Error('Unrecognized backup');
      for(const key of ['settings','statuses','entryStatuses','lessons','studio'])if(data[key]!=null&&(typeof data[key]!=='object'||Array.isArray(data[key])))throw Error('Invalid '+key);
      if(data.readerText!=null&&typeof data.readerText!=='string')throw Error('Invalid reader text');
      if(data.schemaVersion&&data.schemaVersion>2)throw Error('This backup needs a newer version of HSK Reader');
    }catch(err){toast('Backup not imported: '+err.message);return;}
    const nextSettings=data.settings?normalizeSettings(data.settings):settings;
    let nextStatuses={...statuses};
    if(data.entryStatuses||data.statuses){nextStatuses={};for(const [k,v] of Object.entries(data.entryStatuses||data.statuses))if((BY_ID.has(k)||BY_WORD.has(k))&&['known','learning','new'].includes(v))nextStatuses[k]=v;}
    const nextLessons=JSON.parse(JSON.stringify(lessons));
    if(data.lessons)for(const level of ['2','3']){
      const v=data.lessons[level];if(!v||typeof v!=='object'||Array.isArray(v))continue;
      nextLessons[level]={wordsPerDay:Math.max(1,Math.min(100,Math.floor(Number(v.wordsPerDay)||10))),startDate:typeof v.startDate==='string'?v.startDate:'',completedDays:Math.max(0,Math.min(600,Math.floor(Number(v.completedDays)||0))),completedDates:Array.isArray(v.completedDates)?v.completedDates.filter(x=>typeof x==='string').slice(0,600):[],coveredWords:v.coveredWords!=null&&Number.isFinite(Number(v.coveredWords))?Math.max(0,Math.floor(Number(v.coveredWords))):null,daySizes:Array.isArray(v.daySizes)?v.daySizes.slice(0,600).map(n=>Math.max(0,Math.floor(Number(n)||0))):null};
    }
    const nextExtras=data.studio?sanitizeExtras(data.studio):sanitizeExtras(extras);
    if(!data.studio)nextExtras.session=null;
    const nextText=typeof data.readerText==='string'?data.readerText:$('inputText').value;
    if(!canPersistStudy()){toast('Reopen the app before importing a backup.');return;}
    if(!confirm('Replace the backup fields on this device? Download your current backup first if you want to keep it. Saved passages and review schedules stay unchanged when importing an older backup without those fields.'))return;
    const entries=[[STORE.settings,nextSettings],[STORE.statuses,nextStatuses],[STORE.lessons,nextLessons],[STORE.draft,nextText],[STORE.extras,nextExtras]],prior=new Map();
    try{
      for(const [k] of entries)prior.set(k,localStorage.getItem(k));
      for(const [k,v] of entries)localStorage.setItem(k,JSON.stringify(v));
    }catch(err){
      let restored=true;for(const [k,v] of prior){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{restored=false;}}
      toast(restored?'Storage could not save the import. Your current data was retained.':'Storage failed during import. Download the current in-memory backup before closing.');return;
    }
    clearTimeout(readerInputTimer);++translationRequestId;$('translationBox').hidden=true;
    settings=nextSettings;statuses=nextStatuses;lessons=nextLessons;extras=nextExtras;$('inputText').value=nextText;
    clearTransientStudy();applySettingsToUI();restoreFlashSession();renderAll();renderPassages();toast('Backup imported.');
  }

  function downloadBackup(){
    try{
      const data=JSON.stringify(getBackup(),null,2);
      const blob=new Blob([data],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`hsk-reader-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Backup download requested.');
    }catch{ $('jsonBox').value=JSON.stringify(getBackup(),null,2);toast('Download unavailable. Copy the backup JSON from the box.'); }
  }

  document.addEventListener('click', e=>{
    const tab = e.target.closest('[data-tab]');
    if(tab){switchTab(tab.dataset.tab);return;}
    const wordEl = e.target.closest('[data-word]');
    if(wordEl){ showWord(wordEl.dataset.word, wordEl.dataset.tokenIndex); return; }
    const st = e.target.closest('[data-status-word]');
    if(st){ setStatus(st.dataset.statusWord, st.dataset.status); return; }
    const ls = e.target.closest('[data-lesson-save]'); if(ls){ savePlan(ls.dataset.lessonSave); return; }
    const startLesson=e.target.closest('[data-start-lesson]'); if(startLesson){activeLessonLevel=Number(startLesson.dataset.startLesson);renderLessons();studyLessonWords();return;}
    const ll = e.target.closest('[data-lesson-load]'); if(ll){ activeLessonLevel=Number(ll.dataset.lessonLoad); renderLessons(); return; }
    const lr = e.target.closest('[data-lesson-reset]'); if(lr){ resetPlan(lr.dataset.lessonReset); return; }
  });
  let undoneReaderText=null,readerInputTimer=0;
  function saveReaderDraft(){if(!canPersistStudy())return false;const extrasOK=saveExtras(),draftOK=writeJSON(STORE.draft,$('inputText').value),ok=extrasOK&&draftOK;$('draftNotice').textContent=ok?'Draft saved on this device':'Not saved — export a backup';return ok;}
  function onReaderChanged(){
    ++translationRequestId;
    extras.activePassage='';
    $('translationBox').hidden=true;
    clearTimeout(readerInputTimer);
    $('draftNotice').textContent='Saving…';
    readerInputTimer=setTimeout(()=>{saveReaderDraft();renderReader();},300);
  }
  $('inputText').addEventListener('input',()=>{undoneReaderText=null;$('undoClearBtn').hidden=true;onReaderChanged();});
  const compactEditor=()=>window.matchMedia('(max-width:900px)').matches;
  function showPassageEditor(open,{focus=false,scroll=false}={}){
    document.body.classList.toggle('editor-open',Boolean(open));
    $('editPassageBtn').setAttribute('aria-expanded',String(Boolean(open)));
    $('editPassageBtn').textContent=open?'✕ Close':'✎ Edit';
    if(open&&scroll){$('readerEditorCard').scrollIntoView({behavior:'auto',block:'start'});}
    if(open&&focus)$('inputText').focus({preventScroll:true});
  }
  $('editPassageBtn').onclick=()=>showPassageEditor(!document.body.classList.contains('editor-open'),{scroll:true,focus:true});
  $('finishEditingBtn').onclick=()=>{clearTimeout(readerInputTimer);saveReaderDraft();renderReader();showPassageEditor(false);$('readerOutputCard').scrollIntoView({behavior:'auto',block:'start'});};
  $('readerQuickSpeakBtn').onclick=()=>speakChinese($('inputText').value);
  $('readerQuickTranslateBtn').onclick=translateInput;
  $('renderBtn').onclick=()=>{clearTimeout(readerInputTimer);saveReaderDraft();renderReader();if(compactEditor()){showPassageEditor(false);$('readerOutputCard').scrollIntoView({behavior:'auto',block:'start'});}};
  $('clearTextBtn').onclick=()=>{
    const old=$('inputText').value;if(!old)return;
    undoneReaderText=old;$('undoClearBtn').hidden=false;$('inputText').value='';onReaderChanged();
    toast('Reader cleared. Undo is available below the input.');
  };
  $('undoClearBtn').onclick=()=>{if(undoneReaderText===null)return;$('inputText').value=undoneReaderText;undoneReaderText=null;$('undoClearBtn').hidden=true;onReaderChanged();};
  $('sampleTextBtn').onclick=()=>{undoneReaderText=$('inputText').value;$('undoClearBtn').hidden=false;$('inputText').value=SAMPLE_READER_TEXT;onReaderChanged();toast('Sample loaded. Undo is available.');};
  window.addEventListener('pagehide',saveReaderDraft);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveReaderDraft();});
  $('speakTextBtn').onclick = () => speakChinese($('inputText').value);
  $('stopVoiceBtn').onclick = stopVoice;
  $('translateBtn').onclick = translateInput;
  ['filter2','filter3','hideKnown','showPinyin','showEnglish'].forEach(id => $(id).onchange = () => {settings[id]=$(id).checked;saveSettings();renderReader();});
  $('readerFontSize').oninput=()=>{settings.readerFontSize=Number($('readerFontSize').value);$('readerFontSizeLabel').textContent=`${settings.readerFontSize}px`;saveSettings();$('readerView').style.fontSize=`${settings.readerFontSize}px`;};
  $('vocabSearch').oninput=()=>{renderVocab(true);syncVocabSearchClear();};
  ['vocabLevel','vocabStatus','vocabSort'].forEach(id=>$(id).oninput=()=>renderVocab(true));
  $('vocabLoadMoreBtn').onclick=()=>{vocabVisibleCount+=vocabPageSize();renderVocab();};
  $('vocabStudyResultsBtn').onclick=studyVocabResults;
  $('darkToggle').onclick = () => { settings.dark=!settings.dark; saveSettings(); applySettingsToUI(); };
  for(const area of ['flash','quiz'])$(area+'OptionsToggle').onclick=()=>{const pane=$(area+'Toolbar');pane.classList.toggle('mobile-options-open');$(area+'OptionsToggle').setAttribute('aria-expanded',String(pane.classList.contains('mobile-options-open')));};
  $('sidebarToggle').onclick=()=>{document.body.classList.toggle('sidebar-collapsed');try{if(canPersistStudy())localStorage.setItem(SIDEBAR_STORE,document.body.classList.contains('sidebar-collapsed')?'1':'0');}catch{}};
  $('clearVocabSearchBtn').onclick=()=>{$('vocabSearch').value='';syncVocabSearchClear();renderVocab(true);$('vocabSearch').focus();};
  $('closeDialog').onclick = closeWordDialog; $('prevUnknownBtn').onclick = () => navigateUnknown(-1); $('nextUnknownBtn').onclick = () => navigateUnknown(1); $('wordDialog').addEventListener('cancel', e=>{e.preventDefault(); closeWordDialog();});
  $('wordDialog').addEventListener('click', e=>{
    const dialog = $('wordDialog');
    if (!dialog.open) return;
    if (e.target.closest('.dialog-arrow,.modal-close')) return;
    const rect = dialog.getBoundingClientRect();
    const insideDialog = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!insideDialog) closeWordDialog();
  });
  $('lessonMarkLearning').onclick=()=>markLesson('learning');$('lessonMarkKnown').onclick=()=>markLesson('known');
  $('lessonComplete').onclick=completeLesson;$('lessonUndoBtn').onclick=undoLessonDay;$('lessonStudyBtn').onclick=studyLessonWords;
  $('newDeckBtn').onclick=newDeck;$('flashDeckCount').onchange=()=>{flashDeckLimit();newDeck();};
  $('flashLevel').onchange=newDeck;$('flashShuffle').onchange=newDeck;
  $('flashSkipKnown').onchange=()=>{settings.flashSkipKnown=$('flashSkipKnown').checked;saveSettings();newDeck();};
  $('flashTogglePinyinBtn').onclick=()=>setFlashReveal('pinyin');$('flashToggleEnglishBtn').onclick=()=>setFlashReveal('english');
  let swipeDrag=null, suppressCardClickUntil=0;
  const swipeBox=$('flashcardBox');
  function markFlashStatus(status){
    const v=currentCard();if(!v)return;
    setStatus(entryKey(v),status);
    if(lessonSession){
      if(!lessonSession.reviewed.includes(entryKey(v)))lessonSession.reviewed.push(entryKey(v));
      if(lessonSession.reviewed.length===deck.length){finishLessonSession();return;}
      for(let n=1;n<=deck.length;n++){
        const next=(deckIndex+n)%deck.length;
        if(!lessonSession.reviewed.includes(entryKey(deck[next]))){deckIndex=next;break;}
      }
      flashRevealPinyin=false;flashRevealEnglish=false;flashStrokeRenderedWord='';renderFlash();
    }else{
      if(!deckReviewed.includes(entryKey(v)))deckReviewed.push(entryKey(v));
      if(deckReviewed.length===deck.length){deckFinished=true;toggleFlashStrokePanel(false);$('swipeStatus').textContent='';renderAll();$('lessonFinished').focus();return;}
      for(let n=1;n<=deck.length;n++){const next=(deckIndex+n)%deck.length;if(!deckReviewed.includes(entryKey(deck[next]))){deckIndex=next;break;}}
      flashRevealPinyin=false;flashRevealEnglish=false;flashStrokeRenderedWord='';renderFlash();
    }
    $('swipeStatus').textContent=`${v.word}: ${status==='new'?'not known — revisit in the New words deck':status}.`;
  }
  function resetSwipe(){swipeDrag=null;swipeBox.style.transform='';swipeBox.classList.remove('dragging');delete swipeBox.dataset.swipe;}
  function swipeDirection(dx,dy){return Math.abs(dx)>Math.abs(dy)?(dx>0?'known':'new'):(dy<0?'learning':null);}
  swipeBox.onpointerdown=e=>{
    if(!e.isPrimary||e.button!==0||!currentCard())return;
    swipeDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
    swipeBox.setPointerCapture(e.pointerId);swipeBox.classList.add('dragging');
  };
  swipeBox.onpointermove=e=>{
    if(!swipeDrag||swipeDrag.id!==e.pointerId)return;
    const dx=e.clientX-swipeDrag.x,dy=e.clientY-swipeDrag.y;
    swipeDrag.moved=swipeDrag.moved||Math.hypot(dx,dy)>10;
    swipeBox.style.transform=`translate(${dx*.55}px,${dy*.55}px) rotate(${dx*.025}deg)`;
    const direction=swipeDirection(dx,dy);
    if(direction&&Math.hypot(dx,dy)>24){swipeBox.dataset.swipe=direction;swipeBox.querySelector('.swipe-feedback').textContent=direction==='new'?'← Revisit':direction==='learning'?'↑ Learning':'Known →';}
    else delete swipeBox.dataset.swipe;
  };
  swipeBox.onpointerup=e=>{
    if(!swipeDrag||swipeDrag.id!==e.pointerId)return;
    const dx=e.clientX-swipeDrag.x,dy=e.clientY-swipeDrag.y;
    const direction=swipeDirection(dx,dy),moved=swipeDrag.moved||Math.hypot(dx,dy)>10;
    if(moved)suppressCardClickUntil=Date.now()+400;
    resetSwipe();if(swipeBox.hasPointerCapture(e.pointerId))swipeBox.releasePointerCapture(e.pointerId);
    if(direction&&Math.max(Math.abs(dx),Math.abs(dy))>=65)markFlashStatus(direction);
  };
  swipeBox.onpointercancel=()=>{suppressCardClickUntil=Date.now()+400;resetSwipe();};
  swipeBox.onlostpointercapture=resetSwipe;
  swipeBox.onclick=()=>{if(Date.now()>suppressCardClickUntil)flipFlash();};
  $('flashcardBox').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();flipFlash();}};
  $('flashStrokeToggleBtn').onclick=()=>toggleFlashStrokePanel();
  $('flashPrevBtn').onclick=prevFlash;$('flashNextArrowBtn').onclick=nextFlash;
  $('flashKnownBtn').onclick=()=>markFlashStatus('known');
  $('flashRevisitBtn').onclick=()=>markFlashStatus('new');
  $('flashLearningBtn').onclick=()=>markFlashStatus('learning');
  $('backToLessonsBtn').onclick=()=>switchTab('lessons');
  $('flashSpeakBtn').onclick=()=>{const v=currentCard();if(v)speakEntry(entryKey(v));};
  $('flashReplayBtn').onclick=replayFlashStrokes;$('flashTraceBtn').onclick=traceFlashStrokes;
  $('flashRetryTraceBtn').onclick=traceFlashStrokes;$('flashGuideBtn').onclick=()=>toggleTraceGuide('flash');
  $('flashExitTraceBtn').onclick=()=>toggleFlashStrokePanel(false);
  $('flashStrokeShell').addEventListener('cancel',e=>{e.preventDefault();toggleFlashStrokePanel(false);});
  let strokeBackdropStart=false;
  function outsideStrokeDialog(e){const r=$('flashStrokeShell').getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}
  $('flashStrokeShell').addEventListener('pointerdown',e=>{strokeBackdropStart=e.target===$('flashStrokeShell')&&outsideStrokeDialog(e);});
  $('flashStrokeShell').addEventListener('click',e=>{if(strokeBackdropStart&&e.target===$('flashStrokeShell')&&outsideStrokeDialog(e))toggleFlashStrokePanel(false);strokeBackdropStart=false;});
  $('startQuizBtn').onclick=()=>startQuiz();$('quizCount').onchange=quizCountLimit;
  $('quizNextBtn').onclick=nextQuiz;
  $('quizRetryMissedBtn').onclick=()=>startQuiz(quiz.missed.slice());
  $('quizOptions').onclick=e=>{const b=e.target.closest('.quiz-option');if(b)answerQuiz(b.dataset.answer,b);};
  $('ttsRate').oninput = () => { settings.ttsRate=Number($('ttsRate').value); $('ttsRateLabel').textContent=`${settings.ttsRate.toFixed(2)}x`; saveSettings(); };
  $('onlineTranslate').onchange = () => { settings.onlineTranslate=$('onlineTranslate').checked; saveSettings(); };
  $('autoStroke').onchange = () => { settings.autoStroke=$('autoStroke').checked; saveSettings(); };
  $('preloadStrokeBtn').onclick = preloadStrokeData;
  let lastWritingInput='Not observed';
  function refreshDeviceProbe(){
    const pointerSupport='PointerEvent' in window;
    const touch=Number(navigator.maxTouchPoints)||0;
    const storage=(()=>{try{const k='hskReaderProbe.temp';localStorage.setItem(k,'1');localStorage.removeItem(k);return 'available';}catch{return 'blocked';}})();
    const probe=$('deviceProbeResults');if(!probe)return;
    probe.innerHTML=`<div><span>Touch points</span><strong>${touch}</strong></div><div><span>Pointer input</span><strong>${pointerSupport?'Supported':'Unavailable'}</strong></div><div><span>Local saving</span><strong>${storage}</strong></div><div class="probe-input"><span>Last trace input</span><strong>${escapeHtml(lastWritingInput)}</strong></div>`;
  }
  $('checkDeviceBtn').onclick=()=>{refreshDeviceProbe();toast('Browser capabilities refreshed.');};
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.stroke-panel.trace-mode .stroke-char'))return;
    lastWritingInput=event.pointerType==='pen'?'Pen / stylus':event.pointerType==='touch'?'Finger / touch':event.pointerType==='mouse'?'Mouse / trackpad':event.pointerType||'Unknown';
    refreshDeviceProbe();
  },true);
  $('exportBtn').onclick=()=>{$('jsonBox').value=JSON.stringify(getBackup(),null,2);toast('Backup JSON copied into the box.');};
  $('downloadBackupBtn').onclick=downloadBackup;
  $('importBtn').onclick=()=>importBackup($('jsonBox').value);
  $('uploadBackupBtn').onclick=()=>$('backupFileInput').click();
  $('backupFileInput').onchange=async()=>{
    const file=$('backupFileInput').files?.[0];if(!file)return;
    try{const raw=await file.text();$('jsonBox').value=raw;importBackup(raw);}
    catch{toast('Could not read that backup file.');}
    $('backupFileInput').value='';
  };
  function clearTransientStudy(){
    clearTimeout(readerInputTimer);++translationRequestId;stopVoice();closeWordDialog();toggleFlashStrokePanel(false);
    window.onStudyDataReplaced?.();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    undoneReaderText=null;$('undoClearBtn').hidden=true;$('translationBox').hidden=true;$('jsonBox').value='';
    quiz={score:0,total:0,current:null,locked:false,max:0,deck:[],index:0,currentDir:'zh-en',missed:[]};
    $('quizOptions').innerHTML='';$('quizFeedback').textContent='';$('quizNextBtn').disabled=true;$('quizRetryMissedBtn').hidden=true;$('quizPrompt').textContent='Press Start Quiz';$('quizPrompt').classList.add('quiz-idle');renderQuizScore();
  }
  function resetStudyProgress(){
    if(!canPersistStudy()){toast('Reopen the app before resetting progress.');return false;}
    const bases=[...Object.values(BASE_STORE),SIDEBAR_STORE],keys=[];
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(bases.some(base=>k===base||k.startsWith(base+'::')))keys.push(k);}}catch{toast('Could not access saved progress. Nothing was reset.');return false;}
    const prior=new Map();let priorEpoch,newEpoch,newDraft;
    try{
      for(const k of keys)prior.set(k,localStorage.getItem(k));priorEpoch=localStorage.getItem(STATE_EPOCH_KEY);
      newEpoch=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);newDraft=BASE_STORE.draft+'::'+newEpoch;
      resettingStudy=true;clearTimeout(readerInputTimer);
      for(const k of keys)localStorage.removeItem(k);
      localStorage.setItem(newDraft,JSON.stringify(''));
      localStorage.setItem(STATE_EPOCH_KEY,newEpoch);
      if(localStorage.getItem(STATE_EPOCH_KEY)!==newEpoch||localStorage.getItem(newDraft)!=='""'||keys.some(k=>localStorage.getItem(k)!==null))throw Error('Reset did not persist');
    }catch{
      if(!resettingStudy){toast('Could not read saved progress. Nothing was reset.');return false;}
      let restored=true;
      for(const [k,v] of prior)try{if(localStorage.getItem(k)!==v){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}}catch{restored=false;}
      try{if(newDraft)localStorage.removeItem(newDraft);if(priorEpoch==null)localStorage.removeItem(STATE_EPOCH_KEY);else localStorage.setItem(STATE_EPOCH_KEY,priorEpoch);}catch{restored=false;}
      resettingStudy=!restored;toast(restored?'Reset could not be saved. Your previous progress was retained.':'Reset could not finish. Download your in-memory backup before closing.');return false;
    }
    // Clearing memory as well as storage makes reload/pagehide and async callbacks harmless.
    clearTransientStudy();settings={...DEFAULT_SETTINGS};statuses={};lessons={};extras=sanitizeExtras({});
    deck=[];deckIndex=0;deckReviewed=[];deckFinished=false;lessonSession=null;deckLabel='';activeLessonLevel=2;
    $('inputText').value='';$('passageTitle').value='';document.body.classList.remove('sidebar-collapsed','editor-open','focus-reading');
    applySettingsToUI();renderAll();renderPassages();switchTab('lessons');toast('Progress reset. Reopening the app…');location.reload();return true;
  }
  $('resetBtn').onclick=()=>{if(confirm('Erase all word progress, lessons, reading history, review schedules, settings and saved texts on this device? Download a backup first if needed.'))resetStudyProgress();};
  if('speechSynthesis' in window){loadVoices();window.speechSynthesis.onvoiceschanged=loadVoices;}
  document.addEventListener('keydown',e=>{
    if($('readingPracticeDialog')?.open||$('readingWordDialog')?.open||$('readingOptions')?.open)return;
    if($('flashStrokeShell').open){if(e.key==='Escape'){e.preventDefault();toggleFlashStrokePanel(false);}return;}
    if(!$('wordDialog').open&&e.altKey&&!e.ctrlKey&&!e.metaKey&&/^[1-7]$/.test(e.key)){
      e.preventDefault();switchTab(APP_TAB_NAMES[Number(e.key)-1]);return;
    }
    const tag=document.activeElement?.tagName;
    const editing=['INPUT','TEXTAREA','SELECT'].includes(tag)||document.activeElement?.isContentEditable;
    if($('wordDialog').open){
      if(e.key==='Escape'){e.preventDefault();closeWordDialog();return;}
      if(!editing&&e.key==='ArrowLeft'){e.preventDefault();navigateUnknown(-1);return;}
      if(!editing&&e.key==='ArrowRight'){e.preventDefault();navigateUnknown(1);return;}
      return;
    }
    if(!editing&&e.key==='/'){e.preventDefault();switchTab('vocab');$('vocabSearch').focus();return;}
    if(editing||tag==='BUTTON'||tag==='SUMMARY'||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
    if($('flashcards').classList.contains('active')){
      if(e.key==='ArrowLeft'){e.preventDefault();prevFlash();}
      else if(e.key==='ArrowRight'){e.preventDefault();nextFlash();}
      else if(e.key===' '){e.preventDefault();flipFlash();}
      else if(e.key.toLowerCase()==='k'){e.preventDefault();$('flashKnownBtn').click();}
      else if(e.key.toLowerCase()==='l'){e.preventDefault();$('flashLearningBtn').click();}
    }else if($('quiz').classList.contains('active')){
      if(/^[1-4]$/.test(e.key)&&!quiz.locked&&quiz.current){
        const btn=$('quizOptions').querySelectorAll('.quiz-option')[Number(e.key)-1];
        if(btn){e.preventDefault();btn.click();}
      }else if(e.key==='Enter'&&!$('quizNextBtn').disabled){e.preventDefault();nextQuiz();}
    }
  });
  // Enable keyboard access for highlighted words without changing their inline layout.
  $('readerView').addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){const w=e.target.closest('[data-word]');if(w){e.preventDefault();showWord(w.dataset.word,w.dataset.tokenIndex);}}
  });
  // Additive study state. Legacy keys are retained; raw vocabulary remains immutable.
  function normalizeSettings(raw){
    const out={...DEFAULT_SETTINGS};
    if(!raw||typeof raw!=='object')return out;
    for(const key of Object.keys(out)){
      if(typeof out[key]==='boolean'&&typeof raw[key]==='boolean')out[key]=raw[key];
      else if(typeof out[key]==='string'&&typeof raw[key]==='string')out[key]=raw[key];
    }
    const bounded=(key,min,max)=>out[key]=Math.max(min,Math.min(max,Number(raw[key])||DEFAULT_SETTINGS[key]));
    bounded('ttsRate',.5,1.25);bounded('readerFontSize',18,38);bounded('readerLineHeight',1.6,2.8);bounded('dailyGoal',1,100);
    out.dailyGoal=Math.round(out.dailyGoal);return out;
  }
  function sanitizeExtras(raw){
    raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const out={passages:[],srs:{},daily:{},writing:{},activePassage:'',readerSense:'长::cháng',session:null};
    const validKey=k=>BY_ID.has(k);
    if(Array.isArray(raw.passages)){
      const ids=new Set();
      for(const p of raw.passages.slice(0,100))if(p&&typeof p.id==='string'&&typeof p.text==='string'&&!ids.has(p.id)){
        ids.add(p.id);out.passages.push({id:p.id.slice(0,100),title:String(p.title||'Untitled passage').slice(0,80),text:p.text.slice(0,200000),updated:String(p.updated||''),sense:p.sense==='长::zhǎng'?'长::zhǎng':'长::cháng'});
      }
    }
    if(typeof raw.activePassage==='string'&&out.passages.some(p=>p.id===raw.activePassage))out.activePassage=raw.activePassage;
    if(raw.readerSense==='长::zhǎng')out.readerSense=raw.readerSense;
    for(const [k,v] of Object.entries(raw.srs||{}))if(validKey(k)&&v&&Number.isFinite(v.due)&&Number.isFinite(v.step))out.srs[k]={due:Math.max(0,v.due),step:Math.max(0,Math.min(5,Math.floor(v.step))),reviews:Math.max(0,Math.floor(Number(v.reviews)||0))};
    for(const [k,v] of Object.entries(raw.daily||{}).slice(-90))if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&Array.isArray(v))out.daily[k]=uniq(v.filter(validKey));
    for(const [k,v] of Object.entries(raw.writing||{}))if(Array.from(k).length===1&&isChineseChar(k)&&v)out.writing[k]={count:Math.max(0,Math.floor(Number(v.count)||0)),mistakes:Math.max(0,Math.floor(Number(v.mistakes)||0)),last:typeof v.last==='string'?v.last:''};
    if(raw.session&&Array.isArray(raw.session.ids))out.session={ids:uniq(raw.session.ids.filter(validKey)).slice(0,601),index:Math.max(0,Math.floor(Number(raw.session.index)||0)),label:String(raw.session.label||'').slice(0,80),pinyin:!!raw.session.pinyin,english:!!raw.session.english};
    if(out.session){out.session.reviewed=uniq((Array.isArray(raw.session.reviewed)?raw.session.reviewed:[]).filter(k=>out.session.ids.includes(k)));out.session.complete=!!raw.session.complete&&out.session.reviewed.length===out.session.ids.length;}
    const lesson=raw.session?.lesson;
    if(out.session&&lesson&&[2,3].includes(lesson.level)&&Number.isInteger(lesson.start)&&lesson.start>=0&&Number.isInteger(lesson.day)&&lesson.day>0){
      out.session.lesson={level:lesson.level,start:lesson.start,day:lesson.day,reviewed:uniq((Array.isArray(lesson.reviewed)?lesson.reviewed:[]).filter(k=>out.session.ids.includes(k))),complete:!!lesson.complete};
      out.session.lesson.complete=out.session.lesson.complete&&out.session.lesson.reviewed.length===out.session.ids.length;
    }
    if(raw.reading&&typeof raw.reading==='object')out.reading=sanitizeReading(raw.reading);
    return out;
  }
  function sanitizeReading(raw){
    const strings=(v,n=10000)=>Array.isArray(v)?uniq(v.filter(s=>typeof s==='string'&&s.length<=100).slice(0,n)):[];
    const map=(v,check)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter(([k,x])=>k.length<=100&&check(x)).slice(0,10000)):{};
    const out={source:['2','3','custom','starred'].includes(raw.source)?raw.source:'2',positions:map(raw.positions,x=>Number.isInteger(x)&&x>=0&&x<10000),hiddenPinyin:map(raw.hiddenPinyin,x=>typeof x==='boolean'),starWords:strings(raw.starWords),starSentences:strings(raw.starSentences),labels:map(raw.labels,x=>['new','learning','known'].includes(x)),read:strings(raw.read,5000),mode:raw.mode==='passage'?'passage':'sentence',pinyin:['always','never'].includes(raw.pinyin)?raw.pinyin:'adaptive',pin:!!raw.pin,every:raw.every===10?10:5,sentenceInterval:Math.min(30,Math.max(10,Math.round(Number(raw.sentenceInterval)||10))),quizCount:[5,10,15,20,30].includes(raw.quizCount)?raw.quizCount:10,quizType:['meaning','pinyin','zh-meaning','py-meaning'].includes(raw.quizType)?raw.quizType:'mixed',order:['balanced','original'].includes(raw.order)?raw.order:'',sentenceReview:map(raw.sentenceReview,x=>x&&Number.isFinite(x.due)&&x.due>=0&&Number.isInteger(x.step)&&x.step>=-1&&x.step<=4),wordReview:map(raw.wordReview,x=>x&&Number.isFinite(x.due)&&x.due>=0&&Number.isInteger(x.misses)&&x.misses>0),reviewSession:raw.reviewSession&&Array.isArray(raw.reviewSession.ids)?{ids:strings(raw.reviewSession.ids,10),index:Math.min(9,Math.max(0,Math.floor(Number(raw.reviewSession.index)||0))),reason:raw.reviewSession.reason==='missed vocabulary'?'missed vocabulary':'earlier sentences'}:null,quizCovered:map(raw.quizCovered,x=>Array.isArray(x)&&x.length<=5000&&x.every(s=>typeof s==='string'&&s.length<=100)),custom:typeof raw.custom==='string'?raw.custom.slice(0,200000):'',dismissedCheckpoint:strings(raw.dismissedCheckpoint,1000),practice:null};
    const p=raw.practice;
    if(p&&Array.isArray(p.words)){
      const words=strings(p.words,30).filter(w=>/^[\u3400-\u9fff]{1,20}$/.test(w));
      const questions=(Array.isArray(p.questions)?p.questions:[]).slice(0,31).filter(q=>q&&['meaning','pinyin','zh-meaning','py-meaning','order'].includes(q.kind)&&typeof q.prompt==='string'&&Array.isArray(q.options)).map(q=>({kind:q.kind,prompt:q.prompt.slice(0,1000),target:typeof q.target==='string'?q.target.slice(0,20):'',pinyin:typeof q.pinyin==='string'?q.pinyin.slice(0,100):'',meaning:typeof q.meaning==='string'?q.meaning.slice(0,1000):'',word:typeof q.word==='string'?q.word.slice(0,1000):'',answer:Array.isArray(q.answer)?q.answer.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,40)):[],options:q.kind==='order'?q.options.slice(0,20).filter(o=>o&&typeof o.text==='string'&&Number.isInteger(o.id)).map(o=>({text:o.text.slice(0,40),id:o.id})):uniq(q.options.filter(x=>typeof x==='string').slice(0,4).map(x=>x.slice(0,1000)))}));
      if(words.length){const cursor=Math.min(words.length,Math.max(0,Math.floor(Number(p.cursor)||0)));out.practice={mode:p.mode==='direct'?'direct':'review',source:['2','3','custom','starred'].includes(p.source)?p.source:out.source,sentenceIds:strings(p.sentenceIds,30),words,cursor,reveal:!!p.reveal,phase:['cards','quiz','summary'].includes(p.phase)?p.phase:'cards',questions,q:Math.min(Math.max(0,Math.floor(Number(p.q)||0)),Math.max(0,questions.length-1)),score:Math.max(0,Math.floor(Number(p.score)||0)),total:Math.max(0,Math.floor(Number(p.total)||0)),answered:!!p.answered,order:Array.isArray(p.order)?p.order.filter(x=>Number.isInteger(x)&&x>=0&&x<20).slice(0,20):[],feedback:typeof p.feedback==='string'?p.feedback.slice(0,1000):''};if(out.practice.phase==='quiz'&&!questions.length)out.practice.phase='summary';if(out.practice.phase==='cards'&&cursor===words.length)out.practice.phase='summary';}
    }
    if(out.reviewSession){const validIds=new Set([...((typeof READING_SENTENCES!=='undefined')?READING_SENTENCES.map(s=>s.id):[]),...(out.custom.match(/[^。！？!?\n]+[。！？!?]?/g)||[]).filter(s=>s.trim()).map(s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return 'custom-'+String(h>>>0);})].filter(Boolean));out.reviewSession.ids=out.reviewSession.ids.filter(id=>validIds.has(id));if(!out.reviewSession.ids.length)out.reviewSession=null;else out.reviewSession.index=Math.min(out.reviewSession.index,out.reviewSession.ids.length-1);}
    if(out.practice){const p=out.practice;const known=word=>BY_WORD.has(word)||(typeof READING_DICTIONARY!=='undefined'&&Object.hasOwn(READING_DICTIONARY,word));p.words=p.words.filter(known);p.cursor=Math.min(p.cursor,p.words.length);
      p.questions=p.questions.filter(q=>q.kind==='order'?q.answer.length>=3&&q.answer.length===q.options.length&&q.answer.slice().sort().join('\0')===q.options.map(o=>o.text).sort().join('\0'):q.options.length>=2&&q.options.includes(q.word)&&known(q.target||q.word));
      p.q=Math.min(p.q,Math.max(0,p.questions.length-1));const q=p.questions[p.q];p.order=uniq(p.order.filter(i=>q?.kind==='order'&&i<q.options.length));if(p.phase==='quiz'&&!q)p.phase='summary';if(!p.words.length)out.practice=null;
    }
    return out;
  }
  function saveExtras(){return writeJSON(STORE.extras,extras);}
  function selectedReading(v){return v.word==='长'?(BY_ID.get(extras.readerSense)||v):v;}
  function dueEntries(){const now=Date.now();return VOCAB.filter(v=>{const r=extras.srs[entryKey(v)];return r?r.due<=now:statusOf(entryKey(v))==='learning';}).sort((a,b)=>(extras.srs[entryKey(a)]?.due||0)-(extras.srs[entryKey(b)]?.due||0));}
  const REVIEW_DAYS=[1,3,7,14,30,60];
  function nextIntervalLabel(v){const n=REVIEW_DAYS[extras.srs[entryKey(v)]?.step||0];return `${n} day${n===1?'':'s'}`;}
  function renderDaily(){
    const done=(extras.daily[todayISO()]||[]).length,due=dueEntries().length;
    $('dailyHeadline').textContent=done>=settings.dailyGoal?'A little better than yesterday.':'A little Chinese, every day.';
    $('dailySummary').textContent=`${done} / ${settings.dailyGoal} reviewed today · ${due} due for review`;
    $('reviewDueBtn').textContent=due?`Review ${due} due`:'Start daily review';
    const count=Object.values(extras.writing).reduce((n,x)=>n+x.count,0);
    $('writingSummary').textContent=`Writing practice: ${count} completed characters across ${Object.keys(extras.writing).length} different characters.`;
  }
  function startDailyReview(){
    let pool=dueEntries();
    if(!pool.length)pool=VOCAB.filter(v=>statusOf(entryKey(v))!=='known'&&!extras.srs[entryKey(v)]).slice(0,settings.dailyGoal);
    if(!pool.length){toast('You’re up to date. Choose a deck to practise more.');switchTab('flashcards');return;}
    createCustomDeck(pool,'Due review');switchTab('flashcards');
  }
  function gradeReview(remembered){
    const v=currentCard();if(!v||!flashRevealPinyin||!flashRevealEnglish)return;
    const key=entryKey(v),old=extras.srs[key]||{step:0,reviews:0};
    extras.srs[key]={due:Date.now()+(remembered?REVIEW_DAYS[old.step]*86400000:600000),step:remembered?Math.min(5,old.step+1):0,reviews:old.reviews+1};
    const today=todayISO();extras.daily[today]=uniq([...(extras.daily[today]||[]),key]);
    const dates=Object.keys(extras.daily).sort();for(const d of dates.slice(0,-90))delete extras.daily[d];
    if(statusOf(key)==='new')statuses[key]='learning';
    writeJSON(STORE.statuses,statuses);
    if(deckLabel==='Due review'){deck.splice(deckIndex,1);deckIndex=Math.min(deckIndex,Math.max(0,deck.length-1));flashRevealPinyin=false;flashRevealEnglish=false;flashStrokeRenderedWord='';}
    else if(deck.length){deckIndex=(deckIndex+1)%deck.length;flashRevealPinyin=false;flashRevealEnglish=false;flashStrokeRenderedWord='';}
    if(flashStrokeOpen)toggleFlashStrokePanel(false);
    saveExtras();renderAll();
    if(!deck.length){$('flashFront').textContent='Review complete';$('flashProgress').textContent='Your next reviews are scheduled. Keep reading or choose another deck.';}
    toast(remembered?'Next review scheduled.':'Scheduled again in 10 minutes.');
  }
  function saveFlashSession(){
    extras.session={ids:deck.map(entryKey),index:deckIndex,label:deckLabel,pinyin:flashRevealPinyin,english:flashRevealEnglish,reviewed:deckReviewed,complete:deckFinished,lesson:lessonSession};saveExtras();
  }
  function restoreFlashSession(){
    const session=extras.session;
    if(session?.ids.length){deck=session.ids.map(k=>BY_ID.get(k)).filter(Boolean);deckIndex=Math.min(session.index,deck.length-1);deckLabel=session.label;lessonSession=session.lesson||null;deckReviewed=session.reviewed||[];deckFinished=!!session.complete;flashRevealPinyin=session.pinyin;flashRevealEnglish=session.english;renderFlash();}
    else newDeck();
  }
  function renderPassages(){
    const selected=$('savedPassages').value||extras.activePassage;
    $('savedPassages').innerHTML='<option value="">Choose a passage</option>'+extras.passages.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
    if(extras.passages.some(p=>p.id===selected))$('savedPassages').value=selected;
    $('passageCount').textContent=`${extras.passages.length} saved`;
    $('loadPassageBtn').disabled=!$('savedPassages').value;$('deletePassageBtn').disabled=!$('savedPassages').value;
  }
  function bindStudioControls(){
    $('readerQuickStopBtn').onclick=stopVoice;
    $('closeTranslationBtn').onclick=()=>{$('translationBox').hidden=true;++translationRequestId;};
    $('readerLineHeight').oninput=()=>{settings.readerLineHeight=Number($('readerLineHeight').value);$('readerLineHeightLabel').textContent=settings.readerLineHeight.toFixed(1);saveSettings();$('readerView').style.lineHeight=String(settings.readerLineHeight);};
    $('dailyGoal').onchange=()=>{settings.dailyGoal=Math.max(1,Math.min(100,Math.round(Number($('dailyGoal').value)||10)));$('dailyGoal').value=settings.dailyGoal;saveSettings();renderDaily();};
    $('reviewDueBtn').onclick=startDailyReview;
    $('rateAgainBtn').onclick=()=>gradeReview(false);$('rateGoodBtn').onclick=()=>gradeReview(true);
    $('reviewPassageBtn').onclick=()=>{const entries=uniq(currentReaderAllWords).filter(k=>statusOf(k)!=='known').map(resolveEntry);if(entries.length){createCustomDeck(entries,'From your passage');switchTab('flashcards');}};
    $('focusReaderBtn').onclick=()=>{const on=document.body.classList.toggle('focus-reading');$('focusReaderBtn').setAttribute('aria-pressed',String(on));$('focusReaderBtn').textContent=on?'Exit focus':'Focus';};
    $('savePassageBtn').onclick=()=>{
      const text=$('inputText').value;if(!text.trim()){toast('Write or paste a passage first.');return;}
      if(text.length>200000){toast('Please split this passage into smaller parts before saving.');return;}
      let title=$('passageTitle').value.trim()||text.replace(/\s+/g,' ').slice(0,28);
      const existing=extras.passages.find(p=>p.id===extras.activePassage||p.title===title);
      if(existing&&!confirm(`Replace the saved passage “${existing.title}”?`))return;
      if(!existing&&extras.passages.length>=100){toast('The collection holds 100 passages. Export a backup, then remove an older passage.');return;}
      const id=existing?.id||`p${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const passage={id,title,text,updated:new Date().toISOString(),sense:extras.readerSense};
      if(existing)extras.passages[extras.passages.indexOf(existing)]=passage;else extras.passages.unshift(passage);
      extras.activePassage=id;const saved=saveExtras();$('savedPassages').value='';renderPassages();renderReader();if(saved)toast('Passage saved.');
    };
    $('savedPassages').onchange=()=>{const selected=$('savedPassages').value;$('loadPassageBtn').disabled=!selected;$('deletePassageBtn').disabled=!selected;};
    $('loadPassageBtn').onclick=()=>{
      const p=extras.passages.find(p=>p.id===$('savedPassages').value);if(!p)return;
      undoneReaderText=$('inputText').value;$('undoClearBtn').hidden=false;clearTimeout(readerInputTimer);
      $('inputText').value=p.text;$('passageTitle').value=p.title;extras.activePassage=p.id;extras.readerSense=p.sense;
      ++translationRequestId;$('translationBox').hidden=true;saveReaderDraft();saveExtras();renderReader();showPassageEditor(false);$('readerOutputCard').scrollIntoView({block:'start'});toast('Passage opened. Previous draft is available with Undo.');
    };
    $('deletePassageBtn').onclick=()=>{
      const p=extras.passages.find(p=>p.id===$('savedPassages').value);if(!p||!confirm(`Delete saved passage “${p.title}”? Your current draft stays available.`))return;
      extras.passages=extras.passages.filter(x=>x.id!==p.id);if(extras.activePassage===p.id)extras.activePassage='';saveExtras();renderPassages();renderReader();
    };
    // Re-size using the actual viewport and rendered SVG dimensions; do not stretch a fixed pad.
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
      if($('wordDialog').open&&currentStrokeTraceMode)traceStrokes();
      if(flashStrokeOpen&&flashStrokeTraceMode)traceFlashStrokes();
    },200);});
    // Disable drawing-surface page gestures only, retaining scrolling elsewhere.
    document.addEventListener('touchmove',e=>{if(e.target.closest('.trace-mode .stroke-char'))e.preventDefault();},{passive:false});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&canPersistStudy()){renderDaily();window.refreshReadingStudio?.();}else stopVoice();});
  }

  window.addEventListener('pageshow',()=>{if(canPersistStudy()){renderDaily();window.refreshReadingStudio?.();}});
  settings=normalizeSettings(settings);
  syncSidebarState();applySettingsToUI();flashDeckLimit();quizCountLimit();restoreFlashSession();renderAll();renderPassages();syncVocabSearchClear();refreshDeviceProbe();
  bindStudioControls();
  switchTab('lessons');
  