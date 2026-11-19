// Loaded only by the haven. The second camera sees the sky, shoreline and boats on layer 1.
import { rng } from '../../art/math.mjs';

const [THREE, { Reflector }, { Sky }] = await Promise.all([
  import('three'),
  import('three/addons/objects/Reflector.js'),
  import('three/addons/objects/Sky.js'),
]);
const LIGHT = {
  day: { height: 0.207, tint: '#d9f4ff', deep: '#27868d', glint: '#fff0c6', power: 1.8 },
  dusk: { height: 0.105, tint: '#ffc389', deep: '#5b7280', glint: '#ffb55c', power: 3.2 },
  night: { height: 0.196, tint: '#adc4de', deep: '#1c354c', glint: '#d6e7fd', power: 0.82 },
};

// Seamless height field. Store the two slopes, so the water shader can combine wave trains
// running at different speeds and scales. Mipmaps smooth out ripples towards the far bank.
function paintNormals(g, w, h) {
  const pixels = g.createImageData(w, h),
    turn = 2 * Math.PI;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x * turn) / w,
        v = (y * turn) / h;
      const bend = 1.7 * Math.sin(u + 2 * v) + 0.8 * Math.cos(3 * u - v);
      const a = Math.cos(3 * u + 7 * v + bend);
      const b = Math.cos(2 * u - 11 * v + 1.3 * Math.sin(2 * v + u));
      const c = Math.cos(9 * u + 17 * v + 1.8 * Math.cos(3 * u + 2 * v));
      const i = 4 * (y * w + x);
      pixels.data[i] = 128 + 29 * a + 16 * b + 22 * c;
      pixels.data[i + 1] = 128 + 53 * a - 39 * b + 24 * c;
      pixels.data[i + 2] = pixels.data[i + 3] = 255;
    }
  g.putImageData(pixels, 0, 0);
}

// Tileable value noise, sampled obliquely to make long, thin banks of cloud.
function paintClouds(g, w, h) {
  const random = rng(93),
    pixels = g.createImageData(w, h);
  for (const [n, amplitude] of [
    [4, 115],
    [8, 65],
    [16, 39],
    [32, 23],
    [64, 12],
  ]) {
    const grid = Array.from({ length: n * n }, random);
    const at = (x, y) => grid[(y % n) * n + (x % n)];
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const gx = (x * n) / w,
          gy = (y * n) / h,
          i = Math.floor(gx),
          j = Math.floor(gy);
        const dx = smooth(gx - i),
          dy = smooth(gy - j);
        const low = at(i, j) * (1 - dx) + at(i + 1, j) * dx,
          high = at(i, j + 1) * (1 - dx) + at(i + 1, j + 1) * dx;
        const k = 4 * (y * w + x);
        pixels.data[k] += amplitude * (low * (1 - dy) + high * dy);
        pixels.data[k + 3] = 255;
      }
  }
  g.putImageData(pixels, 0, 0);
}

