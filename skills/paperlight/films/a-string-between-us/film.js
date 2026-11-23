// A STRING BETWEEN US — a Paperlight film. See STORY.md.
// Ivo flies a red kite alone; across a wide flowing land, Mara sits alone on her doorstep. A gust carries the kite to
// her. She picks it up — the string still runs to his hand. One tug, one wave; she sends it up again; they walk toward
// each other along the line. Overcast afternoon → the sun breaks through → dusk.
//
// Screen direction: Ivo screen-left, Mara screen-right; the wind (and the kite) travel left → right, from him to her.
// Cameras stay on the -z side of the line between them.

const IVO = [0, 0], STEP = [35, 4.8], PICK = [32.1, 2.9], MEET_I = [16.3, 1.0], MEET_M = [17.7, 1.6];
const T_PICK = 32.4;                       // she has it in her hand (traced from her blocking)
const TUG_SPEED = 14, D = Math.hypot(PICK[0] - IVO[0], PICK[1] - IVO[1]) / TUG_SPEED; // ≈ 2.3 s along the line
const T_TUG = 37.0, T_WAVE = T_TUG + D + 1.6, LAUNCH = 45.0, WALK = 49.4;

export default ({ cam }) => {
  const seasons = {
    apart: { sound: { wind: 1.1, gusts: 1.0, birds: 0.15 }, weather: { type: 'leaves', count: 240, color: '#6c6455', wind: 1.7 } },
    golden: { sound: { wind: 0.5, birds: 0.7, pad: 0.6 }, weather: { type: 'motes', count: 260, wind: 0.6 } },
    dusk: { sound: { crickets: 0.8, pad: 0.85, drone: 0.4, wind: 0.3 }, weather: { type: 'motes', count: 110, wind: 0.3 } },
  };

  const colors = {
    kite: { color: '#c8372b', meaning: 'what Ivo reaches out with — flown alone every evening', level: [[0, 0.7], [LAUNCH, 1, 2.5]] },
    bond: { color: '#c8372b', meaning: 'what passes between them — the shared string fills with red as each reaches back',
      level: [[0, 0], [T_PICK, 0.25, 0.8], [T_TUG + D, 0.55, 0.8], [T_WAVE, 0.8, 1], [WALK + 0.5, 1, 4]], drain: 0.75 },
    warmth: { color: '#e2a23b', meaning: "Mara's warmth — her scarf, the same gold as the window she keeps lit" },
    home: { color: '#f3cf8a', meaning: 'a light someone has left on — her window, glowing at dusk', level: [[0, 0.4], [62, 1, 4]] },
  };

  const sets = {
    land: {
      mood: 'apart', look: 'living', light: 'overcast', ground: 'meadow',
      bounds: [-110, -110, 150, 140], cell: 0.5,
      // long bands running across the space between them: a land to be crossed
      field: { type: 'flow', dir: 4, period: 6.5, amp: 13, scale: 0.018, levels: 8, spacing: 1.3, tone: 0.36 },
      motion: { dir: 90, speed: 2.4, amp: 0.32, length: 15 },     // waves of wind running from him to her
      style: { coverage: 0.12, maxPen: 1.5, pen: 1.6 },
      life: { walkers: 0, birds: 3 },
      props: [
        { kind: 'tree', at: [-2.6, 3.6], h: 5.6, seed: 3 },                                  // his bare tree
        { kind: 'house', at: [38.5, 9.5], w: 5, d: 5, h: 3.2, roof: 2.2, yaw: -8, lit: 1, color: 'home' }, // her house
        { kind: 'tree', at: [43, 6], h: 6, seed: 7, style: 'round' },
        { kind: 'fence', pts: [[30, 8.4], [36, 7.6]], h: 0.9 },                              // her little yard
        { kind: 'tree', tone: 0.35, at: [-36, 70], h: 9, seed: 12 },
        { kind: 'tree', tone: 0.35, at: [52, 110], h: 10, seed: 5, style: 'round' },
        { kind: 'tree', tone: 0.35, at: [10, 125], h: 9, seed: 14 },
        { kind: 'tree', tone: 0.35, at: [92, 100], h: 8, seed: 9, style: 'round' },
      ],
    },
  };

  const sparse = { density: -0.3, pull: -0.6, toward: ['ivo', 'mara'], reach: 12 };
  const together = (k) => ({ pull: k, toward: ['ivo', 'mara'], reach: 16, flow: 0.4 });
  const cloud = (name, at, w, h, seed, drift = 30) => [name, { kind: 'cloud', set: 'land', shape: { cumulus: true, seed, w, h },
    blocking: [['key', 0, at], ['key', 90, [at[0] + drift, at[1], at[2]]]] }];
  const bird = (name, keys, extra = []) => [name, { kind: 'bird', set: 'land', size: 0.22, color: 'ink', blocking: [...keys.map(([t, p]) => ['key', t, p]), ...extra] }];

  const cast = {
    ivo: {
      kind: 'person', set: 'land', height: 1.82, build: 1.0, hem: 0.42, hat: true, hair: 'short', scarf: 'kite', tone: '#3a2c22',
      gait: { stride: 0.78, bounce: 0.45, swing: 0.6, lean: 6 },
      blocking: [
        ['at', IVO, 90], ['gesture', 'fly', 0.1], ['pose', { slump: 0.55, chin: 4 }, 0.1], ['lookAt', 'kite', 0.3],   // flying it for nobody
        ['until', 17.6], ['pose', { lean: -12, slump: 0.1, chin: 20 }, 0.3], ['gesture', 'reach', 0.15, 'both'],    // the gust yanks his arms
        ['stand', 2.4], ['lookAt', 'mara', 0.6], ['pose', { lean: -4, chin: 2 }, 0.6],                                // it's going to her
        ['gesture', 'hold', 0.6, 'both'], ['stand', 1.0],
        ['until', T_TUG + D - 0.05], ['pose', { chin: -18, lean: 4 }, 0.2], ['lookAt', null, 0.2], ['stand', 0.9], // the line jumps in his hand
        ['lookAt', 'mara', 0.5], ['pose', { chin: 4, lean: 0, slump: 0 }, 0.6],
        ['until', T_WAVE], ['gesture', 'wave', 0.4, 'far'], ['stand', 1.8], ['gesture', 'hold', 0.4, 'far'],         // he waves with his free hand
        ['until', LAUNCH + 0.3], ['lookAt', 'kite', 0.8], ['pose', { chin: 22 }, 0.8],
        ['until', WALK], ['lookAt', 'mara', 0.8], ['pose', { chin: 4 }, 0.6], ['walk', [MEET_I], 1.2],
        ['face', 'mara', 0.6], ['stand', 1.4], ['speak', 1.4], ['stand', 2.0],
        ['lookAt', 'kite', 1.0], ['pose', { chin: 26 }, 1.0], ['stand', 30],
      ],
    },
    mara: {
      kind: 'person', set: 'land', height: 1.64, build: 0.88, hem: 0.3, hair: 'bob', hairSeed: 5, tone: '#26304a',
      scarf: 'warmth',                                       // the colour she keeps: the gold of her lit window
      gait: { stride: 0.95, bounce: 0.9, swing: 0.9 },
      blocking: [
        ['at', STEP, 250], ['sit', 'ground', 0], ['pose', { slump: 0.6, chin: -14 }, 0.1],                         // folded on her step
        ['until', 12.0], ['lookAt', 'kite', 1.0], ['pose', { slump: 0.35, chin: 8 }, 1.0],                          // she sees the red speck
        ['until', 22.8], ['pose', { chin: 18, slump: 0.2 }, 0.6],
        ['until', 26.4], ['rise', 1.0], ['walk', [PICK], 1.0],                                                       // gets up, goes to it
        ['kneel', 0.6], ['gesture', 'take', 0.4], ['stand', 0.5], ['gesture', 'hold', 0.4], ['rise', 0.9],
        ['lookAt', 'ivo', 1.4], ['face', 'ivo', 1.2],                                                                 // her eyes follow the string to him
        ['until', T_TUG - 0.12], ['gesture', 'tug', 0.12, 'both'], ['stand', 0.25], ['gesture', 'hold', 0.3, 'both'], // one tug
        ['until', T_WAVE + 0.4], ['pose', { slump: 0, chin: 10 }, 0.5], ['stand', 0.3], ['hop', 0.12, 0.35],        // he waved: she laughs
        ['until', LAUNCH - 0.8], ['gesture', 'up', 0.5], ['lookAt', 'kite', 0.5],                                   // lifts it…
        ['until', LAUNCH + 0.4], ['gesture', 'fly', 0.8], ['pose', { chin: 26 }, 0.8],                              // …and lets the wind take it
        ['until', WALK], ['lookAt', 'ivo', 0.8], ['pose', { chin: 4 }, 0.6], ['walk', [MEET_M], 1.25],
        ['face', 'ivo', 0.6], ['stand', 1.6], ['speak', 1.2], ['touch', 'ivo:hand', 0.6], ['stand', 1.8], ['gesture', 'hold', 0.6], // her hand on his, on the line
        ['lookAt', 'kite', 1.0], ['pose', { chin: 28 }, 1.0], ['stand', 30],
      ],
    },
    kite: {
      kind: 'kite', set: 'land', color: 'kite', shareColor: 'bond', size: 0.95, length: 10, slack: 0.12, shareWidth: 2.6, tugSpeed: TUG_SPEED,
      blocking: [
        ['heldBy', 0, 'ivo'],
        ['length', 17.6, 34, 3.0],                                                                       // the line burns out
        ['steer', 22.4, [[24.4, [27, 7, 1.5]], [25.5, [30.5, 2, 2.4]], [25.9, [31.3, 0.16, 2.6]]]],      // the wind drops: it lands by her step
        ['heldBy', T_PICK, 'mara', 'ivo'], ['length', T_PICK, 0.35, 0], ['slack', T_PICK + 0.3, 0.03, 1.4], // she picks it up; he still holds his end
        ['tug', T_TUG, 'mara', 1.4],
        ['length', LAUNCH, 14, 4], ['slack', LAUNCH + 0.2, 0.025, 3],                                    // up it goes
        ['length', WALK + 0.5, 8.5, 9],                                                                   // winding in as they walk
      ],
    },
    ...Object.fromEntries([
      bird('flock0', [[17.8, [-14, 9, 6]], [20.0, [6, 11, 7]], [22.4, [30, 12.5, 9]], [24.4, [52, 14, 10]]]),
      bird('flock1', [[18.0, [-15, 10, 8]], [20.2, [5, 12, 9]], [22.6, [29, 13, 11]], [24.6, [51, 15, 12]]]),
      bird('flock2', [[18.2, [-13, 8.4, 4]], [20.4, [7, 10, 5]], [22.7, [31, 11.4, 7]], [24.8, [53, 13, 8]]]),
      bird('pair0', [[63.2, [30, 6, 4]], [64.6, [20, 2.4, 1]], [65.5, [16.6, 0.4, -1.4]]], [['perch', 65.8, [16.6, -1.6]], ['face', 66, 100], ['chirp', 66.2], ['hop', 67.6, [16.85, -1.5]]]),
      bird('pair1', [[63.5, [31, 7, 5]], [64.9, [21, 2.8, 1.5]], [65.9, [17.3, 0.4, -1.2]]], [['perch', 66.2, [17.25, -1.4]], ['face', 66.4, 260], ['chirp', 67.0]]),
      cloud('c1', [-30, 30, 90], 34, 15, 4), cloud('c2', [25, 36, 120], 46, 18, 7), cloud('c3', [70, 28, 95], 30, 13, 11),
      cloud('c4', [-70, 34, 130], 40, 16, 2), cloud('c5', [10, 24, 70], 22, 9, 17), cloud('c6', [110, 30, 40], 36, 15, 9, 18),
    ]),
  };

  const sun = (relAz, elev, alpha = 1) => ({ sun: { relAz, elev, alpha, r: 2.6, color: '#eaa45c', halo: 7 } });
  const IVO_M = (at, gap = 0.5) => ['A4', 'F4', 'D4'].map((n, i) => ({ at: at + i * gap, note: n, vel: 0.18 }));  // his motif falls
  const MARA_M = (at, gap = 0.45) => ['C5', 'E5', 'G5'].map((n, i) => ({ at: at + i * gap, note: n, vel: 0.17 })); // hers rises
  const S = (o) => ({ set: 'land', ...o });

  return {
    title: 'A String Between Us',
    fps: 24, size: [1920, 1080], seed: 23,
    palette: { paper: '#e3e5e8', ink: '#14161a', accent: '#c8372b' },
    air: { dir: 90, speed: 2.6, gust: 0.25, gusts: [[17.5, 2.2, 4.5]] },
    lights: { overcast: { hazeDist: 230, haze: '#d6dbe0' }, dusk: { hazeDist: 190 } }, // a clear grey afternoon: the far side must stay visible
    colors, seasons, sets, cast,
    shots: [
      S({ name: 'apart', dur: 8, wt: 0, light: 'overcast', grade: { temp: -0.35, sat: 0.75 }, feel: sparse, fadeIn: 1.2,
        beat: 'The land inks itself out from a man flying a red kite by a bare tree; far across, a small house, a figure on its step.',
        reveal: { from: 'ivo', start: 0.3, dur: 5.5, radius: 120, feather: 26, ease: 'inOut' },
        title: { text: 'a string between us', at: 2.2, dur: 4.4, y: 0.15, size: 0.024, tracking: 0.4, color: 'ink' },
        sound: IVO_M(2.6, 0.7),
        camera: cam.fixed({ pos: [[17, 16, -37], [17, 12.5, -30]], look: [[17, 0, 6], [17, 0.6, 4]], lens: 28, ease: 'glide' }) }),
      S({ name: 'him', dur: 4.6, wt: 8, light: 'overcast', grade: { temp: -0.35, sat: 0.75 }, feel: sparse,
        beat: 'He flies it for nobody: slumped, chin down, the kite a speck above him.',
        camera: cam.handheld(cam.frame({ subject: 'ivo', size: ['MLS', 'MS'], angle: 'low', side: 70, lens: 40, place: -0.25, ty: 1.1, tilt: [8, 10] }), 0.12) }),
      S({ name: 'her', dur: 4.6, wt: 12.6, light: 'overcast', grade: { temp: -0.35, sat: 0.75 }, feel: sparse, transition: { type: 'dissolve', dur: 1.2 },
        beat: 'Across the land, she sits alone by her yard fence. She lifts her head: a red speck, far away.',
        sound: MARA_M(1.8, 0.6),
        camera: cam.frame({ subject: 'mara', size: [3.0, 2.5], angle: 'eye', side: -105, lens: 38, place: 0.2, ty: 0.7 }) }),
      S({ name: 'the gust', dur: 5.6, wt: 17.2, light: 'overcast', grade: { temp: -0.4, sat: 0.7 }, allowFlip: true,
        beat: 'A gust: leaves and birds tear across; the kite surges and the line burns out through his hands. He looks across at her.',
        feel: { agitation: [0.2, 0.6] }, weather: { count: 620, wind: 3.4 },
        sound: [{ at: 0.3, sfx: 'whoosh', vel: 0.75 }, { at: 0.9, sfx: 'flutter', vel: 0.5 }, { at: 2.6, sfx: 'flutter', vel: 0.4 }],
        camera: cam.handheld(cam.fixed({ pos: [[-3.6, 1.0, -2.4], [-3.2, 1.1, -2.6]], look: [[10, 4.5, 1], [20, 7, 1.5]], lens: 26, ease: 'glide' }), 0.5) }),
      S({ name: 'falling', dur: 4.6, wt: 22.8, light: 'overcast', grade: { temp: -0.35, sat: 0.75 },
        beat: 'The wind drops. The kite sinks out of the sky and lands by her step. She looks up.',
        sound: [{ at: 0.6, sfx: 'flutter', vel: 0.35 }, { at: 3.1, sfx: 'thump', vel: 0.15 }],
        camera: cam.fixed({ pos: [36.4, 0.8, -3.8], look: [[31.5, 3.2, 2.2], [32.4, 1.2, 2.8]], lens: 30, ease: 'glide' }) }),
      S({ name: 'picks it up', dur: 5.6, wt: 27.4, light: 'overcast', grade: { temp: -0.3, sat: 0.8 },
        beat: 'She gets up, goes to it, kneels and picks it up.',
        camera: cam.fixed({ pos: [[33.4, 1.0, -2.0], [33.0, 1.05, -1.6]], look: [32.1, 0.8, 2.9], lens: 34, ease: 'glide' }) }),
      S({ name: 'the line', dur: 3.6, wt: 33.0, light: 'overcast', grade: { temp: -0.3, sat: 0.8 }, allowFlip: true,
        beat: 'Over her shoulder: the string runs from her hand across the whole land, to a small figure by a bare tree.',
        camera: cam.fixed({ pos: [[33.7, 1.75, 3.7], [33.5, 1.75, 3.6]], look: [0, 0.9, 0], lens: [42, 56], ease: 'glide' }) }),
      S({ name: 'one tug', dur: 4.6, wt: 36.6, light: 'overcast', grade: { temp: -0.25, sat: 0.85 },
        beat: 'Side on, low, the whole land against the sky: she tugs once; a ripple runs the length of the string and jumps in his hand.',
        sound: [{ at: +(T_TUG + D - 36.6).toFixed(2), sfx: 'pluck', vel: 0.45 }, { at: +(T_TUG + D - 36.55).toFixed(2), note: 'G4', vel: 0.24 }],
        camera: cam.fixed({ pos: [[16.5, 0.34, -31], [16.5, 0.36, -30]], look: [16.5, 0.9, 1.5], lens: 30, ease: 'glide' }) }),
      S({ name: 'he answers', dur: 3.6, wt: 41.2, light: 'overcast', grade: { temp: [-0.2, -0.05], sat: [0.85, 0.9] },
        beat: 'He looks at his hand, then across — and lifts his free hand in a wave.',
        sound: [{ at: 0.6, note: 'D5', vel: 0.2 }],
        camera: cam.frame({ subject: 'ivo', size: ['MS', 'MCU'], angle: 'eye', side: 95, lens: 45, place: -0.2 }) }),
      S({ name: 'launch', dur: 5.4, wt: 44.8, light: { from: 'overcast', to: 'golden', start: 0.25, end: 1 }, grade: { temp: [-0.05, 0.25], sat: [0.9, 1] },
        beat: 'She laughs, lifts the kite and lets the wind take it — and the sun breaks through, low and gold. The string lifts off the land.',
        sound: [...MARA_M(0.4, 0.3), { at: 0.6, sfx: 'whoosh', vel: 0.35 }, { at: 1.4, note: 'C4', vel: 0.22 }, { at: 1.45, note: 'G4', vel: 0.2 }],
        sky: sun(-22, 7, [0, 1]),
        camera: cam.frame({ subject: 'mara', size: [3.6, 9], angle: 'low', side: -85, lens: 28, place: 0.25, ty: 1.4, tilt: [3, 9] }) }),
      S({ name: 'toward', dur: 6.4, wt: 50.2, light: 'golden', grade: { temp: 0.28, sat: 1 }, feel: { ...together([0, 0.7]), flow: [0, 0.4] },
        beat: 'Side on, against the low sun: they walk toward each other along the lifted string, winding it in; long shadows reach toward us.',
        sky: sun(0, 3.2), sound: IVO_M(1.0, 0.5).concat(MARA_M(2.2, 0.45)),
        camera: cam.fixed({ pos: [[17, 0.6, -28], [17.1, 0.65, -20]], look: [17, 1.6, 1.5], lens: 32, ease: 'glide' }) }),
      S({ name: 'closer', dur: 5.6, wt: 56.6, light: 'golden', grade: { temp: 0.3, sat: 1 }, feel: together(0.7),
        beat: 'Behind his shoulder: she comes closer, the kite above her, motes in the gold light.',
        sky: sun(12, 3), camera: cam.frame({ subject: 'ivo', size: 'MLS', angle: 'eye', side: 140, lens: 40, place: -0.3, ty: 1.3 }) }),
      S({ name: 'meeting', dur: 8, wt: 62.2, light: { from: 'golden', to: 'dusk', start: 0.35, end: 1 }, grade: { temp: [0.3, 0.18], sat: 1.05 }, feel: together(0.8),
        beat: 'They stop, an arm’s length apart, the sun going down between them; two birds land at their feet; a few words; both look up at the kite. Her window glows.',
        sky: sun(-10, [2.6, 1.0]),
        sound: [{ at: 2.4, note: 'C5', vel: 0.22 }, { at: 3.0, note: 'A4', vel: 0.2 }, { at: 4.2, note: 'G4', vel: 0.18 }, { at: 4.25, note: 'E5', vel: 0.16 }, { at: 4.0, sfx: 'chime', vel: 0.25 }],
        camera: cam.fixed({ pos: [[20.2, 0.7, -11.5], [19.8, 0.75, -10.4]], look: [17, 3.4, 1.5], lens: 26, ease: 'glide' }) }),
      S({ name: 'between us', dur: 9, wt: 70.2, light: 'dusk', grade: { temp: 0.15, sat: 1 }, feel: { ...together(0.9), reach: 18, flow: 0.5 },
        fadeOut: 2.6, transition: { type: 'dissolve', dur: 1.5 },
        beat: 'High and wide at dusk: two figures under one kite in the middle of the land; her window lit far off; the first stars.',
        sky: { ...sun(-6, [1.0, -1.5], [1, 0.4]), stars: 90, seed: 4, starAlpha: [0, 1] },
        tint: { cloud: ['kite', [0, 0.22]] },   // what he sent out now colours the evening clouds
        sound: [{ at: 1.0, note: 'D4', vel: 0.18 }, { at: 1.05, note: 'F4', vel: 0.16 }, { at: 1.1, note: 'A4', vel: 0.15 }, { at: 1.15, note: 'C5', vel: 0.14 }],
        camera: cam.fixed({ pos: [[17.5, 2.4, -12], [17.5, 7.5, -24]], look: [[17, 2.6, 2], [17, 2.2, 6]], lens: 30, ease: 'glide' }) }),
    ],
  };
};
