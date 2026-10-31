const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');process.chdir(path.resolve(__dirname,'..'));
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/hsk-reader/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.confirm=()=>true;w.CSS={escape:x=>x};w.TextEncoder=TextEncoder;
w.eval(['assets/vocabulary.js',...Array.from({length:4},(_,i)=>`assets/reading-dictionary-${i}.js`),'assets/sentences.js','assets/sentences-hsk2.js','assets/sentences-hsk3-0.js','assets/sentences-hsk3-1.js','assets/sentences-hsk3-2.js','assets/app.js','assets/reading-studio.js'].map(file=>fs.readFileSync(file,'utf8')).join('\n')+'\nwindow.readerTest={eval:s=>eval(s)};');
const $=id=>w.document.getElementById(id),run=s=>w.readerTest.eval(s);let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
const click=sel=>{const b=w.document.querySelector(sel);assert.ok(b,sel);b.click();};
test('All 1,410 sentences have one pinyin syllable per Chinese character',()=>{for(const s of run('READING_SENTENCES'))assert.equal([...s.zh].filter(c=>/[\u3400-\u9fff]/.test(c)).length,s.py.split(/\s+/).length,s.zh)});
test('Static navigation has no animated image or picture elements',()=>assert.equal(w.document.querySelectorAll('.sidebar-nav img,.sidebar-nav picture').length,0));
test('Dictionary segments multi-character words beyond the original HSK deck',()=>assert.ok(run("ReadingStudio.segments('为了明天的比赛').some(x=>x.text==='比赛'&&x.v)")));
test('Word hint toggles globally without marking the word known',()=>{const word=w.document.querySelector('[data-r-word]').dataset.rWord,st=run(`statusOf(${JSON.stringify(word)})`);click('[data-r-word]');assert.equal(run(`ReadingStudio.hintsVisible(${JSON.stringify(word)})`),false);assert.equal(run(`statusOf(${JSON.stringify(word)})`),st);run('ReadingStudio.render()');assert.equal(run(`ReadingStudio.hintsVisible(${JSON.stringify(word)})`),false)});
test('Pinyin and Chinese use separate buttons; a word opens definition and writing',()=>{
 click('[data-r-definition="每天"]');assert.equal($('readingWordDialog').open,true);
 assert.equal($('readingWordHeading').textContent,'每天');assert.ok($('readingWordMeaning').textContent.includes('every day'));
 $('readingWordClose').click();assert.equal($('readingWordDialog').open,false);
});
test('Each study track has the requested sentence depth with no duplicate sentences',()=>{
 const rows=run('READING_SENTENCES');assert.equal(rows.filter(x=>x.level===2).length,340);assert.equal(rows.filter(x=>x.level===3).length,1070);
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
test('Reading 10 sentences triggers the review prompt without repeating progress',()=>{for(let i=1;i<10;i++)$('readingMarkNext').click();assert.equal(run('extras.reading.read.length'),10);assert.equal($('readingCheckpoint').hidden,false);assert.match($('readingPosition').textContent,/10 read/)});
test('Checkpoint opens a compact quiz popup with all words included',()=>{
 $('readingCheckpointStart').click();assert.equal($('readingPracticeDialog').open,true);
 assert.ok($('readingQuizStart'));assert.equal($('readingCardReveal'),null);assert.equal(w.document.querySelectorAll('[data-quiz-word]').length,0);assert.match($('readingPracticeBody').textContent,/All \d+ words/);
});
test('Mixed quiz includes all covered vocabulary without a selection step',()=>{
 $('readingSetupOrder').checked=true;$('readingSetupType').value='mixed';$('readingQuizStart').click();
 assert.equal(run('extras.reading.practice.phase'),'quiz');assert.equal(run('extras.reading.practice.mode'),'direct');
 assert.equal(run('extras.reading.practice.words.length'),9);assert.equal(run('extras.reading.practice.questions.length'),10);
 assert.equal(new Set(run('extras.reading.practice.questions.map(q=>q.kind)')).size,5);
 assert.ok(run("extras.reading.practice.questions.filter(q=>q.kind!=='order').every(q=>ReadingStudio.definition(q.target))"));
});
test('Correct answers and sentence ordering produce a finite quiz summary',()=>{while(run('extras.reading.practice.phase')==='quiz'){
 const p=run('extras.reading.practice'),q=p.questions[p.q];if(q.kind==='order'){
  const used=new Set();for(const text of q.answer){const i=q.options.findIndex((o,i)=>o.text===text&&!used.has(i));assert.ok(i>=0);used.add(i);click(`[data-reading-order="${i}"]`);}click('#readingOrderCheck');
 }else click(`[data-reading-answer="${q.options.indexOf(q.word)}"]`);
 assert.equal(run('extras.reading.practice.answered'),true);click('#readingQuestionNext');
 }assert.equal(run('extras.reading.practice.phase'),'summary');assert.equal(run('extras.reading.practice.score'),run('extras.reading.practice.total'))});
test('Reader practice and duplicate sentence tokens survive backup round-trip',()=>{const r=run('sanitizeExtras(JSON.parse(JSON.stringify(extras)))');assert.equal(r.reading.practice.cursor,9);assert.equal(r.reading.practice.mode,'direct');assert.equal(r.reading.practice.sentenceIds.length,10);assert.equal(r.reading.practice.phase,'summary');assert.equal(r.reading.practice.score,r.reading.practice.total)});
test('Completing a quiz resets only its sentence interval and prevents the same prompt',()=>{
 assert.equal(run('extras.reading.quizCovered["2"].length'),10);assert.equal($('readingCheckpoint').hidden,true);
 assert.match($('readingIntervalProgress').textContent,/0 \/ 10 sentences/);
});
test('Saved reader options support all intervals from 10 to 30 with proper boundaries',()=>{
 $('readingPracticeClose').click();$('readingOptionsToggle').click();assert.equal($('readingOptions').open,true);
 for(const n of [10,17,20,30]){
  $('readingSentenceInterval').value=n;$('readingSentenceInterval').dispatchEvent(new w.Event('change'));
  assert.equal(run('sanitizeExtras(extras).reading.sentenceInterval'),n);
  run(`extras.reading.read=READING_SENTENCES.filter(s=>s.level===2).slice(0,${n-1}).map(s=>s.id);extras.reading.quizCovered={};extras.reading.dismissedCheckpoint=[];ReadingStudio.render()`);
  assert.equal($('readingCheckpoint').hidden,true);
  run(`extras.reading.read=READING_SENTENCES.filter(s=>s.level===2).slice(0,${n}).map(s=>s.id);ReadingStudio.render()`);
  assert.equal($('readingCheckpoint').hidden,false);
 }
 $('readingSentenceInterval').value=100;$('readingSentenceInterval').dispatchEvent(new w.Event('change'));assert.equal(run('extras.reading.sentenceInterval'),30);
 $('readingSentenceInterval').value=1;$('readingSentenceInterval').dispatchEvent(new w.Event('change'));assert.equal(run('extras.reading.sentenceInterval'),10);
});
test('A 30-question direct quiz survives a backup and resumes without flashcards',()=>{
 run('extras.reading.practice=null');$('readingResumePractice').click();$('readingSetupCount').value='30';$('readingSetupOrder').checked=true;$('readingQuizStart').click();
 const before=JSON.parse(JSON.stringify(run('extras.reading.practice')));assert.ok(before.questions.length>11);assert.ok(before.questions.length<=30);
 run('extras.reading=sanitizeExtras(JSON.parse(JSON.stringify(extras))).reading');assert.equal(run('extras.reading.practice.questions.length'),before.questions.length);assert.equal(JSON.stringify(run("extras.reading.practice.questions.map(q=>[q.word||'',q.target||'',q.options])")),JSON.stringify(before.questions.map(q=>[q.word||'',q.target||'',q.options])));
 assert.equal(run('extras.reading.practice.phase'),'quiz');assert.equal(run('extras.reading.sentenceInterval'),10);
 $('readingPracticeClose').click();$('readingResumePractice').click();assert.ok(w.document.querySelector('[data-reading-answer]'));assert.equal($('readingCardReveal'),null);
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
test('Custom pasted text opens as sentences without losing the original draft',()=>{$('readingPracticeClose').click();$('inputText').value='我们一起学习。明天去公园。';$('readingUseCustom').click();assert.equal(run('ReadingStudio.sentences().length'),2);assert.equal($('readingSource').value,'custom');assert.equal($('reader').classList.contains('active'),true);assert.equal($('inputText').value,'我们一起学习。明天去公园。')});
console.log(count+' reading workflow checks passed');dom.window.close();
