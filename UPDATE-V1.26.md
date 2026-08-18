# Update to DataApp Studio V1.26

V1.26 fixes the beginner Connected App workflow.

## What changed

- A successful request in **Connect** now saves the query, primary result and up to 12 returned rows with the project.
- **Design** uses that saved API result even after the page/browser reloads.
- **Test** begins with the same saved API result/rows, so API Lists no longer appear empty just because Test started.
- **Restart Test** restores the saved Connect result.
- The Blocks help now recognises a two-page API List → Details app and tells pupils exactly what to build on each page.
- On the List page the key recipe is: `when an item in [List] is tapped → go to [Details page]`.
- The tapped API row automatically becomes the current live result; pupils do not need blocks to copy each field to the Details page.
- On the Details page, placeholders are connected visually in Design to API fields.

## One-time note for existing V1.25 projects

V1.25 did not save the actual test response. After installing V1.26, open **Connect** and press **Test request** once more for an existing Connected App. From then on the result is remembered across Design and Test.

## Files to replace

- `app.js`
- `styles.css`
- `sw.js`
- `README.md`
- `UPDATE-V1.26.md`

There are **no Firebase rule changes** in V1.26. The update ZIP does not include `firebase-config.js`.
