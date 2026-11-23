// A SMALL CLOUD — see STORY.md for the poem, the mood table and the shot plan.
//
// Two worlds (sets): her ROOM (night, then morning) and the DREAM (a sea of clouds).
// One accent: warm amber — the nightlight, the dawn sun, the cloud's glow of friendship.
//
// World-time plan:
//   room, night     0 ─ 32    the cloud passes the window; lamp off; she sinks under the blanket
//   dream         100 ─ 170   cloud sea · the small cloud peeks · rabbit · whale · flight · dawn · goodbye
//   room, morning 300 ─ 310   the small cloud is waiting at the window

import { cam } from '../../engine/src/camera.js';

// ---------- moods: paper, ink, light and sound, tuned to each act ----------
const seasons = {
  night: {
    paper: '#1b1f2d', ink: '#07080c', line: '#474e66', pane: '#b6bfd1', star: '#f3f0e6', moon: '#f5f1e4', cloud: '#d9dee8',
    sound: { crickets: 1, tick: 1, drone: 0.7, wind: 0.15, gusts: 0.3 }, shadowAlpha: 0,
  },
  dream: {
    paper: '#e9eaf1', ink: '#1d2034', line: '#2a2e48', cloud: '#f5f5f9',
    wash: { top: '#97a3d4', topA: 0.15, bottom: '#e4d7e8', bottomA: 0.05 },
    sound: { pad: 1, wind: 0.5, gusts: 0.6, drone: 0.6 }, shadowAlpha: 0.35, sun: { az: 200, elev: 40 },
    weather: { type: 'motes', count: 260, wind: 0.4 },  // the dream air glitters
  },
  dawn: {
    paper: '#f3e9e3', ink: '#241c1c', line: '#34292b', cloud: '#fbf4ef',
    wash: { top: '#e7a27b', topA: 0.17, bottom: '#f2cdb2', bottomA: 0.07 },
    sound: { pad: 1, wind: 0.6, birds: 0.6, drone: 0.7 }, shadowAlpha: 0.5, sun: { az: 25, elev: 8 },
    weather: { type: 'motes', count: 300, wind: 0.5 },
  },
  morning: {
    paper: '#e9e2d4', ink: '#16130f', line: '#6b6355', pane: '#fbf6eb', cloud: '#ffffff',
    wash: { top: '#f0c58d', topA: 0.1, bottom: '#efe1c8', bottomA: 0.04 },
    sound: { birds: 1, wind: 0.25, tick: 0.6, drone: 0.5 }, shadowAlpha: 0,
    weather: { type: 'motes', count: 120, wind: 0.1, box: 4, boxY: 2.5 },  // dust in the morning light
  },
};

// ---------- worlds ----------
const WIN = { kind: 'window', at: [0.4, 1.35, 3.0], w: 1.0, h: 1.2, curtains: true, breeze: 0.6 };
const sets = {
  room: {
    mood: 'night', look: 'living', light: 'night',
    wall: '#cbc6dc', floor: 'floorboard',             // a child's room: lilac walls, honey floorboards
    materials: { fabric: ['#efd8a4'], curtain: '#e6b4a0', frame: '#f1ece2' },  // a yellow blanket, peach curtains
    bounds: [-3, -2.5, 3, 3.0],
    boards: { spacing: 0.13, tone: 0.55 },
    sky: { stars: 140, seed: 3, moon: { az: 5, elev: 9, r: 1.3, phase: 0.38 } },
    moonlight: [[0, 0.22], [299, 0, 0.1]],
    shadows: false,
    props: [
      WIN,
      { kind: 'bed', at: [0.2, 2.45], yaw: 90, len: 1.7, w: 0.85, h: 0.42, headboard: 0.22 },
      { kind: 'table', at: [1.4, 2.65], w: 0.38, h: 0.5, d: 0.34 },
      { kind: 'lamp', at: [1.4, 0.5, 2.65], on: [[0, 1], [21.9, 0, 0.45]], color: 'accent' },
    ],
  },
  dream: {
    mood: 'dream', look: 'living', light: 'dream', ground: 'cloudsea',
    bounds: [-230, -170, 230, 430],
    cell: 0.8,
    field: { type: 'billows', scale: 0.022, levels: 34, from: -0.5, to: 0.55, spacing: 0.8, tone: 0.42 },
    motion: { dir: 40, speed: 0.8, amp: 0.25, length: 22 },  // the cloud sea drifts and breathes
    style: { coverage: 0.16, maxPen: 1.6, pen: 1.7 },
    props: [
      { kind: 'tree', at: [-23.5, 153.5], h: 5.5, seed: 6, style: 'round', foliage: ['#e7b9c8', '#efc9d4'] }, // a blossom tree growing out of a cloud where they land
    ],
    sky: {},
    clouds: [
      { at: [24, 0, 16], w: 9, h: 7, seed: 4 },          // the tower the small cloud hides behind
      { at: [-100, 0, 128], w: 34, h: 24, seed: 7 },
      { at: [55, 0, 105], w: 22, h: 16, seed: 2 },
      { at: [10, 0, 230], w: 60, h: 34, seed: 11 },
      { at: [-130, 0, 210], w: 44, h: 26, seed: 5 },
      { at: [120, 0, 260], w: 50, h: 30, seed: 9 },
      { at: [-40, 0, 40], w: 12, h: 9, seed: 13 },
      { at: [-30, 0, -70], w: 26, h: 18, seed: 17 },
      { at: [60, 0, -40], w: 20, h: 14, seed: 19 },
      { at: [-62, 0, 112], w: 16, h: 26, seed: 21 },     // a tall one they pass at dawn
    ],
  },
};

