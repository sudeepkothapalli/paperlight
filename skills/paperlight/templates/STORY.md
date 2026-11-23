# <Title>

<!-- The story representation: what the film MEANS and how it should FEEL, before any code.
     Fill only what the input leaves open. If the user specified something, copy it here verbatim
     and treat it as a constraint. Keep it to one page. -->

**Central idea** — one sentence. *(e.g. "Connection is something two people make by holding on to the same thing.")*

**Logline** — who wants what, what changes. *(1–2 sentences)*

**Emotional arc** — the feeling at each turn, not just the events.
`wonder → play → loss → reaching → connection` *(any shape: comic, tense, quiet, joyous; not always melancholy → hope)*

**The poem underneath** *(optional, 4–8 short lines)*

## Characters
| who | silhouette (height, build, hair, hat, clothes) | gait & body language | wants |
|---|---|---|---|
| | | *(bouncy · stooped · brisk · hesitant…)* | |

## Wordless conversation (the heart of the film — see docs/storytelling.md)
The device: *(a shared thread · a passed object · a signal across distance · mirroring · colour that passes · …)*
| # | who | the move | what it means | how it arrives (what the other sees) | the reply |
|---|---|---|---|---|---|
| 1 | | *(one tug)* | *(are you there?)* | *(a ripple runs the line and jumps in his hand)* | *(he waves)* |

## Motifs and colour
- **Motif(s):** the object/shape/line that carries meaning *(a kite, a thread, a window, a path)*.
- **Colour meaning in THIS film:** what the accent stands for here, when it appears, intensifies, drains, returns.
- **Colour progression:** mood per act *(e.g. grey → warm)*; where it changes inside a shot rather than at a cut.

## World and mood per act
| act | place (set) | mood (paper/ink/wash) | light, wind, weather | sound | what the lines do (feel) |
|---|---|---|---|---|---|
| | | | | | *(calm flow · agitation · leaning toward someone · sparse)* |

## Surroundings & ambience (required: minimal ≠ empty)
Fill every cell; each choice should belong to the story. Every shot needs one living thing besides the characters.
| act | sky & time of day | place: near · middle · far | life (birds, clouds, passers-by) | air (weather, gusts) | light (mood, grade, shadows) | sound (beds, cues, motif) | camera & editing |
|---|---|---|---|---|---|---|---|
| | *(overcast afternoon → low sun → first stars)* | *(a bare tree · a fence · a far house, one window lit)* | *(a flock in the gust; two birds land together)* | *(leaves carried from her to him)* | *(cool → gold inside the turning shot)* | *(wind + birds; a 3-note motif)* | *(reveal from her; dissolve; push in)* |

`lint` reports richness out of 9; aim for 8–9.

## Capability pass (required)
Run `node <skill-dir>/engine/src/cli.js caps films/<slug>/film.js`. Every capability that serves the story is used; list only
the ones left out, each with its reason.
| not used | why |
|---|---|
| *(water)* | *(a dream of clouds: there is no river in it)* |

## Beats — cause, action, evidence, consequence
Every change in the story needs a *reason the audience can see* and *visible evidence*. Plan the micro-actions:
anticipation (a look, a breath, a shift of weight) → the action → the reaction. Nothing changes hands off-screen.

| # | cause (why now?) | action (who does what, micro-actions) | what the audience sees | consequence |
|---|---|---|---|---|
| 1 | a gust | the kite jerks; her hands are pulled forward; the string slides out of her fingers | arms snap forward, string end flicks away, kite climbs | the kite is free |
| 2 | it is hers and it is leaving | she runs a few steps after it, reaching up; stops; arm sinks | light run, arm up, chin up → slump | loss |

## Objects — who has what, when (ownership timeline)
| world time | object | state (held by · free · caught by · shared) | shown in shot | motivated by |
|---|---|---|---|---|

`lint` warns when a hand-over, release, catch or new thread happens between shots, out of frame, or without a gesture.

## Shots
| # | shot (size · angle · move) | what happens (blocking) | why this camera | dur | sound/beat |
|---|---|---|---|---|---|

**Pacing** — total length; where to hold; where to cut quickly.
**Must read with the sound off:** the 2–3 images that carry the story without music or words.

---

### Interpreting the input (how much to add)
| input | what to do |
|---|---|
| one-line idea | invent freely: characters, motif, colour meaning, arc, 8–14 shots |
| poem / essay | find the images and the turn; one shot or scene per image; text only if the user wants it on screen |
| philosophical concept | find a concrete action that embodies it (a fork, a path that forms, a thread) |
| screenplay / shot list | follow it; add only blocking and camera detail it leaves unspecified |
| storyboard / visual reference | match composition and timing; adapt only what the engine cannot draw |
| abstract / ambient request | moods, feel and camera do the work; characters optional; consider a seamless loop |
| constraints (length, ratio, palette, mood, no narration…) | constraints override every default in this skill |

Make sensible creative choices rather than asking — ask only when two readings would produce different films.
