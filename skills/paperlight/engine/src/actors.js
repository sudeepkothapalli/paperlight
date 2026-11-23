// Blocking: actors live in continuous *world time*. Shots are windows onto that time,
// so continuity (positions, gaze, props) is automatic across cuts.
//
// person ops:  ['at',[x,z],headingDeg] ['walk',[[x,z],...],speed] ['stand',sec]
//              ['turn',deg,sec] ['look',deg,sec] (head yaw, relative) ['trail'] ['hide'] ['show']
//              ['set','dream'] (which world they are in) ['gesture','reach'|'wave'|'none'] (no time)
//              ['hop',height,dur] ['lift',dy,dur] (sink/rise) ['ride','actor',[dx,dy,dz]] ['dismount',[x,z],deg]
//              ['pose',{lean,slump,chin,breath,tuck},dur] (attitude, no time) ['sit','chair'|'ground'|'bed',dur] ['rise',dur]
//              in bed: ['lift', mattressHeight, 0], ['tuck', true], ['sit', 'bed', 0] — legs under a blanket; pose.tuck 0..1 pulls it up to the chin
//              ['lookAt','actor'|null,ramp] (head follows someone, no time) ['face','actor',dur] ['walkTo','actor',stopDist,speed]
//              ['kneel',dur] ['lie',dur] ['rise',dur] · ['gesture',name,ramp,'near'|'far'|'both'] — each arm has its own track
// bird ops:    ['key',wt,[x,y,z]] ['hop',wt,[x,z],dur] ['chirp',wt]  (times are absolute)
// cloud ops:   ['key',wt,[x,y,z]] ['shape',wt,'rabbit',dur] ['scale',wt,s,dur] ['glow',wt,v,dur] ['rain',wt,v,dur]

import { DEG, arcPath, splinePoints, clamp, angleLerp, catmull, smoothstep, lerp, noise3 } from './math.js';
import { windAt } from './atmosphere.js';
import { handApprox } from './figures.js';
import { groundHeightAt } from './scenery.js';

