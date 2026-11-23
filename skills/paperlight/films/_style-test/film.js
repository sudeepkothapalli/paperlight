// STYLE TEST — render this after every engine change and look at it: one night interior, one dusk town, one dream,
// one fire. It exercises the living look, figures (in bed, walking, touching, talking, accents, rim light), place life,
// depth of field, water, fire and smoke. Not a story.
//   node engine/src/cli.js board films/_style-test/film.js      (or: render … --publish)

import { cam } from '../../engine/src/camera.js';

const seasons = {
  room: { sound: { tick: 0.6, crickets: 0.4 } },
  town: { sound: { wind: 0.4, crickets: 0.2 } },
  dream: { sound: { pad: 1 }, weather: { type: 'motes', count: 200, wind: 0.3 } },
  fire: { fire: '#d4401f', fire2: '#f0832c', fireCore: '#fcd27a', smoke: '#3a2522', weather: { type: 'embers', count: 300, wind: 0.6 }, sound: { fire: 1 } },
};

const sets = {
  room: { mood: 'room', look: 'living', light: 'night', wall: '#cdd2e2', bounds: [-3, -2.5, 3, 3], boards: { spacing: 0.13 }, shadows: false,
    sky: { stars: 100, moon: { az: 5, elev: 10, r: 1.3, phase: 0.4 } },
    props: [{ kind: 'window', at: [0.4, 1.35, 3.0], w: 1.0, h: 1.2, curtains: true }, { kind: 'bed', at: [0.2, 2.45], yaw: 90, len: 1.7, w: 0.85, h: 0.42, headboard: 0.22 },
      { kind: 'table', at: [1.4, 2.65], w: 0.38, h: 0.5, d: 0.34 }, { kind: 'lamp', at: [1.4, 0.5, 2.65], on: 1, color: 'accent' }] },
  town: { mood: 'town', look: 'living', light: 'dusk', ground: 'grass', figures: 'tonal', // tonal figures are tested here bounds: [-80, -60, 80, 60], cell: 0.5,
    rivers: [{ pts: [[-90, 0], [0, 0.5], [90, 0]], width: 8, flow: 0.7 }],
    roads: [{ pts: [[-80, 7], [80, 7]], width: 3 }, { pts: [[-80, -7], [80, -7]], width: 3 }],
    life: { walkers: 5, birds: 3 },
    props: [{ kind: 'bridge', at: [0, 0], yaw: 90, len: 11, w: 1.6, rise: 1.0 }, { kind: 'buildings', at: [0, 30], len: 140, h: 4, seed: 3, lit: 0.4 },
      ...[[-6, 5], [6, 5], [-6, -5], [6, -5]].map(([x, z]) => ({ kind: 'lamppost', at: [x, z], h: 3.5 })), { kind: 'tree', at: [-14, 12], h: 6, seed: 2, style: 'round' }] },
  dream: { mood: 'dream', look: 'living', light: 'dream', ground: 'cloudsea', bounds: [-120, -80, 120, 200], cell: 0.8,
    field: { type: 'billows', scale: 0.022, levels: 30, from: -0.5, to: 0.55, spacing: 0.8, tone: 0.42 }, motion: { dir: 40, speed: 0.8, amp: 0.25, length: 22 },
    clouds: [{ at: [10, 0, 30], w: 14, h: 10, seed: 3 }, { at: [-30, 0, 70], w: 30, h: 20, seed: 7 }] },
  fire: { mood: 'fire', look: 'living', light: 'night', ground: 'earth', bounds: [-60, -40, 60, 80], cell: 0.6,
    field: { type: 'flow', dir: 80, period: 7, amp: 9, scale: 0.02, levels: 8, spacing: 1.4, tone: 0.32 },
    props: [{ kind: 'buildings', at: [0, 22], len: 70, h: 6, seed: 4, lit: 0.4, fire: { start: 31, from: [-20, 22], speed: 8, size: 3.5 } }, { kind: 'tower', at: [12, 40], w: 7, h: 20, tiers: 4, fire: { start: 33, size: 6 } }] },
};

const cast = {
  kid: { kind: 'person', set: 'room', height: 1.12, headScale: 1.5, build: 0.85, hem: 0.14, flare: 1.5, hair: 'bob', hairSeed: 2, blanket: 'fabric', tone: '#2c3266', accessories: { ribbon: 'accent' },
    blocking: [['at', [0.62, 2.05], 0], ['tuck', true], ['lift', 0.44, 0], ['sit', 'bed', 0], ['look', -12, 3], ['pose', { tuck: 1, lean: -24, chin: -6 }, 2.2], ['lift', 0.3, 2.2]] },
  a: { kind: 'person', set: 'town', height: 1.8, hat: true, tone: '#3a2a1c', accessories: { hatband: 'accent' },
    blocking: [['until', 10], ['at', [-10, 7.2], 90], ['walk', [[-3, 7.2]], 1.3], ['face', 'b', 0.6], ['speak', 2.2], ['gesture', 'point', 0.4], ['stand', 2.4], ['gesture', 'none', 0.3]] },
  b: { kind: 'person', set: 'town', height: 1.25, headScale: 1.4, build: 0.85, hair: 'pigtails', tone: '#22305a', accessories: { ribbon: 'accent' },
    blocking: [['until', 10], ['at', [0.5, 7.0], 270], ['stand', 6.4], ['touch', 'a:hand', 0.6], ['stand', 3]] },
  c: { kind: 'person', set: 'dream', height: 1.6, hair: 'long', tone: '#2a1a32', scarf: 'accent', blocking: [['until', 20], ['at', [0, 0], 60], ['walk', [[6, 3]], 1.0], ['turn', 200, 1.2], ['stand', 4]] },
  d: { kind: 'person', set: 'fire', height: 1.75, tone: '#3a1610', accessories: { sash: 'accent' }, blocking: [['until', 30], ['at', [-2, 6], 0], ['gesture', 'shield', 0.5, 'both'], ['stand', 6]] },
};

export default {
  title: 'Style Test', fps: 24, size: [1920, 1080], seed: 4,
  palette: { paper: '#ecebe7', ink: '#14141a', accent: '#e8a33d' },
  colors: { accent: { color: '#e8a33d', meaning: 'test accent: every character accent and the lamp' } },
  seasons, sets, cast,
  shots: [
    { name: 'night room', set: 'room', dur: 4, wt: 0, beat: 'Night interior: full room, lamp light, a child sitting up in bed under a blanket.', camera: cam.fixed({ pos: [1.9, 1.1, -0.9], look: [0.45, 0.95, 2.6], lens: 26 }) },
    { name: 'dusk town', set: 'town', dur: 4, wt: 15.5, beat: 'Dusk exterior: river, bridge, lamps, passers-by, a talker and a hand that lands on another.', dof: { focus: 7 }, camera: cam.fixed({ pos: [-1.25, 1.3, 1.6], look: [-1.25, 1.25, 7.1], lens: 40 }) },
    { name: 'dream', set: 'dream', dur: 4, wt: 20, beat: 'Dream: pastel light, a walker who turns on the spot (feet step).', camera: cam.frame({ subject: 'c', size: 'FS', side: 120, lens: 40 }) },
    { name: 'fire', set: 'fire', dur: 4, wt: 31, beat: 'Fire at night: roofs catching, smoke, embers, rim light from the fire.', camera: cam.fixed({ pos: [-4, 1.6, -4], look: [0, 4, 22], lens: 28 }) },
  ],
};
