// THE LIVING LOOK — a world in colour around ink-silhouette characters.
//
// The classic look paints everything in ink on toned paper. The living look keeps the characters as ink silhouettes
// (the signature) and gives the world real materials, lit by a time of day:
//
//   film.look = 'living'  (or set.look)          turn it on
//   film.light / set.light / shot.light          'morning' | 'noon' | 'golden' | 'dusk' | 'night' | 'overcast'
//                                                 or { from: 'golden', to: 'dusk', start, end } across a shot
//   set.ground = 'grass' | 'meadow' | 'earth' | 'sand' | 'snow' | 'pavement' | 'stone' | 'sea' | 'board'
//   film.materials / set.materials = { grass: '#…', roof: ['#…', …], … }   override any preset
//   a prop can name its own: { kind: 'house', wall: 'brick', roof: '#…' }
//
// Colour comes from three places, in this order of loudness: LIGHT (lamps, windows, sun, fire — the brightest, warmest
// things in frame), MEANING (film.colors motifs), and MATERIAL (soft, natural, lit and hazed — never louder than light).
// Every material is multiplied by the light's colour, shaded by which way its face points, and hazed into the sky with
// distance, so a whole scene changes together when the time of day does.

export const MATERIALS = {
  // ground
  grass: '#6a8a4a', meadow: '#8aa35c', earth: '#86694c', sand: '#d8c398', snow: '#eef1f5', pavement: '#b5a68e',
  stone: '#a39d92', sea: '#4f7aa0', board: '#8a6a4c',
  // surfaces
  water: '#5d87ab', wood: '#7b5a3d', darkwood: '#5a4130', iron: '#2b2d32', sandstone: '#c8a46e', gold: '#c9a048',
  brick: '#9f5a42', rock: '#8e877c',
  plaster: ['#eadcc3', '#dcc4a0', '#cfbb9d', '#e6d2ae', '#c2ae93', '#d9b99a', '#b9a898'],
  roof: ['#8b4a36', '#5e5b65', '#7a3e2d', '#4f4b4d', '#9b5c3e', '#6a4a3e'],
  bark: '#4c3a2b',
  foliage: ['#4e7a39', '#5f8b42', '#416c35', '#6d9046', '#577f3c'],
  autumn: ['#c2762f', '#a9532b', '#d29b3d', '#b8662c'],
  blossom: ['#e8b9c4', '#f0cdd3', '#dca2b2'],
  lampLight: '#ffcf70', windowLight: '#ffd27e', glass: '#39414b',
  // interiors
  wallpaper: '#d9cdb8', floorboard: '#8d6a4b', fabric: ['#c9d3e6', '#e7d7c4', '#d7c3d0'], curtain: '#c7a98c', frame: '#ece5d8', shade: '#f1e3c4',
  // dreams
  cloudsea: '#f2eff7',
};

