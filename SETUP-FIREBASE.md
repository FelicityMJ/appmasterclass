# Firebase setup for DataApp Studio V1.2

The prototype works locally first. Connect Firebase when you are ready to test real teacher/pupil accounts.

## 1. Register the Web App

In Firebase Console, choose your project and register a **Web App**. Copy the Firebase configuration object into `firebase-config.js` and change:

```js
export const firebaseEnabled = true;
```

Never put a Firebase Admin SDK/service-account private key in the browser app.

## 2. Authentication

Enable **Google** as a sign-in provider in Firebase Authentication.

## 3. Firestore

Create Cloud Firestore and deploy `firestore.rules`.

Suggested data model includes:

```text
classes/{classId}
classes/{classId}/members/{uid}
classes/{classId}/assignments/{assignmentId}
joinCodes/{CODE}
projects/{projectId}
users/{uid}
users/{uid}/images/{imageId}
users/{uid}/appIcons/{projectId}
imageBank/{imageId}
```

## 4. Storage

Enable Firebase Storage and deploy `storage.rules`.

Planned paths:

```text
users/{uid}/images/{imageId}
users/{uid}/appIcons/{projectId}/{fileName}
imageBank/{imageId}
```

`storage.rules` rejects non-images and files at/over 150 KB for pupil image/icon paths. The browser currently targets about 80 KB for personal images, leaving headroom.

### Enforcing the 20-image quota in production

Do not rely only on a counter displayed in the browser. The production version should make the final quota decision in trusted backend code (for example, a callable/server function or another trusted write path) and maintain image metadata/counts transactionally. The V1.2 local prototype enforces 20 in its UI/data store so the classroom behaviour can be tested now.

### Shared Image Bank writes

Pupils should only read shared-bank assets. Teacher/admin uploads should ultimately use a trusted teacher/admin permission or server-side function. The starter cloud rules therefore do not yet allow arbitrary browser writes to the shared bank.

## 5. Hosting

`firebase.json` now includes Hosting, Firestore rules and Storage rules.

## 6. Next cloud-wiring stage

- Google sign-in buttons
- teacher class creation
- pupil join-class flow
- assignment saving/loading
- cloud project autosave
- personal image upload to Firebase Storage + Firestore metadata
- trusted 20-image quota enforcement
- teacher/admin Image Bank uploads
- project publishing endpoint/manifest/QR for Android PWA installation
