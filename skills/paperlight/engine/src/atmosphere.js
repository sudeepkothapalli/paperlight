// Seasons & weather. Time passing is told through the paper itself:
//   • paper and ink shift tone (warm autumn, cool winter, fresh spring, bright summer)
//   • a pale wash sits in the sky (never more than ~12% opacity)
//   • weather is drawn in the style: leaves as small tumbling flecks, snow as paper-coloured
//     flakes that also half-bury the ink lines, rain as fine slanted hairlines, summer dust motes
// Season colours are tones, not accents: the film's accent stays the only saturated colour.

import { rng, noise3, smoothstep, clamp, lerp, TAU } from './math.js';

export const SEASONS = {
  none: {},
  autumn: {
    paper: '#f3ebdc', ink: '#17120d',
    wash: { top: '#d49a55', topA: 0.11, bottom: '#c98a4a', bottomA: 0.03 },
    weather: { type: 'leaves', count: 420, color: '#8a6a43', wind: 1.4 },
    sound: { wind: 1.35, gusts: 1.4 },
  },
  winter: {
    paper: '#eef0ef', ink: '#1c2026',
    wash: { top: '#8ea3b8', topA: 0.13, bottom: '#c3ced8', bottomA: 0.05 },
    weather: { type: 'snow', count: 3200, wind: 0.5 },
    cover: 0.85, lineWeight: 0.7,
    sun: { elev: 34 }, shadowAlpha: 0.55,
    sound: { wind: 0.55, muffle: 0.6, drone: 0.8 },
  },
  spring: {
    paper: '#eef0e5', ink: '#16180f',
    wash: { top: '#9fb68a', topA: 0.1, bottom: '#c9d6b4', bottomA: 0.04 },
    weather: { type: 'rain', count: 2600, wind: 1.0 },
    shadowAlpha: 0.45,
    sound: { wind: 0.7, rain: 1, birds: 1 },
  },
  summer: {
    paper: '#f6efdc', ink: '#15110a',
    wash: { top: '#e3b462', topA: 0.12, bottom: '#efcf8a', bottomA: 0.05 },
    weather: { type: 'motes', count: 350, wind: 0.3 },
    sun: { elev: 20 },
    sound: { wind: 0.5, insects: 1 },
  },
};

export function resolveSeason(spec, film) {
  if (!spec) return null;
  if (typeof spec === 'string') return { name: spec, ...(SEASONS[spec] || {}), ...(film.seasons?.[spec] || {}) };
  const base = spec.base ? SEASONS[spec.base] || {} : {};
  return { name: spec.base || 'custom', ...base, ...spec, weather: { ...(base.weather || {}), ...(spec.weather || {}) } };
}

export function drawWash(g, W, H, wash) {
  if (!wash) return;
  const gr = g.createLinearGradient(0, 0, 0, H);
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  gr.addColorStop(0, rgba(wash.top, wash.topA ?? 0.1));
  gr.addColorStop(0.55, rgba(wash.bottom || wash.top, ((wash.topA ?? 0.1) + (wash.bottomA ?? 0.03)) / 2.2));
  gr.addColorStop(1, rgba(wash.bottom || wash.top, wash.bottomA ?? 0.03));
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.restore();
}

// Particles live in world space inside a box that travels with the camera's point of interest,
// wrapping around, so the camera can move through weather with real parallax.
const particleCache = new Map();
function particles(type, count, seed) {
  const key = `${type}:${count}:${seed}`;
  if (particleCache.has(key)) return particleCache.get(key);
  const r = rng(seed * 7919 + count);
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({ x: r(), y: r(), z: r(), s: 0.6 + r() * 0.8, ph: r() * TAU, sp: 0.75 + r() * 0.5, k: r() });
  }
  particleCache.set(key, arr);
  return arr;
}

