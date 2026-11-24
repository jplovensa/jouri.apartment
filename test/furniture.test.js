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
    assert.ok(asset.scene.children.length >= (name === 'doors' ? 2 : 3), name);
    group.add(asset.scene);
  }
  group.updateMatrixWorld(true);
  const assemblies = group.children.flatMap(({ children }) => children).map(({ name, children }) => {
    const solids = children.map((mesh) => new THREE.Box3().setFromObject(mesh, true));
    return { name, solids };
  });
  assert.equal(assemblies.length, 25);

  const find = (prefix) => group.children.flatMap(({ children }) => children)
    .find(({ name }) => name.startsWith(prefix));
  const bounds = (object) => new THREE.Box3().setFromObject(object, true);
  const size = (object) => bounds(object).getSize(new THREE.Vector3());
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .006, `${actual} differs from ${expected}`);
  const kitchen = bounds(find('F03_Olive'));
  const tower = find('F03_Side');
  const fridge = bounds(tower.children.find(({ material }) => /refrigerator enamel/i.test(material?.name)));
  const island = bounds(find('F01_Two'));
  const firstStool = bounds(find('F02_Sculpted'));
  near(kitchen.max.z - kitchen.min.z, 2.262);
  assert.ok(fridge.min.z > 4.912 && fridge.max.z < 5.501, 'the fridge fits inside the centre F03 appliance bay');
  near(island.max.x - island.min.x, .550);
  near(island.max.z - island.min.z, 1.500);
  assert.ok(bounds(tower).min.x - island.max.x > .60, 'the island clears the appliance run');
  assert.ok(firstStool.max.x < island.min.x, 'the stools sit on the living-room side');
  const desk = size(find('F11_Wall'));
  near(desk.z, .980);
  near(desk.x, .400);
  near(size(find('F20_Illuminated')).x, 1);
  near(size(find('F13')).x, .758);
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
