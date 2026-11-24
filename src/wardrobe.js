import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const CLOSET = { width: 2.022, depth: 2.157, height: 2.61 };
const RAIL = { offset: .300, leftRun: .957, rearRun: .750, profile: .026 };
const RACK = { width: 1.216, depth: .350 };
export const RAIL_END = RAIL.offset + RAIL.leftRun;
export const RACK_FRONT = CLOSET.depth - RACK.depth;
export const RAIL_CLEARANCE_MM = Math.round((RACK_FRONT - RAIL_END) * 1000);
export const GARMENT_ALLOWANCE_MM = 100;
export const STANDING_DEPTH_MM = RAIL_CLEARANCE_MM - GARMENT_ALLOWANCE_MM;
export const JOINERY = [
  ['H01 · Double L rail', 'Left wall and rear return. Proposed left run 957 mm, rear return 750 mm. Rail levels at 1,050 and 2,000 mm above floor.'],
  ['C01 · Four-drawer cabinet', 'Rear right. 900 × 400 × 900 mm.'],
  ['S01 · Open shoe rack', 'Left of the entrance. 1,216 × 350 × 2,610 mm. Nine levels per column.'],
];

export function makeWardrobeMirror(placement) {
  const { width, depth, height } = CLOSET;
  const wall = new THREE.Group();
  wall.name = 'Full-height wardrobe mirror';
  wall.position.set(placement.x, 0, placement.z);
  wall.rotation.y = placement.rotation;

  const glass = new THREE.PlaneGeometry(depth - .006, height - .006);
  const silver = new THREE.Mesh(glass, new THREE.MeshStandardMaterial({
    color: '#b9c5c8', metalness: .92, roughness: .17,
  }));
  const reflection = new Reflector(glass, {
    color: 0xb9bcbf, textureWidth: 640, textureHeight: 640, multisample: 0, clipBias: .001,
  });

  for (const surface of [silver, reflection]) {
    surface.position.set(width - .016, height / 2, depth / 2);
    surface.rotation.y = -Math.PI / 2;
    wall.add(surface);
  }
  return {
    wall,
    show(visible, live) {
      wall.visible = visible;
      silver.visible = !live;
      reflection.visible = live;
    },
  };
}

export function makeWardrobe(box, placement, material) {
  const root = new THREE.Group();
  root.position.set(placement.x, 0, placement.z);
  root.rotation.y = placement.rotation;
  const { width, depth, height } = CLOSET;
  const teak = material('#9c694a');
  teak.name = 'Closet teak';
  teak.roughness = .48;
  const edge = material('#724830');
  const steel = material('#272a26');
  steel.metalness = .46;
  steel.roughness = .38;
  const rails = new THREE.Group();
  const drawers = new THREE.Group();
  const rack = new THREE.Group();
  rails.name = 'H01';
  drawers.name = 'C01';
  rack.name = 'S01';
  root.add(rails, drawers, rack);
  const addTo = (group, bevel = 0) => (w, h, d, x, y, z, surface = teak) => {
    const mesh = bevel
      ? new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w / 4, h / 4, d / 4, bevel)), surface)
      : box(w, h, d, x, y, z, surface);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const addRail = addTo(rails);
  const addDrawer = addTo(drawers, .006);
  const addRack = addTo(rack, .003);

  for (const y of [1.05, 2]) {
    const { offset, leftRun, rearRun, profile } = RAIL;
    // Square-cut ends: the front tip stops at the revised set-out and the rear return meets the left rail.
    const halfProfile = profile / 2;
    addRail(profile, profile, leftRun + halfProfile, offset, y,
      (offset - halfProfile + RAIL_END) / 2, steel);
    addRail(rearRun - halfProfile, profile, profile,
      offset + (rearRun + halfProfile) / 2, y, offset, steel);
    for (const z of [.355, .75, 1.16]) addRail(offset - halfProfile, .022, .022,
      (offset - halfProfile) / 2, y, z, steel);
    addRail(.022, .022, offset - halfProfile, 1.01, y, (offset - halfProfile) / 2, steel);
  }

  const drawerX = width - .45;
  addDrawer(.9, .08, .37, drawerX, .04, .19, edge);
  addDrawer(.9, .82, .382, drawerX, .49, .191);
  for (let i = 0; i < 4; i++) {
    const y = .185 + i * .202;
    addDrawer(.896, .2, .018, drawerX, y, .391);
    addDrawer(.145, .011, .014, drawerX, y + .036, .414, steel);
    for (const x of [drawerX - .061, drawerX + .061]) {
      addDrawer(.017, .012, .020, x, y + .036, .407, steel);
    }
  }

  const { width: rackWidth, depth: rackDepth } = RACK;
  const rackFront = RACK_FRONT;
  const rackZ = rackFront + rackDepth / 2;
  const panel = .018;
  addRack(rackWidth, .08, rackDepth, rackWidth / 2, .04, rackZ, edge);
  addRack(rackWidth, .02, rackDepth, rackWidth / 2, height - .01, rackZ);
  addRack(rackWidth, 2.51, .009, rackWidth / 2, 1.335, depth - .0045, edge);
  const modules = [[.08, 1.4, 5], [1.48, 1.11, 4]];
  for (const [base, moduleHeight, levels] of modules) {
    for (const x of [panel / 2, rackWidth / 2, rackWidth - panel / 2]) {
      addRack(panel, moduleHeight, .341, x, base + moduleHeight / 2, rackFront + .341 / 2);
    }
    addRack(rackWidth - 2 * panel, panel, .341, rackWidth / 2, base + panel / 2, rackFront + .341 / 2);
    addRack(rackWidth - 2 * panel, panel, .341, rackWidth / 2, base + moduleHeight - panel / 2, rackFront + .341 / 2);
    const shelfWidth = (rackWidth - 3 * panel) / 2;
    for (let level = 1; level < levels; level++) {
      for (const x of [panel + shelfWidth / 2, rackWidth - panel - shelfWidth / 2]) {
        addRack(shelfWidth, panel, .33, x, base + level * moduleHeight / levels, rackFront + .165);
      }
    }
  }
  return root;
}
