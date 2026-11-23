// Scenery beyond the ground plane: clouds (as objects and as characters), the sky (stars, moon,
// sun), and interior props (window with moonlight, bed, lamp, nightstand).
//
// Clouds are drawn in the same language as the terrain: a metaball field of soft puffs, its
// iso-lines drawn as ink. The outer iso-line is the silhouette (filled with paper so a cloud hides
// what is behind it); further iso-lines crowd only on the underside, like the dark banks of a road
// — that is the cloud's shadow. Shapes morph by interpolating puffs, so a cloud can become a rabbit.

import { contours } from 'd3-contour';
import { rng, noise3, smoothstep, clamp, lerp, TAU, DEG } from './math.js';

// ---------- cloud shapes: puffs [u, v, rx, ry] in metres, origin at the base centre, +u = facing ----------
export const CLOUD_SHAPES = {
  small: { p: 1.4, flat: 0.7, puffs: [[0, 0.32, 0.4, 0.3], [0.42, 0.26, 0.32, 0.25], [-0.44, 0.24, 0.3, 0.23], [0.12, 0.58, 0.3, 0.27], [-0.2, 0.52, 0.25, 0.22], [0.36, 0.48, 0.2, 0.18]] },
  rabbit: { p: 1.4, flat: 0, puffs: [[-0.05, 0.36, 0.46, 0.33], [-0.38, 0.32, 0.32, 0.3], [0.42, 0.62, 0.24, 0.22], [0.36, 1.0, 0.075, 0.25], [0.5, 0.98, 0.07, 0.23], [-0.72, 0.44, 0.13, 0.13], [0.36, 0.14, 0.14, 0.12]] },
  // a whale: a big rounded head, a long body tapering to a narrow stock, and a fluke swept up in a V
  whale: { p: 1.4, flat: 0, puffs: [[0.95, 0.58, 0.6, 0.46], [0.25, 0.56, 0.8, 0.42], [-0.5, 0.62, 0.58, 0.32], [-1.1, 0.7, 0.4, 0.21], [-1.42, 0.76, 0.26, 0.15],
    [-1.6, 0.98, 0.17, 0.27], [-1.62, 0.56, 0.17, 0.23], [0.55, 0.3, 0.7, 0.2]] },
};
export function makeCumulus(seed = 1, w = 8, h = 5) {
  // A fair-weather cumulus that holds together: built in rows, like a cauliflower. A broad flat-bottomed base row; each
  // row above is narrower, sits a little off-centre toward the crown, and is made of fewer, smaller overlapping puffs.
  // A few puffs are left out of the upper rows so the crown is lumpy, never a smooth bag or a single chimney.
  // Sizes are effective radii (one puff's outline sits at ~0.66 of its field radius, see drawCloud).
  const r = rng(seed * 31 + 7), EFF = 0.66, E = [];
  const peak = (r() - 0.5) * w * 0.28, rows = 4 + (h / w > 0.5 ? 1 : 0);
  for (let k = 0; k < rows; k++) {
    const t = k / rows, er = h * (0.21 - 0.016 * k) * (0.9 + r() * 0.2);
    const half = w * 0.47 * Math.pow(1 - Math.pow(t, 1.25), 0.7);           // the dome narrows as it rises
    const cu = peak * t * 1.2, v = er * 1.05 + k * h * 0.19;
    if (half < er * 0.6) { E.push([cu, v, er * 1.2, er]); break; }
    const m = Math.max(1, Math.round((2 * half) / (er * 1.45)));
    for (let i = 0; i <= m; i++) {
      if (k > 0 && i > 0 && i < m && r() < 0.18) continue;                  // a gap in the crown, now and then
      const u = cu - half + (2 * half * i) / m + (r() - 0.5) * er * 0.4;
      const e = er * (k === 0 ? 1 : 0.85 + r() * 0.3) * (1 - 0.35 * Math.pow(Math.abs(u - cu) / (half + 1e-6), 2));
      if (e < er * 0.55) continue;                                          // no tiny curls
      E.push([u, v + (k ? (r() - 0.3) * er * 0.35 : 0), e * 1.3, e]);
    }
  }
  return { flat: 1, p: 3, puffs: E.map(([u, v, ex, ey]) => [u, v, ex / EFF, ey / EFF]) };
}

function resolveShape(s, seed) {
  if (!s) return CLOUD_SHAPES.small;
  if (typeof s === 'string') return CLOUD_SHAPES[s] || CLOUD_SHAPES.small;
  if (s.cumulus) return makeCumulus(s.seed ?? seed, s.w, s.h);
  return s;
}
function morphShapes(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const n = Math.max(a.puffs.length, b.puffs.length);
  const pad = (p, i) => p.puffs[i] || [...p.puffs[i % p.puffs.length].slice(0, 2), 0.001, 0.001];
  const puffs = [];
  for (let i = 0; i < n; i++) { const A = pad(a, i), B = pad(b, i); puffs.push(A.map((v, k) => lerp(v, B[k], t))); }
  return { flat: lerp(a.flat ?? 0, b.flat ?? 0, t), p: lerp(a.p ?? 3, b.p ?? 3, t), puffs };
}

const cloudGen = contours().smooth(true);

/**
 * Draw one cloud. `c` = { pos3:[x,y,z], heading, scale, shape, shapeB, morph, glow, rain, seed }.
 */
export function drawCloud(g, view, c, pal, time, scale, opts = {}) {
  const sh0 = resolveShape(c.shape, c.seed), sh = c.shapeB ? morphShapes(sh0, resolveShape(c.shapeB, c.seed), c.morph ?? 0) : sh0;
  const S = c.scale ?? 1;
  const [x, y, z] = c.pos3;
  const cam = view.cam;
  const vx = x - cam.pos[0], vz = z - cam.pos[2];
  const viewAz = Math.atan2(vx, vz);
  const Rx = Math.cos(viewAz), Rz = -Math.sin(viewAz);
  // shapes look the way they travel; turning around passes smoothly through side-on (narrow) instead of mirroring
  const fs0 = clamp(Math.sin((c.heading ?? 0) - viewAz) * 3, -1, 1), face = Math.sign(fs0 || 1) * Math.max(0.3, Math.abs(fs0)) * (Math.abs(fs0) < 0.3 ? Math.abs(fs0) / 0.3 * 0.7 + 0.3 : 1);
  const depth = view.toCam(x, y, z)[2];
  if (depth < 0.3) return;
  // breathing puffs (faster and bigger when the shot is agitated; a slow sway when it flows)
  const ag = opts.feel?.agitation || 0, fl = opts.feel?.flow || 0;
  const puffs = sh.puffs.map(([u, v, rx, ry], i) => {
    const b = 1 + (0.045 + 0.07 * ag) * Math.sin(time * (0.9 + 3 * ag) + i * 1.7 + (c.seed ?? 0)) + (0.02 + 0.04 * ag) * noise3(time * (0.4 + 2 * ag), i, c.seed ?? 0);
    u += fl * 0.12 * Math.sin(time * 0.35 + i * 0.6 + (c.seed ?? 0));
    return [u * face * S, v * S, rx * S * b, ry * S * b];
  });
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [u, v, rx, ry] of puffs) { u0 = Math.min(u0, u - rx * 1.8); u1 = Math.max(u1, u + rx * 1.8); v0 = Math.min(v0, v - ry * 1.8); v1 = Math.max(v1, v + ry * 1.8); }
  // grid resolution from on-screen size
  const pxPerM = view.f / depth;
  const cell = clamp(Math.max(u1 - u0, v1 - v0) / 110, 2.2 / pxPerM, 1e9);
  const nu = Math.min(170, Math.ceil((u1 - u0) / cell) + 3), nv = Math.min(140, Math.ceil((v1 - v0) / cell) + 3);
  const cu = (u1 - u0) / (nu - 3), cv = (v1 - v0) / (nv - 3);
  const F = new Float64Array(nu * nv);
  const flat = sh.flat ?? 0;
  const P = sh.p ?? 3;
  for (let j = 0; j < nv; j++) {
    const v = v0 + (j - 1) * cv;
    const base = flat > 0 ? lerp(1, smoothstep(-0.02 * S, 0.12 * S, v), flat) : 1;
    for (let i = 0; i < nu; i++) {
      const u = u0 + (i - 1) * cu;
      // soft union of puffs: each keeps its own bump in the outline (cauliflower, not a smooth bag)
      let s = 0;
      for (const [pu, pv, rx, ry] of puffs) { const du = (u - pu) / rx, dv = (v - pv) / ry; const q = du * du + dv * dv; if (q < 9) s += Math.exp(-1.6 * P * q); }
      F[i + j * nu] = Math.pow(s, 1 / P) * base;
    }
  }
  cloudGen.size([nu, nv]);
  const W = (gu, gv) => { const u = u0 + (gu - 1.5) * cu, v = v0 + (gv - 1.5) * cv; return view.project(x + Rx * u, y + v, z + Rz * u); };
  const rings = (thr) => {
    const out = [];
    for (const poly of cloudGen.contour(F, thr).coordinates) for (const ring of poly.slice(0, 1)) { // outer edges only — no holes
      const pts = [];
      for (const [gu, gv] of ring) { const p = W(gu, gv); if (p) pts.push([p[0], p[1], v0 + (gv - 1.5) * cv]); }
      if (pts.length > 3) out.push(pts);
    }
    return out;
  };
  const outline = rings(0.5);
  if (!outline.length) return;
  let vb = Infinity, vt = -Infinity;
  for (const [, v, , ry] of puffs) { vb = Math.min(vb, v - ry); vt = Math.max(vt, v + ry); }
  if (flat > 0) vb = Math.max(vb, 0);
  const vMid = (vb + vt) / 2;
  // glow (the accent): a soft halo and a warm tint in the body
  const glow = c.glow ?? 0;
  if (glow > 0.01 && pal.accent) {
    const cpx = view.project(x, y + (v0 + v1) * 0.45, z);
    if (cpx) {
      const R = (u1 - u0) * 0.75 * pxPerM;
      const gr = g.createRadialGradient(cpx[0], cpx[1], R * 0.1, cpx[0], cpx[1], R);
      gr.addColorStop(0, hexA(pal.accent, 0.38 * glow)); gr.addColorStop(1, hexA(pal.accent, 0));
      g.fillStyle = gr; g.fillRect(cpx[0] - R, cpx[1] - R, R * 2, R * 2);
    }
  }
  // body
  g.beginPath();
  for (const r of outline) { g.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) g.lineTo(r[i][0], r[i][1]); g.closePath(); }
  g.fillStyle = glow > 0.01 && pal.accent ? mixHex(pal.cloud || pal.paper, pal.accent, 0.22 * glow) : pal.cloud || pal.paper;
  g.fill('nonzero');
  // ink: silhouette line, then underside banks
  const pen = (opts.pen ?? 2.4) * scale * clamp(Math.pow(9 / depth, 0.45), 0.55, 2.0);
  g.strokeStyle = pal.line || pal.ink; g.lineCap = 'round'; g.lineJoin = 'round';
  strokeRings(g, outline, () => pen * 1.15, vMid, null);
  const banks = opts.banks ?? [0.54, 0.58, 0.625, 0.675, 0.73, 0.79];
  const perim = (r) => { let L = 0; for (let i = 1; i < r.length; i++) L += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return L; };
  const outerLen = Math.max(...outline.map(perim));
  banks.forEach((thr, k) => {
    // only long rings that follow the outline: small inner loops read as eyes, not shading
    strokeRings(g, rings(thr).filter((r) => perim(r) > outerLen * 0.35), (vv) => pen * (0.85 - k * 0.08) * smoothstep(vb + (vt - vb) * 0.42, vb + (vt - vb) * 0.12, vv), vMid, k);
  });
  // a little rain
  const rain = c.rain ?? 0;
  if (rain > 0.01) {
    const r = rng((c.seed ?? 1) * 97);
    g.strokeStyle = pal.line || pal.ink;
    for (let i = 0; i < 40 * rain; i++) {
      const u = (r() - 0.5) * (u1 - u0) * 0.6, ph = r();
      const fall = ((time * 1.4 + ph) % 1);
      const v = -fall * 1.6 * S;
      const a = view.project(x + Rx * u, y + v, z + Rz * u), b = view.project(x + Rx * u, y + v - 0.09 * S, z + Rz * u);
      if (!a || !b) continue;
      g.globalAlpha = 0.55 * (1 - fall);
      g.lineWidth = Math.max(0.7 * scale, pen * 0.5);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    g.globalAlpha = 1;
  }
}

