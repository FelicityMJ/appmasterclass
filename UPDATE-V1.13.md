# Update to DataApp Studio V1.13

V1.13 fixes list-background transparency across the builder and finished app.

## What changed

- In **Design**, select a Database List and choose **List background → White** or **Transparent**.
- Transparent is now a first-class saved property rather than relying only on the older checkbox flag.
- Design, Test and published Android/PWA rendering all read the same setting.
- Existing V1.12 projects are migrated automatically.

## Updating from V1.12

Replace `app.js`, `styles.css`, `public-app.js`, `published.css` and `sw.js`. You may also upload the updated README/update guide.

Do **not** replace your working `firebase-config.js`. No Firestore or Storage rule change is required.

After GitHub Pages redeploys, hard-refresh the builder. Open the List in Design, choose the desired background, then use **Update published app** for an already-published app. Fully close and reopen an installed Android app once so the new service-worker cache is used.
