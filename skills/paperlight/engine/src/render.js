// Frame renderer: paper -> ink contour terrain -> trails -> shadows -> silhouettes -> titles -> grain.

import { createCanvas } from '@napi-rs/canvas';
import path from 'node:path';
import { detectBeats, snapShots } from './beats.js';
import { buildTerrain } from './terrain.js';
import { compileWorld } from './actors.js';
import { makeView } from './camera.js';
import { drawPerson, drawBird, drawShadow, drawContactShadow } from './figures.js';
import { resolveSeason, drawWeather, drawWash, coverFn, windAt, blendMoods, mixHex, greyOf, extrapolate } from './atmosphere.js';
import { drawCloud, drawSky, drawProp, drawPropGlow, drawMoonPatch, windowGeometry, trackValue, clipProject, drawObject, drawThread, riverGeometry, drawWaterFill, drawFlame, waterBand, fillPolys3, fireLevel } from './scenery.js';
import { handApprox } from './figures.js';
import { makeLiving, drawBackdrop, drawInterior, resolveLight, blendLights, mixC } from './living.js';
import { lifeCast } from './life.js';
import { rng, noise3, fbm, smoothstep, clamp, lerp, getEase, DEG, hashStr, animParam } from './math.js';

export const DEFAULT_PALETTE = { paper: '#f1eee6', ink: '#14120f', accent: '#c2381f' };
export const DEFAULT_STYLE = {
  pen: 2.1,          // base pen width in px at 1080p
  zRef: 9,           // depth at which pen width is nominal
  depthPow: 0.72,    // <1: far lines thin slower than perspective (drawn, not photographed)
  minSpacing: 2.6,   // px; denser contour levels get dropped (line LOD)
  fadeNear: 140, fadeFar: 420,
  coverage: 0.62,    // ink coverage between neighbouring lines at full tone
  maxPen: 9,         // cap on any line's width, in pens
  boil: 0.35,        // px of hand-drawn line boil, re-drawn on twos
  grain: 1, vignette: 0.1, wind: 1,
  sun: { az: 140, elev: 24 }, // degrees: shadow direction & length
};

export function compileFilm(film) {
  const shots = [];
  let ft = 0, wt = film.worldStart ?? 0;
  for (const [i, s] of film.shots.entries()) {
    if (s.wt != null) wt = s.wt;
    else if (s.skip) wt += s.skip;
    // a shot without a camera (e.g. a blank title card) keeps the previous camera
    shots.push({ ...s, camera: s.camera || shots[i - 1]?.camera, index: i, ft0: ft, wt0: wt });
    ft += s.dur; wt += s.dur;
  }
  return { shots, duration: ft };
}

export function shotAt(shots, ft) {
  for (let i = shots.length - 1; i >= 0; i--) if (ft >= shots[i].ft0) return shots[i];
  return shots[0];
}

function makePaper(W, H, palette, seed, grainAmt) {
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = palette.paper; g.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const r = rng(seed);
  const sc = 1080 / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const m = fbm(x * sc * 0.004, y * sc * 0.004, 3) * 10 + fbm(x * sc * 0.05, y * sc * 0.05, 2) * 4;
    const n = (r() - 0.5) * 7 + m;
    const v = n * grainAmt;
    d[i] = clamp(d[i] + v, 0, 255); d[i + 1] = clamp(d[i + 1] + v, 0, 255); d[i + 2] = clamp(d[i + 2] + v * 1.1, 0, 255);
  }
  g.putImageData(img, 0, 0);
  // speckle used to break up solid ink a touch ('screen' blend)
  const s = createCanvas(W, H), sg = s.getContext('2d');
  sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
  const si = sg.getImageData(0, 0, W, H), sd = si.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const v = Math.max(0, fbm(x * sc * 0.02, y * sc * 0.02, 3, 4) * 120 + (r() - 0.5) * 60);
    sd[i] = sd[i + 1] = sd[i + 2] = v; sd[i + 3] = 255;
  }
  sg.putImageData(si, 0, 0);
  return { paper: c, speckle: s };
}

