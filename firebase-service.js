import { firebaseEnabled, firebaseConfig } from './firebase-config.js';

let services = null;

export async function initFirebaseServices(){
  if(!firebaseEnabled) return null;
  if(services) return services;

  const appSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js');
  const authSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js');
  const dbSdk = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');

  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = dbSdk.getFirestore(app);
  services = { app, auth, db, authSdk, dbSdk };
  return services;
}

export async function signInWithGoogle(){
  const s = await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled yet. Add your Web App config first.');
  const provider = new s.authSdk.GoogleAuthProvider();
  return s.authSdk.signInWithPopup(s.auth, provider);
}

export async function signOutUser(){
  const s = await initFirebaseServices();
  if(!s) return;
  return s.authSdk.signOut(s.auth);
}

export async function createClass(name, user){
  const s = await initFirebaseServices();
  if(!s || !user) throw new Error('Sign in first.');
  const classRef = await s.dbSdk.addDoc(s.dbSdk.collection(s.db,'classes'), {
    name,
    teacherUid:user.uid,
    createdAt:s.dbSdk.serverTimestamp()
  });
  const code = makeJoinCode();
  await s.dbSdk.setDoc(s.dbSdk.doc(s.db,'joinCodes',code), {
    classId:classRef.id,
    createdAt:s.dbSdk.serverTimestamp()
  });
  return { classId:classRef.id, code };
}

export async function joinClassByCode(code, user, displayName=''){
  const s = await initFirebaseServices();
  if(!s || !user) throw new Error('Sign in first.');
  const normalized=String(code).trim().toUpperCase();
  const codeSnap=await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'joinCodes',normalized));
  if(!codeSnap.exists()) throw new Error('That class code was not found.');
  const {classId}=codeSnap.data();
  await s.dbSdk.setDoc(s.dbSdk.doc(s.db,'classes',classId,'members',user.uid), {
    joinCode:normalized,
    displayName:displayName || user.displayName || '',
    joinedAt:s.dbSdk.serverTimestamp()
  });
  return classId;
}

export async function saveProjectToCloud(project, user, classId){
  const s = await initFirebaseServices();
  if(!s || !user) throw new Error('Sign in first.');
  if(!classId) throw new Error('A class is required for pupil projects.');
  const ref = s.dbSdk.doc(s.db, 'projects', project.id);
  await s.dbSdk.setDoc(ref, {
    ...project,
    ownerUid:user.uid,
    classId,
    updatedAt:s.dbSdk.serverTimestamp()
  }, {merge:true});
  return true;
}

export async function loadProjectFromCloud(projectId){
  const s = await initFirebaseServices();
  if(!s) return null;
  const snap = await s.dbSdk.getDoc(s.dbSdk.doc(s.db,'projects',projectId));
  return snap.exists() ? snap.data() : null;
}

export async function saveAssignment(classId, assignment){
  const s=await initFirebaseServices();
  if(!s) throw new Error('Firebase is not enabled.');
  const ref=assignment.id
    ? s.dbSdk.doc(s.db,'classes',classId,'assignments',assignment.id)
    : s.dbSdk.doc(s.dbSdk.collection(s.db,'classes',classId,'assignments'));
  await s.dbSdk.setDoc(ref,{...assignment,id:ref.id,updatedAt:s.dbSdk.serverTimestamp()},{merge:true});
  return ref.id;
}

function makeJoinCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='';
  crypto.getRandomValues(new Uint32Array(7)).forEach(n=>out+=alphabet[n%alphabet.length]);
  return out;
}