// ---------- cast ----------
const girl = {
  kind: 'person', height: 1.12, headScale: 1.5, build: 0.85, hem: 0.14, flare: 1.55, shoulders: 0.82,
  hair: 'bob', feet: 'bare', hairSeed: 2, coatFlutter: 1.4, blanket: 'fabric',
  tone: '#2c3266', accessories: { ribbon: 'accent' },   // a blue-black; a ribbon that carries 'someone with you'
  blocking: [
    // night: sitting up in bed, watching the window
    ['set', 'room'], ['at', [0.62, 2.05], 0], ['tuck', true], ['lift', 0.44, 0], ['sit', 'bed', 0], // sitting up in bed, the blanket over her legs
    ['pose', { chin: 8, slump: 0.15 }, 0.1],
    ['look', -14, 8], ['look', 8, 6], ['look', 0, 5.6],               // follows the cloud      → 19.6
    ['stand', 0.8],
    ['turn', 78, 0.9],                                                   // toward the lamp       → 21.3
    ['gesture', 'reach'], ['stand', 0.9],                                // the lamp goes out at 21.9
    ['gesture', 'none'], ['stand', 0.4],
    ['turn', 0, 0.9],
    ['pose', { tuck: 1, lean: -24, chin: -6, slump: 0 }, 2.2], ['lift', 0.3, 2.2],     // snuggles down, the blanket pulled to her chin → 25.7
    // the dream
    ['until', 100], ['set', 'dream'], ['tuck', false], ['rise', 0.01], ['lift', 0, 0], ['at', [0, 0], 90], ['pose', { chin: 14, tuck: 0, lean: 0 }, 0.1],
    ['stand', 7.0], ['pose', { chin: 4 }, 1.2],
    ['walk', [[3, 0.2], [7, 0.5], [11, 0.9]], 1.0],                     // → ~118.6
    ['turn', 42, 0.8],                                                   // faces the tower
    ['gesture', 'reach'], ['pose', { lean: 6 }, 0.6], ['stand', 3.6], ['gesture', 'none'], ['pose', { lean: -4, chin: 6 }, 0.6], ['stand', 1.0],
    ['walk', [[11.8, 1.6]], 0.6],                                        // one careful step
    ['until', 131.6], ['hop', 0.16, 0.45], ['stand', 0.45], ['hop', 0.16, 0.45],
    ['until', 138.2], ['gesture', 'up'], ['until', 141.3], ['gesture', 'none'],
    ['ride', 'puff', [0, 0.52, 0.35]],
    ['until', 160.5], ['dismount', [-18.9, 151.6], -146], ['pose', { chin: 10 }, 0.8], ['stand', 3.2],
    ['gesture', 'reach'], ['stand', 4.5], ['gesture', 'none'],
    // morning: at the window
    ['until', 300], ['set', 'room'], ['at', [0.45, 2.72], 0], ['pose', { chin: 12, lean: 4 }, 0.1],
    ['stand', 2.2], ['gesture', 'reach'], ['stand', 8],
  ],
};

