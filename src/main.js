import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { APARTMENT_PLAN, ROOMS, makeApartment } from './model.js';
import { JOINERY, RAIL_CLEARANCE_MM } from './wardrobe.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const roomButtons = new Map();
const labels = new Map();
let selection = null;
let view = 'orbit';
let sceneView;
let portal;

function element(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

const roomNotes = {
  master: 'The render shows a teak platform bed, terracotta headboard and fitted storage.',
  bath: 'Vanity, shower and sanitary fittings follow the render as visual references.',
  kitchen: 'Olive base units, a granite worktop and teak upper cabinets.',
  dining: 'Granite-topped island with two stools, based on the furniture plan.',
  living: 'Teak media wall and fitted storage from the Interiola renders.',
  work: 'Angled alcove with daybed, fitted storage and a desk.',
  wic: `2,022 × 2,157 mm bay · 2,610 mm ceiling. Proposed ${RAIL_CLEARANCE_MM} mm gap, up from 57 mm in SD-01. The shaded zone leaves 650 mm in front of the rack after a 100 mm clothing allowance. Verify on site before changing the rail.`,
};

const references = {
  master: ['master', 'master-detail'],
  bath: ['bath'],
  kitchen: ['kitchen', 'kitchen-detail'],
  dining: ['kitchen', 'living'],
  living: ['living', 'living-detail'],
  work: ['work', 'work-detail'],
  wic: ['apartment'],
};
let referenceIndex = 0;
function renderReference() {
  const views = references[selection] ?? ['apartment'];
  const url = `./references/${views[referenceIndex]}.webp`;
  $('reference-link').href = url;
  const img = $('reference-image');
  img.src = url;
  img.alt = selection ? `Interiola design reference for ${ROOMS[selection].name}` : 'Interiola apartment axonometric';
  $('next-reference').hidden = views.length < 2;
}
$('next-reference').addEventListener('click', () => {
  referenceIndex = (referenceIndex + 1) % references[selection].length;
  renderReference();
});

function selectRoom(id) {
  selection = id;
  referenceIndex = 0;
  renderReference();
  $('room-title').textContent = ROOMS[id]?.name ?? 'Apartment overview';
  $('room-note').textContent = roomNotes[id] ?? 'Select a room to see its original design render and notes.';
  $('joinery').hidden = id !== 'wic';
  for (const [roomId, button] of roomButtons) {
    button.setAttribute('aria-pressed', String(roomId === id));
    labels.get(roomId).classList.toggle('active', roomId === id);
  }
  sceneView?.model.highlight(id);
  sceneView?.render();
}

const isClosetView = () => view === 'wic' || view === 'wic-plan';
const isPlanView = () => view === 'plan' || view === 'wic-plan';

function setView(next) {
  portal?.cancelPlacement();
  view = next;
  if (isClosetView()) selectRoom('wic');
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  $('controls-hint').textContent = isPlanView()
    ? 'Drag to pan · Scroll or pinch to zoom'
    : 'Drag to orbit · Scroll or pinch to zoom';
  sceneView?.frame();
}

for (const [id, { name, color }] of Object.entries(ROOMS)) {
  const button = element('button', '');
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  const swatch = element('span', '');
  swatch.className = 'swatch';
  swatch.style.background = color;
  swatch.setAttribute('aria-hidden', 'true');
  button.append(swatch, name);
  button.addEventListener('click', () => {
    if (isClosetView() && id !== 'wic') setView('orbit');
    selectRoom(id);
  });
  $('rooms').append(button);
  roomButtons.set(id, button);
  const label = element('span', name);
  label.className = 'room-label';
  $('labels').append(label);
  labels.set(id, label);
}

for (const [name, detail] of JOINERY) $('joinery').append(element('dt', name), element('dd', detail));
for (const button of viewButtons) button.addEventListener('click', () => setView(button.dataset.view));
$('reset').addEventListener('click', () => {
  if (!isClosetView()) selectRoom(null);
  setView(view);
});

function initialise() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor('#eae8df');
  renderer.toneMapping = THREE.NeutralToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '3D apartment floor plan. Choose a room using the room list.');
  canvas.setAttribute('role', 'img');
  viewport.prepend(canvas);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 100);
  const scene = new THREE.Scene();
  const model = makeApartment();
  scene.add(model.root);
  scene.add(new THREE.HemisphereLight('#fffaf1', '#b9b4a1', 2.35));
  const sun = new THREE.DirectionalLight('#fff4e1', 1.85);
  sun.position.set(-6, 13, -5);
  scene.add(sun);
  const controls = new OrbitControls(camera, canvas);
  controls.minZoom = .55;
  controls.maxZoom = 4;
  controls.maxPolarAngle = Math.PI * .49;
  controls.minPolarAngle = 0;

  const point = new THREE.Vector3();
  function project(x, z, height = .035) {
    point.set(x, height, z).project(camera);
    return {
      visible: Math.abs(point.x) < .94 && Math.abs(point.y) < .94,
      left: `${(point.x + 1) * 50}%`,
      top: `${(1 - point.y) * 50}%`,
    };
  }
  function render() {
    renderer.render(scene, camera);
    for (const [id, label] of labels) {
      const [x, z] = ROOMS[id].label;
      const position = project(x, z);
      label.hidden = isClosetView() || portal?.placing || !position.visible;
      label.style.left = position.left;
      label.style.top = position.top;
    }
    portal?.renderPins((x, z) => project(x, z, isPlanView() ? .05 : .17), isClosetView() ? 'wic' : null);
  }

  function frame() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    const detail = isClosetView();
    const top = isPlanView();
    model.focusCloset(detail, view === 'wic-plan');
    model.showFurniture(view === 'orbit');
    const bounds = detail ? model.detailBounds : model.overviewBounds;
    const target = bounds.getCenter(new THREE.Vector3());
    const offset = top ? [0, 22, detail ? -.001 : .001] : detail ? [-11, 15, .4] : [-10, 20, -15];
    camera.position.copy(target).add(new THREE.Vector3(...offset));
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const transformed = bounds.clone().applyMatrix4(camera.matrixWorldInverse);
    const size = transformed.getSize(new THREE.Vector3());
    const ratio = width / height;
    const half = Math.max(size.x / ratio, size.y) * (detail ? .56 : .55);
    camera.zoom = 1;
    camera.left = -half * ratio;
    camera.right = half * ratio;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.enableRotate = !top;
    controls.mouseButtons.LEFT = top ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = top ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    controls.update();
    render();
  }

  controls.addEventListener('change', render);
  new ResizeObserver(frame).observe(viewport);
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down;
  canvas.addEventListener('pointerdown', (event) => {
    down = event.isPrimary && event.button === 0 ? [event.clientX, event.clientY] : null;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!event.isPrimary) return;
    const start = down;
    down = null;
    if (isClosetView() || !start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects([...model.floors.values()], false)[0];
    if (hit && !portal?.pick(hit.object.userData.room, hit.point.x, hit.point.z)) {
      selectRoom(hit.object.userData.room);
    }
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    canvas.hidden = true;
    $('fallback').hidden = false;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    canvas.hidden = false;
    $('fallback').hidden = true;
    frame();
  });
  frame();
  return { model, frame, render };
}

try {
  sceneView = initialise();
} catch (error) {
  console.error('Apartment renderer could not start.', error);
  viewport.querySelector('canvas')?.remove();
  $('fallback').hidden = false;
  for (const button of [...viewButtons, $('reset')]) button.disabled = true;
}

import('./portal.js').then(({ makePortal }) => {
  portal = makePortal({
    rooms: ROOMS,
    plan: APARTMENT_PLAN,
    browserLocal: import.meta.env.MODE !== 'server',
    selectRoom,
    showPlan: () => setView('plan'),
    redraw: () => sceneView?.render(),
    canPlace: () => Boolean(sceneView && $('fallback').hidden),
    currentRoom: () => selection,
  });
});
selectRoom(null);
