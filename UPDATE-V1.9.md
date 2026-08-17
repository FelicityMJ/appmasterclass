# DataApp Studio V1.9 — update from V1.8

V1.9 is a front-end builder/runtime update. It does not change the Firebase collections or security model.

## Replace on GitHub

Replace these files from this update:

- `app.js`
- `blockly-integration.js`
- `styles.css`
- `public-app.js`
- `published.css`
- `sw.js`
- `README.md`
- `SETUP-FIREBASE.md`

Do **not** replace your working `firebase-config.js`.

## Firebase

No new Firestore or Storage rules are required when upgrading from V1.8.

## What pupils gain

- drag the four corner handles of a selected component to resize it;
- choose page background colours;
- choose button/background/text colours;
- edit Blockly page-by-page rather than seeing the whole app at once;
- create an **Image link (URL)** database field and paste a direct image URL;
- create a **Rating (1–10 stars)** field and choose a star rating visually.

Image-link fields do not consume one of the pupil's 20 uploaded-image slots because the image remains hosted at its original web address. The link must point directly to an image that the remote website allows browsers to display.

After GitHub Pages redeploys, hard-refresh with `Ctrl + Shift + R`. The login screen should show **V1.9 classroom**.
