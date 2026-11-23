// DESIRE PATH — a film made with Paperlight.
//
// Logline: A paved path takes the long way round a park lawn. One walker cuts across the blank
// paper instead. Days pass; others follow the faint line; their feet ink it darker and darker
// until the shortcut is as real as the road. Far off, the same walker steps off again.
//
// Visual idea: every passer-by leaves a few pen strokes. One person is a hairline; a season of
// people is a road. Ink accumulates the way paths do. The red scarf marks the one who goes first.
//
// World-time plan (one continuous world; big jumps are days):
//   autumn    0 ─ 60     the pioneer walks the road, stops at the corner, cuts across   (shots 1–6)
//   winter 1000 ─        in snow, a second walker finds the faint line and follows it    (7–8)
//   spring 2000 ─        in rain, two walk it together, the other way                    (9)
//   summer 2980 ─        traffic: it is a road now; one person still takes the long way  (10–11)
//   autumn 4000 ─        from above: the long curve and the straight line; the scarf again,
//                        stepping off somewhere new                                       (12)
// Seasons are told by atmosphere (paper tone, sky wash, weather, sound), never by a second accent.

import { cam } from '../../engine/src/camera.js';

// ---------- set: a park lawn with one paved path bending the long way round ----------
const set = {
  bounds: [-150, -130, 150, 260],
  cell: 0.4,
  blend: 4,
  roads: [
    { name: 'path', pts: [[-150, -14], [-45, -14], [-15, -13.5], [2, -11], [11, -4], [14, 6], [14.5, 25], [14, 60], [15, 260]], width: 3.0, tone: 1.0 },
  ],
  ponds: [{ at: [-34, 26], r: 6.5, tone: 0.75 }],
};

// the desire line: from A on the west leg to B on the north leg
const A = [-16.5, -14], B = [14.3, 15.8];
const DIAG = [[-10, -8], [-2, 0], [6, 8]];
const off = (pts, d) => pts.map(([x, z]) => [x - 0.7071 * d, z + 0.7071 * d]); // shift across the line

// someone who cuts across. dir +1: A → B (north-east), −1: B → A (south-west)
function crosser({ start, dir = 1, offset = 0, speed = 1.25, pause = 0, ...look }) {
  const diag = off(DIAG, offset);
  const a = [A[0] - 0.7071 * offset, A[1] + 0.2 * offset], b = [B[0] + 0.3 * offset, B[1] - 0.7071 * offset];
  const blocking = dir > 0
    ? [['at', [-32, -14], 90], ['walk', [[-24, -14], a], speed], ...(pause ? [['look', -42, pause], ['look', 0, 0.4]] : []), ['trail'], ['walk', [...diag, b], speed], ['trail', 'end'], ['walk', [[14.4, 30], [14.2, 48]], speed]]
    : [['at', [14.3, 32], 180], ['walk', [[14.3, 24], b], speed], ['trail'], ['walk', [...diag.slice().reverse(), a], speed], ['trail', 'end'], ['walk', [[-26, -14], [-42, -14]], speed]];
  return { kind: 'person', start, exit: 'end', blocking, ...look };
}

const looks = [
  { hair: 'long', height: 1.68, build: 0.92, hem: 0.5, hairSeed: 2.2 },
  { hair: 'short', height: 1.84, build: 1.06, hat: true },
  { hair: 'bun', height: 1.66, build: 0.9, hem: 0.42 },
  { hair: 'crop', height: 1.78, build: 1.1, hem: 0.62 },
  { hair: 'long', height: 1.62, build: 0.88, hem: 0.36, hairSeed: 4.1 },
  { hair: 'short', height: 1.35, build: 0.8, hem: 0.36, hairSeed: 3.3 }, // a child
];

const pioneerLook = { hair: 'short', height: 1.76, build: 0.98, hem: 0.46, scarf: 'accent', motif: 'pioneer', hairSeed: 1.3, tone: '#3a2a22' };

