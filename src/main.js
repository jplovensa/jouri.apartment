import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeWalkthrough } from './walkthrough.js';
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
let interiorWallsVisible = true;
let focusedRoom = null;
let sceneView;
let portal;

function element(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

const interiorShots = {
  master: [[3.28, 1.47, 2.95], [1.91, .72, .96]],
  work: [[2.72, 1.44, 8.04], [2.38, 1.03, 9.89]],
  bath: [[4.17, 1.36, 1.99], [5.13, .85, .92]],
  kitchen: [[3.91, 1.52, 3.85], [5.88, 1.32, 4.07]],
  dining: [[3.17, 1.53, 6.32], [5.35, 1.15, 5.04]],
  living: [[3.48, 1.45, 5.58], [.65, 1.12, 5.80]],
  entry: [[4.06, 1.42, 6.20], [5.76, 1.10, 6.61]],
};

const roomNotes = {
  master: 'Teak platform, ivory bedding and a two-panel window on the balcony wall. The bed GLB includes the fitted frame and bedding.',
  bath: 'Vanity, shower and sanitary fittings follow the render as visual references.',
  kitchen: 'Olive base units and Amarillo granite lead to the refrigerator in the 589 mm F3 bay between the dispenser and the lit end cabinet.',
  dining: 'The 1,500 × 550 mm island has a raised Amarillo pass and two stools on the living-room side. The door position follows the traced opening, with a provisional leaf height and hardware.',
  living: 'Three-panel facade window, Baltimore teak joinery and a two-seat sofa beside the guestroom. P1 is ribbed teak. P2 has display shelves, gold retainers and a Marshmallow White reverse.',
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
  $('focus-entry').hidden = id !== 'dining' || !sceneView;
  $('bed-download').hidden = id !== 'master';
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
  sceneView?.model.highlight(id, Boolean(interiorShots[focusedRoom]) || isWalkView());
  sceneView?.render();
}

const isClosetView = () => view === 'wic' || view === 'wic-plan';
const isPlanView = () => view === 'plan' || view === 'wic-plan';
const isWalkView = () => view === 'walk';

function setView(next) {
  portal?.cancelPlacement();
  view = next;
  focusedRoom = null;
  if (isClosetView()) selectRoom('wic');
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  $('reset').textContent = isWalkView() ? 'Back to entrance' : 'Reset view';
  $('controls-hint').textContent = isWalkView()
    ? 'Joystick, WASD or arrows to move · Drag the view or use Q/E to look · Select a room to jump'
    : isPlanView()
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
    if (isWalkView()) {
      sceneView?.jumpWalk(id);
      return;
    }
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
$('focus-entry').addEventListener('click', () => {
  setView('orbit');
  focusedRoom = 'entry';
  interiorWallsVisible = true;
  sceneView?.frame();
  viewport.scrollIntoView({ block: 'center' });
});

function updateWallVisibility(model) {
  const isInterior = Boolean(interiorShots[focusedRoom]);
  const visible = isWalkView() || (isInterior ? interiorWallsVisible : wallsVisible);
  for (const option of wallButtons) {
    option.disabled = isWalkView();
    option.setAttribute('aria-pressed', String(visible === (option.dataset.walls === 'on')));
  }
  model?.showWalls(visible, isClosetView(), isInterior ? (focusedRoom === 'entry' ? 'dining' : focusedRoom) : undefined);
}

for (const button of wallButtons) button.addEventListener('click', () => {
  if (interiorShots[focusedRoom]) interiorWallsVisible = button.dataset.walls === 'on';
  else wallsVisible = button.dataset.walls === 'on';
  updateWallVisibility(sceneView?.model);
  sceneView?.lightChanged();
});
$('reset').addEventListener('click', () => {
  if (isWalkView()) {
    sceneView?.jumpWalk('entry');
    return;
  }
  if (!isClosetView()) selectRoom(null);
  setView(view);
});

function initialise() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor('#e8e7e2');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '3D apartment floor plan. Choose a room using the room list.');
  canvas.setAttribute('role', 'img');
  viewport.prepend(canvas);

  const planCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .05, 100);
  const interiorCamera = new THREE.PerspectiveCamera(61, 1, .035, 70);
  const walkCamera = new THREE.PerspectiveCamera(67, 1, .05, 45);
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
  scene.add(new THREE.HemisphereLight('#f4f7ff', '#ac9b88', .72));
  const sun = new THREE.DirectionalLight('#fff3df', 2.05);
  sun.position.set(-10, 8.2, 3.2);
  sun.target.position.set(3, 0, 5.5);
  sun.castShadow = true;
  const shadow = sun.shadow;
  Object.assign(shadow.camera, { left: -7.5, right: 7.5, top: 8, bottom: -8, near: .5, far: 40 });
  shadow.camera.updateProjectionMatrix();
  shadow.mapSize.set(2048, 2048);
  shadow.bias = -.00013;
  shadow.normalBias = .017;
  shadow.radius = 3.1;
  scene.add(sun, sun.target);
  // Low-intensity cool fill suggests bounced daylight at the two facade windows.
  for (const z of [1.36, 5.58]) {
    const bounce = new THREE.PointLight('#e9f0fb', .94, 4.4, 2);
    bounce.position.set(.88, 1.94, z);
    scene.add(bounce);
  }
  const lampPositions = [
    [5.81, 1.39, 3.0, .66], [5.80, 1.39, 3.78, .71], [5.61, 1.94, 5.65, .31],
    [1.69, .92, .07, .24], [2.28, .92, .07, .33],
    [2.90, .92, .07, .24], [2.27, 1.73, 3.22, 1.15], [4.42, 1.36, .51, .88],
  ];
  for (const [x, y, z, intensity] of lampPositions) {
    const bounce = new THREE.PointLight('#ffcf9d', intensity, 1.2, 2);
    bounce.position.set(x, y, z);
    scene.add(bounce);
  }
  const controls = new OrbitControls(camera, canvas);
  controls.minZoom = .55;
  controls.maxZoom = 4;
  controls.minDistance = .40;
  controls.maxPolarAngle = Math.PI * .49;
  controls.minPolarAngle = 0;

  let walking = false;
  const walkthrough = makeWalkthrough({
    plan: APARTMENT_PLAN, camera: walkCamera, viewport, canvas, panel: $('walk-panel'), render,
    roomChanged(room) {
      $('walk-room').textContent = ROOMS[room].name;
      selectRoom(room);
    },
  });
  walkthrough.setFurniture(model.walkObstacles());
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
    if (isWalkView()) return;
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
    const walk = isWalkView();
    controls.enabled = !walk;
    model.setWalking(walk);
    model.focusCloset(detail, view === 'wic-plan');
    model.showFurniture(view === 'orbit' || walk, focusedRoom);
    updateWallVisibility(model);
    renderer.shadowMap.needsUpdate = true;
    model.highlight(selection, Boolean(shot) || walk);
    if (walk) {
      camera = walkCamera;
      renderer.toneMappingExposure = 1.08;
      $('labels').hidden = $('map-pins').hidden = true;
      if (!walking) walkthrough.enter();
      walking = true;
      walkthrough.resize(width, height);
      return;
    }
    if (walking) walkthrough.leave();
    walking = false;
    $('labels').hidden = $('map-pins').hidden = false;
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
      renderer.toneMappingExposure = 1.08;
      render();
      return;
    }
    camera = planCamera;
    controls.object = camera;
    renderer.toneMappingExposure = 1.10;
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
    if (isWalkView() || isClosetView() || !start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
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
    walkthrough.setFurniture(model.walkObstacles());
    renderer.shadowMap.needsUpdate = true;
    render();
  });
  return {
    model, frame, render,
    lightChanged() { renderer.shadowMap.needsUpdate = true; render(); },
    jumpWalk(room) { walkthrough.jump(room); viewport.focus({ preventScroll: true }); },
  };
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
