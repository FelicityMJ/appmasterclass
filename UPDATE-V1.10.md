# Update DataApp Studio V1.9 → V1.10

V1.10 is a bug-fix release for the Design inspector, component movement and first-time Android publishing.

## Replace in GitHub

Replace these files in the repository root:

- `app.js`
- `styles.css`
- `firebase-service.js`

You may also upload the updated `README.md` and this `UPDATE-V1.10.md`.

**Do not replace your working `firebase-config.js`.** It is intentionally omitted from the update ZIP.

## Firebase rules

There is no new V1.10 rule schema. If you already published the V1.5-or-later `publishedApps` rules, you do not need to change Firestore or Storage rules.

If Publish still says `permission-denied` after V1.10 is live, compare/publish the supplied current `firestore.rules` and `storage.rules` in Firebase Console.

## What changed

1. Property inputs no longer re-render the full Design tab on every keystroke, so typing `Welcome` does not lose focus after `W`.
2. Selected components have a purple move grip above them. Drag the grip to move a List; drag its four corner squares to resize it.
3. First-time Publish no longer tries to read a random unpublished Firestore document before creating it. That read was correctly denied by the privacy rules and caused the misleading Firebase-blocked alert.

After GitHub Pages deploys, hard-refresh with `Ctrl + Shift + R` and confirm the login screen says **V1.10 classroom**.
