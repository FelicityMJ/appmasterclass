# DataApp Studio — classroom V1.3

A child-friendly database + app builder aimed at roughly age 12–13. V1.3 connects the classroom shell to real Firebase Authentication, Cloud Firestore and Cloud Storage while retaining a local preview mode until Firebase is enabled.

## Pupil workflow

1. Sign in with Google.
2. Join a teacher's class with a six-character code (only needed once).
3. Open a teacher assignment or continue a saved project.
4. **DATA** — create/edit fields and records.
5. **DESIGN** — add labels, images, buttons, text boxes and lists.
6. **BLOCKS** — use a deliberately small Scratch-like visual programming set.
7. **TEST** — run the app and use the friendly debugger.
8. **PUBLISH** — choose future installed-app name, orientation and icon.

## Teacher workflow

1. Sign in with Google using an account approved in `teacherAllowlist`.
2. Create one or more classes.
3. Give pupils the generated six-character join code.
4. Create assignments for the selected class.
5. See real enrolled pupils and their saved project summaries.
6. Add curriculum-safe images to the shared Image Bank.
7. Regenerate a join code or remove a pupil when needed.

## New in V1.3

- Real Google sign-in through Firebase Authentication.
- Automatic pupil account creation on first Google sign-in.
- Secure teacher approval through `teacherAllowlist/{uid}`; pupils cannot promote themselves to teachers.
- Real Firestore classrooms and six-character join codes.
- Pupil class membership persists to their Google account.
- Real class assignments stored under each class.
- Pupil projects autosave to Firestore.
- Teacher dashboard reads real class members and saved project summaries.
- Shared teacher Image Bank stored in Firebase Storage + Firestore metadata.
- Personal pupil images stored in Firebase Storage.
- **Hard 20-image storage layout:** only `01.webp` through `20.webp` are permitted for each pupil.
- Browser resize/compression before upload (max 800 px, WebP, target around 80 KB).
- Shared images do not use pupil slots.
- App icon lives in a separate Firebase path and does not consume a pupil image slot.

## Image architecture

```text
Cloud Storage
users/{uid}/images/01.webp ... 20.webp
users/{uid}/appIcons/{projectId}/icon.webp
imageBank/{teacherUid}/{imageId}.webp

Cloud Firestore
users/{uid}/images/01 ... 20
imageBank/{imageId}
```

The fixed filenames make it impossible for the normal Storage rules to accept a 21st personal image object for a pupil.

## Firestore model

```text
teacherAllowlist/{teacherUid}
users/{uid}
users/{uid}/classes/{classId}
users/{uid}/images/{slot}
classes/{classId}
classes/{classId}/members/{uid}
classes/{classId}/assignments/{assignmentId}
joinCodes/{CODE}
projects/{uid__projectId}
imageBank/{imageId}
```

## Important V1.3 boundary

The classroom/login/storage layer is now real when Firebase is enabled. The Android **Publish → QR code → installable per-pupil PWA** endpoint is still the next stage. The Publish screen already stores the app identity and icon needed for it.

## Run locally

Serve the folder rather than double-clicking `index.html`:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

If `firebaseEnabled` is `false`, the app runs in local preview mode.

## Connect Firebase

Follow `SETUP-FIREBASE.md` exactly. It includes the teacher allow-list step that is required before a teacher can create classes or upload shared images.

## Main files

- `index.html` — app shell.
- `styles.css` — responsive classroom UI.
- `app.js` — pupil/teacher UI, builder, media compression and cloud wiring.
- `firebase-config.js` — paste the Firebase Web App configuration here.
- `firebase-service.js` — Auth, Firestore and Storage operations.
- `firestore.rules` — user/class/project/image metadata permissions.
- `storage.rules` — image ownership, teacher-bank permissions, size/type checks and the 20-slot cap.
- `firebase.json` — Firebase Hosting, Firestore rules and Storage rules configuration.
