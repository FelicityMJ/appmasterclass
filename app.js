import {
  isFirebaseEnabled, onAuthChange, signInWithGoogle, signOutUser,
  isApprovedTeacher, ensureUserProfile, getUserProfile,
  createClass as cloudCreateClass, listTeacherClasses, joinClassByCode,
  listPupilClasses, getClass as cloudGetClass, listClassMembers,
  removeClassMember, regenerateJoinCode, saveAssignment as cloudSaveAssignment,
  listAssignments as cloudListAssignments, saveProjectToCloud,
  listMyProjects, listClassProjects, listPersonalImages,
  uploadPersonalImage, deletePersonalImage, listSharedImages,
  uploadSharedImage, deleteSharedImage, uploadAppIcon
} from './firebase-service.js';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const clone = (obj) => JSON.parse(JSON.stringify(obj));

const imageSvg = (emoji, label, bg='#eef2ff') => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="43%" text-anchor="middle" font-size="110">${emoji}</text><text x="50%" y="72%" text-anchor="middle" font-family="Arial" font-size="34" fill="#283046">${label}</text></svg>`)}`;


const PERSONAL_IMAGE_LIMIT = 20;
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
function imageUsage(ref){
  let count=0;
  state.project.records.forEach(r=>state.project.fields.filter(f=>f.type==='image').forEach(f=>{if(r[f.id]===ref)count++}));
  state.project.components.forEach(c=>{if(c.type==='image'&&c.src===ref)count++});
  return count;
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

const starterProject = {
  id:'project-tourist',
  name:'Scottish Places App',
  publish:{appName:'Scottish Places',icon:'',theme:'#5b5ce2',orientation:'portrait'},
  tableName:'Places',
  fields:[
    {id:'id',name:'ID',type:'number'},
    {id:'place',name:'Place',type:'text'},
    {id:'location',name:'Location',type:'text'},
    {id:'description',name:'Description',type:'text'},
    {id:'picture',name:'Picture',type:'image'}
  ],
  records:[
    {id:1,place:'Edinburgh Castle',location:'Edinburgh',description:'A historic fortress above the city.',picture:imageSvg('🏰','Edinburgh Castle','#efe9ff')},
    {id:2,place:'Loch Ness',location:'Highlands',description:'A famous Scottish loch with a legendary monster.',picture:imageSvg('🌊','Loch Ness','#e1f5ff')},
    {id:3,place:'Falkirk Wheel',location:'Falkirk',description:'A rotating boat lift connecting two canals.',picture:imageSvg('⚙️','Falkirk Wheel','#e8fff3')}
  ],
  components:[
    {id:'titleLabel',type:'label',name:'TitleLabel',x:22,y:55,w:275,h:50,text:'Scottish Places',fontSize:26,align:'center'},
    {id:'placeImage',type:'image',name:'PlaceImage',x:25,y:125,w:270,h:185,src:imageSvg('🏰','Edinburgh Castle','#efe9ff')},
    {id:'placeLabel',type:'label',name:'PlaceLabel',x:25,y:325,w:270,h:42,text:'Edinburgh Castle',fontSize:22,align:'center'},
    {id:'descLabel',type:'label',name:'DescriptionLabel',x:30,y:375,w:260,h:72,text:'A historic fortress above the city.',fontSize:14,align:'center'},
    {id:'nextButton',type:'button',name:'NextButton',x:170,y:500,w:120,h:46,text:'Next →'},
    {id:'prevButton',type:'button',name:'PreviousButton',x:35,y:500,w:120,h:46,text:'← Previous'}
  ],
  program:[
    {id:'b1',type:'event_open'},
    {id:'b2',type:'set_field',target:'placeImage',field:'picture'},
    {id:'b3',type:'set_field',target:'placeLabel',field:'place'},
    {id:'b4',type:'set_field',target:'descLabel',field:'description'},
    {id:'b5',type:'event_click',component:'nextButton'},
    {id:'b6',type:'next_record'},
    {id:'b7',type:'set_field',target:'placeImage',field:'picture'},
    {id:'b8',type:'set_field',target:'placeLabel',field:'place'},
    {id:'b9',type:'set_field',target:'descLabel',field:'description'},
    {id:'b10',type:'event_click',component:'prevButton'},
    {id:'b11',type:'prev_record'},
    {id:'b12',type:'set_field',target:'placeImage',field:'picture'},
    {id:'b13',type:'set_field',target:'placeLabel',field:'place'},
    {id:'b14',type:'set_field',target:'descLabel',field:'description'}
  ]
};

const projectTemplates = {
  tourist: starterProject,
  animals: {
    ...clone(starterProject),
    id:'project-animals',
    name:'Animal Facts App',
    tableName:'Animals',
    fields:[
      {id:'id',name:'ID',type:'number'},
      {id:'animal',name:'Animal',type:'text'},
      {id:'habitat',name:'Habitat',type:'text'},
      {id:'diet',name:'Diet',type:'text'},
      {id:'picture',name:'Picture',type:'image'}
    ],
    records:[
      {id:1,animal:'Red panda',habitat:'Mountain forests',diet:'Bamboo and fruit',picture:imageSvg('🐼','Red panda','#fff0ea')},
      {id:2,animal:'Dolphin',habitat:'Ocean',diet:'Fish and squid',picture:imageSvg('🐬','Dolphin','#e4f5ff')},
      {id:3,animal:'Owl',habitat:'Woodlands',diet:'Small animals',picture:imageSvg('🦉','Owl','#fff7da')}
    ],
    components:[],
    program:[]
  },
  music: {
    ...clone(starterProject),
    id:'project-music',
    name:'Music Guide App',
    tableName:'Songs',
    fields:[
      {id:'id',name:'ID',type:'number'},
      {id:'song',name:'Song',type:'text'},
      {id:'artist',name:'Artist',type:'text'},
      {id:'genre',name:'Genre',type:'text'},
      {id:'cover',name:'Cover',type:'image'}
    ],
    records:[
      {id:1,song:'Midnight Drive',artist:'Nova',genre:'Pop',cover:imageSvg('🎵','Midnight Drive','#f0e9ff')},
      {id:2,song:'Green Room',artist:'The Oaks',genre:'Indie',cover:imageSvg('🎸','Green Room','#eaf8ea')},
      {id:3,song:'Skyline',artist:'Pulse',genre:'Electronic',cover:imageSvg('🎧','Skyline','#e6f1ff')}
    ],
    components:[],
    program:[]
  },
  blank: {
    id:'project-blank',
    name:'My New App',
    publish:{appName:'My New App',icon:'',theme:'#5b5ce2',orientation:'portrait'},
    tableName:'MyData',
    fields:[
      {id:'id',name:'ID',type:'number'},
      {id:'name',name:'Name',type:'text'},
      {id:'info',name:'Information',type:'text'}
    ],
    records:[
      {id:1,name:'First item',info:'Add your information here.'}
    ],
    components:[],
    program:[]
  }
};

const defaultAssignments = [
  {id:'a-tourist',title:'Scottish Places App',template:'tourist',level:'Guided',requirements:{records:3,components:5,blocks:8}},
  {id:'a-animals',title:'Animal Facts App',template:'animals',level:'Starter',requirements:{records:4,components:4,blocks:4}}
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
  codeMode:'python',
  device:'phone',
  assignments:CLOUD_MODE?[]:loadAssignments(),
  media:loadMediaStore(),
  testLogs:[],
  authLoading:CLOUD_MODE,
  user:null,
  profile:null,
  teacherApproved:false,
  classes:[],
  currentClassId:localStorage.getItem('dataapp_current_class')||'',
  currentClass:null,
  members:[],
  classProjects:[],
  cloudProjects:[],
  cloudStatus:CLOUD_MODE?'Waiting for sign-in':'Local preview mode',
  authError:''
};

function loadProject(){
  try { return JSON.parse(localStorage.getItem('dataapp_project')) || clone(starterProject); }
  catch { return clone(starterProject); }
}
function saveProject(){
  localStorage.setItem('dataapp_project',JSON.stringify(state.project));
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
  else if(state.view==='builder') root.innerHTML=builderView();
  bindCommon();
  if(state.view==='builder') bindBuilder();
}

function landingView(){
  if(state.authLoading) return `<div class="landing"><div class="hero-card auth-card"><div class="brand"><div class="brandmark">▦</div> DataApp Studio</div><h2>Connecting to your classroom…</h2><p class="muted">Checking Firebase sign-in.</p></div></div>`;
  if(CLOUD_MODE && state.user && state.role==='teacher-pending') return `<div class="landing"><div class="hero-card auth-card">
    <div class="brand" style="margin-bottom:18px"><div class="brandmark">▦</div> DataApp Studio <span class="pill">V1.3</span></div>
    <h2>Teacher approval needed</h2><p>You are signed in as <b>${escapeHtml(state.user.email||state.user.displayName||'Google user')}</b>, but this account is not yet on the teacher allow-list.</p>
    <div class="notice"><b>Your Firebase UID</b><div class="uid-box">${escapeHtml(state.user.uid)}</div></div>
    <p class="muted">In Firestore create <b>teacherAllowlist → ${escapeHtml(state.user.uid)}</b> with the field <b>enabled = true</b>, then click Check again.</p>
    <div class="modal-actions"><button class="btn" data-action="home">Sign out</button><button class="btn primary" data-action="check-teacher">Check again</button></div>
  </div></div>`;
  return `
<div class="landing">
  <div class="hero">
    <div>
      <div class="brand" style="margin-bottom:28px"><div class="brandmark">▦</div> DataApp Studio <span class="pill">V1.3 classroom</span></div>
      <h1>Build apps.<br>Learn data.<br>See the code.</h1>
      <p>A pupil-friendly app studio: create a database, design a phone screen, connect it with visual blocks, then run it instantly.</p>
      <div class="project-meta" style="margin-top:22px"><span class="tag">Google sign-in</span><span class="tag">Teacher classes</span><span class="tag">20-image pupil limit</span><span class="tag">Shared image bank</span></div>
    </div>
    <div class="hero-card">
      <h2 style="margin-top:0">${CLOUD_MODE?'Sign in to your classroom':'Firebase is not linked yet'}</h2>
      <p class="muted" style="font-size:14px">${CLOUD_MODE?'Use your Google account. Pupils are created automatically; teacher accounts must be approved in Firestore.':'You can still preview the interface locally. Follow SETUP-FIREBASE.md to turn on real accounts and classrooms.'}</p>
      ${state.authError?`<div class="notice warning">${escapeHtml(state.authError)}</div>`:''}
      <div class="role-grid">
        <button class="role-card" ${CLOUD_MODE?'data-auth-role="pupil"':'data-role="pupil"'}><div class="role-icon">🧑‍🎓</div><div><strong>${CLOUD_MODE?'Pupil — Continue with Google':"Pupil preview"}</strong><span>${CLOUD_MODE?'Join a class and build your apps.':'Test the pupil builder locally.'}</span></div></button>
        <button class="role-card" ${CLOUD_MODE?'data-auth-role="teacher"':'data-role="teacher"'}><div class="role-icon">🧑‍🏫</div><div><strong>${CLOUD_MODE?'Teacher — Continue with Google':"Teacher preview"}</strong><span>${CLOUD_MODE?'Create classes, assignments and shared images.':'Test the teacher screens locally.'}</span></div></button>
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
  return `<div class="shell">${topbar(CLOUD_MODE?'Pupil':'Pupil preview')}<main class="page">
    <div class="welcome"><div><h1>Hi ${escapeHtml(name)} 👋</h1><p>${cls?`You are working in <b>${escapeHtml(cls.name||cls.className||'your class')}</b>.`:'Choose an assignment or continue your project.'}</p></div><div><button class="btn" data-action="join-class">+ Join another class</button> <button class="btn primary" data-action="open-builder">Open current project</button></div></div>
    ${classSwitcher()}
    <div class="cards" style="margin-bottom:16px">
      <div class="card project-card"><div><div class="tag" style="display:inline-block;margin-bottom:8px">CURRENT PROJECT</div><h3>${escapeHtml(state.project.name)}</h3><p class="muted">${escapeHtml(state.project.tableName)} database · ${state.project.records.length} records · ${state.project.components.length} components</p></div><div class="progress"><span style="width:${projectProgress()}%"></span></div><div class="project-meta">${checklistBadges()}</div><button class="btn primary" data-action="open-builder">Continue building →</button></div>
      <div class="card"><h3>Cloud classroom</h3><p class="muted">${CLOUD_MODE?'Your work saves to Firebase while you build. Your personal images follow your Google account between devices.':'Local preview mode.'}</p><div class="notice">🖼 <b>${personalImageCount()}/20</b> personal images used. Shared teacher images do not count.</div></div>
    </div>
    <div class="section-head"><div><h2 style="font-size:20px">Assignments from your teacher</h2><p>${state.assignments.length?'Choose one to start a fresh project.':'Your teacher has not added an assignment to this class yet.'}</p></div></div>
    <div class="cards">${state.assignments.length?state.assignments.map(a=>assignmentCard(a)).join(''):'<div class="card"><div class="empty-note">No assignments yet.</div></div>'}</div>
  </main></div>`;
}

function teacherView(){
  if(!state.classes.length) return `<div class="shell">${topbar(CLOUD_MODE?'Teacher':'Teacher preview')}<main class="page">
    <div class="welcome"><div><h1>Your classrooms</h1><p>Create your first class. A join code will be generated automatically.</p></div><div><button class="btn" data-action="manage-bank">🖼 Manage Image Bank</button> <button class="btn primary" data-action="create-class">+ Create class</button></div></div>
    <div class="card empty-class-card"><div class="big-emoji">🏫</div><h2>No classes yet</h2><p class="muted">Create a class, give pupils the six-character code, and they can join with Google sign-in.</p><button class="btn primary" data-action="create-class">Create my first class</button></div>
  </main></div>`;
  const cls=state.currentClass||state.classes.find(c=>c.id===state.currentClassId)||state.classes[0];
  const projectByUid=new Map(); state.classProjects.forEach(p=>{const old=projectByUid.get(p.ownerUid);if(!old)projectByUid.set(p.ownerUid,p)});
  return `<div class="shell">${topbar(CLOUD_MODE?'Teacher':'Teacher preview')}<main class="page">
    <div class="welcome"><div><h1>Your classrooms</h1><p>${escapeHtml(cls?.name||'Class')} · ${state.members.length} pupil${state.members.length===1?'':'s'}</p></div><div><button class="btn" data-action="manage-bank">🖼 Manage Image Bank</button> <button class="btn" data-action="create-class">+ Create class</button> <button class="btn primary" data-action="new-assignment">+ New assignment</button></div></div>
    ${classSwitcher()}
    <div class="cards" style="margin-bottom:16px">
      <div class="card"><div class="muted">Class code</div><h2 class="join-code">${escapeHtml(cls?.joinCode||'—')}</h2><button class="btn small" data-action="regenerate-code">Regenerate code</button></div>
      <div class="card"><div class="muted">Assignments</div><h2 style="margin:5px 0">${state.assignments.length}</h2><div class="muted">Saved to this class</div></div>
      <div class="card"><div class="muted">Shared Image Bank</div><h2 style="margin:5px 0">${state.media.shared.filter(x=>!x.locked).length}</h2><button class="btn small" data-action="manage-bank">Add images</button></div>
    </div>
    <div class="section-head"><div><h2 style="font-size:19px">Assignments</h2><p>These appear automatically on pupils' dashboards.</p></div></div>
    <div class="cards" style="margin-bottom:16px">${state.assignments.length?state.assignments.map(a=>`<div class="card"><div class="tag">${escapeHtml(a.level||'Guided')}</div><h3>${escapeHtml(a.title)}</h3><p class="muted">${a.requirements?.records||1}+ records · ${a.requirements?.components||4}+ components · ${a.requirements?.blocks||4}+ blocks</p><button class="btn small" data-start-assignment="${escapeAttr(a.id)}">Preview starter</button></div>`).join(''):'<div class="card"><div class="empty-note">No assignments yet. Click + New assignment.</div></div>'}</div>
    <div class="card"><div class="section-head"><div><h2 style="font-size:19px">Pupils & projects</h2><p>Real members and saved projects from Firestore.</p></div></div>
      <table class="class-table"><thead><tr><th>Pupil</th><th>Email</th><th>Latest project</th><th>Data</th><th>Design</th><th>Blocks</th><th></th></tr></thead><tbody>
      ${state.members.length?state.members.map(m=>{const p=projectByUid.get(m.uid||m.id);return `<tr><td>${escapeHtml(m.displayName||'Pupil')}</td><td>${escapeHtml(m.email||'')}</td><td>${escapeHtml(p?.name||'Not started')}</td><td>${p?p.records?.length||0:'—'}</td><td>${p?p.components?.length||0:'—'}</td><td>${p?p.program?.length||0:'—'}</td><td><button class="btn small" data-remove-member="${escapeAttr(m.uid||m.id)}">Remove</button></td></tr>`}).join(''):'<tr><td colspan="7"><div class="empty-note">No pupils have joined yet. Give them class code <b>'+escapeHtml(cls?.joinCode||'')+'</b>.</div></td></tr>'}
      </tbody></table>
    </div>
  </main></div>`;
}

function builderView(){return `<div class="builder">
<div class="builder-head"><button class="btn small" data-action="back-pupil">← Dashboard</button><div class="project-title">${escapeHtml(state.project.name)}</div><span class="mini-progress">${projectProgress()}% ready</span><span class="save-state">Saved locally</span><button class="btn small" data-action="reset">Reset project</button></div>
<div class="step-tabs">${['data','design','blocks','test','publish'].map((t,i)=>`<button class="step-tab ${state.tab===t?'active':''}" data-tab="${t}">${['1. 🗃 DATA','2. 🎨 DESIGN','3. 🧩 BLOCKS','4. ▶ TEST','5. 🚀 PUBLISH'][i]}</button>`).join('')}</div>
<div class="builder-body">${state.tab==='data'?dataView():state.tab==='design'?designView():state.tab==='blocks'?blocksView():state.tab==='test'?testView():publishView()}</div>
</div>`}
function dataView(){return `<div class="section-head"><div><h2>Build your database</h2><p>Each row is a <b>record</b>. Each column is a <b>field</b>.</p></div><div><button class="btn" data-action="manage-images">🖼 My Images ${personalImageCount()}/${PERSONAL_IMAGE_LIMIT}</button> <button class="btn" data-action="add-field">+ Add field</button> <button class="btn primary" data-action="add-record">+ Add record</button></div></div>
<div class="notice">Personal uploads are automatically resized and compressed. You can upload up to <b>${PERSONAL_IMAGE_LIMIT}</b>; shared Image Bank pictures do not use your allowance.</div><div class="notice">Your table is called <b>${escapeHtml(state.project.tableName)}</b>. The first field acts as the unique ID for each record.</div>
<div class="data-wrap"><table class="data-table"><thead><tr><th class="row-num">#</th>${state.project.fields.map(f=>`<th>${escapeHtml(f.name)}<span class="data-type">${typeIcon(f.type)} ${f.type}</span></th>`).join('')}<th></th></tr></thead><tbody>${state.project.records.map((r,ri)=>`<tr><td class="row-num">${ri+1}</td>${state.project.fields.map(f=>`<td>${dataCell(f,r,ri)}</td>`).join('')}<td><button class="icon-btn" data-delete-record="${ri}" title="Delete record">✕</button></td></tr>`).join('')}</tbody></table></div>`}
function dataCell(f,r,ri){
  const value=r[f.id]??'';
  if(f.type==='image') return `<div class="image-cell"><img src="${escapeAttr(resolveImage(value))}" alt=""><button class="btn small" data-image-record="${ri}" data-image-field="${f.id}">Change</button></div>`;
  if(f.type==='boolean') return `<select data-record="${ri}" data-field="${f.id}"><option value="" ${value===''?'selected':''}>Choose…</option><option value="true" ${String(value)==='true'?'selected':''}>Yes</option><option value="false" ${String(value)==='false'?'selected':''}>No</option></select>`;
  const type=f.type==='number'?'number':f.type==='date'?'date':'text';
  return `<input data-record="${ri}" data-field="${f.id}" value="${escapeAttr(value)}" type="${type}">`;
}

function designView(){return `<div class="section-head"><div><h2>Design your app</h2><p>Add components, drag them around the device, then connect them to data.</p></div><button class="btn good" data-tab="test">▶ Test app</button></div>
<div class="design-grid">
<aside class="toolbox"><h3>Components</h3>${[['label','🔤','Text / Label'],['image','🖼️','Image'],['button','🔘','Button'],['input','⌨️','Text box'],['list','☷','List']].map(c=>`<button class="component-btn" data-add-component="${c[0]}"><span>${c[1]}</span><span>${c[2]}</span></button>`).join('')}<div class="empty-note" style="margin-top:14px"><b>Easy route:</b><br>Add a component → click it → choose <b>Connect Data</b>.</div></aside>
<section class="workspace-panel"><div class="device-wrap"><div class="device-switch">${[['phone','Phone'],['large','Large phone'],['tablet','Tablet']].map(d=>`<button data-device="${d[0]}" class="${state.device===d[0]?'active':''}">${d[1]}</button>`).join('')}</div>${phoneMarkup('design')}</div></section>
<aside class="properties">${propertiesMarkup()}</aside>
</div>`}
function propertiesMarkup(){
  const c=state.project.components.find(x=>x.id===state.selectedComponent);
  if(!c) return `<h3>Properties</h3><div class="empty-note">Click a component on the phone to change its properties.</div>`;
  return `<h3>${escapeHtml(c.name)}</h3>
  <div class="prop-group"><label>Name</label><input data-prop="name" value="${escapeAttr(c.name)}"></div>
  ${c.type!=='image'&&c.type!=='list'?`<div class="prop-group"><label>Text</label><input data-prop="text" value="${escapeAttr(c.text||'')}"></div>`:''}
  ${c.type==='image'?`<div class="prop-group"><label>Image</label><div class="property-image-preview"><img src="${escapeAttr(resolveImage(c.src))}" alt=""></div><button class="btn" style="width:100%" data-action="choose-component-image">🖼 Choose image</button></div>`:''}
  ${c.type==='label'?`<div class="prop-group"><label>Font size</label><input data-prop="fontSize" type="number" min="10" max="48" value="${c.fontSize||16}"></div><div class="prop-group"><label>Alignment</label><select data-prop="align"><option ${c.align==='left'?'selected':''}>left</option><option ${c.align==='center'?'selected':''}>center</option><option ${c.align==='right'?'selected':''}>right</option></select></div>`:''}
  <div class="prop-group"><label>Width</label><input data-prop="w" type="number" value="${c.w}"></div><div class="prop-group"><label>Height</label><input data-prop="h" type="number" value="${c.h}"></div>
  ${['label','image','input'].includes(c.type)?`<button class="btn connect" style="width:100%;margin-bottom:8px" data-action="connect-data">🔗 Connect Data</button><div class="connection-note">${connectionsFor(c.id)}</div>`:''}
  <button class="btn small" style="width:100%;color:var(--danger)" data-action="delete-component">Delete component</button>`
}

function phoneMarkup(mode='design'){
  return `<div class="phone device-${state.device}"><div class="screen" data-phone-mode="${mode}">${state.project.components.map(c=>componentMarkup(c,mode)).join('')}</div></div>`;
}
function componentMarkup(c,mode){
  const sel=mode==='design'&&state.selectedComponent===c.id?'selected':'';
  const style=`left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;`;
  const attrs=mode==='design'?`data-component="${c.id}"`:`data-test-component="${c.id}"`;
  let inner='';
  if(c.type==='label') inner=`<div class="label" style="font-size:${c.fontSize||16}px;text-align:${c.align||'left'}">${escapeHtml(c.text||'Label')}</div>`;
  if(c.type==='button') inner=`<button>${escapeHtml(c.text||'Button')}</button>`;
  if(c.type==='image') inner=`<img src="${escapeAttr(resolveImage(c.src))}" alt="">`;
  if(c.type==='input') inner=`<input placeholder="${escapeAttr(c.text||'Type here...')}">`;
  if(c.type==='list') inner=`<div class="listbox"><div>Item 1</div><div>Item 2</div><div>Item 3</div></div>`;
  return `<div class="screen-component ${sel}" ${attrs} style="${style}">${inner}</div>`;
}

function blocksView(){return `<div class="section-head"><div><h2>Make it work with blocks</h2><p>Events start a stack. Action blocks underneath run in order.</p></div><button class="btn good" data-tab="test">▶ Run app</button></div>
<div class="blocks-grid"><aside class="block-palette"><h3>Block toolbox</h3>
<div class="palette-group"><strong>Events</strong><button class="palette-block event" data-add-block="event_open">when Screen opens</button><button class="palette-block event" data-add-block="event_click">when button clicked</button></div>
<div class="palette-group"><strong>Database</strong><button class="palette-block data" data-add-block="next_record">next record</button><button class="palette-block data" data-add-block="prev_record">previous record</button></div>
<div class="palette-group"><strong>Screen</strong><button class="palette-block screenb" data-add-block="set_field">set component from field</button></div>
<div class="empty-note">V1 keeps the toolbox deliberately small. Search, filters, if/else and variables come next.</div><div class="mini-checks">${checklistBadges()}</div></aside>
<section class="block-canvas"><div style="font-size:12px;color:#8b93a2;margin-bottom:8px">PROGRAM</div>${programMarkup()}</section>
<aside class="code-panel"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Show code</h3><span class="tag">Read-only</span></div><div class="code-toggle"><button data-code-mode="python" class="${state.codeMode==='python'?'active':''}">Python idea</button><button data-code-mode="plain" class="${state.codeMode==='plain'?'active':''}">Plain English</button></div><div class="codebox">${escapeHtml(generateCode())}</div></aside></div>`}

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
  if(b.type==='set_field') return `<div class="program-block screenb" data-block-id="${b.id}">set <select data-block-prop="target">${optionsComponents(b.target)}</select> to <select data-block-prop="field">${optionsFields(b.field)}</select> from current record <span class="block-move"><button class="move-block" data-dir="-1">↑</button><button class="move-block" data-dir="1">↓</button></span><button class="remove-block">✕</button></div>`;
  return '';
}

function testView(){return `<div class="section-head"><div><h2>Test your app</h2><p>Use the buttons on the phone. The debugger explains what is happening.</p></div><div><button class="btn" data-action="restart-test">↻ Restart</button> <button class="btn primary" data-tab="blocks">Edit blocks</button></div></div>
<div class="test-grid"><section class="test-stage"><div>${phoneMarkup('test')}</div></section><aside class="test-side"><div class="record-card"><h3>Current database record</h3>${recordInspector()}</div><div class="debug"><h3>🐞 What's happening?</h3><div id="debugLog">${state.testLogs.length?state.testLogs.map(l=>`<div class="log-line ${l.kind||''}">${escapeHtml(l.text)}</div>`).join(''):`<div class="log-line">Press Restart or use the app buttons to see events here.</div>`}</div></div></aside></div>`}
function recordInspector(){const r=state.project.records[state.currentRecord]||{}; return `<div class="record-grid">${state.project.fields.map(f=>`<dt>${escapeHtml(f.name)}</dt><dd>${f.type==='image'?'[image]':escapeHtml(String(r[f.id]??''))}</dd>`).join('')}</div>`}


function publishView(){
  const pub=state.project.publish||(state.project.publish={appName:state.project.name,icon:'',theme:'#5b5ce2',orientation:'portrait'});
  const iconSrc=pub.iconData||resolveImage(pub.icon)||imageSvg('📱','App icon',pub.theme);
  return `<div class="section-head"><div><h2>Publish your app</h2><p>Choose how your finished app will look when it is installed.</p></div></div>
  <div class="publish-grid"><section class="card"><div class="publish-icon"><img src="${escapeAttr(iconSrc)}" alt="App icon"></div><div class="prop-group"><label>App name</label><input id="publishName" value="${escapeAttr(pub.appName||state.project.name)}" maxlength="30"></div>
  <div class="prop-group"><label>Orientation</label><select id="publishOrientation"><option value="portrait" ${pub.orientation==='portrait'?'selected':''}>Portrait</option><option value="landscape" ${pub.orientation==='landscape'?'selected':''}>Landscape</option><option value="any" ${pub.orientation==='any'?'selected':''}>Allow both</option></select></div>
  <button class="btn" data-action="choose-app-icon">🎨 Choose app icon</button> <button class="btn" data-action="upload-app-icon">⬆ Upload separate icon</button><input id="appIconFile" type="file" accept="image/*" hidden>
  <div class="notice" style="margin-top:14px">Your app icon is <b>separate</b> and does not use one of your 20 personal image slots.</div></section>
  <section class="card"><h3>Android publishing</h3><p class="muted">The project now stores the app name, icon and orientation needed for a project-specific installable web app.</p><div class="publish-phone"><div class="home-icon"><img src="${escapeAttr(iconSrc)}"><span>${escapeHtml(pub.appName||state.project.name)}</span></div></div>
  <div class="notice warning">In this local prototype, Publish prepares the app identity and preview. The final hosted version will generate the project-specific manifest/share URL and QR code so Android can install it directly.</div></section></div>`;
}
function bindPublish(){
  const pub=state.project.publish||(state.project.publish={appName:state.project.name,icon:'',theme:'#5b5ce2',orientation:'portrait'});
  $('#publishName').oninput=e=>{pub.appName=e.target.value;saveProject()}; $('#publishOrientation').onchange=e=>{pub.orientation=e.target.value;saveProject();render()};
  $('[data-action="choose-app-icon"]').onclick=()=>showMediaPicker({title:'Choose an app icon',selected:pub.icon,iconMode:true,onSelect:choice=>{pub.icon=choice.ref;pub.iconData=choice.dataUrl;saveProject();render()}});
  $('[data-action="upload-app-icon"]').onclick=()=>$('#appIconFile').click(); $('#appIconFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const c=await compressImage(f,90*1024,512);pub.icon='';pub.iconData=(CLOUD_MODE&&state.user&&state.role==='pupil')?await uploadAppIcon(state.user,state.project.id,c):c.dataUrl;saveProject();render()}catch(err){alert(err.message)}};
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
  $$('[data-auth-role]').forEach(b=>b.onclick=async()=>{
    const role=b.dataset.authRole; state.authError='';
    sessionStorage.setItem('dataapp_auth_intent',role); localStorage.setItem('dataapp_last_role',role);
    b.disabled=true; b.querySelector('strong').textContent='Opening Google sign-in…';
    try{await signInWithGoogle()}catch(err){state.authError=friendlyFirebaseError(err);render()}
  });
  $$('[data-action="home"]').forEach(b=>b.onclick=async()=>{
    if(CLOUD_MODE){try{await signOutUser()}catch(err){console.error(err)}}
    state.view='landing';state.role=null;state.user=null;state.classes=[];state.currentClass=null;render();
  });
  $$('[data-action="check-teacher"]').forEach(b=>b.onclick=async()=>{await finishSignedInUser(state.user,'teacher')});
  $$('[data-action="open-builder"]').forEach(b=>b.onclick=()=>{state.view='builder';state.tab='data';render()});
  $$('[data-action="back-pupil"]').forEach(b=>b.onclick=()=>{state.view=state.role==='teacher'?'teacher':'pupil';render()});
  $$('[data-start-assignment]').forEach(b=>b.onclick=()=>startAssignment(b.dataset.startAssignment));
  $$('[data-select-class]').forEach(b=>b.onclick=()=>selectClass(b.dataset.selectClass));
  $$('[data-action="create-class"]').forEach(b=>b.onclick=showCreateClassModal);
  $$('[data-action="join-class"]').forEach(b=>b.onclick=showJoinClassModal);
  const newAssignment=$('[data-action="new-assignment"]'); if(newAssignment)newAssignment.onclick=showAssignmentModal;
  const manageBank=$('[data-action="manage-bank"]'); if(manageBank)manageBank.onclick=showBankManager;
  const regen=$('[data-action="regenerate-code"]'); if(regen)regen.onclick=async()=>{if(!state.currentClassId)return;if(!confirm('Generate a new class code? The old code will stop working.'))return;try{const code=CLOUD_MODE?await regenerateJoinCode(state.currentClassId):'DEMO'+Math.floor(10+Math.random()*89);state.currentClass.joinCode=code;const c=state.classes.find(x=>x.id===state.currentClassId);if(c)c.joinCode=code;render()}catch(err){alert(err.message)}};
  $$('[data-remove-member]').forEach(b=>b.onclick=async()=>{const uid=b.dataset.removeMember;if(!confirm('Remove this pupil from the class? Their saved project will not be deleted.'))return;try{if(CLOUD_MODE)await removeClassMember(state.currentClassId,uid);state.members=state.members.filter(m=>(m.uid||m.id)!==uid);render()}catch(err){alert(err.message)}});
}
function bindBuilder(){
  $$('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;if(state.tab==='test') startTest(false);render()});
  if(state.tab==='data') bindData();
  if(state.tab==='design') bindDesign();
  if(state.tab==='blocks') bindBlocks();
  if(state.tab==='test') bindTest();
  if(state.tab==='publish') bindPublish();
  const manageImages=$('[data-action="manage-images"]'); if(manageImages)manageImages.onclick=showPersonalManager;
  const reset=$('[data-action="reset"]'); if(reset) reset.onclick=()=>{if(confirm('Reset the demo project to its original state?')){state.project=clone(starterProject);state.currentRecord=0;saveProject();render()}};
}

function bindData(){
  $$('.data-table [data-record][data-field]').forEach(inp=>{const update=()=>{const r=state.project.records[+inp.dataset.record];const f=state.project.fields.find(x=>x.id===inp.dataset.field);let v=inp.value;if(f.type==='number')v=Number(v);if(f.type==='boolean'&&v!=='')v=v==='true';r[f.id]=v;saveProject()};inp.oninput=update;inp.onchange=update});
  $$('[data-image-record]').forEach(b=>b.onclick=()=>showImageModal(+b.dataset.imageRecord,b.dataset.imageField));
  $$('[data-delete-record]').forEach(b=>b.onclick=()=>{state.project.records.splice(+b.dataset.deleteRecord,1);saveProject();render()});
  $('[data-action="add-record"]').onclick=()=>{const row={};state.project.fields.forEach(f=>row[f.id]=f.type==='number'?0:f.type==='boolean'?false:'');if(state.project.fields[0]) row[state.project.fields[0].id]=nextId();state.project.records.push(row);saveProject();render()};
  $('[data-action="add-field"]').onclick=()=>showFieldModal();
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
  let tab=selected?.startsWith('asset:personal:')?'personal':'shared', query='';
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  const paint=()=>{
    const source=state.media[tab].filter(a=>!query||`${a.name} ${a.category||''} ${a.tags||''}`.toLowerCase().includes(query.toLowerCase()));
    wrap.innerHTML=`<div class="modal media-modal"><div class="media-modal-head"><div><h3>${escapeHtml(title)}</h3><p class="muted">${iconMode?'App icons do not use a personal image slot.':'Personal images: '+personalImageCount()+' / '+PERSONAL_IMAGE_LIMIT+' used.'}</p></div><button class="icon-btn" id="closeMedia">✕</button></div>
      <div class="media-tabs"><button class="${tab==='shared'?'active':''}" data-media-tab="shared">🏫 Image Bank</button><button class="${tab==='personal'?'active':''}" data-media-tab="personal">👤 My Images (${personalImageCount()}/${PERSONAL_IMAGE_LIMIT})</button></div>
      <div class="media-toolbar"><input id="mediaSearch" placeholder="Search images…" value="${escapeAttr(query)}"><button class="btn ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'disabled':''}" id="uploadPersonal" ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'disabled':''}>+ Upload my image</button><input type="file" id="personalFile" accept="image/*" hidden></div>
      ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'<div class="notice warning">You have reached 20 personal images. Delete an unused image or choose from the shared Image Bank.</div>':''}
      <div class="media-grid">${source.length?source.map(a=>mediaCard(a,tab,selected)).join(''):'<div class="empty-note">No matching images.</div>'}</div>
      <div class="modal-actions"><button class="btn" id="cancelMedia">Cancel</button></div></div>`;
    $('#closeMedia',wrap).onclick=$('#cancelMedia',wrap).onclick=()=>wrap.remove();
    $$('[data-media-tab]',wrap).forEach(b=>b.onclick=()=>{tab=b.dataset.mediaTab;paint()});
    const search=$('#mediaSearch',wrap); search.oninput=()=>{query=search.value;const pos=search.selectionStart;paint();const next=$('#mediaSearch',wrap);next.focus();next.setSelectionRange(pos,pos)};
    $$('[data-media-ref]',wrap).forEach(b=>b.onclick=()=>{const ref=b.dataset.mediaRef;if(iconMode){const asset=findAsset(ref);onSelect?.({ref,dataUrl:asset?.dataUrl||''});}else onSelect?.(ref);wrap.remove()});
    const upload=$('#uploadPersonal',wrap), file=$('#personalFile',wrap);
    if(upload)upload.onclick=()=>file.click();
    if(file)file.onchange=async()=>{if(!file.files?.[0])return;upload.disabled=true;upload.textContent='Optimising…';try{const ref=await addPersonalImage(file.files[0]);if(iconMode){const asset=findAsset(ref);onSelect?.({ref,dataUrl:asset?.dataUrl||''});wrap.remove();}else{selected=ref;tab='personal';paint()}}catch(err){alert(err.message);paint()}};
  };
  document.body.appendChild(wrap);paint();
}
function showPersonalManager(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  const paint=()=>{wrap.innerHTML=`<div class="modal media-modal"><div class="media-modal-head"><div><h3>👤 My Images</h3><p class="muted">${personalImageCount()} / ${PERSONAL_IMAGE_LIMIT} used · uploads are compressed to around 80 KB or less.</p></div><button class="icon-btn" id="closePersonal">✕</button></div>
  <div class="media-toolbar"><button class="btn primary" id="managerUpload" ${personalImageCount()>=PERSONAL_IMAGE_LIMIT?'disabled':''}>+ Upload image</button><input id="managerFile" type="file" accept="image/*" hidden></div>
  <div class="media-manage-grid">${state.media.personal.length?state.media.personal.map(a=>{const ref=assetRef('personal',a.id),uses=imageUsage(ref);return `<div class="manage-image"><img src="${escapeAttr(a.dataUrl)}"><div><strong>${escapeHtml(a.name)}</strong><small>${friendlyBytes(a.size)} · ${uses} use${uses===1?'':'s'} in this project</small></div><button class="btn small" data-delete-personal="${a.id}">Delete</button></div>`}).join(''):'<div class="empty-note">You have not uploaded any personal images yet.</div>'}</div>
  <div class="modal-actions"><button class="btn" id="donePersonal">Done</button></div></div>`;
  $('#closePersonal',wrap).onclick=$('#donePersonal',wrap).onclick=()=>{wrap.remove();render()};
  const up=$('#managerUpload',wrap), fi=$('#managerFile',wrap); if(up)up.onclick=()=>fi.click(); if(fi)fi.onchange=async()=>{if(!fi.files?.[0])return;up.disabled=true;up.textContent='Optimising…';try{await addPersonalImage(fi.files[0]);paint()}catch(err){alert(err.message);paint()}};
  $$('[data-delete-personal]',wrap).forEach(b=>b.onclick=async()=>{const id=b.dataset.deletePersonal,ref=assetRef('personal',id),uses=imageUsage(ref);if(uses&&!confirm(`This image is used ${uses} time${uses===1?'':'s'} in the current project. Delete it and remove those uses?`))return;try{if(CLOUD_MODE&&state.user)await deletePersonalImage(state.user,id);state.media.personal=state.media.personal.filter(a=>a.id!==id);clearImageRef(ref);if(!CLOUD_MODE)saveMediaStore();saveProject();paint()}catch(err){alert(err.message)}});
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
function showFieldModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><h3>Add a field</h3><div class="field"><label>Field name</label><input id="newFieldName" placeholder="e.g. Rating"></div><div class="field"><label>Data type</label><select id="newFieldType"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / No</option><option value="image">Image</option><option value="date">Date</option></select></div><div class="modal-actions"><button class="btn" id="cancelModal">Cancel</button><button class="btn primary" id="createField">Add field</button></div></div>`;document.body.appendChild(wrap);
  $('#cancelModal').onclick=()=>wrap.remove();$('#createField').onclick=()=>{const name=$('#newFieldName').value.trim();if(!name)return;let id=name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||`field_${Date.now()}`;if(state.project.fields.some(f=>f.id===id)) id+=`_${Date.now().toString().slice(-4)}`;const type=$('#newFieldType').value;state.project.fields.push({id,name,type});state.project.records.forEach(r=>r[id]=type==='number'?0:'');wrap.remove();saveProject();render()};
}

function bindDesign(){
  $$('[data-add-component]').forEach(b=>b.onclick=()=>{const type=b.dataset.addComponent;const n=state.project.components.filter(c=>c.type===type).length+1;const c={id:`${type}_${Date.now()}`,type,name:`${cap(type)}${n}`,x:50,y:80+(n*30),w:type==='image'?220:200,h:type==='image'?150:type==='label'?44:type==='list'?110:44,text:type==='button'?'Button':type==='input'?'Type here...':type==='label'?'New label':'',fontSize:18,align:'center',src:type==='image'?imageSvg('🖼️','Your image'):''};state.project.components.push(c);state.selectedComponent=c.id;saveProject();render()});
  $$('.screen-component[data-component]').forEach(el=>{
    el.onpointerdown=(e)=>{e.preventDefault();state.selectedComponent=el.dataset.component;const c=state.project.components.find(x=>x.id===state.selectedComponent);const startX=e.clientX,startY=e.clientY,origX=c.x,origY=c.y;const screen=el.closest('.screen');const maxW=screen.clientWidth,maxH=screen.clientHeight;el.setPointerCapture(e.pointerId);el.onpointermove=ev=>{c.x=Math.max(0,Math.min(maxW-c.w,origX+ev.clientX-startX));c.y=Math.max(36,Math.min(maxH-c.h,origY+ev.clientY-startY));el.style.left=c.x+'px';el.style.top=c.y+'px'};el.onpointerup=()=>{el.onpointermove=null;saveProject();render()};};
  });
  $$('[data-prop]').forEach(inp=>inp.oninput=()=>{const c=state.project.components.find(x=>x.id===state.selectedComponent);let v=inp.value;if(['w','h','fontSize'].includes(inp.dataset.prop))v=Number(v);c[inp.dataset.prop]=v;saveProject();render()});
  $$('[data-device]').forEach(btn=>btn.onclick=()=>{state.device=btn.dataset.device;render()});
  const chooseImage=$('[data-action="choose-component-image"]');if(chooseImage)chooseImage.onclick=()=>{const c=state.project.components.find(x=>x.id===state.selectedComponent);showMediaPicker({title:`Choose image for ${c.name}`,selected:c.src,onSelect:ref=>{c.src=ref;saveProject();render()}})};
  const connect=$('[data-action="connect-data"]');if(connect)connect.onclick=showConnectModal;
  const del=$('[data-action="delete-component"]');if(del)del.onclick=()=>{const id=state.selectedComponent;state.project.components=state.project.components.filter(c=>c.id!==id);state.project.program=state.project.program.filter(b=>b.target!==id&&b.component!==id);state.selectedComponent=null;saveProject();render()};
}

function bindBlocks(){
  $$('[data-add-block]').forEach(b=>b.onclick=()=>{const type=b.dataset.addBlock;const block={id:`b_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,type};if(type==='event_click')block.component=state.project.components.find(c=>c.type==='button')?.id||'';if(type==='set_field'){block.target=state.project.components[0]?.id||'';block.field=state.project.fields[1]?.id||state.project.fields[0]?.id||''}state.project.program.push(block);saveProject();render()});
  $$('.program-block select').forEach(sel=>sel.onchange=()=>{const block=state.project.program.find(b=>b.id===sel.closest('.program-block').dataset.blockId);block[sel.dataset.blockProp]=sel.value;saveProject();render()});
  $$('.remove-block').forEach(btn=>btn.onclick=()=>{const id=btn.closest('.program-block').dataset.blockId;state.project.program=state.project.program.filter(b=>b.id!==id);saveProject();render()});
  $$('.move-block').forEach(btn=>btn.onclick=(e)=>{e.stopPropagation();const id=btn.closest('.program-block').dataset.blockId;moveBlock(id,Number(btn.dataset.dir))});
  $$('[data-code-mode]').forEach(b=>b.onclick=()=>{state.codeMode=b.dataset.codeMode;render()});
}


function assignmentCard(a){
  return `<div class="card assignment-card"><div class="project-meta"><span class="tag">${escapeHtml(a.level)}</span><span class="tag">${a.requirements.records}+ records</span></div><h3>${escapeHtml(a.title)}</h3><p class="muted">A ready-made database structure to help you start quickly.</p><button class="btn" data-start-assignment="${a.id}">Start fresh →</button></div>`;
}
function startAssignment(id){
  const a=state.assignments.find(x=>x.id===id); if(!a)return;
  const template=projectTemplates[a.template]||projectTemplates.blank;
  state.project=clone(template);
  state.project.id=`${template.id}-${Date.now()}`;
  state.project.name=a.title;
  state.project.assignmentId=a.id;
  state.selectedComponent=null; state.currentRecord=0; state.role=state.role||'pupil';
  saveProject(); state.view='builder'; state.tab='data'; render();
}
function showAssignmentModal(){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>Create an assignment</h3>
  <div class="field"><label>Assignment title</label><input id="assignmentTitle" value="My Database App"></div>
  <div class="field"><label>Starter</label><select id="assignmentTemplate"><option value="blank">Blank app</option><option value="animals">Animal facts</option><option value="music">Music guide</option><option value="tourist">Scottish places</option></select></div>
  <div class="field"><label>Support level</label><select id="assignmentLevel"><option>Starter</option><option selected>Guided</option><option>Independent</option></select></div>
  <div class="field"><label>Minimum records</label><input id="assignmentRecords" type="number" value="4" min="1" max="30"></div>
  <div class="modal-actions"><button class="btn" id="cancelAssignment">Cancel</button><button class="btn primary" id="createAssignment">Create</button></div></div>`;
  document.body.appendChild(wrap);
  $('#cancelAssignment').onclick=()=>wrap.remove();
  $('#createAssignment').onclick=async()=>{
    const title=$('#assignmentTitle').value.trim()||'New assignment';
    const assignment={id:CLOUD_MODE?'':`a-${Date.now()}`,title,template:$('#assignmentTemplate').value,level:$('#assignmentLevel').value,requirements:{records:Number($('#assignmentRecords').value)||1,components:4,blocks:4}};
    try{
      if(CLOUD_MODE){if(!state.currentClassId)throw new Error('Choose a class first.');assignment.id=await cloudSaveAssignment(state.currentClassId,assignment)}
      else saveAssignments();
      state.assignments.push(assignment); if(!CLOUD_MODE)saveAssignments(); wrap.remove(); render();
    }catch(err){alert(err.message)}
  };
}
function showConnectModal(){
  const c=state.project.components.find(x=>x.id===state.selectedComponent); if(!c)return;
  const compatible=state.project.fields.filter(f=>c.type==='image'?f.type==='image':f.type!=='image');
  const fields=compatible.length?compatible:state.project.fields;
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><h3>🔗 Connect ${escapeHtml(c.name)} to your database</h3><p class="muted">Choose the field this component should show. I’ll create the display blocks for screen open and record navigation.</p>
  <div class="field"><label>Database field</label><select id="connectField">${fields.map(f=>`<option value="${f.id}">${escapeHtml(f.name)} · ${escapeHtml(f.type)}</option>`).join('')}</select></div>
  <div class="notice">This is the guided route. You can inspect or change the blocks afterwards.</div>
  <div class="modal-actions"><button class="btn" id="cancelConnect">Cancel</button><button class="btn primary" id="makeConnection">Create connection</button></div></div>`;
  document.body.appendChild(wrap);
  $('#cancelConnect').onclick=()=>wrap.remove();
  $('#makeConnection').onclick=()=>{connectComponent(c.id,$('#connectField').value);wrap.remove();saveProject();state.tab='blocks';render()};
}
function connectComponent(componentId,fieldId){
  state.project.program=state.project.program.filter(b=>!(b.type==='set_field'&&b.target===componentId));
  if(!state.project.program.some(b=>b.type==='event_open')) state.project.program.unshift({id:`b_${Date.now()}_open`,type:'event_open'});
  const output=[]; let insertedOpen=false;
  for(const b of state.project.program){
    output.push(b);
    if(b.type==='event_open'&&!insertedOpen){output.push({id:`b_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,type:'set_field',target:componentId,field:fieldId});insertedOpen=true}
    if(b.type==='next_record'||b.type==='prev_record') output.push({id:`b_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,type:'set_field',target:componentId,field:fieldId});
  }
  state.project.program=output;
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
  const hasOpen=state.project.program.some(b=>b.type==='event_open');
  const hasClick=state.project.program.some(b=>b.type==='event_click');
  const connected=state.project.program.some(b=>b.type==='set_field');
  return [
    {label:'Data',ok:state.project.records.length>=3&&state.project.fields.length>=3},
    {label:'Design',ok:state.project.components.length>=3},
    {label:'Events',ok:hasOpen||hasClick},
    {label:'Connected',ok:connected}
  ];
}
function checklistBadges(){return checklist().map(x=>`<span class="tag ${x.ok?'tag-good':''}">${x.ok?'✓':'○'} ${x.label}</span>`).join('')}
function projectProgress(){const c=checklist();return Math.round(c.filter(x=>x.ok).length/c.length*100)}

function startTest(withRender=true){state.currentRecord=0;state.testLogs=[];log('Screen1 opened','good');runEvent('open');if(withRender)render()}
function bindTest(){
  $('[data-action="restart-test"]').onclick=()=>startTest(true);
  $$('.screen-component[data-test-component] button').forEach(btn=>btn.onclick=()=>{const id=btn.closest('[data-test-component]').dataset.testComponent;log(`${nameOfComponent(id)} clicked`,'good');runEvent('click',id);render()});
}
function runEvent(kind,component=null){
  let active=false;
  for(const b of state.project.program){
    if(b.type==='event_open'){active=kind==='open';continue}
    if(b.type==='event_click'){active=kind==='click'&&b.component===component;continue}
    if(!active)continue;
    if(b.type==='next_record'){if(state.project.records.length){state.currentRecord=(state.currentRecord+1)%state.project.records.length;log(`Moved to record ${state.currentRecord+1}`,'good')}}
    if(b.type==='prev_record'){if(state.project.records.length){state.currentRecord=(state.currentRecord-1+state.project.records.length)%state.project.records.length;log(`Moved to record ${state.currentRecord+1}`,'good')}}
    if(b.type==='set_field') applyField(b.target,b.field);
  }
}
function applyField(targetId,fieldId){
  const c=state.project.components.find(x=>x.id===targetId), f=state.project.fields.find(x=>x.id===fieldId), r=state.project.records[state.currentRecord];
  if(!c||!f||!r){log('A block is missing a component or field.','warn');return}
  const value=r[fieldId]??'';
  if(c.type==='image') c.src=String(value); else if(c.type==='list'){} else c.text=String(value);
  log(`${c.name} ← ${f.name} from current record`,'good');
}
function log(text,kind=''){state.testLogs.push({text,kind});if(state.testLogs.length>18)state.testLogs.shift()}

function generateCode(){
  if(state.codeMode==='plain'){
    return state.project.program.map(b=>{
      if(b.type==='event_open')return 'WHEN the screen opens:';
      if(b.type==='event_click')return `WHEN ${nameOfComponent(b.component)} is clicked:`;
      if(b.type==='next_record')return '    Move to the next database record';
      if(b.type==='prev_record')return '    Move to the previous database record';
      if(b.type==='set_field')return `    Put ${nameOfField(b.field)} into ${nameOfComponent(b.target)}`;
      return '';
    }).join('\n');
  }
  let out=[];
  state.project.program.forEach(b=>{
    if(b.type==='event_open') out.push('def screen_opened():');
    if(b.type==='event_click') out.push(`\ndef ${safeName(nameOfComponent(b.component))}_clicked():`);
    if(b.type==='next_record') out.push('    record = database.next_record()');
    if(b.type==='prev_record') out.push('    record = database.previous_record()');
    if(b.type==='set_field') out.push(`    ${safeName(nameOfComponent(b.target))}.value = record["${nameOfField(b.field)}"]`);
  });
  return out.join('\n')||'# Add some blocks to see the code idea here.';
}
function nameOfComponent(id){return state.project.components.find(c=>c.id===id)?.name||'component'}
function nameOfField(id){return state.project.fields.find(f=>f.id===id)?.name||'field'}
function safeName(s){return String(s).replace(/\W+/g,'_').replace(/^\d/,'_$&')}
function typeIcon(t){return ({text:'Aa',number:'#',boolean:'✓',image:'▧',date:'◷'})[t]||'•'}
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
      const approved=await isApprovedTeacher(user); state.teacherApproved=approved;
      if(!approved){state.role='teacher-pending';state.view='landing';render();return}
      state.profile=await ensureUserProfile(user,'teacher');
      state.role='teacher'; state.view='teacher'; localStorage.setItem('dataapp_last_role','teacher');
      await loadTeacherData(); render(); return;
    }
    state.profile=await ensureUserProfile(user,'pupil');
    state.role='pupil'; state.view='pupil'; localStorage.setItem('dataapp_last_role','pupil');
    await loadPupilData(); render();
  }catch(err){state.authError=friendlyFirebaseError(err);state.view='landing';render()}
}

