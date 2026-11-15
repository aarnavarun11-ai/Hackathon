/* GhostFit rep-counting accuracy harness — run with:  node tests/accuracy.js
   Builds realistic movement sequences from the ghost body model (with camera noise, dropouts and
   "real life" moves like dropping your arms between reps), feeds them through the same engine the
   app uses, and compares counted reps with what a human coach would count. */
global.window = global; global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
global.document = { getElementById: () => null, addEventListener() {}, createElement: () => ({}), hidden: false }; global.addEventListener = () => {};
global.location = { search: '' };
const D = require('path').join(__dirname, '..', 'js') + require('path').sep;
for (const f of ['core/util', 'core/store', 'tracking/ghost', 'tracking/exercises', 'tracking/engine']) eval(require('fs').readFileSync(D + f + '.js', 'utf8'));
const G = GF.ghost, E = GF.engine, X = GF.EX;
const W = 1280, H = 720, FPS = 30;
let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/** moves: [[fromKeys, toKeys, seconds], ...]; view: 'side'|'front' */
function run(def, view, moves, { noise = 0.004, dropout = +(process.env.DROPOUT ?? 0.02), anchor = 'feet' } = {}) {
  const pseudo = k => ({ view, type: 'reps', ghost: { anchor, cycle: 1, start: k } });
  const box = { x: W * 0.3, y: H * 0.06, w: W * 0.4, h: H * 0.88 };
  // frame the person like a real setup: everything they do stays in view
  const ext = moves.flatMap(([a, b]) => [a, b]).map(k => G.bbox(G.poseAt(pseudo(k), 0, { e: 0 })))
    .reduce((u, q) => ({ x0: Math.min(u.x0, q.x0), x1: Math.max(u.x1, q.x1), y0: Math.min(u.y0, q.y0) }), { x0: Infinity, x1: -Infinity, y0: Infinity });
  const T = G.fitTransform(G.poseAt(pseudo(moves[0][0]), 0, { e: 0 }), box, false, ext);
  const rc = new E.RepCounter(def); const stab = new E.Stability();
  const out = { good: 0, bad: 0, partial: 0 };
  let t = 0;
  for (const [a, b, sec] of moves) {
    const n = Math.max(1, Math.round(sec * FPS));
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1 || 1), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const ex = { view, type: 'reps', ghost: { anchor, cycle: 1, start: a, end: b } };
      const P = G.poseAt(ex, 0, { e });
      let lm = G.toLandmarks(P, T, W, H).map(p => ({ ...p, x: p.x + gauss() * noise, y: p.y + gauss() * noise }));
      if (rnd() < dropout) lm = lm.map((p, k) => (k >= 13 && k <= 16) || (k >= 25 && k <= 28) ? { ...p, visibility: 0.2 } : p);
      const an = E.analyze(def, lm, W, H); an.unstable = stab.push(def, an) > 0.09;
      for (const ev of rc.feed(an, t * 1000)) if (out[ev.type] != null) out[ev.type]++;
      t += 1 / FPS;
    }
  }
  return out;
}
const rep = (a, b, down = 0.9, up = 0.9, pause = 0.3) => [[a, a, pause], [a, b, down], [b, b, 0.25], [b, a, up]];
const times = (n, seq) => Array.from({ length: n }, () => seq).flat();

// ---------------- poses ----------------
const FS = { lean: 0, thigh: 180, shin: 180 };                              // front standing legs
const SIDES = { ...FS, uarm: 180, farm: 180 };                              // arms by sides
const GOAL = { ...FS, uarm: 92, farm: 2 };                                  // hands at shoulders (goal-post)
const TOP = { ...FS, uarm: 12, farm: 8 };                                   // pressed overhead
const WIDE = { ...FS, uarm: 40, farm: 44 };                                 // pressed overhead in a wide V
const HALF = { ...FS, uarm: 55, farm: 2 };                                  // only pushed halfway
const CURL_DOWN = { ...FS, uarm: 178, farm: 178 }, CURL_UP = { ...FS, uarm: 172, farm: 30 }, OVERHEAD = { ...FS, uarm: 5, farm: 5 };
const LAT_DOWN = { ...FS, uarm: 172, farm: 172 }, LAT_UP = { ...FS, uarm: 88, farm: 88 };
const SQ = X.squat.ghost, SQ_TOP = SQ.start, SQ_BOT = Object.assign({}, SQ.start, SQ.end);
const SQ_90 = { ...SQ_TOP, torso: 34, thigh: 112, shin: 204 }, SQ_SHALLOW = { ...SQ_TOP, torso: 20, thigh: 140, shin: 196 };

