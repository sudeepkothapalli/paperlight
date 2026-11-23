// THE BRIDGE — see STORY.md. A comic two-hander at dusk: a narrow bridge, a balloon, a kindness.

import { cam } from '../../engine/src/camera.js';

const seasons = {
  dusk: {
    paper: '#cfd3dc', ink: '#121318', line: '#2c303e', water: '#9cb0cb', lamp: '#f0d9a2', moon: '#f6f2e6',
    wash: { top: '#7d88a5', topA: 0.15, bottom: '#e6c9a5', bottomA: 0.09 },
    sound: { wind: 0.45, crickets: 0.25, drone: 0.4 }, shadowAlpha: 0, sun: { az: 250, elev: 6 },
  },
};

const sets = {
  town: {
    mood: 'dusk', look: 'living', light: 'dusk', ground: 'grass',
    life: { walkers: 4, birds: 3 },                     // the town goes on around them: passers-by on the banks, birds going home
    bounds: [-120, -80, 120, 80], cell: 0.4,
    rivers: [{ pts: [[-140, 0.5], [-40, 1.2], [0, 0], [40, -1], [140, -0.5]], width: 10, flow: 0.7, tone: 0.5, bankTone: 0.75 }],
    roads: [{ pts: [[-120, 9.5], [0, 9.2], [120, 9.6]], width: 3, tone: 0.5 }, { pts: [[-120, -9.5], [0, -9.2], [120, -9.6]], width: 3, tone: 0.5 }],
    profile: { maxD: 7 },
    sky: { moon: { az: 84, elev: 17, r: 1.5 } },
    props: [
      { kind: 'bridge', at: [0, 0], yaw: 90, len: 14.8, w: 1.6, rise: 1.3 },
      ...[[-8, 7], [8, 7], [-24, 7], [24, 7], [-8, -7], [8, -7], [-24, -7], [24, -7], [-40, 7], [40, -7]].map(([x, z]) => ({ kind: 'lamppost', at: [x, z], h: 3.6, color: 'home' })),
      { kind: 'fence', pts: [[-70, 6.1], [-1.1, 6.1]] }, { kind: 'fence', pts: [[1.1, 6.1], [70, 6.1]] },
      { kind: 'fence', pts: [[-70, -6.1], [-1.1, -6.1]] }, { kind: 'fence', pts: [[1.1, -6.1], [70, -6.1]] },
      { kind: 'buildings', at: [0, 46], len: 200, h: 3.6, seed: 2, lit: 0.35, color: 'home' },
      { kind: 'buildings', at: [0, -46], yaw: 180, len: 200, h: 3.4, seed: 5, lit: 0.3, color: 'home' },
      { kind: 'tree', at: [-34, 15], h: 6, seed: 4, style: 'round' }, { kind: 'tree', at: [17, -13], h: 5, seed: 9, style: 'round' },
    ],
  },
};

// COLOUR SCRIPT — what colour means in this film (not universal meanings: this story's)
//   joy  · yellow · Lila's happiness. Full while she has it; it never drains — it's in danger, not lost.
//         At the end it passes into the moon: the town gets to keep it.
//   home · pale gold of lit windows and lamps · warmth waiting somewhere. Dim at dusk; as the stranger is kind,
//         the town's windows come up, one story beat at a time.
//   grade · the world starts cool and slightly grey (strangers, dusk), tightens during the standoff,
//         and warms within the kneel shot — the turn of the film happens in colour, not just in action.
const colors = {
  joy: { color: '#e8b528', meaning: "Lila's happiness — in danger, then shared with the whole town (the moon)" },
  home: { color: '#f0d39a', meaning: 'warmth waiting at home — the town warms as kindness happens', level: [[0, 0.6], [36.3, 1, 3.5]] },
  // the same yellow as joy, on Otto: grey while he is a hurried stranger; it warms once he has given the balloon back —
  // her joy has rubbed off on him, and nobody has to say so
  shared: { color: '#e8b528', meaning: "Lila's joy, passed to Otto — his hatband warms after the kindness", level: [[0, 0], [36.6, 1, 2.6]], drain: 0.7, arrives: true }, // a colour that arrives is the point
};

