import { firebaseConfig } from './firebase-config.js';

const root=document.getElementById('publishedRoot');
const params=new URLSearchParams(location.search); const publicId=params.get('id')||'';
let deferredInstallPrompt=null; let published=null; let project=null; let currentRecord=0; let logs=[];

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.querySelector('[data-install]');if(b){b.hidden=false;b.textContent='Install app';}});
window.addEventListener('appinstalled',()=>{const b=document.querySelector('[data-install]');if(b)b.hidden=true;});

function esc(s){return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function attr(s){return esc(s).replace(/'/g,'&#39;');}
function nameOfComponent(id){return project?.components?.find(c=>c.id===id)?.name||'component';}
function log(t){logs.push(t);if(logs.length>6)logs.shift();const el=document.querySelector('.debug-mini');if(el)el.textContent=logs.at(-1)||'';}

async function ensureServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
    await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller){
      await new Promise(resolve=>{const timer=setTimeout(resolve,1800);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});});
    }
  }catch(err){console.warn('Service worker unavailable',err);}
}

async function loadPublishedApp(id){
  const cacheKey=`dataapp_public_${id}`;
  try{
    const appSdk=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js');
    const dbSdk=await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
    const app=appSdk.initializeApp(firebaseConfig,`published-${id.slice(0,8)}`);
    const db=dbSdk.getFirestore(app);
    const snap=await dbSdk.getDoc(dbSdk.doc(db,'publishedApps',id));
    if(!snap.exists()||snap.data().published!==true)throw new Error('This app is not published.');
    const data={id:snap.id,...snap.data()};
    localStorage.setItem(cacheKey,JSON.stringify(data));
    return data;
  }catch(err){
    const cached=localStorage.getItem(cacheKey);
    if(cached){console.warn('Using cached published app',err);return JSON.parse(cached);}
    throw err;
  }
}

function attachManifest(app){
  const manifestUrl=new URL('./app.webmanifest',location.href);
  const p=manifestUrl.searchParams;
  p.set('id',publicId);p.set('name',app.appName||'My App');p.set('short',(app.appName||'My App').slice(0,12));
  p.set('theme',app.theme||'#6256df');p.set('orientation',app.orientation||'any');
  p.set('icon192',app.icon192||app.icon512||'');p.set('icon512',app.icon512||app.icon192||'');
  let link=document.querySelector('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link);}link.href=manifestUrl.href;
  let icon=document.querySelector('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon);}icon.href=app.icon192||app.icon512||'';
  const meta=document.querySelector('meta[name="theme-color"]')||document.head.appendChild(Object.assign(document.createElement('meta'),{name:'theme-color'}));meta.content=app.theme||'#6256df';
}

function componentMarkup(c){
  const style=`left:${Number(c.x)||0}px;top:${Number(c.y)||0}px;width:${Number(c.w)||100}px;height:${Number(c.h)||44}px;`;
  let inner='';
  if(c.type==='label')inner=`<div class="label" style="font-size:${Number(c.fontSize)||16}px;text-align:${attr(c.align||'left')}">${esc(c.text||'Label')}</div>`;
  if(c.type==='button')inner=`<button>${esc(c.text||'Button')}</button>`;
  if(c.type==='image')inner=`<img src="${attr(c.src||'')}" alt="">`;
  if(c.type==='input')inner=`<input placeholder="${attr(c.text||'Type here...')}">`;
  if(c.type==='list')inner='<div class="listbox"><div>Item 1</div><div>Item 2</div><div>Item 3</div></div>';
  return `<div class="public-component" data-component="${attr(c.id)}" style="${style}">${inner}</div>`;
}

function render(){
  document.title=published.appName||project.name||'My App';
  root.className='';
  root.innerHTML=`<div class="public-shell"><header class="public-topbar"><div class="public-brand"><img src="${attr(published.icon192||published.icon512||'')}" alt=""><span>${esc(published.appName||project.name)}</span></div><div class="public-actions"><button class="public-btn" data-share>Share</button><button class="public-btn primary" data-install>Install app</button></div></header><section class="public-stage"><div class="public-device"><div class="public-screen">${(project.components||[]).map(componentMarkup).join('')}</div></div></section><div class="debug-mini">App ready</div></div>`;
  document.querySelectorAll('.public-component button').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.closest('[data-component]').dataset.component;log(`${nameOfComponent(id)} clicked`);runEvent('click',id);renderComponents();}));
  document.querySelector('[data-install]').onclick=installApp;
  document.querySelector('[data-share]').onclick=shareApp;
}

