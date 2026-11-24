const seedById = new Map(SEED_WORK.map((item) => [item.id, item]));

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function record(row) {
  return { ...JSON.parse(row.data), id: row.id, revision: row.revision, updatedAt: row.updated_at };
}

function insideRoom(x, z, room) {
  const points = PLAN.zones.find((zone) => zone.id === room).points;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function validate(input) {
  if (!input || !Object.hasOwn(ROOM_NAMES, input.room) || !Object.hasOwn(SCOPES, input.scope)
    || !STATUSES.includes(input.status) || !Number.isFinite(input.x) || !Number.isFinite(input.z)
    || !insideRoom(input.x, input.z, input.room)) return null;
  const limits = { title: 100, notes: 2500, owner: 80, quantity: 80, due: 10 };
  const data = { room: input.room, scope: input.scope, status: input.status, x: input.x, z: input.z };
  for (const [key, max] of Object.entries(limits)) {
    if (typeof input[key] !== 'string' || input[key].length > max) return null;
    data[key] = input[key].trim();
  }
  if (!data.title) return null;
  if (data.due && !/^\d{4}-\d{2}-\d{2}$/.test(data.due)) return null;
  return data;
}

async function handleWork(request, env, id) {
  const url = new URL(request.url);
  if (!request.headers.get('oai-authenticated-user-id')) return json({ error: 'Sign in to open the work register.' }, 401);
  if (request.method === 'GET' && !id) {
    const { results } = await env.DB.prepare('SELECT id, data, revision, updated_at FROM work_items').all();
    const items = new Map(seedById);
    for (const row of results) items.set(row.id, record(row));
    return json({ items: [...items.values()] });
  }
  if (!((request.method === 'POST' && !id) || (request.method === 'PUT' && id))) {
    return json({ error: 'Method not supported.' }, 405);
  }
  if (request.headers.get('Origin') !== url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')) {
    return json({ error: 'The request must come from this portal.' }, 403);
  }
  const text = await request.text();
  if (text.length > 16000) return json({ error: 'Work item is too large.' }, 413);
  let input;
  try { input = JSON.parse(text); } catch { return json({ error: 'Invalid request.' }, 400); }
  const data = validate(input);
  if (!data) return json({ error: 'Enter a title and place the pin inside its selected room.' }, 400);
  const updatedAt = new Date().toISOString();
  const existingSeed = seedById.get(id);
  if (existingSeed) data.source = existingSeed.source;
  const values = JSON.stringify(data);
  if (!id || (existingSeed && input.revision === 0)) {
    const key = id || crypto.randomUUID();
    const result = await env.DB.prepare('INSERT OR IGNORE INTO work_items (id, data, revision, updated_at) VALUES (?, ?, 1, ?)')
      .bind(key, values, updatedAt).run();
    if (!result.meta.changes) return json({ error: 'This item changed. Reload the register before editing.' }, 409);
    return json({ item: { ...data, id: key, revision: 1, updatedAt } }, id ? 200 : 201);
  }
  if (!Number.isInteger(input.revision) || input.revision < 1) return json({ error: 'Invalid work item revision.' }, 400);
  const result = await env.DB.prepare('UPDATE work_items SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?')
    .bind(values, updatedAt, id, input.revision).run();
  if (!result.meta.changes) return json({ error: 'This item changed. Reload the register before editing.' }, 409);
  return json({ item: { ...data, id, revision: input.revision + 1, updatedAt } });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const api = path.match(/^\/api\/work(?:\/([a-zA-Z0-9-]+))?$/);
    if (api) {
      try { return await handleWork(request, env, api[1]); }
      catch (error) {
        console.error('Work register request failed', error);
        return json({ error: 'The work register is temporarily unavailable.' }, 503);
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    const asset = ASSETS[path];
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.data), (char) => char.charCodeAt(0)), {
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': path.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
