import { firebaseEnabled, firebaseConfig } from './firebase-config.js';

let services = null;
const IMAGE_SLOTS = Array.from({length:20},(_,i)=>String(i+1).padStart(2,'0'));

export function isFirebaseEnabled(){ return !!firebaseEnabled; }

export async function initFirebaseServices(){
  if(!firebaseEnabled) return null;
  if(services) return services;

  const appSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js');
  const authSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js');
  const dbSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
  const storageSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js');

  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = dbSdk.getFirestore(app);
  const storage = storageSdk.getStorage(app);
  services = { app, auth, db, storage, authSdk, dbSdk, storageSdk };
  return services;
}

export async function onAuthChange(callback){
  const s=await initFirebaseServices();
  if(!s){ callback(null); return ()=>{}; }
  return s.authSdk.onAuthStateChanged(s.auth, callback);
}

export async function signInWithGoogle(){
  const s = await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled yet. Add your Web App config first.');
  const provider = new s.authSdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  return s.authSdk.signInWithPopup(s.auth, provider);
}

export async function signOutUser(){
  const s = await initFirebaseServices();
  if(!s) return;
  return s.authSdk.signOut(s.auth);
}

export async function isApprovedTeacher(user){
  const s=await initFirebaseServices();
  if(!s||!user) return false;
  const snap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'teacherAllowlist',user.uid));
  return snap.exists() && snap.data().enabled !== false;
}

export async function ensureUserProfile(user, role='pupil'){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  if(role==='teacher' && !(await isApprovedTeacher(user))) throw new Error('This Google account has not been approved as a teacher yet.');
  const ref=s.dbSdk.doc(s.db,'users',user.uid);
  const snap=await s.dbSdk.getDoc(ref);
  if(!snap.exists()){
    await s.dbSdk.setDoc(ref,{
      displayName:user.displayName||'',
      email:user.email||'',
      photoURL:user.photoURL||'',
      role,
      createdAt:s.dbSdk.serverTimestamp(),
      lastSeenAt:s.dbSdk.serverTimestamp()
    });
  }else{
    const existing=snap.data();
    const safeRole=existing.role==='teacher'?'teacher':role;
    await s.dbSdk.setDoc(ref,{
      displayName:user.displayName||existing.displayName||'',
      email:user.email||existing.email||'',
      photoURL:user.photoURL||existing.photoURL||'',
      role:safeRole,
      lastSeenAt:s.dbSdk.serverTimestamp()
    },{merge:true});
  }
  return (await s.dbSdk.getDoc(ref)).data();
}

export async function getUserProfile(user){
  const s=await initFirebaseServices();
  if(!s||!user) return null;
  const snap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'users',user.uid));
  return snap.exists()?snap.data():null;
}

export async function createClass(name, user){
  const s = await initFirebaseServices();
  if(!s || !user) throw new Error('Sign in first.');
  if(!(await isApprovedTeacher(user))) throw new Error('Only approved teacher accounts can create classes.');
  const clean=String(name||'').trim();
  if(!clean) throw new Error('Enter a class name.');

  const classRef=s.dbSdk.doc(s.dbSdk.collection(s.db,'classes'));
  const code=await makeUniqueJoinCode(s);
  await s.dbSdk.setDoc(classRef,{
    name:clean,
    teacherUid:user.uid,
    teacherName:user.displayName||'',
    joinCode:code,
    createdAt:s.dbSdk.serverTimestamp(),
    updatedAt:s.dbSdk.serverTimestamp(),
    updatedAtMs:Date.now()
  });
  await s.dbSdk.setDoc(s.dbSdk.doc(s.db,'joinCodes',code),{
    classId:classRef.id,
    className:clean,
    teacherUid:user.uid,
    createdAt:s.dbSdk.serverTimestamp()
  });
  return { classId:classRef.id, code, name:clean, teacherUid:user.uid };
}

