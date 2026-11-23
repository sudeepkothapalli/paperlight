---
name: paperlight
description: Paperlight — make short narrative animated films (15 s – 3 min) entirely from code, no image or video models. Ink-silhouette characters who act with posture, gesture and touch, in living worlds of real materials lit by a time of day (towns, rivers, bridges, rooms, meadows, seas of cloud, cities on fire); colour that carries meaning; real cinematography and editing; synthesized sound and score. Handles any register (wonder, play, comedy, tension, loss, fable), ensembles, objects that change hands (kites, balloons, cases, lanterns), shared strings, weather and seasons, cloud characters, figures who leap and fly. Use when asked for a short film, an animated story, a poem or fable turned into a film, a storyboard, a silhouette / shadow-puppet / ink style animation, or "a Paperlight film".
---

# Paperlight — films from code, in silhouette and light

Paperlight turns a story into a finished 1080p film with sound, using only code: a Node renderer (canvas + ffmpeg)
that draws ink-silhouette characters in lit, living worlds. You (Claude) write the story plan and a `film.js`; the
engine renders it.

**Where things live.** This skill's folder (the *skill directory*) holds the engine, templates, docs and example
films. The user's films live in **their** project: `films/<slug>/film.js` + `films/<slug>/STORY.md`. Run every
command from the user's project as `node <skill-dir>/engine/src/cli.js <command> films/<slug>/film.js`; renders and
caches are written next to the film (`out/`, `.cache/`). Start a film from `<skill-dir>/templates/film.js` (it needs
no imports and works in any folder).

**Setup once** (in the skill directory): `npm install` (Node ≥ 20); `ffmpeg` must be on PATH. If `npm install` has
not been run, run it before the first command.

`engine/` renders · `docs/` explains · `templates/` starts a film · `films/*` are worked examples — read one first
(`films/_style-test` is the visual regression test; `_lab` and `_loop` are capability tests).

| Example | What it shows |
|---|---|
| `films/the-fork` | one walker, one choice, one bird; a world that inks itself in |
| `films/desire-path` | many walkers across seasons; a path that forms from footsteps |
| `films/small-cloud` | two worlds (bedroom ↔ dream); moods; a cloud that morphs; a child; riding |
| `films/the-bridge` | comedy → kindness; two characters, a river town at dusk, a balloon and a case changing hands, cuts on the music's beats, a match cut to the moon |
| `films/a-string-between-us` | isolation → connection, told without words: a kite carried across a flowing land by the wind, one tug along the string answered by a wave, two people winding the distance in |
| `films/_lab` | capability test: a kite flown, lost in a gust, caught and shared — every hand-off motivated and on screen |


---

## 1. What it can do

**Worlds** (`sets`; a film may have several, each shot names one)
- Ground contours: `roads`, `ponds`, **`rivers`** (banks drawn like roads; the surface takes the mood's `water` colour, paler mid-stream, with
  glints drifting downstream, banks' props reflected upside down and lamps drawn out into rippling streaks) · fields: `flow` (long flowing bands), `billows` (a sea of cloud tops), **`rings`** (ripples around
  centres — abstract/geometric spaces) · interiors: `boards` + props · **`motion: { dir, speed, amp, length }`** makes
  a set's lines move by themselves (wind waves through grass, swell on water).
- Props: `window` (sky, stars, moon, clouds seen through glass; curtains; moonlight on the floor), `bed`, `table`,
  `lamp` (glow, switchable), `bench`, `tree` (`style: 'bare' | 'round'`, sways), `house` (`lit` windows),
  **`bridge`** (arched; people walk over it at deck height), **`lamppost`** (glow), **`fence`**, **`buildings`** (a seeded
  row, some windows lit), **`pillar`**, **`arch`**.
- Sky: `stars`, `moon {az, elev, phase}`, `sun {az | relAz, elev}` per set or per shot. Cumulus `clouds`.
- **Fire**: any `buildings`, `house`, `tower` or `tree` takes `fire: { start, from: [x, z], speed, size, out }`. It
  spreads outward from `from` (stage it where a character lands), with layered flames, glow and smoke. Weather
  `embers`; palette keys `fire · fire2 · fireCore · smoke`; ambience `fire` (roar + crackle) and `surf` (sea).
- **More architecture**: `tower` (a tiered tower with a dome), `rock` (crags people can stand on), `wall`
  (crenellated). **`tone: 0..1`** on any prop hazes it toward the paper, so night cities sit *behind* black figures.
- One wind: `film.air = { dir, speed, gust }` — kites, threads, coats and weather all read it.

