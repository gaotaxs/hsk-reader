/* Synthetic QA fixture only; never included in the app release manifest. */
function seedHistoryQA(){
 const now=Date.now(),rows=[[16,20,'reader','checkpoint'],[8,10,'reader','unknown'],[9,10,'reader','checkpoint'],[15,15,'standalone','checkpoint'],[12,20,'reader','checkpoint'],[4,10,'reader','unknown'],[17,20,'reader','checkpoint']];
 extras.quizHistory=rows.map(([score,total,source,scope],i)=>{const entries=VOCAB.filter(v=>v.level===3).slice(0,total),questions=entries.map((v,j)=>({kind:i===2?'writing':j%2?'meaning':'zh-meaning',character:Array.from(v.word)[0],target:entryKey(v),word:v.english,pinyin:v.pinyin,meaning:v.english,prompt:v.word,options:[v.english,'Other answer'],result:{correct:j<score,selectedAnswer:j<score?0:1,order:[],feedback:'Answer: '+v.word+' · '+v.english,skipped:false}}));return{id:'history-qa-'+i,at:new Date(now-(i<3?i*3600000:(i<6?24:48)*3600000+i*60000)).toISOString(),source,status:'complete',practice:{id:'history-qa-'+i,source:'3',scope,mode:'direct',phase:'summary',words:entries.map(entryKey),cursor:entries.length,questions,q:total-1,score,total,answered:true,order:[],feedback:''}};}).reverse();
 historySelectedId=null;switchTab('history');
}
window.addEventListener('message',async e=>{
 if(e.origin!==location.origin)return;
 if(e.data.qa==='history-preview'){seedHistoryQA();return;}
 if(e.data.qa!=='history')return;
 const results=[];for(const theme of ['light','dark']){
  document.documentElement.dataset.theme=theme;seedHistoryQA();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const cards=[...document.querySelectorAll('.history-card')],nav=[...document.querySelectorAll('[data-tab]')],first=cards[0],box=first.getBoundingClientRect(),score=first.querySelector('.history-score').getBoundingClientRect();
  const geometry={theme,rows:cards.length,heights:cards.map(c=>c.getBoundingClientRect().height),noPreviewOrReview:!$('quizHistoryList').textContent.includes('Missed')&&!$('quizHistoryList').querySelector('[data-history-review]'),scoreAtTopRight:score.x>box.x+box.width*.65&&score.y-box.y<16,visibleRows:cards.filter(c=>{const b=c.getBoundingClientRect(),main=$('mainContent').getBoundingClientRect();return b.top>=main.top&&b.bottom<=main.bottom;}).length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,navTargets:nav.map(n=>{const b=n.getBoundingClientRect();return {tab:n.dataset.tab,width:b.width,height:b.height};})};
  first.click();await new Promise(r=>requestAnimationFrame(r));const review=$('quizHistoryDetail').querySelector('[data-history-review]'),r=review.getBoundingClientRect();geometry.detailRows=[...$('quizHistoryDetail').querySelectorAll('.history-question')].filter(q=>q.getBoundingClientRect().height>0).length;geometry.reviewWidth=r.width;geometry.detailWidth=$('quizHistoryDetail').getBoundingClientRect().width;geometry.reviewHeight=r.height;$('historyBack').click();geometry.returnedToList=!$('quizHistoryList').hidden;results.push(geometry);
 }
 parent.postMessage({report:JSON.stringify({viewport:[innerWidth,innerHeight],results},null,2)},location.origin);
});
