/* GhostFit – Muscle map: a front + back body diagram that lights up the muscles worked.
   weights: { region: number } — any scale; it is normalised so the most-worked muscle is brightest. */
(function (GF) {
  'use strict';
  const { esc } = GF.u;

  const LABEL = {
    neck: 'Neck', traps: 'Traps / upper back', delts: 'Shoulders', chest: 'Chest', biceps: 'Biceps', triceps: 'Triceps',
    forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', lowerback: 'Lower back', lats: 'Lats', glutes: 'Glutes',
    hipflex: 'Hip flexors', adductors: 'Inner thighs', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves', shins: 'Shins',
  };
  /** library muscle names → regions (with share) */
  const NAME = {
    core: { abs: 1, obliques: 0.6, lowerback: 0.3 }, abs: { abs: 1 }, obliques: { obliques: 1 },
    shoulders: { delts: 1 }, 'rear shoulders': { delts: 1, traps: 0.3 }, 'rotator cuff': { delts: 1, traps: 0.4 },
    chest: { chest: 1 }, triceps: { triceps: 1 }, biceps: { biceps: 1 }, forearms: { forearms: 1 }, wrist: { forearms: 1 }, grip: { forearms: 1 },
    glutes: { glutes: 1 }, quads: { quads: 1 }, hamstrings: { hamstrings: 1 }, calves: { calves: 1 }, shins: { shins: 1 }, ankle: { calves: 0.6, shins: 0.6 },
    'lower back': { lowerback: 1 }, spine: { lowerback: 1, traps: 0.3 }, back: { lats: 1, traps: 0.6, lowerback: 0.5 },
    'upper back': { traps: 1, lats: 0.4 }, lats: { lats: 1 }, neck: { neck: 1, traps: 0.5 },
    'hip flexors': { hipflex: 1 }, hips: { glutes: 0.7, hipflex: 0.6, adductors: 0.5 }, adductors: { adductors: 1 }, 'inner thighs': { adductors: 1 },
    'full body': { quads: 0.5, glutes: 0.5, abs: 0.5, delts: 0.5, chest: 0.4, lats: 0.4, hamstrings: 0.4, calves: 0.3 },
  };

  /** Add an exercise's muscles to a weights object. amount = sets done */
  function add(weights, muscles, amount = 1) {
    if (!muscles) return weights;
    const go = (names, f) => (names || []).forEach(n => { const m = NAME[n] || NAME[(n || '').toLowerCase()]; if (m) for (const [r, s] of Object.entries(m)) weights[r] = (weights[r] || 0) + s * f * amount; });
    go(muscles.p, 1); go(muscles.s, 0.45);
    return weights;
  }

  // ---- shapes (viewer-left half; mirrored for the right). viewBox 0 0 200 420 ----
  const BASE = `
    <ellipse cx="100" cy="34" rx="20" ry="25"/>
    <rect x="90" y="54" width="20" height="24" rx="6"/>
    <path d="M64 84 Q100 72 136 84 Q148 92 144 124 L136 212 Q100 228 64 212 L56 124 Q52 92 64 84 Z"/>`;
  const LIMBS = `
    <line x1="64" y1="94" x2="54" y2="160" stroke-width="22"/><line x1="54" y1="160" x2="45" y2="222" stroke-width="17"/>
    <line x1="83" y1="222" x2="80" y2="316" stroke-width="34"/><line x1="80" y1="316" x2="80" y2="398" stroke-width="23"/>`;
  const HANDFOOT = `<circle cx="43" cy="234" r="8"/><ellipse cx="78" cy="410" rx="12" ry="6"/>`;
  const FRONT = {
    delts: '<ellipse cx="66" cy="99" rx="13" ry="15"/>',
    chest: '<path d="M72 100 Q85 92 99 97 L99 128 Q84 136 72 125 Z"/>',
    biceps: '<ellipse cx="57" cy="130" rx="8.5" ry="20" transform="rotate(12 57 130)"/>',
    forearms: '<ellipse cx="48" cy="190" rx="7" ry="24" transform="rotate(8 48 190)"/>',
    abs: '<rect x="87" y="136" width="12" height="14" rx="3"/><rect x="87" y="152" width="12" height="14" rx="3"/><rect x="87" y="168" width="12" height="14" rx="3"/><rect x="87" y="184" width="12" height="22" rx="4"/>',
    obliques: '<path d="M73 134 L84 138 L84 202 L75 198 Q69 166 73 134 Z"/>',
    hipflex: '<path d="M77 212 L96 216 L93 238 L80 232 Z"/>',
    adductors: '<ellipse cx="93" cy="264" rx="6.5" ry="24"/>',
    quads: '<ellipse cx="79" cy="276" rx="13.5" ry="40"/>',
    shins: '<ellipse cx="78" cy="354" rx="6" ry="30"/>',
    traps: '<path d="M90 70 L70 86 L90 82 Z"/>',
  };
  const BACK = {
    delts: FRONT.delts,
    triceps: '<ellipse cx="57" cy="131" rx="9" ry="20" transform="rotate(12 57 131)"/>',
    forearms: FRONT.forearms,
    lats: '<path d="M70 110 L97 126 L97 180 Q80 176 72 152 Z"/>',
    glutes: '<ellipse cx="87" cy="228" rx="15" ry="17"/>',
    hamstrings: '<ellipse cx="81" cy="284" rx="12.5" ry="36"/>',
    calves: '<ellipse cx="80" cy="350" rx="10.5" ry="26"/>',
  };
  const CENTER_FRONT = { neck: '<rect x="93" y="58" width="14" height="18" rx="5"/>' };
  const CENTER_BACK = { neck: CENTER_FRONT.neck, traps: '<path d="M100 64 L134 88 L100 142 L66 88 Z"/>', lowerback: '<rect x="89" y="160" width="22" height="46" rx="8"/>' };

  function color(f) {
    if (!f) return null;
    // teal → amber → orange as the muscle gets more work
    const stops = [[45, 212, 191], [251, 191, 36], [249, 115, 22]];
    const t = Math.min(1, f) * 2, i = Math.min(1, Math.floor(t)), u = t - i;
    const a = stops[i], b = stops[i + 1];
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`;
  }

  function figure(view, norm) {
    const side = view === 'front' ? FRONT : BACK, center = view === 'front' ? CENTER_FRONT : CENTER_BACK;
    const draw = (id, shape) => {
      const f = norm[id] || 0, c = color(f);
      return `<g class="bm-m ${f ? 'on' : ''}" data-r="${id}" ${c ? `style="fill:${c};opacity:${(0.55 + 0.45 * Math.min(1, f)).toFixed(2)}"` : ''}><title>${LABEL[id]}${f ? '' : ' — not worked'}</title>${shape}</g>`;
    };
    const half = Object.entries(side).map(([id, s]) => draw(id, s)).join('');
    return `<svg class="bm-svg" viewBox="0 0 200 420" role="img" aria-label="${view === 'front' ? 'Front' : 'Back'} of body">
      <g class="bm-base">${BASE}<g class="bm-limbs">${LIMBS}<g transform="translate(200 0) scale(-1 1)">${LIMBS}</g></g>${HANDFOOT}<g transform="translate(200 0) scale(-1 1)">${HANDFOOT}</g></g>
      ${half}<g transform="translate(200 0) scale(-1 1)">${half}</g>
      ${Object.entries(center).map(([id, s]) => draw(id, s)).join('')}
    </svg>`;
  }

  /** Render the diagram. opts: { compact, title, empty } */
  function render(weights, opts = {}) {
    const max = Math.max(0, ...Object.values(weights || {}));
    const norm = {}; if (max) for (const [k, v] of Object.entries(weights)) if (LABEL[k] && v > 0) norm[k] = v / max;
    const top = Object.entries(norm).sort((a, b) => b[1] - a[1]);
    const desc = top.length ? top.map(([k]) => LABEL[k]).join(', ') : 'none yet';
    return `<div class="bodymap ${opts.compact ? 'compact' : ''}">
      <div class="bm-figs" role="group" aria-label="Muscle map — worked: ${esc(desc)}">
        <figure>${figure('front', norm)}<figcaption>Front</figcaption></figure>
        <figure>${figure('back', norm)}<figcaption>Back</figcaption></figure>
      </div>
      <div class="bm-side">
        ${opts.title ? `<h3>${esc(opts.title)}</h3>` : ''}
        ${top.length ? `<ul class="bm-list">${top.slice(0, opts.compact ? 6 : 10).map(([k, f]) => `<li data-r="${k}" tabindex="0"><span class="bm-dot" style="background:${color(f)}"></span><span class="bm-name">${LABEL[k]}</span><span class="bm-bar"><i style="width:${Math.round(f * 100)}%;background:${color(f)}"></i></span></li>`).join('')}</ul>`
          : `<p class="bm-empty">${esc(opts.empty || 'Finish some sets to light up your muscles.')}</p>`}
        <div class="bm-legend"><span>Light</span><i></i><span>Most worked</span></div>
      </div>
    </div>`;
  }

  /** Small front-view body with a glowing spot on an injured joint. dot = [x, y] on the viewer-left; mirror for the other side */
  function spot(dot, size = 120, mirror = false) {
    const x = mirror ? 200 - dot[0] : dot[0], y = dot[1];
    const id = 'sp' + Math.random().toString(36).slice(2, 7);
    return `<svg class="bm-spot" width="${size}" height="${Math.round(size * 2.1)}" viewBox="0 0 200 420" aria-hidden="true">
      <defs><radialGradient id="${id}"><stop offset="0" stop-color="#f97316" stop-opacity=".95"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--grad-a)"/><stop offset="1" style="stop-color:var(--grad-b)"/></linearGradient></defs>
      <g class="bm-spot-body" style="fill:url(#${id}b);stroke:url(#${id}b)">${BASE}<g class="bm-limbs">${LIMBS}<g transform="translate(200 0) scale(-1 1)">${LIMBS}</g></g>${HANDFOOT}<g transform="translate(200 0) scale(-1 1)">${HANDFOOT}</g></g>
      <circle cx="${x}" cy="${y}" r="34" fill="url(#${id})"><animate attributeName="r" values="26;38;26" dur="2.4s" repeatCount="indefinite"/></circle>
      <circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="#f97316" stroke-width="5"/>
    </svg>`;
  }

  GF.bodymap = { render, add, spot, LABEL, NAME };
})(window.GF = window.GF || {});
