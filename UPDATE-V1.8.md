# DataApp Studio V1.8 — update from V1.7

V1.8 changes Blockly support so pupils build their own blocks by default, while the teacher can enable automatic starter-block support for individual pupils.

## Replace these files in GitHub

- `app.js`
- `blockly-integration.js`
- `firebase-service.js`
- `styles.css`
- `README.md`

Keep your existing `firebase-config.js` exactly as it is.

## Firebase rules

No Firestore or Storage rule changes are required from V1.7. The existing V1.7 rules already allow the class owner to update a pupil member document, which is where `blockSupportMode` is stored.

## Teacher use

Open a class. In **Pupils & projects**, each pupil now has a **Block support** selector:

- **Tutorial — pupil builds blocks**: default; no Blockly is inserted by Design shortcuts.
- **Auto-add support blocks**: Design shortcuts may create starter Blockly for that pupil.

## Pupil use

For a Button, select it in Design and press **Tell [Button] what to do**. The Blocks tutorial shows how to drag `when Button clicked`, then snap an action such as `go to`, `go back`, `next record` or `set text` inside it.

For a List, the tutorial shows `when an item in List is tapped → go to Details`. The tapped row automatically becomes the selected record.

For Details placeholders, the tutorial shows `when Details opens → set component to field from selected record`.

After GitHub Pages redeploys, hard-refresh with `Ctrl + Shift + R`. The login screen should show **V1.8 classroom**.
