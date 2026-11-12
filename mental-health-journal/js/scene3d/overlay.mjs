// Keeps the real DOM controls (pet buttons, egg nest, effects) lined up with the 3D scene.
// The canvas is decorative; these buttons are what keyboards and screen readers use.

// Smallest comfortable touch target, in CSS pixels.
const MIN_TARGET = 44;

// Screen position of a world point, plus how many pixels one world unit covers there.
function projectPoint(THREE, camera, point, width, height, scratch = new THREE.Vector3()) {
  scratch.set(point.x, point.y, point.z);
  const depth = scratch.clone().applyMatrix4(camera.matrixWorldInverse).z;
  scratch.project(camera);
  const unit = height / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.01, -depth));
  return { x: ((scratch.x + 1) / 2) * width, y: ((1 - scratch.y) / 2) * height, unit };
}

// Each anchor names the element it drives (`selector`, looked up inside the container) and
// how to fit it (`kind`):
//   pet  – a pet button: covers just the pet, its hidden SVG keeps the 2D art's square box
//   box  – a plain square centred on the point (the egg nest, an NPC)
//   pin  – a control floating above the point (map stops)
function syncOverlay(THREE, camera, container, anchors) {
  const width = container.clientWidth,
    height = container.clientHeight;
  if (!width || !height) return;
  camera.updateMatrixWorld();
  for (const anchor of anchors) {
    const element = container.querySelector(anchor.selector);
    if (!element) continue;
    const p = projectPoint(THREE, camera, anchor, width, height);
    const size = anchor.size * p.unit;
    if (anchor.kind === 'pin') {
      element.style.left = (p.x / width) * 100 + '%';
      element.style.top = (p.y / height) * 100 + '%';
      continue;
    }
    if (anchor.kind === 'box') {
      // `lift` is how far above its bottom edge the element's feet sit (5% for pet art).
      element.style.left = p.x - size / 2 + 'px';
      element.style.right = 'auto';
      element.style.bottom = height - p.y - size * (anchor.lift ?? 0.12) + 'px';
      element.style.width = size + 'px';
      continue;
    }
    // The button covers just the pet. Its (invisible) SVG keeps the full square box of the
    // 2D art, feet 5% above the bottom edge, which is what the speech bubble aims at.
    element.style.left = p.x + 'px';
    element.style.bottom = height - p.y + 'px';
    element.style.width = Math.max(MIN_TARGET, anchor.width * p.unit) + 'px';
    element.style.height = Math.max(MIN_TARGET, anchor.height * p.unit) + 'px';
    element.style.setProperty('--pet-box', size + 'px');
    if (anchor.fx) {
      // Floating hearts and sparkles rise from around this pet instead of mid-stage.
      const fx = container.querySelector(anchor.fx);
      if (fx)
        fx.style.transform =
          'translate(' + (p.x - width / 2) + 'px,' + (p.y - size * 0.3 - height * 0.69) + 'px)';
    }
  }
}

export { projectPoint, syncOverlay };