const cases = [
  ['Press: 6 clean reps', X.press, 'front', times(6, rep(GOAL, TOP)), 6],
  ['Press: arms dropped to sides between 4 reps', X.press, 'front', [].concat(...Array.from({ length: 4 }, () => [[SIDES, GOAL, 0.8], ...rep(GOAL, TOP), [GOAL, SIDES, 0.8], [SIDES, SIDES, 0.5]])), 4],
  ['Press: 5 reps in a wide V', X.press, 'front', times(5, rep(GOAL, WIDE)), 5],
  ['Press: 4 half reps (should not count)', X.press, 'front', times(4, rep(GOAL, HALF)), 0],
  ['Press: raising + lowering arms from sides only (no press)', X.press, 'front', times(4, [[SIDES, GOAL, 0.8], [GOAL, SIDES, 0.8]]), 0],
  ['Curl: 6 reps', X.curl, 'front', times(6, rep(CURL_DOWN, CURL_UP)), 6],
  ['Curl: arms raised overhead (no curl)', X.curl, 'front', times(3, rep(CURL_DOWN, OVERHEAD)), 0],
  ['Lateral raise: 6 reps', X.lateral, 'front', times(6, rep(LAT_DOWN, LAT_UP)), 6],
  ['Squat: 6 full reps', X.squat, 'side', times(6, rep(SQ_TOP, SQ_BOT, 1.1, 1.1)), 6],
  ['Squat: 5 reps to ~90° (thighs almost level)', X.squat, 'side', times(5, rep(SQ_TOP, SQ_90, 1.1, 1.1)), 5],
  ['Squat: 4 shallow knee bends (should not count)', X.squat, 'side', times(4, rep(SQ_TOP, SQ_SHALLOW, 0.8, 0.8)), 0],
  ['Squat: 6 fast reps (~1 s each)', X.squat, 'side', times(6, rep(SQ_TOP, SQ_BOT, 0.42, 0.42, 0.15)), 6],
  ['Squat: 3 slow reps (6 s each)', X.squat, 'side', times(3, rep(SQ_TOP, SQ_BOT, 2.8, 2.8, 0.5)), 3],
  ['Squat: 4 reps with chest collapsing forward (bad form)', X.squat, 'side', times(4, rep(SQ_TOP, Object.assign({}, SQ_BOT, SQ.bad), 1.1, 1.1)), 0],
  ['Standing still with camera noise (20 s)', X.press, 'front', [[GOAL, GOAL, 20]], 0],
  ['Squat stance, standing still, heavy noise (20 s)', X.squat, 'side', [[SQ_TOP, SQ_TOP, 20]], 0],
];
let correct = 0, total = 0, perfect = 0;
for (const [name, def, view, moves, expect] of cases) {
  const r = run(def, view, moves, { anchor: view === 'side' ? 'ankle' : 'feet', noise: /heavy/.test(name) ? 0.008 : 0.004 });
  const err = Math.abs(r.good - expect);
  total += Math.max(expect, r.good); correct += Math.max(expect, r.good) - err; if (!err) perfect++;
  console.log(`${err ? '✗' : '✓'} ${name.padEnd(58)} expected ${expect}, counted ${r.good}  (not counted: ${r.bad} bad, ${r.partial} partial)`);
}
console.log(`\nACCURACY ${(100 * correct / Math.max(1, total)).toFixed(1)}%  ·  ${perfect}/${cases.length} scenarios exact`);
process.exitCode = perfect === cases.length ? 0 : 1;