**Characters** (`cast`)
- People of any age: `height`, `build`, `headScale` (children ≈ 1.45), `hem`, `flare`, `shoulders`, `hair`
  (`short · long · bob · bun · pigtails · crop · none`), `hat`, `scarf`, `feet: 'bare'`,
  and **`gait: { stride, bounce, swing, knee, lean }`** — personality in the walk (bouncy child, stooped elder, brisk).
- Fantastical figures: `crown`, `tail: { len, curl }` (it streams behind in flight), `carry: { kind: 'mace' |
  'spear' | 'torch' }`, `tailFire: [[wt, level, dur]]`.
- Birds; **cloud characters** (`shape` morphs, `scale`, `glow`, `rain`); **objects**: `kite`, `balloon`, `lantern`,
  `ball`, `flower`; **threads** between any two things.

**Acting** (blocking ops, in one continuous world clock)
- **Carried things** (cases, lanterns, flowers) are drawn at the hand as drawn, and eased into it when picked up;
  use `['touch', 'case', 0.6]` before a pick-up so the hand goes down to it. Bridges draw their near rail in front
  of the people on the deck and the deck and far rail behind them. Depth of field never blurs a story character.
- **Contact and hands**: **`['touch', target, ramp, arm]`** puts a hand exactly on a point, a person
  (`'name'`), their head (`'name:head'`) or their hand (`'name:hand'`) with two-bone IK, the elbow bending naturally.
  Hands take shapes by gesture: open (reach, offer, take, touch, wave), a fist (hold, fly, tug), a pointing finger.
- **Talking without a face**: `['speak', dur]` (no time) — a nodding head and a small speech mark beside it.
- **Secondary motion** (automatic): after a stop or a turn the coat hem swings on and the head settles.
- Heroics: **`['leap', [x, z], dur, { height, land, soar }]`** (a ballistic flight; the body pitches into a flying pose;
  `land` = new ground height, e.g. a rooftop) · **`['grow', scale, dur]`** (grow huge, become small) · gesture `palms` (palms joined: thanks, a greeting, a plea).
- In bed: `['lift', mattressHeight, 0], ['tuck', true], ['sit', 'bed', 0]` (+ `blanket: 'fabric'` on the character):
  sitting up with the legs under a soft blanket; `pose { tuck: 1, lean: -24 }` pulls it to the chin to sleep.
- Moving: `at · walk (fast = run; { face: false } = sidestep) · walkTo 'someone' · stand · until · turn · face 'someone' · hop · lift · ride / dismount · sit / kneel / lie / rise`
- Looking: `look` (angle) · `lookAt 'someone'` (keeps looking while either moves) · `glance`
- Attitude: `pose { lean, slump, chin, breath }` — slumped, hopeful (chin up), eager (lean in), afraid (lean back)
- Gestures: `reach · point · wave · beckon · up · hold · offer · take · catch · fly · hip · hug · shield · cross · behind`.
  **Each arm has its own track**: `['gesture', 'wave', 0.4, 'far']` waves with one hand while the other keeps holding.
  Arms overshoot slightly and settle, and idle arms breathe.
- Automatic: soft contact shadows under every figure; the feet step through on-the-spot turns; resting arms hang
  a little away from the body so a front view reads as a person; anticipation (the head leads a turn; weight shifts back and the eyes go first before setting off);
  weight shifts forward when setting off and back when stopping; stride scales with body size and speed;
  footsteps follow the strides; people stand on bridge decks.
- Objects: `['heldBy', t, 'who']` (a kite flies downwind on its string; a balloon floats above the hand),
  `['release', t]` (it drifts and climbs on the wind, the cut string trailing), caught again by anyone, `['length', …]`.
  `['steer', t, [[t, [x,y,z]], …]]` pushes a held kite along a path (a lull sinks it and it lands, still on its string);
  `['heldBy', t, 'b', 'a']` = one string through both hands; `['slack', t, sag, dur]` (slack, it lies on the land;
  taut, it lifts); **`['tug', t, 'who']`** sends a ripple along the shared string from that hand (`tugSpeed` m/s), so a
  conversation in pulls is visible from a wide shot — cue a `pluck` where each arrives. Gesture `tug` is the pull.
  Threads: `['link', t, 'a', 'b', { grow }]` — drawn on from one end, sag and sway in the wind.

