# DataApp Studio — classroom V1.23

A child-friendly database + app builder aimed at roughly age 12–13. V1.23 makes Level 5 Connected App projects API-first: pupils begin in Connect, not in an empty database.














## New in V1.23

- **Level 5 — Connected App now starts in Connect**, not Data, whenever a pupil starts or reopens the project.
- The Level 5 main pathway is now **1. Connect → 2. Design → 3. Blocks → 4. Test → 5. Publish**.
- The Level 5 tutorial no longer asks pupils to name or build a database before using an API; Step 1 is **Choose and test a live API**.
- Connect now clearly says **Start here — no database needed** and explains what to do first.
- Local database data is still available under **Advanced: add local database data (optional)** for hybrid projects.
- Opening that optional Data workspace shows a clear message and a one-click route back to Connect.
- The teacher assignment dialog now explains that Level 5 starts in Connect and that database records are optional.
- Existing Level 5 projects are not converted or erased; they simply open on Connect next time.
- No Firebase rule changes are required.

## New in V1.22

- long dialogs such as **Create an assignment** now scroll inside the modal when they are taller than the browser window;
- the page behind the modal stays fixed;
- the assignment action buttons remain reachable at the bottom while scrolling;
- the optional teacher instructions box now uses the full modal width and can be resized vertically;
- no Firebase rule changes are required.

## New in V1.21

- Every capability level now has a built-in **project brief** with a real app purpose, user journey, skills and success criteria. The brief remains visible even when pupils choose checklist-only support.
- **Level 2 — Pet Match** is deliberately framed as a recommendation app: pupils collect user choices with inputs and make meaningful recommendations with IF / ELSE rather than completing an abstract programming exercise.
- Teachers see the recommended project when choosing a capability level. The assignment title follows the recommended brief unless the teacher has typed their own title, and teachers can add class-specific instructions.
- **Level 5 — Connected App** unlocks a new **Connect** workspace and **Web / API** Blockly category. Earlier projects do not see any API tools.
- Level 5 includes three curated no-secret connectors: **Live Weather (Open-Meteo)**, **Book Search (Open Library)** and **Pokédex (PokéAPI)**.
- The Connect workspace includes a real request tester, friendly result fields and an expandable JSON view so pupils can see the request → API → JSON → app flow before coding it.
- New Blockly actions: **ask selected API using [input]**, **set [component] to API result [field]**, and **if last API request worked**. API image URLs can be sent directly to an Image component.
- API requests work in Test and in published/installed apps. Failed requests can be handled with an ELSE branch. No private API keys are stored in pupil projects or published apps.
- Level 5 keeps all Level 1–4 tools; it only adds the Connected App layer.
- No Firestore or Storage rule changes are required for V1.21.

## New in V1.20

- **Progressive capability levels** are stored per assignment/project. Existing projects and old assignments default to **Level 1**, so pupils are not suddenly shown new tools.
- **Level 1 — Database Explorer:** the existing two-page List → Details workflow only.
- **Level 2 — Interactive App:** unlocks Text Input, Number Input, Dropdown, Switch and Slider components; Blockly adds input-change events, IF / ELSE comparisons, messages, show/hide and copying an input value to a screen component.
- **Level 3 — Data Creator:** unlocks add/update/delete record blocks. Inputs can be mapped to database fields in Design, so one block can save a form. Test mode changes a temporary copy only; published apps persist user-created records locally on that device/browser.
- **Level 4 — Smart App:** unlocks simple variables, counters and displaying variable values.
- Teachers choose the capability level when creating an assignment. Pupils only see components and Blockly categories allowed for that project.
- Guided tutorial/checklist content changes with the project capability level.
- No Firestore or Storage rule changes are required for V1.20.

## New in V1.19

- Publish is now described as **Install on phone** rather than Android-only.
- One QR/app link works for Android, iPhone and iPad.
- The pupil Publish screen shows separate Android and iPhone/iPad install instructions.
- Published apps detect iPhone/iPad and show **Add to Home Screen** guidance instead of an Android install message.
- Android still uses the native browser install prompt when available.
- Installed/standalone apps hide the install button.
- The chosen pupil icon is also exposed as an Apple touch icon for iPhone/iPad Home Screen installation.
- No Firebase rules change is required from V1.18.

## New in V1.18

