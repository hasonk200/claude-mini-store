// Pointer helpers: convert a pointer position into the normalised device coordinates the
// scenes raycast with, and forward clicks on the canvas to the matching real button.

function toNDC(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

// A click that lands on the 3D pet just outside its DOM button still counts: the scene
// says what was hit and the existing button handler does the rest.
function forwardClicks(canvas, getScene, getContainer) {
  let downX = 0,
    downY = 0;
  const onDown = (event) => {
    downX = event.clientX;
    downY = event.clientY;
  };
  const onClick = (event) => {
    const scene = getScene(),
      container = getContainer();
    if (!scene || !container) return;
    // Turning the camera ends with a click too; that is not a tap on a pet.
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
    const hit = scene.pick(toNDC(event.clientX, event.clientY, canvas.getBoundingClientRect()));
    if (!hit) return;
    const target =
      hit === 'nest'
        ? container.querySelector('#nest')
        : container.querySelector('.on-stage[data-pid="' + CSS.escape(hit.slice(4)) + '"]');
    if (target) target.click();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('click', onClick);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('click', onClick);
  };
}

export { toNDC, forwardClicks };
