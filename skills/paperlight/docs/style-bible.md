# Paperlight — style bible

> Ink is the made world. Paper is the unmade. A figure is where the light is not.
> Colour happens once.

## 1. The image

**Paper.** Warm off-white (`#f2efe7`), with fine grain and a faint low-frequency mottle. Paper is not a
background; it is the most important material in the frame. Empty paper is the sky, the fog, the future,
the untrodden field. Protect it. A frame should usually be more than half paper.

**Ink lines.** Everything on the ground is drawn with lines that *follow its form* — iso-lines of a distance
field around roads, shores, ponds. Lines:
- run parallel to the thing they describe, never across it;
- are dense and heavy where a form turns or ends (the bank of a road), sparse and hairline inside it;
- lift like a pen: they break into strands with gaps, taper at both ends, vary in pressure;
- thin with distance more slowly than perspective would (drawn, not photographed), and drop out
  (line LOD) so the horizon stays fine instead of going to mud;
- boil very slightly, re-drawn on twos (every other frame) — alive, never jittery.

**Silhouettes.** Figures are solid ink, no interior detail, no outline. All character lives in the outline:
posture, the length and flare of a coat, the slope of the shoulders, the turn of a head, a stride.
Figures are plain and human — a simple skull, a small nose, a soft chin, no lips or detail. Individuality
comes from hair (short with a soft fringe, long falling to the shoulders, a bun, a crop), hats, height, build
and coat length. Check every new character on the model sheet (`model` command) from all angles.
Readability rules:
- choose the camera angle that gives the most legible outline — profile for walking, three-quarter for a
  head turn, profile for birds (a bird head-on is a blob);
- keep silhouettes off dense line areas when they need to read; let them stand against paper;
- long low-sun shadows anchor figures to the ground. Cheat the light per shot so a shadow never reads as a
  second figure.

**Colour.** Colour is a narrative language, decided per film — never a fixed dictionary (red is not "love", blue is
not "sadness"; a red kite can be connection in one film and danger in another). Restraint is the default: usually one
motif colour, rarely more than three, each small in the frame. Write down what each colour *means in this story*
(`film.colors`), then make it move with the story:
- a colour **appears, intensifies, drains or returns** at story moments (its `level` follows story time, so it is
  continuous across cuts and never changes off-screen — lint checks);
- a colour can **pass from one thing into another** (the balloon's yellow into the moon) — `tint`;
- the **grade** carries temperature and saturation: cool/grey for distance or tension, warm for closeness; change it
  *inside* the shot where the feeling turns, not only at cuts;
- **selective saturation**: drain the world while a motif keeps its colour, or drain the motif while the world stays.
Check the whole film's colour on one page with the `colors` command (colour script) before rendering.

**Seasons.** Time passing is told by the paper itself: tone shifts (warm autumn, cool winter, fresh
spring, bright summer), a pale sky wash (≤12%), and weather drawn in the style — leaves as small
tumbling flecks, snow as paper-white flakes that half-bury the lines, rain as fine slanted hairlines,
summer dust glinting. Season colours are muted tones; they never compete with the accent.

**Type.** Lower-case serif (Baskerville), small (≈2.6% of frame height), widely tracked, centred.
Titles sit on empty paper, never over line work. Few words.

## 2. Composition

- Horizon high (upper third) in wide shots; the ground carries the drawing, the sky carries silence.
- Lines converge: use roads and contour bundles as leading lines into the figure.
- Small figure, big world, for solitude. Close silhouette against paper, for interiority.
- Thirds for faces that look: put the head on the third *opposite* to where they look (lead room).
- Symmetry for decisions (the fork, dead centre).

## 3. Camera & cutting

- Slow: glide eases, long accelerations. Push-ins, cranes, gentle orbits. Handheld only as breath (≤0.3°).
- Shot/reverse-shot for looking: close face → POV → close face → POV.
- Respect screen direction: the journey goes left → right. Head-on/away shots are neutral and may sit between.
- Ellipses by cutting forward in world time; mark big ones with a dissolve.
- Let a figure walk into the lens or out of frame to end a shot.
- Average shot ≈ 4–6 s. Hold wides longer than closes.

## 4. Motion

- Walks: 1.1–1.3 m/s, eased starts and stops, coat sway, head and body as separate rotations.
- Stillness is a performance: breathing, coat flutter in wind, a slow head turn.
- The world can *draw itself*: reveal lines outward from a figure or a point (`shot.reveal`), or let a
  character leave a trail (`['trail']`) — a road that exists because someone walked it.

## 5. Sound

Sparse and synthetic, derived from the world: wind with gusts, a low drone in the film's key, footsteps
from the stride simulation, birdsong from blocking, a handful of piano-like notes on story beats.
Silence and wind do most of the work. One rising interval when colour enters.

## 6. What this style is not

- Not cel-shaded 3D, not gradients, not glow, not particles for their own sake.
- Not busy: if a frame has no paper left, take lines away.
- Not colourful. If you need two accents, you have two films.


## Figures: silhouette, tonal, accent
Characters are black silhouettes. In medium and close shots their garments ease into near-black values of their own
(tonal, automatic); in wide shots they are pure silhouettes again. One coloured accent per character carries meaning.
A rim of the nearest story light (lamp, fire, torch, lantern) or the sun/moon sits on the edge that faces it.
