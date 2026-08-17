import { firebaseConfig } from './firebase-config.js';

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

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const button = document.querySelector('[data-install]');
  if (button) {
    button.hidden = false;
    button.textContent = 'Install app';
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
  for (const component of project.components || []) {
    if (!component.pageId) component.pageId = first;
    if (component.type === 'list') {
      component.listLayout = component.listLayout || 'image-title-subtitle';
      component.listImageField = component.listImageField || '';
      component.listTitleField = component.listTitleField || '';
      component.listSubtitleField = component.listSubtitleField || '';
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
  const meta = document.querySelector('meta[name="theme-color"]') || document.head.appendChild(Object.assign(document.createElement('meta'), {name:'theme-color'}));
  meta.content = app.theme || '#6256df';
}

function prepareInstallManifest() {
  ensureServiceWorker().then(() => {
    if (published && project) attachManifest(published);
  });
}

function usePublishedData(data, {resetRuntime=true} = {}) {
  published = data;
  project = typeof structuredClone === 'function' ? structuredClone(data.snapshot) : JSON.parse(JSON.stringify(data.snapshot));
  if (!project) throw new Error('Published project data is missing.');
  normaliseProject();
  if (resetRuntime) {
    currentRecord = 0;
    pageHistory = [];
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
  const rows = project.records || [];
  if (!rows.length) return '<div class="list-empty">No database records</div>';
  return rows.map((record, index) => {
    const image = component.listImageField ? String(record[component.listImageField] ?? '') : '';
    const title = component.listTitleField ? formatValue(component.listTitleField, record[component.listTitleField]) : '';
    const subtitle = component.listSubtitleField ? formatValue(component.listSubtitleField, record[component.listSubtitleField]) : '';
    return `<div class="data-list-row layout-${attr(component.listLayout || 'image-title-subtitle')}" data-list-index="${index}">
      ${component.listLayout?.includes('image') ? `<div class="list-row-image">${image ? `<img src="${attr(image)}" alt="">` : '<span>🖼️</span>'}</div>` : ''}
      ${component.listLayout !== 'image-only' ? `<div class="list-row-copy">${component.listLayout?.includes('title') ? `<strong>${esc(title || `Record ${index + 1}`)}</strong>` : ''}${component.listLayout?.includes('subtitle') ? `<span>${esc(subtitle)}</span>` : ''}</div>` : ''}
      ${component.navigateToPage ? '<div class="list-row-arrow">›</div>' : ''}
    </div>`;
  }).join('');
}

function componentMarkup(component) {
  const style = `left:${Number(component.x) || 0}px;top:${Number(component.y) || 0}px;width:${Number(component.w) || 100}px;height:${Number(component.h) || 44}px;`;
  const textColour = attr(component.textColor || '#172033');
  const background = attr(component.backgroundColor || 'transparent');
  let inner = '';
  if (component.type === 'label') {
    inner = `<div class="label align-${attr(component.align || 'left')}" style="font-size:${Number(component.fontSize) || 16}px;text-align:${attr(component.align || 'left')};color:${textColour};background:${background}">${esc(component.text || 'Label')}</div>`;
  }
  if (component.type === 'button') {
    inner = `<button style="background:${attr(component.backgroundColor || '#5b5ce2')};color:${attr(component.textColor || '#ffffff')}">${esc(component.text || 'Button')}</button>`;
  }
  if (component.type === 'image') inner = `<img src="${attr(component.src || '')}" alt="">`;
  if (component.type === 'input') inner = `<input style="background:${attr(component.backgroundColor || '#ffffff')};color:${textColour}" placeholder="${attr(component.text || 'Type here...')}">`;
  if (component.type === 'list') inner = `<div class="listbox database-list">${listRowsMarkup(component)}</div>`;
  return `<div class="public-component" data-component="${attr(component.id)}" style="${style}">${inner}</div>`;
}

function componentsOnPage() {
  return (project.components || []).filter(component => (component.pageId || project.pages[0].id) === currentPageId);
}

function render() {
  document.title = published.appName || project.name || 'My App';
  root.className = '';
  root.innerHTML = `<div class="public-shell">
    <header class="public-topbar">
      <div class="public-brand"><img src="${attr(published.icon192 || published.icon512 || '')}" alt=""><span>${esc(published.appName || project.name)}</span></div>
      <div class="public-actions"><button class="public-btn" data-share>Share</button><button class="public-btn primary" data-install>Install app</button></div>
    </header>
    <section class="public-stage">
      <div class="public-canvas-wrap" data-canvas-wrap>
        <div class="public-device" data-canvas>
          <div class="public-screen" style="background:${attr(project.pages.find(page => page.id === currentPageId)?.backgroundColor || '#ffffff')}" data-page="${attr(currentPageId)}">
            ${componentsOnPage().map(componentMarkup).join('')}
          </div>
        </div>
      </div>
    </section>
  </div>`;

  document.querySelectorAll('.public-component button').forEach(button => button.addEventListener('click', () => {
    hasInteracted = true;
    const id = button.closest('[data-component]').dataset.component;
    log(`${nameOfComponent(id)} clicked`);
    runEvent('click', id, {pageId:currentPageId});
    render();
  }));
  document.querySelectorAll('.public-component [data-list-index]').forEach(row => row.addEventListener('click', () => {
    hasInteracted = true;
    const host = row.closest('[data-component]');
    const id = host?.dataset.component;
    const index = Number(row.dataset.listIndex);
    if (!id || Number.isNaN(index)) return;
    const component = project.components.find(item => item.id === id);
    const before = currentPageId;
    currentRecord = index;
    log(`${nameOfComponent(id)} selected record ${index + 1}`);
    runEvent('list_click', id, {pageId:before, index});
    if (currentPageId === before && component?.navigateToPage) navigate(component.navigateToPage, true);
    else renderComponents();
  }));
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
    if (component.type === 'label') {
      const label = element.querySelector('.label');
      if (label) label.textContent = component.text || '';
    }
    if (component.type === 'button') {
      const button = element.querySelector('button');
      if (button) button.textContent = component.text || 'Button';
    }
    if (component.type === 'image') {
      const image = element.querySelector('img');
      if (image) image.src = component.src || '';
    }
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

function navigate(pageId, push=true) {
  if (!project.pages.some(page => page.id === pageId) || pageId === currentPageId) return;
  if (push) pageHistory.push(currentPageId);
  currentPageId = pageId;
  log(`${pageName(pageId)} opened`);
  render();
  runEvent('open', null, {pageId});
  renderComponents();
}
function goBack() {
  const previous = pageHistory.pop();
  if (previous) navigate(previous, false);
}

function runEvent(kind, component=null, meta={}) {
  let active = false;
  for (const block of project.program || []) {
    if (block.type === 'event_open') {
      active = kind === 'open' && (block.page || project.pages[0].id) === (meta.pageId || currentPageId);
      continue;
    }
    if (block.type === 'event_click') {
      active = kind === 'click' && block.component === component;
      continue;
    }
    if (block.type === 'event_list_click') {
      active = kind === 'list_click' && block.component === component;
      continue;
    }
    if (!active) continue;
    if (block.type === 'first_record') currentRecord = 0;
    if (block.type === 'next_record' && project.records?.length) currentRecord = (currentRecord + 1) % project.records.length;
    if (block.type === 'prev_record' && project.records?.length) currentRecord = (currentRecord - 1 + project.records.length) % project.records.length;
    if (block.type === 'set_field') applyField(block.target, block.field);
    if (block.type === 'set_text') applyText(block.target, block.text);
    if (block.type === 'navigate_page') navigate(block.page, true);
    if (block.type === 'go_back') goBack();
  }
}

function applyField(targetId, fieldId) {
  const component = project.components?.find(item => item.id === targetId);
  const record = project.records?.[currentRecord];
  if (!component || !record) return;
  const value = record[fieldId] ?? '';
  const field = fieldById(fieldId);
  if (component.type === 'image') component.src = String(value);
  else if (component.type !== 'list') component.text = field?.type === 'rating' ? ratingStars(value) : String(value);
}
function applyText(targetId, text) {
  const component = project.components?.find(item => item.id === targetId);
  if (component && component.type !== 'image' && component.type !== 'list') component.text = String(text || '');
}

async function installApp() {
  if (deferredInstallPrompt) {
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
  box.innerHTML = '<button aria-label="Close">×</button><strong>Install this app on Android</strong><p>In Chrome, open the ⋮ menu and choose <b>Install app</b> or <b>Add to Home screen</b>. The app will use the icon chosen by its creator.</p>';
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
      runEvent('open', null, {pageId:currentPageId});
      renderComponents();
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
      runEvent('open', null, {pageId:currentPageId});
      renderComponents();
      prepareInstallManifest();
    } else if (!hasInteracted) {
      const oldSnapshot = JSON.stringify(published.snapshot || {});
      const newSnapshot = JSON.stringify(fresh.snapshot || {});
      if (oldSnapshot !== newSnapshot || published.appName !== fresh.appName || published.icon192 !== fresh.icon192) {
        usePublishedData(fresh);
        render();
        runEvent('open', null, {pageId:currentPageId});
        renderComponents();
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