function strokeRings(g, list, widthAt, vMid, k) {
  for (const r of list) {
    // stroke in short runs so the width can follow the underside weighting
    for (let i = 0; i < r.length - 1; i += 3) {
      const j = Math.min(r.length - 1, i + 3);
      const w = widthAt(r[i][2]);
      if (w < 0.08) continue;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(r[i][0], r[i][1]);
      for (let q = i + 1; q <= j; q++) g.lineTo(r[q][0], r[q][1]);
      g.stroke();
    }
  }
}

function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (n, s) => (n >> s) & 255;
  const m = (s) => Math.round(lerp(ch(A, s), ch(B, s), t));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// ---------- sky: stars, moon, sun (at infinity) ----------
export function drawSky(g, view, sky, pal, time, scale) {
  if (!sky) return;
  const { cam, f } = view;
  const at = (az, el) => { const d = [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG)]; return view.project(cam.pos[0] + d[0] * 1e4, cam.pos[1] + d[1] * 1e4, cam.pos[2] + d[2] * 1e4); };
  if (sky.stars) {
    const r = rng(sky.seed ?? 5);
    g.fillStyle = pal.star || pal.paper;
    for (let i = 0; i < sky.stars; i++) {
      const az = r() * 360, el = 4 + Math.pow(r(), 0.7) * 80, sz = 0.5 + Math.pow(r(), 3) * 1.6, tw = r() * TAU;
      const p = at(az, el); if (!p) continue;
      g.globalAlpha = (sky.starAlpha ?? 1) * (0.55 + 0.45 * Math.sin(time * (0.7 + r()) + tw));
      g.beginPath(); g.arc(p[0], p[1], sz * scale, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (sky.sun) {
    // relAz places the sun relative to where the camera looks — an art-direction cheat for sunrises
    const az = sky.sun.relAz != null ? cam.yaw / DEG + sky.sun.relAz : sky.sun.az;
    const p = at(az, sky.sun.elev);
    if (p) {
      const R = Math.tan((sky.sun.r ?? 2.2) * DEG) * f;
      const a = sky.sun.alpha ?? 1, sc = pal[sky.sun.color] || sky.sun.color || pal.sunColor || pal.accent, halo = sky.sun.halo ?? 6;
      const gr = g.createRadialGradient(p[0], p[1], R * 0.5, p[0], p[1], R * halo);
      gr.addColorStop(0, hexA(sc, 0.35 * a)); gr.addColorStop(1, hexA(sc, 0));
      g.fillStyle = gr; g.fillRect(p[0] - R * halo, p[1] - R * halo, R * halo * 2, R * halo * 2);
      g.globalAlpha = a; g.fillStyle = sc; g.beginPath(); g.arc(p[0], p[1], R, 0, TAU); g.fill(); g.globalAlpha = 1;
    }
  }
  if (sky.moon) {
    const p = at(sky.moon.az, sky.moon.elev);
    if (p) {
      const R = Math.tan((sky.moon.r ?? 1.8) * DEG) * f;
      g.fillStyle = pal.moon || pal.paper; g.beginPath(); g.arc(p[0], p[1], R, 0, TAU); g.fill();
      if (sky.moon.phase) { g.fillStyle = pal.sky || pal.pane || pal.paper; g.beginPath(); g.arc(p[0] + R * sky.moon.phase, p[1] - R * 0.15, R * 0.92, 0, TAU); g.fill(); }
    }
  }
}

// ---------- fire: flat tongues of flame in three tones, a glow, and smoke that rises and drifts ----------
// Flames are billboards (they always face the lens) planted at a 3D base point; `size` is the flame's height in
// metres at full strength, `level` 0..1 grows it. Colours: pal.fire (outer), pal.fire2 (middle), pal.fireCore.
export function drawFlame(g, view, base, size, level, time, seed = 1, pal = {}, { smoke = 0, wind = 0.4, scale = 1 } = {}) {
  if (level <= 0.01) return;
  const pr = view.project(base[0], base[1], base[2]);
  if (!pr) return;
  const [sx, sy, d] = pr, ppm = view.f / d, Hm = size * level * ppm, W = Math.max(2 * scale, Hm * 0.62);
  if (Hm < 0.6) return;
  const fire = pal.fire || '#d8522a', fire2 = pal.fire2 || '#f08a35', core = pal.fireCore || '#fbd37c';
  // glow on the air around it
  const gr = g.createRadialGradient(sx, sy - Hm * 0.35, 0, sx, sy - Hm * 0.35, Hm * 2.2);
  gr.addColorStop(0, hexA(fire2, 0.32 * level)); gr.addColorStop(1, hexA(fire2, 0));
  g.fillStyle = gr; g.fillRect(sx - Hm * 2.2, sy - Hm * 2.6, Hm * 4.4, Hm * 4.4);
  // smoke first, so the flame sits in front of it
  if (smoke > 0) {
    g.save(); g.fillStyle = pal.smoke || '#3a3236';
    for (let j = 0; j < 7; j++) {
      const ph = (time * 0.18 + j / 7 + seed * 0.13) % 1;
      const r = Hm * (0.35 + ph * 1.5), yy = sy - Hm * (0.9 + ph * 5), xx = sx + (wind * ph * 3.5 + 0.6 * noise3(j, seed, time * 0.2)) * Hm;
      g.globalAlpha = smoke * 0.26 * level * Math.sin(Math.PI * ph);
      g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill();
    }
    g.restore();
  }
  const tongue = (w, h, col, k) => {
    const n = 18, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = (u - 0.5) * 2;
      const env = Math.pow(Math.max(0, 1 - x * x), 0.6);
      const lick = 0.62 + 0.38 * noise3(x * 2.6 + seed, time * 3.2 * (1 + k * 0.3), seed + k) + 0.25 * Math.max(0, Math.sin(x * 6 + time * 7 + seed));
      const hh = h * env * lick, lean = wind * 0.35 * Math.pow(env * lick, 2) * h + 0.06 * h * noise3(time * 2.1, seed + k, 1);
      pts.push([sx + x * w / 2 + lean, sy - hh]);
    }
    g.fillStyle = col; g.beginPath(); g.moveTo(sx - w / 2, sy);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(sx + w / 2, sy); g.closePath(); g.fill();
  };
  g.save(); g.globalAlpha = Math.min(1, level * 1.4);
  tongue(W, Hm, fire, 0); tongue(W * 0.72, Hm * 0.7, fire2, 1); tongue(W * 0.42, Hm * 0.38, core, 2);
  g.restore();
}

// chimney smoke: soft puffs that rise, swell and drift downwind, fading as they go
export function drawSmoke(g, view, base, size, time, seed = 1, color = '#e6e3de', scale = 1, wind = 0.6) {
  g.save(); g.fillStyle = color;
  for (let j = 0; j < 8; j++) {
    const ph = (time * 0.09 + j / 8 + seed * 0.173) % 1;
    const q = [base[0] + (wind * ph * 4 + 0.4 * noise3(j, seed, time * 0.15)) * size, base[1] + ph * 5 * size, base[2] + 0.3 * noise3(seed, j, time * 0.1) * size];
    const pr = view.project(q[0], q[1], q[2]); if (!pr) continue;
    const r = (view.f / pr[2]) * size * (0.25 + ph * 0.9);
    g.globalAlpha = 0.28 * Math.sin(Math.PI * Math.min(1, ph * 1.15)) * (1 - ph * 0.5);
    g.beginPath(); g.arc(pr[0], pr[1], Math.max(0.5 * scale, r), 0, TAU); g.fill();
  }
  g.restore();
}

// fire on a prop: { start, from: [x, z], speed, grow, out, level, size } — it spreads outward from `from`,
// igniting each building as the front reaches it, and dies down after `out`
export function fireLevel(fire, x, z, wt) {
  if (!fire) return 0;
  const ig = (fire.start ?? 0) + (fire.from ? Math.hypot(x - fire.from[0], z - fire.from[1]) / (fire.speed ?? 6) : 0);
  let v = smoothstep(ig, ig + (fire.grow ?? 1.5), wt) * (fire.level ?? 1);
  if (fire.out != null) v *= 1 - smoothstep(fire.out, fire.out + (fire.fade ?? 4), wt);
  return v;
}

// ---------- props (3D polygons, filled as silhouettes) ----------
function box(cx, cy, cz, w, h, d, yaw = 0) {
  const c = Math.cos(yaw * DEG), s = Math.sin(yaw * DEG);
  const P = (a, b, e) => [cx + a * c + e * s, cy + b, cz - a * s + e * c];
  const v = [P(-w / 2, 0, -d / 2), P(w / 2, 0, -d / 2), P(w / 2, 0, d / 2), P(-w / 2, 0, d / 2), P(-w / 2, h, -d / 2), P(w / 2, h, -d / 2), P(w / 2, h, d / 2), P(-w / 2, h, d / 2)];
  return [[v[0], v[1], v[2], v[3]], [v[4], v[5], v[6], v[7]], [v[0], v[1], v[5], v[4]], [v[1], v[2], v[6], v[5]], [v[2], v[3], v[7], v[6]], [v[3], v[0], v[4], v[7]]];
}

// project a 3D polygon, clipping it against the camera's near plane (so walls right at the lens still draw)
export function clipProject(view, poly) {
  const near = 0.05, cs = poly.map((q) => view.toCam(q[0], q[1], q[2]));
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    const ain = a[2] >= near, bin = b[2] >= near;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (near - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]); }
  }
  return out.map(([x, y, z]) => [view.W / 2 + (view.f * x) / z, view.H / 2 - (view.f * y) / z, z]);
}

