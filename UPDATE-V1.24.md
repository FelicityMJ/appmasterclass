# Update to DataApp Studio V1.24

V1.24 makes Connected Apps much more intuitive for beginners and adds staged assignment release.

## Connected API fields in Design

At Level 5, pupils no longer need a Blockly `set ... to API result ...` block for every value they want to display.

- Select a **Label**, **Scrollable text box** or **Image**.
- Choose **Content source → Connected API**.
- Choose the API field to display.
- The component updates automatically after the Search/API request runs.

Blockly is still available for advanced/manual wiring, but the beginner route is now visual.

## Universal List component

The component formerly described as Database List is now simply **List**.

Its **Data source** can be:

- **My database**, or
- **Connected API** at Level 5.

The same Image / Title / Subtitle field mapping works for both sources. New Lists created in Level 5 default to the chosen API with sensible fields selected.

**Book Search** now returns several matching rows (up to 12), so a search can fill a List directly. Weather and Pokédex return one primary result and can still be displayed as one List row or via individual components.

When a pupil taps an API List row, that row becomes the current live result. A Details page whose components are bound to API fields will therefore show the tapped result automatically.

## Assignment release to selected pupils

When creating an assignment, teachers now choose:

- **Whole class**, or
- **Selected pupils only**.

For Selected pupils, the teacher ticks the pupils who are ready. The teacher dashboard shows the assignment audience and includes **Manage pupils**. More pupils can be added to the same assignment later; there is no need to create another copy of the assignment.

Existing V1.23 and older assignments default to Whole class.

## Updating

Replace these files from the V1.24 update ZIP:

- `app.js`
- `api-connectors.js`
- `public-app.js`
- `styles.css`
- `sw.js`
- `README.md`
- `UPDATE-V1.24.md`

Do **not** replace `firebase-config.js`.

There are **no Firestore or Storage rule changes** in V1.24.

After upload, hard refresh the builder with **Ctrl + Shift + R**. Republish an installed app and fully close/reopen it once so the V1.24 service-worker cache is used.
