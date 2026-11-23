// PLACE LIFE — background life a set gets by asking for it, instead of placing every passer-by by hand.
//   set.life = { walkers: 6, birds: 4, span: [0, 120] }
//     walkers: passers-by who walk the set's roads (or cross it, if it has none), back and forth, each with their own
//              height, build, hat or hair, pace and identity tone. They are background (`bg`): checks ignore them.
//     birds:   small flocks that cross the sky now and then.
//     span:    the stretch of world time to fill (default: the film's shots).
// Everything is seeded, so the same film always has the same people in the same places.

import { rng } from './math.js';

export function lifeCast(film) {
  const out = {};
  const sets = film.sets || {};
  const shots = film.shots || [];
  const tEnd = Math.max(60, ...shots.map((s) => (s.wt ?? 0) + 40)) + 30;
  for (const [setName, set] of Object.entries(sets)) {
    const life = set.life; if (!life) continue;
    const r = rng(((film.seed ?? 1) * 7919) ^ setName.length * 131);
    const [t0, t1] = life.span || [-10, tEnd];
    const roads = (set.roads || []).map((rd) => rd.pts);
    const [bx0, bz0, bx1, bz1] = set.bounds || [-60, -60, 60, 60];
    for (let i = 0; i < (life.walkers || 0); i++) {
      // a path: one of the roads (with a little sideways offset), else a line across the set
      let pts = roads.length ? roads[i % roads.length].map(([x, z]) => [x, z + (r() - 0.5) * 1.2]) : [[bx0 + 5, bz0 + r() * (bz1 - bz0)], [bx1 - 5, bz0 + r() * (bz1 - bz0)]];
      if (r() < 0.5) pts = pts.slice().reverse();
      // start somewhere along it
      const k = Math.floor(r() * (pts.length - 1)), u = r();
      const start = [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u];
      const fwd = pts.slice(k + 1), back = pts.slice(0).reverse();
      const speed = 1.0 + r() * 0.55, hat = r() < 0.35, tall = 1.55 + r() * 0.35;
      const blocking = [['at', start, Math.atan2(fwd[0][0] - start[0], fwd[0][1] - start[1]) * 57.3]];
      let leg = 0;
      for (let t = t0; t < t1 && leg < 8; leg++) { // back and forth until the span is covered (approximately)
        const path = leg === 0 ? fwd : leg % 2 ? back : pts;
        blocking.push(['walk', path, speed]);
        let L = 0; for (let j = 1; j < path.length; j++) L += Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]);
        t += L / speed + 1;
        if (r() < 0.3) blocking.push(['stand', 1 + r() * 3]);
      }
      out[`_${setName}_walker${i}`] = {
        kind: 'person', set: setName, bg: true, start: t0, height: tall, build: 0.85 + r() * 0.35, hem: 0.3 + r() * 0.3,
        hat, hair: hat ? 'short' : ['short', 'long', 'bob', 'bun', 'crop'][Math.floor(r() * 5)], hairSeed: r() * 5,
        tone: ['#2a2a36', '#33281f', '#25302c', '#30263a'][Math.floor(r() * 4)],
        gait: { stride: 0.85 + r() * 0.3, bounce: 0.5 + r() * 0.6, swing: 0.6 + r() * 0.5 }, blocking,
      };
    }
    for (let f = 0; f < (life.birds || 0); f++) {
      const tc = t0 + ((f + 0.5) / life.birds) * (t1 - t0) + (r() - 0.5) * 6, n = 3 + Math.floor(r() * 4);
      const a = r() * Math.PI * 2, cx = (bx0 + bx1) / 2 + (r() - 0.5) * (bx1 - bx0) * 0.4, cz = (bz0 + bz1) / 2 + (r() - 0.5) * (bz1 - bz0) * 0.4;
      const span = Math.max(bx1 - bx0, bz1 - bz0) * 0.6, y = 12 + r() * 14;
      for (let b = 0; b < n; b++) {
        const o = [(r() - 0.5) * 4, (r() - 0.5) * 2, (r() - 0.5) * 4], lag = b * 0.25;
        const P = (u) => [cx + Math.cos(a) * span * u + o[0], y + o[1] + 2 * Math.sin(u * 3), cz + Math.sin(a) * span * u + o[2]];
        out[`_${setName}_flock${f}_${b}`] = { kind: 'bird', set: setName, bg: true, size: 0.22, color: 'ink',
          blocking: [['key', tc - 12 + lag, P(-1)], ['key', tc - 4 + lag, P(-0.35)], ['key', tc + 4 + lag, P(0.35)], ['key', tc + 12 + lag, P(1)]] };
      }
    }
  }
  return out;
}
