// Render-on-demand loop. Nothing is drawn unless something changed; ambient animation runs
// at a gentle ~30fps and only a walking or carried pet asks for full-rate frames. The loop
// stops when the page is hidden and never ticks animation when motion is reduced.
//
// On a device that cannot keep up (frames arriving slower than ~25fps), ambient animation
// backs off to every third frame so the page stays responsive to taps and scrolling.

const AMBIENT_INTERVAL = 1000 / 30 - 2;
const STRUGGLING_FRAME = 40;
const SLOWEST_AMBIENT = 300;

// How long to wait between ambient frames given the recent average gap between frames.
function ambientInterval(averageFrame) {
  if (averageFrame <= STRUGGLING_FRAME) return AMBIENT_INTERVAL;
  return Math.min(SLOWEST_AMBIENT, averageFrame * 3);
}

function createLoop({ render, tick, busy, ambient, reducedMotion }) {
  let frame = 0,
    last = 0,
    lastDraw = 0,
    lastStep = 0,
    averageFrame = 16,
    dirty = false,
    running = false;

  const animating = () => !reducedMotion && !document.hidden && (busy() || ambient());

  function step(now) {
    frame = 0;
    if (!running) return;
    // Consecutive frames tell us how well the device is coping.
    if (lastStep && now - lastStep < 1000) averageFrame += (now - lastStep - averageFrame) * 0.2;
    lastStep = now;
    const full = !reducedMotion && busy();
    if (dirty || full || now - lastDraw >= ambientInterval(averageFrame)) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (!reducedMotion && !document.hidden) tick(dt);
      render();
      lastDraw = now;
      dirty = false;
    }
    if (animating()) frame = requestAnimationFrame(step);
    else last = lastStep = 0;
  }

  function requestRender() {
    dirty = true;
    if (running && !frame) frame = requestAnimationFrame(step);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = lastStep = 0;
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
      last = lastStep = 0;
      document.removeEventListener('visibilitychange', onVisibility);
    },
    get active() {
      return !!frame;
    },
  };
}

export { createLoop, ambientInterval };