export function fillPolys3(g, view, polys, color, seal = false) {
  g.beginPath();
  for (const poly of polys) {
    const scr = clipProject(view, poly);
    if (scr.length < 3) continue;
    let area = 0; for (let i = 0; i < scr.length; i++) { const a = scr[i], b = scr[(i + 1) % scr.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) scr.reverse();
    g.moveTo(scr[0][0], scr[0][1]); for (let i = 1; i < scr.length; i++) g.lineTo(scr[i][0], scr[i][1]); g.closePath();
  }
  g.fillStyle = color; g.fill('nonzero');
  if (seal) { g.strokeStyle = color; g.lineWidth = 1; g.lineJoin = 'round'; g.stroke(); } // closes hairline seams between faces
}

// window in a wall facing -z (the room is on the -z side)
export function windowGeometry(w) {
  const [cx, cy, cz] = w.at, hw = w.w / 2, hh = w.h / 2;
  const pane = [[cx - hw, cy - hh, cz], [cx + hw, cy - hh, cz], [cx + hw, cy + hh, cz], [cx - hw, cy + hh, cz]];
  const fr = w.frame ?? 0.06, bars = [];
  const bar = (x0, y0, x1, y1) => bars.push([[x0, y0, cz - 0.02], [x1, y0, cz - 0.02], [x1, y1, cz - 0.02], [x0, y1, cz - 0.02]]);
  bar(cx - hw - fr, cy - hh - fr, cx + hw + fr, cy - hh);  // bottom
  bar(cx - hw - fr, cy + hh, cx + hw + fr, cy + hh + fr);  // top
  bar(cx - hw - fr, cy - hh, cx - hw, cy + hh);             // left
  bar(cx + hw, cy - hh, cx + hw + fr, cy + hh);             // right
  bar(cx - fr * 0.4, cy - hh, cx + fr * 0.4, cy + hh);      // mullion
  bar(cx - hw, cy - fr * 0.4, cx + hw, cy + fr * 0.4);      // transom
  // sill
  bars.push(...box(cx, cy - hh - fr - 0.04, cz - 0.08, w.w + 0.3, 0.04, 0.2));
  return { pane, bars };
}

const mixC = (a, b, t) => { const A = parseInt(a.slice(1, 7), 16), B = parseInt(b.slice(1, 7), 16), m = (s2) => Math.round(((A >> s2) & 255) * (1 - t) + ((B >> s2) & 255) * t); return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1); };
export function drawProp(g, view, p, pal, time, wt, scale, feel) {
  // tone: distance haze (0 = full ink, 1 = paper). Backgrounds a step lighter keep the figures in front readable.
  const ink = p.tone ? mixC(pal.ink, pal.paper, p.tone) : pal.ink;
  // the living look paints each part in its material, lit and hazed; the classic look fills everything with ink
  const Lv = pal._living;
  const paint = (polys, part, o = {}) => (Lv ? Lv.paint(g, view, fillPolys3, p, part, polys, o) : fillPolys3(g, view, polys, ink));
  const camD = (q) => Math.hypot(q[0] - view.cam.pos[0], q[1] - view.cam.pos[1], q[2] - view.cam.pos[2]);
  if (p.kind === 'window') {
    const { bars } = windowGeometry(p);
    paint(bars, 'frame', { solid: false });
    if (p.curtains) {
      const [cx, cy, cz] = p.at, hw = p.w / 2, hh = p.h / 2;
      for (const side of [-1, 1]) {
        const pts = [];
        const top = cy + hh + 0.25, bot = cy - hh - 0.35, inner = cx + side * (hw - (p.curtainOpen ?? 0.12));
        const outer = cx + side * (hw + 0.35);
        for (let i = 0; i <= 12; i++) { const u = i / 12; const sway = 0.03 * noise3(u * 3 + time * 0.6, side, 0) * (p.breeze ?? 1); pts.push([lerp(inner, inner + side * 0.06, u) + sway * u, lerp(top, bot, u), cz - 0.1 - 0.05 * u]); }
        pts.push([outer, bot, cz - 0.12], [outer, top, cz - 0.1]);
        paint([pts], 'curtain', { solid: false });
      }
    }
  } else if (p.kind === 'bed') {
    const [x, z] = p.at, yaw = p.yaw ?? 0, L = p.len ?? 1.6, Wd = p.w ?? 0.9, H = p.h ?? 0.42;
    const frame = [...box(x, 0, z, Wd, H, L, yaw), ...box(x + (L / 2) * Math.sin(yaw * DEG), 0, z + (L / 2) * Math.cos(yaw * DEG), Wd + 0.06, H + (p.headboard ?? 0.45), 0.06, yaw)], polys = [];
    // the blanket: one soft, rounded mound (rumpled a little), the pillow a rounded bolster at the head
    const c = Math.cos(yaw * DEG), s = Math.sin(yaw * DEG);
    const Pb = (e, y, u) => [x + e * s + u * c, y, z + e * c - u * s];
    const e0 = -L / 2 + 0.06, e1 = L / 2 - 0.44, nE = 10, nU = 8, hw = Wd * 0.51;
    const hgt = (e, u) => (0.05 + 0.03 * Math.sin(e * 5.1 + 0.7) + 0.015 * Math.sin(e * 13 + u * 7)) * Math.sqrt(Math.max(0, 1 - (u / hw) ** 2)) * smoothstep(e0 - 0.01, e0 + 0.12, e);
    for (let i = 0; i < nE; i++) for (let j = 0; j < nU; j++) {
      const ea = lerp(e0, e1, i / nE), eb = lerp(e0, e1, (i + 1) / nE), ua = lerp(-hw, hw, j / nU), ub = lerp(-hw, hw, (j + 1) / nU);
      polys.push([Pb(ea, H + hgt(ea, ua), ua), Pb(eb, H + hgt(eb, ua), ua), Pb(eb, H + hgt(eb, ub), ub), Pb(ea, H + hgt(ea, ub), ub)]);
    }
    for (const side of [-1, 1]) for (let i = 0; i < nE; i++) { const ea = lerp(e0, e1, i / nE), eb = lerp(e0, e1, (i + 1) / nE); polys.push([Pb(ea, H - 0.12, side * hw), Pb(eb, H - 0.12, side * hw), Pb(eb, H + hgt(eb, side * hw * 0.999), side * hw), Pb(ea, H + hgt(ea, side * hw * 0.999), side * hw)]); } // it hangs over the sides
    const pillow = [];
    for (let j = 0; j < 10; j++) { const a0 = (j / 10) * Math.PI, a1 = ((j + 1) / 10) * Math.PI, pe = L / 2 - 0.25; pillow.push([Pb(pe - 0.15, H + Math.sin(a0) * 0.1, Math.cos(a0) * Wd * 0.36), Pb(pe + 0.15, H + Math.sin(a0) * 0.1, Math.cos(a0) * Wd * 0.36), Pb(pe + 0.15, H + Math.sin(a1) * 0.1, Math.cos(a1) * Wd * 0.36), Pb(pe - 0.15, H + Math.sin(a1) * 0.1, Math.cos(a1) * Wd * 0.36)]); }
    paint(frame, 'frame', { solid: false });
    if (Lv) { paint(polys, 'blanket', { centre: [x, H - 0.3, z], seed: p.seed ?? 0 }); paint(pillow, 'pillow', { centre: Pb(L / 2 - 0.25, H - 0.2, 0) }); }
    else fillPolys3(g, view, [...polys, ...pillow], ink);
  } else if (p.kind === 'tree') {
    // a seeded silhouette: bare branches or a round crown; it sways a little with the wind
    const [x, z] = p.at, Ht = p.h ?? 5, r = rng((p.seed ?? 1) * 101);
    const cam = view.cam, az = Math.atan2(x - cam.pos[0], z - cam.pos[2]), Rx = Math.cos(az), Rz = -Math.sin(az);
    const W3 = (u, v) => [x + Rx * u, v, z + Rz * u];
    const polys = [];
    const sway = (p.sway ?? 1) * (1 + 3 * (feel?.agitation || 0) + (feel?.flow || 0)) * 0.035 * noise3(time * (0.6 + 1.5 * (feel?.agitation || 0)), p.seed ?? 1, 0);
    const branch = (u0, v0, ang, len, wd, depth) => {
      const a2 = ang + sway * (4 - depth) * 0.5;
      const u1 = u0 + Math.sin(a2) * len, v1 = v0 + Math.cos(a2) * len;
      const nx = Math.cos(a2) * wd, ny = -Math.sin(a2) * wd, w2 = wd * 0.68;
      polys.push([W3(u0 - nx, v0 - ny), W3(u0 + nx, v0 + ny), W3(u1 + nx * 0.68, v1 + ny * 0.68), W3(u1 - nx * 0.68, v1 - ny * 0.68)]);
      if (depth >= (p.style === 'round' ? 3 : 6) || len < 0.12) return;
      const kids = depth < 1 ? 2 + (r() < 0.5 ? 1 : 0) : 2;
      for (let i = 0; i < kids; i++) branch(u1, v1, a2 + (i - (kids - 1) / 2) * (0.5 + r() * 0.35) + (r() - 0.5) * 0.3, len * (0.62 + r() * 0.18), w2, depth + 1);
    };
    branch(0, 0, (p.lean ?? 0) * DEG, Ht * 0.36, Ht * 0.035, 0);
    const crown = [], lights = [];
    if (p.style === 'round') { // crown: a union of soft circles
      for (let i = 0; i < 9; i++) {
        const cu = (r() - 0.5) * Ht * 0.5 + sway * Ht, cv = Ht * (0.58 + r() * 0.3), rr = Ht * (0.16 + r() * 0.1);
        crown.push(Array.from({ length: 18 }, (_, j) => { const t = (j / 18) * TAU; return W3(cu + Math.cos(t) * rr, cv + Math.sin(t) * rr); }));
        lights.push(Array.from({ length: 14 }, (_, j) => { const t = (j / 14) * TAU; return W3(cu - rr * 0.12 + Math.cos(t) * rr * 0.62, cv + rr * 0.26 + Math.sin(t) * rr * 0.55); }));
      }
    }
    if (!Lv) fillPolys3(g, view, [...polys, ...crown], ink);
    else {
      paint(polys, 'bark', { solid: false });
      if (crown.length) { // foliage with light on top: a darker mass, lit puffs above
        const fc = Lv.materialOf(p, 'foliage', p.seed ?? 1), d = camD([x, Ht * 0.7, z]);
        fillPolys3(g, view, crown, Lv.lit(fc, 0.3, d)); fillPolys3(g, view, lights, Lv.lit(fc, 0.95, d));
      }
    }
    if (p.fire) { const [tx, tz] = p.at, lv = fireLevel(p.fire, tx, tz, wt); drawFlame(g, view, [tx, Ht * 0.55, tz], (p.fire.size ?? Ht * 0.7), lv, time, 9, pal, { smoke: 1, scale }); }
  } else if (p.kind === 'house') {
    const [x, z] = p.at, w = p.w ?? 5, d = p.d ?? 6, h = p.h ?? 3.2, roof = p.roof ?? 2, yaw = p.yaw ?? 0;
    const c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
    const P = (a, y, e) => [x + a * c + e * sn, y, z - a * sn + e * c];
    const walls = [...box(x, 0, z, w, h, d, yaw)];
    walls.push([P(-w / 2, h, -d / 2), P(w / 2, h, -d / 2), P(0, h + roof, -d / 2)], [P(-w / 2, h, d / 2), P(w / 2, h, d / 2), P(0, h + roof, d / 2)]);
    const roofs = [[P(-w / 2, h, -d / 2), P(0, h + roof, -d / 2), P(0, h + roof, d / 2), P(-w / 2, h, d / 2)], [P(w / 2, h, -d / 2), P(0, h + roof, -d / 2), P(0, h + roof, d / 2), P(w / 2, h, d / 2)]];
    const ctr = [x, h * 0.6, z];
    if (!Lv) fillPolys3(g, view, [...walls, ...roofs], ink);
    else {
      const chim = box(P(w * 0.22, 0, d * 0.15)[0], h + roof * 0.3, P(w * 0.22, 0, d * 0.15)[2], 0.5, roof * 0.9, 0.5, yaw);
      paint(walls, 'wall', { centre: ctr }); paint(chim, 'chimney'); paint(roofs, 'roof', { centre: ctr });
      if (p.smoke !== false) drawSmoke(g, view, P(w * 0.22, h + roof * 1.25, d * 0.15), 0.7, time, p.seed ?? 3, Lv.lit('#e9e6e1', 0.8, camD([x, h, z])), scale);
    }
    if (p.lit || Lv) { // windows on the side facing -z: glass by day, warm light when lit
      const lv = typeof p.lit === 'number' ? p.lit : p.lit ? 1 : 0, wins = [];
      for (const a of [-w * 0.25, w * 0.25]) wins.push([P(a - 0.35, h * 0.35, -d / 2 - 0.02), P(a + 0.35, h * 0.35, -d / 2 - 0.02), P(a + 0.35, h * 0.7, -d / 2 - 0.02), P(a - 0.35, h * 0.7, -d / 2 - 0.02)]);
      if (Lv) fillPolys3(g, view, wins, Lv.lit(Lv.M.glass, 0.5, camD([x, h, z])));
      const on = lv * (Lv ? Lv.emit : 1);
      if (on > 0.01) fillPolys3(g, view, wins, hexA(pal[p.color] || pal.lamp || pal.accent || '#e8a33d', 0.9 * on));
    }
    if (p.fire) { const lv = fireLevel(p.fire, x, z, wt); for (let k2 = 0; k2 < 3; k2++) { const u = (k2 - 1) * w * 0.32; drawFlame(g, view, P(u, h + roof * (1 - Math.abs(k2 - 1) * 0.55), 0), p.fire.size ?? 3, lv, time, k2 + 1, pal, { smoke: k2 === 1 ? 1 : 0, scale }); } }
  } else if (p.kind === 'tower') {
    // a tiered tower: stacked tiers narrowing upward, a dome and a finial; windows lit on the lower tiers
    const [x, z] = p.at, w = p.w ?? 6, h = p.h ?? 18, tiers = p.tiers ?? 4, polys = [], wins = [];
    let y = 0, ww = w;
    for (let i = 0; i < tiers; i++) {
      const th = (h * 0.72) / tiers * (i === 0 ? 1.4 : 0.87);
      polys.push(...box(x, y, z, ww, th, ww, p.yaw ?? 0));
      polys.push(...box(x, y + th, z, ww * 1.12, th * 0.08, ww * 1.12, p.yaw ?? 0)); // a cornice
      if (i < 2 && (p.lit ?? 0.6) > 0) for (let j = -1; j <= 1; j++) { const wy = y + th * 0.35; wins.push([[x + j * ww * 0.28 - 0.25, wy, z - ww / 2 - 0.03], [x + j * ww * 0.28 + 0.25, wy, z - ww / 2 - 0.03], [x + j * ww * 0.28 + 0.25, wy + th * 0.3, z - ww / 2 - 0.03], [x + j * ww * 0.28 - 0.25, wy + th * 0.3, z - ww / 2 - 0.03]]); }
      y += th * 1.08; ww *= 0.78;
    }
    const n = 14, R = ww * 0.62, dh = h - y;
    for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { // dome (bulb) as rings
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, v0 = j / 4, v1 = (j + 1) / 4;
      const r0 = R * Math.sin(Math.PI * lerp(0.15, 1, 1 - v0)) * (1 - v0 * 0.2), r1 = R * Math.sin(Math.PI * lerp(0.15, 1, 1 - v1)) * (1 - v1 * 0.2);
      polys.push([[x + Math.cos(a0) * r0, y + v0 * dh * 0.75, z + Math.sin(a0) * r0], [x + Math.cos(a1) * r0, y + v0 * dh * 0.75, z + Math.sin(a1) * r0], [x + Math.cos(a1) * r1, y + v1 * dh * 0.75, z + Math.sin(a1) * r1], [x + Math.cos(a0) * r1, y + v1 * dh * 0.75, z + Math.sin(a0) * r1]]);
    }
    polys.push(...box(x, y + dh * 0.7, z, 0.12, dh * 0.3, 0.12));
    paint(polys, 'wall', { solid: false });
    if (wins.length) fillPolys3(g, view, wins, hexA(pal[p.color] || pal.lamp || '#e8c47a', 0.9 * (p.lit ?? 0.6)));
    if (p.fire) { const lv = fireLevel(p.fire, x, z, wt); drawFlame(g, view, [x, y, z], (p.fire.size ?? 5), lv, time, 5, pal, { smoke: 1, scale }); drawFlame(g, view, [x - w * 0.3, h * 0.3, z - w * 0.4], (p.fire.size ?? 5) * 0.7, lv, time, 6, pal, { scale }); }
  } else if (p.kind === 'rock') {
    // a crag or cliff: an irregular block, wider at the base; people can stand on its top (groundHeightAt)
    const [x, z] = p.at, r0 = p.r ?? 4, h = p.h ?? 6, n = 11, rr = rng((p.seed ?? 1) * 97), polys = [];
    const base = [], top = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, k1 = 0.8 + rr() * 0.4, k2 = 0.55 + rr() * 0.25;
      base.push([x + Math.cos(a) * r0 * k1, 0, z + Math.sin(a) * r0 * k1]);
      top.push([x + Math.cos(a) * r0 * k2 * (p.flat ?? 1), h * (0.92 + rr() * 0.12), z + Math.sin(a) * r0 * k2 * (p.flat ?? 1)]);
    }
    for (let i = 0; i < n; i++) polys.push([base[i], base[(i + 1) % n], top[(i + 1) % n], top[i]]);
    polys.push(top);
    paint(polys, 'body', { centre: [x, h * 0.45, z] });
  } else if (p.kind === 'wall') {
    // a city wall with crenellations along a polyline
    const pts = p.pts, h = p.h ?? 5, th = p.thick ?? 1.2, polys = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) / DEG - 90;
      polys.push(...box((x0 + x1) / 2, 0, (z0 + z1) / 2, L, h, th, yaw));
      const m = Math.floor(L / 1.6);
      for (let k2 = 0; k2 < m; k2++) { const u = (k2 + 0.5) / m; polys.push(...box(x0 + (x1 - x0) * u, h, z0 + (z1 - z0) * u, 0.8, 0.7, th, yaw)); }
    }
    paint(polys, 'body', { solid: false });
  } else if (p.kind === 'bridge') {
    // an arched footbridge: deck, rails, posts
    const [x, z] = p.at, L = p.len ?? 12, w = p.w ?? 1.8, rise = p.rise ?? 1.2, yaw = p.yaw ?? 0, n = 14;
    const c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
    const P = (a, y, e) => [x + a * c + e * sn, y, z - a * sn + e * c];
    const deckY = (a) => rise * (1 - Math.pow((2 * a) / L, 2)) + 0.05;
    // A solid object from every angle: the deck is a slab (top, underside and both fascias), the ends stand on
    // stone landings, posts carry a top rail and a mid rail. Seen from above it reads as a walkway, not two lines.
    const hw = w / 2, deck = [], railsBy = { [-hw]: [], [hw]: [] }, th = p.thick ?? 0.32, landings = [];
    const n2 = n * 2;
    for (let i = 0; i < n2; i++) {
      const a0 = -L / 2 + (L * i) / n2, a1 = -L / 2 + (L * (i + 1)) / n2, y0 = deckY(a0), y1 = deckY(a1), seg = [];
      seg.push([P(a0, y0, -hw), P(a1, y1, -hw), P(a1, y1, hw), P(a0, y0, hw)]);                         // deck top
      seg.push([P(a0, y0 - th, -hw), P(a1, y1 - th, -hw), P(a1, y1 - th, hw), P(a0, y0 - th, hw)]);     // underside
      for (const e of [-hw, hw]) {
        seg.push([P(a0, y0, e), P(a1, y1, e), P(a1, y1 - th, e), P(a0, y0 - th, e)]);                     // fascia
        railsBy[e].push([P(a0, y0 + 0.95, e), P(a1, y1 + 0.95, e), P(a1, y1 + 0.89, e), P(a0, y0 + 0.89, e)]); // top rail
        railsBy[e].push([P(a0, y0 + 0.5, e), P(a1, y1 + 0.5, e), P(a1, y1 + 0.47, e), P(a0, y0 + 0.47, e)]);   // mid rail
      }
      deck.push({ seg, ctr: P((a0 + a1) / 2, (y0 + y1) / 2 - th / 2, 0) });
    }
    for (let i = 0; i <= n; i++) { const a = -L / 2 + (L * i) / n; for (const e of [-hw, hw]) { const q = P(a, 0, e); const end = i === 0 || i === n; railsBy[e].push(...box(q[0], deckY(a), q[2], end ? 0.12 : 0.05, end ? 1.1 : 0.95, end ? 0.12 : 0.05, yaw)); } } // posts (newels at the ends)
    for (const s of [-1, 1]) { const q = P(s * (L / 2 + 0.4), 0, 0); landings.push({ polys: box(q[0], -0.4, q[2], 1.2, 0.48, w + 0.5, yaw), ctr: [q[0], -0.16, q[2]] }); } // stone landings
    // drawn in two parts so people on the deck sit between them: 'far' (deck, landings, the far rail) is painted
    // before the figures, 'near' (the rail on the camera's side) after them
    const eN = p.eNear ?? null, nearR = eN != null ? railsBy[eN > 0 ? hw : -hw] : [], farR = eN != null ? railsBy[eN > 0 ? -hw : hw] : [...railsBy[-hw], ...railsBy[hw]];
    if (p.part === 'near') { if (!Lv) fillPolys3(g, view, nearR, ink); else paint(nearR, 'rail', { solid: false }); }
    else {
      const rails = p.part === 'far' ? farR : [...railsBy[-hw], ...railsBy[hw]];
      if (!Lv) fillPolys3(g, view, [...deck.flatMap((d2) => d2.seg), ...rails, ...landings.flatMap((l) => l.polys)], ink);
      else {
        for (const l of landings) paint(l.polys, 'landing', { centre: l.ctr });
        deck.sort((A, B) => camD(B.ctr) - camD(A.ctr)).forEach((d2) => paint(d2.seg, 'deck', { centre: d2.ctr }));
        paint(rails, 'rail', { solid: false });
      }
    }
  } else if (p.kind === 'lamppost') {
    const [x, z] = p.at, h = p.h ?? 3.4;
    paint([...box(x, 0, z, 0.08, h, 0.08), ...box(x, h, z, 0.26, 0.05, 0.26), ...box(x, h - 0.32, z, 0.18, 0.3, 0.18)], 'post', { solid: false });
  } else if (p.kind === 'fence') {
    const pts = p.pts, h = p.h ?? 1.0, polys = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (p.gap ?? 1.4)));
      for (let k = 0; k <= n; k++) { const u = k / n; polys.push(...box(x0 + (x1 - x0) * u, 0, z0 + (z1 - z0) * u, 0.07, h, 0.07)); }
      for (const y of [h * 0.45, h * 0.85]) polys.push([[x0, y, z0], [x1, y, z1], [x1, y + 0.05, z1], [x0, y + 0.05, z0]]);
    }
    paint(polys, 'rail', { solid: false });
  } else if (p.kind === 'buildings') {
    // a row of houses/blocks along a line, seeded heights and roofs, some windows lit
    const r = rng((p.seed ?? 1) * 53), [x, z] = p.at, yaw = p.yaw ?? 0, c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
    let a = -(p.len ?? 40) / 2; const polys = [], wins = [], blds = []; let bi0 = 0;
    while (a < (p.len ?? 40) / 2) {
      const w = 4 + r() * 5, d = 5 + r() * 3, h = (p.h ?? 6) * (0.6 + r() * 0.8), cx = x + (a + w / 2) * c, cz = z - (a + w / 2) * sn;
      const P = (u, y, e) => [cx + u * c + e * sn, y, cz - u * sn + e * c];
      const walls = box(cx, 0, cz, w, h, d, yaw), roofs = []; polys.push(...walls);
      const roofed = r() < 0.6;
      if (roofed) { const gab = [[P(-w / 2, h, -d / 2), P(w / 2, h, -d / 2), P(0, h + w * 0.35, -d / 2)], [P(-w / 2, h, d / 2), P(w / 2, h, d / 2), P(0, h + w * 0.35, d / 2)]]; walls.push(...gab); roofs.push([P(-w / 2, h, -d / 2), P(0, h + w * 0.35, -d / 2), P(0, h + w * 0.35, d / 2), P(-w / 2, h, d / 2)], [P(w / 2, h, -d / 2), P(0, h + w * 0.35, -d / 2), P(0, h + w * 0.35, d / 2), P(w / 2, h, d / 2)]); polys.push(...gab, ...roofs); }
      blds.push({ walls, roofs, ctr: [cx, h * 0.6, cz], i: bi0, chimney: roofed && (bi0 * 7 + (p.seed ?? 1)) % 3 === 0 ? P(w * 0.2, h + w * 0.3, d * 0.1) : null, w, h });
      for (let row = 0; row < Math.floor(h / 2.6); row++) for (let col = 0; col < Math.floor(w / 1.6); col++) {
        const isLit = r() < (p.lit ?? 0.35); if (!isLit && !Lv) continue;
        const u = -w / 2 + 0.8 + col * 1.6, y = 1.2 + row * 2.6, Pw = (uu, yy) => [cx + uu * c + (-d / 2 - 0.02) * sn, yy, cz - uu * sn + (-d / 2 - 0.02) * c];
        wins.push({ poly: [Pw(u - 0.3, y), Pw(u + 0.3, y), Pw(u + 0.3, y + 0.8), Pw(u - 0.3, y + 0.8)], lit: isLit, k: bi0 * 31 + row * 7 + col });
      }
      a += w + 0.4 + r() * 1.5; bi0++;
    }
    if (!Lv) {
      fillPolys3(g, view, polys, ink);
      if (wins.length && (p.lit ?? 0.35) > 0) fillPolys3(g, view, wins.map((wn) => wn.poly), pal[p.color] || pal.lamp || pal.accent || '#e8c47a');
    } else {
      blds.sort((A, B) => camD(B.ctr) - camD(A.ctr));
      for (const b of blds) {
        paint(b.walls, 'wall', { centre: b.ctr, seed: b.i * 3 + 1 });
        if (b.chimney) paint(box(b.chimney[0], b.h, b.chimney[2], 0.6, b.w * 0.32 + 0.6, 0.6, yaw), 'chimney');
        if (b.roofs.length) paint(b.roofs, 'roof', { centre: b.ctr, seed: b.i * 5 + 2 });
        if (b.chimney && p.smoke !== false) drawSmoke(g, view, [b.chimney[0], b.h + b.w * 0.32 + 0.7, b.chimney[2]], 0.8, time, b.i + (p.seed ?? 1) * 11, Lv.lit('#e9e6e1', 0.8, camD(b.ctr)), scale);
      }
      // windows: glass by day; lit ones glow when it gets dark, and now and then one goes on or off
      const glass = Lv.lit(Lv.M.glass, 0.5, camD([x, 3, z])), light = pal[p.color] || pal.lamp || Lv.M.windowLight;
      fillPolys3(g, view, wins.map((wn) => wn.poly), glass);
      if (Lv.emit > 0.01) for (const wn of wins) {
        const life = smoothstep(-0.55, -0.35, noise3(time * 0.04 + wn.k * 0.37, wn.k * 1.3, 2.2));
        const on = (wn.lit ? life : 0) * Lv.emit; if (on > 0.02) fillPolys3(g, view, [wn.poly], hexA(light, 0.92 * on));
      }
    }
    if (p.fire) { // roofs catch one by one as the fire front passes
      const r2 = rng((p.seed ?? 1) * 53); let a2 = -(p.len ?? 40) / 2, bi = 0;
      while (a2 < (p.len ?? 40) / 2) {
        const w = 4 + r2() * 5, d = 5 + r2() * 3, h = (p.h ?? 6) * (0.6 + r2() * 0.8), cx = x + (a2 + w / 2) * c, cz = z - (a2 + w / 2) * sn;
        const roofed = r2() < 0.6; const roofH = roofed ? h + w * 0.35 : h;
        for (let row = 0; row < Math.floor(h / 2.6); row++) for (let col = 0; col < Math.floor(w / 1.6); col++) r2(); // keep the same random stream as above
        const lv = fireLevel(p.fire, cx, cz, wt);
        if (lv > 0.01) for (let k2 = 0; k2 < 3; k2++) { const u = (k2 - 1) * w * 0.3; drawFlame(g, view, [cx + u * c, roofed ? h + w * 0.35 * (1 - Math.abs(k2 - 1) * 0.6) : h, cz - u * sn], (p.fire.size ?? 3.2) * (0.8 + 0.4 * ((bi * 7 + k2 * 3) % 5) / 5), lv, time, bi * 3 + k2 + 1, pal, { smoke: k2 === 1 ? 1 : 0, scale }); }
        a2 += w + 0.4 + r2() * 1.5; bi++;
      }
    }
  } else if (p.kind === 'pillar') {
    const [x, z] = p.at, h = p.h ?? 4, r2 = p.r ?? 0.4, n = 12;
    const ring = (y) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * TAU) * r2, y, z + Math.sin((i / n) * TAU) * r2]);
    const lo = ring(0), hi = ring(h), polys = [];
    for (let i = 0; i < n; i++) polys.push([lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]]);
    polys.push(...box(x, h, z, r2 * 2.6, 0.25, r2 * 2.6));
    paint(polys, 'body', { solid: false });
  } else if (p.kind === 'arch') {
    const [x, z] = p.at, w = p.w ?? 3, h = p.h ?? 4, t = p.t ?? 0.45, yaw = p.yaw ?? 0, c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
    const P = (a, y) => [x + a * c, y, z - a * sn];
    const polys = [...box(x - (w / 2) * c, 0, z + (w / 2) * sn, t, h - w / 2, t, yaw), ...box(x + (w / 2) * c, 0, z - (w / 2) * sn, t, h - w / 2, t, yaw)];
    for (let i = 0; i < 12; i++) { const a0 = Math.PI - (i / 12) * Math.PI, a1 = Math.PI - ((i + 1) / 12) * Math.PI, R0 = w / 2 + t / 2, R1 = w / 2 - t / 2, b = h - w / 2;
      polys.push([P(Math.cos(a0) * R0, b + Math.sin(a0) * R0), P(Math.cos(a1) * R0, b + Math.sin(a1) * R0), P(Math.cos(a1) * R1, b + Math.sin(a1) * R1), P(Math.cos(a0) * R1, b + Math.sin(a0) * R1)]); }
    paint(polys, 'body', { solid: false });
  } else if (p.kind === 'bench') {
    const [x, z] = p.at, L = p.len ?? 1.6, yaw = p.yaw ?? 0, h = p.h ?? 0.45;
    const c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
    const polys = [...box(x, h - 0.05, z, L, 0.05, 0.4, yaw)];
    for (const e of [-L / 2 + 0.12, L / 2 - 0.12]) polys.push(...box(x + e * c, 0, z - e * sn, 0.06, h - 0.05, 0.34, yaw));
    if (p.back !== false) polys.push(...box(x - 0.18 * sn, h, z - 0.18 * c, L, 0.4, 0.04, yaw));
    paint(polys, 'seat', { solid: false });
  } else if (p.kind === 'table') {
    const [x, z] = p.at;
    paint(box(x, 0, z, p.w ?? 0.4, p.h ?? 0.5, p.d ?? 0.35, p.yaw ?? 0), 'top', { centre: [x, (p.h ?? 0.5) / 2, z] });
  } else if (p.kind === 'lamp') {
    const [x, y, z] = p.at;
    const polys = [...box(x, y, z, 0.05, 0.22, 0.05), ...box(x, y, z, 0.14, 0.02, 0.14)];
    // shade: a truncated cone as a billboard-ish box
    paint(polys, 'stand', { solid: false });
    const shade = box(x, y + 0.2, z, 0.22, 0.16, 0.22), lampOn = trackValue(p.on ?? 1, wt);
    if (Lv && lampOn > 0.02) fillPolys3(g, view, shade, mixC(Lv.lit(Lv.materialOf(p, 'shade'), 0.6, 3), mixC(pal[p.color] || pal.accent, '#fff4dc', 0.35), lampOn)); // the shade glows while it's on
    else paint(shade, 'shade', { solid: false });
  }
}

