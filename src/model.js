import * as THREE from 'three';
import plan from './plan.json' with { type: 'json' };
import { floorFinish, paintFinish, finishFurniture } from './surfaces.js';
import { loadFurnishings } from './furnishings.js';
import { CLOSET, GARMENT_ALLOWANCE_MM, RACK_FRONT, RAIL_END, makeWardrobe } from './wardrobe.js';

export const APARTMENT_PLAN = plan;

export const ROOMS = {
  master: { name: 'Main bedroom', color: '#9a7b64', label: [1.80, 1.83] },
  bath: { name: 'Bathroom', color: '#bdb4aa', label: [4.34, 1.62] },
  kitchen: { name: 'Kitchen', color: '#bbb1a6', label: [4.87, 3.02] },
  dining: { name: 'Dining area', color: '#bbb1a6', label: [5.02, 4.72] },
  living: { name: 'Living area', color: '#bbb1a6', label: [2.02, 5.56] },
  work: { name: 'Working room', color: '#9a7b64', label: [2.38, 9.24] },
  wic: { name: 'Walk-in closet', color: '#bbb1a6', label: [5.05, 9.30] },
};

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: .88 });
// Jotun 0471 Light Antique. The material is an on-screen approximation.
const wallSurface = material('#eae2da');
const wallCap = material('#eae2da');
const ceilingPaint = material('#f1ede7');
const skirtingPaint = material('#ded8cd');
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

function addWall(group, [x1, z1, x2, z2], height = CLOSET.height) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  const wall = box(length, height, .13, (x1 + x2) / 2, height / 2, (z1 + z2) / 2,
    [wallSurface, wallSurface, wallCap, wallSurface, wallSurface, wallSurface]);
  wall.receiveShadow = true;
  wall.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  group.add(wall);
  const skirting = box(length, .060, .151, wall.position.x, .03, wall.position.z, skirtingPaint);
  skirting.rotation.y = wall.rotation.y;
  skirting.receiveShadow = true;
  group.add(skirting);
}

