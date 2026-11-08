/* Lifecycle UI deliberately remains separate from study-state logic. */
(()=>{
  const status=document.getElementById('offlineStatus'),update=document.getElementById('updateAppBtn');
  const prefix='hsk-reader-studio-'+encodeURIComponent(new URL('./',location.href).pathname)+'-';
  let registration=null,reloading=false,refreshGeneration=0;
  document.getElementById('appVersion').textContent='Running version '+HSK_RELEASE.version;
  const network=()=>{document.getElementById('connectionStatus').hidden=navigator.onLine;};
  network();window.addEventListener('online',network);window.addEventListener('offline',network);
  async function refresh(){
    const generation=++refreshGeneration;
    try{
      const name=prefix+HSK_RELEASE.version,exists=(await caches.keys()).includes(name);
      let ready=false;
      // Never open a missing cache: diagnostics must not create or repair caches.
      if(registration?.active?.state==='activated'&&exists){
        const cache=await caches.open(name);
        const entries=await Promise.all(HSK_RELEASE.assets.map(path=>cache.match(new URL(path,location.href).href)));
        ready=entries.every(response=>response?.ok&&response.type!=='opaque');
      }
      if(generation!==refreshGeneration)return;
      status.textContent=ready?'Offline copy ready for '+HSK_RELEASE.version+', including all 622 writing characters. Your browser may remove site data under storage pressure.':'Offline copy incomplete for '+HSK_RELEASE.version+'. Reconnect and use Repair offline copy if it remains incomplete.';
      waiting();
    }catch{if(generation===refreshGeneration){status.textContent='Could not verify offline files. Study progress can still be exported.';waiting();}}
  }
  function waiting(){if(registration?.waiting){update.hidden=false;status.textContent='A new version is ready. Choose Reload to update when you are ready to reload.';}}
  if(!('serviceWorker' in navigator)||!window.isSecureContext){
    status.textContent='Offline installation requires HTTPS (or localhost). Open the deployed GitHub Pages address.';
    document.getElementById('checkUpdateBtn').disabled=true;document.getElementById('repairCacheBtn').disabled=true;return;
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading)location.reload();else refresh();
  });
  update.onclick=()=>{if(!registration)return;if(!saveReaderDraft()){toast('Export your backup before updating; local saving is unavailable.');return;}if(!saveExtras()){toast('Export your backup before updating; local saving is unavailable.');return;}reloading=true;if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});else location.reload();};
  document.getElementById('checkUpdateBtn').onclick=async()=>{
    if(!navigator.onLine){toast('Reconnect to check for updates.');return;}
    try{await registration?.update();await refresh();waiting();toast(registration?.waiting?'Reload to install the downloaded update.':'Update check requested. A button appears when a new version is ready.');}catch{toast('Could not check for updates. Try again when connected.');}
  };
  document.getElementById('repairCacheBtn').onclick=async()=>{
    if(!navigator.onLine){toast('Reconnect before repairing the offline copy.');return;}
    if(!confirm('Re-download this app’s offline files and reload? Your study progress stays on this device.'))return;
    if(!saveReaderDraft()||!saveExtras())return;
    try{
      if(registration)await registration.unregister();
      for(const key of await caches.keys())if(key.startsWith(prefix))await caches.delete(key);
      location.reload();
    }catch{toast('Could not repair the offline copy. Your progress has not been cleared.');}
  };
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
    registration=reg;waiting();refresh();
    const watch=()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();if(worker.state==='activated')refresh();if(worker.state==='redundant')status.textContent='Offline setup did not finish. Reconnect and try Repair offline copy.';});};
    watch();reg.addEventListener('updatefound',watch);
    navigator.serviceWorker.ready.then(refresh);
  }).catch(()=>{status.textContent='Offline setup failed. Check the uploaded files, then try again while online.';});
})();
