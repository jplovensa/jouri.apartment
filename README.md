# Jouri Apartment Renovation Control Tower

The GitHub Pages viewer rebuilds Interiola’s 16 October 2026 apartment set in Three.js. The kitchen, social rooms, bedroom, working room and bathroom use custom Blender meshes exported as four GLB packs. Room references display the original design sheets. The meshes are reconstructions from the drawings and perspective renders. Finishes and heights outside the measured walk-in closet are visual approximations.

Use **With walls** or **Without walls** to switch wall visibility. The painted walls use an on-screen approximation of Jotun 0471 Light Antique. The closet plan preserves the proposed 750 mm rail-to-rack gap and 650 mm standing-depth allowance. Verify the shortened 757 mm left run and actual garment clearance on site.

The register starts with 13 indicative scope pins from the SECHA Studio+ minor works estimate SCH-MW-01/02. The status board, schedule and room progress views share the same work records. Room, status and search filters also update the map. Existing pins can be moved and saved in a new location. Work is stored in the current browser. Export/import passes updates between people or devices without publishing them to GitHub.

## Development

```sh
npm ci
npm run dev
node --test
npm run build:pages
```

To regenerate the committed furniture assets with Blender 4.3+:

```sh
blender -b --factory-startup --python-exit-code 1 --python scripts/build-furniture.py
```

GitHub Actions builds and publishes the `dist/` folder to GitHub Pages after pushes to `main`.
