# Directing a Paperlight film

A film is one JavaScript module (`films/<name>/film.js`) exporting a description. The engine does
everything else. Write it in this order — the same order a production works in.

## 0. Workflow

```bash
# From the skill directory as below; from your own project use node <skill-dir>/engine/src/cli.js …
node engine/src/cli.js caps   films/<name>/film.js          # every capability, and which this film uses
node engine/src/cli.js board  films/<name>/film.js          # storyboard contact sheet  -> out/storyboard.png
node engine/src/cli.js lint   films/<name>/film.js          # continuity report
node engine/src/cli.js model  films/<name>/film.js --actor walker   # character model sheet (incl. acting row)
node engine/src/cli.js qa     films/<name>/film.js          # readability, crops, jumps, camera pops, accent, determinism
node engine/src/cli.js render films/<name>/film.js --publish --size 1080x1920   # vertical
node engine/src/cli.js still  films/<name>/film.js --shot 7 --at 0.4 --scale 0.5
node engine/src/cli.js render films/<name>/film.js                       # draft, 640×360 (≈20 s for 70 s of film)
node engine/src/cli.js render films/<name>/film.js --publish             # 1080p publish quality (≈5 min)
node engine/src/cli.js render films/<name>/film.js --shots 8-9            # re-render a range
```

Iterate on the **board** first (seconds), then **stills** of problem frames, then a half-res render.

## 1. Story → beats

Write a logline and a world-time plan at the top of `film.js`. A short in this style is usually
one character, one place, one change, one colour. 45–90 s, 10–15 shots.

## 2. The set (`set`)

The world is a ground plane described as primitives; their distance field is drawn as contour lines.

```js
set: {
  bounds: [x0, z0, x1, z1],   // metres; +z is "north", +x is "east"
  cell: 0.4,                  // grid resolution of the field (smaller = finer, slower)
  blend: 5,                   // smooth-min radius: how softly paths merge
  roads: [{ pts: [[x, z], ...], width: 3.4, tone: 1.2 }],  // tone scales darkness of its banks
  ponds: [{ at: [x, z], r: 12, tone: 1 }],
  profile: { maxD: 11, bankFall: 2.6, spacing: 0.085 },    // optional tone profile overrides
}
```

Terrain is cached in `films/<name>/.cache/`; changing the set rebuilds it (~1 s).

### Several worlds

```js
sets: {
  room:  { mood: 'night', bounds: [-3, -2.5, 3, 3], boards: { spacing: 0.13 },
           sky: { stars: 140, moon: { az: 5, elev: 9, phase: 0.38 } }, moonlight: [[0, 0.22], [299, 0]],
           shadows: false,
           props: [ { kind: 'window', at: [0.4, 1.35, 3], w: 1, h: 1.2, curtains: true },
                    { kind: 'bed', at: [0.2, 2.45], yaw: 90, len: 1.7, headboard: 0.22 },
                    { kind: 'lamp', at: [1.4, 0.5, 2.65], on: [[0, 1], [21.9, 0, 0.45]] } ] },
  dream: { mood: 'dream', field: { type: 'billows', levels: 34, spacing: 0.8 }, style: { coverage: 0.16 },
           clouds: [ { at: [24, 0, 16], w: 9, h: 7, seed: 4 } ] },
}
// each shot:  { set: 'dream', ... }   each actor:  ['set', 'dream'] in its blocking
```

## 3. Cast and blocking (`cast`)

Actors live in **continuous world time**. Shots never move actors — they only look at them.