const otto = {
  kind: 'person', set: 'town', height: 1.86, build: 1.05, hem: 0.42, hat: true,
  tone: '#4a3220', accessories: { hatband: 'shared' },   // a warm brown-black; a hatband that starts drained
  gait: { stride: 1.08, bounce: 0.7, swing: 0.8, lean: 4 },
  blocking: [
    ['at', [-26, 9], 90],
    ['walk', [[-8, 9.2], [-3, 9], [0, 7.4], [0, 0.85]], 1.45],                     // 1–2 · brisk, home
    ['until', 22.6], ['speak', 1.1], ['walk', [[0.42, 0.85]], 0.7, { face: false }], ['stand', 0.4], // 3 · 'after you' — sidestep … she does too
    ['walk', [[-0.42, 0.85]], 0.7, { face: false }], ['stand', 0.3],                // 3 · … and again
    ['pose', { slump: 0.55, chin: -12 }, 0.5], ['gesture', 'hip', 0.5, 'far'],       // 4 · a sigh, hand on hip (case in the other)
    ['until', 30.0], ['pose', { chin: 25 }, 0.3], ['gesture', 'none', 0.2, 'far'],    // 5 · the gust — he looks up
    ['until', 31.55], ['gesture', 'catch', 0.3], ['hop', 0.28, 0.5],                  // 6 · drops the case, jumps, catches
    ['pose', { chin: 0 }, 0.6], ['until', 33.8], ['kneel', 1.0],                      // 7 · kneels to her height
    ['gesture', 'offer', 0.5], ['until', 36.3], ['touch', 'case', 0.6, 'near'],       //     offers; then his hand goes down to the case
    ['until', 37.2], ['gesture', 'none', 0.4], ['rise', 1.0],                         // 8 · rises
    ['walk', [[0.6, 0.6]], 0.6, { face: false }], ['until', 40.4],                    //     steps aside for her
    ['walk', [[0.2, -2], [0, -7.4], [3, -9], [20, -9.2]], 1.45],                      //     and goes on
  ],
};
const lila = {
  kind: 'person', set: 'town', height: 1.12, headScale: 1.45, build: 0.85, hem: 0.3, flare: 1.3, hair: 'bob', hairSeed: 3,
  tone: '#22305a', accessories: { ribbon: 'joy' },       // a blue-black; a yellow ribbon — her joy, the balloon's colour
  gait: { bounce: 1.6, stride: 0.95, swing: 1.3 },
  blocking: [
    ['at', [21, -9], -90], ['gesture', 'hold', 0.1],
    ['walk', [[8, -9.2], [3, -9], [0, -7.4], [0, -0.85]], 1.2],                      // 1–2 · skipping home with her balloon
    ['until', 22.6], ['walk', [[0.42, -0.85]], 0.7, { face: false }], ['stand', 0.4],
    ['walk', [[-0.42, -0.85]], 0.7, { face: false }], ['stand', 0.3],
    ['pose', { chin: 22 }, 0.6],                                                       // 4 · looks up at him
    ['until', 30.2], ['gesture', 'up', 0.25], ['pose', { chin: 35, lean: -7 }, 0.3],  // 5 · it slips — she reaches up
    ['until', 32.6], ['gesture', 'none', 0.6], ['pose', { chin: 15 }, 0.6],
    ['until', 35.6], ['touch', 'otto:hand', 0.4],                                      // 7 · her hand lands on his, on the string
    ['until', 36.6], ['gesture', 'hold', 0.5], ['pose', { chin: 10 }, 0.6],
    ['until', 38.4], ['gesture', 'wave', 0.4, 'far'], ['until', 40.0], ['gesture', 'none', 0.5, 'far'], // 8 · waves, still holding
    ['walk', [[-0.3, 1.2], [0, 7.4], [-3, 9], [-16, 9.3]], 1.2],                     //     and skips on
  ],
};
const cast = {
  otto, lila,
  balloon: {
    kind: 'balloon', set: 'town', color: 'joy', motif: 'joy', size: 1.1, length: 1.0,
    blocking: [['heldBy', 0, 'lila'], ['release', 30.2], ['fly', 31.3, [0.15, 3.1, 0.5]], ['heldBy', 32.2, 'otto'], ['heldBy', 36.1, 'lila']],
  },
  case: {
    kind: 'object', shape: 'case', set: 'town', color: 'ink', size: 1, hang: 0.05, rest: 0.0,
    blocking: [['heldBy', 0, 'otto'], ['drop', 31.6], ['heldBy', 37.0, 'otto']],
  },
};

const cut = (n) => n; // shot durations are snapped to the music's beats at render time (film.music.snapCuts)