// time of day: the sky, the colour of the light, how much of it there is, haze, and whether lamps and windows are on
export const LIGHTS = {
  morning:  { skyTop: '#93bde3', skyHorizon: '#f4e3c9', light: '#fff0da', ambient: 0.8, haze: '#ebe3d6', hazeDist: 150, emit: 0, shadow: 0.42, sun: '#fff1cf', ink: '#17181c', stars: 0 },
  noon:     { skyTop: '#78ade2', skyHorizon: '#d9e8f3', light: '#ffffff', ambient: 0.86, haze: '#d8e5ef', hazeDist: 190, emit: 0, shadow: 0.5, sun: '#fffbe9', ink: '#16171b', stars: 0 },
  golden:   { skyTop: '#86a3cf', skyHorizon: '#f4bf7c', light: '#ffd8a0', ambient: 0.76, haze: '#efc795', hazeDist: 125, emit: 0.2, shadow: 0.56, sun: '#ffd27a', ink: '#1b1611', stars: 0 },
  dusk:     { skyTop: '#46598c', skyHorizon: '#e7a47d', light: '#c9b6c6', ambient: 0.58, haze: '#a395ad', hazeDist: 150, emit: 1, shadow: 0.22, sun: '#f0a46a', ink: '#141319', stars: 0.25 },
  night:    { skyTop: '#121b38', skyHorizon: '#38486f', light: '#7f91c2', ambient: 0.34, haze: '#2f3c61', hazeDist: 70, emit: 1, shadow: 0.12, sun: '#cdd6ee', ink: '#0b0c12', stars: 1 },
  // dreams: pastel, soft, nearly shadowless; a deep-blue dream night for falling asleep into
  dream:    { skyTop: '#8d9fd8', skyHorizon: '#f2dce7', light: '#fff5fa', ambient: 0.86, haze: '#efe0ee', hazeDist: 230, emit: 0, shadow: 0.25, sun: '#ffe6c8', ink: '#1d2034', stars: 0 },
  dreamNight: { skyTop: '#1d2550', skyHorizon: '#6f6aa0', light: '#a7acd8', ambient: 0.5, haze: '#5d5b8e', hazeDist: 160, emit: 0.4, shadow: 0.1, sun: '#e9e4ff', ink: '#0e1024', stars: 1 },
  overcast: { skyTop: '#a8b1bc', skyHorizon: '#d9dde0', light: '#e8ebee', ambient: 0.74, haze: '#cfd5da', hazeDist: 105, emit: 0.1, shadow: 0.18, sun: '#f2f2ee', ink: '#17181b', stars: 0 },
};

// what each kind of thing is made of (part → material name, a list to vary by seed, or a colour)
export const KIND_MATERIALS = {
  house: { wall: 'plaster', roof: 'roof', chimney: 'brick' },
  buildings: { wall: 'plaster', roof: 'roof', chimney: 'brick' },
  bridge: { deck: 'wood', rail: 'iron', landing: 'stone' },
  lamppost: { post: 'iron' },
  fence: { rail: 'wood' },
  tree: { bark: 'bark', foliage: 'foliage' },
  bench: { seat: 'wood' }, table: { top: 'wood' }, bed: { frame: 'darkwood', blanket: 'fabric', pillow: 'frame' },
  window: { frame: 'frame', curtain: 'curtain' }, lamp: { stand: 'darkwood', shade: 'shade' },
  tower: { wall: 'sandstone', dome: 'gold' },
  rock: { body: 'rock' }, wall: { body: 'stone' }, pillar: { body: 'stone' }, arch: { body: 'stone' },
};

// ---------- colour helpers ----------
const hx = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mixC = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const mul = (a, b, k = 1) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => (v * B[i] / 255) * k)); };

export function blendLights(A, B, u) {
  const out = {};
  for (const k of Object.keys(A)) out[k] = typeof A[k] === 'string' && A[k][0] === '#' ? mixC(A[k], B[k] ?? A[k], u) : (A[k] ?? 0) + ((B[k] ?? A[k]) - (A[k] ?? 0)) * u;
  return out;
}
export function resolveLight(spec, film) {
  const named = (n) => ({ ...(LIGHTS[n] || LIGHTS.dusk), ...(film.lights?.[n] || {}) });
  return typeof spec === 'string' ? named(spec) : spec && !spec.from ? { ...LIGHTS.dusk, ...spec } : named('dusk');
}

/**
 * The painter for one frame. `L` = the light now, `sunDir` = [x,y,z] toward the sun, `cam` = camera position,
 * `grade` = optional (hex) => hex from the shot's grade. Returns helpers drawProp and the renderer use.
 */
