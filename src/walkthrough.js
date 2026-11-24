import { createWalkSpace } from './navigation.js';

const mapping = new Map([
  ['KeyW', 'forward'], ['ArrowUp', 'forward'], ['KeyS', 'back'], ['ArrowDown', 'back'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyQ', 'turn-left'], ['KeyE', 'turn-right'],
]);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function makeWalkthrough({ plan, camera, viewport, canvas, panel, render, roomChanged }) {
  const space = createWalkSpace(plan);
  const pressed = new Map();
  const joystick = panel.querySelector('.walk-stick');
  let position;
  let yaw = 0;
  const initialPitch = -.15;
  let pitch = initialPitch;
  let active = false;
  let previous = 0;
  let animation = 0;
  let look;
  let currentRoom;
  let stickPointer;
  let stickSide = 0;
  let stickForward = 0;

  const hasInput = () => pressed.size || stickSide || stickForward;

  function sync() {
    camera.position.set(position.x, 1.61, position.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);
    const room = space.roomAt(position.x, position.z);
    if (room && room !== currentRoom) {
      currentRoom = room;
      roomChanged(room);
    }
    render();
  }

  function step(inputs, dt) {
    const forward = Number(inputs.has('forward')) - Number(inputs.has('back')) + stickForward;
    const side = Number(inputs.has('right')) - Number(inputs.has('left')) + stickSide;
    const turn = Number(inputs.has('turn-left')) - Number(inputs.has('turn-right'));
    yaw += turn * dt * 1.68;
    if (forward || side) {
      const distance = 1.45 * dt / Math.max(1, Math.hypot(forward, side));
      position = space.move(position, distance * (-Math.sin(yaw) * forward + Math.cos(yaw) * side),
        -distance * (Math.cos(yaw) * forward + Math.sin(yaw) * side));
    }
    sync();
  }

  function move(now) {
    animation = 0;
    if (!active || !hasInput()) return;
    const dt = previous ? Math.min((now - previous) / 1000, .05) : .016;
    previous = now;
    step(new Set(pressed.values()), dt);
    animation = requestAnimationFrame(move);
  }

  function clear() {
    pressed.clear();
    resetStick();
    look = null;
    previous = 0;
    if (animation) cancelAnimationFrame(animation);
    animation = 0;
  }

  function startInput(id, action) {
    if (pressed.has(id)) return;
    const first = !hasInput();
    pressed.set(id, action);
    if (first) step(new Set([action]), .06);
    if (!animation) animation = requestAnimationFrame(move);
  }
  function endInput(id) {
    pressed.delete(id);
    if (!hasInput()) previous = 0;
  }

  viewport.addEventListener('keydown', (event) => {
    if (!active || !mapping.has(event.code)) return;
    event.preventDefault();
    startInput(event.code, mapping.get(event.code));
  });
  window.addEventListener('keyup', (event) => endInput(event.code));
  window.addEventListener('blur', clear);
  viewport.addEventListener('focusout', (event) => {
    if (!viewport.contains(event.relatedTarget)) clear();
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!active || look || event.button !== 0) return;
    viewport.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    look = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!active || look?.id !== event.pointerId) return;
    yaw -= (event.clientX - look.x) * .0043;
    pitch = clamp(pitch - (event.clientY - look.y) * .0043, -1.24, 1.24);
    look = { id: event.pointerId, x: event.clientX, y: event.clientY };
    sync();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, (event) => { if (look?.id === event.pointerId) look = null; });
  }

  function drawStick(x, y) {
    joystick.style.setProperty('--stick-x', `${x}px`);
    joystick.style.setProperty('--stick-y', `${y}px`);
  }

  function resetStick() {
    stickPointer = undefined;
    stickSide = stickForward = 0;
    drawStick(0, 0);
    if (!hasInput()) previous = 0;
  }

  function updateStick(event) {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * .30;
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(x, y);
    const limit = Math.min(1, radius / Math.max(1, distance));
    drawStick(x * limit, y * limit);
    const strength = clamp((distance / radius - .13) / .87, 0, 1) / Math.max(1, distance);
    stickSide = x * strength;
    stickForward = -y * strength;
    if (!hasInput()) previous = 0;
    else if (!animation) animation = requestAnimationFrame(move);
  }

  joystick.addEventListener('pointerdown', (event) => {
    if (!active || stickPointer !== undefined || event.button !== 0) return;
    event.preventDefault();
    joystick.focus({ preventScroll: true });
    joystick.setPointerCapture(event.pointerId);
    stickPointer = event.pointerId;
    updateStick(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (stickPointer === event.pointerId) updateStick(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joystick.addEventListener(type, (event) => {
      if (stickPointer === event.pointerId) resetStick();
    });
  }

  function jump(room = 'entry') {
    const start = space.start(room);
    if (!start) return false;
    position = start;
    yaw = start.yaw;
    pitch = initialPitch;
    sync();
    return true;
  }

  return {
    enter() {
      active = true;
      panel.hidden = false;
      viewport.classList.add('in-walkthrough');
      viewport.setAttribute('tabindex', '0');
      viewport.focus({ preventScroll: true });
      if (position && space.canStand(position.x, position.z)) sync();
      else jump();
    },
    leave() {
      active = false;
      clear();
      panel.hidden = true;
      viewport.classList.remove('in-walkthrough');
      viewport.removeAttribute('tabindex');
    },
    resize(width, height) {
      camera.aspect = width / height;
      camera.fov = camera.aspect < .9 ? 76 : 67;
      camera.updateProjectionMatrix();
      if (position) sync();
    },
    jump,
    setFurniture(obstacles) {
      space.setFurniture(obstacles);
      if (active && position && !space.canStand(position.x, position.z)) jump(currentRoom) || jump();
    },
  };
}
