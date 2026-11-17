/* Runs only in the isolated QA copy made by prepare-browser-audit.py. */
window.addEventListener('message',async e=>{
 if(e.origin!==location.origin||e.data.qa!=='quizzes')return;
 const results=[],pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
 const closePractice=async()=>{const d=$('readingPracticeDialog');if(d.open)await new Promise(resolve=>{d.addEventListener('close',resolve,{once:true});d.close();});};
 try{
  switchTab('reader');
  for(const theme of ['light','dark'])for(const kind of ['zh-meaning','order','writing']){
   document.documentElement.dataset.theme=theme;
   await closePractice();
   extras.reading.practice=null;extras.reading.source='custom';extras.reading.custom='我 爱 你 他 是 好 人。今天 我们 去 学校 学习 中文。';extras.reading.positions.custom=1;extras.reading.read=ReadingStudio.sentences().map(s=>s.id);extras.reading.quizCovered={};
   ReadingStudio.setupQuiz();$('readingSetupType').value=kind==='order'?'zh-meaning':kind;$('readingSetupCount').value='5';$('readingSetupOrder').checked=kind==='order';$('readingQuizStart').click();
   const p=extras.reading.practice;
   if(kind==='order'){p.q=p.questions.findIndex(q=>q.kind==='order');}
   if(kind==='zh-meaning'){const q=p.questions[p.q];q.prompt='Definition prompt: '+('a deliberately long definition with full text available; '.repeat(20));q.options=q.options.map((o,i)=>o+' '+('long definition; '.repeat(i*15+2)));q.word=q.options[0];}
   await closePractice();$('readingResumePractice').click();await pause();
   if(kind==='writing'){const deadline=performance.now()+15000;while(!$('readingQuizTrace').querySelector('svg')&&performance.now()<deadline&&!/unavailable/i.test($('readingTraceStatus').textContent))await new Promise(r=>setTimeout(r,50));}
   const shell=$('readingPracticeBody'),dialog=$('readingPracticeDialog'),next=$('readingQuestionNext'),footer=next.closest('.quiz-answer-row'),buttons=[...shell.querySelectorAll('[data-reading-answer]')];
   const n=rect(next),d=rect(dialog),f=rect(footer),h=rect($('darkToggle'));
   results.push({theme,kind,footerVisible:n.bottom<=Math.min(innerHeight,d.bottom)&&n.y>=d.y,shellDoesNotScroll:shell.scrollHeight<=shell.clientHeight+1,dialogDoesNotScroll:dialog.scrollHeight<=dialog.clientHeight+1,equalOptionHeights:!buttons.length||Math.max(...buttons.map(b=>b.clientHeight))-Math.min(...buttons.map(b=>b.clientHeight))<2,headerVisible:h.right<=innerWidth,writingStatus:kind==='writing'?$('readingTraceStatus').textContent:null,writingSVG:kind==='writing'?!!$('readingQuizTrace').querySelector('svg'):null,body:rect(shell),footer:f});
  }
  await closePractice();extras.reading.practice=null;extras.reading.source='2';extras.reading.custom='';extras.reading.positions['2']=0;ReadingStudio.render();
  parent.postMessage({report:JSON.stringify({viewport:[innerWidth,innerHeight],results},null,2)},location.origin);
 }catch(error){parent.postMessage({report:JSON.stringify({error:error.stack})},location.origin);}
});
