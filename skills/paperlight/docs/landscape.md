# Code-based video: the landscape, and what Paperlight takes from it

A survey of how people make moving pictures with code alone (no image or video models),
grouped by *how they actually produce pixels*, then what we borrowed for Paperlight.

## 1. Four ways code becomes frames

| Approach | How frames are made | Examples | Strength | Weakness for us |
|---|---|---|---|---|
| **Browser capture** | Build the frame as DOM/SVG/Canvas/WebGL, freeze a virtual clock, screenshot with headless Chrome, encode with ffmpeg | Remotion, Revideo, Motion Canvas (export), HyperFrames, timecut/Puppeteer + GSAP | The whole web platform: CSS, fonts, React, three.js | Heavy (Chromium per worker), slow per frame, licensing (Remotion is source-available with a company licence) |
| **Native canvas → ffmpeg pipe** | Draw into a 2D raster (Skia/Cairo) in-process, stream raw RGBA into `ffmpeg` stdin | canvas-sketch, Editly, FFCreator, Manim (Cairo backend), **Paperlight** | Fast, deterministic, few dependencies, trivially parallel | You write your own scene graph and timeline |
| **GPU shaders** | Every pixel is a function `f(x, y, t)`: SDFs, raymarching, feedback | Shadertoy, Inigo Quilez's painted shader films, Hydra, regl/twgl, TouchDesigner | Unlimited complexity at real-time speed | Hard to direct (cameras, characters, edits); needs a GPU |
| **Scene description → renderer** | Describe a 3D scene in code; an offline renderer draws it | Blender `bpy` + Grease Pencil / **Freestyle** line rendering, POV-Ray, three.js offline | Real 3D, real line rendering (Freestyle) | Big install, slow, hard to keep a hand-drawn feel |

## 2. The frameworks, briefly

- **Remotion** (React). A video is a React component of `frame`; `<Sequence>` places things on a timeline;
  `renderMedia` screenshots each frame in headless Chromium, parallelised across tabs. Great for data-driven
  and templated video. The pattern worth stealing: *a frame is a pure function of time*.
- **Motion Canvas / Revideo** (TypeScript). Generator functions (`yield* all(...)`) express animation as
  imperative coroutines — "move this, then that, together". Revideo forks it for headless rendering and audio.
  Worth stealing: *timing written like a script, not keyframes*.
- **Manim** (Python, 3Blue1Brown). Scenes of mathematical objects with `self.play(Transform(...))`; renders with
  Cairo or OpenGL. Recent research agents (e.g. Code2Video, TheoremExplainAgent) have LLMs write Manim for
  explainers — evidence that *code is a good intermediate language for an AI director*.
- **canvas-sketch / p5.js / Processing / nannou / openFrameworks.** Creative-coding sketches with frame export.
  The generative-art tradition (Tyler Hobbs' flow fields, Anders Hoff's *inconvergent*, pen-plotter art with
  vpype/vsketch) is where hand-drawn-looking line work comes from.
- **Editly / FFCreator / VideoFlow / Shotstack / Creatomate.** JSON → video for templated content: clips, text,
  transitions. Worth stealing: *a declarative edit list*.
- **Theatre.js / GSAP.** Timeline and keyframe tooling over three.js / DOM, captured to video.
- **Blender Freestyle.** The serious non-photorealistic line renderer: silhouettes, creases, line styles along
  3D edges. Proof that *line art can be derived from a 3D world* rather than drawn per frame.

## 3. The ideas that matter more than the tools

1. **Tonal art maps** (Praun et al., *Real-Time Hatching*, 2001). Tone is rendered by *line density*, and density
   must stay constant on screen as things recede or the image turns to mud. Paperlight does this with line-level LOD:
   every contour level has an importance; as levels crowd together on screen, less important ones fade out and
   the survivors thicken. Tone is preserved; detail is not.
2. **Evenly-spaced streamlines** (Turk & Banks 1996; Jobard & Lefer 1997). Lines that follow a field, start and
   stop by spacing rules, and read as "drawn". Paperlight uses iso-lines of a distance field — the same family of
   ideas, with gaps and tapers to imitate a pen lifting.
3. **Signed distance fields with smooth-min.** From the shader world: blend shapes so paths *merge like ink, not
   like CAD*. The fork in the reference image is a smooth-min of four roads.
4. **The Virtual Cinematographer** (He, Cohen & Salesin, 1996) and later toric-space framing (Lino & Christie, 2015)
   and the Prose Storyboard Language (Ronfard et al., 2013): cinematography expressed as *rules and idioms* —
   shot sizes, sides of the line, framing by thirds — that a program can apply. Paperlight's camera API is a small
   version of this: you ask for "an MCU from the walker's left at 85mm, on the left third", not a matrix.
5. **Silhouette animation** — Lotte Reiniger (*The Adventures of Prince Achmed*, 1926), Michel Ocelot; and in games
   *Limbo*, *Alto*, *Journey*. Character carried entirely by outline, pose and timing.
6. **The single colour** — Saul Bass's titles, the red coat in *Schindler's List*, *Rumble Fish*. Colour as a
   narrative event, not decoration.

## 4. Why Paperlight is built the way it is

- **Native canvas + ffmpeg pipe** (Node, `@napi-rs/canvas`, `d3-contour`): no browser, no GPU, no models.
  A 72-second film renders at 540p in about a minute on 8 cores; 1080p in a few minutes.
- **A real 3D ground plane and pinhole camera.** Lines are generated once in world space; only the camera moves.
  That gives true parallax, foreshortening and cinematography for free, and it means every shot of a scene is
  a camera inside the *same* world — continuity is structural.
- **World time ≠ film time.** Actors are blocked in continuous world time; shots are windows onto it (with
  ellipses where the edit skips). This is how films are actually staged, and it makes cuts match automatically.
- **Director-level API.** Shot sizes, angles, sides, lenses, thirds, locks, handheld, POV, dolly-zoom by animating
  `lens` at fixed `size`. Every parameter animates (`[from, to]`).
- **Tooling a film crew would recognise:** storyboard contact sheet, continuity lint (screen direction, jump cuts,
  time running backwards, empty frames, colour discipline), stills for any frame, and sound designed from the
  simulation (footsteps from strides, birdsong from blocking, panned by screen position).

## Sources

- [Remotion vs Motion Canvas vs Revideo (2026)](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026)
- [Motion Canvas vs Remotion (2026)](https://autoae.online/blog/motion-canvas-vs-remotion)
- [VideoFlow — JSON to programmatic video](https://www.producthunt.com/p/videoflow/videoflow)
- [Jobard & Lefer, *Creating Evenly-Spaced Streamlines of Arbitrary Density* (course notes PDF)](https://www.cg.tuwien.ac.at/courses/Visualisierung1/2015W/exercises/Streamlines_Jobard&Lefer.pdf)
- [Jobard–Lefer algorithm implementation](https://github.com/pedropark99/Jobard-Lefer-Algorithm)
- [Evenly spaced streamlines demo](https://keithfma.github.io/evenly_spaced_streamlines/even_stream_demo.html)
- Other references (Praun et al. 2001; He, Cohen & Salesin 1996; Lino & Christie 2015; Ronfard et al. 2013;
  Reiniger; Freestyle) are cited from the author's background knowledge rather than fetched in this session.
