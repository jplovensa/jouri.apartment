import { ROOM_NAMES, STATUSES } from './work-data.js';

const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' });
const displayDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const projectDate = (time = Date.now()) => day.format(time);
export const isOverdue = (row, today) => row.status !== 'Complete' && Boolean(row.due && row.due < today);

function formatDate(value) {
  const time = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(time.getTime()) ? value : displayDate.format(time);
}

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function badge(label, kind) {
  const el = node('span', label, 'work-badge');
  el.dataset.kind = kind;
  return el;
}

function details(row, today) {
  const wraps = node('div', undefined, 'item-meta');
  const dateLabel = row.start && row.due ? `${formatDate(row.start)} – ${formatDate(row.due)}`
    : row.due ? `Due ${formatDate(row.due)}` : row.start ? `Starts ${formatDate(row.start)}` : '';
  wraps.append(node('span', [row.scope, ROOM_NAMES[row.room], row.owner].filter(Boolean).join(' · ')));
  if (dateLabel) wraps.append(node('span', dateLabel, isOverdue(row, today) ? 'overdue' : ''));
  if (row.blocker) wraps.append(node('span', row.blocker, 'blocker'));
  return wraps;
}

function workEntry(row, today, openItem, compact = false) {
  const button = node('button', undefined, compact ? 'board-card' : 'work-entry advanced-entry');
  button.type = 'button';
  const main = node('div', undefined, 'entry-main');
  main.append(node('strong', row.title), details(row, today));
  const tags = node('div', undefined, 'work-tags');
  if (!compact) tags.append(badge(row.status, row.status));
  if (row.priority && row.priority !== 'Normal') tags.append(badge(row.priority, row.priority));
  if (isOverdue(row, today)) tags.append(badge('Overdue', 'Urgent'));
  button.append(main, tags);
  button.addEventListener('click', () => openItem(row));
  return button;
}

function section(title, count, className) {
  const wrap = node('section', undefined, className);
  const heading = node('h3', undefined, 'column-title');
  heading.append(node('span', title), node('span', count, 'column-count'));
  wrap.append(heading);
  return wrap;
}

function workList(rows, today, openItem, compact) {
  const list = node('ol', undefined, compact ? 'column-list' : 'work-list');
  for (const row of rows) {
    const li = node('li');
    li.append(workEntry(row, today, openItem, compact));
    list.append(li);
  }
  return list;
}

export function scheduleGroups(rows, now = Date.now()) {
  const today = projectDate(now);
  const week = projectDate(now + 7 * 86400000);
  const groups = [
    ['Overdue', []], ['Next 7 days', []], ['Later', []], ['Unscheduled', []], ['Complete', []],
  ];
  const ordered = [...rows].sort((a, b) => (a.due || a.start || '9999').localeCompare(b.due || b.start || '9999'));
  for (const row of ordered) {
    const date = row.due || row.start;
    const index = row.status === 'Complete' ? 4 : isOverdue(row, today) ? 0 : !date ? 3 : date <= week ? 1 : 2;
    groups[index][1].push(row);
  }
  return groups;
}

export function renderWorkView(host, view, rows, openItem, filterRoom) {
  if (!rows.length) {
    host.replaceChildren(node('p', 'No work items match these filters.', 'empty-work'));
    return;
  }
  const today = projectDate();
  if (view === 'list') {
    host.replaceChildren(workList(rows, today, openItem, false));
    return;
  }
  const collection = node('div', undefined, view === 'board' ? 'work-board' : view === 'rooms' ? 'room-progress' : 'work-schedule');
  if (view === 'rooms') {
    for (const [key, name] of Object.entries(ROOM_NAMES)) {
      const room = rows.filter((row) => row.room === key);
      if (!room.length) continue;
      const done = room.filter((row) => row.status === 'Complete').length;
      const blocked = room.filter((row) => row.status === 'Blocked').length;
      const overdue = room.filter((row) => isOverdue(row, today)).length;
      const card = node('button', undefined, 'room-progress-card');
      card.type = 'button';
      const meter = node('progress');
      meter.max = room.length;
      meter.value = done;
      meter.setAttribute('aria-label', `${name} work completed`);
      const summary = [`${done}/${room.length} complete`, blocked && `${blocked} blocked`, overdue && `${overdue} overdue`].filter(Boolean);
      card.append(node('strong', name), meter, node('small', summary.join(' · ')));
      card.addEventListener('click', () => filterRoom(key));
      collection.append(card);
    }
  } else {
    const groups = view === 'board' ? STATUSES.map((status) => [status, rows.filter((row) => row.status === status)]) : scheduleGroups(rows);
    for (const [label, items] of groups) {
      const column = section(label, items.length, 'work-column');
      column.dataset.kind = label;
      if (items.length) column.append(workList(items, today, openItem, view === 'board'));
      else column.append(node('p', 'No work items', 'empty-work'));
      collection.append(column);
    }
  }
  host.replaceChildren(collection);
}
