// Silhouettes. Figures are built in a local frame and projected point by point, so they
// foreshorten, turn and scale correctly under any camera. They are always solid ink (or the
// accent): a silhouette is the absence of light, never a drawing of detail. All the
// character is in the outline — posture, coat, stride, the turn of a head.

import { lerp, clamp, noise3, smoothstep, TAU } from './math.js';

function ellipse(cx, cy, rx, ry, n = 18, a0 = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}
// closed Catmull-Rom through control points (2D)
function smoothClosed(ctrl, per = 5) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out;
}
function limb(ax, ay, bx, by, wa, wb) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  return [[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb], [ax - nx * wa, ay - ny * wa]];
}

// ---------- head: a plain skull and face, blended front <-> profile in polar form ----------
// Kept deliberately simple: a small nose, a soft chin, no lips. Character comes from hair.
// Control points (metres, origin ≈ ear, +x = the way the face points, +y up).
const HEAD_PROFILE = [
  [0.0, 0.1], [0.045, 0.092], [0.07, 0.065], [0.082, 0.03], [0.08, 0.012],      // crown, forehead, brow, bridge
  [0.096, -0.018], [0.081, -0.03], [0.08, -0.052], [0.077, -0.08],              // nose, mouth, chin
  [0.062, -0.104], [0.03, -0.103], [0.0, -0.085], [-0.03, -0.062],              // under the jaw
  [-0.065, -0.045], [-0.085, -0.01], [-0.088, 0.035], [-0.068, 0.075], [-0.035, 0.097], // nape, back of skull
];
const HEAD_FRONT = [
  [0.0, 0.105], [0.026, 0.097], [0.045, 0.081], [0.058, 0.056], [0.066, 0.024], [0.068, -0.01], [0.064, -0.045],
  [0.052, -0.076], [0.03, -0.1], [0.0, -0.108], [-0.03, -0.1], [-0.052, -0.076],
  [-0.064, -0.045], [-0.068, -0.01], [-0.066, 0.024], [-0.058, 0.056], [-0.045, 0.081], [-0.026, 0.097],
];
const RN = 128;
function polar(ctrl) {
  const poly = smoothClosed(ctrl, 6);
  const r = new Float32Array(RN);
  for (let i = 0; i < RN; i++) {
    const a = (i / RN) * TAU, dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (let j = 0; j < poly.length; j++) {
      const [x1, y1] = poly[j], [x2, y2] = poly[(j + 1) % poly.length];
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (x1 * ey - y1 * ex) / den, u = (x1 * dy - y1 * dx) / den;
      if (t > 0 && u >= 0 && u <= 1 && t > best) best = t;
    }
    r[i] = best;
  }
  return r;
}
const R_PROFILE = polar(HEAD_PROFILE), R_FRONT = polar(HEAD_FRONT);
const wrapA = (a) => ((a % TAU) + TAU) % TAU;
function band(a, a0, a1, fade) {
  const t = wrapA(a - a0), len = a1 - a0;
  return t > len ? 0 : smoothstep(0, fade, t) * smoothstep(len, len - fade, t);
}
// hair thickness around the skull (metres) for profile (+x facing), front and back views.
// Smooth masses only — a cap that is fuller on top, a swept fringe, a soft side part.
const lobe = (a, c, half) => { const d = Math.abs(((a - c + Math.PI) % TAU + TAU) % TAU - Math.PI); return d >= half ? 0 : Math.pow(Math.cos((d / half) * Math.PI / 2), 0.7); };
const gauss = (a, c, w) => { const d = ((a - c + Math.PI) % TAU + TAU) % TAU - Math.PI; return Math.exp(-((d / w) ** 2)); };
function hairThick(view, a, style, seed) {
  if (style === 'none') return 0;
  if (style === 'bob') {
    // a chin-length bob: full and rounded, a straight fringe, ending crisply at the jaw
    if (view === 'profile') return 0.02 * lobe(a, 2.45, 2.0) + 0.012 * gauss(a, 0.62, 0.2) + 0.012 * gauss(a, 4.1, 0.28);
    if (view === 'front') return 0.019 * lobe(a, Math.PI / 2, 2.15) + 0.006 * gauss(a, Math.PI / 2, 0.5);
    return 0.022 * lobe(a, Math.PI / 2, 2.6);
  }
  const vol = style === 'long' ? 1.15 : style === 'crop' ? 0.5 : style === 'bun' || style === 'pigtails' ? 0.75 : 1;
  const part = Math.sin(seed * 2.3) >= 0 ? 1 : -1;   // which side the hair falls to
  // a few soft locks: broad bumps, never jagged
  const locks = (c0, n, spread, amp) => { let v = 0; for (let i = 0; i < n; i++) v += gauss(a, c0 + (i - (n - 1) / 2) * spread, spread * 0.42) * (0.7 + 0.3 * Math.sin(seed * 3 + i * 1.7)); return v * amp; };
  if (view === 'profile') {
    const cap = 0.013 * lobe(a, 2.1, 1.6);
    const edge = smoothstep(4.05, 3.85, ((a % TAU) + TAU) % TAU) * smoothstep(0.4, 0.62, ((a % TAU) + TAU) % TAU); // crisp ends
    const fringe = 0.013 * gauss(a, 0.58, 0.17);                                  // swept over the forehead
    const nape = style === 'short' ? 0.006 * gauss(a, 3.85, 0.12) : 0;            // the cut ends in a small step
    return vol * ((cap + locks(1.9, 4, 0.42, 0.0045)) * edge + fringe + nape);
  }
  if (view === 'front') {
    const cap = 0.012 * lobe(a, Math.PI / 2, 1.2);
    const sweep = 0.007 * gauss(a, Math.PI / 2 + 0.55 * part, 0.3);               // fringe falling to one side
    return vol * (cap + sweep + locks(Math.PI / 2, 3, 0.5, 0.003));
  }
  return vol * (0.012 * lobe(a, Math.PI / 2, 2.0) + locks(Math.PI / 2, 5, 0.5, 0.0035));
}
function headOutline(cx, cy, hs, hdir, back, style = 'short', seed = 1) {
  const w = smoothstep(0.15, 0.92, hs);
  const pts = [];
  for (let i = 0; i < RN; i++) {
    const a = (i / RN) * TAU;
    // profile facing -x is the mirror: sample at (pi - a)
    const j = hdir > 0 ? i : (((RN / 2 - i) % RN) + RN) % RN;
    const ap = (j / RN) * TAU;
    const rf = R_FRONT[i] + hairThick(back ? 'back' : 'front', a, style, seed);
    const rp = R_PROFILE[j] + hairThick('profile', ap, style, seed);
    const r = lerp(rf, rp, w);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
// extra hair shapes that leave the skull: long hair, bun (head-local, +x = facing in profile)
function hairExtras(style, hs, hdir, back) {
  const prof = hs > 0.5, m = (pts) => pts.map(([x, y]) => [x * (prof ? hdir : 1), y]);
  if (style === 'long') {
    if (prof) return [m(smoothClosed([[-0.03, 0.09], [-0.082, 0.05], [-0.096, -0.04], [-0.098, -0.18], [-0.055, -0.2], [-0.035, -0.1], [-0.02, -0.03]], 4))];
    if (back) return [smoothClosed([[-0.07, 0.05], [-0.084, -0.04], [-0.092, -0.17], [-0.06, -0.2], [0.06, -0.2], [0.092, -0.17], [0.084, -0.04], [0.07, 0.05]], 4)];
    // from the front: two locks framing the face, paper showing between them and the neck
    return [-1, 1].map((e) => smoothClosed([[e * 0.058, 0.07], [e * 0.08, 0.02], [e * 0.088, -0.08], [e * 0.096, -0.19], [e * 0.07, -0.205], [e * 0.054, -0.15], [e * 0.06, -0.06], [e * 0.064, 0.02]], 4));
  }
  if (style === 'pigtails') {
    const tie = (x, y, r) => [ellipse(x, y, r, r * 1.15, 14), ellipse(x * 0.93, y + r * 0.9, r * 0.45, r * 0.4, 10)];
    return prof ? tie(-0.092, -0.02, 0.04).map(m) : [...tie(-0.098, -0.01, 0.038), ...tie(0.098, -0.01, 0.038)];
  }
  if (style === 'bob') {
    if (prof) return [m(smoothClosed([[-0.03, 0.1], [-0.085, 0.075], [-0.1, 0.01], [-0.1, -0.06], [-0.088, -0.078], [-0.03, -0.072], [0.0, -0.02], [0.04, 0.05]], 4))];
    return [smoothClosed([[-0.06, 0.08], [-0.084, 0.02], [-0.092, -0.05], [-0.094, -0.078], [-0.07, -0.082], [-0.062, -0.03], [-0.05, 0.03],
      [0.05, 0.03], [0.062, -0.03], [0.07, -0.082], [0.094, -0.078], [0.092, -0.05], [0.084, 0.02], [0.06, 0.08]].map(([x, y]) => (back && Math.abs(x) < 0.064 && y < 0.04 ? [x, Math.min(y, -0.07)] : [x, y])), 4)];
  }
  if (style === 'bun') return prof ? [m(ellipse(-0.074, 0.068, 0.035, 0.033, 14))] : [ellipse(0, 0.112, 0.033, 0.03, 14)];
  return [];
}

// ---------- gait: thigh, knee, shin; the stance foot stays planted ----------
const THIGH = 0.44, SHIN = 0.42, ANKLE = 0.075;
function legPose(phi, walk, gt = {}, run = 0, sit = 0, ground = false, kneel = 0, side = 1, bedLegs = false) {
  // phi: 0..2pi per stride pair; leg is at heel-strike when sin(phi) = 1
  const q = ((phi + Math.PI / 2) % TAU + TAU) % TAU;          // 0..pi swing, pi..2pi stance
  // the thigh leads the swing a little ahead of a pure sine; the knee folds most mid-swing.
  // gait personality scales stride and knee lift; running lengthens both and adds a flight phase
  const amp = 0.4 * (gt.stride ?? 1) * (1 + 0.35 * run * (gt.runStride ?? 1));
  const rk = gt.runKnee ?? 0.6; // how high the knees come up when running (1 = sprint)
  let hip = walk * (amp * Math.sin(phi) + (q < Math.PI ? (0.12 + 0.16 * run * rk) * Math.sin(q) : 0));
  let knee = q < Math.PI ? walk * (0.8 * (gt.knee ?? 1) + 0.75 * run * rk) * Math.pow(Math.sin(q), 1.6)
                         : walk * (0.16 + 0.25 * run * rk) * Math.sin(q - Math.PI);
  // seated: on a chair (thighs level, shins down), in bed (legs straight out under the blanket), or on the ground
  // (knees drawn up, feet planted close — the natural way to sit on the ground; one leg a little lower than the other)
  if (sit > 0) {
    const gh = side > 0 ? 2.15 : 1.95, gk = side > 0 ? 1.8 : 1.5;
    hip = lerp(hip, bedLegs ? 1.5 : ground ? gh : 1.45, sit); knee = lerp(knee, bedLegs ? 0.12 : ground ? gk : 1.48, sit);
  }
  if (kneel > 0) { // one knee down: the front foot planted, the back shin along the ground
    hip = lerp(hip, side > 0 ? 1.3 : -0.12, kneel); knee = lerp(knee, side > 0 ? 1.4 : 1.62, kneel);
  }
  const kx = Math.sin(hip) * THIGH, ky = -Math.cos(hip) * THIGH;
  const sa = hip - knee;
  const ax = kx + Math.sin(sa) * SHIN, ay = ky - Math.cos(sa) * SHIN;
  const swing = q < Math.PI;
  const toe = swing ? -0.55 * knee * Math.sin(q) + 0.15 * walk * smoothstep(0.75, 1, q / Math.PI) : (q > 1.75 * Math.PI ? -0.5 * walk * smoothstep(1.75, 2, q / Math.PI) : 0);
  return { kx, ky, ax, ay, toe, swing };
}
// shoe in foot space (forward, up), ankle at origin, sole at -ANKLE
const SHOE = [[-0.035, 0.015], [-0.055, -0.03], [-0.05, -0.068], [-0.025, -0.075], [0.13, -0.075], [0.165, -0.063], [0.158, -0.042], [0.09, -0.028], [0.03, -0.005], [0.022, 0.02]];

/** Person silhouette as local polygons (metres; x = screen right, y = up). */
export function personShape(def, st, rel, time, wind = 1) {
  const H = (def.height ?? 1.75) * (st.scale ?? 1), k = H / 1.75, build = def.build ?? 1;
  const s = Math.abs(Math.sin(rel)), c = Math.abs(Math.cos(rel));
  const soar = st.soar || 0;
  const TN = (k) => (def.tonal ? '__t_' + k : undefined); // tonal mode: each garment its own near-black
  const dir = Math.sin(rel) >= 0 ? 1 : -1; // which screen side the figure faces in profile
  const walk = st.walking || 0;
  const gt = def.gait || {};
  // steps come from the blocking (stride scales with body size and speed); heel strikes on whole steps
  const phase = (st.steps != null ? st.steps : (st.dist || 0) / 0.74) * Math.PI + Math.PI / 2;
  const run = walk * smoothstep(1.9, 3.0, (st.speed || 0) / Math.sqrt(k));
  const down = st.sit || 0, on = st.sitOn;
  const sit = on === 'kneel' || on === 'lie' ? 0 : down, ground = on === 'ground' || on === 'bed';
  const kneel = on === 'kneel' ? down : 0, lie = on === 'lie' ? down : 0;
  const breath = (1 - walk) * 0.004 * Math.sin(time * 1.6) * (1 + (st.pose?.breath ?? 0));
  const polys = [];
  const hemY0 = lerp(def.hem ?? 0.48, 0.9, Math.max(sit, kneel * 0.85)); // seated or kneeling, the coat ends at the seat and drapes over the lap

  // legs first: their length decides how high the hips ride (the walk's bob comes from here)
  const legs = [-1, 1].map((side) => ({ side, ...legPose(phase + (side > 0 ? Math.PI : 0), walk, gt, run, sit, ground, kneel, side, on === 'bed') }));
  const hipY = Math.max(...legs.map((l) => -l.ay)) + ANKLE;
  // bounce (personality) and a flight phase when running
  const lift = (hipY - (THIGH + SHIN + ANKLE)) * (gt.bounce ?? 1) + run * 0.04 * (gt.runBounce ?? 1) * Math.abs(Math.sin(2 * phase));
  const S = (pts, color) => { const p = pts.map(([x, y]) => [x * k, y * k]); polys.push(color ? { color, pts: p } : p); };
  const B = (y) => y + lift;                                    // body follows the hips
  const hemY = ground && on !== 'bed' ? lerp(B(hemY0), 0.025, smoothstep(0.3, 1, sit)) : B(hemY0); // on the ground the coat falls to the ground under her

  for (const L of legs) {
    const hx = L.side * 0.068 * build * c;
    const X = (f) => hx + dir * s * f;                          // forward axis foreshortens off-profile
    const knee = [X(L.kx), hipY + L.ky], ank = [X(L.ax), hipY + L.ay];
    const top = [lerp(hx, knee[0], 0.25), lerp(hipY, knee[1], 0.25)];
    S(limb(top[0], top[1], knee[0], knee[1], 0.064 * build, 0.052), TN('legs'));
    S(limb(knee[0], knee[1], ank[0], ank[1], 0.052, 0.036), TN('legs'));
    S(ellipse(knee[0], knee[1], 0.052, 0.052, 12), TN('legs'));
    // shoe: profile shape rotated by toe angle, plus a front-on oval so it never vanishes
    const ct = Math.cos(L.toe), sn = Math.sin(L.toe);
    const fs = def.feet === 'bare' ? 0.78 : 1;
    S(SHOE.map(([f, u]) => { const fr = f * ct * fs - u * sn, ur = f * sn * fs + u * ct * (fs < 1 ? 0.85 : 1); return [ank[0] + dir * s * fr, ank[1] + ur]; }), TN('shoes'));
    if (c > 0.2) S(ellipse(ank[0], ank[1] - 0.04, (0.042 * c + 0.01) * fs, 0.034, 12), TN('shoes'));
  }

  const bodyStart = polys.length;
  if (sit > 0.05 || kneel > 0.05) { // the coat drapes over the lap
    for (const L of legs) { const hx = L.side * 0.068 * build * c; S(limb(hx, hipY + 0.02, hx + dir * s * L.kx, hipY + L.ky + 0.02, 0.1 * build, 0.085), TN('coat')); }
  }
  // coat: one smooth outline; the front of the hem is pushed by the forward knee
  const nw = lerp(1, 0.62, s) * build;
  const f = dir * s;
  const pose = st.pose || {};
  const slump = pose.slump ?? 0;
  const sy = B(1.43 + breath - 0.035 * slump);
  const kneeFwd = Math.max(...legs.map((l) => l.kx)) * s;
  const sway = -f * 0.025 * walk + 0.02 * wind * noise3(time * 0.8, 3.1, 0) * (def.coatFlutter ?? 1) + f * 0.035 * (st.settle || 0); // the hem swings on after a stop
  const flut = (x) => 0.012 * wind * noise3(x * 5 + time * 2.1, time * 1.4, 1);
  const hw = 0.255 * (def.flare ?? 1), bw = 0.205 * (def.shoulders ?? 1);
  const side = (sg) => {
    const front = sg === dir;
    const chest = s * (front ? 0.035 : -0.01), hunch = s * (front ? 0 : 0.02);
    const push = front ? Math.max(0, kneeFwd - hw * nw * 0.8) * 0.9 : -0.02 * walk * s;
    return [
      [sg * lerp(0.068, front ? 0.045 : 0.055, s), sy + lerp(0.112, front ? 0.088 : 0.115, s)], // collar hugs the neck, raised at the back
      [sg * lerp(0.13, front ? 0.11 : 0.105, s), sy + lerp(0.055, front ? 0.035 : 0.075, s) + hunch * 0.5],
      [sg * (bw * nw + hunch), sy - 0.015],
      [sg * ((bw + 0.012) * nw + chest), sy - 0.2],
      [sg * (lerp(0.215 * (def.shoulders ?? 1), hw, def.flare > 1.1 ? 0.3 : 0) * nw + chest * 0.6), B(1.02)],
      [sg * (lerp(hw, hw * 0.95, def.flare > 1.1 ? 0 : 1) * (def.flare > 1.1 ? 0.78 : 1) * nw) + sway * 0.6 + sg * push * 0.5, B(0.72)],
      [sg * (hw * (def.flare > 1.1 ? 1.08 : 1.03) * nw) + sway + sg * push, hemY + 0.02 + flut(sg)],
    ];
  };
  const Lc = side(-1), Rc = side(1).reverse();
  const hem = [];
  for (let i = 1; i < 4; i++) { const x = lerp(Lc[6][0], Rc[0][0], i / 4); hem.push([x, hemY + flut(x * 3)]); }
  S(smoothClosed([...Lc, ...hem, ...Rc], 5), TN('coat'));
  const acc = def.accessories || {};
  if (acc.hem && sit < 0.3 && kneel < 0.3) { const xl = Lc[6][0], xr = Rc[0][0], y0h = hemY + 0.02; S([[xl, y0h], [xr, y0h], [xr * 0.985, y0h + 0.06], [xl * 0.985, y0h + 0.06]], acc.hem); } // a border at the hem (standing only)

  // arms: both act. The near arm swings in profile and takes most gestures; the far arm swings opposite,
  // joins two-handed gestures ('both'), and is hidden behind the body when at rest in profile.
  const gest = st.gesture && st.gesture.amt > 0.01 ? st.gesture : null;
  const backOut = (u) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }; // overshoot, then settle
  const tug = 0.1 * noise3(time * 1.4, 2.7, 0) + 0.06 * Math.sin(time * 2.3);   // a kite pulling at the string
  const POSE = (name, t2, far) => ({
    reach: [1.3, 0.12], point: [1.52, 0.0], up: [2.85, 0.05], hold: [0.7, 0.9], take: [1.1, 0.35],
    catch: [2.5, 0.25], fly: far ? [1.35 + tug * 0.7, 0.95] : [1.75 + tug, 0.55],
    wave: [2.5, -0.35 + 0.4 * Math.sin(t2 * 8)], beckon: [1.25, 0.45 + 0.5 * Math.max(0, Math.sin(t2 * 6))],
    hug: [1.15, 1.05], shield: [2.2, 1.75], cross: [0.25, 2.25], behind: [-0.5, -0.25], offer: [0.95, 0.55],
    tug: [0.15, 1.75], // a quick pull on a string, the hand drawn back to the chest
    palms: [0.42, 2.25], // palms joined at the chest (with 'both'): thanks, a greeting, a plea
    touch: [1.2, 0.4], // (the IK target overrides this)
    hip: [0.65, -1.75], // hand on hip, elbow out: impatience that still reads in silhouette
  }[name] || [0, 0.1]);
  let hand = [(1 - s) * bw * nw * 0.95 + f * 0.02, sy - 0.62], hand2 = null;
  const gest2 = st.gesture2 && st.gesture2.amt > 0.01 ? st.gesture2 : (gest && gest.arms === 'both' ? gest : null);
  const arm = (far) => {
    const g = far ? gest2 : gest && gest.arms !== 'far' ? gest : null;
    const sideSign = far ? -1 : 1;
    if (!g && def.handsInPockets) return null; // otherwise arms are always there: hanging at the sides seen from the front
    let sw = -sideSign * 0.36 * walk * (gt.swing ?? 1) * (1 + 0.5 * run) * Math.sin(phase);
    let el = 0.12 + 0.25 * walk * Math.max(0, Math.sin(phase + (far ? 0 : Math.PI))) + 1.1 * run;
    if (walk < 0.2) { sw += 0.035 * Math.sin(time * 0.9 + sideSign * 1.3); el += 0.05 * Math.sin(time * 0.7 + sideSign); } // idle life
    if (sit > 0.5 && !g) { sw = 0.5; el = 0.7; } // hands resting on the lap
    const hugK = !g && ground && on !== 'bed' && sit > 0.05 ? legs[far ? 0 : 1] : null; // on the ground: arms wrapped round the knees
    if (g) {
      const G = POSE(g.name, g.t || 0, far);
      const amt = g.exiting ? smoothstep(0, 1, g.amt) : backOut(clamp(g.amt));
      sw = lerp(sw, G[0], amt); el = lerp(el, G[1], amt);
    }
    // forward is the facing direction in profile. A walking swing goes forward/back — seen from the front it
    // foreshortens (barely moves). Only a gesture lifts the arm out to its own side.
    const lat = g ? smoothstep(0, 1, clamp(g.amt)) : 0;
    const ax = dir * s + sideSign * (1 - s) * lerp(0.12, 0.9, lat);
    const hang = (1 - s) * (1 - lat) * (1 - walk * 0.6) * sideSign * 0.085; // seen from the front, a sliver of light between arm and coat
    const px = sideSign * (1 - s) * bw * nw * 0.92 - (far ? f * 0.015 : 0), py = sy - 0.035;
    let ex = px + ax * Math.sin(sw) * 0.3 + hang * 0.6, ey = py - Math.cos(sw) * 0.3;
    let hx = ex + ax * Math.sin(sw + el) * 0.29 + hang, hy = ey - Math.cos(sw + el) * 0.29;
    // touch: two-bone IK so the hand lands exactly on a point (a rail, a shoulder, a window), elbow bending down/out
    let tl = far ? st.touchL2 : st.touchL;
    if (hugK) { const kxL = hugK.side * 0.068 * build * c + dir * s * hugK.kx; tl = [kxL + dir * s * 0.07 + (1 - s) * sideSign * 0.04, hipY + hugK.ky - 0.06]; }
    if ((g && g.name === 'touch' && tl) || hugK) {
      const amt = hugK ? smoothstep(0.05, 1, sit) : smoothstep(0, 1, g.exiting ? g.amt : clamp(g.amt)), A = 0.3, Bl = 0.29;
      let dx = tl[0] - px, dy = tl[1] - py; const d0 = Math.hypot(dx, dy), d = Math.min(d0, (A + Bl) * 0.995) || 1e-3;
      dx /= d0 || 1; dy /= d0 || 1;
      const a1 = Math.acos(clamp((A * A + d * d - Bl * Bl) / (2 * A * d), -1, 1)), base = Math.atan2(dy, dx);
      const bend = (dx * (dir || 1) >= 0 ? -1 : 1);                       // the elbow bends below the reach
      const ia = base + bend * a1, iex = px + Math.cos(ia) * A, iey = py + Math.sin(ia) * A;
      const ihx = px + dx * d, ihy = py + dy * d;
      ex = lerp(ex, iex, amt); ey = lerp(ey, iey, amt); hx = lerp(hx, ihx, amt); hy = lerp(hy, ihy, amt);
    }
    S(limb(px, py, ex, ey, 0.058, 0.048), TN(far ? 'coat' : 'sleeve'));
    S(ellipse(px - sideSign * 0.006, py - 0.012, 0.064, 0.07, 12), TN(far ? 'coat' : 'sleeve')); // a rounded shoulder, not a square corner
    S(limb(ex, ey, hx, hy, 0.048, 0.036), TN(far ? 'coat' : 'sleeve'));
    S(ellipse(ex, ey, 0.048, 0.048, 10), TN(far ? 'coat' : 'sleeve'));
    // the hand takes a shape: open (reaching, offering, touching), a fist (holding), a pointing finger
    const fa = Math.atan2(hy - ey, hx - ex), cf = Math.cos(fa), sf = Math.sin(fa);
    const kindH = !g || g.amt < 0.35 ? 'rest' : ['point'].includes(g.name) ? 'point' : ['hold', 'fly', 'tug', 'hip', 'cross', 'behind'].includes(g.name) ? 'fist' : 'open';
    const HP = (u, v) => [hx + cf * u - sf * v, hy + sf * u + cf * v];
    if (kindH === 'open') { S([HP(-0.015, -0.034), HP(0.05, -0.03), HP(0.085, -0.012), HP(0.09, 0.012), HP(0.05, 0.03), HP(-0.015, 0.034)], TN('skin')); S([HP(0.0, 0.02), HP(0.04, 0.055), HP(0.05, 0.045), HP(0.02, 0.01)], TN('skin')); }
    else if (kindH === 'point') { S(ellipse(hx + cf * 0.01, hy + sf * 0.01, 0.034, 0.034, 10), TN('skin')); S([HP(0.02, -0.011), HP(0.11, -0.008), HP(0.115, 0.006), HP(0.02, 0.011)], TN('skin')); }
    else if (kindH === 'fist') S(ellipse(hx + cf * 0.012, hy + sf * 0.012, 0.037, 0.037, 10), TN('skin'));
    else S(ellipse(hx + ax * 0.012, hy - 0.025 * Math.cos(sw + el), 0.035, 0.045, 10), TN('skin'));
    return kindH === 'rest' ? [hx + ax * 0.012, hy - 0.025 * Math.cos(sw + el)] : [hx + cf * 0.03, hy + sf * 0.03];
  };
  const h2 = arm(true); if (h2) hand2 = h2;
  const h1 = arm(false); if (h1) hand = h1;
  const headStart = polys.length;

  // neck + head; the head can look away from the body
  const hr = rel + (st.head || 0);
  const hs = Math.abs(Math.sin(hr)), hdir = Math.sin(hr) >= 0 ? 1 : -1;
  const hsF = def.headScale ?? 1, nb = sy + 0.06;
  const hcx = f * 0.01 + hdir * hs * 0.004, hcy = nb + 0.155 * hsF;
  const chin = nb + 0.155 - 0.1; // scale the head about the chin, so a child's neck stays short
  const SH = (pts, color) => S(pts.map(([x, y]) => [hcx + (x - hcx) * hsF, chin + (y - chin) * hsF]), color);
  const rel0 = (x, y) => [hcx + (x - hcx) / hsF, nb + (y - nb) / hsF]; // inverse, so head code can stay in adult units
  // neck: in profile it leans forward from the collar to under the jaw
  const wN = smoothstep(0.15, 0.92, hs);
  const nx = (front, back) => [lerp(-0.04, hdir * back, wN), lerp(0.04, hdir * front, wN)];
  const [b0, b1] = nx(0.03, -0.05), [t0, t1] = nx(0.05, -0.04);
  const hc = nb + 0.155; // head centre in adult units (SH scales it up for children)
  SH([[hcx + b0, sy + 0.06], [hcx + b1, sy + 0.06], [hcx + t1, hc - 0.055], [hcx + t0, hc - 0.055]], TN('skin'));
  const hair = def.hair ?? 'short', back = Math.cos(hr) > 0;
  if (hs < 0.4 && (hair === 'short' || hair === 'crop' || hair === 'none')) for (const e of [-1, 1]) SH(ellipse(hcx + e * 0.07, hc - 0.012, 0.009, 0.018, 10), TN('skin')); // ears
  SH(headOutline(hcx, hc, hs, hdir, back, def.hat || def.crown ? 'crop' : hair, def.hairSeed ?? 1.3), TN('hair')); // hair tucks under a hat
  for (const hx of hairExtras(hair, hs, hdir, back)) SH(hx.map(([x, y]) => [hcx + x, hc + y]), TN('hair'));
  if (def.crown) { // a tall tapering crown (mukut) with a finial
    const cw = lerp(0.082, 0.07, hs), fx = hdir * hs * 0.01;
    SH([[hcx - cw, hc + 0.045], [hcx + cw, hc + 0.045], [hcx + cw * 0.8 + fx, hc + 0.12], [hcx + cw * 0.45 + fx, hc + 0.19], [hcx + 0.014 + fx, hc + 0.215], [hcx + fx, hc + 0.27], [hcx - 0.014 + fx, hc + 0.215], [hcx - cw * 0.45 + fx, hc + 0.19], [hcx - cw * 0.8 + fx, hc + 0.12]]);
    SH(ellipse(hcx, hc + 0.05, cw * 1.12, 0.016, 16));
  }
  if (def.hat) {
    SH(ellipse(hcx, hc + 0.078, 0.122 * lerp(1, 1.06, hs), 0.013, 18), TN('hat'));
    SH(ellipse(hcx - hdir * hs * 0.006, hc + 0.1, 0.086, 0.055, 18), TN('hat'));
  }
  // ---- accents: one small coloured detail that carries meaning (colour keys or motif names; never decoration) ----
  if (acc.hatband && def.hat) { const bx = hcx - hdir * hs * 0.006; SH([[bx - 0.089, hc + 0.081], [bx + 0.089, hc + 0.081], [bx + 0.087, hc + 0.107], [bx - 0.087, hc + 0.107]], acc.hatband); }
  if (acc.ribbon) { // a bow in the hair, at the back of the head (on top when seen from the front)
    const bx = hcx - hdir * hs * 0.078 + (1 - hs) * 0.085, by = hc + lerp(0.035, 0.06, hs);
    SH([[bx, by], [bx - 0.038, by + 0.024], [bx - 0.036, by - 0.02]], acc.ribbon); SH([[bx, by], [bx + 0.038, by + 0.024], [bx + 0.036, by - 0.02]], acc.ribbon);
    SH(ellipse(bx, by, 0.012, 0.012, 10), acc.ribbon);
  }
  const headEnd = polys.length;
  if (def.scarf) {
    // a wrap hugging the neck above the collar, and one short tail hanging in front, moving a little
    const wx = hcx * 0.6, sw = lerp(0.062, 0.05, s);
    S(smoothClosed([[wx - sw, sy + 0.07], [wx, sy + 0.06], [wx + sw, sy + 0.07], [wx + sw * 0.92, sy + 0.12], [wx, sy + 0.128], [wx - sw * 0.92, sy + 0.12]], 4), def.scarf);
    const side = lerp(-0.025, dir * 0.06, s);           // front view: off-centre; profile: on the chest
    const tail = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      tail.push([wx + side + dir * s * 0.02 * u + 0.012 * u * wind * noise3(u + time * 1.6, 2.2, 0), sy + 0.085 - u * 0.24]);
    }
    const tw = (i) => lerp(0.018, 0.014, i / 6) * lerp(1, 0.75, s);
    S([...tail.map(([x, y], i) => [x - tw(i), y]), ...tail.map(([x, y], i) => [x + tw(i), y]).reverse()], def.scarf);
  }

  // ---- a tail (vanara): from the small of the back it sweeps back, rises and curls forward at the tip ----
  let tailTip = null;
  if (def.tail) {
    const L = (def.tail.len ?? 1.5), n = 16, side = -dir * Math.max(s, 0.35), pts = [];
    let x = -dir * s * 0.1, y = B(0.98);
    const curl = def.tail.curl ?? 2.7, streaming = soar;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push([x, y]);
      // angle from 'backward' toward 'up'; in flight the tail streams straight back with a lift at the tip
      // (in flight the body pitches forward ~70°, so 'down along the legs' becomes 'streaming behind')
      let a = lerp(lerp(-0.45, curl, Math.pow(u, 0.9)), lerp(-1.25, -0.75, u * u), streaming);
      a += (0.18 + 0.25 * walk) * Math.sin(time * 1.4 + u * 3.2) * u + 0.1 * wind * noise3(time * 0.9 + u, 4.4, 0) * u;
      x += side * Math.cos(a) * (L / n); y += Math.sin(a) * (L / n);
    }
    const tw = (u) => lerp(0.048, 0.02, u);
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, w = tw(i / n);
      left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    S([...left, ...right.reverse()]);
    const tp = pts[pts.length - 1]; S(ellipse(tp[0], tp[1], 0.035, 0.035, 10)); // the tuft
    tailTip = tp;
  }
  // ---- things carried as part of the silhouette: a mace on the shoulder, a spear, a torch ----
  let carryTip = null;
  if (def.carry) {
    const hnd = def.carry.hand === 'near' ? hand : hand2 || hand, kind = def.carry.kind;
    if (kind === 'mace') { // shaft from the hand up over the shoulder, a fluted head on top
      const ax = hnd[0] - dir * s * 0.05, ay = hnd[1], tx = ax - dir * s * 0.22 - (1 - s) * 0.05, ty = ay + 0.72;
      S(limb(ax, ay - 0.08, tx, ty, 0.022, 0.026));
      S(ellipse(tx - dir * s * 0.03, ty + 0.1, 0.12, 0.14, 16)); S([[tx - 0.02, ty + 0.22], [tx + 0.02, ty + 0.22], [tx, ty + 0.32]]);
    } else if (kind === 'spear') {
      S(limb(hnd[0], hnd[1] - 0.9, hnd[0], hnd[1] + 1.25, 0.016, 0.016));
      S([[hnd[0] - 0.045, hnd[1] + 1.22], [hnd[0] + 0.045, hnd[1] + 1.22], [hnd[0], hnd[1] + 1.5]]);
    } else if (kind === 'torch') {
      S(limb(hnd[0], hnd[1] - 0.12, hnd[0] + dir * s * 0.06, hnd[1] + 0.42, 0.02, 0.03));
      carryTip = [hnd[0] + dir * s * 0.06, hnd[1] + 0.45];
    }
  }
  if (acc.belt || acc.sash) {
    const bw2 = (0.215 * (def.shoulders ?? 1) + 0.01) * nw;
    if (acc.belt) S([[-bw2 * 1.02, B(1.0)], [bw2 * 1.02, B(1.0)], [bw2 * 1.03, B(1.045)], [-bw2 * 1.03, B(1.045)]], acc.belt);
    if (acc.sash) { // over one shoulder and across to the other hip: a clear diagonal from every side
      const x0 = (1 - s) * bw2 * 0.85 - dir * s * 0.09, x1 = -(1 - s) * bw2 * 0.85 + dir * s * 0.12, wd = 0.04 + 0.01 * s;
      S([[x0 - wd, sy + 0.03], [x0 + wd, sy + 0.03], [x1 + wd, B(0.97)], [x1 - wd, B(0.97)]], acc.sash);
    }
  }
  if (acc.cuff) S(ellipse(hand[0], hand[1] + 0.045, 0.032, 0.02, 10), acc.cuff);
  // ---- posture: the head pitches (chin), the upper body leans and slumps about the hips ----
  const rot = (list, px, py, ang, squash) => {
    const c0 = Math.cos(ang), s0 = Math.sin(ang);
    const f2 = ([x, y]) => { const dx = x - px, dy = (y - py) * squash; return [px + dx * c0 - dy * s0, py + dx * s0 + dy * c0]; };
    for (let i = 0; i < list.length; i++) { const p = list[i]; if (Array.isArray(p)) list[i] = p.map(f2); else list[i] = { ...p, pts: p.pts.map(f2) }; }
  };
  const chinA = ((pose.chin ?? 0) - 22 * slump + (st.speaking || 0) * 4 * Math.sin(time * 9.5) * (0.6 + 0.4 * Math.sin(time * 2.3)) + 3 * (st.settle || 0)) * (Math.PI / 180); // talking nods; the head settles after a stop
  if (Math.abs(chinA) > 1e-3) {
    const headPolys = polys.slice(headStart, headEnd);
    rot(headPolys, hcx * k, (sy + 0.06) * k, chinA * hdir * hs, 1 - (1 - hs) * Math.min(0.12, Math.abs(chinA) * 0.3));
    polys.splice(headStart, headEnd - headStart, ...headPolys);
  }
  const leanDeg = (pose.lean ?? 0) + (gt.lean ?? 0) + 7 * slump + (gt.runLean ?? 4) * run + clamp((st.accel || 0) * 2.5, -5, 5);
  const leanA = leanDeg * (Math.PI / 180);
  if (Math.abs(leanA) > 1e-3) {
    const body = polys.slice(bodyStart);
    rot(body, 0, hipY * k, -leanA * dir * s, 1 - (1 - s) * (1 - Math.cos(leanA)));
    polys.splice(bodyStart, polys.length - bodyStart, ...body);
    const c0 = Math.cos(-leanA * dir * s), s0 = Math.sin(-leanA * dir * s);
    const rotH = (h) => { const dx = h[0], dy = h[1] - hipY; return [dx * c0 - dy * s0, hipY + dx * s0 + dy * c0]; };
    hand = rotH(hand); if (hand2) hand2 = rotH(hand2);
    if (tailTip) tailTip = rotH(tailTip); if (carryTip) carryTip = rotH(carryTip);
  }
  if (soar > 0.01) {
    // flight: the whole body pitches forward about the hips (head leading), seen best in profile
    const ang = -dir * (Math.PI / 2 - 0.22) * smoothstep(0, 1, soar) * Math.min(1, s * 1.4);
    const py0 = hipY * k;
    const all = polys.slice(0); rot(all, 0, py0, ang, 1); polys.splice(0, polys.length, ...all);
    const c0 = Math.cos(ang), s0 = Math.sin(ang), rp = (h) => { const x = h[0] * k, y = h[1] * k - py0; return [(x * c0 - y * s0) / k, (py0 + x * s0 + y * c0) / k]; };
    hand = rp(hand); if (hand2) hand2 = rp(hand2); if (tailTip) tailTip = rp(tailTip); if (carryTip) carryTip = rp(carryTip);
  }
  if (lie > 0.01) {
    // lying: in profile the figure rotates onto the ground (head toward the way it faced); seen end-on it becomes a low mound
    const ang = -dir * (Math.PI / 2) * smoothstep(0, 1, lie) * Math.min(1, s * 1.6);
    const squash = lerp(1, 0.28, lie * (1 - Math.min(1, s * 1.6)));
    const all = polys.slice(0); rot(all, 0, hipY * k * 0.9, ang, 1); // lie down where you stood: pivot near the hips
    let minY = Infinity; for (const p of all) for (const [, y] of (Array.isArray(p) ? p : p.pts)) minY = Math.min(minY, y);
    const f2 = ([x, y]) => [x, (y - minY) * squash];
    for (let i = 0; i < all.length; i++) { const p = all[i]; polys[i] = Array.isArray(p) ? p.map(f2) : { ...p, pts: p.pts.map(f2) }; }
    const c0 = Math.cos(ang), s0 = Math.sin(ang), py0 = hipY * k * 0.9, rh = (h) => { const x = h[0] * k, y = h[1] * k - py0; return [(x * c0 - y * s0) / k, ((py0 + x * s0 + y * c0 - minY) * squash) / k]; };
    hand = rh(hand); if (hand2) hand2 = rh(hand2);
  }
  polys.hand = [hand[0] * k, hand[1] * k];
  if (hand2) polys.hand2 = [hand2[0] * k, hand2[1] * k];
  if (tailTip) polys.tailTip = [tailTip[0] * k, tailTip[1] * k];
  if (carryTip) polys.carryTip = [carryTip[0] * k, carryTip[1] * k];
  return polys;
}

