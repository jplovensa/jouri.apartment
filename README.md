# Jouri Apartment Renovation Control Tower

Three.js coordination model based on Interiola’s 16 October 2026 as-built drawing and the SECHA Studio+ minor works estimate SCH-MW-01/02. The model shows all seven zones. Furniture is simplified for coordination. The attached render sheets in the room panel are the original design references.

The closet uses the SD-01 rack position and a proposed 750 mm rail-to-rack gap. The left rail run is 757 mm, 693 mm shorter than the shop drawing. The plan shows 650 mm standing depth after a 100 mm allowance for clothing. Verify clearances on site and approve the revised set-out before fabrication.

The optional server build uses signed-in Site access and a DB binding. The GitHub Pages build uses browser-local storage. Positions are stored in metres in the apartment’s X/Z frame. Estimate pins are indicative. Editing an estimate pin stores an override in D1. Newly placed pins and edits persist across sessions. The browser uses optimistic revision checks so simultaneous edits cannot silently overwrite one another.

```sh
npm ci
node --test
npm run build:portal
```

Publish `dist/server/index.js` as the Site Worker. The D1 schema lives under `drizzle/`.

GitHub Pages runs `npm run build:pages`. Its work register is stored locally in each browser and supports JSON export and import for handoff. Edits do not appear on other devices until imported. No project updates are written to this public repository by the browser.
