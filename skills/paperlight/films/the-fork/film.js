// THE FORK — a one-minute film made with Paperlight.
//
// Logline: A walker reaches a three-way fork, weighs the roads, and follows a small red
// bird off every road into blank paper — where a new line begins to draw itself behind them.
//
// Visual idea: ink = the made world. Paper = the unmade. The accent red appears once,
// as the thing that is not on any map.
//
// World-time plan (the actors live in continuous time; shots are windows onto it):
//   0 ─ 52   walker comes up the south road            (shots 1–3, ellipsis between 2 and 3)
//   52 ─ 54  stands at the fork
//   54 ─ 63  looks left, then right                    (shot/reverse-shot 4–7)
//   63 ─ 70  red bird crosses, lands in the blank field (8–9)
//   70 ─ 72  turns toward it; walks off the road        (10–12)
//   99 ─110  far above: three roads and one new line    (13)

import { cam } from '../../engine/src/camera.js';

const set = {
  bounds: [-170, -200, 170, 460],
  cell: 0.4,
  blend: 5,
  roads: [
    { name: 'south', pts: [[0, 2], [0, -20], [1.5, -60], [-2.5, -110], [0.5, -190]], width: 3.8 },
    { name: 'left', pts: [[0, 2], [-9, 9], [-30, 20], [-70, 36], [-130, 52], [-200, 62]], width: 3.4, tone: 1.3 },
    { name: 'center', pts: [[0, 2], [1, 18], [-3.5, 45], [3, 85], [-2.5, 140], [4, 230], [0, 470]], width: 2.6, tone: 0.9 },
    { name: 'right', pts: [[0, 2], [9, 8], [32, 15], [75, 25], [140, 34], [210, 40]], width: 3.4, tone: 0.8 },
  ],
};

const cast = {
  walker: {
    kind: 'person', height: 1.76, build: 1.0, hem: 0.46, tone: '#2c2a3a', plain: true, // colour belongs to the bird; the walker is only a hue in the black
    blocking: [
      ['at', [0, -68], 0],
      ['walk', [[0, -60], [0.5, -40], [0, -20], [0, -6], [0.1, -1]], 1.3], // arrives ~52.3
      ['stand', 2.0],
      ['look', -60, 4.6],   // the left road            54.3
      ['look', 55, 4.6],    // the right road           58.9
      ['look', 0, 2.0],     //                          63.5
      ['look', 30, 5.0],    // the bird                 65.5
      ['turn', 34, 1.0],    //                          70.5
      ['trail'],            // from here, the walker draws their own road
      ['walk', [[2, 3], [6, 9], [11, 16], [16, 25], [20, 35], [24, 48], [27, 62], [32, 80], [36, 100]], 1.15], // 71.5 →
    ],
  },
  bird: {
    kind: 'bird', color: 'accent', size: 0.25, height: 0.16,
    blocking: [
      ['key', 63.5, [-18, 9, 6]],      // enters high, frame left
      ['key', 64.6, [-6, 4.5, -8]],
      ['key', 65.3, [-1.2, 3.2, -12]], // swoops past the lens: colour enters the film
      ['key', 66.0, [2.5, 2.6, -6]],
      ['key', 66.8, [7, 1.4, 6]],
      ['key', 67.3, [10.5, 0.6, 15]],
      ['perch', 67.8, [13, 22]],       // lands in the blank field, off every road
      ['face', 68.0, 120],          // turns side-on: a bird reads best in profile
      ['chirp', 67.9],
      ['hop', 69.0, [13.45, 21.75]],
      ['chirp', 69.6],
      ['hop', 70.2, [13.9, 21.5]],
      ['face', 70.6, 200],          // looks back toward the walker
      ['key', 83.0, [13.9, 0, 21.5]],
      ['key', 83.6, [15.5, 1.4, 27]],
      ['key', 84.7, [19.5, 3.2, 39]],
      ['key', 85.9, [24, 2.0, 51]],
      ['perch', 86.9, [26.5, 58]],
      ['chirp', 100.5],
      ['key', 104.0, [26.5, 0, 58]],
      ['key', 105.0, [28, 2.5, 66]],
      ['key', 107.0, [33, 9, 90]],
      ['key', 110.0, [42, 16, 130]],
    ],
  },
};

const behindHigh = { pos: [0.4, 3.1, -17.5], look: [0, 0.6, 4] };