**Two looks**
- **Classic** (default): everything in ink on toned paper; moods swap the paper and ink. Graphic and stark.
- **Living** (`film.look = 'living'` or per set): the characters stay ink silhouettes (the signature), and the world
  gets real materials lit by a time of day. `light: 'morning' | 'noon' | 'golden' | 'overcast' | 'dusk' | 'night'`
  (film, set or shot; `{ from, to, start, end }` changes the light *inside* a shot), `ground: 'grass' | 'meadow' |
  'earth' | 'sand' | 'snow' | 'pavement' | 'stone'`. Every prop kind has material presets (plaster walls, tiled roofs,
  wooden decks and fences, iron rails and lampposts, bark and foliage, stone), shaded by which way each face points
  and hazed into the sky with distance. Light presets bring their own life: lamps burn warm and pool on the ground,
  windows glow (and now and then one goes on or off), chimneys smoke, the sky is a gradient to a hazy horizon, water
  takes the sky's colour. Override anything: `film.materials = { grass: '#…', roof: ['#…'] }` or per prop
  (`{ kind: 'house', wall: 'brick' }`). **Loudness order**: light > meaning (motifs) > material.
  Use living for warmth, place and everyday life; classic for starkness, fable, abstraction.

**Layering (what goes in front of what)** — one fixed order, so nothing has to be fixed by hand:
1. sky and backdrop (or a room's walls); 2. ground, water with its reflections, roads, the land's lines, trails;
3. shadows (cast and contact) and the glow of lights; 4. **the world, far to near** — every prop, person, bird, cloud
and object sorted by distance, where *big things are split*: a bridge is its deck + far rail (behind the people on it)
and its near rail (in front of them); a long fence is layered in ~3 m pieces; *attached things travel with their
owner*: a carried case or lantern is drawn with the hand that holds it; *strings* (kites, balloons, shared threads)
are drawn right after the nearer of their two ends, so a rail or a person in front of both ends covers them; story
characters are never blurred by depth of field; 5. atmosphere: wash, weather; 6. titles and fades.
New props that people can stand behind or on must follow the same rule: split by side, or into short pieces.

**Place life** — `set.life = { walkers: 6, birds: 4 }`: passers-by who walk the set's roads (each their own height,
pace, hat or hair, tone) and flocks crossing now and then; seeded, background (`bg`), ignored by the story checks.

**Camera depth** — in the living look, close shots soften everything behind the subject (depth of field), so the
figure stands forward; `shot.dof = { px, focus }` tunes it, `false` turns it off.

**Light on the figures** — rim light comes from the strongest nearby story light (lamppost, lamp, fire, torch,
lantern) in either look, else from the sun or moon in the living look. Night skies keep a moonlit band at the horizon
so silhouettes still read. Interiors are whole rooms: back and side walls, ceiling, floor.

**Colour on characters** (the silhouette stays black; colour on a character is earned by meaning)
- **Every lead is seen in colour** from their first shot: give them a readable accent (scarf, ribbon, sash or
  hatband — a cuff alone is too small), unless a colour *arriving* is the point (`arrives: true` on the motif) or
  they are deliberately plain (`plain: true`). Lint checks this.