function tile(textures, name, paint) {
  const t = textures.canvasTexture('place:haven:' + name, 256, 256, paint);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeSky(env, direction, light) {
  const sky = new Sky(),
    mat = sky.material,
    u = mat.uniforms;
  sky.scale.setScalar(4000);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  sky.layers.enable(1);
  u.sunPosition.value.copy(direction).multiplyScalar(450000);
  u.turbidity.value = env.time === 'dusk' ? 7 : 2.2;
  u.rayleigh.value = env.time === 'dusk' ? 3.4 : 1.45;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.86;
  u.cloudMap = { value: tile(env.textures, 'clouds', paintClouds) };
  u.clock = { value: 0 };
  u.skyTint = { value: new THREE.Color(light.tint) };
  // Keep the daylight scattering from Sky. Apply the film response here so the low-poly
  // models and the site's shared renderer retain their own colours.
  mat.defines = { ['HAVEN_' + env.time.toUpperCase()]: 1 };
  mat.fragmentShader =
    'uniform sampler2D cloudMap; uniform float clock; uniform vec3 skyTint;\n' +
    mat.fragmentShader.replace(
      'gl_FragColor = vec4( retColor, 1.0 );',
      `
      float height = max(direction.y, 0.0);
      float radius = length(direction - vSunDirection);
      vec3 air = retColor / (retColor + vec3(0.58));
      #ifdef HAVEN_NIGHT
        air = mix(vec3(.085,.13,.22), vec3(.008,.016,.047), smoothstep(-.06,.45,height));
        vec3 cloudLight = vec3(.14,.19,.28);
        float disc = .014;
      #elif defined(HAVEN_DUSK)
        air *= mix(vec3(1.48,.63,.40), vec3(.71,.70,1.02), smoothstep(.04,.43,height));
        vec3 cloudLight = mix(vec3(1.12,.52,.28), vec3(.56,.36,.45), smoothstep(.08,.38,height));
        float disc = .022;
      #else
        air *= vec3(.69,.91,1.14);
        vec3 cloudLight = vec3(.92,.94,.96);
        float disc = .014;
      #endif
      float aureole = exp(-radius*17.0)*.53 + exp(-radius*60.0)*.45;
      air += skyTint*aureole;
      air = mix(air, mix(skyTint,vec3(1.),.76)*1.4, 1.0-smoothstep(disc-.001,disc+.001,radius));
      vec2 cloudUV = direction.xz / max(height + .055, .055) * vec2(.074,.16);
      cloudUV.x += clock*.00065;
      float wisps = texture2D(cloudMap,cloudUV).r*.77 + texture2D(cloudMap,cloudUV*2.76).r*.23;
      float cloud = smoothstep(.48,.70,wisps)*smoothstep(.01,.13,height);
      gl_FragColor = vec4(mix(air,cloudLight,cloud*.66),1.);
    `,
    );
  return sky;
}

const WATER_SHADER = {
  name: 'HavenWater',
  uniforms: {
    ...Reflector.ReflectorShader.uniforms,
    normals: { value: null },
    clock: { value: 0 },
    lightDir: { value: null },
    glint: { value: null },
    power: { value: 1 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 mirror;
    varying vec3 world;
    void main() {
      world = (modelMatrix * vec4(position,1.)).xyz;
      mirror = textureMatrix * vec4(position,1.);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, normals;
    uniform vec3 color, lightDir, glint;
    uniform float clock, power;
    varying vec4 mirror;
    varying vec3 world;
    void main() {
      vec2 uv = world.xz;
      vec2 wave = texture2D(normals,uv*.094+clock*vec2(.011,-.006)).rg-.5;
      vec2 fine = texture2D(normals,uv*.27+clock*vec2(-.009,.014)).rg-.5;
      vec2 slope = wave*.34 + fine*.14;
      vec3 n = normalize(vec3(slope.x,1.,slope.y));
      vec3 eye = normalize(cameraPosition-world);
      float facing = clamp(dot(n,eye),0.,1.);
      float fresnel = .19+.79*pow(1.-facing,3.);
      vec2 offset = slope.yx * vec2(.095,.082);
      vec3 reflection = texture2D(tDiffuse,clamp(mirror.xy/mirror.w+offset,.001,.999)).rgb;
      vec3 halfRay = normalize(eye+lightDir);
      float facet = max(dot(halfRay,n),0.);
      float shine = pow(facet,560.) + .16*pow(facet,72.);
      vec3 lake = mix(color*(.86+.5*wave.y),reflection,fresnel);
      gl_FragColor = vec4(lake + glint*power*shine,1.);
      #include <colorspace_fragment>
    }`,
};

export function atmosphere(env, bounds, renderer) {
  const light = LIGHT[env.time];
  const direction = new THREE.Vector3(
    env.time === 'dusk' ? 0.184 : 0.23,
    light.height,
    -1,
  ).normalize();
  const normals = tile(env.textures, 'wave-normals', paintNormals);
  const sky = makeSky(env, direction, light);
  // A portrait phone shows few enough water pixels for a quarter-size mirror.
  const resolution = renderer.domElement.clientWidth <= 560 ? 256 : 512;
  const water = new Reflector(new THREE.PlaneGeometry(bounds.width, bounds.length), {
    textureWidth: resolution,
    textureHeight: resolution,
    multisample: 0,
    shader: WATER_SHADER,
    color: light.deep,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, bounds.y, bounds.z);
  water.camera.layers.set(1);
  const target = water.getRenderTarget();
  target.texture.type = THREE.UnsignedByteType;
  water.material.addEventListener('dispose', () => target.dispose());
  const u = water.material.uniforms;
  u.normals.value = normals;
  u.lightDir.value = direction;
  u.glint.value = new THREE.Color(light.glint);
  u.power.value = light.power;
  const group = new THREE.Group();
  group.add(water, sky);
  function dispose() {
    group.removeFromParent();
    for (const obj of [water, sky]) {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  }
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    const gl = renderer.getContext();
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error('Lake reflection framebuffer unavailable');
  } catch (error) {
    dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previous);
  }
  env.group.add(group);
  return {
    tick(t) {
      u.clock.value = sky.material.uniforms.clock.value = t;
    },
    time: () => u.clock.value,
    dispose,
  };
}
