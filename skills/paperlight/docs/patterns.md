# Video patterns that suit Paperlight

The style is strongest where the story is **one figure, one landscape, one change** and where lines can
*mean* something — a road, a route, a habit, a life. Ranked by fit × effort.

| # | Pattern | Why it fits | Length / format | Engine work needed |
|---|---|---|---|---|
| 1 | **Parables & proverbs** — koans, fables, Stoic lines (Sisyphus, the cracked pot) | A choice made visible; silence and space do the acting | 45–90 s, 16:9 or 9:16 | none — *The Fork* is this |
| 2 | **Concept-as-landscape explainers** — desire paths (habits, emergence), opportunity cost, compounding, network effects, "the map is not the territory" | Abstract ideas become terrain you can walk through; trails, forks and roads are already the vocabulary | 60–120 s, newsletters, talks, founders, educators | several walkers; trails that darken as more people walk them |
| 3 | **Journeys on real terrain** — pilgrimages, expeditions, migrations, your own GPX hike | Contour lines *are* topographic maps; real elevation turns into real ink | 1–3 min, map crane shots + ground-level walking | import elevation (DEM/GeoTIFF) and GPX routes as the field and the path |
| 4 | **A life as a line** — biographies, memorial and anniversary films, founder stories | Each fork a decision, each title card a year; restraint suits grief and gratitude | 2–4 min | build shots from a timeline JSON (date, place, choice) |
| 5 | **Poetry & haiku series** — one line of verse per shot, seasonal accent | Few words, much paper; ideal for a recurring social series | 15–30 s, 9:16 | vertical-frame presets; optional recorded voice-over track |
| 6 | **Ambient loops** — walking in rain, snow, fog, at night | Generative, so a 3-hour loop never repeats; calm by design | 10 min – 3 h, focus/sleep channels | weather (rain strokes, snow, fog), seamless camera loops, night (inverted) palette |
| 7 | **Music videos** — ambient, folk, neo-classical piano | Line reveals and camera moves can breathe with the music | track length | audio analysis → cue track (onsets, loudness) driving reveals and cuts |
| 8 | **Title sequences & brand openers** — conference intros, podcast intros, literary book trailers, festival idents | Saul Bass lineage: shape, line, one colour, typography | 5–20 s | type that draws itself on, line-wipe transitions |
| 9 | **Data stories with silhouettes** — "one figure = 1,000 people", crowds dispersing along roads | Silhouettes make numbers human without faces | 60–90 s | crowd system (many varied walkers), contour bands as quiet charts |
| 10 | **Bedtime fables** — the Lotte Reiniger tradition | Silhouette storytelling has a 100-year pedigree with children | 3–5 min, chapters | more figures (animals, trees, houses), multiple sets per film |

## Suggested next steps

- **Next film:** *Desire Path* (pattern 2). One walker cuts across a field; seasons pass in ellipses; more walkers follow
  the same line; it darkens from a hairline into a road; finally someone paves it. It reuses everything that exists and
  adds one feature (trail weight by repetition) that many explainer topics would reuse.
- **Biggest unique capability:** real terrain (pattern 3). No other code-video tool turns a GPX file into a drawn landscape
  film. It also unlocks memorial and travel films.
- **Cheapest series:** haiku (pattern 5). It needs only vertical presets, and the board → render loop is already fast enough
  for daily output.
