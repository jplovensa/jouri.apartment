import { makeLocalRegister } from './local-register.js';
import { ROOM_NAMES, SCOPES, STATUSES } from './work-data.js';

const $ = (id) => document.getElementById(id);
const dialog = $('editor');
const form = $('work-form');
const fields = form.elements;
const roomFilter = $('room-filter');
const statusFilter = $('status-filter');
const placeButton = $('add-pin');
const viewport = $('viewport');

function make(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function choices(select, entries) {
  for (const [value, label] of entries) {
    const option = make('option', label);
    option.value = value;
    select.append(option);
  }
}

export function makePortal({ rooms, plan, selectRoom, showPlan, redraw, canPlace, currentRoom, browserLocal }) {
  const register = browserLocal ? makeLocalRegister(window.localStorage, plan) : null;
  let items = [];
  let drafting = false;
  let editing;
  let point;
  let ready = false;
  let saving = false;
  const pins = new Map();
  const roomEntries = Object.entries(ROOM_NAMES);
  choices(roomFilter, [['', 'All rooms'], ...roomEntries]);
  choices(statusFilter, [['', 'All statuses'], ...STATUSES.map((name) => [name, name])]);
  choices(fields.room, roomEntries);
  choices(fields.scope, Object.entries(SCOPES).map(([code, [label]]) => [code, `${code} · ${label}`]));
  choices(fields.status, STATUSES.map((name) => [name, name]));

  const filtered = () => items.filter((row) =>
    (!roomFilter.value || roomFilter.value === row.room) && (!statusFilter.value || statusFilter.value === row.status));

  function notice(text) { $('portal-message').textContent = text; }
  function setDrafting(active) {
    drafting = active;
    placeButton.textContent = active ? 'Cancel pin placement' : '+ Drop work pin';
    viewport.classList.toggle('placing', active);
    redraw();
    $('controls-hint').textContent = active ? 'Click or tap inside a room to place the pin' : 'Drag for the current view · Scroll or pinch to zoom';
  }

  function showLocation() {
    const name = ROOM_NAMES[fields.room.value];
    $('editor-location').textContent = point.exact ? `${name} · selected location` : `${name} · room centre`;
  }

  function openEditor(row, placement) {
    $('form-error').hidden = true;
    form.reset();
    editing = row;
    const room = row?.room ?? placement?.room ?? currentRoom() ?? 'living';
    point = row ? { x: row.x, z: row.z, exact: true }
      : placement ? { ...placement, exact: true } : { x: rooms[room].label[0], z: rooms[room].label[1], exact: false };
    fields.room.value = room;
    fields.scope.value = row?.scope ?? 'Other';
    fields.status.value = row?.status ?? 'Planned';
    for (const key of ['title', 'notes', 'owner', 'quantity', 'due']) fields[key].value = row?.[key] ?? '';
    $('editor-title').textContent = row ? 'Edit work pin' : 'New work pin';
    showLocation();
    $('delete-work').hidden = !register || !row || Boolean(row.source);
    dialog.showModal();
  }

  function openItem(row) {
    selectRoom(row.room);
    openEditor(row);
  }

  function render() {
    const totals = [
      ['Work items', items.length],
      ['Survey needed', items.filter((row) => row.status === 'Survey needed').length],
      ['In progress', items.filter((row) => row.status === 'In progress').length],
      ['Complete', items.filter((row) => row.status === 'Complete').length],
    ];
    $('totals').replaceChildren(...totals.map(([label, count]) => {
      const node = make('div');
      node.className = 'total';
      node.append(make('strong', count), make('span', label));
      return node;
    }));
    const list = $('work-list');
    list.replaceChildren();
    $('map-pins').replaceChildren();
    pins.clear();
    const result = filtered();
    for (const row of result) {
      const li = make('li');
      const entry = make('button');
      entry.type = 'button';
      entry.className = 'work-entry';
      const work = make('div');
      work.append(make('strong', row.title), make('span', row.scope + (row.due ? ` · Due ${row.due}` : '')));
      entry.append(work, make('span', ROOM_NAMES[row.room]), make('span', row.status));
      entry.addEventListener('click', () => openItem(row));
      li.append(entry);
      list.append(li);
      const marker = make('button', row.scope === 'Other' ? '•' : row.scope.replace('M0', ''));
      marker.className = 'pin';
      marker.type = 'button';
      marker.hidden = true;
      marker.dataset.status = row.status;
      marker.setAttribute('aria-label', `${row.title}, ${ROOM_NAMES[row.room]}, ${row.status}`);
      marker.title = `${row.title} · ${ROOM_NAMES[row.room]}`;
      marker.addEventListener('click', () => openItem(row));
      $('map-pins').append(marker);
      pins.set(row.id, [row, marker]);
    }
    if (ready && !result.length) list.append(make('li', 'No work items match these filters.'));
    redraw();
  }

  async function load() {
    try {
      if (register) items = register.list();
      else {
        const response = await fetch('./api/work');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        items = data.items;
      }
      ready = true;
      placeButton.disabled = false;
      notice('');
      render();
    } catch (error) {
      notice(error.message || 'Unable to load the register. Refresh and try again.');
    }
  }

  roomFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);
  placeButton.addEventListener('click', () => {
    if (drafting) { setDrafting(false); return; }
    if (!canPlace()) { openEditor(null); return; }
    showPlan();
    setDrafting(true);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drafting) setDrafting(false);
  });
  placeButton.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (drafting) return;
    event.preventDefault();
    openEditor(null);
  });
  $('close-editor').addEventListener('click', () => { if (!saving) dialog.close(); });
  dialog.addEventListener('cancel', (event) => { if (saving) event.preventDefault(); });
  fields.room.addEventListener('change', () => {
    const [x, z] = rooms[fields.room.value].label;
    point = { x, z, exact: false };
    showLocation();
  });
  fields.scope.addEventListener('change', () => {
    if (!fields.title.value && fields.scope.value !== 'Other') fields.title.value = SCOPES[fields.scope.value][0];
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const submit = form.querySelector('button[type="submit"]');
    const errorNode = $('form-error');
    errorNode.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      const data = Object.fromEntries(new FormData(form));
      Object.assign(data, { x: point.x, z: point.z, revision: editing?.revision });
      let result;
      if (register) result = { item: register.save(data, editing) };
      else {
        const response = await fetch(editing ? `./api/work/${editing.id}` : './api/work', {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        result = await response.json();
        if (!response.ok) throw new Error(result.error);
      }
      items = [result.item, ...items.filter((row) => row.id !== result.item.id)];
      // Keep newly saved work visible even if the previous filters hid it.
      if (roomFilter.value && roomFilter.value !== result.item.room) roomFilter.value = '';
      if (statusFilter.value && statusFilter.value !== result.item.status) statusFilter.value = '';
      dialog.close();
      notice('Work pin saved.');
      render();
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
    } finally {
      saving = false;
      submit.disabled = false;
      submit.textContent = 'Save work';
    }
  });

  if (register) {
    $('storage-mode').textContent = 'Browser-local register';
    $('handoff-controls').hidden = false;
    $('export-work').addEventListener('click', () => {
      try {
        const url = URL.createObjectURL(new Blob([JSON.stringify(register.export(), null, 2)], { type: 'application/json' }));
        const link = make('a');
        link.href = url;
        link.download = 'jouri-work-register.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { notice(error.message); }
    });
    const fileInput = $('import-file');
    $('import-work').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw new Error('The register file is larger than 1 MB.');
        const result = register.import(JSON.parse(await file.text()));
        items = register.list();
        render();
        notice(`Imported ${result.imported} work updates.${result.conflicts ? ' Conflicting revisions stayed as saved on this browser.' : ''}`);
      } catch (error) { notice(error.message); }
      finally { fileInput.value = ''; }
    });
    $('delete-work').addEventListener('click', () => {
      if (!editing || saving) return;
      try {
        register.remove(editing);
        items = register.list();
        dialog.close();
        render();
        notice('Work pin removed from this browser.');
      } catch (error) {
        $('form-error').textContent = error.message;
        $('form-error').hidden = false;
      }
    });
  }

  load();
  return {
    get placing() { return drafting; },
    pick(room, x, z) {
      if (!drafting) return false;
      selectRoom(room);
      setDrafting(false);
      openEditor(null, { room, x, z });
      return true;
    },
    cancelPlacement() { if (drafting) setDrafting(false); },
    renderPins(project, visibleRoom) {
      for (const [row, marker] of pins.values()) {
        const position = project(row.x, row.z);
        marker.hidden = drafting || !position.visible || (visibleRoom && row.room !== visibleRoom);
        marker.style.left = position.left;
        marker.style.top = position.top;
      }
    },
  };
}
