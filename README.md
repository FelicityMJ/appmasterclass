# DataApp Studio — classroom V1.12

A child-friendly database + app builder aimed at roughly age 12–13. V1.9 keeps the multi-app, multi-page, Blockly and Android publishing foundation and adds teacher-controlled block support so pupils can build programming themselves with tutorials.




## New in V1.12

- published page background now fills the entire installed-app viewport, including below the scaled design canvas;
- Database List components can use a **Transparent list background** option;
- transparent lists let the page background show through the container and rows in Design, Test and published Android/PWA apps.

## New in V1.11

- published Android apps now render against the same 320×630 logical canvas as the builder and scale to the real device, preserving layout and alignment;
- centred/right-aligned labels render consistently in the published app;
- published-app debug/status toasts are removed;
- cached published apps render immediately on launch while Firestore refreshes quietly in the background;
- service-worker/manifest setup no longer blocks the first visible app screen;
- PWA splash background follows the first app page colour;
- optional `public-host.js` lets QR/install links point at Firebase Hosting or a custom branded domain rather than the GitHub Pages address.

See `UPDATE-V1.11.md`.

## New in V1.10

- fixed Design property inputs losing focus after every typed character;
- text, font, colour, width and height now update the preview live without rebuilding the inspector while the pupil is typing;
- selected components now show a purple **move grip** above them, so database Lists can be moved without stealing scroll/tap gestures from their rows;
- kept the four corner resize handles from V1.9;
- fixed first-time Publish permission errors caused by probing an unpublished/non-existent public ID before creating it;
- Publish now generates a cryptographically random public ID and writes the snapshot directly, while Firestore rules still prevent overwriting another pupil's published app.

No Firestore or Storage rule change is required from V1.9 if the V1.5+ publishing rules are already deployed.

See `UPDATE-V1.10.md`.

## New in V1.9

- four draggable corner handles resize components directly on the phone canvas;
- page background colour plus text/background colours for labels, buttons and text boxes;
- Blockly is split by app page, so pupils edit only the current page's blocks;
- new database type **Image link (URL)** displays externally hosted images without using an upload slot;
- new **Rating (1–10 stars)** field with clickable stars in the database and star display in lists/details;
- no Firebase rule change is required from V1.8.

See `UPDATE-V1.9.md` when upgrading an already connected V1.8 site.

## New in V1.8

- pupils build Blockly themselves by default; Design no longer silently inserts programming for them;
- every class pupil has a teacher-controlled **Block support** setting;
- **Tutorial — pupil builds blocks** is the default;
- **Auto-add support blocks** can be switched on for individual pupils who need more scaffolding;
- buttons now show a clear **Tell this button what to do** route into the Blockly tutorial;
- List navigation and database placeholder connections only auto-create blocks when that pupil has Auto-add support enabled;
- contextual Blockly tutorials explain button clicks, List → Details navigation and Details-page placeholders;
- wording now uses **selected record** for the row chosen from a List;
- no Firestore or Storage rule change is needed from V1.7 because class owners already have permission to update their member records.

See `UPDATE-V1.8.md` when upgrading an already connected V1.7 site.

## New in V1.7

- **My Apps** pupil dashboard with up to 30 apps per class;
- create, open, rename, duplicate and delete apps without affecting other projects;
- Draft / Published status on every app card;
- app cards show page, record and component counts;
- teacher assignments create a new app/attempt instead of replacing an existing app;
- assignment cards show how many apps/attempts the pupil has started;
- 20 personal-image slots remain account-wide and can be reused across all apps;
- teacher class table shows each pupil's app count and their latest project;
- existing single-project V1.6 data is automatically treated as an app rather than being lost.

## Pupil workflow

1. Sign in with Google.
2. Join a teacher's class with a six-character code (only needed once).
3. Open a teacher assignment or continue a saved project.
4. **DATA** — create/edit fields and records.
5. **DESIGN** — add labels, images, buttons, text boxes and lists.
6. **BLOCKS** — use a deliberately small Scratch-like visual programming set.
7. **TEST** — run the app and use the friendly debugger.
8. **PUBLISH** — choose the installed-app name/icon, publish an unlisted snapshot, scan its QR code and install it on Android.

## Teacher workflow

1. Sign in with Google using an account approved in `teacherAllowlist`.
2. Create one or more classes.
3. Give pupils the generated six-character join code.
4. Create assignments for the selected class.
5. See real enrolled pupils and their saved project summaries.
6. Add curriculum-safe images to the shared Image Bank.
7. Regenerate a join code or remove a pupil when needed.



## New in V1.6

- pupils can create, rename, switch between and delete multiple app pages/screens;
- every component belongs to a page, with automatic migration of V1.5 single-screen projects to a Home page;
- real database-driven List component instead of placeholder rows;
- list layouts: **Image only**, **Image + Title**, **Image + Title + Subtitle**, **Title + Subtitle**, or **Title only**;
- image/title/subtitle each map to a chosen database field;
- lists are vertically scrollable when there are many records;
- tapping a list row makes that row the **current database record**;
- a list can be configured to open another page when a row is tapped;
- the easy list-navigation setting creates real Blockly `when list item tapped → go to page` blocks that pupils can inspect and edit;
- new Blockly **list item tapped**, **go to page**, and **go back** blocks;
- Page Open Blockly events now choose which page they belong to;
- detail-page labels/images can use the existing **Connect Data** route to show fields from the selected list record;
- Test and published Android/PWA apps both support the same multi-page/list navigation;
- the guided first-app tutorial now teaches the common **scrollable list → details page** pattern from a blank project.

No Firestore or Storage rule change is required from V1.5. See `UPDATE-V1.6.md`.

## New in V1.5

- real Blockly workspace with snap-together custom Events, Database and Screen blocks;
- Blockly JSON workspace state saved with the pupil project;
- existing V1.4 programs migrate into Blockly stacks;
- live Python-style / plain-English representation of the Blockly program;
- new database **first record** and screen **set text** blocks;
- pupil Publish creates a separate public snapshot in `publishedApps/{publicId}`;
- 14-character unlisted public app IDs and share URLs;
- QR code generated on the pupil Publish screen;
- dedicated `published.html` runtime which does not expose the classroom builder;
- Android PWA manifest generated per published app, using the pupil's app name/orientation/icon;
- 192px and 512px install icons stored outside the pupil 20-image allowance;
- service worker and Android install flow;
- update an existing published app without changing its QR link;
- unpublish to switch the public link off.

See `UPDATE-V1.5.md` when upgrading an already connected V1.4 site.

## New in V1.4

- pupil projects start completely blank — no sample database, records, components or blocks;
- step-by-step tutorial that checks work without doing it for the pupil;
- pupils name their own app and database table;
- teacher assignments always start blank;
- teachers can choose Guided tutorial or Checklist only;
- legacy built-in demo projects are ignored for new pupil work;
- no Firestore/Storage rules change is required from V1.3.

See `UPDATE-V1.4.md` when upgrading an already connected site.

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

The classroom/login/storage layer is now real when Firebase is enabled. V1.5 implements the Android **Publish → QR code → installable per-pupil PWA** flow. Published apps are unlisted public snapshots rather than editable classroom projects.

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