export default {
  title: 'The Bridge',
  figures: 'tonal',                                // garments in near-black values: Otto's brown coat, Lila's navy dress
  fps: 24, size: [1920, 1080], seed: 41,
  palette: { paper: '#cfd3dc', ink: '#121318', accent: '#e8b528' },
  colors,
  air: { dir: 85, speed: 2.5, gust: 0.3, gusts: [[29.8, 2.6, 2.0]] },
  music: { file: 'music.wav', gain: 0.55, snapCuts: 'beats' },
  seasons, sets, cast,
  score: { key: 'C', drone: 0.5 },
  shots: [
    { name: 'dusk', set: 'town', dur: cut(5.5), wt: 0, grade: { temp: -0.35, sat: 0.8 }, beat: 'Dusk; a river through a small town; lamps on; the water moving.',
      camera: cam.fixed({ pos: [[-30, 6, -24], [-27, 5.5, -22]], look: [0, 1.5, 6], lens: 30, ease: 'glide' }), fadeIn: 0.8,
      title: { text: 'the bridge', at: 1.2, dur: 3.8, y: 0.12, size: 0.026, tracking: 0.45, color: 'moon' } },
    { name: 'otto', set: 'town', dur: cut(4.6), wt: 6.5, grade: { temp: -0.35, sat: 0.8 }, beat: 'He strides home along the far bank, case in hand. Left to right.',
      camera: cam.handheld(cam.frame({ subject: 'otto', size: 'FS', angle: 'low', side: -90, lens: 40, place: 0.2, tilt: 4 }), 0.08) }, // from the town side, out over the river: right to left, as on the bridge
    { name: 'lila', set: 'town', dur: cut(4.6), allowFlip: true, grade: { temp: -0.3, sat: 0.85 }, beat: 'She skips home along the near bank with her balloon. Left to right — toward him.',
      camera: cam.handheld(cam.frame({ subject: 'lila', size: 2.6, angle: 14, side: 90, lens: 40, place: -0.2, ty: 0.9, tilt: -7 }), 0.08) }, // from over the water, looking down at her on the bank
    { name: 'the bridge', set: 'town', dur: cut(6.6), wt: 17.4, allowFlip: true, grade: { temp: -0.4, sat: 0.75 }, beat: 'Side on: both climb the arch from opposite ends and stop at the top, face to face.',
      camera: cam.fixed({ pos: [17, 2.3, 0.2], look: [0, 2.0, 0], lens: 35 }) },
    { name: 'after you', set: 'town', dur: cut(3.6), allowFlip: true, grade: { temp: -0.45, sat: 0.7 }, beat: 'He steps aside — so does she. The other way — so does she.',
      camera: cam.fixed({ pos: [5.2, 2.1, 0.1], look: [0, 2.2, 0], lens: 40 }), sound: [{ at: 0.6, sfx: 'pluck', vel: 0.35 }, { at: 2.0, sfx: 'pluck', vel: 0.35 }] },
    { name: 'sigh', set: 'town', dur: cut(2.2), grade: { temp: -0.55, sat: 0.55 }, beat: 'Close, from her height: he sighs, hand on hip; the case still in the other hand.',
      camera: cam.frame({ subject: 'otto', size: 1.7, angle: 'low', side: -25, lens: 40, place: -0.15, lock: 'start', ty: 1.25 }), // from the front, her height: hand on hip and case both read
      feel: { agitation: 0.25 } },
    { name: 'the gust', set: 'town', dur: cut(2.6), wt: 29.7, grade: { temp: -0.5, sat: 0.6 }, beat: 'A gust: the string slips through her fingers; she reaches up.',
      camera: cam.frame({ subject: 'lila', size: 2.6, angle: 'low', side: 70, lens: 30, place: -0.15, lock: 'start', ty: 1.1, tilt: 10 }),
      feel: { agitation: [0.3, 0.8] }, sound: [{ at: 0.6, sfx: 'whoosh', vel: 0.7 }] },
    { name: 'the catch', set: 'town', dur: cut(2.2), grade: { temp: -0.45, sat: 0.65 }, beat: 'He drops the case, jumps, and catches the string.',
      camera: cam.frame({ subject: 'otto', size: 2.4, angle: 'low', side: -100, lens: 50, place: 0.15, lock: 'start', ty: 1.5, tilt: 10 }), // side-on and tight: the case falls, the arm goes up
      feel: { agitation: [0.8, 0.2] }, sound: [{ at: 0.1, sfx: 'thump', vel: 0.5 }, { at: 0.7, sfx: 'pop', vel: 0.4 }] },
    { name: 'kneel', set: 'town', dur: cut(4.8), grade: { temp: [-0.45, 0.25], sat: [0.65, 1] }, // the turn of the film happens in colour, inside this shot beat: 'Side on: he kneels to her height and offers it; she takes it. He picks up his case.',
      camera: cam.fixed({ pos: [[3.8, 2.6, 0.15], [3.5, 2.55, 0.15]], look: [0, 2.45, 0], lens: 38, ease: 'glide' }),
      feel: { flow: 0.4 }, sound: [{ at: 2.0, sfx: 'chime', vel: 0.35 }] },
    { name: 'passing', set: 'town', dur: cut(5.6), allowFlip: true, grade: { temp: 0.3, sat: 1 }, beat: 'She waves with her free hand; he steps aside; they pass.',
      camera: cam.fixed({ pos: [6.0, 3.0, 3.4], look: [0, 2.2, 0], lens: 32 }) },
    { name: 'parting', set: 'town', dur: cut(4.8), allowFlip: true, grade: { temp: 0.32, sat: 1.05 }, beat: 'High and wide: two people going home in opposite directions; the yellow bobbing above her.',
      camera: cam.fixed({ pos: [[20, 9, -10], [21, 10.5, -11]], look: [0, 1.2, 1], lens: 30, ease: 'glide' }) },
    { name: 'moon', set: 'town', dur: cut(5.6), grade: { temp: 0.35, sat: 1.05 }, tint: { moon: ['joy', { from: 0, to: 0.7, start: 0.15, end: 0.75 }] }, // the joy rises into the moon beat: 'Match cut: the balloon becomes the moon over the town.',
      camera: cam.fixed({ pos: [[-17, 0.7, -1.2], [-15.5, 0.75, -1.1]], yaw: 86, pitch: 8, lens: 30, ease: 'glide' }), // on the river: the arch side-on, the moon above it
      matchCut: { from: 'balloon', to: 'moon', release: 3 }, fadeOut: 1.8 },
  ],
};
