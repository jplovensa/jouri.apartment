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

## Bed asset and facade openings

The main bed uses the [Innerscene CC0 queen bedding model](https://www.innerscene.com/tools/library/3d-parts/queen-bed-with-bedding-original-interior-furnishing-ea3bae95) for the fitted mattress, duvet and shams. It was resized and recoloured to fit the Interiola-style platform. The complete adapted bed is downloadable from the main-bedroom panel as `main-bed.glb`. The vendor GLB is retained under `assets/vendor` for reproduction.

The living and main-bedroom window positions follow the Interiola plan. Sill and head elevations are visually estimated. The main entrance follows the opening at the dining return, with provisional leaf and hardware geometry. The two-seat sofa replaces the previous low cabinet in front of the guestroom and leaves the P2 door clear.
