import assert from 'node:assert/strict';
import test from 'node:test';
import plan from '../src/plan.json' with { type: 'json' };
import { addPlanWall, OPENINGS } from '../src/openings.js';

test('the facade windows and apartment entrance cut real openings into the traced walls', () => {
  const solids = [];
  for (const wall of plan.walls) {
    addPlanWall(null, wall, (_, coordinates, height, base = 0) => solids.push({ coordinates, height, base }), 2.61);
  }
  for (const opening of OPENINGS) {
    const matchingWall = plan.walls.find(([x1, z1, x2, z2]) => x1 === opening.x && x2 === opening.x
      && Math.min(z1, z2) <= opening.from && Math.max(z1, z2) >= opening.to);
    assert.ok(matchingWall, `No exterior trace for ${opening.id}`);
    for (const { coordinates: [x1, z1, x2, z2], height, base } of solids) {
      if (x1 !== opening.x || x2 !== opening.x) continue;
      const overlapZ = Math.min(opening.to, Math.max(z1, z2)) - Math.max(opening.from, Math.min(z1, z2));
      const overlapY = Math.min(opening.head, base + height) - Math.max(opening.sill, base);
      assert.ok(overlapZ <= 1e-5 || overlapY <= 1e-5, `Wall overlaps ${opening.id}`);
    }
  }
});
