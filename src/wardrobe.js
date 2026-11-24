import * as THREE from 'three';

export const CLOSET = { width: 2.022, depth: 2.157, height: 2.61 };
export const JOINERY = [
  ['H01 · Double L rail', 'Left wall and rear return. 1,450 + 750 mm at 1,050 and 2,000 mm above floor.'],
  ['C01 · Four-drawer cabinet', 'Rear right. 900 × 400 × 900 mm.'],
  ['S01 · Open shoe rack', 'Left of the entrance. 1,216 × 350 × 2,610 mm. Nine levels per column.'],
];

export function makeWardrobe(box, placement, material) {
  const root = new THREE.Group();
  root.position.set(placement.x, 0, placement.z);
  root.rotation.y = placement.rotation;
  const { width, depth, height } = CLOSET;
  const teak = material('#9c694a');
  const edge = material('#724830');
  const steel = material('#272a26');
  const add = (w, h, d, x, y, z, surface = teak) =>
    root.add(box(w, h, d, x, y, z, surface));

  for (const y of [1.05, 2]) {
    add(.026, .026, 1.45, .30, y, 1.025, steel);
    add(.75, .026, .026, .675, y, .3, steel);
    for (const z of [.355, 1.05, 1.67]) add(.30, .022, .022, .15, y, z, steel);
    add(.022, .022, .30, 1.01, y, .15, steel);
  }

  const drawerX = width - .45;
  add(.9, .08, .37, drawerX, .04, .19, edge);
  add(.9, .82, .382, drawerX, .49, .191);
  for (let i = 0; i < 4; i++) {
    const y = .185 + i * .202;
    add(.896, .2, .018, drawerX, y, .391);
    add(.155, .014, .022, drawerX, y + .036, .411, steel);
  }

  const rackWidth = 1.216;
  const rackDepth = .350;
  const rackFront = depth - rackDepth;
  const rackZ = rackFront + rackDepth / 2;
  const panel = .018;
  add(rackWidth, .08, rackDepth, rackWidth / 2, .04, rackZ, edge);
  add(rackWidth, .02, rackDepth, rackWidth / 2, height - .01, rackZ);
  add(rackWidth, 2.51, .009, rackWidth / 2, 1.335, depth - .0045, edge);
  const modules = [[.08, 1.4, 5], [1.48, 1.11, 4]];
  for (const [base, moduleHeight, levels] of modules) {
    for (const x of [panel / 2, rackWidth / 2, rackWidth - panel / 2]) {
      add(panel, moduleHeight, .341, x, base + moduleHeight / 2, rackFront + .341 / 2);
    }
    add(rackWidth - 2 * panel, panel, .341, rackWidth / 2, base + panel / 2, rackFront + .341 / 2);
    add(rackWidth - 2 * panel, panel, .341, rackWidth / 2, base + moduleHeight - panel / 2, rackFront + .341 / 2);
    const shelfWidth = (rackWidth - 3 * panel) / 2;
    for (let level = 1; level < levels; level++) {
      for (const x of [panel + shelfWidth / 2, rackWidth - panel - shelfWidth / 2]) {
        add(shelfWidth, panel, .33, x, base + level * moduleHeight / levels, rackFront + .165);
      }
    }
  }
  return root;
}