export default {
  title: 'The Fork',
  fps: 24,
  size: [1920, 1080],
  seed: 11,
  palette: { paper: '#f2efe7', ink: '#13110e', accent: '#c4381e' },
  style: { sun: { az: 118, elev: 22 } },
  set,
  cast,
  score: { key: 'D', drone: 0.9, wind: 0.8 },
  shots: [
    {
      name: 'the line', dur: 7, wt: 0,
      beat: 'Blank paper. A figure. The road inks itself outward from their feet.',
      camera: cam.frame({ subject: 'walker', size: ['EWS', 'VWS'], angle: [32, 15], az: 0, lens: 35, placeY: [-0.45, -0.3], ease: 'glide' }),
      figureIn: { walker: [0.3, 1.3] },
      reveal: { from: 'walker', start: 1.2, dur: 5.2, radius: 280, feather: 30, ease: 'inOut' },
      fadeIn: 0.5,
      title: { text: 'the fork', at: 2.4, dur: 4.2, y: 0.13, size: 0.03, tracking: 0.5 },
      sound: [{ at: 0.6, note: 'D3', vel: 0.5 }, { at: 2.4, note: 'A3', vel: 0.35 }],
    },
    {
      name: 'walking', dur: 5.5,
      beat: 'Profile. Steady pace, left to right: the direction of the whole film.',
      camera: cam.handheld(cam.frame({ subject: 'walker', size: 'FS', angle: 'hip', side: 90, lens: 50, place: -0.2 }), 0.12),
    },
    {
      name: 'the fork', dur: 10, wt: 43.5,
      beat: 'Ellipsis. The road divides in three. The walker arrives and stops dead centre.',
      camera: cam.fixed({ pos: [[0.6, 4.2, -30], behindHigh.pos], look: [[0, 0.6, 2], behindHigh.look], lens: 35, ease: 'glide' }),
      transition: { type: 'dissolve', dur: 1.2 },
      sound: [{ at: 8.6, note: 'F3', vel: 0.3 }],
    },
    {
      name: 'left?', dur: 3.0,
      beat: 'Close. The head turns to the left road.',
      camera: cam.handheld(cam.frame({ subject: 'walker', size: 'MCU', side: 22, angle: 'eye', lens: 85, place: 'left', lock: 'start' }), 0.12),
    },
    {
      name: 'pov left', dur: 2.3,
      beat: 'The left road: heavy, dark banks.',
      camera: cam.handheld(cam.pov('walker', { lens: 30, tilt: -5 }), 0.3),
      hide: ['walker'],
      sound: [{ at: 0.2, note: 'C3', vel: 0.3 }],
    },
    {
      name: 'right?', dur: 2.2,
      beat: 'Back to the face. The head swings to the right road.',
      camera: cam.handheld(cam.frame({ subject: 'walker', size: 'MCU', side: -22, angle: 'eye', lens: 85, place: 'right', lock: 'start' }), 0.12),
    },
    {
      name: 'pov right', dur: 2.5,
      beat: 'The right road: lighter, easier, and just as certain.',
      camera: cam.handheld(cam.pov('walker', { lens: 30, tilt: -5 }), 0.3),
      hide: ['walker'],
      sound: [{ at: 0.2, note: 'E3', vel: 0.3 }],
    },
    {
      name: 'the bird', dur: 4.5,
      beat: 'Wide again. Colour enters the film for the first time: a red bird, off every road.',
      camera: cam.fixed({ pos: behindHigh.pos, look: [behindHigh.look, [3.5, 0.6, 9]], lens: 35 }),
      sound: [{ at: 0.4, note: 'A4', vel: 0.45 }, { at: 1.1, note: 'E5', vel: 0.3 }],
    },
    {
      name: 'blank paper', dur: 2.5,
      beat: 'Ground level. The bird on untouched paper; the walker small at the fork behind it.',
      camera: cam.frame({ subject: 'bird', size: 0.7, angle: 'ground', az: -150, lens: 85, place: 'right', lock: 'start' }),
    },
    {
      name: 'decision', dur: 4.0,
      beat: 'The walker turns and walks straight into the lens.',
      camera: cam.frame({ subject: 'walker', size: 'MS', side: 40, angle: 'eye', lens: 50, lock: 'start' }),
      sound: [{ at: 1.0, note: 'D4', vel: 0.35 }, { at: 1.5, note: 'A4', vel: 0.3 }],
    },
    {
      name: 'off the road', dur: 6.5,
      beat: 'Profile, wide. Off the road, a new line draws itself behind each step.',
      camera: cam.frame({ subject: 'walker', size: 'VWS', angle: 13, az: -56, lens: 40, place: 'left', placeY: -0.15 }),
      style: { sun: { az: 30 } },   // cheat the light so the shadow falls sideways, not into the figure
    },
    {
      name: 'the new line', dur: 5.5,
      beat: 'Low, behind. The new line leads from the lens to the walker. The bird lifts and goes on ahead.',
      camera: cam.handheld(cam.frame({ subject: 'walker', size: ['FS', 'WS'], side: 180, angle: 'low', lens: 28, placeY: 0.1 }), 0.15),
      sound: [{ at: 3.0, note: 'F#4', vel: 0.3 }],
    },
    {
      name: 'map', dur: 11, wt: 99,
      beat: 'Crane up to a map: three roads, and one line no one drew before.',
      camera: cam.frame({ subject: 'walker', size: ['WS', 78], angle: [24, 89.6], az: 34, lens: 35, ease: 'glide' }),
      transition: { type: 'dissolve', dur: 1.0 },
      fadeOut: 2.2,
      sound: [{ at: 1.0, note: 'D3', vel: 0.4 }, { at: 1.05, note: 'A3', vel: 0.3 }, { at: 1.1, note: 'F#4', vel: 0.25 }],
    },
    {
      name: 'end', dur: 5.5, blank: true,
      beat: 'Paper again. The last line of the film is written, not drawn.',
      title: { text: 'there was no road.\nonly walking.', at: 0.4, dur: 4.8, y: 0.5, size: 0.026, tracking: 0.32, leading: 2.0, fade: 1.2 },
      sound: [{ at: 0.5, note: 'E4', vel: 0.25 }, { at: 0.55, note: 'B3', vel: 0.2 }],
    },
  ],
};
