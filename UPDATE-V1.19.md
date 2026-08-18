# Update to DataApp Studio V1.19

V1.19 changes the published-app experience from Android-only wording to **Install on phone**.

## What changed

- The same QR code works on Android, iPhone and iPad.
- Android: scan/open in Chrome and use **Install app** / **Add to Home screen**.
- iPhone/iPad: open in Safari, tap **Share → Add to Home Screen → Add**.
- Published apps detect iOS and display the correct guidance.
- The pupil's chosen app icon is used as an Apple touch icon.
- Installed apps hide the install button.
- The PWA service-worker cache has been bumped so the new published runtime replaces older cached wording.

## Firebase

No Firestore or Storage rules change is required from V1.18.
