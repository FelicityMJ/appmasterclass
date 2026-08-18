# Update to DataApp Studio V1.20

V1.20 introduces **progressive project capabilities**.

## Why this matters

A pupil completing the original two-page database List → Details project remains on **Level 1** and sees exactly the small component/block set needed for that task. Higher-level tools only appear inside projects/assignments that the teacher deliberately creates at a higher capability level.

## Capability levels now available

1. **Level 1 — Database Explorer** — labels, images, buttons, scrollable text display, Database List, selected-record display and navigation.
2. **Level 2 — Interactive App** — adds Text Input, Number Input, Dropdown, Switch/Toggle and Slider; Blockly adds input-change events, IF / ELSE comparisons, messages, show/hide and copying input values to text components.
3. **Level 3 — Data Creator** — adds form-to-database mapping plus add/update/delete record blocks.
4. **Level 4 — Smart App** — adds simple variables, counters and displaying variable values.

Existing projects and assignments without a capability value automatically stay on **Level 1**.

## Level 3 data behaviour

In Test, record changes happen on a temporary copy and never overwrite the pupil's saved design database. In a published app, data created/edited by the app user is stored locally in that browser/device, so each user's installed app has its own local data.

## Updating from V1.19

Replace these files:

- `app.js`
- `blockly-integration.js`
- `public-app.js`
- `styles.css`
- `published.css`
- `sw.js`
- `README.md`

Then hard refresh DataApp Studio. Installed/published apps should be fully closed and reopened once so the V1.20 service worker cache is used.

**No Firebase rules need republishing for V1.20.**
