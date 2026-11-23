// CAPABILITY LAB — a short test scene for acting, objects, wind, feel and colour. Not a story film.
//
// Beats (cause → action → evidence → consequence):
//  1  she is flying her kite         → both hands up on the string, tugging, a small hop of joy     → he watches from a bench downwind
//  2  a gust                         → her arms are yanked forward; the string slips; she reaches up → the kite is free
//  3  it is hers and it is leaving   → a few light running steps after it; she stops; arm sinks      → loss
//  4  it is coming his way           → he stands, steps under it, reaches up, catches the trailing string → he has it
//  5  he has her kite                → she straightens and walks over (that's WHY she goes)          → they meet
//  6  it is hers                     → he offers it; she reaches and takes it; he keeps the end      → one string runs through both their hands
//
// Ownership: 0–8.2 kid · 8.2–16.5 free (flies to him) · 16.5–27.3 elder · 27.3– kid + elder (shared, accent)
// Everything travels left → right, with the wind.

import { cam } from '../../engine/src/camera.js';

const seasons = {
  grey: { paper: '#e8e7e3', ink: '#16161a', line: '#2b2b31', wash: { top: '#97a0ad', topA: 0.1, bottom: '#d6d8dc', bottomA: 0.04 }, shadowAlpha: 0.5, sound: { wind: 1.0, gusts: 1.1 } },
  warm: { paper: '#f3eadc', ink: '#1a140f', line: '#2e251c', wash: { top: '#e8b07a', topA: 0.14, bottom: '#f1d6b5', bottomA: 0.05 }, shadowAlpha: 0.6, sound: { wind: 0.7, birds: 0.8 } },
};

const sets = {
  meadow: {
    mood: 'grey',
    bounds: [-130, -90, 130, 220], cell: 0.5,
    field: { type: 'flow', dir: 90, period: 9, amp: 10, scale: 0.016, levels: 8, spacing: 1.3, tone: 0.38 },
    style: { coverage: 0.12, maxPen: 1.5, pen: 1.6 },
    props: [
      { kind: 'bench', at: [9.2, 7.8], yaw: 0, len: 1.6 },
      { kind: 'tree', at: [15, 13], h: 6, seed: 3, style: 'round' },
      { kind: 'tree', at: [-22, 30], h: 7, seed: 8 },
      { kind: 'tree', at: [40, 60], h: 9, seed: 5, style: 'round' },
      { kind: 'house', at: [-45, 80], w: 6, d: 7, h: 3.4, roof: 2.4, yaw: 15, lit: 0.6 },
    ],
  },
};

const cast = {
  kid: {
    kind: 'person', set: 'meadow', height: 1.15, headScale: 1.45, build: 0.85, hem: 0.3, flare: 1.3, hair: 'pigtails', hairSeed: 1, tone: '#2a2f55',
    gait: { bounce: 1.3, stride: 0.95, swing: 1.2, runKnee: 0.45, runLean: 3 },
    blocking: [
      ['at', [-2, 1], 80], ['gesture', 'fly'], ['pose', { chin: 22 }, 0.5], ['lookAt', 'kite', 0.3],
      ['stand', 3.4], ['hop', 0.1, 0.4], ['stand', 3.6],                                   // 1 · flying it, a hop of joy
      ['until', 7.6], ['pose', { lean: -9, chin: 25 }, 0.25],                              // 2 · the gust pulls
      ['gesture', 'reach', 0.15], ['stand', 0.6],                                          //     arms yanked forward, it slips (8.2)
      ['gesture', 'up', 0.3], ['pose', { chin: 32, lean: -3 }, 0.4], ['stand', 0.4],       //     reaching after it
      ['walk', [[0.5, 1.4], [3, 2]], 2.6],                                                  // 3 · a few light running steps
      ['stand', 0.8], ['gesture', 'none', 1.0], ['pose', { slump: 0.65, chin: 8 }, 1.4],   //     stops; the arm sinks
      ['until', 17.0], ['lookAt', 'elder', 0.8], ['pose', { chin: 0 }, 0.8], ['stand', 1.0],// 5 · sees he has it
      ['walkTo', 'elder', 1.25, 1.3],
      ['pose', { chin: -8, slump: 0.2 }, 0.6], ['stand', 0.9],                             // 6 · a shy pause
      ['until', 26.6], ['gesture', 'take', 0.4], ['stand', 1.0],                           //     reaches, takes the string (27.3)
      ['gesture', 'fly', 0.6], ['lookAt', 'kite', 0.8], ['pose', { chin: 24 }, 0.8], ['stand', 10],
    ],
  },
  elder: {
    kind: 'person', set: 'meadow', height: 1.7, build: 1.05, hem: 0.45, hat: true, tone: '#3a2c20',
    gait: { stride: 0.72, bounce: 0.5, swing: 0.55, lean: 7 },
    blocking: [
      ['at', [9.2, 7.95], 0], ['sit', 'chair', 0], ['lookAt', 'kite', 0.5],               // 1 · watching from the bench
      ['until', 14.6], ['rise', 0.9], ['pose', { chin: 30 }, 0.6],                        // 4 · it's coming: he stands, eyes on it
      ['gesture', 'catch', 0.5], ['walk', [[10.6, 6.9]], 0.9],                             //     reaches up as he steps under it …
      ['until', 17.0], ['gesture', 'fly', 0.6, 'near'],                                    //     … catches (16.5), holds it
      ['until', 17.6], ['lookAt', 'kid', 0.8],                                              //     looks to the girl
      ['until', 25.2], ['face', 'kid', 0.7], ['gesture', 'offer', 0.6], ['stand', 1.6],   // 6 · offers it (26.0)
      ['gesture', 'hold', 0.6], ['lookAt', 'kite', 1], ['pose', { chin: 20 }, 1], ['stand', 10],
    ],
  },
  kite: {
    kind: 'kite', set: 'meadow', color: 'accent', motif: 'kite', shareColor: 'accent', size: 0.9, length: 11,
    blocking: [
      ['heldBy', 0, 'kid'], ['release', 8.2],
      ['fly', 9.6, [8.5, 12.5, 6.0]], ['fly', 11.6, [12.5, 12.8, 7.5]], ['fly', 13.6, [15.5, 11.0, 8.6]], ['fly', 15.2, [17.0, 9.6, 8.8]],
      ['heldBy', 16.5, 'elder'], ['length', 16.5, 7, 3],
      ['heldBy', 27.3, 'kid', 'elder'],                                                    // one string, through both their hands
    ],
  },
};

