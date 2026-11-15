/* GhostFit – 60-second guided tour ("judge mode").
   Plays the app's best moments automatically, with a simulated athlete running through the REAL
   tracking engine (so the reps, the "Not counted" rejections and the joint angles are genuine output).
   Controls: ← → to move, Space to pause, Esc to close. Narration uses the device's speech voice. */
(function (GF) {
  'use strict';
  const { esc, icon } = GF.u;
  const art = GF.art;
  let T = null;   // running tour state

  const STEPS = [
    { id: 'intro', dur: 6, title: 'Meet GhostFit', text: 'The AI home trainer that only counts good reps — and helps you recover from injuries.',
      say: 'Meet GhostFit. The A I home trainer that only counts good reps, and helps you recover from injuries.' },
    { id: 'track', dur: 16, title: 'It watches your form', text: 'Any webcam. 33 body points, tracked on your device. Clean rep? +1. Bad form or half a rep? Not counted.',
      say: 'It tracks thirty three body points from any webcam. A clean rep counts. Bad form, or half a rep, does not.' },
    { id: 'score', dur: 6, title: 'Instant feedback', text: 'Every set gets a form score. Personal bests and streaks get celebrated.',
      say: 'Every set gets a form score, and personal bests get celebrated.' },
    { id: 'rehab', dur: 12, title: 'Rehab that measures recovery', text: 'After an injury, GhostFit measures how far your joint moves — in degrees — across 8 body areas.',
      say: 'After an injury, rehab mode measures how far your joint moves, in degrees.' },
    { id: 'progress', dur: 7, title: 'Watch it come back', text: 'Range of motion over the weeks, pain before and after — and a one-click report for your physio.',
      say: 'You see your range coming back week by week, and can print a report for your physio.' },
    { id: 'muscles', dur: 6, title: 'See what you worked', text: 'A muscle map lights up after every workout.',
      say: 'A muscle map shows exactly what you worked.' },
    { id: 'more', dur: 7, title: 'Private, hands-free, simple', text: 'Video never leaves your computer. Say “pause” or “next”. Light and dark mode.',
      say: 'Your video never leaves your computer. You can control it with your voice. And it is simple to use.' },
    { id: 'end', dur: 0, title: 'Your turn', text: 'Try it now — no account, no download.', say: 'Your turn. Try it now.' },
  ];

  /* ---------- demo athlete for the tracking step ---------- */
  function trackDemo(canvas) {
    const ex = GF.EX.squat, E = GF.engine, G = GF.ghost;
    const rc = new E.RepCounter(ex), stab = new E.Stability();
    const script = ['good', 'good', 'bad', 'good', 'partial', 'good'];
    const st = { count: 0, flash: null, caption: 'Squats · watch the counter', t0: performance.now(), lastEv: '' };
    return {
      st,
      frame(now) {
        const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
        const t = (now - st.t0) / 1000 - 0.6, cyc = 2.4;
        let e = 0, mode = 'good';
        if (t > 0) { const k = Math.floor(t / cyc); mode = script[k % script.length]; e = G.repProfile((t % cyc) / cyc) * (mode === 'partial' ? 0.55 : 1); }
        const P = G.poseAt(ex, 0, { e, variant: mode === 'bad' ? 'bad' : undefined });
        const Tm = G.motionFit(ex, { x: W * 0.3, y: H * 0.08, w: W * 0.4, h: H * 0.86 });
        const lm = G.toLandmarks(P, Tm, W, H).map(p => ({ ...p, x: p.x + (Math.random() - 0.5) * 0.002, y: p.y + (Math.random() - 0.5) * 0.002 }));
        const a = E.analyze(ex, lm, W, H); a.unstable = stab.push(ex, a) > 0.09;
        for (const ev of rc.feed(a, now)) {
          if (ev.type === 'good') { st.count++; st.flash = { text: '+1', cls: 'ok', at: now }; st.caption = 'Clean rep — counted'; }
          if (ev.type === 'bad') { st.flash = { text: 'Not counted', cls: 'bad', at: now }; st.caption = `Bad form: “${ev.issue.msg.replace(/!$/, '')}”`; }
          if (ev.type === 'partial') { st.flash = { text: 'Not counted', cls: 'bad', at: now }; st.caption = 'Half rep — go lower'; }
        }
        // draw
        ctx.clearRect(0, 0, W, H);
        G.draw(ctx, P, Tm, { color: '#5eead4', glowColor: 'rgba(94,234,212,.5)', alpha: 0.22, glow: true });
        const L = i => ({ x: lm[i].x * W, y: lm[i].y * H });
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 5;
        for (const [i, j] of [[11, 23], [23, 25], [25, 27], [27, 31], [11, 13], [13, 15], [0, 11]]) { ctx.beginPath(); ctx.moveTo(L(i).x, L(i).y); ctx.lineTo(L(j).x, L(j).y); ctx.stroke(); }
        const issue = rc.live || (st.flash && st.flash.cls === 'bad' && now - st.flash.at < 900);
        const col = issue ? '#f87171' : '#4ade80';
        ctx.strokeStyle = col; ctx.lineWidth = 11; ctx.shadowColor = col; ctx.shadowBlur = 16;
        ctx.beginPath(); [23, 25, 27].forEach((i, k) => k ? ctx.lineTo(L(i).x, L(i).y) : ctx.moveTo(L(i).x, L(i).y)); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
        for (const i of [0, 11, 13, 15, 23, 25, 27, 31]) { ctx.beginPath(); ctx.arc(L(i).x, L(i).y, 7, 0, 7); ctx.fill(); }
        // counter
        ctx.fillStyle = 'rgba(8,22,24,.75)'; rr(ctx, W - 190, 24, 160, 130, 22); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 84px Inter, Segoe UI, sans-serif'; ctx.fillText(st.count, W - 110, 120);
        ctx.font = '600 18px Inter, Segoe UI, sans-serif'; ctx.fillStyle = '#a8bfbb'; ctx.fillText('clean reps', W - 110, 145);
        if (st.flash && now - st.flash.at < 1000) {
          const u = (now - st.flash.at) / 1000;
          ctx.globalAlpha = 1 - u; ctx.font = `800 ${st.flash.cls === 'ok' ? 110 : 64}px Inter, Segoe UI, sans-serif`;
          ctx.fillStyle = st.flash.cls === 'ok' ? '#4ade80' : '#f87171'; ctx.fillText(st.flash.text, W / 2, H * 0.42 - u * 60); ctx.globalAlpha = 1;
        }
      },
    };
  }

  /* ---------- rehab angle demo ---------- */
  function rehabDemo(canvas) {
    const R = GF.rehab, e = R.get('k_seatbend'), G = GF.ghost, M = R.METRICS.kneeFlex;
    const st = { best: 0, t0: performance.now() };
    return {
      st,
      frame(now) {
        const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
        const t = (now - st.t0) / 1000, k = Math.floor(t / 3), amt = G.repProfile((t % 3) / 3) * [0.7, 0.85, 1][Math.min(2, k)];
        const { lm, P, T: Tm } = R.simLandmarks(e, amt, W, H);
        const p = R.points(lm, 'L', W, H, M.need);
        ctx.clearRect(0, 0, W, H);
        G.drawProps(ctx, e, P, Tm, 'rgba(148,233,220,.25)');
        G.draw(ctx, P, Tm, { color: '#5eead4', glowColor: 'rgba(94,234,212,.5)', alpha: 0.25, glow: true });
        if (!p) return;
        const v = M.fn(p); st.best = Math.max(st.best, v);
        ctx.lineCap = 'round'; ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 11; ctx.shadowColor = '#2dd4bf'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(p.hip.x, p.hip.y); ctx.lineTo(p.knee.x, p.knee.y); ctx.lineTo(p.ankle.x, p.ankle.y); ctx.stroke(); ctx.shadowBlur = 0;
        const a1 = Math.atan2(p.knee.y - p.hip.y, p.knee.x - p.hip.x), a2 = Math.atan2(p.ankle.y - p.knee.y, p.ankle.x - p.knee.x);
        let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        ctx.fillStyle = 'rgba(249,115,22,.25)'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(p.knee.x, p.knee.y); ctx.arc(p.knee.x, p.knee.y, 70, a1, a1 + da, da < 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; [p.hip, p.knee, p.ankle].forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, 7); ctx.fill(); });
        ctx.fillStyle = 'rgba(8,22,24,.82)'; rr(ctx, p.knee.x + 40, p.knee.y - 120, 170, 70, 18); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 48px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(v) + '°', p.knee.x + 125, p.knee.y - 68);
        ctx.fillStyle = 'rgba(8,22,24,.75)'; rr(ctx, W - 230, 24, 200, 110, 22); ctx.fill();
        ctx.fillStyle = '#a8bfbb'; ctx.font = '700 18px Inter, Segoe UI, sans-serif'; ctx.fillText('Best knee bend', W - 130, 60);
        ctx.fillStyle = '#4ade80'; ctx.font = '800 50px Inter, Segoe UI, sans-serif'; ctx.fillText(Math.round(st.best) + '°', W - 130, 112);
      },
    };
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function progressChart() {
    const vals = [82, 90, 97, 104, 110, 116, 121], W = 520, H = 220, L = 40, B = 30, max = 140;
    const x = i => L + i / (vals.length - 1) * (W - L - 16), y = v => 12 + (1 - v / max) * (H - 12 - B);
    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const len = vals.reduce((s, v, i) => i ? s + Math.hypot(x(i) - x(i - 1), y(v) - y(vals[i - 1])) : 0, 0);
    return `<svg class="tour-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Example: knee bend rising from 82 to 121 degrees over 3 weeks">
      ${[0, 45, 90, 135].map(v => `<line x1="${L}" x2="${W - 16}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.1)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}°</text>`).join('')}
      <line x1="${L}" x2="${W - 16}" y1="${y(135)}" y2="${y(135)}" stroke="#94a3b8" stroke-dasharray="6 5"/><text x="${W - 16}" y="${y(135) - 6}" text-anchor="end" fill="#cbd5e1">typical normal</text>
      <polyline points="${pts}" fill="none" stroke="#2dd4bf" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:${len};stroke-dashoffset:${len};animation:tourDraw 2.6s ease-out .3s forwards"/>
      ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="6" fill="#2dd4bf" style="opacity:0;animation:tourPop .3s ease-out ${0.3 + i * 0.37}s forwards"/>`).join('')}
      ${['Wk 1', '', 'Wk 2', '', '', 'Wk 3', 'Now'].map((t, i) => t ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${t}</text>` : '').join('')}
    </svg>`;
  }

  function stepHTML(s) {
    switch (s.id) {
      case 'intro': return `<div class="tv-intro">${art.ghost(170, 'wink')}<div class="tv-logo">GhostFit</div><div class="tv-chips"><span>${icon('eye')}AI form tracking</span><span>${icon('heart')}Injury rehab</span><span>${icon('lock')}100% on-device</span></div></div>`;
      case 'track': case 'rehab': return `<canvas class="tv-canvas" width="960" height="600" aria-hidden="true"></canvas>${s.id === 'rehab' ? `<div class="tv-areas">${['Knee', 'Ankle', 'Hip', 'Shoulder', 'Elbow', 'Wrist', 'Back', 'Neck'].map(a => `<span>${a}</span>`).join('')}</div>` : ''}`;
      case 'score': return `<div class="tv-score">${art.ring(0.92, '92', 'form score', 230)}<div class="tv-pb">${icon('flame')} New personal best<br><b>15 squats</b></div></div>`;
      case 'progress': return `<div class="tv-progress"><div class="tv-chartcard"><b>Knee bend · example</b>${progressChart()}</div>
        <div class="tv-report"><div class="tv-rh">${icon('download')} Report for your physio</div><i></i><i></i><i class="s"></i><div class="tv-rbars"><span style="height:40%"></span><span style="height:55%"></span><span style="height:68%"></span><span style="height:80%"></span></div><i></i><i class="s"></i></div></div>`;
      case 'muscles': return `<div class="tv-muscles">${GF.bodymap.render({ quads: 10, glutes: 8, hamstrings: 5, abs: 4, delts: 3, calves: 2 }, { title: 'Muscles worked · example' })}</div>`;
      case 'more': return `<div class="tv-grid">
        <div>${art.feature('privacy')}<b>Private</b><span>Video never leaves your computer</span></div>
        <div>${art.feature('voice')}<b>Hands-free</b><span>Say “pause”, “next”, “done”</span></div>
        <div>${art.feature('joints')}<b>Any webcam</b><span>No sensors or wearables</span></div>
        <div>${art.ghost(80)}<b>Simple</b><span>Pick a focus → go</span></div></div>`;
      case 'end': return `<div class="tv-end">${art.ghost(140, 'happy')}<div class="tv-cta">
        <button class="btn primary lg" data-tv="go-workout">${icon('play')}Start a workout</button>
        <button class="btn ghost-light lg" data-tv="go-rehab">${icon('heart')}Try rehab</button>
        <button class="btn ghost-light lg" data-tv="replay">${icon('replay')}Replay tour</button></div></div>`;
    }
    return '';
  }

  function speak(text) {
    try {
      const s = window.speechSynthesis; if (!s || !T || !T.narrate) return;
      s.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02;
      const v = GF.speech && GF.speech.pick && GF.speech.pick(); if (v) u.voice = v;
      s.speak(u);
    } catch (e) { /* narration is optional */ }
  }

  function open() {
    if (T) close();
    const root = document.createElement('div');
    root.className = 'tour'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'GhostFit 60-second tour');
    root.innerHTML = `
      <header class="tv-top">
        <div class="tv-brand">${art.ghost(30)}<b>GhostFit tour</b><span class="tv-note">simulated athlete · example data</span></div>
        <div class="tv-progress-bar" role="tablist" aria-label="Tour steps">${STEPS.map((s, i) => `<button role="tab" data-tv-step="${i}" aria-label="Step ${i + 1}: ${esc(s.title)}"><i></i></button>`).join('')}</div>
        <button class="btn sm ghost-light" data-tv="close" aria-label="Close tour">${icon('x')}Close</button>
      </header>
      <main class="tv-main">
        <section class="tv-visual" data-tv-visual></section>
        <section class="tv-copy"><span class="tv-step" data-tv-num></span><h2 data-tv-title></h2><p data-tv-text></p><p class="tv-live" data-tv-live aria-live="polite"></p></section>
      </main>
      <footer class="tv-bottom">
        <button class="btn ghost-light" data-tv="prev">${icon('left')}Back</button>
        <button class="btn ghost-light" data-tv="pause" aria-pressed="false">${icon('pause')}Pause</button>
        <button class="btn ghost-light" data-tv="narrate" aria-pressed="true">${icon('vol')}Voice on</button>
        <button class="btn primary" data-tv="next">Next ${icon('right')}</button>
      </footer>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    T = { root, i: -1, paused: false, narrate: true, raf: 0, demo: null, stepStart: 0, elapsedBefore: 0, focusBefore: document.activeElement };
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    go(0);
    T.raf = requestAnimationFrame(loop);
  }

  function close() {
    if (!T) return;
    cancelAnimationFrame(T.raf);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    document.removeEventListener('keydown', onKey);
    T.root.remove(); document.body.style.overflow = '';
    const f = T.focusBefore; T = null;
    if (location.hash === '#/tour') GF.go('dashboard');
    if (f && f.focus) try { f.focus(); } catch (e) { /* ignore */ }
  }

  function go(i) {
    if (!T) return;
    i = Math.max(0, Math.min(STEPS.length - 1, i));
    T.i = i; T.stepStart = performance.now(); T.elapsedBefore = 0;
    const s = STEPS[i], vis = T.root.querySelector('[data-tv-visual]');
    vis.innerHTML = stepHTML(s);
    vis.classList.remove('in'); void vis.offsetWidth; vis.classList.add('in');
    T.root.querySelector('[data-tv-num]').textContent = `${i + 1} / ${STEPS.length}`;
    T.root.querySelector('[data-tv-title]').textContent = s.title;
    T.root.querySelector('[data-tv-text]').textContent = s.text;
    T.root.querySelector('[data-tv-live]').textContent = '';
    T.root.querySelectorAll('[data-tv-step]').forEach((b, k) => { b.classList.toggle('done', k < i); b.classList.toggle('now', k === i); b.setAttribute('aria-selected', k === i); });
    const cv = vis.querySelector('canvas');
    T.demo = s.id === 'track' && cv ? trackDemo(cv) : s.id === 'rehab' && cv ? rehabDemo(cv) : null;
    if (s.id === 'score') setTimeout(() => { if (T && STEPS[T.i].id === 'score') GF.fx.confetti({ count: 120, y: 0.45 }); }, 900);
    if (s.id === 'muscles') cycleMuscles(vis);
    GF.fx.enhance(vis);
    speak(s.say);
    T.root.querySelector('[data-tv="next"]').hidden = s.id === 'end';
    if (s.id === 'end') setTimeout(() => { const b = T && T.root.querySelector('[data-tv="go-workout"]'); if (b) b.focus(); }, 50);
  }
  function cycleMuscles(vis) {
    const order = ['quads', 'glutes', 'hamstrings', 'abs'];
    let k = 0;
    const tick = () => {
      if (!T || STEPS[T.i].id !== 'muscles') return;
      const bm = vis.querySelector('.bodymap'); if (!bm) return;
      const r = order[k++ % order.length]; bm.dataset.hl = r;
      bm.querySelectorAll('.bm-m').forEach(g => g.classList.toggle('hl-on', g.dataset.r === r));
      setTimeout(tick, 1300);
    };
    setTimeout(tick, 900);
  }

  function loop(now) {
    if (!T) return;
    T.raf = requestAnimationFrame(loop);
    try {
      const s = STEPS[T.i];
      if (T.paused) { T.stepStart = now - T.elapsedBefore; return; }
      T.elapsedBefore = now - T.stepStart;
      if (T.demo) {
        T.demo.frame(now);
        const live = T.root.querySelector('[data-tv-live]');
        if (s.id === 'track' && live.textContent !== T.demo.st.caption) live.textContent = T.demo.st.caption;
      }
      const bar = T.root.querySelector(`[data-tv-step="${T.i}"] i`);
      if (bar) bar.style.width = s.dur ? Math.min(100, T.elapsedBefore / (s.dur * 1000) * 100) + '%' : '100%';
      if (s.dur && T.elapsedBefore >= s.dur * 1000) go(T.i + 1);
    } catch (err) { GF.crash(err, 'tour'); }
  }

  function setPaused(p) {
    T.paused = p;
    const b = T.root.querySelector('[data-tv="pause"]');
    b.setAttribute('aria-pressed', p); b.innerHTML = `${icon(p ? 'play' : 'pause')}${p ? 'Play' : 'Pause'}`;
    try { if (p) window.speechSynthesis.pause(); else window.speechSynthesis.resume(); } catch (e) { /* ignore */ }
  }
  function onClick(e) {
    if (!T) return;
    const st = e.target.closest('[data-tv-step]'); if (st) { go(+st.dataset.tvStep); return; }
    const b = e.target.closest('[data-tv]'); if (!b) return;
    const a = b.dataset.tv;
    if (a === 'close') close();
    else if (a === 'next') go(T.i + 1);
    else if (a === 'prev') go(T.i - 1);
    else if (a === 'pause') setPaused(!T.paused);
    else if (a === 'narrate') { T.narrate = !T.narrate; b.setAttribute('aria-pressed', T.narrate); b.innerHTML = `${icon(T.narrate ? 'vol' : 'volOff')}${T.narrate ? 'Voice on' : 'Voice off'}`; if (!T.narrate) try { window.speechSynthesis.cancel(); } catch (err) { /* ignore */ } }
    else if (a === 'replay') go(0);
    else if (a === 'go-workout') { close(); GF.go('dashboard'); setTimeout(() => { const f = document.getElementById('focus'); if (f) f.scrollIntoView({ behavior: 'smooth' }); }, 200); }
    else if (a === 'go-rehab') { close(); GF.go('rehab'); }
  }
  function onKey(e) {
    if (!T || document.querySelector('.modal-backdrop')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(T.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(T.i - 1); }
    else if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); setPaused(!T.paused); }
  }

  GF.tour = { open, close, isOpen: () => !!T, _state: () => T, STEPS };
})(window.GF = window.GF || {});
