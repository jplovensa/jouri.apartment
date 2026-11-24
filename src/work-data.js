export const ROOM_NAMES = {
  master: 'Main bedroom',
  bath: 'Bathroom',
  kitchen: 'Kitchen',
  dining: 'Dining area',
  living: 'Living area',
  work: 'Working room',
  wic: 'Walk-in closet',
};

export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export const STATUSES = ['Planned', 'Survey needed', 'In progress', 'Blocked', 'Complete'];

export const SCOPES = {
  M01: ['Scrape and repaint', 'Protect surfaces, scrape loose coating, patch, sand, prime and paint in Jotun 0471 Light Antique. Measure scraping, net wall paint and ceiling paint separately.'],
  M02: ['Main bedroom door', 'Measure clear opening, wall thickness, frame condition and swing. Confirm door leaf, finish, hinges, handle and lockset.'],
  M03: ['Window frame refresh', 'Record each unit, material, affected faces, damage and finish. Confirm seals and hardware after inspection.'],
  M04: ['Bathroom cable routing', 'Measure route length and connection points. Confirm cable protection, fixings, access and patching.'],
  M05: ['Closet ceiling repair', 'Map damaged areas, inspect framing and identify the cause. Measure patching and framing separately. Ceiling paint belongs to M01.'],
  Other: ['Other planned work', 'Describe the work and any measurements or approvals still needed.'],
};

const estimatePins = [
  ['M01', 'master', 2.7, .65],
  ['M01', 'bath', 4.15, 1.45, 'Measure only painted wall area above the tile, plus the ceiling.'],
  ['M01', 'kitchen', 4.35, 2.8],
  ['M01', 'dining', 5.1, 4.85],
  ['M01', 'living', 2.1, 5.1],
  ['M01', 'work', 2.65, 9.25],
  ['M01', 'wic', 5.1, 9.4, 'Nominal main-bay ceiling paint area is 4.36 m². Verify any return or recess.'],
  ['M02', 'master', 3.33, 3.08, 'One set. Opening size and hardware pending survey.'],
  ['M03', 'master', .25, 1.6],
  ['M03', 'living', .29, 6.07],
  ['M03', 'work', 1.23, 8.65],
  ['M04', 'bath', 5.55, 1.75],
  ['M05', 'wic', 5.68, 8.35],
];

export const SEED_WORK = estimatePins.map(([scope, room, x, z, details]) => ({
  id: `${scope}-${room}`,
  scope, room, x, z,
  title: SCOPES[scope][0],
  status: 'Survey needed',
  notes: [SCOPES[scope][1], details, 'Estimate reference. Pin location is indicative.'].filter(Boolean).join('\n'),
  due: '',
  owner: '',
  quantity: scope === 'M02' ? '1 set' : '',
  revision: 0,
  source: 'SCH-MW-01/02',
}));