export function drawPropGlow(g, view, p, pal, wt, scale, feel) {
  if (p.kind === 'lamppost') {
    const Lv = pal._living;
    let on = trackValue(p.on ?? 1, wt) * (1 - (feel?.agitation || 0) * 0.35 * Math.max(0, Math.sin(wt * 23) * Math.sin(wt * 7.1)));
    if (Lv) on *= Lv.emit * (0.93 + 0.07 * noise3(wt * 6, (p.at[0] + p.at[1]) * 0.3, 1)); // lamps breathe a little
    if (on <= 0.01) return;
    const [x, z] = p.at, h = p.h ?? 3.4, c = view.project(x, h - 0.2, z);
    if (!c) return;
    const R = (3.2 * view.f) / c[2], col0 = pal[p.color] || pal.lamp || (Lv ? Lv.M.lampLight : null) || pal.accent || '#e8c47a', col = Lv ? mixC(col0, Lv.M.lampLight, 0.6) : col0; // living lamps burn warm
    if (Lv) { // a pool of light on the ground under the lamp
      const b = view.project(x, 0.01, z), bx = view.project(x + view.R[0] * 3.2, 0.01, z + view.R[2] * 3.2);
      const fh = Math.hypot(view.F[0], view.F[2]) || 1, bz = view.project(x + (view.F[0] / fh) * 3.2, 0.01, z + (view.F[2] / fh) * 3.2);
      if (b && bx && bz) {
        const rx = Math.max(2, Math.hypot(bx[0] - b[0], bx[1] - b[1])), ry = Math.max(1, Math.abs(bz[1] - b[1]) * 1.2);
        g.save(); g.globalCompositeOperation = 'screen'; g.translate(b[0], b[1]); g.scale(1, ry / rx);
        const pg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        pg.addColorStop(0, hexA(col, 0.42 * on)); pg.addColorStop(0.5, hexA(col, 0.14 * on)); pg.addColorStop(1, hexA(col, 0));
        g.fillStyle = pg; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
      }
    }
    g.save(); g.globalCompositeOperation = 'screen';
    const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], R);
    gr.addColorStop(0, hexA(col, 0.6 * on)); gr.addColorStop(0.2, hexA(col, 0.2 * on)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.fillRect(c[0] - R, c[1] - R, R * 2, R * 2); g.restore();
    fillPolys3(g, view, box(x, h - 0.3, z, 0.16, 0.26, 0.16), hexA(col, 0.95 * on));
    return;
  }
  if (p.kind !== 'lamp' || !pal.accent) return;
  pal = { ...pal, accent: pal[p.color] || pal.accent };
  const on = trackValue(p.on, wt);
  if (on <= 0.01) return;
  const [x, y, z] = p.at;
  if (pal._living) { // a room lit by one lamp: a big warm falloff on wall and floor
    const c0 = view.project(x, y + 0.25, z);
    if (c0) { const R0 = (5.5 * view.f) / c0[2]; g.save();
      if (pal._paneScr?.length >= 3) { g.beginPath(); g.rect(0, 0, view.W, view.H); pal._paneScr.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.clip('evenodd'); }
      g.globalCompositeOperation = 'screen'; const gr0 = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], R0); gr0.addColorStop(0, hexA(pal.accent, 0.5 * on)); gr0.addColorStop(0.35, hexA(pal.accent, 0.18 * on)); gr0.addColorStop(1, hexA(pal.accent, 0)); g.fillStyle = gr0; g.fillRect(c0[0] - R0, c0[1] - R0, R0 * 2, R0 * 2); g.restore(); }
  }
  const c = view.project(x, y + 0.28, z);
  if (!c) return;
  const R = (2.6 * view.f) / c[2];
  g.save();
  g.globalCompositeOperation = 'screen';
  const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], R);
  gr.addColorStop(0, hexA(pal.accent, 0.75 * on)); gr.addColorStop(0.25, hexA(pal.accent, 0.28 * on)); gr.addColorStop(1, hexA(pal.accent, 0));
  g.fillStyle = gr; g.fillRect(c[0] - R, c[1] - R, R * 2, R * 2);
  g.restore();
  // the lit shade itself
  g.fillStyle = hexA(pal.accent, on);
  fillPolys3(g, view, box(x, y + 0.2, z, 0.2, 0.15, 0.2), hexA(pal.accent, 0.9 * on));
}

