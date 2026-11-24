import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { furnish } from '../src/furnishings.js';

test('separate furniture assemblies have no overlapping physical meshes', () => {
  const furniture = new THREE.Group();
  const box = (w, h, d, x, y, z, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  furnish(furniture, box, (color) => new THREE.MeshBasicMaterial({ color }));
  furniture.updateMatrixWorld(true);
  const assemblies = furniture.children.map(({ name, children }) => {
    const solids = children.map((mesh) => new THREE.Box3().setFromObject(mesh));
    return { name, solids };
  });
  assert.equal(assemblies.length, 21);
  for (let i = 0; i < assemblies.length; i++) {
    for (let j = i + 1; j < assemblies.length; j++) {
      const a = assemblies[i];
      const b = assemblies[j];
      for (const left of a.solids) {
        for (const right of b.solids) {
          const overlap = left.clone().intersect(right).getSize(new THREE.Vector3());
          assert.ok(Math.min(overlap.x, overlap.y, overlap.z) <= .001, `${a.name} clashes with ${b.name}`);
        }
      }
    }
  }
});
