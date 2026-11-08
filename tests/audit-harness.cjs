/* Synthetic storage only. Exercises lifecycle ordering without touching a user's PWA. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
process.chdir(process.env.HSK_TEST_ROOT||path.resolve(__dirname,'..')); 
const files=['vocabulary.js',...Array.from({length:4},(_,i)=>`reading-dictionary-${i}.js`),'sentences.js','sentences-hsk2.js','sentences-hsk3-0.js','sentences-hsk3-1.js','sentences-hsk3-2.js','sentences-context.js','app.js','reading-studio.js'];
const code=files.map(f=>fs.readFileSync('assets/'+f,'utf8')).join('\n');
function boot(seed={}){const errors=[],navigations=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(/navigation/.test(e.message))navigations.push(e);else errors.push(e)});const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/hsk-reader/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.confirm=()=>true;w.CSS={escape:x=>x};w.TextEncoder=TextEncoder;
 for(const [k,v]of Object.entries(seed))w.localStorage.setItem(k,v);
 w.eval(code+'\nwindow.auditAPI={eval:s=>eval(s)};');return{dom,w,errors,navigations,$:id=>w.document.getElementById(id),run:s=>w.auditAPI.eval(s),snapshot:()=>({...w.localStorage})};}

module.exports={boot};
