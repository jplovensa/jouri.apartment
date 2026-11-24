import * as THREE from 'three';
import plan from './plan.json' with { type: 'json' };
import { CLOSET, makeWardrobe } from './wardrobe.js';

export const ROOMS = {
  master: { name: 'Main bedroom', color: '#c89c77', label: [1.80, 1.83] },
  bath: { name: 'Bathroom', color: '#ced5cf', label: [4.34, 1.62] },
  kitchen: { name: 'Kitchen', color: '#e8dfcf', label: [4.87, 3.02] },
  dining: { name: 'Dining area', color: '#e8dfcf', label: [5.02, 4.72] },
  living: { name: 'Living area', color: '#e8dfcf', label: [2.02, 5.56] },
  work: { name: 'Working room', color: '#c89c77', label: [2.38, 9.24] },
  wic: { name: 'Walk-in closet', color: '#e8dfcf', label: [5.05, 9.30] },
};

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: .88 });
const wallSurface = material('#f3f0e6');
const wallCap = material('#dedbd1');
const slabEdge = material('#8e8980');
const selected = new THREE.Color('#adc2a4');

function box(w, h, d, x, y, z, surface) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surface);
  mesh.position.set(x, y, z);
  return mesh;
}

function floor(points, surface) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const extrusion = new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: false, steps: 1 });
  const mesh = new THREE.Mesh(extrusion, [surface, slabEdge]);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -.09;
  return mesh;
}

function addWall(group, [x1, z1, x2, z2], height = .43) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  const wall = box(length, height, .13, (x1 + x2) / 2, height / 2, (z1 + z2) / 2,
    [wallSurface, wallSurface, wallCap, wallSurface, wallSurface, wallSurface]);
  wall.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  group.add(wall);
}

function addFixtures(group) {
  const base = material('#ada396');
  const counter = material('#f8f4e9');
  const dark = material('#353931');
  const steel = material('#7b8580');
  const white = material('#f8f9f4');
  const add = (...args) => group.add(box(...args));
  add(.57, .84, 3.22, 5.88, .42, 3.90, base);
  add(.60, .048, 3.27, 5.88, .864, 3.90, counter);
  add(.39, .018, .48, 5.88, .895, 2.64, steel);
  add(.29, .012, .32, 5.88, .905, 2.66, dark);
  add(.40, .02, .55, 5.88, .895, 3.43, dark);
  add(.038, .14, .038, 6.10, .95, 2.65, steel);
  add(.59, .13, .53, 5.34, .065, 1.01, white);
}

export function makeApartment() {
  const root = new THREE.Group();
  const shell = new THREE.Group();
  const fixtures = new THREE.Group();
  const closet = makeWardrobe(box, plan.wardrobe, material);
  const closetShell = new THREE.Group();
  const { width, depth } = CLOSET;

  for (const segment of [[0, 0, width, 0], [0, 0, 0, depth], [width, 0, width, depth]]) {
    addWall(closetShell, segment, .29);
  }
  closetShell.position.copy(closet.position);
  closetShell.rotation.copy(closet.rotation);
  const floors = new Map();
  for (const { id, points } of plan.zones) {
    const room = ROOMS[id];
    const exactPoints = id === 'wic'
      ? points.map(([x, z]) => [x, z === 7.978 ? plan.wardrobe.z - depth : z])
      : points;
    const mesh = floor(exactPoints, material(room.color));
    mesh.userData.room = id;
    shell.add(mesh);
    floors.set(id, mesh);
  }
  const recessSurface = material('#b49a7d');
  for (const points of plan.recesses) shell.add(floor(points, recessSurface));
  // Original trace retains the short entrance pocket. Its wall lengths are approximate.
  for (const wall of plan.walls) addWall(shell, wall);
  addFixtures(fixtures);
  root.add(shell, fixtures, closet, closetShell);
  closetShell.visible = false;
  const overviewBounds = new THREE.Box3().setFromObject(root);
  const detailBounds = new THREE.Box3(
    new THREE.Vector3(plan.wardrobe.x - width - .15, 0, plan.wardrobe.z - depth - .12),
    new THREE.Vector3(plan.wardrobe.x + .15, CLOSET.height, plan.wardrobe.z + .12),
  );
  const detailFloor = floor([[0, 0], [width, 0], [width, depth], [0, depth]], material(ROOMS.wic.color));
  const detailFloorGroup = new THREE.Group();
  detailFloorGroup.position.copy(closet.position);
  detailFloorGroup.rotation.copy(closet.rotation);
  detailFloorGroup.add(detailFloor);
  detailFloorGroup.visible = false;
  root.add(detailFloorGroup);
  return {
    root, floors, overviewBounds, detailBounds,
    focusCloset(isDetail) {
      shell.visible = fixtures.visible = !isDetail;
      closetShell.visible = detailFloorGroup.visible = isDetail;
    },
    highlight(id) {
      for (const [key, mesh] of floors) {
        mesh.material[0].color.set(ROOMS[key].color);
        if (key === id) mesh.material[0].color.lerp(selected, .72);
      }
    },
  };
}
