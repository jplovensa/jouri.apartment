import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CLOSET, RAIL_CLEARANCE_MM, makeWardrobe } from '../src/wardrobe.js';

test('both H01 hanging levels clear the S01 shoe rack by the SD-01 set-out', () => {
  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  const wardrobe = makeWardrobe(box, { x: 0, z: 0, rotation: 0 },
    (color) => new THREE.MeshBasicMaterial({ color }));
  const rails = wardrobe.getObjectByName('H01');
  const rack = new THREE.Box3().setFromObject(wardrobe.getObjectByName('S01'));
  assert.equal(Math.round(rack.min.z * 1000), 1807);
  assert.equal(Math.round(rack.max.z * 1000), 2157);
  assert.equal(Math.round(rack.max.y * 1000), CLOSET.height * 1000);
  assert.equal(RAIL_CLEARANCE_MM, 57);

  for (const height of [1.05, 2]) {
    const level = rails.children.filter((mesh) => mesh.position.y === height);
    assert.equal(level.length, 6);
    const bounds = new THREE.Box3();
    for (const mesh of level) bounds.expandByObject(mesh);
    assert.equal(Math.round(bounds.max.z * 1000), 1750);
    assert.equal(Math.round((rack.min.z - bounds.max.z) * 1000), 57);
    assert.equal(bounds.intersectsBox(rack), false);
  }
});