// moonlight through a window falls on the floor as a pale parallelogram, crossed by the frame
export function drawMoonPatch(g, view, w, sky, pal, strength = 0.22) {
  if (!sky?.moon) return;
  const az = sky.moon.az * DEG, el = Math.max(8, sky.moon.elev) * DEG;
  const L = [-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)]; // travelling into the room
  const toFloor = (p) => { const t = -p[1] / L[1]; return [p[0] + L[0] * t, 0.002, p[2] + L[2] * t]; };
  const [cx, cy, cz] = w.at, hw = w.w / 2, hh = w.h / 2, m = (w.frame ?? 0.06) * 0.4;
  const quads = [[cx - hw, cx - m, cy - hh, cy - m], [cx + m, cx + hw, cy - hh, cy - m], [cx - hw, cx - m, cy + m, cy + hh], [cx + m, cx + hw, cy + m, cy + hh]];
  g.save(); g.globalAlpha = strength;
  fillPolys3(g, view, quads.map(([x0, x1, y0, y1]) => [[x0, y0, cz], [x1, y0, cz], [x1, y1, cz], [x0, y1, cz]].map(toFloor)), pal.pane || pal.paper);
  g.restore();
}

// keyed scalar: number, or [[t, v], ...] with smooth transitions (0.6 s)
export function trackValue(track, wt) {
  if (track == null) return 1;
  if (typeof track === 'number') return track;
  let v = track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [t, val, dur = 0.6] = track[i];
    if (wt >= t) v = lerp(v, val, smoothstep(t, t + dur, wt));
  }
  return v;
}

