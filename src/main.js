import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { APARTMENT_PLAN, ROOMS, makeApartment } from './model.js';
import { JOINERY, RAIL_CLEARANCE_MM, STANDING_DEPTH_MM, GARMENT_ALLOWANCE_MM } from './wardrobe.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const wallButtons = [...document.querySelectorAll('[data-walls]')];
const roomButtons = new Map();
const labels = new Map();
let selection = null;
let view = 'orbit';
let wallsVisible = false;
let focusedRoom = null;
let sceneView;
let portal;

function element(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

const interiorShots = {
  master: [[3.32, 1.35, 2.90], [1.91, .67, .96]],
  work: [[1.44, 1.27, 8.16], [2.85, .65, 9.85]],
  bath: [[4.17, 1.36, 1.99], [5.13, .85, .92]],
  kitchen: [[4.06, 1.46, 4.20], [5.87, 1.03, 3.33]],
  dining: [[3.07, 1.45, 6.13], [5.33, .95, 4.88]],
  living: [[3.48, 1.43, 6.30], [1.48, 1.05, 4.12]],
};

const roomNotes = {
  master: 'The render shows a teak platform bed, terracotta headboard and fitted storage.',
  bath: 'Vanity, shower and sanitary fittings follow the render as visual references.',
  kitchen: 'Olive base units, a granite worktop and teak upper cabinets.',
  dining: 'Granite-topped island with two stools, based on the furniture plan.',
  living: 'Baltimore teak media joinery and two concealed doors. P1 has 20 mm ribs and 20 mm spacing. P2 has integrated display shelves, gold retainers and a Marshmallow White reverse.',
  work: 'Angled alcove with daybed, fitted storage and a desk.',
  wic: `2,022 × 2,157 mm bay · 2,610 mm ceiling. Proposed ${RAIL_CLEARANCE_MM} mm rail-to-rack gap. The shaded zone leaves ${STANDING_DEPTH_MM} mm in front of the rack after a ${GARMENT_ALLOWANCE_MM} mm clothing allowance. Check this tighter standing space on site.`,
};

const references = {
  master: ['master', 'master-detail'],
  bath: ['bath'],
  kitchen: ['kitchen', 'kitchen-detail'],
  dining: ['kitchen', 'living'],
  living: ['living', 'living-detail', 'door-p1', 'door-p2', 'door-p2-detail'],
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
  $('focus-doors').hidden = id !== 'living' || !sceneView;
  $('focus-room').hidden = !id || id === 'wic' || !sceneView;
  referenceIndex = 0;
  renderReference();
  $('room-title').textContent = ROOMS[id]?.name ?? 'Apartment overview';
  $('room-note').textContent = roomNotes[id] ?? 'Select a room to see its original design render and notes.';
  $('joinery').hidden = id !== 'wic';
  for (const [roomId, button] of roomButtons) {
    button.setAttribute('aria-pressed', String(roomId === id));
    labels.get(roomId).classList.toggle('active', roomId === id);
  }
  sceneView?.model.highlight(id, Boolean(interiorShots[focusedRoom]));
  sceneView?.render();
}

const isClosetView = () => view === 'wic' || view === 'wic-plan';
const isPlanView = () => view === 'plan' || view === 'wic-plan';

function setView(next) {
  portal?.cancelPlacement();
  view = next;
  focusedRoom = null;
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
$('focus-room').addEventListener('click', () => {
  if (!selection || selection === 'wic') return;
  setView('orbit');
  focusedRoom = selection;
  sceneView?.frame();
  viewport.scrollIntoView({ block: 'center' });
});
$('focus-doors').addEventListener('click', () => {
  setView('orbit');
  focusedRoom = 'doors';
  referenceIndex = 2;
  renderReference();
  sceneView?.frame();
  viewport.scrollIntoView({ block: 'center' });
});
for (const button of wallButtons) button.addEventListener('click', () => {
  wallsVisible = button.dataset.walls === 'on';
  for (const option of wallButtons) option.setAttribute('aria-pressed', String(option === button));
  sceneView?.model.showWalls(wallsVisible, isClosetView());
  sceneView?.render();
});
$('reset').addEventListener('click', () => {
  if (!isClosetView()) selectRoom(null);
  setView(view);
});

function initialise() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor('#eae7de');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '3D apartment floor plan. Choose a room using the room list.');
  canvas.setAttribute('role', 'img');
  viewport.prepend(canvas);

  const planCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 100);
  const interiorCamera = new THREE.PerspectiveCamera(61, 1, .035, 70);
  let camera = planCamera;
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, .12).texture;
  scene.environmentIntensity = .57;
  environment.dispose();
  pmrem.dispose();
  const model = makeApartment();
  scene.add(model.root);
  scene.add(new THREE.HemisphereLight('#f6f8ff', '#b5a18e', .98));
  const sun = new THREE.DirectionalLight('#fff8ee', 2.35);
  sun.position.set(-6, 15, 1.8);
  sun.target.position.set(3, 0, 5.5);
  sun.castShadow = true;
  const shadow = sun.shadow;
  Object.assign(shadow.camera, { left: -7.5, right: 7.5, top: 8, bottom: -8, near: .5, far: 40 });
  shadow.camera.updateProjectionMatrix();
  shadow.mapSize.set(1536, 1536);
  shadow.normalBias = .011;
  shadow.radius = 2.7;
  scene.add(sun, sun.target);
  const lampPositions = [[5.56, 1.33, 3.45], [2.32, .69, .28], [2.27, 1.73, 3.22], [4.42, 1.36, .51]];
  for (const position of lampPositions) {
    const bounce = new THREE.PointLight('#ffcf9d', 3.1, 1.4, 2);
    bounce.position.set(...position);
    scene.add(bounce);
  }
  const controls = new OrbitControls(camera, canvas);
  controls.minZoom = .55;
  controls.maxZoom = 4;
  controls.minDistance = .40;
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
      label.hidden = isClosetView() || Boolean(focusedRoom) || portal?.placing || !position.visible;
      label.style.left = position.left;
      label.style.top = position.top;
    }
    portal?.renderPins((x, z) => {
      const position = project(x, z, isPlanView() ? .05 : .17);
      if (focusedRoom) position.visible = false;
      return position;
    }, isClosetView() ? 'wic' : null);
  }

  function frame() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    const detail = isClosetView();
    const top = isPlanView();
    const shot = interiorShots[focusedRoom];
    model.focusCloset(detail, view === 'wic-plan');
    model.showFurniture(view === 'orbit', focusedRoom === 'doors');
    model.showWalls(wallsVisible, detail);
    renderer.shadowMap.needsUpdate = true;
    model.highlight(selection, Boolean(shot));
    controls.enableRotate = !top;
    controls.mouseButtons.LEFT = top ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = top ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    if (shot) {
      camera = interiorCamera;
      controls.object = camera;
      const [position, target] = shot;
      camera.aspect = width / height;
      camera.fov = camera.aspect < .9 ? 72 : 61;
      camera.position.set(...position);
      controls.target.set(...target);
      camera.updateProjectionMatrix();
      controls.update();
      renderer.toneMappingExposure = 1.23;
      render();
      return;
    }
    camera = planCamera;
    controls.object = camera;
    renderer.toneMappingExposure = 1.14;
    const focusFloor = focusedRoom && model.floors.get(focusedRoom);
    const doors = focusedRoom === 'doors';
    const doorBounds = new THREE.Box3(new THREE.Vector3(2.88, 0, 7.33), new THREE.Vector3(4.98, 2.64, 7.69));
    const bounds = detail ? model.detailBounds : doors ? doorBounds : focusFloor
      ? new THREE.Box3().setFromObject(focusFloor).expandByVector(new THREE.Vector3(.30, .12, .30))
      : model.overviewBounds;
    if (focusFloor && !detail) bounds.max.y = 1.75;
    const target = bounds.getCenter(new THREE.Vector3());
    const offset = top ? [0, 22, detail ? -.001 : .001] : detail ? [-11, 15, .4] : doors ? [-2, 2.1, -12] : [-10, 20, -15];
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
  const assetStatus = $('asset-status');
  assetStatus.hidden = false;
  assetStatus.textContent = 'Loading furniture assets…';
  model.loadFurniture().then((failures) => {
    assetStatus.hidden = failures === 0;
    assetStatus.textContent = failures ? 'Some furniture could not load. Refresh to retry.' : '';
    renderer.shadowMap.needsUpdate = true;
    render();
  });
  return { model, frame, render };
}

try {
  sceneView = initialise();
} catch (error) {
  console.error('Apartment renderer could not start.', error);
  viewport.querySelector('canvas')?.remove();
  $('fallback').hidden = false;
  for (const button of [...viewButtons, ...wallButtons, $('reset')]) button.disabled = true;
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