- **One accent per character**: `accessories: { ribbon | hatband | sash | belt | cuff | hem: 'motifName' }` (or
  `scarf`, which also reads as a sari's end over the shoulder). Seated figures drop the `hem` band.
  It is a motif, so it has a written meaning and follows story time: it can appear, drain (`drain: 0..1` sinks it into
  the silhouette instead of a grey stripe) and return. Strongest use: a colour that **passes between characters**
  (The Bridge: Lila's yellow ribbon; Otto's hatband warms to the same yellow after his kindness).
- **Tonal figures** — each garment gets its own near-black value (coat, sleeves, trousers, shoes, hands and neck,
  hair, hat), capped so it never reads lighter than a deep shadow. **Default `figures: 'auto'`**: pure silhouettes in
  wide shots, garments easing in as a figure fills the frame (medium and close shots), for any number of characters.
  `figures: 'tonal'` (always) or `'silhouette'` (never) on the film or a set; `tonal: false | true | { coat, legs,
  skin, hair, hat }` on a character.
- **Identity tone**: `tone: '#…'` gives each character's black a faint hue of its own (`toneAmt`, default 0.14).
- **Rim light** (living look, on by default): a thin edge of the nearest lamp's light, else the sun's or moon's.
- Lint: one accent colour per character, and it must be a declared motif. Never: fully coloured clothes, patterns,
  faces.

**Mood, colour, feeling**
- Moods/seasons per shot (`autumn · winter · spring · summer` or your own: paper, ink, line, pane, wash, weather,
  shadows, sun, sound bed). **A shot can travel between moods**: `season: { from: 'grey', to: 'warm', start, end }`.
- **Colour as narrative language** (meaning decided per film, never fixed):
  `film.colors = { joy: { color, meaning, level: [[wt, v, dur], …] } }` — named motif colours used by any actor, prop
  or palette key; `level` follows story time (0 = drained grey, 1 = full) so colour appears/drains/returns at story
  moments, continuously across cuts. `shot.grade = { temp: -1…1, sat }` (animatable) for cool↔warm and selective
  saturation. `shot.tint = { moon: ['joy', [0, 0.7]] }` lets a colour pass into something else. `colors` command draws
  the colour script; lint asks every colour for a meaning and flags colour changes no one sees.
- **Emotional geometry (experimental, off unless asked)**: `feel: { flow, agitation, pull, toward, density }` bends the
  world's existing lines — slow breathing flow (calm), nervous jitter (anxiety), leaning toward characters (connection),
  pushing away (`pull` < 0, separation), thinning (`density` < 0, loneliness). Clouds breathe faster and trees sway
  harder when agitated; lampposts flicker. Stable (a function of place and time).

**Camera, editing, sound**
- `cam.frame / fixed / pov / move / handheld`; sizes in metres, angles, sides, thirds, locks; any parameter animated.
- Transitions: cut, `dissolve`, **`iris` (opens from a character or object)**, `wipe`, fades to any palette colour;
  time ellipses; `reveal` (the world draws itself out from someone); **match cuts**: `matchCut: { from: 'balloon',
  to: 'moon' }` turns the incoming camera so the new subject lands exactly where the old one was.
- **Music**: `film.music = { file, gain, snapCuts: 'beats' | 'bar' }` — tempo and beats detected, cuts moved onto them;
  the track is mixed at export. `beats` command prints tempo and where cuts land.
- **Loops**: `film.loop = { crossfade: 1.5 }` — the end blends into the start (picture and sound) for ambient pieces.
- Sound: synthesized ambience from the world (footsteps, birds, rain, wind, crickets, clock, pad), piano notes and
  **`sfx` cues** (`chime · pluck · whoosh · flutter · thump · pop`), plus **external tracks** (narration, music,
  recordings): `film.audio = [{ file, at, gain, fadeIn, fadeOut, dur }]`, mixed at export.

**Style test** — `films/_style-test` (night room, dusk town, dream, fire): render its board after any engine
change and look at it before rendering a film.

**Tools**: **`caps`** (the full capability list and what this film uses) · `board` · **`colors`** (colour script) · `lint` (screen direction, jump cuts, time order, empty frames, one accent motif) · **`qa`**
(silhouette readability against its background, tiny or head-cropped subjects, teleports, camera pops, **single-frame
pops/flicker**, accent area, determinism) · `model` (turnaround, walk, **acting row**, heads, cast) · `still` · `render` (`--publish` 1080p,
`--shots a-b`, **`--size WxH`** for vertical/square).

---

## 2. Stories without words (read `docs/storytelling.md`)

Paperlight films have no dialogue and no faces; they must read the same in any language, with the sound off.
The form is strongest at: **distance as feeling** (two figures far apart, the gap closing), **posture as emotion**,
**light that turns when the feeling turns**, **objects that become words** (a kite, a balloon, a lantern passed or
lost), **one colour that means one thing**, and **weather that acts** (the gust that carries something across).

Build every film around a **wordless conversation**: a visible question and a visible answer.
- **The thread**: a shared string where each pull travels and is answered (one tug → two → three).
- **The passed object**: offered, taken, given back.
- **The signal**: a window lamp switched on in reply, a lantern raised, a wave across the land.
- **Mirroring**, **colour that passes** from one person to another, **closing the distance** along something that
  connects them, **waiting**, **shadows that meet first**, **call-and-response melodies**.

Seed the device early, leave a pause between question and answer, escalate in threes, and always show the message
arrive and the receiver react. Avoid stories that need speech, faces or explanation.

## 3. Direction: adapt to the story

**Range.** The style is not one mood. Pick the tools that fit the feeling:

| feeling | staging that works |
|---|---|
| wonder | reveal the world from a figure; slow push-ins; scale contrast; a pad; open paper |
| play / joy | bouncy gait, hops, runs, a chase across frame; quick cuts; objects in motion; `feel.flow`; birds, plucks |
| tension | static holds, tighter frames, a figure off-centre; `feel.agitation`; drained accent; silence then a thump |
| humour | timing: a hold, a beat, a reversal; mirrored gestures; an object that won't behave (kite pulls, balloon escapes) |
| loss / melancholy | separation in frame, small figures, `feel.density` < 0, slumped pose, colour draining |
| connection | lookAt, walkTo, offer/reach, a thread or a shared object; `feel.pull` toward both; colour warming within a shot |
| conflict | opposing screen directions, cutting between them, `feel.agitation`, sharp transitions |
| resolution | balanced two-shot, lines calming (`flow`), warm mood arriving, a held wide |

**Principles.** Emotion before spectacle · composition before decoration · movement with intention · colour with
meaning (decided per film) · silhouettes against light · faceless characters act through motion and posture ·
**a muted film must still tell its story**.

**Blandness is the most common failure.** Two figures on blank land, cuts only, a static camera, one mood and silence
read as a test scene, not a film. The engine has sky, clouds, birds, weather, props, light that changes, land
that moves, camera moves, transitions and score: use them on every film (workflow step 2).

**Avoid** (formula creep): every film opening on an extreme wide · everyone moving slowly · every world being flowing
lines · always melancholy → hope · a colour change on every emotion · camera movement in every shot · one gait for
everyone · busier backgrounds as the film goes on · text carrying the meaning · feel/colour effects on by default.

---

## 4. Workflow

1. **Interpret** with `templates/STORY.md` (central idea, emotional arc, characters & gaits, **the wordless conversation**,
   motif and what its colour means *here*, moods per act, shot table, what must read with the sound off). Its last table says how much to add
   for each kind of input. User constraints override every default. Decide rather than ask, unless two readings would
   make different films.
2. **Capability pass: required on every request.** Run `node <skill-dir>/engine/src/cli.js caps films/<slug>/film.js`: it lists
   **every** capability the skill has (look and light, world, life, acting, camera, editing, colour, feeling, sound,
   format) and marks what the film uses. Use everything that applies to the story; for each one left out, write
   one line in STORY.md's *Capability pass* saying why (e.g. "no water: it's a dream of clouds"). A request never gets
   a reduced version of the skill because it is short, simple or vertical: a 15-second short still gets light,
   life, sound and camera. Re-run `caps` before rendering. **New engine features must be added to `caps.js`** so no
   later film forgets them.
   **Enrich: required on every film, whatever its length or mood.** Minimal means *few elements, each alive*, not
   *empty*. Before writing shots, fill the template's **Surroundings & ambience** table: for each act, decide the
   **sky** (sun/moon/stars, drifting clouds, time of day), **place** (something near, middle and far: a tree, a fence,
   a bench, a far house with a lit window), **life** (birds, moving clouds, passers-by), **air** (leaves, motes, rain,
   snow; gusts), **land** (motion, `feel`), **light** (mood blends *inside* shots, grade, long shadows), **sound** (ambience
   beds per mood, cues, a melodic motif or a music track) and **camera & editing** (moves, a reveal, dissolves, an iris or
   match cut, POV). Then give **every shot at least one living thing besides the characters** — wind in the lines,
   leaves crossing, a bird, a cloud, a flicker of light — and a **staged image**: a silhouette against the sun, a
   figure framed by a tree, a line leading the eye. Each element must belong to the story (the wind carries what the
   story carries; the light turns when the feeling turns). `lint` scores **richness out of 9** and names the families
   not used: aim for 8–9 and justify any gap (an empty room can be the point). Restraint still governs *colour* and
   *clutter*: three planes of depth, not thirty props.
3. **Build** `films/<slug>/film.js` (in the user's project) from `<skill-dir>/templates/film.js`: moods → sets → cast (blocking in world time; print
   positions over time to line shots up) → shots.
4. **Check cheaply**: `caps` → `board` → `lint` → `qa` → `model --actor <name>` → `still --shot N --at 0.5 --scale 1`.
   Look at every image. Fix what lint/qa flag unless it is a deliberate choice (then mark it: `allowFlip`, `empty`…).
5. **Render** for review at 1080p: `render films/<slug>/film.js --publish` (≈ 2–5 min per minute of film on 8 cores).
   Contact sheet: `ffmpeg -i out.mp4 -vf "fps=1,scale=320:-1,tile=6x10" -frames:v 1 sheet.png`; inspect transitions.
   Revise one shot with `--shots N` or a `still` instead of re-rendering everything.

## 5. Extending

Fields: `fieldValue` (`terrain.js`) · props/objects/threads: `scenery.js` · figures, gaits, gestures, hair:
`figures.js` · blocking ops: `actors.js` · moods: `atmosphere.js` · camera idioms: `camera.js` · checks: `lint.js`, `qa.js`.