export async function listTeacherClasses(user){
  const s=await initFirebaseServices();
  if(!s||!user) return [];
  const q=s.dbSdk.query(s.dbSdk.collection(s.db,'classes'),s.dbSdk.where('teacherUid','==',user.uid));
  const snap=await s.dbSdk.getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}

export async function joinClassByCode(code, user){
  const s = await initFirebaseServices();
  if(!s || !user) throw new Error('Sign in first.');
  const normalized=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!normalized) throw new Error('Enter the class code.');
  const codeSnap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'joinCodes',normalized));
  if(!codeSnap.exists()) throw new Error('That class code was not found. Check it and try again.');
  const data=codeSnap.data(), classId=data.classId;
  const cls={name:data.className||'Class',teacherUid:data.teacherUid||''};

  const batch=s.dbSdk.writeBatch(s.db);
  batch.set(s.dbSdk.doc(s.db,'classes',classId,'members',user.uid),{
    uid:user.uid,
    displayName:user.displayName||'',
    email:user.email||'',
    photoURL:user.photoURL||'',
    joinCode:normalized,
    joinedAt:s.dbSdk.serverTimestamp()
  },{merge:true});
  batch.set(s.dbSdk.doc(s.db,'users',user.uid,'classes',classId),{
    classId,
    className:cls.name||data.className||'Class',
    teacherUid:cls.teacherUid||data.teacherUid||'',
    joinCode:normalized,
    joinedAt:s.dbSdk.serverTimestamp()
  },{merge:true});
  await batch.commit();
  const classSnap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'classes',classId));
  return classSnap.exists()?{id:classId,...classSnap.data()}:{id:classId,...cls};
}

export async function listPupilClasses(user){
  const s=await initFirebaseServices();
  if(!s||!user) return [];
  const snap=await s.dbSdk.getDocs(s.dbSdk.collection(s.db,'users',user.uid,'classes'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.className||a.name).localeCompare(String(b.className||b.name)));
}

export async function getClass(classId){
  const s=await initFirebaseServices();
  if(!s||!classId) return null;
  const snap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'classes',classId));
  return snap.exists()?{id:snap.id,...snap.data()}:null;
}

export async function listClassMembers(classId){
  const s=await initFirebaseServices();
  if(!s||!classId) return [];
  const snap=await s.dbSdk.getDocs(s.dbSdk.collection(s.db,'classes',classId,'members'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.displayName).localeCompare(String(b.displayName)));
}

export async function getClassMember(classId, uid){
  const s=await initFirebaseServices();
  if(!s||!classId||!uid) return null;
  const snap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'classes',classId,'members',uid));
  return snap.exists()?{id:snap.id,...snap.data()}:null;
}

export async function updateClassMemberSettings(classId, uid, patch={}){
  const s=await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled.');
  if(!classId||!uid) throw new Error('Choose a pupil first.');
  const allowed={};
  if(patch.blockSupportMode==='auto'||patch.blockSupportMode==='manual') allowed.blockSupportMode=patch.blockSupportMode;
  if(!Object.keys(allowed).length) return;
  allowed.updatedAt=s.dbSdk.serverTimestamp();
  await s.dbSdk.updateDoc(s.dbSdk.doc(s.db,'classes',classId,'members',uid),allowed);
}

export async function removeClassMember(classId, uid){
  const s=await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled.');
  const batch=s.dbSdk.writeBatch(s.db);
  batch.delete(s.dbSdk.doc(s.db,'classes',classId,'members',uid));
  batch.delete(s.dbSdk.doc(s.db,'users',uid,'classes',classId));
  await batch.commit();
}

export async function regenerateJoinCode(classId){
  const s=await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled.');
  const classRef=s.dbSdk.doc(s.db,'classes',classId);
  const snap=await s.dbSdk.getDoc(classRef);
  if(!snap.exists()) throw new Error('Class not found.');
  const cls=snap.data();
  const old=cls.joinCode||'';
  const code=await makeUniqueJoinCode(s);
  const batch=s.dbSdk.writeBatch(s.db);
  batch.update(classRef,{joinCode:code,updatedAt:s.dbSdk.serverTimestamp()});
  batch.set(s.dbSdk.doc(s.db,'joinCodes',code),{classId,className:cls.name||'',teacherUid:cls.teacherUid,createdAt:s.dbSdk.serverTimestamp()});
  if(old) batch.delete(s.dbSdk.doc(s.db,'joinCodes',old));
  await batch.commit();
  return code;
}