async function loadTeacherData(){
  await refreshCloudMedia();
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
      [state.assignments,state.cloudProjects]=await Promise.all([
        cloudListAssignments(state.currentClassId),listMyProjects(state.user,state.currentClassId)
      ]);
      if(state.cloudProjects.length){
        const p=state.cloudProjects[0];
        const clean=clone(p); delete clean.cloudId; delete clean.ownerUid; delete clean.ownerName; delete clean.classId; delete clean.updatedAt; delete clean.projectId;
        state.project=clean; localStorage.setItem('dataapp_project',JSON.stringify(state.project));
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
  if(code.includes('permission-denied'))return 'Firebase blocked that action. Check that the V1.3 Firestore and Storage rules have been published.';
  if(code.includes('unauthorized-domain'))return 'This web address is not yet listed as an authorised Firebase Authentication domain.';
  return err?.message||'Something went wrong with Firebase.';
}

async function bootstrap(){
  render();
  if(!CLOUD_MODE)return;
  try{
    await onAuthChange(async user=>{
      state.authLoading=false;state.user=user;
      if(!user){state.view='landing';state.role=null;state.profile=null;state.classes=[];state.currentClass=null;render();return}
      const desired=sessionStorage.getItem('dataapp_auth_intent')||localStorage.getItem('dataapp_last_role')||'pupil';
      sessionStorage.removeItem('dataapp_auth_intent');
      await finishSignedInUser(user,desired);
    });
  }catch(err){state.authLoading=false;state.authError=friendlyFirebaseError(err);render()}
}

bootstrap();
