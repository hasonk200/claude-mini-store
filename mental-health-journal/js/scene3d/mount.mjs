// The one place the rest of the app talks to: "show this scene in this container".
// Everything 3D is progressive enhancement. Callers always build their normal DOM; when 3D
// is available the canvas slides in behind it, and when it is not (no WebGL2, switched off,
// quiet mode, a lost context) nothing here runs and the 2D artwork stays exactly as before.
import { state } from '../state.mjs';
import { SCENE3D_KEY } from '../shared/storage-keys.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { toast } from '../shared/controls.mjs';
import { resolve3D, readEnvironment, normalizeSetting } from './support.mjs';
import {
  loadThree,
  loadedThree,
  getRenderer,
  onContextLost,
  contextLost,
  rendererInfo,
} from './renderer.mjs';
import { createLoop } from './loop.mjs';
import { syncOverlay, resetOverlay, projectPoint } from './overlay.mjs';
import { spotPosition } from './layout.mjs';
import { forwardClicks } from './picking.mjs';
import { palette } from './palette.mjs';

const SCENES = {
  home: () => import('./scenes/home.mjs'),
  park: () => import('./scenes/park.mjs'),
  cafe: () => import('./scenes/cafe.mjs'),
  lake: () => import('./scenes/lake.mjs'),
  street: () => import('./scenes/street.mjs'),
  island: () => import('./scenes/island.mjs'),
  haven: () => import('./scenes/haven.mjs'),
};
// The places a pet can go out to that have a 3D scene.
const OUTING_SCENES = ['park', 'cafe', 'lake', 'street'];
const loadedScenes = {};
const radians = (degrees) => (degrees * Math.PI) / 180;

let current = null,
  pendingToken = 0,
  loadFailed = false,
  fallback = () => {};

// The choice lives only on this device: it is never written to state or synced.
function local3DSetting() {
  try {
    return normalizeSetting(localStorage.getItem(SCENE3D_KEY));
  } catch (err) {
    return 'auto';
  }
}

function setLocal3DSetting(value) {
  try {
    localStorage.setItem(SCENE3D_KEY, normalizeSetting(value));
    return true;
  } catch (err) {
    return false;
  }
}

function use3D() {
  return resolve3D({
    ...readEnvironment(),
    setting: local3DSetting(),
    quiet: !!state.settings.quiet,
    failed: loadFailed || contextLost(),
  });
}

function draw() {
  if (!current) return;
  const { THREE } = loadedThree();
  getRenderer().render(current.scene.scene, current.scene.camera);
  syncOverlay(THREE, current.scene.camera, current.container, current.scene.anchors());
}

function resize() {
  if (!current) return;
  const width = current.container.clientWidth,
    height = current.container.clientHeight;
  if (!width || !height) return;
  const { scene, controls } = current;
  getRenderer().setSize(width, height, false);
  const view = scene.frame(width, height);
  // Keep the angle the user has turned to; only the distance and focus follow the size.
  const offset = scene.camera.position.clone().sub(controls.target).setLength(view.distance);
  controls.target.set(...view.target);
  scene.camera.position.copy(controls.target).add(offset);
  controls.minDistance = controls.maxDistance = view.distance;
  controls.update();
  draw();
}

function attach(container) {
  const canvas = getRenderer().domElement;
  const moved = current.container !== container || canvas.parentElement !== container;
  if (current.container !== container) current.container.classList.remove('is-3d');
  current.container = container;
  container.classList.add('is-3d');
  for (const flat of container.querySelectorAll(':scope > svg.scene')) flat.remove();
  if (!moved) return;
  container.prepend(canvas);
  current.observer.disconnect();
  current.observer.observe(container);
  resize();
}

