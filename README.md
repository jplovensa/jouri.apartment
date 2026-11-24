# Jouri Apartment Renovation Control Tower

Private Three.js coordination model based on Interiola’s 16 October 2026 as-built drawing and the SECHA Studio+ minor works estimate SCH-MW-01/02. The model shows all seven zones. Furniture is simplified for coordination. The attached render sheets in the room panel are the original design references.

The closet uses the SD-01 rack position and a proposed 750 mm rail-to-rack gap. The left rail run is 757 mm, 693 mm shorter than the shop drawing. The plan shows 650 mm standing depth after a 100 mm allowance for clothing. Verify clearances on site and approve the revised set-out before fabrication.

The work register requires signed-in Site access and its DB binding. Positions are stored in metres in the apartment’s X/Z frame. Estimate pins are indicative. Editing an estimate pin stores an override in D1. Newly placed pins and edits persist across sessions. The browser uses optimistic revision checks so simultaneous edits cannot silently overwrite one another.

```sh
npm ci
node --test
npm run build:portal
```

Publish `dist/server/index.js` as the Site Worker. The D1 schema lives under `drizzle/`.

GitHub Pages runs `npm run build:pages`. It serves the apartment viewer and render references and links to the private work register. The Pages build has no database, account session or saved project records. To publish a separate control tower, configure the destination site ID and the logical D1 binding `DB` in `.openai/hosting.json`.
