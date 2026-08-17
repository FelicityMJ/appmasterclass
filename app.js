import {
  isFirebaseEnabled, onAuthChange, signInWithGoogle, signOutUser,
  isApprovedTeacher, getTeacherAccess, claimTeacherInvite, createTeacherInvite,
  listTeacherInvites, listTeacherAccounts, revokeTeacherAccount, cancelTeacherInvite,
  ensureUserProfile, getUserProfile,
  createClass as cloudCreateClass, listTeacherClasses, joinClassByCode,
  listPupilClasses, getClass as cloudGetClass, listClassMembers, getClassMember, updateClassMemberSettings,
  removeClassMember, regenerateJoinCode, saveAssignment as cloudSaveAssignment,
  listAssignments as cloudListAssignments, saveProjectToCloud,
  listMyProjects, listClassProjects, listPersonalImages,
  uploadPersonalImage, deletePersonalImage, listSharedImages,
  uploadSharedImage, deleteSharedImage, uploadPublishedIcons, publishProject, unpublishProject, deleteProjectFromCloud
} from './firebase-service.js';
import { initBlocklyEditor } from './blockly-integration.js';
import { publicAppBaseUrl } from './public-host.js';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const clone = (obj) => JSON.parse(JSON.stringify(obj));

const imageSvg = (emoji, label, bg='#eef2ff') => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="43%" text-anchor="middle" font-size="110">${emoji}</text><text x="50%" y="72%" text-anchor="middle" font-family="Arial" font-size="34" fill="#283046">${label}</text></svg>`)}`;


const PERSONAL_IMAGE_LIMIT = 20;
const MAX_PUPIL_APPS = 30;
const PERSONAL_IMAGE_TARGET_BYTES = 80 * 1024;
const MAX_IMAGE_DIMENSION = 800;

const defaultSharedImages = [
  ['castle','🏰','Castle','Places','#efe9ff'],['loch','🌊','Loch / Water','Nature','#e1f5ff'],
  ['forest','🌳','Forest','Nature','#e8fff3'],['mountain','⛰️','Mountain','Nature','#edf2ff'],
  ['panda','🐼','Panda','Animals','#fff0ea'],['owl','🦉','Owl','Animals','#fff7da'],
  ['dog','🐶','Dog','Animals','#fff0e6'],['football','⚽','Football','Sport','#eaf9ef'],
  ['guitar','🎸','Guitar','Music','#f3edff'],['headphones','🎧','Headphones','Music','#e6f1ff'],
  ['pizza','🍕','Pizza','Food','#fff0dc'],['computer','💻','Computer','Computing','#e9f3ff']
].map(([id,emoji,name,category,bg])=>({
  id:`system-${id}`, name, category, tags:`${name} ${category}`.toLowerCase(),
  dataUrl:imageSvg(emoji,name,bg), size:0, locked:true, source:'system'
}));

function loadMediaStore(){
  try{
    const saved=JSON.parse(localStorage.getItem('dataapp_media'));
    if(saved && Array.isArray(saved.personal) && Array.isArray(saved.shared)){
      const systemIds=new Set(defaultSharedImages.map(x=>x.id));
      const teacher=saved.shared.filter(x=>!systemIds.has(x.id));
      return {personal:saved.personal.slice(0,PERSONAL_IMAGE_LIMIT),shared:[...clone(defaultSharedImages),...teacher]};
    }
  }catch{}
  return {personal:[],shared:clone(defaultSharedImages)};
}
function saveMediaStore(){
  try{ localStorage.setItem('dataapp_media',JSON.stringify(state.media)); return true; }
  catch(err){ alert('Your browser storage is full. Delete an unused personal image, or use the shared Image Bank.'); return false; }
}
function assetRef(scope,id){ return `asset:${scope}:${id}`; }
function parseAssetRef(value){
  const m=String(value||'').match(/^asset:(personal|shared):(.+)$/); return m?{scope:m[1],id:m[2]}:null;
}
function findAsset(value){
  const ref=parseAssetRef(value); if(!ref)return null;
  return state.media[ref.scope]?.find(x=>x.id===ref.id)||null;
}
function resolveImage(value){ return findAsset(value)?.dataUrl || value || imageSvg('🖼️','Image'); }
function personalImageCount(){ return state.media.personal.length; }
function imageUsageInProject(project,ref){
  if(!project)return 0;let count=0;
  (project.records||[]).forEach(r=>(project.fields||[]).filter(f=>f.type==='image').forEach(f=>{if(r[f.id]===ref)count++}));
  (project.components||[]).forEach(c=>{if(c.type==='image'&&c.src===ref)count++});
  if(project.publish?.icon===ref)count++;
  return count;
}
function imageUsage(ref){ return imageUsageInProject(state.project,ref); }
function imageUsageAcrossApps(ref){
  const projects=[...(state.cloudProjects||[])];
  if(!projects.some(p=>projectIdOf(p)===projectIdOf(state.project)))projects.push(state.project);
  return projects.reduce((sum,p)=>sum+imageUsageInProject(p,ref),0);
}
function clearImageRef(ref){
  state.project.records.forEach(r=>state.project.fields.filter(f=>f.type==='image').forEach(f=>{if(r[f.id]===ref)r[f.id]=''}));
  state.project.components.forEach(c=>{if(c.type==='image'&&c.src===ref)c.src=''});
  if(state.project.publish?.icon===ref) state.project.publish.icon='';
}
function blobToDataUrl(blob){ return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob)}); }
function loadImageFile(file){ return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read that image.'))};img.src=url}); }
async function compressImage(file,targetBytes=PERSONAL_IMAGE_TARGET_BYTES,maxDim=MAX_IMAGE_DIMENSION){
  if(!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const img=await loadImageFile(file);
  let scale=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight));
  let quality=.76, blob=null;
  for(let attempt=0;attempt<12;attempt++){
    const w=Math.max(1,Math.round(img.naturalWidth*scale)), h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
    blob=await new Promise(res=>canvas.toBlob(res,'image/webp',quality));
    if(blob && blob.size<=targetBytes) break;
    if(quality>.42) quality-=.1; else scale*=.82;
  }
  if(!blob || blob.size>targetBytes) throw new Error('That image could not be reduced enough. Try a simpler or smaller picture.');
  return {dataUrl:await blobToDataUrl(blob),size:blob.size,width:Math.round(img.naturalWidth*scale),height:Math.round(img.naturalHeight*scale)};
}
function friendlyBytes(n){ return n<1024?`${n} B`:`${Math.max(1,Math.round(n/1024))} KB`; }

const projectTemplates = {
  blank: {
    id:'project-blank',
    name:'My New App',
    publish:{appName:'My New App',icon:'',theme:'#5b5ce2',orientation:'portrait'},
    tableName:'MyData',
    fields:[],
    records:[],
    pages:[{id:'screen1',name:'Home',backgroundColor:'#ffffff'}],
    components:[],
    program:[],
    tutorialEnabled:true,
    blocklyState:null,
    blocklyPages:{}
  }
};