export default {
  title: 'Capability Lab',
  fps: 24, size: [1920, 1080], seed: 5,
  palette: { paper: '#e8e7e3', ink: '#16161a', accent: '#cf3b2a' },
  air: { dir: 80, speed: 3.5, gust: 0.3, gusts: [[7.4, 2.2, 2.4]] },
  seasons, sets, cast,
  shots: [
    { name: 'flying', set: 'meadow', dur: 6.4, wt: 0, beat: 'She flies her kite; downwind, an old man watches from a bench.',
      camera: cam.frame({ subject: 'kid', size: 11, angle: 8, az: 8, lens: 30, place: -0.3, ty: 3 }), fadeIn: 0.6 },
    { name: 'the gust', set: 'meadow', dur: 3.4, beat: 'A gust: her arms are yanked forward, the string slips through her fingers.',
      camera: cam.frame({ subject: 'kid', size: 2.4, angle: 'low', side: 60, lens: 35, place: -0.15, lock: 'start', ty: 1.0, tilt: 8 }),
      feel: { agitation: [0, 0.7] }, sound: [{ at: 1.3, sfx: 'whoosh', vel: 0.7 }, { at: 2.2, sfx: 'flutter', vel: 0.4 }] },
    { name: 'away', set: 'meadow', dur: 4.6, beat: 'It rides the wind toward the bench, string trailing; she runs a few steps, stops, deflates.',
      camera: cam.fixed({ pos: [[-3, 1.4, -10], [-1, 1.6, -11]], look: [[5, 6, 6], [10, 6, 8]], lens: 26, ease: 'glide' }),
      feel: { agitation: [0.6, 0.2] } },
    { name: 'catch', set: 'meadow', dur: 3.8, beat: 'He stands, steps under it, reaches up — and catches the trailing string.',
      camera: cam.frame({ subject: 'elder', size: 3.6, angle: 'low', side: -70, lens: 32, place: -0.2, lock: 15.4, ty: 1.3, tilt: 6 }),
      sound: [{ at: 2.1, sfx: 'pluck', vel: 0.5 }] },
    { name: 'he has it', set: 'meadow', dur: 5.4, beat: 'She sees he has her kite. She straightens, and walks over.',
      camera: cam.frame({ subject: 'kid', size: 5.5, angle: 6, side: 200, lens: 35, place: -0.25, ty: 1.4 }) },
    { name: 'the string', set: 'meadow', dur: 7.6, beat: 'He offers it. She takes the string; he keeps the end. One string through both their hands.',
      camera: cam.fixed({ pos: [[13.4, 1.1, 1.8], [13.0, 1.05, 2.2]], look: [10.05, 1.3, 6.55], lens: 36, ease: 'glide' }), // side-on to the two of them
      season: { from: 'grey', to: 'warm', start: 0.45, end: 1 }, accent: [0.6, 1],
      feel: { pull: [0, 0.8], toward: ['kid', 'elder'], reach: 25, flow: [0, 0.5] },
      sound: [{ at: 2.6, sfx: 'chime', vel: 0.45 }, { at: 3.8, note: 'C5', vel: 0.25 }] },
    { name: 'together', set: 'meadow', dur: 5, beat: 'Wide: two people, one kite, one string.',
      camera: cam.fixed({ pos: [[3, 0.85, 15], [1.5, 0.95, 17]], look: [10.5, 3.0, 6.0], lens: 30, ease: 'glide' }), // low, from the open side: figures against the sky
      season: 'warm', feel: { flow: 0.5 }, fadeOut: 1.6, sound: [{ at: 0.5, note: 'F4', vel: 0.22 }] },
  ],
};
