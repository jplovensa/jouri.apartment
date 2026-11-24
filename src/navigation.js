// The traced room floors stop at finished wall faces. These small joining polygons are
// the four open thresholds, including the concealed doors shown open in Walkthrough.
export const thresholds = [
  [[3.63, 2.268], [3.80, 2.268], [3.80, 3.156], [3.63, 3.156]],
  [[3.948, 2.09], [4.549, 2.09], [4.549, 2.26], [3.948, 2.26]],
  [[2.964, 7.44], [3.907, 7.44], [3.907, 7.65], [2.964, 7.65]],
  [[4.112, 7.44], [4.918, 7.44], [4.918, 7.53], [4.112, 7.53]],
];

export const WALK_STARTS = {
  entry: [5.29, 6.63, Math.PI / 2],
  master: [3.20, 2.84, .40],
  bath: [4.17, 1.79, -.65],
  kitchen: [4.07, 3.54, -1.78],
  dining: [4.43, 6.46, -.30],
  living: [2.27, 5.83, 1.33],
  work: [2.96, 8.18, 2.90],
  wic: [4.52, 8.32, 2.97],
};

const radius = .155;
const wallClearance = radius + .068;

function inside(x, z, points) {
  let contained = false;
  for (let i = 0, last = points.length - 1; i < points.length; last = i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[last];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) contained = !contained;
  }
  return contained;
}

function alongWall(x, z, [ax, az, bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 < wallClearance ** 2;
}

function overFurniture(x, z, { minX, minZ, maxX, maxZ }) {
  const dx = Math.max(minX - x, 0, x - maxX);
  const dz = Math.max(minZ - z, 0, z - maxZ);
  return dx * dx + dz * dz < radius * radius;
}

export function createWalkSpace(plan) {
  let furniture = [];
  function occupied(x, z) {
    return plan.walls.some((wall) => alongWall(x, z, wall)) || furniture.some((item) => overFurniture(x, z, item));
  }
  function roomAt(x, z) {
    return plan.zones.find(({ points }) => inside(x, z, points))?.id;
  }
  function canStand(x, z) {
    return (Boolean(roomAt(x, z)) || thresholds.some((points) => inside(x, z, points))) && !occupied(x, z);
  }
  return {
    roomAt,
    canStand,
    setFurniture(obstacles) { furniture = obstacles; },
    start(room) {
      const [x, z, yaw] = WALK_STARTS[room] ?? WALK_STARTS.entry;
      if (canStand(x, z)) return { x, z, yaw };
      // Keep a room jump within that room when a furniture assembly occupies its preferred starting position.
      const expected = room === 'entry' ? 'dining' : room;
      for (let ring = 1; ring <= 8; ring++) {
        for (let step = 0; step < 20; step++) {
          const angle = step * Math.PI / 10;
          const nx = x + ring * .11 * Math.cos(angle);
          const nz = z + ring * .11 * Math.sin(angle);
          if (roomAt(nx, nz) === expected && canStand(nx, nz)) return { x: nx, z: nz, yaw };
        }
      }
      return null;
    },
    move(position, dx, dz) {
      // Substeps prevent corner tunnelling and allow sliding along a wall.
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .055));
      let { x, z } = position;
      for (let i = 0; i < steps; i++) {
        const nx = x + dx / steps;
        const nz = z + dz / steps;
        if (canStand(nx, z)) x = nx;
        if (canStand(x, nz)) z = nz;
      }
      return { x, z };
    },
  };
}
