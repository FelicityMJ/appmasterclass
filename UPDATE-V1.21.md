# Update to DataApp Studio V1.21

V1.21 adds **project briefs for every capability level** and **Level 5 — Connected App**.

## Project briefs

Each level now gives pupils a real app challenge, a user journey, the skills they are practising, and success criteria:

1. **Collection Explorer** — two-page List → Details database app.
2. **Pet Match** — inputs + IF / ELSE used to make a recommendation.
3. **My Review Tracker** — form inputs that add/edit/delete app data.
4. **Eco Challenge** — variables and counters used as a live score.
5. **Live Info Finder** — a real API search that turns JSON results into a phone interface.

Teachers see the recommended brief while creating an assignment and can add extra class-specific instructions. Pupils can expand the brief from their assignment card and it stays at the top of the builder.

## Level 5 — Connected App

Level 5 adds a **Connect** tab and a **Web / API** Blockly category. Levels 1–4 are unchanged and do not see these tools.

Curated connectors included:

- **Live Weather** — Open-Meteo
- **Book Search** — Open Library
- **Pokédex** — PokéAPI

The Connect tab lets pupils test a request before coding and shows both friendly fields and an expandable JSON result.

New Blockly blocks:

- `ask [selected API] using [input]`
- `set [component] to API result [field]`
- `if last API request worked ... else ...`

Image URL results can be placed directly into an Image component. Requests also work in published phone apps.

## Updating from V1.20

Replace these files:

- `app.js`
- `blockly-integration.js`
- `api-connectors.js` **(new)**
- `public-app.js`
- `styles.css`
- `sw.js`
- `README.md`

Then hard refresh DataApp Studio. Fully close/reopen an already-installed published app once so the V1.21 service-worker cache can update.

**No Firebase rules need republishing for V1.21.**