export function compilePerson(def, w0 = null) {
  const segs = [];
  const headKeys = [[0, 0]];
  const events = [];
  let t = def.start ?? 0, pos = [0, 0], heading = 0, dist = 0, visible = true, trailStart = null, trailEnd = null;
  const tucks = [[-Infinity, false]];
  const poses = [[-Infinity, {}, 0]], sits = [[-Infinity, 0, 0, 'chair']], lookAts = [[-Infinity, null, 0]];
  const H0 = def.height ?? 1.75, stepBase = 0.74 * (H0 / 1.75) * (def.gait?.stride ?? 1);
  const stepLen = (v) => stepBase * (1 + 0.55 * smoothstep(1.9, 3.2, v / Math.sqrt(H0 / 1.75))); // runners take longer strides
  let steps = 0;
  const speaks = [];
  const setKeys = [[-Infinity, def.set ?? 'main']], gestures = [[-Infinity, 'none']], gestures2 = [[-Infinity, 'none']], lifts = [[-Infinity, 0, 0]], hops = [], rides = [];
  let ride = null, liftBase = 0;
  const grows = [[-Infinity, def.scale ?? 1, 0]];
  for (const op0 of def.blocking || []) {
    const op = op0.slice();
    const [kind, ...a] = op;
    if (kind === 'set') { setKeys.push([t, a[0]]); continue; }
    if (kind === 'until') { const T = Math.max(t, a[0]); segs.push({ type: 'stand', t0: t, t1: T, pos, heading, dist, visible }); t = T; continue; }
    if (kind === 'tuck') { tucks.push([t, a[0] !== false]); continue; }
    if (kind === 'pose') { poses.push([t, a[0] || {}, a[1] ?? 0.8]); continue; }
    if (kind === 'lookAt') { lookAts.push([t, a[0] ?? null, a[1] ?? 0.5]); continue; }
    if (kind === 'sit' || kind === 'rise' || kind === 'kneel' || kind === 'lie') {
      const down = kind !== 'rise';
      const dur = (kind === 'sit' ? a[1] : a[0]) ?? (kind === 'lie' ? 1.6 : 1.0);
      sits.push([t, down ? 1 : 0, dur, kind === 'sit' ? a[0] || 'chair' : kind === 'rise' ? sits[sits.length - 1][3] : kind]);
      segs.push({ type: 'stand', t0: t, t1: t + dur, pos, heading, dist, steps, visible }); t += dur; continue;
    }
    if (kind === 'face' && w0) { // turn the body toward someone (resolved where they are at this moment)
      const tp = w0.state(a[0], t).pos; op[0] = 'turn'; op.splice(1, op.length - 1, Math.atan2(tp[0] - pos[0], tp[1] - pos[1]) / DEG, a[1] ?? 0.8);
    } else if (kind === 'face') { segs.push({ type: 'stand', t0: t, t1: t + (a[1] ?? 0.8), pos, heading, dist, steps, visible }); t += a[1] ?? 0.8; continue; }
    if (kind === 'walkTo') { // walk up to someone and stop a little short of them
      const tp = w0 ? w0.state(a[0], t).pos : pos;
      const dx = tp[0] - pos[0], dz = tp[1] - pos[1], L = Math.hypot(dx, dz) || 1, stop = Math.min(L - 0.05, a[1] ?? 0.9);
      op.length = 0; op.push('walk', [[pos[0] + (dx / L) * (L - stop), pos[1] + (dz / L) * (L - stop)]], a[2] ?? 1.2);
    }
    if (op[0] !== kind) { a.length = 0; a.push(...op.slice(1)); }
    const kind2 = op[0];
    if (kind2 === 'gesture') { // each arm has its own track: one can hold while the other waves
      const arms = a[2] ?? (a[0] === 'fly' ? 'both' : 'near');
      if (arms !== 'far') gestures.push([t, a[0], a[1] ?? 0.5, arms]);
      if (arms !== 'near') gestures2.push([t, a[0], a[1] ?? 0.5, arms]);
      continue;
    }
    if (kind2 === 'touch') { // ['touch', [x,y,z] | 'actor' | 'actor:head' | 'actor:hand', ramp, arm] — the hand lands exactly there (IK)
      const arms = a[2] ?? 'near';
      if (arms !== 'far') gestures.push([t, 'touch', a[1] ?? 0.6, arms, a[0]]);
      if (arms !== 'near') gestures2.push([t, 'touch', a[1] ?? 0.6, arms, a[0]]);
      continue;
    }
    if (kind2 === 'speak') { speaks.push([t, t + (a[0] ?? 2)]); continue; } // talking, without a face: head bob, gesture, a speech mark (no time)
    if (kind2 === 'hop') { const dur = a[1] ?? 0.45; hops.push([t, a[0] ?? 0.2, dur]); segs.push({ type: 'stand', t0: t, t1: t + dur, pos, heading, dist, visible }); t += dur; continue; }
    if (kind2 === 'grow') { grows.push([t, a[0], a[1] ?? 1]); continue; } // change size (no time): a hero growing huge, shrinking small
    if (kind2 === 'leap') {
      // ['leap', [x, z], dur, { height, land: newGroundY }] — a ballistic flight; the body pitches into flight between take-off and landing
      const o = a[2] || {}, dur = a[1] ?? 2, to = a[0], land = o.land ?? liftBase;
      segs.push({ type: 'leap', t0: t, t1: t + dur, from: pos, to, h0: heading, arc: o.height ?? 4, base0: liftBase, base1: land, soar: o.soar ?? 1, ease: o.ease ?? 0.25, dist, steps, visible });
      heading = Math.atan2(to[0] - pos[0], to[1] - pos[1]); pos = to.slice(); t += dur;
      lifts.push([t, land, 0]); liftBase = land; continue;
    }
    if (kind2 === 'lift') { const dur = a[1] ?? 1; lifts.push([t, a[0], dur]); liftBase = a[0]; segs.push({ type: 'stand', t0: t, t1: t + dur, pos, heading, dist, visible }); t += dur; continue; }
    if (kind2 === 'ride') { ride = { t0: t, t1: Infinity, target: a[0], off: a[1] || [0, 0, 0] }; rides.push(ride); continue; }
    if (kind2 === 'dismount') { if (ride) ride.t1 = t; ride = null; pos = a[0].slice(); heading = (a[1] ?? 0) * DEG; segs.push({ type: 'stand', t0: t, t1: t, pos, heading, dist, visible }); continue; }
    if (kind2 === 'at') { pos = a[0].slice(); heading = (a[1] ?? 0) * DEG; segs.push({ type: 'stand', t0: t, t1: t, pos, heading, dist, steps, visible }); }
    else if (kind2 === 'stand' || kind2 === 'wait') { segs.push({ type: 'stand', t0: t, t1: t + a[0], pos, heading, dist, visible }); t += a[0]; }
    else if (kind2 === 'turn') {
      const h1 = a[0] * DEG;
      // turning on the spot is done with the feet: about two small steps per quarter turn (none for a tiny adjustment)
      const dh = Math.abs(Math.atan2(Math.sin(h1 - heading), Math.cos(h1 - heading))), tsteps = dh > 0.35 ? Math.max(2, Math.round((dh / (Math.PI / 2)) * 2)) : 0;
      segs.push({ type: 'turn', t0: t, t1: t + (a[1] ?? 0.8), pos, h0: heading, h1, dist, visible, steps, tsteps });
      t += a[1] ?? 0.8; heading = h1; steps += tsteps;
    } else if (kind2 === 'look') {
      const dur = a[1] ?? 1; const ttime = a[2] ?? Math.min(0.6, dur);
      headKeys.push([t, null], [t + ttime, a[0] * DEG]);
      segs.push({ type: 'stand', t0: t, t1: t + dur, pos, heading, dist, visible }); t += dur;
    } else if (kind2 === 'glance') { // head turn without consuming time
      headKeys.push([t + (a[2] ?? 0), null], [t + (a[2] ?? 0) + (a[1] ?? 0.6), a[0] * DEG]);
    } else if (kind2 === 'walk') {
      const speed = a[1] ?? 1.3;
      const path = arcPath(splinePoints([pos, ...a[0]], 0.2));
      const ramp = Math.min(0.7, path.length / speed / 3);
      const T = path.length / speed + ramp;
      const sl = stepLen(speed);
      const keep = a[2]?.face === false; // a sidestep: walk without turning to face the way
      segs.push({ type: 'walk', t0: t, t1: t + T, path, speed, ramp, h0: heading, dist0: dist, steps0: steps, step: sl, visible, keep });
      t += T; dist += path.length; steps += path.length / sl; pos = path.at(path.length);
      if (!keep) { const dEnd = path.dirAt(path.length); heading = Math.atan2(dEnd[0], dEnd[1]); }
    } else if (kind2 === 'trail') { if (a[0] === false || a[0] === 'end') trailEnd = t; else trailStart = t; }
    else if (kind2 === 'hide') visible = false;
    else if (kind2 === 'show') visible = true;
    else if (kind2 === 'event') events.push({ wt: t, name: a[0] });
  }
  segs.push({ type: 'stand', t0: t, t1: Infinity, pos, heading, dist, steps, visible });
  for (const sg of segs) if (sg.steps == null) sg.steps = sg.steps0 ?? 0;

  const keyAt = (keys, wt) => { let k = keys[0]; for (const x of keys) if (x[0] <= wt) k = x; return k; };
  function gestureAt(wt, list = gestures) {
    let i = 0; for (let j = 0; j < list.length; j++) if (list[j][0] <= wt) i = j;
    const gestures = list;
    const [t0, name, ramp, arms, target] = gestures[i];
    const u = clamp((wt - t0) / Math.max(1e-3, ramp));
    if (name === 'none') { const prev = gestures[i - 1]; return prev && prev[1] !== 'none' ? { name: prev[1], amt: 1 - smoothstep(0, 1, u), t: wt - prev[0], arms: prev[3], exiting: true, target: prev[4] } : { name: 'none', amt: 0 }; }
    return { name, amt: u, t: wt - t0, arms, target };
  }
  let world = null;

  // resolve head keys (null = hold previous value)
  for (let i = 1; i < headKeys.length; i++) if (headKeys[i][1] == null) headKeys[i][1] = headKeys[i - 1][1];
  const headAt = (wt) => {
    let v = 0;
    for (let i = 1; i < headKeys.length; i++) {
      const [ta, va] = headKeys[i - 1], [tb, vb] = headKeys[i];
      if (wt >= tb) { v = vb; continue; }
      if (wt >= ta) { v = lerp(va, vb, smoothstep(ta, tb, wt)); break; }
    }
    return v;
  };

  // an actor can exist only for a window of world time: enter defaults to `start`, exit 'end' = after the last op
  const enter = def.enter ?? (def.start != null ? def.start : null);
  const exit = def.exit === 'end' ? t : def.exit ?? null;
  function state(wt, shallow = false) {
    // the latest segment that has started (so an instantaneous 'at' wins at its own moment)
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].t0 <= wt) lo = m; else hi = m - 1; }
    const s = segs[lo];
    const inWindow = (enter == null || wt >= enter) && (exit == null || wt <= exit);
    const out = { pos: s.pos, heading: s.heading, speed: 0, dist: s.dist, head: headAt(wt), visible: s.visible && inWindow, walking: 0 };
    out.set = keyAt(setKeys, wt)[1];
    out.tucked = keyAt(tucks, wt)[1];
    out.steps = s.steps ?? 0;
    // anticipation: in the moment before setting off, weight shifts back and the head turns toward the way
    const nx = segs[lo + 1];
    if (s.type !== 'walk' && nx && nx.type === 'walk' && wt > nx.t0 - 0.4 && wt <= nx.t0) {
      const u = smoothstep(nx.t0 - 0.4, nx.t0, wt), d0 = nx.path.dirAt(0), h0 = Math.atan2(d0[0], d0[1]);
      out.accel = -1.6 * Math.sin(Math.PI * u);
      out.head += 0.6 * Math.atan2(Math.sin(h0 - out.heading), Math.cos(h0 - out.heading)) * u;
    }
    // attitude: blended posture
    const pz = {};
    for (const [t0, p, dur] of poses) if (wt >= t0) { const u = dur ? smoothstep(t0, t0 + dur, wt) : 1; for (const kk of ['lean', 'slump', 'chin', 'breath', 'tuck']) pz[kk] = lerp(pz[kk] ?? 0, p[kk] ?? 0, u); }
    out.pose = pz;
    let sv = 0, sOn = 'chair';
    for (const [t0, v, dur, on] of sits) if (wt >= t0) { sv = lerp(sv, v, dur ? smoothstep(t0, t0 + dur, wt) : 1); if (v) sOn = on; }
    out.sit = sv; out.sitOn = sOn;
    out.gesture = gestureAt(wt); out.gesture2 = gestureAt(wt, gestures2);
    // secondary motion: after a walk stops (or a turn ends) the coat, hair and scarf swing on and settle (a damped spring)
    let settle = 0;
    for (let j = Math.max(0, lo - 2); j <= lo; j++) {
      const sg = segs[j]; if (!sg || (sg.type !== 'walk' && sg.type !== 'turn')) continue;
      const dt = wt - sg.t1; if (dt < 0 || dt > 1.6) continue;
      const amp = sg.type === 'walk' ? Math.min(1, (sg.speed || 1) / 1.6) : 0.6;
      settle += amp * Math.exp(-dt * 3.2) * Math.sin(dt * 11);
    }
    out.settle = settle;
    const sp = speaks.find(([a0, a1]) => wt >= a0 && wt <= a1);
    out.speaking = sp ? Math.min(1, (wt - sp[0]) / 0.25, (sp[1] - wt) / 0.25) : 0;
    let y = 0;
    for (const [t0, v, dur] of lifts) if (wt >= t0) y = lerp(y, v, dur ? smoothstep(t0, t0 + dur, wt) : 1);
    for (const [t0, h, dur] of hops) if (wt >= t0 && wt <= t0 + dur) { const u = (wt - t0) / dur; y += 4 * h * u * (1 - u); }
    out.y = y;
    let sc = 1; for (const [t0, v, dur] of grows) if (wt >= t0) sc = lerp(sc, v, dur ? smoothstep(t0, t0 + dur, wt) : 1);
    out.scale = sc;
    if (s.type === 'leap') {
      const u = clamp((wt - s.t0) / (s.t1 - s.t0)), e = s.ease;
      const ue = u < e ? (u * u) / (2 * e * (1 - e)) : u > 1 - e ? 1 - ((1 - u) * (1 - u)) / (2 * e * (1 - e)) : (u - e / 2) / (1 - e); // gentle take-off and landing
      out.pos = [lerp(s.from[0], s.to[0], ue), lerp(s.from[1], s.to[1], ue)];
      const gh = (q) => (world?.heightAt ? world.heightAt(out.set, q[0], q[1]) : 0); // take off from / land on rocks and decks
      out.y = lerp(s.base0 + gh(s.from), s.base1 + gh(s.to), ue) + s.arc * 4 * ue * (1 - ue); out.leaping = true;
      out.heading = angleLerp(s.h0, Math.atan2(s.to[0] - s.from[0], s.to[1] - s.from[1]), smoothstep(0, 0.12, u));
      out.soar = s.soar * smoothstep(0.02, 0.16, u) * (1 - smoothstep(0.84, 0.98, u));
      out.speed = 0;
    }
    const rd = rides.find((r) => wt >= r.t0 && wt < r.t1);
    if (rd && world) {
      const ts = world.state(rd.target, wt), tp = ts.pos3 || [ts.pos[0], 0, ts.pos[1]];
      const hh = ts.heading ?? 0, c = Math.cos(hh), sn = Math.sin(hh);
      const [dx, dy, dz] = rd.off; // offset in the carrier's frame: dx = sideways, dz = forward
      out.pos = [tp[0] + dx * c + dz * sn, tp[2] - dx * sn + dz * c];
      out.y = (tp[1] || 0) + dy + y; out.heading = hh; out.riding = rd.target; out.set = ts.set ?? out.set;
    } else if (world) {
      // stepping off: glide from the riding position to the ground over 0.6 s (no pop)
      const off = rides.find((r) => r.t1 !== Infinity && wt >= r.t1 && wt < r.t1 + 0.6);
      if (off) {
        const ts = world.state(off.target, off.t1 - 1e-3), tp = ts.pos3 || [ts.pos[0], 0, ts.pos[1]];
        const hh = ts.heading ?? 0, c = Math.cos(hh), sn = Math.sin(hh), [dx, dy, dz] = off.off;
        const u = smoothstep(off.t1, off.t1 + 0.6, wt);
        out.pos = [lerp(tp[0] + dx * c + dz * sn, out.pos[0], u), lerp(tp[2] - dx * sn + dz * c, out.pos[1], u)];
        out.y = lerp((tp[1] || 0) + dy, out.y, u) + 0.12 * Math.sin(Math.PI * u);
      }
    }
    if (s.type === 'turn') {
      const u = smoothstep(s.t0, s.t1, wt);
      out.heading = angleLerp(s.h0, s.h1, u);
      const rem = Math.atan2(Math.sin(s.h1 - out.heading), Math.cos(s.h1 - out.heading));
      out.head += 0.55 * rem * Math.sin(Math.PI * clamp((wt - s.t0) / (s.t1 - s.t0) * 1.15)); // the head leads the turn
      if (s.tsteps && !(out.sit > 0.3)) { const v = clamp((wt - s.t0) / (s.t1 - s.t0)); out.steps = s.steps + s.tsteps * v; out.walking = 0.32 * Math.sin(Math.PI * v); } // small stepping feet
    } else if (s.type === 'walk') {
      const tt = clamp(wt - s.t0, 0, s.t1 - s.t0), T = s.t1 - s.t0, r = s.ramp, v = s.speed;
      // trapezoidal speed profile: ease in over r, ease out over r
      let d;
      if (tt < r) d = (v * tt * tt) / (2 * r);
      else if (tt > T - r) { const q = T - tt; d = s.path.length - (v * q * q) / (2 * r); }
      else d = (v * r) / 2 + v * (tt - r);
      d = clamp(d, 0, s.path.length);
      const p = s.path.at(d), dir = s.path.dirAt(d);
      const hPath = Math.atan2(dir[0], dir[1]);
      out.pos = p; out.dist = s.dist0 + d;
      out.heading = s.keep ? s.h0 : angleLerp(s.h0, hPath, smoothstep(0, 0.6, tt));
      out.speed = tt < r ? v * tt / r : tt > T - r ? v * (T - tt) / r : v;
      out.walking = clamp(out.speed / v);
      out.accel = tt < r ? v / r : tt > T - r ? -v / r : 0;   // drives the weight shift: lean in, settle back
      out.steps = s.steps0 + d / s.step;
    }
    if (world?.heightAt && !out.riding && !out.leaping) out.y += world.heightAt(out.set, out.pos[0], out.pos[1]);
    const la = keyAt(lookAts, wt);
    if (world && !shallow && (la[1] || lookAts.indexOf(la) > 0)) {
      const i = lookAts.indexOf(la), prev = lookAts[i - 1];
      const want = (name) => {
        if (!name) return out.head;
        const tp = world.state(name, wt, true).pos; // shallow: two people looking at each other must not recurse
        const d = Math.atan2(tp[0] - out.pos[0], tp[1] - out.pos[1]) - out.heading;
        return clamp(Math.atan2(Math.sin(d), Math.cos(d)), -1.35, 1.35);
      };
      out.head = lerp(want(prev?.[1]), want(la[1]), smoothstep(la[0], la[0] + (la[2] || 0.5), wt));
    }
    return out;
  }

  // positions along the actual walked route, for trails
  function route(wtFrom, wtTo, step = 0.12) {
    const pts = [];
    for (let w = wtFrom; w <= wtTo; w += step) {
      const p = state(w).pos;
      if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.18) pts.push(p);
    }
    const p = state(wtTo).pos;
    if (pts.length && Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.02) pts.push(p);
    return pts;
  }

  // trail route is memoised once it is complete (it never changes after trailEnd)
  let doneRoute = null;
  function trailRoute(wt) {
    if (trailStart == null || wt <= trailStart) return null;
    if (trailEnd != null && wt >= trailEnd) return doneRoute || (doneRoute = route(trailStart, trailEnd));
    return route(trailStart, wt);
  }
  return { def, state, route, trailRoute, trailStart, trailEnd, events, end: t, bind: (w) => { world = w; } };
}