function hash2(a, b) { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/**
 * Draw ground strands as variable-width ribbons into one Path2D.
 */
function drawStrands(g, view, strands, o) {
  const { W, H, f } = view;
  const [px, py, pz] = view.cam.pos;
  const R = view.R, U = view.U, F = view.F;
  const near = 0.12, margin = 30;
  const pen = o.pen, minSp = o.minSp;
  const RhL = Math.hypot(R[0], R[2]) || 1, FhL = Math.hypot(F[0], F[2]) || 1;
  const Rh0 = R[0] / RhL, Rh2 = R[2] / RhL, Fh0 = F[0] / FhL, Fh2 = F[2] / FhL;
  const xs = new Float32Array(8192), ys = new Float32Array(8192), ws = new Float32Array(8192);
  const path = new (o.Path2D)();
  let count = 0;

  const flush = (n) => {
    if (n < 2) return;
    // bbox cull
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let i = 0; i < n; i++) { if (xs[i] < minx) minx = xs[i]; if (xs[i] > maxx) maxx = xs[i]; if (ys[i] < miny) miny = ys[i]; if (ys[i] > maxy) maxy = ys[i]; }
    if (maxx < -margin || minx > W + margin || maxy < -margin || miny > H + margin) return;
    // left side
    let lx0 = 0, ly0 = 0;
    const L = [], Rr = [];
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? i - 1 : i, b = i < n - 1 ? i + 1 : i;
      let tx = xs[b] - xs[a], ty = ys[b] - ys[a];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const hw = ws[i] * 0.5;
      L.push(xs[i] - ty * hw, ys[i] + tx * hw);
      Rr.push(xs[i] + ty * hw, ys[i] - tx * hw);
    }
    path.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) path.lineTo(L[i], L[i + 1]);
    for (let i = Rr.length - 2; i >= 0; i -= 2) path.lineTo(Rr[i], Rr[i + 1]);
    path.closePath();
    count++;
  };

  for (let si = 0; si < strands.length; si++) {
    const s = strands[si];
    const P = s.pts, np = P.length / 3;
    // cheap reject: first/mid/last point far behind or beyond fade
    const boilR = o.boil ? hash2(si, o.boilFrame) - 0.5 : 0;
    const boilW = o.boil ? 1 + (hash2(si * 7 + 3, o.boilFrame) - 0.5) * 0.25 : 1;
    let n = 0;
    const feel = o.feel, Tq = (o.boilFrame || 0) / 12;
    for (let k = 0; k < np; k++) {
      let x = P[k * 3], z = P[k * 3 + 1];
      let w = P[k * 3 + 2];
      if (s.flow) { // water: dashes that travel downstream
        const ph = ((k * 0.6 - o.time * s.flow) / s.dash + s.seed * 7.3) % 1, m = ph < 0 ? ph + 1 : ph;
        w *= smoothstep(0, 0.18, m) * smoothstep(0.78, 0.5, m);
      }
      if (o.motion && !s.flow) { // the land moves by itself: waves of wind travelling through the lines
        const M = o.motion, d = (M.dir ?? 90) * DEG;
        const kb1 = Math.min(np - 1, k + 1), ka1 = Math.max(0, k - 1);
        const tx1 = P[kb1 * 3] - P[ka1 * 3], tz1 = P[kb1 * 3 + 1] - P[ka1 * 3 + 1], tl1 = Math.hypot(tx1, tz1) || 1;
        const along = x * Math.sin(d) + z * Math.cos(d);
        const off = (M.amp ?? 0.25) * Math.sin((2 * Math.PI * (along - (M.speed ?? 2) * o.time)) / (M.length ?? 14)) * (0.6 + 0.4 * noise3(x * 0.04, z * 0.04, 2.2));
        x += (-tz1 / tl1) * off; z += (tx1 / tl1) * off;
      }
      if (feel) { // emotional geometry: the world's lines respond to feeling (always a function of place + time: stable)
        const kb0 = Math.min(np - 1, k + 1), ka0 = Math.max(0, k - 1);
        let tx0 = P[kb0 * 3] - P[ka0 * 3], tz0 = P[kb0 * 3 + 1] - P[ka0 * 3 + 1]; const tl0 = Math.hypot(tx0, tz0) || 1;
        const nx0 = -tz0 / tl0, nz0 = tx0 / tl0;
        let off = 0;
        if (feel.flow) off += feel.flow * 0.4 * noise3(x * 0.05 - Tq * 0.2, z * 0.05, Tq * 0.1);
        if (feel.agitation) { off += feel.agitation * (0.09 * noise3(x * 0.8, z * 0.8, Tq * 2.5) + 0.04 * noise3(x * 3, z * 3, Tq * 5)); w *= 1 + feel.agitation * 0.5 * noise3(x * 0.5, z * 0.5, Tq * 3); }
        x += nx0 * off; z += nz0 * off;
        if (feel.pull && feel.points) for (const [px2, pz2] of feel.points) {
          const dx = px2 - x, dz = pz2 - z, d = Math.hypot(dx, dz) + 1e-3;
          const amt = feel.pull * Math.min(d * 0.3, 3.5) * Math.exp(-d / (feel.reach ?? 30));
          x += (dx / d) * amt; z += (dz / d) * amt;
        }
      }
      const dx = x - px, dy = -py, dz = z - pz;
      const cz = dx * F[0] + dy * F[1] + dz * F[2];
      const hd = Math.hypot(dx, dz);
      let fade = hd > o.fadeNear ? 1 - smoothstep(o.fadeNear, o.fadeFar, hd) : 1;
      if (o.reveal) fade *= o.reveal(x, z);
      if (cz < near || fade <= 0.003 || w <= 0.003) { flush(n); n = 0; continue; }
      const cx = dx * R[0] + dy * R[1] + dz * R[2];
      const cy = dx * U[0] + dy * U[1] + dz * U[2];
      const sx = W / 2 + (f * cx) / cz, sy = H / 2 - (f * cy) / cz;
      // line LOD from on-screen spacing of neighbouring contour levels
      const kb = Math.min(np - 1, k + 1), ka = Math.max(0, k - 1);
      let tx = P[kb * 3] - P[ka * 3], tz = P[kb * 3 + 1] - P[ka * 3 + 1];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nX = -tz, nZ = tx; // ground normal of the line
      const rayLen = Math.sqrt(cz * cz + cx * cx + cy * cy);
      const sinG = clamp(py / rayLen, 0.02, 1);
      const nr = nX * Rh0 + nZ * Rh2, nv = nX * Fh0 + nZ * Fh2;
      const spPx = (s.sp * f / cz) * Math.sqrt(nr * nr + nv * nv * sinG * sinG);
      const need = Math.log2(minSp / Math.max(1e-4, spPx));
      const lod = need <= -1 ? 1 : smoothstep(need - 1.2, need + 0.4, s.imp + 0.5);
      if (lod <= 0.004) { flush(n); n = 0; continue; }
      // on-screen gap between surviving lines: tone is coverage of that gap (tonal art map idea)
      const kept = spPx * Math.pow(2, clamp(need, 0, s.imp));
      const depthF = clamp(Math.pow(o.zRef / cz, o.depthPow), 0.14, 2.6);
      const cov = Math.min(1.15, w) * o.coverage;
      let wp = (cov * kept + pen * 0.3 * depthF * Math.min(1, w * 3)) * lod * fade * boilW;
      wp = Math.min(wp, kept * 1.02 + 0.4, pen * o.maxPen * clamp(depthF, 0.6, 2.6));
      if (o.minPx) wp = Math.max(wp, o.minPx * Math.min(1, w * 1.6) * lod * fade);
      if (wp < 0.02) { flush(n); n = 0; continue; }
      const bx = sx + (o.boil ? boilR * o.boil * -tz : 0), by = sy + (o.boil ? boilR * o.boil * tx : 0);
      // subdivide long screen segments so near lines stay smooth
      if (n > 0) {
        const L = Math.hypot(bx - xs[n - 1], by - ys[n - 1]);
        if (L > 14 && n > 1) {
          const m = Math.min(12, Math.ceil(L / 10));
          const x0 = xs[n - 2], y0 = ys[n - 2], x1 = xs[n - 1], y1 = ys[n - 1], w1 = ws[n - 1];
          // extrapolate the next point for catmull tangent
          const x3 = bx + (bx - x1) * 0.5, y3 = by + (by - y1) * 0.5;
          for (let j = 1; j < m; j++) {
            const t = j / m, t2 = t * t, t3 = t2 * t;
            xs[n] = 0.5 * (2 * x1 + (-x0 + bx) * t + (2 * x0 - 5 * x1 + 4 * bx - x3) * t2 + (-x0 + 3 * x1 - 3 * bx + x3) * t3);
            ys[n] = 0.5 * (2 * y1 + (-y0 + by) * t + (2 * y0 - 5 * y1 + 4 * by - y3) * t2 + (-y0 + 3 * y1 - 3 * by + y3) * t3);
            ws[n] = lerp(w1, wp, t);
            n++;
            if (n >= 8000) { flush(n); n = 0; }
          }
        }
      }
      xs[n] = bx; ys[n] = by; ws[n] = wp; n++;
      if (n >= 8000) { flush(n); xs[0] = bx; ys[0] = by; ws[0] = wp; n = 1; }
    }
    flush(n);
  }
  g.fillStyle = o.color;
  g.fill(path, 'nonzero');
  return count;
}

