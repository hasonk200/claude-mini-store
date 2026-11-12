// Pure colour and light choices for the 3D scenes. The time-of-day buckets come from the 2D
// art (`tod`) so both renderings always agree on what "day", "dusk" and "night" mean.
import { tod } from '../art/pet-scenes.mjs';

const TIMES = {
  day: {
    sky: ['#9fd0f0', '#e6f4fb'],
    backdrop: '#f4ead7',
    hemiSky: '#fff8ea',
    hemiGround: '#d9c3a0',
    hemi: 1.55,
    sun: '#fff1d6',
    sunPower: 1.9,
    sunFrom: [5, 9, 7],
    skyline: '#7f8fa8',
    glow: 0,
  },
  dusk: {
    sky: ['#f4a96f', '#7d6aa6'],
    backdrop: '#ecd2b6',
    hemiSky: '#ffe2c2',
    hemiGround: '#c9a98a',
    hemi: 1.9,
    sun: '#ffc58f',
    sunPower: 1.3,
    sunFrom: [7, 5, 6],
    skyline: '#7f8fa8',
    glow: 0.4,
  },
  night: {
    sky: ['#141c3c', '#34436f'],
    backdrop: '#232846',
    hemiSky: '#d6c8cc',
    hemiGround: '#806c62',
    hemi: 1.2,
    sun: '#e6d8d4',
    sunPower: 0.75,
    sunFrom: [4, 8, 6],
    skyline: '#1c2340',
    glow: 1,
  },
};

// Colours sampled from the 2D room so the two versions feel like the same home.
const ROOM_COLOURS = {
  wall: '#efe1c9',
  stripe: '#ebdcc3',
  wainscot: '#e3d0b0',
  panel: '#cdb58f',
  skirting: '#b99670',
  floor: '#c79a6b',
  plank: '#b38758',
  slab: '#a98560',
  window: '#fbf6ea',
  windowWood: '#b8916a',
  curtain: '#a9c3b0',
  rod: '#8a6d4a',
  rug: '#d9826a',
  rugTrim: '#f1c6a8',
  rugLine: '#c76c55',
  bed: '#d0a77c',
  bedPad: '#f0dcc0',
  lampWarm: '#ffd98a',
  bulbs: ['#ffd27a', '#ff9fb2', '#9ff0ff', '#c9f29b'],
};

function palette(hour) {
  const time = tod(hour);
  return { time, night: time === 'night', ...TIMES[time], room: ROOM_COLOURS };
}

export { palette, ROOM_COLOURS };
