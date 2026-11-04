const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');process.chdir(path.resolve(__dirname,'..'));
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/hsk-reader/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.confirm=()=>true;w.CSS={escape:x=>x};w.TextEncoder=TextEncoder;
w.eval(['assets/vocabulary.js',...Array.from({length:4},(_,i)=>`assets/reading-dictionary-${i}.js`),'assets/sentences.js','assets/sentences-hsk2.js','assets/sentences-hsk3-0.js','assets/sentences-hsk3-1.js','assets/sentences-hsk3-2.js','assets/sentences-context.js','assets/app.js','assets/reading-studio.js'].map(file=>fs.readFileSync(file,'utf8')).join('\n')+'\nwindow.readerTest={eval:s=>eval(s)};');
const $=id=>w.document.getElementById(id),run=s=>w.readerTest.eval(s);let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
const click=sel=>{const b=w.document.querySelector(sel);assert.ok(b,sel);b.click();};
test('All 1,602 sentences have one pinyin syllable per Chinese character',()=>{for(const s of run('READING_SENTENCES'))assert.equal([...s.zh].filter(c=>/[\u3400-\u9fff]/.test(c)).length,s.py.split(/\s+/).length,s.zh)});
test('Static navigation has no animated image or picture elements',()=>assert.equal(w.document.querySelectorAll('.sidebar-nav img,.sidebar-nav picture').length,0));
test('Dictionary segments multi-character words beyond the original HSK deck',()=>assert.ok(run("ReadingStudio.segments('为了明天的比赛').some(x=>x.text==='比赛'&&x.v)")));
test('Pinyin hints persist without grading the word',()=>{const word=w.document.querySelector('[data-r-word]').dataset.rWord;click('[data-r-word]');assert.equal(run(`statusOf(${JSON.stringify(word)})`),'new');click('[data-r-word]');assert.equal(run(`ReadingStudio.hintsVisible(${JSON.stringify(word)})`),false);assert.equal(run(`statusOf(${JSON.stringify(word)})`),'new');run('ReadingStudio.render()');assert.equal(run(`ReadingStudio.hintsVisible(${JSON.stringify(word)})`),false);const backup=run('getBackup()');assert.equal(backup.entryStatuses[word],undefined);assert.equal(backup.studio.reading.hiddenPinyin[word],true);click('[data-r-word]');assert.equal(run(`ReadingStudio.hintsVisible(${JSON.stringify(word)})`),true);assert.equal(run(`statusOf(${JSON.stringify(word)})`),'new');});
test('Tap pinyin toggles hints without grading, preserves individual pins, and resets on navigation',()=>{
 $('readingNext').click();assert.equal(w.document.querySelector('[data-r-word][aria-pressed="true"]'),null);const before=run('JSON.stringify(statuses)');assert.equal($('readingPeek').getAttribute('aria-label'),'Show pinyin');
 $('readingPeek').click();assert.equal($('readingPeek').getAttribute('aria-label'),'Hide pinyin');assert.ok(w.document.querySelector('[data-r-word][aria-pressed="true"]'));assert.equal(run('JSON.stringify(statuses)'),before);
 $('readingPeek').click();assert.equal(w.document.querySelector('[data-r-word][aria-pressed="true"]'),null);assert.equal(run('JSON.stringify(statuses)'),before);
 click('[data-r-word]');$('readingPeek').click();$('readingPeek').click();assert.equal(w.document.querySelector('[data-r-word]').getAttribute('aria-pressed'),'true');
 $('readingPeek').click();$('readingNext').click();assert.equal($('readingPeek').getAttribute('aria-label'),'Show pinyin');assert.equal(w.document.querySelector('[data-r-word][aria-pressed="true"]'),null);$('readingPrev').click();$('readingPrev').click();
});
test('Pinyin and Chinese use separate buttons; a word opens definition and writing',()=>{
 click('[data-r-definition="每天"]');assert.equal($('readingWordDialog').open,true);
 assert.equal($('readingWordHeading').textContent,'每天');assert.ok($('readingWordMeaning').textContent.includes('every day'));
 $('readingWordClose').click();assert.equal($('readingWordDialog').open,false);
});
test('Each study track has the requested sentence depth with no duplicate sentences',()=>{
 const rows=run('READING_SENTENCES');assert.equal(rows.filter(x=>x.level===2).length,421);assert.equal(rows.filter(x=>x.level===3).length,1181);
 assert.equal(new Set(rows.map(x=>x.zh)).size,rows.length);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
});
test('Collapsed rail keeps the top-left brand and has no floating label tooltip rule',()=>{
 const css=fs.readFileSync('assets/app.css','utf8');assert.ok(css.includes('.sidebar-collapsed .sidebar-brand{display:flex'));
 assert.ok(css.includes('.sidebar-collapsed .side-tab .side-label'));
});
test('Reader controls live in a settings dialog and sentence vocabulary starts collapsed',()=>{
 assert.equal($('readingSource').closest('dialog').id,'readingOptions');assert.equal($('readingPinyinMode').closest('dialog').id,'readingOptions');
 assert.equal($('readingVocabulary').tagName,'DETAILS');assert.equal($('readingVocabulary').open,false);
 $('readingVocabulary').querySelector('summary').click();assert.equal($('readingVocabulary').open,true);$('readingVocabulary').querySelector('summary').click();
});
test('Pinyin hint choices survive backup sanitization',()=>{const r=run('sanitizeExtras(extras).reading');assert.ok(Object.keys(r.hiddenPinyin).length);assert.equal(r.source,'2')});
test('Sentence translation is initially hidden, reveals and can be pinned',()=>{assert.equal($('readingTranslationText').hidden,true);$('readingTranslateToggle').click();assert.equal($('readingTranslationText').hidden,false);$('readingPinTranslation').click();$('readingMarkNext').click();assert.equal($('readingTranslationText').hidden,false)});
test('Reader progress shows overall read sentences independently of quiz cadence',()=>{
 run('extras.reading.read=[];extras.reading.quizSeen={};extras.reading.quizCadence={};extras.reading.positions["2"]=0;ReadingStudio.render()');
 assert.equal(parseFloat($('readingBar').style.width),0);$('readingMarkNext').click();
 assert.equal(Number($('readingBar').parentElement.getAttribute('aria-valuenow')),1);
 assert.equal(Number($('readingBar').parentElement.getAttribute('aria-valuemax')),421);
 assert.ok(Math.abs(parseFloat($('readingBar').style.width)-100/421)<.001);
 assert.match($('readingProgressText').textContent,/1 \/ 20 sentences to quiz/);
});
test('Exactly twenty sentences trigger a quiz with all vocabulary eligible',()=>{
 for(let i=1;i<19;i++)$('readingMarkNext').click();assert.equal($('readingPracticeDialog').open,false);
 $('readingMarkNext').click();assert.equal($('readingPracticeDialog').open,true);
 assert.ok($('readingQuizStart'));assert.equal($('readingCardReveal'),null);
 assert.match($('readingPracticeBody').textContent,/last 20 sentences/);
 assert.ok(run('extras.reading.quizSeen["2"].length')===20);
});
test('Not now defers the quiz without marking untested words as reviewed',()=>{
 const covered=run('extras.reading.quizCovered["2"]?.length||0');
 $('readingQuizLater').click();assert.equal($('readingPracticeDialog').open,false);
 assert.equal(run('extras.reading.quizCovered["2"]?.length||0'),covered);
 $('readingResumePractice').click();assert.equal($('readingPracticeDialog').open,true);
 assert.ok($('readingQuizStart'));
});
test('Mixed quiz samples current vocabulary without word-selection setup',()=>{
 $('readingSetupOrder').checked=true;$('readingSetupType').value='mixed';$('readingQuizStart').click();
 assert.equal(run('extras.reading.practice.phase'),'quiz');assert.equal(run('extras.reading.practice.mode'),'direct');
 const p=run('extras.reading.practice');assert.ok(p.words.length>0);assert.ok(p.questions.length>0&&p.questions.length<=10);
 assert.ok(new Set(p.questions.map(q=>q.kind)).size>=1);
 assert.ok(p.questions.filter(q=>q.kind!=='order').every(q=>run('ReadingStudio.definition('+JSON.stringify(q.target)+')')));
});
test('Correct answers and sentence ordering produce a finite quiz summary',()=>{while(run('extras.reading.practice.phase')==='quiz'){
 const p=run('extras.reading.practice'),q=p.questions[p.q];if(q.kind==='order'){
  const used=new Set();for(const word of q.answer){const i=q.options.findIndex((o,i)=>o.text===word&&!used.has(i));assert.ok(i>=0);used.add(i);click('[data-reading-order="'+i+'"]');}click('#readingOrderCheck');
 }else click('[data-reading-answer="'+q.options.indexOf(q.word)+'"]');
 assert.equal(run('extras.reading.practice.answered'),true);click('#readingQuestionNext');
 }assert.equal(run('extras.reading.practice.phase'),'summary');assert.equal(run('extras.reading.practice.score'),run('extras.reading.practice.total'))});