```js
walker: { kind: 'person', height: 1.76, build: 1, hem: 0.46, hat: false, scarf: null /* or 'accent' */,
  hair: 'short' /* short | long | bun | crop | none */, hairSeed: 1.3 /* which way the hair falls */,
  start: 0, exit: 'end',   // exists only from `start` until its blocking ends (or a world time)
  motif: 'pioneer',        // several cast entries can share one accent motif (lint counts motifs)
  blocking: [
    ['at', [0, -68], 0],                 // position, heading in degrees (0 = north, 90 = east)
    ['walk', [[0, -20], [0, -1]], 1.3],  // waypoints (spline), speed m/s; eased start/stop
    ['stand', 2],
    ['look', -60, 4.6],                  // turn head (relative deg) and hold for 4.6 s
    ['glance', 30, 0.6],                 // head turn that doesn't consume time
    ['turn', 34, 1.0],                   // body to absolute heading over 1 s
    ['trail'],                           // start drawing a new line behind them
    ['trail', 'end'],                    // stop it (trails persist; many walkers' trails accumulate into a road)
    ['hide'], ['show'],
  ] },
bird: { kind: 'bird', color: 'accent', size: 0.25, height: 0.16,
  blocking: [
    ['key', 63.5, [x, y, z]],            // absolute world time, 3D position (flight spline)
    ['perch', 67.8, [x, z]],             // land
    ['face', 68.0, 120],                 // perched heading (profile reads best)
    ['hop', 69.0, [x, z]], ['chirp', 69.6],
  ] },
```

```js
// a cloud with a personality
puff: { kind: 'cloud', set: 'dream', shape: 'small', scale: 1, height: 1, enter: 100,
  blocking: [ ['key', 115.2, [20, 2, 15]], ['shape', 130.3, 'rabbit', 1.3], ['shape', 136.2, 'whale', 2],
              ['scale', 136.2, 1.3, 2], ['glow', 163, 1, 1.6], ['rain', 164.6, 1, 0.6] ] },
// a child, riding it
mira: { kind: 'person', height: 1.12, headScale: 1.5, flare: 1.55, hem: 0.14, hair: 'bob', feet: 'bare',
  blocking: [ ..., ['gesture', 'up'], ['until', 141.3], ['gesture', 'none'], ['ride', 'puff', [0, 0.52, 0.35]],
              ['until', 160.5], ['dismount', [-18.9, 151.6], -146], ... ] },
```

Print positions over time while blocking (`compileWorld(film).state('walker', t)`) to line shots up
with action.

### Acting, objects and threads

```js
kid:   { kind: 'person', height: 1.15, headScale: 1.45, hair: 'pigtails', gait: { bounce: 1.4, swing: 1.3 },
         blocking: [ ['at', [-8, 0.5], 90], ['gesture', 'hold'], ['walk', [[6, 1.4]], 3.4],      // 3.4 m/s = running
                     ['gesture', 'up', 0.25], ['pose', { chin: 30, lean: -6 }, 0.4], ['stand', 2.5],
                     ['pose', { slump: 0.7 }, 1.2], ['lookAt', 'elder'], ['walkTo', 'elder', 1.1, 1.7] ] },
elder: { kind: 'person', hat: true, gait: { stride: 0.72, bounce: 0.5, lean: 7 },
         blocking: [ ['at', [12, 10.35], 0], ['sit', 'chair', 0], ['until', 11], ['rise', 1.2], ['face', 'kid', 0.8] ] },
kite:  { kind: 'kite', color: 'accent', motif: 'kite', size: 0.9, length: 12,
         blocking: [ ['heldBy', 0, 'kid'], ['release', 9.2], ['heldBy', 13.9, 'elder'], ['length', 13.9, 6, 3] ] },
bond:  { kind: 'thread', color: 'accent', motif: 'kite', blocking: [ ['link', 21.2, 'elder', 'kid', { grow: 1.6 }] ] },
// film.air = { dir: 80, speed: 4, gust: 0.4 }   — the wind the kite, thread, coats and weather share
```

