import assert from 'node:assert/strict';
import test from 'node:test';
import plan from '../src/plan.json' with { type: 'json' };
import { createWalkSpace } from '../src/navigation.js';

test('walking crosses room thresholds and stops at walls and the apartment boundary', () => {
  const space = createWalkSpace(plan);
  assert.equal(space.roomAt(...Object.values(space.move({ x: 3.4, z: 2.7 }, .7, 0))), 'kitchen');
  assert.equal(space.roomAt(...Object.values(space.move({ x: 3.4, z: 1.7 }, .7, 0))), 'master');
  const outside = space.move(space.start('entry'), 2, 0);
  assert.equal(space.roomAt(outside.x, outside.z), 'dining');
  for (const { id } of plan.zones) {
    const { x, z } = space.start(id);
    assert.equal(space.roomAt(x, z), id);
  }
});

test('walking slides alongside furniture without stepping through it', () => {
  const space = createWalkSpace(plan);
  space.setFurniture([{ minX: 3, maxX: 3.7, minZ: 5.5, maxZ: 6.1 }]);
  const blocked = space.move({ x: 2.5, z: 5.7 }, 1.3, 0);
  assert.ok(blocked.x <= 3 - .155);
  const moved = space.move(blocked, .1, -.45);
  assert.ok(moved.z < 5.3);
  assert.ok(space.canStand(moved.x, moved.z));
});