function renderComponents(){
  for(const c of project.components||[]){
    const el=document.querySelector(`[data-component="${CSS.escape(c.id)}"]`);if(!el)continue;
    if(c.type==='label'){const lab=el.querySelector('.label');if(lab)lab.textContent=c.text||'';}
    if(c.type==='button'){const b=el.querySelector('button');if(b)b.textContent=c.text||'Button';}
    if(c.type==='image'){const img=el.querySelector('img');if(img)img.src=c.src||'';}
  }
  const dbg=document.querySelector('.debug-mini');if(dbg)dbg.textContent=logs.at(-1)||`Record ${currentRecord+1}`;
}

function runEvent(kind,component=null){
  let active=false;
  for(const b of project.program||[]){
    if(b.type==='event_open'){active=kind==='open';continue;}
    if(b.type==='event_click'){active=kind==='click'&&b.component===component;continue;}
    if(!active)continue;
    if(b.type==='first_record'){currentRecord=0;log('Moved to first record');}
    if(b.type==='next_record'&&project.records?.length){currentRecord=(currentRecord+1)%project.records.length;log(`Moved to record ${currentRecord+1}`);}
    if(b.type==='prev_record'&&project.records?.length){currentRecord=(currentRecord-1+project.records.length)%project.records.length;log(`Moved to record ${currentRecord+1}`);}
    if(b.type==='set_field')applyField(b.target,b.field);
    if(b.type==='set_text')applyText(b.target,b.text);
  }
}
function applyField(targetId,fieldId){
  const c=project.components?.find(x=>x.id===targetId),r=project.records?.[currentRecord];if(!c||!r)return;
  const value=r[fieldId]??'';if(c.type==='image')c.src=String(value);else c.text=String(value);log(`${c.name||'Component'} updated from database`);
}
function applyText(targetId,text){const c=project.components?.find(x=>x.id===targetId);if(c&&c.type!=='image')c.text=String(text||'');}

async function installApp(){
  if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;return;}
  showInstallHelp();
}
function showInstallHelp(){
  document.querySelector('.install-help')?.remove();
  const box=document.createElement('div');box.className='install-help';box.innerHTML='<button aria-label="Close">×</button><strong>Install this app on Android</strong><p>In Chrome, open the ⋮ menu and choose <b>Install app</b> or <b>Add to Home screen</b>. The app will use the icon chosen by its creator.</p>';document.body.appendChild(box);box.querySelector('button').onclick=()=>box.remove();
}
async function shareApp(){
  if(navigator.share){try{await navigator.share({title:published.appName||'My App',url:location.href});return;}catch{}}
  try{await navigator.clipboard.writeText(location.href);alert('App link copied.');}catch{prompt('Copy this app link:',location.href);}
}

(async()=>{
  if(!publicId){root.className='published-error';root.textContent='This app link is missing its app ID.';return;}
  try{
    await ensureServiceWorker();
    published=await loadPublishedApp(publicId); project=published.snapshot;
    if(!project)throw new Error('Published project data is missing.');
    attachManifest(published);render();currentRecord=0;runEvent('open');renderComponents();
  }catch(err){console.error(err);root.className='published-error';root.innerHTML=`<div><h1>App unavailable</h1><p>${esc(err.message||'This app could not be loaded.')}</p></div>`;}
})();
