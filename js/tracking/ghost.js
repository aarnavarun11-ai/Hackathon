/* =========================================================================
   GhostFit – Ghost engine
   A tiny 2D "body model" that can be posed with joint angles, animated
   between keyframes and drawn as a glowing silhouette. Used for:
     • the big demo ghost ("watch how it's done")
     • the outline guide that shows where to stand
     • the AR ghost that is pinned onto YOUR body when form slips
   Angles are in degrees: 0 = up, 90 = forward/outward, 180 = down.
   Units: a standing body is ~1.0 tall, ground is y = 0, up is negative y.
   ========================================================================= */
(function (GF) {
  'use strict';

  const LEN = { torso: 0.30, neck: 0.045, headR: 0.068, uarm: 0.16, farm: 0.15, thigh: 0.245, shin: 0.245, foot: 0.075 };
  const WID = { torso: 0.115, uarm: 0.052, farm: 0.044, thigh: 0.078, shin: 0.06, neck: 0.045, foot: 0.04 };
  const SHOULDER_HALF = 0.115, HIP_HALF = 0.065, SEAT_H = 0.32;

  const rad = d => d * Math.PI / 180;
  const dirOf = a => ({ x: Math.sin(rad(a)), y: -Math.cos(rad(a)) });
  const move = (p, a, len) => { const d = dirOf(a); return { x: p.x + d.x * len, y: p.y + d.y * len }; };
  const pick = (k, name, side) => (k[name + side] !== undefined ? k[name + side] : k[name]);

  /* ---------- Forward kinematics: side view (facing +x) ---------- */
  function fkSide(k) {
    const P = { view: 'side' };
    P.hip = { x: 0, y: 0 };
    P.shoulder = move(P.hip, k.torso, LEN.torso);
    const headDir = k.head !== undefined ? k.head : k.torso;
    P.neckTop = move(P.shoulder, headDir, LEN.neck);
    P.head = move(P.neckTop, headDir, LEN.headR);
    P.nose = move(P.head, headDir + 90, LEN.headR * 0.9);
    for (const s of ['A', 'B']) {           // A = near side, B = far side
      const shin = pick(k, 'shin', s);
      P['elbow' + s] = move(P.shoulder, pick(k, 'uarm', s), LEN.uarm);
      P['wrist' + s] = move(P['elbow' + s], pick(k, 'farm', s), LEN.farm);
      P['knee' + s] = move(P.hip, pick(k, 'thigh', s), LEN.thigh);
      P['ankle' + s] = move(P['knee' + s], shin, LEN.shin);
      const footDir = pick(k, 'foot', s) !== undefined ? pick(k, 'foot', s) : shin - 90;
      P['heel' + s] = move(P['ankle' + s], footDir + 180, LEN.foot * 0.25);
      P['toe' + s] = move(P['ankle' + s], footDir, LEN.foot);
    }
    return P;
  }

  /* ---------- Forward kinematics: front view (facing camera) ---------- */
  function fkFront(k) {
    const P = { view: 'front' };
    P.hipC = { x: 0, y: 0 };
    P.shoulderC = move(P.hipC, k.lean || 0, LEN.torso);
    P.head = move(P.shoulderC, k.lean || 0, LEN.neck + LEN.headR);
    P.nose = { x: P.head.x, y: P.head.y + LEN.headR * 0.15 };
    for (const [s, sg] of [['R', 1], ['L', -1]]) {   // R = screen-right limb
      const go = (p, a, len) => ({ x: p.x + sg * Math.sin(rad(a)) * len, y: p.y - Math.cos(rad(a)) * len });
      P['shoulder' + s] = { x: P.shoulderC.x + sg * SHOULDER_HALF, y: P.shoulderC.y };
      P['hip' + s] = { x: sg * HIP_HALF, y: 0 };
      P['elbow' + s] = go(P['shoulder' + s], pick(k, 'uarm', s), LEN.uarm);
      P['wrist' + s] = go(P['elbow' + s], pick(k, 'farm', s), LEN.farm);
      P['knee' + s] = go(P['hip' + s], pick(k, 'thigh', s), LEN.thigh * (k.thighScale || 1));
      P['ankle' + s] = go(P['knee' + s], pick(k, 'shin', s), LEN.shin);
      P['heel' + s] = { x: P['ankle' + s].x, y: P['ankle' + s].y + 0.01 };
      P['toe' + s] = go(P['ankle' + s], 120, LEN.foot * 0.75);
    }
    return P;
  }

  /* ---------- Put the posed body on the ground / chair ---------- */
  function ground(P, anchor, anchorX) {
    let dx = 0, dy = 0;
    const pts = Object.entries(P).filter(([k, v]) => typeof v === 'object');
    if (anchor === 'seat') {
      const h = P.view === 'front' ? P.hipC : P.hip;
      dx = -h.x; dy = -SEAT_H - h.y;
    } else {
      let maxY = -Infinity;
      for (const [k, p] of pts) maxY = Math.max(maxY, k === 'head' ? p.y + LEN.headR : p.y);
      const ref = P.view === 'front' ? { x: 0 } : (anchorX && P[anchorX]) ? P[anchorX] : P.ankleA;
      dx = -ref.x;
      dy = -0.035 - maxY;
      if (anchor === 'ankle') dy = -0.04 - P.ankleA.y;
    }
    for (const [, p] of pts) { p.x += dx; p.y += dy; }
    return P;
  }

  /* ---------- Animation ---------- */
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function lerpKeys(a, b, e) {
    const out = {};
    // limb keys like "thighA" fall back to the shared "thigh" value of the same keyframe
    const val = (k, key) => {
      if (k[key] !== undefined) return k[key];
      const base = key.replace(/[ABLR]$/, '');
      return base !== key ? k[base] : undefined;
    };
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = val(a, key) !== undefined ? val(a, key) : val(b, key);
      const vb = val(b, key) !== undefined ? val(b, key) : val(a, key);
      out[key] = (typeof va === 'number' && typeof vb === 'number') ? va + (vb - va) * e : va;
    }
    return out;
  }
  // Movement profile for one rep cycle: pause, go, hold, return, pause
  function repProfile(u) {
    if (u < 0.08) return 0;
    if (u < 0.45) return ease((u - 0.08) / 0.37);
    if (u < 0.58) return 1;
    if (u < 0.94) return 1 - ease((u - 0.58) / 0.36);
    return 0;
  }

  /** Pose the ghost for exercise `ex` at time t (seconds).
   *  opts: { e: force progress 0..1, variant: 'bad' } */
  function poseAt(ex, t, opts = {}) {
    const g = ex.ghost;
    let e;
    if (opts.e !== undefined) e = opts.e;
    else if (ex.type === 'hold') e = 1;
    else e = repProfile(((t % g.cycle) + g.cycle) % g.cycle / g.cycle);
    let end = g.end || g.start;
    if (opts.variant === 'bad' && g.bad) end = Object.assign({}, end, g.bad);
    let k = lerpKeys(g.start, end, e);
    if (ex.type === 'hold' && opts.e === undefined) {   // gentle breathing
      const b = Math.sin(t * 2.2) * 1.2;
      k = Object.assign({}, k, { torso: (k.torso || 0) + (ex.view === 'side' ? b * 0.4 : 0) });
    }
    const P = ex.view === 'front' ? fkFront(k) : fkSide(k);
    return ground(P, g.anchor || 'feet', g.anchorX);
  }

  /* ---------- Geometry helpers for transforms ---------- */
  function bbox(P) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [k, p] of Object.entries(P)) {
      if (typeof p !== 'object') continue;
      const r = k === 'head' ? LEN.headR : 0.03;
      x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r);
      y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r);
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  /** Transform that fits pose P into a pixel box (bottom-centred). */
  function fitTransform(P, box, flip = false, extra = null) {
    const b = bbox(P);
    if (extra) { b.x0 = Math.min(b.x0, extra.x0); b.x1 = Math.max(b.x1, extra.x1); b.y0 = Math.min(b.y0, extra.y0); b.w = b.x1 - b.x0; b.h = b.y1 - b.y0; }
    const s = Math.min(box.w / b.w, box.h / b.h);
    const cx = (b.x0 + b.x1) / 2;
    return {
      s, flip,
      x: box.x + box.w / 2 - (flip ? -cx : cx) * s,
      y: box.y + box.h - b.y1 * s,
    };
  }
  /** Fit the WHOLE movement (start + end + bad poses) into a pixel box. */
  function motionFit(ex, box, flip = false) {
    const P0 = poseAt(ex, 0, { e: 0 });
    const ext = [poseAt(ex, 0, { e: 1 }), poseAt(ex, 0, { e: 1, variant: 'bad' })].map(bbox)
      .reduce((u, b) => ({ x0: Math.min(u.x0, b.x0), x1: Math.max(u.x1, b.x1), y0: Math.min(u.y0, b.y0) }), { x0: Infinity, x1: -Infinity, y0: Infinity });
    return fitTransform(P0, box, flip, ext);
  }
  /** Transform that pins ghost joint `joint` onto a pixel point. */
  function pinTransform(P, joint, target, scale, flip) {
    const j = P[joint];
    return { s: scale, flip, x: target.x - (flip ? -j.x : j.x) * scale, y: target.y - j.y * scale };
  }
  const apply = (T, p) => ({ x: T.x + (T.flip ? -p.x : p.x) * T.s, y: T.y + p.y * T.s });

  /* ---------- Drawing ---------- */
  const offscreens = new WeakMap();
  function off(ctx, n) {
    let list = offscreens.get(ctx.canvas);
    if (!list) { list = [document.createElement('canvas'), document.createElement('canvas')]; offscreens.set(ctx.canvas, list); }
    const c = list[n];
    if (c.width !== ctx.canvas.width || c.height !== ctx.canvas.height) { c.width = ctx.canvas.width; c.height = ctx.canvas.height; }
    const o = c.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, c.width, c.height);
    return { c, o };
  }

  function segments(P) {
    if (P.view === 'front') {
      return {
        far: [],
        near: [
          ['shoulderR', 'elbowR', WID.uarm], ['elbowR', 'wristR', WID.farm],
          ['shoulderL', 'elbowL', WID.uarm], ['elbowL', 'wristL', WID.farm],
          ['hipR', 'kneeR', WID.thigh], ['kneeR', 'ankleR', WID.shin], ['ankleR', 'toeR', WID.foot],
          ['hipL', 'kneeL', WID.thigh], ['kneeL', 'ankleL', WID.shin], ['ankleL', 'toeL', WID.foot],
          ['shoulderC', 'head', WID.neck],
        ],
        torso: ['shoulderL', 'shoulderR', 'hipR', 'hipL'],
      };
    }
    return {
      far: [['shoulder', 'elbowB', WID.uarm], ['elbowB', 'wristB', WID.farm],
            ['hip', 'kneeB', WID.thigh], ['kneeB', 'ankleB', WID.shin], ['ankleB', 'toeB', WID.foot]],
      near: [['hip', 'shoulder', WID.torso], ['shoulder', 'neckTop', WID.neck],
             ['hip', 'kneeA', WID.thigh], ['kneeA', 'ankleA', WID.shin], ['ankleA', 'toeA', WID.foot],
             ['shoulder', 'elbowA', WID.uarm], ['elbowA', 'wristA', WID.farm]],
      torso: null,
    };
  }

  function paintBody(o, P, T, list, torso, color, shrink) {
    o.strokeStyle = color; o.fillStyle = color; o.lineCap = 'round'; o.lineJoin = 'round';
    for (const [a, b, w] of list) {
      const A = apply(T, P[a]), B = apply(T, P[b]);
      o.lineWidth = Math.max(1, w * T.s * shrink);
      o.beginPath(); o.moveTo(A.x, A.y); o.lineTo(B.x, B.y); o.stroke();
    }
    if (torso) {
      const pts = torso.map(n => apply(T, P[n]));
      const cx = pts.reduce((s, p) => s + p.x, 0) / 4, cy = pts.reduce((s, p) => s + p.y, 0) / 4;
      o.beginPath();
      pts.forEach((p, i) => {
        const x = cx + (p.x - cx) * shrink, y = cy + (p.y - cy) * shrink;
        i ? o.lineTo(x, y) : o.moveTo(x, y);
      });
      o.closePath(); o.fill();
      o.lineWidth = WID.uarm * T.s * shrink; o.stroke();
    }
    if (list.some(s => s[1] === 'neckTop' || s[1] === 'head')) {
      const H = apply(T, P.head);
      o.beginPath(); o.arc(H.x, H.y, LEN.headR * T.s * shrink, 0, Math.PI * 2); o.fill();
    }
  }

  /**
   * Draw a ghost.
   * style: { color, alpha, glow, outline (bool), farAlpha }
   */
  function draw(ctx, P, T, style = {}) {
    const color = style.color || '#7df9ff';
    const alpha = style.alpha !== undefined ? style.alpha : 0.55;
    const seg = segments(P);
    const passes = [];
    if (seg.far.length) passes.push({ list: seg.far, torso: null, a: alpha * (style.farAlpha || 0.55) });
    passes.push({ list: seg.near, torso: seg.torso, a: alpha });

    for (const pass of passes) {
      const { c, o } = off(ctx, 0);
      paintBody(o, P, T, pass.list, pass.torso, color, 1);
      if (style.outline) {
        o.globalCompositeOperation = 'destination-out';
        paintBody(o, P, T, pass.list, pass.torso, '#000', 0.62);
        o.globalCompositeOperation = 'source-over';
      }
      ctx.save();
      ctx.globalAlpha = pass.a;
      if (style.glow !== false) { ctx.shadowColor = style.glowColor || color; ctx.shadowBlur = Math.max(8, T.s * 0.03); }
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    }
  }

  /** Scenery: floor, wall, chair (for the demo view) */
  function drawProps(ctx, ex, P, T, color = 'rgba(255,255,255,0.18)') {
    const props = ex.ghost.props || [];
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
    const b = bbox(P);
    // floor
    const g0 = apply(T, { x: b.x0 - 0.25, y: 0 }), g1 = apply(T, { x: b.x1 + 0.25, y: 0 });
    ctx.lineWidth = Math.max(2, T.s * 0.01);
    ctx.beginPath(); ctx.moveTo(Math.min(g0.x, g1.x), g0.y); ctx.lineTo(Math.max(g0.x, g1.x), g1.y); ctx.stroke();
    if (props.includes('wall')) {
      const x = P.hip.x - 0.075;
      const a = apply(T, { x, y: 0 }), c = apply(T, { x, y: -1.05 });
      ctx.lineWidth = Math.max(3, T.s * 0.02);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    if (props.includes('chair')) {
      ctx.lineWidth = Math.max(2, T.s * 0.016);
      const seatY = -SEAT_H + 0.035;
      const line = (x0, y0, x1, y1) => { const A = apply(T, { x: x0, y: y0 }), B = apply(T, { x: x1, y: y1 }); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); };
      if (P.view === 'front') {
        line(-0.19, seatY, 0.19, seatY); line(-0.17, seatY, -0.17, 0); line(0.17, seatY, 0.17, 0);
        line(-0.17, seatY, -0.17, seatY - 0.36); line(0.17, seatY, 0.17, seatY - 0.36); line(-0.17, seatY - 0.36, 0.17, seatY - 0.36);
      } else {
        const hx = P.hip.x;
        line(hx - 0.1, seatY, hx + 0.16, seatY); line(hx - 0.09, seatY, hx - 0.09, 0); line(hx + 0.15, seatY, hx + 0.15, 0);
        line(hx - 0.1, seatY, hx - 0.13, seatY - 0.38);
      }
    }
    ctx.restore();
  }

  /** Map a posed ghost onto MediaPipe-style landmarks (used by the test simulator). */
  function toLandmarks(P, T, W, H) {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 }));
    const put = (i, p, v = 0.98) => { const q = apply(T, p); lm[i] = { x: q.x / W, y: q.y / H, z: 0, visibility: v }; };
    put(0, P.nose);
    if (P.view === 'front') {
      // In the raw (un-mirrored) camera image the person's LEFT side appears on the RIGHT.
      const m = { shoulder: [11, 12], elbow: [13, 14], wrist: [15, 16], hip: [23, 24], knee: [25, 26], ankle: [27, 28], heel: [29, 30], toe: [31, 32] };
      for (const [n, [l, r]] of Object.entries(m)) { put(l, P[n + 'R']); put(r, P[n + 'L']); }
    } else {
      const m = { elbow: [13, 14], wrist: [15, 16], knee: [25, 26], ankle: [27, 28], heel: [29, 30], toe: [31, 32] };
      for (const [n, [l, r]] of Object.entries(m)) { put(l, P[n + 'A']); put(r, P[n + 'B'], 0.9); }
      put(11, P.shoulder); put(12, { x: P.shoulder.x + 0.01, y: P.shoulder.y }, 0.9);
      put(23, P.hip); put(24, { x: P.hip.x + 0.01, y: P.hip.y }, 0.9);
    }
    return lm;
  }

  GF.ghost = { LEN, repProfile, poseAt, fitTransform, motionFit, pinTransform, bbox, apply, draw, drawProps, toLandmarks, fkSide, fkFront, SEAT_H };
})(window.GF = window.GF || {});