- one teacher account can be marked as the **DataApp Studio administrator** with `admin = true` in its existing `teacherAllowlist/{uid}` document;
- only that administrator sees **Invite teacher** and the Teacher administration panel;
- the admin invites a teacher by their Google email address — no Firebase UID needs to be copied;
- the invited teacher chooses **Teacher — Sign in** and their non-admin teacher account is activated automatically on first Google sign-in;
- invited teachers can create and manage their own classes but **cannot invite other teachers**;
- the admin can see active teacher accounts, pending invitations, cancel a pending invite, or revoke a teacher account;
- revoking teacher access does not delete that teacher's stored classes or pupil work;
- invitation emails are not silently sent by Firebase: the admin can copy the prepared invitation or open their normal email app with the message ready to send.

**Firestore rules change required from V1.17.** Publish the V1.18 `firestore.rules` before using teacher invitations. No Storage rules change is required.

## New in V1.17

- the landing screen now separates **New pupil — Join a class**, **Returning pupil — Sign in**, and **Teacher — Sign in**;
- choosing **New pupil** opens Google sign-in first and then immediately asks for the teacher's class code;
- returning pupils sign in straight to their existing classes, apps and assignments without re-entering a code;
- if a returning Google account has no class membership yet, DataApp Studio automatically opens the class-code prompt;
- existing pupils can still use **+ Join another class** from their dashboard;
- accidentally choosing New pupil with an existing account is safe — it simply offers the Join another class flow rather than creating a duplicate account;
- signing out never removes class membership.

No Firestore, Storage or Firebase Authentication rule change is required from V1.16.

## New in V1.16

- teachers can click a pupil in the class table and open a **Pupil Apps** screen showing every saved app for that class;
- teachers can open a pupil app in a clearly labelled **read-only teacher view** and inspect Data, Design, page-specific Blocks and Test without changing pupil work;
- pupils can **rename a database field**, **change its data type**, or **delete the field** after creating it;
- renaming a field preserves its internal field ID so existing connections continue to work;
- changing a field type converts existing values where sensible and clears incompatible image/list connections;
- deleting a field warns that the whole column of record data will be removed;
- the Image picker now has **Image Bank**, **My Images**, and **Image URL** choices for fixed Image components and image-valued database cells;
- an Image URL must use `https://` and does not consume a pupil personal-image slot.

## New in V1.15

- database text fields are now split into **Short text** and **Long text**;
- existing legacy `text` fields automatically migrate to **Short text**;
- **Long text** records use a multi-line textarea in the Data table;
- the app **Scrollable text box** component wraps long content inside its designed width/height and scrolls vertically when needed;
- the same long-text behaviour is preserved in Design, Test, and published Android/PWA apps.

## New in V1.14

- transparent database Lists are now genuinely frameless: no outer white border and no white row-divider lines;
- list thumbnail images use a full-bleed `cover` crop and completely fill their circular image slot;
- fixed an older generic List CSS rule that was adding padding to nested database-list elements in Design/Test;
- the same transparent-list and image-crop behaviour is used in Design, Test and the published Android/PWA runtime.

## New in V1.13

- List background is now an explicit Design property: **White** or **Transparent**.
- The same saved setting is used in Design, Test and the published Android/PWA app.
- Transparent lists force both the list container and individual database rows to be transparent, so the page background shows through.
- Older projects using the V1.12 `listTransparent` flag migrate automatically.

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

1. New pupils choose **Join a class**, sign in with Google and enter the teacher's six-character code.
2. Returning pupils choose **Sign in** and go straight back to their saved classes/apps.
3. Open a teacher assignment or continue a saved project.
4. **DATA** — create/edit fields and records.
5. **DESIGN** — add labels, images, buttons, text boxes and lists.
6. **BLOCKS** — use a deliberately small Scratch-like visual programming set.
7. **TEST** — run the app and use the friendly debugger.
8. **PUBLISH** — choose the installed-app name/icon, publish an unlisted snapshot, scan its QR code and install it on Android, iPhone or iPad.

## Teacher workflow

1. Sign in with Google using an account approved in `teacherAllowlist`.
2. Create one or more classes.
3. Give pupils the generated six-character join code.
4. Create assignments for the selected class.
5. Click a pupil to see all of their saved apps and open any app in read-only teacher view.
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
