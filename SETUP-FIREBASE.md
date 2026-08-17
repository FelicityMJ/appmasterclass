# Connect DataApp Studio V1.9 to Firebase

This guide is written for the files in this ZIP. V1.9 uses the existing V1.5 publishing rules model and adds multi-page, multi-app and teacher-controlled Blockly support inside the existing classroom structure.

## What Firebase is doing

- **Authentication**: Google sign-in for teachers and pupils.
- **Cloud Firestore**: users, teacher approval, classes, join codes, assignments, memberships, projects and image metadata.
- **Cloud Storage**: pupil images, shared teacher images and app icons.
- **Hosting**: optional but recommended for the live website.

GitHub can remain your source-code repository; Firebase can be the backend and the live host.

---

## 1. Create/open your Firebase project

Go to Firebase Console and either create a new project or open the project you want to use for DataApp Studio.

A separate Firebase project for this product is simplest while it is being developed.

---

## 2. Register DataApp Studio as a Web App

On **Project overview**:

1. Click the **Web (`</>`)** app icon. If the project already has apps, choose **Add app → Web**.
2. Give it a nickname such as `DataApp Studio Web`.
3. Click **Register app**.
4. Firebase shows a configuration object containing values such as `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.

Open `firebase-config.js` in this ZIP and replace the blank values:

```js
export const firebaseEnabled = true;

