// THE CAPABILITY LIST — everything the skill can do, and whether a film uses it.
//   node engine/src/cli.js caps films/<slug>/film.js
// Every film should be checked against this list: use what serves the story; for anything left out, know why
// (STORY.md, "Capability pass"). New engine features must be added here so no request forgets them.

const any = (arr, fn) => (arr || []).some(fn);

export function capabilities(film, R) {
  const sets = Object.values(film.sets || {}), cast = Object.entries(film.cast || {}), shots = film.shots || [];
  const props = sets.flatMap((s) => s.props || []), kinds = new Set(props.map((p) => p.kind));
  const ops = (name) => cast.some(([, d]) => (d.blocking || []).some((b) => b[0] === name));
  const gestures = new Set(cast.flatMap(([, d]) => (d.blocking || []).filter((b) => b[0] === 'gesture').map((b) => b[1])));
  const people = cast.filter(([, d]) => !d.kind || d.kind === 'person'), kindOf = (k) => cast.some(([, d]) => d.kind === k);
  const moved = R ? R.shots.filter((s) => !s.blank).filter((s) => { const a = R.cameraAt(s, 0).cam, b = R.cameraAt(s, s.dur).cam; return Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]) > 0.15 || Math.abs(a.yaw - b.yaw) > 0.02 || Math.abs(a.lens - b.lens) > 1; }).length : 0;
  const living = film.look === 'living' || sets.some((s) => s.look === 'living');
  const sky = (k) => sets.some((s) => s.sky?.[k]) || shots.some((s) => s.sky?.[k]);
  const L = [
    // look and light
    ['look', 'living look (materials lit by time of day) or classic ink — chosen on purpose', living || film.lookChosen === 'classic', "film.look = 'living'"],
    ['look', 'time of day per set or shot', !!(film.light || sets.some((s) => s.light) || shots.some((s) => s.light)), "light: 'golden'"],
    ['look', 'light that changes inside a shot', shots.some((s) => s.light?.from || s.season?.from), "light: { from: 'golden', to: 'dusk' }"],
    ['look', 'material overrides that give the place its identity', !!(film.materials || sets.some((s) => s.materials) || props.some((p) => p.wall || p.roof || p.material)), "materials: { roof: ['#…'] }"],
    // world
    ['world', 'ground: a field, floorboards, a cloud sea, a sea', sets.some((s) => s.field || s.boards), "field: { type: 'flow' | 'billows' | 'rings' }"],
    ['world', 'roads / paths', sets.some((s) => s.roads?.length), 'roads: [{ pts, width }]'],
    ['world', 'water (rivers, ponds) with reflections', sets.some((s) => s.rivers?.length || s.ponds?.length), 'rivers: [{ pts, width, flow }]'],
    ['world', 'a place in depth: something near, middle and far', props.length >= 3, 'props: trees, fences, houses, buildings…'],
    ['world', 'architecture (house, buildings, bridge, tower, wall, arch, pillar)', ['house', 'buildings', 'bridge', 'tower', 'wall', 'arch', 'pillar'].some((k) => kinds.has(k)), "{ kind: 'house' }"],
    ['world', 'nature props (trees, rocks)', kinds.has('tree') || kinds.has('rock'), "{ kind: 'tree', style: 'round' }"],
    ['world', 'interiors (window with sky, bed, table, lamp, curtains)', kinds.has('window'), "{ kind: 'window', curtains: true }"],
    ['world', 'lights in the world (lamps, lampposts, lit windows)', kinds.has('lamp') || kinds.has('lamppost') || props.some((p) => p.lit), "{ kind: 'lamppost' }"],
    ['world', 'sky: sun, moon, stars', sky('sun') || sky('moon') || sky('stars'), 'sky: { moon, stars, sun }'],
    ['world', 'clouds in the sky (set clouds or drifting cloud actors)', sets.some((s) => s.clouds?.length) || kindOf('cloud'), "{ kind: 'cloud', shape: { cumulus: true } }"],
    ['world', 'weather in the air (leaves, snow, rain, motes, embers)', Object.values(film.seasons || {}).some((m) => m.weather?.type) || shots.some((s) => s.weather?.type), "weather: { type: 'motes' }"],
    ['world', 'a world that moves by itself (land/water motion, gusts)', sets.some((s) => s.motion) || !!film.air?.gusts, 'motion: { dir, speed, amp }'],
    ['world', 'fire, smoke, embers', props.some((p) => p.fire) || cast.some(([, d]) => d.tailFire || d.carry?.kind === 'torch'), 'fire: { start, from, speed }'],
    // life
    ['life', 'birds', kindOf('bird') || sets.some((st) => st.life?.birds), "{ kind: 'bird' } with key / perch / hop / chirp"],
    ['life', 'cloud characters (shape morph, glow, rain)', cast.some(([, d]) => d.kind === 'cloud' && d.shape && typeof d.shape === 'string'), "shape 'rabbit' | 'whale'"],
    ['life', 'more than two people (passers-by, a crowd, guards)', people.length > 2 || sets.some((st) => st.life?.walkers), 'set.life = { walkers: 6 } or extra cast'],
    ['life', 'place life presets (passers-by on the paths, flocks crossing)', sets.some((st) => st.life), 'set.life = { walkers, birds }'],
    ['life', 'objects that matter (kite, balloon, lantern, ball, flower, case)', cast.some(([, d]) => ['kite', 'balloon', 'lantern', 'ball', 'flower', 'object'].includes(d.kind)), "{ kind: 'balloon' } heldBy / release / catch"],
    ['story', 'a wordless conversation (tugs, a signal, an object passed back and forth, mirroring)', cast.some(([, d]) => (d.blocking || []).some((b) => b[0] === 'tug')) || props.some((p) => Array.isArray(p.on) && p.on.length > 2) || cast.some(([, d]) => new Set((d.blocking || []).filter((b) => b[0] === 'heldBy').map((b) => b[2])).size >= 2), 'docs/storytelling.md'],
    ['life', 'threads and shared strings (tugs that travel)', kindOf('thread') || cast.some(([, d]) => (d.blocking || []).some((b) => b[0] === 'tug')), "['tug', t, 'who']"],
    // acting
    ['character', 'a character accent that means something (ribbon, hatband, scarf, sash, cuff, belt)', cast.some(([, d]) => d.accessories || (d.scarf && d.scarf !== 'ink')), "accessories: { hatband: 'motif' }"],
    ['character', 'identity tones (each black has a faint hue of its own)', cast.some(([, d]) => d.tone), "tone: '#3a2a1c'"],
    ['character', 'tonal figures (garments in near-black values; automatic in close shots)', film.figures !== 'silhouette', "figures: 'auto' (default) · 'tonal' · 'silhouette'"],
    ['character', 'rim light from the scene (living look)', living && film.rim !== false, 'on by default in the living look'],
    ['acting', 'walks with personality (gait), runs, sidesteps', people.some(([, d]) => d.gait) || ops('walk'), 'gait: { stride, bounce, swing, lean }'],
    ['acting', 'gestures, both arms acting', gestures.size >= 2, "['gesture', 'wave', 0.4, 'far']"],
    ['acting', 'posture (lean, slump, chin)', ops('pose'), "['pose', { slump, chin }]"],
    ['acting', 'sit, kneel, lie, rise', ops('sit') || ops('kneel') || ops('lie'), "['kneel', 0.6]"],
    ['acting', 'looking (lookAt, glance, look)', ops('lookAt') || ops('look') || ops('glance'), "['lookAt', 'someone']"],
    ['acting', 'hands that land on things (touch IK) and hand shapes', ops('touch'), "['touch', 'someone:hand', 0.6]"],
    ['acting', 'talking without a face (speak: nods, a speech mark)', ops('speak'), "['speak', 2.5]"],
    ['acting', 'hop, lift, ride, leap, grow', ops('hop') || ops('ride') || ops('leap') || ops('grow') || ops('lift'), "['hop', 0.2, 0.4]"],
    // camera
    ['camera', 'a range of shot sizes (wide → close)', shots.length >= 6, 'size: EWS … CU'],
    ['camera', 'camera that moves in a third of shots', R ? moved >= R.shots.length / 3 : false, 'animated pos / size / side / lens'],
    ['camera', 'depth of field in close shots (auto in the living look)', living || shots.some((sh) => sh.dof), 'shot.dof = { px, focus }'],
    ['camera', 'handheld life where tension or intimacy calls for it', shots.some((s) => s.camera?.desc?.includes('handheld')), 'cam.handheld(spec, 0.2)'],
    ['camera', 'point of view / over the shoulder', shots.some((s) => s.camera?.desc?.includes('POV')) || shots.some((s) => /shoulder|POV|through/i.test(s.beat || '')), 'cam.pov(actor)'],
    // editing
    ['editing', 'reveal: the world draws itself out from someone', shots.some((s) => s.reveal), 'reveal: { from, radius }'],
    ['editing', 'transitions: dissolve, iris, wipe', shots.some((s) => s.transition), "transition: { type: 'iris', at: 'actor' }"],
    ['editing', 'match cut', shots.some((s) => s.matchCut), "matchCut: { from: 'balloon', to: 'moon' }"],
    ['editing', 'fades and titles', shots.some((s) => s.fadeIn || s.fadeOut || s.title), 'title: { text }'],
    ['editing', 'time ellipses (cuts that skip time)', shots.some((s, i) => i > 0 && s.wt != null), 'wt jumps'],
    // colour and feeling
    ['colour', 'colour motifs with written meanings', !!film.colors && Object.keys(film.colors).length > 0, "colors: { joy: { color, meaning, level } }"],
    ['colour', 'colour that follows story time (levels)', any(Object.values(film.colors || {}), (m) => m.level), 'level: [[wt, v, dur]]'],
    ['colour', 'grade: warm/cool and saturation per shot', shots.some((s) => s.grade), 'grade: { temp, sat }'],
    ['colour', 'tint: a colour passing into something else', shots.some((s) => s.tint), "tint: { moon: ['joy', amt] }"],
    ['feeling', 'emotional geometry (flow, agitation, pull, density)', shots.some((s) => s.feel), 'feel: { flow, pull, toward }'],
    // sound
    ['sound', 'ambience beds that fit each place', Object.values(film.seasons || {}).some((m) => m.sound) || shots.some((s) => s.ambience), 'sound: { birds, wind, surf, fire, crickets }'],
    ['sound', 'sound effects on story beats', shots.some((s) => (s.sound || []).some((c) => c.sfx)), "{ at, sfx: 'chime' }"],
    ['sound', 'a melodic motif / score', shots.some((s) => (s.sound || []).some((c) => c.note)) || !!film.score, "{ at, note: 'C5' }"],
    ['sound', 'music or narration track (cuts on the beat)', !!(film.music || film.audio?.length), "music: { file, snapCuts: 'beats' }"],
    // format
    ['format', 'format fits the platform (16:9, 9:16, 1:1, loop)', true, "size: [1080, 1920] · loop: { crossfade }"],
  ];
  return L.map(([group, name, used, hint]) => ({ group, name, used: !!used, hint }));
}

export function capsText(film, R) {
  const list = capabilities(film, R);
  const used = list.filter((c) => c.used).length;
  const lines = [`${film.title}: ${used}/${list.length} capabilities in use`];
  let g = '';
  for (const c of list) {
    if (c.group !== g) { g = c.group; lines.push(`\n  ${g}`); }
    lines.push(`   ${c.used ? '✓' : '·'} ${c.name}${c.used ? '' : `   — ${c.hint}`}`);
  }
  lines.push('\n  · = not used: use it if it serves the story; otherwise note why in STORY.md (Capability pass).');
  return lines.join('\n');
}
