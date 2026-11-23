// Continuity & film-grammar checks. A script supervisor in ~100 lines.
//
//  • screen direction: a walker's left→right must not flip across a cut unless a neutral
//    (head-on / away) shot sits between, or the shot sets allowFlip
//  • jump cuts: consecutive continuous-time cuts with near-identical camera
//  • time: a cut that runs backwards in world time (unless flashback:true)
//  • empty frames: no actor on screen for a whole shot (unless empty:true / POV)
//  • rhythm: shots shorter than 0.8s or longer than 14s; average shot length
//  • colour discipline: more than one accent-coloured element in the cast

import { makeView } from './camera.js';

export function lint(film, R) {
  const items = [];
  const add = (shot, level, msg) => items.push({ shot, level, msg });
  const { shots, world, W, H } = R;
  let lastDir = 0, lastDirShot = -1;
  let prevCam = null;

  for (const shot of shots) {
    if (shot.dur < 0.8) add(shot.index, 'warn', `very short shot (${shot.dur}s)`);
    if (shot.dur > 14) add(shot.index, 'info', `long take (${shot.dur}s) — make sure something changes`);
    if (shot.index > 0) {
      const p = shots[shot.index - 1];
      const pend = p.wt0 + p.dur;
      if (shot.wt0 < pend - 0.05 && !shot.flashback) add(shot.index, 'warn', `world time runs backwards across the cut (${pend.toFixed(1)} → ${shot.wt0.toFixed(1)})`);
    }

    if (shot.blank) continue;
    // sample the shot
    let anyVisible = false;
    let dirVotes = 0, neutral = 0;
    for (const u of [0.15, 0.5, 0.85]) {
      const t = u * shot.dur;
      const { cam } = R.cameraAt(shot, t);
      const view = makeView(cam, W, H);
      const wt = shot.wt0 + t;
      for (const [name, a] of Object.entries(world.actors)) {
        if (a.def.bg) continue; // background life is not story blocking
        if (shot.hide?.includes(name)) continue;
        const st = a.state(wt);
        if (!st.visible) continue;
        if (film.sets && (st.set ?? 'main') !== R.setOf(shot)) continue;
        const p3 = st.pos3 || [st.pos[0], 0, st.pos[1]];
        const hh = a.def.kind === 'bird' ? 0.12 : (a.def.height ?? 1.75);
        const h = hh * 0.5;
        const pr = view.project(p3[0], p3[1] + h, p3[2]);
        for (const f of [0.05, 0.5, 0.9]) {
          const q = view.project(p3[0], p3[1] + hh * f, p3[2]);
          if (q && q[0] > -W * 0.02 && q[0] < W * 1.02 && q[1] > -H * 0.02 && q[1] < H * 1.02) anyVisible = true;
        }
        if (a.def.kind !== 'bird' && st.walking > 0.3 && pr) {
          const q = view.project(p3[0] + Math.sin(st.heading), p3[1] + h, p3[2] + Math.cos(st.heading));
          if (q) {
            const dx = q[0] - pr[0], dy = q[1] - pr[1];
            const lateral = Math.abs(dx) / (Math.hypot(dx, dy) + 1e-6);
            const towardAway = Math.abs(view.toCam(p3[0] + Math.sin(st.heading), 0, p3[2] + Math.cos(st.heading))[2] - view.toCam(p3[0], 0, p3[2])[2]);
            if (lateral > 0.5 && towardAway < 0.8) dirVotes += Math.sign(dx);
            else neutral++;
          }
        }
      }
      if (u === 0.5) {
        const camNow = cam;
        if (prevCam && (!shot.transition || shot.transition.type === 'cut') && shot.index > 0) {
          const p = shots[shot.index - 1];
          const continuous = Math.abs(shot.wt0 - (p.wt0 + p.dur)) < 0.05;
          const dv = Math.abs(((camNow.yaw - prevCam.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
          const dp = Math.hypot(...camNow.pos.map((v, i) => v - prevCam.pos[i]));
          const lens = Math.max(camNow.lens, prevCam.lens) / Math.min(camNow.lens, prevCam.lens);
          if (continuous && dv < 0.35 && dp < 2.5 && lens < 1.3) add(shot.index, 'warn', `possible jump cut from shot ${shot.index} (camera barely moves: ${(dv * 57.3).toFixed(0)}°, ${dp.toFixed(1)}m)`);
        }
        prevCam = camNow;
      }
    }
    const isPOV = /POV/.test(shot.camera.desc || '');
    if (!anyVisible && !shot.empty && !isPOV) add(shot.index, 'info', 'no figure on screen in this shot');
    if (dirVotes !== 0) {
      const dir = Math.sign(dirVotes);
      if (lastDir && dir !== lastDir && !shot.allowFlip) add(shot.index, 'warn', `screen direction flips (${lastDir > 0 ? 'L→R' : 'R→L'} in shot ${lastDirShot + 1}, now ${dir > 0 ? 'L→R' : 'R→L'}) — crossing the line?`);
      lastDir = dir; lastDirShot = shot.index;
    } else if (neutral > 0) lastDir = 0; // a neutral shot resets the axis
  }

  // story logic for objects: every hand-over, release and catch must be SEEN, and motivated by a gesture
  const OBJ = ['kite', 'balloon', 'lantern', 'ball', 'flower', 'object'];
  const shotAtWorld = (t) => shots.find((sh) => !sh.blank && t >= sh.wt0 && t < sh.wt0 + sh.dur);
  const onScreen = (shot, t, name, hand) => {
    const { cam } = R.cameraAt(shot, t - shot.wt0), view = makeView(cam, W, H), a = world.actors[name];
    if (!a) return false;
    const st = a.state(t), p3 = st.pos3 || [st.pos[0], (st.y || 0) + (hand ? (a.def.height ?? 1.7) * 0.7 : 0), st.pos[1]];
    const pr = view.project(...p3);
    return !!pr && pr[0] > -W * 0.02 && pr[0] < W * 1.02 && pr[1] > -H * 0.05 && pr[1] < H * 1.05;
  };
  const gestureNear = (name, t) => [-0.8, -0.4, 0, 0.3].some((dt) => { const g = world.state(name, t + dt).gesture; return g && g.amt > 0.5 && ['catch', 'up', 'reach', 'take', 'offer', 'fly', 'hold', 'touch'].includes(g.name); });
  for (const [name, a] of Object.entries(world.actors)) {
    if (!OBJ.includes(a.def.kind) || !a.events) continue;
    a.events.forEach((e, i) => {
      if (e.mode === 'key') return;
      if (i === 0 && e.t <= shots[0].wt0 + 0.01) return; // the starting state
      const what = e.mode === 'held' ? `${e.holder} ${a.events[i - 1]?.mode === 'free' ? 'catches' : 'takes'} the ${name}` : `the ${name} is let go`;
      const sh = shotAtWorld(e.t);
      if (!sh) { add(-1, 'warn', `${what} at world ${e.t.toFixed(1)} s, between shots — the audience never sees it happen`); return; }
      const who = e.mode === 'held' ? e.holder : a.events[i - 1]?.holder;
      if (who && !onScreen(sh, e.t, who, true)) add(sh.index, 'warn', `${what} out of frame`);
      if (e.mode === 'held' && !gestureNear(e.holder, e.t)) add(sh.index, 'warn', `${what} without reaching for it (add a catch/take/reach gesture)`);
    });
  }
  for (const [name, a] of Object.entries(world.actors)) {
    if (a.def.kind !== 'thread') continue;
    for (const op of a.def.blocking || []) if (op[0] === 'link') {
      const sh = shotAtWorld(op[1]);
      if (!sh) add(-1, 'warn', `${name} links ${op[2]} and ${op[3]} between shots — it will appear from nowhere`);
      else if (!onScreen(sh, op[1], op[2]) || !onScreen(sh, op[1], op[3])) add(sh.index, 'warn', `${name} links ${op[2]} and ${op[3]} with one of them out of frame`);
    }
  }

  // colour as meaning: every colour used for a motif should say what it means in THIS film
  const motifs = film.colors || {};
  const used = new Map();
  const note = (col, who) => { if (!col || col === 'ink') return; if (!used.has(col)) used.set(col, []); used.get(col).push(who); };
  for (const [n, d] of Object.entries(film.cast || {})) {
    note(d.color, n); note(d.scarf, n); note(d.shareColor, n);
    // character accents: one small detail per character, and it must mean something (a declared motif)
    const acc = [d.scarf, ...Object.values(d.accessories || {})].filter((c) => c && c !== 'ink');
    for (const c of Object.values(d.accessories || {})) note(c, n);
    if (new Set(acc).size > 1) add(-1, 'warn', `${n} wears ${new Set(acc).size} accent colours (${[...new Set(acc)].join(', ')}) — one meaningful detail per character keeps the silhouette`);
    if (acc.length && !acc.every((c) => motifs[c])) add(-1, 'warn', `${n}'s accent (${acc.join(', ')}) has no declared meaning — give it a motif in film.colors`);
    // every lead should be seen in colour: when we first meet them their accent must read (not drained, not tiny)
    const isLead = (!d.kind || d.kind === 'person') && !d.bg;
    if (isLead && Object.keys(motifs).length) {
      const first = shots.find((sh) => !sh.blank && (sh.set ?? d.set) === (d.set ?? sh.set) && R.world.actors[n]?.state(sh.wt0 + sh.dur / 2).visible);
      const lv = (c) => { const m = motifs[c]; if (!m) return 1; if (!Array.isArray(m.level)) return 1; let v = m.level[0][1]; for (const [t0, val] of m.level) if (first && t0 <= first.wt0 + first.dur / 2) v = val; return v; };
      const big = [d.scarf, d.accessories?.ribbon, d.accessories?.sash, d.accessories?.belt, d.accessories?.hem, d.accessories?.hatband].filter(Boolean);
      const people = Object.values(film.cast || {}).filter((c) => (!c.kind || c.kind === 'person') && !c.bg).length;
      if (!acc.length) { if (!d.plain && people <= 3) add(-1, 'info', `${n} wears no colour — a lead usually carries one meaningful accent (scarf, ribbon, sash, hatband); mark plain: true if leaving them colourless is the point`); }
      else if (!big.length) add(-1, 'warn', `${n}'s only accent (${acc.join(', ')}) is too small to read in most shots — give a lead a scarf, ribbon, sash or hatband`);
      else if (first && !big.some((c) => motifs[c]?.arrives) && Math.max(...big.map(lv)) < 0.35) add(first.index, 'warn', `${n} is colourless when we first meet them (accent at ${Math.max(...big.map(lv)).toFixed(2)}) — let the audience see their colour before it changes`);
    }
  }
  for (const [sn, st] of Object.entries(film.sets || { main: film.set || {} })) for (const p of st.props || []) note(p.color, `${sn}/${p.kind}`);
  if (Object.keys(motifs).length) {
    for (const [col, who] of used) if (!motifs[col] && col !== 'accent') add(-1, 'info', `colour '${col}' (${who.join(', ')}) is not a declared motif in film.colors`);
    for (const [name, m] of Object.entries(motifs)) {
      if (!m.meaning) add(-1, 'warn', `colour motif '${name}' has no meaning — say what it stands for in this film`);
      if (!used.has(name) && !shots.some((sh) => sh.tint && Object.values(sh.tint).some(([src]) => src === name))) add(-1, 'info', `colour motif '${name}' is declared but never used`);
      // a change of a colour's level is a story event: it should be seen
      for (const [t0, , dur = 0.6] of (Array.isArray(m.level) ? m.level.slice(1) : [])) {
        const sh = shots.find((x) => !x.blank && t0 + dur > x.wt0 && t0 < x.wt0 + x.dur);
        if (!sh) add(-1, 'warn', `colour '${name}' changes at world ${t0} s between shots — the audience never sees it happen`);
      }
    }
    if (Object.keys(motifs).length > 3) add(-1, 'info', `${Object.keys(motifs).length} colour motifs — is each one earning its place?`);
  } else {
    const accents = [...new Set(Object.entries(film.cast || {}).filter(([, d]) => d.color === 'accent' || d.scarf === 'accent').map(([n, d]) => d.motif || n))];
    if (accents.length > 1) add(-1, 'warn', `accent colour used by ${accents.join(', ')} — give each colour its own motif and meaning in film.colors, or keep one`);
  }
  // richness: is the film using the world, or just two figures on paper? Each family is a kind of life a frame can have.
  const sets = Object.values(film.sets || {}), moods = Object.values(film.seasons || {}), cast = Object.values(film.cast || {});
  const live = shots.filter((s) => !s.blank);
  const moved = live.filter((s) => {
    const a = R.cameraAt(s, 0).cam, b = R.cameraAt(s, s.dur).cam;
    return Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]) > 0.15 || Math.abs(a.yaw - b.yaw) > 0.02 || Math.abs(a.pitch - b.pitch) > 0.02 || Math.abs(a.lens - b.lens) > 1;
  }).length;
  const fam = {
    'sky (sun · moon · stars · clouds)': sets.some((s) => s.sky?.sun || s.sky?.moon || s.sky?.stars || s.clouds?.length) || live.some((s) => s.sky?.sun || s.sky?.moon || s.sky?.stars) || cast.some((c) => c.kind === 'cloud'),
    'life beyond the leads (birds, clouds that move, passers-by)': cast.some((c) => c.kind === 'bird' || c.kind === 'cloud') || cast.filter((c) => !c.kind || c.kind === 'person').length > 2 || sets.some((st) => st.life),
    'weather in the air (leaves, snow, rain, motes)': moods.some((m) => m.weather?.type) || live.some((s) => s.weather?.type || ['autumn', 'winter', 'spring', 'summer'].includes(typeof s.season === 'string' ? s.season : s.season?.from)),
    'a place (props near, middle and far)': sets.reduce((n, s) => n + (s.props?.length || 0) + (s.rivers?.length || 0) + (s.roads?.length || 0), 0) >= 3,
    'light that changes (mood blends, grade, time of day)': live.some((s) => (s.season && typeof s.season === 'object') || s.light?.from) || new Set(live.map((s) => JSON.stringify(s.season ?? ''))).size > 1 || new Set(live.map((s) => JSON.stringify(s.grade ?? ''))).size > 2,
    'a world that moves (land motion, feel, wind gusts)': sets.some((s) => s.motion) || live.some((s) => s.feel) || !!film.air?.gusts,
    'camera that moves (in at least a third of shots)': moved >= live.length / 3,
    'transitions beyond the cut (reveal, dissolve, iris, match cut)': live.some((s) => s.reveal || s.transition || s.matchCut),
    'sound design (music, cues, ambience beds)': !!(film.music || film.audio?.length) || live.filter((s) => s.sound?.length).length >= live.length / 3,
  };
  const missing = Object.entries(fam).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) add(-1, missing.length > 2 ? 'warn' : 'info', `richness ${9 - missing.length}/9 — not yet used: ${missing.join(' · ')}`);
  const asl = R.duration / shots.length;
  const text = [
    `${film.title}: ${shots.length} shots, ${R.duration.toFixed(1)}s, average shot ${asl.toFixed(1)}s`,
    ...items.map((i) => `  ${i.level === 'warn' ? '⚑' : '·'} ${i.shot >= 0 ? `shot ${i.shot + 1} ${shots[i.shot].name}: ` : ''}${i.msg}`),
    items.length ? '' : '  no continuity issues found',
  ].join('\n');
  return { items, text };
}
