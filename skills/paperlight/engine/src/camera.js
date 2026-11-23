// Virtual cinematography.
//
// A camera *spec* is a function (ctx) -> camera state, evaluated every frame, where
//   ctx = { u (0..1 through the shot), t (seconds into shot), dur, wt (world time),
//           wt0 (world time at shot start), world, W, H }
// and camera state = { pos:[x,y,z], yaw, pitch, roll, lens } (radians, lens in mm, 36mm gate).
//
// Specs speak the language of a director rather than of a matrix:
//   cam.frame({ subject:'walker', size:'MS', angle:'eye', side:90, lens:50, place:'left' })
// and every numeric parameter can be animated: size:['WS','MCU'] is a push-in,
// side:[120,180] an orbit, lens:[24,85] with a fixed size is a dolly-zoom.

import { DEG, animParam, lerp, clamp, angleLerp, getEase, noise3 } from './math.js';

// Vertical extent of the frame (metres) at the subject, by shot size.
export const SIZES = {
  ECU: 0.24, CU: 0.48, MCU: 0.8, MS: 1.25, MLS: 1.8, FS: 2.5, WS: 6, VWS: 16, EWS: 45, XWS: 120,
};
const sizeM = (s) => (typeof s === 'number' ? s : SIZES[s] ?? 2.5);

const ANGLES = { ground: { y: 0.12 }, low: { y: 0.45 }, hip: { y: 1.0 }, eye: { y: 1.58 }, high: { elev: 28 }, birds: { elev: 62 }, top: { elev: 89.6 } };

export function makeView(cam, W, H) {
  const f = (W * cam.lens) / 36;
  const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const F = [syw * cp, sp, cyw * cp];
  let R = [cyw, 0, -syw];
  let U = [F[1] * R[2] - F[2] * R[1], F[2] * R[0] - F[0] * R[2], F[0] * R[1] - F[1] * R[0]];
  if (cam.roll) {
    const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
    const R2 = R.map((v, i) => v * cr + U[i] * sr), U2 = U.map((v, i) => U[i] * cr - R[i] * sr);
    R = R2; U = U2;
  }
  const [px, py, pz] = cam.pos;
  const view = {
    cam, W, H, f, F, R, U, near: 0.08,
    // camera-space coordinates
    toCam(x, y, z) {
      const dx = x - px, dy = y - py, dz = z - pz;
      return [dx * R[0] + dy * R[1] + dz * R[2], dx * U[0] + dy * U[1] + dz * U[2], dx * F[0] + dy * F[1] + dz * F[2]];
    },
    project(x, y, z) {
      const [cx, cy, cz] = view.toCam(x, y, z);
      if (cz < view.near) return null;
      return [W / 2 + (f * cx) / cz, H / 2 - (f * cy) / cz, cz];
    },
  };
  return view;
}

