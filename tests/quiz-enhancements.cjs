/* Isolated fixtures; no production study data or browser profile. */
const {boot}=require('./audit-harness.cjs'),assert=require('node:assert/strict'),fs=require('node:fs');
const state=a=>JSON.parse(a.run('JSON.stringify(extras.reading)'));
let count=0;
async function test(name,fn){const a=boot();try{await fn(a);assert.deepEqual(a.errors,[]);console.log('PASS '+name);count++;}finally{a.dom.window.close();}}
function click(a,sel){const el=a.w.document.querySelector(sel);assert.ok(el,sel);el.click();}
function start(a,{type='zh-meaning',questions=5,order=false,writing=true,unknown=false}={}){a.$(unknown?'readingUnknownQuiz':'readingResumePractice').click();a.$('readingSetupType').value=type;a.$('readingSetupCount').value=String(questions);a.$('readingSetupOrder').checked=order;if(a.$('readingSetupWriting'))a.$('readingSetupWriting').checked=writing;a.$('readingQuizStart').click();}
function recognition(a,correct=true){const p=state(a).practice,q=p.questions[p.q];assert.ok(!['order','writing'].includes(q.kind));click(a,`[data-reading-answer="${q.options.findIndex(o=>correct?o===q.word:o!==q.word)}"]`);}
function drag(a,dx,dy=0,target='readingPracticeBody',cancel=false){const el=a.$(target);for(const [type,x,y] of [['pointerdown',170,160],['pointermove',170+dx,160+dy],[cancel?'pointercancel':'pointerup',170+dx,160+dy]]){const e=new a.w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});el.dispatchEvent(e);}const now=a.w.Date.now();a.w.Date.now=()=>now+500;}
const settle=()=>new Promise(r=>setTimeout(r,0));
const characters=JSON.parse(fs.readFileSync('vendor/characters.json','utf8'));
function useCharacterData(a){a.w.fetch=async()=>({ok:true,json:async()=>characters});}
function draw(a,strokes){
  const pad=a.$('readingQuizTrace').querySelector('svg');
  pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
  for(const stroke of strokes)stroke.forEach(([x,y],i)=>{
    const event=new a.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
    Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
    pad.dispatchEvent(event);
  });
}
function drawCurrent(a,correct=true){
  const p=state(a).practice;
  const medians=characters[p.questions[p.q].character].medians;
  draw(a,correct?medians.slice().reverse().map(stroke=>stroke.slice().reverse().map(([x,y])=>[22+x/6,29+(900-y)/6])):[[[14,16],[15,16]]]);
}
function checkInk(a){click(a,'[data-ink-check]');return settle();}
function custom(a){a.run(`extras.reading.source='custom';extras.reading.custom='我 爱 你 他 是 好 人。今天 我们 去 学校 学习 中文。明天 一起 回家 吃 米饭 鸡蛋。';extras.reading.positions.custom=2;extras.reading.read=ReadingStudio.sentences().map(s=>s.id);extras.reading.quizCovered={};ReadingStudio.render()`);}
(async()=>{
await test('Restart is reachable during a Reader quiz and cancellation preserves every answer',a=>{start(a);recognition(a,false);const before=state(a).practice;assert.ok(a.$('readingQuizRestart'));a.w.confirm=()=>false;a.$('readingQuizRestart').click();assert.deepEqual(state(a).practice,before);a.$('readingQuizLeave').click();assert.equal(a.$('readingPracticeDialog').open,false);a.$('readingResumePractice').click();assert.deepEqual(state(a).practice,before);a.w.confirm=()=>true;a.$('readingQuizRestart').click();assert.equal(state(a).practice.q,0);assert.equal(state(a).practice.total,0);assert.equal(state(a).practice.score,0);assert.deepEqual(state(a).practice.questions.map(q=>q.options),before.questions.map(q=>q.options));assert.ok(state(a).practice.questions.every(q=>!q.result));assert.equal(a.run('extras.quizHistory[0].status'),'stopped');});
await test('Reader swipe requires an answer; back preserves wrong result, options, score and misses',a=>{start(a);drag(a,-90);assert.equal(state(a).practice.q,0);recognition(a,false);const q=state(a).practice.questions[0],misses=state(a).wordReview;drag(a,-90);assert.equal(state(a).practice.q,1);drag(a,90);let p=state(a).practice;assert.equal(p.q,0);assert.equal(p.answered,true);assert.equal(p.questions[0].result.correct,false);assert.deepEqual(p.questions[0].options,q.options);assert.ok(a.w.document.querySelector('[data-reading-answer].wrong'));recognition(a);assert.equal(state(a).practice.total,1);assert.deepEqual(state(a).wordReview,misses);drag(a,-90);assert.equal(state(a).practice.q,1);assert.equal(state(a).practice.answered,false);});
await test('Cancelled, short and vertical quiz gestures never navigate or answer',a=>{start(a);recognition(a);const before=state(a).practice;drag(a,-15);drag(a,-90,0,'readingPracticeBody',true);drag(a,-20,90);assert.deepEqual(state(a).practice,before);});
await test('Answer snapshots survive reload, back navigation and backup sanitization',a=>{start(a);recognition(a,false);a.$('readingQuestionNext').click();recognition(a);a.$('readingQuestionPrev').click();const expected=state(a).practice;a.run('extras.reading.practice.answered=false;saveExtras()');const b=boot(a.snapshot());try{b.$('readingResumePractice').click();const p=state(b).practice;assert.equal(p.q,0);assert.equal(p.total,2);assert.equal(p.score,1);assert.deepEqual(p.questions[0].result,expected.questions[0].result);assert.equal(b.$('readingQuestionNext').disabled,false);assert.ok(b.w.document.querySelector('.reading-quiz-options .wrong'));}finally{b.dom.window.close();}});
await test('Don’t know records one immutable miss and advances immediately',a=>{start(a);const q=state(a).practice.questions[0];a.$('readingDontKnow').click();let p=state(a).practice;assert.equal(p.q,1);assert.equal(p.total,1);assert.equal(p.score,0);assert.equal(p.questions[0].result.skipped,true);assert.equal(state(a).wordReview[q.target].misses,1);a.$('readingQuestionPrev').click();assert.equal(a.$('readingDontKnow').hidden,true);recognition(a);assert.equal(state(a).practice.total,1);});
await test('Unknown Quiz excludes Known senses, includes New/Learning and leaves checkpoint state unchanged',a=>{custom(a);a.run(`setStatus('我','known');setStatus('鸡蛋','known');setStatus('学习','learning')`);const before=state(a);start(a,{unknown:true,questions:30});let p=state(a).practice;assert.equal(p.scope,'unknown');assert.ok(!p.words.includes('我'));assert.ok(!p.words.includes('鸡蛋'));assert.ok(p.words.includes('学习'));while(state(a).practice.phase==='quiz')a.$('readingDontKnow').click();const after=state(a);for(const k of ['quizCadence','quizCovered','quizSeen','read','positions'])assert.deepEqual(after[k],before[k],k);});
await test('Unknown Quiz protects an unfinished checkpoint and handles an empty unknown pool',a=>{start(a);recognition(a);const before=state(a).practice;a.$('readingQuizLeave').click();a.$('readingUnknownQuiz').click();assert.ok(a.$('readingQuizResume'));assert.deepEqual(state(a).practice,before);a.$('readingQuizLater').click();a.run(`extras.reading.practice=null;extras.reading.source='custom';extras.reading.custom='我。';extras.reading.positions.custom=0;setStatus('我','known');ReadingStudio.render()`);a.$('readingUnknownQuiz').click();assert.equal(a.$('readingQuizStart').disabled,true);});
await test('Priority puts New/Learning ahead of Known, and recent unfamiliar words ahead of older unfamiliar words',a=>{custom(a);a.run(`setStatus('我','known');setStatus('鸡蛋','known')`);const pool=a.run(`ReadingStudio.prioritizeWords(['我','鸡蛋','爱','米饭'],ReadingStudio.sentences().map(s=>s.id))`);assert.deepEqual(Array.from(pool.slice(0,2)),['米饭','爱']);assert.ok(pool.indexOf('我')>=2);});
await test('Mixed distributes multiple sentence builds and tracing through the quiz rather than only the end',a=>{custom(a);start(a,{type:'mixed',questions:20,order:true});const qs=state(a).practice.questions;assert.equal(qs.length,20);assert.ok(qs.filter(q=>q.kind==='order').length>=3);assert.ok(qs.filter(q=>q.kind==='writing').length>=3);assert.ok(qs.slice(0,6).some(q=>q.kind==='order'));assert.equal(new Set(qs.slice(0,6).map(q=>q.kind)).size,6);assert.ok(new Set(qs.filter(q=>q.kind==='order').map(q=>q.sentenceId)).size>1);});
await test('Unknown Quiz opens a blank pad and accepts reversed stroke order and direction',async a=>{
  custom(a);useCharacterData(a);start(a,{type:'writing',unknown:true});
  const p=state(a).practice,q=p.questions[0],pad=a.$('readingQuizTrace');
  assert.equal(q.kind,'writing');assert.equal(p.scope,'unknown');
  assert.equal(pad.querySelectorAll('path').length,0);
  assert.ok(pad.querySelector('[data-ink-check]').disabled);
  assert.ok(!a.$('readingPracticeBody').textContent.includes(q.character));
  drawCurrent(a);await checkInk(a);
  assert.equal(state(a).practice.score,1);
  assert.equal(a.run(`extras.writing[${JSON.stringify(q.character)}].count`),1);
  a.$('readingQuestionNext').click();a.$('readingQuestionPrev').click();
  assert.equal(a.$('readingQuizTrace'),null);assert.equal(state(a).practice.total,1);
});
await test('Shape checking rejects a tiny mark, preserves Known and counts one attempt',async a=>{
  useCharacterData(a);start(a,{type:'writing'});
  const q=state(a).practice.questions[0],key=JSON.stringify(q.target);
  a.run(`resolveEntry(${key})?setStatus(${key},'known'):extras.reading.labels[${key}]='known'`);
  drawCurrent(a,false);await checkInk(a);
  assert.equal(state(a).practice.questions[0].result.correct,false);
  assert.equal(a.run(`resolveEntry(${key})?statusOf(${key}):extras.reading.labels[${key}]`),'known');
  assert.equal(a.run(`extras.writing[${JSON.stringify(q.character)}].count`),1);
});
await test('Leaving a quiz invalidates pending handwriting results',async a=>{
  let resolve;
  a.w.fetch=()=>new Promise(done=>resolve=done);
  start(a,{type:'writing'});drawCurrent(a);click(a,'[data-ink-check]');
  a.$('readingQuizLeave').click();a.$('readingResumePractice').click();
  resolve({ok:true,json:async()=>characters});await settle();
  assert.equal(state(a).practice.total,0);
  drawCurrent(a);await checkInk(a);
  assert.equal(state(a).practice.score,1);
});
await test('Writing load failures preserve the ink and leave Check and Don’t know available',async a=>{
  a.w.fetch=async()=>{throw Error('offline');};
  start(a,{type:'writing'});drawCurrent(a);await checkInk(a);
  assert.match(a.$('readingQuizTrace').querySelector('[role=status]').textContent,/unavailable/i);
  assert.ok(a.$('readingQuizTrace').querySelector('path'));assert.equal(state(a).practice.total,0);
  assert.equal(a.$('readingQuizTrace').querySelector('[data-ink-check]').disabled,false);
  a.$('readingDontKnow').click();assert.equal(state(a).practice.total,1);
});
await test('Tracing snapshots reload without inventing partial completion',a=>{
  start(a,{type:'writing'});drawCurrent(a);
  const before=state(a).practice,b=boot(a.snapshot());
  try{
    b.$('readingResumePractice').click();
    assert.equal(state(b).practice.questions[0].character,before.questions[0].character);
    assert.equal(state(b).practice.total,0);assert.equal(state(b).practice.answered,false);
    assert.equal(b.$('readingQuizTrace').querySelectorAll('path').length,0);
  }finally{b.dom.window.close();}
});
await test('Mixed includes freehand writing in the manual Unknown Quiz',a=>{
  custom(a);start(a,{type:'mixed',questions:5,unknown:true});
  const kinds=state(a).practice.questions.map(q=>q.kind);
  assert.ok(kinds.includes('writing'));assert.ok(!kinds.includes('order'));
});
await test('A different character with the same number of strokes does not pass',a=>{
  const different=characters['十'].medians.map(stroke=>stroke.map(([x,y])=>[x/5,(900-y)/5]));
  assert.equal(a.run(`QuizHandwriting.matches(${JSON.stringify(different)},${JSON.stringify(characters['二'].medians)})`),false);
});
await test('Reader history saves once, round-trips in backups and reviews only misses without checkpoint changes',a=>{start(a);for(let i=0;i<5;i++){recognition(a,i!==1);a.$('readingQuestionNext').click();}assert.equal(a.run('extras.quizHistory.length'),1);a.$('readingPracticeContinue').click();a.run("switchTab('history')");assert.equal(a.$('quizHistoryDetail').hidden,true);click(a,'[data-history-open]');const covered=state(a).quizCovered;click(a,'[data-history-review]');assert.equal(state(a).practice.questions.length,1);assert.equal(state(a).practice.scope,'mistakes');recognition(a);a.$('readingQuestionNext').click();assert.deepEqual(state(a).quizCovered,covered);assert.equal(a.run('extras.quizHistory.length'),2);assert.equal(a.run('sanitizeExtras(getBackup().studio).quizHistory.length'),2);a.run('saveExtras()');const b=boot(a.snapshot());try{assert.equal(b.run('extras.quizHistory.length'),2);}finally{b.dom.window.close();}});
await test('History review cannot overwrite an unfinished Reader quiz',a=>{start(a);for(let i=0;i<5;i++)a.$('readingDontKnow').click();a.$('readingPracticeContinue').click();start(a);const before=state(a).practice;a.$('readingQuizLeave').click();a.run("switchTab('history')");if(a.$('quizHistoryDetail').hidden)click(a,'[data-history-open]');click(a,'[data-history-review]');assert.deepEqual(state(a).practice,before);assert.equal(a.$('readingPracticeDialog').open,true);});
await test('Older backups preserve new history, and failed imports roll it back with the rest of state',a=>{start(a);for(let i=0;i<5;i++)a.$('readingDontKnow').click();const backup=JSON.parse(a.run('JSON.stringify(getBackup())'));delete backup.studio.quizHistory;a.run(`importBackup(${JSON.stringify(JSON.stringify(backup))})`);assert.equal(a.run('extras.quizHistory.length'),1);const before=a.snapshot();const set=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=function(k,v){if(k.includes('Statuses'))throw Error('synthetic quota');return set.call(this,k,v)};try{a.run(`importBackup(${JSON.stringify(JSON.stringify(backup))})`);}finally{a.w.Storage.prototype.setItem=set;}assert.deepEqual(a.snapshot(),before);assert.equal(a.run('extras.quizHistory.length'),1);});
await test('Legacy reviewed prefix stays locked, preserves aggregate score, and never fabricates individual correctness',a=>{const raw={source:'2',practice:{mode:'direct',source:'2',words:['我','你'],phase:'quiz',q:1,score:1,total:1,answered:false,questions:['我','你'].map(word=>({kind:'meaning',target:word,word,prompt:word,options:['我','你']}))}};const migrated=a.run(`sanitizeReading(${JSON.stringify(raw)})`);assert.equal(migrated.practice.score,1);assert.equal(migrated.practice.questions[0].result.correct,null);assert.equal(migrated.practice.questions[1].result,null);assert.equal(JSON.stringify(a.run(`sanitizeReading(${JSON.stringify(migrated)})`)),JSON.stringify(migrated));});
await test('Standalone quiz swipes retain exact options/direction, block unanswered next, and never rescore a past answer',a=>{a.run(`switchTab('quiz');startQuiz([resolveEntry('我'),resolveEntry('你'),resolveEntry('爱')])`);const first=a.$('quizPrompt').textContent,options=a.$('quizOptions').innerHTML;drag(a,-90,0,'quizPracticePanel');assert.equal(a.run('quiz.index'),0);const correct=a.run('quizCorrectFor(quiz.current,quiz.currentDir)');const wrong=[...a.$('quizOptions').children].find(b=>b.dataset.answer!==correct);wrong.click();drag(a,-90,0,'quizPracticePanel');assert.equal(a.run('quiz.position'),1);drag(a,90,0,'quizPracticePanel');assert.equal(a.$('quizPrompt').textContent,first);assert.equal(a.run('quiz.total'),1);assert.equal(a.run('quiz.locked'),true);assert.ok(a.$('quizOptions').querySelector('.wrong'));a.$('quizOptions').firstChild.click();assert.equal(a.run('quiz.total'),1);assert.ok(options.includes('data-answer'));});
await test('Standalone Don’t know completes history and long quizzes retain every question on reload',a=>{a.run(`switchTab('quiz');startQuiz(VOCAB.slice(0,40))`);for(let i=0;i<40;i++)a.$('quizDontKnow').click();assert.equal(a.run('extras.quizHistory.length'),1);assert.equal(a.run('extras.quizHistory[0].practice.total'),40);assert.equal(a.run('sanitizeExtras(extras).quizHistory[0].practice.questions.length'),40);assert.equal(a.run('extras.quizHistory[0].practice.questions.filter(q=>q.result.skipped).length'),40);});
await test('Unknown Quiz filters the two 长 pronunciations independently',a=>{a.run(`extras.reading.source='3';extras.reading.read=['cháng','zhǎng'].map(py=>READING_SENTENCES.find(s=>s.level===3&&ReadingStudio.segments(s.zh,s.py).some(t=>t.text==='长'&&t.py===py)).id);setStatus('长::cháng','known');setStatus('长::zhǎng','new');ReadingStudio.render()`);start(a,{unknown:true,questions:30});assert.ok(!state(a).practice.words.includes('长::cháng'));assert.ok(state(a).practice.words.includes('长::zhǎng'));assert.ok(!state(a).practice.questions.some(q=>q.target==='长::cháng'));});
await test('Failed result saves keep in-memory answers and history available for backup',a=>{start(a);const set=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=function(k,v){if(k.includes('Studio'))throw Error('synthetic quota');return set.call(this,k,v)};try{for(let i=0;i<5;i++)a.$('readingDontKnow').click();assert.equal(state(a).practice.total,5);assert.equal(a.run('getBackup().studio.quizHistory[0].practice.questions.filter(q=>q.result.skipped).length'),5);assert.equal(a.$('readingQuizSaveStatus').hidden,false);assert.match(a.$('readingQuizSaveStatus').textContent,/Not saved/);}finally{a.w.Storage.prototype.setItem=set;}});
await test('History escapes definition text and preserves trace results in a lossless backup',async a=>{useCharacterData(a);start(a,{type:'writing'});const q=state(a).practice.questions[0];drawCurrent(a,false);await checkInk(a);a.$('readingQuizRestart').click();a.run(`extras.quizHistory[0].practice.questions[0].result.feedback='<img src=x onerror=alert(1)>';renderQuizHistory()`);click(a,'[data-history-open]');assert.equal(a.$('quizHistoryDetail').querySelector('img'),null);assert.ok(a.$('quizHistoryDetail').textContent.includes('<img'));const saved=a.run('sanitizeExtras(getBackup().studio).quizHistory[0].practice');assert.equal(saved.questions[0].character,q.character);assert.equal(saved.questions[0].result.correct,false);assert.equal(saved.questions[0].result.feedback,'<img src=x onerror=alert(1)>');});
await test('Reset and import clear stale standalone navigation controls and history is study data',a=>{a.run(`startQuiz([resolveEntry('我'),resolveEntry('你')])`);a.$('quizDontKnow').click();assert.equal(a.$('quizPrevBtn').disabled,false);a.run('clearTransientStudy()');assert.equal(a.$('quizPrevBtn').disabled,true);assert.equal(a.$('quizDontKnow').hidden,true);assert.equal(a.$('quizHistoryDetail').hidden,true);a.run('resetStudyProgress()');assert.equal(a.run('extras.quizHistory.length'),0);});
await test('Five-question Mixed keeps both sentence building and tracing when eligible',a=>{custom(a);start(a,{type:'mixed',questions:5,order:true});const qs=state(a).practice.questions;assert.equal(qs.length,5);assert.ok(qs.some(q=>q.kind==='order'));assert.ok(qs.some(q=>q.kind==='writing'));});
await test('Confirmed replacement from Unknown Quiz retains the requested manual scope',a=>{start(a);recognition(a);a.$('readingQuizLeave').click();a.$('readingUnknownQuiz').click();a.$('readingQuizRestart').click();assert.match(a.$('readingPracticeBody').textContent,/Unknown Quiz/);a.$('readingSetupType').value='zh-meaning';a.$('readingQuizStart').click();assert.equal(state(a).practice.scope,'unknown');});
await test('A delayed close event cannot cancel a just-reopened tracing quiz',async a=>{
  useCharacterData(a);start(a,{type:'writing'});a.$('readingQuizLeave').click();a.$('readingResumePractice').click();
  a.$('readingPracticeDialog').dispatchEvent(new a.w.Event('close'));
  drawCurrent(a);await checkInk(a);assert.equal(state(a).practice.total,1);assert.equal(state(a).practice.score,1);
});
console.log(count+' quiz enhancement checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
