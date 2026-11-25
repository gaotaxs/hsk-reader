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
const baseCharacters=JSON.parse(fs.readFileSync('vendor/characters.json','utf8'));
const supplementalCharacters=JSON.parse(fs.readFileSync('vendor/reader-character-medians.json','utf8'));
const characters={...baseCharacters,...supplementalCharacters};
function useCharacterData(a){a.w.fetch=async url=>({ok:true,json:async()=>url.endsWith('reader-character-medians.json')?supplementalCharacters:baseCharacters});}
function draw(a,strokes,index=0){
  const pad=a.$('readingQuizTrace').querySelectorAll('svg')[index];
  pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
  for(const stroke of strokes)stroke.forEach(([x,y],i)=>{
    const event=new a.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
    Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
    pad.dispatchEvent(event);
  });
}
function handwriting(character){
  return characters[character].medians.slice().reverse().map(stroke =>
    stroke.slice().reverse().map(([x,y],i)=>[22+x/6+Math.sin(i)*2,29+(900-y)/6+Math.cos(i)*2]));
}
function drawCurrent(a,correct=true){
  const p=state(a).practice;
  Array.from(p.questions[p.q].word).forEach((character,i)=>
    draw(a,correct?handwriting(character):[[[14,16],[15,16]]],i));
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
  assert.ok(!a.$('readingPracticeBody').textContent.includes(q.word));
  drawCurrent(a);await checkInk(a);
  assert.equal(state(a).practice.score,1);
  assert.equal(a.run(`extras.writing[${JSON.stringify(q.word[0])}].count`),Array.from(q.word).filter(c=>c===q.word[0]).length);
  const ink=pad.querySelectorAll('path').length;
  assert.ok(ink>0);
  assert.equal(a.$('readingQuizTrace').querySelectorAll('path').length,ink);
  a.$('readingQuestionNext').click();a.$('readingQuestionPrev').click();
  assert.equal(a.$('readingQuizTrace').querySelectorAll('path').length,ink);
  assert.equal(state(a).practice.total,1);
});
await test('Shape checking rejects a tiny mark, preserves Known and counts one attempt',async a=>{
  useCharacterData(a);start(a,{type:'writing'});
  const q=state(a).practice.questions[0],key=JSON.stringify(q.target);
  a.run(`resolveEntry(${key})?setStatus(${key},'known'):extras.reading.labels[${key}]='known'`);
  drawCurrent(a,false);await checkInk(a);
  assert.equal(state(a).practice.questions[0].result.correct,false);
  assert.equal(a.run(`resolveEntry(${key})?statusOf(${key}):extras.reading.labels[${key}]`),'known');
  assert.equal(a.run(`extras.writing[${JSON.stringify(q.word[0])}].count`),Array.from(q.word).filter(c=>c===q.word[0]).length);
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
    assert.equal(state(b).practice.questions[0].word,before.questions[0].word);
    assert.equal(state(b).practice.total,0);assert.equal(state(b).practice.answered,false);
    assert.equal(b.$('readingQuizTrace').querySelectorAll('path').length,0);
  }finally{b.dom.window.close();}
});
await test('Mixed includes freehand writing in the manual Unknown Quiz',a=>{
  custom(a);start(a,{type:'mixed',questions:5,unknown:true});
  const kinds=state(a).practice.questions.map(q=>q.kind);
  assert.ok(kinds.includes('writing'));assert.ok(!kinds.includes('order'));
});
await test('随便 requires both characters in order and saves both drawings across reload',async a=>{
  useCharacterData(a);
  a.run(`extras.reading.source='custom';extras.reading.custom='随便。';ReadingStudio.render()`);
  start(a,{type:'writing',unknown:true});
  assert.equal(state(a).practice.questions[0].word,'随便');
  assert.equal(a.$('readingQuizTrace').querySelectorAll('svg').length,2);
  draw(a,handwriting('随'),0);
  assert.ok(a.$('readingQuizTrace').querySelector('[data-ink-check]').disabled);
  assert.ok(a.$('readingQuestionNext').disabled);
  draw(a,handwriting('便'),1);
  await checkInk(a);
  const result=state(a).practice.questions[0].result;
  assert.equal(result.correct,true);
  assert.equal(result.ink.length,2);
  assert.equal(a.run("traceProgress('随便')"),1);
  assert.equal(a.run("traceProgress('随')"),0);
  assert.equal(a.$('readingQuizTrace').querySelectorAll('svg path').length,characters['随'].medians.length+characters['便'].medians.length);
  const b=boot(a.snapshot());
  try{
    b.$('readingResumePractice').click();
    assert.deepEqual(state(b).practice.questions[0].result,result);
    assert.deepEqual([...b.$('readingQuizTrace').querySelectorAll('path')].map(path=>path.getAttribute('d')),
      [...a.$('readingQuizTrace').querySelectorAll('path')].map(path=>path.getAttribute('d')));
    b.$('readingQuizRestart').click();
    assert.equal(b.$('readingQuizTrace').querySelectorAll('path').length,0);
  }finally{b.dom.window.close();}
});
await test('An older unanswered 随便 question upgrades to two pads without losing its quiz position',a=>{
  a.run(`extras.reading.source='custom';extras.reading.custom='随便。';ReadingStudio.render()`);
  start(a,{type:'writing',unknown:true});
  a.run(`extras.reading.practice.questions[0].character='便';saveExtras()`);
  const b=boot(a.snapshot());
  try{
    b.$('readingResumePractice').click();
    assert.equal(state(b).practice.q,0);
    assert.equal(state(b).practice.total,0);
    assert.equal(b.$('readingQuizTrace').querySelectorAll('svg').length,2);
  }finally{b.dom.window.close();}
});
await test('One good character and one scribble fail the entire writing question',async a=>{
  useCharacterData(a);
  a.run(`extras.reading.source='custom';extras.reading.custom='随便。';ReadingStudio.render()`);
  start(a,{type:'writing',unknown:true});
  draw(a,handwriting('随'));
  draw(a,[[[24,30],[210,50],[25,115],[205,135],[29,200]]],1);
  await checkInk(a);
  const p=state(a).practice;
  assert.equal(p.questions[0].result.correct,false);
  assert.equal(p.score,0);
  assert.equal(p.total,1);
  assert.match(a.w.document.querySelector('.reading-feedback').textContent,/Incorrect · 随便/);
  assert.equal(a.run("traceProgress('随便')"),0);
  assert.equal(a.$('readingQuizTrace').querySelectorAll('svg')[1].querySelectorAll('path').length,1);
});
await test('Tracing ranks natural 小, 让 and 七 above the bundled alternatives',a=>{
  // Pen paths reconstructed from the reported Tracing screenshots.
  const examples={
    小: [
      [[116,40],[118,53],[118,67],[119,85],[119,105],[118,123],[115,154],[110,175],[102,175],[94,171],[83,162],[72,150]],
      [[75,91],[65,99],[58,106],[53,118]],
      [[157,84],[171,95],[184,116],[189,125]]
    ],
    让: [
      [[34,48],[41,47],[45,53],[51,73],[53,74]],
      [[26,103],[35,105],[50,103],[63,100],[62,115],[51,148],[49,163],[49,191],[51,198],[54,202],[57,201],[68,184],[73,176]],
      [[138,53],[146,64],[146,89],[145,124],[145,157],[152,164]],
      [[148,89],[163,88],[178,88],[186,89],[195,94],[195,96],[189,99]],
      [[102,175],[149,175],[183,173],[194,173],[201,175],[208,182]]
    ],
    七: [
      [[34,113],[58,107],[85,99],[112,90],[143,83],[161,80],[171,80],[175,79],[175,76]],
      [[80,44],[73,57],[62,78],[58,92],[56,117],[56,143],[59,157],[66,167],[76,175],[88,178],[101,179],[128,179],[166,176],[172,168],[165,156],[160,146],[155,134],[155,121]]
    ]
  };
  const recognize=(ink,word)=>a.run(`QuizHandwriting.recognizes(${JSON.stringify(ink)},${JSON.stringify(word)},fixtureCharacters)`);
  a.w.fixtureCharacters=characters;
  for(const [word,ink] of Object.entries(examples))assert.equal(recognize(ink,word),true,word);
  for(const [drawn,target] of [['十','七'],['上','让'],['水','小'],['少','小'],['根','很'],['日','目'],['已','己']]){
    assert.equal(recognize(handwriting(drawn),target),false,drawn+' vs '+target);
  }
  assert.equal(recognize([[[34,33],[202,209]],[[32,210],[210,32]]],'七'),false);
});
await test('Realistic 很 with joined strokes passes while lookalike characters are rejected',a=>{
  // Approximate the freehand example from the Tracing feedback screenshot.
  const ink=[
    [[495,875],[465,887],[415,918],[379,943],[326,973],[262,1019]],
    [[406,944],[416,973],[395,1009],[367,1052],[328,1104],[288,1160]],
    [[384,1091],[390,1104],[394,1156],[410,1275],[419,1318],[426,1334]],
    [[580,865],[580,875],[612,871],[690,853],[725,849],[741,849],[741,909],[725,971],[716,1009],[700,1053],[681,1062]],
    [[583,967],[655,973],[728,973],[737,981]],
    [[541,1078],[562,1098],[594,1098],[626,1091],[662,1065]],
    [[541,928],[525,960],[518,1094],[518,1315],[524,1352],[535,1379],[552,1376],[560,1370]],
    [[685,1121],[657,1160],[625,1190],[592,1210],[564,1223],[537,1223],[563,1228],[592,1245],[670,1296],[755,1333],[838,1359]]
  ].map(s=>s.map(([x,y])=>[Math.round((x-208)*.303),Math.round((y-703)*.303)]));
  const matches=(ink,word)=>a.run(`QuizHandwriting.matches(${JSON.stringify(ink)},${JSON.stringify(characters[word].medians)})`);
  assert.equal(matches(ink,'很'),true);
  a.w.fixtureCharacters=baseCharacters;
  assert.equal(a.run(`QuizHandwriting.recognizes(${JSON.stringify(ink)},'很',fixtureCharacters)`),true);
  assert.equal(matches(handwriting('日'),'目'),false);
  assert.equal(matches(handwriting('根'),'很'),false);
});
await test('Complex Tracing accepts two pen lifts or joins and distinguishes lookalikes',a=>{
  a.w.fixtureCharacters=baseCharacters;
  const recognize=(ink,word)=>a.run(`QuizHandwriting.recognizes(${JSON.stringify(ink)},${JSON.stringify(word)},fixtureCharacters)`);
  // The median paths are perturbed and reversed by the handwriting fixture.
  for(const word of ['便','情','谢','照','舞']){
    const ink=handwriting(word);
    const split=ink.map((stroke,i)=>({i,length:stroke.length}))
      .filter(stroke=>stroke.length>=4).sort((a,b)=>b.length-a.length).slice(0,2).map(stroke=>stroke.i);
    const lifted=ink.flatMap((stroke,i)=>{
      const midpoint=Math.floor(stroke.length/2);
      return split.includes(i)?[stroke.slice(0,midpoint+1),stroke.slice(midpoint)]:[stroke];
    });
    assert.equal(lifted.length,ink.length+2);
    assert.equal(recognize(lifted,word),true,word+' with two extra pen lifts');
    assert.equal(recognize(ink.map(stroke=>[...stroke,...stroke.slice().reverse()]),word),false,word+' retraced');
  }
  const separate=baseCharacters['谢'].medians.map(stroke=>stroke.map(([x,y])=>[x/6,(900-y)/6]));
  const joined=separate.flatMap((stroke,i)=>{
    if(i===2||i===7)return [[...stroke,...separate[i+1]]];
    return i===3||i===8?[]:[stroke];
  });
  assert.equal(joined.length,separate.length-2);
  assert.equal(recognize(joined,'谢'),true);
  for(const [drawn,expected] of [['清','情'],['晴','清'],['睛','晴'],['请','情'],['根','很']]){
    assert.equal(recognize(handwriting(drawn),expected),false,drawn+' vs '+expected);
  }
});
await test('Retracing and connecting every stroke into one scribble fail shape checking',a=>{
  const medians=characters['便'].medians, ink=handwriting('便');
  for(const attempt of [ink.map(stroke=>[...stroke,...stroke.slice().reverse()]),[ink.flat()]]){
    assert.equal(a.run(`QuizHandwriting.matches(${JSON.stringify(attempt)},${JSON.stringify(medians)})`),false);
  }
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
await test('History escapes definition text and preserves trace results in a lossless backup',async a=>{useCharacterData(a);start(a,{type:'writing'});const q=state(a).practice.questions[0];drawCurrent(a,false);await checkInk(a);a.$('readingQuizRestart').click();a.run(`extras.quizHistory[0].practice.questions[0].result.feedback='<img src=x onerror=alert(1)>';renderQuizHistory()`);click(a,'[data-history-open]');assert.equal(a.$('quizHistoryDetail').querySelector('img'),null);assert.ok(a.$('quizHistoryDetail').textContent.includes('<img'));const saved=a.run('sanitizeExtras(getBackup().studio).quizHistory[0].practice');assert.equal(saved.questions[0].word,q.word);assert.equal(saved.questions[0].result.correct,false);assert.equal(saved.questions[0].result.feedback,'<img src=x onerror=alert(1)>');});
await test('Reset and import clear stale standalone navigation controls and history is study data',a=>{a.run(`startQuiz([resolveEntry('我'),resolveEntry('你')])`);a.$('quizDontKnow').click();assert.equal(a.$('quizPrevBtn').disabled,false);a.run('clearTransientStudy()');assert.equal(a.$('quizPrevBtn').disabled,true);assert.equal(a.$('quizDontKnow').hidden,true);assert.equal(a.$('quizHistoryDetail').hidden,true);a.run('resetStudyProgress()');assert.equal(a.run('extras.quizHistory.length'),0);});
await test('Five-question Mixed keeps both sentence building and tracing when eligible',a=>{custom(a);start(a,{type:'mixed',questions:5,order:true});const qs=state(a).practice.questions;assert.equal(qs.length,5);assert.ok(qs.some(q=>q.kind==='order'));assert.ok(qs.some(q=>q.kind==='writing'));});
await test('Confirmed replacement from Unknown Quiz retains the requested manual scope',a=>{start(a);recognition(a);a.$('readingQuizLeave').click();a.$('readingUnknownQuiz').click();a.$('readingQuizRestart').click();assert.match(a.$('readingPracticeBody').textContent,/Unknown Quiz/);a.$('readingSetupType').value='zh-meaning';a.$('readingQuizStart').click();assert.equal(state(a).practice.scope,'unknown');});
await test('Tracing grades random single characters, retains ink and leaves existing study records alone',async a=>{
  useCharacterData(a);
  start(a);
  recognition(a);
  a.$('readingQuizLeave').click();
  const before=state(a).practice;
  a.run(`HSK2.forEach(v=>statuses[entryKey(v)]='known'); shuffle=items=>[...items].sort((a,b)=>Number(b.word==='云')-Number(a.word==='云'))`);
  click(a,'[data-tab=tracing]');
  const panel=a.$('tracing'),pinyin=panel.querySelector('.tracing-prompt p').textContent;
  const meaning=panel.querySelector('.tracing-prompt p+p').textContent;
  const entry=a.run(`VOCAB.find(v=>v.word.length===1&&v.pinyin===${JSON.stringify(pinyin)}&&v.english===${JSON.stringify(meaning)})`);
  assert.ok(entry);
  assert.equal(panel.querySelectorAll('svg path').length,0);
  assert.equal(panel.querySelector('[data-ink-check]').disabled,true);
  assert.ok(!panel.textContent.includes(entry.word));
  const drawTrace=strokes=>{
    const pad=panel.querySelector('svg');
    pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
    for(const stroke of strokes)stroke.forEach(([x,y],i)=>{
      const event=new a.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
      Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
      pad.dispatchEvent(event);
    });
  };
  const undo=()=>panel.querySelector('[data-ink-undo]');
  assert.ok(undo().disabled);
  drawTrace([[[70,70],[105,105]]]);
  assert.equal(panel.querySelectorAll('svg path').length,1);
  undo().click();
  assert.equal(panel.querySelectorAll('svg path').length,0);
  assert.ok(undo().disabled);
  drawTrace([[[75,70],[78,75]]]);
  click(a,'#tracing [data-ink-check]');
  await settle();
  assert.match(panel.querySelector('[data-ink-status]').textContent,/Couldn’t read/);
  assert.equal(panel.querySelectorAll('svg path').length,1);
  assert.match(panel.querySelector('.tracing-heading p').textContent,/0 \/ 0/);
  click(a,'#tracing [data-ink-clear]');
  drawTrace(handwriting(entry.word));
  click(a,'[data-tab=reader]');
  click(a,'[data-tab=tracing]');
  assert.ok(panel.querySelector('svg path'));
  click(a,'#tracing [data-ink-check]');
  await settle();
  assert.match(panel.querySelector('.tracing-feedback').textContent,/Correct/);
  assert.equal(panel.querySelector('.tracing-feedback strong').textContent,entry.word);
  assert.match(panel.querySelector('.tracing-heading p').textContent,/1 \/ 1/);
  assert.ok(panel.querySelector('svg path'));
  a.$('tracingNext').click();
  a.$('tracingSkip').click();
  assert.notEqual(panel.querySelector('.tracing-feedback strong').textContent,entry.word);
  assert.match(panel.querySelector('.tracing-feedback').textContent,/Skipped/);
  assert.deepEqual(state(a).practice,before);
});
await test('A delayed close event cannot cancel a just-reopened tracing quiz',async a=>{
  useCharacterData(a);start(a,{type:'writing'});a.$('readingQuizLeave').click();a.$('readingResumePractice').click();
  a.$('readingPracticeDialog').dispatchEvent(new a.w.Event('close'));
  drawCurrent(a);await checkInk(a);assert.equal(state(a).practice.total,1);assert.equal(state(a).practice.score,1);
});
await test('Tracing learns a confirmed shorthand, restores it on reload and can forget it',async a=>{
  const setup=instance=>{
    useCharacterData(instance);
    instance.run(`HSK2.forEach(v=>statuses[entryKey(v)]='known'); shuffle=items=>[...items].sort((a,b)=>Number(b.word==='云')-Number(a.word==='云'))`);
    click(instance,'[data-tab=tracing]');
    assert.equal(instance.$('tracingPrompt').querySelector('p').textContent,'yún');
  };
  const shorthand=[
    [[76,52],[100,49],[151,49]],
    [[48,100],[88,94],[137,86]],
    [[104,92],[83,116],[64,157],[66,161],[95,149],[128,146],[143,155],[148,179],[172,177]]
  ];
  async function check(instance,strokes){
    const pad=instance.$('tracingInput').querySelector('svg');
    pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
    for(const stroke of strokes)stroke.forEach(([x,y],i)=>{
      const event=new instance.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
      Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
      pad.dispatchEvent(event);
    });
    click(instance,'#tracing [data-ink-check]');
    await settle();
    return instance.$('tracingInput').querySelector('.tracing-feedback').firstElementChild.textContent;
  }
  setup(a);
  await check(a,shorthand);
  assert.equal(a.$('tracingInput').querySelector('.tracing-guesses').hidden,false);
  a.$('tracingNone').click();
  a.w.confirm=()=>false;
  a.$('tracingTeachUnclear').click();
  assert.equal(a.run("Boolean(extras.tracingStyles?.['云'])"),false);
  a.w.confirm=()=>true;
  a.$('tracingTeachUnclear').click();
  assert.match(a.$('tracing').querySelector('.tracing-heading p').textContent,/1 \/ 1/);
  assert.equal(a.run("traceProgress('云')"),0);
  const saved=a.run("JSON.stringify(extras.tracingStyles['云'])");
  const b=boot(a.snapshot());
  try{
    setup(b);
    assert.equal(b.run("JSON.stringify(extras.tracingStyles['云'])"),saved);
    const redrawn=shorthand.slice().reverse().map(stroke=>stroke.slice().reverse().map(([x,y],i)=>[x+5+i%3,y+7-i%2]));
    assert.equal(await check(b,redrawn),'Correct');
    b.$('tracingForget').click();
    assert.equal(b.run("Boolean(extras.tracingStyles?.['云'])"),false);
    assert.equal(b.$('tracingForget'),null);
  }finally{b.dom.window.close();}
  a.w.shorthand=shorthand;
  assert.equal(a.run("QuizHandwriting.matchesPersonal(shorthand,'二',extras.tracingStyles)"),false);
  assert.equal(a.run("QuizHandwriting.matchesPersonal([[[30,30],[204,201]]],'云',extras.tracingStyles)"),false);
});
await test('Tracing grades rough 走, narrow 马 and uneven 百 directly when the strokes agree',async a=>{
  useCharacterData(a);
  const samples={
    走:[
      [[66,56],[81,56],[117,50],[130,51]], [[106,20],[108,40],[108,82],[106,96]],
      [[36,104],[70,102],[104,100],[139,100]], [[102,98],[100,123],[100,153],[98,161]],
      [[99,128],[108,124],[143,125],[155,128]], [[76,126],[63,166],[37,201]],
      [[68,155],[82,154],[96,158],[128,173],[168,189],[212,192]]
    ],
    马:[
      [[77,48],[102,42],[137,34],[136,48],[127,80],[125,84]],
      [[108,54],[99,77],[96,104],[103,108],[149,104],[156,108],[161,146],[160,187],[153,204],[131,212],[112,185]],
      [[86,151],[95,148],[135,149]]
    ],
    百:[
      [[71,47],[78,49],[137,50],[154,49],[167,43]], [[121,53],[113,64],[84,90]],
      [[78,97],[74,110],[75,120],[72,168]], [[93,80],[135,80],[141,83],[144,104],[144,170]],
      [[84,129],[98,126],[132,124],[160,121]], [[75,161],[80,165],[135,164]]
    ]
  };
  a.w.inkSamples=samples;
  a.w.structureBundle=baseCharacters;
  for(const character of Object.keys(samples)){
    const input=JSON.stringify(character);
    assert.equal(a.run(`(() => {
      const strokes=inkSamples[${input}];
      return QuizHandwriting.clearStructureMatch(strokes, structureBundle, QuizHandwriting.rankCharacters(strokes, structureBundle));
    })()`),character);
  }
  a.run(`shuffle=items=>[...items].sort((a,b)=>Number(b.word==='走')-Number(a.word==='走'))`);
  click(a,'[data-tab=tracing]');
  function submit(strokes){
    const pad=a.$('tracingInput').querySelector('svg');
    pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
    for(const stroke of strokes)stroke.forEach(([x,y],i)=>{
      const event=new a.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
      Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
      pad.dispatchEvent(event);
    });
    click(a,'#tracing [data-ink-check]');
    return settle();
  }
  await submit(handwriting('足'));
  assert.match(a.$('tracing').querySelector('.tracing-read-as').textContent,/足/);
  assert.match(a.$('tracing').querySelector('.tracing-feedback').textContent,/Incorrect/);
  a.$('tracingRetry').click();
  await submit(samples.走);
  assert.equal(a.$('tracing').querySelector('.tracing-feedback').firstElementChild.textContent,'Correct');
  assert.equal(a.$('tracing').querySelector('.tracing-feedback strong').textContent,'走');
  assert.equal(a.$('tracingInput').querySelectorAll('svg path').length,samples.走.length);
});
await test('Stroke ranking distinguishes distorted characters with 10 or more strokes and rejects scribbles',a=>{
  a.w.structureBundle=baseCharacters;
  const classify=ink=>a.run(`(() => {
    const ink=${JSON.stringify(ink)};
    return QuizHandwriting.clearStructureMatch(ink, structureBundle, QuizHandwriting.rankCharacters(ink, structureBundle));
  })()`);
  for(const character of ['情','请','谢']){
    assert.ok(baseCharacters[character].medians.length>=10);
    const distorted=baseCharacters[character].medians.map((stroke,i)=>stroke.map(([x,y],j)=>[
      120+(x-500)*0.11+Math.sin(i*2)*12+Math.cos(j*1.2)*2,
      120+(400-y)*0.16+Math.cos(i*2)*9+Math.sin(j*1.2)*2
    ])).reverse().map(stroke=>stroke.reverse());
    assert.equal(classify(distorted),character);
  }
  const scribble=Array.from({length:10},(_,i)=>Array.from({length:7},(_,j)=>[
    120+75*Math.sin(i+4*j),120+66*Math.cos(2*i+1.4*j)
  ]));
  assert.equal(classify(scribble),undefined);
});
await test('Tracing Check grades clear reads and asks for help on close calls',async a=>{
  useCharacterData(a);
  a.run(`HSK2.forEach(v=>statuses[entryKey(v)]='known'); shuffle=items=>[...items].sort((a,b)=>Number(b.word==='云')-Number(a.word==='云'))`);
  click(a,'[data-tab=tracing]');
  const pad=a.$('tracingInput').querySelector('svg');
  pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
  function write(word,target=pad){
    for(const stroke of handwriting(word))stroke.forEach(([x,y],i)=>{
      const event=new a.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
      Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
      target.dispatchEvent(event);
    });
  }
  assert.equal(a.$('tracingInput').querySelector('[data-ink-guess]'),null);
  write('小');
  click(a,'#tracing [data-ink-check]');
  await settle();
  assert.match(a.$('tracing').querySelector('.tracing-feedback').textContent,/Incorrect/);
  assert.match(a.$('tracing').querySelector('.tracing-read-as').textContent,/小/);
  a.$('tracingRetry').click();
  const freshPad=a.$('tracingInput').querySelector('svg');
  freshPad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
  write('云',freshPad);
  const rank=a.run('QuizHandwriting.rankCharacters');
  a.run(`QuizHandwriting.rankCharacters = () => [{character:'云',score:0.06},{character:'天',score:0.062}]`);
  const clearStructureMatch=a.run('QuizHandwriting.clearStructureMatch');
  a.run('QuizHandwriting.clearStructureMatch = () => undefined');
  click(a,'#tracing [data-ink-check]');
  await settle();
  const newList=a.$('tracingInput').querySelector('.tracing-guesses');
  assert.equal(newList.hidden,false);
  assert.equal(newList.querySelector('button').textContent,'云');
  assert.match(a.$('tracing').querySelector('.tracing-heading p').textContent,/0 \/ 1/);
  newList.querySelector('button').click();
  assert.match(a.$('tracing').querySelector('.tracing-heading p').textContent,/1 \/ 1/);
  assert.match(a.$('tracing').querySelector('.tracing-feedback').textContent,/Correct with help/);
  assert.equal(a.run("traceProgress('云')"),0);
  a.run('QuizHandwriting').rankCharacters=rank;
  a.run('QuizHandwriting').clearStructureMatch=clearStructureMatch;
});
await test('Tracing is second and mastery requires three independent days across reloads',async a=>{
  const tabs=[...a.w.document.querySelectorAll('.sidebar-nav [data-tab]')].map(tab=>tab.dataset.tab);
  assert.deepEqual(tabs.slice(0,2),['reader','tracing']);
  a.run("setStatus('云','known'); extras.writing['云']={count:50,mistakes:0,last:todayISO()}; saveExtras()");
  let snapshot=a.snapshot();
  for(const [day,count] of [['2026-11-21',1],['2026-11-21',1],['2026-11-23',2],['2026-11-25',3],['2026-11-26',3]]){
    const b=boot(snapshot);
    try{
      useCharacterData(b);
      b.w.Date=class extends b.w.Date {
        constructor(...args){super(...(args.length?args:[day+'T12:00:00']));}
      };
      b.run(`HSK2.forEach(v=>statuses[entryKey(v)]='known'); shuffle=items=>[...items].sort((a,b)=>Number(b.word==='云')-Number(a.word==='云'))`);
      click(b,'[data-tab=tracing]');
      if(b.run("traceProgress('云')")===3)click(b,'.tracing-mode');
      const pad=b.$('tracingInput').querySelector('svg');
      pad.getBoundingClientRect=()=>({left:0,top:0,width:240,height:240});
      for(const stroke of handwriting('云'))stroke.forEach(([x,y],i)=>{
        const event=new b.w.Event(i===0?'pointerdown':i===stroke.length-1?'pointerup':'pointermove',{bubbles:true,cancelable:true});
        Object.assign(event,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
        pad.dispatchEvent(event);
      });
      click(b,'#tracing [data-ink-check]');
      await settle();
      assert.equal(b.$('tracing').querySelector('.tracing-feedback span').textContent,'Correct');
      assert.equal(b.$('tracing').querySelector('[data-trace-progress]').textContent,count===3?'Mastered':`Mastery ${count}/3 days`);
      assert.equal(b.run("statusOf('云')"),'known');
      assert.equal(b.run("traceProgress('云')"),count);
      snapshot=b.snapshot();
      if(count!==3)continue;
      click(b,'[data-tab=vocab]');
      b.$('vocabStatus').value='mastered';
      b.$('vocabStatus').dispatchEvent(new b.w.Event('input',{bubbles:true}));
      assert.equal(b.$('vocabTable').querySelectorAll('tr').length,1);
      assert.match(b.$('vocabTable').textContent,/云.*Mastered/);
      const backup=b.run('getBackup()');
      assert.deepEqual(Array.from(backup.studio.traceSuccessDays.云),['2026-11-21','2026-11-23','2026-11-25']);
      const old=JSON.parse(JSON.stringify(backup));delete old.studio.traceSuccessDays;
      b.run(`importBackup(${JSON.stringify(JSON.stringify(old))})`);
      assert.equal(b.run("traceProgress('云')"),3);
    }finally{b.dom.window.close();}
  }
});
await test('Practice resumes saved Reader quizzes and keeps vocabulary status editable',a=>{
  start(a);
  recognition(a);
  a.$('readingQuizLeave').click();
  const saved=state(a).practice;
  click(a,'[data-tab="practice"]');
  assert.equal(a.$('practicePrimary').textContent,'Resume Reader quiz');
  a.$('practicePrimary').click();
  assert.equal(a.$('readingPracticeDialog').open,true);
  assert.deepEqual(state(a).practice,saved);
  a.$('readingQuizLeave').click();
  click(a,'[data-tab="vocab"]');
  const status=a.$('vocabTable').querySelector('[data-vocab-status]');
  const key=status.dataset.vocabStatus;
  assert.equal(status.closest('tr').querySelectorAll('select').length,1);
  status.value='learning';
  status.dispatchEvent(new a.w.Event('change',{bubbles:true}));
  assert.equal(a.run(`statusOf(${JSON.stringify(key)})`),'learning');
  assert.equal(a.w.document.activeElement.dataset.vocabStatus,key);
});
await test('Tracing locks HSK 3 until all HSK 2 entries are Known, then weights review by progress',a=>{
  const samples=a.run(`(() => {
    const entries=VOCAB.filter(v=>v.word.length===1&&isChineseChar(v.word)&&!v.english.includes(v.word));
    const [plain,due,known,mastered]=entries.filter(v=>v.level===2).slice(0,4);
    const three=entries.find(v=>v.level===3&&!entries.some(other=>other.word===v.word&&other.level===2));
    const last=HSK2.find(v=>v.word.length>1);
    statuses[entryKey(known)]='known';
    extras.traceSuccessDays[due.word]=['2026-01-01','2026-01-02'];
    extras.traceSuccessDays[mastered.word]=['2026-01-01','2026-01-02','2026-01-03'];
    let pool;
    const previous=shuffle;
    shuffle=items=>{if(items[0]?.word&&items.includes(plain))pool=items;return items;};
    switchTab('tracing');
    const [ordinary,waiting,learned,review,locked]=[plain,due,known,mastered,three].map(entry=>pool.filter(item=>item===entry).length);
    HSK2.forEach(v=>statuses[entryKey(v)]='known');
    statuses[entryKey(last)]='learning';
    resetTracingPractice();
    const stillLocked=!pool.includes(three);
    statuses[entryKey(last)]='known';
    openTracingPractice();
    document.getElementById('tracingSkip').click();
    document.getElementById('tracingNext').click();
    const unlocked=pool.includes(three)&&pool.filter(item=>item===three).length>pool.filter(item=>item===plain).length;
    shuffle=previous;
    return {ordinary,waiting,learned,review,locked,stillLocked,unlocked,mastered:mastered.pinyin};
  })()`);
  assert.ok(samples.waiting>samples.ordinary&&samples.ordinary>samples.learned);
  assert.equal(samples.review,0);
  assert.equal(samples.locked,0);
  assert.equal(samples.stillLocked,true);
  assert.equal(samples.unlocked,true);
  assert.equal(a.$('tracing').querySelector('.tracing-practice-options p'),null);
  click(a,'.tracing-mode');
  assert.equal(a.$('tracing').querySelector('[data-trace-progress]').textContent,'Mastered');
  assert.equal(a.$('tracingPrompt').querySelector('p').textContent,samples.mastered);
  click(a,'.tracing-mode');
  assert.notEqual(a.$('tracing').querySelector('[data-trace-progress]').textContent,'Mastered');
});
console.log(count+' quiz enhancement checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