export function makeLiving({ L, materials = {}, sunDir = [0.3, 0.6, 0.7], cam = [0, 0, 0], grade = (c) => c }) {
  const M = { ...MATERIALS, ...materials };
  const pick = (v, seed = 0) => {
    if (Array.isArray(v)) return pick(v[Math.abs(Math.floor(seed)) % v.length], 0);
    if (typeof v === 'string' && v[0] !== '#') return pick(M[v] ?? '#888888', seed);
    return v;
  };
  const sl = Math.hypot(...sunDir) || 1, S = sunDir.map((v) => v / sl);
  // lit colour of a material: multiplied by the light, brighter facing the sun, hazed with distance
  const lit = (base, face = 0.6, depth = 0) => {
    let c = mul(base, L.light, L.ambient + (1 - L.ambient) * face * 1.25);
    if (depth > 0) c = mixC(c, L.haze, 1 - Math.exp(-depth / L.hazeDist));
    return grade(c);
  };
  const materialOf = (p, part, seed = 0) => {
    const ownRaw = p.material?.[part] ?? p[part], own = typeof ownRaw === 'string' || Array.isArray(ownRaw) ? ownRaw : null; // numbers are sizes (a house's roof height), not materials
    const kindM = KIND_MATERIALS[p.kind]?.[part];
    return pick(own ?? kindM ?? part, seed + (p.seed ?? 0) * 7);
  };
  const dist = (q) => Math.hypot(q[0] - cam[0], q[1] - cam[1], q[2] - cam[2]);
  const centroid = (poly) => { const c = [0, 0, 0]; for (const q of poly) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; } return c.map((v) => v / poly.length); };
  const normal = (poly) => {
    const [a, b, c] = poly; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
    return n.map((x) => x / l);
  };
  /**
   * Paint polygons of one part of a prop. solid = closed volumes (boxes, roofs): faces are culled and shaded by
   * which way they point; otherwise one flat colour (thin things, unions of shapes).
   */
  function paint(g, view, fillPolys3, p, part, polys, { solid = true, seed = 0, centre = null, base = null } = {}) {
    if (!polys.length) return;
    const col = base || materialOf(p, part, seed);
    if (!solid) {
      const c = centroid(polys[Math.floor(polys.length / 2)]);
      fillPolys3(g, view, polys, lit(col, 0.55, dist(c)));
      return;
    }
    const ctr = centre || centroid(polys.map(centroid));
    const faces = [];
    for (const poly of polys) {
      if (poly.length < 3) continue;
      const c = centroid(poly); let n = normal(poly);
      const out = [c[0] - ctr[0], c[1] - ctr[1], c[2] - ctr[2]];
      if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((x) => -x);
      const toCam = [cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]];
      if (n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] < -1e-6) continue; // back face
      const sun = Math.max(0, n[0] * S[0] + n[1] * S[1] + n[2] * S[2]), sky = Math.max(0, n[1]) * 0.25;
      faces.push({ poly, d: dist(c), col: lit(col, Math.min(1, 0.25 + sun * 0.85 + sky), dist(c)) });
    }
    faces.sort((a, b) => b.d - a.d);
    for (const f of faces) fillPolys3(g, view, [f.poly], f.col, true);
  }
  return {
    L, M, lit, pick, paint, materialOf, tint: grade,
    ground: (name) => pick(name || 'grass'),
    emit: L.emit,
    ink: L.ink,
    // the colour of lines drawn on a surface: a darker, more saturated shade of it
    lineOf: (base) => grade(mixC(mul(base, L.light, L.ambient * 0.62), L.ink, 0.22)),
  };
}