function freshBlankProject(name='My New App', assignmentId=''){
  const project=clone(projectTemplates.blank);
  project.id=`project-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  project.name=name||'My New App';
  project.publish.appName=project.name;
  project.assignmentId=assignmentId||'';
  project.tutorialEnabled=true;
  return normaliseProject(project);
}
function normaliseProject(project){
  project=project||freshBlankProject();
  if(!Array.isArray(project.pages)||!project.pages.length) project.pages=[{id:'screen1',name:'Home',backgroundColor:'#ffffff'}];
  project.pages=project.pages.map((pg,i)=>({id:pg.id||`screen${i+1}`,name:pg.name||`Page ${i+1}`,backgroundColor:pg.backgroundColor||'#ffffff'}));
  const first=project.pages[0].id;
  project.fields=Array.isArray(project.fields)?project.fields:[];
  for(const f of project.fields){
    if(f.type==='text') f.type='shortText';
  }
  project.components=Array.isArray(project.components)?project.components:[];
  for(const c of project.components){
    if(!c.pageId||!project.pages.some(p=>p.id===c.pageId))c.pageId=first;
    if(c.textColor===undefined)c.textColor=c.type==='button'?'#ffffff':'#172033';
    if(c.backgroundColor===undefined)c.backgroundColor=c.type==='button'?'#5b5ce2':c.type==='input'?'#ffffff':'';
    if(c.type==='list'){
      c.listBackground=c.listBackground||(c.listTransparent?'transparent':'white');
      c.listTransparent=c.listBackground==='transparent';
    }
    if(c.type==='list'){
      c.listLayout=c.listLayout||'image-title-subtitle';
      c.listImageField=c.listImageField||'';
      c.listTitleField=c.listTitleField||'';
      c.listSubtitleField=c.listSubtitleField||'';
      c.navigateToPage=c.navigateToPage||'';
    }
  }
  project.program=Array.isArray(project.program)?project.program:[];
  project.blocklyPages=(project.blocklyPages&&typeof project.blocklyPages==='object')?project.blocklyPages:{};
  for(const b of project.program)if(b.type==='event_open'&&!b.page)b.page=first;
  return project;
}
function isEmptyProject(project){
  return !project?.fields?.length && !project?.records?.length && !project?.components?.length && !project?.program?.length;
}
function isLegacyDemoProject(project){
  const id=String(project?.projectId||project?.id||'');
  return ['project-tourist','project-animals','project-music'].some(prefix=>id===prefix||id.startsWith(prefix+'-'));
}

function projectIdOf(project){ return String(project?.id||project?.projectId||''); }
function projectTime(project){
  if(Number(project?.updatedAtMs)) return Number(project.updatedAtMs);
  if(Number(project?.updatedAt?.seconds)) return Number(project.updatedAt.seconds)*1000;
  return 0;
}
function sortProjects(projects){ return [...(projects||[])].sort((a,b)=>projectTime(b)-projectTime(a)||String(a.name||'').localeCompare(String(b.name||''))); }
function cleanCloudProject(project){
  const clean=clone(project||{});
  ['cloudId','ownerUid','ownerName','classId','updatedAt','projectId'].forEach(k=>delete clean[k]);
  if(clean.tutorialEnabled===undefined) clean.tutorialEnabled=true;
  return normaliseProject(clean);
}
function loadLocalProjects(){
  try{
    const saved=JSON.parse(localStorage.getItem('dataapp_projects')||'[]');
    if(Array.isArray(saved)&&saved.length) return sortProjects(saved.filter(p=>!isLegacyDemoProject(p)).map(normaliseProject));
    const old=JSON.parse(localStorage.getItem('dataapp_project')||'null');
    if(old&&!isLegacyDemoProject(old)&&!isEmptyProject(old)) return [normaliseProject(old)];
  }catch{}
  return [];
}
function saveLocalProjects(){
  if(CLOUD_MODE)return;
  localStorage.setItem('dataapp_projects',JSON.stringify(state.cloudProjects||[]));
}
function syncCurrentProjectInList(){
  if(state.role!=='pupil')return;
  const id=projectIdOf(state.project); if(!id)return;
  const i=(state.cloudProjects||[]).findIndex(p=>projectIdOf(p)===id);
  if(i<0)return;
  state.cloudProjects[i]={...clone(state.project),projectId:id,classId:state.currentClassId,ownerUid:state.user?.uid||state.cloudProjects[i]?.ownerUid||'',updatedAtMs:state.project.updatedAtMs||Date.now()};
  state.cloudProjects=sortProjects(state.cloudProjects);
  saveLocalProjects();
}
function addProjectToList(project){
  const id=projectIdOf(project); if(!id)return;
  const entry={...clone(project),projectId:id,classId:state.currentClassId,ownerUid:state.user?.uid||'',updatedAtMs:project.updatedAtMs||Date.now()};
  state.cloudProjects=[entry,...(state.cloudProjects||[]).filter(p=>projectIdOf(p)!==id)];
  state.cloudProjects=sortProjects(state.cloudProjects);
  saveLocalProjects();
}
function assignmentTitle(id){ return state.assignments.find(a=>a.id===id)?.title||''; }
function publishedStatus(project){ return project?.publish?.isPublished?'Published':'Draft'; }

const defaultAssignments = [
  {id:'a-first',title:'My First Database App',template:'blank',level:'Guided',tutorialMode:'guided',requirements:{records:3,components:4,blocks:4}}
];

function loadAssignments(){
  try { return JSON.parse(localStorage.getItem('dataapp_assignments')) || clone(defaultAssignments); }
  catch { return clone(defaultAssignments); }
}
function saveAssignments(){
  localStorage.setItem('dataapp_assignments',JSON.stringify(state.assignments));
}

const CLOUD_MODE = isFirebaseEnabled();
let cloudSaveTimer = null;

const state = {
  view:'landing',
  role:null,
  tab:'data',
  project: loadProject(),
  selectedComponent:null,
  currentRecord:0,
  currentPageId:'screen1',
  pageHistory:[],
  codeMode:'python',
  device:'phone',
  assignments:CLOUD_MODE?[]:loadAssignments(),
  media:loadMediaStore(),
  testLogs:[],
  authLoading:CLOUD_MODE,
  user:null,
  profile:null,
  teacherApproved:false,
  teacherAdmin:false,
  teacherInvites:[],
  teacherAccounts:[],
  classes:[],
  currentClassId:localStorage.getItem('dataapp_current_class')||'',
  currentClass:null,
  members:[],
  classProjects:[],
  teacherPupilUid:'',
  teacherPupilName:'',
  teacherInspectActive:false,
  pupilMember:null,
  blockSupportMode:'manual',
  blockTutorial:'overview',
  cloudProjects:CLOUD_MODE?[]:loadLocalProjects(),
  cloudStatus:CLOUD_MODE?'Waiting for sign-in':'Local preview mode',
  authError:''
};
state.currentPageId=state.project.pages?.[0]?.id||'screen1';

function loadProject(){
  try { return normaliseProject(JSON.parse(localStorage.getItem('dataapp_project')) || freshBlankProject()); }
  catch { return freshBlankProject(); }
}
function saveProject(){
  state.project.updatedAtMs=Date.now();
  localStorage.setItem('dataapp_project',JSON.stringify(state.project));
  syncCurrentProjectInList();
  const el=$('.save-state');
  if(el) el.textContent=CLOUD_MODE&&state.user&&state.role==='pupil'&&state.currentClassId?'Saving…':'✓ Saved locally';
  if(CLOUD_MODE&&state.user&&state.role==='pupil'&&state.currentClassId){
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer=setTimeout(async()=>{
      try{
        await saveProjectToCloud(state.project,state.user,state.currentClassId);
        state.cloudStatus='Saved to Firebase';
        const target=$('.save-state'); if(target) target.textContent='✓ Saved to cloud';
      }catch(err){
        state.cloudStatus=err.message;
        const target=$('.save-state'); if(target) target.textContent='⚠ Save failed';
        console.error(err);
      }
    },700);
  }else if(el){
    setTimeout(()=>{const target=$('.save-state');if(target)target.textContent='Saved locally';},800);
  }
}

function render(){
  const root=$('#app');
  if(state.view==='landing') root.innerHTML=landingView();
  else if(state.view==='teacher') root.innerHTML=teacherView();
  else if(state.view==='pupil') root.innerHTML=pupilView();
  else if(state.view==='teacher-pupil') root.innerHTML=teacherPupilAppsView();
  else if(state.view==='builder') root.innerHTML=builderView();
  bindCommon();
  if(state.view==='builder') bindBuilder();
}

function landingView(){
  if(state.authLoading) return `<div class="landing"><div class="hero-card auth-card"><div class="brand"><div class="brandmark">▦</div> DataApp Studio</div><h2>Connecting to your classroom…</h2><p class="muted">Checking Firebase sign-in.</p></div></div>`;
  if(CLOUD_MODE && state.user && state.role==='teacher-pending') return `<div class="landing"><div class="hero-card auth-card">
    <div class="brand" style="margin-bottom:18px"><div class="brandmark">▦</div> DataApp Studio <span class="pill">V1.18</span></div>
    <h2>Teacher approval needed</h2><p>You are signed in as <b>${escapeHtml(state.user.email||state.user.displayName||'Google user')}</b>, but this Google account has not been invited as a teacher yet.</p>
    <div class="notice"><b>Ask your DataApp Studio administrator to invite this exact Google email address.</b><div class="uid-box">${escapeHtml(state.user.email||'')}</div></div>
    <p class="muted">Once the administrator has invited the address, click <b>Check again</b>. The teacher account will be activated automatically; no Firebase UID needs to be copied.</p>
    <div class="modal-actions"><button class="btn" data-action="home">Sign out</button><button class="btn primary" data-action="check-teacher">Check again</button></div>
  </div></div>`;
  return `
<div class="landing">
  <div class="hero">
    <div>
      <div class="brand" style="margin-bottom:28px"><div class="brandmark">▦</div> DataApp Studio <span class="pill">V1.18 classroom</span></div>
      <h1>Build apps.<br>Learn data.<br>See the code.</h1>
      <p>A pupil-friendly app studio: create a database, design a phone screen, connect it with visual blocks, then run it instantly.</p>
      <div class="project-meta" style="margin-top:22px"><span class="tag">Google sign-in</span><span class="tag">Teacher classes</span><span class="tag">20-image pupil limit</span><span class="tag">Shared image bank</span></div>
    </div>
    <div class="hero-card">
      <h2 style="margin-top:0">${CLOUD_MODE?'Choose how you want to continue':'Firebase is not linked yet'}</h2>
      <p class="muted" style="font-size:14px">${CLOUD_MODE?'New pupils join with a class code once. Returning pupils simply sign back in to their saved classes and apps.':'You can still preview the interface locally. Follow SETUP-FIREBASE.md to turn on real accounts and classrooms.'}</p>
      ${state.authError?`<div class="notice warning">${escapeHtml(state.authError)}</div>`:''}
      <div class="role-grid">
        ${CLOUD_MODE?`
        <button class="role-card" data-auth-intent="pupil-join"><div class="role-icon">✨</div><div><strong>New pupil — Join a class</strong><span>Sign up with Google, then enter your teacher's class code.</span></div></button>
        <button class="role-card" data-auth-intent="pupil-return"><div class="role-icon">🧑‍🎓</div><div><strong>Returning pupil — Sign in</strong><span>Open your existing classes, apps and assignments.</span></div></button>
        <button class="role-card" data-auth-intent="teacher"><div class="role-icon">🧑‍🏫</div><div><strong>Teacher — Sign in</strong><span>Manage classes, pupils, assignments and shared images.</span></div></button>
        `:`
        <button class="role-card" data-role="pupil"><div class="role-icon">🧑‍🎓</div><div><strong>Pupil preview</strong><span>Test the pupil builder locally.</span></div></button>
        <button class="role-card" data-role="teacher"><div class="role-icon">🧑‍🏫</div><div><strong>Teacher preview</strong><span>Test the teacher screens locally.</span></div></button>
        `}
      </div>
    </div>
  </div>
</div>`;
}

function topbar(label){
  const person=state.user?`<span class="user-chip">${state.user.photoURL?`<img src="${escapeAttr(state.user.photoURL)}" alt="">`:''}${escapeHtml(state.user.displayName||state.user.email||'Google user')}</span>`:'';
  return `<div class="topbar"><div class="brand"><div class="brandmark">▦</div> DataApp Studio</div><div class="top-actions">${person}<span class="pill">${escapeHtml(label)}</span><button class="btn small" data-action="home">${CLOUD_MODE?'Sign out':'Exit preview'}</button></div></div>`;
}

function classSwitcher(){
  if(!state.classes.length) return '';
  return `<div class="class-switcher">${state.classes.map(c=>`<button class="class-chip ${c.id===state.currentClassId?'active':''}" data-select-class="${escapeAttr(c.id)}">${escapeHtml(c.name||c.className||'Class')}</button>`).join('')}</div>`;
}

function pupilView(){
  const name=state.user?.displayName?.split(' ')[0]||'Pupil';
  if(CLOUD_MODE && !state.classes.length) return `<div class="shell">${topbar('Pupil')}<main class="page">
    <div class="welcome"><div><h1>Hi ${escapeHtml(name)} 👋</h1><p>Your Google account is ready. Join your first classroom to get assignments and cloud project saving.</p></div><button class="btn primary" data-action="join-class">+ Join a class</button></div>
    <div class="card empty-class-card"><div class="big-emoji">🏫</div><h2>Enter the class code from your teacher</h2><p class="muted">You only need to join once. The class will appear here every time you sign in.</p><button class="btn primary" data-action="join-class">Join class</button></div>
  </main></div>`;
  const cls=state.currentClass;
  const apps=sortProjects((state.cloudProjects||[]).filter(p=>!isLegacyDemoProject(p)));
  return `<div class="shell">${topbar(CLOUD_MODE?'Pupil':'Pupil preview')}<main class="page">
    <div class="welcome"><div><h1>Hi ${escapeHtml(name)} 👋</h1><p>${cls?`You are working in <b>${escapeHtml(cls.name||cls.className||'your class')}</b>.`:'Build and keep more than one app.'}</p></div><div><button class="btn" data-action="join-class">+ Join another class</button> <button class="btn primary" data-action="new-app" ${apps.length>=MAX_PUPIL_APPS?'disabled title="Delete an old app before creating another."':''}>+ New app</button></div></div>
    ${classSwitcher()}
    <div class="section-head"><div><h2 style="font-size:22px">My Apps</h2><p>${apps.length?`Choose an app to continue. Your personal image allowance is shared across all your apps.`:'You have not created an app in this class yet.'}</p></div><div class="app-count">${apps.length}/${MAX_PUPIL_APPS} apps · 🖼 ${personalImageCount()}/20 images</div></div>
    ${apps.length?`<div class="cards app-library">${apps.map(appCard).join('')}</div>`:`<div class="card empty-app-library"><div class="big-emoji">📱</div><h3>Create your first app</h3><p class="muted">Every app starts blank. The tutorial can guide you while you create the database, pages and Blockly yourself.</p><button class="btn primary" data-action="new-app">+ New app</button></div>`}
    <div class="section-head app-section-gap"><div><h2 style="font-size:20px">Class Tasks</h2><p>${state.assignments.length?'Starting a task creates a new app. It never replaces one of your existing apps.':'Your teacher has not added an assignment to this class yet.'}</p></div></div>
    <div class="cards">${state.assignments.length?state.assignments.map(a=>assignmentCard(a)).join(''):'<div class="card"><div class="empty-note">No assignments yet.</div></div>'}</div>
  </main></div>`;
}
function appCard(project){
  const id=projectIdOf(project), published=project?.publish?.isPublished, task=project.assignmentId?assignmentTitle(project.assignmentId):'';
  const pages=project.pages?.length||1, records=project.records?.length||0, components=project.components?.length||0;
  return `<div class="card project-card app-library-card">
    <div class="app-card-top"><div><div class="project-meta"><span class="tag ${published?'tag-good':''}">${published?'✓ Published':'Draft'}</span>${task?`<span class="tag">Class task</span>`:'<span class="tag">My app</span>'}</div><h3>${escapeHtml(project.name||'Untitled app')}</h3>${task?`<p class="app-task-name">${escapeHtml(task)}</p>`:''}</div><div class="mini-app-icon">${published?'📲':'📱'}</div></div>
    <p class="muted">${pages} page${pages===1?'':'s'} · ${records} record${records===1?'':'s'} · ${components} component${components===1?'':'s'}</p>
    <div class="progress"><span style="width:${projectProgressFor(project)}%"></span></div>
    <div class="app-card-actions"><button class="btn primary small" data-open-project="${escapeAttr(id)}">Open</button><button class="btn small" data-rename-project="${escapeAttr(id)}">Rename</button><button class="btn small" data-duplicate-project="${escapeAttr(id)}">Duplicate</button><button class="btn small danger-soft" data-delete-project="${escapeAttr(id)}">Delete</button></div>
  </div>`;
}
function projectProgressFor(project){
  const hasEvent=(project.program||[]).some(b=>['event_open','event_click','event_list_click'].includes(b.type));
  const connected=(project.program||[]).some(b=>b.type==='set_field');
  const listReady=(project.components||[]).some(c=>c.type==='list'&&(c.listTitleField||c.listImageField));
  const checks=[(project.records||[]).length>=3&&(project.fields||[]).length>=3,(project.components||[]).length>=3,(project.pages||[]).length>=2&&listReady,hasEvent,connected];
  return Math.round(checks.filter(Boolean).length/checks.length*100);
}

function teacherAdminPanel(){
  if(!state.teacherAdmin)return '';
  const activeAccounts=(state.teacherAccounts||[]).filter(a=>a.enabled!==false);
  const activeByEmail=new Map(activeAccounts.filter(a=>a.email).map(a=>[String(a.email).toLowerCase(),a]));
  const pending=(state.teacherInvites||[]).filter(i=>i.enabled!==false && !activeByEmail.has(String(i.email||i.id||'').toLowerCase()));
  const accountRows=activeAccounts.length?activeAccounts.map(a=>{
    const isMe=a.uid===state.user?.uid;
    const label=a.admin===true?'Administrator':'Teacher';
    const email=a.email||(isMe?state.user?.email:'');
    const name=a.displayName||(isMe?state.user?.displayName:'')||email||'Teacher account';
    return `<div class="teacher-admin-row"><div><strong>${escapeHtml(name)}</strong><div class="muted">${escapeHtml(email||'')} · ${label}</div></div><div>${a.admin===true?'<span class="tag tag-good">Admin</span>':`<button class="btn small danger-outline" data-revoke-teacher="${escapeAttr(a.uid)}" data-teacher-email="${escapeAttr(email||'')}">Revoke</button>`}</div></div>`;
  }).join(''):'<div class="empty-note">No teacher accounts found.</div>';
  const pendingRows=pending.length?pending.map(i=>{
    const email=String(i.email||i.id||'');
    return `<div class="teacher-admin-row"><div><strong>${escapeHtml(email)}</strong><div class="muted">Waiting for first Google sign-in</div></div><button class="btn small" data-cancel-teacher-invite="${escapeAttr(email)}">Cancel invite</button></div>`;
  }).join(''):'<div class="empty-note">No pending invitations.</div>';
  return `<div class="card teacher-admin-panel">
    <div class="section-head"><div><h2 style="font-size:19px">Teacher administration</h2><p>Only your administrator account can invite or revoke teachers.</p></div><button class="btn primary" data-action="invite-teacher">+ Invite teacher</button></div>
    <div class="teacher-admin-columns">
      <div><h3>Teacher accounts</h3>${accountRows}</div>
      <div><h3>Pending invitations</h3>${pendingRows}</div>
    </div>
  </div>`;
}

function teacherView(){
  const teacherLabel=CLOUD_MODE?(state.teacherAdmin?'Admin':'Teacher'):'Teacher preview';
  if(!state.classes.length) return `<div class="shell">${topbar(teacherLabel)}<main class="page">
    <div class="welcome"><div><h1>Your classrooms</h1><p>Create your first class. A join code will be generated automatically.</p></div><div>${state.teacherAdmin?'<button class="btn" data-action="invite-teacher">👩‍🏫 Invite teacher</button> ':''}<button class="btn" data-action="manage-bank">🖼 Manage Image Bank</button> <button class="btn primary" data-action="create-class">+ Create class</button></div></div>
    ${teacherAdminPanel()}
    <div class="card empty-class-card"><div class="big-emoji">🏫</div><h2>No classes yet</h2><p class="muted">Create a class, give pupils the six-character code, and they can join with Google sign-in.</p><button class="btn primary" data-action="create-class">Create my first class</button></div>
  </main></div>`;
  const cls=state.currentClass||state.classes.find(c=>c.id===state.currentClassId)||state.classes[0];
  const projectByUid=new Map(), projectCountByUid=new Map();
  sortProjects(state.classProjects).forEach(p=>{projectCountByUid.set(p.ownerUid,(projectCountByUid.get(p.ownerUid)||0)+1);if(!projectByUid.has(p.ownerUid))projectByUid.set(p.ownerUid,p)});
  return `<div class="shell">${topbar(teacherLabel)}<main class="page">
    <div class="welcome"><div><h1>Your classrooms</h1><p>${escapeHtml(cls?.name||'Class')} · ${state.members.length} pupil${state.members.length===1?'':'s'}</p></div><div>${state.teacherAdmin?'<button class="btn" data-action="invite-teacher">👩‍🏫 Invite teacher</button> ':''}<button class="btn" data-action="manage-bank">🖼 Manage Image Bank</button> <button class="btn" data-action="create-class">+ Create class</button> <button class="btn primary" data-action="new-assignment">+ New assignment</button></div></div>
    ${classSwitcher()}
    ${teacherAdminPanel()}
    <div class="cards" style="margin-bottom:16px">
      <div class="card"><div class="muted">Class code</div><h2 class="join-code">${escapeHtml(cls?.joinCode||'—')}</h2><button class="btn small" data-action="regenerate-code">Regenerate code</button></div>
      <div class="card"><div class="muted">Assignments</div><h2 style="margin:5px 0">${state.assignments.length}</h2><div class="muted">Saved to this class</div></div>
      <div class="card"><div class="muted">Shared Image Bank</div><h2 style="margin:5px 0">${state.media.shared.filter(x=>!x.locked).length}</h2><button class="btn small" data-action="manage-bank">Add images</button></div>
    </div>
    <div class="section-head"><div><h2 style="font-size:19px">Assignments</h2><p>These appear automatically on pupils' dashboards.</p></div></div>
    <div class="cards" style="margin-bottom:16px">${state.assignments.length?state.assignments.map(a=>`<div class="card"><div class="tag">${escapeHtml(a.level||'Guided')}</div><h3>${escapeHtml(a.title)}</h3><p class="muted">${a.requirements?.records||1}+ records · ${a.requirements?.components||4}+ components · ${a.requirements?.blocks||4}+ blocks</p><button class="btn small" data-start-assignment="${escapeAttr(a.id)}">Preview task</button></div>`).join(''):'<div class="card"><div class="empty-note">No assignments yet. Click + New assignment.</div></div>'}</div>
    <div class="card"><div class="section-head"><div><h2 style="font-size:19px">Pupils & projects</h2><p>Real members and saved projects from Firestore.</p></div></div>
      <table class="class-table"><thead><tr><th>Pupil</th><th>Email</th><th>Apps</th><th>Latest project</th><th>Data</th><th>Design</th><th>Blocks</th><th>Block support</th><th></th></tr></thead><tbody>
      ${state.members.length?state.members.map(m=>{const p=projectByUid.get(m.uid||m.id);const mode=m.blockSupportMode==='auto'?'auto':'manual';return `<tr><td><button class="pupil-link" data-view-pupil="${escapeAttr(m.uid||m.id)}">${escapeHtml(m.displayName||'Pupil')}</button></td><td>${escapeHtml(m.email||'')}</td><td>${projectCountByUid.get(m.uid||m.id)||0}</td><td>${escapeHtml(p?.name||'Not started')}</td><td>${p?p.records?.length||0:'—'}</td><td>${p?p.components?.length||0:'—'}</td><td>${p?p.program?.length||0:'—'}</td><td><select class="member-support-select" data-block-support="${escapeAttr(m.uid||m.id)}"><option value="manual" ${mode==='manual'?'selected':''}>Tutorial — pupil builds blocks</option><option value="auto" ${mode==='auto'?'selected':''}>Auto-add support blocks</option></select></td><td><button class="btn small" data-view-pupil="${escapeAttr(m.uid||m.id)}">View apps</button> <button class="btn small" data-remove-member="${escapeAttr(m.uid||m.id)}">Remove</button></td></tr>`}).join(''):'<tr><td colspan="9"><div class="empty-note">No pupils have joined yet. Give them class code <b>'+escapeHtml(cls?.joinCode||'')+'</b>.</div></td></tr>'}
      </tbody></table>
    </div>
  </main></div>`;
}

function teacherPupilAppsView(){
  const uid=state.teacherPupilUid;
  const member=state.members.find(m=>(m.uid||m.id)===uid);
  const apps=sortProjects((state.classProjects||[]).filter(p=>p.ownerUid===uid));
  const pupilName=member?.displayName||state.teacherPupilName||'Pupil';
  return `<div class="shell">${topbar('Teacher')}<main class="page">
    <div class="welcome"><div><button class="btn small" data-action="back-class">← Back to class</button><h1 style="margin-top:14px">${escapeHtml(pupilName)}'s apps</h1><p>${apps.length} saved app${apps.length===1?'':'s'} in ${escapeHtml(state.currentClass?.name||'this class')}. Open an app to inspect it without changing the pupil's work.</p></div></div>
    ${apps.length?`<div class="cards teacher-pupil-apps">${apps.map(p=>teacherAppCard(p)).join('')}</div>`:`<div class="card empty-class-card"><div class="big-emoji">📱</div><h2>No apps yet</h2><p class="muted">This pupil has not saved an app in this class yet.</p></div>`}
  </main></div>`;
}
function teacherAppCard(project){
  const id=projectIdOf(project),pages=project.pages?.length||1,records=project.records?.length||0,blocks=project.program?.length||0;
  return `<div class="card project-card"><div class="project-meta"><span class="tag ${project?.publish?.isPublished?'tag-good':''}">${project?.publish?.isPublished?'✓ Published':'Draft'}</span>${project.assignmentId?'<span class="tag">Class task</span>':'<span class="tag">Own app</span>'}</div><h3>${escapeHtml(project.name||'Untitled app')}</h3><p class="muted">${pages} page${pages===1?'':'s'} · ${records} record${records===1?'':'s'} · ${blocks} block${blocks===1?'':'s'}</p><button class="btn primary small" data-teacher-open-project="${escapeAttr(id)}">Open read-only</button></div>`;
}
function openTeacherPupil(uid){
  const member=state.members.find(m=>(m.uid||m.id)===uid);state.teacherPupilUid=uid;state.teacherPupilName=member?.displayName||'Pupil';state.view='teacher-pupil';render();
}
function openTeacherProject(projectId){
  const found=(state.classProjects||[]).find(p=>p.ownerUid===state.teacherPupilUid&&projectIdOf(p)===projectId);if(!found)return;
  state.project=cleanCloudProject(found);state.teacherInspectActive=true;state.currentRecord=0;state.currentPageId=state.project.pages[0]?.id||'screen1';state.pageHistory=[];state.selectedComponent=null;state.view='builder';state.tab='data';render();
}

function builderView(){
  const inspect=state.teacherInspectActive&&state.role==='teacher';
  const tabs=inspect?['data','design','blocks','test']:['data','design','blocks','test','publish'];
  const labels={data:'1. 🗃 DATA',design:'2. 🎨 DESIGN',blocks:'3. 🧩 BLOCKS',test:'4. ▶ TEST',publish:'5. 🚀 PUBLISH'};
  return `<div class="builder ${inspect?'teacher-inspection':''}">
<div class="builder-head"><button class="btn small" data-action="back-pupil">← ${inspect?'Pupil apps':'Dashboard'}</button><div class="project-title">${escapeHtml(state.project.name)}</div>${inspect?`<span class="pill">Read-only teacher view</span>`:`<span class="mini-progress">${projectProgress()}% ready</span><span class="save-state">${CLOUD_MODE?'Cloud project':'Saved locally'}</span><button class="btn small tutorial-toggle" data-action="toggle-tutorial">${state.project.tutorialEnabled===false?'Show tutorial':'Hide tutorial'}</button><button class="btn small" data-action="reset">Clear project</button>`}</div>
<div class="step-tabs">${tabs.map(t=>`<button class="step-tab ${state.tab===t?'active':''}" data-tab="${t}">${labels[t]}</button>`).join('')}</div>
${inspect?`<div class="notice teacher-readonly-note"><b>Teacher view:</b> You can inspect Data, Design, Blocks and run Test. Nothing here saves changes to the pupil's project.</div>`:(state.project.tutorialEnabled===false?'':tutorialPanel())}
<div class="builder-body">${state.tab==='data'?dataView():state.tab==='design'?designView():state.tab==='blocks'?blocksView():state.tab==='test'?testView():publishView()}</div>
</div>`}

function tutorialSteps(){
  const fields=state.project.fields||[], records=state.project.records||[], comps=state.project.components||[], program=state.project.program||[];
  const pages=state.project.pages||[];
  const lists=comps.filter(c=>c.type==='list');
  const configuredList=lists.find(c=>(!c.listLayout?.includes('image')||c.listImageField)&&(!c.listLayout?.includes('title')||c.listTitleField)&&(!c.listLayout?.includes('subtitle')||c.listSubtitleField));
  const hasSecondPage=pages.length>=2;
  const nonHomePages=new Set(pages.slice(1).map(p=>p.id));
  const detailComponents=comps.filter(c=>nonHomePages.has(c.pageId)&&['label','image','input'].includes(c.type));
  const hasDetailDesign=detailComponents.length>=1;
  const detailConnected=detailComponents.length>0&&detailComponents.some(c=>program.some(b=>b.type==='set_field'&&b.target===c.id));
  const listEvent=program.some(b=>b.type==='event_list_click');
  const navBlock=program.some(b=>b.type==='navigate_page'&&nonHomePages.has(b.page));
  const assisted=autoBlocksEnabled();
  return [
    {tab:'data',title:'Name your app and database',done:state.project.name!=='My New App'&&state.project.tableName!=='MyData',
      text:'Choose your own app idea. Give the app a name, then name the database table that will hold its information.',
      tip:'Examples: Songs, Films, Players, Recipes, Animals or Places.'},
    {tab:'data',title:'Create your fields',done:fields.length>=3,
      text:'Create at least three database fields. Think about what you want each item in your list and details page to show.',
      tip:'A useful list often has an ID, a title/name, a subtitle/category and an image field.'},
    {tab:'data',title:'Add your records',done:records.length>=3,
      text:'Add at least three different records. These rows will become the items in your app list.',
      tip:'Use different-looking data so you can tell whether the selected record is changing correctly.'},
    {tab:'design',title:'Build a scrollable list on Page 1',done:!!configuredList,
      text:'Add a Database List. Choose its row layout, then choose which database fields supply the image, title and subtitle.',
      tip:'The list itself is data-bound in Design. Programming decides what happens when somebody taps a row.'},
    {tab:'design',title:'Create a second page',done:hasSecondPage,
      text:'Click + Add page and name it something like Details. You only build this page once.',
      tip:'The same Details page is reused for every database row, so an app with two designed pages can feel like it has dozens.'},
    {tab:'design',title:'Design the reusable Details page',done:hasDetailDesign,
      text:'Add the placeholders you need on the second page: headings, labels, images or other components.',
      tip:'Do not make one page per record. These placeholders will be filled from whichever list row the user selects.'},
    {tab:assisted?'design':'blocks',title:'Connect the Details placeholders to the selected record',done:detailConnected,
      text:assisted?'Your teacher has enabled Auto-add support. You may use Auto-connect Data on a placeholder, then inspect the Blockly it creates.':'Open Blocks. Use “when Details opens” and Screen blocks to set each placeholder from a field in the selected record.',
      tip:assisted?'Auto-add is support, not magic: open Blocks and read what it generated.':'For example: WHEN Details opens → SET TeamName TO Team Name FROM selected record.'},
    {tab:assisted?'design':'blocks',title:'Program the list tap',done:listEvent&&navBlock,
      text:assisted?'Your teacher has enabled Auto-add support, so choosing a destination page on the List can create the starter Blockly.':'Build it yourself in Blockly: Events → “when an item in List is tapped”, then Navigation → “go to Details”.',
      tip:'The tapped row automatically becomes the selected record before the Details page opens.'},
    {tab:'test',title:'Test several different records',done:state.tutorialTested===true,
      text:'Run the app, scroll the list, tap different rows and check that the same Details page fills with different data each time.',
      tip:'Try the first, middle and last row. Then add a Back button and program it with Navigation → go back.'}
  ];
}
function tutorialPanel(){
  const steps=tutorialSteps(), completed=steps.filter(x=>x.done).length;
  const current=steps.find(x=>!x.done)||steps[steps.length-1];
  const pct=Math.round(completed/steps.length*100);
  return `<section class="tutorial-panel">
    <div class="tutorial-top"><div><span class="tutorial-kicker">🧭 GUIDED TUTORIAL</span><h3>${completed===steps.length?'You built it yourself 🎉':`Step ${Math.min(completed+1,steps.length)} of ${steps.length}: ${escapeHtml(current.title)}`}</h3></div><strong>${completed}/${steps.length}</strong></div>
    <div class="tutorial-progress"><span style="width:${pct}%"></span></div>
    ${completed===steps.length?`<p>You now have a database, interface and program that you created from a blank canvas. You can keep improving it or move to Publish.</p>`:
    `<p>${escapeHtml(current.text)}</p><div class="tutorial-tip">💡 ${escapeHtml(current.tip)}</div><button class="btn primary small" data-tutorial-tab="${current.tab}">Go to ${cap(current.tab)} →</button>`}
    <details class="tutorial-all"><summary>See all tutorial steps</summary><ol>${steps.map(x=>`<li class="${x.done?'done':''}">${x.done?'✓':'○'} ${escapeHtml(x.title)}</li>`).join('')}</ol></details>
  </section>`;
}

function dataView(){return `<div class="section-head"><div><h2>Build your database</h2><p>Start from nothing: you choose the table, fields and records.</p></div><div><button class="btn" data-action="manage-images">🖼 My Images ${personalImageCount()}/${PERSONAL_IMAGE_LIMIT}</button> <button class="btn" data-action="add-field">+ Add field</button> <button class="btn primary" data-action="add-record" ${state.project.fields.length?'':'disabled title="Add a field first"'}>+ Add record</button></div></div>
<div class="project-setup-grid">
  <div class="field"><label>My app is called</label><input id="projectNameInput" value="${escapeAttr(state.project.name)}" placeholder="e.g. My Animal Guide" maxlength="50"></div>
  <div class="field"><label>My database table is called</label><input id="tableNameInput" value="${escapeAttr(state.project.tableName)}" placeholder="e.g. Animals" maxlength="40"></div>
</div>
<div class="notice"><b>Database words:</b> a <b>field</b> is a column/type of information; a <b>record</b> is one complete row/item. Your first field should normally be a unique ID.</div>
${!state.project.fields.length?`<div class="blank-builder-state"><div class="big-emoji">🗃️</div><h3>Your database is completely empty</h3><p>Good — you are building it yourself. Start by clicking <b>+ Add field</b>. The tutorial above will guide you.</p></div>`:
`<div class="data-wrap"><table class="data-table"><thead><tr><th class="row-num">#</th>${state.project.fields.map(f=>`<th><div class="field-head"><div>${escapeHtml(f.name)}<span class="data-type">${typeIcon(f.type)} ${fieldTypeLabel(f.type)}</span></div><div class="field-head-actions"><button class="field-action" data-edit-field="${escapeAttr(f.id)}" title="Edit field">✎</button><button class="field-action danger" data-delete-field="${escapeAttr(f.id)}" title="Delete field">✕</button></div></div></th>`).join('')}<th></th></tr></thead><tbody>${state.project.records.map((r,ri)=>`<tr><td class="row-num">${ri+1}</td>${state.project.fields.map(f=>`<td>${dataCell(f,r,ri)}</td>`).join('')}<td><button class="icon-btn" data-delete-record="${ri}" title="Delete record">✕</button></td></tr>`).join('')}</tbody></table>${!state.project.records.length?'<div class="empty-note" style="margin-top:12px">Fields created. Now click <b>+ Add record</b> and enter your own data.</div>':''}</div>`}` }
function ratingStars(value){
  const n=Math.max(0,Math.min(10,Number(value)||0));
  return '★'.repeat(n)+'☆'.repeat(10-n);
}
function formatFieldValue(fieldId,value){
  const f=state.project.fields.find(x=>x.id===fieldId);
  return f?.type==='rating'?ratingStars(value):String(value??'');
}
function dataCell(f,r,ri){
  const value=r[f.id]??'';
  if(f.type==='image') return `<div class="image-cell"><img src="${escapeAttr(resolveImage(value))}" alt=""><button class="btn small" data-image-record="${ri}" data-image-field="${f.id}">Change</button></div>`;
  if(f.type==='imageUrl') return `<input data-record="${ri}" data-field="${f.id}" value="${escapeAttr(value)}" type="url" placeholder="https://example.com/photo.jpg">`;
  if(f.type==='rating') return `<div class="rating-cell" data-rating-record="${ri}" data-rating-field="${f.id}"><div class="rating-stars">${Array.from({length:10},(_,i)=>`<button type="button" class="rating-star ${i<Number(value||0)?'on':''}" data-rating-value="${i+1}" title="${i+1} out of 10">★</button>`).join('')}</div><small>${Number(value)||0}/10</small></div>`;
  if(f.type==='boolean') return `<select data-record="${ri}" data-field="${f.id}"><option value="" ${value===''?'selected':''}>Choose…</option><option value="true" ${String(value)==='true'?'selected':''}>Yes</option><option value="false" ${String(value)==='false'?'selected':''}>No</option></select>`;
  if(f.type==='longText') return `<textarea class="long-text-cell" data-record="${ri}" data-field="${f.id}" rows="4" placeholder="Enter longer text…">${escapeHtml(value)}</textarea>`;
  const type=f.type==='number'?'number':f.type==='date'?'date':'text';
  return `<input data-record="${ri}" data-field="${f.id}" value="${escapeAttr(value)}" type="${type}">`;
}

function currentPage(){
  return state.project.pages.find(p=>p.id===state.currentPageId)||state.project.pages[0];
}
function pageName(id){return state.project.pages.find(p=>p.id===id)?.name||'Page';}
function componentsOnPage(pageId=state.currentPageId){return state.project.components.filter(c=>(c.pageId||state.project.pages[0]?.id)===pageId);}
function fieldOptionsHtml(selected='',type='any',blank='Choose field…'){
  const fields=state.project.fields.filter(f=>type==='image'?['image','imageUrl'].includes(f.type):type==='text'?!['image','imageUrl'].includes(f.type):true);
  return `<option value="">${blank}</option>`+fields.map(f=>`<option value="${f.id}" ${f.id===selected?'selected':''}>${escapeHtml(f.name)} · ${escapeHtml(fieldTypeLabel(f.type))}</option>`).join('');
}
function pageOptionsHtml(selected='',exclude=''){
  return `<option value="">Choose page…</option>`+state.project.pages.filter(p=>p.id!==exclude).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
}
function designView(){
  const pg=currentPage();
  return `<div class="section-head"><div><h2>Design your app</h2><p>Create more than one page, then place components on the selected page.</p></div><button class="btn good" data-tab="test">▶ Test app</button></div>
  <div class="page-strip">
    <div class="page-tabs">${state.project.pages.map((p,i)=>`<button class="page-tab ${p.id===state.currentPageId?'active':''}" data-page-select="${p.id}"><span>${escapeHtml(p.name)}</span><small>Page ${i+1}</small></button>`).join('')}</div>
    <div class="page-actions"><button class="btn small" data-action="rename-page">Rename</button><button class="btn small" data-action="add-page">+ Add page</button>${state.project.pages.length>1?'<button class="btn small danger-text" data-action="delete-page">Delete page</button>':''}</div>
  </div>
  <div class="notice master-detail-note"><b>List → Details pattern:</b> Put a List on Home and design one reusable Details page. ${autoBlocksEnabled()?'Your teacher has enabled Auto-add support, so Design shortcuts can create starter Blockly for you.':'Programming stays in Blocks: you decide what happens when the user taps a row.'} The tapped row becomes the <b>selected record</b>.</div>
  <div class="design-grid">
  <aside class="toolbox"><h3>Components</h3>${[['label','🔤','Text / Label'],['image','🖼️','Image'],['button','🔘','Button'],['input','📝','Scrollable text box'],['list','☷','Database List']].map(c=>`<button class="component-btn" data-add-component="${c[0]}"><span>${c[1]}</span><span>${c[2]}</span></button>`).join('')}<div class="empty-note" style="margin-top:14px"><b>Selected page:</b><br>${escapeHtml(pg?.name||'Page')}</div></aside>
  <section class="workspace-panel"><div class="device-wrap"><div class="device-switch">${[['phone','Phone'],['large','Large phone'],['tablet','Tablet']].map(d=>`<button data-device="${d[0]}" class="${state.device===d[0]?'active':''}">${d[1]}</button>`).join('')}</div>${phoneMarkup('design')}</div></section>
  <aside class="properties">${propertiesMarkup()}</aside>
  </div>`;
}
function autoBlocksEnabled(){return state.blockSupportMode==='auto';}
function propertiesMarkup(){
  const c=state.project.components.find(x=>x.id===state.selectedComponent);
  if(!c){const pg=currentPage();return `<h3>${escapeHtml(pg?.name||'Page')}</h3><div class="prop-group"><label>Page background</label><div class="colour-row"><input data-page-prop="backgroundColor" type="color" value="${escapeAttr(pg?.backgroundColor||'#ffffff')}"><span>${escapeHtml(pg?.backgroundColor||'#ffffff')}</span></div></div><div class="empty-note">Click a component on ${escapeHtml(pg?.name||'this page')} to change its properties.</div>`;}
  return `<h3>${escapeHtml(c.name)}</h3>
  <div class="prop-group"><label>Name</label><input data-prop="name" value="${escapeAttr(c.name)}"></div>
  ${c.type!=='image'&&c.type!=='list'?`<div class="prop-group"><label>${c.type==='input'?'Text box content':'Text'}</label>${c.type==='input'?`<textarea data-prop="text" rows="5">${escapeHtml(c.text||'')}</textarea>`:`<input data-prop="text" value="${escapeAttr(c.text||'')}">`}</div>`:''}
  ${['label','button','input'].includes(c.type)?`<div class="prop-group colour-grid"><label>Text colour</label><input data-prop="textColor" type="color" value="${escapeAttr(c.textColor||'#172033')}"><label>Background colour</label><input data-prop="backgroundColor" type="color" value="${escapeAttr(c.backgroundColor||'#ffffff')}"></div>`:''}
  ${c.type==='image'?`<div class="prop-group"><label>Image</label><div class="property-image-preview"><img src="${escapeAttr(resolveImage(c.src))}" alt=""></div><button class="btn" style="width:100%" data-action="choose-component-image">🖼 Choose image</button></div>`:''}
  ${c.type==='label'?`<div class="prop-group"><label>Font size</label><input data-prop="fontSize" type="number" min="10" max="48" value="${c.fontSize||16}"></div><div class="prop-group"><label>Alignment</label><select data-prop="align"><option ${c.align==='left'?'selected':''}>left</option><option ${c.align==='center'?'selected':''}>center</option><option ${c.align==='right'?'selected':''}>right</option></select></div>`:''}
  ${c.type==='list'?listPropertiesMarkup(c):''}
  <div class="prop-group"><label>Width</label><input data-prop="w" type="number" value="${c.w}"></div><div class="prop-group"><label>Height</label><input data-prop="h" type="number" value="${c.h}"></div>
  ${['label','image','input'].includes(c.type)?(autoBlocksEnabled()?`<button class="btn connect" style="width:100%;margin-bottom:8px" data-action="connect-data">✨ Auto-connect Data</button><div class="connection-note">${connectionsFor(c.id)}</div>`:`<button class="btn connect" style="width:100%;margin-bottom:8px" data-program-component="${escapeAttr(c.id)}" data-program-kind="data">🧩 Program data in Blocks</button><div class="connection-note">${connectionsFor(c.id)} You add the Blockly yourself.</div>`):''}
  ${c.type==='button'?`<button class="btn connect" style="width:100%;margin-bottom:8px" data-program-component="${escapeAttr(c.id)}" data-program-kind="button">🧩 Tell ${escapeHtml(c.name)} what to do</button><div class="connection-note">Buttons only act when you program a <b>when ${escapeHtml(c.name)} clicked</b> event in Blocks.</div>`:''}
  <button class="btn small" style="width:100%;color:var(--danger)" data-action="delete-component">Delete component</button>`
}
function listPropertiesMarkup(c){
  const layouts=[
    ['image-title-subtitle','Image + title + subtitle'],
    ['image-title','Image + title'],
    ['image-only','Image only'],
    ['title-subtitle','Title + subtitle'],
    ['title-only','Title only']
  ];
  const needsImage=c.listLayout?.includes('image');
  const needsTitle=c.listLayout?.includes('title');
  const needsSubtitle=c.listLayout?.includes('subtitle');
  return `<div class="list-props">
    <div class="prop-section-title">Database list</div>
    <div class="prop-group"><label>Row layout</label><select data-list-prop="listLayout">${layouts.map(([v,n])=>`<option value="${v}" ${c.listLayout===v?'selected':''}>${n}</option>`).join('')}</select></div>
    ${needsImage?`<div class="prop-group"><label>Image field</label><select data-list-prop="listImageField">${fieldOptionsHtml(c.listImageField,'image')}</select></div>`:''}
    ${needsTitle?`<div class="prop-group"><label>Title field</label><select data-list-prop="listTitleField">${fieldOptionsHtml(c.listTitleField,'text')}</select></div>`:''}
    ${needsSubtitle?`<div class="prop-group"><label>Subtitle field</label><select data-list-prop="listSubtitleField">${fieldOptionsHtml(c.listSubtitleField,'text')}</select></div>`:''}
    <div class="prop-group"><label>List background</label><select data-list-prop="listBackground"><option value="white" ${(c.listBackground||(!c.listTransparent?'white':'transparent'))==='white'?'selected':''}>White</option><option value="transparent" ${(c.listBackground||(!c.listTransparent?'white':'transparent'))==='transparent'?'selected':''}>Transparent</option></select><small class="prop-help">Transparent lets the page background show through the list and every row.</small></div>
    ${autoBlocksEnabled()?`<div class="prop-group"><label>When a row is tapped</label><select data-list-prop="navigateToPage">${pageOptionsHtml(c.navigateToPage,c.pageId)}</select></div><div class="connection-note">${c.navigateToPage?`Tap → <b>${escapeHtml(pageName(c.navigateToPage))}</b>. Auto support will add the Blockly navigation.`:'Choose a destination page and Auto support will create the list-tap blocks.'}</div>`:`<button class="btn connect" style="width:100%;margin-top:8px" data-program-component="${escapeAttr(c.id)}" data-program-kind="list">🧩 Program what happens when a row is tapped</button><div class="connection-note">The tapped row automatically becomes the <b>selected record</b>, but you must add the Blockly event and navigation yourself.</div>`}
  </div>`;
}
function phoneMarkup(mode='design'){
  const pageId=state.currentPageId||state.project.pages[0]?.id;
  const pg=state.project.pages.find(p=>p.id===pageId);return `<div class="phone device-${state.device}"><div class="screen" style="background:${escapeAttr(pg?.backgroundColor||'#ffffff')}" data-phone-mode="${mode}" data-page-id="${escapeAttr(pageId)}">${componentsOnPage(pageId).map(c=>componentMarkup(c,mode)).join('')}</div></div>`;
}
function listRowsMarkup(c,mode){
  const rows=state.project.records||[];
  if(!rows.length)return `<div class="list-empty">No database records yet</div>`;
  return rows.map((r,i)=>{
    const image=c.listImageField?resolveImage(r[c.listImageField]):'';
    const title=c.listTitleField?formatFieldValue(c.listTitleField,r[c.listTitleField]):'';
    const subtitle=c.listSubtitleField?formatFieldValue(c.listSubtitleField,r[c.listSubtitleField]):'';
    const rowClass=`data-list-row layout-${c.listLayout||'image-title-subtitle'}`;
    return `<div class="${rowClass}" ${mode==='test'?`data-list-index="${i}"`:''}>
      ${c.listLayout?.includes('image')?`<div class="list-row-image">${image?`<img src="${escapeAttr(image)}" alt="">`:'<span>🖼️</span>'}</div>`:''}
      ${c.listLayout!=='image-only'?`<div class="list-row-copy">${c.listLayout?.includes('title')?`<strong>${escapeHtml(title||`Record ${i+1}`)}</strong>`:''}${c.listLayout?.includes('subtitle')?`<span>${escapeHtml(subtitle)}</span>`:''}</div>`:''}
      ${c.navigateToPage?'<div class="list-row-arrow">›</div>':''}
    </div>`;
  }).join('');
}
function componentMarkup(c,mode){
  const sel=mode==='design'&&state.selectedComponent===c.id?'selected':'';
  const style=`left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;`;
  const attrs=mode==='design'?`data-component="${c.id}"`:`data-test-component="${c.id}"`;
  const textColor=escapeAttr(c.textColor||'#172033'),bg=escapeAttr(c.backgroundColor||'transparent');
  let inner='';
  if(c.type==='label') inner=`<div class="label" style="font-size:${c.fontSize||16}px;text-align:${c.align||'left'};color:${textColor};background:${bg}">${escapeHtml(c.text||'Label')}</div>`;
  if(c.type==='button') inner=`<button style="background:${escapeAttr(c.backgroundColor||'#5b5ce2')};color:${escapeAttr(c.textColor||'#ffffff')}">${escapeHtml(c.text||'Button')}</button>`;
  if(c.type==='image') inner=`<img src="${escapeAttr(resolveImage(c.src))}" alt="">`;
  if(c.type==='input') inner=`<div class="text-box-component" style="background:${escapeAttr(c.backgroundColor||'#ffffff')};color:${textColor}">${escapeHtml(c.text||'Long text appears here')}</div>`;
  if(c.type==='list'){const transparent=(c.listBackground==='transparent'||c.listTransparent===true);inner=`<div class="listbox database-list ${transparent?'transparent-list':''}" style="${transparent?'background:transparent;':''}">${listRowsMarkup(c,mode)}</div>`;}
  const handles=mode==='design'&&sel?['nw','ne','sw','se'].map(pos=>`<span class="resize-handle resize-${pos}" data-resize-handle="${pos}" title="Drag to resize"></span>`).join(''):'';
  const moveHandle=mode==='design'&&sel?`<span class="move-handle" data-move-handle title="Drag to move">✥</span>`:'';
  return `<div class="screen-component ${sel}" ${attrs} style="${style}">${inner}${moveHandle}${handles}</div>`;
}

function blockTutorialCard(){
  const c=state.project.components.find(x=>x.id===state.selectedComponent);
  const kind=state.blockTutorial||'overview';
  const name=escapeHtml(c?.name||'your component');
  let title='Build the blocks yourself',body=`Choose the kind of help you need. Nothing is inserted into the workspace unless your teacher has turned on Auto-add support for you.`;
  if(kind==='button') {title=`Program ${name}`;body=`<ol><li>Open <b>Events</b> and drag <b>when … clicked</b> onto the workspace.</li><li>Choose <b>${name}</b> in its dropdown.</li><li>Open the category for the action you want. For example, use <b>Navigation → go to</b> to open another page, or <b>go back</b> for a Back button.</li><li>Snap the action block inside the event's <b>do</b> section.</li><li>Press <b>Run app</b> and click the button to test it.</li></ol>`;}
  if(kind==='list') {title='Program the list tap';body=`<ol><li>Open <b>Events</b> and drag <b>when an item in … is tapped</b>.</li><li>Choose your List in the dropdown.</li><li>The row the user taps automatically becomes the <b>selected record</b>.</li><li>Open <b>Navigation</b>, drag <b>go to</b> inside the event, and choose your Details page.</li><li>Test by tapping several different list rows.</li></ol>`;}
  if(kind==='data') {title=`Show database data in ${name}`;body=`<ol><li>Open <b>Events</b> and drag <b>when [Details] opens</b>.</li><li>Open <b>Screen</b> and drag <b>set … to … from selected record</b> inside it.</li><li>Choose <b>${name}</b> as the component.</li><li>Choose the database field it should display.</li><li>Repeat with the other placeholders on the Details page.</li></ol>`;}
  return `<div class="block-tutorial-card"><div class="block-tutorial-head"><div><span class="tag ${autoBlocksEnabled()?'tag-good':''}">${autoBlocksEnabled()?'✨ Auto-add support ON':'🧩 You build the blocks'}</span><h3>${title}</h3></div></div><div class="block-help-tabs"><button class="btn small ${kind==='button'?'primary':''}" data-block-help="button">Button</button><button class="btn small ${kind==='list'?'primary':''}" data-block-help="list">List → Details</button><button class="btn small ${kind==='data'?'primary':''}" data-block-help="data">Details placeholders</button></div><div class="block-tutorial-body">${body}</div></div>`;
}
function blocksView(){const pg=currentPage();return `<div class="section-head"><div><h2>Make ${escapeHtml(pg?.name||'this page')} work</h2><p>Each page has its own Blockly workspace, so you only see the blocks for the page you are programming.</p></div><button class="btn good" data-tab="test">▶ Run app</button></div>
<div class="page-strip blocks-page-strip"><div class="page-tabs">${state.project.pages.map((p,i)=>`<button class="page-tab ${p.id===state.currentPageId?'active':''}" data-block-page="${p.id}"><span>${escapeHtml(p.name)}</span><small>Page ${i+1} blocks</small></button>`).join('')}</div><div class="page-actions"><span class="tag">Editing: ${escapeHtml(pg?.name||'Page')}</span></div></div>
${blockTutorialCard()}
<div class="blockly-layout"><section class="blockly-card"><div class="blockly-help"><b>Remember:</b> <span>A list tap chooses the selected database record. Screen blocks display fields from it, and Navigation blocks move between pages.</span></div><div id="blocklyDiv" class="blockly-workspace"></div></section>
<aside class="code-panel blockly-code"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Show code</h3><span class="tag">Live</span></div><div class="code-toggle"><button data-code-mode="python" class="${state.codeMode==='python'?'active':''}">Python idea</button><button data-code-mode="plain" class="${state.codeMode==='plain'?'active':''}">Plain English</button></div><div class="codebox" id="generatedCode">${escapeHtml(generateCode())}</div><div class="mini-checks">${checklistBadges()}</div><div class="notice" style="margin-top:12px">${autoBlocksEnabled()?'Your teacher has enabled <b>Auto-add block support</b>. Design shortcuts may create starter blocks for you. You can still change them yourself.':'Design shortcuts will <b>not</b> create Blockly for you. Use the tutorial above and build the blocks yourself.'}</div></aside></div>`}

