# Jouri Apartment Renovation Control Tower

The GitHub Pages viewer rebuilds Interiola’s 16 October 2026 apartment set in Three.js. The kitchen, social rooms, bedroom, working room and bathroom use custom Blender meshes exported as five GLB packs. Room references display the original design sheets, including the P1 ribbed WIC door and P2 shelf-paneled concealed door. These doors are depicted closed. The meshes are reconstructions from the drawings and perspective renders. Bedding uses sculpted drapes, padded shams and stitched seams. Wood, fabric, stone, tile, brass, glass and paint use distinct surface responses. Finishes and heights outside the measured walk-in closet are visual approximations. Select a room and choose **Interior view** for an eye-level perspective.

Use **With walls** or **Without walls** to switch wall visibility. The painted walls use an on-screen approximation of Jotun 0471 Light Antique. The closet plan preserves the proposed 550 mm rail-to-rack gap and 450 mm of standing depth after a 100 mm clothing allowance. Verify the revised 957 mm left run and actual garment clearance on site.

The register starts with 13 indicative scope pins from the SECHA Studio+ minor works estimate SCH-MW-01/02. The status board, schedule and room progress views share the same work records. Room, status and search filters also update the map. Existing pins can be moved and saved in a new location. Export the filtered register or a one-page status card with a vector pin diagram and an Interiola image. An individual pin has its own printable card. Work is stored in the current browser. JSON transfer passes updates between devices without publishing them to GitHub.

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
