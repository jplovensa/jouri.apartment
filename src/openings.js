import * as THREE from 'three';

// Set-out traced from Interiola layout sheet 4 and the dedicated bedroom plan.
// Vertical dimensions are model assumptions based on the room renders.
export const OPENINGS = [
  { id: 'W01 Main-bedroom window', room: 'master', x: .027, from: .65, to: 2.022, sill: .78, head: 2.25, bays: 2 },
  { id: 'W02 Living-room window', room: 'living', x: .027, from: 4.65, to: 6.55, sill: .76, head: 2.13, bays: 3 },
  { id: 'Working-room glazed balcony door', room: 'work', x: .902, from: 8.047, to: 8.793, sill: 0, head: 2.17, bays: 1, glazedDoor: true },
  { id: 'Working-room glazing over desk', room: 'work', x: .902, from: 8.793, to: 9.43, sill: .81, head: 2.17, bays: 1 },
  { id: 'Apartment entrance', room: 'dining', x: 5.779, from: 6.12, to: 7.10, sill: 0, head: 2.14 },
];

export function addPlanWall(group, segment, addWall, wallHeight) {
  const [x1, z1, x2, z2] = segment;
  const low = Math.min(z1, z2);
  const high = Math.max(z1, z2);
  const openings = OPENINGS.filter(({ x, from, to }) => x1 === x && x2 === x && from >= low && to <= high)
    .sort((a, b) => a.from - b.from);
  if (!openings.length) {
    addWall(group, segment, wallHeight);
    return;
  }
  let cursor = low;
  for (const { x, from, to, sill, head } of openings) {
    if (from > cursor) addWall(group, [x, cursor, x, from], wallHeight);
    if (sill > 0) addWall(group, [x, from, x, to], sill);
    if (head < wallHeight) addWall(group, [x, from, x, to], wallHeight - head, head);
    cursor = to;
  }
  if (cursor < high) addWall(group, [x1, cursor, x1, high], wallHeight);
}

export function makeOpenings(box) {
  const windows = new THREE.Group();
  const doors = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#e5e0d8', roughness: .40, metalness: .12 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#6f716e', roughness: .85 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#b8c8cf', metalness: .12, roughness: .14, opacity: .20, transparent: true,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const teak = new THREE.MeshStandardMaterial({ color: '#5b3325', roughness: .49, name: 'Entrance teak' });
  const brass = new THREE.MeshStandardMaterial({ color: '#af9b80', roughness: .31, metalness: .78 });

  for (const opening of OPENINGS) {
    const { id, x, from, to, sill, head, bays, glazedDoor } = opening;
    const assembly = new THREE.Group();
    assembly.name = id;
    assembly.position.set(x, 0, (from + to) / 2);
    assembly.rotation.y = Math.PI / 2;
    const host = bays ? windows : doors;
    host.add(assembly);
    const width = to - from;
    const height = head - sill;
    const add = (w, h, d, u, y, z, material) => assembly.add(box(w, h, d, u, y, z, material));
    const profile = bays ? .055 : .040;
    for (const side of [-1, 1]) add(profile, height, .106, side * (width - profile) / 2, (sill + head) / 2, 0, bays ? frame : teak);
    add(width - 2 * profile, profile, .106, 0, head - profile / 2, 0, bays ? frame : teak);
    if (bays) {
      add(width - 2 * profile, profile, .106, 0, sill + profile / 2, 0, frame);
      const pane = (width - 2 * profile) / bays;
      for (let i = 0; i < bays; i++) {
        const pos = -width / 2 + profile + pane * (i + .5);
        add(pane - .026, height - 2 * profile, .014, pos, (sill + head) / 2, 0, glass);
        if (i < bays - 1) add(.044, height - 2 * profile, .073, pos + pane / 2, (sill + head) / 2, 0, frame);
      }
      add(width - .004, .025, .137, 0, sill + .0125, .008, frame);
      add(width - .10, .011, .065, 0, sill + .054, .009, rubber);
      if (glazedDoor) {
        add(.020, .154, .024, width / 2 - .077, 1.04, .058, frame);
        add(.032, .013, .017, width / 2 - .077, 1.04, .077, rubber);
      }
    } else {
      add(width - 2 * profile - .009, height - profile - .018, .049, 0, height / 2 - .012, -.012, teak);
      add(width - 2 * profile, .018, .127, 0, .009, 0, brass);
      for (const side of [-1, 1]) {
        const face = -.012 + side * .029;
        add(.035, .138, .008, .325, .99, face, brass);
        add(.117, .017, .027, .281, 1.025, face + side * .019, brass);
      }
    }
  }
  return { windows, doors };
}
