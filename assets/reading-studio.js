/* Sentence reader and integrated reading → cards → exercises workflow. */
const ReadingStudio=(()=>{
  const root=$('readingStudio');
  let translationOpen=false,selectedWord='',localPracticeOptions=[],quizSetup=null;
  const data=()=>extras.reading ||= {source:'2',positions:{},hiddenPinyin:{},starWords:[],starSentences:[],labels:{},read:[],mode:'sentence',pinyin:'adaptive',pin:false,every:5,sentenceInterval:10,quizCount:10,quizType:'mixed',quizCovered:{},custom:'',practice:null};
  const save=()=>saveExtras();
  const status=word=>resolveEntry(word)?statusOf(word):(data().labels[word]||'new');
  const definition=word=>{const v=resolveEntry(word),d=READING_DICTIONARY[word];return v?{word,pinyin:cardSyllables(v).join(' '),english:v.english,key:entryKey(v)}:d?{word,pinyin:d[0],english:d[1],key:word}:null;};
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
  function sentences(){const r=data();return r.source==='custom'?customSentences():r.source==='starred'?[...READING_SENTENCES,...customSentences()].filter(x=>r.starSentences.includes(x.id)):READING_SENTENCES.filter(x=>String(x.level)===r.source);}
  function position(){const list=sentences();return Math.min(Math.max(0,data().positions[data().source]||0),Math.max(0,list.length-1));}
  function current(){return sentences()[position()];}
  function hintsVisible(word){const r=data();return r.pinyin==='always'||(r.pinyin==='adaptive'&&!(word in r.hiddenPinyin? r.hiddenPinyin[word]:status(word)==='known'));}
  function wordHTML(seg){
    if(!seg.v&&!Array.from(seg.text).some(isChineseChar))return escapeHtml(seg.text);
    const visible=hintsVisible(seg.text),chars=Array.from(seg.text),parts=seg.py.split(/\s+/);
    const columns=`style="--reading-columns:${chars.length}"`;
    return `<span class="sentence-token ${status(seg.text)==='known'?'token-known':''}"><button class="reading-pinyin-toggle ${visible?'':'pinyin-masked'}" data-r-word="${escapeHtml(seg.text)}" aria-label="${escapeHtml(seg.text)}: ${visible?'hide':'show'} pinyin" title="${visible?'Hide':'Show'} pinyin" aria-pressed="${visible}" ${columns}>${chars.map((ch,i)=>`<span aria-hidden="${!visible}" class="${visible?'':'hint-hidden'}">${escapeHtml(parts[i]||'·')}</span>`).join('')}</button><button class="reading-word-button" data-r-definition="${escapeHtml(seg.text)}" aria-label="Definition and writing: ${escapeHtml(seg.text)}" ${columns}>${chars.map(ch=>`<span lang="zh-Hans">${escapeHtml(ch)}</span>`).join('')}</button></span>`;

  }
  function vocabWords(list=[current()]){return uniq(list.filter(Boolean).flatMap(s=>segments(s.zh,s.py).filter(x=>x.v).map(x=>x.text)));}
  function rstatus(word,next){if(resolveEntry(word))setStatus(word,next);else{data().labels[word]=next;save();}render();}
  function toggleStar(list,value){const a=data()[list];data()[list]=a.includes(value)?a.filter(x=>x!==value):[...a,value];save();render();}
  function render(){
    if(!root)return;const r=data(),list=sentences(),index=position(),sentence=list[index];
    $('readingResumePractice').textContent=r.practice?.mode==='direct'&&r.practice.phase==='quiz'?'Resume quiz':'Quick quiz';
    for(const level of [2,3])$('readingSource').querySelector(`[value="${level}"]`).textContent=`HSK ${level} practice · ${READING_SENTENCES.filter(x=>x.level===level).length.toLocaleString()} sentences`;
    $('readingSource').value=r.source;$('readingPinyinMode').value=r.pinyin;$('readingSentenceInterval').value=String(interval());$('readingQuizCount').value=String(r.quizCount||10);$('readingQuizType').value=r.quizType||'mixed';
    $('readingMode').textContent=r.mode==='sentence'?'Passage view · 10 sentences':'Sentence view';
    const completed=list.filter(x=>r.read.includes(x.id)).length;
    $('readingPosition').textContent=list.length?`${index+1} / ${list.length} sentences · ${completed} read`:'No sentences yet';
    $('readingBar').style.width=list.length?`${completed/list.length*100}%`:'0%';
    $('readingPrev').disabled=!index;$('readingNext').disabled=index>=list.length-1;
    $('readingMarkNext').disabled=!sentence;$('readingListen').disabled=!sentence;
    $('readingStarSentence').disabled=!sentence;$('readingStarSentence').textContent=r.starSentences.includes(sentence?.id)?'★ Saved':'☆ Save sentence';
    const visible=r.mode==='sentence'?[sentence].filter(Boolean):list.slice(Math.floor(index/10)*10,Math.floor(index/10)*10+10);
    $('sentenceCanvas').innerHTML=visible.length?visible.map(s=>`<div class="sentence-paragraph ${s.id===sentence?.id?'current-sentence':''}">${segments(s.zh,s.py).map(wordHTML).join('')}</div>`).join(''):'<p class="small">Choose a reading track, save a sentence, or paste your own text below and choose “Read my text”.</p>';
    const trans=$('sentenceTranslation');trans.hidden=!sentence;
    $('readingTranslationText').hidden=!(translationOpen||r.pin);
    $('readingTranslationText').textContent=sentence?.en||'No sentence translation is bundled for your pasted text. Word meanings are available below; use the full-text translator in the text tools if needed.';
    $('readingTranslateToggle').textContent=translationOpen||r.pin?'Hide translation':'Reveal translation';
    $('readingPinTranslation').textContent=r.pin?'Unpin translation':'Pin translation';$('readingPinTranslation').setAttribute('aria-pressed',String(r.pin));
    const words=vocabWords(),unknown=words.filter(w=>status(w)!=='known'),display=unknown.filter(w=>!selectedWord||w!==selectedWord);
    $('readingWordCount').textContent=`${unknown.length} to learn · ${words.length-unknown.length} known`;
    const chosen=selectedWord&&definition(selectedWord);
    $('readingSelectedWord').hidden=!chosen;
    if(chosen)$('readingSelectedWord').innerHTML=vocabRow(selectedWord,true);
    $('readingVocab').innerHTML=display.map(w=>vocabRow(w)).join('')||'<p class="small">You know the listed vocabulary in this sentence.</p>';
    $('readingReviewWords').disabled=!vocabWords(visible).some(w=>status(w)!=='known'||r.starWords.includes(w));
    const pending=unquizzed(),due=pending.length>0&&(pending.length>=interval()||completed===list.length)&&!r.dismissedCheckpoint?.includes(r.source+':'+completed);
    $('readingIntervalProgress').textContent=`${pending.length} / ${interval()} sentences towards your next quiz · ${Math.max(0,interval()-pending.length)} to go`;
    $('readingCheckpoint').hidden=!due;
    $('readingCheckpointTitle').textContent=completed===list.length?'Reading complete. Put it into practice.':`${pending.length} sentences read. Ready for a quick quiz?`;
    $('readingPinyinNote').textContent=r.pinyin==='adaptive'?'Tap the pinyin or its shaded block to toggle it everywhere. Tap the Chinese word for its definition and writing.':`Pinyin is ${r.pinyin==='always'?'always visible':'hidden'}. Choose Adaptive to remember individual word hints.`;
  }
  function vocabRow(word,selected=false){const v=definition(word),known=status(word)==='known';return `<div class="reading-vocab-row ${selected?'selected-word':''}"><div><strong lang="zh-Hans">${escapeHtml(word)}</strong><span>${escapeHtml(v.pinyin)}</span><p>${escapeHtml(v.english)}</p></div><div class="reading-word-actions"><button data-r-speak="${escapeHtml(word)}" aria-label="Hear ${escapeHtml(word)}">Listen</button><button data-r-star="${escapeHtml(word)}" aria-label="${data().starWords.includes(word)?'Unsave':'Save'} ${escapeHtml(word)}">${data().starWords.includes(word)?'★':'☆'}</button><button data-r-status="${escapeHtml(word)}" data-r-next="${known?'learning':'known'}">${known?'Revisit':'✓ Known'}</button></div></div>`;}
  function move(delta,mark=false){const list=sentences(),r=data();if(!list.length)return;if(mark)r.read=uniq([...r.read,current().id]);r.positions[r.source]=Math.max(0,Math.min(list.length-1,position()+delta));selectedWord='';translationOpen=false;save();render();}
  const interval=()=>Math.min(30,Math.max(10,Number(data().sentenceInterval)||10));
  function unquizzed(){const r=data(),covered=r.quizCovered?.[r.source]||[];return sentences().filter(s=>r.read.includes(s.id)&&!covered.includes(s.id));}
  function recentBlock(){const pending=unquizzed();if(pending.length)return pending.slice(-interval());const r=data(),read=sentences().filter(s=>r.read.includes(s.id));return read.length?read.slice(-interval()):[current()].filter(Boolean);}
  function startPractice(){
    quizSetup=null;const r=data(),pool=vocabWords(recentBlock()).filter(w=>status(w)!=='known'||r.starWords.includes(w));
    if(!pool.length){toast('No unfamiliar or saved words in this reading block. Try Quick quiz to include known words.');return;}
    r.practice={words:pool.slice(0,30),cursor:0,reveal:false,phase:'cards',questions:[],q:0,score:0,total:0,answered:false,order:[],feedback:''};save();openPractice();
  }
  function setupQuiz(){
    const block=recentBlock();localPracticeOptions=vocabWords(block);
    quizSetup={source:data().source,ids:block.map(s=>s.id)};
    const dialog=$('readingPracticeDialog');if(!dialog.open)dialog.showModal();
    $('readingPracticeBody').innerHTML=`<h2 class="reading-quiz-heading">Quick quiz</h2><p class="small reading-quiz-subtitle">All ${localPracticeOptions.length} words from this ${block.length}-sentence block are included. Questions are sampled from the full vocabulary.</p><div class="reading-quiz-settings"><div><label for="readingSetupCount">Maximum questions</label><select id="readingSetupCount">${[5,10,15,20,30].map(n=>`<option value="${n}" ${n===(data().quizCount||10)?'selected':''}>${n}</option>`).join('')}</select></div><div><label for="readingSetupType">Quiz type</label><select id="readingSetupType"><option value="mixed">Mixed · all question types</option><option value="meaning">English → Chinese</option><option value="pinyin">Pinyin → Chinese</option><option value="zh-meaning">Chinese → English</option><option value="py-meaning">Pinyin → English</option></select></div></div><label class="reading-order-setting"><input id="readingSetupOrder" type="checkbox" checked> Include sentence order</label><div class="reading-quiz-footer"><p class="small">All covered words included</p><button class="primary" id="readingQuizStart" ${localPracticeOptions.length?'':'disabled'}>Start quiz →</button></div>`;
    $('readingSetupType').value=data().quizType||'mixed';
  }
  function launchQuiz(){
    if(!quizSetup)return;
    const selected=localPracticeOptions;if(!selected.length)return;
    const r=data();r.quizCount=Number($('readingSetupCount').value);r.quizType=$('readingSetupType').value;
    const words=shuffle(selected).slice(0,r.quizCount),p={mode:'direct',source:quizSetup.source,sentenceIds:quizSetup.ids,words,cursor:words.length,reveal:false,phase:'quiz',questions:[],q:0,score:0,total:0,answered:false,order:[],feedback:''};
    makeQuiz(p,words,READING_SENTENCES.concat(customSentences()).find(s=>s.id===quizSetup.ids.at(-1)),r.quizType,$('readingSetupOrder').checked,r.quizCount);
    p.words=p.questions.filter(q=>q.kind!=='order').map(q=>q.target||q.word);p.cursor=p.words.length;r.practice=p;quizSetup=null;save();renderPractice();
  }
  function finishQuiz(p){if(p.mode!=='direct')return;const r=data();r.quizCovered ||= {};r.quizCovered[p.source]=uniq([...(r.quizCovered[p.source]||[]),...p.sentenceIds]);render();}
  function openPractice(){const dialog=$('readingPracticeDialog');if(!dialog.open)dialog.showModal();renderPractice();}
  function makeQuiz(p,block=p.words.slice(Math.max(0,p.cursor-data().every),p.cursor),sentence=current(),type='mixed',includeOrder=true,limit=31){
    const covered=uniq([...vocabWords(recentBlock()),...p.words]);
    const modes=['meaning','zh-meaning','pinyin','py-meaning'];
    p.questions=block.map((word,i)=>{
      const v=definition(word),kind=type==='mixed'?modes[i%modes.length]:type,englishAnswer=kind.endsWith('-meaning');
      const correct=englishAnswer?v.english:word;
      const usable=w=>{const d=definition(w);return w!==word&&d&&(kind.includes('pinyin')||kind==='py-meaning'?d.pinyin!==v.pinyin:true)&&d.english!==v.english;};
      const familiar=shuffle(covered.filter(usable)),fallback=shuffle(uniq(VOCAB.map(v=>v.word)).filter(w=>usable(w)&&!familiar.includes(w)));
      const distractors=uniq(familiar.concat(fallback).map(w=>englishAnswer?definition(w).english:w)).slice(0,3);
      return {kind,target:word,word:correct,prompt:kind==='meaning'?v.english:kind==='zh-meaning'?word:v.pinyin,options:shuffle([correct,...distractors])};
    });
    const parts=sentence?segments(sentence.zh,sentence.py).filter(s=>s.v).map(s=>s.text):[];
    if(includeOrder&&parts.length>=3&&parts.length<=14){p.questions=p.questions.slice(0,Math.max(0,limit-1));p.questions.push({kind:'order',prompt:sentence.en||'Rebuild the sentence you just read.',answer:parts,options:shuffle(parts.map((text,i)=>({text,id:i})))});}
    p.phase='quiz';p.q=0;p.answered=false;p.order=[];p.feedback='';
  }
  function renderPractice(){
    const p=data().practice;if(!p)return;const shell=$('readingPracticeBody'),total=p.words.length;
    if(p.phase==='cards'){
      const v=definition(p.words[p.cursor]);if(!v){p.phase='summary';return renderPractice();}
      shell.innerHTML=`<span class="card-eyebrow">READING VOCABULARY</span><p class="small">${p.cursor} / ${total} words reviewed</p><button class="reading-study-card" id="readingCardReveal" aria-label="Reveal or hide this word"><span lang="zh-Hans">${escapeHtml(v.word)}</span><strong class="${p.reveal?'':'hint-hidden'}">${escapeHtml(v.pinyin)}</strong><p class="${p.reveal?'':'hint-hidden'}">${escapeHtml(v.english)}</p><small>Tap to reveal</small></button><div class="reading-rating"><button data-reading-rate="new">Revisit</button><button data-reading-rate="learning">Learning</button><button data-reading-rate="known" class="primary">Known</button></div>`;
    }else if(p.phase==='quiz'){
      const q=p.questions[p.q];shell.innerHTML=`<span class="card-eyebrow">QUICK CHECK</span><p class="small">Question ${p.q+1} / ${p.questions.length} · ${p.mode==='direct'?`${p.words.length} words in this quiz`:`${p.cursor} words reviewed`}</p><div class="progressbar reading-quiz-progress"><span style="width:${p.q/p.questions.length*100}%"></span></div><h2 class="reading-question">${escapeHtml(q.prompt)}</h2>${q.kind==='order'?`<p class="small">Tap the words in sentence order. Tap your answer to undo the last word.</p><button id="readingOrderAnswer" class="reading-order-answer" aria-label="Undo last word">${p.order.map(i=>escapeHtml(q.options[i].text)).join(' ')||'Build your sentence here'}</button><div class="reading-order-options">${q.options.map((o,i)=>`<button data-reading-order="${i}" ${p.order.includes(i)||p.answered?'disabled':''}>${escapeHtml(o.text)}</button>`).join('')}</div><button id="readingOrderCheck" ${p.answered||p.order.length!==q.options.length?'disabled':''}>Check sentence</button>`:`<div class="reading-quiz-options ${q.kind.endsWith('-meaning')?'latin-options':''}">${q.options.map((w,i)=>`<button data-reading-answer="${i}" class="${p.answered&&w===q.word?'correct':''}" ${p.answered?'disabled':''}>${escapeHtml(w)}</button>`).join('')}</div>`}<p class="reading-feedback" role="status">${escapeHtml(p.feedback||'')}</p><button class="primary" id="readingQuestionNext" ${p.answered?'':'hidden'}>${p.q+1===p.questions.length?'See results':'Next question'}</button>`;
    }else{
      shell.innerHTML=`<span class="card-eyebrow">PRACTICE COMPLETE</span><h2>${p.mode==='direct'?'Quiz complete!':p.cursor===total?'Nice work. You’re done!':'A little stronger, one block at a time.'}</h2><p>${p.mode==='direct'?`${p.words.length} words practised`:`${p.cursor} / ${total} words reviewed`} · ${p.score} / ${p.total} quiz answers correct</p><button class="primary" id="readingPracticeContinue">${p.cursor<total?'Continue flashcards':'Back to reading'}</button>`;
    }
  }
  function answer(correct,feedback){const p=data().practice;if(p.answered)return;p.answered=true;p.total++;if(correct)p.score++;else{const word=p.questions[p.q].target||p.questions[p.q].word;if(word)rstatus(word,'learning');}p.feedback=feedback;save();renderPractice();}
  let detailWriters=[],detailGeneration=0,detailWord='',detailGuide=true;
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
      $('readingWordWritingNote').textContent=missing.length?`Writing data is not bundled for: ${missing.join('、')}.`:'Trace inside the character pad. Finish one character to move to the next.';
      if(!supported.length){panel.textContent='Writing data is not available for this word.';state.textContent='';return;}
      detailWriters=renderStrokeSurfaces({panel,status:state,wrap:panel.closest('.stroke-panel'),chars:supported,prefix:'readingWordStroke',traceMode:true,startQuiz:true,valid,guideVisible:detailGuide});
    }catch{if(valid()){state.textContent='Writing practice unavailable';panel.textContent='Please check the offline files in Settings.';}}
  }
  function showDetails(word){
    const v=definition(word)||{word,pinyin:'',english:'This word is not in the local reading dictionary.'};
    detailWord=word;detailGuide=true;$('readingWordGuide').textContent='Hide guide';
    $('readingWordHeading').textContent=word;$('readingWordPronunciation').textContent=v.pinyin;$('readingWordMeaning').textContent=v.english;$('readingWordState').textContent=status(word);
    const dialog=$('readingWordDialog');if(!dialog.open)dialog.showModal();renderDetailsWriting();
  }
  function bind(){
    root.addEventListener('click',e=>{
      const details=e.target.closest('[data-r-definition]');if(details){showDetails(details.dataset.rDefinition);return;}
      const token=e.target.closest('[data-r-word]');if(token){const word=token.dataset.rWord;selectedWord=word;data().hiddenPinyin[word]=hintsVisible(word);if(data().pinyin!=='adaptive')data().pinyin='adaptive';save();render();return;}
      const known=e.target.closest('[data-r-status]');if(known){rstatus(known.dataset.rStatus,known.dataset.rNext);return;}
      const star=e.target.closest('[data-r-star]');if(star){toggleStar('starWords',star.dataset.rStar);return;}
      const speak=e.target.closest('[data-r-speak]');if(speak)speakChinese(speak.dataset.rSpeak);
    });
    $('readingSource').onchange=e=>{data().source=e.target.value;selectedWord='';translationOpen=false;save();render();};
    $('readingPinyinMode').onchange=e=>{data().pinyin=e.target.value;save();render();};
    const settingsDialog=$('readingOptions');
    $('readingOptionsToggle').onclick=()=>settingsDialog.showModal();$('readingSettingsClose').onclick=()=>settingsDialog.close();
    let settingsBackdrop=false;const settingsOutside=e=>{const b=settingsDialog.getBoundingClientRect();return e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom;};
    settingsDialog.onpointerdown=e=>{settingsBackdrop=e.target===settingsDialog&&settingsOutside(e);};settingsDialog.onclick=e=>{if(settingsBackdrop&&e.target===settingsDialog&&settingsOutside(e))settingsDialog.close();settingsBackdrop=false;};
    $('readingSentenceInterval').onchange=e=>{data().sentenceInterval=Math.min(30,Math.max(10,Math.round(Number(e.target.value)||10)));save();render();};
    $('readingQuizCount').onchange=e=>{data().quizCount=Number(e.target.value);save();};
    $('readingQuizType').onchange=e=>{data().quizType=e.target.value;save();};
    $('readingMode').onclick=()=>{data().mode=data().mode==='sentence'?'passage':'sentence';save();render();};
    $('readingPrev').onclick=()=>move(-1);$('readingNext').onclick=()=>move(1);$('readingMarkNext').onclick=()=>move(1,true);
    $('readingListen').onclick=()=>{if(current())speakChinese(current().zh);};
    $('readingStarSentence').onclick=()=>{if(current())toggleStar('starSentences',current().id);};
    $('readingTranslateToggle').onclick=()=>{translationOpen=!(translationOpen||data().pin);if(!translationOpen)data().pin=false;save();render();};
    $('readingPinTranslation').onclick=()=>{data().pin=!data().pin;save();render();};
    $('readingUseCustom').onclick=()=>{data().custom=$('inputText').value.slice(0,200000);data().source='custom';data().positions.custom=0;selectedWord='';save();render();root.scrollIntoView({behavior:'smooth',block:'start'});};
    $('readingReviewWords').onclick=startPractice;$('readingCheckpointStart').onclick=setupQuiz;
    $('readingCheckpointDismiss').onclick=()=>{const r=data(),n=sentences().filter(x=>r.read.includes(x.id)).length;r.dismissedCheckpoint=uniq([...(r.dismissedCheckpoint||[]),r.source+':'+n]);save();render();};
    $('readingResumePractice').onclick=()=>{quizSetup=null;if(data().practice?.mode==='direct'&&data().practice.phase==='quiz')openPractice();else setupQuiz();};
    const detail=$('readingWordDialog');
    $('readingWordClose').onclick=()=>detail.close();detail.addEventListener('close',()=>{++detailGeneration;cancelWriters(detailWriters);detailWriters=[];});
    let detailBackdrop=false;const detailOutside=e=>{const r=detail.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    detail.onpointerdown=e=>{detailBackdrop=e.target===detail&&detailOutside(e);};detail.addEventListener('click',e=>{if(detailBackdrop&&e.target===detail&&detailOutside(e))detail.close();detailBackdrop=false;});
    $('readingWordListen').onclick=()=>speakChinese(detailWord);
    $('readingWordKnown').onclick=()=>{rstatus(detailWord,'known');$('readingWordState').textContent=status(detailWord);};
    $('readingWordLearning').onclick=()=>{rstatus(detailWord,'learning');$('readingWordState').textContent=status(detailWord);};
    $('readingWordRetry').onclick=()=>{detailGuide=true;$('readingWordGuide').textContent='Hide guide';renderDetailsWriting();};
    $('readingWordGuide').onclick=()=>{detailGuide=!detailGuide;detailWriters.forEach(w=>detailGuide?w.showOutline():w.hideOutline());$('readingWordGuide').textContent=detailGuide?'Hide guide':'Show guide';};
    const dialog=$('readingPracticeDialog');$('readingPracticeClose').onclick=()=>dialog.close();
    let backdrop=false;const outside=e=>{const b=dialog.getBoundingClientRect();return e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom;};
    dialog.onpointerdown=e=>{backdrop=e.target===dialog&&outside(e);};dialog.addEventListener('click',e=>{if(backdrop&&e.target===dialog&&outside(e))dialog.close();backdrop=false;});
    
    $('readingPracticeBody').onclick=e=>{
      if(e.target.closest('#readingQuizStart')){launchQuiz();return;}
      if(quizSetup)return;
      const p=data().practice;if(!p)return;
      if(e.target.closest('#readingCardReveal')){p.reveal=!p.reveal;save();renderPractice();return;}
      const rate=e.target.closest('[data-reading-rate]');if(rate&&p.phase==='cards'){
        rstatus(p.words[p.cursor],rate.dataset.readingRate);p.cursor++;p.reveal=false;
        if(p.cursor===p.words.length)p.phase='summary';save();renderPractice();return;
      }
      const choice=e.target.closest('[data-reading-answer]');if(choice&&p.phase==='quiz'){const q=p.questions[p.q];answer(q.options[Number(choice.dataset.readingAnswer)]===q.word,`Answer: ${q.target||q.word} · ${definition(q.target||q.word).pinyin} · ${definition(q.target||q.word).english}`);return;}
      const order=e.target.closest('[data-reading-order]');if(order&&!p.answered){p.order.push(Number(order.dataset.readingOrder));save();renderPractice();return;}
      if(e.target.closest('#readingOrderAnswer')&&!p.answered){p.order.pop();save();renderPractice();return;}
      if(e.target.closest('#readingOrderCheck')&&!p.answered){const q=p.questions[p.q];answer(p.order.map(i=>q.options[i].text).join('')===q.answer.join(''),'Sentence: '+q.answer.join(''));return;}
      if(e.target.closest('#readingQuestionNext')){p.q++;p.answered=false;p.order=[];p.feedback='';if(p.q>=p.questions.length){p.phase='summary';finishQuiz(p);}save();renderPractice();return;}
      if(e.target.closest('#readingPracticeContinue')){if(p.cursor<p.words.length){p.phase='cards';save();renderPractice();}else{dialog.close();render();}}
    };
  }
  bind();window.refreshReadingStudio=render;render();
  return {segments,definition,current,sentences,render,startPractice,hintsVisible,showDetails,setupQuiz};
})();