Gestures: `reach point wave beckon up hold offer take catch fly hip hug shield cross behind none`.
Each arm has its own track — `['gesture', 'wave', 0.4, 'far']` (far arm), `'near'` (default), `'both'`.
Pose: `{ lean, slump, chin, breath }`. `sit` takes `'chair'` or `'ground'`; also `['kneel', dur]`, `['lie', dur]`, `['rise', dur]`.
`['walk', [[x, z]], speed, { face: false }]` is a sidestep. `walkTo`/`face` resolve where the other person is at that moment.
Objects: `['heldBy', t, 'who', 'second holder']`, `['release' | 'drop', t]`, `['fly', t, [x, y, z]]` (steer a free kite or balloon
into the next hand), `['length', t, m, dur]`, `['steer', t, [[t, [x, y, z]], …]]` (a *held* kite pushed along a path —
a lull sinks it, it lands and lies on the land, still on its string), `['slack', t, sag, dur]` (a shared string lies on the
land when slack, lifts when taut), `['tug', t, 'who', amp]` (a ripple runs along the shared string from that person's
hand at `tugSpeed` m/s; pair with gesture `tug` and a `pluck` cue where it arrives; `shareWidth` thickens the line for
wide shots — film it low, against the sky). Carried things: `kind: 'object', shape: 'case', hang`. Gusts: `film.air.gusts = [[t, strength, dur]]`.

### Contact, speech, life, depth
```js
['touch', 'otto:hand', 0.5]            // the hand lands on his hand (IK); also [x,y,z], 'name', 'name:head'
['speak', 1.2]                         // talks (no time): nods + a speech mark
life: { walkers: 4, birds: 3 }         // on a set: passers-by on its roads, flocks crossing
dof: { px: 2.6, focus: 4.5 }           // on a shot: soften what is behind a close subject (auto in the living look)
['lift', 0.44, 0], ['tuck', true], ['sit', 'bed', 0]   // in bed (+ blanket: 'fabric'); pose { tuck: 1 } to sleep
```

### More world

```js
rivers: [{ pts: [[-140, 0], [0, 0], [140, 0]], width: 10, flow: 0.7 }],         // banks + flowing surface
field: { type: 'rings', centers: [[0, 0]], period: 4, warp: 3 },                // abstract ripples
motion: { dir: 30, speed: 2, amp: 0.35, length: 16 },                           // the land moves by itself
props: [ { kind: 'bridge', at: [0, 0], yaw: 90, len: 15, rise: 1.3 }, { kind: 'lamppost', at: [8, 7] },
         { kind: 'fence', pts: [[-70, 6], [-1, 6]] }, { kind: 'buildings', at: [0, 46], len: 200, h: 3.6, lit: 0.35 },
         { kind: 'pillar', at: [6, 10], h: 5 }, { kind: 'arch', at: [-6, 14], w: 3, h: 4.5 } ],
```

### Colour script

```js
colors: {
  joy:  { color: '#e8b528', meaning: "Lila's happiness — shared with the town at the end" },
  home: { color: '#f0d39a', meaning: 'warmth waiting at home', level: [[0, 0.35], [36.3, 1, 3.5]] }, // story time
},
// actors/props use them by name: { kind: 'balloon', color: 'joy' }, { kind: 'lamppost', color: 'home' }
// per shot:  grade: { temp: [-0.45, 0.25], sat: [0.65, 1] },  tint: { moon: ['joy', { from: 0, to: 0.7 }] }
```

### Music, match cuts, loops

```js
music: { file: 'music.wav', gain: 0.55, snapCuts: 'beats' },   // or 'bar'; `beats` command shows tempo and cut times
loop: { crossfade: 1.5 },                                       // seamless ambient loop (best without walking figures)
// a shot: matchCut: { from: 'balloon', to: 'moon', release: 3 }  — the new subject lands where the old one was
```

## 4. Shots (`shots`)

