// <TITLE> — starter film. Copy to films/<slug>/film.js (in your own project), then replace everything you need.
// See docs/direction.md for every option, and films/* in the skill for complete examples.
// The engine hands the film its camera tools, so this file needs no imports and can live in any folder.

export default ({ cam }) => ({
  title: 'Untitled',
  fps: 24,
  size: [1920, 1080],            // or [1080, 1920] for vertical
  seed: 1,
  palette: { paper: '#f1eee6', ink: '#14120f', accent: '#c4381e' },
  look: 'living',                                 // real materials lit by a time of day (or leave out for classic ink)
  light: 'golden',                                // morning · noon · golden · overcast · dusk · night · dream · dreamNight
  colors: {                                       // every colour says what it means in THIS story
    accent: { color: '#c4381e', meaning: 'what this colour stands for here', level: [[0, 1]] },
  },
  air: { dir: 90, speed: 3, gust: 0.3 },          // one wind for kites, threads, coats, weather
  seasons: {                                       // moods: the sound bed and the air of each place
    calm: { sound: { wind: 0.6, birds: 0.5 }, weather: { type: 'motes', count: 160, wind: 0.4 } },
  },
  sets: {
    main: {
      mood: 'calm', ground: 'grass',
      bounds: [-120, -80, 120, 200],
      roads: [{ pts: [[-120, 0], [0, 2], [120, 0]], width: 3 }],   // or field: { type: 'flow' | 'billows' }, rivers, boards
      motion: { dir: 90, speed: 1.5, amp: 0.25, length: 16 },      // the grass moves in the wind
      sky: { sun: { az: 10, elev: 8 } },
      life: { walkers: 2, birds: 2 },                              // passers-by and birds, generated
      props: [                                                      // near, middle, far
        { kind: 'tree', at: [12, 18], h: 6, seed: 2, style: 'round' },
        { kind: 'fence', pts: [[-40, 6], [40, 6]] },
        { kind: 'house', at: [30, 60], w: 6, d: 6, h: 3.4, roof: 2.4, lit: 0.6 },
      ],
    },
  },
  cast: {
    a: { kind: 'person', set: 'main', height: 1.7, hair: 'short',
      tone: '#2c2a3a', scarf: 'accent', // one meaningful accent per character (ribbon, hatband, sash, belt, cuff, hem)
      blocking: [['at', [-10, 0], 90], ['walk', [[0, 1]], 1.2], ['look', -30, 2]] },
  },
  shots: [
    { name: 'opening', set: 'main', dur: 5, wt: 0, beat: 'What the audience should feel here.',
      light: { from: 'golden', to: 'dusk', start: 0.3, end: 1 },   // light can change inside a shot
      reveal: { from: 'a', start: 0, dur: 3, radius: 120 },        // the world draws itself out from her
      sound: [{ at: 1, note: 'C5', vel: 0.2 }],
      camera: cam.frame({ subject: 'a', size: ['WS', 'FS'], angle: 'eye', side: 90, lens: 40 }), fadeIn: 0.5, fadeOut: 1 },
  ],
});
