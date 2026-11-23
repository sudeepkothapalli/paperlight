// Small, dependency-free math kit: seeded RNG, value/gradient noise, easing, splines.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t));

// ---------- seeded RNG ----------
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.gauss = () => {
    const u = Math.max(1e-9, next()), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  return next;
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- noise (2D/3D gradient noise, deterministic) ----------
const PERM = new Uint8Array(512);
{
  const r = rng(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad3(h, x, y, z) {
  const u = (h & 15) < 8 ? x : y;
  const v = (h & 15) < 4 ? y : ((h & 15) === 12 || (h & 15) === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  return lerp(
    lerp(lerp(grad3(PERM[AA], x, y, z), grad3(PERM[BA], x - 1, y, z), u),
      lerp(grad3(PERM[AB], x, y - 1, z), grad3(PERM[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad3(PERM[AA + 1], x, y, z - 1), grad3(PERM[BA + 1], x - 1, y, z - 1), u),
      lerp(grad3(PERM[AB + 1], x, y - 1, z - 1), grad3(PERM[BB + 1], x - 1, y - 1, z - 1), u), v),
    w);
}
export const noise2 = (x, y) => noise3(x, y, 0.5);
export function fbm(x, y, oct = 4, z = 0) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z + i * 17.3); f *= 2.03; a *= 0.5; }
  return s; // ~[-0.6, 0.6]
}

// ---------- easing ----------
export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // slow, film-like: long acceleration, long settle
  glide: (t) => { const s = smoothstep(0, 1, t); return smoothstep(0, 1, s); },
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
};
export const getEase = (e) => (typeof e === 'function' ? e : ease[e || 'inOut'] || ease.inOut);

// ---------- splines ----------
export function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return p1.map((_, i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

// Sample a Catmull-Rom spline through control points at ~`step` spacing (any dimension).
export function splinePoints(ctrl, step = 0.5) {
  if (ctrl.length < 2) return ctrl.slice();
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(...a.map((v, k) => b[k] - v));
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < n; j++) out.push(catmull(pts[i - 1], a, b, pts[i + 2], j / n));
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(...pts[i].map((v, k) => v - pts[i - 1][k]));
  return L;
}

// Arc-length parametrised polyline: returns {length, at(s) -> point, dirAt(s) -> unit vector}
export function arcPath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(...pts[i].map((v, k) => v - pts[i - 1][k])));
  const length = cum[cum.length - 1];
  const locate = (s) => {
    s = clamp(s, 0, length);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1;
    return [lo, hi, (s - cum[lo]) / seg];
  };
  return {
    length, pts,
    at(s) { const [a, b, t] = locate(s); return pts[a].map((v, k) => lerp(v, pts[b][k], t)); },
    dirAt(s) {
      const [a, b] = locate(s);
      const d = pts[b].map((v, k) => v - pts[a][k]);
      const l = Math.hypot(...d) || 1;
      return d.map((v) => v / l);
    },
  };
}

// Interpolate a value that may be a scalar, an array [from,to], or {from,to,ease}.
export function animParam(v, u, defEase = 'inOut') {
  if (v == null) return v;
  if (Array.isArray(v) && v.length === 2 && Array.isArray(v[0]) && Array.isArray(v[1])) {
    const t = getEase(defEase)(u);
    return v[0].map((x, i) => lerp(x, v[1][i], t));
  }
  if (Array.isArray(v) && v.length === 2 && typeof v[0] !== 'object') {
    const t = getEase(defEase)(u);
    if (typeof v[0] === 'number') return lerp(v[0], v[1], t);
    return t < 0.5 ? v[0] : v[1];
  }
  if (typeof v === 'object' && !Array.isArray(v) && 'from' in v) {
    const t = getEase(v.ease || defEase)(clamp((u - (v.start ?? 0)) / ((v.end ?? 1) - (v.start ?? 0))));
    if (typeof v.from === 'number') return lerp(v.from, v.to, t);
    if (Array.isArray(v.from)) return v.from.map((x, i) => lerp(x, v.to[i], t));
    return t < 0.5 ? v.from : v.to;
  }
  return v;
}

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
