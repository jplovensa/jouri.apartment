import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleGroups } from '../src/work-views.js';

test('schedule groups due dates by the project day in Jakarta', () => {
  const now = new Date('2026-11-24T18:00:00Z');
  const rows = [
    { id: 'late', due: '2026-11-24', status: 'Planned' },
    { id: 'next', start: '2026-11-27', status: 'In progress' },
    { id: 'later', due: '2026-12-08', status: 'Planned' },
    { id: 'open', status: 'Planned' },
    { id: 'done', due: '2026-11-21', status: 'Complete' },
  ];
  assert.deepEqual(scheduleGroups(rows, now).map(([, group]) => group.map((row) => row.id)),
    [['late'], ['next'], ['later'], ['open'], ['done']]);
});
