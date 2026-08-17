# Update to DataApp Studio V1.7

V1.7 adds the pupil **My Apps** library. It does not change the Firestore or Storage security model used by V1.6.

## If V1.6 is already live
Replace these root files:

- `app.js`
- `firebase-service.js`
- `styles.css`
- `README.md` (optional documentation)

Keep your existing `firebase-config.js`. No rules change is required from V1.6.

## What pupils get
- Up to 30 apps per class.
- New App, Open, Rename, Duplicate and Delete.
- Draft/Published status.
- Starting an assignment creates another blank app rather than replacing anything.
- Their 20-image quota is still shared across their whole account, so an uploaded image can be reused in many apps.

Existing V1.6 projects remain in the `projects` collection and automatically appear in My Apps.