export function drawWeather(g, view, weather, wt, palette, scale, seed = 1) {
  if (!weather || !weather.type || weather.type === 'none') return;
  const { cam, W, H, f } = view;
  const F = view.F;
  // centre of the weather box: ahead of the camera, but never below the ground
  // high cameras: the box sits on the ground where the camera looks; low ones: just ahead of the lens
  let ahead = 10;
  if (F[1] < -0.05) { const ground = (cam.pos[1] - 0.3) / -F[1]; ahead = Math.min(ground, Math.max(10, ground - 8)); }
  const BX = weather.box ?? 26, BY = weather.boxY ?? 12, BZ = BX;
  const cx = cam.pos[0] + F[0] * ahead, cz = cam.pos[2] + F[2] * ahead;
  const cy = Math.max(BY / 2 - 1, cam.pos[1] + F[1] * ahead);
  const wind = weather.wind ?? 1;
  const list = particles(weather.type, weather.count ?? 500, seed);
  const wrap = (v, c, B) => c + ((((v - c + B / 2) % B) + B) % B) - B / 2;
  const t = wt;
  const ink = palette.ink, paper = palette.paper;
  g.save();
  g.lineCap = 'round';
  for (const p of list) {
    let x, y, z, size;
    if (weather.type === 'snow') {
      x = p.x * BX + t * wind * 0.5 * p.sp + 0.35 * Math.sin(t * 0.7 * p.sp + p.ph);
      y = (1 - p.y) * BY - t * 0.9 * p.sp;
      z = p.z * BZ + 0.3 * Math.cos(t * 0.6 + p.ph);
      size = 0.016 * p.s;
    } else if (weather.type === 'rain') {
      x = p.x * BX + t * wind * 1.6; y = (1 - p.y) * BY - t * 8.5 * p.sp; z = p.z * BZ; size = 0.0022;
    } else if (weather.type === 'leaves') {
      x = p.x * BX + t * wind * 1.1 * p.sp + 0.9 * Math.sin(t * 0.9 * p.sp + p.ph);
      y = (1 - p.y) * BY - t * 0.75 * p.sp + 0.3 * Math.sin(t * 1.7 + p.ph);
      z = p.z * BZ + 0.6 * Math.cos(t * 0.8 + p.ph);
      size = 0.045 * p.s;
    } else if (weather.type === 'embers') { // sparks rising from a fire, drifting downwind
      x = p.x * BX + t * wind * 0.9 + 0.4 * Math.sin(t * 1.3 * p.sp + p.ph);
      y = p.y * BY + t * 1.7 * p.sp;
      z = p.z * BZ + 0.3 * Math.cos(t * 0.9 + p.ph);
      size = 0.012 * p.s;
    } else { // motes
      x = p.x * BX + t * wind * 0.25 + 0.3 * Math.sin(t * 0.3 + p.ph);
      y = p.y * BY + t * 0.08 * p.sp + 0.2 * Math.sin(t * 0.5 + p.ph * 2);
      z = p.z * BZ + 0.3 * Math.cos(t * 0.4 + p.ph);
      size = 0.006 * p.s;
    }
    x = wrap(x, cx, BX); z = wrap(z, cz, BZ); y = wrap(y, cy, BY);
    if (y < 0) continue;
    const pr = view.project(x, y, z);
    if (!pr) continue;
    const [sx, sy, depth] = pr;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
    // fade at the edges of the box so wrapping never pops
    const edge = Math.min(BX / 2 - Math.abs(x - cx), BZ / 2 - Math.abs(z - cz), BY / 2 - Math.abs(y - cy));
    const fade = smoothstep(0, 2, edge) * (1 - smoothstep(22, 40, depth));
    if (fade <= 0.01) continue;
    const px = (size * f) / depth;
    if (weather.type === 'snow') {
      const r = clamp(px, 0.5 * scale, 9 * scale);
      g.globalAlpha = fade * 0.95;
      g.fillStyle = '#fbfcfc';
      g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
      g.globalAlpha = fade * 0.2;
      g.strokeStyle = ink; g.lineWidth = Math.max(0.4, r * 0.25);
      g.stroke();
    } else if (weather.type === 'rain') {
      const len = (0.2 * f) / depth; // 8.5 m/s over a 1/48 s shutter
      const dx = len * 0.18 * wind, dy = len;
      g.globalAlpha = fade * 0.42;
      g.strokeStyle = ink; g.lineWidth = Math.max(0.5 * scale, px);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - dx, sy - dy); g.stroke();
    } else if (weather.type === 'leaves') {
      const r = clamp(px, 0.6 * scale, 16 * scale);
      const ang = t * 2.2 * p.sp + p.ph, flip = Math.abs(Math.sin(t * 3 * p.sp + p.ph));
      g.globalAlpha = fade * 0.85;
      g.fillStyle = p.k < 0.25 ? ink : weather.color || '#93683f';
      g.save(); g.translate(sx, sy); g.rotate(ang);
      g.beginPath();
      g.moveTo(-r, 0); g.quadraticCurveTo(0, -r * 0.55 * flip - 0.2, r, 0); g.quadraticCurveTo(0, r * 0.55 * flip + 0.2, -r, 0);
      g.fill(); g.restore();
    } else if (weather.type === 'embers') {
      const r = clamp(px, 0.8 * scale, 5 * scale);
      g.globalAlpha = fade * (0.55 + 0.45 * Math.sin(t * 9 * p.sp + p.ph * 3));
      g.fillStyle = p.k < 0.5 ? (palette.fire2 || '#f08a35') : (palette.fireCore || '#fbd37c');
      g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
    } else {
      const r = clamp(px, 0.7 * scale, 4 * scale);
      g.globalAlpha = fade * (0.5 + 0.3 * Math.sin(t * 2 + p.ph));
      g.fillStyle = '#fff6dc';
      g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
    }
  }
  g.restore();
}

