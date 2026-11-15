/* GhostFit – Movement replay (skeleton data only — no video is ever recorded)
   Replays the landmarks captured during a camera-tracked set, beside an exercise reference,
   with the tracked joint angle over time and each rep marked. Approximate 2D estimate. */
(function (GF) {
  'use strict';
  const { esc, icon, modal } = GF.u;
  GF.views = GF.views || {};
  const CONN = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
  const MARK = { good: ['✓', '#4cc47f', 'Counted'], unassessed: ['?', '#a0a5ab', 'Counted, form not assessed'], bad: ['✗', '#e85a50', 'Not counted — form'], partial: ['◐', '#e8b53f', 'Not counted — range'] };

  function open(rp) {
    const e = GF.lib.get(rp.exId), def = GF.lib.trackOf(e);
    if (!rp.frames || rp.frames.length < 2) { GF.u.toast('Not enough movement data to replay'); return; }
    const t0 = rp.frames[0].t, dur = rp.frames[rp.frames.length - 1].t - t0;
    const counts = {}; rp.events.forEach(ev => { counts[ev.type] = (counts[ev.type] || 0) + 1; });
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="replay">
        <div>
          <canvas class="rp" aria-label="Skeleton replay of ${esc(rp.label)}"></canvas>
          <div class="row" style="margin-top:8px">
            <button class="btn sm" data-rp="play" aria-label="Play or pause">${icon('pause')}</button>
            <input type="range" min="0" max="${Math.round(dur)}" value="0" step="10" aria-label="Replay position" data-rp="seek" style="flex:1">
            <div class="seg"><button data-sp="0.5" aria-pressed="false">0.5×</button><button data-sp="1" aria-pressed="true">1×</button></div>
            <label class="switch small"><input type="checkbox" data-rp="ref" checked> Reference</label>
          </div>
          <canvas class="chart" aria-label="Joint angle over time"></canvas>
          <p class="small faint">Line: ${def ? 'tracked joint angle' : 'movement'} over time. Dashed lines: start and target positions. Marks: ${Object.values(MARK).map(m => `${m[0]} ${m[2]}`).join(' · ')}.</p>
        </div>
        <div>
          <div class="eyebrow">${rp.simulated ? 'Simulated demo' : 'Your set'}</div>
          <h3 style="margin:4px 0 10px">${esc(rp.label)}</h3>
          <ul class="list">${Object.entries(MARK).filter(([k]) => counts[k]).map(([k, m]) => `<li><span style="color:${m[1]};font-weight:700;width:18px">${m[0]}</span><div class="grow">${m[2]}</div><strong>${counts[k]}</strong></li>`).join('') || '<li class="muted">No complete reps recorded.</li>'}</ul>
          <h3 style="margin:16px 0 6px">Moments to review</h3>
          <ul class="list">${rp.events.filter(ev => ev.type === 'bad' || ev.type === 'partial').map(ev => `<li><button class="btn sm ghost" data-at="${ev.t - t0}">${((ev.t - t0) / 1000).toFixed(1)}s</button><div class="grow small">${esc(issueText(def, ev))}</div></li>`).join('') || '<li class="small muted">No flagged reps.</li>'}</ul>
          <p class="note">This is an approximate 2D estimate from camera landmarks, not a biomechanical assessment. Use it to spot patterns, not exact measurements.</p>
        </div>
      </div>`;
    let raf = 0, playing = true, speed = 1, pos = 0, last = performance.now(), showRef = true;
    modal({ title: 'Movement review', body, wide: true, onClose: () => cancelAnimationFrame(raf) });
    const cv = body.querySelector('canvas.rp'), ch = body.querySelector('canvas.chart'), seek = body.querySelector('[data-rp=seek]');
    body.addEventListener('click', ev => {
      const b = ev.target.closest('[data-rp=play]'); if (b) { playing = !playing; b.innerHTML = icon(playing ? 'pause' : 'play'); if (playing && pos >= dur) pos = 0; }
      const sp = ev.target.closest('[data-sp]'); if (sp) { speed = +sp.dataset.sp; body.querySelectorAll('[data-sp]').forEach(x => x.setAttribute('aria-pressed', x === sp)); }
      const at = ev.target.closest('[data-at]'); if (at) { pos = Math.max(0, +at.dataset.at - 1200); playing = true; }
    });
    seek.addEventListener('input', () => { pos = +seek.value; });
    body.querySelector('[data-rp=ref]').addEventListener('change', ev => { showRef = ev.target.checked; });

    function frameAt(ms) { const t = t0 + ms; let lo = 0, hi = rp.frames.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rp.frames[mid].t <= t) lo = mid; else hi = mid - 1; } return rp.frames[lo]; }
    function lmOf(f) { const out = []; for (let i = 0; i < 33; i++) out.push({ x: f.lm[i * 3], y: f.lm[i * 3 + 1], visibility: f.lm[i * 3 + 2] }); return out; }

    function drawFrame() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
      const f = frameAt(pos), lm = lmOf(f);
      const s = Math.min(w / rp.W, h / rp.H), ox = (w - rp.W * s) / 2, oy = (h - rp.H * s) / 2;
      // map source pixels → canvas pixels, mirrored like the live view
      const map = (x, y) => ({ x: ox + (rp.W - x) * s, y: oy + y * s });
      if (showRef && def) {
        const a = GF.engine.analyze(def, lm, rp.W, rp.H);
        if (a.P && a.P._torso) {
          const prog = def.type === 'hold' ? 1 : Math.max(0, Math.min(1, (def.start - (f.m != null ? f.m : def.start)) / (def.start - def.end)));
          const Pg = GF.ghost.poseAt(def, 0, { e: prog });
          const pin = def.ghost.pin, user = pin === 'ankleA' ? a.P.ankle : pin === 'hipC' ? a.P._hip : a.P.hip;
          let flip = false;
          if (def.view === 'side') { const g0 = GF.ghost.poseAt(def, 0, { e: 0 }); const gdx = g0.shoulder.x - g0.ankleA.x; flip = Math.abs(gdx) > 0.1 ? Math.sign(a.P.shoulder.x - a.P.ankle.x) !== Math.sign(gdx) : (a.P.nose.x - a.P.shoulder.x) < 0; }
          const u = map(user.x, user.y);
          GF.ghost.draw(ctx, Pg, GF.ghost.pinTransform(Pg, pin, u, a.P._torso * s / GF.ghost.LEN.torso, !flip), { alpha: 0.35, color: '#d6f35a', glow: false });
        }
      }
      ctx.save(); ctx.translate(ox + rp.W * s, oy); ctx.scale(-s, s);
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, rp.H * 0.006);
      ctx.strokeStyle = f.q === 'good' ? '#e9ecef' : f.q === 'fair' ? '#e8b53f' : '#7d8288';
      for (const [i, j] of CONN) { const p = lm[i], q = lm[j]; if (p.visibility < 0.5 || q.visibility < 0.5) continue; ctx.beginPath(); ctx.moveTo(p.x * rp.W, p.y * rp.H); ctx.lineTo(q.x * rp.W, q.y * rp.H); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#a0a5ab'; ctx.font = `${12 * dpr}px system-ui`;
      ctx.fillText(`${(pos / 1000).toFixed(1)} s${f.q && f.q !== 'good' ? ' · tracking ' + (f.q === 'fair' ? 'limited' : 'poor') : ''}`, 10 * dpr, 18 * dpr);
      if (showRef && def) { ctx.fillStyle = '#d6f35a'; ctx.fillText('Reference', 10 * dpr, 36 * dpr); }
    }
    function drawChart() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(ch.clientWidth * dpr), h = Math.round(ch.clientHeight * dpr);
      if (ch.width !== w || ch.height !== h) { ch.width = w; ch.height = h; }
      const ctx = ch.getContext('2d'); ctx.clearRect(0, 0, w, h);
      const ms = rp.frames.map(f => f.m).filter(m => m != null);
      if (!ms.length) return;
      let lo = Math.min(...ms), hi = Math.max(...ms);
      if (def && def.start != null) { lo = Math.min(lo, def.start, def.end); hi = Math.max(hi, def.start, def.end); }
      const pad = (hi - lo) * 0.1 || 5; lo -= pad; hi += pad;
      const X = t => (t - t0) / dur * (w - 20 * dpr) + 10 * dpr, Y = m => h - 18 * dpr - (m - lo) / (hi - lo) * (h - 30 * dpr);
      ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = dpr;
      if (def && def.start != null) for (const v of [def.start, def.end]) { ctx.beginPath(); ctx.moveTo(0, Y(v)); ctx.lineTo(w, Y(v)); ctx.stroke(); }
      ctx.setLineDash([]); ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = 2 * dpr; ctx.beginPath();
      let first = true; for (const f of rp.frames) { if (f.m == null) continue; const x = X(f.t), y = Y(f.m); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } ctx.stroke();
      ctx.font = `bold ${12 * dpr}px system-ui`; ctx.textAlign = 'center';
      for (const ev of rp.events) { const m = MARK[ev.type]; if (!m) continue; ctx.fillStyle = m[1]; ctx.fillText(m[0], X(ev.t), 12 * dpr); }
      ctx.strokeStyle = '#111827'; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(X(t0 + pos), 14 * dpr); ctx.lineTo(X(t0 + pos), h); ctx.stroke();
    }
    function loop(now) {
      const dt = now - last; last = now;
      if (playing) { pos += dt * speed; if (pos >= dur) { pos = dur; playing = false; body.querySelector('[data-rp=play]').innerHTML = icon('play'); } seek.value = pos; }
      drawFrame(); drawChart();
      if (document.body.contains(cv)) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }
  function issueText(def, ev) {
    if (ev.type === 'partial') return def ? def.partial : 'Partial range';
    const f = def && def.form.find(x => x.id === ev.id); return f ? f.msg : 'Form issue';
  }
  GF.views.replay = { open };
})(window.GF = window.GF || {});
