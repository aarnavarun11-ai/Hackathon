/* GhostFit – Rehab: guided recovery after an injury (knee, ankle, hip, shoulder, elbow, wrist, back, neck).
   Setup (safety → area → side → injury → ability → stage), a home with range-of-motion progress and an
   editable plan, and a camera session that measures how far the injured joint moves, counts gentle reps,
   tracks pain before/after and adjusts the dose. Never replaces a clinician. */
(function (GF) {
  'use strict';
  const { esc, icon, toast, fmtDate, confirmDialog } = GF.u;
  GF.views = GF.views || {};
  const R = GF.rehab, art = GF.art, ghost = GF.ghost;
  const sideName = s => (s === 'L' ? 'Left' : s === 'R' ? 'Right' : '');
  const say = t => { try { if (GF.speech && GF.speech.say) GF.speech.say(t, 2); } catch (e) { /* voice optional */ } };
  const areaSpot = (area, side, size) => GF.bodymap.spot(R.AREAS[area].dot, size, side === 'L');
  const planTitle = p => `${R.sided(p.area) ? sideName(p.side) + ' ' : ''}${R.AREAS[p.area].name.toLowerCase()}`;

  /* ======================= setup wizard ======================= */
  const wiz = { step: 1, d: {}, ok1: false, ok2: false };
  const stepNames = d => ['Safety', 'Area'].concat(!d.area || R.sided(d.area) ? ['Side'] : []).concat(['Injury', 'Ability', 'Stage']);
  function stepper(n) {
    const names = stepNames(wiz.d);
    const idx = n - 1 - (wiz.d.area && !R.sided(wiz.d.area) && n > 3 ? 1 : 0);
    return `<ol class="stepper" aria-label="Setup steps">${names.map((t, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}" ${i === idx ? 'aria-current="step"' : ''}><span>${i < idx ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  }
  function redFlags(compact, area) {
    return `<ul class="flags ${compact ? 'compact' : ''}">${(area ? R.redFlags(area) : R.RED_FLAGS).map(f => `<li>${icon('alert')}<span>${esc(f)}</span></li>`).join('')}</ul>`;
  }

  function renderSetup(root) {
    const d = wiz.d;
    const back = wiz.step > 1 ? `<button class="btn ghost" data-wback>${icon('left')}Back</button>` : (GF.store.rehab().plan ? `<a class="btn ghost" href="#/rehab">${icon('left')}Cancel</a>` : '');
    let body = '';
    if (wiz.step === 1) {
      body = `
        <section class="glass rehab-intro">
          <div class="ri-art">${art.ghost(96)}<div class="ri-leg">${GF.bodymap.spot(R.AREAS.knee.dot, 70, true)}</div></div>
          <div>
            <h1>Recover with GhostFit</h1>
            <p class="lead">Step-by-step exercises after an injury to your knee, ankle, hip, shoulder, elbow, wrist, back or neck. The camera measures how far the joint moves, so you can watch it come back.</p>
          </div>
        </section>
        <section class="glass safety-card">
          <h2>${icon('shield')} Before you start</h2>
          <label class="check"><input type="checkbox" data-ok="1" ${wiz.ok1 ? 'checked' : ''}><span>A doctor or physio has said I can start exercising it</span></label>
          <label class="check"><input type="checkbox" data-ok="2" ${wiz.ok2 ? 'checked' : ''}><span>I’ll stop and get help if any of these happen:</span></label>
          ${redFlags()}
          <div class="row" style="margin-top:14px"><button class="btn primary lg" data-wnext ${wiz.ok1 && wiz.ok2 ? '' : 'disabled'}>I’m cleared ${icon('right')}</button><button class="btn" data-notyet>Not yet</button></div>
          <p class="small muted" style="margin-top:10px">GhostFit guides home exercises. It doesn’t diagnose injuries or replace your doctor or physio — their advice always comes first.</p>
        </section>`;
    } else if (wiz.step === 2) {
      body = `<h1 class="wiz-h">What are you recovering from?</h1>
        <div class="pick-grid areas">${Object.entries(R.AREAS).map(([k, a]) => `
          <button class="pick area-pick" data-area="${k}">${GF.bodymap.spot(a.dot, 54)}<b>${a.name}</b></button>`).join('')}</div>`;
    } else if (wiz.step === 3) {
      body = `<h1 class="wiz-h">Which ${R.AREAS[d.area].name.toLowerCase()}?</h1>
        <div class="pick-grid two">${['L', 'R'].map(s => `
          <button class="pick big" data-side="${s}">${areaSpot(d.area, s, 70)}<b>${sideName(s)}</b></button>`).join('')}</div>`;
    } else if (wiz.step === 4) {
      body = `<h1 class="wiz-h">What happened?</h1>
        <div class="pick-list">${R.AREAS[d.area].injuries.map(([k, t]) => `<button class="pick row-pick" data-injury="${k}">${icon(k === 'fracture' ? 'target' : k === 'surgery' || k === 'replacement' ? 'plus' : 'heart')}<b>${esc(t)}</b>${icon('right')}</button>`).join('')}</div>`;
    } else if (wiz.step === 5) {
      body = `<h1 class="wiz-h">How much can you use it right now?</h1>
        <p class="muted">Go with what your doctor or physio told you.</p>
        <div class="pick-grid three">${['none', 'partial', 'full'].map((k, i) => { const [t, sub] = R.wbInfo(d.area, k); return `
          <button class="pick" data-wb="${k}"><span class="wb-meter">${[0, 1, 2].map(n => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</span><b>${t}</b><small>${sub}</small></button>`; }).join('')}</div>`;
    } else if (wiz.step === 6) {
      body = `<h1 class="wiz-h">Which stage are you at?</h1>
        <p class="muted">Your physio’s advice wins. Not sure? Start with stage 1.</p>
        <div class="pick-grid three">${Object.entries(R.STAGES).map(([k, s]) => `
          <button class="pick" data-stage="${k}"><span class="stage-num">${k}</span><b>${s.name}</b><small>${s.sub}</small></button>`).join('')}</div>`;
    }
    root.innerHTML = `${wiz.step > 1 ? stepper(wiz.step) : ''}${body}<div class="row" style="margin-top:20px">${back}</div>`;
    const f = root.querySelector('.pick'); if (f && wiz.step > 1) f.focus();
  }

  function setupClick(root, e) {
    const t = e.target;
    if (t.closest('[data-wback]')) { wiz.step = Math.max(1, wiz.step - 1); if (wiz.step === 3 && wiz.d.area && !R.sided(wiz.d.area)) wiz.step = 2; renderSetup(root); return true; }
    if (t.closest('[data-notyet]')) {
      GF.u.modal({ title: 'Check with your doctor first', body: `<div class="center-art">${art.ghost(80)}</div><p>Exercising too early can slow healing. Ask your doctor or physio when it’s safe to start, and which stage to begin with. GhostFit will be right here.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
      return true;
    }
    if (t.closest('[data-wnext]')) { wiz.step = 2; renderSetup(root); return true; }
    const go = n => { wiz.step = n; renderSetup(root); window.scrollTo(0, 0); return true; };
    const a = t.closest('[data-area]'); if (a) { wiz.d.area = a.dataset.area; if (!R.sided(wiz.d.area)) wiz.d.side = 'C'; return go(R.sided(wiz.d.area) ? 3 : 4); }
    const sd = t.closest('[data-side]'); if (sd) { wiz.d.side = sd.dataset.side; return go(4); }
    const inj = t.closest('[data-injury]'); if (inj) { wiz.d.injury = inj.dataset.injury; return go(5); }
    const wb = t.closest('[data-wb]'); if (wb) { wiz.d.wb = wb.dataset.wb; return go(6); }
    const st = t.closest('[data-stage]');
    if (st) {
      const d = wiz.d;
      GF.store.setRehabPlan({ area: d.area, side: d.side, injury: d.injury, wb: d.wb, stage: +st.dataset.stage, volume: 1, cleared: Date.now(), startedAt: Date.now(), advice: null, suggestStage: null, custom: { add: [], remove: [] } });
      wiz.step = 1; wiz.d = {};
      toast('Your rehab plan is ready');
      GF.go('rehab');
      return true;
    }
    return false;
  }

  /* ======================= home ======================= */
  function spark(values, key) {
    if (values.length < 2) return '';
    const W = 120, H = 34, r = R.ROM[key], lo = Math.min(...values, r.better === 'lower' ? r.full : 0), hi = Math.max(...values, r.better === 'lower' ? 0 : 1), span = hi - lo || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1) * (W - 6) + 3).toFixed(1)},${(H - 3 - (r.better === 'lower' ? (hi - v) : (v - lo)) / span * (H - 6)).toFixed(1)}`).join(' ');
    return `<svg class="rom-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" style="stroke:var(--grad-a)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function romVal(key, v) { return v == null ? '—' : R.ROM[key].better === 'lower' ? (v <= 2 ? 'Straight' : `${v}° short`) : `${v}°`; }
  let editing = false;

  function planEditor(plan) {
    const A = R.AREAS[plan.area];
    const chip = (attr, val, label, on) => `<button class="pchip ${on ? 'on' : ''}" data-p-${attr}="${val}" aria-pressed="${on}">${label}</button>`;
    const cat = R.catalogue(plan);
    return `<section class="glass plan-edit" id="plan-edit" aria-label="Change your rehab plan">
      <div class="pe-head"><h2 class="section-h">${icon('edit')} Your plan</h2><button class="btn sm" data-p-close>${icon('check')}Done</button></div>
      <div class="pe-row"><span class="pe-k">Area</span><div class="pe-chips">${Object.entries(R.AREAS).map(([k, a]) => chip('area', k, a.name, plan.area === k)).join('')}</div></div>
      ${R.sided(plan.area) ? `<div class="pe-row"><span class="pe-k">Side</span><div class="pe-chips">${chip('side', 'L', 'Left', plan.side === 'L')}${chip('side', 'R', 'Right', plan.side === 'R')}</div></div>` : ''}
      <div class="pe-row"><span class="pe-k">Injury</span><div class="pe-chips">${A.injuries.map(([k, t]) => chip('injury', k, esc(t), plan.injury === k)).join('')}</div></div>
      <div class="pe-row"><span class="pe-k">Ability</span><div class="pe-chips">${['none', 'partial', 'full'].map(k => chip('wb', k, R.wbInfo(plan.area, k)[0], plan.wb === k)).join('')}</div></div>
      <div class="pe-row"><span class="pe-k">Stage</span><div class="pe-chips">${[1, 2, 3].map(k => chip('stage', k, `${k} · ${R.STAGES[k].name}`, plan.stage === k)).join('')}</div></div>
      <div class="pe-row"><span class="pe-k">Session size</span><div class="pe-chips">${[[0.6, 'Short'], [0.8, 'Medium'], [1, 'Full']].map(([v, t]) => chip('vol', v, t, Math.abs((plan.volume || 1) - v) < 0.11)).join('')}</div></div>
      <h3 class="pe-sub">Exercises <span class="small muted">— tap to add or remove</span></h3>
      <div class="pe-ex">${cat.map(({ e, on, blocked, stageMatch }) => `
        <button class="pe-x ${on ? 'on' : ''}" data-p-ex="${e.id}" aria-pressed="${on}" ${blocked ? `disabled title="${esc(blocked)}"` : ''}>
          <span class="pe-fig"><canvas data-fig="${e.id}" aria-hidden="true"></canvas></span>
          <span class="pe-t"><b>${esc(e.name)}</b><small>${blocked ? esc(blocked) : `Stage ${e.phases.join(', ')}${stageMatch ? '' : ' · extra'}`}</small></span>
          <span class="pe-tick">${icon(on ? 'check' : 'plus')}</span>
        </button>`).join('')}</div>
    </section>`;
  }

  function renderHome(root) {
    const rs = GF.store.rehab(), plan = rs.plan;
    const { list, notes } = R.routine(plan);
    const log = rs.log.filter(l => l.area === plan.area && l.side === plan.side);
    const keys = Object.keys(R.ROM).filter(k => R.ROM[k].area === plan.area && (list.some(e => e.rom && e.rom[k]) || log.some(l => l.rom && l.rom[k] != null)));
    const best = {}, series = {};
    keys.forEach(k => { series[k] = log.filter(l => l.rom && l.rom[k] != null).map(l => l.rom[k]); best[k] = series[k].length ? series[k][series[k].length - 1] : null; });
    const injury = (R.AREAS[plan.area].injuries.find(x => x[0] === plan.injury) || [, ''])[1];
    const advice = plan.advice;
    const muscles = list.reduce((m, e) => GF.bodymap.add(m, e.muscles, R.dose(e, plan, false).sets), {});
    const sided = R.sided(plan.area);

    root.innerHTML = `
      <section class="hero glass rehab-hero">
        <div class="hero-copy">
          <span class="pill eyebrow-pill">${icon('heart')}Rehab · Stage ${plan.stage} — ${R.STAGES[plan.stage].name}</span>
          <h1>${esc(planTitle(plan).replace(/^./, c => c.toUpperCase()))}<br><span class="grad-text">coming back.</span></h1>
          <p class="lead">${esc(injury)} · ${log.length ? `${log.length} session${log.length === 1 ? '' : 's'} done` : 'Day one'}</p>
          <div class="row">
            <button class="btn primary lg" data-start ${list.length ? '' : 'disabled'}>${icon('play')}Start today’s session</button>
            <button class="btn glass-btn lg" data-demo ${list.length ? '' : 'disabled'}>${icon('eye')}Demo</button>
            <a class="btn glass-btn lg" href="#/rehab/report">${icon('download')}Report for physio</a>
            <button class="btn glass-btn lg" data-edit aria-expanded="${editing}"${editing ? ' aria-controls="plan-edit"' : ''}>${icon('edit')}Change plan</button>
          </div>
        </div>
        <div class="hero-art rehab-art" aria-hidden="true">
          <div class="orb"></div>
          <span class="spot-wrap">${areaSpot(plan.area, plan.side, 120)}</span>
          <div class="float f1">${icon('target')}Measures your range</div>
          <div class="float f3">${art.painFace(2, 22)}Tracks pain</div>
          <div class="hero-mascot">${art.ghost(80)}</div>
        </div>
      </section>
      ${editing ? planEditor(plan) : ''}

      ${advice ? `<section class="glass advice ${advice.kind}"><span class="adv-ic">${icon(advice.kind === 'easier' ? 'alert' : 'check')}</span><div><b>${esc(advice.title)}</b><p>${esc(advice.text)}</p></div></section>` : ''}
      ${plan.suggestStage ? `<section class="glass advice up"><span class="adv-ic">${icon('up')}</span><div><b>Ready for stage ${plan.suggestStage}?</b><p>Pain has stayed low. Only move up if your physio agrees.</p></div><div class="row"><button class="btn primary" data-stageup>Move up</button><button class="btn ghost" data-stageno>Not yet</button></div></section>` : ''}

      ${keys.length ? `<h2 class="section-h">Your range of motion</h2>
      <section class="rom-grid">${keys.map(k => {
        const r = R.ROM[k], v = best[k], base = rs.baseline[k + plan.side];
        const pct = R.romPct(k, v), ofOther = v != null && base != null ? Math.round(R.romPct(k, v) / Math.max(0.01, R.romPct(k, base)) * 100) : null;
        const first = series[k][0], delta = v != null && first != null ? v - first : 0;
        return `<div class="glass rom-card">
          ${art.ring(pct, v == null ? '—' : Math.round(pct * 100) + '%', 'of normal', 92)}
          <div class="rom-info"><div class="k">${r.label}</div><div class="v">${romVal(k, v)}</div>
            ${delta && series[k].length > 1 ? `<div class="delta ${(r.better === 'lower' ? delta < 0 : delta > 0) ? 'up' : 'down'}">${(r.better === 'lower' ? -delta : delta) > 0 ? '▲' : '▼'} ${Math.abs(delta)}° since day one</div>` : ''}
            ${ofOther != null ? `<div class="small muted">${Math.min(ofOther, 150)}% of your other side</div>` : sided && list.some(e => e.rom && e.rom[k]) ? `<button class="linkish small" data-measure="${k}">Measure other side</button>` : ''}
            ${spark(series[k], k)}
          </div></div>`;
      }).join('')}</section>` : `<section class="glass note-card"><p>${icon('info')} This area’s exercises are guided by timer and taps — the camera shows your movement but doesn’t measure an angle.</p></section>`}

      <h2 class="section-h" style="margin-top:28px">Today’s exercises</h2>
      ${list.length ? `<section class="rehab-ex">${list.map((e, i) => { const d0 = R.dose(e, plan, false); return `
        <button class="glass rx" data-preview="${e.id}" aria-label="Practise ${esc(e.name)}">
          <span class="rx-fig t${(i % 6) + 1}"><canvas data-fig="${e.id}" aria-hidden="true"></canvas></span>
          <span class="rx-txt"><b>${esc(e.name)}</b><small>${esc(e.short)}</small>
          <span class="row" style="gap:6px"><span class="pill">${e.mode === 'reps' ? `${d0.sets} × ${d0.reps}` : e.mode === 'hold' ? `${d0.sets} × ${d0.hold}s` : `${d0.time}s`}</span>${e.metric ? `<span class="pill cam">${icon('eye')}Measured</span>` : ''}</span></span>
        </button>`; }).join('')}</section>` : `<div class="glass note-card"><p>${icon('info')} No exercises fit your plan right now. Tap “Change plan” to add some.</p></div>`}
      ${notes.length ? `<details class="glass note-card"><summary>${notes.length} exercise${notes.length === 1 ? '' : 's'} left out for safety</summary>${notes.map(n => `<p>${icon('info')} ${esc(n)}</p>`).join('')}</details>` : ''}

      <section class="glass pad" style="margin-top:28px"><h2 class="section-h">Muscles you’re retraining</h2>
        ${GF.bodymap.render(muscles, { empty: 'Add exercises to see which muscles they work.' })}</section>

      <div class="grid g2" style="margin-top:20px">
        <section class="glass pad"><h2 class="section-h">${icon('alert')} Stop and call your doctor if…</h2>${redFlags(true, plan.area)}</section>
        <section class="glass pad"><h2 class="section-h">Recent sessions</h2>
          ${log.length ? `<ul class="list">${log.slice(-5).reverse().map(l => `<li><div class="grow"><div class="title">${fmtDate(l.at, { weekday: 'short', month: 'short', day: 'numeric' })}${l.gentle ? ' · gentle' : ''}</div><div class="sub">${Object.entries(l.rom || {}).map(([k, v]) => `${R.ROM[k].short} ${romVal(k, v)}`).join(' · ') || `${(l.results || []).filter(r => !r.skipped).length} exercises`}</div></div><span class="pain-pair" title="Pain before → after">${art.painFace(l.painBefore, 26)}${icon('right')}${art.painFace(l.painAfter, 26)}</span></li>`).join('')}</ul>` : `<p class="muted">No sessions yet. Your first one takes about 10 minutes.</p>`}
        </section>
      </div>
      <div class="row" style="margin-top:20px">
        <button class="btn ghost" data-reset>${icon('trash')}Start over</button>
      </div>`;
    return art.animateFigures(root, 0.5);
  }

  /** Inline plan editing (no need to redo the whole setup) */
  function editClick(root, t) {
    const plan = GF.store.rehab().plan;
    const set = patch => { GF.store.setRehabPlan(patch); return true; };
    const g = (k) => t.closest(`[data-p-${k}]`);
    let b;
    if ((b = g('area'))) {
      const area = b.dataset.pArea; if (area === plan.area) return true;
      const injuries = R.AREAS[area].injuries.map(x => x[0]);
      return set({ area, side: R.sided(area) ? (plan.side === 'C' ? 'L' : plan.side) : 'C', injury: injuries.includes(plan.injury) ? plan.injury : 'other', custom: { add: [], remove: [] }, advice: null, suggestStage: null });
    }
    if ((b = g('side'))) return set({ side: b.dataset.pSide });
    if ((b = g('injury'))) return set({ injury: b.dataset.pInjury });
    if ((b = g('wb'))) return set({ wb: b.dataset.pWb });
    if ((b = g('stage'))) return set({ stage: +b.dataset.pStage, suggestStage: null, custom: { add: [], remove: [] } });
    if ((b = g('vol'))) return set({ volume: +b.dataset.pVol });
    if ((b = g('ex'))) {
      const id = b.dataset.pEx, e = R.get(id), c = { add: (plan.custom && plan.custom.add || []).slice(), remove: (plan.custom && plan.custom.remove || []).slice() };
      const on = b.getAttribute('aria-pressed') === 'true';
      const inStage = e.phases.includes(plan.stage);
      if (on) { if (inStage) c.remove.push(id); c.add = c.add.filter(x => x !== id); }
      else { if (inStage) c.remove = c.remove.filter(x => x !== id); else c.add.push(id); }
      return set({ custom: c });
    }
    return false;
  }

  /* ======================= session ======================= */
  const CONN = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32]];
  const SWAP = [[11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
  const CHAIN = { leg: ['hip', 'knee', 'ankle', 'heel', 'toe'], arm: ['shoulder', 'elbow', 'wrist', 'index'], body: ['nose', 'shoulder', 'hip', 'knee'] };
  let S = null;

  function show(v) {
    const m = S.ex && S.ex.metric;
    if (v == null) return '—';
    if (m === 'footAngle') { const d = Math.round(v - 90); return d >= 0 ? `${d}° down` : `${-d}° up`; }
    return `${Math.round(v)}°`;
  }

  function openSession(opts = {}) {
    const rs = GF.store.rehab(), plan = rs.plan;
    let list = R.routine(plan).list;
    if (opts.measure) {
      const e = list.find(x => x.rom && x.rom[opts.measure]);
      if (!e) { toast('That measurement isn’t part of your current stage'); return; }
      list = [e];
    }
    if (opts.only) list = [R.get(opts.only)].filter(Boolean);
    if (!list.length) { toast('No exercises to do yet — tap “Change plan” to add some'); return; }
    if (S) closeSession();
    const root = document.getElementById('session-root');
    root.innerHTML = `
      <div class="session rehab-ses" role="dialog" aria-modal="true" aria-label="Rehab session">
        <header class="ses-top"><div class="title">${opts.measure ? `Measuring your ${plan.side === 'L' ? 'right' : 'left'} (healthy) side` : `${esc(planTitle(plan).replace(/^./, c => c.toUpperCase()))} · Stage ${plan.stage}`}</div>
          <div class="ses-progress" data-prog></div>${opts.demo ? '<span class="chip accent">Demo</span>' : ''}<button class="btn sm" data-r="end" aria-label="Exit session">${icon('x')}Exit</button></header>
        <div class="ses-main">
          <div class="stage">
            <video playsinline muted aria-hidden="true"></video>
            <canvas class="overlay" aria-hidden="true"></canvas>
            <div class="flash" aria-hidden="true"></div>
            <div class="stage-center" data-center></div>
            <div class="stage-msg" data-msg role="status"></div>
          </div>
          <aside class="ses-panel" data-panel></aside>
        </div>
      </div>`;
    const el = root.querySelector('.rehab-ses');
    S = {
      plan, list, i: 0, set: 1, phase: opts.measure ? 'intro' : 'pain', demo: !!opts.demo, measure: opts.measure || null,
      side: opts.measure ? (plan.side === 'L' ? 'R' : 'L') : plan.side,
      cam: false, gentle: false, painBefore: opts.measure ? null : null, painAfter: null,
      results: {}, v: null, vis: false, rep: { st: 'rest', peak: null }, count: 0, mn: null, mx: null, holdT: 0, timeT: 0, restT: 0,
      el: { root: el, video: el.querySelector('video'), canvas: el.querySelector('canvas.overlay'), center: el.querySelector('[data-center]'), panel: el.querySelector('[data-panel]'), msg: el.querySelector('[data-msg]'), flash: el.querySelector('.flash'), prog: el.querySelector('[data-prog]') },
      last: performance.now(), raf: 0, msgUntil: 0, simT0: 0,
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.querySelector('.modal-backdrop')) endSession();
      if (e.code === 'Space' && S && S.phase === 'work' && !e.target.closest('input, textarea, select, button')) { e.preventDefault(); S.el.panel.querySelector('[data-r="pause"]').click(); }
    });
    renderPhase();
    S.raf = requestAnimationFrame(loop);
  }

  function closeSession() {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    if (S.cam) GF.pose.stop('rehab');
    document.getElementById('session-root').innerHTML = '';
    S = null;
  }
  /** Exit is always possible: save what was done, leave without saving, or keep going. */
  async function endSession() {
    if (!S) return;
    const any = Object.values(S.results).some(r => !r.skipped);
    if (S.phase === 'stopped' || !any || S.measure || S.demo) { closeSession(); GF.rerender(); return; }
    if (S.exiting) return;
    S.exiting = true;
    const choice = await new Promise(res => GF.u.modal({
      title: 'Leave this session?', body: '<p>You can save what you’ve done so far, or leave without saving.</p>',
      actions: [{ label: 'Keep going', value: 'stay' }, { label: 'Exit without saving', value: 'discard', kind: 'danger' }, { label: 'Save & exit', value: 'save', kind: 'primary' }],
      onClose: v => res(v || 'stay'),
    }));
    if (!S) return;
    S.exiting = false;
    if (choice === 'discard') { closeSession(); GF.rerender(); return; }
    if (choice === 'save') { if (S.painAfter == null) S.painAfter = S.painBefore; S.advice = advise(S.plan, S.painBefore, S.painAfter); saveSession(); }
  }

  function dose() { return R.dose(S.ex, S.plan, S.gentle); }
  function limb() { return R.AREAS[S.plan.area].limb; }
  function limbText(cap) {
    const L = limb(), w = L === 'body' ? 'body' : `${S.side === 'L' ? 'left' : 'right'} ${L}`;
    return cap ? w.replace(/^./, c => c.toUpperCase()) : w;
  }
  function camHint(e) {
    if (e.view === 'front') return 'Face the camera. Step back so your whole body is in view.';
    return limb() === 'body' ? 'Turn side-on to the camera, whole body in view.' : `Turn side-on, ${S.side === 'L' ? 'left' : 'right'} ${limb()} nearest the camera.`;
  }
  function curLimit() { const e = S.ex; return (e.injuryLimit && e.injuryLimit[S.plan.injury]) || e.limit || null; }
  function progressBar() {
    S.el.prog.innerHTML = S.list.map((e, k) => `<i class="${k < S.i ? 'done' : k === S.i && ['intro', 'work', 'rest'].includes(S.phase) ? 'now' : ''}"></i>`).join('');
  }

  /* ---------- phase screens ---------- */
  function renderPhase() {
    if (!S) return;
    S.ex = S.list[S.i];
    progressBar();
    const c = S.el.center;
    c.hidden = false;
    if (S.phase === 'pain' || S.phase === 'painAfter') {
      const after = S.phase === 'painAfter';
      c.innerHTML = `<div class="ov-card">
        <div class="ov-mascot">${art.ghost(70, after ? 'happy' : 'focus')}</div>
        <h2>${after ? 'How does it feel now?' : 'How much does it hurt right now?'}</h2>
        <p>0 = no pain · 10 = worst pain</p>
        <div class="pain-scale" role="group" aria-label="Pain from 0 to 10">${Array.from({ length: 11 }, (_, n) => `<button data-pain="${n}" aria-label="Pain ${n}">${art.painFace(n, 34)}<span>${n}</span></button>`).join('')}</div>
        ${after ? `<div class="row center"><button class="btn ghost-light" data-r="painskip">Skip</button></div>` : ''}
      </div>`;
      panelInfo(after ? 'Almost done' : 'Pain check', after ? 'Rate your pain after the exercises.' : 'We adjust today’s session to how you feel.');
      focusFirst(); return;
    }
    if (S.phase === 'stopped') {
      c.innerHTML = `<div class="ov-card"><div class="ov-mascot">${art.ghost(70)}</div><h2>Let’s rest today</h2>
        <p>Pain that high is your body asking for rest. Ice, elevate and keep it comfortable. If it stays this high, or you notice any warning signs, contact your doctor or physio.</p>
        ${redFlags(true, S.plan.area)}
        <div class="row center"><button class="btn primary lg" data-r="close">OK</button></div></div>`;
      panelInfo('Session skipped', 'Nothing to do today — resting is part of recovery.');
      focusFirst(); return;
    }
    if (S.phase === 'intro') {
      const e = S.ex, d = dose();
      c.innerHTML = `<div class="ov-card wide-intro">
        <div class="intro-grid">
          <div class="intro-fig"><canvas data-fig="${e.id}" aria-hidden="true"></canvas></div>
          <div class="intro-txt">
            <span class="eyebrow">${S.measure ? 'Measurement' : `Exercise ${S.i + 1} of ${S.list.length}`}</span>
            <h2>${esc(e.name)}</h2>
            <span class="pill">${icon('target')}${esc(e.pos)}</span>
            <ol class="mini-steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
            <p class="dose">${S.measure ? '3 slow reps, as far as is comfortable' : e.mode === 'reps' ? `${d.sets} × ${d.reps} reps` : e.mode === 'hold' ? `${d.sets} holds × ${d.hold} s` : `${d.time} seconds`}</p>
            ${e.metric && !S.demo ? `<p class="small cam-hint">${icon('cam')} ${camHint(e)}</p>` : ''}
          </div>
        </div>
        <div class="row center">
          ${e.metric && !S.cam && !S.demo ? `<button class="btn primary lg" data-r="cam-start">${icon('cam')}Use camera &amp; start</button><button class="btn ghost-light" data-r="go">Start without camera</button>`
            : `<button class="btn primary lg" data-r="go">${icon('play')}Start</button>`}
          ${S.measure ? '' : `<button class="btn ghost-light" data-r="skip">Skip</button>`}
        </div></div>`;
      art.animateFigures(c, 0, art.DARK);
      panelInfo(e.name, e.short);
      focusFirst(); return;
    }
    if (S.phase === 'rest') {
      c.innerHTML = `<div class="ov-card compact"><h2>Rest</h2><p class="rest-n" data-restn>${Math.ceil(S.restT)}</p><div class="row center"><button class="btn primary" data-r="restskip">Next ${icon('right')}</button></div></div>`;
      return;
    }
    if (S.phase === 'work') { c.innerHTML = ''; c.hidden = true; renderWorkPanel(); return; }
    if (S.phase === 'summary') { renderSummary(); }
  }
  function focusFirst() { setTimeout(() => { const b = S && S.el.center.querySelector('.btn.primary, [data-pain]'); if (b) b.focus(); }, 30); }
  function panelInfo(title, sub) {
    S.el.panel.innerHTML = `<div class="ex-now"><div class="eyebrow">Rehab</div><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p></div>
      <div class="r-safe">${icon('shield')}<span>Gentle stretch or effort is OK. Sharp pain means stop.</span></div>`;
  }

  function gaugeSvg() {
    return `<svg class="r-gauge" viewBox="0 0 220 128" aria-hidden="true">
      <defs><linearGradient id="rgg" x1="0" x2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
      <path d="M20 112 A90 90 0 0 1 200 112" fill="none" style="stroke:var(--ring-track)" stroke-width="14" stroke-linecap="round"/>
      <path data-g-arc d="" fill="none" stroke="url(#rgg)" stroke-width="14" stroke-linecap="round"/>
      <line data-g-goal x1="0" y1="0" x2="0" y2="0" stroke="#f97316" stroke-width="4" stroke-linecap="round"/>
      <line data-g-best x1="0" y1="0" x2="0" y2="0" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
      <text x="110" y="100" text-anchor="middle" class="g-val" data-g-val>—</text>
    </svg>`;
  }
  function renderWorkPanel() {
    const e = S.ex, d = dose();
    const target = S.measure ? 3 : e.mode === 'reps' ? d.reps : e.mode === 'hold' ? d.hold : d.time;
    const lastBest = lastValue(e);
    S.el.panel.innerHTML = `
      <div class="ex-now"><div class="eyebrow">${S.measure ? 'Measurement' : `Set ${S.set} of ${d.sets}`}</div><h2>${esc(e.name)}</h2></div>
      <div class="counter"><span class="n" data-count>${e.mode === 'reps' ? S.count : Math.ceil(target - (e.mode === 'hold' ? S.holdT : S.timeT))}</span><span class="of">${e.mode === 'reps' ? `/ ${target} reps` : 'seconds'}</span></div>
      ${e.metric ? `<div class="r-gwrap">${gaugeSvg()}<div class="g-legend"><span><i class="lg-goal"></i>Target</span><span><i class="lg-best"></i>Best</span></div></div>
        <div class="r-best"><div><span>Best this set</span><b data-best>—</b></div><div><span>Last time</span><b>${lastBest != null ? show(lastBest) : '—'}</b></div></div>
        <div class="r-seen" data-seen>${S.cam || S.demo ? 'Looking for your leg…' : 'Camera off — tap +1 for each rep'}</div>` : `<div class="r-seen">Follow along — the timer runs on its own.</div>`}
      <div class="caption" data-cap></div>
      <div class="ses-controls">
        <button class="btn danger" data-r="pain">${icon('alert')}Pain — stop</button>
        <button class="btn ${S.paused ? 'on' : ''}" data-r="pause" aria-pressed="${!!S.paused}">${icon(S.paused ? 'play' : 'pause')}${S.paused ? 'Resume' : 'Pause'}</button>
        ${e.mode === 'reps' ? `<button class="btn" data-r="plus">${icon('plus')}+1 rep</button>` : ''}
        <button class="btn primary" data-r="setdone">${icon('check')}${e.mode === 'reps' ? 'Set done' : 'Done'}</button>
        ${e.metric && !S.demo ? `<button class="btn ${S.cam ? 'on' : ''}" data-r="cam">${icon(S.cam ? 'camOff' : 'cam')}${S.cam ? 'Camera off' : 'Camera'}</button>` : ''}
      </div>`;
    S.gauge = {
      arc: S.el.panel.querySelector('[data-g-arc]'), goal: S.el.panel.querySelector('[data-g-goal]'), best: S.el.panel.querySelector('[data-g-best]'), val: S.el.panel.querySelector('[data-g-val]'),
      count: S.el.panel.querySelector('[data-count]'), bestTxt: S.el.panel.querySelector('[data-best]'), seen: S.el.panel.querySelector('[data-seen]'), cap: S.el.panel.querySelector('[data-cap]'),
    };
    if (e.metric) { const g = e.mode === 'reps' ? e.reach : (e.holdOk && (e.holdOk.below != null ? e.holdOk.below : e.holdOk.above)); setTick(S.gauge.goal, g); }
  }
  // gauge helpers: value → angle along the half circle (180° → 0°)
  function gPos(v, r = 90) {
    const [lo, hi] = (R.METRICS[S.ex.metric] || {}).range || [0, 180];
    const f = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    const a = Math.PI * (1 - f);
    return { x: 110 + Math.cos(a) * r, y: 112 - Math.sin(a) * r, f };
  }
  function setTick(line, v) { if (!line || v == null) return; const a = gPos(v, 78), b = gPos(v, 102); line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y); }
  function updateGauge() {
    const g = S.gauge; if (!g || !g.arc) return;
    if (S.v == null || !S.vis) { g.arc.setAttribute('d', ''); g.val.textContent = '—'; return; }
    const p = gPos(S.v);
    g.arc.setAttribute('d', p.f > 0.002 ? `M20 112 A90 90 0 0 1 ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : '');
    g.val.textContent = show(S.v);
    const best = bestOfSet();
    if (best != null) { setTick(g.best, best); g.bestTxt.textContent = show(best); }
  }
  function bestOfSet() {
    const e = S.ex; if (!e.metric) return null;
    const how = e.rom ? Object.values(e.rom)[0] : null;
    if (how) return how === 'min' || how === 'up' ? S.mn : S.mx;
    const up = e.mode === 'reps' ? e.reach > e.restAt : !(e.holdOk && e.holdOk.below != null);
    return up ? S.mx : S.mn;
  }
  function lastValue(e) {
    const log = GF.store.rehab().log; if (!e.metric) return null;
    for (let k = log.length - 1; k >= 0; k--) { const r = (log[k].results || []).find(x => x.id === e.id && x.best != null); if (r) return r.best; }
    return null;
  }

  /* ---------- per-frame loop ---------- */
  function loop(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(loop);
    try { loopBody(now); } catch (err) { GF.crash(err, 'rehab loop'); }
  }
  function loopBody(now) {
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
    const cv = S.el.canvas, video = S.el.video;
    let W = 1280, H = 720, lms = null;
    if (S.cam && video.videoWidth) { W = video.videoWidth; H = video.videoHeight; }
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (S.cam && GF.pose.landmarker) { try { lms = GF.pose.detect(video); } catch (err) { lms = null; } }
    else if (S.demo && S.ex && S.ex.metric && ['intro', 'work', 'rest'].includes(S.phase)) lms = simFrame(W, H, now);
    S.lms = lms;
    measure(W, H);
    if (S.phase === 'work' && !S.paused) work(dt);
    else if (S.phase === 'rest') { S.restT -= dt; const n = S.el.center.querySelector('[data-restn]'); if (n) n.textContent = Math.max(0, Math.ceil(S.restT)); if (S.restT <= 0) { S.phase = 'intro'; S.rep = { st: 'rest', peak: null }; nextSetOrExercise(true); } }
    draw(W, H);
    if (S.phase === 'work') updateGauge();
    if (S.msgUntil && now > S.msgUntil) { S.el.msg.textContent = ''; S.el.msg.className = 'stage-msg'; S.msgUntil = 0; }
  }

  function measure(W, H) {
    const e = S.ex;
    if (!e || !e.metric || !S.lms) { S.vis = false; return; }
    const M = R.METRICS[e.metric];
    const need = M.need.concat(e.check ? R.METRICS[e.check.metric].need : []);
    const p = R.points(S.lms, S.side, W, H, need);
    S.pts = p;
    if (!p) { S.vis = false; return; }
    const raw = M.fn(p);
    S.v = S.v == null || !S.vis ? raw : S.v + (raw - S.v) * 0.4;
    S.vis = true;
    S.checkV = e.check ? R.METRICS[e.check.metric].fn(p) : null;
  }

  function work(dt) {
    const e = S.ex, d = dose(), g = S.gauge || {};
    const tracking = !!(e.metric && (S.cam || S.demo));
    if (g.seen && tracking) g.seen.innerHTML = S.vis ? `<span class="ok">${icon('check')} ${limbText(true)} tracked</span>` : `<span class="no">${icon('eye')} Can’t see your ${limbText(false)} — ${S.ex.view === 'front' ? 'face the camera' : 'turn side-on'}</span>`;
    if (S.vis && S.v != null) { S.mn = S.mn == null ? S.v : Math.min(S.mn, S.v); S.mx = S.mx == null ? S.v : Math.max(S.mx, S.v); }

    if (e.mode === 'reps') {
      if (tracking && S.vis) {
        const up = e.reach > e.restAt, s = v => (up ? v : -v);
        if (S.rep.st === 'rest' && s(S.v) >= s(e.reach)) { S.rep = { st: 'reach', peak: S.v }; }
        else if (S.rep.st === 'reach') {
          S.rep.peak = up ? Math.max(S.rep.peak, S.v) : Math.min(S.rep.peak, S.v);
          if (s(S.v) <= s(e.restAt)) { S.rep.st = 'rest'; addRep(S.rep.peak); }
        }
        if (curLimit() && S.v > curLimit().above) msg(curLimit().msg, 'warn');
        else if (e.check && S.checkV != null && S.checkV > e.check.above) msg(e.check.msg, 'warn');
      }
      if (S.demo && !e.metric) {   // demo athlete "taps" a rep each movement cycle
        const k = Math.floor(((performance.now() - S.simT0) / 1000 - 0.5) / (e.ghost.cycle || 3));
        if (k > S.count) addRep(null);
      }
      const target = S.measure ? 3 : d.reps;
      if (S.count >= target) finishSet();
    } else if (e.mode === 'hold') {
      let ok = true;
      if (tracking) {
        if (!S.vis) ok = false;
        else if (e.holdOk) ok = e.holdOk.below != null ? S.v < e.holdOk.below : S.v > e.holdOk.above;
        if (S.vis && !ok) msg(e.holdOk.msg, 'warn');
      }
      if (ok) S.holdT += dt;
      if (g.count) g.count.textContent = Math.max(0, Math.ceil(d.hold - S.holdT));
      if (g.cap) g.cap.textContent = ok ? 'Hold it… breathe' : (tracking && !S.vis ? 'Timer paused — I can’t see your leg' : 'Timer paused');
      if (S.holdT >= d.hold) finishSet();
    } else {
      S.timeT += dt;
      if (g.count) g.count.textContent = Math.max(0, Math.ceil(d.time - S.timeT));
      if (S.timeT >= d.time) finishSet();
    }
  }
  function msg(text, cls) { if (S.el.msg.textContent !== text) { S.el.msg.textContent = text; S.el.msg.className = 'stage-msg ' + (cls || ''); if (cls === 'warn') say(text); } S.msgUntil = performance.now() + 1500; }
  function flash(t, cls) { const f = S.el.flash; f.textContent = t; f.className = 'flash'; void f.offsetWidth; f.className = 'flash show ' + cls; }

  function addRep(peak) {
    S.count++;
    if (peak != null) { (S.peaks = S.peaks || []).push(peak); }
    if (S.gauge && S.gauge.count) S.gauge.count.textContent = S.count;
    flash('+1', 'ok');
    say(String(S.count));
  }

  function res() { return (S.results[S.ex.id] = S.results[S.ex.id] || { id: S.ex.id, name: S.ex.name, reps: 0, sets: 0, holdSec: 0, mn: null, mx: null }); }
  function finishSet() {
    const r = res(), e = S.ex;
    r.sets++; r.reps += S.count; r.holdSec += Math.round(S.holdT);
    if (S.mn != null) r.mn = r.mn == null ? S.mn : Math.min(r.mn, S.mn);
    if (S.mx != null) r.mx = r.mx == null ? S.mx : Math.max(r.mx, S.mx);
    const d = dose();
    S.count = 0; S.holdT = 0; S.timeT = 0; S.mn = null; S.mx = null; S.peaks = []; S.rep = { st: 'rest', peak: null };
    flash(e.mode === 'reps' ? 'Set done' : 'Done', 'ok');
    const more = !S.measure && S.set < d.sets;
    if (more) { S.set++; S.phase = 'rest'; S.restT = e.rest || 20; say('Rest'); renderPhase(); return; }
    S.i++; S.set = 1;
    if (S.i >= S.list.length) { S.phase = S.measure ? 'summary' : 'painAfter'; renderPhase(); return; }
    S.phase = 'intro'; renderPhase();
  }
  function nextSetOrExercise() {
    // after a rest: same exercise → straight back to work; new exercise → its intro
    const r = S.results[S.ex.id];
    if (r && S.set > 1) { startWork(); return; }
    renderPhase();
  }
  function startWork() { S.phase = 'work'; S.paused = false; S.count = 0; S.holdT = 0; S.timeT = 0; S.mn = null; S.mx = null; S.v = null; S.simT0 = performance.now(); renderPhase(); say(S.ex.name); }

  /* ---------- demo athlete ---------- */
  function simFrame(W, H, now) {
    const e = S.ex;
    let eAmt = 0;
    if (S.phase === 'work') {
      if (e.type === 'hold' || e.mode === 'hold') eAmt = 1;
      else {
        const t = (now - S.simT0) / 1000 - 0.5, cyc = e.ghost.cycle;
        if (t > 0) { const k = Math.floor(t / cyc), amp = [0.9, 1, 0.95, 1, 0.86][k % 5]; eAmt = ghost.repProfile((t % cyc) / cyc) * amp; }
      }
    }
    const sim = R.simLandmarks(e, eAmt, W, H);
    S.simP = sim.P; S.simT = sim.T;
    let lm = sim.lm.map(p => ({ ...p, x: p.x + (Math.random() - 0.5) * 0.002, y: p.y + (Math.random() - 0.5) * 0.002 }));
    if (S.side === 'R') { lm = lm.slice(); for (const [a, b] of SWAP) { const t = lm[a]; lm[a] = lm[b]; lm[b] = t; } }
    return lm;
  }

  /* ---------- drawing ---------- */
  function draw(W, H) {
    const ctx = S.el.canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (S.demo && S.simP && S.ex && S.ex.metric) ghost.draw(ctx, S.simP, S.simT, { color: '#5eead4', glowColor: 'rgba(94,234,212,.6)', alpha: 0.28, glow: true });
    const lms = S.lms; if (!lms) return;
    const lw = Math.max(3, H * 0.006);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = lw;
    for (const [a, b] of CONN) { const p = lms[a], q = lms[b]; if (!p || !q || (p.visibility || 0) < 0.5 || (q.visibility || 0) < 0.5) continue; ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(q.x * W, q.y * H); ctx.stroke(); }
    const p = S.pts; if (!p || !S.vis || !S.ex || !S.ex.metric) return;
    // the injured leg, highlighted
    const chain = (CHAIN[limb()] || CHAIN.leg).map(n => (n === 'shoulder' && limb() === 'body' && S.ex.view === 'front' ? p.shoulderC : n === 'hip' && limb() === 'body' && S.ex.view === 'front' ? p.hipC : p[n])).filter(q => q && (q.v == null || q.v >= 0.5));
    const zone = S.rep.st === 'reach' ? '#22c55e' : (curLimit() && S.v > curLimit().above) ? '#f59e0b' : '#2dd4bf';
    ctx.save(); ctx.shadowColor = zone; ctx.shadowBlur = lw * 4; ctx.strokeStyle = zone; ctx.lineWidth = lw * 2.4;
    ctx.beginPath(); chain.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    ctx.fillStyle = '#fff'; chain.forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, lw * 1.8, 0, 7); ctx.fill(); });
    ctx.restore();
    // angle arc at the measured joint
    const m = S.ex.metric, j = p[R.METRICS[m].joint];
    if (!j) return;
    let a1, a2;
    const dir = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
    if (m === 'kneeFlex') { a1 = dir(p.knee, { x: 2 * p.knee.x - p.hip.x, y: 2 * p.knee.y - p.hip.y }); a2 = dir(p.knee, p.ankle); }
    else if (m === 'footAngle') { a1 = dir(p.ankle, p.knee); a2 = Math.atan2(p.toe.y - p.heel.y, p.toe.x - p.heel.x); }
    else if (m === 'shinTilt') { a1 = -Math.PI / 2; a2 = dir(p.ankle, p.knee); }
    else if (m === 'legOut') { a1 = Math.PI / 2; a2 = dir(p.hip, p.knee); }
    else if (m === 'hipLine') { a1 = dir(p.hip, p.shoulder); a2 = dir(p.hip, p.knee); }
    else if (m === 'armRaise') { a1 = dir(p.shoulder, p.hip); a2 = dir(p.shoulder, p.elbow); }
    else if (m === 'elbowFlex') { a1 = dir(p.elbow, { x: 2 * p.elbow.x - p.shoulder.x, y: 2 * p.elbow.y - p.shoulder.y }); a2 = dir(p.elbow, p.wrist); }
    else if (m === 'wristBend') { a1 = dir(p.wrist, { x: 2 * p.wrist.x - p.elbow.x, y: 2 * p.wrist.y - p.elbow.y }); a2 = dir(p.wrist, p.index); }
    else if (m === 'trunkLean') { a1 = -Math.PI / 2; a2 = dir(p.hip, p.shoulder); }
    else if (m === 'trunkSide') { a1 = -Math.PI / 2; a2 = dir(p.hipC, p.shoulderC); }
    else if (m === 'neckFlex') { a1 = dir(p.shoulder, { x: 2 * p.shoulder.x - p.hip.x, y: 2 * p.shoulder.y - p.hip.y }); a2 = dir(p.shoulder, p.nose); }
    else { a1 = dir(p.hip, { x: 2 * p.hip.x - p.shoulder.x, y: 2 * p.hip.y - p.shoulder.y }); a2 = dir(p.hip, p.knee); }
    let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const r = H * 0.09;
    ctx.save();
    ctx.fillStyle = 'rgba(249,115,22,.22)'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(j.x, j.y); ctx.arc(j.x, j.y, r, a1, a1 + da, da < 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(j.x, j.y, r, a1, a1 + da, da < 0); ctx.stroke();
    // label (the canvas is mirrored by CSS, so un-mirror the text)
    const txt = show(S.v), fs = Math.round(H * 0.05);
    ctx.translate(j.x + r * 0.9, j.y - r * 1.1); ctx.scale(-1, 1);
    ctx.font = `800 ${fs}px Inter, Segoe UI, system-ui, sans-serif`;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(8,22,24,.82)'; roundRect(ctx, -tw / 2 - fs * 0.4, -fs * 0.95, tw + fs * 0.8, fs * 1.35, fs * 0.35); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* ---------- camera ---------- */
  async function camOn() {
    try {
      await GF.pose.start(S.el.video, { userAction: true, deviceId: GF.store.settings.cameraId || undefined });
      S.cam = true;
      if (!GF.pose.landmarker) {
        S.el.msg.textContent = 'Loading the AI model…'; S.el.msg.className = 'stage-msg';
        GF.pose.load().then(() => { if (S) { S.el.msg.textContent = ''; } }).catch(() => { if (S) msg('AI model couldn’t load — tap +1 for each rep instead', 'warn'); toast('The AI model could not download. You can still log reps by tapping.', 'error'); });
      }
      return true;
    } catch (err) {
      toast(err && err.name === 'NotAllowedError' ? 'Camera blocked — allow it in the address bar, or continue without it.' : 'Camera unavailable: ' + (err.message || err.name), 'error');
      return false;
    }
  }

  /* ---------- clicks ---------- */
  async function onClick(ev) {
    if (!S) return;
    const p = ev.target.closest('[data-pain]');
    if (p) {
      const n = +p.dataset.pain;
      if (S.phase === 'pain') {
        S.painBefore = n;
        if (n >= 7) { S.phase = 'stopped'; renderPhase(); return; }
        S.gentle = n >= 4;
        if (S.gentle) toast('Gentle day — fewer reps today');
        S.phase = 'intro'; renderPhase(); return;
      }
      if (S.phase === 'painAfter') { S.painAfter = n; S.phase = 'summary'; renderPhase(); return; }
    }
    const b = ev.target.closest('[data-r]'); if (!b) return;
    const a = b.dataset.r;
    if (a === 'end') return endSession();
    if (a === 'painskip') { S.painAfter = null; S.phase = 'summary'; renderPhase(); return; }
    if (a === 'discard') { closeSession(); GF.rerender(); return; }
    if (a === 'close') { closeSession(); GF.rerender(); return; }
    if (a === 'cam-start') { b.disabled = true; await camOn(); if (S) startWork(); return; }
    if (a === 'go') return startWork();
    if (a === 'skip') { (S.results[S.ex.id] = S.results[S.ex.id] || { id: S.ex.id, name: S.ex.name, reps: 0, sets: 0, holdSec: 0, skipped: true }); S.i++; S.set = 1; if (S.i >= S.list.length) { S.phase = 'painAfter'; } renderPhase(); return; }
    if (a === 'restskip') { S.restT = 0; return; }
    if (a === 'plus') { addRep(null); return; }
    if (a === 'pause') { S.paused = !S.paused; if (!S.paused) S.simT0 = performance.now() - (S.count + 0.2) * ((S.ex.ghost && S.ex.ghost.cycle) || 3) * 1000; msg(S.paused ? 'Paused' : 'Go!', ''); renderWorkPanel(); const pb = S.el.panel.querySelector('[data-r="pause"]'); if (pb) pb.focus(); return; }
    if (a === 'setdone') { finishSet(); return; }
    if (a === 'cam') { if (S.cam) { GF.pose.stop('user'); S.cam = false; S.lms = null; S.vis = false; } else await camOn(); if (S) renderWorkPanel(); return; }
    if (a === 'pain') {
      const r = res(); r.painStop = true;
      const sharp = await new Promise(resolve => GF.u.modal({ title: 'Stopped — what kind of pain?', body: `<p>Achy or tired muscles are normal. Sharp, stabbing or worrying pain means stop for today.</p>`, actions: [{ label: 'Achy — skip this exercise', value: 0 }, { label: 'Sharp — end the session', kind: 'danger', value: 1 }], onClose: v => resolve(v) }));
      if (!S) return;
      if (sharp === 1) { S.phase = 'painAfter'; renderPhase(); return; }
      S.count = 0; S.holdT = 0; S.timeT = 0; S.i++; S.set = 1;
      S.phase = S.i >= S.list.length ? 'painAfter' : 'intro'; renderPhase(); return;
    }
    if (a === 'save') { saveSession(); return; }
  }

  /* ---------- summary & saving ---------- */
  function sessionRom() {
    const rom = {};
    for (const r of Object.values(S.results)) {
      const e = R.get(r.id); if (!e || !e.rom) continue;
      const v = R.romFrom(e, r.mn, r.mx);
      for (const [k, val] of Object.entries(v)) if (rom[k] == null || R.better(k, val, rom[k])) rom[k] = val;
    }
    return rom;
  }
  function renderSummary() {
    const rom = sessionRom(), rs = GF.store.rehab(), plan = S.plan;
    const prev = {};
    rs.log.filter(l => l.area === plan.area && l.side === plan.side).forEach(l => Object.entries(l.rom || {}).forEach(([k, v]) => { if (prev[k] == null || R.better(k, v, prev[k])) prev[k] = v; }));
    const done = Object.values(S.results).filter(r => !r.skipped);
    const c = S.el.center; c.hidden = false;
    const adv = S.measure ? null : advise(plan, S.painBefore, S.painAfter);
    S.advice = adv;
    c.innerHTML = `<div class="ov-card wide">
      <div class="ov-mascot">${art.ghost(72, 'wink')}</div>
      <h2>${S.measure ? 'Measured!' : 'Session complete'}</h2>
      ${Object.keys(rom).length ? `<div class="sum-rom">${Object.entries(rom).map(([k, v]) => {
        const p0 = prev[k], up = p0 != null && R.better(k, v, p0) && v !== p0;
        return `<div>${art.ring(R.romPct(k, v), v + '°', k === 'kneeStraight' ? 'from straight' : R.ROM[k].short, 96)}${!S.measure && p0 != null ? `<span class="delta ${up ? 'up' : ''}">${up ? `▲ ${Math.abs(v - p0)}° best ever` : `best ${romVal(k, p0)}`}</span>` : ''}</div>`;
      }).join('')}</div>` : `<p>${done.length} exercise${done.length === 1 ? '' : 's'} done. Use the camera next time to measure your range.</p>`}
      ${S.measure ? `<p>This is your healthy side — we’ll compare your injured side to it.</p>` : `
        ${S.painAfter != null ? `<div class="pain-sum">${art.painFace(S.painBefore, 34)}<span>${icon('right')}</span>${art.painFace(S.painAfter, 34)}<span class="small">Pain ${S.painBefore} → ${S.painAfter}</span></div>` : ''}
        ${adv ? `<p class="adv-line ${adv.kind}">${esc(adv.text)}</p>` : ''}`}
      ${S.demo ? '<p class="small" style="opacity:.75">Demo — not saved.</p>' : ''}
      <div class="sum-body">${GF.bodymap.render(Object.values(S.results).filter(r => !r.skipped && r.sets).reduce((m, r) => GF.bodymap.add(m, (R.get(r.id) || {}).muscles, r.sets), {}), { compact: true, title: 'Muscles you worked', empty: 'No exercises finished.' })}</div>
      <div class="row center"><button class="btn primary lg" data-r="save">${S.demo ? 'Finish' : 'Save & finish'}</button>${S.demo ? '' : `<button class="btn ghost-light" data-r="discard">Exit without saving</button>`}</div>
    </div>`;
    GF.fx.enhance(c);
    const improved = Object.entries(rom).filter(([k, v]) => prev[k] != null && R.better(k, v, prev[k]) && v !== prev[k]);
    if (!S.demo && !S.measure && improved.length) GF.fx.celebrate(`New best range: ${R.ROM[improved[0][0]].label} ${romVal(improved[0][0], improved[0][1])}!`);
    else if (!S.demo && !S.measure && done.length) GF.fx.confetti({ count: 60 });
    panelInfo('Nice work', S.measure ? 'Measurement saved.' : 'Recovery is built one session at a time.');
    focusFirst();
  }
  function advise(plan, before, after) {
    if (after == null) return null;
    if (after >= 7 || after - before >= 3) return { kind: 'easier', title: 'We’ve made it gentler', text: 'Pain went up a lot, so next time has fewer reps. If pain lasts more than a couple of hours, or swelling increases, contact your physio.' };
    if (after - before >= 2 || after >= 5) return { kind: 'easier', title: 'Take it steady', text: 'A little sore is OK. Keep the same level next time and see how it settles by tomorrow.' };
    return { kind: 'good', title: 'Pain stayed under control', text: 'Great — keep going. As long as pain stays low, we’ll slowly build the reps back up.' };
  }
  function saveSession() {
    const plan = S.plan;
    if (!S.demo) {
      const rom = sessionRom();
      if (S.measure) { for (const [k, v] of Object.entries(rom)) GF.store.setRehabBaseline(k + plan.side, v); toast(Object.keys(rom).length ? 'Healthy side saved' : 'Nothing measured — the camera needs to see your leg'); }
      else {
        const results = Object.values(S.results).map(r => {
          const e = R.get(r.id);
          const how = e && e.rom ? Object.values(e.rom)[0] : null;
          const b = e && e.metric ? (how === 'min' || how === 'up' ? r.mn : r.mx) : null;
          return { id: r.id, reps: r.reps, sets: r.sets, holdSec: r.holdSec, skipped: !!r.skipped, painStop: !!r.painStop, best: b != null ? Math.round(b) : null };
        });
        GF.store.addRehabLog({ area: plan.area, side: plan.side, stage: plan.stage, gentle: S.gentle, painBefore: S.painBefore, painAfter: S.painAfter, rom, results });
        const adv = S.advice, patch = { advice: adv };
        if (adv && adv.kind === 'easier' && adv.title.startsWith('We')) patch.volume = Math.max(0.5, Math.round((plan.volume || 1) * 0.75 * 100) / 100);
        if (adv && adv.kind === 'good') {
          patch.volume = Math.min(1, Math.round(((plan.volume || 1) + 0.1) * 100) / 100);
          const recent = GF.store.rehab().log.filter(l => l.area === plan.area && l.side === plan.side && l.stage === plan.stage).slice(-3);
          if (plan.stage < 3 && recent.length >= 3 && recent.every(l => l.painAfter <= 3)) patch.suggestStage = plan.stage + 1;
        }
        GF.store.setRehabPlan(patch);
        toast('Session saved');
      }
    }
    closeSession(); GF.rerender();
  }

  /* ======================= report for a physio / doctor ======================= */
  function lineChart(series, opt) {
    const W = 640, H = 190, L = 40, Rr = 12, T = 14, B = 28;
    const n = Math.max(2, ...series.map(s => (s.values ? s.values.length : 0)));
    const lo = opt.min, hi = opt.max, sx = i => L + (n === 1 ? 0 : i / (n - 1)) * (W - L - Rr), sy = v => T + (1 - (v - lo) / ((hi - lo) || 1)) * (H - T - B);
    const grid = [0, 0.25, 0.5, 0.75, 1].map(f => { const v = lo + (hi - lo) * f; return `<line x1="${L}" x2="${W - Rr}" y1="${sy(v)}" y2="${sy(v)}" class="rg"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${Math.round(v)}${opt.unit || ''}</text>`; }).join('');
    const lines = series.map(s => {
      if (s.flat != null) return `<line x1="${L}" x2="${W - Rr}" y1="${sy(s.flat)}" y2="${sy(s.flat)}" stroke="${s.color}" stroke-width="2" stroke-dasharray="6 5"/><text x="${W - Rr}" y="${sy(s.flat) - 5}" text-anchor="end" fill="${s.color}">${esc(s.name)}</text>`;
      const pts = s.values.map((v, i) => v == null ? null : [sx(i), sy(v)]).filter(Boolean);
      return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}"/>`).join('')}`;
    }).join('');
    const xl = (opt.labels || []).map((t, i) => (n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1) ? `<text x="${sx(i)}" y="${H - 8}" text-anchor="middle">${esc(t)}</text>` : '').join('');
    const legend = series.filter(s => s.flat == null).map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    return `<figure class="rp-chart"><figcaption>${esc(opt.title)}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title)}">${grid}${lines}${xl}</svg>${legend ? `<div class="rp-legend">${legend}</div>` : ''}</figure>`;
  }

  function renderReport(root) {
    const rs = GF.store.rehab(), plan = rs.plan;
    const log = rs.log.filter(l => l.area === plan.area && l.side === plan.side).sort((a, b) => a.at - b.at);
    const A = R.AREAS[plan.area], injury = (A.injuries.find(x => x[0] === plan.injury) || [, 'Not specified'])[1];
    const day = 864e5, first = log[0], last = log[log.length - 1];
    const spanDays = first ? Math.max(1, Math.round((last.at - first.at) / day) + 1) : 0;
    const perWeek = first ? (log.length / Math.max(1, spanDays / 7)).toFixed(1) : '0';
    const keys = Object.keys(R.ROM).filter(k => R.ROM[k].area === plan.area && log.some(l => l.rom && l.rom[k] != null));
    const fmt = (k, v) => v == null ? '—' : romVal(k, v);
    const dates = log.map(l => fmtDate(l.at, { month: 'short', day: 'numeric' }));
    const obs = [];
    keys.forEach(k => {
      const vals = log.map(l => l.rom[k]).filter(v => v != null);
      if (vals.length >= 2) {
        const d = vals[vals.length - 1] - vals[0], good = R.ROM[k].better === 'lower' ? d < 0 : d > 0;
        obs.push(`${R.ROM[k].label}: ${fmt(k, vals[0])} → ${fmt(k, vals[vals.length - 1])} (${good ? 'improved' : d === 0 ? 'no change' : 'reduced'} by ${Math.abs(d)}°) across ${vals.length} measured sessions.`);
      }
    });
    const pa = log.filter(l => l.painAfter != null && l.painBefore != null);
    if (pa.length) {
      const avg = a => (a.reduce((s, l) => s + l.painAfter, 0) / a.length).toFixed(1);
      obs.push(pa.length >= 4 ? `Average pain after exercise: ${avg(pa.slice(0, 3))}/10 in the first 3 sessions, ${avg(pa.slice(-3))}/10 in the last 3.` : `Average pain after exercise: ${avg(pa)}/10.`);
      const flares = pa.filter(l => l.painAfter - l.painBefore >= 3).length;
      if (flares) obs.push(`Pain rose by 3+ points during ${flares} session${flares > 1 ? 's' : ''}.`);
    }
    const stops = log.filter(l => (l.results || []).some(r => r.painStop)).length;
    if (stops) obs.push(`“Pain — stop” was used in ${stops} session${stops > 1 ? 's' : ''}.`);
    const gentle = log.filter(l => l.gentle).length;
    if (gentle) obs.push(`${gentle} session${gentle > 1 ? 's were' : ' was'} reduced to a gentle dose because pain was 4–6 beforehand.`);
    if (!obs.length) obs.push('Not enough sessions yet to show trends.');
    const programme = R.routine(plan).list;

    root.innerHTML = `
      <div class="rp-tools no-print">
        <a class="btn ghost" href="#/rehab">${icon('left')}Back to rehab</a>
        <button class="btn primary" data-print>${icon('download')}Print / Save as PDF</button>
      </div>
      <article class="report" aria-label="Rehab progress report">
        <header class="rp-head">
          <div class="rp-brand"><svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M16 3C9.4 3 5 8 5 14.5V28l3.6-3 3.6 3 3.8-3 3.8 3 3.6-3 3.6 3V14.5C27 8 22.6 3 16 3z" fill="#0f766e"/><circle cx="12" cy="14" r="2" fill="#fff"/><circle cx="20" cy="14" r="2" fill="#fff"/></svg><div><b>GhostFit</b><span>Rehab progress report</span></div></div>
          <div class="rp-date">Generated ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </header>

        <section class="rp-grid">
          <label class="rp-field"><span>Name</span><input type="text" data-rname value="${esc(plan.reportName || '')}" placeholder="Your name (optional)" aria-label="Your name"></label>
          <div class="rp-field"><span>Area</span><b>${esc(planTitle(plan).replace(/^./, c => c.toUpperCase()))}</b></div>
          <div class="rp-field"><span>Injury (self-reported)</span><b>${esc(injury)}</b></div>
          <div class="rp-field"><span>Current stage</span><b>${plan.stage} — ${R.STAGES[plan.stage].name}</b></div>
          <div class="rp-field"><span>Ability</span><b>${esc(R.wbInfo(plan.area, plan.wb)[0])}</b></div>
          <div class="rp-field"><span>Programme started</span><b>${fmtDate(plan.startedAt || (first && first.at) || Date.now(), { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>
          <div class="rp-field"><span>Sessions logged</span><b>${log.length}${first ? ` over ${spanDays} day${spanDays > 1 ? 's' : ''} (${perWeek}/week)` : ''}</b></div>
          <div class="rp-field"><span>Last session</span><b>${last ? fmtDate(last.at, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</b></div>
        </section>

        <section><h2>Range of motion</h2>
          ${keys.length ? `<table class="rp-table"><thead><tr><th>Measurement</th><th>First</th><th>Latest</th><th>Best</th><th>Typical normal</th><th>Other side</th><th>% of normal</th></tr></thead><tbody>
          ${keys.map(k => { const vals = log.map(l => l.rom[k]).filter(v => v != null); const best = vals.reduce((b, v) => R.better(k, v, b) ? v : b, null); const base = rs.baseline[k + plan.side];
            return `<tr><td>${R.ROM[k].label}</td><td>${fmt(k, vals[0])}</td><td>${fmt(k, vals[vals.length - 1])}</td><td>${fmt(k, best)}</td><td>${fmt(k, R.ROM[k].full)}</td><td>${base != null ? fmt(k, base) : '—'}</td><td>${Math.round(R.romPct(k, vals[vals.length - 1]) * 100)}%</td></tr>`; }).join('')}
          </tbody></table>
          <div class="rp-charts">${keys.map(k => { const r = R.ROM[k], vals = log.map(l => (l.rom || {})[k] != null ? l.rom[k] : null); const base = rs.baseline[k + plan.side];
            const all = vals.filter(v => v != null).concat([r.full, base].filter(v => v != null));
            return lineChart([{ name: r.label, color: '#0f766e', values: vals }, { name: 'Typical normal', color: '#94a3b8', flat: r.full }].concat(base != null ? [{ name: 'Other side', color: '#f97316', flat: base }] : []),
              { title: `${r.label} (degrees${r.better === 'lower' ? ' short of straight — lower is better' : ''})`, min: 0, max: Math.max(10, Math.ceil(Math.max(...all) / 10) * 10 + 10), unit: '°', labels: dates }); }).join('')}</div>`
          : '<p class="rp-muted">No camera measurements yet. Range of motion appears here after sessions with the camera on.</p>'}
        </section>

        <section><h2>Pain (0–10)</h2>
          ${pa.length ? lineChart([{ name: 'Before exercise', color: '#64748b', values: log.map(l => l.painBefore) }, { name: 'After exercise', color: '#dc2626', values: log.map(l => l.painAfter) }], { title: 'Pain before and after each session', min: 0, max: 10, labels: dates }) : '<p class="rp-muted">No pain ratings yet.</p>'}
        </section>

        <section><h2>Summary</h2><ul class="rp-obs">${obs.map(o => `<li>${esc(o)}</li>`).join('')}</ul></section>

        <section class="rp-break"><h2>Session log</h2>
          ${log.length ? `<table class="rp-table"><thead><tr><th>Date</th><th>Stage</th><th>Exercises</th><th>Reps / holds</th><th>Pain before → after</th><th>Measurements</th><th>Notes</th></tr></thead><tbody>
          ${log.slice(-25).reverse().map(l => { const res = (l.results || []).filter(r => !r.skipped); return `<tr><td>${fmtDate(l.at, { month: 'short', day: 'numeric' })}</td><td>${l.stage || '—'}</td><td>${res.length}</td><td>${res.reduce((a, r) => a + (r.reps || 0), 0)} reps${res.some(r => r.holdSec) ? ` · ${res.reduce((a, r) => a + (r.holdSec || 0), 0)} s held` : ''}</td><td>${l.painBefore ?? '—'} → ${l.painAfter ?? '—'}</td><td>${Object.entries(l.rom || {}).map(([k, v]) => `${R.ROM[k].short} ${fmt(k, v)}`).join(', ') || '—'}</td><td>${[l.gentle ? 'gentle dose' : '', (l.results || []).some(r => r.painStop) ? 'pain stop' : '', (l.results || []).some(r => r.skipped) ? 'skipped some' : ''].filter(Boolean).join(', ') || ''}</td></tr>`; }).join('')}
          </tbody></table>` : '<p class="rp-muted">No sessions yet.</p>'}
        </section>

        <section><h2>Current home programme</h2>
          <table class="rp-table"><thead><tr><th>Exercise</th><th>Position</th><th>Dose</th><th>Camera-measured</th></tr></thead><tbody>
          ${programme.map(e => { const d = R.dose(e, plan, false); return `<tr><td>${esc(e.name)}</td><td>${esc(e.pos)}</td><td>${e.mode === 'reps' ? `${d.sets} × ${d.reps} reps` : e.mode === 'hold' ? `${d.sets} × ${d.hold} s hold` : `${d.time} s`}</td><td>${e.metric ? 'Yes' : 'No'}</td></tr>`; }).join('')}
          </tbody></table>
        </section>

        <section class="rp-notes"><h2>Questions for my physio / doctor</h2><textarea data-rnotes rows="3" aria-label="Questions for my physio or doctor" placeholder="Write anything you want to ask…">${esc(plan.reportNotes || '')}</textarea>
          <h2>Clinician notes</h2><div class="rp-lines"><i></i><i></i><i></i><i></i></div></section>

        <footer class="rp-foot">Measurements are estimates from a single webcam using 2D body tracking (MediaPipe Pose) and can differ from a goniometer by several degrees, especially at the ankle, wrist and neck. Pain scores and injury details are self-reported. GhostFit is a home exercise guide and does not diagnose or treat; please interpret alongside clinical assessment.</footer>
      </article>`;
    root.addEventListener('click', e => { if (e.target.closest('[data-print]')) window.print(); });
    root.addEventListener('change', e => {
      if (e.target.matches('[data-rname]')) GF.store.setRehabPlan({ reportName: e.target.value.trim().slice(0, 80) });
      if (e.target.matches('[data-rnotes]')) GF.store.setRehabPlan({ reportNotes: e.target.value.slice(0, 1000) });
    });
  }

  /* ======================= view entry ======================= */
  function render(root, params) {
    const rs = GF.store.rehab();
    root.classList.add('rehab-page');
    if (rs.plan && params[0] === 'report') { renderReport(root); document.title = 'Rehab report — GhostFit'; return () => closeSession(); }
    if (!rs.plan || params[0] === 'setup') {
      if (params[0] === 'setup' && rs.plan && wiz.step === 1 && !wiz.d.area) { wiz.ok1 = wiz.ok2 = true; }
      renderSetup(root);
      root.addEventListener('change', e => { const ok = e.target.closest('[data-ok]'); if (ok) { wiz['ok' + ok.dataset.ok] = ok.checked; const n = root.querySelector('[data-wnext]'); if (n) n.disabled = !(wiz.ok1 && wiz.ok2); } });
      root.addEventListener('click', e => setupClick(root, e));
      return () => closeSession();
    }
    let stop = renderHome(root);
    const redraw = focusSel => {
      const y = window.scrollY;
      if (stop) stop(); stop = renderHome(root);
      window.scrollTo(0, y);
      if (focusSel) { const f = root.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
    };
    root.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('[data-p-close]')) { editing = false; redraw('[data-edit]'); return; }
      const pe = t.closest('[data-p-area],[data-p-side],[data-p-injury],[data-p-wb],[data-p-stage],[data-p-vol],[data-p-ex]');
      if (pe && editClick(root, t)) {
        const attr = [...pe.attributes].find(x => x.name.startsWith('data-p-'));
        redraw(`[${attr.name}="${attr.value}"]`);
        return;
      }
      if (t.closest('[data-edit]')) { editing = !editing; redraw(editing ? '#plan-edit [aria-pressed="true"]' : '[data-edit]'); if (editing) { const pe2 = root.querySelector('#plan-edit'); if (pe2) pe2.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
      if (t.closest('[data-start]')) return openSession({});
      if (t.closest('[data-demo]')) return openSession({ demo: true });
      const pv = t.closest('[data-preview]'); if (pv) return openSession({ only: pv.dataset.preview, demo: false });
      const m = t.closest('[data-measure]'); if (m) return openSession({ measure: m.dataset.measure });
      if (t.closest('[data-stageup]')) { const p = GF.store.rehab().plan; GF.store.setRehabPlan({ stage: p.suggestStage, suggestStage: null, advice: null, volume: 0.8 }); toast(`Stage ${p.suggestStage} — new exercises unlocked`); GF.rerender(); return; }
      if (t.closest('[data-stageno]')) { GF.store.setRehabPlan({ suggestStage: null }); GF.rerender(); return; }
      if (t.closest('[data-reset]') && await confirmDialog('Start over?', 'This deletes your rehab plan and measurements on this device.', 'Delete', true)) { GF.store.resetRehab(); wiz.step = 1; wiz.ok1 = wiz.ok2 = false; editing = false; GF.rerender(); }
    });
    return () => { closeSession(); if (stop) stop(); };
  }

  GF.views.rehab = { render, _state: () => S, _open: openSession, _sim: (W, H) => (S && S.ex && S.ex.metric ? simFrame(W, H, performance.now()) : null) };
})(window.GF = window.GF || {});
