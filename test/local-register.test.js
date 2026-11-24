import assert from 'node:assert/strict';
import test from 'node:test';
import { makeLocalRegister } from '../src/local-register.js';
import plan from '../src/plan.json' with { type: 'json' };

function browser() {
  const records = new Map();
  const storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value) };
  return makeLocalRegister(storage, plan);
}

test('the Pages register keeps pins and can hand off updates without duplicating baseline scope', () => {
  const source = browser();
  const target = browser();
  assert.equal(source.list().length, 13);
  const initial = source.list()[0];
  const planned = source.save({ ...initial, scope: 'Other', title: 'New work pin' });
  source.save({ ...planned, status: 'Complete' }, planned);
  assert.throws(() => source.save({ ...planned }, planned), /changed/);
  assert.throws(() => source.save({ ...planned, x: -20 }), /inside/);
  assert.deepEqual(target.import(source.export()), { imported: 1, conflicts: 0 });
  assert.equal(target.list().find((item) => item.id === planned.id).status, 'Complete');
  assert.deepEqual(target.import(source.export()), { imported: 0, conflicts: 0 });
  target.remove(target.list().find((item) => item.id === planned.id));
  assert.equal(target.list().length, 13);
});

test('planned dates, priorities and blockers survive a register handoff', () => {
  const source = browser();
  const target = browser();
  const initial = source.list()[0];
  const revised = source.save({ ...initial, priority: 'Urgent', start: '2026-11-24',
    due: '2026-11-26', blocker: 'Confirm wall finish' }, initial);
  assert.equal(target.import(source.export()).imported, 1);
  const restored = target.list().find((item) => item.id === revised.id);
  assert.equal(restored.priority, 'Urgent');
  assert.equal(restored.blocker, 'Confirm wall finish');
  assert.throws(() => target.save({ ...restored, start: '2026-11-27' }, restored), /Enter a title/);
});
