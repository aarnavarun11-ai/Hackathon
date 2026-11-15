/* GhostFit – interaction polish + crash safety.
   • confetti()  – celebration burst (skipped when the user prefers reduced motion)
   • enhance(el) – count-up numbers, muscle-map hover linking
   • global: button ripples, card tilt, and a crash guard that keeps the app usable */
(function (GF) {
  'use strict';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('rm');
  const fine = matchMedia('(pointer: fine)').matches;

  /* ---------- crash guard ---------- */
  let lastCrashToast = 0;
  function crash(err, where) {
    try { console.error('[GhostFit]', where || '', err); } catch (e) { /* ignore */ }
    const now = Date.now();
    if (now - lastCrashToast > 10000 && GF.u && GF.u.toast) { lastCrashToast = now; GF.u.toast('Something went wrong, but your data is safe. If anything looks stuck, reload the page.', 'error'); }
  }
  const ours = src => !src || /ghostfit|\/js\/|index\.html|^file:|localhost/i.test(src);
  window.addEventListener('error', e => {
    const m = String(e.message || '');
    if (/ResizeObserver loop/i.test(m) || !ours(e.filename)) return;   // harmless browser noise / extensions
    crash(e.error || m, 'error');
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason, m = String((r && r.message) || r || '');
    if (/AbortError|NotAllowedError|play\(\) request was interrupted/i.test(m)) return;   // camera/media cancellations are handled where they happen
    crash(r, 'promise');
  });

  /* ---------- confetti ---------- */
  function confetti(opts = {}) {
    if (reduced()) return;
    const n = opts.count || 140, colors = ['#2dd4bf', '#22d3ee', '#f97316', '#fbbf24', '#a78bfa', '#4ade80', '#fb7185'];
    const c = document.createElement('canvas');
    c.className = 'confetti'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
    const ctx = c.getContext('2d');
    const ox = (opts.x != null ? opts.x : 0.5) * W, oy = (opts.y != null ? opts.y : 0.35) * H;
    const P = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2, sp = (4 + Math.random() * 9) * dpr;
      return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6 * dpr, r: (4 + Math.random() * 5) * dpr, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], shape: Math.random() < 0.5 };
    });
    const t0 = performance.now();
    (function frame(t) {
      const el = (t - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        p.vy += 0.32 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - el / 2.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        if (p.shape) ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9); else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (el < 2.6) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  /** Big celebration: confetti + a toast + (optional) spoken line */
  function celebrate(text, opts = {}) {
    confetti(opts);
    if (text) {
      GF.u.toast(text);
      if (opts.say !== false) try { GF.speech && GF.speech.say(text.replace(/[!🎉]/g, ''), 3); } catch (e) { /* voice optional */ }
    }
  }

  /* ---------- count-up numbers: <b data-up="42">42</b> ---------- */
  function countUp(root) {
    root.querySelectorAll('[data-up]').forEach(el => {
      const to = parseFloat(el.dataset.up); if (!isFinite(to) || reduced() || to === 0) return;
      const suffix = el.dataset.upSuffix || '', dec = (String(el.dataset.up).split('.')[1] || '').length;
      const t0 = performance.now(), dur = 900;
      (function step(t) {
        if (!el.isConnected) return;
        const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3);
        el.textContent = (to * e).toFixed(dec) + suffix;
        if (u < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ---------- muscle map: hover a muscle ↔ its row ---------- */
  function linkBodymap(root) {
    root.querySelectorAll('.bodymap').forEach(bm => {
      if (bm.dataset.linked) return; bm.dataset.linked = '1';
      const set = r => {
        if (r) bm.dataset.hl = r; else delete bm.dataset.hl;
        bm.querySelectorAll('.bm-m').forEach(g => g.classList.toggle('hl-on', !!r && g.dataset.r === r));
      };
      bm.addEventListener('pointerover', e => { const t = e.target.closest('[data-r]'); set(t && t.dataset.r); });
      bm.addEventListener('pointerleave', () => set(null));
      bm.addEventListener('focusin', e => { const t = e.target.closest('[data-r]'); set(t && t.dataset.r); });
      bm.addEventListener('focusout', () => set(null));
    });
  }

  function enhance(root) {
    if (!root) return;
    try { countUp(root); linkBodymap(root); } catch (e) { crash(e, 'enhance'); }
  }

  /* ---------- global micro-interactions ---------- */
  const RIPPLE = '.btn, .pchip, .pick, .focus, .choice, .rx, .pe-x, .cta, .mine, .pain-scale button, .rate-big button';
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest(RIPPLE);
    if (!el || el.disabled || reduced()) return;
    const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }, { passive: true });

  const TILT = '.focus, .wk, .feature, .choice, .pick, .rx, .cta, .rom-card, .stat-card, .mine';
  let tilted = null;
  if (fine) {
    document.addEventListener('pointermove', e => {
      if (reduced()) return;
      const el = e.target.closest(TILT);
      if (tilted && tilted !== el) { tilted.style.transform = ''; tilted.style.removeProperty('--mx'); tilted.style.removeProperty('--my'); tilted = null; }
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const k = r.width > 320 ? 3 : 7;
      el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * k).toFixed(2)}deg) rotateY(${((x - 0.5) * k).toFixed(2)}deg) translateY(-3px)`;
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      tilted = el;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (tilted) { tilted.style.transform = ''; tilted = null; } });
  }

  GF.fx = { confetti, celebrate, countUp, enhance, crash, reduced };
  GF.crash = crash;
})(window.GF = window.GF || {});
