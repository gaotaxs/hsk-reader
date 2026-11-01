/* Build and audit original contextual additions using the app's own tokenizer.
   Run with the development jsdom dependency installed (see tests/package.json). */
const fs=require('fs'),path=require('path'),{JSDOM}=(()=>{try{return require('jsdom')}catch{return require('../tests/node_modules/jsdom')}})();
const root=path.resolve(__dirname,'..');process.chdir(root);
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/hsk-reader/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.CSS={escape:x=>x};w.TextEncoder=TextEncoder;
const files=['vocabulary.js',...Array.from({length:4},(_,i)=>`reading-dictionary-${i}.js`),'sentences.js','sentences-hsk2.js','sentences-hsk3-0.js','sentences-hsk3-1.js','sentences-hsk3-2.js','app.js','reading-studio.js'];
w.eval(files.map(f=>fs.readFileSync('assets/'+f,'utf8')).join('\n')+'\nwindow.inspectReading={segments:ReadingStudio.segments,rows:READING_SENTENCES,vocab:RAW_VOCAB};');
const {segments,rows,vocab}=w.inspectReading,crypto=require('crypto');const added=[],seen=new Set(rows.map(s=>s.zh));
function tone(p){return /[àèìòùǜ]/.test(p)?4:/[āēīōūǖ]/.test(p)?1:/[áéíóúǘ]/.test(p)?2:/[ǎěǐǒǔǚ]/.test(p)?3:5;}
for(const line of fs.readFileSync('tools/context-sentences.tsv','utf8').trim().split('\n')){
 const [level,context,zh,en]=line.split('|');if(!en||seen.has(zh))throw Error('Incomplete or duplicate: '+zh);seen.add(zh);
 const fallback={钟:'zhōng',睡:'shuì',见:'jiàn',同:'tóng',词:'cí',并:'bìng',色:'sè',务:'wù',叶:'yè',变:'biàn',怪:'guài',箱:'xiāng',子:'zi',事:'shì',随:'suí',便:'biàn',仅:'jǐn',常:'cháng',停:'tíng',王:'wáng',咬:'yǎo',修:'xiū',拍:'pāi',尝:'cháng',改:'gǎi',戴:'dài',封:'fēng',替:'tì'};
 const chars=[...zh].filter(c=>/[\u3400-\u9fff]/.test(c)),py=segments(zh).filter(s=>/[\u3400-\u9fff]/.test(s.text)).flatMap(s=>s.py?s.py.split(/\s+/):[...s.text].map(c=>fallback[c]||'?'+c));
 if(py.some(x=>x.startsWith('?')))throw Error('Missing pronunciation: '+zh+' '+py.filter(x=>x.startsWith('?')));
 if(chars.length!==py.length)throw Error('Pinyin gap: '+zh+' '+py.join(' '));
 for(let i=0;i<chars.length;i++){
  if(chars[i]==='长'&&zh.includes('长得'))py[i]='zhǎng';
  if(chars[i]==='得'&&(zh.includes('得换')||zh.includes('我们得')))py[i]='děi';
  if(chars[i]==='得'&&zh.includes('我得了'))py[i]='dé';
  if(chars[i]==='还'&&zh.includes('还给'))py[i]='huán';
  if(chars[i]==='差')py[i]='chà';
  if(chars[i]==='只'&&(/^[白黑]?[猫狗]/.test(chars.slice(i+1).join(''))))py[i]='zhī';
  if(chars[i]==='一'&&i<chars.length-1&&(i===0||chars[i-1]!=='第')&&chars.slice(Math.max(0,i-2),i).join('')!=='星期'&&!'二三四五六七八九十百千万年月日号点'.includes(chars[i+1]))py[i]=tone(py[i+1])===4||chars[i+1]==='个'?'yí':'yì';
  if(chars[i]==='不'&&i<chars.length-1&&tone(py[i+1])===4)py[i]='bú';
 }
 added.push({id:'context-'+crypto.createHash('sha256').update(zh).digest('hex').slice(0,14),level:Number(level),zh,py:py.join(' '),en,topic:'Everyday: '+context,context});
}
fs.writeFileSync('assets/sentences-context.js','/* Original everyday contexts; built by tools/build-context-bank.cjs. */\nREADING_SENTENCES.push(...'+JSON.stringify(added)+');\n');
const all=[...rows,...added],tokenized=all.map(s=>({...s,tokens:segments(s.zh,s.py)}));
const entries=vocab.map(v=>{const matching=tokenized.filter(s=>s.level===v.level&&s.tokens.some(t=>t.text===v.word&&(v.word!=='长'||t.py.includes(v.level===2?'cháng':'zhǎng'))));return{word:v.word,pinyin:v.pinyin,level:v.level,sentences:matching.length,contexts:new Set(matching.map(s=>s.topic||'Original examples')).size,ids:matching.slice(0,6).map(s=>s.id)};});
const summary=Object.fromEntries([2,3].map(level=>{const vs=entries.filter(v=>v.level===level);return[level,{sentences:all.filter(s=>s.level===level).length,studyEntries:vs.length,covered:vs.filter(v=>v.sentences>0).length,atLeast3:vs.filter(v=>v.sentences>=3).length,missing:vs.filter(v=>!v.sentences).map(v=>v.word)}];}));
fs.writeFileSync('tools/vocabulary-coverage.json',JSON.stringify({method:'Exact reader tokens in the matching study track; distinct sentences, with separate 长 readings. Contexts are source topic/pattern labels, not independent linguistic certification.',summary,entries},null,2)+'\n');console.log(JSON.stringify({added:added.length,summary},null,2));dom.window.close();
