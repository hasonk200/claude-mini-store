// One WebGL renderer and canvas for the whole site. Scenes borrow it and the canvas is
// moved between containers, so the browser's limit on WebGL contexts is never an issue.
// three.js itself is only downloaded the first time a 3D scene is actually shown.

const MAX_PIXEL_RATIO = 1.75;

let three = null,
  loading = null,
  renderer = null,
  lost = false;
const lostHandlers = new Set();

function loadThree() {
  loading ||= Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]).then(
    ([THREE, controls]) => {
      three = { THREE, OrbitControls: controls.OrbitControls };
      return three;
    },
  );
  return loading;
}

const loadedThree = () => three;
const contextLost = () => lost;

function getRenderer() {
  if (renderer) return renderer;
  const { THREE } = three;
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  const canvas = renderer.domElement;
  canvas.className = 'scene3d';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    for (const handler of [...lostHandlers]) handler();
  });
  return renderer;
}

function onContextLost(handler) {
  lostHandlers.add(handler);
  return () => lostHandlers.delete(handler);
}

// Numbers the docs and browser tests read: what is on the GPU and what a frame costs.
function rendererInfo() {
  if (!renderer) return null;
  const { memory, render } = renderer.info;
  return {
    geometries: memory.geometries,
    textures: memory.textures,
    calls: render.calls,
    triangles: render.triangles,
  };
}

export {
  MAX_PIXEL_RATIO,
  loadThree,
  loadedThree,
  getRenderer,
  onContextLost,
  contextLost,
  rendererInfo,
};