export async function saveAssignment(classId, assignment){
  const s=await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled.');
  if(!classId) throw new Error('Choose a class first.');
  const ref=assignment.id
    ? s.dbSdk.doc(s.db,'classes',classId,'assignments',assignment.id)
    : s.dbSdk.doc(s.dbSdk.collection(s.db,'classes',classId,'assignments'));
  await s.dbSdk.setDoc(ref,{...assignment,id:ref.id,updatedAt:s.dbSdk.serverTimestamp()},{merge:true});
  return ref.id;
}

export async function listAssignments(classId){
  const s=await initFirebaseServices();
  if(!s||!classId) return [];
  const snap=await s.dbSdk.getDocs(s.dbSdk.collection(s.db,'classes',classId,'assignments'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.title).localeCompare(String(b.title)));
}

export async function saveProjectToCloud(project, user, classId){
  const s = await initFirebaseServices();
  if(!s || !user) throw new Error('Sign in first.');
  if(!classId) throw new Error('Join a class before saving a pupil project.');
  const cloudId=`${user.uid}__${project.id}`;
  const ref = s.dbSdk.doc(s.db, 'projects', cloudId);
  await s.dbSdk.setDoc(ref, {
    ...project,
    projectId:project.id,
    ownerUid:user.uid,
    classId,
    updatedAt:s.dbSdk.serverTimestamp(),
    updatedAtMs:Date.now()
  }, {merge:true});
  return cloudId;
}

export async function listMyProjects(user, classId=''){
  const s=await initFirebaseServices();
  if(!s||!user) return [];
  let q=s.dbSdk.query(s.dbSdk.collection(s.db,'projects'),s.dbSdk.where('ownerUid','==',user.uid));
  if(classId) q=s.dbSdk.query(s.dbSdk.collection(s.db,'projects'),s.dbSdk.where('ownerUid','==',user.uid),s.dbSdk.where('classId','==',classId));
  const snap=await s.dbSdk.getDocs(q);
  return snap.docs.map(d=>({cloudId:d.id,...d.data()}));
}

export async function listClassProjects(classId){
  const s=await initFirebaseServices();
  if(!s||!classId) return [];
  const q=s.dbSdk.query(s.dbSdk.collection(s.db,'projects'),s.dbSdk.where('classId','==',classId));
  const snap=await s.dbSdk.getDocs(q);
  return snap.docs.map(d=>({cloudId:d.id,...d.data()}));
}

export async function loadProjectFromCloud(cloudId){
  const s = await initFirebaseServices();
  if(!s) return null;
  const snap = await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'projects',cloudId));
  return snap.exists() ? {cloudId:snap.id,...snap.data()} : null;
}

export async function deleteProjectFromCloud(user, projectId){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  if(!projectId) throw new Error('Choose an app first.');
  const cloudId=`${user.uid}__${projectId}`;
  await s.dbSdk.deleteDoc(s.dbSdk.doc(s.db,'projects',cloudId));
}

export async function listPersonalImages(user){
  const s=await initFirebaseServices();
  if(!s||!user) return [];
  const snap=await s.dbSdk.getDocs(s.dbSdk.collection(s.db,'users',user.uid,'images'));
  return snap.docs.map(d=>({id:d.id,...d.data(),dataUrl:d.data().downloadURL||''})).sort((a,b)=>a.id.localeCompare(b.id));
}

