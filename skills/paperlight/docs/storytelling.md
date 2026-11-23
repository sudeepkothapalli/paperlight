# Storytelling in Paperlight: stories without words

Paperlight films have no dialogue, no faces and no text that explains. That is not a limit to work around; it is
the form's strength. A Paperlight film should read the same in any language, for any age, with the sound off.

## What this form is best at

| strength | why it works | use it |
|---|---|---|
| **Anyone can be the character** | a silhouette has no face, age or nationality to argue with: the viewer fills it with themselves | keep characters simple; let posture and walk carry personality |
| **Posture is emotion** | a slump, a lifted chin, a lean toward someone read instantly, at any distance | plan the *body* of every beat, not just the action |
| **Distance is feeling** | two figures far apart in a wide land *is* loneliness; closing the distance *is* the story | stage relationships in space; let the camera show the gap |
| **Light is mood** | the time of day turning inside a shot does what a line of dialogue would | change the light when the feeling turns, not at a cut |
| **Objects become words** | a kite, a balloon, a lantern, a case: what happens to a thing says what people mean | give the story one object that travels between people |
| **Colour means one thing** | a single colour that arrives, fades or passes on is a sentence | declare what each colour means *in this film* |
| **Time folds easily** | seasons, days and years pass in a cut or a light change | stories of habit, waiting and change |
| **Wind and weather act** | an invisible character that can take things away and bring them | let the weather cause the turn |

**Avoid** stories that depend on what people *say* (arguments, explanations, jokes in words), on faces (a secret
look, tears), on complex plots with many reversals, or on abstract ideas with no physical image.

## The heart of it: wordless conversation

The most graceful thing this form can do is let people *talk without speaking*: one person does something, the
other answers, and the audience understands both. Plan every important exchange as a **question and an answer you
can see**.

### Devices

| device | the grammar | how to stage it in Paperlight |
|---|---|---|
| **The thread** | a pull is a word; pulls travel; the reply comes back along the same line | a shared string (`heldBy` with two holders) and `['tug', t, 'who']`: the ripple visibly travels; cue a `pluck` where it lands. Escalate: one tug → two → three |
| **The passed object** | giving is speaking; taking is answering | `heldBy` hand-overs with `offer` / `take` / `touch`; never off screen |
| **The signal across distance** | a light, a wave, a raised object, seen from far away | a window lamp switched on and off (`on: [[t, 1], [t2, 0]]`), a lantern raised, a wave with the free hand, a kite flown as a message |
| **Mirroring** | doing what the other does = I see you (or comic stalemate) | matched blocking: sidesteps, the same gesture a beat later |
| **Colour that passes** | a colour moving from one person to another is a feeling shared | a motif on one character's accent that *arrives* on another's (`arrives: true`), or `tint` into the world |
| **Closing the distance** | walking toward each other along something that connects them | a string being wound in, a path, a bridge; the land's lines leaning toward them (`feel.pull`) |
| **Waiting** | staying is a promise | a held shot; something (a cloud, a bird, a person) still there when we cut back |
| **Shadows first** | shadows meet before people do | a low sun; `shadowAlpha`; frame the shadows |
| **The weather as messenger** | the wind brings what someone couldn't | a staged gust (`air.gusts`) carries the object across |
| **Call and response in sound** | each person has a short melody; the last chord joins them | `sound` notes per character; combine them at the end |

### Rules for wordless exchanges
1. **Seed the device early.** Show the kite, the window, the thread before the story needs it.
2. **Question → pause → answer.** Give the audience a beat to wonder whether an answer will come.
3. **Escalate in threes.** The same move repeated, then varied: one tug, two tugs, a wave; a lamp on, off, on.
4. **One central device per film.** Others can support it, but one carries the story.
5. **Show the arrival.** The audience must *see* a message land (the ripple reaching the hand, the light seen
   through the other window), and see the receiver react with their body.
6. **No title cards that explain.** A title or a last line can frame the film; it never tells what happened.
7. **Must read with the sound off.** List the two or three images that carry the story without music.
8. **End on the image that holds the story** — its place and its object together (the two figures under the kite,
   the bridge under the moon). Check the final shot shows both.

## Story shapes that fit

| shape | the turn | example prompt |
|---|---|---|
| **Distance closed** | two people far apart find a way across | *two strangers on opposite hills, one kite between them* |
| **The gift that travels** | an object passes from hand to hand and changes everyone it touches | *a yellow balloon in a small town at dusk* |
| **The ritual with a difference** | the same act every day; one day someone answers | *a woman lights her window lamp every night; one night a lamp across the street answers* |
| **The small kindness** | impatience or indifference turns at a moment of need | *two people block each other on a narrow bridge* |
| **The found friend** | a lonely character meets something that isn't a person | *a girl befriends a cloud in her dream* |
| **The path** | one person's choice becomes everyone's way | *a path forms across a field from one person's footsteps* |
| **Over the fence** | something thrown back and forth until it means more than a game | *a ball comes over a garden fence every day; one day a flower comes back instead* |

## Starter ideas

Ready to make; each uses what the engine already draws.

| film | the story | the wordless conversation |
|---|---|---|
| **Window to Window** | two strangers in facing windows across a dark street; she switches her lamp off and on, and a lamp answers | lamp signals in threes, until both lamps stay on |
| **Over the Fence** | a ball keeps landing in an old woman's garden; she throws it back, annoyed; one day a flower comes back with it | a passed object that changes meaning |
| **The Lantern River** | at dusk a child floats a lantern downstream; on the far bank another child lights a second one and sends it back | light passed along the water |
| **Two Kites** | two kites tangle in a gust; their owners walk toward each other to unwind them and end up flying side by side | tangled strings, tugs to find whose is whose |
| **Seasons of a Bench** | an old man feeds birds alone; each season a girl sits a little closer, until in winter she brings the bread | distance closing season by season |
| **The Red Umbrella** | in grey rain one person shares a red umbrella; the stranger passes the shelter on; the red travels through town | a colour that passes from person to person |
| **The Last Train** | a traveller drops a glove as the train leaves; a station worker runs it the length of the platform | running alongside, a hand through a window, a wave |
| **Paper Bird** | a child sends a paper bird out of a high window on the wind; a boy below folds another and sends it back up | the wind as messenger; a gift returned |
| **The Line Between Roofs** | two neighbours on facing rooftops string a line and send things across it all night | the thread as a bridge; each object a sentence |
| **Lighthouse** | a keeper flashes the light each night for one passing boat; one night it doesn't come; the next it answers | signal, absence, answer |

## Planning it

In `STORY.md`, fill the **Wordless conversation** table: who speaks first, with what move, what it means, how it
arrives, and the reply. If a beat can only be told with words, change the beat.