export function makeApartment() {
  const root = new THREE.Group();
  const shell = new THREE.Group();
  const fixtures = new THREE.Group();
  let furnitureFocus;
  const ceilings = new Map();
  const fixturePacks = { master: 'bedroom', work: 'work', bath: 'bath', living: 'social', kitchen: 'social', dining: 'social' };
  const walls = new THREE.Group();
  const closet = makeWardrobe(box, plan.wardrobe, material);
  paintFinish(wallSurface);
  closet.traverse((item) => {
    if (item.isMesh) finishFurniture(item.material);
  });
  const closetShell = new THREE.Group();
  const clearance = new THREE.Group();
  const guideHeight = 2.64;
  const guideMaterial = new THREE.LineBasicMaterial({ color: '#3b7360' });
  const guidePoints = [
    [.3, RAIL_END, .54, RAIL_END],
    [.3, RACK_FRONT, .54, RACK_FRONT],
    [.49, RAIL_END, .49, RACK_FRONT],
  ].flatMap(([x1, z1, x2, z2]) => [new THREE.Vector3(x1, guideHeight, z1), new THREE.Vector3(x2, guideHeight, z2)]);
  clearance.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(guidePoints), guideMaterial));
  const standingStart = RAIL_END + GARMENT_ALLOWANCE_MM / 1000;
  const standing = new THREE.Mesh(
    new THREE.PlaneGeometry(1.216, RACK_FRONT - standingStart),
    new THREE.MeshBasicMaterial({ color: '#84a28b', transparent: true, opacity: .45, depthWrite: false }),
  );
  standing.rotation.x = -Math.PI / 2;
  standing.position.set(.608, .013, (standingStart + RACK_FRONT) / 2);
  clearance.add(standing);
  clearance.position.copy(closet.position);
  clearance.rotation.copy(closet.rotation);
  clearance.visible = false;
  const { width, depth } = CLOSET;

  for (const segment of [[0, 0, width, 0], [0, 0, 0, depth], [width, 0, width, depth]]) {
    addWall(closetShell, segment);
  }
  closetShell.position.copy(closet.position);
  closetShell.rotation.copy(closet.rotation);
  const floors = new Map();
  for (const { id, points } of plan.zones) {
    const room = ROOMS[id];
    const exactPoints = id === 'wic'
      ? points.map(([x, z]) => [x, z === 7.978 ? plan.wardrobe.z - depth : z])
      : points;
    const surface = material(room.color);
    floorFinish(surface, id === 'master' || id === 'work');
    const mesh = floor(exactPoints, surface);
    mesh.userData.room = id;
    mesh.receiveShadow = true;
    shell.add(mesh);
    floors.set(id, mesh);
    if (id !== 'wic') {
      const ceiling = floor(exactPoints, ceilingPaint);
      ceiling.position.y = CLOSET.height;
      ceiling.visible = false;
      shell.add(ceiling);
      ceilings.set(id, ceiling);
    }
  }
  const recessSurface = material('#b49a7d');
  for (const points of plan.recesses) shell.add(floor(points, recessSurface));
  // Original trace retains the short entrance pocket. Its wall lengths are approximate.
  for (const wall of plan.walls) addWall(walls, wall);
  shell.add(walls);
  root.add(shell, fixtures, closet, closetShell);
  closetShell.visible = false;
  const overviewBounds = new THREE.Box3().setFromObject(root);
  const detailBounds = new THREE.Box3(
    new THREE.Vector3(plan.wardrobe.x - width - .15, 0, plan.wardrobe.z - depth - .12),
    new THREE.Vector3(plan.wardrobe.x + .15, CLOSET.height, plan.wardrobe.z + .12),
  );
  const detailSurface = material(ROOMS.wic.color);
  floorFinish(detailSurface, false);
  const detailFloor = floor([[0, 0], [width, 0], [width, depth], [0, depth]], detailSurface);
  const detailFloorGroup = new THREE.Group();
  detailFloorGroup.position.copy(closet.position);
  detailFloorGroup.rotation.copy(closet.rotation);
  detailFloor.receiveShadow = true;
  detailFloorGroup.add(detailFloor);
  detailFloorGroup.visible = false;
  root.add(detailFloorGroup, clearance);
  function applyFurnitureFocus() {
    const pack = furnitureFocus === 'doors' ? 'doors' : fixturePacks[furnitureFocus];
    for (const scene of fixtures.children) {
      scene.visible = !pack || scene.name === pack || (pack === 'social' && scene.name === 'doors');
    }
    closet.visible = !furnitureFocus;
  }
  return {
    root, floors, overviewBounds, detailBounds,
    async loadFurniture() {
      const failures = await loadFurnishings(fixtures);
      applyFurnitureFocus();
      let teakMap;
      fixtures.traverse((node) => {
        if (node.isMesh && node.material?.name?.includes('Baltimore teak')) teakMap = node.material.map;
      });
      if (teakMap) closet.traverse((node) => {
        if (node.material?.name !== 'Closet teak') return;
        node.material.map = teakMap;
        node.material.color.set('#ffffff');
        node.material.needsUpdate = true;
      });
      return failures;
    },
    showFurniture(visible, focus) {
      fixtures.visible = visible;
      furnitureFocus = focus;
      applyFurnitureFocus();
    },
    showWalls(visible, closetView, roomView) {
      walls.visible = visible && !closetView;
      closetShell.visible = visible && closetView;
      for (const [room, ceiling] of ceilings) ceiling.visible = visible && room === roomView;
    },
    focusCloset(isDetail, showClearance = false) {
      shell.visible = fixtures.visible = !isDetail;
      closetShell.visible = detailFloorGroup.visible = isDetail;
      clearance.visible = isDetail && showClearance;
    },
    highlight(id, realistic = false) {
      for (const [key, mesh] of floors) {
        mesh.material[0].color.set(ROOMS[key].color);
        if (key === id && !realistic) mesh.material[0].color.lerp(selected, .72);
      }
    },
  };
}
