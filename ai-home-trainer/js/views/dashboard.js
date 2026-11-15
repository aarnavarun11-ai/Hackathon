/* GhostFit – Home. Visual first: hero, today's stats, what the AI does, then the step-by-step start.
   Step 1 Focus → Step 2 Intensity → (workout screen) Step 3 Camera → Step 4 Go */
(function (GF) {
  'use strict';
  const { esc, icon, fmtMin, startOfWeek } = GF.u;
  GF.views = GF.views || {};
  const wk = GF.wk, art = GF.art;

  const FOCUS = [
    ['tpl_foundations', 'Full Body', 't1'],
    ['tpl_lower', 'Leg Day', 't2'],
    ['tpl_upper', 'Arm Day', 't3'],
    ['tpl_core', 'Core', 't4'],
    ['tpl_chair', 'Chair', 't5'],
    ['tpl_mobility', 'Stretch', 't6'],
  ];
  const INT_ART = { quick: 1, standard: 2, beast: 3 };
  const state = { step: 1, focus: null };

  function steps(n) {
    const names = ['Focus', 'Intensity', 'Camera', 'Go'];
    return `<ol class="stepper" aria-label="Steps">${names.map((t, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}" ${i + 1 === n ? 'aria-current="step"' : ''}><span>${i + 1 < n ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  }
  function figure(id) {
    const w = wk.find(id); const items = wk.allExerciseItems(w);
    const it = items.find(x => GF.lib.trackOf(GF.lib.get(x.exId)) && GF.lib.demoOf(GF.lib.get(x.exId))) || items.find(x => GF.lib.demoOf(GF.lib.get(x.exId))) || items[0];
    return it.exId;
  }
  function stats(history) {
    const day = 864e5, today = new Date(); today.setHours(0, 0, 0, 0);
    const mins = [], labels = [];
    for (let i = 6; i >= 0; i--) {
      const s = today.getTime() - i * day;
      mins.push(Math.round(history.filter(h => h.startedAt >= s && h.startedAt < s + day).reduce((a, h) => a + (h.durationSec || 0), 0) / 60));
      labels.push('SMTWTFS'[new Date(s).getDay()]);
    }
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const s = today.getTime() - i * day;
      if (history.some(h => h.completed && h.startedAt >= s && h.startedAt < s + day)) streak++;
      else if (i > 0) break;
    }
    let goodReps = 0;
    history.forEach(h => (h.sets || []).forEach(x => { if (x.source === 'camera' && x.counts) goodReps += x.counts.good || 0; }));
    return { mins, labels, streak, goodReps };
  }

  function render(root) {
    const s = GF.store.settings;
    const history = GF.store.history().slice().sort((a, b) => a.startedAt - b.startedAt);
    const mine = GF.store.workouts();
    const weekDone = history.filter(h => h.completed && h.startedAt >= startOfWeek()).length;
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    let stopAnim = () => { };
    root.classList.add('home');

    function draw() {
      stopAnim();
      if (state.step === 2 && state.focus) {
        const base = wk.find(state.focus);
        const f = FOCUS.find(x => x[0] === state.focus);
        root.innerHTML = `
          ${steps(2)}
          <header class="page-head step-head">
            <div class="step-badge ${f ? f[2] : 't1'}"><canvas data-fig="${figure(state.focus)}" aria-hidden="true"></canvas></div>
            <div><h1>How hard today?</h1><p>${esc(base.name)}</p></div>
          </header>
          <div class="choice-list">
            ${Object.entries(wk.INTENSITY).map(([k, L]) => { const w = wk.withIntensity(base, k); const n = wk.flatten(w).filter(x => x.kind === 'work').length; return `
              <button class="choice int-${k} ${k === (s.lastIntensity || 'standard') ? 'suggested' : ''}" data-int="${k}">
                ${art.flames(INT_ART[k])}
                <span class="choice-name">${L.name}</span>
                <span class="choice-sub">${L.sub}</span>
                <span class="choice-meta"><span class="pill">${icon('clock')}${fmtMin(wk.estimateSeconds(w))}</span><span class="pill">${n} sets</span></span>
              </button>`; }).join('')}
          </div>
          <div class="row" style="margin-top:20px"><button class="btn ghost" data-back>${icon('left')}Back</button></div>`;
        stopAnim = art.animateFigures(root);
        const first = root.querySelector('.choice.suggested'); if (first) first.focus();
        return;
      }
      const st = stats(history);
      const goal = s.weeklyGoal || 3;
      root.innerHTML = `
        <section class="hero glass">
          <div class="hero-copy">
            <span class="pill eyebrow-pill">${icon('sparkle')}AI home trainer</span>
            <h1>${greet}.<br><span class="grad-text">Let's move.</span></h1>
            <p class="lead">Your ghost coach watches your form and counts only the clean reps.</p>
            <div class="row">
              <button class="btn primary lg" data-jump>${icon('play')}Start a workout</button>
              <a class="btn glass-btn lg" href="#/workout/tpl_foundations/demo">${icon('eye')}See a demo</a>
            </div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="orb"></div><div class="orb-ring"></div>
            <canvas class="hero-fig" data-fig="squat"></canvas>
            <div class="float f1"><b class="okc">+1</b> clean rep</div>
            <div class="float f2"><i class="dot ok"></i>Knees tracked</div>
            <div class="float f3">${icon('mic')}“Pause”</div>
            <div class="hero-mascot">${art.ghost(92, 'wink')}</div>
          </div>
        </section>

        <section class="stat-strip" aria-label="Your week">
          <div class="glass stat-card">
            ${art.ring(weekDone / goal, `${weekDone}/${goal}`, 'this week', 104)}
            <div><div class="k">Weekly goal</div><div class="v">${weekDone >= goal ? 'Done!' : `${goal - weekDone} to go`}</div></div>
          </div>
          <div class="glass stat-card bars-card">
            <div><div class="k">Minutes · 7 days</div><div class="v"><span data-up="${st.mins.reduce((a, b) => a + b, 0)}">${st.mins.reduce((a, b) => a + b, 0)}</span><small> min</small></div></div>
            ${art.weekBars(st.mins, st.labels)}
          </div>
          <div class="glass stat-card">
            <div class="big-ic flame">${icon('flame')}</div>
            <div><div class="k">Streak</div><div class="v"><span data-up="${st.streak}">${st.streak}</span><small> day${st.streak === 1 ? '' : 's'}</small></div></div>
          </div>
          <div class="glass stat-card">
            <div class="big-ic okbg">${icon('check')}</div>
            <div><div class="k">Clean reps</div><div class="v" data-up="${st.goodReps}">${st.goodReps}</div></div>
          </div>
        </section>

        <section class="features" aria-label="What GhostFit does">
          ${[['joints', 'Sees your joints', 'Live skeleton, 33 points'],
             ['reps', 'Only good reps count', 'Bad form? Not counted'],
             ['voice', 'Hands-free', 'Say “pause”, “next”, “done”'],
             ['privacy', '100% on-device', 'No video ever leaves'],
          ].map(([k, t, d]) => `<div class="feature glass"><div class="feature-art">${art.feature(k)}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}
        </section>

        <section id="focus" class="focus-sec">
          <div class="sec-row"><h2 class="section-h">Pick your focus</h2>${steps(1)}</div>
          <div class="focus-list">
            ${FOCUS.map(([id, name, tone]) => { const w = wk.find(id); return `
              <button class="focus ${tone}" data-focus="${id}">
                <canvas data-fig="${figure(id)}" aria-hidden="true"></canvas>
                <span class="focus-name">${name}</span>
                <span class="focus-meta"><span class="pill">${icon('clock')}${fmtMin(wk.estimateSeconds(w))}</span><span class="go">${icon('right')}</span></span>
              </button>`; }).join('')}
          </div>
        </section>

        <a class="rehab-banner glass" href="#/rehab">
          <span class="rb-art" aria-hidden="true">${art.leg('knee', 84)}</span>
          <span class="grow"><b>Recovering from an injury?</b><small>Rehab for knees, ankles, hips, shoulders, elbows, wrists, back &amp; neck</small></span>
          <span class="go" aria-hidden="true">${icon('right')}</span>
        </a>

        ${mine.length ? `<section class="mine-sec"><h2 class="section-h">Your workouts</h2>
          <div class="mine-list">${mine.slice(-4).reverse().map(w => { const first = wk.allExerciseItems(w)[0]; return `<a class="mine glass" href="#/workout/${encodeURIComponent(w.id)}"><canvas data-fig="${first ? first.exId : 'squat'}" aria-hidden="true"></canvas><span class="grow"><b>${esc(w.name)}</b><small>${fmtMin(wk.estimateSeconds(w))}</small></span><span class="play">${icon('play')}</span></a>`; }).join('')}</div></section>` : ''}

        <section class="cta-row">
          <a class="cta glass" href="#/builder"><span class="cta-ic">${icon('plus')}</span><b>Build your own</b></a>
          <a class="cta glass" href="#/coach"><span class="cta-ic mascot">${art.ghost(44)}</span><b>Ask the AI coach</b></a>
          <a class="cta glass" href="#/progress"><span class="cta-ic">${icon('chart')}</span><b>See progress</b></a>
        </section>`;
      stopAnim = art.animateFigures(root);
      GF.fx.enhance(root);
    }

    root.addEventListener('click', e => {
      if (e.target.closest('[data-jump]')) { const f = root.querySelector('#focus'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'start' }); const b = f.querySelector('[data-focus]'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 350); } return; }
      const f = e.target.closest('[data-focus]'); if (f) { state.focus = f.dataset.focus; state.step = 2; draw(); window.scrollTo(0, 0); return; }
      if (e.target.closest('[data-back]')) { state.step = 1; draw(); return; }
      const i = e.target.closest('[data-int]');
      if (i) {
        GF.store.setSetting('lastIntensity', i.dataset.int);
        GF._pendingWorkout = wk.withIntensity(wk.find(state.focus), i.dataset.int);
        state.step = 1;
        GF.go('workout/__pending');
      }
    });
    draw();
    return () => stopAnim();
  }
  GF.views.dashboard = { render };
})(window.GF = window.GF || {});
