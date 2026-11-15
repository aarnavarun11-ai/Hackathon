/* GhostFit exercise self-test
   Poses the ghost body model through every exercise and checks the tracker:
   good reps must count, bad-form reps must be rejected with the right fix,
   half reps must be flagged, and standing still must never count a rep.
   Run:  node tests/exercise-check.js          (add --flip to test facing the other way)
*/
global.window = global;
const path = require('path');
const D = path.join(__dirname, '..', 'js', 'tracking') + path.sep;
for (const f of ['ghost.js','exercises.js','engine.js']) eval(require('fs').readFileSync(D+f,'utf8'));
const {ghost, EX, engine} = GF;
const W=1280,H=720;
function lmsFor(ex, opts, flip=flipArg){
  const P = ghost.poseAt(ex, 0, opts);
  const T = ghost.motionFit(ex, {x:W*0.2,y:H*0.1,w:W*0.6,h:H*0.8}, flip);
  return ghost.toLandmarks(P, T, W, H);
}
const flipArg = process.argv.includes('--flip');
let fails=0;
for (const [id, ex] of Object.entries(EX)) {
  const row = [];
  const run = (label, opts) => {
    const a = engine.analyze(ex, lmsFor(ex, opts), W, H);
    if (!a.valid) { row.push(`${label}: INVALID(${a.reason})`); return a; }
    const formHits = ex.type==='hold' ? (ex.check(a.P)?.id||'ok') : ex.form.filter(f=>f.test(a.P)).map(f=>f.id).join(',')||'-';
    const gate = ex.gate ? (ex.gate(a.P)||'ok') : 'n/a';
    row.push(`${label}: m=${a.metric?.toFixed(0)} form=${formHits} gate=${gate}`);
    return a;
  };
  run('start',{e:0}); if (ex.type==='reps') run('end',{e:1}); if (ex.ghost.bad) run('bad',{e:1,variant:'bad'});
  // full simulated sequences through RepCounter / HoldTracker
  if (ex.type==='reps') {
    const seq = (variant, scale=1) => {
      const rc = new engine.RepCounter(ex); const evs=[]; let t=0;
      for (let rep=0; rep<3; rep++) for (let i=0;i<=90;i++){ // 3s per rep at 30fps
        const u=i/90; const e = (u<0.15?0:u<0.45?(u-0.15)/0.3:u<0.6?1:u<0.9?1-(u-0.6)/0.3:0)*scale;
        const a = engine.analyze(ex, lmsFor(ex,{e,variant}), W, H);
        for (const v of rc.feed(a, t)) if (['good','bad','partial'].includes(v.type)) evs.push(v.type+(v.issue?':'+v.issue.id:''));
        t+=33;
      }
      return evs.join(' ');
    };
    const g=seq(), b=ex.ghost.bad?seq('bad'):'(none)', p=seq(undefined,0.6);
    row.push(`GOOD→[${g}] BAD→[${b}] HALF→[${p}]`);
    if (g!=='good good good') fails++;
    if (ex.ghost.bad && !/^bad:\w+ bad:\w+ bad:\w+$/.test(b)) fails++;
    if (p!=='partial partial partial') fails++;
  } else {
    const ht = new engine.HoldTracker(ex);
    for (let i=0;i<60;i++) ht.feed(engine.analyze(ex, lmsFor(ex,{e:1}), W, H), 1/30);
    const g = ht.elapsed.toFixed(1);
    const hb = new engine.HoldTracker(ex);
    for (let i=0;i<60;i++) hb.feed(engine.analyze(ex, lmsFor(ex,{e:1,variant:'bad'}), W, H), 1/30);
    row.push(`HOLD good 2s→${g}s  bad→${hb.elapsed.toFixed(1)}s issue=${hb.issue?.id}`);
    if (g < 1.6 || hb.elapsed > 0) fails++;
  }
  console.log(id.padEnd(14), row.join(' | '));
}
// jitter test: still person at start pose with noise must never count
for (const id of ['squat','curl','pushup','jacks']) {
  const ex=EX[id]; const rc=new engine.RepCounter(ex); let n=0;
  for (let i=0;i<900;i++){ const l=lmsFor(ex,{e:0}).map(p=>({...p,x:p.x+(Math.random()-.5)*0.02,y:p.y+(Math.random()-.5)*0.02}));
    n += rc.feed(engine.analyze(ex,l,W,H), i*33).filter(v=>['good','bad','partial'].includes(v.type)).length; }
  console.log('jitter',id,'reps counted while standing still (30s):', n); if(n) fails++;
}
console.log('FAILS:', fails);