function programMarkup(){
  if(!state.project.program.length) return `<div class="hint">Click a block in the toolbox to start.</div>`;
  return state.project.program.map(b=>blockMarkup(b)).join('');
}
function optionsComponents(selected, types=null){return state.project.components.filter(c=>!types||types.includes(c.type)).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
function optionsFields(selected){return state.project.fields.map(f=>`<option value="${f.id}" ${f.id===selected?'selected':''}>${escapeHtml(f.name)}</option>`).join('')}
function blockMarkup(b){
  if(b.type==='event_open') return `<div class="program-block event" data-block-id="${b.id}">when <b>Screen1</b> opens <span class="block-move"><button class="move-block" data-dir="-1">↑</button><button class="move-block" data-dir="1">↓</button></span><button class="remove-block">✕</button></div>`;
  if(b.type==='event_click') return `<div class="program-block event" data-block-id="${b.id}">when <select data-block-prop="component">${optionsComponents(b.component,['button'])}</select> clicked <span class="block-move"><button class="move-block" data-dir="-1">↑</button><button class="move-block" data-dir="1">↓</button></span><button class="remove-block">✕</button></div>`;
  if(b.type==='next_record') return `<div class="program-block data" data-block-id="${b.id}">🗃 get next record <span class="block-move"><button class="move-block" data-dir="-1">↑</button><button class="move-block" data-dir="1">↓</button></span><button class="remove-block">✕</button></div>`;
  if(b.type==='prev_record') return `<div class="program-block data" data-block-id="${b.id}">🗃 get previous record <span class="block-move"><button class="move-block" data-dir="-1">↑</button><button class="move-block" data-dir="1">↓</button></span><button class="remove-block">✕</button></div>`;
  if(b.type==='set_field') return `<div class="program-block screenb" data-block-id="${b.id}">set <select data-block-prop="target">${optionsComponents(b.target)}</select> to <select data-block-prop="field">${optionsFields(b.field)}</select> from selected record <span class="block-move"><button class="move-block" data-dir="-1">↑</button><button class="move-block" data-dir="1">↓</button></span><button class="remove-block">✕</button></div>`;
  return '';
}

function testView(){return `<div class="section-head"><div><h2>Test your app</h2><p>Use the buttons on the phone. The debugger explains what is happening.</p></div><div><button class="btn" data-action="restart-test">↻ Restart</button> <button class="btn primary" data-tab="blocks">Edit blocks</button></div></div>
<div class="test-grid"><section class="test-stage"><div>${phoneMarkup('test')}</div></section><aside class="test-side"><div class="record-card"><h3>Current database record</h3>${recordInspector()}</div><div class="debug"><h3>🐞 What's happening?</h3><div id="debugLog">${state.testLogs.length?state.testLogs.map(l=>`<div class="log-line ${l.kind||''}">${escapeHtml(l.text)}</div>`).join(''):`<div class="log-line">Press Restart or use the app buttons to see events here.</div>`}</div></div></aside></div>`}
function recordInspector(){const r=state.project.records[state.currentRecord]||{}; return `<div class="record-grid">${state.project.fields.map(f=>`<dt>${escapeHtml(f.name)}</dt><dd>${f.type==='image'?'[image]':escapeHtml(String(r[f.id]??''))}</dd>`).join('')}</div>`}


function publishView(){
  const pub=state.project.publish||(state.project.publish={appName:state.project.name,icon:'',theme:'#5b5ce2',orientation:'portrait'});
  const iconSrc=pub.iconData||resolveImage(pub.icon)||imageSvg('📱','App icon',pub.theme);
  const live=!!(pub.publicId&&pub.isPublished);
  const shareUrl=live?publishedUrl(pub.publicId):'';
  return `<div class="section-head"><div><h2>Publish your app</h2><p>Create a public, installable snapshot of the app you built.</p></div></div>
  <div class="publish-grid"><section class="card"><div class="publish-icon"><img src="${escapeAttr(iconSrc)}" alt="App icon"></div><div class="prop-group"><label>App name</label><input id="publishName" value="${escapeAttr(pub.appName||state.project.name)}" maxlength="30"></div>
  <div class="prop-group"><label>Orientation</label><select id="publishOrientation"><option value="portrait" ${pub.orientation==='portrait'?'selected':''}>Portrait</option><option value="landscape" ${pub.orientation==='landscape'?'selected':''}>Landscape</option><option value="any" ${pub.orientation==='any'?'selected':''}>Allow both</option></select></div>
  <button class="btn" data-action="choose-app-icon">🎨 Choose app icon</button> <button class="btn" data-action="upload-app-icon">⬆ Upload separate icon</button><input id="appIconFile" type="file" accept="image/*" hidden>
  <div class="notice" style="margin-top:14px">Your app icon is stored separately and <b>does not use one of your 20 personal image slots</b>.</div>
  <button class="btn primary publish-main-btn" data-action="publish-project">${live?'Update published app':'🚀 Publish app'}</button>
  ${live?`<button class="btn small" data-action="unpublish-project" style="margin-top:8px">Unpublish</button>`:''}</section>
  <section class="card"><h3>${live?'Your Android app is ready':'Android publishing'}</h3><p class="muted">${live?'Scan the QR code on an Android phone, open the app in Chrome, then tap Install app.':'Choose an icon and press Publish. DataApp Studio will create an unlisted public snapshot, unique link and QR code.'}</p><div class="publish-phone"><div class="home-icon"><img src="${escapeAttr(pub.icon512||iconSrc)}"><span>${escapeHtml(pub.appName||state.project.name)}</span></div></div>
  ${live?`<div class="publish-result"><div id="publishQr" class="qr-box" aria-label="QR code"></div><div class="share-url">${escapeHtml(shareUrl)}</div><div class="publish-actions"><button class="btn primary" data-action="open-published">Open app</button><button class="btn" data-action="copy-published">Copy link</button></div><div class="notice goodish">The link is a <b>published snapshot</b>. People opening it do not get access to the pupil's editable project or Google account.</div></div>`:
  `<div class="notice warning">Publishing requires Firebase and a signed-in pupil account. Anyone with the QR code or link can open the published app, but they cannot access the pupil's classroom account or editable project.</div>`}</section></div>`;
}
function bindPublish(){
  const pub=state.project.publish||(state.project.publish={appName:state.project.name,icon:'',theme:'#5b5ce2',orientation:'portrait'});
  $('#publishName').oninput=e=>{pub.appName=e.target.value;saveProject()}; $('#publishOrientation').onchange=e=>{pub.orientation=e.target.value;saveProject();render()};
  $('[data-action="choose-app-icon"]').onclick=()=>showMediaPicker({title:'Choose an app icon',selected:pub.icon,iconMode:true,onSelect:choice=>{pub.icon=choice.ref;pub.iconData=choice.dataUrl;saveProject();render()}});
  $('[data-action="upload-app-icon"]').onclick=()=>$('#appIconFile').click(); $('#appIconFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const c=await compressImage(f,90*1024,512);pub.icon='';pub.iconData=c.dataUrl;saveProject();render()}catch(err){alert(err.message)}};
  const publish=$('[data-action="publish-project"]');if(publish)publish.onclick=()=>publishCurrentProject(publish);
  const unpublish=$('[data-action="unpublish-project"]');if(unpublish)unpublish.onclick=async()=>{if(!confirm('Unpublish this app? Its QR link will stop opening until you publish it again.'))return;try{await unpublishProject(state.user,pub.publicId);pub.isPublished=false;saveProject();render()}catch(err){alert(friendlyFirebaseError(err))}};
  const open=$('[data-action="open-published"]');if(open)open.onclick=()=>window.open(publishedUrl(pub.publicId),'_blank','noopener');
  const copy=$('[data-action="copy-published"]');if(copy)copy.onclick=async()=>{const url=publishedUrl(pub.publicId);try{await navigator.clipboard.writeText(url);copy.textContent='✓ Copied'}catch{prompt('Copy this link:',url)}};
  if(pub.publicId&&pub.isPublished)requestAnimationFrame(()=>renderPublishQr(publishedUrl(pub.publicId)));
}
function publishedUrl(publicId){const base=String(publicAppBaseUrl||'').trim();const root=base?new URL(base.endsWith('/')?base:base+'/',location.href):location.href;const u=new URL('published.html',root);u.search='';u.hash='';u.searchParams.set('id',publicId);return u.href}
async function renderPublishQr(url){
  const el=$('#publishQr');if(!el)return;el.innerHTML='<div class="muted">Making QR code…</div>';
  try{
    if(!window.QRCode)await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    if(!document.body.contains(el))return;el.innerHTML='';new window.QRCode(el,{text:url,width:190,height:190,correctLevel:window.QRCode.CorrectLevel?.M});
  }catch(err){if(document.body.contains(el))el.innerHTML=`<div class="empty-note">QR code could not load.<br><a href="${escapeAttr(url)}" target="_blank">Open app link</a></div>`;}
}
function loadExternalScript(src){return new Promise((resolve,reject)=>{const old=[...document.scripts].find(s=>s.src===src);if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});if(window.QRCode)return resolve();return}const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.appendChild(script)})}
async function loadImageSource(src){return new Promise((resolve,reject)=>{const img=new Image();if(/^https?:/i.test(src))img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not prepare the selected app icon. Try uploading a different icon.'));img.src=src})}
async function makeSquareIconDataUrl(src,size,targetBytes){
  const img=await loadImageSource(src);let quality=.8,blob=null;
  for(let attempt=0;attempt<10;attempt++){
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);
    const scale=Math.max(size/img.naturalWidth,size/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
    blob=await new Promise(res=>canvas.toBlob(res,'image/webp',quality));if(blob&&blob.size<=targetBytes)break;quality-=.08;
  }
  if(!blob||blob.size>targetBytes)throw new Error('The app icon could not be compressed enough. Try a simpler image.');
  return blobToDataUrl(blob);
}
function makePublishSnapshot(){
  const snap=clone(state.project);snap.blocklyState=null;delete snap.assignmentId;delete snap.tutorialEnabled;snap.publish={appName:state.project.publish?.appName||state.project.name,theme:state.project.publish?.theme||'#6256df',orientation:state.project.publish?.orientation||'any'};
  const imageFields=new Set((snap.fields||[]).filter(f=>f.type==='image').map(f=>f.id));
  for(const r of snap.records||[])for(const fid of imageFields)if(r[fid])r[fid]=resolveImage(r[fid]);
  for(const c of snap.components||[])if(c.type==='image'&&c.src)c.src=resolveImage(c.src);
  return snap;
}
async function publishCurrentProject(button){
  if(!CLOUD_MODE||!state.user||state.role!=='pupil'){alert('Sign in as a pupil with Firebase before publishing.');return}
  if(!state.project.fields.length||!state.project.components.length){alert('Build your database and app screen before publishing.');return}
  const pub=state.project.publish||(state.project.publish={});
  if(!pub.icon&&!pub.iconData){alert('Choose an app icon first.');return}
  button.disabled=true;const original=button.textContent;button.textContent='Publishing…';
  try{
    const source=pub.iconData||resolveImage(pub.icon);const [i192,i512]=await Promise.all([makeSquareIconDataUrl(source,192,70*1024),makeSquareIconDataUrl(source,512,120*1024)]);
    const icons=await uploadPublishedIcons(state.user,state.project.id,i192,i512);pub.icon192=icons.icon192;pub.icon512=icons.icon512;
    const result=await publishProject(state.user,state.project,makePublishSnapshot(),icons);pub.publicId=result.publicId;pub.isPublished=true;saveProject();render();
  }catch(err){console.error(err);alert(friendlyFirebaseError(err));button.disabled=false;button.textContent=original;}
}

function bindCommon(){
  $$('[data-role]').forEach(b=>b.onclick=()=>{
    state.role=b.dataset.role;
    if(!CLOUD_MODE && !state.classes.length){
      state.classes=[{id:'local-demo',name:'S2 Computing Demo',className:'S2 Computing Demo',joinCode:'DEMO42'}];
      state.currentClassId='local-demo'; state.currentClass=state.classes[0];
      if(state.role==='teacher') state.members=[{uid:'demo-sophie',displayName:'Sophie M.',email:'sophie@example.school'}];
    }
    state.view=state.role==='teacher'?'teacher':'pupil'; render();
  });
  $$('[data-auth-intent]').forEach(b=>b.onclick=async()=>{
    const intent=b.dataset.authIntent; state.authError='';
    sessionStorage.setItem('dataapp_auth_intent',intent);
    localStorage.setItem('dataapp_last_role',intent==='teacher'?'teacher':'pupil-return');
    b.disabled=true; b.querySelector('strong').textContent='Opening Google sign-in…';
    try{await signInWithGoogle()}catch(err){state.authError=friendlyFirebaseError(err);render()}
  });
  $$('[data-action="home"]').forEach(b=>b.onclick=async()=>{
    if(CLOUD_MODE){try{await signOutUser()}catch(err){console.error(err)}}
    state.view='landing';state.role=null;state.user=null;state.classes=[];state.currentClass=null;state.teacherAdmin=false;state.teacherInvites=[];state.teacherAccounts=[];state.teacherInspectActive=false;state.teacherPupilUid='';render();
  });
  $$('[data-action="check-teacher"]').forEach(b=>b.onclick=async()=>{await finishSignedInUser(state.user,'teacher')});
  $$('[data-action="open-builder"]').forEach(b=>b.onclick=()=>{state.project=normaliseProject(state.project);state.currentPageId=state.project.pages[0]?.id||'screen1';state.pageHistory=[];state.view='builder';state.tab='data';if(state.project.tutorialEnabled===undefined)state.project.tutorialEnabled=true;render()});
  $$('[data-action="new-app"]').forEach(b=>b.onclick=showNewAppModal);
  $$('[data-open-project]').forEach(b=>b.onclick=()=>openPupilProject(b.dataset.openProject));
  $$('[data-rename-project]').forEach(b=>b.onclick=()=>renamePupilProject(b.dataset.renameProject));
  $$('[data-duplicate-project]').forEach(b=>b.onclick=()=>duplicatePupilProject(b.dataset.duplicateProject));
  $$('[data-delete-project]').forEach(b=>b.onclick=()=>deletePupilProject(b.dataset.deleteProject));
  $$('[data-action="back-pupil"]').forEach(b=>b.onclick=()=>{if(state.teacherInspectActive&&state.role==='teacher'){state.teacherInspectActive=false;state.view='teacher-pupil';}else state.view=state.role==='teacher'?'teacher':'pupil';render()});
  $$('[data-view-pupil]').forEach(b=>b.onclick=()=>openTeacherPupil(b.dataset.viewPupil));
  $$('[data-teacher-open-project]').forEach(b=>b.onclick=()=>openTeacherProject(b.dataset.teacherOpenProject));
  $$('[data-action="back-class"]').forEach(b=>b.onclick=()=>{state.teacherInspectActive=false;state.view='teacher';render()});
  $$('[data-start-assignment]').forEach(b=>b.onclick=()=>startAssignment(b.dataset.startAssignment));
  $$('[data-select-class]').forEach(b=>b.onclick=()=>selectClass(b.dataset.selectClass));
  $$('[data-action="create-class"]').forEach(b=>b.onclick=showCreateClassModal);
  $$('[data-action="join-class"]').forEach(b=>b.onclick=showJoinClassModal);
  const newAssignment=$('[data-action="new-assignment"]'); if(newAssignment)newAssignment.onclick=showAssignmentModal;
  const manageBank=$('[data-action="manage-bank"]'); if(manageBank)manageBank.onclick=showBankManager;
  const inviteTeacher=$('[data-action="invite-teacher"]'); if(inviteTeacher)inviteTeacher.onclick=showInviteTeacherModal;
  $$('[data-cancel-teacher-invite]').forEach(b=>b.onclick=async()=>{
    const email=b.dataset.cancelTeacherInvite;if(!confirm(`Cancel the invitation for ${email}?`))return;
    try{await cancelTeacherInvite(state.user,email);await loadTeacherAdminData();render()}catch(err){alert(friendlyFirebaseError(err))}
  });
  $$('[data-revoke-teacher]').forEach(b=>b.onclick=async()=>{
    const uid=b.dataset.revokeTeacher,email=b.dataset.teacherEmail||'';
    if(!confirm(`Revoke teacher access${email?` for ${email}`:''}? Their own classes and pupil work will remain stored, but they will no longer be able to use the teacher account.`))return;
    try{await revokeTeacherAccount(state.user,uid,email);await loadTeacherAdminData();render()}catch(err){alert(friendlyFirebaseError(err))}
  });
  const regen=$('[data-action="regenerate-code"]'); if(regen)regen.onclick=async()=>{if(!state.currentClassId)return;if(!confirm('Generate a new class code? The old code will stop working.'))return;try{const code=CLOUD_MODE?await regenerateJoinCode(state.currentClassId):'DEMO'+Math.floor(10+Math.random()*89);state.currentClass.joinCode=code;const c=state.classes.find(x=>x.id===state.currentClassId);if(c)c.joinCode=code;render()}catch(err){alert(err.message)}};
  $$('[data-block-support]').forEach(sel=>sel.onchange=async()=>{
    const uid=sel.dataset.blockSupport,mode=sel.value==='auto'?'auto':'manual';
    sel.disabled=true;
    try{
      if(CLOUD_MODE)await updateClassMemberSettings(state.currentClassId,uid,{blockSupportMode:mode});
      const member=state.members.find(m=>(m.uid||m.id)===uid);if(member)member.blockSupportMode=mode;
    }catch(err){alert(friendlyFirebaseError(err));render();return}
    sel.disabled=false;
  });
  $$('[data-remove-member]').forEach(b=>b.onclick=async()=>{const uid=b.dataset.removeMember;if(!confirm('Remove this pupil from the class? Their saved project will not be deleted.'))return;try{if(CLOUD_MODE)await removeClassMember(state.currentClassId,uid);state.members=state.members.filter(m=>(m.uid||m.id)!==uid);render()}catch(err){alert(err.message)}});
}
function bindBuilder(){
  $$('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;if(state.tab==='test') startTest(false);render()});
  if(state.teacherInspectActive&&state.role==='teacher'){
    $$('[data-page-select]').forEach(b=>b.onclick=()=>{state.currentPageId=b.dataset.pageSelect;state.selectedComponent=null;render()});
    $$('[data-device]').forEach(b=>b.onclick=()=>{state.device=b.dataset.device;render()});
    if(state.tab==='blocks') bindBlocks(true);
    if(state.tab==='test') bindTest();
    return;
  }
  if(state.tab==='data') bindData();
  if(state.tab==='design') bindDesign();
  if(state.tab==='blocks') bindBlocks();
  if(state.tab==='test') bindTest();
  if(state.tab==='publish') bindPublish();
  const manageImages=$('[data-action="manage-images"]'); if(manageImages)manageImages.onclick=showPersonalManager;
  const tutorialToggle=$('[data-action="toggle-tutorial"]'); if(tutorialToggle)tutorialToggle.onclick=()=>{state.project.tutorialEnabled=state.project.tutorialEnabled===false;saveProject();render()};
  $$('[data-tutorial-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tutorialTab;if(state.tab==='test')startTest(false);render()});
  const reset=$('[data-action="reset"]'); if(reset) reset.onclick=()=>{if(confirm('Clear this project and start again from a blank canvas? This removes its fields, records, screen components and blocks.')){const name=state.project.name,assignmentId=state.project.assignmentId||'',tutorialEnabled=state.project.tutorialEnabled!==false;state.project=freshBlankProject(name,assignmentId);state.project.tutorialEnabled=tutorialEnabled;state.currentRecord=0;state.currentPageId=state.project.pages[0].id;state.pageHistory=[];state.selectedComponent=null;saveProject();render()}};
}

function bindData(){
  $$('.data-table [data-record][data-field]').forEach(inp=>{const update=()=>{const r=state.project.records[+inp.dataset.record];const f=state.project.fields.find(x=>x.id===inp.dataset.field);let v=inp.value;if(f.type==='number')v=Number(v);if(f.type==='boolean'&&v!=='')v=v==='true';r[f.id]=v;saveProject()};inp.oninput=update;inp.onchange=update});
  $$('.rating-star[data-rating-value]').forEach(btn=>btn.onclick=()=>{const host=btn.closest('[data-rating-record]'),r=state.project.records[Number(host.dataset.ratingRecord)],f=host.dataset.ratingField;if(!r)return;r[f]=Number(btn.dataset.ratingValue);saveProject();render()});
  $$('[data-image-record]').forEach(b=>b.onclick=()=>showImageModal(+b.dataset.imageRecord,b.dataset.imageField));
  $$('[data-delete-record]').forEach(b=>b.onclick=()=>{state.project.records.splice(+b.dataset.deleteRecord,1);saveProject();render()});
  const addRecord=$('[data-action="add-record"]'); if(addRecord)addRecord.onclick=()=>{if(!state.project.fields.length){alert('Add at least one field before adding a record.');return}const row={};state.project.fields.forEach(f=>row[f.id]=['number','rating'].includes(f.type)?0:f.type==='boolean'?false:'');if(state.project.fields[0]) row[state.project.fields[0].id]=nextId();state.project.records.push(row);saveProject();render()};
  $('[data-action="add-field"]').onclick=()=>showFieldModal();
  $$('[data-edit-field]').forEach(b=>b.onclick=()=>showEditFieldModal(b.dataset.editField));
  $$('[data-delete-field]').forEach(b=>b.onclick=()=>deleteField(b.dataset.deleteField));
  const projectName=$('#projectNameInput'); if(projectName)projectName.oninput=()=>{state.project.name=projectName.value;if(!state.project.publish)state.project.publish={};state.project.publish.appName=projectName.value;saveProject()};
  const tableName=$('#tableNameInput'); if(tableName)tableName.oninput=()=>{state.project.tableName=tableName.value;saveProject()};
}
function showImageModal(recordIndex,fieldId){
  showMediaPicker({
    title:'Choose an image for this record',
    selected:state.project.records[recordIndex][fieldId],
    onSelect:ref=>{state.project.records[recordIndex][fieldId]=ref;saveProject();render()}
  });
}

async function addPersonalImage(file){
  if(personalImageCount()>=PERSONAL_IMAGE_LIMIT) throw new Error(`You have used all ${PERSONAL_IMAGE_LIMIT} personal image slots.`);
  const compressed=await compressImage(file);
  const name=file.name.replace(/\.[^.]+$/,'');
  if(CLOUD_MODE&&state.user){
    const asset=await uploadPersonalImage(state.user,{name,tags:file.name,...compressed});
    state.media.personal.push(asset);
    state.media.personal.sort((a,b)=>a.id.localeCompare(b.id));
    return assetRef('personal',asset.id);
  }
  const id=`p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  state.media.personal.push({id,name,category:'My Images',tags:file.name.toLowerCase(),...compressed,source:'personal',createdAt:Date.now()});
  if(!saveMediaStore()) state.media.personal.pop();
  return assetRef('personal',id);
}
async function addSharedImage(file){
  const compressed=await compressImage(file,100*1024,900);
  const name=file.name.replace(/\.[^.]+$/,'');
  if(CLOUD_MODE&&state.user){
    const asset=await uploadSharedImage(state.user,{name,tags:file.name,category:'Teacher uploads',...compressed});
    state.media.shared.push({...asset,locked:false});
    return assetRef('shared',asset.id);
  }
  const id=`t-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  state.media.shared.push({id,name,category:'Teacher uploads',tags:file.name.toLowerCase(),...compressed,source:'teacher',createdAt:Date.now(),locked:false});
  if(!saveMediaStore()) state.media.shared.pop();
  return assetRef('shared',id);
}
function mediaCard(asset,scope,selected=''){
  const ref=assetRef(scope,asset.id), active=ref===selected?'selected':'';
  return `<button class="media-card ${active}" data-media-ref="${escapeAttr(ref)}"><img src="${escapeAttr(asset.dataUrl)}" alt=""><span>${escapeHtml(asset.name)}</span><small>${escapeHtml(asset.category||'Image')}${asset.size?` · ${friendlyBytes(asset.size)}`:''}</small></button>`;
}
function showMediaPicker({title='Choose an image',selected='',onSelect,iconMode=false}){
  const selectedIsUrl=!iconMode && /^https:\/\//i.test(String(selected||''));
  let tab=selectedIsUrl?'url':selected?.startsWith('asset:personal:')?'personal':'shared', query='', urlValue=selectedIsUrl?String(selected):'';
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  const paint=()=>{
    const source=tab==='url'?[]:state.media[tab].filter(a=>!query||`${a.name} ${a.category||''} ${a.tags||''}`.toLowerCase().includes(query.toLowerCase()));
    const libraryPanel=tab!=='url'?`
      <div class="media-toolbar"><input id="mediaSearch" placeholder="Search images…" value="${escapeAttr(query)}"><button class="btn ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'disabled':''}" id="uploadPersonal" ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'disabled':''}>+ Upload my image</button><input type="file" id="personalFile" accept="image/*" hidden></div>
      ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'<div class="notice warning">You have reached 20 personal images. Delete an unused image or choose from the shared Image Bank.</div>':''}
      <div class="media-grid">${source.length?source.map(a=>mediaCard(a,tab,selected)).join(''):'<div class="empty-note">No matching images.</div>'}</div>`:`
      <div class="image-url-panel">
        <div class="field"><label>Direct image web address</label><input id="imageUrlValue" type="url" placeholder="https://example.com/photo.jpg" value="${escapeAttr(urlValue)}"></div>
        <p class="muted">Use a direct <b>https://</b> image address. The image stays hosted on that website and does not use one of your personal image slots.</p>
        <div class="image-url-preview ${urlValue?'':'empty'}">${urlValue?`<img src="${escapeAttr(urlValue)}" alt="Image URL preview" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="empty-note" style="display:none">That address could not be previewed. Check that it is a direct image link.</div>`:'<div class="empty-note">Paste an image address to preview it.</div>'}</div>
        <button class="btn primary" id="useImageUrl" ${/^https:\/\//i.test(urlValue)?'':'disabled'}>Use this image</button>
      </div>`;
    wrap.innerHTML=`<div class="modal media-modal"><div class="media-modal-head"><div><h3>${escapeHtml(title)}</h3><p class="muted">${iconMode?'App icons do not use a personal image slot.':'Personal images: '+personalImageCount()+' / '+PERSONAL_IMAGE_LIMIT+' used.'}</p></div><button class="icon-btn" id="closeMedia">✕</button></div>
      <div class="media-tabs"><button class="${tab==='shared'?'active':''}" data-media-tab="shared">🏫 Image Bank</button><button class="${tab==='personal'?'active':''}" data-media-tab="personal">👤 My Images (${personalImageCount()}/${PERSONAL_IMAGE_LIMIT})</button>${iconMode?'':`<button class="${tab==='url'?'active':''}" data-media-tab="url">🔗 Image URL</button>`}</div>
      ${libraryPanel}
      <div class="modal-actions"><button class="btn" id="cancelMedia">Cancel</button></div></div>`;
    $('#closeMedia',wrap).onclick=$('#cancelMedia',wrap).onclick=()=>wrap.remove();
    $$('[data-media-tab]',wrap).forEach(b=>b.onclick=()=>{tab=b.dataset.mediaTab;paint()});
    const search=$('#mediaSearch',wrap); if(search)search.oninput=()=>{query=search.value;const pos=search.selectionStart;paint();const next=$('#mediaSearch',wrap);next.focus();next.setSelectionRange(pos,pos)};
    $$('[data-media-ref]',wrap).forEach(b=>b.onclick=()=>{const ref=b.dataset.mediaRef;if(iconMode){const asset=findAsset(ref);onSelect?.({ref,dataUrl:asset?.dataUrl||''});}else onSelect?.(ref);wrap.remove()});
    const urlInput=$('#imageUrlValue',wrap), useUrl=$('#useImageUrl',wrap), urlPreview=$('.image-url-preview',wrap);
    if(urlInput)urlInput.oninput=()=>{
      urlValue=urlInput.value.trim();const valid=/^https:\/\//i.test(urlValue);if(useUrl)useUrl.disabled=!valid;
      window.clearTimeout(wrap.__urlPreviewTimer);wrap.__urlPreviewTimer=window.setTimeout(()=>{if(!urlPreview)return;if(!valid){urlPreview.innerHTML='<div class="empty-note">Paste an https:// image address to preview it.</div>';return;}urlPreview.innerHTML=`<img src="${escapeAttr(urlValue)}" alt="Image URL preview"><div class="empty-note" style="display:none">That address could not be previewed. Check that it is a direct image link.</div>`;const im=$('img',urlPreview);if(im)im.onerror=()=>{im.style.display='none';const note=$('.empty-note',urlPreview);if(note)note.style.display='block'};},250);
    };
    if(useUrl)useUrl.onclick=()=>{const value=String(urlValue||'').trim();if(!/^https:\/\//i.test(value)){alert('Please use an https:// image address.');return;}onSelect?.(value);wrap.remove()};
    const upload=$('#uploadPersonal',wrap), file=$('#personalFile',wrap);
    if(upload&&file)upload.onclick=()=>file.click();
    if(file)file.onchange=async()=>{if(!file.files?.[0])return;upload.disabled=true;upload.textContent='Optimising…';try{const ref=await addPersonalImage(file.files[0]);if(iconMode){const asset=findAsset(ref);onSelect?.({ref,dataUrl:asset?.dataUrl||''});wrap.remove();}else{selected=ref;tab='personal';paint()}}catch(err){alert(err.message);paint()}};
  };
  document.body.appendChild(wrap);paint();
}
function showPersonalManager(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  const paint=()=>{wrap.innerHTML=`<div class="modal media-modal"><div class="media-modal-head"><div><h3>👤 My Images</h3><p class="muted">${personalImageCount()} / ${PERSONAL_IMAGE_LIMIT} used · uploads are compressed to around 80 KB or less.</p></div><button class="icon-btn" id="closePersonal">✕</button></div>
  <div class="media-toolbar"><button class="btn primary" id="managerUpload" ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'disabled':''}>+ Upload image</button><input id="managerFile" type="file" accept="image/*" hidden></div>
  <div class="media-manage-grid">${state.media.personal.length?state.media.personal.map(a=>{const ref=assetRef('personal',a.id),uses=imageUsage(ref);return `<div class="manage-image"><img src="${escapeAttr(a.dataUrl)}"><div><strong>${escapeHtml(a.name)}</strong><small>${friendlyBytes(a.size)} · ${imageUsageAcrossApps(ref)} use${imageUsageAcrossApps(ref)===1?'':'s'} across your apps</small></div><button class="btn small" data-delete-personal="${a.id}">Delete</button></div>`}).join(''):'<div class="empty-note">You have not uploaded any personal images yet.</div>'}</div>
  <div class="modal-actions"><button class="btn" id="donePersonal">Done</button></div></div>`;
  $('#closePersonal',wrap).onclick=$('#donePersonal',wrap).onclick=()=>{wrap.remove();render()};
  const up=$('#managerUpload',wrap), fi=$('#managerFile',wrap); if(up)up.onclick=()=>fi.click(); if(fi)fi.onchange=async()=>{if(!fi.files?.[0])return;up.disabled=true;up.textContent='Optimising…';try{await addPersonalImage(fi.files[0]);paint()}catch(err){alert(err.message);paint()}};
  $$('[data-delete-personal]',wrap).forEach(b=>b.onclick=async()=>{const id=b.dataset.deletePersonal,ref=assetRef('personal',id),uses=imageUsage(ref),allUses=imageUsageAcrossApps(ref);if(allUses>uses){alert(`This image is still used ${allUses} time${allUses===1?'':'s'} across your saved apps. Remove it from those apps before deleting it.`);return;}if(uses&&!confirm(`This image is used ${uses} time${uses===1?'':'s'} in this app. Delete it and remove those uses?`))return;try{if(CLOUD_MODE&&state.user)await deletePersonalImage(state.user,id);state.media.personal=state.media.personal.filter(a=>a.id!==id);clearImageRef(ref);if(!CLOUD_MODE)saveMediaStore();saveProject();paint()}catch(err){alert(err.message)}});
  };document.body.appendChild(wrap);paint();
}
function showBankManager(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  const paint=()=>{wrap.innerHTML=`<div class="modal media-modal"><div class="media-modal-head"><div><h3>🏫 Shared Image Bank</h3><p class="muted">Pupils can use these without using one of their 20 personal image slots.</p></div><button class="icon-btn" id="closeBank">✕</button></div>
  <div class="media-toolbar"><button class="btn primary" id="bankUpload">+ Add images to bank</button><input id="bankFiles" type="file" accept="image/*" multiple hidden></div>
  <div class="media-manage-grid">${state.media.shared.map(a=>{const canDelete=!a.locked&&(!CLOUD_MODE||a.uploaderUid===state.user?.uid);return `<div class="manage-image"><img src="${escapeAttr(a.dataUrl)}"><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.category||'Image')}${a.size?` · ${friendlyBytes(a.size)}`:''}</small></div>${a.locked?'<span class="tag">Built in</span>':canDelete?`<button class="btn small" data-delete-shared="${a.id}">Delete</button>`:'<span class="tag">Shared</span>'}</div>`}).join('')}</div>
  <div class="modal-actions"><button class="btn" id="doneBank">Done</button></div></div>`;
  $('#closeBank',wrap).onclick=$('#doneBank',wrap).onclick=()=>{wrap.remove();render()};
  $('#bankUpload',wrap).onclick=()=>$('#bankFiles',wrap).click(); $('#bankFiles',wrap).onchange=async e=>{const files=[...e.target.files];for(const f of files){try{await addSharedImage(f)}catch(err){alert(`${f.name}: ${err.message}`)}}paint()};
  $$('[data-delete-shared]',wrap).forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteShared,ref=assetRef('shared',id),uses=imageUsage(ref);if(uses&&!confirm(`This image is used ${uses} time${uses===1?'':'s'} in the current project. Delete it and remove those uses?`))return;try{if(CLOUD_MODE&&state.user)await deleteSharedImage(state.user,id);state.media.shared=state.media.shared.filter(a=>a.id!==id);clearImageRef(ref);if(!CLOUD_MODE)saveMediaStore();saveProject();paint()}catch(err){alert(err.message)}});
  };document.body.appendChild(wrap);paint();
}

function nextId(){const f=state.project.fields[0];if(!f) return state.project.records.length+1;return Math.max(0,...state.project.records.map(r=>Number(r[f.id])||0))+1}
function defaultValueForType(type){return ['number','rating'].includes(type)?0:type==='boolean'?false:'';}
function convertFieldValue(value,oldType,newType){
  if(oldType===newType)return value;
  if((oldType==='shortText'||oldType==='longText')&&(newType==='shortText'||newType==='longText'))return String(value??'');
  if(newType==='number'){const n=Number(value);return Number.isFinite(n)?n:0;}
  if(newType==='rating'){const n=Number(value);return Math.max(0,Math.min(10,Number.isFinite(n)?Math.round(n):0));}
  if(newType==='boolean'){if(value===true||String(value).toLowerCase()==='true'||String(value).toLowerCase()==='yes'||String(value)==='1')return true;if(value===false||String(value).toLowerCase()==='false'||String(value).toLowerCase()==='no'||String(value)==='0')return false;return false;}
  if(newType==='date')return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'';
  if(['image','imageUrl'].includes(newType)||['image','imageUrl'].includes(oldType))return '';
  return String(value??'');
}
function clearIncompatibleFieldConnections(fieldId,newType=null){
  for(const c of state.project.components||[]){
    if(c.type==='list'){
      if(c.listImageField===fieldId && newType && !['image','imageUrl'].includes(newType))c.listImageField='';
      if((c.listTitleField===fieldId||c.listSubtitleField===fieldId) && newType && ['image','imageUrl'].includes(newType)){if(c.listTitleField===fieldId)c.listTitleField='';if(c.listSubtitleField===fieldId)c.listSubtitleField='';}
      if(newType===null){if(c.listImageField===fieldId)c.listImageField='';if(c.listTitleField===fieldId)c.listTitleField='';if(c.listSubtitleField===fieldId)c.listSubtitleField='';}
    }
  }
}
function showEditFieldModal(fieldId){
  const f=state.project.fields.find(x=>x.id===fieldId);if(!f)return;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><h3>Edit field</h3><div class="field"><label>Field name</label><input id="editFieldName" value="${escapeAttr(f.name)}" maxlength="40"></div><div class="field"><label>Data type</label><select id="editFieldType"><option value="shortText" ${f.type==='shortText'?'selected':''}>Short text</option><option value="longText" ${f.type==='longText'?'selected':''}>Long text</option><option value="number" ${f.type==='number'?'selected':''}>Number</option><option value="boolean" ${f.type==='boolean'?'selected':''}>Yes / No</option><option value="image" ${f.type==='image'?'selected':''}>Image upload / bank</option><option value="imageUrl" ${f.type==='imageUrl'?'selected':''}>Image link (URL)</option><option value="rating" ${f.type==='rating'?'selected':''}>Rating (1–10 stars)</option><option value="date" ${f.type==='date'?'selected':''}>Date</option></select></div><div class="notice"><b>Rename:</b> existing connections stay intact. <b>Change type:</b> DataApp Studio converts values where sensible; image-type changes clear old values.</div><div class="modal-actions"><button class="btn" id="cancelEditField">Cancel</button><button class="btn primary" id="saveEditField">Save changes</button></div></div>`;document.body.appendChild(wrap);
  $('#cancelEditField').onclick=()=>wrap.remove();$('#saveEditField').onclick=()=>{const name=$('#editFieldName').value.trim();const newType=$('#editFieldType').value;if(!name)return;const oldType=f.type;if(newType!==oldType){state.project.records.forEach(r=>r[f.id]=convertFieldValue(r[f.id],oldType,newType));f.type=newType;clearIncompatibleFieldConnections(f.id,newType);state.project.blocklyState=null;state.project.blocklyPages={};}f.name=name;wrap.remove();saveProject();render();};
}
function deleteField(fieldId){
  const f=state.project.fields.find(x=>x.id===fieldId);if(!f)return;
  if(!confirm(`Delete the field “${f.name}”? This removes this column and its data from every record. This cannot be undone.`))return;
  state.project.fields=state.project.fields.filter(x=>x.id!==fieldId);state.project.records.forEach(r=>delete r[fieldId]);clearIncompatibleFieldConnections(fieldId,null);
  state.project.program=(state.project.program||[]).filter(b=>!(b.type==='set_field'&&b.field===fieldId));state.project.blocklyState=null;state.project.blocklyPages={};saveProject();render();
}

function showFieldModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><h3>Add a field</h3><div class="field"><label>Field name</label><input id="newFieldName" placeholder="e.g. Rating"></div><div class="field"><label>Data type</label><select id="newFieldType"><option value="shortText">Short text</option><option value="longText">Long text</option><option value="number">Number</option><option value="boolean">Yes / No</option><option value="image">Image upload / bank</option><option value="imageUrl">Image link (URL)</option><option value="rating">Rating (1–10 stars)</option><option value="date">Date</option></select></div><div class="modal-actions"><button class="btn" id="cancelModal">Cancel</button><button class="btn primary" id="createField">Add field</button></div></div>`;document.body.appendChild(wrap);
  $('#cancelModal').onclick=()=>wrap.remove();$('#createField').onclick=()=>{const name=$('#newFieldName').value.trim();if(!name)return;let id=name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||`field_${Date.now()}`;if(state.project.fields.some(f=>f.id===id)) id+=`_${Date.now().toString().slice(-4)}`;const type=$('#newFieldType').value;state.project.fields.push({id,name,type});state.project.records.forEach(r=>r[id]=defaultValueForType(type));wrap.remove();saveProject();render()};
}

function pruneProgram(deletedIds=new Set(),deletedPage=''){
  const kept=[];let skipGroup=false;
  for(const b of state.project.program){
    if(['event_open','event_click','event_list_click'].includes(b.type)){
      skipGroup=(b.type==='event_open'&&deletedPage&&(b.page||state.project.pages[0]?.id)===deletedPage)||(['event_click','event_list_click'].includes(b.type)&&deletedIds.has(b.component));
      if(!skipGroup)kept.push(b);
    }else if(!skipGroup&&!deletedIds.has(b.target)&&!(b.type==='navigate_page'&&deletedPage&&b.page===deletedPage))kept.push(b);
  }
  state.project.program=kept;state.project.blocklyState=null;state.project.blocklyPages={};
}
function applyDesignPropPreview(c){
  if(!c)return;
  const el=document.querySelector(`.screen-component[data-component="${CSS.escape(c.id)}"]`);
  if(!el)return;
  if(Number.isFinite(Number(c.w)))el.style.width=`${Number(c.w)}px`;
  if(Number.isFinite(Number(c.h)))el.style.height=`${Number(c.h)}px`;
  if(c.type==='label'){
    const node=el.querySelector('.label');
    if(node){node.textContent=c.text||'Label';node.style.fontSize=`${c.fontSize||16}px`;node.style.textAlign=c.align||'left';node.style.color=c.textColor||'#172033';node.style.background=c.backgroundColor||'transparent';}
  }
  if(c.type==='button'){
    const node=el.querySelector('button');
    if(node){node.textContent=c.text||'Button';node.style.background=c.backgroundColor||'#5b5ce2';node.style.color=c.textColor||'#ffffff';}
  }
  if(c.type==='input'){
    const node=el.querySelector('input');
    if(node){node.placeholder=c.text||'Type here...';node.style.background=c.backgroundColor||'#ffffff';node.style.color=c.textColor||'#172033';}
  }
}

function bindDesign(){
  $$('[data-page-select]').forEach(b=>b.onclick=()=>{state.currentPageId=b.dataset.pageSelect;state.selectedComponent=null;saveProject();render()});
  const addPage=$('[data-action="add-page"]');if(addPage)addPage.onclick=()=>{
    const n=state.project.pages.length+1;const id=`screen_${Date.now()}`;state.project.pages.push({id,name:`Page ${n}`,backgroundColor:'#ffffff'});state.currentPageId=id;state.selectedComponent=null;saveProject();render();
  };
  const renamePage=$('[data-action="rename-page"]');if(renamePage)renamePage.onclick=()=>{
    const pg=currentPage();const name=prompt('Page name:',pg?.name||'Page');if(name?.trim()){pg.name=name.trim().slice(0,30);saveProject();render()}
  };
  const deletePage=$('[data-action="delete-page"]');if(deletePage)deletePage.onclick=()=>{
    if(state.project.pages.length<=1)return;const pg=currentPage();if(!confirm(`Delete ${pg.name} and all components on it?`))return;
    const ids=new Set(state.project.components.filter(c=>c.pageId===pg.id).map(c=>c.id));
    state.project.components=state.project.components.filter(c=>c.pageId!==pg.id);
    pruneProgram(ids,pg.id);
    for(const c of state.project.components)if(c.type==='list'&&c.navigateToPage===pg.id)c.navigateToPage='';
    state.project.pages=state.project.pages.filter(p=>p.id!==pg.id);delete state.project.blocklyPages?.[pg.id];state.currentPageId=state.project.pages[0].id;state.selectedComponent=null;state.project.blocklyState=null;saveProject();render();
  };
  $$('[data-add-component]').forEach(b=>b.onclick=()=>{
    const type=b.dataset.addComponent;const n=state.project.components.filter(c=>c.type===type).length+1;
    const c={id:`${type}_${Date.now()}`,type,name:`${cap(type)}${n}`,pageId:state.currentPageId,x:30,y:75+(n*18),w:type==='image'?220:type==='list'?280:200,h:type==='image'?150:type==='label'?44:type==='list'?330:type==='input'?150:44,text:type==='button'?'Button':type==='input'?'Long text appears here':type==='label'?'New label':'',fontSize:18,align:'center',textColor:type==='button'?'#ffffff':'#172033',backgroundColor:type==='button'?'#5b5ce2':type==='input'?'#ffffff':'',src:type==='image'?imageSvg('🖼️','Your image'):'',listLayout:'image-title-subtitle',listImageField:'',listTitleField:'',listSubtitleField:'',listBackground:'white',listTransparent:false,navigateToPage:''};
    state.project.components.push(c);state.selectedComponent=c.id;saveProject();render()
  });
  $$('.screen-component[data-component]').forEach(el=>{
    el.onpointerdown=(e)=>{
      if(e.target.closest('.database-list')){const changed=state.selectedComponent!==el.dataset.component;state.selectedComponent=el.dataset.component;if(changed)render();return}
      e.preventDefault();state.selectedComponent=el.dataset.component;const c=state.project.components.find(x=>x.id===state.selectedComponent);const startX=e.clientX,startY=e.clientY,origX=c.x,origY=c.y;const screen=el.closest('.screen');const maxW=screen.clientWidth,maxH=screen.clientHeight;el.setPointerCapture(e.pointerId);
      el.onpointermove=ev=>{c.x=Math.max(0,Math.min(maxW-c.w,origX+ev.clientX-startX));c.y=Math.max(36,Math.min(maxH-c.h,origY+ev.clientY-startY));el.style.left=c.x+'px';el.style.top=c.y+'px'};
      el.onpointerup=()=>{el.onpointermove=null;saveProject();render()};
    };
  });
  $$('[data-move-handle]').forEach(handle=>handle.onpointerdown=e=>{
    e.preventDefault();e.stopPropagation();const el=handle.closest('.screen-component'),c=state.project.components.find(x=>x.id===el?.dataset.component);if(!el||!c)return;
    const startX=e.clientX,startY=e.clientY,origX=c.x,origY=c.y;const screen=el.closest('.screen');const maxW=screen.clientWidth,maxH=screen.clientHeight;handle.setPointerCapture(e.pointerId);
    handle.onpointermove=ev=>{c.x=Math.max(0,Math.min(maxW-c.w,origX+ev.clientX-startX));c.y=Math.max(36,Math.min(maxH-c.h,origY+ev.clientY-startY));el.style.left=c.x+'px';el.style.top=c.y+'px'};
    handle.onpointerup=()=>{handle.onpointermove=null;saveProject()};
  });
  $$('[data-resize-handle]').forEach(handle=>handle.onpointerdown=e=>{
    e.preventDefault();e.stopPropagation();const el=handle.closest('.screen-component'),c=state.project.components.find(x=>x.id===el?.dataset.component);if(!el||!c)return;
    const corner=handle.dataset.resizeHandle,startX=e.clientX,startY=e.clientY,start={x:c.x,y:c.y,w:c.w,h:c.h};const screen=el.closest('.screen');const maxW=screen.clientWidth,maxH=screen.clientHeight;handle.setPointerCapture(e.pointerId);
    handle.onpointermove=ev=>{const dx=ev.clientX-startX,dy=ev.clientY-startY;let x=start.x,y=start.y,w=start.w,h=start.h;const minW=c.type==='list'?140:60,minH=c.type==='list'?100:32;if(corner.includes('e'))w=Math.max(minW,Math.min(maxW-start.x,start.w+dx));if(corner.includes('s'))h=Math.max(minH,Math.min(maxH-start.y,start.h+dy));if(corner.includes('w')){const nx=Math.max(0,Math.min(start.x+start.w-minW,start.x+dx));w=start.w+(start.x-nx);x=nx}if(corner.includes('n')){const ny=Math.max(36,Math.min(start.y+start.h-minH,start.y+dy));h=start.h+(start.y-ny);y=ny}c.x=x;c.y=y;c.w=w;c.h=h;Object.assign(el.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'})};
    handle.onpointerup=()=>{handle.onpointermove=null;saveProject();render()};
  });
  $$('[data-page-prop]').forEach(inp=>inp.oninput=()=>{const pg=currentPage();if(!pg)return;pg[inp.dataset.pageProp]=inp.value;saveProject();const screen=$('.screen[data-page-id="'+CSS.escape(pg.id)+'"]');if(screen)screen.style.background=inp.value;});
  $$('[data-prop]').forEach(inp=>{
    const update=()=>{
      const c=state.project.components.find(x=>x.id===state.selectedComponent);if(!c)return;const prop=inp.dataset.prop;let v=inp.value;
      if(['w','h','fontSize'].includes(prop)){if(v==='')return;v=Number(v);if(!Number.isFinite(v))return;}
      c[prop]=v;saveProject();applyDesignPropPreview(c);
    };
    inp.oninput=update;
    inp.onchange=()=>{update();render()};
  });
  $$('[data-list-prop]').forEach(inp=>inp.onchange=()=>{
    const c=state.project.components.find(x=>x.id===state.selectedComponent);if(!c||c.type!=='list')return;
    c[inp.dataset.listProp]=inp.value;
    if(inp.dataset.listProp==='listBackground')c.listTransparent=inp.value==='transparent';
    if(inp.dataset.listProp==='navigateToPage')connectListNavigation(c);
    saveProject();render();
  });
  $$('[data-list-toggle]').forEach(inp=>inp.onchange=()=>{
    const c=state.project.components.find(x=>x.id===state.selectedComponent);if(!c||c.type!=='list')return;
    c[inp.dataset.listToggle]=Boolean(inp.checked);saveProject();render();
  });
  $$('[data-device]').forEach(btn=>btn.onclick=()=>{state.device=btn.dataset.device;render()});
  $$('[data-program-component]').forEach(btn=>btn.onclick=()=>{
    state.selectedComponent=btn.dataset.programComponent||state.selectedComponent;
    state.blockTutorial=btn.dataset.programKind||'overview';
    state.tab='blocks';render();
  });
  const chooseImage=$('[data-action="choose-component-image"]');if(chooseImage)chooseImage.onclick=()=>{const c=state.project.components.find(x=>x.id===state.selectedComponent);showMediaPicker({title:`Choose image for ${c.name}`,selected:c.src,onSelect:ref=>{c.src=ref;saveProject();render()}})};
  const connect=$('[data-action="connect-data"]');if(connect)connect.onclick=showConnectModal;
  const del=$('[data-action="delete-component"]');if(del)del.onclick=()=>{const id=state.selectedComponent;state.project.components=state.project.components.filter(c=>c.id!==id);pruneProgram(new Set([id]));state.selectedComponent=null;saveProject();render()};
}
function connectListNavigation(c){
  if(!autoBlocksEnabled())return;
  const kept=[];let skipping=false;
  for(const b of state.project.program){
    if(['event_open','event_click','event_list_click'].includes(b.type)){
      skipping=b.type==='event_list_click'&&b.component===c.id;
      if(!skipping)kept.push(b);
    }else if(!skipping)kept.push(b);
  }
  state.project.program=kept;
  if(c.navigateToPage){
    state.project.program.push({id:`b_${Date.now()}_list`,type:'event_list_click',component:c.id});
    state.project.program.push({id:`b_${Date.now()}_nav`,type:'navigate_page',page:c.navigateToPage});
  }
  state.project.blocklyState=null;state.project.blocklyPages=state.project.blocklyPages||{};delete state.project.blocklyPages[c.pageId||state.project.pages[0]?.id];
}

function bindBlocks(readOnly=false){
  $$('[data-block-page]').forEach(b=>b.onclick=()=>{state.currentPageId=b.dataset.blockPage;state.selectedComponent=null;render()});
  $$('[data-block-help]').forEach(b=>b.onclick=()=>{state.blockTutorial=b.dataset.blockHelp||'overview';render()});
  const host=$('#blocklyDiv');
  if(host){
    requestAnimationFrame(async()=>{
      try{
        const pageId=state.currentPageId||state.project.pages[0]?.id;
        state.blocklyWorkspace=await initBlocklyEditor({
          element:host,project:state.project,pageId,components:state.project.components,fields:state.project.fields,pages:state.project.pages,
          readOnly,
          onChange:({blocklyState,program})=>{
            if(readOnly)return;
            state.project.blocklyPages=state.project.blocklyPages||{};state.project.blocklyPages[pageId]=blocklyState;replaceProgramForPage(pageId,program);saveProject();
            const code=$('#generatedCode'); if(code)code.textContent=generateCode();
          }
        });
      }catch(err){host.innerHTML=`<div class="notice warning"><b>Blockly could not start.</b><br>${escapeHtml(err.message)}</div>`;}
    });
  }
  $$('[data-code-mode]').forEach(b=>b.onclick=()=>{state.codeMode=b.dataset.codeMode;$$('[data-code-mode]').forEach(x=>x.classList.toggle('active',x.dataset.codeMode===state.codeMode));const code=$('#generatedCode');if(code)code.textContent=generateCode();});
}


function assignmentCard(a){
  const guided=(a.tutorialMode||'guided')!=='checklist';
  const attempts=(state.cloudProjects||[]).filter(p=>p.assignmentId===a.id).length;
  return `<div class="card assignment-card"><div class="project-meta"><span class="tag">${escapeHtml(a.level||'Guided')}</span><span class="tag">Blank canvas</span><span class="tag">${guided?'🧭 Tutorial':'✓ Checklist'}</span>${attempts?`<span class="tag tag-good">${attempts} app${attempts===1?'':'s'} started</span>`:''}</div><h3>${escapeHtml(a.title)}</h3><p class="muted">Starting this task creates a new app. Your other apps are left exactly as they are.</p><button class="btn" data-start-assignment="${a.id}" ${state.cloudProjects.length>=MAX_PUPIL_APPS?'disabled':''}>${attempts?'Start another attempt':'Start new app'} →</button></div>`;
}
function startAssignment(id){
  const a=state.assignments.find(x=>x.id===id); if(!a)return;
  if((state.cloudProjects||[]).length>=MAX_PUPIL_APPS){alert(`You can keep up to ${MAX_PUPIL_APPS} apps in a class. Delete an old app before starting another.`);return;}
  state.project=freshBlankProject(a.title,a.id);
  state.project.tutorialEnabled=(a.tutorialMode||'guided')!=='checklist';
  state.project.updatedAtMs=Date.now(); addProjectToList(state.project);
  state.selectedComponent=null; state.currentRecord=0; state.currentPageId=state.project.pages[0].id; state.pageHistory=[]; state.role=state.role||'pupil';
  saveProject(); state.view='builder'; state.tab='data'; render();
}
function showNewAppModal(){
  if((state.cloudProjects||[]).length>=MAX_PUPIL_APPS){alert(`You can keep up to ${MAX_PUPIL_APPS} apps in a class. Delete an old app before creating another.`);return;}
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>Create a new app</h3><div class="field"><label>App name</label><input id="newAppName" value="My New App" maxlength="50" autofocus></div><div class="field"><label>Help while I build</label><select id="newAppTutorial"><option value="guided" selected>Guided tutorial</option><option value="checklist">Checklist only</option></select></div><div class="notice">This creates a completely separate blank app. Your existing apps will not be changed.</div><div class="modal-actions"><button class="btn" id="cancelNewApp">Cancel</button><button class="btn primary" id="createNewApp">Create app</button></div></div>`;
  document.body.appendChild(wrap);$('#cancelNewApp').onclick=()=>wrap.remove();
  $('#createNewApp').onclick=()=>{const name=$('#newAppName').value.trim()||'My New App';state.project=freshBlankProject(name,'');state.project.tutorialEnabled=$('#newAppTutorial').value==='guided';state.project.updatedAtMs=Date.now();addProjectToList(state.project);state.currentRecord=0;state.currentPageId=state.project.pages[0].id;state.pageHistory=[];state.selectedComponent=null;wrap.remove();saveProject();state.view='builder';state.tab='data';render();};
}
function findPupilProject(id){ return (state.cloudProjects||[]).find(p=>projectIdOf(p)===id); }
function openPupilProject(id){
  const found=findPupilProject(id);if(!found)return;
  state.project=cleanCloudProject(found);state.currentRecord=0;state.currentPageId=state.project.pages[0]?.id||'screen1';state.pageHistory=[];state.selectedComponent=null;localStorage.setItem('dataapp_project',JSON.stringify(state.project));state.view='builder';state.tab='data';render();
}
async function renamePupilProject(id){
  const found=findPupilProject(id);if(!found)return;const project=cleanCloudProject(found);const name=prompt('Rename this app:',project.name||'My App');if(name===null)return;const trimmed=name.trim();if(!trimmed)return;
  project.name=trimmed;if(!project.publish)project.publish={};project.publish.appName=trimmed;project.updatedAtMs=Date.now();
  const i=state.cloudProjects.findIndex(p=>projectIdOf(p)===id);state.cloudProjects[i]={...clone(project),projectId:id,classId:state.currentClassId,ownerUid:state.user?.uid||''};
  if(projectIdOf(state.project)===id)state.project=clone(project);
  try{if(CLOUD_MODE)await saveProjectToCloud(project,state.user,state.currentClassId);else saveLocalProjects();render();}catch(err){alert(friendlyFirebaseError(err));}
}
async function duplicatePupilProject(id){
  if((state.cloudProjects||[]).length>=MAX_PUPIL_APPS){alert(`You can keep up to ${MAX_PUPIL_APPS} apps in a class. Delete an old app before duplicating one.`);return;}
  const found=findPupilProject(id);if(!found)return;const source=cleanCloudProject(found), copy=clone(source);copy.id=`project-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;copy.name=`Copy of ${source.name||'My App'}`.slice(0,50);copy.assignmentId='';copy.updatedAtMs=Date.now();copy.blocklyState=source.blocklyState?clone(source.blocklyState):null;const pub=source.publish||{};copy.publish={appName:copy.name,icon:pub.icon||'',theme:pub.theme||'#5b5ce2',orientation:pub.orientation||'portrait',isPublished:false,publicId:'',icon192:'',icon512:''};
  addProjectToList(copy);
  try{if(CLOUD_MODE)await saveProjectToCloud(copy,state.user,state.currentClassId);else saveLocalProjects();render();}catch(err){state.cloudProjects=state.cloudProjects.filter(p=>projectIdOf(p)!==copy.id);alert(friendlyFirebaseError(err));}
}
async function deletePupilProject(id){
  const found=findPupilProject(id);if(!found)return;const project=cleanCloudProject(found);if(!confirm(`Delete “${project.name||'this app'}”? This removes the editable app and cannot be undone.`))return;
  try{
    if(CLOUD_MODE){if(project.publish?.publicId&&project.publish?.isPublished){try{await unpublishProject(state.user,project.publish.publicId)}catch{}}await deleteProjectFromCloud(state.user,id);}
    state.cloudProjects=state.cloudProjects.filter(p=>projectIdOf(p)!==id);saveLocalProjects();
    if(projectIdOf(state.project)===id){state.project=freshBlankProject();localStorage.setItem('dataapp_project',JSON.stringify(state.project));}
    render();
  }catch(err){alert(friendlyFirebaseError(err));}
}

function showAssignmentModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>Create an assignment</h3>
  <div class="field"><label>Assignment title</label><input id="assignmentTitle" value="My Database App"></div>
  <div class="notice">Pupils always begin this assignment with a completely blank database, screen and block canvas.</div>
  <div class="field"><label>Pupil support</label><select id="assignmentTutorial"><option value="guided" selected>Guided tutorial — step by step</option><option value="checklist">Checklist only — more independent</option></select></div>
  <div class="field"><label>Support level label</label><select id="assignmentLevel"><option>Starter</option><option selected>Guided</option><option>Independent</option></select></div>
  <div class="field"><label>Minimum records</label><input id="assignmentRecords" type="number" value="3" min="1" max="30"></div>
  <div class="modal-actions"><button class="btn" id="cancelAssignment">Cancel</button><button class="btn primary" id="createAssignment">Create</button></div></div>`;
  document.body.appendChild(wrap);
  $('#cancelAssignment').onclick=()=>wrap.remove();
  $('#createAssignment').onclick=async()=>{
    const title=$('#assignmentTitle').value.trim()||'New assignment';
    const assignment={id:CLOUD_MODE?'':`a-${Date.now()}`,title,template:'blank',tutorialMode:$('#assignmentTutorial').value,level:$('#assignmentLevel').value,requirements:{records:Number($('#assignmentRecords').value)||1,components:4,blocks:4}};
    try{
      if(CLOUD_MODE){if(!state.currentClassId)throw new Error('Choose a class first.');assignment.id=await cloudSaveAssignment(state.currentClassId,assignment)}
      else saveAssignments();
      state.assignments.push(assignment); if(!CLOUD_MODE)saveAssignments(); wrap.remove(); render();
    }catch(err){alert(err.message)}
  };
}
function showConnectModal(){
  const c=state.project.components.find(x=>x.id===state.selectedComponent); if(!c)return;
  if(!autoBlocksEnabled()){state.blockTutorial='data';state.tab='blocks';render();return;}
  const compatible=state.project.fields.filter(f=>c.type==='image'?f.type==='image':f.type!=='image');
  const fields=compatible.length?compatible:state.project.fields;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>🔗 Connect ${escapeHtml(c.name)} to your database</h3><p class="muted">Choose the field this component should show. I’ll create a page-open display block for the page this component is on.</p>
  <div class="field"><label>Database field</label><select id="connectField">${fields.map(f=>`<option value="${f.id}">${escapeHtml(f.name)} · ${escapeHtml(fieldTypeLabel(f.type))}</option>`).join('')}</select></div>
  <div class="notice">This is the guided route. You can inspect or change the blocks afterwards.</div>
  <div class="modal-actions"><button class="btn" id="cancelConnect">Cancel</button><button class="btn primary" id="makeConnection">Create connection</button></div></div>`;
  document.body.appendChild(wrap);
  $('#cancelConnect').onclick=()=>wrap.remove();
  $('#makeConnection').onclick=()=>{connectComponent(c.id,$('#connectField').value);wrap.remove();saveProject();state.tab='blocks';render()};
}
function connectComponent(componentId,fieldId){
  const c=state.project.components.find(x=>x.id===componentId);if(!c)return;
  const pageId=c.pageId||state.project.pages[0]?.id;
  state.project.program=state.project.program.filter(b=>!(b.type==='set_field'&&b.target===componentId));
  let eventIndex=state.project.program.findIndex(b=>b.type==='event_open'&&(b.page||state.project.pages[0]?.id)===pageId);
  if(eventIndex<0){
    state.project.program.push({id:`b_${Date.now()}_open`,type:'event_open',page:pageId});
    eventIndex=state.project.program.length-1;
  }
  state.project.program.splice(eventIndex+1,0,{id:`b_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,type:'set_field',target:componentId,field:fieldId});
  state.project.blocklyState=null;state.project.blocklyPages=state.project.blocklyPages||{};delete state.project.blocklyPages[pageId];
}
function connectionsFor(componentId){
  const fields=[...new Set(state.project.program.filter(b=>b.type==='set_field'&&b.target===componentId).map(b=>nameOfField(b.field)))];
  return fields.length?`Connected to: <b>${fields.map(escapeHtml).join(', ')}</b>`:'Not connected to data yet.';
}
function moveBlock(id,delta){
  const i=state.project.program.findIndex(b=>b.id===id), j=i+delta;
  if(i<0||j<0||j>=state.project.program.length)return;
  [state.project.program[i],state.project.program[j]]=[state.project.program[j],state.project.program[i]];
  saveProject(); render();
}
function checklist(){
  const hasEvent=state.project.program.some(b=>['event_open','event_click','event_list_click'].includes(b.type));
  const connected=state.project.program.some(b=>b.type==='set_field');
  const listReady=state.project.components.some(c=>c.type==='list'&&(c.listTitleField||c.listImageField));
  const multiPage=state.project.pages.length>=2;
  return [
    {label:'Data',ok:state.project.records.length>=3&&state.project.fields.length>=3},
    {label:'Design',ok:state.project.components.length>=3},
    {label:'Pages/List',ok:multiPage&&listReady},
    {label:'Events',ok:hasEvent},
    {label:'Connected',ok:connected}
  ];
}
function checklistBadges(){return checklist().map(x=>`<span class="tag ${x.ok?'tag-good':''}">${x.ok?'✓':'○'} ${x.label}</span>`).join('')}
function projectProgress(){const c=checklist();return Math.round(c.filter(x=>x.ok).length/c.length*100)}

