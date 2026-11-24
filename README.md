# Jouri Apartment

A Three.js coordination model of the Jouri apartment for SECHA Studio+. It opens in a cutaway view with seven selectable rooms, a top-down floor plan and a dedicated wardrobe detail.

## Run locally

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Run `npm run build` to generate a static, relative-path build in `dist/`. Use `npm run preview` to check that build.

## Drawing basis

- The shell is traced from the full apartment “Layout Desain”, page 4 of Interiola’s *Gambar Kerja Apartment Ms. Joury*. The in-app drawing register uses English room names.
- The walk-in closet uses SECHA Studio+ **SD-01**, 19 November 2026, sheets WIC-SD01–08. Facing into the closet, the double rail is on the left, the four-drawer cabinet is at the rear right, and the shoe rack sits on the inside of the entrance return with its shelves opening into the room.
- `src/plan.json` holds the traced polygons, wall segments and wardrobe transform in metres. `src/wardrobe.js` holds the measured main bay and joinery envelopes. The entrance pocket and other rooms remain approximate. Cutaway wall height, kitchen and bathroom fixtures, bracket appearance and finish colours are visual approximations.
- The existing mirror and optional A01–A03 shelves require confirmed set-out or scope. They are excluded from this initial model. SD-01 is for production review. Verify site dimensions before fabrication.