/** Person seen from high above: shoulders, head, a hint of stride. 3D polygons. */
function personTop(def, st) {
  const k = (def.height ?? 1.75) / 1.75;
  const h = st.heading, F = [Math.sin(h), Math.cos(h)], Sd = [Math.cos(h), -Math.sin(h)];
  const [x, z] = st.pos;
  const P = (f, s, y) => [x + F[0] * f + Sd[0] * s, y, z + F[1] * f + Sd[1] * s];
  const polys = [];
  const phase = ((st.dist || 0) / 0.74) * Math.PI;
  for (const side of [-1, 1]) {
    const f = side * Math.sin(phase) * 0.3 * (st.walking || 0);
    polys.push(ellipse(f, side * 0.08, 0.12, 0.05, 10).map(([a, b]) => P(a * k, b * k, 0.05)));
  }
  polys.push(ellipse(0, 0, 0.14, 0.25, 20).map(([a, b]) => P(a * k, b * k, 1.4 * k)));
  polys.push(ellipse(0.02, 0, 0.09, 0.08, 16).map(([a, b]) => P(a * k, b * k, 1.7 * k)));
  if (def.scarf) polys.push({ color: def.scarf, pts: ellipse(-0.02, 0, 0.1, 0.17, 14).map(([a, b]) => P(a * k, b * k, 1.72 * k)) });
  return polys;
}

