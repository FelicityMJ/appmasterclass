import { firebaseConfig } from './firebase-config.js';
import { apiServiceInfo, fetchApiResponse } from './api-connectors.js';

const root = document.getElementById('publishedRoot');
const params = new URLSearchParams(location.search);
const publicId = params.get('id') || '';
const DESIGN_WIDTH = 320;
const DESIGN_HEIGHT = 630;

let deferredInstallPrompt = null;
let published = null;
let project = null;
let currentRecord = 0;
let currentPageId = 'screen1';
let pageHistory = [];
let hasInteracted = false;
let runtimeRecords = [];
let runtimeValues = {};
let runtimeVisibility = {};
let runtimeVariables = {};
let runtimeApiResult = {};
let runtimeApiRows = [];
let runtimeApiSuccess = false;
let runtimeApiError = '';

function isIOSDevice() {
  const ua = navigator.userAgent || '';
  const classicIOS = /iPad|iPhone|iPod/.test(ua);
  const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return classicIOS || iPadDesktopMode;
}
function isStandaloneMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}
function installButtonLabel() {
  if (isIOSDevice()) return 'Add to Home Screen';
  if (deferredInstallPrompt) return 'Install app';
  return 'Install on phone';
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const button = document.querySelector('[data-install]');
  if (button) {
    button.hidden = false;
    button.textContent = installButtonLabel();
  }
});
window.addEventListener('appinstalled', () => {
  const button = document.querySelector('[data-install]');
  if (button) button.hidden = true;
});
window.addEventListener('resize', resizePublishedCanvas);

function esc(value) {
  return String(value ?? '').replace(/[&<>\"]/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[match]));
}
function attr(value) { return esc(value).replace(/'/g, '&#39;'); }
function pageName(id) { return project?.pages?.find(page => page.id === id)?.name || 'Page'; }
function nameOfComponent(id) { return project?.components?.find(component => component.id === id)?.name || 'component'; }
function log(text) { console.debug('[DataApp]', text); }

function normaliseProject() {
  if (!Array.isArray(project.pages) || !project.pages.length) {
    project.pages = [{id:'screen1', name:'Home', backgroundColor:'#ffffff'}];
  }
  project.pages = project.pages.map(page => ({...page, backgroundColor:page.backgroundColor || '#ffffff'}));
  const first = project.pages[0].id;
  project.fields = Array.isArray(project.fields) ? project.fields : [];
  project.apiService = project.apiService || 'weather';
  for (const field of project.fields) if (field.type === 'text') field.type = 'shortText';
  for (const component of project.components || []) {
    if (!component.pageId) component.pageId = first;
    if (component.visible === undefined) component.visible = true;
    if (['textInput','numberInput','dropdown','switch','slider'].includes(component.type)) {
      if (component.placeholder === undefined) component.placeholder = component.type === 'numberInput' ? 'Enter a number' : 'Type here...';
      if (component.defaultValue === undefined) component.defaultValue = component.type === 'switch' ? false : component.type === 'slider' ? 50 : '';
      if (component.dataField === undefined) component.dataField = '';
      if (component.type === 'dropdown' && component.options === undefined) component.options = 'Option 1\nOption 2\nOption 3';
      if (component.type === 'slider') { if (component.min === undefined) component.min = 0; if (component.max === undefined) component.max = 100; if (component.step === undefined) component.step = 1; }
    }
    if (['label','input','image'].includes(component.type)) {
      component.contentSource = component.contentSource || (component.apiField ? 'api' : 'fixed');
      component.apiField = component.apiField || '';
    }
    if (component.type === 'list') {
      component.listLayout = component.listLayout || 'image-title-subtitle';
      component.listDataSource = component.listDataSource || 'database';
      component.listImageField = component.listImageField || '';
      component.listTitleField = component.listTitleField || '';
      component.listSubtitleField = component.listSubtitleField || '';
      component.listTransparent = Boolean(component.listTransparent);
      component.navigateToPage = component.navigateToPage || '';
    }
  }
  for (const block of project.program || []) {
    if (block.type === 'event_open' && !block.page) block.page = first;
  }
  currentPageId = first;
}

function cacheKey(id) { return `dataapp_public_${id}`; }
function readCachedApp(id) {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveCachedApp(id, data) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(data)); } catch {}
}

async function fetchPublishedApp(id) {
  const appSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js');
  const dbSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
  const app = appSdk.initializeApp(firebaseConfig, `published-${id.slice(0, 8)}`);
  const db = dbSdk.getFirestore(app);
  const snap = await dbSdk.getDoc(dbSdk.doc(db, 'publishedApps', id));
  if (!snap.exists() || snap.data().published !== true) throw new Error('This app is not published.');
  const data = {id:snap.id, ...snap.data()};
  saveCachedApp(id, data);
  return data;
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js', {scope:'./'});
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1800);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timer);
          resolve();
        }, {once:true});
      });
    }
  } catch (error) {
    console.warn('Service worker unavailable', error);
  }
}

