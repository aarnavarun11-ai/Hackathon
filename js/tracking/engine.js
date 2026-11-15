/* =========================================================================
   GhostFit – Tracking engine
   Turns raw pose landmarks into trustworthy reps.
   Anti "ghost rep" protections:
     1. Every required body point must be clearly visible AND inside the frame
     2. You must face the right way (side / front)
     3. You must hold the start position before a rep can begin (+ posture gate)
     4. Angles are smoothed (median + moving average) to kill jitter
     5. A rep only counts if you reach FULL range of motion and come back
     6. A rep only counts if your FORM was good the whole way
     7. Reps faster than 0.35 s or slower than 8 s are thrown out
   ========================================================================= */
(function (GF) {
  'use strict';

  const IDX = { nose: 0, shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16,
    hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28, heelL: 29, heelR: 30, toeL: 31, toeR: 32 };
  const PARTS = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'heel', 'toe'];
  const VIS_MIN = 0.5, EDGE = 0.01;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function reasonFor(missing) {
    const has = re => missing.some(n => re.test(n));
    if (has(/ankle|knee|heel|toe/)) return 'Step back — show your whole body down to your feet';
    if (has(/hip/)) return 'Step back so your hips are in view';
    if (has(/shoulder|nose/)) return 'Move so your head & shoulders are in the frame';
    if (has(/wrist|elbow/)) return 'Keep both arms inside the frame';
    return 'Step into the frame';
  }

  /** Analyse one frame of landmarks for a given exercise. */
  function analyze(ex, lms, W, H) {
    if (!lms) return { valid: false, code: 'none', reason: 'Step into the frame — I can\'t see you' };
    const get = i => { const l = lms[i]; return { x: l.x * W, y: l.y * H, v: l.visibility == null ? 1 : l.visibility, nx: l.x, ny: l.y }; };
    const inFrame = p => p && p.v >= VIS_MIN && p.nx > EDGE && p.nx < 1 - EDGE && p.ny > EDGE && p.ny < 1 - EDGE;
    const P = { nose: get(0) };
    let near = null;
    if (ex.view === 'side') {
      const score = s => ex.need.reduce((a, n) => a + (lms[IDX[n + s]].visibility || 0) + (inFrame(get(IDX[n + s])) ? 1 : 0), 0);
      near = score('L') >= score('R') ? 'L' : 'R';
      const far = near === 'L' ? 'R' : 'L';
      for (const n of PARTS) { P[n] = get(IDX[n + near]); P[n + 'F'] = get(IDX[n + far]); }
      P._sh = P.shoulder; P._hip = P.hip;
    } else {
      for (const n of PARTS) { P[n + 'L'] = get(IDX[n + 'L']); P[n + 'R'] = get(IDX[n + 'R']); }
      P._sh = mid(P.shoulderL, P.shoulderR); P._hip = mid(P.hipL, P.hipR);
    }
    P._torso = dist(P._sh, P._hip);
    const quality = assess(ex, lms, P, near, W, H, get, inFrame);
    const missing = ex.need.filter(n => !inFrame(P[n]));
    if (missing.length) return { valid: false, code: 'frame', reason: quality.tips[0] || reasonFor(missing), P, missing, quality };
    if (P._torso < H * 0.05) return { valid: false, code: 'far', reason: 'Move a little closer to the camera', P, quality };

    const spread = dist(get(IDX.shoulderL), get(IDX.shoulderR)) / (P._torso || 1);
    if (ex.view === 'side' && spread > 0.62) return { valid: false, code: 'orient', reason: 'Turn sideways so I can see your movement from the side', P, quality };
    if (ex.view === 'front' && spread < 0.38) return { valid: false, code: 'orient', reason: 'Turn to face the camera', P, quality };

    return { valid: true, P, near, metric: ex.metric ? ex.metric(P) : null, quality };
  }

  /* ---------- tracking confidence ----------
     Combines landmark visibility, framing, distance and centring into a score and
     plain-language tips. Corrections are only given when the level is "good". */
  const SIDE_NAME = { L: 'left', R: 'right' };
  function partLabel(name, near) {
    const m = /^(shoulder|elbow|wrist|hip|knee|ankle|heel|toe)([LR])?$/.exec(name);
    if (!m) return 'body';
    const side = m[2] || near;
    const part = { toe: 'foot', heel: 'heel' }[m[1]] || m[1];
    return side ? `${SIDE_NAME[side]} ${part}` : part;
  }
  function assess(ex, lms, P, near, W, H, get, inFrame) {
    const tips = [];
    const vis = ex.need.map(n => (P[n] ? P[n].v : 0));
    const needVis = vis.reduce((a, b) => a + b, 0) / (vis.length || 1);
    let allVis = 0; for (let i = 11; i < 33; i++) allVis += (lms[i].visibility || 0); allVis /= 22;
    // framing: bounding box of confidently seen points
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0, n = 0;
    for (let i = 0; i < 33; i++) { const l = lms[i]; if ((l.visibility || 0) > 0.5) { n++; x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x); y0 = Math.min(y0, l.y); y1 = Math.max(y1, l.y); } }
    const cx = (P._hip.x / W);
    const outEdge = ex.need.filter(k => P[k] && (P[k].nx <= EDGE || P[k].nx >= 1 - EDGE || P[k].ny <= EDGE || P[k].ny >= 1 - EDGE));
    const hidden = ex.need.filter(k => P[k] && !outEdge.includes(k) && P[k].v < VIS_MIN);

    if (outEdge.some(k => /ankle|knee|heel|toe/.test(k)) && (y1 - y0) > 0.85) tips.push('Move farther from the camera so your whole body fits');
    else if (outEdge.some(k => /ankle|knee|heel|toe|hip/.test(k))) tips.push('Step back so your full body is visible');
    else if (outEdge.some(k => /shoulder|wrist|elbow/.test(k))) tips.push((y0 < 0.02) ? 'Move back or lower the camera — your head and arms are cut off' : 'Keep your arms inside the frame');
    if (cx < 0.22) tips.push('Move a step to your left, toward the centre');
    else if (cx > 0.78) tips.push('Move a step to your right, toward the centre');
    if (hidden.length) tips.push(`Your ${partLabel(hidden[0], near)} is partly hidden from the camera`);
    if (n > 8 && allVis < 0.55 && !hidden.length) tips.push('Lighting looks low — try facing a window or lamp');
    if ((y1 - y0) < 0.3 && n > 8 && !ex.need.every(k => /shoulder|elbow|wrist|hip/.test(k))) tips.push('Move a little closer to the camera');

    const framing = outEdge.length ? 0.4 : (cx < 0.22 || cx > 0.78) ? 0.75 : 1;
    const score = Math.max(0, Math.min(1, needVis * 0.7 + framing * 0.3));
    return { score, needVis, allVis, tips, level: score >= 0.72 ? 'good' : score >= 0.55 ? 'fair' : 'poor' };
  }

  /** Tracks frame-to-frame jitter of the key points (high jitter = unreliable). */
  class Stability {
    constructor() { this.prev = null; this.j = 0; }
    reset() { this.prev = null; this.j = 0; }
    push(ex, a) {
      if (!a.valid) { this.prev = null; return this.j; }
      const pts = ex.need.map(k => a.P[k]);
      if (this.prev && this.prev.length === pts.length) {
        let d = 0; pts.forEach((p, i) => { d += Math.hypot(p.x - this.prev[i].x, p.y - this.prev[i].y); });
        d = d / pts.length / (a.P._torso || 1);
        // fast real movement is ~0.03–0.08 per frame; spikes far above that are tracking glitches
        this.j = this.j * 0.85 + Math.min(0.5, d) * 0.15;
      }
      this.prev = pts.map(p => ({ x: p.x, y: p.y }));
      return this.j;
    }
    get unstable() { return this.j > 0.09; }
  }

  /* ---------- smoothing ---------- */
  class Smoother {
    constructor(alpha = 0.45) { this.a = alpha; this.reset(); }
    reset() { this.buf = []; this.v = null; }
    push(x) {
      this.buf.push(x); if (this.buf.length > 3) this.buf.shift();
      const m = this.buf.slice().sort((p, q) => p - q)[Math.floor(this.buf.length / 2)];
      this.v = this.v == null ? m : this.v + this.a * (m - this.v);
      return this.v;
    }
  }

  /* ---------- rep counter ---------- */
  /** How strict rep counting is (Settings → Rep counting). full = share of the range that counts as a full rep;
      formShare = how much of a rep must show a form fault before it's rejected (relaxed: form only warns). */
  const STRICT = {
    relaxed:  { full: 0.82, formShare: Infinity },
    standard: { full: 0.9,  formShare: 0.35 },
    strict:   { full: 1.0,  formShare: 0.2 },
  };
  const strictness = () => STRICT[(GF.store && GF.store.settings && GF.store.settings.repStrictness) || 'standard'] || STRICT.standard;
  const LOST_GRACE = 600;   // ms of bad tracking we ride through before giving up on a rep

  class RepCounter {
    constructor(ex) { this.ex = ex; this.sm = new Smoother(); this.reset(); }
    reset() { this.state = 'waitStart'; this.readySince = null; this.sm.reset(); this.live = null; this.liveRun = {}; this.p = 0; this.metric = null; this.lostSince = null; }
    progress(m) { return (this.ex.start - m) / (this.ex.start - this.ex.end); }   // 0 = start, 1 = full depth

    /** feed one analysed frame → list of events */
    feed(a, now) {
      const ev = [];
      if (!a.valid) {
        // a blink of bad tracking (motion blur, an arm crossing the body) shouldn't throw away a good rep
        if (this.lostSince == null) this.lostSince = now;
        if (this.state !== 'waitStart' && now - this.lostSince < LOST_GRACE) { this.live = null; return ev; }
        if (this.state !== 'waitStart') ev.push({ type: 'interrupted' });
        this.state = 'waitStart'; this.readySince = null; this.sm.reset(); this.live = null;
        return ev;
      }
      this.lostSince = null;
      const cfg = strictness();
      const m = this.metric = this.sm.push(a.metric);
      const p = this.p = this.progress(m);
      const gateMsg = this.ex.gate ? this.ex.gate(a.P) : null;
      this.gateMsg = gateMsg;

      // live form feedback (needs 3 frames in a row so a single glitchy frame never fires)
      let liveNow = null;
      const reliable = !a.quality || (a.quality.level === 'good' && !a.unstable);
      if (this.state === 'moving' && reliable) this.assessed = (this.assessed || 0) + 1;
      if (this.state === 'moving' && reliable) {
        for (const f of this.ex.form) {
          if (f.test(a.P)) { this.liveRun[f.id] = (this.liveRun[f.id] || 0) + 1; this.issueCount[f.id] = (this.issueCount[f.id] || 0) + 1; if (this.liveRun[f.id] >= 3 && !liveNow) liveNow = f; }
          else this.liveRun[f.id] = 0;
        }
      }
      this.live = liveNow;

      switch (this.state) {
        case 'waitStart':
          if (p < 0.15 && !gateMsg) {
            if (this.readySince == null) this.readySince = now;
            if (now - this.readySince > 350) { this.state = 'ready'; ev.push({ type: 'ready' }); }
          } else this.readySince = null;
          break;
        case 'ready':
          if (p > 0.3) { this.state = 'moving'; this.t0 = now; this.maxP = p; this.reachedRun = 0; this.reached = false; this.frames = 0; this.assessed = 0; this.issueCount = {}; this.liveRun = {}; ev.push({ type: 'start' }); }
          break;
        case 'moving': {
          this.frames++;
          // the end position must really be reached (and look right, e.g. hands overhead for a press) for 2+ frames
          const atEnd = p >= cfg.full && (!this.ex.endOk || this.ex.endOk(a.P));
          this.reachedRun = atEnd ? this.reachedRun + 1 : 0;
          if (this.reachedRun >= 2) this.reached = true;
          this.maxP = Math.max(this.maxP, this.ex.endOk && !this.ex.endOk(a.P) ? Math.min(p, cfg.full - 0.01) : p);
          if (now - this.t0 > 8000) { this.state = 'waitStart'; this.readySince = null; ev.push({ type: 'timeout' }); break; }
          if (this.ex.abort && this.ex.abort(a.P)) { this.state = 'waitStart'; this.readySince = null; ev.push({ type: 'cancel' }); break; }
          if (p < 0.12) {
            const dur = now - this.t0;
            this.state = 'ready';
            if (dur < 450) break;                                  // too fast = jitter, ignore
            if (this.reached) {
              const assessedShare = this.frames ? (this.assessed || 0) / this.frames : 0;
              const need = Math.max(3, Math.round((this.assessed || 0) * cfg.formShare));
              const bad = assessedShare >= 0.5 && this.ex.form.filter(f => (this.issueCount[f.id] || 0) >= need)
                .sort((x, y) => this.issueCount[y.id] - this.issueCount[x.id])[0];
              ev.push(bad ? { type: 'bad', issue: bad, dur } : { type: 'good', dur, assessed: assessedShare >= 0.5 });
            } else if (this.maxP > 0.5) {
              ev.push({ type: 'partial', depth: this.maxP, dur });
            }
          }
          break;
        }
      }
      return ev;
    }
  }

  /* ---------- hold timer (plank, wall sit) ---------- */
  class HoldTracker {
    constructor(ex) { this.ex = ex; this.reset(); }
    reset() { this.elapsed = 0; this.good = false; this.goodT = 0; this.badT = 0; this.issue = null; this.breaks = 0; this.sm = new Smoother(); this.metric = null; }
    feed(a, dt) {
      const ev = [];
      if (a.valid && this.ex.metric) this.metric = this.sm.push(this.ex.metric(a.P));
      const reliable = a.valid && (!a.quality || (a.quality.level === 'good' && !a.unstable));
      this.assessedT = (this.assessedT || 0) + (reliable && this.good ? dt : 0);
      const res = !a.valid ? { id: 'frame', msg: a.reason, say: a.reason } : reliable ? this.ex.check(a.P) : (this.good ? null : this.ex.check(a.P));
      if (!res) {
        this.goodT += dt; this.badT = 0;
        if (!this.good && this.goodT > 0.25) { this.good = true; this.issue = null; ev.push({ type: 'resume' }); }
      } else {
        this.badT += dt; this.goodT = 0;
        if (this.good && this.badT > 0.45) { this.good = false; this.breaks++; ev.push({ type: 'break', issue: res }); }
        if (!this.good) this.issue = res;
      }
      if (this.good) this.elapsed += dt;
      return ev;
    }
  }

  GF.engine = { IDX, analyze, RepCounter, HoldTracker, Smoother, Stability, mid, dist };
})(window.GF = window.GF || {});