function startTest(withRender=true){
  state.currentRecord=0;state.currentPageId=state.project.pages[0]?.id||'screen1';state.pageHistory=[];state.testLogs=[];state.tutorialTested=true;
  log(`${pageName(state.currentPageId)} opened`,'good');runEvent('open',null,{pageId:state.currentPageId});if(withRender)render()
}
function bindTest(){
  $('[data-action="restart-test"]').onclick=()=>startTest(true);
  $$('.screen-component[data-test-component] button').forEach(btn=>btn.onclick=()=>{
    const id=btn.closest('[data-test-component]').dataset.testComponent;log(`${nameOfComponent(id)} clicked`,'good');runEvent('click',id,{pageId:state.currentPageId});render()
  });
  $$('.screen-component[data-test-component] [data-list-index]').forEach(row=>row.onclick=()=>{
    const host=row.closest('[data-test-component]'),id=host?.dataset.testComponent,index=Number(row.dataset.listIndex);if(!id||Number.isNaN(index))return;
    state.currentRecord=index;log(`${nameOfComponent(id)} row ${index+1} tapped → selected record ${index+1}`,'good');
    runEvent('list_click',id,{pageId:state.currentPageId,index});
    render();
  });
}
function navigateTest(pageId,push=true){
  if(!state.project.pages.some(p=>p.id===pageId)||pageId===state.currentPageId)return;
  if(push&&state.currentPageId)state.pageHistory.push(state.currentPageId);
  state.currentPageId=pageId;state.selectedComponent=null;log(`${pageName(pageId)} opened`,'good');runEvent('open',null,{pageId});
}
function goBackTest(){const prev=state.pageHistory.pop();if(prev)navigateTest(prev,false);}
function runEvent(kind,component=null,meta={}){
  let active=false;
  for(const b of state.project.program){
    if(b.type==='event_open'){active=kind==='open'&&(b.page||state.project.pages[0]?.id)===(meta.pageId||state.currentPageId);continue}
    if(b.type==='event_click'){active=kind==='click'&&b.component===component;continue}
    if(b.type==='event_list_click'){active=kind==='list_click'&&b.component===component;continue}
    if(!active)continue;
    if(b.type==='first_record'){state.currentRecord=0;log('Moved to first record','good')}
    if(b.type==='next_record'){if(state.project.records.length){state.currentRecord=(state.currentRecord+1)%state.project.records.length;log(`Moved to record ${state.currentRecord+1}`,'good')}}
    if(b.type==='prev_record'){if(state.project.records.length){state.currentRecord=(state.currentRecord-1+state.project.records.length)%state.project.records.length;log(`Moved to record ${state.currentRecord+1}`,'good')}}
    if(b.type==='set_field')applyField(b.target,b.field);
    if(b.type==='set_text')applyText(b.target,b.text);
    if(b.type==='navigate_page')navigateTest(b.page,true);
    if(b.type==='go_back')goBackTest();
  }
}
function applyField(targetId,fieldId){
  const c=state.project.components.find(x=>x.id===targetId), f=state.project.fields.find(x=>x.id===fieldId), r=state.project.records[state.currentRecord];
  if(!c||!f||!r){log('A block is missing a component or field.','warn');return}
  const value=r[fieldId]??'';
  if(c.type==='image') c.src=String(value); else if(c.type!=='list') c.text=f.type==='rating'?ratingStars(value):String(value);
  log(`${c.name} ← ${f.name} from selected record`,'good');
}
function applyText(targetId,text){const c=state.project.components.find(x=>x.id===targetId);if(!c){log('A text block is missing its component.','warn');return}if(c.type!=='image'&&c.type!=='list')c.text=String(text||'');log(`${c.name} text updated`,'good')}
function log(text,kind=''){state.testLogs.push({text,kind});if(state.testLogs.length>18)state.testLogs.shift()}

