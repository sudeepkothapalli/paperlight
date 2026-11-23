// Sound, synthesised from the film itself — no samples.
//
//  • drone: a quiet chord in the film's key, breathing slowly
//  • wind: filtered noise with gusts (paper landscapes are windy places)
//  • footsteps: emitted by the walk simulation (one per stride), loudness by distance to
//    the camera, panned by where the walker sits in the frame
//  • birdsong: from the bird's 'chirp' blocking, same spatialisation
//  • score: sparse piano-like notes from each shot's `sound` cues, through a small reverb
// Everything is derived from the same world clock as the picture, so sound is in sync
// by construction.

import fs from 'node:fs';
import { makeView } from './camera.js';
import { resolveSeason, windAt } from './atmosphere.js';
import { rng, noise3, clamp, smoothstep } from './math.js';

const SR = 48000;
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function noteFreq(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function addPiano(buf, start, freq, vel, pan = 0) {
  const partials = [[1, 1], [2, 0.42], [3, 0.2], [4.02, 0.1], [5.03, 0.05], [6.05, 0.025]];
  const dur = 5.5, n = Math.floor(dur * SR), i0 = Math.floor(start * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (const [p, a] of partials) {
    const f = freq * p, tau = 2.6 / Math.sqrt(p), w = (2 * Math.PI * f) / SR;
    for (let i = 0; i < n && i0 + i < buf.L.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.006) * Math.exp(-t / tau) * (1 - smoothstep(dur - 0.6, dur, t));
      const v = Math.sin(w * i + p) * a * env * vel * 0.16;
      buf.L[i0 + i] += v * gl; buf.R[i0 + i] += v * gr;
    }
  }
}

function addStep(buf, start, gain, pan, r) {
  const n = Math.floor(0.12 * SR), i0 = Math.floor(start * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  let lp1 = 0, lp2 = 0;
  const bright = 0.18 + r() * 0.1;
  for (let i = 0; i < n && i0 + i < buf.L.length; i++) {
    const t = i / SR;
    const x = r() * 2 - 1;
    lp1 += (x - lp1) * bright; lp2 += (lp1 - lp2) * 0.03;
    const crunch = (lp1 - lp2) * Math.exp(-t / 0.028) * (1 + 0.6 * Math.sin(t * 900));
    const thump = Math.sin(2 * Math.PI * 85 * t) * Math.exp(-t / 0.018) * 0.5;
    const v = (crunch * 1.4 + thump) * gain;
    buf.L[i0 + i] += v * gl; buf.R[i0 + i] += v * gr;
  }
}

function addChirp(buf, start, gain, pan, r) {
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  const count = 2 + Math.floor(r() * 3);
  let t0 = start;
  for (let c = 0; c < count; c++) {
    const len = 0.045 + r() * 0.04, f0 = 3000 + r() * 900, f1 = f0 + 900 + r() * 1400;
    const n = Math.floor(len * SR), i0 = Math.floor(t0 * SR);
    let ph = 0;
    for (let i = 0; i < n && i0 + i < buf.L.length; i++) {
      const u = i / n;
      const f = f0 + (f1 - f0) * Math.sin(u * Math.PI * 0.5) + 180 * Math.sin(u * 60);
      ph += (2 * Math.PI * f) / SR;
      const env = Math.sin(Math.PI * u) ** 2;
      const v = Math.sin(ph) * env * gain * 0.22;
      buf.L[i0 + i] += v * gl; buf.R[i0 + i] += v * gr;
    }
    t0 += len + 0.05 + r() * 0.06;
  }
}

// a few synthesized effects for story beats (any real recording can be added as an audio track instead)
function addSfx(buf, start, type, gain = 0.5, pan = 0, r = Math.random) {
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  const dur = { chime: 3.5, whoosh: 1.2, pluck: 1.4, thump: 0.5, flutter: 1.6, pop: 0.2 }[type] ?? 1;
  const n = Math.floor(dur * SR), i0 = Math.floor(start * SR);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n && i0 + i < buf.L.length; i++) {
    const t = i / SR, u = t / dur;
    let v = 0;
    if (type === 'chime') for (const [m, a] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]]) v += Math.sin(2 * Math.PI * 1318 * m * t) * a * Math.exp(-t * (1.2 + m * 0.5));
    else if (type === 'pluck') v = Math.sin(2 * Math.PI * 392 * t + 2 * Math.exp(-t * 20)) * Math.exp(-t * 3.5);
    else if (type === 'thump') v = Math.sin(2 * Math.PI * (70 + 60 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14);
    else if (type === 'pop') v = Math.sin(2 * Math.PI * (900 - 600 * u) * t) * Math.exp(-t * 40);
    else { // whoosh / flutter: filtered noise with a swelling envelope
      const x = r() * 2 - 1, cut = type === 'whoosh' ? 0.02 + 0.25 * Math.sin(Math.PI * u) : 0.15;
      lp += (x - lp) * cut; lp2 += (lp - lp2) * cut;
      const env = type === 'whoosh' ? Math.sin(Math.PI * u) ** 2 : (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 18)) * Math.sin(Math.PI * u);
      v = (lp - lp2) * 4 * env;
    }
    v *= gain * 0.25 * Math.min(1, t / 0.004);
    buf.L[i0 + i] += v * gl; buf.R[i0 + i] += v * gr;
  }
}

