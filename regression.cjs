const {JSDOM}=require('jsdom');
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const path=require('path');process.chdir(path.resolve(__dirname,'..'));const root='./';let results=[];
function test(name,fn){try{fn();results.push({name,result:'PASS'});}catch(e){results.push({name,result:'FAIL',error:e.stack});}}
const original=JSON.parse(fs.readFileSync('tests/original-vocabulary.json','utf8'));
const doc=fs.readFileSync(root+'index.html','utf8');
const dom=new JSDOM(doc,{url:'https://example.test/hsk-reader/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.confirm=()=>true;w.CSS={escape:x=>x};w.TextEncoder=TextEncoder;w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(root+'vendor/characters.json','utf8'))});
w.localStorage.setItem('hskReaderStatuses.v01',JSON.stringify({'长':'known','爱':'learning'}));
w.localStorage.setItem('hskReaderSettings.v01',JSON.stringify({dark:true,ttsRate:0.8,onlineTranslate:true,autoStroke:false}));
w.localStorage.setItem('hskReaderLessons.v01',JSON.stringify({'2':{wordsPerDay:10,completedDays:2,completedDates:['2026-01-01','2026-01-02']}}));
w.eval(fs.readFileSync(root+'assets/vocabulary.js','utf8')+'\n'+fs.readFileSync(root+'assets/app.js','utf8')+`\nwindow.api={raw:RAW_VOCAB,all:VOCAB,entryKey,resolveEntry,statusOf,setStatus,getDeck,createCustomDeck,currentCard,getBackup,importBackup,planFor,savePlan,completeLesson,undoLessonDay,currentLessonWords,segmentText,segmentTextWithPredicate,renderReader,filteredVocab,startQuiz,nextQuiz,answerQuiz,quizCorrectFor,quizPromptFor,dueEntries,gradeReview,flipFlash,startDailyReview,restoreFlashSession,saveFlashSession,sanitizeExtras,normalizeSettings,showWord,renderStrokeSurfaces,onlineTranslate,localCharacterLoader,renderAll,applySettingsToUI,saveReaderDraft,eval:s=>eval(s)};`);
const a=w.api,$=id=>w.document.getElementById(id),plain=x=>JSON.parse(JSON.stringify(x));
test('All 601 original records unchanged, in original order',()=>assert.deepEqual(plain(a.raw),original));
test('303 HSK2 / 298 HSK3 / 600 written words',()=>assert.deepEqual([a.getDeck('2').length,a.getDeck('3').length,new Set(a.raw.map(v=>v.word)).size],[303,298,600]));
test('Legacy settings and lesson history survive startup',()=>{assert.equal(w.document.documentElement.dataset.theme,'dark');assert.equal(a.planFor(2).coveredWords,20);assert.equal(a.planFor(2).completedDates.length,2);assert.equal(a.eval('settings.onlineTranslate'),true);});
test('Legacy snapshot captured before migration',()=>assert.equal(JSON.parse(w.localStorage.getItem('hskReaderPreStudioBackup.v1'))['hskReaderStatuses.v01'],'{"长":"known","爱":"learning"}'));
test('Legacy 长 status migrates to both senses',()=>assert.deepEqual([a.statusOf('长::cháng'),a.statusOf('长::zhǎng')],['known','known']));
test('Reset one pronunciation without erasing the other',()=>{a.setStatus('长::zhǎng','new');assert.equal(a.statusOf('长::cháng'),'known');assert.equal(a.statusOf('长::zhǎng'),'new');});
test('HSK3 and custom decks retain zhǎng',()=>{const v=a.getDeck('3').find(v=>v.word==='长');a.createCustomDeck([v],'test');assert.equal(a.currentCard().pinyin,'zhǎng');});
test('Vocabulary search exposes both 长 records',()=>{$('vocabSearch').value='长';const rows=a.filteredVocab().filter(v=>v.word==='长');assert.equal(rows.length,2);$('vocabSearch').value='';});
test('Hide known does not split 我们 into 我',()=>{a.setStatus('我们','known');a.eval('settings.hideKnown=true');const segs=a.segmentText('我们').segs;assert.equal(segs.length,1);assert.equal(segs[0].type,'text');assert.equal(segs[0].text,'我们');a.eval('settings.hideKnown=false');});
test('Reader preserves punctuation and safely renders hostile markup',()=>{$('inputText').value='我们。<img src=x onerror="alert(1)">';a.renderReader();assert.equal($('readerView').textContent,$('inputText').value);assert.equal($('readerView').querySelector('img'),null);});
test('HSK3-only reader uses explicit zhǎng selection',()=>{a.eval("extras.readerSense='长::zhǎng';settings.filter2=false;settings.filter3=true");assert.equal(a.segmentText('长').segs[0].v.pinyin,'zhǎng');a.eval('settings.filter2=true');});
test('Lesson word count changes retain completed coverage',()=>{$('lessonDaily2').value=7;a.savePlan(2);assert.equal(a.planFor(2).coveredWords,20);a.completeLesson();assert.equal(a.planFor(2).coveredWords,27);a.undoLessonDay();assert.equal(a.planFor(2).coveredWords,20);});
test('Quiz includes four distinct options and locks duplicate answers',()=>{a.startQuiz([a.resolveEntry('爱'),a.resolveEntry('买')]);assert.equal(new Set([...$('quizOptions').children].map(x=>x.dataset.answer)).size,4);let q=a.eval('quiz');const correct=a.quizCorrectFor(q.current,q.currentDir),b=[...$('quizOptions').children].find(x=>x.dataset.answer!==correct);a.answerQuiz(b.dataset.answer,b);a.answerQuiz(b.dataset.answer,b);assert.equal(a.eval('quiz.total'),1);assert.equal(a.eval('quiz.missed.length'),1);assert.match($('quizFeedback').textContent,/Correct answer/);});
test('Polyphonic quiz prompts disambiguate meaning/pronunciation',()=>{const v=a.resolveEntry('长::zhǎng');assert.match(a.quizPromptFor(v,'zh-en'),/zhǎng/);assert.match(a.quizPromptFor(v,'zh-py'),/chief/);});
test('Remembered schedules 1 day and counts unique daily review',()=>{a.createCustomDeck([a.resolveEntry('爱')],'Due review');a.flipFlash();const now=Date.now();a.gradeReview(true);const r=a.getBackup().studio.srs['爱'];assert.ok(r.due-now>=86399000&&r.due-now<86402000);assert.equal(r.step,1);assert.equal(a.eval('deck.length'),0);});
test('Again schedules 10 minutes and resets interval step',()=>{a.createCustomDeck([a.resolveEntry('爱')],'Due review');a.flipFlash();const now=Date.now();a.gradeReview(false);const r=a.getBackup().studio.srs['爱'];assert.ok(r.due-now>=599000&&r.due-now<602000);assert.equal(r.step,0);assert.equal(a.getBackup().studio.daily[a.eval('todayISO()')].filter(x=>x==='爱').length,1);});
test('Future reviews excluded; unscheduled Learning words included',()=>{assert.ok(!a.dueEntries().some(v=>v.word==='爱'));a.setStatus('北京','learning');assert.ok(a.dueEntries().some(v=>v.word==='北京'));});
test('Flashcard session restores exact pronunciation and reveal state',()=>{a.createCustomDeck([a.resolveEntry('长::zhǎng'),a.resolveEntry('长::cháng')],'Senses');a.flipFlash();a.saveFlashSession();a.eval('deck=[];deckIndex=0');a.restoreFlashSession();assert.equal(a.currentCard().pinyin,'zhǎng');assert.equal(a.eval('flashRevealEnglish'),true);});
test('Save and reload a named passage',()=>{$('inputText').value='今天我们学习中文。';$('passageTitle').value='Practice <one>';$('savePassageBtn').click();const p=a.getBackup().studio.passages[0];assert.equal(p.text,'今天我们学习中文。');$('inputText').value='other';$('savedPassages').value=p.id;$('loadPassageBtn').click();assert.equal($('inputText').value,p.text);assert.equal($('savedPassages').querySelector('option[value="'+p.id+'"]').textContent,'Practice <one>');});
test('New backup round trip preserves statuses, SRS, writing and passages',()=>{const backup=plain(a.getBackup());a.setStatus('爱','known');a.importBackup(JSON.stringify(backup));const restored=plain(a.getBackup());assert.deepEqual(restored.entryStatuses,backup.entryStatuses);assert.deepEqual(restored.studio.srs,backup.studio.srs);assert.deepEqual(restored.studio.passages,backup.studio.passages);assert.equal(restored.readerText,backup.readerText);});
test('Old backups accepted; new passage collection retained',()=>{const n=a.getBackup().studio.passages.length;a.importBackup(JSON.stringify({version:'V0.30',statuses:{'长':'learning','爱':'known'},settings:{dark:false},lessons:{'3':{wordsPerDay:9,completedDays:3}},readerText:'你好'}));assert.equal(a.statusOf('长::zhǎng'),'learning');assert.equal(a.statusOf('长::cháng'),'learning');assert.equal(a.getBackup().studio.passages.length,n);assert.equal(a.planFor(3).coveredWords,27);assert.equal($('inputText').value,'你好');});
test('Invalid JSON, wrong field types and newer schemas leave state untouched',()=>{const before=JSON.stringify(a.getBackup().entryStatuses);for(const raw of ['{bad','{"statuses":[]}','{"statuses":{},"readerText":5}','{"statuses":{},"schemaVersion":99}'])a.importBackup(raw);assert.equal(JSON.stringify(a.getBackup().entryStatuses),before);});
test('Import quota failure rolls back all persisted keys and in-memory state',()=>{const before=JSON.stringify(a.getBackup().entryStatuses),beforeStorage={...w.localStorage},orig=w.Storage.prototype.setItem;let n=0;w.Storage.prototype.setItem=function(k,v){if(++n===3)throw Error('quota');return orig.call(this,k,v)};a.importBackup(JSON.stringify({settings:{dark:true},statuses:{'你':'known'},readerText:'replacement'}));w.Storage.prototype.setItem=orig;assert.equal(JSON.stringify(a.getBackup().entryStatuses),before);assert.deepEqual({...w.localStorage},beforeStorage);});
test('Blocked draft storage does not claim saved',()=>{const orig=w.Storage.prototype.setItem;w.Storage.prototype.setItem=()=>{throw Error('quota')};assert.equal(a.saveReaderDraft(),false);assert.match($('draftNotice').textContent,/Not saved/);w.Storage.prototype.setItem=orig;});
test('Imported settings are bounded and type checked',()=>{const s=a.normalizeSettings({dark:'false',readerFontSize:900,ttsRate:-5,readerLineHeight:999,dailyGoal:200});assert.deepEqual([s.dark,s.readerFontSize,s.ttsRate,s.readerLineHeight,s.dailyGoal],[false,38,.5,2.8,100]);});
test('Complete bundled writing dataset covers every vocabulary character',()=>{const d=JSON.parse(fs.readFileSync(root+'vendor/characters.json','utf8'));const chars=new Set(a.raw.flatMap(v=>Array.from(v.word)));assert.equal(chars.size,622);assert.equal(Object.keys(d).length,622);for(const c of chars){assert.ok(d[c]?.strokes.length);assert.equal(d[c].strokes.length,d[c].medians.length);}});
test('Hidden flash writing panel becomes interactive when opened',()=>{a.eval("flashStrokeOpen=false;toggleFlashStrokePanel(false)");assert.equal($('flashStrokeShell').inert,true);w.HanziWriter={create:()=>({animateCharacter:()=>Promise.resolve(),cancelQuiz(){},pauseAnimation(){}})};a.eval('toggleFlashStrokePanel(true)');assert.equal($('flashStrokeShell').inert,false);a.eval('toggleFlashStrokePanel(false)');});
test('Writing pad records a completion once and exposes navigation',()=>{const quizzes=[];w.HanziWriter={create:(id,ch,opts)=>({quiz:q=>quizzes.push(q),animateCharacter:()=>Promise.resolve()})};const panel=w.document.createElement('div'),status=w.document.createElement('div'),wrap=w.document.createElement('div');w.document.body.append(panel);a.renderStrokeSurfaces({panel,status,wrap,chars:['我','你'],prefix:'unitPad',traceMode:true,startQuiz:true,valid:()=>true,guideVisible:true});assert.equal(panel.querySelectorAll('.stroke-box:not([hidden])').length,1);quizzes[0].onComplete({totalMistakes:2});quizzes[0].onComplete({totalMistakes:2});assert.equal(a.getBackup().studio.writing['我'].count,1);assert.equal(a.getBackup().studio.writing['我'].mistakes,2);panel.remove();});
test('Static document IDs are unique and local assets exist',()=>{const ids=[...w.document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);for(const m of doc.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))assert.ok(fs.existsSync(root+m[1].slice(2)),m[1]);});
test('Swipe left/up/right persist distinct statuses and advance once',()=>{
 const box=$('flashcardBox');box.setPointerCapture=()=>{};box.hasPointerCapture=()=>false;
 for(const [dx,dy,status] of [[-100,0,'new'],[0,-100,'learning'],[100,0,'known']]){
  a.createCustomDeck(a.all.slice(0,3),'swipe test');const key=a.entryKey(a.currentCard());
  box.onpointerdown({isPrimary:true,button:0,pointerId:1,clientX:200,clientY:200});
  box.onpointermove({pointerId:1,clientX:200+dx,clientY:200+dy});
  box.onpointerup({pointerId:1,clientX:200+dx,clientY:200+dy});box.click();
  assert.equal(a.statusOf(key),status);assert.equal(a.eval('deckIndex'),1);assert.equal(a.eval('flashRevealEnglish'),false);
 }
});
test('Short, downward and cancelled swipes do not change the card',()=>{
 const box=$('flashcardBox');
 for(const [dx,dy,cancel] of [[25,0,false],[0,100,false],[-100,0,true]]){
  a.createCustomDeck(a.all.slice(0,3),'swipe test');
  box.onpointerdown({isPrimary:true,button:0,pointerId:1,clientX:200,clientY:200});
  box.onpointermove({pointerId:1,clientX:200+dx,clientY:200+dy});
  if(cancel)box.onpointercancel();else box.onpointerup({pointerId:1,clientX:200+dx,clientY:200+dy});
  assert.equal(a.eval('deckIndex'),0);assert.equal(box.style.transform,'');
 }
});
test('Lesson progress is derived from known words and study opens correct level',()=>{
 a.renderAll();const known=a.getDeck('3').filter(v=>a.statusOf(a.entryKey(v))==='known').length;
 assert.equal($('lessonMeter3').getAttribute('aria-valuenow'),String(Math.round(known/298*100)));
 w.document.querySelector('[data-start-lesson="3"]').click();assert.equal(a.currentCard().level,3);
 assert.equal(a.eval('deckLabel'),'HSK 3 lesson');
});
test('Lesson completes once at 10/10, persists after reload, and updates next day',()=>{
 a.eval('lessonSession=null');const before=a.planFor(2).coveredWords,day=a.planFor(2).completedDays;
 w.document.querySelector('[data-start-lesson="2"]').click();
 const count=a.eval('deck.length');
 for(let n=0;n<count;n++)$('flashKnownBtn').click();
 assert.equal($('lessonFinished').hidden,false);assert.equal(a.currentCard(),null);
 assert.equal(a.planFor(2).coveredWords,before+count);assert.equal(a.planFor(2).completedDays,day+1);
 assert.match($('flashProgress').textContent,new RegExp(count+' / '+count+' reviewed'));
 $('flashKnownBtn').click();assert.equal(a.planFor(2).completedDays,day+1);
 const saved=a.sanitizeExtras(a.eval('extras'));a.eval('lessonSession=null');a.restoreFlashSession();
 assert.equal($('lessonFinished').hidden,false);assert.equal(saved.session.lesson.complete,true);
 assert.match(w.document.querySelector('[data-start-lesson="2"]').textContent,/Today complete/);
});
test('Pinyin aligns one syllable per character for all vocabulary entries',()=>{
 for(const v of a.all){const parts=a.eval('cardSyllables')(v);assert.equal(parts.length,Array.from(v.word).length,v.word+' '+v.pinyin);}
});
test('Stroke popup closes cleanly and blocks underlying flashcard shortcuts',()=>{
 a.createCustomDeck(a.all.slice(0,3),'modal test');$('flashStrokeToggleBtn').click();
 assert.equal($('flashStrokeShell').open,true);const index=a.eval('deckIndex');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(a.eval('deckIndex'),index);
 $('flashExitTraceBtn').click();assert.equal($('flashStrokeShell').open,false);assert.equal(a.eval('flashStrokeOpen'),false);
 $('flashStrokeToggleBtn').click();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal($('flashStrokeShell').open,false);assert.equal(w.document.activeElement,$('flashStrokeToggleBtn'));
});
(async()=>{
 try{let calls=0;w.fetch=async()=>{calls++;throw Error('should not fetch')};await assert.rejects(a.onlineTranslate('我'.repeat(200)));test('Over-limit online translation sends no request',()=>assert.equal(calls,0));}catch(e){results.push({name:'Translation limit',result:'FAIL',error:e.stack})}
 fs.writeFileSync('tests/regression-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));dom.window.close();if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
})();
