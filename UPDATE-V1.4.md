# DataApp Studio V1.4 — blank pupil projects + guided tutorial

V1.4 changes the pupil learning flow. It does not change the Firebase data model, Firestore rules or Storage rules from V1.3.

## What changed

- Pupils now begin with a completely blank project: 0 fields, 0 records, 0 components and 0 blocks.
- The old Scottish Places / Animal Facts / Music starter projects are no longer offered to pupils.
- A guided tutorial sits above the builder and checks the pupil's own work as they progress.
- Tutorial stages cover: naming the app/table, fields, records, screen design, connecting data, button/event blocks and testing.
- Pupils can hide/show the tutorial at any time.
- The Data page now lets pupils name their own app and database table.
- A record cannot be added until at least one field exists.
- Teacher assignments always start from a blank canvas.
- Teachers choose either Guided tutorial or Checklist only for a new assignment.
- Legacy V1.3 demo projects with the old built-in demo IDs are ignored when a pupil has no genuine project in that class.
- Clear project now clears back to a blank canvas rather than restoring an example app.

## Upgrade an already-connected GitHub site

Because your Firebase project is already connected, the safest update is:

1. Keep your existing configured `firebase-config.js` exactly as it is.
2. In GitHub replace the root `app.js` with the V1.4 `app.js`.
3. Replace the root `styles.css` with the V1.4 `styles.css`.
4. Commit the changes.
5. Wait for GitHub Pages to deploy.
6. Hard-refresh the site with `Ctrl + Shift + R`.

No Firebase console rule changes are required for this V1.4 update.

## Expected pupil first screen

After joining a class, a pupil with no genuine saved project should see **Blank canvas** and **Start tutorial**. Opening it should show an empty database and tutorial Step 1.