const cast = {
  pioneer: {
    kind: 'person', ...pioneerLook, start: 0, exit: 'end',
    blocking: [
      ['at', [-40, -14], 90],
      ['walk', [[-30, -14], A], 1.25],   // reaches the corner ~19.4
      ['stand', 1.0],
      ['look', -45, 4.0],                // across the lawn          20.4 → 24.4
      ['look', 0, 0.6],
      ['turn', 45, 0.8],                 //                          25.0 → 25.8
      ['trail'],
      ['walk', [...DIAG, B], 1.3],       // the first crossing       25.8 → ~58
      ['trail', 'end'],
      ['walk', [[14.4, 30], [14.2, 55]], 1.25],
    ],
  },
  second: { ...crosser({ start: 1000, dir: 1, offset: 0.25, speed: 1.15, pause: 2.2 }), ...looks[0] },
  pairA: { ...crosser({ start: 2000, dir: -1, offset: -0.35, speed: 1.1 }), ...looks[1] },
  pairB: { ...crosser({ start: 2000.3, dir: -1, offset: 0.35, speed: 1.1 }), ...looks[2] },
  c1: { ...crosser({ start: 2981, dir: -1, offset: 0.0, speed: 1.2 }), ...looks[3] },
  c2: { ...crosser({ start: 2990, dir: 1, offset: -0.3, speed: 1.3 }), ...looks[4] },
  c3: { ...crosser({ start: 2995, dir: 1, offset: 0.4, speed: 1.15 }), ...looks[1], hat: false, hair: 'short' },
  c4: { ...crosser({ start: 3001, dir: -1, offset: -0.2, speed: 1.25 }), ...looks[2] },
  c5: { ...crosser({ start: 2997, dir: 1, offset: 0.15, speed: 1.0 }), ...looks[5] },
  // one person still takes the long way round
  loner: {
    kind: 'person', hair: 'short', height: 1.8, build: 1.0, hat: true, hem: 0.55, start: 2996, exit: 'end',
    blocking: [['at', [-38, -14], 90], ['walk', [[-15, -13.5], [2, -11], [11, -4], [14, 6], [14.4, 25], [14.2, 50]], 1.2]],
  },
  // much later, the one in the red scarf leaves the road again, somewhere new
  pioneer2: {
    kind: 'person', ...pioneerLook, start: 3986, exit: 'end',
    blocking: [
      ['at', [14.3, 24], 0],
      ['walk', [[14.3, 30], [14.4, 34]], 1.2],
      ['stand', 0.8],
      ['turn', 70, 0.9],
      ['trail'],
      ['walk', [[18, 36], [24, 39], [31, 43], [40, 47], [52, 52], [66, 56]], 1.25],
    ],
  },
};

const timeCard = (text) => ({ text, at: 0.5, dur: 3.6, x: 0.5, y: 0.1, size: 0.022, tracking: 0.35, italic: true });