function attachManifest(app) {
  const manifestUrl = new URL('./app.webmanifest', location.href);
  const query = manifestUrl.searchParams;
  query.set('id', publicId);
  query.set('name', app.appName || 'My App');
  query.set('short', (app.appName || 'My App').slice(0, 12));
  query.set('theme', app.theme || '#6256df');
  query.set('bg', project?.pages?.[0]?.backgroundColor || '#ffffff');
  query.set('orientation', app.orientation || 'any');
  query.set('icon192', app.icon192 || app.icon512 || '');
  query.set('icon512', app.icon512 || app.icon192 || '');
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = manifestUrl.href;
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.href = app.icon192 || app.icon512 || '';
  let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = app.icon192 || app.icon512 || '';
  const meta = document.querySelector('meta[name="theme-color"]') || document.head.appendChild(Object.assign(document.createElement('meta'), {name:'theme-color'}));
  meta.content = app.theme || '#6256df';
}

function prepareInstallManifest() {
  ensureServiceWorker().then(() => {
    if (published && project) attachManifest(published);
  });
}


function cloneData(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
function runtimeDataKey() { return `dataapp_runtime_records_${publicId}`; }
function loadRuntimeRecords() {
  try { const raw = localStorage.getItem(runtimeDataKey()); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveRuntimeRecords() { try { localStorage.setItem(runtimeDataKey(), JSON.stringify(runtimeRecords)); } catch {} }
function interactiveComponentType(type) { return ['textInput','numberInput','dropdown','switch','slider'].includes(type); }
function dropdownOptions(component) { return String(component.options || 'Option 1\nOption 2\nOption 3').split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean).slice(0,30); }
function initialInteractiveValue(component) { if (component.type === 'dropdown') { const opts=dropdownOptions(component); return opts.includes(String(component.defaultValue??'')) ? String(component.defaultValue) : (opts[0]||''); } return component.defaultValue ?? (component.type === 'switch' ? false : component.type === 'slider' ? Number(component.min ?? 0) : ''); }
function usePublishedData(data, {resetRuntime=true} = {}) {
  published = data;
  project = typeof structuredClone === 'function' ? structuredClone(data.snapshot) : JSON.parse(JSON.stringify(data.snapshot));
  if (!project) throw new Error('Published project data is missing.');
  normaliseProject();
  if (resetRuntime) {
    currentRecord = 0;
    pageHistory = [];
    runtimeRecords = loadRuntimeRecords() || cloneData(project.records || []);
    runtimeValues = {}; runtimeVisibility = {}; runtimeVariables = {}; runtimeApiResult = {}; runtimeApiRows = []; runtimeApiSuccess = false; runtimeApiError = '';
    for (const component of project.components || []) {
      runtimeVisibility[component.id] = component.visible !== false;
      if (interactiveComponentType(component.type)) runtimeValues[component.id] = initialInteractiveValue(component);
    }
  }
}

function fieldById(id) { return project.fields?.find(field => field.id === id); }
function ratingStars(value) {
  const count = Math.max(0, Math.min(10, Number(value) || 0));
  return '★'.repeat(count) + '☆'.repeat(10 - count);
}
function formatValue(id, value) {
  return fieldById(id)?.type === 'rating' ? ratingStars(value) : String(value ?? '');
}

function listRowsMarkup(component) {
  const apiSource = component.listDataSource === 'api';
  const rows = apiSource ? (runtimeApiRows || []) : (runtimeRecords || []);
  if (!rows.length) return `<div class="list-empty">${apiSource ? 'Search to load live results' : 'No database records'}</div>`;
  return rows.map((record, index) => {
    const image = component.listImageField ? String(record[component.listImageField] ?? '') : '';
    const title = component.listTitleField ? (apiSource ? String(record[component.listTitleField] ?? '') : formatValue(component.listTitleField, record[component.listTitleField])) : '';
    const subtitle = component.listSubtitleField ? (apiSource ? String(record[component.listSubtitleField] ?? '') : formatValue(component.listSubtitleField, record[component.listSubtitleField])) : '';
    return `<div class="data-list-row layout-${attr(component.listLayout || 'image-title-subtitle')}" data-list-index="${index}">
      ${component.listLayout?.includes('image') ? `<div class="list-row-image">${image ? `<img src="${attr(image)}" alt="">` : '<span>🖼️</span>'}</div>` : ''}
      ${component.listLayout !== 'image-only' ? `<div class="list-row-copy">${component.listLayout?.includes('title') ? `<strong>${esc(title || `${apiSource ? 'Result' : 'Record'} ${index + 1}`)}</strong>` : ''}${component.listLayout?.includes('subtitle') ? `<span>${esc(subtitle)}</span>` : ''}</div>` : ''}
      ${component.navigateToPage ? '<div class="list-row-arrow">›</div>' : ''}
    </div>`;
  }).join('');
}

function componentMarkup(component) {
  const hidden = runtimeVisibility[component.id] === false;
  const style = `left:${Number(component.x) || 0}px;top:${Number(component.y) || 0}px;width:${Number(component.w) || 100}px;height:${Number(component.h) || 44}px;${hidden?'display:none;':''}`;
  const textColour = attr(component.textColor || '#172033');
  const background = attr(component.backgroundColor || 'transparent');
  const directApi = component.contentSource === 'api' && component.apiField;
  const apiRaw = directApi ? runtimeApiResult?.[component.apiField] : undefined;
  const apiValue = directApi ? (apiRaw !== undefined && apiRaw !== null && apiRaw !== '' ? apiRaw : (component.type === 'image' ? (component.src || '') : '')) : '';
  let inner = '';
  if (component.type === 'label') inner = `<div class="label align-${attr(component.align || 'left')}" style="font-size:${Number(component.fontSize) || 16}px;text-align:${attr(component.align || 'left')};color:${textColour};background:${background}">${esc(directApi ? apiValue : (component.text || 'Label'))}</div>`;
  if (component.type === 'button') inner = `<button style="background:${attr(component.backgroundColor || '#5b5ce2')};color:${attr(component.textColor || '#ffffff')}">${esc(component.text || 'Button')}</button>`;
  if (component.type === 'image') inner = `<img src="${attr(directApi ? apiValue : (component.src || ''))}" alt="">`;
  if (component.type === 'input') inner = `<div class="text-box-component" style="background:${attr(component.backgroundColor || '#ffffff')};color:${textColour}">${esc(directApi ? apiValue : (component.text || 'Long text appears here'))}</div>`;
  if (component.type === 'textInput') inner = `<input class="interactive-input" data-interactive-value type="text" placeholder="${attr(component.placeholder||'Type here...')}" value="${attr(runtimeValues[component.id]??'')}" style="background:${background};color:${textColour}">`;
  if (component.type === 'numberInput') inner = `<input class="interactive-input" data-interactive-value type="number" placeholder="${attr(component.placeholder||'Enter a number')}" value="${attr(runtimeValues[component.id]??'')}" style="background:${background};color:${textColour}">`;
  if (component.type === 'dropdown') { const value=String(runtimeValues[component.id]??''),opts=dropdownOptions(component); inner=`<select class="interactive-input" data-interactive-value style="background:${background};color:${textColour}">${opts.map((o,i)=>`<option value="${attr(o)}" ${(value===o||(!value&&i===0))?'selected':''}>${esc(o)}</option>`).join('')}</select>`; }
  if (component.type === 'switch') { const checked=runtimeValues[component.id]===true||String(runtimeValues[component.id])==='true'; inner=`<label class="switch-component" style="background:${background};color:${textColour}"><input data-interactive-value type="checkbox" ${checked?'checked':''}><span class="switch-track"><span></span></span><b>${esc(component.text||'On / Off')}</b></label>`; }
  if (component.type === 'slider') { const value=Number(runtimeValues[component.id]??component.min??0); inner=`<div class="slider-component" style="background:${background};color:${textColour}"><input data-interactive-value type="range" min="${Number(component.min??0)}" max="${Number(component.max??100)}" step="${Number(component.step??1)}" value="${Number.isFinite(value)?value:0}"><span class="slider-value">${Number.isFinite(value)?value:0}</span></div>`; }
  if (component.type === 'list') { const transparent = component.listBackground === 'transparent' || component.listTransparent === true; inner = `<div class="listbox database-list ${transparent ? 'transparent-list' : ''}" style="${transparent ? 'background:transparent;' : ''}">${listRowsMarkup(component)}</div>`; }
  return `<div class="public-component" data-component="${attr(component.id)}" style="${style}">${inner}</div>`;
}

function componentsOnPage() {
  return (project.components || []).filter(component => (component.pageId || project.pages[0].id) === currentPageId);
}

function render() {
  document.title = published.appName || project.name || 'My App';
  root.className = '';
  const pageBackground = project.pages.find(page => page.id === currentPageId)?.backgroundColor || '#ffffff';
  document.documentElement.style.background = pageBackground;
  document.body.style.background = pageBackground;
  root.innerHTML = `<div class="public-shell" style="background:${attr(pageBackground)}">
    <header class="public-topbar">
      <div class="public-brand"><img src="${attr(published.icon192 || published.icon512 || '')}" alt=""><span>${esc(published.appName || project.name)}</span></div>
      <div class="public-actions"><button class="public-btn" data-share>Share</button>${isStandaloneMode()?'':`<button class="public-btn primary" data-install>${esc(installButtonLabel())}</button>`}</div>
    </header>
    <section class="public-stage" style="background:${attr(pageBackground)}">
      <div class="public-canvas-wrap" data-canvas-wrap>
        <div class="public-device" data-canvas>
          <div class="public-screen" style="background:${attr(pageBackground)}" data-page="${attr(currentPageId)}">
            ${componentsOnPage().map(componentMarkup).join('')}
          </div>
        </div>
      </div>
    </section>
  </div>`;

  document.querySelectorAll('.public-component button').forEach(button => button.addEventListener('click', async () => {
    hasInteracted = true;
    const id = button.closest('[data-component]').dataset.component;
    log(`${nameOfComponent(id)} clicked`);
    await runEvent('click', id, {pageId:currentPageId});
    render();
  }));
  document.querySelectorAll('.public-component [data-list-index]').forEach(row => row.addEventListener('click', async () => {
    hasInteracted = true;
    const host = row.closest('[data-component]');
    const id = host?.dataset.component;
    const index = Number(row.dataset.listIndex);
    if (!id || Number.isNaN(index)) return;
    const component = project.components.find(item => item.id === id);
    const before = currentPageId;
    if (component?.listDataSource === 'api') {
      runtimeApiResult = runtimeApiRows[index] || runtimeApiResult;
      log(`${nameOfComponent(id)} selected live result ${index + 1}`);
    } else {
      currentRecord = index;
      log(`${nameOfComponent(id)} selected record ${index + 1}`);
    }
    await runEvent('list_click', id, {pageId:before, index});
    if (currentPageId === before && component?.navigateToPage) await navigate(component.navigateToPage, true);
    else render();
  }));
  document.querySelectorAll('.public-component [data-interactive-value]').forEach(control => {
    const host=control.closest('[data-component]'),id=host?.dataset.component,component=project.components.find(item=>item.id===id);if(!id||!component)return;
    control.addEventListener('change',async()=>{hasInteracted=true;let value=control.type==='checkbox'?control.checked:control.value;if(['numberInput','slider'].includes(component.type)&&value!=='')value=Number(value);runtimeValues[id]=value;await runEvent('change',id,{pageId:currentPageId});render();});
    if(component.type==='slider')control.addEventListener('input',()=>{runtimeValues[id]=Number(control.value);const out=host.querySelector('.slider-value');if(out)out.textContent=control.value;});
  });
  const install = document.querySelector('[data-install]');
  const share = document.querySelector('[data-share]');
  if (install) install.onclick = installApp;
  if (share) share.onclick = shareApp;
  requestAnimationFrame(resizePublishedCanvas);
}

function renderComponents() {
  for (const component of componentsOnPage()) {
    const element = document.querySelector(`[data-component="${CSS.escape(component.id)}"]`);
    if (!element) continue;
    element.style.display = runtimeVisibility[component.id] === false ? 'none' : '';
    if (component.type === 'label') { const label = element.querySelector('.label'); if (label) label.textContent = component.text || ''; }
    if (component.type === 'button') { const button = element.querySelector('button'); if (button) button.textContent = component.text || 'Button'; }
    if (component.type === 'image') { const image = element.querySelector('img'); if (image) image.src = component.src || ''; }
    if (component.type === 'input') { const box=element.querySelector('.text-box-component');if(box)box.textContent=component.text||''; }
    if (interactiveComponentType(component.type)) { const control=element.querySelector('[data-interactive-value]');if(control){if(control.type==='checkbox')control.checked=runtimeValues[component.id]===true;else control.value=runtimeValues[component.id]??'';} }
  }
}

function resizePublishedCanvas() {
  const stage = document.querySelector('.public-stage');
  const canvas = document.querySelector('[data-canvas]');
  const wrap = document.querySelector('[data-canvas-wrap]');
  if (!stage || !canvas || !wrap) return;
  const stageWidth = Math.max(1, stage.clientWidth);
  const stageHeight = Math.max(1, stage.clientHeight);
  const scale = Math.min(stageWidth / DESIGN_WIDTH, stageHeight / DESIGN_HEIGHT);
  const safeScale = Math.max(0.1, scale);
  wrap.style.width = `${DESIGN_WIDTH * safeScale}px`;
  wrap.style.height = `${DESIGN_HEIGHT * safeScale}px`;
  canvas.style.transform = `scale(${safeScale})`;
}

async function navigate(pageId, push=true) {
  if (!project.pages.some(page => page.id === pageId) || pageId === currentPageId) return;
  if (push) pageHistory.push(currentPageId);
  currentPageId = pageId;
  log(`${pageName(pageId)} opened`);
  render();
  await runEvent('open', null, {pageId});
  render();
}
async function goBack() {
  const previous = pageHistory.pop();
  if (previous) await navigate(previous, false);
}

function parseLiteral(value){const text=String(value??'').trim();if(/^[-+]?\d+(\.\d+)?$/.test(text))return Number(text);if(/^true$/i.test(text))return true;if(/^false$/i.test(text))return false;return value??'';}
function compareRuntime(actual,operator,expected){const right=parseLiteral(expected);let left=actual;if(typeof right==='number'&&left!==''&&!Number.isNaN(Number(left)))left=Number(left);if(operator==='eq')return String(left)===String(right);if(operator==='neq')return String(left)!==String(right);if(operator==='contains')return String(left).toLowerCase().includes(String(right).toLowerCase());if(operator==='gt')return Number(left)>Number(right);if(operator==='lt')return Number(left)<Number(right);if(operator==='gte')return Number(left)>=Number(right);if(operator==='lte')return Number(left)<=Number(right);return false;}
function defaultValueForField(field){return ['number','rating'].includes(field?.type)?0:field?.type==='boolean'?false:'';}
function formValueForField(value,field){if(field?.type==='number')return Number(value)||0;if(field?.type==='rating')return Math.max(0,Math.min(10,Math.round(Number(value)||0)));if(field?.type==='boolean')return value===true||String(value).toLowerCase()==='true'||String(value)==='1';return String(value??'');}
function applyFormInputs(record){for(const component of project.components||[]){if(!interactiveComponentType(component.type)||!component.dataField||(component.pageId||project.pages[0]?.id)!==currentPageId)continue;const field=fieldById(component.dataField);if(field)record[field.id]=formValueForField(runtimeValues[component.id],field);}}
function fillAutomaticId(record){const first=project.fields?.[0];if(!first)return;const mapped=(project.components||[]).some(c=>interactiveComponentType(c.type)&&c.dataField===first.id&&(c.pageId||project.pages[0]?.id)===currentPageId);if(mapped)return;if(first.type==='number')record[first.id]=Math.max(0,...runtimeRecords.map(r=>Number(r[first.id])||0))+1;else if(/(^|_)id$|\bid\b/i.test(`${first.id} ${first.name||''}`))record[first.id]=String(runtimeRecords.length+1);}
function applyRuntimeValueToTarget(targetId,value){const component=project.components?.find(item=>item.id===targetId);if(!component)return;if(interactiveComponentType(component.type))runtimeValues[component.id]=value;else if(component.type==='image')component.src=String(value??'');else if(component.type!=='list')component.text=String(value??'');}
async function executeActions(actions=[]){
  for(const block of actions){
    if(block.type==='first_record'){currentRecord=0;continue;}
    if(block.type==='next_record'&&runtimeRecords.length){currentRecord=(currentRecord+1)%runtimeRecords.length;continue;}
    if(block.type==='prev_record'&&runtimeRecords.length){currentRecord=(currentRecord-1+runtimeRecords.length)%runtimeRecords.length;continue;}
    if(block.type==='set_field'){applyField(block.target,block.field);continue;}
    if(block.type==='set_text'){applyText(block.target,block.text);continue;}
    if(block.type==='set_from_component'){applyRuntimeValueToTarget(block.target,runtimeValues[block.source]);continue;}
    if(block.type==='set_visible'){runtimeVisibility[block.target]=block.visible!==false;continue;}
    if(block.type==='show_message'){alert(String(block.text||''));continue;}
    if(block.type==='if_component'){await executeActions(compareRuntime(runtimeValues[block.source],block.operator,block.value)?(block.then||[]):(block.else||[]));continue;}
    if(block.type==='set_variable'){runtimeVariables[block.name||'score']=parseLiteral(block.value);continue;}
    if(block.type==='change_variable'){const name=block.name||'score';runtimeVariables[name]=(Number(runtimeVariables[name])||0)+(Number(block.amount)||0);continue;}
    if(block.type==='set_from_variable'){applyRuntimeValueToTarget(block.target,runtimeVariables[block.name||'score']??0);continue;}
    if(block.type==='api_request'){try{const response=await fetchApiResponse(project.apiService,runtimeValues[block.source]);runtimeApiResult=response.primary;runtimeApiRows=response.rows||[];runtimeApiSuccess=true;runtimeApiError='';log(`${apiServiceInfo(project.apiService).name} request returned ${runtimeApiRows.length} result${runtimeApiRows.length===1?'':'s'}`);}catch(err){runtimeApiResult={};runtimeApiRows=[];runtimeApiSuccess=false;runtimeApiError=err.message||'API request failed';log(`API request failed: ${runtimeApiError}`);}continue;}
    if(block.type==='set_from_api'){applyRuntimeValueToTarget(block.target,runtimeApiResult?.[block.field]??'');continue;}
    if(block.type==='if_api_success'){await executeActions(runtimeApiSuccess?(block.then||[]):(block.else||[]));continue;}
    if(block.type==='add_record_form'){const row={};for(const field of project.fields||[])row[field.id]=defaultValueForField(field);applyFormInputs(row);fillAutomaticId(row);runtimeRecords.push(row);currentRecord=runtimeRecords.length-1;saveRuntimeRecords();continue;}
    if(block.type==='update_record_form'){const row=runtimeRecords[currentRecord];if(row){applyFormInputs(row);saveRuntimeRecords();}continue;}
    if(block.type==='delete_record'){if(runtimeRecords.length){runtimeRecords.splice(currentRecord,1);currentRecord=Math.max(0,Math.min(currentRecord,runtimeRecords.length-1));saveRuntimeRecords();}continue;}
    if(block.type==='navigate_page'){await navigate(block.page,true);continue;}
    if(block.type==='go_back'){await goBack();continue;}
  }
}
async function runEvent(kind, component=null, meta={}) {
  let active=false;
  for(const block of project.program||[]){
    if(block.type==='event_open'){active=kind==='open'&&(block.page||project.pages[0].id)===(meta.pageId||currentPageId);continue;}
    if(block.type==='event_click'){active=kind==='click'&&block.component===component;continue;}
    if(block.type==='event_list_click'){active=kind==='list_click'&&block.component===component;continue;}
    if(block.type==='event_change'){active=kind==='change'&&block.component===component;continue;}
    if(active)await executeActions([block]);
  }
}
function applyField(targetId, fieldId) { const component=project.components?.find(item=>item.id===targetId),record=runtimeRecords[currentRecord];if(!component||!record)return;const value=record[fieldId]??'',field=fieldById(fieldId);if(component.type==='image')component.src=String(value);else if(interactiveComponentType(component.type))runtimeValues[component.id]=value;else if(component.type!=='list')component.text=field?.type==='rating'?ratingStars(value):String(value); }
function applyText(targetId, text) { applyRuntimeValueToTarget(targetId,text); }

async function installApp() {
  if (isStandaloneMode()) return;
  if (!isIOSDevice() && deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }
  showInstallHelp();
}
function showInstallHelp() {
  document.querySelector('.install-help')?.remove();
  const box = document.createElement('div');
  box.className = 'install-help';
  const ios = isIOSDevice();
  box.innerHTML = ios
    ? '<button aria-label="Close">×</button><strong>Add this app to iPhone or iPad</strong><p>Open this link in <b>Safari</b>, tap the <b>Share</b> button, choose <b>Add to Home Screen</b>, then tap <b>Add</b>. If your iPhone shows <b>Open as Web App</b>, leave it switched on. The Home Screen icon will use the image chosen by the app creator.</p>'
    : '<button aria-label="Close">×</button><strong>Install this app on your phone</strong><p>On Android, open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>. On iPhone/iPad, open the link in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>';
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => box.remove();
}
async function shareApp() {
  if (navigator.share) {
    try {
      await navigator.share({title:published.appName || 'My App', url:location.href});
      return;
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(location.href);
    alert('App link copied.');
  } catch {
    prompt('Copy this app link:', location.href);
  }
}

async function boot() {
  if (!publicId) {
    root.className = 'published-error';
    root.textContent = 'This app link is missing its app ID.';
    return;
  }

  const cached = readCachedApp(publicId);
  if (cached?.published === true && cached.snapshot) {
    try {
      usePublishedData(cached);
      render();
      await runEvent('open', null, {pageId:currentPageId});
      render();
      prepareInstallManifest();
    } catch (error) {
      console.warn('Cached app could not be rendered', error);
    }
  }

  try {
    const fresh = await fetchPublishedApp(publicId);
    if (!published) {
      usePublishedData(fresh);
      render();
      await runEvent('open', null, {pageId:currentPageId});
      render();
      prepareInstallManifest();
    } else if (!hasInteracted) {
      const oldSnapshot = JSON.stringify(published.snapshot || {});
      const newSnapshot = JSON.stringify(fresh.snapshot || {});
      if (oldSnapshot !== newSnapshot || published.appName !== fresh.appName || published.icon192 !== fresh.icon192) {
        usePublishedData(fresh);
        render();
        await runEvent('open', null, {pageId:currentPageId});
        render();
      }
      published = fresh;
    } else {
      published = fresh;
    }
  } catch (error) {
    if (!published) {
      console.error(error);
      root.className = 'published-error';
      root.innerHTML = `<div><h1>App unavailable</h1><p>${esc(error.message || 'This app could not be loaded.')}</p></div>`;
    } else {
      console.warn('Could not refresh published app; using cached copy', error);
    }
  }
}

boot();