export const firebaseConfig = {
  apiKey: "PASTE_YOURS_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

Use the exact values Firebase gives you; do not guess the Storage bucket name.

The Firebase Web config is intended to be used in client-side web code. **Never** put an Admin SDK service-account/private key into this website.

---

## 3. Turn on Google sign-in

In Firebase Console:

1. Open **Security → Authentication**.
2. Open **Sign-in method**.
3. Select **Google**.
4. Enable it.
5. Choose the support email Firebase asks for.
6. Save.

Pupils do not need a separate password or verification email. Their DataApp Studio pupil profile is created the first time they sign in with Google.

If you later use a custom website domain, make sure that domain is also listed in Authentication's authorised domains.

---

## 4. Create Cloud Firestore

In Firebase Console:

1. Open **Databases & Storage → Firestore**.
2. Click **Create database**.
3. Choose a suitable region.
4. You can choose **Production mode** because the supplied `firestore.rules` will replace the default deny-all rules immediately.
5. Create the database.

### Put in the V1.3 rules

Open the Firestore **Rules** tab.

Replace the existing rules with the complete contents of this ZIP's:

`firestore.rules`

Then click **Publish**.

Use the complete V1.5 rules supplied with this build. They include the V1.3 classroom model plus V1.5 public publishing permissions.

---

## 5. Create Cloud Storage

DataApp Studio needs Cloud Storage for personal images and your shared Image Bank.

In Firebase Console:

1. Open **Databases & Storage → Storage**.
2. Click **Get started**.
3. Choose your bucket location.
4. Create the bucket.

### Important billing change

As of 2026, Cloud Storage for Firebase requires the Firebase project to be on the **Blaze pay-as-you-go plan**, although no-cost Cloud Storage usage can still be available within Google's free allowances. Set a budget alert before using it with real pupils.

### Put in the V1.5 Storage rules

Open **Storage → Rules**.

Replace the rules with the complete contents of:

`storage.rules`

Then click **Publish**.

These rules:

- accept image files only;
- reject pupil/shared uploads over 150 KB after processing;
- only allow pupils to use personal filenames `01.webp` through `20.webp`;
- keep app icons outside those 20 slots;
- only let approved teachers write to their teacher Image Bank folder.

---

## 6. Make your own Google account an approved teacher

This is intentionally a two-step process so a pupil cannot simply click "I'm a teacher" and gain teacher permissions.

### First sign in once

1. Run/deploy DataApp Studio with `firebaseEnabled = true`.
2. Click **Teacher — Continue with Google**.
3. Sign in with your Google account.
4. The site will show **Teacher approval needed** and display your Firebase **UID**.
5. Copy that UID.

### Add the teacher allow-list document

In Firebase Console:

1. Go to **Firestore → Data**.
2. Start a collection named exactly:

`teacherAllowlist`

3. Use your copied Firebase UID as the **Document ID**.
4. Add a field:

```text
enabled    boolean    true
```

Optional fields for your own reference can be added, for example:

```text
name       string     Felicity
email      string     your-email@example.com
```

5. Save the document.
6. Return to DataApp Studio and click **Check again**.

You should now enter the Teacher dashboard. Your teacher profile is created automatically.

To approve another teacher later, add another document using that teacher's Firebase UID.

---

## 7. Create your first real class

In the Teacher dashboard:

1. Click **+ Create class**.
2. Enter something such as `S2 Computing 2.4`.
3. Click **Create class**.

DataApp Studio writes:

```text
classes/{classId}
joinCodes/{sixCharacterCode}
```

The dashboard then shows the generated code.

You can regenerate it later. Regenerating removes the old join code, but pupils already enrolled remain members of the class.

---

## 8. Test a pupil account

Use a different Google account for a genuine test if possible.

1. Open DataApp Studio.
2. Choose **Pupil — Continue with Google**.
3. Sign in.
4. Click **Join a class**.
5. Enter the teacher's six-character code.

The site stores membership in both places:

```text
classes/{classId}/members/{pupilUid}
users/{pupilUid}/classes/{classId}
```

That is why the pupil does not need to enter the class code again on the next login.

---

## 9. Add the images pupils can use without using their 20

Sign in as the approved teacher.

1. Open **Manage Image Bank** from the teacher dashboard.
2. Click **+ Add images to bank**.
3. Select one or several images from your computer.

Before upload, DataApp Studio automatically resizes/compresses each image to WebP.

The image itself goes to:

```text
Cloud Storage:
imageBank/{yourTeacherUid}/{imageId}.webp
```

The searchable metadata goes to:

```text
Cloud Firestore:
imageBank/{imageId}
```

Pupils see these under **Image Bank**. They can use them as many times as they want and they do **not** consume one of the pupil's 20 personal slots.

The built-in starter images also remain available.

---

## 10. Test the 20-image pupil limit

Pupil uploads are compressed first, then stored as:

```text
users/{pupilUid}/images/01.webp
users/{pupilUid}/images/02.webp
...
users/{pupilUid}/images/20.webp
```

There is no permitted `21.webp` path in `storage.rules`.

Deleting a personal image frees that numbered slot for a future upload.

App icons use a separate path:

```text
users/{pupilUid}/appIcons/{projectId}/icon.webp
```

so an app icon does not reduce the 20-image allowance.

---

## 11. Host the website

Firebase Hosting is recommended for the live site.

From the V1.3 folder, with Node.js installed:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy
```

Choose your DataApp Studio Firebase project when asked.

Because `firebase.json` is already supplied, `firebase deploy` can deploy Hosting plus the Firestore and Storage rules from this folder.

For Hosting only:

```bash
firebase deploy --only hosting
```

Firebase Hosting gives you addresses similar to:

```text
YOUR_PROJECT_ID.web.app
YOUR_PROJECT_ID.firebaseapp.com
```

Keep the source project in GitHub; deploy the tested version to Firebase Hosting.

---

## 12. What you should see in Firestore after testing

A healthy first test will look roughly like:

```text
teacherAllowlist
  YOUR_TEACHER_UID

users
  YOUR_TEACHER_UID
  PUPIL_UID
    classes
      CLASS_ID
    images
      01

classes
  CLASS_ID
    members
      PUPIL_UID
    assignments
      ASSIGNMENT_ID

joinCodes
  ABC123

projects
  PUPIL_UID__PROJECT_ID

imageBank
  IMAGE_ID
```

Do **not** manually create these normal class/pupil/project collections. The website creates them. The only collection you need to seed manually is the teacher allow-list.

---

## Troubleshooting

### "Teacher approval needed"
Your Google sign-in worked. Add the displayed UID to `teacherAllowlist` with `enabled = true`.

### "Firebase blocked that action"
Most often the V1.3 `firestore.rules` or `storage.rules` have not been published, or the teacher UID is not correctly allow-listed.

### Google says the domain is not authorised
Add the site's hostname to Firebase Authentication's authorised domains.

### Storage gives 402/403 errors
Check that the project is on the Blaze plan and has an active Cloud Storage bucket.

### Pupils can sign in but cannot join
Check that the code is exactly the current code displayed on the teacher class. Old codes stop working after regeneration.

### Image upload fails
Check Storage is enabled, V1.3 Storage rules are published, and the signed-in user has the correct role. The browser attempts to compress images before upload; Storage still rejects files over 150 KB as a second guardrail.


---

## V1.5 — enable published Android apps

V1.5 adds a `publishedApps` Firestore collection and 192/512 install-icon files. If you upgraded from V1.4, republish both rule files before testing Publish.

A pupil's public app URL points to `published.html?id=RANDOM_ID`. The public Firestore rule permits **GET only** when that document's `published` flag is true and denies collection listing. The published document does not contain the pupil's email or display name.

GitHub Pages must be served over HTTPS for Android PWA installation. Keep GitHub Pages **Enforce HTTPS** on.

See `UPDATE-V1.5.md` for the exact file replacement and testing sequence.


## V1.6 — multiple pages and database lists

V1.6 adds pages, scrollable database lists and master/detail navigation. **No additional Firestore or Storage rule change is required if the V1.5 rules are already published.** See `UPDATE-V1.6.md` for the files to replace.


## V1.7 — multiple pupil apps

V1.7 adds a My Apps library using the existing `projects` collection. No additional Firestore or Storage rule change is required from V1.6.

## V1.8 — teacher-controlled Blockly support

V1.8 stores `blockSupportMode` on `classes/{classId}/members/{pupilUid}`. The V1.7 Firestore rules already allow the class owner to update member documents and allow a pupil to read their own member document, so **no rule change is required**.

Teachers choose the support mode per pupil from the class dashboard. Pupils should refresh/reopen the class after a teacher changes the setting.