export default {
  title: 'Desire Path',
  fps: 24,
  size: [1920, 1080],
  seed: 23,
  colors: { accent: { color: '#c4381e', meaning: 'the one who goes first — the pioneer who leaves the road, and whose path others make into a road' } },
  palette: { paper: '#f2efe7', ink: '#13110e', accent: '#c4381e' },
  style: { sun: { az: 200, elev: 26 } },
  set,
  cast,
  score: { key: 'A', drone: 0.8, wind: 0.7 },
  shots: [
    {
      name: 'the park', season: 'autumn', dur: 6, wt: 8,
      beat: 'A park drawn from nothing: one paved path bending the long way round a blank lawn.',
      camera: cam.fixed({ pos: [[-62, 30, -62], [-54, 25, -54]], look: [[-8, 0, 2], [-6, 0, 2]], lens: 35, ease: 'glide' }),
      reveal: { from: 'pioneer', start: 0.4, dur: 4.8, radius: 220, feather: 25, ease: 'inOut' },
      figureIn: { pioneer: [0.1, 0.8] },
      fadeIn: 0.5,
      title: { text: 'desire path', at: 1.8, dur: 3.8, y: 0.11, size: 0.03, tracking: 0.5 },
      sound: [{ at: 0.5, note: 'A2', vel: 0.45 }, { at: 1.8, note: 'E3', vel: 0.3 }],
    },
    {
      name: 'the long way', season: 'autumn', dur: 5, wt: 14,
      beat: 'Profile, left to right. The paved path, and beyond it, nothing.',
      camera: cam.handheld(cam.frame({ subject: 'pioneer', size: 'FS', angle: 'hip', side: 90, lens: 50, place: -0.15 }), 0.12),
    },
    {
      name: 'the corner', season: 'autumn', dur: 3.0,
      beat: 'They stop where the path turns. The head turns to the lawn.',
      camera: cam.handheld(cam.frame({ subject: 'pioneer', size: 'MCU', side: 35, angle: 'eye', lens: 85, place: 'left', lock: 'start' }), 0.12),
    },
    {
      name: 'blank', season: 'autumn', dur: 2.8,
      beat: 'What they see: blank paper, a pond, the far side of the path.',
      camera: cam.handheld(cam.pov('pioneer', { lens: 40, tilt: -2.5 }), 0.25),
      hide: ['pioneer'],
      sound: [{ at: 0.3, note: 'C#4', vel: 0.28 }],
    },
    {
      name: 'first step', season: 'autumn', dur: 5.2,
      beat: 'Ground level. They turn, step off the path, and the first pen strokes appear under their feet.',
      camera: cam.frame({ subject: 'pioneer', size: 'FS', angle: 14, az: 44, lens: 32, lock: 'start', placeY: -0.3 }),
      sound: [{ at: 1.4, note: 'E4', vel: 0.32 }],
    },
    {
      name: 'across', season: 'autumn', dur: 6.5, wt: 33,
      beat: 'High and wide: a single hairline across the lawn behind them.',
      camera: cam.frame({ subject: 'pioneer', size: 'VWS', angle: 24, side: 90, lens: 35, place: 0.1 }),
    },
    {
      name: 'first snow', season: 'winter', dur: 6.5, wt: 1009,
      beat: 'Snow. Someone else on the path. At the corner, a faint line still leaves it under the snow.',
      camera: cam.frame({ subject: 'second', size: 'WS', angle: 16, side: 200, lens: 35, placeY: -0.2 }),
      transition: { type: 'dissolve', dur: 1.0 },
      title: timeCard('winter'),
    },
    {
      name: 'following', season: 'winter', dur: 5, wt: 1026,
      beat: 'They take it. Profile, left to right, like the first.',
      camera: cam.handheld(cam.frame({ subject: 'second', size: 'FS', angle: 'hip', side: 90, lens: 50, place: -0.15 }), 0.12),
    },
    {
      name: 'spring', season: 'spring', dur: 5.5, wt: 2033,
      beat: 'Spring rain. Two walk it together, the other way, towards us. The line is a bundle now.',
      camera: cam.frame({ subject: 'pairA', size: 'WS', angle: 5, side: 8, lens: 85, place: 0.12 }),
      transition: { type: 'dissolve', dur: 1.0 },
      title: timeCard('spring'),
    },
    {
      name: 'summer', season: 'summer', dur: 8, wt: 3012,
      beat: 'Summer, from above: traffic on the shortcut. One figure still walks the long way round.',
      camera: cam.fixed({ pos: [[34, 30, -36], [28, 36, -28]], look: [[-2, 0, 1], [-1, 0, 2]], lens: 35, ease: 'glide' }), // from outside the bend: the shortcut crosses the frame
      transition: { type: 'dissolve', dur: 1.0 },
      title: timeCard('summer'),
      sound: [{ at: 1.0, note: 'A3', vel: 0.3 }, { at: 1.05, note: 'E4', vel: 0.22 }],
    },
    {
      name: 'worn', season: 'summer', dur: 4.5, wt: 3022, allowFlip: true, // two-way traffic is the point
      beat: 'On the ground: a road of ink from the lens to the horizon. Someone walks it past us.',
      camera: cam.fixed({ pos: [-11.5, 0.55, -9.9], look: [12.6, 0.4, 14.0], lens: 28 }), // just beside the line, so walkers pass the lens
    },
    {
      name: 'the map', season: 'autumn', dur: 10, wt: 4000, allowFlip: true, // a map has no screen direction
      beat: 'Crane to a map: the long curve, the straight line. Far up, the red scarf steps off again.',
      camera: cam.frame({ subject: [9, 18], size: [35, 80], angle: [30, 89.6], az: 40, lens: 35, ease: 'glide' }),
      transition: { type: 'dissolve', dur: 1.0 },
      title: timeCard('autumn'),
      fadeOut: 2.0,
      sound: [{ at: 1.0, note: 'A2', vel: 0.4 }, { at: 1.05, note: 'E3', vel: 0.3 }, { at: 1.1, note: 'C#4', vel: 0.25 }, { at: 5.5, note: 'B3', vel: 0.25 }],
    },
    {
      name: 'end', season: 'autumn', dur: 5.5, blank: true,
      beat: 'Paper.',
      title: { text: 'every road was once\nsomeone’s shortcut.', at: 0.4, dur: 4.8, y: 0.5, size: 0.026, tracking: 0.3, leading: 2.0, fade: 1.2 },
      sound: [{ at: 0.5, note: 'E4', vel: 0.22 }, { at: 0.55, note: 'A3', vel: 0.2 }],
    },
  ],
};