// ---------- strings, threads, kites, balloons and small held things ----------
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A string between two 3D points: it sags, and the wind moves it. `grow` (0..1) draws it on from A.
 *  `floor` keeps it on the land (a slack string lies along the ground). `pulses` = [{ t, fromA, amp }] are tugs:
 *  a ripple that runs along the string at `speed` m/s, lifting it as it passes — a message you can watch travel. */
export function drawThread(g, view, A, B, { sag = 0.06, wind = null, time = 0, width = 1, color, grow = 1, seed = 0, scale = 1, floor = null, pulses = null, speed = 15 } = {}) {
  const L = Math.hypot(...sub3(B, A));
  const n = Math.max(12, Math.min(80, Math.round(L * 3)));
  const wx = wind ? wind.x * wind.speed : 0.6, wz = wind ? wind.z * wind.speed : 0;
  const pts = [];
  for (let i = 0; i <= n * grow; i++) {
    const u = i / n, belly = 4 * u * (1 - u);
    const flutter = 0.05 * L * belly * noise3(u * 2.5 - time * 0.8, seed, time * 0.3);
    let y = A[1] + (B[1] - A[1]) * u - sag * L * belly;
    if (floor != null) y = Math.max(floor, y);
    if (pulses) for (const q of pulses) {
      const d = (time - q.t) * speed, at = q.fromA ? d : L - d, x = u * L - at;
      const life = Math.max(0, 1 - Math.max(0, d - L) / 3); // it arrives, and dies in the far hand
      y += (q.amp ?? 1) * 0.55 * life * Math.exp(-(x * x) / 1.6) * Math.min(1, d / 1.5 + 0.3);
    }
    pts.push(view.project(
      A[0] + (B[0] - A[0]) * u + wx * 0.012 * L * belly + flutter,
      y,
      A[2] + (B[2] - A[2]) * u + wz * 0.012 * L * belly + flutter * 0.6));
  }
  g.save(); g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = Math.max(0.8 * scale, width * scale);
  g.beginPath(); let started = false;
  for (const p of pts) { if (!p) { started = false; continue; } if (!started) { g.moveTo(p[0], p[1]); started = true; } else g.lineTo(p[0], p[1]); }
  g.stroke(); g.restore();
}