// the small cloud, three times: outside her window at night, in the dream, at the window in the morning
const loop = (t0, c, r, steps = 6, dt = 0.32) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
  return ['key', t0 + i * dt, [c[0] + Math.cos(a) * r * 0.74, c[1] + r + Math.sin(a) * r, c[2] + Math.cos(a) * r * 0.67]];
});
const cast = {
  mira: girl,
  puffNight: {
    kind: 'cloud', set: 'room', shape: 'small', scale: 2.4, height: 1.2, exit: 99, heading: 90,
    blocking: [
      ['key', 0, [-11, 8.4, 45]], ['key', 12, [1.4, 9.6, 45]],
      ['key', 14.5, [1.7, 9.95, 45]], ['key', 17, [1.9, 9.6, 45]], ['key', 19.5, [2.1, 9.85, 45]],  // it stops, as if it noticed her
      ['key', 45, [17, 10.6, 45]],
    ],
  },
  puff: {
    kind: 'cloud', set: 'dream', shape: 'small', scale: 1.0, height: 1.0, enter: 100, exit: 200, heading: 220,
    blocking: [
      ['key', 100, [26, 2.2, 21]], ['key', 114.3, [25.5, 2.2, 20.5]],
      ['key', 115.2, [20.0, 2.0, 15.2]], ['key', 116.2, [20.3, 2.05, 15.3]], ['key', 116.9, [24.5, 2.3, 19.0]],   // peeks, hides
      ['key', 117.9, [24.3, 2.3, 18.8]], ['key', 118.9, [20.2, 1.9, 15.0]], ['key', 120.5, [20.1, 2.0, 15.0]],    // peeks again, stays
      ['key', 123.4, [15.0, 1.3, 5.2]], ['key', 124.8, [13.3, 1.0, 3.4]],                                          // comes close
      ['key', 125.4, [13.4, 1.05, 3.5]], ['key', 126.4, [15.3, 1.5, 5.4]],                                          // too close — backs away
      ['key', 127.8, [13.2, 1.0, 3.2]],                                                                            // comes back
      ...loop(128.2, [13.2, 0.4, 3.2], 0.8),                                                                       // a loop, for joy
      ['key', 130.6, [13.2, 0.06, 3.2]],
      ['key', 131.6, [13.2, 0.06, 3.2]], ['key', 131.95, [13.55, 0.6, 3.55]], ['key', 132.3, [13.9, 0.06, 3.9]],  // rabbit hops
      ['key', 132.65, [14.25, 0.6, 4.25]], ['key', 133.0, [14.6, 0.06, 4.6]], ['key', 133.8, [14.6, 0.06, 4.6]],
      ['key', 134.2, [14.0, 0.55, 4.0]], ['key', 134.6, [13.4, 0.06, 3.4]],
      ['key', 136.0, [13.4, 0.1, 3.4]], ['key', 138.5, [12.9, -0.05, 1.9]], ['key', 141.4, [12.8, -0.1, 1.8]],    // grows, lowers
      ['key', 143.0, [11.5, 1.2, 6]], ['key', 145.0, [8, 3.4, 20]], ['key', 147.5, [0, 4.4, 40]],                  // flight
      ['key', 150.0, [-12, 5, 62]], ['key', 152.5, [-28, 6, 85]], ['key', 155.0, [-48, 6.5, 108]],
      ['key', 157.5, [-36, 4, 130]], ['key', 159.5, [-24, 1.4, 146]], ['key', 160.5, [-20, 0.05, 150]],             // lands
      ['key', 162.6, [-19.45, 0.95, 151.0]], ['key', 170, [-19.45, 0.98, 151.05]],                                          // hovers by her
    ],
  },
  puffMorning: {
    kind: 'cloud', set: 'room', shape: 'small', scale: 1.6, height: 1.0, enter: 290, glow: 0.75, heading: 270,
    blocking: [['key', 290, [1.2, 2.4, 13]], ['key', 300, [1.0, 2.5, 13]], ['key', 304, [0.8, 2.3, 13]], ['key', 310, [0.9, 2.45, 13]]],
  },
};
for (let i = 0; i < 5; i++) cast['dawnBird' + i] = { kind: 'bird', set: 'dream', size: 0.3, color: 'ink', enter: 150, exit: 162, blocking: [
  ['key', 150 + i * 0.25, [-90 - i * 3, 14 + i, 70 + i * 6]], ['key', 154 + i * 0.25, [-50 - i * 2, 13 + i * 0.6, 95 + i * 4]], ['key', 158 + i * 0.25, [-10 - i * 3, 12, 125 + i * 3]], ['key', 162, [30, 12, 150]]] };
