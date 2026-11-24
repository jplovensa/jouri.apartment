import { ROOM_NAMES, SCOPES, SEED_WORK, STATUSES } from './work-data.js';

const key = 'secha-jouri-renovation-register-v1';
export const DATA_FORMAT = 'jouri-apartment-work-register';
const limits = { title: 100, notes: 2500, owner: 80, quantity: 80, due: 10 };

function inRoom(plan, x, z, room) {
  const points = plan.zones.find((zone) => zone.id === room).points;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function valid(plan, row) {
  return row && Object.hasOwn(ROOM_NAMES, row.room) && Object.hasOwn(SCOPES, row.scope)
    && STATUSES.includes(row.status) && Number.isFinite(row.x) && Number.isFinite(row.z)
    && inRoom(plan, row.x, row.z, row.room)
    && Object.entries(limits).every(([field, max]) => typeof row[field] === 'string' && row[field].length <= max)
    && row.title.trim().length > 0 && (!row.due || /^\d{4}-\d{2}-\d{2}$/.test(row.due));
}

function validSaved(plan, row) {
  return valid(plan, row) && /^[\da-z-]{2,80}$/i.test(row.id) && Number.isInteger(row.revision) && row.revision >= 0;
}

export function makeLocalRegister(storage, plan) {
  const seed = new Map(SEED_WORK.map((row) => [row.id, row]));
  function read() {
    const raw = storage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(rows) || !rows.every((row) => validSaved(plan, row))) throw new Error('The saved register could not be read.');
    return new Map(rows.map((row) => [row.id, row]));
  }

  function write(rows) {
    storage.setItem(key, JSON.stringify([...rows.values()]));
  }

  return {
    list() { return [...new Map([...seed, ...read()]).values()]; },
    save(input, editing) {
      if (!valid(plan, input)) throw new Error('Enter a title and place the pin inside its selected room.');
      const rows = read();
      const current = editing && (rows.get(editing.id) ?? seed.get(editing.id));
      if (editing && current?.revision !== editing.revision) throw new Error('This item changed. Reload and try again.');
      const row = {
        ...input, id: editing?.id ?? crypto.randomUUID(), revision: (current?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      if (current?.source) row.source = current.source;
      rows.set(row.id, row);
      write(rows);
      return row;
    },
    remove(target) {
      const rows = read();
      if (seed.has(target.id)) throw new Error('The estimate pins are part of the project baseline.');
      if (rows.get(target.id)?.revision !== target.revision) throw new Error('This item changed. Reload and try again.');
      rows.delete(target.id);
      write(rows);
    },
    export() { return { format: DATA_FORMAT, version: 1, items: [...read().values()] }; },
    import(snapshot) {
      if (snapshot?.format !== DATA_FORMAT || snapshot.version !== 1 || !Array.isArray(snapshot.items)
        || snapshot.items.length > 2000 || !snapshot.items.every((row) => validSaved(plan, row))) {
        throw new Error('Choose a work-register file exported from Jouri Apartment.');
      }
      const rows = read();
      let imported = 0;
      let conflicts = 0;
      for (const item of snapshot.items) {
        const current = rows.get(item.id);
        if (current?.revision === item.revision) {
          if (JSON.stringify(current) !== JSON.stringify(item)) conflicts++;
        } else if (!current || item.revision > current.revision) {
          rows.set(item.id, item);
          imported++;
        }
      }
      write(rows);
      return { imported, conflicts };
    },
  };
}
