# Update DataApp Studio V1.11 → V1.12

V1.12 fixes two published-app presentation issues.

## Replace

- `app.js`
- `styles.css`
- `public-app.js`
- `published.css`

Do not replace your configured `firebase-config.js`. No Firestore or Storage rule change is required.

## Changes

- The selected page background colour now fills the entire real device viewport around/below the scaled 320×630 design canvas.
- Database Lists now have a **Transparent list background** checkbox in Design. When enabled, the list container and rows show the page background through them.
- The same transparent-list setting is preserved in Test and published Android/PWA apps.

After GitHub Pages deploys, hard-refresh the builder and use **Update published app** for an already-published app. If an installed PWA still shows the old cached appearance, fully close and reopen it once after updating.
