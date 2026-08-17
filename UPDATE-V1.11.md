# Update DataApp Studio V1.10 → V1.11

V1.11 fixes the published Android/PWA presentation and launch experience.

## Replace in GitHub

Replace:

- `app.js`
- `public-app.js`
- `published.css`
- `sw.js`

Add:

- `public-host.js`

You may also upload the updated `README.md` and this `UPDATE-V1.11.md`.

Do **not** replace your configured `firebase-config.js`.

No Firestore or Storage rule changes are required from V1.10.

## What V1.11 fixes

- published apps use the same 320×630 logical phone canvas as the builder and scale that canvas to the real phone screen, keeping positions and proportions consistent;
- label alignment now matches the builder, including centred/right-aligned labels;
- published-only debug messages such as `Home · Record 1` and `Label updated from database` are removed;
- an already-opened/installed app renders its cached published snapshot immediately instead of waiting for the service worker and Firestore before showing the screen;
- service-worker/manifest preparation now happens in the background, reducing the time spent on the Android launch splash;
- the PWA splash background follows the first page background colour;
- QR links can use a separate branded/Firebase Hosting origin through `public-host.js`.

## Hiding the GitHub address in QR/install links

By default `public-host.js` is blank, so links use the same origin as the builder.

To stop pupil QR codes exposing `felicitymj.github.io`, deploy the site (or at minimum the published runtime files) to Firebase Hosting, then edit:

```js
export const publicAppBaseUrl = '';
```

to something such as:

```js
export const publicAppBaseUrl = 'https://YOUR-PROJECT-ID.web.app/';
```

For the final product, a custom domain on Firebase Hosting is cleaner again, for example `https://apps.yourdomain.com/`.

Existing published apps keep the same public ID. When the pupil returns to Publish, the regenerated QR/link uses the new host without needing a new app database record.
