# DataApp Studio V1.5 update guide

V1.5 adds **real Blockly** visual programming and **real Publish → QR → Android PWA installation**.

## Keep your existing Firebase configuration

If V1.4 is already connected and Google sign-in/classes are working, **keep your current `firebase-config.js`**. Do not replace it with the blank example from this ZIP.

## Replace/add these GitHub files

Replace:

- `index.html`
- `app.js`
- `styles.css`
- `firebase-service.js`
- `firestore.rules`
- `storage.rules`
- `README.md`
- `SETUP-FIREBASE.md`

Add:

- `blockly-integration.js`
- `published.html`
- `published.css`
- `public-app.js`
- `sw.js`
- `UPDATE-V1.5.md`

`firebase.json` may also be replaced with the V1.5 copy; its structure is compatible with the previous build.

## IMPORTANT — publish the new Firebase rules

V1.5 needs new rules because published apps use a new `publishedApps` collection and two install-icon files.

1. Firebase Console → **Firestore Database → Rules**.
2. Replace the rules with this ZIP's complete `firestore.rules`.
3. Click **Publish**.
4. Firebase Console → **Storage → Rules**.
5. Replace the rules with this ZIP's complete `storage.rules`.
6. Click **Publish**.

Do this before testing Publish.

## Blockly

The Blocks tab now uses the real Blockly editor rather than the earlier HTML imitation. The static GitHub Pages build loads a pinned Blockly script (v13.2.1) using the script-tag approach documented by Blockly.

Pupil projects store Blockly's JSON workspace state in the existing Firestore project document. A small compiler also turns the Blockly stacks into DataApp Studio's runtime instructions so the Test and Published App views can execute them.

Existing V1.4 block programs are automatically rebuilt as Blockly stacks the first time the pupil opens the Blocks tab.

## Publishing test

Use a fictional pupil first.

1. Build a small database with at least two records.
2. Add a label/image/button to the screen.
3. Build Blockly stacks and confirm **Test** works.
4. Open **Publish**.
5. Choose an app icon.
6. Press **Publish app**.
7. Confirm a QR code and unique public URL appear.
8. Scan the QR on Android.
9. Open the link in Chrome.
10. Tap **Install app**. If Chrome does not show the native prompt immediately, use Chrome's `⋮` menu → **Install app** / **Add to Home screen**.
11. Confirm the chosen icon/name appear on the Android home screen/app launcher.

The public URL opens an **unlisted snapshot**, not the pupil's editable classroom project. Firestore listing of published apps is denied; someone must know the random public ID/link.

## Republish and unpublish

- **Update published app** writes a fresh snapshot to the same public link.
- **Unpublish** switches the public document off; the QR link stops loading until the pupil publishes again.

## GitHub Pages requirement

PWA installation requires HTTPS. GitHub Pages supplies HTTPS, so keep **Enforce HTTPS** enabled.
