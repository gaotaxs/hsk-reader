/* Sentence reader and integrated reading → cards → exercises workflow. */
const ReadingStudio=(()=>{
  const root=$('readingStudio');
  const orderedCache=new Map();
  let translationOpen=false,selectedWord='',localPracticeOptions=[],quizSetup=null;
  let peek=false,hintContext='',revealedHints=new Set(),practiceReturn=null;
  const nextIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  const data=()=>extras.reading ||= {source:'2',positions:{},hiddenPinyin:{},starWords:[],starSentences:[],labels:{},read:[],mode:'sentence',pinyin:'adaptive',pin:false,every:5,sentenceInterval:20,cadenceUnit:'sentences',quizWordInterval:20,quizCadence:{},quizCount:10,quizType:'mixed',quizCovered:{},order:'balanced',sentenceReview:{},wordReview:{},reviewSession:null,custom:'',practice:null};
  const save=()=>saveExtras();
  const status=(word,pyHint='')=>{const key=definition(word,pyHint)?.key||word;return resolveEntry(key)?statusOf(key):(data().labels[key]||'new');};
  const definition=(word,pyHint='')=>{if(word==='只'&&pyHint==='zhī')return{word,pinyin:'zhī',english:'classifier for animals and some objects',key:'只::zhī'};const v=word==='长'?resolveEntry((pyHint|| (data().source==='3'?'zhǎng':'cháng')).includes('zhǎng')?'长::zhǎng':'长::cháng'):resolveEntry(word),d=READING_DICTIONARY[word];return v?{word,pinyin:cardSyllables(v).join(' '),english:v.english,key:entryKey(v)}:d?{word,pinyin:d[0],english:d[1],key:word}:null;};
  function segments(text,py=''){
    const syllables=py?py.split(/\s+/):[],result=[];let offset=0;
    for(let i=0;i<text.length;){
      const ch=text[i];if(!isChineseChar(ch)){result.push({text:ch});i++;continue;}
      let word='';for(let n=Math.min(8,text.length-i);n>0;n--){const candidate=text.slice(i,i+n);if(definition(candidate)){word=candidate;break;}}
      word ||= ch;const v=definition(word),count=Array.from(word).filter(isChineseChar).length;
      const p=syllables.length?syllables.slice(offset,offset+count).join(' '):(v?.pinyin||'');offset+=count;
      result.push({text:word,v,py:p});i+=word.length;
    }return result;
  }
  function customSentences(){return (data().custom.match(/[^。！？!?\n]+[。！？!?]?/g)||[]).map((zh,i)=>({id:'custom-'+hash(zh),zh:zh.trim(),py:'',en:'',level:0})).filter(x=>x.zh);}
  function hash(s){let x=0;for(const c of s)x=(x*31+c.charCodeAt(0))|0;return String(x>>>0);}
  function orderedLevel(level,order=data().order){
    const key=level+':'+order;if(orderedCache.has(key))return orderedCache.get(key);
    const all=READING_SENTENCES.filter(s=>String(s.level)===String(level));if(order==='original'){orderedCache.set(key,all);return all;}
    const introductory=all.filter(s=>s.id.startsWith('original-'));
    function interleave(rows){const groups=new Map();for(const row of rows){const k=row.topic||'Other';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}const output=[];while([...groups.values()].some(a=>a.length))for(const group of groups.values())if(group.length)output.push(group.shift());return output;}
    const patterns=interleave(all.filter(s=>s.id.startsWith('pattern-'))),contexts=interleave(all.filter(s=>s.id.startsWith('context-'))),result=[...introductory];
    while(contexts.length||patterns.length){if(contexts.length)result.push(contexts.shift());if(patterns.length)result.push(patterns.shift());}
    orderedCache.set(key,result);return result;
  }
  function setOrder(next){const r=data(),ids={};for(const l of ['2','3'])ids[l]=orderedLevel(l,r.order||'original')[r.positions[l]||0]?.id;r.order=next;for(const l of ['2','3'])r.positions[l]=Math.max(0,orderedLevel(l,next).findIndex(s=>s.id===ids[l]));save();render();}
  function sentences(){const r=data();r.source=String(r.source);if(!['2','3','custom','starred'].includes(r.source))r.source='2';if(r.reviewSession){const byId=new Map([...READING_SENTENCES,...customSentences()].map(s=>[s.id,s]));const list=r.reviewSession.ids.map(id=>byId.get(id)).filter(Boolean);if(list.length)return list;r.reviewSession=null;}return r.source==='custom'?customSentences():r.source==='starred'?[...READING_SENTENCES,...customSentences()].filter(x=>r.starSentences.includes(x.id)):orderedLevel(r.source);}
  function position(){const list=sentences(),r=data(),index=r.reviewSession?r.reviewSession.index:r.positions[r.source]||0;return Math.min(Math.max(0,index),Math.max(0,list.length-1));}
  function current(){return sentences()[position()];}
  const hintKey=(word,index)=>Array.from(word).length===1?word:word+'::hint::'+index;
  function adaptiveHint(word,pyHint='',index=null){const r=data();const shown=i=>{const key=hintKey(word,i);return !(key in r.hiddenPinyin?r.hiddenPinyin[key]:word in r.hiddenPinyin?r.hiddenPinyin[word]:status(word,pyHint)==='known');};return r.pinyin==='always'||(r.pinyin==='adaptive'&&(index===null?Array.from(word).some((_,i)=>shown(i)):shown(index)));}
  function hintsVisible(word,pyHint='',index=null){const visible=i=>revealedHints.has(hintKey(word,i))||(peek&&adaptiveHint(word,pyHint,i));return index===null?Array.from(word).some((_,i)=>visible(i)):visible(index);}
  function setPeek(active){peek=active;$('readingPeek').setAttribute('aria-pressed',String(peek));render();}
  function wordHTML(seg){
    if(!seg.v&&!Array.from(seg.text).some(isChineseChar))return escapeHtml(seg.text);
    const chars=Array.from(seg.text),parts=seg.py.split(/\s+/),columns=`style="--reading-columns:${chars.length}"`;
    const hints=chars.map((ch,i)=>{const visible=hintsVisible(seg.text,seg.py,i);return `<button class="reading-pinyin-toggle ${visible?'':'pinyin-masked'}" data-r-word="${escapeHtml(seg.text)}" data-r-index="${i}" data-r-pronunciation="${escapeHtml(seg.py)}" aria-label="${escapeHtml(ch)} (${escapeHtml(seg.text)}): ${visible?'hide':'show'} pinyin" aria-pressed="${visible}"><span aria-hidden="${!visible}" class="${visible?'':'hint-hidden'}">${escapeHtml(parts[i]||'·')}</span></button>`;}).join('');
    return `<span class="sentence-token ${status(seg.text,seg.py)==='known'?'token-known':status(seg.text,seg.py)==='learning'?'token-learning':''}"><span class="reading-hint-row" ${columns}>${hints}</span><button class="reading-word-button" data-r-definition="${escapeHtml(seg.text)}" data-r-pronunciation="${escapeHtml(seg.py)}" aria-label="Definition and writing: ${escapeHtml(seg.text)}" ${columns}>${chars.map(ch=>`<span lang="zh-Hans">${escapeHtml(ch)}</span>`).join('')}</button></span>`;
  }
  function sentenceHTML(sentence){
    const units=[];for(const seg of segments(sentence.zh,sentence.py)){if(/^[，。！？、；：,.!?;:）》」』】”’]+$/u.test(seg.text)&&units.length)units[units.length-1]+=`<span class="sentence-punctuation">${escapeHtml(seg.text)}</span>`;else units.push(wordHTML(seg));}
    return units.map(html=>`<span class="sentence-unit">${html}</span>`).join('');
  }
  function balancedBreaks(widths,limit){
    const greedy=[];let start=0,sum=0;for(let i=0;i<widths.length;i++){if(i>start&&sum+widths[i]>limit){greedy.push(i);start=i;sum=0;}sum+=widths[i];}greedy.push(widths.length);
    const count=greedy.length;if(count===1||widths.length>80)return greedy;
    const target=widths.reduce((a,b)=>a+b,0)/count,memo=new Map();
    function solve(from,lines){if(!lines)return from===widths.length?{cost:0,ends:[]}:null;const key=from+':'+lines;if(memo.has(key))return memo.get(key);let best=null,width=0;for(let end=from+1;end<=widths.length-lines+1;end++){width+=widths[end-1];if(width>limit&&end>from+1)break;const tail=solve(end,lines-1);if(tail){const cost=(width-target)**2+tail.cost;if(!best||cost<best.cost)best={cost,ends:[end,...tail.ends]};}}memo.set(key,best);return best;}return solve(0,count)?.ends||greedy;
  }
  function layoutSentences(){const canvas=$('sentenceCanvas');if(!canvas.clientWidth)return;for(const p of canvas.querySelectorAll('.sentence-paragraph')){const units=[...p.querySelectorAll('.sentence-unit')];if(!units.length)continue;const measure=document.createElement('span');measure.className='sentence-line';measure.style.width='max-content';measure.append(...units);p.replaceChildren(measure);for(const token of p.querySelectorAll('.sentence-token')){const word=token.querySelector('.reading-word-button'),hints=[...token.querySelectorAll('.reading-pinyin-toggle span')];if(word&&hints.length){const min=Math.max(parseFloat(getComputedStyle(word).fontSize),...hints.map(h=>h.getBoundingClientRect().width+2));word.style.gridTemplateColumns=`repeat(${hints.length},minmax(${min}px,1fr))`;}}const widths=units.map(el=>{const css=getComputedStyle(el);return el.getBoundingClientRect().width+parseFloat(css.marginLeft)+parseFloat(css.marginRight);});const ends=balancedBreaks(widths,canvas.clientWidth-2);let from=0;const rowWidth=Math.ceil(Math.max(...ends.map(end=>{const width=widths.slice(from,end).reduce((a,b)=>a+b,0);from=end;return width;})));p.replaceChildren();let start=0;for(const end of ends){const row=document.createElement('span');row.className='sentence-line';row.style.width=rowWidth+'px';row.append(...units.slice(start,end));p.append(row);start=end;}}}
  function fitSentence(){const canvas=$('sentenceCanvas');canvas.style.fontSize='';canvas.style.removeProperty('--reader-hint-size');layoutSentences();if(data().mode!=='sentence'||!canvas.clientHeight)return;const base=parseFloat(getComputedStyle(canvas).fontSize),hint=canvas.querySelector('.reading-pinyin-toggle'),baseHint=hint?parseFloat(getComputedStyle(hint).fontSize):13;const fits=()=>canvas.scrollHeight<=canvas.clientHeight+1&&canvas.scrollWidth<=canvas.clientWidth+1;const setSize=size=>{canvas.style.fontSize=size+'px';canvas.style.setProperty('--reader-hint-size',Math.max(10,Math.min(baseHint,size*.43))+'px');layoutSentences();};if(fits())return;let low=18,high=Math.floor(base)-1,best=18;setSize(18);if(!fits())return;while(low<=high){const middle=Math.floor((low+high)/2);setSize(middle);if(fits()){best=middle;low=middle+1;}else high=middle-1;}setSize(best);}


  function vocabWords(list=[current()]){return uniq(list.filter(Boolean).flatMap(s=>segments(s.zh,s.py).filter(x=>x.v).map(x=>x.text)));}
  function currentHint(word){const s=current();return s?segments(s.zh,s.py).find(t=>t.text===word)?.py||'':'';}
  function rstatus(word,next,pyHint=''){const key=definition(word,pyHint||currentHint(word))?.key||word;if(resolveEntry(key))setStatus(key,next);else{data().labels[key]=next;save();}render();}
  function toggleStar(list,value){const a=data()[list];data()[list]=a.includes(value)?a.filter(x=>x!==value):[...a,value];save();render();}
  function render(){
    if(!root)return;const r=data(),list=sentences(),index=position(),sentence=list[index];
    const context=r.source+':'+(sentence?.id||'')+':'+r.mode;if(context!==hintContext){hintContext=context;peek=false;revealedHints.clear();lastKnown=null;cancelDrag();}
    $('readingPeek').setAttribute('aria-pressed',String(peek));$('readingPeek').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="10" text-anchor="middle">pīn</text><text x="12" y="21" text-anchor="middle">yīn</text></svg>';$('readingPeek').setAttribute('aria-label',peek?'Hide pinyin':'Show pinyin');$('readingPeek').title=peek?'Hide pinyin':'Show pinyin';$('readingPeek').disabled=!sentence;
    updateGestureNotice();
    $('sentenceCanvas').dataset.mode=r.mode;
    $('readingResumePractice').textContent=r.practice?.mode==='direct'&&r.practice.phase==='quiz'?'Resume quiz':'Quick quiz';
    for(const level of [2,3])$('readingSource').querySelector(`[value="${level}"]`).textContent=`HSK ${level} practice · ${READING_SENTENCES.filter(x=>x.level===level).length.toLocaleString()} sentences`;
    $('readingSource').value=r.source;$('readingPinyinMode').value=r.pinyin;$('readingWordInterval').value=String(r.sentenceInterval||20);$('readingQuizCount').value=String(r.quizCount||10);$('readingQuizType').value=r.quizType||'mixed';
    $('readingOrder').value=r.order||'balanced';
    const now=Date.now(),dueCount=Object.entries(r.sentenceReview||{}).filter(([id,v])=>v.due<=now&&r.read.includes(id)).length,misses=Object.keys(r.wordReview||{}).length;
    $('readingReviewSummary').textContent=`${dueCount} sentences due · ${misses} words to revisit`;$('readingReviewEarlier').disabled=!r.read.length;$('readingReviewMissed').disabled=!misses;
    $('readingExitReview').hidden=!r.reviewSession;$('readingMarkNext').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L20 5"/></svg>';$('readingMarkNext').setAttribute('aria-label',r.reviewSession?'Mark reviewed and next sentence':'Mark read and next sentence');$('readingMarkNext').title=r.reviewSession?'Reviewed & next':'Read & next';
    $('readingMode').textContent=r.mode==='sentence'?'Passage view · 10 sentences':'Sentence view';
    const completed=list.filter(x=>r.read.includes(x.id)).length;
    $('readingPosition').textContent=list.length?r.reviewSession?`Review ${index+1} of ${list.length}`:`Sentence ${index+1} of ${list.length}`:'No sentences yet';
    const readState=$('readingReadState'),isRead=!!sentence&&r.read.includes(sentence.id);readState.textContent=sentence?(isRead?'✓ Read':'Unread'):'';readState.dataset.read=String(isRead);
    const checkpoint=cadence();
    $('readingBar').style.width=(list.length?completed/list.length*100:0)+'%';
    $('readingBar').parentElement.setAttribute('aria-valuenow',String(completed));
    $('readingBar').parentElement.setAttribute('aria-valuemax',String(list.length));
    $('readingProgressText').textContent=`${completed} / ${list.length} read · ${checkpoint.sentences} / ${checkpoint.target} to quiz`;
    $('readingPrev').disabled=!index;$('readingNext').disabled=index>=list.length-1;
    $('readingMarkNext').disabled=!sentence;$('readingListen').disabled=!sentence;
    const saveSentence=$('readingStarSentence'),saved=r.starSentences.includes(sentence?.id);saveSentence.disabled=!sentence;saveSentence.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>';saveSentence.setAttribute('aria-pressed',String(saved));saveSentence.setAttribute('aria-label',saved?'Unsave sentence':'Save sentence');saveSentence.title=saved?'Unsave sentence':'Save sentence';
    const visible=r.mode==='sentence'?[sentence].filter(Boolean):list.slice(Math.floor(index/10)*10,Math.floor(index/10)*10+10);
    $('sentenceCanvas').innerHTML=visible.length?visible.map(s=>`<div class="sentence-paragraph ${s.id===sentence?.id?'current-sentence':''}">${sentenceHTML(s)}</div>`).join(''):'<p class="small">Choose a reading track, save a sentence, or open Workspace to add your own text.</p>';
    fitSentence();
    const trans=$('sentenceTranslation');trans.hidden=!sentence;
    $('readingTranslationText').hidden=!(translationOpen||r.pin);
    $('readingTranslationText').textContent=sentence?.en||'No sentence translation is bundled for your pasted text. Word meanings are available below; use the full-text translator in the text tools if needed.';
    const translationVisible=translationOpen||r.pin;
    const eye=$('readingTranslateToggle'),pin=$('readingPinTranslation');
    eye.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${translationVisible?'<path d="m3 3 18 18"/>':''}</svg>`;
    eye.setAttribute('aria-label',translationVisible?'Hide translation':'Reveal translation');eye.title=translationVisible?'Hide translation':'Reveal translation';eye.setAttribute('aria-pressed',String(translationVisible));
    pin.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v6l3 3v3H5v-3l3-3V3Z"/><path d="M12 15v6"/></svg>';
    pin.setAttribute('aria-label',r.pin?'Unpin translation':'Pin translation');pin.title=r.pin?'Unpin translation':'Pin translation';pin.setAttribute('aria-pressed',String(r.pin));

    const words=vocabWords(),unknown=words.filter(w=>status(w,currentHint(w))!=='known'),display=unknown.filter(w=>!selectedWord||w!==selectedWord);
    $('readingWordCount').textContent=`${unknown.length} to learn · ${words.length-unknown.length} known`;
    const chosen=selectedWord&&definition(selectedWord);
    $('readingSelectedWord').hidden=!chosen;
    if(chosen)$('readingSelectedWord').innerHTML=vocabRow(selectedWord,true);
    $('readingVocab').innerHTML=display.map(w=>vocabRow(w)).join('')||'<p class="small">You know the listed vocabulary in this sentence.</p>';
    $('readingReviewWords').disabled=!vocabWords(visible).some(w=>status(w)!=='known'||r.starWords.includes(w));
    $('readingIntervalProgress').textContent=checkpoint.sentences+' / '+checkpoint.target+' sentences towards your next quiz.';
    $('readingCheckpoint').hidden=true;
    $('readingPinyinNote').textContent='Try the Chinese first. Tap Show pinyin for hints, or tap a shaded block for one syllable. Tap the Chinese word for its definition. Pull down to toggle Known; pull up to mark Learning for later review. Swipe left or right for the next or previous phrase.';
  }
  function vocabRow(word,selected=false){const sentence=current(),hint=sentence?segments(sentence.zh,sentence.py).find(t=>t.text===word)?.py||'':'',v=definition(word,hint),known=status(word,hint)==='known';return `<div class="reading-vocab-row ${selected?'selected-word':''}"><div><strong lang="zh-Hans">${escapeHtml(word)}</strong><span>${escapeHtml(v.pinyin)}</span><p>${escapeHtml(v.english)}</p></div><div class="reading-word-actions"><button data-r-speak="${escapeHtml(word)}" aria-label="Hear ${escapeHtml(word)}">Listen</button><button data-r-star="${escapeHtml(word)}" aria-label="${data().starWords.includes(word)?'Unsave':'Save'} ${escapeHtml(word)}">${data().starWords.includes(word)?'★':'☆'}</button><button data-r-status="${escapeHtml(word)}" data-r-next="${known?'learning':'known'}">${known?'Revisit':'✓ Known'}</button></div></div>`;}
  const SENTENCE_DAYS=[1,3,7,14,30];
  function scheduleSentence(id,review=false){const r=data();r.sentenceReview ||= {};const old=r.sentenceReview[id];if(old&&!review)return;const step=old&&review?Math.min(4,old.step+1):0;r.sentenceReview[id]={step,due:Date.now()+SENTENCE_DAYS[step]*86400000};}
  function startSentenceReview(missed=false){
    const r=data(),all=[...READING_SENTENCES,...customSentences()],read=all.filter(s=>r.read.includes(s.id)),missedWords=Object.keys(r.wordReview||{});
    let candidates=missed?all.filter(s=>segments(s.zh,s.py).some(t=>missedWords.includes(t.text))):read;
    if(!missed){const due=candidates.filter(s=>!r.sentenceReview?.[s.id]||r.sentenceReview[s.id].due<=Date.now());if(due.length)candidates=due;}
    if(!candidates.length){toast('Read a few sentences first, or complete a quiz.');return;}
    candidates=candidates.sort((a,b)=>(r.sentenceReview?.[a.id]?.due||0)-(r.sentenceReview?.[b.id]?.due||0));
    const chosen=[],seenTopics=new Set();for(const s of candidates)if(!seenTopics.has(s.topic||s.id)){chosen.push(s);seenTopics.add(s.topic||s.id);if(chosen.length===10)break;}
    for(const s of candidates)if(chosen.length<10&&!chosen.includes(s))chosen.push(s);
    r.reviewSession={ids:chosen.map(s=>s.id),index:0,reason:missed?'missed vocabulary':'earlier sentences'};$('readingOptions').close();save();render();
  }
  function wordCount(sentence){return segments(sentence.zh,sentence.py).filter(token=>token.v||Array.from(token.text).some(isChineseChar)).length;}
  function randomCheckpoint(){return [10,20,30].includes(data().sentenceInterval)?data().sentenceInterval:20;}
  function cadence(source=data().source){
    const r=data();r.quizCadence ||= {};
    if(r.cadenceUnit!=='sentences'){r.quizCadence={};r.sentenceInterval=20;r.cadenceUnit='sentences';}
    if(r.quizCadence[source]&&!Number.isInteger(r.quizCadence[source].sentences))delete r.quizCadence[source];
    if(r.quizCountBasis!=='read'){r.quizCadence={};r.quizCountBasis='read';}
    if(!r.quizCadence[source]){const ids=new Set((source==='custom'?customSentences():source==='starred'?[...READING_SENTENCES,...customSentences()].filter(s=>r.starSentences.includes(s.id)):orderedLevel(source)).map(s=>s.id));const count=uniq(r.read).filter(id=>ids.has(id)&&!(r.quizCovered?.[source]||[]).includes(id)).length;r.quizCadence[source]={sentences:count%randomCheckpoint(),target:randomCheckpoint()};}
    return r.quizCadence[source];
  }
  function move(delta,mark=false){
    const list=sentences(),r=data();if(!list.length)return;
    const sentence=current();
    const newExposure=!r.reviewSession&&mark&&!r.read.includes(sentence.id);
    let showQuiz=false;
    if(!r.reviewSession&&(mark||delta>0)){r.quizSeen ||= {};r.quizSeen[r.source]=uniq([...(r.quizSeen[r.source]||[]),sentence.id]);}
    if(mark){r.read=uniq([...r.read,sentence.id]);scheduleSentence(sentence.id,!!r.reviewSession);}
    if(newExposure){
      r.quizSeen ||= {};r.quizSeen[r.source] ||= [];r.quizSeen[r.source]=uniq([...r.quizSeen[r.source],sentence.id]);
      const check=cadence();check.sentences++;
      if(check.sentences>=check.target){
        check.sentences-=check.target;
        check.target=randomCheckpoint();
        showQuiz=true;
      }
    }
    if(r.reviewSession){if(mark&&position()===list.length-1){r.reviewSession=null;toast('Review complete. Your reading place is saved.');}else r.reviewSession.index=Math.max(0,Math.min(list.length-1,position()+delta));}
    else r.positions[r.source]=Math.max(0,Math.min(list.length-1,position()+delta));
    selectedWord='';translationOpen=false;save();render();
    if(showQuiz)setupQuiz(true);
  }
  function unquizzed(){const r=data(),covered=r.quizCovered?.[r.source]||[],seen=new Set([...(r.quizSeen?.[r.source]||[]),...r.read]);return sentences().filter(s=>seen.has(s.id)&&!covered.includes(s.id));}
  function recentBlock(){
    const r=data(),byId=new Map(sentences().map(s=>[s.id,s]));
    const ids=uniq(r.read).filter(id=>byId.has(id));
    const pending=ids.filter(id=>!(r.quizCovered?.[r.source]||[]).includes(id));
    return (pending.length?pending:ids).slice(-randomCheckpoint()).map(id=>byId.get(id)).filter(Boolean).concat(ids.length?[]:[current()].filter(Boolean));
  }
  function rememberReadingPlace(){const r=data();practiceReturn={source:r.source,position:position(),reviewSession:r.reviewSession?JSON.parse(JSON.stringify(r.reviewSession)):null};}
  function restoreReadingPlace(){
    if(practiceReturn){const r=data();r.source=practiceReturn.source;r.reviewSession=practiceReturn.reviewSession;if(r.reviewSession)r.reviewSession.index=practiceReturn.position;else r.positions[r.source]=practiceReturn.position;practiceReturn=null;save();}
    render();requestAnimationFrame(()=>fitSentence());
  }
  function startPractice(){
    quizSetup=null;const r=data(),pool=vocabWords(recentBlock()).filter(w=>status(w)!=='known'||r.starWords.includes(w));
    if(!pool.length){toast('No unfamiliar or saved words in this reading block. Try Quick quiz to include known words.');return;}
    r.practice={words:pool.slice(0,30),cursor:0,reveal:false,phase:'cards',questions:[],q:0,score:0,total:0,answered:false,order:[],feedback:''};save();openPractice();
  }
  function setupQuiz(automatic=false){
    rememberReadingPlace();const block=recentBlock();localPracticeOptions=vocabWords(block);
    quizSetup={source:data().source,ids:block.map(s=>s.id)};
    const dialog=$('readingPracticeDialog');if(!dialog.open)dialog.showModal();
    $('readingPracticeBody').innerHTML=`<h2 class="reading-quiz-heading">${automatic===true?'Time for a quick check':'Quick quiz'}</h2><p class="small reading-quiz-subtitle">Review words from your last ${block.length} sentences. Questions are sampled from ${localPracticeOptions.length} different words you have read.</p><div class="reading-quiz-settings"><div><label for="readingSetupCount">Maximum questions</label><select id="readingSetupCount">${[5,10,15,20,30].map(n=>`<option value="${n}" ${n===(data().quizCount||10)?'selected':''}>${n}</option>`).join('')}</select></div><div><label for="readingSetupType">Quiz type</label><select id="readingSetupType"><option value="mixed">Mixed · all question types</option><option value="meaning">English → Chinese</option><option value="pinyin">Pinyin → Chinese</option><option value="zh-meaning">Chinese → English</option><option value="py-meaning">Pinyin → English</option></select></div></div><label class="reading-order-setting"><input id="readingSetupOrder" type="checkbox" checked> Include sentence order</label><div class="reading-quiz-footer"><button id="readingQuizLater" type="button">Not now</button><button class="primary" id="readingQuizStart" ${localPracticeOptions.length?'':'disabled'}>Start quiz →</button></div>`;
    $('readingSetupType').value=data().quizType||'mixed';
  }
  function launchQuiz(){
    if(!quizSetup)return;
    const selected=localPracticeOptions;if(!selected.length)return;
    const r=data();r.quizCount=Number($('readingSetupCount').value);r.quizType=$('readingSetupType').value;
    const words=selected.slice(),p={mode:'direct',source:quizSetup.source,sentenceIds:quizSetup.ids,words,cursor:words.length,reveal:false,phase:'quiz',questions:[],q:0,score:0,total:0,answered:false,order:[],feedback:''};
    makeQuiz(p,shuffle(words.slice()).slice(0,r.quizCount),READING_SENTENCES.concat(customSentences()).find(s=>s.id===quizSetup.ids.at(-1)),r.quizType,$('readingSetupOrder').checked,r.quizCount);
    p.cursor=p.words.length;r.practice=p;quizSetup=null;save();renderPractice();
  }
  function finishQuiz(p){if(p.mode!=='direct')return;const r=data();r.quizCovered ||= {};r.quizCovered[p.source]=uniq([...(r.quizCovered[p.source]||[]),...p.sentenceIds]);render();}
  function openPractice(){rememberReadingPlace();const dialog=$('readingPracticeDialog');if(!dialog.open)dialog.showModal();renderPractice();}
  function makeQuiz(p,block=p.words.slice(Math.max(0,p.cursor-data().every),p.cursor),sentence=current(),type='mixed',includeOrder=true,limit=31){
    const covered=uniq([...vocabWords(recentBlock()),...p.words]);
    const modes=['meaning','zh-meaning','pinyin','py-meaning'];
    p.questions=block.map((word,i)=>{
      const hint=recentBlock().flatMap(s=>segments(s.zh,s.py)).find(t=>t.text===word)?.py||'',v=definition(word,hint),kind=type==='mixed'?modes[i%modes.length]:type,englishAnswer=kind.endsWith('-meaning');
      const correct=englishAnswer?v.english:word;
      const usable=w=>{const d=definition(w);return w!==word&&d&&(kind.includes('pinyin')||kind==='py-meaning'?d.pinyin!==v.pinyin:true)&&d.english!==v.english;};
      const familiar=shuffle(covered.filter(usable)),fallback=shuffle(uniq(VOCAB.map(v=>v.word)).filter(w=>usable(w)&&!familiar.includes(w)));
      const distractors=uniq(familiar.concat(fallback).map(w=>englishAnswer?definition(w).english:w)).slice(0,3);
      return {kind,target:word,pinyin:v.pinyin,meaning:v.english,word:correct,prompt:kind==='meaning'?v.english:kind==='zh-meaning'?word:v.pinyin,options:shuffle([correct,...distractors])};
    });
    const parts=sentence?segments(sentence.zh,sentence.py).filter(s=>s.v).map(s=>s.text):[];
    if(includeOrder&&parts.length>=3&&parts.length<=14){p.questions=p.questions.slice(0,Math.max(0,limit-1));p.questions.push({kind:'order',prompt:sentence.en||'Rebuild the sentence you just read.',answer:parts,options:shuffle(parts.map((text,i)=>({text,id:i})))});}
    p.phase='quiz';p.q=0;p.answered=false;p.order=[];p.feedback='';p.selectedAnswer=null;
  }
  function renderPractice(){
    const p=data().practice;if(!p)return;const shell=$('readingPracticeBody'),total=p.words.length;
    if(p.phase==='cards'){
      const v=definition(p.words[p.cursor]);if(!v){p.phase='summary';return renderPractice();}
      shell.innerHTML=`<span class="card-eyebrow">READING VOCABULARY</span><p class="small">${p.cursor} / ${total} words reviewed</p><button class="reading-study-card" id="readingCardReveal" aria-label="Reveal or hide this word"><span lang="zh-Hans">${escapeHtml(v.word)}</span><strong class="${p.reveal?'':'hint-hidden'}">${escapeHtml(v.pinyin)}</strong><p class="${p.reveal?'':'hint-hidden'}">${escapeHtml(v.english)}</p><small>Tap to reveal</small></button><div class="reading-rating"><button data-reading-rate="new">Revisit</button><button data-reading-rate="learning">Learning</button><button data-reading-rate="known" class="primary">Known</button></div>`;
    }else if(p.phase==='quiz'){
      const q=p.questions[p.q];if(!q){p.phase='summary';save();return renderPractice();}p.order=uniq((p.order||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<q.options.length));shell.innerHTML=`<span class="card-eyebrow">QUICK CHECK</span><p class="small">Question ${p.q+1} / ${p.questions.length} · ${p.mode==='direct'?`${p.sentenceIds?.length||0} sentences · ${p.words.length} words`:`${p.cursor} words reviewed`}</p><div class="progressbar reading-quiz-progress"><span style="width:${p.q/p.questions.length*100}%"></span></div><h2 class="reading-question">${escapeHtml(q.prompt)}</h2>${q.kind==='order'?`<p class="small">Tap the words in sentence order. Tap your answer to undo the last word.</p><button id="readingOrderAnswer" class="reading-order-answer ${p.answered?(p.order.map(i=>q.options[i].text).join('')===q.answer.join('')?'correct':'wrong'):''}" aria-label="Undo last word">${p.order.map(i=>escapeHtml(q.options[i].text)).join(' ')||'Build your sentence here'}</button><div class="reading-order-options">${q.options.map((o,i)=>`<button data-reading-order="${i}" ${p.order.includes(i)||p.answered?'disabled':''}>${escapeHtml(o.text)}</button>`).join('')}</div><button id="readingOrderCheck" ${p.answered||p.order.length!==q.options.length?'disabled':''}>Check sentence</button>`:`<div class="reading-quiz-options ${q.kind.endsWith('-meaning')?'latin-options':''}">${q.options.map((w,i)=>`<button data-reading-answer="${i}" class="${p.answered&&w===q.word?'correct':p.answered&&i===p.selectedAnswer?'wrong':''}" ${p.answered?'disabled':''}>${escapeHtml(w)}</button>`).join('')}</div>`}<div class="quiz-answer-row"><p class="reading-feedback" role="status">${escapeHtml(p.feedback||'')}</p><button class="icon-button primary" id="readingQuestionNext" aria-label="${p.q+1===p.questions.length?'See results':'Next question'}" title="${p.q+1===p.questions.length?'See results':'Next question'}" ${p.answered?'':'disabled'}>${nextIcon}</button></div>`;
    }else{
      shell.innerHTML=`<span class="card-eyebrow">PRACTICE COMPLETE</span><h2>${p.mode==='direct'?'Quiz complete!':p.cursor===total?'Nice work. You’re done!':'A little stronger, one block at a time.'}</h2><p>${p.mode==='direct'?`${p.words.length} words practised`:`${p.cursor} / ${total} words reviewed`} · ${p.score} / ${p.total} quiz answers correct</p><button class="primary" id="readingPracticeContinue">${p.cursor<total?'Continue flashcards':'Back to reading'}</button>`;
    }
  }
  function answer(correct,feedback){const r=data(),p=r.practice;if(p.answered)return;p.answered=true;p.total++;const q=p.questions[p.q],word=q.kind==='order'?'':q.target||q.word;r.wordReview ||= {};
    if(correct){p.score++;if(word)delete r.wordReview[word];}else if(word){r.wordReview[word]={due:Date.now()+600000,misses:(r.wordReview[word]?.misses||0)+1};r.sentenceReview ||= {};for(const s of [...READING_SENTENCES,...customSentences()])if(r.read.includes(s.id)&&segments(s.zh,s.py).some(t=>t.text===word))r.sentenceReview[s.id]={step:-1,due:Date.now()+600000};rstatus(word,'learning',q.pinyin);}
    p.feedback=feedback;save();render();renderPractice();}
  let detailWriters=[],detailGeneration=0,detailWord='',detailHint='',detailGuide=true;
  async function renderDetailsWriting(){
    cancelWriters(detailWriters);detailWriters=[];
    const generation=++detailGeneration,dialog=$('readingWordDialog'),word=detailWord;
    const valid=()=>dialog.open&&detailWord===word&&generation===detailGeneration;
    const panel=$('readingWordWriting'),state=$('readingWordWritingStatus');
    state.textContent='Loading writing practice…';
    const chars=Array.from(word).filter(isChineseChar).slice(0,8);
    try{
      await ensureHanziWriter();const results=await Promise.all(chars.map(async ch=>{try{await localCharacterLoader(ch);return ch;}catch{return null;}}));
      if(!valid())return;
      const supported=results.filter(Boolean),missing=chars.filter(ch=>!supported.includes(ch));
      $('readingWordWritingNote').textContent=missing.length?`Writing data is not bundled for: ${missing.join('、')}.`:'Trace each stroke to continue.';
      if(!supported.length){panel.textContent='Writing data is not available for this word.';state.textContent='';return;}
      const viewportHeight=window.visualViewport?.height||window.innerHeight;
      const padSize=Math.round(.8*Math.max(168,Math.min(272,window.innerWidth-116,Math.round(viewportHeight*.3))));
      detailWriters=renderStrokeSurfaces({panel,status:state,wrap:panel.closest('.stroke-panel'),chars:supported,prefix:'readingWordStroke',traceMode:true,startQuiz:true,valid,guideVisible:detailGuide,padSize});
    }catch{if(valid()){state.textContent='Writing practice unavailable';panel.textContent='Please check the offline files in Settings.';}}
  }
  function showDetails(word,pyHint=''){
    const v=definition(word,pyHint)||{word,pinyin:'',english:'This word is not in the local reading dictionary.'};
    detailWord=word;detailHint=pyHint;detailGuide=true;$('readingWordGuide').textContent='Hide guide';
    $('readingWordHeading').textContent=word;$('readingWordPronunciation').textContent=v.pinyin;$('readingWordMeaning').textContent=v.english;$('readingWordState').textContent=status(word,pyHint);
    const dialog=$('readingWordDialog');if(!dialog.open)dialog.showModal();renderDetailsWriting();
  }
  let drag=null,suppressClickUntil=0,lastKnown=null,undoTimer=0;
  function cancelDrag(){if(drag?.token){drag.button.style.transform='';drag.token.classList.remove('word-pull-ready','word-pull-learning');}drag=null;}
  function markWordKnown(word,py,offset=0,learning=false){const previous=status(word,py),next=learning?'learning':previous==='known'?'new':'known';lastKnown={word,py,previous,next};clearTimeout(undoTimer);rstatus(word,next,py);const button=[...$('sentenceCanvas').querySelectorAll('[data-r-definition]')].find(el=>el.dataset.rDefinition===word&&el.dataset.rPronunciation===py);if(button&&!matchMedia('(prefers-reduced-motion: reduce)').matches)button.animate?.([{transform:`translateY(${offset}px)`},{transform:`translateY(${offset<0?2:-2}px)`,offset:.65},{transform:'translateY(0)'}],{duration:330,easing:'cubic-bezier(.2,.8,.3,1)'});undoTimer=setTimeout(()=>{lastKnown=null;updateGestureNotice();},8000);}
  function updateGestureNotice(){const notice=$('readingGestureNotice');notice.hidden=!lastKnown;if(lastKnown)$('readingGestureText').textContent=lastKnown.word+(lastKnown.next==='known'?' marked Known':lastKnown.next==='learning'?' marked Learning':' marked Unknown');}
  function bindSentenceGestures(){const canvas=$('sentenceCanvas');
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;if(e.target.closest('[data-r-word]')){cancelDrag();suppressClickUntil=0;return;}cancelDrag();suppressClickUntil=0;const button=e.target.closest('[data-r-definition]');drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,axis:'',button,token:button?.closest('.sentence-token')};(button||canvas).setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;const x=Math.abs(drag.dx),y=Math.abs(drag.dy);if(!drag.axis&&Math.max(x,y)>10)drag.axis=x>y*1.25?'horizontal':drag.button&&y>x*1.25?'word':'cancel';if(drag.axis){e.preventDefault();suppressClickUntil=Date.now()+450;}if(drag.axis==='word'){drag.button.style.transform=`translateY(${Math.max(-12,Math.min(12,drag.dy*.28))}px)`;drag.token.classList.toggle('word-pull-ready',drag.dy>=34);drag.token.classList.toggle('word-pull-learning',drag.dy<=-34);}});
    const finish=(e,cancelled=false)=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;cancelDrag();d.token?.classList.remove('word-pull-ready','word-pull-learning');if(cancelled)return;if(d.axis==='horizontal'&&Math.abs(d.dx)>=55&&Math.abs(d.dx)>Math.abs(d.dy)*1.25){e.preventDefault();move(d.dx<0?1:-1);}else if(d.axis==='word'&&Math.abs(d.dy)>=34&&Math.abs(d.dx)<Math.abs(d.dy)*.7){e.preventDefault();markWordKnown(d.button.dataset.rDefinition,d.button.dataset.rPronunciation,Math.max(-12,Math.min(12,d.dy*.28)),d.dy<0);}};
    canvas.addEventListener('pointerup',e=>finish(e));canvas.addEventListener('pointercancel',e=>finish(e,true));canvas.addEventListener('lostpointercapture',e=>finish(e,true));canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();}},true);
    window.addEventListener('blur',cancelDrag);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDrag();});
    $('readingGestureUndo').onclick=()=>{if(!lastKnown)return;const old=lastKnown;lastKnown=null;clearTimeout(undoTimer);rstatus(old.word,old.previous,old.py);};
  }
  function resizeReadingFrame(){
    const main=$('mainContent');if(!matchMedia('(max-width:720px)').matches||!main.clientHeight){root.style.removeProperty('--sentence-frame-height');return;}
    const css=getComputedStyle(main),vocab=$('readingVocabulary'),vcss=getComputedStyle(vocab),summary=vocab.querySelector('summary');
    const available=main.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-root.querySelector('.reading-intro').getBoundingClientRect().height-summary.getBoundingClientRect().height-parseFloat(vcss.paddingTop)-parseFloat(vcss.paddingBottom)-12;
    root.style.setProperty('--sentence-frame-height',Math.max(360,Math.floor(available))+'px');
  }
  function bindVocabularyDisclosure(){
    const details=$('readingVocabulary'),summary=details.querySelector('summary'),body=details.querySelector('.reading-vocab-content');
    let expanded=details.open,animation=null,generation=0,followFrame=0;
    const follow=()=>{const main=$('mainContent'),local=/auto|scroll/.test(getComputedStyle(main).overflowY)&&main.scrollHeight>main.clientHeight;const bottom=local?main.getBoundingClientRect().bottom:window.innerHeight,delta=details.getBoundingClientRect().bottom-bottom+12;if(delta>0){if(local)main.scrollTop+=delta;else window.scrollBy(0,delta);}};
    const sync=()=>{summary.setAttribute('aria-expanded',String(expanded));body.inert=!expanded;};sync();
    summary.addEventListener('click',e=>{
      e.preventDefault();const from=details.open?body.getBoundingClientRect().height:0,opening=!expanded,id=++generation;
      expanded=opening;cancelAnimationFrame(followFrame);animation?.cancel();animation=null;body.style.removeProperty('overflow');sync();
      if(!body.animate||matchMedia('(prefers-reduced-motion: reduce)').matches){details.open=opening;resizeReadingFrame();if(opening)requestAnimationFrame(follow);return;}
      details.open=true;const target=opening?body.getBoundingClientRect().height:0;
      body.style.overflow='hidden';
      animation=body.animate([{height:from+'px',opacity:from?1:0},{height:target+'px',opacity:opening?1:0}],{duration:230,easing:'cubic-bezier(.22,.68,0,1)',fill:'both'});
      if(opening){const tick=()=>{if(id!==generation||!animation)return;follow();followFrame=requestAnimationFrame(tick);};followFrame=requestAnimationFrame(tick);}
      animation.finished.then(()=>{
        if(id!==generation)return;cancelAnimationFrame(followFrame);details.open=opening;if(opening)follow();animation.cancel();animation=null;body.style.removeProperty('overflow');resizeReadingFrame();
      }).catch(()=>{});
    });
    details.addEventListener('toggle',()=>{if(!animation){expanded=details.open;sync();}resizeReadingFrame();fitSentence();});
  }
  function bind(){
    bindSentenceGestures();
    bindVocabularyDisclosure();
    window.addEventListener('resize',resizeReadingFrame);
    const peekButton=$('readingPeek');
    peekButton.onclick=()=>setPeek(!peek);
    peekButton.oncontextmenu=e=>e.preventDefault();
    window.addEventListener('blur',()=>{if(peek)setPeek(false);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&peek)setPeek(false);});
    root.addEventListener('click',e=>{
      const details=e.target.closest('[data-r-definition]');if(details){showDetails(details.dataset.rDefinition,details.dataset.rPronunciation);return;}
      const token=e.target.closest('[data-r-word]');if(token){const word=token.dataset.rWord,index=Number(token.dataset.rIndex),py=token.dataset.rPronunciation,chars=Array.from(word);if(!Number.isInteger(index)||index<0||index>=chars.length)return;selectedWord=word;const key=hintKey(word,index),hiding=hintsVisible(word,py,index);if(hiding)revealedHints.delete(key);else revealedHints.add(key);data().hiddenPinyin[key]=hiding;data().hiddenPinyin[word]=chars.every((_,i)=>data().hiddenPinyin[hintKey(word,i)]===true);save();render();return;}
      const known=e.target.closest('[data-r-status]');if(known){rstatus(known.dataset.rStatus,known.dataset.rNext);return;}
      const star=e.target.closest('[data-r-star]');if(star){toggleStar('starWords',star.dataset.rStar);return;}
      const speak=e.target.closest('[data-r-speak]');if(speak)speakChinese(speak.dataset.rSpeak);
    });
    $('readingSource').onchange=e=>{data().reviewSession=null;data().source=e.target.value;selectedWord='';translationOpen=false;save();render();};
    $('readingOrder').onchange=e=>setOrder(e.target.value);$('readingReviewEarlier').onclick=()=>startSentenceReview();$('readingReviewMissed').onclick=()=>startSentenceReview(true);$('readingExitReview').onclick=()=>{data().reviewSession=null;save();render();};
    $('readingPinyinMode').onchange=e=>{data().pinyin=e.target.value;save();render();};
    const settingsDialog=$('readingOptions');
    $('readingOptionsToggle').onclick=()=>{render();settingsDialog.showModal();};$('readingSettingsClose').onclick=()=>settingsDialog.close();
    let settingsBackdrop=false;const settingsOutside=e=>{const b=settingsDialog.getBoundingClientRect();return e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom;};
    settingsDialog.onpointerdown=e=>{settingsBackdrop=e.target===settingsDialog&&settingsOutside(e);};settingsDialog.onclick=e=>{if(settingsBackdrop&&e.target===settingsDialog&&settingsOutside(e))settingsDialog.close();settingsBackdrop=false;};
    $('readingWordInterval').onchange=e=>{data().sentenceInterval=[10,20,30].includes(Number(e.target.value))?Number(e.target.value):20;const check=cadence();check.target=randomCheckpoint();check.sentences=Math.min(check.sentences,check.target-1);save();render();};
    $('readingQuizCount').onchange=e=>{data().quizCount=Number(e.target.value);save();};
    $('readingQuizType').onchange=e=>{data().quizType=e.target.value;save();};
    $('readingMode').onclick=()=>{data().mode=data().mode==='sentence'?'passage':'sentence';save();render();};
    $('readingPrev').onclick=()=>move(-1);$('readingNext').onclick=()=>move(1);$('readingMarkNext').onclick=()=>move(1,true);
    $('readingListen').onclick=()=>{if(current())speakChinese(current().zh);};
    $('readingStarSentence').onclick=()=>{if(current())toggleStar('starSentences',current().id);};
    $('readingTranslateToggle').onclick=()=>{translationOpen=!(translationOpen||data().pin);if(!translationOpen)data().pin=false;save();render();};
    $('readingPinTranslation').onclick=()=>{data().pin=!data().pin;save();render();};
    $('readingUseCustom').onclick=()=>{data().reviewSession=null;data().custom=$('inputText').value.slice(0,200000);data().source='custom';data().positions.custom=0;selectedWord='';save();render();switchTab('reader');root.scrollIntoView({behavior:'smooth',block:'start'});};
    $('readingReviewWords').onclick=startPractice;$('readingCheckpointStart').onclick=setupQuiz;
    $('readingCheckpointDismiss').onclick=()=>{$('readingCheckpoint').hidden=true;};
    $('readingResumePractice').onclick=()=>{quizSetup=null;if(data().practice?.mode==='direct'&&data().practice.phase==='quiz')openPractice();else setupQuiz();};
    const detail=$('readingWordDialog');
    $('readingWordClose').onclick=()=>detail.close();detail.addEventListener('close',()=>{++detailGeneration;cancelWriters(detailWriters);detailWriters=[];});
    let detailBackdrop=false;const detailOutside=e=>{const r=detail.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    detail.onpointerdown=e=>{detailBackdrop=e.target===detail&&detailOutside(e);};detail.addEventListener('click',e=>{if(detailBackdrop&&e.target===detail&&detailOutside(e))detail.close();detailBackdrop=false;});
    $('readingWordListen').onclick=()=>speakChinese(detailWord);
    $('readingWordKnown').onclick=()=>{rstatus(detailWord,'known',detailHint);$('readingWordState').textContent=status(detailWord,detailHint);};
    $('readingWordLearning').onclick=()=>{rstatus(detailWord,'learning',detailHint);$('readingWordState').textContent=status(detailWord,detailHint);};
    $('readingWordRetry').onclick=()=>{detailGuide=true;$('readingWordGuide').textContent='Hide guide';renderDetailsWriting();};
    $('readingWordGuide').onclick=()=>{detailGuide=!detailGuide;detailWriters.forEach(w=>detailGuide?w.showOutline():w.hideOutline());$('readingWordGuide').textContent=detailGuide?'Hide guide':'Show guide';};
    const dialog=$('readingPracticeDialog');$('readingPracticeClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{quizSetup=null;restoreReadingPlace();});
    let backdrop=false;const outside=e=>{const b=dialog.getBoundingClientRect();return e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom;};
    dialog.onpointerdown=e=>{backdrop=e.target===dialog&&outside(e);};dialog.addEventListener('click',e=>{if(backdrop&&e.target===dialog&&outside(e))dialog.close();backdrop=false;});
    
    $('readingPracticeBody').onclick=e=>{
      if(e.target.closest('#readingQuizLater')){quizSetup=null;dialog.close();return;}
      if(e.target.closest('#readingQuizStart')){launchQuiz();return;}
      if(quizSetup)return;
      const p=data().practice;if(!p)return;
      if(e.target.closest('#readingCardReveal')){p.reveal=!p.reveal;save();renderPractice();return;}
      const rate=e.target.closest('[data-reading-rate]');if(rate&&p.phase==='cards'){
        rstatus(p.words[p.cursor],rate.dataset.readingRate);p.cursor++;p.reveal=false;
        if(p.cursor===p.words.length)p.phase='summary';save();renderPractice();return;
      }
      const choice=e.target.closest('[data-reading-answer]');if(choice&&p.phase==='quiz'){const q=p.questions[p.q];if(p.answered)return;p.selectedAnswer=Number(choice.dataset.readingAnswer);answer(q.options[Number(choice.dataset.readingAnswer)]===q.word,`Answer: ${q.target||q.word} · ${q.pinyin||definition(q.target||q.word).pinyin} · ${q.meaning||definition(q.target||q.word).english}`);return;}
      const order=e.target.closest('[data-reading-order]');if(order&&p.phase==='quiz'&&!p.answered){const index=Number(order.dataset.readingOrder);if(!Number.isInteger(index)||index<0||index>=p.questions[p.q].options.length||p.order.includes(index))return;p.order.push(index);save();renderPractice();return;}
      if(e.target.closest('#readingOrderAnswer')&&!p.answered){p.order.pop();save();renderPractice();return;}
      if(e.target.closest('#readingOrderCheck')&&!p.answered){const q=p.questions[p.q];answer(p.order.map(i=>q.options[i].text).join('')===q.answer.join(''),'Sentence: '+q.answer.join(''));return;}
      if(e.target.closest('#readingQuestionNext')&&p.phase==='quiz'&&p.answered){p.q++;p.answered=false;p.selectedAnswer=null;p.order=[];p.feedback='';if(p.q>=p.questions.length){p.phase='summary';finishQuiz(p);}save();renderPractice();return;}
      if(e.target.closest('#readingPracticeContinue')){if(p.cursor<p.words.length){p.phase='cards';save();renderPractice();}else{dialog.close();render();}}
    };
  }
  window.onStudyDataReplaced=()=>{cancelDrag();lastKnown=null;clearTimeout(undoTimer);peek=false;hintContext='';revealedHints.clear();translationOpen=false;selectedWord='';quizSetup=null;practiceReturn=null;localPracticeOptions=[];detailWord='';++detailGeneration;cancelWriters(detailWriters);detailWriters=[];for(const id of ['readingPracticeDialog','readingWordDialog','readingOptions'])if($(id).open)$(id).close();$('readingPracticeBody').innerHTML='';};
  cadence();
  if(!data().order)setOrder('balanced');
  data().sentenceReview ||= {};let addedSchedule=false;for(const id of data().read)if(!data().sentenceReview[id]){data().sentenceReview[id]={step:0,due:Date.now()};addedSchedule=true;}if(addedSchedule)save();
  bind();window.refreshReadingStudio=()=>{render();resizeReadingFrame();};render();resizeReadingFrame();if(typeof ResizeObserver!=='undefined'){new ResizeObserver(()=>fitSentence()).observe($('sentenceCanvas'));new ResizeObserver(resizeReadingFrame).observe($('mainContent'));}
  return {segments,definition,current,sentences,render,startPractice,hintsVisible,showDetails,setupQuiz,startSentenceReview,orderedLevel,balancedBreaks};
})();
