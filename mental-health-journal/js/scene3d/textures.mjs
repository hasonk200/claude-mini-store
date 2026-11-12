// Small canvas-drawn textures: pet faces, the window view, signs and the framed card.
// A cache owns every texture so a scene can release them all in one call.
import { rng } from '../art/math.mjs';

const VISOR = '#1c2136';

function createTextureCache(THREE, onLoad = () => {}) {
  const store = new Map();
  let disposed = false;

  function canvasTexture(key, width, height, draw) {
    if (store.has(key)) return store.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    draw(g, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    store.set(key, texture);
    return texture;
  }

  // The pet's visor and expression, drawn from the same shapes as the SVG character.
  function face(expr, glow) {
    return canvasTexture('face:' + expr + ':' + glow, 288, 168, (g) => {
      g.scale(4, 4);
      g.translate(-64, -76);
      const panel = new Path2D();
      panel.roundRect(64, 76, 72, 42, 19);
      g.fillStyle = VISOR;
      g.fill(panel);
      g.save();
      g.clip(panel);
      g.globalAlpha = 0.35;
      g.strokeStyle = glow;
      g.lineWidth = 4;
      g.stroke(panel);
      g.restore();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,.22)';
      g.lineWidth = 3;
      g.stroke(new Path2D('M74 84Q82 80 92 80'));
      g.strokeStyle = glow;
      g.fillStyle = glow;
      const stroke = (d, width = 4) => {
        g.lineWidth = width;
        g.stroke(new Path2D(d));
      };
      const fill = (d) => g.fill(new Path2D(d));
      const pill = (x) => {
        const p = new Path2D();
        p.roundRect(x, 88, 9, 15, 4.5);
        g.fill(p);
      };
      const dot = (x, y, rx, ry = rx) => {
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      };
      switch (expr) {
        case 'happy':
          stroke('M78 101Q86 89 94 101M106 101Q114 89 122 101');
          fill('M93 108Q100 116 107 108Z');
          break;
        case 'love':
          fill('M86 104l-8 -8a4.6 4.6 0 0 1 8 -5a4.6 4.6 0 0 1 8 5z');
          fill('M114 104l-8 -8a4.6 4.6 0 0 1 8 -5a4.6 4.6 0 0 1 8 5z');
          stroke('M95 110Q100 114 105 110', 3);
          break;
        case 'sleep':
        case 'blink':
          stroke('M78 98H93M107 98H122');
          stroke(expr === 'sleep' ? 'M96 109Q100 111 104 109' : 'M95 109Q100 112 105 109', 2.6);
          break;
        case 'eat':
          stroke('M78 99Q86 89 94 99M106 99Q114 89 122 99');
          dot(100, 110, 6, 5);
          break;
        case 'wow':
          g.lineWidth = 3.4;
          g.beginPath();
          g.arc(86, 96, 6, 0, Math.PI * 2);
          g.stroke();
          g.beginPath();
          g.arc(114, 96, 6, 0, Math.PI * 2);
          g.stroke();
          dot(100, 110, 3);
          break;
        case 'ask':
          pill(81);
          pill(110);
          stroke('M95 110Q100 107 105 110', 2.6);
          break;
        default:
          pill(81);
          pill(110);
          stroke('M93 108Q96.5 112 100 108Q103.5 112 107 108', 2.6);
      }
    });
  }

  // What you can see out of the window; mirrors the 2D room's sky, skyline, sun and moon.
  function windowView(palette) {
    return canvasTexture('window:' + palette.time, 392, 272, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, palette.sky[0]);
      sky.addColorStop(1, palette.sky[1]);
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.scale(2, 2);
      g.translate(-482, -72);
      const disc = (x, y, r, colour, alpha = 1) => {
        g.globalAlpha = alpha;
        g.fillStyle = colour;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      };
      if (palette.time === 'night') {
        const random = rng(7);
        for (let i = 0; i < 22; i++) {
          const x = 486 + random() * 190,
            y = 76 + random() * 94,
            r = 0.6 + random() * 1.4;
          disc(x, y, r, '#fff', 0.5 + random() * 0.5);
        }
        disc(640, 100, 14, '#f3e6b4');
        disc(634, 96, 14, palette.sky[0]);
      } else if (palette.time === 'day') {
        disc(640, 104, 16, '#ffe08a');
        g.globalAlpha = 0.9;
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(540, 110, 28, 10, 0, 0, Math.PI * 2);
        g.arc(530, 104, 10, 0, Math.PI * 2);
        g.arc(548, 100, 12, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      } else disc(620, 160, 20, '#ffd27a', 0.9);
      g.globalAlpha = 0.85;
      g.fillStyle = palette.skyline;
      g.fill(
        new Path2D(
          'M482 208V172L500 168V150H514V160H530V140H548V172H566V132H580V166H600V150H618V176H640V158H656V180H678V208Z',
        ),
      );
      g.globalAlpha = 1;
      if (palette.time === 'night') {
        const random = rng(3);
        for (let i = 0; i < 22; i++) {
          g.globalAlpha = 0.5 + random() * 0.5;
          g.fillStyle = '#ffd27a';
          g.fillRect(486 + random() * 188, 150 + random() * 52, 3, 4);
        }
        g.globalAlpha = 1;
      }
      // Two faint diagonal streaks so the panes read as glass.
      g.fillStyle = 'rgba(255,255,255,.13)';
      for (const x of [520, 548, 640]) {
        g.beginPath();
        g.moveTo(x, 72);
        g.lineTo(x + 14, 72);
        g.lineTo(x - 30, 208);
        g.lineTo(x - 44, 208);
        g.fill();
      }
    });
  }

  // Soft round gradient used for blob shadows (dark) and gentle halos (light).
  function radial(key, inner, outer) {
    return canvasTexture('radial:' + key, 64, 64, (g) => {
      const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      g.fillStyle = gradient;
      g.fillRect(0, 0, 64, 64);
    });
  }

  function glyph(text, colour, font = 'bold 44px Georgia, serif') {
    return canvasTexture('glyph:' + text + colour, 64, 64, (g) => {
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = colour;
      g.fillText(text, 32, 34);
    });
  }

  // Rasterises SVG markup (the framed card) once it has decoded; shows paper until then.
  function svg(key, markup, width, height, background = '#f4ead3') {
    const cacheKey = 'svg:' + key;
    if (store.has(cacheKey)) return store.get(cacheKey);
    let context;
    const texture = canvasTexture(cacheKey, width, height, (g) => {
      context = g;
      g.fillStyle = background;
      g.fillRect(0, 0, width, height);
    });
    const image = new Image();
    image.onload = () => {
      if (disposed || store.get(cacheKey) !== texture) return;
      context.drawImage(image, 0, 0, width, height);
      texture.needsUpdate = true;
      onLoad();
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    return texture;
  }

  return {
    face,
    windowView,
    radial,
    glyph,
    svg,
    canvasTexture,
    release(prefix) {
      for (const [key, texture] of store)
        if (key.startsWith(prefix)) {
          texture.dispose();
          store.delete(key);
        }
    },
    dispose() {
      disposed = true;
      for (const texture of store.values()) texture.dispose();
      store.clear();
    },
  };
}

export { createTextureCache, VISOR };
