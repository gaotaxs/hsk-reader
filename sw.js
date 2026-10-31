/* Increment VERSION for every release that changes any cached file.
   Install the complete release atomically; activate only after user accepts an update. */
const VERSION='1.5.0';
const CACHE_PREFIX='hsk-reader-studio-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE_NAME=CACHE_PREFIX+VERSION;
const APP_SHELL=['./index.html','./manifest.json','./assets/app.css','./assets/vocabulary.js','./assets/app.js','./assets/pwa.js','./vendor/hanzi-writer-3.7.3.min.js','./vendor/characters.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./vendor/noto/1f440.svg','./vendor/noto/1f440.webp','./vendor/noto/1f4a1.svg','./vendor/noto/1f4a1.webp','./vendor/noto/1f4ac.svg','./vendor/noto/1f4ac.webp','./vendor/noto/1f4da.svg','./vendor/noto/1f4da.webp','./vendor/noto/1f9e0.svg','./vendor/noto/1f9e0.webp','./vendor/noto/2699_fe0f.svg','./vendor/noto/2699_fe0f.webp','./vendor/noto/NOTICE.txt'];
const URLS=APP_SHELL.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  try {await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));}
  catch(error){await caches.delete(CACHE_NAME);throw error;}
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const documentURL=new URL('./index.html',self.registration.scope).href;
  const scopeURL=self.registration.scope;
  if(request.mode==='navigate'&&(url.pathname===new URL(scopeURL).pathname||url.pathname===new URL(documentURL).pathname)){
    event.respondWith(caches.open(CACHE_NAME).then(async cache=>(await cache.match(documentURL))||fetch(request)));return;
  }
  // Only this release's explicit local assets are cached. Never cache translation queries.
  if(URLS.includes(url.href))event.respondWith(caches.open(CACHE_NAME).then(async cache=>(await cache.match(request))||fetch(request)));
});
