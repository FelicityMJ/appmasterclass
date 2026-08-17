# DataApp Studio V1.6 update guide

V1.6 adds **multiple pages** and a real **database-driven scrollable List** while keeping the V1.5 Google login, classrooms, image limits, Blockly and Android QR/PWA publishing.

## If your V1.5 site is already connected to Firebase

Keep your existing `firebase-config.js` exactly as it is.

Replace/add these files in the root of the GitHub repository:

- `app.js`
- `blockly-integration.js`
- `public-app.js`
- `styles.css`
- `published.css`
- `sw.js`
- `README.md`
- `UPDATE-V1.6.md`

`index.html`, `published.html`, `app.webmanifest`, Firebase config and Firebase service code do not need changing for this update.

## Firebase rules

**No Firestore or Storage rule changes are required from V1.5.** The new pages/list settings are saved inside the existing pupil project/published snapshot documents, so the V1.5 rules already cover them.

## What pupils can now build

A common project can work like this:

1. Create a `Songs` database containing `Song`, `Artist`, `Image`, `Information`.
2. On the Home page add a Database List.
3. Choose `Image + Title + Subtitle`.
4. Map `Image → Image`, `Title → Song`, `Subtitle → Artist`.
5. Add a second page called `Song Details`.
6. Add labels/images to Song Details and connect them to fields.
7. Select the list and set **When a row is tapped → Song Details**.
8. DataApp Studio creates Blockly logic equivalent to:

   `when an item in SongList is tapped → go to Song Details`

The tapped list row automatically becomes the current record, so the details page displays the correct database record.

## Test after deploying

1. Hard refresh the GitHub Pages site (`Ctrl + Shift + R`).
2. Sign in with a fictional/test pupil account.
3. Start a blank project.
4. Add at least 5 records so the List genuinely scrolls.
5. Create Home + Details pages.
6. Verify all five List layouts.
7. Verify different list rows open Details with different record data.
8. Add a Back button and use the Blockly `go back` block.
9. Publish the app, scan the QR on Android, and repeat the same list/navigation test in the installed/public app.

Existing V1.5 single-screen pupil projects migrate automatically: their old components are assigned to a new `Home` page when opened.
