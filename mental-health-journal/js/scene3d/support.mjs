// Decides whether the 3D scenes may be used. The rules are pure functions of an
// "environment" object so they can be unit-tested; `readEnvironment` gathers the real one.

const SETTINGS = ['auto', 'on', 'off'];

const normalizeSetting = (value) => (SETTINGS.includes(value) ? value : 'auto');

// Hardware can render the scenes at all: WebGL2, and not a very low-memory device.
function canUse3DWith(env) {
  if (!env.webgl2) return false;
  return env.deviceMemory === undefined || env.deviceMemory >= 2;
}

// "Auto" keeps 3D for desktops and mid/high-end phones and stays flat on modest hardware.
function autoAllows(env) {
  if (env.deviceMemory !== undefined && env.deviceMemory < 4) return false;
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 4) return false;
  return true;
}

// The single answer the app asks for. Quiet mode, a local "off", a lost WebGL context this
// visit, or missing WebGL2 all mean the 2D version is shown.
function resolve3D(env) {
  if (env.failed || env.quiet) return false;
  const setting = normalizeSetting(env.setting);
  if (setting === 'off' || !canUse3DWith(env)) return false;
  return setting === 'on' || autoAllows(env);
}

let probed;
function probeWebGL2() {
  if (probed !== undefined) return probed;
  probed = false;
  try {
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const gl = document.createElement('canvas').getContext('webgl2');
      probed = !!gl;
      // Hand the probe context straight back; browsers cap how many can exist.
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch (err) {
    probed = false;
  }
  return probed;
}

function readEnvironment() {
  return {
    webgl2: probeWebGL2(),
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}

export { SETTINGS, normalizeSetting, canUse3DWith, autoAllows, resolve3D, readEnvironment };
