/* GhostFit – Demo athlete (open any workout with "Demo" or the URL suffix /demo).
   A simulated person built from the ghost body model. It produces the same landmarks the
   camera AI would, so tracking features can be demonstrated without a camera (e.g. when
   rehearsing a pitch). It is always labelled "Simulated" on screen and is never used for
   real progress data. Mostly good reps, with an occasional bad-form or partial rep. */
(function (GF) {
  'use strict';
  const SEQ = ['good', 'good', 'bad', 'good', 'good', 'partial', 'good', 'good', 'good'];
  const sim = {
    k: 0, kBase: 0, t0: 0, wasActive: false,
    reset() { this.k = 0; this.kBase = 0; this.wasActive = false; },
    /** ex: tracking definition; active: user is "performing" right now */
    detect(W, H, ex, active) {
      if (!ex) return null;
      const now = performance.now(), ghost = GF.ghost;
      if (active && !this.wasActive) this.t0 = now;
      if (!active && this.wasActive) this.kBase = this.k + 1;
      this.wasActive = active;
      let P;
      if (active && ex.type === 'reps') {
        const t = (now - this.t0) / 1000 - 0.6, cyc = ex.ghost.cycle;
        if (t < 0) P = ghost.poseAt(ex, 0, { e: 0 });
        else {
          this.k = this.kBase + Math.floor(t / cyc);
          const mode = SEQ[this.k % SEQ.length], u = (t % cyc) / cyc;
          P = ghost.poseAt(ex, 0, { e: ghost.repProfile(u) * (mode === 'partial' ? 0.6 : 1), variant: mode === 'bad' ? 'bad' : undefined });
        }
      } else if (active && ex.type === 'hold') {
        const t = (now - this.t0) / 1000;
        P = ghost.poseAt(ex, 0, { e: 1, variant: (t > 4 && t < 6.5) ? 'bad' : undefined });
      } else P = ghost.poseAt(ex, 0, { e: ex.type === 'hold' ? 1 : 0 });
      const box = ex.floor ? { x: W * 0.1, y: H * 0.3, w: W * 0.8, h: H * 0.62 } : { x: W * 0.25, y: H * 0.06, w: W * 0.5, h: H * 0.88 };
      const T = ghost.motionFit(ex, box);
      this.lastP = P; this.lastT = T;   // lets the UI draw the simulated body
      return ghost.toLandmarks(P, T, W, H)
        .map(p => ({ ...p, x: p.x + (Math.random() - 0.5) * 0.003, y: p.y + (Math.random() - 0.5) * 0.003 }));
    },
  };
  GF.sim = sim;
})(window.GF = window.GF || {});
