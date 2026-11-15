/* GhostFit – visual kit: the ghost mascot, feature illustrations, rings and mini charts.
   Everything is inline SVG so it works offline and follows the light/dark theme via CSS variables. */
(function (GF) {
  'use strict';
  let n = 0;
  const uid = p => `${p}${++n}`;

  /** The GhostFit mascot: a glowing ghost with a sweatband. mood: 'happy' | 'wink' | 'focus' */
  function ghost(size = 120, mood = 'happy') {
    const g = uid('gg'), s = uid('gs');
    const eyes = mood === 'wink'
      ? `<circle cx="48" cy="56" r="6" fill="#0b1f24"/><path d="M66 56q6-5 12 0" stroke="#0b1f24" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : mood === 'focus'
        ? `<rect x="42" y="52" width="13" height="7" rx="3.5" fill="#0b1f24"/><rect x="65" y="52" width="13" height="7" rx="3.5" fill="#0b1f24"/>`
        : `<circle cx="48" cy="56" r="6.5" fill="#0b1f24"/><circle cx="72" cy="56" r="6.5" fill="#0b1f24"/><circle cx="50" cy="54" r="2" fill="#fff"/><circle cx="74" cy="54" r="2" fill="#fff"/>`;
    return `<svg class="gf-ghost" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecfffb"/><stop offset=".55" stop-color="#99f6e4"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
        <radialGradient id="${s}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2dd4bf" stop-opacity=".55"/><stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#0f766e" opacity=".18"/>
      <circle cx="60" cy="60" r="58" fill="url(#${s})"/>
      <path d="M60 14c-23 0-38 17-38 39v49l9-7 9 7 10-7 10 7 10-7 10 7 9-7 9 7V53c0-22-15-39-38-39z" fill="url(#${g})" stroke="#0f766e" stroke-opacity=".25" stroke-width="1.5"/>
      <path d="M26 40q34-12 68 0" stroke="#f97316" stroke-width="7" fill="none" stroke-linecap="round"/>
      ${eyes}
      <path d="M52 70q8 7 16 0" stroke="#0b1f24" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="40" cy="67" r="4" fill="#fb923c" opacity=".45"/><circle cx="80" cy="67" r="4" fill="#fb923c" opacity=".45"/>
    </svg>`;
  }

  /** Progress ring. value 0..1, label in the middle */
  function ring(value, big, small, size = 120) {
    const g = uid('rg'), r = 46, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
    return `<svg class="gf-ring" width="${size}" height="${size}" viewBox="0 0 110 110" aria-hidden="true">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--grad-a)"/><stop offset="1" style="stop-color:var(--grad-b)"/></linearGradient></defs>
      <circle cx="55" cy="55" r="${r}" fill="none" style="stroke:var(--ring-track)" stroke-width="10"/>
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="url(#${g})" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" transform="rotate(-90 55 55)" class="ring-fill" style="--c:${c.toFixed(1)}"/>
      <text x="55" y="56" text-anchor="middle" class="ring-big">${big}</text>
      <text x="55" y="74" text-anchor="middle" class="ring-small">${small}</text>
    </svg>`;
  }

  /** Mini bar chart for the last 7 days. values = minutes per day, today last */
  function weekBars(values, labels) {
    const max = Math.max(10, ...values), W = 210, H = 84, bw = W / values.length;
    const g = uid('bg');
    return `<svg class="gf-bars" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--grad-a)"/><stop offset="1" style="stop-color:var(--grad-b)"/></linearGradient></defs>
      ${values.map((v, i) => { const h = Math.max(6, v / max * (H - 26)); const last = i === values.length - 1; return `
        <rect x="${i * bw + bw * 0.28}" y="${H - 18 - (H - 26)}" width="${bw * 0.44}" height="${H - 26}" rx="${bw * 0.22}" style="fill:var(--ring-track)"/>
        <rect x="${i * bw + bw * 0.28}" y="${H - 18 - h}" width="${bw * 0.44}" height="${h}" rx="${bw * 0.22}" fill="${v ? `url(#${g})` : 'transparent'}" ${last ? 'class="today"' : ''}/>
        <text x="${i * bw + bw / 2}" y="${H - 3}" text-anchor="middle" class="bar-lbl${last ? ' now' : ''}">${labels[i]}</text>`; }).join('')}
    </svg>`;
  }

  /** Feature illustrations (what makes GhostFit different) */
  const FEATURE = {
    joints: () => `<svg viewBox="0 0 80 80" aria-hidden="true"><g style="stroke:var(--grad-b)" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M40 22v20M40 42l-10 14v14M40 42l10 14v14M40 28l-14 8-6 12M40 28l14 8 6 12"/></g>
      <circle cx="40" cy="14" r="7" style="fill:var(--grad-a)" opacity=".9"/>
      ${[[40, 28], [26, 36], [54, 36], [20, 48], [60, 48], [40, 42], [30, 56], [50, 56], [30, 70], [50, 70]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${i === 6 || i === 7 ? '#f97316' : '#22c55e'}" stroke="#fff" stroke-width="1.5"/>`).join('')}</svg>`,
    reps: () => `<svg viewBox="0 0 80 80" aria-hidden="true">
      <rect x="6" y="14" width="40" height="34" rx="12" fill="#22c55e"/><text x="26" y="38" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">+1</text>
      <rect x="34" y="40" width="40" height="28" rx="11" fill="#ef4444" opacity=".9"/><path d="M47 47l14 14M61 47 47 61" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
    voice: () => `<svg viewBox="0 0 80 80" aria-hidden="true">
      <rect x="30" y="12" width="20" height="34" rx="10" style="fill:var(--grad-a)"/><path d="M22 38a18 18 0 0 0 36 0M40 56v10M30 66h20" style="stroke:var(--grad-b)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M10 30v14M66 26v22M72 32v10M4 34v6" stroke="#f97316" stroke-width="4" stroke-linecap="round"/></svg>`,
    privacy: () => `<svg viewBox="0 0 80 80" aria-hidden="true">
      <path d="M40 8 66 18v18c0 18-12 30-26 36C26 66 14 54 14 36V18z" style="fill:var(--grad-a)" opacity=".9"/>
      <rect x="29" y="36" width="22" height="18" rx="4" fill="#fff"/><path d="M33 36v-5a7 7 0 0 1 14 0v5" stroke="#fff" stroke-width="4" fill="none"/><circle cx="40" cy="45" r="2.6" style="fill:var(--grad-b)"/></svg>`,
  };
  const feature = k => FEATURE[k] ? FEATURE[k]() : '';

  /** Intensity meter: 1–3 flames */
  function flames(level) {
    return `<span class="flames" aria-hidden="true">${[1, 2, 3].map(i => `<svg viewBox="0 0 24 24" class="${i <= level ? 'on' : ''}"><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z"/></svg>`).join('')}</span>`;
  }

  /** Animate every <canvas data-fig="exerciseId"> inside root with the ghost figure. Returns a stop fn. */
  function animateFigures(root, offsetEach = 0.37, colors) {
    let raf = 0;
    const cards = [...root.querySelectorAll('canvas[data-fig]')].map((c, i) => ({ c, e: GF.lib.get(c.dataset.fig) || (GF.rehab && GF.rehab.get(c.dataset.fig)), o: i * offsetEach })).filter(x => x.e);
    if (!cards.length) return () => { };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('rm');
    const t0 = performance.now();
    (function loop(t) {
      if (!cards.some(x => x.c.isConnected)) return;
      for (const { c, e, o } of cards) GF.viewer3d.draw2D(c, e, reduce ? 0.9 : (t - t0) / 1000 + o, colors);
      if (!reduce) raf = requestAnimationFrame(loop);
    })(t0);
    return () => cancelAnimationFrame(raf);
  }

  /** Side-view leg with the chosen joint glowing. area: knee | ankle */
  function leg(area, size = 140) {
    const g = uid('lg'), r = uid('lr');
    const j = area === 'ankle' ? [62, 118] : [70, 70];
    return `<svg class="gf-leg" width="${size}" height="${size}" viewBox="0 0 140 140" aria-hidden="true">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--grad-a)"/><stop offset="1" style="stop-color:var(--grad-b)"/></linearGradient>
        <radialGradient id="${r}"><stop offset="0" stop-color="#f97316" stop-opacity=".9"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient></defs>
      <path d="M58 8 C76 8 84 18 82 36 L78 70 C77 80 74 92 70 104 L68 116 C80 118 100 120 112 124 C118 126 118 132 110 132 L52 132 C48 132 47 128 48 122 L52 104 C55 92 58 80 60 70 L58 36 C56 22 46 8 58 8 Z" fill="url(#${g})" opacity=".9"/>
      <circle cx="${j[0]}" cy="${j[1]}" r="26" fill="url(#${r})"><animate attributeName="r" values="20;28;20" dur="2.4s" repeatCount="indefinite"/></circle>
      <circle cx="${j[0]}" cy="${j[1]}" r="8" fill="#fff" stroke="#f97316" stroke-width="4"/>
    </svg>`;
  }
  /** Pain face for 0–10 */
  function painFace(n, size = 44) {
    if (n == null) n = 0;
    const c = n <= 3 ? '#22c55e' : n <= 6 ? '#f59e0b' : '#ef4444';
    const mouth = n <= 1 ? 'M14 27q8 7 16 0' : n <= 3 ? 'M15 28q7 4 14 0' : n <= 6 ? 'M15 29h14' : n <= 8 ? 'M15 31q7-5 14 0' : 'M14 32q8-8 16 0';
    return `<svg width="${size}" height="${size}" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="${c}"/><circle cx="16" cy="18" r="2.6" fill="#0b1f24"/><circle cx="28" cy="18" r="2.6" fill="#0b1f24"/><path d="${mouth}" stroke="#0b1f24" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  }
  const DARK = { a: '#5eead4', b: '#22d3ee', glow: 'rgba(94,234,212,.7)', prop: 'rgba(148,233,220,.22)' };
  GF.art = { DARK, leg, painFace, ghost, ring, weekBars, feature, flames, animateFigures };
})(window.GF = window.GF || {});
