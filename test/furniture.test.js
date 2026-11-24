import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FURNITURE_PACKS } from '../src/furnishings.js';

test('the exported GLB assemblies load and have no clashes with separate furniture', async () => {
  // Read the exported geometry in Node. Texture decoding is checked in the live WebGL viewer.
  const loader = new GLTFLoader().register((parser) => {
    parser.loadTexture = () => Promise.resolve(new THREE.Texture());
    return { name: 'geometry-only-test' };
  });
  const group = new THREE.Group();
  for (const name of FURNITURE_PACKS) {
    const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const asset = await loader.parseAsync(buffer, '');
    assert.ok(asset.scene.children.length >= 3, name);
    group.add(asset.scene);
  }
  group.updateMatrixWorld(true);
  const assemblies = group.children.flatMap(({ children }) => children).map(({ name, children }) => {
    const solids = children.map((mesh) => new THREE.Box3().setFromObject(mesh, true));
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
