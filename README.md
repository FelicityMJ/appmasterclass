# DataApp Studio — classroom V1.2

Temporary working name. This is a working static prototype for a child-friendly database + app builder aimed at roughly age 12–13.

## Pupil workflow

1. **DATA** — create/edit fields and records in a simple database table.
2. **DESIGN** — add labels, images, buttons, text boxes and lists to a phone/tablet screen.
3. **BLOCKS** — use a deliberately tiny Scratch-like block set for events, database navigation and displaying fields.
4. **TEST** — run the app in a device preview and read a friendly debugger.
5. **PUBLISH** — choose the future installed app name, orientation and app icon.

## New in V1.2 — managed images

- Each pupil has **20 personal image slots** shared across their local projects.
- Reusing one personal image many times does **not** use extra slots.
- Pupil uploads are resized in the browser before storage:
  - maximum dimension: 800 px
  - WebP output
  - target: about 80 KB or less
- The 21st personal upload is blocked.
- **My Images** shows the quota and the current-project usage count.
- Deleting an image being used in the current project shows a warning and removes those references if confirmed.
- Shared **Image Bank** images do not use a pupil slot.
- A starter Image Bank is included.
- Teacher demo dashboard has **Manage Image Bank** and can add compressed shared images.
- Image fields and Image components use the same safe picker; pupils no longer need to paste arbitrary image URLs.
- Publish has an app-icon picker. Uploading a separate app icon does **not** consume a personal-image slot.

## Other V1.1/V1.2 features

- Teacher dashboard and assignment templates.
- Pupil dashboard and starter projects.
- Readiness badges: Data, Design, Events, Connected.
- **Connect Data** guided wizard that creates display blocks automatically.
- Phone / large phone / tablet preview switch.
- Move visual blocks up/down.
- LocalStorage persistence so the teaching UI can be tested before Firebase is configured.
- Firebase-ready Auth/Firestore service layer.
- Firestore and Storage starter security rules.

## Important prototype note

The local demo stores compressed personal/shared images in browser storage. That is useful for testing, but the production school version should store image bytes in Firebase Storage and only keep image metadata/references in Firestore.

The **Publish** screen currently saves and previews the app identity (name/icon/orientation). The production hosted version still needs the project-specific publishing route that serves each pupil app, its manifest, QR/share link and installable Android PWA identity.

## Run locally

Serve the folder rather than double-clicking `index.html`:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Connect Firebase

See `SETUP-FIREBASE.md`.

## Files

- `index.html` — app shell.
- `styles.css` — responsive classroom UI.
- `app.js` — prototype application including media compression/quota logic.
- `firebase-config.js` — disabled config placeholder.
- `firebase-service.js` — optional Firebase Auth/Firestore adapter.
- `firestore.rules` — classroom/project/media metadata rules.
- `storage.rules` — image type/size/ownership guardrails.
- `firebase.json` — Firebase Hosting/Firestore/Storage config.
