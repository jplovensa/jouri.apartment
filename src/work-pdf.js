import { jsPDF } from 'jspdf';
import { ROOM_NAMES, STATUSES } from './work-data.js';
import { isOverdue, projectDate } from './work-views.js';

const ink = '#273b30';
const muted = '#626b62';
const border = '#dddcd3';
const paper = '#f6f5ef';
const colors = {
  Planned: '#516c55',
  'Survey needed': '#946021',
  'In progress': '#356580',
  Blocked: '#9b483d',
  Complete: '#2b583e',
};
const shortRoom = { master: 'Bedroom', bath: 'Bath', kitchen: 'Kitchen', dining: 'Dining', living: 'Living', work: 'Work', wic: 'Closet' };
const references = { master: 'master', bath: 'bath', kitchen: 'kitchen', dining: 'kitchen', living: 'living', work: 'work', wic: 'door-p1' };

function inline(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function label(doc, value, x, y, size = 9, color = ink, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(color);
  doc.text(inline(value), x, y);
}

function rect(doc, x, y, w, h, fill, outline = border) {
  doc.setFillColor(fill).setDrawColor(outline).setLineWidth(.25);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
}

function header(doc, title, filter, today) {
  label(doc, 'SECHA STUDIO+   /   JOURI APARTMENT', 14, 17, 9, muted, true);
  label(doc, title, 14, 33, 24, ink, true);
  const lines = doc.setFontSize(9).splitTextToSize(filter || 'All apartment work', 148);
  label(doc, lines.join(' ').slice(0, 120), 14, 42, 9, muted);
  label(doc, today, 167, 17, 9, muted);
  doc.setDrawColor(border).line(14, 47, 196, 47);
}

function metrics(doc, rows, today) {
  const tiles = [
    ['Work items', rows.length],
    ['Complete', rows.filter((row) => row.status === 'Complete').length],
    ['Blocked', rows.filter((row) => row.status === 'Blocked').length],
    ['Overdue', rows.filter((row) => isOverdue(row, today)).length],
  ];
  tiles.forEach(([name, value], index) => {
    const x = 14 + index * 46;
    rect(doc, x, 53, 43, 19, paper);
    label(doc, value, x + 4, 62, 15, ink, true);
    label(doc, name, x + 4, 68, 8, muted);
  });
}

function diagram(doc, plan, rooms, rows, room) {
  const px = 17, py = 84, width = 68, height = 101;
  const corners = plan.zones.flatMap((zone) => zone.points);
  const minX = Math.min(...corners.map(([x]) => x)) - .25;
  const maxX = Math.max(...corners.map(([x]) => x)) + .25;
  const minZ = Math.min(...corners.map(([, z]) => z)) - .25;
  const maxZ = Math.max(...corners.map(([, z]) => z)) + .25;
  const scale = Math.min(width / (maxX - minX), height / (maxZ - minZ));
  const project = (x, z) => [px + (width - scale * (maxX - minX)) / 2 + scale * (x - minX), py + scale * (z - minZ)];
  doc.setLineWidth(.3).setDrawColor('#cbc8bd');
  for (const zone of plan.zones) {
    const projected = zone.points.map(([x, z]) => project(x, z));
    const lines = projected.slice(1).map(([x, z], i) => [x - projected[i][0], z - projected[i][1]]);
    doc.setFillColor(zone.id === room ? '#d4dfd3' : '#ece9df');
    doc.lines(lines, ...projected[0], [1, 1], 'FD', true);
  }
  doc.setDrawColor('#797e73').setLineWidth(.25);
  for (const [x1, z1, x2, z2] of plan.walls) doc.line(...project(x1, z1), ...project(x2, z2));
  for (const [key, data] of Object.entries(rooms)) {
    const [x, y] = project(...data.label);
    label(doc, shortRoom[key], x - 4, y - 2.9, 6, muted, true);
  }
  for (const row of rows) {
    const [x, y] = project(row.x, row.z);
    doc.setFillColor(colors[row.status] || colors.Planned).setDrawColor('#ffffff').setLineWidth(.22).circle(x, y, 1.65, 'FD');
  }
}

async function picture(room) {
  const name = references[room] || 'apartment';
  const url = new URL(`references/${name}.webp`, document.baseURI).href;
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return { data: canvas.toDataURL('image/jpeg', .9), ratio: canvas.width / canvas.height };
}

function overview(doc, plan, rooms, rows, room, img, single) {
  label(doc, 'FLOOR PLAN AND WORK PINS', 14, 80, 8, muted, true);
  label(doc, 'INTERIOLA DESIGN REFERENCE', 94, 80, 8, muted, true);
  rect(doc, 14, 83, 73, 105, '#fbfaf7');
  diagram(doc, plan, rooms, rows, room);
  const imageHeight = Math.min(68, 100 / img.ratio);
  const imageWidth = img.ratio * imageHeight;
  doc.addImage(img.data, 'JPEG', 94 + (100 - imageWidth) / 2, 83, imageWidth, imageHeight);
  label(doc, room ? ROOM_NAMES[room] : 'Apartment axonometric', 94, 88 + imageHeight, 8, muted);
  if (single) {
    const row = rows[0];
    const caption = doc.setFont('helvetica', 'bold').setFontSize(10).splitTextToSize(inline(row.title), 99);
    doc.setTextColor(ink).text(caption, 94, 98 + imageHeight);
    label(doc, `${row.status}  /  ${row.priority || 'Normal'} priority`, 94, 106 + imageHeight, 8, muted);
  }
  STATUSES.forEach((name, i) => {
    const x = 15 + i * 36;
    doc.setFillColor(colors[name]).circle(x, 195, 1.25, 'F');
    label(doc, name, x + 3, 196, 7, muted);
  });
}

function statusRows(doc, rows, today) {
  let y = 208;
  label(doc, 'STATUS BREAKDOWN', 14, y, 8, muted, true);
  for (const state of STATUSES) {
    y += 9;
    const count = rows.filter((row) => row.status === state).length;
    label(doc, state, 14, y, 8, ink);
    doc.setFillColor('#ecece6').rect(57, y - 2.9, 115, 3.8, 'F');
    if (count) doc.setFillColor(colors[state]).rect(57, y - 2.9, 115 * count / rows.length, 3.8, 'F');
    label(doc, count, 180, y, 8, ink, true);
  }
  label(doc, 'Pin positions and drawing geometry are indicative.', 14, 267, 8, muted);
}

function itemLines(doc, row) {
  const fields = [
    `${row.scope}  |  ${ROOM_NAMES[row.room]}  |  ${row.status}  |  ${row.priority || 'Normal'} priority`,
    [row.owner && `Assigned to ${row.owner}`, row.start && `Start ${row.start}`, row.due && `Due ${row.due}`, row.quantity && `Quantity ${row.quantity}`].filter(Boolean).join('  |  '),
    row.blocker && `Blocker or dependency: ${row.blocker}`,
    row.notes,
  ].map(inline).filter(Boolean);
  return doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(fields.join('\n'), 171);
}

function register(doc, rows, today) {
  doc.addPage();
  header(doc, 'Work register', 'Scope, programme and site notes', today);
  if (!rows.length) label(doc, 'No work items match the active filters.', 14, 61, 9);
  let y = 60;
  for (const [index, row] of rows.entries()) {
    const title = doc.setFont('helvetica', 'bold').setFontSize(10).splitTextToSize(`${index + 1}. ${inline(row.title)}`, 174);
    const lines = itemLines(doc, row);
    if (y + title.length * 4.5 + lines.length * 4.2 > 270) {
      doc.addPage();
      header(doc, 'Work register', 'Scope, programme and site notes', today);
      y = 60;
    }
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(ink).text(title, 14, y);
    y += title.length * 4.5;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted).text(lines, 17, y);
    y += lines.length * 4.2 + 4;
    doc.setDrawColor(border).line(14, y - 2, 196, y - 2);
    y += 5;
  }
}

export async function exportWorkPdf({ kind, plan, rooms, rows, room, filter, single }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = projectDate();
  const name = single ? 'Work item status card' : kind === 'card' ? 'Work status card' : 'Renovation work report';
  const img = await picture(room);
  header(doc, name, filter, today);
  metrics(doc, rows, today);
  overview(doc, plan, rooms, rows, room, img, single);
  if (single) {
    const lines = itemLines(doc, rows[0]);
    label(doc, 'WORK ITEM DETAILS', 14, 208, 8, muted, true);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(ink).text(lines.slice(0, 14), 14, 216);
    if (lines.length > 14) label(doc, 'Additional notes are available in the work register.', 14, 277, 8, muted);
  } else statusRows(doc, rows, today);
  if (kind === 'report') register(doc, rows, today);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setDrawColor(border).line(14, 281, 196, 281);
    label(doc, 'SECHA Studio+  /  Site coordination', 14, 287, 8, muted);
    label(doc, `${page} / ${doc.getNumberOfPages()}`, 179, 287, 8, muted);
  }
  doc.save(`jouri-${single ? 'pin-card' : kind === 'card' ? 'status-card' : 'work-report'}-${today}.pdf`);
}