// A cloud with a personality: it moves along keyed positions, breathes, changes shape, glows, rains.
export function compileCloud(def) {
  const keys = [], tracks = { scale: [[-Infinity, def.scale ?? 1, 0]], glow: [[-Infinity, def.glow ?? 0, 0]], rain: [[-Infinity, 0, 0]] };
  const shapes = [[-Infinity, def.shape || 'small', 0]];
  for (const op of def.blocking || []) {
    const [kind, ...a] = op;
    if (kind === 'key') keys.push({ wt: a[0], p: a[1] });
    else if (kind === 'shape') shapes.push([a[0], a[1], a[2] ?? 1.5]);
    else if (tracks[kind]) tracks[kind].push([a[0], a[1], a[2] ?? 1]);
  }
  keys.sort((x, y) => x.wt - y.wt);
  const posAt = (wt) => {
    if (!keys.length) return def.at || [0, 0, 0];
    if (wt <= keys[0].wt) return keys[0].p;
    if (wt >= keys[keys.length - 1].wt) return keys[keys.length - 1].p;
    let i = 0; while (keys[i + 1].wt < wt) i++;
    const A = keys[i], B = keys[i + 1], u = (wt - A.wt) / (B.wt - A.wt);
    const P0 = keys[Math.max(0, i - 1)].p, P3 = keys[Math.min(keys.length - 1, i + 2)].p;
    // ease within each leg so clouds drift and settle rather than tick through keys
    return catmull(P0, A.p, B.p, P3, smoothstep(0, 1, u) * 0.5 + u * 0.5);
  };
  const track = (tr, wt) => { let v = tr[0][1]; for (const [t0, val, dur] of tr) if (wt >= t0) v = lerp(v, val, dur ? smoothstep(t0, t0 + dur, wt) : 1); return v; };
  function state(wt) {
    const p = posAt(wt);
    // heading follows the recent direction of travel, smoothed, so a cloud turns around instead of flipping
    let hx = 0, hz = 0;
    for (let back = 0; back < 1.2; back += 0.1) { const a = posAt(wt - back - 0.1), b = posAt(wt - back + 0.1), wgt = 1 - back / 1.2; hx += (b[0] - a[0]) * wgt; hz += (b[2] - a[2]) * wgt; }
    let heading = (def.heading ?? 90) * DEG;
    if (Math.hypot(hx, hz) > 0.02) heading = Math.atan2(hx, hz);
    else for (let back = 1.2; back < 8; back += 0.25) {
      const a = posAt(wt - back - 0.2), b = posAt(wt - back + 0.2);
      if (Math.hypot(b[0] - a[0], b[2] - a[2]) > 0.02) { heading = Math.atan2(b[0] - a[0], b[2] - a[2]); break; }
    }
    let i = 0; for (let j = 0; j < shapes.length; j++) if (shapes[j][0] <= wt) i = j;
    const [t0, name, dur] = shapes[i];
    const morph = dur ? smoothstep(t0, t0 + dur, wt) : 1;
    const prev = i > 0 ? shapes[i - 1][1] : name;
    const visible = (def.enter == null || wt >= def.enter) && (def.exit == null || wt <= def.exit);
    return { visible, pos3: p, pos: [p[0], p[2]], heading, shape: prev, shapeB: name, morph, scale: track(tracks.scale, wt), glow: track(tracks.glow, wt), rain: track(tracks.rain, wt), set: def.set ?? 'main' };
  }
  return { def, state, end: keys[keys.length - 1]?.wt ?? 0 };
}