function lookAngles(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

function subjectInfo(ctx, subject, lockT) {
  if (Array.isArray(subject)) {
    return { pos: subject.length === 3 ? subject : [subject[0], 0, subject[1]], heading: 0, height: 1.75 };
  }
  const st = ctx.world.state(subject, lockT ?? ctx.wt);
  const def = ctx.world.def(subject);
  const pos = st.pos3 || [st.pos[0], st.y || 0, st.pos[1]]; // people standing on a bridge deck are framed where they are
  return { pos, heading: st.heading, height: def.height ?? 1.75, state: st };
}

function attach(fn, desc) { fn.desc = desc; return fn; }

export const cam = {
  /** Frame a subject using shot-size grammar. */
  frame(o) {
    const fn = (ctx) => {
      const u = ctx.u, e = o.ease || 'inOut';
      const A = (v) => animParam(v, u, e);
      const lens = A(o.lens ?? 40);
      const f = (ctx.W * lens) / 36;
      let S = o.size ?? 'FS';
      if (Array.isArray(S)) { const a = Math.log(sizeM(S[0])), b = Math.log(sizeM(S[1])); S = Math.exp(lerp(a, b, getEase(e)(u))); }
      else if (typeof S === 'object' && S.from) { const a = Math.log(sizeM(S.from)), b = Math.log(sizeM(S.to)); S = Math.exp(lerp(a, b, getEase(S.ease || e)(clamp((u - (S.start ?? 0)) / ((S.end ?? 1) - (S.start ?? 0)))))); }
      const frameH = sizeM(S);
      const lockT = o.lock === 'start' ? ctx.wt0 : o.lock === 'end' ? ctx.wt0 + ctx.dur : typeof o.lock === 'number' ? o.lock : undefined;
      const sub = subjectInfo(ctx, o.subject, lockT);
      const D = (f * frameH) / ctx.H; // distance so the subject fills frameH
      const ty = A(o.ty) ?? Math.max(sub.height * 0.5, sub.height - frameH * 0.38);
      const target = [sub.pos[0], sub.pos[1] + ty, sub.pos[2]];

      // azimuth of camera position around the subject
      let posAz;
      if (o.az != null) posAz = A(o.az) * DEG + Math.PI; // az = direction the camera looks
      else posAz = sub.heading + A(o.side ?? 180) * DEG;
      const ang = A(o.angle ?? 'eye');
      let cy, hd;
      const spec = typeof ang === 'number' ? { elev: ang } : ANGLES[ang] || ANGLES.eye;
      if (spec.elev != null) {
        const el = spec.elev * DEG;
        hd = D * Math.cos(el); cy = target[1] + D * Math.sin(el);
      } else {
        cy = A(o.height) ?? spec.y;
        if (o.height == null && sub.pos[1] > 0.3) cy += sub.pos[1]; // eye level of someone standing up high (a deck, a crag, mid-air)
        hd = Math.sqrt(Math.max(0.01, D * D - (cy - target[1]) ** 2));
      }
      const pos = [target[0] + Math.sin(posAz) * hd, cy, target[2] + Math.cos(posAz) * hd];
      if (o.offset) { const off = A(o.offset); pos[0] += off[0]; pos[1] += off[1]; pos[2] += off[2]; }
      let { yaw, pitch } = lookAngles(pos, target);
      if (spec.elev > 89) yaw = posAz + Math.PI + (A(o.topYaw) ?? 0) * DEG;
      // composition: put the subject on a third / raise or lower it in frame
      const place = { left: -1 / 3, right: 1 / 3, center: 0 };
      const fx = typeof o.place === 'string' ? place[o.place] ?? 0 : A(o.place) ?? 0;
      const fy = A(o.placeY) ?? 0;
      yaw -= Math.atan((fx * ctx.W) / 2 / f);
      pitch -= Math.atan((fy * ctx.H) / 2 / f);
      yaw += (A(o.pan) ?? 0) * DEG;
      pitch += (A(o.tilt) ?? 0) * DEG;
      return { pos, yaw, pitch, roll: (A(o.roll) ?? 0) * DEG, lens };
    };
    const sz = Array.isArray(o.size) ? o.size.join('→') : o.size ?? 'FS';
    const desc = o.desc || [sz, typeof o.angle === 'number' ? `${o.angle}°` : o.angle || 'eye', `${Array.isArray(o.lens) ? o.lens.join('→') : o.lens ?? 40}mm`,
      o.az != null ? `az ${[].concat(o.az).join('→')}` : `side ${[].concat(o.side ?? 180).join('→')}`, o.lock ? 'locked' : 'tracking'].join(' · ');
    return attach(fn, desc);
  },

  /** Camera at a fixed place, looking at a point or a subject. Params animate. */
  fixed(o) {
    const fn = (ctx) => {
      const A = (v) => animParam(v, ctx.u, o.ease || 'inOut');
      const pos = A(o.pos);
      let target = o.look;
      if (typeof target === 'string') { const s = subjectInfo(ctx, target); target = [s.pos[0], s.pos[1] + (o.ty ?? 1.2), s.pos[2]]; }
      else target = A(target);
      let { yaw, pitch } = target ? lookAngles(pos, target) : { yaw: (A(o.yaw) ?? 0) * DEG, pitch: (A(o.pitch) ?? 0) * DEG };
      yaw += (A(o.pan) ?? 0) * DEG; pitch += (A(o.tilt) ?? 0) * DEG;
      return { pos, yaw, pitch, roll: (A(o.roll) ?? 0) * DEG, lens: A(o.lens ?? 35) };
    };
    return attach(fn, o.desc || `fixed · ${[].concat(o.lens ?? 35).join('→')}mm`);
  },

  /** Point of view of an actor: eye height, looking where their head looks. */
  pov(subject, o = {}) {
    const fn = (ctx) => {
      const A = (v) => animParam(v, ctx.u, o.ease || 'inOut');
      const st = ctx.world.state(subject, ctx.wt);
      const def = ctx.world.def(subject);
      const h = st.heading + (st.head || 0) + (A(o.pan) ?? 0) * DEG;
      const eye = [st.pos[0] + Math.sin(h) * 0.12, (def.height ?? 1.75) - 0.1, st.pos[1] + Math.cos(h) * 0.12];
      return { pos: eye, yaw: h, pitch: (A(o.tilt) ?? -6) * DEG, roll: 0, lens: A(o.lens ?? 32) };
    };
    return attach(fn, o.desc || `POV ${subject} · ${o.lens ?? 32}mm`);
  },

  /** Interpolate between two specs (each evaluated live). */
  move(a, b, o = {}) {
    const E = getEase(o.ease || 'inOut');
    const fn = (ctx) => {
      const u = E(clamp((ctx.u - (o.start ?? 0)) / ((o.end ?? 1) - (o.start ?? 0))));
      const A = a(ctx), B = b(ctx);
      return {
        pos: A.pos.map((v, i) => lerp(v, B.pos[i], u)),
        yaw: angleLerp(A.yaw, B.yaw, u), pitch: lerp(A.pitch, B.pitch, u), roll: lerp(A.roll || 0, B.roll || 0, u),
        lens: Math.exp(lerp(Math.log(A.lens), Math.log(B.lens), u)),
      };
    };
    return attach(fn, o.desc || `${a.desc}  ⟶  ${b.desc}`);
  },

  /** Add operator life: breathing handheld or a slow drift. amount ~ 0.2 subtle, 1 nervous. */
  handheld(spec, amount = 0.3, o = {}) {
    const fn = (ctx) => {
      const c = spec(ctx);
      const t = ctx.wt * (o.speed ?? 0.35);
      const a = amount * DEG;
      return { ...c, yaw: c.yaw + a * 1.4 * noise3(t, 1.1, 7), pitch: c.pitch + a * noise3(t, 5.3, 2), roll: (c.roll || 0) + a * 0.5 * noise3(t, 9.7, 4) };
    };
    return attach(fn, `${spec.desc} · handheld`);
  },
};