function eventPageId(event){
  if(event.type==='event_open')return event.page||state.project.pages[0]?.id;
  if(['event_click','event_list_click'].includes(event.type))return state.project.components.find(c=>c.id===event.component)?.pageId||state.project.pages[0]?.id;
  return '';
}
function programForPage(pageId){
  const out=[];let include=false;
  for(const b of state.project.program||[]){
    if(['event_open','event_click','event_list_click'].includes(b.type))include=eventPageId(b)===pageId;
    if(include)out.push(b);
  }
  return out;
}
function replaceProgramForPage(pageId,pageProgram){
  const kept=[];let include=false;
  for(const b of state.project.program||[]){
    if(['event_open','event_click','event_list_click'].includes(b.type))include=eventPageId(b)===pageId;
    if(!include)kept.push(b);
  }
  state.project.program=[...kept,...pageProgram];
}
function generateCode(){
  const visibleProgram=programForPage(state.currentPageId);
  if(state.codeMode==='plain'){
    return visibleProgram.map(b=>{
      if(b.type==='event_open')return `WHEN ${pageName(b.page||state.project.pages[0]?.id)} opens:`;
      if(b.type==='event_click')return `WHEN ${nameOfComponent(b.component)} is clicked:`;
      if(b.type==='event_list_click')return `WHEN an item in ${nameOfComponent(b.component)} is tapped:  (that row becomes the selected record)`;
      if(b.type==='first_record')return '    Move to the first database record';
      if(b.type==='next_record')return '    Move to the next database record';
      if(b.type==='prev_record')return '    Move to the previous database record';
      if(b.type==='set_field')return `    Put ${nameOfField(b.field)} into ${nameOfComponent(b.target)}`;
      if(b.type==='set_text')return `    Set ${nameOfComponent(b.target)} text to \"${b.text||''}\"`;
      if(b.type==='navigate_page')return `    Go to ${pageName(b.page)}`;
      if(b.type==='go_back')return '    Go back to the previous page';
      return '';
    }).filter(Boolean).join('\n');
  }
  const out=[];
  visibleProgram.forEach(b=>{
    if(b.type==='event_open')out.push(`def ${safeName(pageName(b.page||state.project.pages[0]?.id))}_opened():`);
    if(b.type==='event_click')out.push(`\ndef ${safeName(nameOfComponent(b.component))}_clicked():`);
    if(b.type==='event_list_click')out.push(`\ndef ${safeName(nameOfComponent(b.component))}_item_tapped(clicked_record):\n    record = clicked_record`);
    if(b.type==='first_record')out.push('    record = database.first_record()');
    if(b.type==='next_record')out.push('    record = database.next_record()');
    if(b.type==='prev_record')out.push('    record = database.previous_record()');
    if(b.type==='set_field')out.push(`    ${safeName(nameOfComponent(b.target))}.value = record["${nameOfField(b.field)}"]`);
    if(b.type==='set_text')out.push(`    ${safeName(nameOfComponent(b.target))}.value = ${JSON.stringify(b.text||'')}`);
    if(b.type==='navigate_page')out.push(`    app.go_to("${pageName(b.page)}")`);
    if(b.type==='go_back')out.push('    app.go_back()');
  });
  return out.join('\n')||'# Add some blocks to see the code idea here.';
}
function nameOfComponent(id){return state.project.components.find(c=>c.id===id)?.name||'component'}
function nameOfField(id){return state.project.fields.find(f=>f.id===id)?.name||'field'}
function safeName(s){return String(s).replace(/\W+/g,'_').replace(/^\d/,'_$&')}
function fieldTypeLabel(t){return ({shortText:'Short text',longText:'Long text',text:'Short text',number:'Number',boolean:'Yes / No',image:'Image upload / bank',imageUrl:'Image link (URL)',rating:'Rating (1–10 stars)',date:'Date'})[t]||t}
function typeIcon(t){return ({shortText:'Aa',longText:'¶',text:'Aa',number:'#',boolean:'✓',image:'▧',imageUrl:'🔗',rating:'★',date:'◷'})[t]||'•'}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function escapeAttr(s){return escapeHtml(s).replace(/'/g,'&#39;')}


async function refreshCloudMedia(){
  if(!CLOUD_MODE||!state.user)return;
  try{
    const [personal,shared]=await Promise.all([listPersonalImages(state.user),listSharedImages()]);
    state.media={personal,shared:[...clone(defaultSharedImages),...shared.map(x=>({...x,locked:false}))]};
  }catch(err){console.error('Image bank load failed',err)}
}

async function finishSignedInUser(user,desiredRole){
  if(!user)return;
  state.user=user; state.authError=''; state.authLoading=false;
  try{
    if(desiredRole==='teacher'){
      let access=await getTeacherAccess(user);
      if(!access.approved){
        try{await claimTeacherInvite(user)}catch(err){if(err?.code!=='permission-denied')console.warn('Teacher invite claim failed',err)}
        access=await getTeacherAccess(user);
      }
      state.teacherApproved=access.approved;state.teacherAdmin=access.admin===true;
      if(!access.approved){state.role='teacher-pending';state.view='landing';render();return}
      state.profile=await ensureUserProfile(user,'teacher');
      state.role='teacher'; state.view='teacher'; state.teacherInspectActive=false; localStorage.setItem('dataapp_last_role','teacher');
      await loadTeacherData(); render(); return;
    }
    const joinAfterSignIn=desiredRole==='pupil-join';
    state.profile=await ensureUserProfile(user,'pupil');
    state.role='pupil'; state.view='pupil'; localStorage.setItem('dataapp_last_role','pupil-return');
    await loadPupilData(); render();
    // A new-pupil click always leads to the class-code step. If an existing pupil
    // accidentally uses it, the same flow simply lets them join another class.
    // A returning account with no memberships is also guided to the code prompt.
    if(joinAfterSignIn || !state.classes.length) setTimeout(()=>showJoinClassModal(),0);
  }catch(err){state.authError=friendlyFirebaseError(err);state.view='landing';render()}
}

async function loadTeacherAdminData(){
  if(!CLOUD_MODE||!state.user){state.teacherAdmin=false;state.teacherInvites=[];state.teacherAccounts=[];return}
  const access=await getTeacherAccess(state.user);
  state.teacherApproved=access.approved===true;state.teacherAdmin=access.admin===true;
  if(state.teacherAdmin){
    [state.teacherInvites,state.teacherAccounts]=await Promise.all([listTeacherInvites(state.user),listTeacherAccounts(state.user)]);
  }else{
    state.teacherInvites=[];state.teacherAccounts=[];
  }
}

async function loadTeacherData(){
  await refreshCloudMedia();
  await loadTeacherAdminData();
  state.classes=await listTeacherClasses(state.user);
  if(!state.classes.some(c=>c.id===state.currentClassId)) state.currentClassId=state.classes[0]?.id||'';
  if(state.currentClassId) await loadSelectedClassData(false); else {state.currentClass=null;state.assignments=[];state.members=[];state.classProjects=[]}
}

async function loadPupilData(){
  await refreshCloudMedia();
  state.classes=await listPupilClasses(state.user);
  if(!state.classes.some(c=>c.id===state.currentClassId)) state.currentClassId=state.classes[0]?.id||'';
  if(state.currentClassId) await loadSelectedClassData(false); else {state.currentClass=null;state.assignments=[];state.cloudProjects=[]}
}

async function loadSelectedClassData(doRender=true){
  if(!state.currentClassId){if(doRender)render();return}
  localStorage.setItem('dataapp_current_class',state.currentClassId);
  if(CLOUD_MODE){
    state.currentClass=await cloudGetClass(state.currentClassId);
    if(state.role==='teacher'){
      [state.assignments,state.members,state.classProjects]=await Promise.all([
        cloudListAssignments(state.currentClassId),listClassMembers(state.currentClassId),listClassProjects(state.currentClassId)
      ]);
    }else{
      [state.assignments,state.cloudProjects,state.pupilMember]=await Promise.all([
        cloudListAssignments(state.currentClassId),listMyProjects(state.user,state.currentClassId),getClassMember(state.currentClassId,state.user.uid)
      ]);
      state.blockSupportMode=state.pupilMember?.blockSupportMode==='auto'?'auto':'manual';
      state.cloudProjects=sortProjects(state.cloudProjects.filter(p=>!isLegacyDemoProject(p)));
      if(state.cloudProjects.length){
        const clean=cleanCloudProject(state.cloudProjects[0]);
        state.project=clean; state.currentPageId=state.project.pages[0]?.id||'screen1'; state.pageHistory=[]; localStorage.setItem('dataapp_project',JSON.stringify(state.project));
      }else{
        state.project=freshBlankProject(); state.currentPageId=state.project.pages[0].id; state.pageHistory=[];
        localStorage.setItem('dataapp_project',JSON.stringify(state.project));
      }
    }
  }else{
    state.currentClass=state.classes.find(c=>c.id===state.currentClassId)||null;
  }
  if(doRender)render();
}

async function selectClass(id){
  state.currentClassId=id; state.currentClass=null;
  try{await loadSelectedClassData(true)}catch(err){alert(friendlyFirebaseError(err))}
}


function teacherInviteMessage(email){
  const site=`${location.origin}${location.pathname}`;
  return `You have been invited to DataApp Studio as a teacher.\n\nOpen ${site}\nChoose "Teacher — Sign in" and use this Google account: ${email}\n\nYour teacher account will activate automatically the first time you sign in.`;
}

function showInviteTeacherModal(){
  if(!state.teacherAdmin){alert('Only the DataApp Studio administrator can invite teachers.');return}
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>👩‍🏫 Invite a teacher</h3><p class="muted">Enter the Google email address they will use for DataApp Studio. Invited teachers are teachers only — they cannot invite other teachers.</p><div class="field"><label>Teacher Google email</label><input id="inviteTeacherEmail" type="email" placeholder="teacher@school.org" autocomplete="off"></div><div class="notice"><b>What happens next?</b><br>The teacher opens this site, chooses <b>Teacher — Sign in</b>, and signs in with the invited Google account. Their teacher access is activated automatically.</div><div class="modal-actions"><button class="btn" id="cancelTeacherInvite">Cancel</button><button class="btn primary" id="sendTeacherInvite">Create invite</button></div></div>`;
  document.body.appendChild(wrap);$('#cancelTeacherInvite').onclick=()=>wrap.remove();$('#inviteTeacherEmail').focus();
  $('#sendTeacherInvite').onclick=async()=>{
    const email=$('#inviteTeacherEmail').value.trim().toLowerCase();if(!email)return;
    const btn=$('#sendTeacherInvite');btn.disabled=true;btn.textContent='Inviting…';
    try{
      await createTeacherInvite(state.user,email);
      await loadTeacherAdminData();
      const msg=teacherInviteMessage(email);
      wrap.innerHTML=`<div class="modal"><h3>✓ Teacher invited</h3><p><b>${escapeHtml(email)}</b> is now approved to create a teacher account when they sign in with Google.</p><div class="notice">This version does not send mail silently from your account. You can copy the invitation message or open your normal email app with it ready to send.</div><div class="modal-actions"><button class="btn" id="copyTeacherInvite">Copy invitation</button><button class="btn" id="emailTeacherInvite">Email invitation</button><button class="btn primary" id="doneTeacherInvite">Done</button></div></div>`;
      $('#doneTeacherInvite').onclick=()=>{wrap.remove();render()};
      $('#copyTeacherInvite').onclick=async()=>{try{await navigator.clipboard.writeText(msg);$('#copyTeacherInvite').textContent='Copied ✓'}catch{alert(msg)}};
      $('#emailTeacherInvite').onclick=()=>{const subject=encodeURIComponent('Your DataApp Studio teacher invitation');const body=encodeURIComponent(msg);window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`};
    }catch(err){alert(friendlyFirebaseError(err));btn.disabled=false;btn.textContent='Create invite'}
  };
}

function showCreateClassModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>🏫 Create a class</h3><p class="muted">A six-character pupil join code will be created automatically.</p><div class="field"><label>Class name</label><input id="newClassName" placeholder="e.g. S2 Computing 2.4" maxlength="60"></div><div class="modal-actions"><button class="btn" id="cancelClass">Cancel</button><button class="btn primary" id="makeClass">Create class</button></div></div>`;
  document.body.appendChild(wrap); $('#cancelClass').onclick=()=>wrap.remove(); $('#newClassName').focus();
  $('#makeClass').onclick=async()=>{
    const name=$('#newClassName').value.trim(); if(!name)return;
    const btn=$('#makeClass');btn.disabled=true;btn.textContent='Creating…';
    try{
      let cls;
      if(CLOUD_MODE) cls=await cloudCreateClass(name,state.user);
      else cls={classId:`local-${Date.now()}`,name,code:'DEMO42'};
      const item={id:cls.classId,name:cls.name||name,className:cls.name||name,joinCode:cls.code,teacherUid:state.user?.uid||'local'};
      state.classes.push(item);state.currentClassId=item.id;state.currentClass=item;state.assignments=[];state.members=[];state.classProjects=[];
      localStorage.setItem('dataapp_current_class',item.id);wrap.remove();render();
    }catch(err){alert(friendlyFirebaseError(err));btn.disabled=false;btn.textContent='Create class'}
  };
}

function showJoinClassModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>🏫 Join a class</h3><p class="muted">Enter the six-character code your teacher gave you.</p><div class="field"><label>Class code</label><input id="joinClassCode" class="code-input" placeholder="ABC123" maxlength="8" autocomplete="off"></div><div class="modal-actions"><button class="btn" id="cancelJoin">Cancel</button><button class="btn primary" id="joinNow">Join class</button></div></div>`;
  document.body.appendChild(wrap);$('#cancelJoin').onclick=()=>wrap.remove();$('#joinClassCode').focus();
  $('#joinClassCode').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  $('#joinNow').onclick=async()=>{
    const code=$('#joinClassCode').value.trim();if(!code)return;const btn=$('#joinNow');btn.disabled=true;btn.textContent='Joining…';
    try{
      if(CLOUD_MODE){await joinClassByCode(code,state.user);await loadPupilData()}
      else {const item={id:`local-${code}`,name:'Demo joined class',className:'Demo joined class',joinCode:code};state.classes.push(item);state.currentClassId=item.id;state.currentClass=item}
      wrap.remove();render();
    }catch(err){alert(friendlyFirebaseError(err));btn.disabled=false;btn.textContent='Join class'}
  };
}

function friendlyFirebaseError(err){
  const code=err?.code||'';
  if(code.includes('popup-closed'))return 'The Google sign-in window was closed before sign-in finished.';
  if(code.includes('popup-blocked'))return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
  if(code.includes('permission-denied'))return 'Firebase blocked that action. Check that the current Firestore and Storage rules have been published.';
  if(code.includes('unauthorized-domain'))return 'This web address is not yet listed as an authorised Firebase Authentication domain.';
  return err?.message||'Something went wrong with Firebase.';
}

async function bootstrap(){
  render();
  if(!CLOUD_MODE)return;
  try{
    await onAuthChange(async user=>{
      state.authLoading=false;state.user=user;
      if(!user){state.view='landing';state.role=null;state.profile=null;state.classes=[];state.currentClass=null;state.teacherAdmin=false;state.teacherInvites=[];state.teacherAccounts=[];render();return}
      const desired=sessionStorage.getItem('dataapp_auth_intent')||localStorage.getItem('dataapp_last_role')||'pupil-return';
      sessionStorage.removeItem('dataapp_auth_intent');
      await finishSignedInUser(user,desired);
    });
  }catch(err){state.authLoading=false;state.authError=friendlyFirebaseError(err);render()}
}

bootstrap();
