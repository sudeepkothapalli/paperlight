# Changelog

## Unreleased

- Scarves read as cloth worn on the body: a roll round the neck, a front end on the chest edge, an end trailing in the wind.
- The sun and moon set behind the horizon; the far ground fades into the sky's horizon colour (no grey band).
- Clearer defaults: overcast and dusk haze keep the far side of wide shots readable; shared strings are thick enough to watch a tug travel.
- `docs/design-decisions.md`: every rule that came from feedback, and where it lives in the engine.
- Ten starter ideas for wordless films in `docs/storytelling.md`.

## 1.1.0 — 2026-11-23

- Storytelling guide (`docs/storytelling.md`): what the form is best at, wordless conversation devices (the thread,
  the passed object, the signal, mirroring, colour that passes), story shapes; a *Wordless conversation* table in
  the story template; a `caps` check for it.
- Sitting on the ground: knees drawn up, arms around them, the coat pooling on the ground (bed sitting unchanged).
- Cumulus clouds rebuilt in rows: a flat base and a lumpy rounded crown; no floating puffs or stalks.
- Every lead is seen in colour: lint warns when a lead's accent is too small or drained when we first meet them
  (`arrives: true` for colour that is meant to arrive, `plain: true` for a deliberately plain lead).
- New example *A String Between Us*, made from scratch with the skill. The example set is now five films.
- Gesture `palms` (palms joined).

## 1.0.0 — 2026-11-23

First public release.

- Skill and engine: story plan → `film.js` → checks → 1080p render with synthesized sound.
- Living look (materials lit by six times of day and two dream lights) and classic ink look.
- Characters: gaits, two-arm acting, touch IK, hand shapes, sit / kneel / lie / in bed, speech marks, leap, fly, grow.
- Figures: automatic tonal garments in close shots, meaningful accents, identity tones, rim light from story lights.
- Worlds: roads, rivers with reflections, bridges, rooms, cloud seas, towers, crags, fire, weather, place life.
- Objects and threads: held, flown, dropped, caught, carried, shared strings with travelling tugs.
- Camera and editing: shot grammar, moves, depth of field, reveals, transitions, match cuts, beat-synced cuts, loops.
- A fixed layering order (bridges, fences, carried things, strings).
- Tools: `caps`, `board`, `lint`, `qa`, `model`, `colors`, `still`, `beats`, `audio`, `render`.
- Five example films and a style-test film.