test('Reader quiz and selected vocabulary survive backup round-trip',()=>{
 const p=run('extras.reading.practice'),r=run('sanitizeExtras(JSON.parse(JSON.stringify(extras)))');
 assert.equal(r.reading.practice.cursor,p.cursor);assert.equal(r.reading.practice.mode,'direct');
 assert.equal(r.reading.practice.sentenceIds.length,p.sentenceIds.length);
 assert.equal(r.reading.practice.phase,'summary');assert.equal(r.reading.practice.score,r.reading.practice.total);
});
test('Completing a quiz covers its reading sentences and keeps a live progress bar',()=>{
 const p=run('extras.reading.practice'),covered=run('extras.reading.quizCovered["2"]');
 assert.equal(covered.length,p.sentenceIds.length);assert.equal($('readingCheckpoint').hidden,true);
 assert.ok($('readingIntervalProgress').textContent.includes('sentences towards your next quiz'));
});
test('Sentence intervals and partial progress survive sanitization',()=>{
 $('readingPracticeClose').click();$('readingOptionsToggle').click();
 for(const n of [10,20,30]){$('readingWordInterval').value=n;$('readingWordInterval').dispatchEvent(new w.Event('change'));assert.equal(run('sanitizeExtras(extras).reading.sentenceInterval'),n);assert.equal(run('extras.reading.quizCadence["2"].target'),n);}
 $('readingWordInterval').value=20;$('readingWordInterval').dispatchEvent(new w.Event('change'));$('readingSettingsClose').click();
 const r=run('sanitizeExtras(JSON.parse(JSON.stringify(extras))).reading');assert.equal(r.cadenceUnit,'sentences');assert.equal(r.sentenceInterval,20);assert.deepEqual(r.quizCadence['2'],run('extras.reading.quizCadence["2"]'));
 assert.deepEqual(r.quizSeen['2'],run('extras.reading.quizSeen["2"]'));
});
test('A 30-question direct quiz survives backup and resumes without flashcards',()=>{
 run('extras.reading.practice=null;extras.reading.read=READING_SENTENCES.filter(s=>s.level===2).slice(0,30).map(s=>s.id);extras.reading.quizCovered={};ReadingStudio.render()');
 $('readingResumePractice').click();$('readingSetupCount').value='30';$('readingSetupOrder').checked=true;$('readingQuizStart').click();
 const before=JSON.parse(JSON.stringify(run('extras.reading.practice')));assert.ok(before.questions.length>5);assert.ok(before.questions.length<=30);
 run('extras.reading=sanitizeExtras(JSON.parse(JSON.stringify(extras))).reading');
 assert.equal(run('extras.reading.practice.questions.length'),before.questions.length);
 assert.equal(JSON.stringify(run("extras.reading.practice.questions.map(q=>[q.word||'',q.target||'',q.options])")),JSON.stringify(before.questions.map(q=>[q.word||'',q.target||'',q.options])));
 assert.equal(run('extras.reading.practice.phase'),'quiz');assert.equal(run('extras.reading.quizWordInterval'),20);
 $('readingPracticeClose').click();$('readingResumePractice').click();
 assert.ok(w.document.querySelector('[data-reading-answer]'));assert.equal($('readingCardReveal'),null);
});
test('Flashcard review stays separate and completes without silently becoming a quiz',()=>{
 $('readingPracticeClose').click();$('readingSettingsClose').click();$('readingReviewWords').click();assert.ok($('readingCardReveal'));
 const n=run('extras.reading.practice.words.length');for(let i=0;i<n;i++)click('[data-reading-rate="learning"]');
 assert.equal(run('extras.reading.practice.phase'),'summary');assert.equal(run('extras.reading.practice.cursor'),n);
});
test('Workspace is separate from Reader and keeps text tools and credits together',()=>{
 assert.equal($('inputText').closest('.panel').id,'workspace');assert.equal($('readingUseCustom').closest('.panel').id,'workspace');
 assert.equal(w.document.querySelector('.reading-credit').closest('.panel').id,'workspace');assert.equal($('reader').querySelector('textarea'),null);
 click('[data-tab="workspace"]');assert.equal($('workspace').classList.contains('active'),true);assert.equal($('pageTitle').textContent,'Workspace');
});
test('Every study entry has a matching-track sentence, without claiming universal three-example coverage',()=>{
 const audit=JSON.parse(fs.readFileSync('tools/vocabulary-coverage.json','utf8'));assert.equal(audit.entries.length,601);
 assert.ok(audit.entries.every(v=>v.sentences>0));assert.ok(audit.entries.some(v=>v.sentences<3));
 for(const entry of audit.entries)for(const id of entry.ids){const row=run(`READING_SENTENCES.find(s=>s.id===${JSON.stringify(id)})`);assert.equal(row.level,entry.level);assert.ok(run(`ReadingStudio.segments(${JSON.stringify(row.zh)},${JSON.stringify(row.py)}).some(t=>t.text===${JSON.stringify(entry.word)})`));}
});
test('Balanced order mixes contexts and patterns and preserves the current sentence on order changes',()=>{
 run('extras.reading.reviewSession=null;extras.reading.source="2";extras.reading.order="original";extras.reading.positions["2"]=25;ReadingStudio.render()');const id=run('ReadingStudio.current().id');
 $('readingOrder').value='balanced';$('readingOrder').dispatchEvent(new w.Event('change'));assert.equal(run('ReadingStudio.current().id'),id);
 const rows=run('ReadingStudio.orderedLevel(2)');assert.ok(rows[20].id.startsWith('context-'));assert.ok(rows[21].id.startsWith('pattern-'));assert.notEqual(rows[20].topic,rows[22].topic);
 assert.equal(new Set(rows.map(s=>s.id)).size,rows.length);
});
test('Sentence reviews are finite, preserve the reading place and schedule the next visit',()=>{
 const pos=run('extras.reading.positions["2"]'),read=run('extras.reading.read.length');run('ReadingStudio.startSentenceReview()');assert.ok(run('extras.reading.reviewSession'));
 const id=run('ReadingStudio.current().id'),n=run('extras.reading.reviewSession.ids.length');for(let i=0;i<n;i++)$('readingMarkNext').click();
 assert.equal(run('extras.reading.reviewSession'),null);assert.equal(run('extras.reading.positions["2"]'),pos);assert.equal(run('extras.reading.read.length'),read);
 assert.ok(run(`extras.reading.sentenceReview[${JSON.stringify(id)}].due`)>Date.now());
});
test('A quiz miss schedules vocabulary and relevant sentences; review uses that word in context',()=>{
 run('extras.reading.practice=null');$('readingResumePractice').click();$('readingQuizStart').click();const p=run('extras.reading.practice'),q=p.questions[p.q],word=q.target;
 click(`[data-reading-answer="${q.options.findIndex(x=>x!==q.word)}"]`);assert.equal(run(`extras.reading.wordReview[${JSON.stringify(word)}].misses`),1);
 const due=run(`extras.reading.wordReview[${JSON.stringify(word)}].due`);assert.ok(due>Date.now()+590000&&due<=Date.now()+600000);
 $('readingPracticeClose').click();run('ReadingStudio.startSentenceReview(true)');
 assert.ok(run(`ReadingStudio.sentences().every(s=>ReadingStudio.segments(s.zh,s.py).some(t=>t.text===${JSON.stringify(word)}))`));
 const restored=run('sanitizeExtras(JSON.parse(JSON.stringify(extras))).reading');assert.equal(restored.reviewSession.reason,'missed vocabulary');assert.ok(restored.wordReview[word]);
 $('readingExitReview').click();assert.equal(run('extras.reading.reviewSession'),null);
});
test('Compound syllables toggle independently while definition and punctuation stay grouped',()=>{
 run(`extras.reading.source='custom';extras.reading.custom='面条。';extras.reading.positions.custom=0;extras.reading.pinyin='always';statuses['面条']='new';ReadingStudio.render()`);
 const hints=w.document.querySelectorAll('[data-r-word="面条"]');assert.equal(hints.length,2);assert.equal(w.document.querySelectorAll('[data-r-definition="面条"]').length,1);
 hints[0].click();click('[data-r-word="面条"][data-r-index="1"]');click('[data-r-word="面条"][data-r-index="0"]');assert.equal(run(`ReadingStudio.hintsVisible('面条','miàn tiáo',0)`),false);assert.equal(run(`ReadingStudio.hintsVisible('面条','miàn tiáo',1)`),true);assert.equal(run(`statusOf('面条')`),'new');
 click('[data-r-word="面条"][data-r-index="1"]');assert.equal(run(`statusOf('面条')`),'new');click('[data-r-word="面条"][data-r-index="0"]');assert.equal(run(`statusOf('面条')`),'new');assert.equal(run(`ReadingStudio.hintsVisible('面条','miàn tiáo',1)`),false);
 const restored=run('sanitizeExtras(getBackup().studio).reading');assert.equal(restored.hiddenPinyin['面条::hint::0'],false);assert.equal(restored.hiddenPinyin['面条::hint::1'],true);
 const unit=w.document.querySelector('[data-r-definition="面条"]').closest('.sentence-unit');assert.equal(unit.querySelector('.sentence-punctuation').textContent,'。');
 click('[data-r-definition="面条"]');assert.equal($('readingWordHeading').textContent,'面条');assert.match($('readingWordMeaning').textContent,/noodle/);$('readingWordClose').click();
});
test('Word pull grades globally, cancels short pulls, supports Undo and suppresses definition clicks',()=>{
 run(`extras.reading.source='custom';extras.reading.custom='面条。';extras.reading.positions.custom=0;statuses['面条']='new';ReadingStudio.render()`);
 const canvas=$('sentenceCanvas'),send=(type,target,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,isPrimary:true,clientX:x,clientY:y});target.dispatchEvent(e);};
 let word=w.document.querySelector('[data-r-definition="面条"]');send('pointerdown',word,100,100);send('pointermove',canvas,100,120);send('pointerup',canvas,100,120);assert.equal(run(`statusOf('面条')`),'new');
 send('pointerdown',word,100,100);send('pointermove',canvas,100,145);send('pointercancel',canvas,100,145);assert.equal(run(`statusOf('面条')`),'new');
 send('pointerdown',word,100,100);send('pointermove',canvas,100,145);assert.equal(word.style.transform,'translateY(12px)');assert.equal(word.closest('.sentence-token').style.transform,'');send('pointerup',canvas,100,145);assert.equal(run(`statusOf('面条')`),'known');assert.equal(run('getBackup().entryStatuses["面条"]'),'known');assert.equal($('readingGestureNotice').hidden,false);click('[data-r-definition="面条"]');assert.equal($('readingWordDialog').open,false);$('readingGestureUndo').click();assert.equal(run(`statusOf('面条')`),'new');
});
test('Pulling a Known word toggles to Unknown and Undo restores Known',()=>{
 run(`extras.reading.source='custom';extras.reading.custom='面条。';extras.reading.positions.custom=0;statuses['面条']='known';ReadingStudio.render()`);const canvas=$('sentenceCanvas'),word=w.document.querySelector('[data-r-definition="面条"]');for(const [type,y] of [['pointerdown',100],['pointermove',145],['pointerup',145]]){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:9,button:0,isPrimary:true,clientX:100,clientY:y});(type==='pointerdown'?word:canvas).dispatchEvent(e);}assert.equal(run(`statusOf('面条')`),'new');assert.ok(!w.document.querySelector('[data-r-definition="面条"]').closest('.sentence-token').classList.contains('token-known'));assert.match($('readingGestureText').textContent,/Unknown/);$('readingGestureUndo').click();assert.equal(run(`statusOf('面条')`),'known');
});
test('Translation icon buttons retain accessible actions and pin state',()=>{assert.ok($('readingTranslateToggle').querySelector('svg'));assert.ok($('readingPinTranslation').querySelector('svg'));assert.equal($('readingPinTranslation').textContent,'');const before=$('readingPinTranslation').getAttribute('aria-pressed');$('readingPinTranslation').click();assert.notEqual($('readingPinTranslation').getAttribute('aria-pressed'),before);assert.match($('readingPinTranslation').getAttribute('aria-label'),/translation/);});
test('Horizontal phrase swipes preserve unread state and clamp at the first sentence',()=>{
 run(`extras.reading.source='custom';extras.reading.custom='你好。谢谢。';extras.reading.positions.custom=0;ReadingStudio.render()`);const canvas=$('sentenceCanvas'),send=(type,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:2,button:0,isPrimary:true,clientX:x,clientY:y});canvas.dispatchEvent(e);};
 const read=run('JSON.stringify(extras.reading.read)'),id=run('ReadingStudio.current().id');send('pointerdown',150,100);send('pointermove',60,104);send('pointerup',60,104);assert.equal(run('extras.reading.positions.custom'),1);assert.equal(run('JSON.stringify(extras.reading.read)'),read);assert.ok(run('extras.reading.quizSeen.custom.includes('+JSON.stringify(id)+')'));send('pointerdown',50,100);send('pointermove',140,102);send('pointerup',140,102);assert.equal(run('extras.reading.positions.custom'),0);send('pointerdown',50,100);send('pointermove',140,102);send('pointerup',140,102);assert.equal(run('extras.reading.positions.custom'),0);
});
test('Balanced word rows avoid an orphan final unit and preserve order',()=>{const ends=Array.from(run('ReadingStudio.balancedBreaks([30,60,30,30,60,60,60],300)'));assert.equal(ends.length,2);assert.ok(ends[0]<=5);assert.equal(ends[1],7);assert.deepEqual(Array.from(run('ReadingStudio.balancedBreaks([30,60,30],300)')),[3]);});
test('Word feedback occupies a dedicated slot outside translation flow',()=>{assert.equal($('readingGestureNotice').closest('.reading-feedback-slot').parentElement.classList.contains('sentence-card'),true);assert.equal($('readingGestureNotice').closest('#sentenceTranslation'),null);});
test('Custom pasted text opens as sentences without losing the original draft',()=>{$('readingPracticeClose').click();$('inputText').value='我们一起学习。明天去公园。';$('readingUseCustom').click();assert.equal(run('ReadingStudio.sentences().length'),2);assert.equal($('readingSource').value,'custom');assert.equal($('reader').classList.contains('active'),true);assert.equal($('inputText').value,'我们一起学习。明天去公园。')});
test('Pinyin pointer taps never capture or retarget the hint button',()=>{
 run(`extras.reading.source='2';extras.reading.reviewSession=null;ReadingStudio.render()`);
 const hint=w.document.querySelector('[data-r-word]');let captured=false;$('sentenceCanvas').setPointerCapture=()=>{captured=true};
 const e=new w.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(e,{pointerId:22,button:0,isPrimary:true,clientX:100,clientY:100});hint.dispatchEvent(e);assert.equal(captured,false);hint.click();assert.equal(w.document.querySelector('[data-r-word]').getAttribute('aria-pressed'),'true');
});
test('Quiz exit and resume preserve track, sentence, arrows and all eligible words',()=>{
 run(`extras.reading.source='2';extras.reading.positions['2']=25;extras.reading.practice=null;extras.reading.read=ReadingStudio.orderedLevel(2).slice(0,20).map(s=>s.id);extras.reading.quizSeen={};extras.reading.quizCovered={};ReadingStudio.render()`);
 const id=run('ReadingStudio.current().id');$('readingResumePractice').click();$('readingSetupCount').value='5';$('readingSetupOrder').checked=false;$('readingQuizStart').click();
 assert.equal(run('extras.reading.practice.sentenceIds.length'),20);assert.ok(run('extras.reading.practice.words.length')>5);assert.equal(run('extras.reading.practice.questions.length'),5);
 const p=run('extras.reading.practice'),q=p.questions[0];click('[data-reading-answer="'+q.options.findIndex(x=>x!==q.word)+'"]');
 assert.ok(w.document.querySelector('[data-reading-answer].wrong'));assert.ok(w.document.querySelector('[data-reading-answer].correct'));assert.match($('readingPracticeBody').textContent,/Answer:/);assert.ok($('readingQuestionNext').querySelector('svg'));
 $('readingPracticeClose').click();assert.equal(run('ReadingStudio.current().id'),id);assert.equal(run('ReadingStudio.sentences().length'),421);assert.equal($('readingNext').disabled,false);
 $('readingResumePractice').click();assert.ok(w.document.querySelector('[data-reading-answer].wrong'));$('readingPracticeClose').click();$('readingNext').click();assert.notEqual(run('ReadingStudio.current().id'),id);
 const restored=run('sanitizeExtras(JSON.parse(JSON.stringify(extras))).reading');assert.ok(restored.practice.words.length>5);assert.equal(restored.practice.selectedAnswer,p.selectedAnswer);
});
test('Navigation, progress and vocabulary status controls have the requested structure',()=>{
 assert.equal(w.document.querySelector('[data-tab]').dataset.tab,'reader');assert.equal($('progressSummary').closest('section').id,'lessons');assert.equal($('writingSummary').closest('section').id,'lessons');
 assert.ok($('settings').querySelectorAll('.settings-grid>details').length>=6);assert.equal($('vocabTable').querySelector('.status-chip'),null);assert.ok($('vocabTable').querySelector('[data-status="new"] svg'));
});
test('A stale review list or numeric track never leaves a preset reader empty',()=>{
 run(`extras.reading.source=2;extras.reading.reviewSession={ids:['obsolete-sentence'],index:0};ReadingStudio.render()`);assert.equal(run('ReadingStudio.sentences().length'),421);assert.equal(run('extras.reading.reviewSession'),null);assert.equal($('readingNext').disabled,false);
});
test('Upward word pulls mark Learning globally, keep hints still, and support Undo',()=>{
 run(`extras.reading.source='custom';extras.reading.custom='面条。';extras.reading.positions.custom=0;extras.reading.reviewSession=null;statuses['面条']='known';ReadingStudio.render()`);
 const canvas=$('sentenceCanvas'),send=(type,target,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:17,button:0,isPrimary:true,clientX:100,clientY:y});target.dispatchEvent(e);};
 let word=w.document.querySelector('[data-r-definition="面条"]');send('pointerdown',word,100);send('pointermove',canvas,80);send('pointerup',canvas,80);assert.equal(run(`statusOf('面条')`),'known');
 send('pointerdown',word,100);send('pointermove',canvas,55);assert.equal(word.style.transform,'translateY(-12px)');assert.equal(word.closest('.sentence-token').querySelector('.reading-hint-row').style.transform,'');send('pointercancel',canvas,55);assert.equal(run(`statusOf('面条')`),'known');
 send('pointerdown',word,100);send('pointermove',canvas,55);assert.ok(word.closest('.sentence-token').classList.contains('word-pull-learning'));send('pointerup',canvas,55);
 assert.equal(run(`statusOf('面条')`),'learning');assert.equal(run('getBackup().entryStatuses["面条"]'),'learning');assert.match($('readingGestureText').textContent,/Learning/);assert.ok(w.document.querySelector('.sentence-token.token-learning'));click('[data-r-definition="面条"]');assert.equal($('readingWordDialog').open,false);
 $('readingGestureUndo').click();assert.equal(run(`statusOf('面条')`),'known');
});
test('Hint tooltips are absent and forward action is an accessible double chevron',()=>{
 assert.equal(w.document.querySelector('[data-r-word][title]'),null);assert.ok($('readingMarkNext').querySelector('svg'));assert.match($('readingMarkNext').getAttribute('aria-label'),/Mark read/);assert.equal($('readingMarkNext').textContent,'');
});
test('Word guide metadata is beside the word and vocabulary has a separate scrolling body',()=>{
 assert.ok($('readingWordMeaning').closest('.reading-word-info'));assert.equal($('readingWordHeading').parentElement,$('readingWordMeaning').closest('.reading-word-hero'));assert.ok($('readingVocab').closest('.reading-vocab-content'));
 const css=fs.readFileSync('assets/app.css','utf8');assert.ok(css.includes('height:var(--sentence-frame-height'));assert.ok(css.includes('.reading-vocabulary[open] .reading-vocab-content'));assert.ok($('flashGuideWord'));assert.ok($('flashGuidePinyin'));
});
test('Reader popup places status at the right and supplies accessible listen and learning icons',()=>{
 assert.equal($('readingWordState').parentElement.className,'reading-word-hero');assert.equal($('readingWordState').previousElementSibling.className,'reading-word-info');assert.ok($('readingWordListen').querySelector('svg'));assert.equal($('readingWordListen').textContent,'');assert.match($('readingWordListen').getAttribute('aria-label'),/Listen/);assert.ok($('readingWordLearning').querySelector('svg'));assert.equal($('readingWordLearning').textContent,'Learning');
});
test('Save sentence uses an accessible bookmark and persists its toggled state',()=>{
 const button=$('readingStarSentence'),id=run('ReadingStudio.current().id'),before=button.getAttribute('aria-pressed');assert.ok(button.querySelector('svg'));assert.equal(button.textContent,'');button.click();assert.notEqual(button.getAttribute('aria-pressed'),before);assert.equal(run('getBackup().studio.reading.starSentences.includes('+JSON.stringify(id)+')'),button.getAttribute('aria-pressed')==='true');assert.match(button.getAttribute('aria-label'),/sentence/);button.click();assert.equal(button.getAttribute('aria-pressed'),before);
});
test('Reader controls use the header and a compact accessible icon rail',()=>{
 assert.ok($('readingOptionsToggle').closest('header'));assert.ok($('readingResumePractice').closest('header'));assert.ok($('readingListen').querySelector('svg'));assert.equal($('readingListen').textContent,'');assert.ok($('readingPeek').querySelector('svg'));assert.ok($('readingTranslateToggle').closest('.reading-navigation'));assert.ok($('readingPinTranslation').closest('.reading-navigation'));
});
console.log(count+' reading workflow checks passed');dom.window.close();