export function compileBird(def) {
  const keys = []; // {wt, p:[x,y,z], mode}
  const chirps = [];
  const faces = []; // [wt, heading] for a perched bird
  for (const op of def.blocking || []) {
    const [kind, ...a] = op;
    if (kind === 'key') keys.push({ wt: a[0], p: a[1], mode: 'fly' });
    else if (kind === 'perch') keys.push({ wt: a[0], p: [a[1][0], 0, a[1][1]], mode: 'fly' });
    else if (kind === 'hop') {
      const prev = keys[keys.length - 1];
      keys.push({ wt: a[0], p: prev.p.slice(), mode: 'hold' });
      keys.push({ wt: a[0] + (a[2] ?? 0.32), p: [a[1][0], 0, a[1][1]], mode: 'hop' });
    } else if (kind === 'chirp') chirps.push(a[0]);
    else if (kind === 'face') faces.push([a[0], a[1] * DEG]);
  }
  faces.sort((x, y) => x[0] - y[0]);
  keys.sort((x, y) => x.wt - y.wt);
  const first = keys[0]?.wt ?? 0;

  let lastMode = 'hold';
  function posAt(wt) {
    lastMode = 'hold';
    if (wt <= keys[0].wt) return keys[0].p;
    if (wt >= keys[keys.length - 1].wt) return keys[keys.length - 1].p;
    let i = 0;
    while (keys[i + 1].wt < wt) i++;
    const A = keys[i], B = keys[i + 1];
    const u = (wt - A.wt) / (B.wt - A.wt);
    lastMode = B.mode;
    if (B.mode === 'hop') {
      const x = lerp(A.p[0], B.p[0], u), z = lerp(A.p[2], B.p[2], u);
      return [x, 0.12 * 4 * u * (1 - u), z];
    }
    if (B.mode === 'hold') return A.p;
    const P0 = keys[Math.max(0, i - 1)].p, P3 = keys[Math.min(keys.length - 1, i + 2)].p;
    const p = catmull(P0, A.p, B.p, P3, u);
    p[1] = Math.max(0, p[1]);
    return p;
  }

  let lastHeading = 0;
  function state(wt) {
    if (!keys.length || wt < first) return { visible: false, pos: [0, 0], pos3: [0, -10, 0], heading: 0, set: def.set ?? 'main' };
    const p = posAt(wt); const mode = lastMode; const q = posAt(wt + 0.06);
    const vx = q[0] - p[0], vy = q[1] - p[1], vz = q[2] - p[2];
    const hs = Math.hypot(vx, vz);
    const speed = Math.hypot(vx, vy, vz) / 0.06;
    let heading;
    if (hs > 0.002) heading = Math.atan2(vx, vz);
    else {
      // find last heading by looking back
      let w = wt, moved = -Infinity; heading = lastHeading;
      for (let k = 0; k < 60; k++) { w -= 0.1; const a = posAt(w), b = posAt(w + 0.06); if (Math.hypot(b[0] - a[0], b[2] - a[2]) > 0.002) { heading = Math.atan2(b[0] - a[0], b[2] - a[2]); moved = w; break; } }
      const fc = faces.filter((f) => f[0] <= wt).pop();
      if (fc && fc[0] > moved) heading = angleLerp(heading, fc[1], smoothstep(fc[0], fc[0] + 0.25, wt));
    }
    lastHeading = heading;
    const flying = mode === 'fly' && (speed > 0.4 || p[1] > 0.05);
    return { visible: true, pos: [p[0], p[2]], pos3: p, heading, speed, flying, climb: Math.atan2(vy, hs + 1e-6), set: def.set ?? 'main' };
  }
  return { def, state, chirps, end: keys[keys.length - 1]?.wt ?? 0 };
}