```js
{ name: 'left?', dur: 3.0,              // seconds of screen time
  wt: 43.5,                             // optional: jump to this world time (ellipsis); or skip: 20
  beat: 'Close. The head turns to the left road.',   // shows on the storyboard
  camera: cam.frame({ ... }),
  transition: { type: 'dissolve', dur: 1.2 },        // default: cut
  fadeIn: 0.5, fadeOut: 2,              // to/from paper ({dur, color:'ink'} for black)
  reveal: { from: 'walker', start: 1.2, dur: 5, radius: 280, feather: 30 },  // world inks itself in
  figureIn: { walker: [0.3, 1.3] },     // fade a figure in (seconds into shot)
  hide: ['walker'],                     // e.g. in their own POV
  title: { text: 'the fork', at: 2.4, dur: 4, y: 0.13, size: 0.03, tracking: 0.5 },
  style: { sun: { az: 30 } },           // per-shot overrides (cheat the light)
  season: 'winter',                     // autumn | winter | spring | summer, or { base: 'winter', cover: 0.5, ... }
  weather: { count: 6000 },             // override the season's weather for this shot (false = none)
  ambience: { rain: 0.5 },              // override the season's sound bed
  sound: [{ at: 0.4, note: 'A4', vel: 0.45 }],
  wind: 1.2,                            // ambience level for this shot
  blank: true,                          // paper only (title cards)
  allowFlip: true, empty: true, flashback: true,     // silence specific lint rules
  season: { from: 'grey', to: 'warm', start: 0.2, end: 1 },   // colour progression inside the shot
  accent: [0.4, 1],                                            // accent strength across the shot
  feel: { flow: 0.5, agitation: [0, 0.7], pull: 0.8, toward: ['a', 'b'], density: -0.3 },  // experimental
  transition: { type: 'iris', dur: 0.9, at: 'kite' },          // or dissolve | wipe { dir } | cut
  sound: [{ at: 1, note: 'C5' }, { at: 1.4, sfx: 'chime' }],   // sfx: chime pluck whoosh flutter thump pop
}
// film.audio = [{ file: 'narration.m4a', at: 2, gain: 1, fadeIn: 0.5 }]  — external tracks, mixed at export
```

### Camera grammar

```js
cam.frame({ subject, size, angle, side | az, lens, place, placeY, lock, ty, pan, tilt, roll, offset, ease })
```
- `size`: `ECU 0.24 · CU 0.48 · MCU 0.8 · MS 1.25 · MLS 1.8 · FS 2.5 · WS 6 · VWS 16 · EWS 45 · XWS 120`
  (metres of frame height at the subject) or a number.
- `angle`: `ground · low · hip · eye · high (28°) · birds (62°) · top` or an elevation in degrees.
- `side`: where the camera stands relative to the subject's facing — `0` front, `180` behind,
  `90` their right. Or `az`: absolute direction the camera looks (0 = north).
- `place`: `'left' | 'right' | 'center'` or −1…1 horizontal placement; `placeY` −1…1 vertical.
- `lock: 'start'` freezes the framing at the shot's first frame (static camera, subject moves through).
- Any parameter can animate: `size: ['WS', 'MCU']` (push in), `side: [120, 180]` (orbit),
  `angle: [24, 89.6]` (crane to top), `lens: [24, 85]` with fixed size (dolly-zoom).

Other specs: `cam.fixed({ pos, look, lens })`, `cam.pov('walker', { lens, tilt })`,
`cam.move(specA, specB, { ease })`, `cam.handheld(spec, 0.15)`.

## 5. Seasons & weather

A shot's `season` sets paper and ink tone, a pale sky wash, weather particles and the sound bed:

| season | tone | weather | sound |
|---|---|---|---|
| `autumn` | warm paper, amber sky | drifting leaves (muted ochre) | gusty wind |
| `winter` | cool grey-blue | snow as paper-white flakes; lines half-buried (`cover`) and lighter | muffled wind, softer steps |
| `spring` | fresh pale green | fine slanted rain hairlines | rain hiss and drops, distant birds |
| `summer` | bright cream, golden sky | slow glinting dust; long hard shadows | calm air, distant insects |

Presets live in `engine/src/atmosphere.js`; override per film with `seasons: { winter: { ... } }`.
Seasons are tones, not accents — keep the film's accent the only saturated colour. Dissolve between
seasons; the sound beds cross-fade by themselves.

## 6. Continuity lint

`lint` checks: screen direction flips across cuts (crossing the line), jump cuts, world time running
backwards, shots with no figure in frame, very short/long shots, more than one accent-coloured element.
Warnings also appear in red on the storyboard. Silence a rule per shot only when the break is a choice.

## 7. Sound

`score: { key: 'D', drone: 0.9, wind: 0.8 }` plus per-shot `sound` note cues. Footsteps and chirps
are automatic. Keep notes to story beats: an arrival, the colour, the decision, the end.