/** Sky and ground behind everything: a gradient sky down to the horizon, the ground fading into haze toward it. */
export function drawBackdrop(g, view, Lv, groundBase) {
  const { W, H, cam } = view, L = Lv.L;
  // the horizon: far ahead along the ground, at eye level
  const fh = Math.hypot(view.F[0], view.F[2]) || 1;
  const far = view.project(cam.pos[0] + (view.F[0] / fh) * 1e5, 0, cam.pos[2] + (view.F[2] / fh) * 1e5);
  let hy = far ? far[1] : (view.F[1] > 0 ? H * 2 : -H);
  hy = Math.max(-H, Math.min(H * 2, hy));
  const sk = g.createLinearGradient(0, hy - H * 1.1, 0, hy);
  sk.addColorStop(0, Lv.tint(L.skyTop)); sk.addColorStop(0.7, Lv.tint(mixC(L.skyTop, L.skyHorizon, 0.55))); sk.addColorStop(1, Lv.tint(L.skyHorizon));
  g.fillStyle = sk; g.fillRect(0, 0, W, Math.max(0, Math.min(H, hy + 1)));
  if (L.ambient < 0.5 && hy > 0) { // night: a moonlit band of sky at the horizon, so a figure against it still reads
    const nb = g.createLinearGradient(0, hy - H * 0.32, 0, hy);
    nb.addColorStop(0, 'rgba(255,255,255,0)'); nb.addColorStop(1, `rgba(214,222,245,${(0.5 - L.ambient) * 0.55})`);
    g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = nb; g.fillRect(0, Math.max(0, hy - H * 0.32), W, Math.min(H, hy) - Math.max(0, hy - H * 0.32)); g.restore();
  }
  if (hy < H) {
    const near = Lv.lit(groundBase, 0.75, 0), farC = Lv.lit(groundBase, 0.75, L.hazeDist * 2.2);
    const gr = g.createLinearGradient(0, hy, 0, H + Math.max(0, H - hy) * 0.3);
    gr.addColorStop(0, farC); gr.addColorStop(0.08, mixC(farC, near, 0.45)); gr.addColorStop(1, near);
    g.fillStyle = gr; g.fillRect(0, Math.max(0, hy), W, H - Math.max(0, hy));
  }
  return hy;
}

/** A room: the wall behind everything, the floor in its own material (the floorboards' lines go on top). */
export function drawInterior(g, view, Lv, fillPolys3, bounds, { wall = 'wallpaper', floor = 'floorboard', roomH = 2.7 } = {}) {
  const { W, H } = view;
  const wallC = Lv.lit(Lv.pick(wall), 0.55, 4);
  g.fillStyle = wallC; g.fillRect(0, 0, W, H);
  const [x0, z0, x1, z1] = bounds;
  // a gentle falloff on the wall: darker up high, where the light does not reach
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // a whole room: back wall, side walls and a ceiling, each lit a little differently, then the floor
  const rh = roomH, wb = Lv.pick(wall), grid = (fn, nu, nv) => { const q = []; for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) q.push([fn(i / nu, j / nv), fn((i + 1) / nu, j / nv), fn((i + 1) / nu, (j + 1) / nv), fn(i / nu, (j + 1) / nv)]); return q; };
  fillPolys3(g, view, grid((u, v) => [x0 + (x1 - x0) * u, rh * v, z1], 6, 3), Lv.lit(wb, 0.6, 4), true);
  fillPolys3(g, view, grid((u, v) => [x0, rh * v, z0 + (z1 - z0) * u], 6, 3), Lv.lit(wb, 0.42, 4), true);
  fillPolys3(g, view, grid((u, v) => [x1, rh * v, z0 + (z1 - z0) * u], 6, 3), Lv.lit(wb, 0.5, 4), true);
  fillPolys3(g, view, grid((u, v) => [x0 + (x1 - x0) * u, rh, z0 + (z1 - z0) * v], 6, 6), Lv.lit(mixC(wb, '#ffffff', 0.25), 0.3, 4), true);
  const quads = [];
  for (let x = x0; x < x1; x += 1) for (let z = z0; z < z1; z += 1) quads.push([[x, 0, z], [Math.min(x1, x + 1), 0, z], [Math.min(x1, x + 1), 0, Math.min(z1, z + 1)], [x, 0, Math.min(z1, z + 1)]]);
  fillPolys3(g, view, quads, Lv.lit(Lv.pick(floor), 0.7, 3), true);
}
