// test: a seamless ambient loop on rippled abstract ground with land motion
import { cam } from '../../engine/src/camera.js';
export default {
  title: 'Loop Test', fps: 24, size: [1920, 1080], seed: 3, loop: { crossfade: 1.5 },
  palette: { paper: '#e9e6df', ink: '#1a1a1e', accent: '#c4381e' },
  sets: { main: { bounds: [-80, -80, 80, 80], cell: 0.5, field: { type: 'rings', centers: [[0, 0], [25, 30]], period: 4, warp: 3, levels: 8, spacing: 1, tone: 0.4 },
    style: { coverage: 0.14, maxPen: 1.4 }, motion: { dir: 30, speed: 2, amp: 0.35, length: 16 },
    props: [{ kind: 'pillar', at: [6, 10], h: 5 }, { kind: 'arch', at: [-6, 14], w: 3, h: 4.5 }] } },
  cast: { a: { kind: 'person', set: 'main', height: 1.7, hair: 'long', blocking: [['at', [0, 0], 40], ['walk', [[3, 4], [6, 6]], 0.9]] } },
  shots: [{ name: 'loop', set: 'main', dur: 8, wt: 0, camera: cam.fixed({ pos: [[-8, 3, -10], [-7, 3, -9.5]], look: [2, 1, 6], lens: 30, ease: 'linear' }) }],
};