/** Fill polygons given in 3D, normalising winding so overlaps union instead of cancelling. */
const mixH = (a, b, t) => { const A = parseInt(a.slice(1, 7), 16), B = parseInt(b.slice(1, 7), 16), m = (k) => Math.round(((A >> k) & 255) * (1 - t) + ((B >> k) & 255) * t); return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1); };
function fillProjected(g, view, polys, colors, defColor, rim = null) {
  const byColor = new Map();
  for (const p of polys) {
    const pts = Array.isArray(p) ? p : p.pts, col = Array.isArray(p) ? defColor : p.color;
    const scr = [];
    for (const q of pts) { const pr = view.project(q[0], q[1], q[2]); if (pr) scr.push(pr); }
    if (scr.length < 3) continue;
    let area = 0;
    for (let i = 0; i < scr.length; i++) { const a = scr[i], b = scr[(i + 1) % scr.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) scr.reverse();
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(scr);
  }
  const trace = (list) => { g.beginPath(); for (const scr of list) { g.moveTo(scr[0][0], scr[0][1]); for (let i = 1; i < scr.length; i++) g.lineTo(scr[i][0], scr[i][1]); g.closePath(); } };
  for (const [col, list] of byColor) { trace(list); g.fillStyle = colors[col] || col; g.fill('nonzero'); }
  // rim light: a thin edge of the scene's light on the side of the whole silhouette that faces it
  if (rim && rim.strength > 0.02) {
    const all = [...byColor.values()].flat();
    g.save(); trace(all); g.clip('nonzero');
    g.globalAlpha = Math.min(1, rim.strength); g.fillStyle = rim.color; trace(all); g.fill('nonzero');
    g.globalAlpha = 1; g.translate(-rim.dx, -rim.dy);
    for (const [col, list] of byColor) { trace(list); g.fillStyle = colors[col] || col; g.fill('nonzero'); }
    g.restore();
  }
}

export function drawPerson(g, view, def, st, time, colors, wind = 1, opts = {}) {
  const [x, z] = st.pos;
  const cam = view.cam;
  const vx = x - cam.pos[0], vz = z - cam.pos[2];
  const hd = Math.hypot(vx, vz);
  const elev = Math.atan2(cam.pos[1] - 1.0 - (st.y || 0), hd); // relative to the figure (it may stand on a crag or fly)
  let col = def.color || 'ink';
  // identity tone: each character's black carries a faint hue of its own (felt in close-ups, invisible at a distance)
  if (def.tone) col = mixH(colors[col] || col, colors[def.tone] || def.tone, def.toneAmt ?? 0.14);
  // TONAL MODE: garments in near-black values of their own (coat, sleeves, legs, shoes, skin, hair, hat), like layered
  // paper cut-outs — a silhouette from afar, separable people up close. def.tonal = true | { coat, legs, skin, hair, hat }
  // how tonal: always (true), never (false), or 'auto' — garments blend in as the figure fills the frame (close shots),
  // a pure silhouette in wide shots; eased, so a figure walking toward the lens never pops
  let tonalAmt = def.tonal === false ? 0 : def.tonal ? 1 : opts.tonal === true ? 1 : 0;
  if (!tonalAmt && opts.tonal === 'auto' && def.tonal !== false) {
    const dz = view.toCam(x, (st.y || 0) + (def.height ?? 1.75) * 0.5, z)[2];
    if (dz > 0.1) tonalAmt = smoothstep(0.34, 0.6, ((def.height ?? 1.75) * (st.scale ?? 1) * view.f / dz) / view.H);
  }
  if (tonalAmt > 0.01 && !def.tonal) def = { ...def, tonal: true };
  if (tonalAmt > 0.01) {
    const base = colors[col] || col, hue = colors[def.tone] || def.tone || '#3a3550', o = typeof def.tonal === 'object' ? def.tonal : {};
    // every garment stays near-black: its colour is a hue, never a lightness (luminance capped)
    const dark = (hex, maxL) => { const n = parseInt(hex.slice(1, 7), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, L = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255; if (L <= maxL) return hex; const k = maxL / L; return '#' + [r, gg, b].map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join(''); };
    const pick = (k, dflt, maxL = 0.15) => dark(colors[o[k]] || o[k] || dflt, maxL);
    const coat = pick('coat', mixH(base, hue, 0.6), 0.115);
    colors = { ...colors, __t_coat: coat, __t_sleeve: pick('sleeve', mixH(coat, '#ffffff', 0.05), 0.145), __t_legs: pick('legs', mixH(base, '#000000', 0.35)),
      __t_shoes: pick('shoes', mixH(base, '#000000', 0.5)), __t_skin: pick('skin', mixH(base, '#8a6450', 0.3), 0.12), __t_hair: pick('hair', mixH(base, '#000000', 0.25), 0.08),
      __t_hat: pick('hat', mixH(base, hue, 0.45), 0.1) };
    if (tonalAmt < 0.999) for (const k of Object.keys(colors)) if (k.startsWith('__t_')) colors[k] = mixH(base, colors[k], tonalAmt);
  }
  if (elev > 1.1) { fillProjected(g, view, personTop(def, st), colors, col); return; }
  const viewAz = Math.atan2(vx, vz);
  const rel = st.heading - viewAz;
  const Rx = Math.cos(viewAz), Rz = -Math.sin(viewAz);
  const y0 = st.y || 0;
  const kk = ((def.height ?? 1.75) / 1.75) * (st.scale ?? 1);
  const toLocal = (p3) => [((p3[0] - x) * Rx + (p3[2] - z) * Rz) / kk, (p3[1] - y0) / kk];
  if (st.gesture?.targetPos || st.gesture2?.targetPos) st = { ...st, touchL: st.gesture?.targetPos && toLocal(st.gesture.targetPos), touchL2: st.gesture2?.targetPos && toLocal(st.gesture2.targetPos) };
  const shape = personShape(def, st, rel, time, wind);
  const polys = shape.map((p) => {
    const pts = (Array.isArray(p) ? p : p.pts).map(([lx, ly]) => [x + Rx * lx, ly + y0, z + Rz * lx]);
    return Array.isArray(p) ? pts : { color: p.color, pts };
  });
  // in bed: a soft 3D blanket over the legs and lap; pose.tuck pulls it up toward the chin as she leans back
  if (st.tucked && st.sitOn === 'bed' && (st.sit || 0) > 0.3) {
    const tk = st.pose?.tuck ?? 0, h = st.heading, F = [Math.sin(h), Math.cos(h)], Sd = [Math.cos(h), -Math.sin(h)], k2 = (def.height ?? 1.75) / 1.75;
    const e0 = lerp(-0.18, -0.42, tk) * k2, e1 = 0.98 * k2, w = 0.3 * k2 * (def.build ?? 1), base = y0 - 0.03;
    const top = (e) => { const u = (e - e0) / (e1 - e0); return (u < 0.25 ? lerp(0.22, 0.3, Math.sin((u / 0.25) * Math.PI / 2)) : lerp(0.3, 0.13, smoothstep(0.25, 0.85, u)) + 0.05 * Math.exp(-((u - 0.86) ** 2) / 0.004)) * k2 + tk * 0.42 * k2 * Math.max(0, 1 - u * 2.2); };
    const P = (e, u, yy) => [x + F[0] * e + Sd[0] * u, yy, z + F[1] * e + Sd[1] * u], nE = 9, nU = 6;
    for (let i = 0; i < nE; i++) for (let j = 0; j < nU; j++) {
      const ea = lerp(e0, e1, i / nE), eb = lerp(e0, e1, (i + 1) / nE), ua = lerp(-w, w, j / nU), ub = lerp(-w, w, (j + 1) / nU);
      const H = (e, u) => base + top(e) * Math.sqrt(Math.max(0, 1 - (u / w) ** 2)) + 0.03;
      polys.push({ color: '__blanket', pts: [P(ea, ua, H(ea, ua)), P(eb, ua, H(eb, ua)), P(eb, ub, H(eb, ub)), P(ea, ub, H(ea, ub))] });
      if (j === 0 || j === nU - 1) { const uu = j === 0 ? ua : ub; polys.push({ color: '__blanket', pts: [P(ea, uu, base), P(eb, uu, base), P(eb, uu, H(eb, uu)), P(ea, uu, H(ea, uu))] }); }
    }
    for (const e of [e0, e1]) { const ring = []; for (let j = 0; j <= nU; j++) { const u = lerp(-w, w, j / nU); ring.push(P(e, u, base + top(e) * Math.sqrt(Math.max(0, 1 - (u / w) ** 2)) + 0.03)); } ring.push(P(e, w, base), P(e, -w, base)); polys.push({ color: '__blanket', pts: ring }); }
  }
  let rim = null;
  if (opts.rim) { // the light's direction on screen, and an edge width that scales with the figure
    const c3 = [x, y0 + (def.height ?? 1.75) * (st.scale ?? 1) * 0.6, z], a = view.project(...c3), b = view.project(...opts.rim.at(c3));
    if (a && b) {
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy);
      if (l < 1e-3) { dx = 0; dy = -1; } else { dx /= l; dy /= l; }
      const w = Math.max(1, Math.min(3.5, (view.f / a[2]) * 0.009));
      rim = { dx: dx * w, dy: dy * w, color: opts.rim.color, strength: opts.rim.strength };
    }
  }
  fillProjected(g, view, polys, opts.blanket ? { ...colors, __blanket: opts.blanket } : { ...colors, __blanket: colors.paper || '#e0dcd3' }, col, rim);
  const [hx, hy] = shape.hand;
  const out = { hand: [x + Rx * hx, hy + y0, z + Rz * hx] }; // where a held string or object attaches, as drawn
  if (shape.hand2) out.hand2 = [x + Rx * shape.hand2[0], shape.hand2[1] + y0, z + Rz * shape.hand2[0]];
  for (const key of ['tailTip', 'carryTip']) if (shape[key]) out[key] = [x + Rx * shape[key][0], shape[key][1] + y0, z + Rz * shape[key][0]];
  return out;
}

/** A view-independent estimate of a person's hand, for physics (kites, threads) before drawing. */
export function handApprox(def, st) {
  const H = (def.height ?? 1.75) * (st.scale ?? 1), h = st.heading || 0, g = st.gesture?.amt > 0.3 ? st.gesture.name : 'none';
  const up = { up: 1.08, catch: 1.05, fly: 0.92, wave: 1.0, point: 0.78, reach: 0.74, offer: 0.66, take: 0.62, hold: 0.56, hug: 0.68 }[g] ?? 0.45;
  const fwd = { up: 0.1, catch: 0.3, fly: 0.42, wave: 0.12, point: 0.55, reach: 0.5, offer: 0.38, take: 0.42, hold: 0.25, hug: 0.3 }[g] ?? 0.05;
  const [x, z] = st.pos, k = H / 1.75;
  return [x + Math.sin(h) * fwd * k + Math.cos(h) * 0.18 * k, (st.y || 0) + H * up, z + Math.cos(h) * fwd * k - Math.sin(h) * 0.18 * k];
}

/** Cast shadow on the ground (long, low sun). */
/** A soft contact shadow where the figure meets the ground: it keeps feet planted when there is no long shadow. */
export function drawContactShadow(g, view, def, st, color, alpha = 0.35) {
  const k = ((def.height ?? 1.75) / 1.75) * (st.scale ?? 1), b = def.build ?? 1;
  const [x, z] = st.pos, gy = st.ground ?? 0, lift = Math.max(0, (st.y || 0) - gy);
  const fade = Math.max(0, 1 - lift / (0.9 * k)); if (fade < 0.02) return;
  const rx = 0.3 * k * b * (1 + lift * 0.4), rz = 0.2 * k * b * (1 + lift * 0.4), pts = [];
  for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2; const p = view.project(x + Math.cos(t) * rx, gy + 0.01, z + Math.sin(t) * rz); if (!p) return; pts.push(p); }
  const c = view.project(x, gy + 0.01, z); if (!c) return;
  let R = 0; for (const p of pts) R = Math.max(R, Math.hypot(p[0] - c[0], p[1] - c[1]));
  g.save(); g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.clip();
  const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], R);
  const n = parseInt(color.slice(1, 7), 16), rgb = `${n >> 16},${(n >> 8) & 255},${n & 255}`;
  gr.addColorStop(0, `rgba(${rgb},${alpha * fade})`); gr.addColorStop(0.55, `rgba(${rgb},${alpha * fade * 0.5})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(c[0] - R, c[1] - R, R * 2, R * 2); g.restore();
}

export function drawShadow(g, view, def, st, sun, color) {
  const H = def.kind === 'bird' ? 0.12 : def.height ?? 1.75;
  const [x, z] = st.pos;
  const a = sun.az + Math.PI;
  const D = [Math.sin(a), Math.cos(a)], N = [Math.cos(a), -Math.sin(a)];
  const lift = st.pos3 ? st.pos3[1] : st.y || 0;
  const tanE = Math.tan(sun.elev);
  const L = H / tanE;
  const ox = x + (D[0] * lift) / tanE, oz = z + (D[1] * lift) / tanE;
  const bs = def.kind === 'bird' ? (def.size ?? 0.2) / 0.2 : def.build ?? 1;
  const prof = def.kind === 'bird'
    ? [[0, 0.03], [0.4, 0.06], [0.8, 0.04], [1, 0]]
    : [[0, 0.09], [0.1, 0.12], [0.3, 0.2], [0.7, 0.18], [0.8, 0.06], [0.84, 0.05], [0.88, 0.085], [0.96, 0.07], [1, 0]];
  const spread = (st.walking || 0) * 0.14 * Math.sin(((st.dist || 0) / 0.74) * Math.PI);
  const left = [], right = [];
  for (const [u, w] of prof) {
    const ww = w * bs + (u < 0.25 ? Math.abs(spread) * (1 - u * 4) : 0);
    left.push([ox + D[0] * u * L + N[0] * ww, oz + D[1] * u * L + N[1] * ww]);
    right.push([ox + D[0] * u * L - N[0] * ww, oz + D[1] * u * L - N[1] * ww]);
  }
  const poly = [...left, ...right.reverse()];
  g.beginPath();
  let first = true;
  for (const [px, pz] of poly) {
    const pr = view.project(px, 0.001, pz);
    if (!pr) continue;
    if (first) { g.moveTo(pr[0], pr[1]); first = false; } else g.lineTo(pr[0], pr[1]);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

// songbird profile (forward f, up u), metres for a 0.2 m bird, origin at the feet
const BIRD_SIDE = [[0.1, 0.105], [0.072, 0.115], [0.06, 0.128], [0.035, 0.137], [0.005, 0.126], [-0.035, 0.11], [-0.062, 0.09],
  [-0.112, 0.097], [-0.114, 0.083], [-0.058, 0.067], [-0.03, 0.046], [0.0, 0.038], [0.04, 0.052], [0.06, 0.08], [0.07, 0.1]];

/** Small bird, modelled in 3D: body profile + plan, flapping swept wings. */
export function drawBird(g, view, def, st, time, colors) {
  const sc = (def.size ?? 0.2) / 0.2;
  const [x, y, z] = st.pos3;
  const h = st.heading, cl = st.flying ? clamp(st.climb, -0.6, 0.6) * 0.6 : 0;
  const F = [Math.sin(h) * Math.cos(cl), Math.sin(cl), Math.cos(h) * Math.cos(cl)];
  const S = [Math.cos(h), 0, -Math.sin(h)];
  const U = [S[2] * F[1] - S[1] * F[2], S[0] * F[2] - S[2] * F[0], S[1] * F[0] - S[0] * F[1]];
  const lift = st.flying ? -0.06 : 0;
  const W = (f, u, s) => [x + (F[0] * f + U[0] * (u + lift) + S[0] * s) * sc, y + (F[1] * f + U[1] * (u + lift) + S[1] * s) * sc, z + (F[2] * f + U[2] * (u + lift) + S[2] * s) * sc];
  const polys = [];
  const peck = st.flying ? 0 : Math.max(0, Math.sin(time * 1.9 + 1)) ** 10 * 0.025;
  const side = smoothClosed(BIRD_SIDE.map(([f, u]) => [f, f > 0.03 ? u - peck * (f - 0.03) * 10 : u]), 4);
  polys.push(side.map(([f, u]) => W(f, u, 0)));
  polys.push(ellipse(-0.01, 0, 0.065, 0.03, 18).map(([f, s]) => W(f, 0.09, s)));      // plan view of body
  polys.push(ellipse(0.04, 0, 0.026, 0.024, 12).map(([f, s]) => W(f, 0.125, s)));     // plan view of head
  polys.push([W(-0.05, 0.088, 0), W(-0.112, 0.092, 0.026), W(-0.114, 0.09, -0.026)]); // tail fan
  if (st.flying) {
    const glide = st.climb < -0.25;
    const a = glide ? 0.18 + 0.06 * Math.sin(time * 5) : Math.sin(time * TAU * 7) * 0.95;
    for (const sg of [-1, 1]) {
      const wing = [[0.03, 0], [0.025, 0.07], [-0.01, 0.15], [-0.045, 0.165], [-0.04, 0.1], [-0.052, 0.04], [-0.04, 0]];
      polys.push(wing.map(([f, r]) => W(f, 0.105 + Math.sin(a) * r, sg * Math.cos(a) * r)));
    }
  }
  fillProjected(g, view, polys, colors, def.color || 'accent');
  if (!st.flying) {
    g.strokeStyle = colors[def.color || 'accent'] || def.color;
    const cz = Math.max(0.1, view.toCam(x, y, z)[2]);
    g.lineWidth = Math.max(0.5, (view.f * 0.0035 * sc) / cz);
    g.beginPath();
    for (const s of [-0.014, 0.014]) {
      const a = view.project(...W(0.0, 0.042, s)), b = view.project(...W(0.01, 0.0, s));
      if (a && b) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    }
    g.stroke();
  }
}
