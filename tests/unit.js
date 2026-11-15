/* GhostFit unit tests — run with:  node tests/unit.js
   Covers: exercise library integrity, templates, workout flattening & validation,
   voice-command parsing, the built-in coach (safety, honesty, workout generation),
   adaptation rules (never auto-applied, templates preserved), and confidence-based
   tracking (low-confidence reps are counted but never "corrected"). */
global.window = global; global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
global.document = { getElementById: () => null, addEventListener() {}, createElement: () => ({}), hidden: false }; global.addEventListener = () => {};
global.location = { search: '' };
const D = require('path').join(__dirname, '..', 'js') + require('path').sep;
for (const f of ['core/util', 'core/store', 'tracking/ghost', 'tracking/exercises', 'tracking/engine', 'data/library', 'data/workouts', 'core/voice', 'core/adapt', 'core/coach-engine']) eval(require('fs').readFileSync(D + f + '.js', 'utf8'));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
// library integrity
for (const e of GF.lib.list) { for (const id of [...e.alt, ...e.easier, ...e.harder]) ok(GF.lib.get(id), `${e.id} references missing ${id}`); if (e.track) ok(GF.EX[e.track], `${e.id} track missing`); if (e.ghostFrom) ok(GF.EX[e.ghostFrom], `${e.id} ghostFrom missing`); const d = GF.lib.demoOf(e); if (d) { try { GF.ghost.poseAt(d, 1.3); } catch (x) { ok(0, 'ghost fails ' + e.id + x); } } }
console.log('library:', GF.lib.list.length, 'exercises,', GF.lib.list.filter(e => e.track).length, 'camera-tracked,', GF.lib.list.filter(e => GF.lib.demoOf(e)).length, 'with demos');
// templates valid
for (const t of GF.wk.TEMPLATES) { const v = GF.wk.validate(t, { equipment: ['dumbbells', 'bench'] }); ok(!v.errors.length, t.id + ' ' + v.errors); }
// flatten: superset ordering
const w = GF.wk.TEMPLATES.find(t => t.id === 'tpl_lower'); const steps = GF.wk.flatten(w);
const seq = steps.filter(s => s.kind === 'work' && s.group).map(s => s.exId + s.set).join(',');
ok(seq === 'lunge1,bridge1,lunge2,bridge2,lunge3,bridge3', 'superset order ' + seq);
ok(steps[steps.length - 1].kind === 'work', 'no trailing rest');
// validation catches bad input
const bad = GF.wk.newWorkout(''); bad.blocks[1].items.push(GF.wk.group('superset', [GF.wk.exItem('squat')]));
const v = GF.wk.validate(bad, {}); ok(v.errors.length >= 2, 'validation ' + v.errors);
// voice parse
const P = GF.voiceParse; const cases = { 'pause': 'pause', 'hold on a second': 'pause', 'okay resume': 'resume', 'next exercise': 'next', 'skip this one': 'skip', 'add another set': 'addSet', 'how many reps are left': 'repsLeft', 'how much rest is left': 'restLeft', 'slow down please': 'slow', 'explain my form': 'form', 'how is my form': 'form', 'end the workout': 'end', 'end session': 'end', 'stop workout': 'end', "i'm done": 'done', 'repeat that': 'repeat', 'start workout': 'start', 'mute': 'mute' };
for (const [t, c] of Object.entries(cases)) ok(P(t) === c, `parse "${t}" → ${P(t)} expected ${c}`);
// coach engine
const R = q => GF.coach.respond(q, null);
const txt = r => r.blocks.map(b => b.text || (b.items || []).join(' ') || '').join(' ');
ok(/stop exercising/i.test(txt(R('I have chest pain and feel dizzy'))), 'safety');
ok(R('my knee hurts when i squat').blocks.some(b => /push through pain/i.test(b.text || '')), 'pain');
ok(/quads|glutes/.test(txt(R('What muscles do squats work?'))), 'muscles');
ok(R('What can replace burpees?').chips.length > 0, 'replace');
ok(/easier version|Knee Push-up|Incline/i.test(txt(R('Why am I struggling with push-ups?'))), 'struggling');
const wr = R('Create a 30-minute upper-body workout with no equipment'); ok(wr.workout && GF.wk.validate(wr.workout, {}).errors.length === 0, 'gen workout valid');
console.log('generated:', wr.workout.name, Math.round(GF.wk.estimateSeconds(wr.workout) / 60) + 'min:', GF.wk.allExerciseItems(wr.workout).map(i => i.exId).join(','));
const wr2 = R('20 minute seated workout'); console.log('seated:', GF.wk.allExerciseItems(wr2.workout).map(i => i.exId).join(','));
ok(GF.wk.allExerciseItems(wr2.workout).every(i => ['seatedPress', 'seatedCurl', 'seatedLateral', 'kneeExt', 'seatedMarch', 'breathing'].includes(i.exId)), 'seated only');
const wr3 = R('give me a 25 min hiit workout, low impact'); ok(GF.wk.allExerciseItems(wr3.workout).every(i => GF.lib.get(i.exId).impact === 'low'), 'low impact');
ok(/60.?90 seconds|seconds/.test(txt(R('How long should I rest?'))), 'rest');
ok(/Sit back|chair/i.test(txt(R('Explain squats more simply'))), 'simple');
ok(/not sure|only know/i.test(txt(R('who won the football game'))), 'fallback honest');
ok(/don.t have a recent set|only runs during a workout/i.test(txt(R('how was my form'))), 'no fake form review');
ok(/Camera tracking was not active/.test(txt(GF.coach.respond('how was my form', { exId: 'curl', lastSet: { exId: 'curl', tracked: false, good: 0, issues: {} } }))), 'honest untracked');
// adaptation never auto-increases; suggestions only
const sug = GF.adapt.suggestions(GF.wk.TEMPLATES[0], { perEx: { squat: 'easy', pushup: 'pain' } });
ok(sug.some(s => s.type === 'reps' && s.delta > 0 && /optional/i.test(s.reason)), 'easy suggestion optional');
ok(sug.some(s => s.safety), 'pain safety note');
ok(sug.every(s => !s.accepted), 'nothing pre-accepted');
const saved = GF.adapt.apply(GF.wk.TEMPLATES[0], sug.filter(s => s.type === 'reps'), 'x');
ok(saved && saved.name.includes('(adjusted)') && GF.wk.TEMPLATES[0].name === 'Full Body Foundations', 'template preserved');
ok(GF.wk.allExerciseItems(saved).find(i => i.exId === 'squat').reps === 12, 'applied +2 reps');
ok(GF.store.adaptations().length === 1, 'adaptation logged');
// engine: low-confidence frames never produce "bad" reps
const ex = GF.EX.squat; const rc = new GF.engine.RepCounter(ex); const evs = []; const W = 1280, H = 720;
const T = GF.ghost.motionFit(ex, { x: W * .25, y: H * .06, w: W * .5, h: H * .88 });
for (let rep = 0; rep < 3; rep++) for (let i = 0; i <= 90; i++) { const u = i / 90, e = u < .15 ? 0 : u < .45 ? (u - .15) / .3 : u < .6 ? 1 : u < .9 ? 1 - (u - .6) / .3 : 0;
  const lm = GF.ghost.toLandmarks(GF.ghost.poseAt(ex, 0, { e, variant: 'bad' }), T, W, H).map(p => ({ ...p, visibility: p.visibility > .5 ? 0.52 : p.visibility }));
  const a = GF.engine.analyze(ex, lm, W, H); for (const x of rc.feed(a, (rep * 91 + i) * 33)) if (['good', 'bad', 'partial'].includes(x.type)) evs.push(x.type + (x.assessed === false ? '(unassessed)' : '')); }
console.log('low-confidence bad squats →', evs.join(' '));
ok(evs.length === 3 && evs.every(x => x === 'good(unassessed)'), 'low confidence → counted but not assessed, no false corrections');
console.log(fails ? `FAILS: ${fails}` : 'ALL UNIT TESTS PASS');