export function drawObject(g, view, def, st, pal, time, scale, anchor) {
  const col = pal[def.color || 'accent'] || def.color || pal.accent;
  const size = def.size ?? 1, p = st.pos3, w = st.wind || { x: 1, z: 0, speed: 3 };
  if (def.kind === 'kite') {
    // the kite faces back along its string; it rocks in the gusts
    let toA = anchor ? norm3(sub3(anchor, p)) : norm3([-w.x, -0.6, -w.z]);
    if (st.grounded) toA = norm3(toA.map((v, i) => v * 0.25 + (i === 1 ? -1 : 0))); // brought down: it lies on the land
    let R = norm3(cross3([0, 1, 0], toA)); if (!isFinite(R[0])) R = [1, 0, 0];
    const U = norm3(cross3(toA, R));
    const rock = 0.22 * noise3(time * 1.3, 4, 0) + (st.free ? 0.6 * Math.sin(time * 2.1) : 0);
    const cr = Math.cos(rock), sr = Math.sin(rock);
    const Rr = R.map((v, i) => v * cr + U[i] * sr), Ur = U.map((v, i) => U[i] * cr - R[i] * sr);
    const P = (a, b) => [p[0] + (Rr[0] * a + Ur[0] * b) * size, p[1] + (Rr[1] * a + Ur[1] * b) * size, p[2] + (Rr[2] * a + Ur[2] * b) * size];
    const top = P(0, 0.42), right = P(0.3, 0.1), bottom = P(0, -0.55), left = P(-0.3, 0.1);
    fillPolys3(g, view, [[top, right, bottom, left]], col);
    // spars, a shade darker
    const prj = (q) => view.project(...q);
    g.save(); g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = Math.max(0.6 * scale, (0.012 * size * view.f) / Math.max(0.5, view.toCam(...p)[2]));
    g.beginPath(); for (const [a, b] of [[top, bottom], [left, right]]) { const A = prj(a), B = prj(b); if (A && B) { g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); } } g.stroke(); g.restore();
    // tail: trails downwind and down, a wave running along it, with little bows
    const tail = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, wave = 0.12 * size * Math.sin(u * 7 - time * 7) * u;
      tail.push([bottom[0] + (w.x * 0.5 * u + Rr[0] * wave) * size * 1.6, bottom[1] - u * 1.3 * size, bottom[2] + (w.z * 0.5 * u + Rr[2] * wave) * size * 1.6]);
    }
    g.save(); g.strokeStyle = col; g.lineWidth = Math.max(0.8 * scale, (0.012 * size * view.f) / Math.max(0.5, view.toCam(...p)[2]));
    g.beginPath(); let s0 = false; for (const q of tail) { const s1 = view.project(...q); if (!s1) continue; if (!s0) { g.moveTo(s1[0], s1[1]); s0 = true; } else g.lineTo(s1[0], s1[1]); } g.stroke(); g.restore();
    for (let i = 4; i <= 16; i += 4) { const q = tail[i]; fillPolys3(g, view, [[[q[0] + Rr[0] * 0.07 * size, q[1] + 0.03 * size, q[2] + Rr[2] * 0.07 * size], [q[0], q[1] - 0.02 * size, q[2]], [q[0] - Rr[0] * 0.07 * size, q[1] + 0.03 * size, q[2] - Rr[2] * 0.07 * size]]], col); }
    return { bridle: P(0, -0.05) };
  }
  if (def.kind === 'balloon' || def.kind === 'ball' || def.kind === 'lantern' || def.kind === 'flower' || def.kind === 'object') {
    const cam = view.cam, vx = p[0] - cam.pos[0], vz = p[2] - cam.pos[2], az = Math.atan2(vx, vz);
    const Rx = Math.cos(az), Rz = -Math.sin(az);
    const B = (a, b) => [p[0] + Rx * a * size, p[1] + b * size, p[2] + Rz * a * size];
    const ring = (cx, cy, rx, ry, n = 20) => Array.from({ length: n }, (_, i) => { const t = (i / n) * TAU; return B(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry); });
    if (def.kind === 'balloon') { fillPolys3(g, view, [ring(0, 0.2, 0.15, 0.19), [B(-0.025, 0.0), B(0.025, 0.0), B(0, 0.03)]], col); return { bridle: B(0, -0.01) }; }
    if (def.kind === 'ball') { fillPolys3(g, view, [ring(0, 0, 0.11, 0.11)], col); return { bridle: p }; }
    if (def.kind === 'flower') { fillPolys3(g, view, [[B(-0.006, 0), B(0.006, 0), B(0.006, 0.28), B(-0.006, 0.28)]], pal.ink); fillPolys3(g, view, [ring(0, 0.3, 0.045, 0.045, 12)], col); return { bridle: p }; }
    if (def.kind === 'lantern') {
      const c = view.project(...B(0, 0.12));
      if (c) { const R = (0.9 * view.f) / c[2]; const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], R); gr.addColorStop(0, hexA(col, 0.55)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(c[0] - R, c[1] - R, R * 2, R * 2); }
      fillPolys3(g, view, [ring(0, 0.12, 0.08, 0.11)], col); return { bridle: B(0, 0.24) };
    }
    if (def.shape === 'case') { const c2 = pal[def.color || 'ink'] || pal.ink; fillPolys3(g, view, [[B(-0.2, -0.3), B(0.2, -0.3), B(0.2, 0), B(-0.2, 0)], [B(-0.06, 0), B(0.06, 0), B(0.06, 0.05), B(-0.06, 0.05)]], c2); return { bridle: B(0, 0.04) }; }
    fillPolys3(g, view, [ring(0, 0.06, 0.08, 0.06)], col); return { bridle: p };
  }
  return { bridle: p };
}