function reverb(L, R, wet = 0.3) {
  const combs = [1687, 1601, 2053, 2251, 1867, 1499], aps = [347, 113, 37];
  const proc = (x, spread) => {
    const y = new Float32Array(x.length);
    for (const d0 of combs) {
      const d = d0 + spread, line = new Float32Array(d);
      let idx = 0, lp = 0;
      for (let i = 0; i < x.length; i++) {
        const o = line[idx];
        lp = o * 0.62 + lp * 0.38;
        line[idx] = x[i] + lp * 0.86;
        y[i] += o / combs.length;
        idx = (idx + 1) % d;
      }
    }
    for (const d0 of aps) {
      const d = d0 + spread, line = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < y.length; i++) {
        const b = line[idx], v = y[i] + b * -0.5;
        line[idx] = v; y[i] = b + v * 0.5;
        idx = (idx + 1) % d;
      }
    }
    return y;
  };
  const wl = proc(L, 0), wr = proc(R, 23);
  for (let i = 0; i < L.length; i++) { L[i] = L[i] * (1 - wet * 0.4) + wl[i] * wet; R[i] = R[i] * (1 - wet * 0.4) + wr[i] * wet; }
}

export function renderAudio(film, R, file) {
  const dur = R.duration + 0.5 + (R.loopCF || 0);
  const N = Math.ceil(dur * SR);
  const amb = { L: new Float32Array(N), R: new Float32Array(N) };
  const fx = { L: new Float32Array(N), R: new Float32Array(N) };
  const mus = { L: new Float32Array(N), R: new Float32Array(N) };
  const sc = film.score || {};
  const r = rng(film.seed ?? 7);
  const key = noteFreq((sc.key || 'D') + '2');

  // drone + wind
  const droneLv = 0.018 * (sc.drone ?? 1), windLv = 0.05 * (sc.wind ?? 1);
  const chord = [1, 1.5, 2, 2.997, 4.003];
  let wl = 0, wr = 0, wl2 = 0, wr2 = 0, rl = 0, rr = 0, fl = 0, fr = 0, sl = 0, sr = 0, sl2 = 0, sr2 = 0;
  // per-shot ambience targets (season sound beds), smoothed so seasons cross-fade at cuts
  const amb0 = { wind: 1, gusts: 1, muffle: 0, drone: 1, rain: 0, insects: 0, birds: 0, pad: 0, tick: 0, crickets: 0, fire: 0, surf: 0 };
  const targets = R.shots.map((sh) => {
    const sp = sh.season ?? sh.mood ?? R.setMood?.(sh); const se = resolveSeason(sp?.to ?? sp, film);
    return { ...amb0, ...(se?.sound || {}), wind: (se?.sound?.wind ?? 1) * (sh.wind ?? 1), ...(sh.ambience || {}) };
  });
  const cur = { ...amb0, ...targets[0] };
  let si = 0;
  const k = 1 - Math.exp(-1 / (SR * 0.6));
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    while (si < R.shots.length - 1 && t >= R.shots[si + 1].ft0) si++;
    const tg = targets[si];
    for (const kk of Object.keys(amb0)) cur[kk] += (tg[kk] - cur[kk]) * k;
    let d = 0;
    for (let c = 0; c < chord.length; c++) {
      const m = chord[c];
      const lfo = 0.6 + 0.4 * Math.sin(t * (0.07 + c * 0.023) + c);
      d += Math.sin(2 * Math.PI * key * m * t + Math.sin(t * 0.3 + c) * 0.4) * lfo / (1 + c * 0.8);
    }
    const gust = 0.5 + 0.5 * noise3(t * 0.18, 1.3, 0) * cur.gusts + 0.25 * noise3(t * 0.9, 4.1, 0) * cur.gusts;
    const cut = (0.012 + 0.035 * gust) * (1 - 0.65 * cur.muffle);
    wl += ((r() * 2 - 1) - wl) * cut; wr += ((r() * 2 - 1) - wr) * cut;
    wl2 += (wl - wl2) * cut; wr2 += (wr - wr2) * cut;
    if (i % 480 === 0) { const sh = R.shots[si]; cur._g = windAt(film.air, sh.wt0 + (t - sh.ft0)).gust || 0; } // staged gusts are heard
    const w = windLv * clamp(gust, 0.1, 1.6) * 6 * cur.wind * (1 + 1.6 * (cur._g || 0));
    let L = d * droneLv * cur.drone + wl2 * w, Rv = d * droneLv * cur.drone + wr2 * w;
    if (cur.rain > 0.01) { // rain: bright hiss + scattered drops
      const nl = r() * 2 - 1, nr = r() * 2 - 1;
      rl += (nl - rl) * 0.35; rr += (nr - rr) * 0.35;
      L += (nl - rl) * 0.03 * cur.rain; Rv += (nr - rr) * 0.03 * cur.rain;
    }
    if (cur.insects > 0.01) { // distant summer insects: a high shimmer, pulsing
      const pulse = Math.pow(Math.max(0, Math.sin(t * 2 * Math.PI * 28)), 6) * (0.6 + 0.4 * noise3(t * 0.4, 9, 0));
      const v = (Math.sin(t * 2 * Math.PI * 4400) + 0.5 * Math.sin(t * 2 * Math.PI * 5230)) * pulse * 0.0035 * cur.insects;
      L += v; Rv += v * 0.8;
    }
    if (cur.pad > 0.01) { // dream pad: a high, slow, breathing chord
      let pv = 0;
      for (const [m, ph] of [[4, 0], [5.04, 1.3], [6, 2.1], [8.01, 0.7]]) pv += Math.sin(2 * Math.PI * key * m * t + ph + 0.6 * Math.sin(t * 0.21 + ph)) * (0.55 + 0.45 * Math.sin(t * 0.13 + ph * 2));
      L += pv * 0.0055 * cur.pad; Rv += pv * 0.005 * cur.pad;
    }
    if (cur.crickets > 0.01) { // a cricket somewhere outside: short trills
      const cyc = t % 1.3, on = cyc < 0.28 ? Math.pow(Math.max(0, Math.sin(cyc * 2 * Math.PI * 22)), 4) : 0;
      const v = Math.sin(t * 2 * Math.PI * 4300) * on * 0.004 * cur.crickets;
      L += v * 0.6; Rv += v;
    }
    if (cur.fire > 0.01) { // a big fire: a low roar that breathes
      fl += ((r() * 2 - 1) - fl) * 0.03; fr += ((r() * 2 - 1) - fr) * 0.03;
      const br = 0.7 + 0.3 * noise3(t * 0.7, 6.1, 0);
      L += fl * 0.16 * cur.fire * br; Rv += fr * 0.16 * cur.fire * br;
    }
    if (cur.surf > 0.01) { // the sea: waves that swell and break, slowly
      sl += ((r() * 2 - 1) - sl) * 0.08; sr += ((r() * 2 - 1) - sr) * 0.08;
      sl2 += (sl - sl2) * 0.25; sr2 += (sr - sr2) * 0.25;
      const sw = Math.pow(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 6.5), 2), sw2 = Math.pow(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 6.5 + 2.2), 2);
      L += sl2 * 0.09 * cur.surf * (0.25 + sw); Rv += sr2 * 0.09 * cur.surf * (0.25 + sw2);
    }
    if (cur.tick > 0.01) { // a clock in the room
      const ph = t % 1;
      if (ph < 0.012) { const e = Math.exp(-ph / 0.002); const v = (r() * 2 - 1) * e * 0.02 * cur.tick * (Math.floor(t) % 2 ? 0.8 : 1); L += v; Rv += v * 0.7; }
    }
    amb.L[i] = L; amb.R[i] = Rv;
  }
  // spring birdsong, scattered and distant
  R.shots.forEach((sh, i) => {
    if (!(targets[i].birds > 0)) return;
    for (let t = 0.3; t < sh.dur; t += 0.9 + r() * 1.6) addChirp(fx, sh.ft0 + t, 0.12 * targets[i].birds * (0.5 + r() * 0.5), (r() - 0.5) * 1.6, r);
  });
  // fire crackle: sharp pops scattered through the roar
  R.shots.forEach((sh, i) => {
    if (!(targets[i].fire > 0)) return;
    for (let t = 0; t < sh.dur; t += 0.02 + r() * 0.12) {
      const i0 = Math.floor((sh.ft0 + t) * SR), g = 0.05 * targets[i].fire * Math.pow(r(), 2), pan = r() * 2 - 1;
      for (let j = 0; j < 140 && i0 + j < N; j++) { const v = (r() * 2 - 1) * g * Math.exp(-j / 22); fx.L[i0 + j] += v * (1 - pan) / 2; fx.R[i0 + j] += v * (1 + pan) / 2; }
    }
  });
  // rain drops
  R.shots.forEach((sh, i) => {
    if (!(targets[i].rain > 0)) return;
    for (let t = 0; t < sh.dur; t += 0.01 + r() * 0.05) {
      const i0 = Math.floor((sh.ft0 + t) * SR), g = 0.03 * targets[i].rain * r(), pan = r() * 2 - 1;
      for (let j = 0; j < 90 && i0 + j < N; j++) { const v = (r() * 2 - 1) * g * Math.exp(-j / 18); fx.L[i0 + j] += v * (1 - pan) / 2; fx.R[i0 + j] += v * (1 + pan) / 2; }
    }
  });

  // world sounds, spatialised per shot
  const W = R.W, H = R.H;
  for (const shot of R.shots) {
    const dt = 1 / 240;
    for (const [name, a] of Object.entries(R.world.actors)) {
      if (a.def.kind === 'bird') {
        for (const c of a.chirps) {
          if (c < shot.wt0 || c >= shot.wt0 + shot.dur) continue;
          const t = c - shot.wt0;
          const { gain, pan } = spatial(R, shot, t, a.state(c).pos3);
          addChirp(fx, shot.ft0 + t, gain * 1.2, pan, r);
        }
        continue;
      }
      let prevStep = null;
      for (let t = 0; t < shot.dur; t += dt) {
        const st = a.state(shot.wt0 + t);
        const step = Math.floor(st.steps ?? (st.dist || 0) / 0.74);
        const here = !film.sets || (st.set ?? 'main') === R.setOf(shot);
        if (prevStep != null && step !== prevStep && st.walking > 0.05 && st.visible && here && !shot.hide?.includes(name)) {
          const { gain, pan } = spatial(R, shot, t, [st.pos[0], 0, st.pos[1]]);
          addStep(fx, shot.ft0 + t, gain * (0.7 + 0.3 * r()) * (1 - 0.5 * (targets[shot.index]?.muffle || 0)), pan, r);
        }
        prevStep = step;
      }
    }
    for (const cue of shot.sound || []) {
      if (cue.note) addPiano(mus, shot.ft0 + cue.at, noteFreq(cue.note), cue.vel ?? 0.4, cue.pan ?? (r() - 0.5) * 0.5);
      if (cue.sfx) addSfx(cue.sfx === 'chime' || cue.sfx === 'pluck' ? mus : fx, shot.ft0 + cue.at, cue.sfx, cue.vel ?? 0.5, cue.pan ?? 0, r);
    }
  }
  reverb(mus.L, mus.R, 0.5);
  reverb(fx.L, fx.R, 0.12);

  // mix, fades, soft clip, normalise
  const L = new Float32Array(N), Rr = new Float32Array(N);
  let peak = 1e-6;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const g = R.loopCF ? 1 : smoothstep(0, 0.8, t) * (1 - smoothstep(dur - 3, dur - 0.3, t));
    L[i] = Math.tanh((amb.L[i] + fx.L[i] + mus.L[i]) * 1.2) * g;
    Rr[i] = Math.tanh((amb.R[i] + fx.R[i] + mus.R[i]) * 1.2) * g;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
  }
  if (R.loopCF) { // seamless loop: blend the tail into the head, end exactly at the loop point
    const cf = Math.floor(R.loopCF * SR), D = Math.floor(R.duration * SR);
    for (let i = 0; i < cf && D + i < N; i++) { const u = i / cf; L[i] = L[i] * u + L[D + i] * (1 - u); Rr[i] = Rr[i] * u + Rr[D + i] * (1 - u); }
  }
  const norm = 0.89 / peak;
  const out = Buffer.alloc(44 + N * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    out.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(clamp(Rr[i] * norm, -1, 1) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, out);
  return file;
}

function spatial(R, shot, t, p3) {
  const { cam } = R.cameraAt(shot, t);
  const view = makeView(cam, R.W, R.H);
  const d = Math.hypot(p3[0] - cam.pos[0], p3[1] - cam.pos[1], p3[2] - cam.pos[2]);
  const pr = view.project(p3[0], p3[1] + 0.5, p3[2]);
  const pan = pr ? clamp((pr[0] / R.W) * 2 - 1, -0.9, 0.9) : 0;
  const onScreen = pr && pr[0] > 0 && pr[0] < R.W && pr[1] > 0 && pr[1] < R.H ? 1 : 0.5;
  return { gain: clamp(3.2 / (d + 1.5), 0.02, 1) * onScreen, pan };
}
