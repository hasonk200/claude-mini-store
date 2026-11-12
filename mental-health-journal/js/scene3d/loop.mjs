// Render-on-demand loop. Nothing is drawn unless something changed; ambient animation runs
// at a gentle ~30fps and only a walking or carried pet asks for full-rate frames. The loop
// stops when the page is hidden and never ticks animation when motion is reduced.

const AMBIENT_INTERVAL = 1000 / 30 - 2;

function createLoop({ render, tick, busy, ambient, reducedMotion }) {
  let frame = 0,
    last = 0,
    lastDraw = 0,
    dirty = false,
    running = false;

  const animating = () => !reducedMotion && !document.hidden && (busy() || ambient());

  function step(now) {
    frame = 0;
    if (!running) return;
    const full = !reducedMotion && busy();
    if (dirty || full || now - lastDraw >= AMBIENT_INTERVAL) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (!reducedMotion && !document.hidden) tick(dt);
      render();
      lastDraw = now;
      dirty = false;
    }
    if (animating()) frame = requestAnimationFrame(step);
    else last = 0;
  }

  function requestRender() {
    dirty = true;
    if (running && !frame) frame = requestAnimationFrame(step);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    } else requestRender();
  }

  return {
    requestRender,
    start() {
      if (running) return;
      running = true;
      document.addEventListener('visibilitychange', onVisibility);
      requestRender();
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      document.removeEventListener('visibilitychange', onVisibility);
    },
    get active() {
      return !!frame;
    },
  };
}

export { createLoop };
