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

function syncOverlay(THREE, camera, container, anchors) {
  const width = container.clientWidth,
    height = container.clientHeight;
  if (!width || !height) return;
  camera.updateMatrixWorld();
  for (const anchor of anchors) {
    const p = projectPoint(THREE, camera, anchor, width, height);
    const size = anchor.size * p.unit;
    if (anchor.id === 'nest') {
      const nest = container.querySelector('#nest');
      if (!nest) continue;
      nest.style.left = p.x - size / 2 + 'px';
      nest.style.bottom = height - p.y - size * 0.12 + 'px';
      nest.style.width = size + 'px';
      continue;
    }
    const button = container.querySelector(
      '.on-stage[data-pid="' + CSS.escape(anchor.id.slice(4)) + '"]',
    );
    if (!button) continue;
    // The button covers just the pet. Its (invisible) SVG keeps the full square box of the
    // 2D art, feet 5% above the bottom edge, which is what the speech bubble aims at.
    button.style.left = p.x + 'px';
    button.style.bottom = height - p.y + 'px';
    button.style.width = Math.max(MIN_TARGET, anchor.width * p.unit) + 'px';
    button.style.height = Math.max(MIN_TARGET, anchor.height * p.unit) + 'px';
    button.style.setProperty('--pet-box', size + 'px');
    if (!button.classList.contains('other')) {
      // Floating hearts and sparkles rise from around the main pet instead of mid-stage.
      const fx = container.querySelector('#fx');
      if (fx)
        fx.style.transform =
          'translate(' + (p.x - width / 2) + 'px,' + (p.y - size * 0.3 - height * 0.69) + 'px)';
    }
  }
}

export { projectPoint, syncOverlay };