// snow cover: patchy, so the lines look half-buried rather than uniformly faded
export function coverFn(cover) {
  if (!cover) return null;
  return (x, z) => 1 - cover * smoothstep(-0.6, 0.15, noise3(x * 0.09, z * 0.09, 7.7) + 0.4 * noise3(x * 0.5, z * 0.5, 3.1));
}

// One wind for the whole world: kites, threads, coats, weather all read it.
// film.air = { dir: degrees the wind blows toward (0 = north/+z), speed: m/s, gust: 0..1 }; a shot may override.
export function windAt(air, wt) {
  const a = { dir: 90, speed: 3, gust: 0.35, ...(air || {}) };
  const wander = 10 * noise3(wt * 0.05, 1.7, 3) * (Math.PI / 180);
  const d = a.dir * (Math.PI / 180) + wander;
  let speed = a.speed * (1 + a.gust * (0.55 * noise3(wt * 0.45, 4.2, 1) + 0.25 * noise3(wt * 1.7, 2.2, 5)));
  // story gusts: air.gusts = [[t, strength, dur]] — a sudden push of wind you can stage (and hear, and see in coats)
  let g = 0;
  for (const [t0, k, dur = 1.5] of a.gusts || []) if (wt > t0 && wt < t0 + dur) g += k * Math.sin(Math.PI * (wt - t0) / dur) ** 2;
  speed *= 1 + g;
  return { x: Math.sin(d), z: Math.cos(d), speed: Math.max(0, speed), gust: g };
}

export function mixHex(a, b, t) {
  if (!a) return b; if (!b) return a;
  const A = parseInt(a.slice(1, 7), 16), B = parseInt(b.slice(1, 7), 16);
  const m = (sh) => Math.round(lerp((A >> sh) & 255, (B >> sh) & 255, t));
  return '#' + [m(16), m(8), m(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function greyOf(hex) {
  const n = parseInt(hex.slice(1, 7), 16), l = Math.round(0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255));
  return '#' + [l, l, l].map((v) => v.toString(16).padStart(2, '0')).join('');
}
// a mood part-way between two moods: colours mix, numbers interpolate, weather cross-fades
export function blendMoods(A, B, u) {
  A = A || {}; B = B || {};
  const out = { name: `${A.name}→${B.name}` };
  for (const k of ['paper', 'ink', 'line', 'pane', 'cloud', 'star', 'moon', 'sky', 'accent']) if (A[k] || B[k]) out[k] = mixHex(A[k], B[k], u);
  out._paperA = A.paper; out._paperB = B.paper; out._u = u;
  if (!A.paper || !B.paper) { delete out._paperA; delete out._paperB; }
  for (const k of ['shadowAlpha', 'cover', 'lineWeight']) if (A[k] != null || B[k] != null) out[k] = lerp(A[k] ?? (k === 'shadowAlpha' || k === 'lineWeight' ? 1 : 0), B[k] ?? (k === 'shadowAlpha' || k === 'lineWeight' ? 1 : 0), u);
  if (A.wash || B.wash) {
    const a = A.wash || { top: B.wash.top, topA: 0, bottom: B.wash.bottom, bottomA: 0 }, b = B.wash || { top: a.top, topA: 0, bottom: a.bottom, bottomA: 0 };
    out.wash = { top: mixHex(a.top, b.top, u), topA: lerp(a.topA ?? 0.1, b.topA ?? 0.1, u), bottom: mixHex(a.bottom || a.top, b.bottom || b.top, u), bottomA: lerp(a.bottomA ?? 0.03, b.bottomA ?? 0.03, u) };
  }
  if (A.sun || B.sun) { const a = A.sun || B.sun, b = B.sun || A.sun; out.sun = { az: lerp(a.az ?? 140, b.az ?? 140, u), elev: lerp(a.elev ?? 24, b.elev ?? 24, u) }; }
  const wa = A.weather, wb = B.weather;
  if (wa?.type && wb?.type && wa.type === wb.type) out.weather = { ...wb, count: Math.round(lerp(wa.count ?? 500, wb.count ?? 500, u)) };
  else if (u < 0.5 && wa?.type) out.weather = { ...wa, count: Math.round((wa.count ?? 500) * (1 - 2 * u)) };
  else if (wb?.type) out.weather = { ...wb, count: Math.round((wb.count ?? 500) * (2 * u - 1)) };
  out.sound = B.sound || A.sound;
  return out;
}

// push a colour further from grey (saturation above 1)
export function extrapolate(grey, hex, k) {
  const A = parseInt(grey.slice(1, 7), 16), B = parseInt(hex.slice(1, 7), 16);
  const m = (sh) => Math.max(0, Math.min(255, Math.round(((A >> sh) & 255) + (((B >> sh) & 255) - ((A >> sh) & 255)) * k)));
  return '#' + [m(16), m(8), m(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
