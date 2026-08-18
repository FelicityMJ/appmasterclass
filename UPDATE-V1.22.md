# Update to DataApp Studio V1.22

V1.22 fixes long teacher dialogs, especially **Create an assignment**.

## What changed

- The modal has a viewport-aware maximum height and its own vertical scrolling.
- Scrolling works with mouse wheel, trackpad and touch.
- The page behind the dialog stays fixed.
- Create/Cancel actions remain reachable at the bottom of the assignment dialog.
- The **Extra instructions for this class** textarea now fills the available width and can be resized vertically.

## Update from V1.21

Replace these files:

- `app.js`
- `styles.css`

`firebase-config.js` is not included. No Firestore or Storage rules need republishing.

After uploading, hard refresh DataApp Studio with **Ctrl + Shift + R**.