cast.sparrow = { kind: 'bird', set: 'room', size: 0.16, color: 'ink', enter: 299, blocking: [
  ['key', 300.5, [2.6, 2.2, 3.4]], ['key', 302.2, [0.95, 0.76, 3.18]], ['key', 309, [0.95, 0.76, 3.18]], ['chirp', 302.6], ['chirp', 304.4], ['hop', 305.5, [0.78, 3.18]], ['chirp', 306.1]] };
cast.puff.blocking.push(
  ['shape', 130.3, 'rabbit', 1.3], ['shape', 136.2, 'whale', 2.0], ['scale', 136.2, 1.3, 2.0],
  ['shape', 161.4, 'small', 1.6], ['scale', 161.4, 1.0, 1.6],
  ['glow', 163.0, 1, 1.6], ['rain', 164.6, 1, 0.6], ['rain', 167.6, 0, 0.8],
);

const nightTitle = { text: 'a small cloud', at: 1.4, dur: 4.6, y: 0.88, size: 0.028, tracking: 0.45, color: 'moon' };

export default {
  title: 'A Small Cloud',
  fps: 24,
  size: [1920, 1080],
  seed: 31,
  palette: { paper: '#e9eaf1', ink: '#1d2034', accent: '#e8a33d' },
  // COLOUR — one warm amber, and what it means here: someone with you. The nightlight; gone when she is alone in
  // the dark; it comes back as the dawn and the small cloud's glow; and it is waiting at her window in the morning.
  colors: { accent: { color: '#e8a33d', meaning: 'someone with you — the nightlight, the dawn, the small cloud\'s glow', level: [[0, 1], [21.9, 0.25, 0.6], [146, 1, 6]], drain: 0.6 } },
  style: { boil: 0.3 },
  seasons,
  sets,
  cast,
  score: { key: 'F', drone: 0.8, wind: 0.6 },
  shots: [
    // ---------------- act 1: night ----------------
    { name: 'window', set: 'room', dur: 6.5, wt: 0, empty: true,
      beat: 'The window from inside: stars, a crescent moon, a small cloud crossing alone.',
      camera: cam.fixed({ pos: [[0.4, 1.3, 1.2], [0.4, 1.32, 1.42]], look: [0.55, 1.45, 3], lens: 35, ease: 'linear' }),
      fadeIn: 1.2, title: nightTitle, grade: { temp: -0.25, sat: 0.9 },
      sound: [{ at: 1.4, note: 'F3', vel: 0.32 }, { at: 3.2, note: 'C4', vel: 0.24 }] },
    { name: 'her room', set: 'room', dur: 6,
      beat: 'Wide: she sits up in bed by the window. The lamp is the only warm thing in the night.',
      camera: cam.fixed({ pos: [[1.9, 1.1, -0.9], [1.75, 1.08, -0.6]], look: [0.45, 0.95, 2.6], lens: 26, ease: 'glide' }) }, // her silhouette lands inside the bright pane
    { name: 'watching', set: 'room', dur: 4.5,
      beat: 'Her head against the moonlit pane, following the cloud.',
      camera: cam.fixed({ pos: [1.35, 0.95, 1.3], look: [0.3, 1.25, 3.0], lens: 42 }) },
    { name: 'it stops', set: 'room', dur: 3.5, empty: true,
      beat: 'Through the glass: the cloud stops by the moon, as if it noticed her.',
      camera: cam.handheld(cam.fixed({ pos: [0.68, 1.62, 2.8], look: [1.9, 9.7, 45], lens: 70 }), 0.1), // inside one pane, past the frame
      sound: [{ at: 0.4, note: 'A4', vel: 0.22 }] },
    { name: 'lamp', set: 'room', dur: 6.1,
      beat: 'She reaches over and turns off the lamp — the warm colour leaves the film — and sinks under the blanket.',
      sound: [{ at: 2.0, sfx: 'thump', vel: 0.08 }], grade: { temp: [-0.05, -0.35], sat: [1, 0.8] },
      camera: cam.fixed({ pos: [-1.0, 0.92, 1.95], look: [1.35, 0.82, 2.62], lens: 36 }) }, // she is a silhouette against the lamp's glow
    { name: 'into the window', set: 'room', dur: 6.0,
      beat: 'The camera drifts into the pane until its light is all there is.',
      camera: cam.fixed({ pos: [[0.4, 1.15, 0.2], [0.42, 1.36, 2.8]], look: [[0.42, 1.3, 3], [0.42, 1.38, 6]], lens: [28, 35], ease: 'in' }),
      fadeOut: { dur: 1.8, color: 'pane' },
      sound: [{ at: 3.0, note: 'C4', vel: 0.25 }, { at: 4.2, note: 'F4', vel: 0.22 }] },

    // ---------------- act 2: the dream ----------------
    { name: 'cloud sea', set: 'dream', dur: 7, wt: 100,
      beat: 'Nothing under her feet but weather. The cloud sea draws itself out from where she stands.',
      camera: cam.frame({ subject: 'mira', size: ['EWS', 'VWS'], angle: [24, 13], az: 70, lens: 35, placeY: -0.32, ease: 'glide' }),
      reveal: { from: 'mira', start: 0.4, dur: 5.2, radius: 320, feather: 30, ease: 'inOut' },
      figureIn: { mira: [0.2, 1.2] }, fadeIn: 0.8,
      light: { from: 'dreamNight', to: 'dream', start: 0.1, end: 0.9 }, sky: { stars: 160, seed: 9, starAlpha: [1, 0] }, // falling asleep into morning
      feel: { flow: 0.3 },
      sound: [{ at: 0.6, note: 'F3', vel: 0.35 }, { at: 1.4, note: 'A3', vel: 0.28 }, { at: 2.2, note: 'C4', vel: 0.24 }] },
    { name: 'walking', set: 'dream', dur: 5.5, wt: 107.5,
      beat: 'Profile, left to right: barefoot on cloud tops.',
      camera: cam.handheld(cam.frame({ subject: 'mira', size: 'FS', angle: 'hip', side: 90, lens: 50, place: -0.2 }), 0.1) },
    { name: 'peek', set: 'dream', dur: 5.5,
      beat: 'A tower of cloud. Something small peeks out from behind it — and hides — and peeks again.',
      camera: cam.fixed({ pos: [3.5, 1.15, -4.5], look: [21.5, 2.6, 15.5], lens: 42 }) },
    { name: 'hand', set: 'dream', dur: 4.6,
      beat: 'Close: she turns to it and holds out her hand.',
      camera: cam.frame({ subject: 'mira', size: 0.95, side: 35, angle: 'hip', lens: 70, place: 'left', lock: 123, ty: 0.86 }),
      sound: [{ at: 1.0, note: 'D4', vel: 0.22 }] },
    { name: 'shy', set: 'dream', dur: 7.2,
      beat: 'It comes close, backs away, comes back — and loops once, for joy.',
      feel: { pull: [0, 0.6], toward: ['mira', 'puff'], reach: 14, flow: 0.3 }, sound: [{ at: 4.2, sfx: 'pluck', vel: 0.35 }],
      camera: cam.frame({ subject: 'mira', size: 3.8, side: 92, angle: 4, lens: 40, place: -0.25, lock: 'start' }) },
    { name: 'rabbit', set: 'dream', dur: 5.8,
      beat: 'It becomes a rabbit and hops. She hops too.',
      camera: cam.frame({ subject: 'mira', size: 'MLS', side: 150, angle: 'low', lens: 28, place: -0.22, lock: 'start' }),
      sound: [{ at: 0.6, note: 'A4', vel: 0.28 }, { at: 1.6, note: 'C5', vel: 0.22 }, { at: 1.15, sfx: 'pop', vel: 0.25 }, { at: 1.85, sfx: 'pop', vel: 0.22 }, { at: 2.55, sfx: 'pop', vel: 0.2 }] },
    { name: 'whale', set: 'dream', dur: 5.5,
      beat: 'It grows into a whale and lowers itself beside her. She reaches up.',
      camera: cam.frame({ subject: 'mira', size: 5.5, side: 112, angle: 8, lens: 35, place: -0.15, lock: 'start' }),
      sound: [{ at: 0.4, note: 'F3', vel: 0.32 }, { at: 1.4, note: 'C4', vel: 0.26 }] },
    { name: 'flight', set: 'dream', dur: 8.5,
      beat: 'Alongside: she rides the whale low over the cloud sea; towers slide past.',
      feel: { flow: 0.6 }, sound: [{ at: 0.3, sfx: 'whoosh', vel: 0.45 }],
      camera: cam.frame({ subject: 'puff', size: 5, side: 95, angle: 6, lens: 35, ty: 1.0 }),
      sound: [{ at: 0.5, note: 'F3', vel: 0.3 }, { at: 0.55, note: 'C4', vel: 0.24 }, { at: 0.6, note: 'A4', vel: 0.2 }] },
    { name: 'dawn', set: 'dream', season: 'dawn', dur: 7.5, light: { from: 'dream', to: 'golden', start: 0, end: 0.8 },
      grade: { temp: [0, 0.3], sat: [1, 1.1] }, tint: { cloud: ['accent', [0, 0.22]] }, // the clouds blush with the returning warmth
      beat: 'High and wide: they round a tall tower as the horizon warms. The amber returns — as the sun.',
      camera: cam.frame({ subject: 'puff', size: [5, 10], angle: [5, 10], side: 150, lens: 30, ease: 'glide' }),
      sky: { sun: { relAz: -20, elev: 3.5, r: 2.4 } },
      transition: { type: 'dissolve', dur: 1.2 },
      sound: [{ at: 1.0, note: 'F3', vel: 0.35 }, { at: 1.05, note: 'A3', vel: 0.28 }, { at: 1.1, note: 'E4', vel: 0.24 }] },
    { name: 'goodbye', set: 'dream', season: 'dawn', dur: 8.5, wt: 160, light: 'golden', grade: { temp: 0.3, sat: 1.05 }, tint: { cloud: ['accent', 0.2] },
      beat: 'They land. It becomes small again, glows, and — since clouds cannot hold hands — rains gently on her palm.',
      camera: cam.frame({ subject: 'mira', size: 2.6, side: -90, angle: 'hip', lens: 45, place: 0.25, lock: 161, ty: 0.85 }),
      sky: { sun: { relAz: -14, elev: 6, r: 2.4 } },
      transition: { type: 'dissolve', dur: 1.0 },
      sound: [{ at: 3.0, note: 'C5', vel: 0.22 }, { at: 3.0, sfx: 'chime', vel: 0.3 }, { at: 4.6, note: 'A4', vel: 0.2 }, { at: 5.2, note: 'F4', vel: 0.2 }] },

    // ---------------- act 3: morning ----------------
    { name: 'morning', set: 'room', season: 'morning', light: 'morning', dur: 8.5, wt: 300, grade: { temp: 0.15, sat: 1 },
      matchCut: { from: 'puff', to: 'puffMorning', release: 4 }, transition: { type: 'dissolve', dur: 1.6 }, // the dream cloud becomes the one at her window
      beat: 'Morning. She stands at the window, her hand on the glass. Outside, the small cloud is waiting, warm.',
      camera: cam.fixed({ pos: [[0.02, 1.0, 0.95], [0.12, 1.05, 1.35]], look: [0.6, 1.3, 3], lens: 32, ease: 'glide' }),
      sky: { moon: null, stars: 0 },
      sound: [{ at: 2.5, note: 'F4', vel: 0.25 }, { at: 3.2, note: 'C5', vel: 0.2 }, { at: 2.4, sfx: 'flutter', vel: 0.25 }] },
    { name: 'end', set: 'room', season: 'morning', dur: 6, blank: true,
      beat: 'Paper.',
      title: { text: 'and every night after,\nit waited by her window.', at: 0.4, dur: 5.2, y: 0.5, size: 0.026, tracking: 0.3, leading: 2.0, fade: 1.2 },
      sound: [{ at: 0.5, note: 'F3', vel: 0.24 }, { at: 0.55, note: 'C4', vel: 0.2 }] },
  ],
};