// Objects: kites, balloons, lanterns, balls, flowers — things that can be held, flown, released, caught.
//   ['key',wt,[x,y,z]]  ['heldBy',wt,'actor']  ['release',wt]  ['length',wt,metres,dur]
// A held kite flies downwind on its string; released, it drifts and climbs on the wind (string trailing);
// caught again, it blends back onto the new holder's string. A balloon floats above the hand; let go, it rises.
// Small things (ball, flower, letter, lantern) ride in the hand; dropped, they fall.
export function compileObject(def, air) {
  //   ['key',t,[x,y,z]]  ['heldBy',t,'who'(,'second holder')]  ['release',t]  ['fly',t,[x,y,z]] (directed free flight)
  //   ['length',t,metres,dur]
  //   ['steer',t,[[t,[x,y,z]],…]]  while held: the kite is pushed along a path (a lull sinks it, it lands) and stays
  //                                 at the last point, still on its string, until the next event
  //   ['slack',t,sag,dur]           how much a shared string sags (it lies on the land when slack, lifts when taut)
  //   ['tug',t,'who']               a pull: a ripple runs along the shared string from that person's hand
  const ev = [], fly = [], steers = [], tugs = [];
  const slackTr = [[-Infinity, def.slack ?? 0.12, 0]];
  const lengthTr = [[-Infinity, def.length ?? (def.kind === 'kite' ? 14 : 1.1), 0]];
  for (const op of def.blocking || []) {
    const [kind, wt, ...a] = op;
    if (kind === 'key') ev.push({ t: wt, mode: 'key', p: a[0] });
    else if (kind === 'heldBy' || kind === 'tie') ev.push({ t: wt, mode: 'held', holder: a[0], holders: a.filter((x) => typeof x === 'string') });
    else if (kind === 'release' || kind === 'drop') ev.push({ t: wt, mode: 'free' });
    else if (kind === 'fly') fly.push({ t: wt, p: a[0] });
    else if (kind === 'length') lengthTr.push([wt, a[0], a[1] ?? 2]);
    else if (kind === 'steer') steers.push({ t: wt, way: a[0].map(([t, p]) => ({ t, p })) });
    else if (kind === 'slack') slackTr.push([wt, a[0], a[1] ?? 1]);
    else if (kind === 'tug') tugs.push({ t: wt, who: a[0], amp: a[1] ?? 1 });
  }
  ev.sort((x, y) => x.t - y.t); fly.sort((x, y) => x.t - y.t);
  const keys = ev.filter((e) => e.mode === 'key');
  let world = null;
  const trackAt = (tr, wt) => { let v = tr[0][1]; for (const [t0, val, dur] of tr) if (wt >= t0) v = lerp(v, val, dur ? smoothstep(t0, t0 + dur, wt) : 1); return v; };
  const lengthAt = (wt) => trackAt(lengthTr, wt);
  const keyPos = (wt) => {
    if (!keys.length) return def.at || [0, 1, 0];
    if (wt <= keys[0].t) return keys[0].p;
    let i = 0; while (i < keys.length - 1 && keys[i + 1].t < wt) i++;
    if (i === keys.length - 1) return keys[i].p;
    const A = keys[i], B = keys[i + 1], u = (wt - A.t) / (B.t - A.t);
    return catmull(keys[Math.max(0, i - 1)].p, A.p, B.p, keys[Math.min(keys.length - 1, i + 2)].p, u);
  };
  const isPerson = (n) => { const k = world.def(n).kind; return !k || k === 'person'; };
  const handOf = (name, wt) => { const st = world.state(name, wt, true); return isPerson(name) ? handApprox(world.def(name), st) : st.pos3 || [st.pos[0], 0, st.pos[1]]; };
  const heldPos = (holder, wt) => {
    const w = windAt(air, wt), L = lengthAt(wt), h = handOf(holder, wt);
    if (def.kind === 'kite') {
      const el = (36 + 12 * noise3(wt * 0.21, 1.1, 2)) * DEG * clamp(0.5 + w.speed / 6, 0.5, 1.2);
      const az = Math.atan2(w.x, w.z) + 0.25 * noise3(wt * 0.17, 3.3, 1);
      return [h[0] + Math.sin(az) * Math.cos(el) * L, h[1] + Math.sin(el) * L, h[2] + Math.cos(az) * Math.cos(el) * L];
    }
    if (def.kind === 'balloon') return [h[0] + w.x * 0.25 * w.speed / 3 + 0.08 * noise3(wt * 0.6, 1, 1), h[1] + L, h[2] + w.z * 0.25 * w.speed / 3 + 0.08 * noise3(wt * 0.6, 2, 1)];
    return [h[0], h[1] - (def.hang ?? 0.02), h[2]];
  };
  const memo = new Map();
  // free flight: along directed 'fly' waypoints if given (ending exactly where the next holder will hold it),
  // otherwise carried by the wind — integrated step by step, so a staged gust really snatches it away
  function freePos(e, wt) {
    if (!memo.has(e)) {
      const p0 = state(e.t - 1e-3).pos3, next = ev.find((x) => x.t > e.t && x.mode === 'held');
      const way = fly.filter((f) => f.t > e.t && (!next || f.t < next.t));
      let path = null;
      const flies = def.kind === 'kite' || def.kind === 'balloon' || def.kind === 'lantern';
      if (way.length || (next && flies)) { // things that fly can be steered into the next hand; dropped things fall and wait
        path = [{ t: e.t, p: p0 }, ...way];
        if (next && world) path.push({ t: next.t, p: heldPos(next.holder, next.t) });
      }
      const sim = [];
      if (!path) { // integrate the wind
        let p = p0.slice(), vy = 0;
        for (let i = 0; i <= 24 * 40; i++) {
          const t = e.t + i / 24, w = windAt(air, t);
          sim.push(p.slice());
          const lift = def.kind === 'kite' ? 0.9 + 0.25 * w.speed : def.kind === 'balloon' || def.kind === 'lantern' ? 0.9 : 0;
          if (lift) { p[0] += (w.x * w.speed * 0.6) / 24; p[2] += (w.z * w.speed * 0.6) / 24; p[1] += lift / 24 / (1 + i / 120); }
          else { vy -= 9.8 / 24; p[1] = Math.max((world?.heightAt ? world.heightAt(def.set ?? 'main', p[0], p[2]) : 0) + (def.rest ?? 0.05), p[1] + vy / 24); }
        }
      }
      memo.set(e, { path, sim });
    }
    const { path, sim } = memo.get(e);
    const wob = def.kind === 'kite' ? [0.5 * noise3(wt * 0.4, 7, 1), 0.3 * noise3(wt * 0.5, 8, 2), 0.5 * noise3(wt * 0.4, 9, 1)] : [0, 0, 0];
    if (path) {
      if (wt >= path[path.length - 1].t) return path[path.length - 1].p;
      let i = 0; while (i < path.length - 2 && path[i + 1].t < wt) i++;
      const A = path[i], B = path[i + 1], u = clamp((wt - A.t) / (B.t - A.t));
      const P = catmull(path[Math.max(0, i - 1)].p, A.p, B.p, path[Math.min(path.length - 1, i + 2)].p, u);
      const fade = Math.sin(Math.PI * clamp((wt - path[0].t) / (path[path.length - 1].t - path[0].t))); // no wobble at the ends
      return P.map((v, k) => v + wob[k] * fade);
    }
    const i = Math.min(sim.length - 1, Math.floor((wt - e.t) * 24));
    return sim[i].map((v, k) => v + wob[k]);
  }
  // a steered held kite: from where the wind had it, along the path; it stays at the last point
  function steeredPos(e, wt) {
    const nextT = ev.find((x) => x.t > e.t)?.t ?? Infinity;
    const sd = steers.filter((s) => s.t >= e.t && s.t < nextT && s.t <= wt).pop();
    if (!sd) return null;
    const path = [{ t: sd.t, p: heldPos(e.holder, sd.t) }, ...sd.way];
    if (wt >= path[path.length - 1].t) return path[path.length - 1].p;
    let i = 0; while (i < path.length - 2 && path[i + 1].t < wt) i++;
    const A = path[i], B = path[i + 1], u = clamp((wt - A.t) / (B.t - A.t));
    return catmull(path[Math.max(0, i - 1)].p, A.p, B.p, path[Math.min(path.length - 1, i + 2)].p, u);
  }
  function modePos(e, wt) {
    if (!e || e.mode === 'key') return keyPos(wt);
    if (e.mode === 'held' && world) return steeredPos(e, wt) || heldPos(e.holder, wt);
    if (e.mode === 'free') return freePos(e, wt);
    return keyPos(wt);
  }
  function state(wt) {
    let i = -1; for (let j = 0; j < ev.length; j++) if (ev[j].t <= wt) i = j;
    const e = ev[i], prev = ev[i - 1];
    let p = modePos(e, wt);
    // hand-overs between holders blend; a catch out of free flight is already continuous (the path ends there)
    if (e && prev && e.mode === 'held' && prev.mode === 'held' && wt - e.t < 0.9) p = p.map((v, k) => lerp(modePos(prev, wt)[k], v, smoothstep(e.t, e.t + 0.9, wt)));
    // picked up from where it lay: lifted into the hand, not teleported
    if (e && prev && e.mode === 'held' && prev.mode === 'free' && !['kite', 'balloon', 'lantern'].includes(def.kind) && wt - e.t < 0.6) p = p.map((v, k) => lerp(freePos(prev, wt)[k], v, smoothstep(e.t, e.t + 0.6, wt)));
    const held = e?.mode === 'held' ? e.holder : null;
    const next = e?.mode === 'free' ? ev.find((x) => x.t > e.t && x.mode === 'held') : null;
    const visible = (def.enter == null || wt >= def.enter) && (def.exit == null || wt <= def.exit);
    return {
      visible, pos3: p, pos: [p[0], p[2]], heading: 0, held, holders: e?.mode === 'held' ? e.holders : [], free: e?.mode === 'free',
      catcher: next?.holder, toCatch: next ? next.t - wt : null,
      length: lengthAt(wt), slack: trackAt(slackTr, wt), grounded: p[1] < 0.6,
      tugs: tugs.filter((g) => g.t <= wt && wt - g.t < 6), wind: windAt(air, wt), set: def.set ?? 'main', since: e ? wt - e.t : 0,
    };
  }
  return { def, state, events: ev, end: ev.length ? ev[ev.length - 1].t : 0, bind: (w) => { world = w; } };
}

