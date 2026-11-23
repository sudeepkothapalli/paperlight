// Terrain = ink contour lines of a signed distance field on the ground plane.
//
// A "set" is a list of primitives (roads, ponds, ridges...). We build one blended distance
// field d(x,z) (smooth-min so paths merge like ink, not like CAD), choose contour levels
// whose spacing follows a tone profile (dense = dark), extract the iso-lines with marching
// squares, then break them into hand-drawn "strands" with tapered ends and pressure.
//
// Result is cached on disk: geometry is static per set, only the camera moves.

import fs from 'node:fs';
import path from 'node:path';
import { contours } from 'd3-contour';
import { rng, fbm, noise3, smoothstep, clamp, splinePoints, hashStr, lerp } from './math.js';

const DEFAULT_PROFILE = {
  inner: 0.14,      // darkness of lines inside a road (0..1)
  edge: 1.0,        // darkness right at the road edge
  plateau: 0.7,     // metres of full-dark bank beyond the edge
  bankFall: 2.6,    // e-folding distance of the bank (m)
  maxD: 11,         // beyond this the paper stays white
  spacing: 0.085,   // contour spacing (m) at full darkness
  maxSpacing: 0.9,
};

export function toneAt(d, P, hw = 1.75) {
  if (d < 0) {
    const t = smoothstep(-Math.min(1.0, hw * 0.6), 0, d);
    return P.inner + (P.edge - P.inner) * t * t;
  }
  if (d < P.plateau) return P.edge;
  return P.edge * Math.exp(-(d - P.plateau) / P.bankFall);
}

function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function ctz(n) { let c = 0; while (n > 0 && (n & 1) === 0) { n >>= 1; c++; } return c; }

function boardsTerrain(set, seed) {
  // floorboards: straight parallel lines with joints, a little uneven, like a drawn floor
  const b = set.boards, [x0, z0, x1, z1] = set.bounds;
  const r = rng(seed * 13 + 1), strands = [];
  let li = 0;
  for (let z = z0; z <= z1; z += b.spacing ?? 0.14, li++) {
    let x = x0 + r() * 1.2;
    while (x < x1) {
      const len = Math.min(x1 - x, 0.9 + r() * 2.2), arr = [];
      for (let u = 0; u <= len; u += 0.12) {
        const pos = u / len;
        const w = (b.tone ?? 0.5) * (0.7 + 0.5 * noise3(x * 0.8, z * 3, 1)) * smoothstep(0, 0.06, pos) * smoothstep(1, 0.94, pos);
        arr.push(x + u, z + 0.01 * noise3((x + u) * 0.5, z, 2), w);
      }
      if (arr.length >= 9) strands.push({ pts: Float32Array.from(arr), li, imp: li % 2 ? 0 : 3, sp: b.spacing ?? 0.14, lvl: 0, seed: r() });
      x += len + 0.02 + r() * 0.05;
    }
  }
  return { strands, levels: li, bounds: set.bounds };
}

// height fields whose iso-lines are drawn: 'billows' = a sea of cloud tops seen from above
function fieldValue(f, x, z) {
  if (f.type === 'billows') {
    const s = f.scale ?? 0.025;
    const a = fbm(x * s, z * s, f.octaves ?? 4, 3.3);
    const puffy = Math.abs(noise3(x * s * 2.2, z * s * 2.2, 8.1));       // billow cusps
    return a * 1.2 - puffy * 0.35;
  }
  if (f.type === 'rings') {
    // ripples around one or more centres — for abstract, geometric or dream spaces
    let d = Infinity; for (const [cx, cz] of f.centers || [[0, 0]]) d = Math.min(d, Math.hypot(x - cx, z - cz));
    return Math.sin((2 * Math.PI * (d + (f.warp ?? 0) * fbm(x * 0.03, z * 0.03, 2, 4.4))) / (f.period ?? 4));
  }
  if (f.type === 'flow') {
    // long flowing bands: parallel lines that swell, bunch and part like wind or water
    const a = (f.dir ?? 90) * Math.PI / 180, s = f.scale ?? 0.018;
    const across = x * Math.cos(a) - z * Math.sin(a);
    const warp = (f.amp ?? 9) * fbm(x * s, z * s, 3, 1.7) + (f.swell ?? 0) * Math.sin((x * Math.sin(a) + z * Math.cos(a)) * 0.02);
    return Math.sin((2 * Math.PI * (across + warp)) / (f.period ?? 7));
  }
  return 0;
}