function trailStrands(actor, wt, seed) {
  const route = actor.trailRoute(wt);
  if (!route || route.length < 3) return [];
  const done = actor.trailEnd != null && wt >= actor.trailEnd;
  const out = [];
  const offs = [-0.3, -0.12, 0.05, 0.24];
  const total = route.length;
  offs.forEach((off, li) => {
    const arr = [];
    for (let i = 0; i < total; i++) {
      const a = route[Math.max(0, i - 1)], b = route[Math.min(total - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const [x, z] = route[i];
      const wob = 0.07 * noise3(x * 0.35, z * 0.35, li * 3.7 + seed) + 0.025 * noise3(x * 1.7, z * 1.7, li + seed);
      const o = off + wob;
      const fromStart = i * 0.18, toEnd = (total - 1 - i) * 0.18;
      const w = (0.55 + 0.3 * noise3(x * 0.2, z * 0.2, li + seed)) * smoothstep(0, 2.5, fromStart) * smoothstep(0, done ? 2.5 : 0.9 + li * 0.15, toEnd);
      arr.push(x - tz * o, z + tx * o, w);
    }
    out.push({ pts: Float32Array.from(arr), sp: 0.16, imp: 6, seed: li });
  });
  return out;
}

export function createRenderer(film0, { W, H, cacheDir, log = () => {}, Path2D }) {
  let film = film0;
  const palette = { ...DEFAULT_PALETTE, ...(film.palette || {}) };
  const style = { ...DEFAULT_STYLE, ...(film.style || {}), sun: { ...DEFAULT_STYLE.sun, ...(film.style?.sun || {}) } };
  const seed = film.seed ?? 7;
  // a film can have several worlds (sets); each shot names one. `film.set` alone is the set 'main'.
  const sets = film.sets || { main: film.set || {} };
  const defaultSet = film.sets ? Object.keys(film.sets)[0] : 'main';
  const terrains = new Map();
  const terrainFor = (name) => { if (!terrains.has(name)) terrains.set(name, buildTerrain(sets[name] || {}, { cacheDir, seed, log })); return terrains.get(name); };
  const terrain = terrainFor(defaultSet);
  const setOf = (shot) => shot.set || defaultSet;
  const riversOf = new Map();
  const riversFor = (name) => { if (!riversOf.has(name)) riversOf.set(name, (sets[name]?.rivers || []).map((r) => ({ r, geo: riverGeometry(r) }))); return riversOf.get(name); };
  // background life a set asked for (passers-by, flocks): generated, seeded, marked bg
  if (Object.values(sets).some((st) => st.life)) film = { ...film, cast: { ...lifeCast(film), ...(film.cast || {}) } };
  const world = compileWorld(film);
  // music: detect beats; optionally move cuts onto them (film.music = { file, snapCuts: true | 'bar' })
  let beats = null;
  if (film.music?.file) {
    const base = cacheDir ? path.dirname(cacheDir) : '.';
    try { beats = detectBeats(path.resolve(base, film.music.file), cacheDir); } catch (e) { log(`  music: ${e.message}`); }
    if (beats && film.music.snapCuts) film = { ...film, shots: snapShots(film.shots, beats.beats.map((b) => b - (film.music.at ?? 0)), { every: film.music.snapCuts === 'bar' ? 4 : 1 }) };
  }
  const compiled = compileFilm(film);
  const shots = compiled.shots;
  // seamless loop: the content runs `crossfade` seconds past the end, and that tail is blended into the head
  const loopCF = film.loop ? (film.loop.crossfade ?? 1.5) : 0;
  const duration = compiled.duration - loopCF;
  const scale = H / 1080;
  const tex = makePaper(W, H, palette, seed, style.grain);
  // paper textures per season tone (made lazily, cached)
  const papers = new Map([[palette.paper, tex.paper]]);
  const paperFor = (col) => { if (!papers.has(col)) papers.set(col, makePaper(W, H, { ...palette, paper: col }, seed, style.grain).paper); return papers.get(col); };
  // a shot's mood: its own season/mood, else its set's mood
  const seasonOf = (shot) => (shot._season !== undefined ? shot._season : (shot._season = resolveSeason(shot.season ?? shot.mood ?? sets[setOf(shot)]?.mood, film)));
  const PAL_KEYS = ['paper', 'ink', 'line', 'pane', 'cloud', 'star', 'moon', 'sky', 'accent', 'lamp', 'sunColor', 'water', 'fire', 'fire2', 'fireCore', 'smoke'];
  // a shot's mood may also change across it: season: { from: 'night', to: 'dawn', start, end, ease }
  const moodAt = (shot, t) => {
    const spec = shot.season ?? shot.mood ?? sets[setOf(shot)]?.mood;
    if (spec && typeof spec === 'object' && spec.from) {
      const u = getEase(spec.ease || 'inOut')(clamp((t / shot.dur - (spec.start ?? 0)) / ((spec.end ?? 1) - (spec.start ?? 0))));
      return blendMoods(resolveSeason(spec.from, film), resolveSeason(spec.to, film), u);
    }
    return seasonOf(shot);
  };
  // the living look's time of day: shot.light / set.light / film.light, or { from, to, start, end } across a shot
  const lightAt = (shot, t) => {
    const spec = shot.light ?? sets[setOf(shot)]?.light ?? film.light ?? 'dusk';
    if (spec && typeof spec === 'object' && spec.from) {
      const u = getEase(spec.ease || 'inOut')(clamp((t / shot.dur - (spec.start ?? 0)) / ((spec.end ?? 1) - (spec.start ?? 0))));
      return blendLights(resolveLight(spec.from, film), resolveLight(spec.to, film), u);
    }
    return resolveLight(spec, film);
  };
  // COLOUR AS NARRATIVE LANGUAGE
  //  film.colors = { joy: { color, meaning, level: [[wt, v, dur], ...] } } — named motif colours. Any actor/prop/palette
  //    key can use a motif by name. `level` follows STORY time (continuous across cuts): 0 = drained to grey, 1 = full.
  //  shot.grade = { temp: -1..1 (cool..warm), sat: 0..1.5 } — the cinematographer's grade; animatable across the shot.
  //  shot.tint = { moon: ['joy', [0, 0.7]] } — let one colour pass into something else (here, the moon takes the joy).
  const motifs = film.colors || {};
  const PAL_GRADED = ['paper', 'ink', 'line', 'pane', 'cloud', 'sky', 'water', 'lamp', 'moon', 'star'];
  const WARM = '#f2c58f', COOL = '#9fb2d6';
  const satHex = (hex, k) => (k === 1 || !hex ? hex : k < 1 ? mixHex(greyOf(hex), hex, k) : extrapolate(greyOf(hex), hex, k));
  const paletteOf = (shot, t = 0) => {
    const se = moodAt(shot, t); const p = { ...palette };
    if (se) for (const k of PAL_KEYS) if (se[k] != null) p[k] = se[k];
    if (se?.lamp) p.lamp = se.lamp; if (se?.water) p.water = se.water;
    if (se?._paperB) { p._paperA = se._paperA; p._paperB = se._paperB; p._u = se._u; }
    const u = clamp(t / shot.dur), wt = shot.wt0 + t, A = (v) => animParam(v, u, 'inOut');
    // motif colours at this moment of the story
    for (const [name, m] of Object.entries(motifs)) {
      const lv = m.level == null ? 1 : trackValue(m.level, wt);
      // drain: where the colour goes when it is absent — a grey (default) or, with drain 0..1, toward the ink (an accent
      // on a silhouette should sink into it rather than become a bright grey stripe)
      const lo = m.drain ? mixHex(greyOf(m.color), p.ink || '#111111', m.drain) : greyOf(m.color);
      p[name] = mixHex(lo, m.color, clamp(lv, 0, 1.2));
      if (name === 'accent') p.accent = p[name];
    }
    if (shot.accent != null) p.accent = mixHex(greyOf(p.accent), p.accent, clamp(A(shot.accent)));
    // grade: temperature and saturation of the world (motif colours keep their own level: selective saturation)
    if (shot.grade) {
      const temp = A(shot.grade.temp) ?? 0, sat = A(shot.grade.sat) ?? 1;
      for (const k of PAL_GRADED) if (p[k]) {
        let c = satHex(p[k], sat);
        if (temp) c = mixHex(c, temp > 0 ? WARM : COOL, Math.abs(temp) * (k === 'ink' ? 0.15 : 0.55));
        p[k] = c;
      }
      if (p._paperB) { p._paperA = mixHex(satHex(p._paperA, sat), temp > 0 ? WARM : COOL, Math.abs(temp) * 0.55); p._paperB = mixHex(satHex(p._paperB, sat), temp > 0 ? WARM : COOL, Math.abs(temp) * 0.55); }
      p._grade = (c) => { let c2 = satHex(c, sat); if (temp) c2 = mixHex(c2, temp > 0 ? WARM : COOL, Math.abs(temp) * 0.4); return c2; };
      p._wash = temp ? { top: temp > 0 ? '#e9a86a' : '#7b8fc0', topA: Math.abs(temp) * 0.2, bottom: temp > 0 ? '#f3d2a8' : '#b8c6e0', bottomA: Math.abs(temp) * 0.08 } : null;
    }
    // tints: a key takes on a motif colour (or any colour) by an animated amount
    for (const [key, [src, amt]] of Object.entries(shot.tint || {})) p[key] = mixHex(p[key] || p.paper, p[src] || src, clamp(A(amt) ?? 0));
    return p;
  };
  const fps = film.fps ?? 24;
  const fontFamily = film.font || 'Baskerville';

  function baseCam(shot, t) {
    const ctx = { u: clamp(t / shot.dur), t, dur: shot.dur, wt: shot.wt0 + t, wt0: shot.wt0, world, W, H };
    return { cam: shot.camera(ctx), ctx };
  }
  // where something sits on screen in a given shot at a given time (actor, [x,y,z], or 'moon'/'sun')
  function screenOf(shot, t, target, cam) {
    const view = makeView(cam, W, H);
    if (target === 'moon' || target === 'sun') {
      const sk = { ...(sets[setOf(shot)]?.sky || {}), ...(shot.sky || {}) }[target]; if (!sk) return null;
      const az = (sk.relAz != null ? cam.yaw / DEG + sk.relAz : sk.az) * DEG, el = sk.elev * DEG;
      return view.project(cam.pos[0] + Math.sin(az) * Math.cos(el) * 1e4, cam.pos[1] + Math.sin(el) * 1e4, cam.pos[2] + Math.cos(az) * Math.cos(el) * 1e4);
    }
    let p3 = target;
    if (typeof target === 'string') { const a = world.actors[target]; if (!a) return null; const st = a.state(shot.wt0 + t); p3 = st.pos3 || [st.pos[0], (st.y || 0) + (a.def.height ?? 1.7) * 0.6, st.pos[1]]; }
    return view.project(...p3);
  }
  // match cut: turn the incoming camera so its subject lands where the outgoing subject was
  function matchOffset(shot) {
    if (shot._match !== undefined) return shot._match;
    shot._match = null;
    const mc = shot.matchCut, prev = shots[shot.index - 1];
    if (!mc || !prev) return null;
    const pc = baseCam(prev, prev.dur).cam, a = screenOf(prev, prev.dur, mc.from, pc);
    const cc = baseCam(shot, 0).cam, b = screenOf(shot, 0, mc.to, cc);
    if (!a || !b) return null;
    const f = (W * cc.lens) / 36;
    shot._match = { yaw: Math.atan((b[0] - W / 2) / f) - Math.atan((a[0] - W / 2) / f), pitch: -(Math.atan((a[1] - H / 2) / f) - Math.atan((b[1] - H / 2) / f)) };
    return shot._match;
  }
  function cameraAt(shot, t) {
    const r = baseCam(shot, t), m = shot.matchCut ? matchOffset(shot) : null;
    if (m) r.cam = { ...r.cam, yaw: r.cam.yaw + m.yaw * (1 - smoothstep(0, shot.matchCut.release ?? Infinity, t)), pitch: r.cam.pitch + m.pitch * (1 - smoothstep(0, shot.matchCut.release ?? Infinity, t)) };
    return r;
  }

  function revealFn(spec, t, wt) {
    if (!spec) return null;
    const list = Array.isArray(spec) ? spec : [spec];
    const fns = list.map((rv) => {
      const u = getEase(rv.ease || 'out')(clamp((t - (rv.start ?? 0)) / (rv.dur ?? 3)));
      let c = rv.from;
      if (typeof c === 'string') c = world.state(c, wt).pos;
      const r = lerp(rv.r0 ?? 0, rv.radius ?? 300, u);
      const fe = rv.feather ?? 12;
      const inv = rv.mode === 'out';
      return (x, z) => {
        const v = smoothstep(0, fe, r - Math.hypot(x - c[0], z - c[1]));
        return inv ? 1 - v : v;
      };
    });
    return (x, z) => { let v = 1; for (const fn of fns) v *= fn(x, z); return v; };
  }

  let dofLayer = null;
  function drawScene(g, shot, t, opts = {}) {
    const { cam } = cameraAt(shot, t);
    const view = makeView(cam, W, H);
    const wt = shot.wt0 + t;
    const ft = shot.ft0 + t;
    const frameIdx = Math.round(ft * fps);
    const season = moodAt(shot, t);
    let pal = paletteOf(shot, t);
    // depth of field (living look by default, or shot.dof): in a close shot, everything behind the subject is drawn on a
    // layer and softened, so the figure stands forward. shot.dof = false | { px, focus }
    let mainG = null, farLimit = Infinity, dofPx = 0;
    {
      const dset = sets[setOf(shot)] || {}, spec = shot.dof ?? ((dset.look ?? film.look) === 'living' ? {} : null);
      if (spec && !shot.blank) {
        let near = Infinity;
        for (const [nm, a] of Object.entries(world.actors)) {
          const k0 = a.def.kind; if ((k0 && k0 !== 'person') || a.def.bg) continue; // focus is on the story's people
          const st0 = a.state(wt); if (!st0.visible || (st0.set ?? 'main') !== setOf(shot) || shot.hide?.includes(nm)) continue;
          const cz0 = view.toCam(st0.pos[0], (st0.y || 0) + 1.0, st0.pos[1])[2]; if (cz0 > 0.4) near = Math.min(near, cz0);
        }
        const focus = spec.focus ?? 4.5;
        if (near < focus) {
          dofPx = (spec.px ?? 2.6) * scale * clamp((focus - near) / 2.5, 0.35, 1); farLimit = near * 1.8;
          if (!dofLayer) dofLayer = createCanvas(W, H);
          mainG = g; g = dofLayer.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        }
      }
    }
    const flushDof = () => { if (!mainG) return; mainG.save(); mainG.filter = `blur(${dofPx.toFixed(2)}px)`; mainG.drawImage(dofLayer, 0, 0); mainG.restore(); g = mainG; mainG = null; };
    // THE LIVING LOOK: real materials lit by a time of day, ink-silhouette characters (see living.js)
    const lset = sets[setOf(shot)] || {};
    const living = (lset.look ?? film.look) === 'living' && !shot.blank ? lightAt(shot, t) : null; // a blank card stays paper
    let Lv = null, groundBase = null;
    if (living) {
      const sunS0 = { ...style.sun, ...(season?.sun || {}), ...(lset.sun || {}), ...(shot.style?.sun || {}) };
      const sa = sunS0.az * DEG, se = Math.max(4, sunS0.elev) * DEG;
      Lv = makeLiving({ L: living, materials: { ...(film.materials || {}), ...(lset.materials || {}) }, sunDir: [Math.sin(sa) * Math.cos(se), Math.sin(se), Math.cos(sa) * Math.cos(se)], cam: cam.pos, grade: pal._grade || ((c) => c) });
      groundBase = Lv.ground(lset.ground || (lset.boards ? 'floorboard' : 'grass'));
      const waterBase = Lv.pick(lset.materials?.water || 'water');
      pal = { ...pal, _living: Lv, ink: Lv.ink, line: Lv.lineOf(groundBase), paper: Lv.tint(living.skyHorizon),
        water: Lv.tint(mixC(mixC(waterBase, living.skyTop, 0.42), living.skyHorizon, 0.12)), // water is the sky's colour on the material's own blue cloud: Lv.tint(mixC('#ffffff', living.skyHorizon, 0.35)),
        moon: pal.moon || '#f6f1e2', star: pal.star || '#fbf6e8', _wash: null,
        // a window shows the outside light (kept bright enough for a silhouette against it)
        pane: Lv.tint(mixC(mixC(living.skyTop, living.skyHorizon, 0.55), living.ambient < 0.5 ? '#9fb1dc' : '#e9eef6', living.ambient < 0.5 ? 0.32 : 0.15)) };
      if (lset.boards) drawInterior(g, view, Lv, fillPolys3, lset.bounds, { wall: lset.wall, floor: lset.floor, roomH: lset.roomH });
      else drawBackdrop(g, view, Lv, groundBase);
      g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55; g.drawImage(paperFor('#f6f3ee'), 0, 0); g.restore(); // the paper's grain stays
    } else if (pal._paperB) { g.drawImage(paperFor(pal._paperA), 0, 0); g.globalAlpha = pal._u; g.drawImage(paperFor(pal._paperB), 0, 0); g.globalAlpha = 1; }
    else g.drawImage(paperFor(pal.paper), 0, 0);
    if (shot.blank) { if (season) drawWash(g, W, H, season.wash); return view; }

    const set_ = sets[setOf(shot)] || {};
    const sst = { ...(set_.style || {}), ...(shot.style || {}) };
    const pen = (sst.pen ?? style.pen) * scale;
    const common = {
      Path2D, pen, minSp: style.minSpacing * scale, zRef: style.zRef, depthPow: style.depthPow,
      coverage: (sst.coverage ?? style.coverage) * (season?.lineWeight ?? 1), maxPen: sst.maxPen ?? style.maxPen,
      fadeNear: sst.fadeNear ?? style.fadeNear, fadeFar: sst.fadeFar ?? style.fadeFar,
      boil: opts.noBoil ? 0 : (sst.boil ?? style.boil) * scale, boilFrame: frameIdx >> 1, color: pal.ink, time: wt,
      motion: set_.motion ? { ...set_.motion, ...(shot.motion || {}) } : shot.motion || null,
    };
    // emotional geometry (experimental, opt-in per shot): numbers or [from, to] across the shot
    let feel = null;
    if (shot.feel) {
      const A = (v) => animParam(v, clamp(t / shot.dur), 'inOut');
      feel = { flow: A(shot.feel.flow) || 0, agitation: A(shot.feel.agitation) || 0, pull: A(shot.feel.pull) || 0, reach: shot.feel.reach, density: A(shot.feel.density) || 0 };
      feel.points = [].concat(shot.feel.toward || []).map((n) => (typeof n === 'string' ? world.state(n, wt).pos : n));
      common.feel = feel;
      common.coverage *= 1 + feel.density;
      common.boil *= 1 + feel.agitation * 2;
    }
    const reveal0 = revealFn(shot.reveal, t, wt), cover = coverFn(season?.cover);
    const reveal = reveal0 && cover ? (x, z) => reveal0(x, z) * cover(x, z) : reveal0 || cover;
    const setName = setOf(shot), set = sets[setName] || {};
    const shotFeel = shot.feel ? { agitation: animParam(shot.feel.agitation, clamp(t / shot.dur), 'inOut') || 0, flow: animParam(shot.feel.flow, clamp(t / shot.dur), 'inOut') || 0 } : null;
    const inSet = (st) => (st.set ?? 'main') === setName || (!film.sets && true);
    const props = set.props || [];
    // the sky's numbers can change across a shot: the sun breaks through (alpha), sinks (elev), stars come out (starAlpha)
    const skyU = clamp(t / shot.dur), skyA = (v) => (v == null ? v : animParam(v, skyU, 'inOut'));
    let sky = shot.sky ? { ...set.sky, ...shot.sky } : set.sky;
    if (sky) {
      sky = { ...sky, starAlpha: skyA(sky.starAlpha) };
      if (sky.sun) sky.sun = { ...sky.sun, alpha: skyA(sky.sun.alpha), elev: skyA(sky.sun.elev), relAz: skyA(sky.sun.relAz), az: skyA(sky.sun.az) };
    }
    const win = props.find((p) => p.kind === 'window');
    const lineCol = pal.line || pal.ink;
    // cloud actors and set clouds (drawn inside the window pane in a room, or in depth order outside)
    const cloudItems = [];
    for (const [name, a] of Object.entries(world.actors)) {
      if (a.def.kind !== 'cloud' || shot.hide?.includes(name)) continue;
      const st = a.state(wt);
      if (st.visible && inSet(st)) cloudItems.push({ name, c: { ...st, seed: hashStr(name) % 97 }, def: a.def });
    }
    for (const [i, c] of (set.clouds || []).entries()) cloudItems.push({ name: 'set-cloud-' + i, c: { pos3: c.at, heading: (c.heading ?? 90) * DEG, scale: c.scale ?? 1, shape: c.shape || { cumulus: true, seed: c.seed ?? i + 1, w: c.w, h: c.h }, seed: i + 1 }, def: c });
    const drawC = (it) => drawCloud(g, view, it.c, { ...pal, cloud: it.def.fill || pal.cloud }, wt, scale, { pen: it.def.pen, feel: shotFeel });
    if (win) {
      const { pane } = windowGeometry(win);
      const scr = clipProject(view, pane);
      pal._paneScr = scr; // lamplight in the room does not light the sky outside
      if (scr.length >= 3) {
        g.save();
        g.beginPath(); scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
        g.fillStyle = pal.pane || pal.paper; g.fill(); g.clip();
        drawSky(g, view, sky, { ...pal, sky: pal.pane }, wt, scale);
        cloudItems.sort((A, B) => view.toCam(...B.c.pos3)[2] - view.toCam(...A.c.pos3)[2]).forEach(drawC);
        g.restore();
      }
    } else drawSky(g, view, sky, { ...pal, sky: pal.paper }, wt, scale);

    if (Lv) for (const rd of set.roads || []) { // paved roads and paths, in their own material
      if (!rd._geo) rd._geo = riverGeometry({ pts: rd.pts, width: rd.width ?? 3 });
      const base = Lv.pick(rd.material || 'pavement');
      fillPolys3(g, view, waterBand(rd._geo, 0, 1), Lv.lit(base, 0.7, 25));
    }
    const rivers = riversFor(setName);
    for (const { r, geo } of rivers) {
      // things on the banks are reflected; lamps become streaks of light on the water
      const near = (p) => { const at = p.at || (p.pts ? p.pts[0] : null); if (!at) return false; let d = Infinity; for (const q of geo.left.concat(geo.right)) d = Math.min(d, Math.hypot(at[0] - q[0], at[at.length === 3 ? 2 : 1] - q[1])); return d < (r.reflectReach ?? 30); };
      const reflect = r.reflect === false ? [] : props.filter((p) => ['bridge', 'lamppost', 'tree', 'house', 'buildings', 'fence', 'tower', 'pillar', 'arch'].includes(p.kind) && near(p));
      const lamps = r.reflect === false ? [] : props.filter((p) => p.kind === 'lamppost').map((p) => ({ at: [p.at[0], (p.h ?? 3.4) - 0.15, p.at[1]], color: pal[p.color] || pal.lamp || '#f0d9a2' }));
      drawWaterFill(g, view, geo, pal[r.fill || 'water'] || mixHex(pal.paper, pal.line || pal.ink, 0.07),
        { rich: r.rich !== false, time: wt, flow: r.flow ?? 0.7, pal, reflect, lamps, scale, light: pal[r.light] || (Lv ? mixC(Lv.tint(living.skyHorizon), '#ffffff', 0.35) : mixHex(pal.paper, '#ffffff', 0.5)) });
    }
    const terrainAlpha = shot.terrainAlpha != null ? (typeof shot.terrainAlpha === 'function' ? shot.terrainAlpha(t / shot.dur) : shot.terrainAlpha) : 1;
    if (terrainAlpha > 0) {
      g.globalAlpha = terrainAlpha;
      drawStrands(g, view, terrainFor(setName).strands, { ...common, color: lineCol, reveal });
      g.globalAlpha = 1;
    }
    for (const { geo } of rivers) drawStrands(g, view, geo.strands, { ...common, color: Lv ? mixC(pal.water, Lv.ink, 0.3) : lineCol, coverage: 0.2, maxPen: 1.2, minPx: 0.5 * scale, feel: common.feel ? { ...common.feel, pull: 0 } : null });
    if (win && sky?.moon && trackValue(set.moonlight ?? 0.22, wt) > 0.01) drawMoonPatch(g, view, win, sky, pal, trackValue(set.moonlight ?? 0.22, wt));
    // trails
    for (const [name, a] of Object.entries(world.actors)) {
      if (a.trailStart == null) continue;
      const tr = trailStrands(a, wt, (hashStr(name) % 1000) / 37);
      if (tr.length) drawStrands(g, view, tr, { ...common, color: lineCol, coverage: style.trailCoverage ?? 0.22, maxPen: 1.5, minPx: 0.9 * scale, reveal: null });
    }
    // everything that stands in the world, painted far to near
    const sunS = { ...style.sun, ...(season?.sun || {}), ...(shot.style?.sun || {}) }; // light may be cheated per shot
    const sun = { az: sunS.az * DEG, elev: sunS.elev * DEG };
    const vis = (name) => shot.hide?.includes(name) ? 0 : 1;
    const figAlpha = (name) => { const fi = shot.figureIn?.[name]; return fi ? smoothstep(fi[0], fi[1], t) : 1; };
    const items = [];
    const anchors = {}, threads = [], strings = [];
    for (const [name, a] of Object.entries(world.actors)) {
      if (a.def.kind === 'cloud') continue;
      if (a.def.kind === 'thread') { const st = a.state(wt); if (st.visible && inSet(st)) threads.push({ name, a, st }); continue; }
      const st = a.state(wt);
      if (!st.visible || !inSet(st) || !vis(name)) continue;
      const p3 = st.pos3 || [st.pos[0], st.y || 0, st.pos[1]];
      let cz = view.toCam(p3[0], p3[1] + 0.5, p3[2])[2];
      if (cz < 0.1) continue;
      if (opts.noFigures && (!a.def.kind || a.def.kind === 'person')) continue;
      if (st.riding) cz += 0.8; // a rider sits *in* the cloud: draw them first, the cloud over their legs
      if (st.tucked) cz -= st.sitOn === 'bed' ? 1.2 : -1.2; // in bed: drawn over the bed, with the blanket over her legs
      if (st.sit > 0.5 && !st.tucked) cz -= 0.5; // seated on something: drawn after the seat
      items.push({ cz, kind: 'fig', name, a, st });
    }
    if (!win) for (const it of cloudItems) { const cz = view.toCam(...it.c.pos3)[2]; if (cz > 0.3) items.push({ cz, kind: 'cloud', it }); }
    for (const p of props) {
      const pa = p.at || (p.pts ? p.pts.reduce((a, q) => [a[0] + q[0] / p.pts.length, a[1] + q[1] / p.pts.length], [0, 0]) : [0, 0]); // fences: their middle
      const at = pa.length === 3 ? pa : [pa[0], 0, pa[1]];
      // big props sort by their far edge, so a figure standing in front of a bench or bed is drawn over it
      const ext = 0.45 * Math.max(p.len ?? 0, p.w ?? 0, p.d ?? 0, p.kind === 'tree' ? 0.6 : 0.4);
      if (p.kind === 'fence' && p.pts?.length > 1) { // long fences are layered piece by piece (about 3 m), so a person standing
        for (let i = 0; i < p.pts.length - 1; i++) {   // beside one end is not covered by the whole fence
          const [x0, z0] = p.pts[i], [x1, z1] = p.pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 3));
          for (let k = 0; k < n; k++) {
            const a0 = [x0 + (x1 - x0) * (k / n), z0 + (z1 - z0) * (k / n)], a1 = [x0 + (x1 - x0) * ((k + 1) / n), z0 + (z1 - z0) * ((k + 1) / n)];
            items.push({ cz: view.toCam((a0[0] + a1[0]) / 2, (p.h ?? 1) / 2, (a0[1] + a1[1]) / 2)[2], kind: 'prop', p: { ...p, pts: [a0, a1], gap: L / n / Math.max(1, Math.round(L / n / (p.gap ?? 1.4))) } });
          }
        }
        continue;
      }
      if (p.kind === 'bridge') { // two parts: deck + far rail behind the people on it, near rail in front of them
        const yw = (p.yaw ?? 0) * DEG, sd = [Math.sin(yw), 0, Math.cos(yw)], hw = (p.w ?? 1.8) / 2;
        const eN = Math.sign((view.cam.pos[0] - at[0]) * sd[0] + (view.cam.pos[2] - at[2]) * sd[2]) || 1;
        items.push({ cz: view.toCam(at[0], at[1], at[2])[2] + ext, kind: 'prop', p: { ...p, part: 'far', eNear: eN } });
        const nr = view.toCam(at[0] + sd[0] * hw * eN, (p.rise ?? 1.2) + 0.5, at[2] + sd[2] * hw * eN)[2];
        items.push({ cz: nr - 0.05, kind: 'prop', p: { ...p, part: 'near', eNear: eN } });
        continue;
      }
      items.push({ cz: view.toCam(at[0], at[1], at[2])[2] + ext + (p.kind === 'window' ? 0.5 : 0), kind: 'prop', p });
    }
    items.sort((A, B) => B.cz - A.cz);
    if (set.shadows !== false) for (const F of items) {
      if (F.kind !== 'fig' || F.st.riding || !['person', 'bird', undefined].includes(F.a.def.kind)) continue;
      g.globalAlpha = figAlpha(F.name) * (Lv ? living.shadow : season?.shadowAlpha ?? 1);
      drawShadow(g, view, F.a.def, F.st, sun, Lv ? pal.line : pal.ink);
      g.globalAlpha = figAlpha(F.name);
      if (F.a.def.kind !== 'bird' && !F.st.tucked) drawContactShadow(g, view, F.a.def, { ...F.st, ground: world.heightAt?.(F.st.set, F.st.pos[0], F.st.pos[1]) ?? 0 }, Lv ? pal.line : pal.ink, Lv ? 0.42 : 0.3);
    }
    g.globalAlpha = 1;
    for (const p of props) drawPropGlow(g, view, p, pal, wt, scale, shotFeel); // light first: silhouettes stand against it
    // the lights of the story, for rim light on the figures
    const storyLights = [];
    {
      const emit = Lv ? Lv.emit : 1, warm = Lv ? Lv.M.lampLight : (pal.lamp || '#f0c674');
      for (const p of props) {
        if (p.kind === 'lamppost') { const on = trackValue(p.on ?? 1, wt) * emit; if (on > 0.05) storyLights.push({ pos: [p.at[0], (p.h ?? 3.4) - 0.2, p.at[1]], color: Lv ? mixC(pal[p.color] || pal.lamp || warm, warm, 0.6) : pal[p.color] || warm, strength: 0.7 * on, reach: 7 }); }
        if (p.kind === 'lamp') { const on = trackValue(p.on ?? 1, wt); if (on > 0.05) storyLights.push({ pos: [p.at[0], p.at[1] + 0.3, p.at[2]], color: pal[p.color] || pal.accent || warm, strength: 0.75 * on, reach: 3.5 }); }
        if (p.fire) { const at = p.at || [0, 0], lv = fireLevel(p.fire, at[0], at[1], wt); if (lv > 0.05) storyLights.push({ pos: [at[0], (p.h ?? 6) * 0.8, at[1]], color: pal.fire2 || '#f0832c', strength: 0.95 * lv, reach: 40 }); }
      }
      for (const [nm, a] of Object.entries(world.actors)) {
        const d0 = a.def;
        if (d0.carry?.kind === 'torch' || d0.tailFire || d0.kind === 'lantern') {
          const st0 = a.state(wt); if (!st0.visible || (st0.set ?? 'main') !== setName) continue;
          const lv = d0.kind === 'lantern' ? 1 : d0.tailFire && !d0.carry ? trackValue(d0.tailFire, wt) : 1;
          const p3 = st0.pos3 || [st0.pos[0], (st0.y || 0) + (d0.height ?? 1.7) * 0.9, st0.pos[1]];
          if (lv > 0.05) storyLights.push({ pos: p3, color: d0.kind === 'lantern' ? (pal[d0.color] || pal.accent) : pal.fire2 || '#f0832c', strength: 0.8 * lv, reach: d0.kind === 'lantern' ? 3 : 4, from: nm });
        }
      }
    }
    const anchorOf = (n) => {
      if (Array.isArray(n)) return n;
      if (anchors[n]) return anchors[n];
      const a = world.actors[n]; if (!a) return null;
      const st = a.state(wt);
      return a.def.kind === 'person' || !a.def.kind ? handApprox(a.def, st) : st.pos3 || [st.pos[0], 0, st.pos[1]];
    };
    const drawStringOf = ({ F, bridle }) => {
      const st = F.st, kd = F.a.def.kind, w = st.wind;
      if (st.held) {
        const h0 = anchorOf(st.held);
        // a kite brought down lies on the land: its string sags onto the ground
        const gy = st.grounded ? (world.heightAt?.(F.a.def.set ?? shot.set, bridle[0], bridle[2]) ?? 0) + 0.02 : null;
        drawThread(g, view, h0, bridle, { sag: kd === 'kite' ? (st.grounded ? 0.12 : 0.035) : 0.01, wind: w, time: wt, width: 1.1, color: pal.ink, seed: 3, scale, floor: gy });
        // a second holder keeps hold of the other end: one string, through both their hands. Slack, it lies on the
        // land; tugs travel along it from whoever pulled.
        const h1 = st.holders?.[1];
        if (h1) drawThread(g, view, anchorOf(h1), h0, { sag: st.slack ?? 0.12, wind: w, time: wt, width: F.a.def.shareWidth ?? 1.3, color: pal[F.a.def.shareColor || 'ink'] || F.a.def.shareColor, seed: 9, scale,
          floor: 0.02, pulses: (st.tugs || []).map((q) => ({ t: q.t, amp: q.amp, fromA: q.who === h1 })), speed: F.a.def.tugSpeed ?? 15 });
      } else if (st.free) {
        // the string trails below; as a catch approaches, its end swings into the catcher's hand
        const L = Math.min(st.length, 6);
        let end = [bridle[0] - w.x * L * 0.3, bridle[1] - L * 0.8, bridle[2] - w.z * L * 0.3];
        if (st.catcher && st.toCatch < 1.4) {
          const hc = anchorOf(st.catcher), u = smoothstep(1.4, 0, st.toCatch);
          if (hc) end = end.map((v, k) => lerp(v, hc[k], u));
        }
        drawThread(g, view, bridle, end, { sag: -0.05, wind: w, time: wt, width: 1, color: pal.ink, seed: 5, scale });
      }
    };
    const drawThreadOf = (T) => {
      const A = anchorOf(T.st.link.a), B = anchorOf(T.st.link.b);
      if (A && B) drawThread(g, view, A, B, { sag: T.a.def.sag ?? 0.05, wind: windAt(shot.air || film.air, wt), time: wt, width: T.a.def.width ?? 1.4,
        color: pal[T.a.def.color || 'ink'] || T.a.def.color, grow: T.st.grow, seed: 7, scale });
    };
    // LAYERING RULE for strings and threads: a string is drawn right after the nearer of its ends (the later one in the
    // far-to-near order), so anything in front of both ends — a rail, a fence, a person — covers it, and anything
    // behind is covered by it. Ends that are fixed points or not in this frame count as already drawn.
    const drawnNow = new Set(), inFrame = new Set(items.filter((I) => I.kind === 'fig').map((I) => I.name));
    const pendingStrings = [];
    for (const T of threads) pendingStrings.push({ ends: [T.st.link.a, T.st.link.b].filter((n) => typeof n === 'string'), draw: () => drawThreadOf(T) });
    const settleStrings = () => { for (let i = pendingStrings.length - 1; i >= 0; i--) if (pendingStrings[i].ends.every((n) => drawnNow.has(n) || !inFrame.has(n))) pendingStrings.splice(i, 1)[0].draw(); };
    // who is carrying what this frame (small things ride in the hand; kites and balloons fly on strings)
    const carriedBy = {};
    for (const F of items) if (F.kind === 'fig' && ['lantern', 'ball', 'flower', 'object'].includes(F.a.def.kind) && F.st.held && items.some((G) => G.kind === 'fig' && G.name === F.st.held)) (carriedBy[F.st.held] ||= []).push(F);
    for (const F of items) {
      settleStrings();
      if (F.kind === 'fig') drawnNow.add(F.name);
      if (mainG && (F.cz < farLimit || (F.kind === 'fig' && !F.a.def.bg && (!F.a.def.kind || F.a.def.kind === 'person')))) flushDof(); // story characters are always sharp
      if (F.kind === 'cloud') { drawC(F.it); continue; }
      if (F.kind === 'prop') { drawProp(g, view, F.p, pal, wt, wt, scale, shotFeel); continue; }
      g.globalAlpha = figAlpha(F.name);
      const kd = F.a.def.kind;
      if (kd === 'bird') drawBird(g, view, F.a.def, F.st, wt, pal);
      else if (['kite', 'balloon', 'lantern', 'ball', 'flower', 'object'].includes(kd)) {
        // things carried in a hand are drawn with the person holding them, at the hand as drawn (see below)
        if (['lantern', 'ball', 'flower', 'object'].includes(kd) && F.st.held && carriedBy[F.st.held]) continue;
        const holder = F.st.held ? anchors[F.st.held] || handApprox(world.def(F.st.held), world.state(F.st.held, wt)) : null;
        const r = drawObject(g, view, F.a.def, F.st, pal, wt, scale, holder);
        anchors[F.name] = r.bridle;
        if (kd === 'kite' || kd === 'balloon') pendingStrings.push({ ends: [F.name, F.st.held, F.st.holders?.[1]].filter(Boolean), draw: () => drawStringOf({ F, bridle: r.bridle }) });
      } else {
        // rim light (living look): from the nearest lit lamp, else from the sun / moon — low light makes the strongest rim
        // rim light: the strongest nearby story light (a lamppost, a lamp, fire, a torch, a lantern) — in either look —
        // else, in the living look, the sun or moon (low light makes the strongest rim)
        let rimO = null;
        if ((film.rim ?? lset.rim) !== false && F.a.def.rim !== false) {
          const [fx, fz] = F.st.pos; let best = null;
          for (const L0 of storyLights) { const d = Math.hypot(L0.pos[0] - fx, L0.pos[2] - fz), sc = L0.strength * Math.pow(Math.max(0, 1 - d / L0.reach), 0.6); if (sc > 0.03 && (!best || sc > best.sc)) best = { sc, L0 }; }
          if (best) rimO = { at: () => best.L0.pos, color: mixC(best.L0.color, '#ffffff', 0.15), strength: Math.min(0.85, best.sc) };
          else if (Lv) {
            const sd = [Math.sin(sun.az) * Math.cos(sun.elev), Math.sin(sun.elev), Math.cos(sun.az) * Math.cos(sun.elev)];
            rimO = { at: (c3) => [c3[0] + sd[0] * 60, c3[1] + sd[1] * 60, c3[2] + sd[2] * 60], color: mixC(Lv.tint(living.sun), '#ffffff', 0.15), strength: 0.55 * clamp(1 - (sun.elev / DEG) / 50, 0.15, 1) };
          }
        }
        // touch targets: a point, someone ('name'), their head ('name:head') or hand ('name:hand')
        const resolveT = (gs) => {
          if (!gs || gs.name !== 'touch' || gs.target == null) return gs;
          let tp = gs.target;
          if (typeof tp === 'string') {
            const [who, part] = tp.split(':'), oa = world.actors[who]; if (!oa) return gs;
            const os = oa.state(wt), od = oa.def;
            if (part === 'hand') tp = anchors[who] || handApprox(od, os);
            else tp = os.pos3 || [os.pos[0], (os.y || 0) + (od.height ?? 1.7) * (part === 'head' ? 0.92 : 0.74) * (os.scale ?? 1), os.pos[1]];
          }
          return { ...gs, targetPos: tp };
        };
        if (F.st.gesture?.name === 'touch' || F.st.gesture2?.name === 'touch') F.st = { ...F.st, gesture: resolveT(F.st.gesture), gesture2: resolveT(F.st.gesture2) };
        const bl = F.a.def.blanket;
        const blanket = bl ? (Lv ? Lv.lit(Lv.pick(bl), 0.6, 3) : pal[bl] || bl) : null;
        const r = drawPerson(g, view, F.a.def, F.st, wt, pal, style.wind * (season?.weather?.wind ?? 1) * clamp(windAt(shot.air || film.air, wt).speed / 3, 0.5, 3), { rim: rimO, blanket, tonal: F.a.def.tonal === false ? false : ({ tonal: true, silhouette: false }[lset.figures ?? film.figures] ?? 'auto') }); // figures: 'auto' (tonal in close shots, default) · 'tonal' · 'silhouette'
        if (r?.hand) anchors[F.name] = r.hand;
        for (const O of carriedBy[F.name] || []) { // carried things: exactly at the drawn hand (eased in for a moment after a pick-up)
          const hnd = O.a.def.hand === 'far' ? r?.hand2 || r?.hand : r?.hand; if (!hnd) continue;
          const at = [hnd[0], hnd[1] - (O.a.def.hang ?? 0.02), hnd[2]], u = smoothstep(0, 0.6, O.st.since ?? 1);
          const p3 = O.st.pos3.map((v, i) => lerp(v, at[i], u));
          const ro = drawObject(g, view, O.a.def, { ...O.st, pos3: p3, pos: [p3[0], p3[2]] }, pal, wt, scale, hnd);
          anchors[O.name] = ro.bridle; drawnNow.add(O.name);
        }
        if (F.st.speaking > 0.02) { // a speech mark: three small arcs beside the head, breathing with the words
          const H0 = (F.a.def.height ?? 1.75) * (F.st.scale ?? 1), hp = view.project(F.st.pos[0], (F.st.y || 0) + H0 * 0.93, F.st.pos[1]);
          if (hp) {
            const ppm = view.f / hp[2], side = Math.sin(F.st.heading - Math.atan2(F.st.pos[0] - view.cam.pos[0], F.st.pos[1] - view.cam.pos[2])) >= 0 ? 1 : -1;
            g.save(); g.strokeStyle = pal.ink; g.lineCap = 'round'; g.lineWidth = Math.max(1, ppm * 0.012); g.globalAlpha = F.st.speaking * 0.75;
            for (let k = 0; k < 3; k++) { const rr = ppm * (0.07 + k * 0.045) * (1 + 0.08 * Math.sin(wt * 8 + k)); g.beginPath(); g.arc(hp[0] + side * ppm * 0.1, hp[1], rr, side > 0 ? -0.6 : Math.PI - 0.6, side > 0 ? 0.6 : Math.PI + 0.6); g.stroke(); }
            g.restore();
          }
        }
        // fire carried by a figure: a burning tail tip, a torch
        const d0 = F.a.def, wnd = windAt(shot.air || film.air, wt);
        if (r?.tailTip && d0.tailFire) drawFlame(g, view, r.tailTip, 0.75 * (F.st.scale ?? 1), trackValue(d0.tailFire, wt), wt, 3, pal, { smoke: 0.5, wind: wnd.x * 0.5, scale });
        if (r?.carryTip && d0.carry?.kind === 'torch') drawFlame(g, view, r.carryTip, 0.42, d0.carry.fire != null ? trackValue(d0.carry.fire, wt) : 1, wt, 11 + (d0.seed ?? 0), pal, { wind: wnd.x * 0.4, scale });
      }
      g.globalAlpha = 1;
    }
    settleStrings();
    // whatever strings are still waiting (an end that never appeared in this frame) go on now
    for (const S0 of pendingStrings.splice(0)) S0.draw();
    g.globalAlpha = 1;
    flushDof();
    if (pal._wash) drawWash(g, W, H, pal._wash);
    if (season) {
      if (!Lv) drawWash(g, W, H, season.wash);
      drawWeather(g, view, shot.weather === false ? null : { ...season.weather, ...(shot.weather || {}) }, wt, pal, scale, seed);
    }
    return view;
  }

  function drawTitle(g, ti, t, pal = palette) {
    const at = ti.at ?? 0, dur = ti.dur ?? 3, fi = ti.fade ?? 1;
    const a = smoothstep(at, at + fi, t) * (1 - smoothstep(at + dur - fi, at + dur, t));
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = pal[ti.color || 'ink'] || ti.color;
    const px = Math.round((ti.size ?? 0.026) * H);
    g.font = `${ti.italic ? 'italic ' : ''}${ti.weight || 'normal'} ${px}px ${ti.font || fontFamily}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(ti.text).split('\n');
    const track = (ti.tracking ?? 0.18) * px;
    lines.forEach((line, i) => {
      const chars = [...line];
      const widths = chars.map((ch) => g.measureText(ch).width);
      const total = widths.reduce((s, w) => s + w, 0) + track * (chars.length - 1);
      let x = (ti.x ?? 0.5) * W - total / 2;
      const y = (ti.y ?? 0.5) * H + (i - (lines.length - 1) / 2) * px * (ti.leading ?? 1.7);
      g.textAlign = 'left';
      chars.forEach((ch, k) => { g.fillText(ch, x, y); x += widths[k] + track; });
    });
    g.restore();
  }

  function finish(g, shot, t) {
    const pal = paletteOf(shot, t);
    for (const ti of [].concat(shot.title || [])) drawTitle(g, ti, t, pal);
    // fades
    const fade = (spec, inward) => {
      if (!spec) return;
      const s = typeof spec === 'number' ? { dur: spec } : spec;
      const a = inward ? 1 - smoothstep(s.at ?? 0, (s.at ?? 0) + s.dur, t) : smoothstep(shot.dur - s.dur, shot.dur, t);
      if (a <= 0) return;
      g.globalAlpha = a; g.fillStyle = pal[s.color || 'paper'] || s.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    };
    fade(shot.fadeIn, true); fade(shot.fadeOut, false);
    // ink texture + vignette
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.09 * style.grain; g.drawImage(tex.speckle, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
    if (style.vignette > 0) {
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(120,110,95,${style.vignette})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'source-over';
  }

  let scratchA = null, scratchL = null;
  function renderFrame(g, ft, opts = {}) {
    if (loopCF && ft < loopCF && !opts._inner) {
      // seamless loop: the head is blended with the tail that runs past the end
      renderFrame(g, ft, { ...opts, _inner: true });
      scratchL = scratchL || createCanvas(W, H);
      renderFrame(scratchL.getContext('2d'), duration + ft, { ...opts, _inner: true, _tail: true });
      g.globalAlpha = 1 - smoothstep(0, loopCF, ft); g.drawImage(scratchL, 0, 0); g.globalAlpha = 1;
      return shotAt(shots, ft);
    }
    ft = clamp(ft, 0, (opts._tail ? duration + loopCF : duration) - 1e-6);
    const shot = shotAt(shots, ft);
    const t = ft - shot.ft0;
    const tr = shot.transition;
    if (tr && tr.type !== 'cut' && t < tr.dur && shot.index > 0) {
      const prev = shots[shot.index - 1];
      scratchA = scratchA || createCanvas(W, H);
      const ga = scratchA.getContext('2d');
      drawScene(ga, prev, prev.dur + t, opts);
      drawScene(g, shot, t, opts);
      const u = smoothstep(0, tr.dur, t);
      g.save();
      if (tr.type === 'iris') {
        // the new shot opens from a point — usually a character or an object (object-led transition)
        let c = [W / 2, H / 2];
        if (tr.at) {
          const view = makeView(cameraAt(shot, t).cam, W, H);
          const p3 = Array.isArray(tr.at) ? tr.at : (() => { const st = world.state(tr.at, shot.wt0 + t); const p = st.pos3 || [st.pos[0], st.y || 0, st.pos[1]]; return [p[0], p[1] + (world.def(tr.at).height ?? 1) * 0.7, p[2]]; })();
          const pr = view.project(...p3); if (pr) c = [pr[0], pr[1]];
        }
        const Rmax = Math.hypot(Math.max(c[0], W - c[0]), Math.max(c[1], H - c[1]));
        g.beginPath(); g.rect(0, 0, W, H); g.arc(c[0], c[1], Math.max(0.1, Rmax * u), 0, Math.PI * 2, true); g.clip('evenodd');
        g.drawImage(scratchA, 0, 0);
      } else if (tr.type === 'wipe') {
        const d = tr.dir || 'right', x = d === 'right' ? W * u : W * (1 - u);
        g.beginPath(); if (d === 'right') g.rect(x, 0, W - x, H); else g.rect(0, 0, x, H); g.clip();
        g.drawImage(scratchA, 0, 0);
      } else { // dissolve
        g.globalAlpha = 1 - u; g.drawImage(scratchA, 0, 0);
      }
      g.restore();
    } else drawScene(g, shot, t, opts);
    finish(g, shot, t);
    return shot;
  }

  return { renderFrame, cameraAt, paletteAt: paletteOf, motifs, beats, loopCF, shots, duration, world, terrain, palette, style, W, H, fps, setOf, setMood: (sh) => sets[setOf(sh)]?.mood, makeView: (c) => makeView(c, W, H) };
}