function create(kind, container, reducedMotion) {
  const { THREE, OrbitControls } = loadedThree();
  const canvas = getRenderer().domElement;
  let loop = null;
  const scene = loadedScenes[kind].createScene({
    THREE,
    renderer: getRenderer(),
    palette,
    reducedMotion,
    requestRender: () => loop && loop.requestRender(),
  });
  loop = createLoop({
    render: draw,
    tick: (dt) => scene.tick(dt),
    busy: () => scene.busy(),
    ambient: () => scene.ambient(),
    reducedMotion,
  });
  // A gentle look-around: a little left and right, a little up and down, no zoom or pan.
  const setup = scene.cameraSetup;
  const controls = new OrbitControls(scene.camera, canvas);
  controls.target.set(...setup.target);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.rotateSpeed = 0.45;
  controls.minAzimuthAngle = radians(setup.azimuth - setup.azimuthRange);
  controls.maxAzimuthAngle = radians(setup.azimuth + setup.azimuthRange);
  controls.minPolarAngle = radians(setup.polarMin);
  controls.maxPolarAngle = radians(setup.polarMax);
  controls.enabled = !reducedMotion;
  controls.addEventListener('change', () => loop.requestRender());
  // Vertical swipes still scroll the page on touch screens.
  canvas.style.touchAction = 'pan-y';
  current = {
    kind,
    container,
    scene,
    loop,
    controls,
    reducedMotion,
    observer: new ResizeObserver(resize),
    stopClicks: forwardClicks(
      canvas,
      () => current && current.scene,
      () => current && current.container,
    ),
  };
  container.classList.add('is-3d');
  for (const flat of container.querySelectorAll(':scope > svg.scene')) flat.remove();
  container.prepend(canvas);
  current.observer.observe(container);
  resize();
  loop.start();
}

// Shows `kind` in `container`. Returns true when the 3D scene is live right now; false
// means the caller's 2D markup is what the user sees (possibly only until three.js loads).
function mount3D(kind, container, makeSnapshot) {
  if (!container || !SCENES[kind] || !use3D()) {
    unmount3D();
    return false;
  }
  const reducedMotion = prefersReducedMotion();
  if (current && (current.kind !== kind || current.reducedMotion !== reducedMotion)) unmount3D();
  if (!current) {
    if (!loadedThree() || !loadedScenes[kind]) {
      const token = ++pendingToken;
      Promise.all([loadThree(), SCENES[kind]()])
        .then(([, module]) => {
          loadedScenes[kind] = module;
          if (token === pendingToken && container.isConnected)
            mount3D(kind, container, makeSnapshot);
        })
        .catch(() => {
          // three.js or the scene could not be fetched: stay in 2D for this visit.
          loadFailed = true;
          fallback();
        });
      return false;
    }
    create(kind, container, reducedMotion);
  } else attach(container);
  current.scene.update(makeSnapshot());
  draw();
  current.loop.requestRender();
  return true;
}

// True when `mount3D(kind, …)` would be live immediately, so callers can skip building
// the 2D artwork they are about to cover.
const ready3D = (kind) => !!(loadedThree() && loadedScenes[kind]) && use3D();

// The live scene of this kind, or null when the 2D version is showing.
const scene3D = (kind) => (current && current.kind === kind ? current.scene : null);

function unmount3D(kind) {
  pendingToken++;
  if (!current || (kind && current.kind !== kind)) return;
  const { scene, loop, controls, observer, stopClicks, container } = current;
  current = null;
  loop.stop();
  controls.dispose();
  observer.disconnect();
  stopClicks();
  resetOverlay(container, scene.anchors());
  scene.dispose();
  getRenderer().domElement.remove();
  container.classList.remove('is-3d');
  for (const fx of container.querySelectorAll('.fx')) fx.style.transform = '';
}

// Called with a function that redraws the current page in 2D.
function initializeScene3D({ onFallback }) {
  fallback = onFallback;
  onContextLost(() => {
    unmount3D();
    toast('3D 暫時載入唔到，已轉返平面版。');
    fallback();
  });
  // Read-only diagnostics for the docs and the browser tests.
  window.JournalScene3D = {
    info: rendererInfo,
    live: () => (current ? current.kind : null),
    use3D,
    describe: () => (current ? current.scene.describe() : null),
    // Where a point of the scene (or a home pet spot) currently is, in viewport pixels.
    pointOnPage(point) {
      if (!current) return null;
      const { container, scene } = current;
      const box = container.getBoundingClientRect();
      const p = projectPoint(loadedThree().THREE, scene.camera, point, box.width, box.height);
      return { x: box.left + p.x, y: box.top + p.y };
    },
    spotOnPage(spotId) {
      return this.pointOnPage(spotPosition(spotId));
    },
  };
}

export {
  mount3D,
  unmount3D,
  ready3D,
  scene3D,
  use3D,
  local3DSetting,
  setLocal3DSetting,
  initializeScene3D,
  OUTING_SCENES,
};