export async function uploadPersonalImage(user, image){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  const existing=await listPersonalImages(user);
  const used=new Set(existing.map(x=>x.id));
  const slot=IMAGE_SLOTS.find(x=>!used.has(x));
  if(!slot) throw new Error('You have used all 20 personal image slots.');
  const blob=dataUrlToBlob(image.dataUrl);
  const path=`users/${user.uid}/images/${slot}.webp`;
  const storageRef=s.storageSdk.ref(s.storage,path);
  await s.storageSdk.uploadBytes(storageRef,blob,{contentType:'image/webp',customMetadata:{ownerUid:user.uid,slot}});
  const downloadURL=await s.storageSdk.getDownloadURL(storageRef);
  await s.dbSdk.setDoc(s.dbSdk.doc(s.db,'users',user.uid,'images',slot),{
    slot,
    name:image.name||`Image ${slot}`,
    category:'My Images',
    tags:(image.tags||image.name||'').toLowerCase(),
    downloadURL,
    storagePath:path,
    size:image.size||blob.size,
    width:image.width||0,
    height:image.height||0,
    source:'personal',
    createdAt:s.dbSdk.serverTimestamp()
  });
  return {id:slot,name:image.name||`Image ${slot}`,category:'My Images',tags:(image.tags||image.name||'').toLowerCase(),downloadURL,dataUrl:downloadURL,storagePath:path,size:image.size||blob.size,width:image.width||0,height:image.height||0,source:'personal'};
}

export async function deletePersonalImage(user, slot){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  const metaRef=s.dbSdk.doc(s.db,'users',user.uid,'images',slot);
  const snap=await s.dbSdk.getDoc(metaRef);
  if(snap.exists() && snap.data().storagePath){
    try{ await s.storageSdk.deleteObject(s.storageSdk.ref(s.storage,snap.data().storagePath)); }catch(err){ if(err?.code!=='storage/object-not-found') throw err; }
  }
  await s.dbSdk.deleteDoc(metaRef);
}

export async function listSharedImages(){
  const s=await initFirebaseServices();
  if(!s) return [];
  const snap=await s.dbSdk.getDocs(s.dbSdk.collection(s.db,'imageBank'));
  return snap.docs.map(d=>({id:d.id,...d.data(),dataUrl:d.data().downloadURL||''})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}

export async function uploadSharedImage(user, image){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  if(!(await isApprovedTeacher(user))) throw new Error('Only approved teachers can add shared images.');
  const imageId=s.dbSdk.doc(s.dbSdk.collection(s.db,'imageBank')).id;
  const blob=dataUrlToBlob(image.dataUrl);
  const path=`imageBank/${user.uid}/${imageId}.webp`;
  const storageRef=s.storageSdk.ref(s.storage,path);
  await s.storageSdk.uploadBytes(storageRef,blob,{contentType:'image/webp',customMetadata:{uploaderUid:user.uid}});
  const downloadURL=await s.storageSdk.getDownloadURL(storageRef);
  const meta={
    name:image.name||'Shared image',
    category:image.category||'Teacher uploads',
    tags:(image.tags||image.name||'').toLowerCase(),
    downloadURL,
    storagePath:path,
    size:image.size||blob.size,
    width:image.width||0,
    height:image.height||0,
    source:'teacher',
    uploaderUid:user.uid,
    createdAt:s.dbSdk.serverTimestamp()
  };
  await s.dbSdk.setDoc(s.dbSdk.doc(s.db,'imageBank',imageId),meta);
  return {id:imageId,...meta,dataUrl:downloadURL};
}

export async function deleteSharedImage(user, imageId){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  const ref=s.dbSdk.doc(s.db,'imageBank',imageId), snap=await s.dbSdk.getDoc(ref);
  if(!snap.exists()) return;
  const data=snap.data();
  if(data.uploaderUid!==user.uid) throw new Error('You can only delete shared images that you uploaded.');
  if(data.storagePath){
    try{ await s.storageSdk.deleteObject(s.storageSdk.ref(s.storage,data.storagePath)); }catch(err){ if(err?.code!=='storage/object-not-found') throw err; }
  }
  await s.dbSdk.deleteDoc(ref);
}

export async function uploadAppIcon(user, projectId, image){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  const blob=dataUrlToBlob(image.dataUrl);
  const safeProject=String(projectId||'project').replace(/[^a-zA-Z0-9_-]/g,'_');
  const path=`users/${user.uid}/appIcons/${safeProject}/icon.webp`;
  const ref=s.storageSdk.ref(s.storage,path);
  await s.storageSdk.uploadBytes(ref,blob,{contentType:'image/webp'});
  return s.storageSdk.getDownloadURL(ref);
}

function dataUrlToBlob(dataUrl){
  const [meta,data]=String(dataUrl).split(',');
  const mime=(meta.match(/data:([^;]+)/)||[])[1]||'image/webp';
  const bytes=atob(data); const arr=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

async function makeUniqueJoinCode(s){
  for(let attempt=0;attempt<8;attempt++){
    const code=makeJoinCode();
    const snap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'joinCodes',code));
    if(!snap.exists()) return code;
  }
  throw new Error('Could not generate a unique class code. Try again.');
}

function makeJoinCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const nums=new Uint32Array(6); crypto.getRandomValues(nums);
  return [...nums].map(n=>alphabet[n%alphabet.length]).join('');
}

export async function uploadPublishedIcons(user, projectId, icon192DataUrl, icon512DataUrl){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  const safeProject=String(projectId||'project').replace(/[^a-zA-Z0-9_-]/g,'_');
  const uploadOne=async(name,dataUrl)=>{
    const blob=dataUrlToBlob(dataUrl);
    const path=`users/${user.uid}/appIcons/${safeProject}/${name}.webp`;
    const ref=s.storageSdk.ref(s.storage,path);
    await s.storageSdk.uploadBytes(ref,blob,{contentType:'image/webp'});
    return s.storageSdk.getDownloadURL(ref);
  };
  const [icon192,icon512]=await Promise.all([uploadOne('icon-192',icon192DataUrl),uploadOne('icon-512',icon512DataUrl)]);
  return {icon192,icon512};
}

export async function publishProject(user, project, snapshot, icons){
  const s=await initFirebaseServices();
  if(!s||!user) throw new Error('Sign in first.');
  if(!project?.id) throw new Error('This project does not have an ID yet.');
  let publicId=project.publish?.publicId||'';
  const isNew=!publicId;
  // Do not probe a random unpublished document with getDoc here. Public-app rules
  // intentionally deny reads of non-existent/unpublished IDs, so that uniqueness
  // check itself would be rejected. A 14-character crypto-random ID has ample
  // entropy; in the vanishingly unlikely event of a collision, Firestore's update
  // rule rejects overwriting somebody else's snapshot and the pupil can retry.
  if(!publicId) publicId=makePublicId();
  const pub=project.publish||{};
  const ref=s.dbSdk.doc(s.db,'publishedApps',publicId);
  const data={
    ownerUid:user.uid,
    projectId:project.id,
    appName:(pub.appName||project.name||'My App').slice(0,60),
    theme:pub.theme||'#6256df',
    orientation:pub.orientation||'any',
    icon192:icons?.icon192||'',
    icon512:icons?.icon512||'',
    snapshot,
    published:true,
    updatedAt:s.dbSdk.serverTimestamp()
  };
  if(isNew) data.publishedAt=s.dbSdk.serverTimestamp();
  await s.dbSdk.setDoc(ref,data,{merge:true});
  return {publicId,...data};
}

export async function unpublishProject(user, publicId){
  const s=await initFirebaseServices();
  if(!s||!user||!publicId) throw new Error('Nothing is published yet.');
  await s.dbSdk.updateDoc(s.dbSdk.doc(s.db,'publishedApps',publicId),{published:false,updatedAt:s.dbSdk.serverTimestamp()});
}

function makePublicId(){
  const alphabet='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const nums=new Uint32Array(14);crypto.getRandomValues(nums);
  return [...nums].map(n=>alphabet[n%alphabet.length]).join('');
}