export function buildTerrain(set, { cacheDir, seed = 7, log = () => {} } = {}) {
  if (set.boards) return boardsTerrain(set, seed);
  if (!set.field && !(set.roads?.length) && !(set.ponds?.length) && !(set.rivers?.length)) return { strands: [], levels: 0, bounds: set.bounds || [0, 0, 0, 0] };
  const P = { ...DEFAULT_PROFILE, ...(set.profile || {}) };
  const key = hashStr(JSON.stringify({ set, seed, v: 5 })).toString(16);
  const cacheFile = cacheDir && path.join(cacheDir, `terrain-${key}.bin`);
  if (cacheFile && fs.existsSync(cacheFile)) return loadTerrain(cacheFile);

  const t0 = Date.now();
  const cell = set.cell || 0.4;
  const [bx0, bz0, bx1, bz1] = set.bounds || [-160, -260, 160, 460];
  const nx = Math.ceil((bx1 - bx0) / cell) + 1, nz = Math.ceil((bz1 - bz0) / cell) + 1;
  const N = nx * nz;
  const R = P.maxD + 6;
  const d = new Float32Array(N).fill(R);
  const toneMul = new Float32Array(N).fill(1);
  const hwArr = new Float32Array(N).fill(1.75);
  const best = new Float32Array(N).fill(R);
  const k = set.blend ?? 4;

  const prims = [];
  for (const r of set.roads || []) prims.push({ kind: 'road', pts: splinePoints(r.pts, 1.0), hw: (r.width ?? 3.6) / 2, tone: r.tone ?? 1 });
  for (const p of set.ponds || []) prims.push({ kind: 'pond', at: p.at, r: p.r, hw: p.r, tone: p.tone ?? 1 });
  for (const r of set.rivers || []) prims.push({ kind: 'road', pts: splinePoints(r.pts, 1.0), hw: (r.width ?? 8) / 2, tone: r.bankTone ?? 0.8 }); // banks

  const tmp = new Float32Array(N);
  if (set.field) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) d[i + j * nx] = fieldValue(set.field, bx0 + i * cell, bz0 + j * cell);
    prims.length = 0;
  }
  for (const pr of prims) {
    tmp.fill(R + pr.hw);
    if (pr.kind === 'road') {
      const pts = pr.pts;
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, az] = pts[s], [cx, cz] = pts[s + 1];
        const minx = Math.min(ax, cx) - R - pr.hw, maxx = Math.max(ax, cx) + R + pr.hw;
        const minz = Math.min(az, cz) - R - pr.hw, maxz = Math.max(az, cz) + R + pr.hw;
        const i0 = Math.max(0, Math.floor((minx - bx0) / cell)), i1 = Math.min(nx - 1, Math.ceil((maxx - bx0) / cell));
        const j0 = Math.max(0, Math.floor((minz - bz0) / cell)), j1 = Math.min(nz - 1, Math.ceil((maxz - bz0) / cell));
        const ex = cx - ax, ez = cz - az, el = ex * ex + ez * ez || 1;
        for (let j = j0; j <= j1; j++) {
          const z = bz0 + j * cell;
          for (let i = i0; i <= i1; i++) {
            const x = bx0 + i * cell;
            const t = clamp(((x - ax) * ex + (z - az) * ez) / el);
            const dx = x - ax - ex * t, dz = z - az - ez * t;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const idx = i + j * nx;
            if (dist < tmp[idx]) tmp[idx] = dist;
          }
        }
      }
    } else if (pr.kind === 'pond') {
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = bx0 + i * cell, z = bz0 + j * cell;
        tmp[i + j * nx] = Math.hypot(x - pr.at[0], z - pr.at[1]);
      }
    }
    for (let i = 0; i < N; i++) {
      const dp = tmp[i] - pr.hw;
      if (dp < best[i]) { best[i] = dp; toneMul[i] = pr.tone; hwArr[i] = pr.hw; }
      d[i] = smin(d[i], dp, k);
    }
  }
  log(`  distance field ${nx}x${nz} in ${Date.now() - t0}ms`);

  // ----- contour levels: spacing inversely proportional to tone -----
  const minHw = Math.min(...prims.map((p) => p.hw), 1.75);
  const levels = [];
  if (set.field) {
    const f = set.field, flowT = f.type === 'flow' || f.type === 'rings', n = f.levels ?? (flowT ? 10 : 18), lo = f.from ?? (flowT ? -0.92 : -0.45), hi = f.to ?? (flowT ? 0.92 : 0.55);
    for (let i = 0; i < n; i++) {
      const fr = i / (n - 1);
      levels.push({ v: lerp(lo, hi, fr), T: (f.tone ?? 0.55) * (0.55 + 0.45 * Math.sin(fr * Math.PI)), sp: f.spacing ?? 1.1, imp: Math.min(6, ctz(i + 1)) });
    }
  } else {
    let L = -minHw + 0.18;
    while (L < P.maxD) {
      const T = toneAt(L, P, minHw);
      levels.push({ v: L, T, sp: 0 });
      L += Math.min(P.maxSpacing, P.spacing / (0.06 + T));
    }
    for (let i = 0; i < levels.length; i++) {
      levels[i].sp = i + 1 < levels.length ? levels[i + 1].v - levels[i].v : P.maxSpacing;
      levels[i].imp = Math.min(6, ctz(i + 1));
    }
  }

  // ----- marching squares -----
  // d3-contour encloses values >= threshold; we only need the iso-lines.
  const gen = contours().size([nx, nz]).smooth(true);
  const R2 = rng(seed);
  const strands = [];
  const sample = (arr, x, z) => {
    const gi = clamp((x - bx0) / cell, 0, nx - 1.001), gj = clamp((z - bz0) / cell, 0, nz - 1.001);
    const i = Math.floor(gi), j = Math.floor(gj), fx = gi - i, fz = gj - j;
    const a = arr[i + j * nx], b = arr[i + 1 + j * nx], c = arr[i + (j + 1) * nx], e = arr[i + 1 + (j + 1) * nx];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + e * fx) * fz;
  };

  for (let li = 0; li < levels.length; li++) {
    const lv = levels[li];
    const geo = gen.contour(d, lv.v);
    for (const poly of geo.coordinates) {
      for (const ring of poly) {
        // split ring where it runs along the grid boundary
        let cur = [];
        const flush = () => { if (cur.length > 4) lineToStrands(cur, lv, li); cur = []; };
        for (const [gx, gz] of ring) {
          const onEdge = gx <= 0.6 || gz <= 0.6 || gx >= nx - 0.6 || gz >= nz - 0.6;
          if (onEdge) { flush(); continue; }
          cur.push([bx0 + (gx - 0.5) * cell, bz0 + (gz - 0.5) * cell]);
        }
        flush();
      }
    }
  }

  function lineToStrands(line, lv, li) {
    // Chaikin smoothing to remove marching-squares facets
    for (let it = 0; it < 2; it++) {
      const sm = [line[0]];
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1];
        sm.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
      }
      sm.push(line[line.length - 1]);
      line = sm;
    }
    // resample at fixed spacing
    const step = 0.3;
    const pts = [line[0]];
    let acc = 0;
    for (let i = 1; i < line.length; i++) {
      let [px, pz] = pts[pts.length - 1];
      const [qx, qz] = line[i];
      let seg = Math.hypot(qx - px, qz - pz);
      acc = seg;
      while (acc >= step) {
        const t = step / acc;
        px = px + (qx - px) * t; pz = pz + (qz - pz) * t;
        pts.push([px, pz]);
        acc = Math.hypot(qx - px, qz - pz);
      }
    }
    if (pts.length < 4) return;

    // break into strands: pen lifts, pressure, tapered ends, hand wobble
    let i = 0;
    const lvlSeed = li * 13.7;
    while (i < pts.length - 3) {
      const T = lv.T;
      const lenM = R2.range(4, 30) * (0.6 + 0.6 * T);
      const n = Math.max(4, Math.round(lenM / step));
      const end = Math.min(pts.length, i + n);
      const arr = [];
      for (let k2 = i; k2 < end; k2++) {
        let [x, z] = pts[k2];
        const a = pts[Math.max(0, k2 - 1)], b = pts[Math.min(pts.length - 1, k2 + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const wob = 0.05 * noise3(x * 0.07, z * 0.07, 3.3) + 0.018 * noise3(x * 0.45, z * 0.45, lvlSeed);
        x += -tz * wob; z += tx * wob;
        const tm = sample(toneMul, x, z);
        const patch = 0.62 + 1.1 * fbm(x * 0.035, z * 0.035, 3, 9.1) + 0.25 * noise3(x * 0.3, z * 0.3, lvlSeed);
        const pos = (k2 - i) / Math.max(1, end - 1 - i);
        const taper = smoothstep(0, 0.12, pos) * smoothstep(1, 0.85, pos);
        const w = clamp(T * tm * patch, 0, 1.4) * (0.25 + 0.75 * taper);
        arr.push(x, z, w);
      }
      if (arr.length >= 12) {
        strands.push({ pts: Float32Array.from(arr), li, imp: lv.imp, sp: lv.sp, lvl: lv.v, seed: R2() });
      }
      const gapM = R2.range(0.15, 1.2) * (1.6 - lv.T);
      i = end + Math.max(1, Math.round(gapM / step));
    }
  }

  log(`  ${levels.length} levels -> ${strands.length} strands in ${Date.now() - t0}ms`);
  const out = { strands, levels: levels.length, bounds: [bx0, bz0, bx1, bz1] };
  if (cacheFile) saveTerrain(cacheFile, out);
  return out;
}

function saveTerrain(file, t) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const meta = t.strands.map((s) => [s.pts.length, s.li, s.imp, s.sp, s.lvl, s.seed]);
  const total = meta.reduce((a, m) => a + m[0], 0);
  const buf = new Float32Array(total);
  let o = 0;
  for (const s of t.strands) { buf.set(s.pts, o); o += s.pts.length; }
  const head = Buffer.from(JSON.stringify({ meta, levels: t.levels, bounds: t.bounds }));
  const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
  fs.writeFileSync(file, Buffer.concat([len, head, Buffer.from(buf.buffer)]));
}

function loadTerrain(file) {
  const b = fs.readFileSync(file);
  const hl = b.readUInt32LE(0);
  const head = JSON.parse(b.subarray(4, 4 + hl).toString());
  const raw = b.subarray(4 + hl);
  const all = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  let o = 0;
  const strands = head.meta.map(([n, li, imp, sp, lvl, seed]) => {
    const s = { pts: all.subarray(o, o + n), li, imp, sp, lvl, seed };
    o += n;
    return s;
  });
  return { strands, levels: head.levels, bounds: head.bounds };
}
