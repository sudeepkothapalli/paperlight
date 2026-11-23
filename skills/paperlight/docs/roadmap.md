# Roadmap and design review

A creative director's pass over the whole skill: what makes it cohesive and alive, what was fixed in this pass, and
what I recommend next, in priority order.

## What the style is now (keep this)
- **Ink characters, living world.** Characters are black silhouettes with a faint hue of their own. Everything else
  is material, lit by a time of day. That contrast is the signature.
- **Loudness order:** light (lamps, windows, sun, fire) → meaning (colour motifs, character accents) → material
  (always softened by light and distance).
- **Colour is earned.** Every colour, including one detail on a character, has a written meaning in that film and
  follows story time.
- **Minimal means few elements, each alive**, never empty (`caps`, richness).

## Fixed in this pass
| area | problem | fix |
|---|---|---|
| acting · beds | the girl "in bed" stood on the floor behind the bed, so the blanket cut her off: she read as crouching | a real in-bed mode: hips on the mattress, legs under a soft 3D blanket over the lap; `pose.tuck` pulls it to the chin as she leans back to sleep |
| props · bed | the blanket was stacked boxes with a stepped outline; faceted surfaces showed hairline seams | one rounded, slightly rumpled mound hanging over the sides, a bolster pillow; shaded faces are sealed so no seams show |
| figures · front view | arms merged into the coat (a rectangle), and arm tops made square "epaulette" corners | resting arms hang a little away from the body with light between; rounded shoulders |
| figures · grounding | with little or no cast shadow (dusk, overcast, classic paper), figures floated | a soft contact shadow under every figure, fading as they leave the ground |
| motion · turns | turning on the spot pivoted the whole figure like a statue | the feet take small steps through the turn (about two per quarter turn) |
| colour · characters | accents existed only in The Bridge | every film has them, each with a meaning: Mira's ribbon (*someone with you*), Wren's red scarf (*what she sends out*), Tomas's cuff (*what passes between them*), the pioneer's scarf (*the one who goes first*); identity tones for every lead |
| colour · drained accents | an absent accent turned into a bright grey stripe | `drain` sinks it into the silhouette |
| accents · placement | Lila's bow on top of the head read as ears from the front; a sash was an upright stripe; a seated hem band became a bar across the lap | bow at the side/back of the head and smaller; sash a true diagonal from shoulder to opposite hip; hem band only when standing |
| tools | the model sheet showed accents in black | the model sheet shows accents in their colours |
| starter | the template started in the classic look with no meaning for its colour | it starts living, with a time of day, a colour motif with a meaning and a character accent |

## Built in the second pass (all ten recommendations)
| # | recommendation | what exists now |
|---|---|---|
| 1 | hands that land on things | `['touch', target]` with two-bone IK; targets a point, a person, their head or their hand |
| 2 | secondary motion | coat hems swing on and the head settles after stops and turns (a damped spring) |
| 3 | hand shapes | open, fist and pointing hands chosen by the gesture |
| 4 | depth of field | close shots in the living look soften what is behind the subject; `shot.dof` tunes it |
| 5 | story lights on figures | rim light from lampposts, lamps, fire, torches and lanterns, in both looks |
| 6 | readable night | a moonlit band of sky at the horizon behind figures |
| 7 | place life | `set.life = { walkers, birds }`: seeded passers-by on the roads, flocks crossing |
| 8 | full rooms | back and side walls and a ceiling, each lit differently |
| 9 | talking without faces | `['speak', dur]`: nods and a speech mark |
| 10 | a style test | `films/_style-test`: night room, dusk town, dream, fire — check it after every engine change |

## Still open (next)
- Feet locked to the ground on slopes and during long turns (true foot IK).
- Hair that trails with its own spring (today only the head and hem settle).
- Fire and lanterns tinting nearby walls, not only figures.
- An optional **tonal** figure mode (near-black clothing pieces in slightly different values) for films that want
  more than one accent per character.

## Recommended next (first pass list, kept for reference)

1. **Real 2-bone arm and leg IK for contact.** Hands that land exactly on a rail, a cheek, someone's shoulder; feet
   that stay locked on the ground during turns and on slopes. Today hands are posed, not placed, so a hand "on the
   glass" or "on the balloon string" is approximate.
2. **Secondary motion.** Hair and coat hems that lag and settle after a stop or a turn (a simple spring per
   strand), a scarf that trails in the wind with a delay. Cheap, and it makes every movement feel weighted.
3. **Hands with shape.** Mitten hands that can open, point, hold or curl (three or four silhouettes). Gestures like
   `offer` and `palms` would read much better in close-ups.
4. **Depth of field for close shots.** Soften far layers (a blur on the backdrop and distant props) in MCU/CU, so
   faces and hands stand forward. It must stay subtle to keep the graphic feel.
5. **Light that falls on the world from story lights.** Lamps and windows light the ground today; extend it so
   fire and lanterns tint nearby walls and figures' rims.
6. **A `living` night that keeps silhouettes readable.** Night scenes lose figure contrast; add an automatic
   "moonlit sky band" behind figures, or raise the sky near the horizon when a figure is against it (a QA check
   already measures this).
7. **Crowd and background life presets.** Passers-by, distant windows going on and off, smoke and birds that a
   film gets by naming a place ("market at noon", "town at dusk") rather than placing each one.
8. **Interiors as full rooms.** Side walls, a ceiling line and door frames; today a room is one wall and a floor.
9. **Lip-sync-free speech.** A small head bob, gesture and a speech-mark glyph for when characters talk, for
   narration-led films.
10. **A short "style test" film rendered on every engine change,** so regressions in the look are caught by eye:
    one night interior, one dusk exterior, one dream, one fire.
