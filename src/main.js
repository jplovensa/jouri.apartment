import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROOMS, makeApartment } from './model.js';
import { JOINERY } from './wardrobe.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const roomButtons = new Map();
const labels = new Map();
let selection = null;
let view = 'orbit';
let sceneView;

function element(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

const roomNotes = {
  master: 'At the residential end of the apartment, beside the bathroom.',
  bath: 'Between the main bedroom and kitchen. Fixtures are shown schematically.',
  kitchen: 'The floor plan shows a counter along the right-hand wall. Fixtures are schematic.',
  dining: 'Part of the open-plan kitchen, dining and living area.',
  living: 'The main open room between the bedroom and working room.',
  work: 'The room beside the walk-in closet, with the angled exterior wall.',
  wic: 'Main bay 2,022 × 2,157 mm. Ceiling 2,610 mm. SD-01 is for production review.',
};

function selectRoom(id) {
  selection = id;
  $('room-title').textContent = ROOMS[id]?.name ?? 'Apartment overview';
  $('room-note').textContent = roomNotes[id] ?? 'Select a room in the model or the list to see its drawing notes.';
  $('joinery').hidden = id !== 'wic';
  for (const [roomId, button] of roomButtons) {
    button.setAttribute('aria-pressed', String(roomId === id));
    labels.get(roomId).classList.toggle('active', roomId === id);
  }
  sceneView?.model.highlight(id);
  sceneView?.render();
}

function setView(next) {
  view = next;
  if (view === 'wic') selectRoom('wic');
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  $('controls-hint').textContent = view === 'plan'
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
    if (view === 'wic' && id !== 'wic') setView('orbit');
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
  if (view !== 'wic') selectRoom(null);
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
  function render() {
    renderer.render(scene, camera);
    for (const [id, label] of labels) {
      const [x, z] = ROOMS[id].label;
      point.set(x, .035, z).project(camera);
      label.hidden = view === 'wic' || Math.abs(point.x) > .93 || Math.abs(point.y) > .93;
      label.style.left = `${(point.x + 1) * 50}%`;
      label.style.top = `${(1 - point.y) * 50}%`;
    }
  }

  function frame() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    const detail = view === 'wic';
    const top = view === 'plan';
    model.focusCloset(detail);
    const bounds = detail ? model.detailBounds : model.overviewBounds;
    const target = bounds.getCenter(new THREE.Vector3());
    const offset = top ? [0, 22, .001] : detail ? [-9, 10, 6.5] : [-10, 20, -15];
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
    if (view === 'wic' || !start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects([...model.floors.values()], false)[0];
    if (hit) selectRoom(hit.object.userData.room);
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
