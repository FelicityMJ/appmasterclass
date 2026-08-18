# Update to DataApp Studio V1.25

V1.25 makes the Pokédex connector useful for both single-result detail apps and multi-row List apps.

## Pokédex search now has two beginner-friendly behaviours

The same Pokédex search box accepts:

- a **Pokémon name or Pokédex number** (for example `pikachu` or `25`) → returns one Pokémon;
- a **Pokémon type** (for example `electric`, `fire`, `water`, `grass`) → returns up to 12 Pokémon for a List;
- **`all`** → returns a starter browse list of 12 Pokémon.

This means a pupil can deliberately choose whether they are building a single-result app or a browse/list app without learning a second API connector.

Examples:

- `pikachu` → one row: Pikachu;
- `electric` → several Electric-type Pokémon rows;
- `all` → several Pokémon rows.

The returned rows use exactly the same API fields already available in Design: Artwork image, Name, Pokédex number, Type(s), Height and Weight.

## Updating

Replace these files from the V1.25 update ZIP:

- `app.js`
- `api-connectors.js`
- `sw.js`
- `README.md`
- `UPDATE-V1.25.md`

Do **not** replace `firebase-config.js`.

There are **no Firebase rule changes** in V1.25.