// A thread joining two things (people's hands, objects, or fixed points) over intervals of world time.
//   ['link', wt, 'a', 'b', { grow: seconds }]  ['unlink', wt]
export function compileThread(def) {
  const links = [];
  for (const op of def.blocking || []) {
    if (op[0] === 'link') links.push({ t0: op[1], t1: Infinity, a: op[2], b: op[3], grow: op[4]?.grow ?? 0 });
    if (op[0] === 'unlink' && links.length) links[links.length - 1].t1 = op[1];
  }
  return { def, end: 0, state: (wt) => { const l = links.find((x) => wt >= x.t0 && wt < x.t1); return { visible: !!l, link: l, pos: [0, 0], heading: 0, set: def.set ?? 'main', grow: l ? (l.grow ? clamp((wt - l.t0) / l.grow) : 1) : 0 }; } };
}

export function compileWorld(film) {
  const actors = {};
  for (const [name, def] of Object.entries(film.cast || {})) {
    const OBJ = ['kite', 'balloon', 'lantern', 'ball', 'flower', 'object'];
    actors[name] = def.kind === 'bird' ? compileBird(def) : def.kind === 'cloud' ? compileCloud(def)
      : OBJ.includes(def.kind) ? compileObject(def, film.air) : def.kind === 'thread' ? compileThread(def) : compilePerson(def);
  }
  const world = {
    actors,
    state: (name, wt, shallow) => actors[name].state(wt, shallow),
    def: (name) => actors[name].def,
    heightAt: (set, x, z) => groundHeightAt((film.sets?.[set] || (set === 'main' ? film.set : null) || {}).props, x, z),
  };
  for (const a of Object.values(actors)) a.bind?.(world);
  // second pass: people who face or walk up to someone are recompiled against the first-pass world
  for (const [name, def] of Object.entries(film.cast || {})) {
    if (def.kind && def.kind !== 'person') continue;
    if (!(def.blocking || []).some((op) => op[0] === 'face' || op[0] === 'walkTo')) continue;
    actors[name] = compilePerson(def, world);
    actors[name].bind(world);
  }
  return world;
}
