# Design decisions

Every one of these started as a note on a specific film. Each was fixed **in the engine or the skill**, never only in
the film, so every later film inherits it. When you change the engine, keep these true.

## Figures
| feedback | the rule now | where |
|---|---|---|
| heads looked like cartoon creatures; round heads, odd chins | simple human heads in profile and front blends, real hair styles (short, long, bob, bun, pigtails, crop) | `figures.js` head + hair |
| legs were sticks | thighs, knees, shins and planted feet, with a proper gait cycle | `figures.js` `legPose` |
| arms did nothing; arms flapped like wings in front views | both arms act on their own tracks; a walking swing goes forward/back and foreshortens from the front | `figures.js` arms |
| a kite held at crotch height | gestures put hands where the action is (flying, holding, offering, catching) | gesture poses |
| running looked aggressive | runs are light: stride, knee and lean scale with personality (`gait`) | `legPose`, gait |
| a figure "in bed" stood behind the bed | an in-bed pose: sitting up on the mattress under a 3D blanket; `pose.tuck` to sleep | `sit 'bed'` |
| sitting on the ground looked stiff | knees drawn up, arms around them, the coat pooling on the ground | `sit 'ground'` |
| front views read as a rectangle | resting arms hang a little away from the body; rounded shoulders | arms |
| figures floated | soft contact shadows under every figure | `drawContactShadow` |
| turns pivoted like statues | the feet step through on-the-spot turns; follow-through after stops | `actors.js` |
| hands didn't land on things; a suitcase jumped into a hand | touch IK; carried things are drawn at the hand as drawn and eased in when picked up | `touch`, render |
| characters were flat black | tonal garments ease in as a figure fills the frame (close shots); pure silhouettes in wide shots | `figures: 'auto'` |
| a girl had no colour | every lead carries a readable accent from their first shot; lint checks it | `lint.js` |
| the scarf read as "something alien inside them" | a scarf is a roll round the neck, a front end on the chest edge, and an end trailing in the wind, outside the silhouette | scarf in `figures.js` |

## World and light
| feedback | the rule now | where |
|---|---|---|
| the world was ink on paper only; lacked life | the *living* look: real materials lit by a time of day; lamps, windows, smoke, water all react to light | `living.js` |
| "always the same path" | many worlds: towns, rivers, rooms, meadows, cloud seas, crags, fire; plan the place for each story | SKILL, template |
| the river didn't read as water | water takes the sky's colour, pales mid-stream, reflects the banks, glints drift downstream | `drawWaterFill` |
| a bridge looked like two thin lines | solid deck, rails, posts and landings from every angle | bridge prop |
| clouds looked odd (stalks, blobs) | cumulus are built in rows: a flat base and a lumpy rounded crown | `makeCumulus` |
| the sun sat on the ground at sunset | the sky is drawn only above the horizon; the far ground fades into the sky's horizon colour | render, `drawBackdrop` |
| openings were washed out by haze | haze presets keep the far side of a wide shot readable | `LIGHTS` |
| night figures disappeared | a moonlit band at the horizon; rim light from story lights | living, render |

## Layering
| feedback | the rule now |
|---|---|
| people drawn over the near bridge rail | big props are split: a bridge's near rail is drawn after the people on its deck; long fences in short pieces |
| a balloon string drawn over a rail | a string is drawn right after the nearer of its two ends |
| a walking lead blurred | depth of field never blurs a story character |

## Story, colour and craft
| feedback | the rule now | where |
|---|---|---|
| props and strings appeared from nowhere; motives unclear | every change has a visible cause, action, evidence and consequence; nothing changes hands off screen | template beats table, lint |
| films felt bland | a required enrichment and capability pass on every film: sky, place, life, air, light, sound, camera, editing | SKILL, `caps`, richness lint |
| colour without meaning | every colour is a motif with a written meaning that follows story time; restraint by default | `film.colors`, lint |
| the thread as non-verbal conversation was the best moment | every film is built around a wordless conversation; films must read in any language with the sound off | `docs/storytelling.md`, template |
| small drafts were impossible to judge | reviews are rendered at 1080p | workflow |
| the defining place vanished in the last shot | end on an image that holds the story's place and object | storytelling rules |