// ---------- water: a river's surface, filled pale, with dashes that travel downstream ----------
export function riverGeometry(r) {
  const pts = splinePointsXZ(r.pts, 0.6), hw = (r.width ?? 8) / 2, out = { left: [], right: [], strands: [] };
  const norms = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; return [-tz / l, tx / l]; });
  pts.forEach((p, i) => { out.left.push([p[0] + norms[i][0] * hw, p[1] + norms[i][1] * hw]); out.right.push([p[0] - norms[i][0] * hw, p[1] - norms[i][1] * hw]); });
  const n = Math.max(3, Math.round((hw * 2) / (r.spacing ?? 0.45)));
  for (let j = 1; j < n; j++) {
    const o = -hw + (2 * hw * j) / n, arr = [];
    const edge = 1 - Math.pow(Math.abs(o) / hw, 2);
    pts.forEach((p, i) => arr.push(p[0] + norms[i][0] * o, p[1] + norms[i][1] * o, (r.tone ?? 0.5) * (0.35 + 0.65 * edge)));
    out.strands.push({ pts: Float32Array.from(arr), sp: (2 * hw) / n, imp: j % 2 ? 0 : 3, seed: j * 0.37, flow: (r.flow ?? 0.8) * (0.6 + 0.6 * edge), dash: r.dash ?? 2.2, water: true });
  }
  return out;
}
function splinePointsXZ(ctrl, step) {
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) { const t = j / n, t2 = t * t, t3 = t2 * t, p0 = pts[i - 1], p3 = pts[i + 2];
      out.push([0, 1].map((k) => 0.5 * (2 * a[k] + (-p0[k] + b[k]) * t + (2 * p0[k] - 5 * a[k] + 4 * b[k] - p3[k]) * t2 + (-p0[k] + 3 * a[k] - 3 * b[k] + p3[k]) * t3))); }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
// a band of the river between fractions e0..e1 of its width (0 = left bank, 1 = right bank), in overlapping pieces
// so the near-plane clip never collapses a long river
export function waterBand(geo, e0, e1) {
  const L = geo.left, R = geo.right, quads = [], at = (i, e) => [L[i][0] + (R[i][0] - L[i][0]) * e, 0.001, L[i][1] + (R[i][1] - L[i][1]) * e];
  for (let i = 0; i < L.length - 1; i += 6) {
    const j = Math.min(L.length - 1, i + 7), a = [], b = [];
    for (let k = i; k <= j; k++) { a.push(at(k, e0)); b.push(at(k, e1)); }
    quads.push([...a, ...b.reverse()]);
  }
  return quads;
}

/**
 * Water that reads as water: a colour of its own, deeper at the banks and paler mid-stream (the sky in it), mirrored
 * reflections of what stands on its banks (`reflect`: props), lights drawn out into rippling streaks, and glints that
 * drift downstream. opts = { time, flow, light, pal, reflect: [props], lamps: [{ at:[x,y,z], color }], scale, wind }
 */
export function drawWaterFill(g, view, geo, color, opts = {}) {
  const { time = 0, flow = 0.7, pal = {}, scale = 1 } = opts;
  fillPolys3(g, view, waterBand(geo, 0, 1), color);
  if (!opts.rich) return;
  const light = opts.light || pal.paper || '#ffffff';
  const mix = (a, b, t) => { const A = parseInt(a.slice(1, 7), 16), B = parseInt(b.slice(1, 7), 16), m = (s2) => Math.round(((A >> s2) & 255) * (1 - t) + ((B >> s2) & 255) * t); return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1); };
  // paler toward mid-stream in many small steps (a gradient, not stripes)
  g.save(); g.globalAlpha = 0.09; const pale = mix(color, light, 0.55);
  for (let k = 1; k <= 8; k++) fillPolys3(g, view, waterBand(geo, 0.055 * k, 1 - 0.055 * k), pale);
  g.restore();
  // everything below happens only on the water
  g.save();
  g.beginPath();
  for (const poly of waterBand(geo, 0, 1)) { const scr = clipProject(view, poly); if (scr.length < 3) continue; g.moveTo(scr[0][0], scr[0][1]); for (let i = 1; i < scr.length; i++) g.lineTo(scr[i][0], scr[i][1]); g.closePath(); }
  g.clip('nonzero');
  // reflections: the banks' silhouettes, upside down, faint and broken by ripples
  if (opts.reflect?.length) {
    const mv = { ...view, toCam: (x, y, z) => view.toCam(x, -y, z), project: (x, y, z) => view.project(x, -y, z) };
    g.globalAlpha = 0.24;
    const dim = { ...pal, ink: mix(pal.ink || '#111111', color, 0.35) };
    for (const p of opts.reflect) drawProp(g, mv, { ...p, lit: 0, fire: null }, dim, time, time, scale, null);
    g.globalAlpha = 1;
    // ripple lines in the water's own colour cut through the reflection, so it shimmers instead of mirroring
    g.strokeStyle = color; g.lineWidth = 1.6 * scale;
    const L = geo.left, R = geo.right;
    for (let i = 0; i < L.length - 1; i += 2) for (let r2 = 0; r2 < 3; r2++) {
      const e = ((i * 0.618 + r2 * 0.37 + time * 0.05) % 1), k = Math.min(L.length - 1, i + 2);
      const A = view.project(L[i][0] + (R[i][0] - L[i][0]) * e, 0.002, L[i][1] + (R[i][1] - L[i][1]) * e), B = view.project(L[k][0] + (R[k][0] - L[k][0]) * e, 0.002, L[k][1] + (R[k][1] - L[k][1]) * e);
      if (A && B) { g.globalAlpha = 0.5; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    }
    g.globalAlpha = 1;
  }
  // lights drawn out into rippling streaks below their mirrored image
  for (const lp of opts.lamps || []) {
    const top = view.project(lp.at[0], -lp.at[1], lp.at[2]), base = view.project(lp.at[0], 0, lp.at[2]);
    if (!top || !base) continue;
    const ppm = view.f / top[2], n = 9;
    g.fillStyle = lp.color;
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1), y = base[1] + (top[1] - base[1]) * (0.15 + 0.95 * u);
      const w = ppm * (0.18 + 0.35 * u) * (0.6 + 0.4 * Math.sin(time * 3.1 + k * 1.7 + lp.at[0])), x = top[0] + ppm * 0.08 * Math.sin(time * 2.3 + k * 2.1);
      g.globalAlpha = 0.55 * (1 - 0.6 * u); g.fillRect(x - w / 2, y - Math.max(1, ppm * 0.03), w, Math.max(1.2 * scale, ppm * 0.06));
    }
  }
  // glints of sky light drifting downstream
  {
    const L = geo.left, R = geo.right, total = L.length, rr = rng(17), m = Math.min(160, Math.round(total * 0.5));
    g.strokeStyle = light; g.lineCap = 'round';
    for (let k = 0; k < m; k++) {
      const e = 0.1 + rr() * 0.8, len = 1 + Math.floor(rr() * 2), sp = 0.6 + rr() * 0.8, ph = rr();
      const pos = ((ph * total + (time * flow * sp * 1.6) / 0.6) % total + total) % total, i = Math.floor(pos), j = Math.min(total - 1, i + len);
      if (j <= i) continue;
      const P = (q) => view.project(L[q][0] + (R[q][0] - L[q][0]) * e, 0.003, L[q][1] + (R[q][1] - L[q][1]) * e);
      const A = P(i), B = P(j); if (!A || !B) continue;
      g.globalAlpha = 0.35 + 0.3 * Math.sin(time * 2 + k);
      g.lineWidth = Math.max(0.8 * scale, Math.min(3 * scale, (view.f / A[2]) * 0.05));
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    }
  }
  g.restore();
}

// height of walkable surfaces (bridge decks) at a point — people and dropped things stand on them
export function groundHeightAt(props, x, z) {
  for (const p of props || []) {
    if (p.kind === 'rock' && Math.hypot(x - p.at[0], z - p.at[1]) < (p.r ?? 4) * 0.55 * (p.flat ?? 1)) return (p.h ?? 6) * 0.97;
    if (p.kind !== 'bridge') continue;
    const L = p.len ?? 12, w = p.w ?? 1.8, rise = p.rise ?? 1.2, c = Math.cos((p.yaw ?? 0) * DEG), sn = Math.sin((p.yaw ?? 0) * DEG);
    const dx = x - p.at[0], dz = z - p.at[1], a = dx * c - dz * sn, e = dx * sn + dz * c;
    if (Math.abs(a) < L / 2 && Math.abs(e) < w / 2 + 0.15) return rise * (1 - Math.pow((2 * a) / L, 2)) + 0.05;
  }
  return 0;
}
