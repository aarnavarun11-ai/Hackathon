/* GhostFit – Active workout
   Runs any workout (custom, template or coach-generated) step by step.
   • Camera is optional and only starts when the user presses "Turn on camera".
   • Camera-checked exercises: reps count only with full range and good form, and corrections
     are only given when tracking confidence is good. Others: the user logs sets (or a timer runs).
   • Never advances while the user is performing a rep-based set; timed sets end when the timer does.
   • Voice commands (opt-in), gentle adaptive voice, captions, struggle support, movement replay. */
(function (GF) {
  'use strict';
  const { esc, icon, fmtTime, uid, toast, modal, bus } = GF.u;
  GF.views = GF.views || {};
  const lib = GF.lib, wk = GF.wk, engine = GF.engine, ghost = GF.ghost, pose = GF.pose;
  const speech = GF.speech, cv = GF.coachVoice, listen = GF.listen;
  const SET = () => GF.store.settings;
  const CONNECTIONS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
  const RING = 2 * Math.PI * 70;

  let S = null;
  const isOpen = () => !!S;

  /* ======================= open / close ======================= */
  function open(id, opts = {}) {
    if (S) close('reopen');
    const w = String(id).startsWith('__') ? GF._pendingWorkout : wk.find(id);
    if (!w) { toast('That workout could not be found', 'error'); GF.go('workouts'); return; }
    const v = wk.validate(w, SET());
    if (v.errors.length) {
      modal({ title: 'This workout needs fixing first', body: `<ul class="plain">${v.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`,
        actions: w.template || w.generated ? [{ label: 'OK', kind: 'primary' }] : [{ label: 'Close' }, { label: 'Open in builder', kind: 'primary', onClick: () => { GF.go('builder/' + w.id); } }] });
      GF.go(w.template ? 'workouts' : 'workouts/' + w.id); return;
    }
    const steps = wk.flatten(w);
    S = {
      w, steps, i: -1, phase: 'overview', phaseT: 0, paused: false, elapsed: 0, startedAt: null, demo: !!opts.demo,
      cam: false, camLoading: false, sets: [], replays: [], swaps: [], struggleShown: {}, a: { valid: false }, lms: null,
      stab: new engine.Stability(), cur: null, ovStep: opts.demo ? 'ready' : 'camera', sumStep: 'results', showCues: false, raf: 0, last: performance.now(), lastVT: -1, endArmedAt: 0, unsub: [], focusBefore: document.activeElement,
    };
    centerKey = ''; lastChips = ''; lastQ = '';
    buildDom();
    S.unsub.push(bus.on('caption', t => { if (SET().captions && S) S.el.caption.textContent = t; }));
    S.unsub.push(bus.on('mic', renderMic));
    S.unsub.push(bus.on('camera', e => { if (!S) return; if (!e.on && S.cam && !S.demo) { S.cam = false; renderControls(); if (e.reason === 'revoked' || e.reason === 'ended') { msg('Camera access ended. Continuing without camera tracking.', 'warn'); toast('Camera stopped — permission was removed or the camera was disconnected', 'error'); } } }));
    renderOverview();
    S.raf = requestAnimationFrame(loop);
    document.addEventListener('keydown', onKey);
    setTimeout(() => { const b = S && S.root.querySelector('[data-act="start-cam"], [data-act="start"]'); if (b) b.focus(); }, 30);
  }

  function close(reason) {
    if (!S) return;
    const s = S; S = null;
    cancelAnimationFrame(s.raf);
    if (s.startedAt && !s.saved && s.phase !== 'summary') saveSession(s, false);
    pose.stop('closed'); listen.disable(); speech.stop(); speech.slow = false;
    s.unsub.forEach(f => f());
    document.removeEventListener('keydown', onKey);
    s.root.remove();
    document.body.style.overflow = '';
    if (s.focusBefore && s.focusBefore.focus) try { s.focusBefore.focus(); } catch (e) { /* ignore */ }
    if (reason !== 'navigate' && location.hash.startsWith('#/workout/')) GF.go(s.record ? 'progress' : s.demo ? 'workouts' : 'dashboard');
  }

  /* ======================= DOM ======================= */
  function buildDom() {
    const root = document.createElement('div');
    root.className = 'session'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Active workout: ' + S.w.name);
    root.innerHTML = `
      <div class="ses-top">
        <span class="title">${esc(S.w.name)}</span>
        <div class="ses-progress" data-el="prog" aria-hidden="true"></div>
        <span class="num muted" data-el="clock" aria-label="Elapsed time">0:00</span>
        <button class="btn sm" data-act="end">End workout</button>
      </div>
      <div class="ses-main">
        <div class="stage" data-el="stage">
          <video playsinline muted aria-hidden="true"></video>
          <canvas class="overlay" aria-hidden="true"></canvas>
          <canvas class="demo" aria-hidden="true"></canvas>
          <div class="stage-center" data-el="center"></div>
          <div class="stage-tl" data-el="chips"></div>
          <div class="stage-msg" data-el="msg" role="status" aria-live="polite"></div>
          <div class="hud-count" data-el="hud" hidden></div>
          <div class="flash" data-el="flash" aria-hidden="true"></div>
          <div class="seen" data-el="seen" hidden aria-label="Body parts the camera can see"></div>
        </div>
        <aside class="ses-panel" aria-label="Workout controls">
          <div class="ex-now"><div class="eyebrow" data-el="eyebrow"></div><h2 data-el="name"></h2><div class="sub" data-el="sub"></div></div>
          <div class="counter" data-el="counterWrap"><span class="n" data-el="count" aria-live="off">–</span><span class="of" data-el="of"></span></div>
          <div class="quality none" data-el="quality"></div>
          <div class="ses-controls" data-el="controls"></div>
          <div data-el="log"></div>
          <div class="mic-state" data-el="mic"></div>
          <div class="caption" data-el="caption" aria-live="polite" ${SET().captions ? '' : 'hidden'}></div>
          <div data-el="banner"></div>
          <ol class="cues" data-el="cues"></ol>
          <div class="next-up" data-el="next"></div>
        </aside>
      </div>`;
    document.getElementById('session-root').appendChild(root);
    document.body.style.overflow = 'hidden';
    S.root = root; S.el = {};
    root.querySelectorAll('[data-el]').forEach(n => { S.el[n.dataset.el] = n; });
    S.video = root.querySelector('video'); S.overlay = root.querySelector('canvas.overlay'); S.demoC = root.querySelector('canvas.demo');
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    renderProgress(); renderControls(); renderMic({ state: listen.state });
  }

  const cur = () => S.steps[S.i];
  const exOf = st => st && st.exId ? lib.get(st.exId) : null;
  const trackDef = st => { const e = exOf(st); return e ? lib.trackOf(e) : null; };
  const tracked = () => { const st = cur(); return !!(st && st.kind === 'work' && trackDef(st) && (S.demo || (S.cam && pose.status === 'ready')) && !S.manualSet); };

  function flash(text, kind) { const f = S.el.flash; f.className = 'flash'; void f.offsetWidth; f.textContent = text; f.className = 'flash show ' + kind; }
  function hud() {
    const st = cur(); const el = S.el.hud;
    if (!st || st.kind !== 'work' || !['work', 'lost', 'countdown', 'position'].includes(S.phase) || !(S.cam || S.demo)) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = st.mode === 'time' ? `<b>${S.el.count.textContent}</b><span>${tracked() ? 'hold' : 'left'}</span>` : tracked() ? `<b>${S.cur.counts.good}</b><span>/ ${st.target}</span>` : `<b>${st.target}</b><span>reps</span>`;
  }
  function msg(text, kind = '') { S.el.msg.className = 'stage-msg ' + kind; S.el.msg.innerHTML = text ? esc(text) : ''; }
  function setPhase(p) { S.phase = p; S.phaseT = 0; renderControls(); }

  function renderProgress() {
    const works = S.steps.map((s, i) => ({ s, i })).filter(x => x.s.kind === 'work');
    S.el.prog.innerHTML = works.map(x => `<i class="${x.i < S.i ? 'done' : x.i === S.i ? 'now' : ''}"></i>`).join('');
  }

  function renderControls() {
    if (!S) return;
    const st = cur(), p = S.phase;
    const inWork = st && st.kind === 'work';
    const manualDone = inWork && ['work', 'lost'].includes(p);
    const btn = (act, ic, label, extra = '') => `<button class="btn ${extra}" data-act="${act}">${icon(ic)}<span>${label}</span></button>`;
    if (p === 'overview' || p === 'summary') { S.el.controls.innerHTML = ''; return; }
    const micOn = ['listening', 'processing', 'starting'].includes(listen.state);
    const main = [
      S.paused ? btn('resume', 'play', 'Resume', 'primary') : btn('pause', 'pause', 'Pause'),
      manualDone ? btn('done', 'check', st.mode === 'time' && !tracked() ? 'End set' : 'Set done') : btn('next', 'skip', p === 'rest' ? 'Skip rest' : 'Start now'),
      btn('skip', 'right', 'Skip exercise'),
      S.demo ? btn('noop', 'eye', 'Simulated', 'on') : S.cam ? btn('cam-off', 'camOff', 'Camera off', 'live') : btn('cam-on', 'cam', 'Camera on'),
      micOn ? btn('mic-off', 'micOff', 'Voice off', 'live') : btn('mic-on', 'mic', 'Voice control'),
      `<button class="btn" data-act="more" aria-expanded="${!!S.moreOpen}">${icon(S.moreOpen ? 'up' : 'down')}<span>${S.moreOpen ? 'Less' : 'More'}</span></button>`,
    ];
    const more = [
      btn('addset', 'plus', 'Add a set'),
      SET().voiceOn ? btn('mute', 'vol', 'Mute coach') : btn('unmute', 'volOff', 'Unmute', 'on'),
      btn('cues', 'list', S.showCues ? 'Hide steps' : 'Show steps'),
      btn('demo3d', 'cube', '3D demo'),
      btn('repeat', 'replay', 'Repeat'),
    ];
    S.el.controls.innerHTML = main.join('') + (S.moreOpen ? more.join('') + `<p class="kbd-hint"><kbd>Space</kbd> pause · <kbd>Enter</kbd> set done · <kbd>N</kbd> next</p>` : '');
  }
  function renderMic(e) {
    if (!S) return;
    const st = (e && e.state) || listen.state;
    if (st === 'off' || !listen.supported) { S.el.mic.innerHTML = listen.supported ? '' : '<span class="small faint">Voice control is not supported in this browser.</span>'; S.el.mic.className = 'mic-state'; renderControls(); return; }
    const heard = e && e.heard ? `<span class="heard">“${esc(e.heard)}”</span>` : '';
    const err = e && e.error ? ` — ${esc(e.error)} <button class="btn sm ghost" data-act="mic-on">Retry</button>` : '';
    const hint = st === 'denied' ? ' — allow the microphone in your browser\'s site settings' : '';
    S.el.mic.className = 'mic-state ' + st;
    S.el.mic.innerHTML = `<span class="dot ${['listening', 'processing'].includes(st) ? 'live' : st === 'error' || st === 'denied' ? 'bad' : ''}"></span><span>${GF.micLabel(st)}${hint}${err}</span>${heard}`;
    renderControls();
  }

  function renderExercise() {
    const st = cur(); if (!st) return;
    if (st.kind === 'rest') {
      const nx = S.steps.slice(S.i + 1).find(x => x.kind === 'work'), ne = exOf(nx);
      S.el.eyebrow.textContent = 'Rest';
      S.el.name.textContent = 'Recover';
      S.el.sub.textContent = st.why === 'round' ? 'End of round' : st.why === 'recovery' ? 'Recovery period' : '';
      S.el.cues.innerHTML = ''; S.el.next.innerHTML = ne ? `Up next: <b>${esc(ne.name)}</b> · ${nx.mode === 'time' ? nx.target + ' s' : nx.target + ' reps'}` : 'Last one done.';
      return;
    }
    const e = exOf(st), def = trackDef(st);
    const g = st.group ? ` · ${st.group.type === 'superset' ? 'Superset' : 'Circuit'} ${st.group.index + 1}/${st.group.size}` : '';
    S.el.eyebrow.textContent = `${wk.BLOCK_LABEL[st.blockType]} · ${st.group ? 'Round' : 'Set'} ${st.set} of ${st.sets}${g}`;
    S.el.name.textContent = e.name;
    S.el.sub.innerHTML = `${st.mode === 'time' ? `${st.target} seconds` : `${st.target} reps`}${st.tempo ? ` · tempo ${esc(st.tempo)}` : ''}${st.notes ? ` · ${esc(st.notes)}` : ''}`;
    S.el.cues.innerHTML = S.showCues ? e.steps.map(s => `<li>${esc(s)}</li>`).join('') : '';
    const nx = S.steps.slice(S.i + 1).find(x => x.kind === 'work');
    S.el.next.innerHTML = nx ? `Then: <b>${esc(exOf(nx).name)}</b>${nx.exId === st.exId ? ` (set ${nx.set})` : ''}` : 'Last set of the workout.';
    void def;
  }

  /* ======================= overview ======================= */
  function stepper(n) {
    const names = ['Focus', 'Intensity', 'Camera', 'Go'];
    return `<ol class="stepper dark" aria-label="Steps">${names.map((t, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}" ${i + 1 === n ? 'aria-current="step"' : ''}><span>${i + 1 < n ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  }
  function renderOverview() {
    const n = wk.allExerciseItems(S.w).length, tr = wk.trackedCount(S.w);
    S.el.name.textContent = S.w.name; S.el.eyebrow.textContent = 'Workout'; S.el.sub.textContent = `About ${Math.round(wk.estimateSeconds(S.w) / 60)} min · ${n} exercises`;
    S.el.counterWrap.hidden = true;
    S.el.cues.innerHTML = '';
    let html;
    if (S.ovStep === 'camera') {
      html = !S.cam ? `
        <div class="ov-card">
          ${stepper(3)}
          <div class="ov-mascot">${GF.art.ghost(84)}</div>
          <h2>Use your camera?</h2>
          <div class="cam-tips">
            <div><span>${icon('eye')}</span>Counts reps</div>
            <div><span>${icon('target')}</span>Checks form</div>
            <div><span>${icon('lock')}</span>Never recorded</div>
          </div>
          ${tr < n ? `<p class="small">Camera-checked: ${tr} of ${n} exercises</p>` : ''}
          <div class="row center"><button class="btn primary lg" data-act="cam-on">${icon('cam')}Use my camera</button><button class="btn ghost-light" data-act="ov-skip-cam">No camera</button></div>
        </div>`
      : `
        <div class="ov-card compact">
          ${stepper(3)}
          <h2>Can you see yourself?</h2>
          <p>Step back until the parts you need show <b>✓</b> in the “What I can see” box. Side-on or facing the camera is fine for now.</p>
          <div class="row center"><button class="btn primary lg" data-act="ov-next">Looks good ${icon('right')}</button></div>
        </div>`;
    } else {
      const seenIds = new Set();
      const items = S.steps.filter(s1 => s1.kind === 'work' && !seenIds.has(s1.itemId) && seenIds.add(s1.itemId));
      html = `
        <div class="ov-card">
          ${S.demo ? '' : stepper(4)}
          <h2>Ready?</h2>
          ${S.demo ? '<p class="note warn" style="text-align:left">Demo: a simulated athlete does the moves. Not saved to your progress.</p>' : ''}
          <ol class="ov-list">${items.slice(0, 8).map(x => `<li><span class="ovx">${GF.lib.demoOf(exOf(x)) ? `<canvas class="thumb" data-fig="${exOf(x).id}" aria-hidden="true"></canvas>` : `<span class="thumb ph">${icon('target')}</span>`}${esc(exOf(x).name)}</span><span>${x.sets} × ${x.mode === 'time' ? x.target + 's' : x.target}</span></li>`).join('')}${items.length > 8 ? `<li><span>+ ${items.length - 8} more</span><span></span></li>` : ''}</ol>
          <div class="row center"><button class="btn primary lg" data-act="start">${icon('play')}Start workout</button></div>
          ${S.demo ? '' : `<p class="small" style="opacity:.75;margin-top:8px">${S.cam ? 'Camera on' : 'No camera — you’ll tap “Set done” after each set'} · <button class="linkish" data-act="ov-back">change</button></p>`}
        </div>`;
    }
    S.el.center.innerHTML = html;
    GF.art.animateFigures(S.el.center, 0.5, GF.art.DARK);
    S.demoT0 = performance.now();
    setTimeout(() => { const b = S && S.el.center.querySelector('.btn.primary'); if (b) b.focus(); }, 30);
  }

  /* ======================= flow ======================= */
  function start() {
    S.startedAt = Date.now(); S.el.counterWrap.hidden = false;
    if (S.demo) GF.sim.reset();
    enterStep(0);
  }
  function enterStep(i) {
    S.i = i; S.manualSet = false; S.el.log.innerHTML = ''; S.el.banner.innerHTML = '';
    if (i >= S.steps.length) return finish(true);
    renderProgress(); renderExercise();
    if (cur().kind === 'rest') enterRest(); else enterIntro();
  }

  function newSetRecord(st) {
    return { exId: st.exId, itemId: st.itemId, set: st.set, mode: st.mode, target: st.target, reps: 0, seconds: 0, weight: null, source: null,
      counts: { good: 0, bad: 0, partial: 0, unassessed: 0 }, issues: {}, holdBreaks: 0, assessedT: 0, frames: [], events: [], startedAt: null };
  }

  function enterIntro() {
    const st = cur(), e = exOf(st), def = trackDef(st);
    S.cur = newSetRecord(st);
    S.tracker = def && def.type === 'reps' ? new engine.RepCounter(def) : null;
    S.hold = def && def.type === 'hold' ? new engine.HoldTracker(def) : null;
    S.stab.reset(); S.badStreak = 0; S.coachUntil = 0; S.timeLeft = st.mode === 'time' ? st.target : 0;
    const prev = S.steps.slice(0, S.i).reverse().find(x => x.kind === 'work');
    const repeat = prev && prev.exId === st.exId;
    S.introDur = repeat ? 2 : 4;
    setPhase('intro');
    S.el.count.textContent = st.mode === 'time' ? fmtTime(st.target) : '0';
    S.el.of.textContent = st.mode === 'time' ? (def ? 'hold' : 'left') : `/ ${st.target} reps`;
    const what = st.mode === 'time' ? `${st.target} seconds` : `${st.target} reps`;
    if (repeat) cv.line('transition', `Set ${st.set} of ${st.sets}. ${what}.`, { short: `Set ${st.set}.` });
    else {
      cv.line('transition', `Next: ${e.name}. ${st.sets > 1 ? `Set ${st.set} of ${st.sets}, ` : ''}${what}.`, { short: `${e.name}. ${what}.` });
      setTimeout(() => { if (S && S.phase === 'intro') cv.line('cue', SET().coaching === 'detailed' ? e.steps.join(' ') : e.simple); }, 2200);
    }
    msg(def && !(S.cam || S.demo) ? (st.mode === 'time' ? 'Camera is off — a timer will run.' : 'Camera is off — log this set yourself when you finish.') : !def ? (st.mode === 'time' ? 'Timed exercise — a timer will run.' : 'This exercise isn’t camera-checked — log it yourself when you finish.') : '', '');
  }

  function enterPosition() { setPhase('position'); S.posGood = 0; S.lastSay = -99; if (S.tracker) S.tracker.reset(); }
  function enterCountdown() { setPhase('countdown'); S.cdLast = null; }
  function enterWork() {
    const st = cur();
    setPhase('work'); S.lostT = 0;
    S.cur.startedAt = Date.now();
    S.cur.source = tracked() ? (S.demo ? 'simulated' : 'camera') : st.mode === 'time' ? 'timer' : 'manual';
    if (S.tracker && S.tracker.state === 'moving') S.tracker.reset();
    cv.line('transition', st.mode === 'time' ? 'Begin. Hold steady.' : 'Begin.', { short: 'Go.' });
    msg(tracked() ? '' : st.mode === 'time' ? 'Timer running' : `Do ${st.target} reps, then tap “Set done” or say “done”.`, '');
    if (!tracked() && st.mode === 'reps') { S.el.count.textContent = st.target; S.el.of.textContent = 'reps · log when done'; showManualLog(); }
  }
  function enterRest() {
    const st = cur();
    setPhase('rest'); S.restLeft = S.restTotal = st.duration; S.restTicks = new Set();
    S.el.count.textContent = fmtTime(st.duration); S.el.of.textContent = 'rest';
    const nx = S.steps.slice(S.i + 1).find(x => x.kind === 'work');
    const lastSet = S.sets[S.sets.length - 1];
    if (nx) cv.line('transition', `Rest for ${st.duration} seconds. Next, ${exOf(nx).name}.`, { short: `Rest ${st.duration} seconds.` });
    const fs = lastSet && lastSet.form != null ? `<span class="form-chip ${lastSet.form >= 85 ? 'hi' : lastSet.form >= 60 ? 'mid' : 'lo'}">Form <b>${lastSet.form}</b>${lastSet.pb ? ' · PB!' : ''}</span>` : '';
    S.el.banner.innerHTML = fs + (lastSet && S.replays.find(r => r.setIndex === S.sets.length - 1) ? `<button class="btn sm" data-act="review">${icon('replay')}Review your last set</button>` : '');
    msg('', '');
  }

  function completeSet(o = {}) { if (finalizeSet(o)) enterStep(S.i + 1); }
  function finalizeSet({ reps, weight, skipped } = {}) {
    const st = cur(), r = S.cur;
    if (!st || st.kind !== 'work' || !r || r.endedAt) return false;
    if (skipped && !r.startedAt) { r.skipped = true; }
    if (r.source === 'manual' || reps != null) r.reps = reps != null ? reps : r.reps;
    if (r.source === 'camera' || r.source === 'simulated') r.reps = r.counts.good;
    if (st.mode === 'time') r.seconds = Math.round(S.hold ? S.hold.elapsed : st.target - S.timeLeft);
    if (weight) r.weight = weight;
    r.skipped = !!skipped; r.endedAt = Date.now();
    r.assessedShare = S.tracker ? (r.counts.good ? (r.counts.good - r.counts.unassessed) / r.counts.good : 0) : S.hold ? (r.assessedT / Math.max(1, r.seconds)) : 0;
    // keep the movement data for review (memory only unless the user opted in)
    if (r.frames.length > 10) {
      const rp = { id: uid('rp'), exId: r.exId, setIndex: S.sets.length, label: `${exOf(st).name} · set ${st.set}`, at: Date.now(), W: S.W, H: S.H, frames: r.frames, events: r.events, simulated: S.demo };
      S.replays.push(rp);
      if (!S.demo) GF.store.saveReplay(Object.assign({}, rp, { frames: rp.frames.filter((f, i) => i % 2 === 0) }));
    }
    delete r.frames;
    r.form = formScore(r, st);
    if (!S.demo && !r.skipped) checkBest(r, st);
    S.sets.push(r);
    if (SET().shareContextWithCoach && !S.demo) GF.coachContext = { exId: r.exId, workoutName: S.w.name, lastSet: { exId: r.exId, tracked: r.source === 'camera', assessedShare: r.assessedShare, good: r.counts.good, bad: r.counts.bad + r.counts.partial, issues: r.issues } };
    if (!skipped && S.phase !== 'summary') cv.line('transition', r.counts.bad + r.counts.partial >= 2 && SET().coaching !== 'minimal' ? 'Set complete. Take your time on the next one.' : 'Set complete.', { short: 'Done.' });
    return true;
  }

  /** 0–100: share of clean reps (partial reps count a little), or how much of a hold stayed in good form */
  function formScore(r, st) {
    if (r.skipped || !(r.source === 'camera' || r.source === 'simulated')) return null;
    if (st.mode === 'time') { const sec = r.seconds || 0; if (!sec) return null; return Math.max(0, Math.min(100, Math.round(100 * Math.min(1, sec / Math.max(1, st.target)) - (r.holdBreaks || 0) * 8))); }
    const c = r.counts || {}, tot = (c.good || 0) + (c.bad || 0) + (c.partial || 0);
    return tot ? Math.round(100 * ((c.good || 0) + 0.4 * (c.partial || 0)) / tot) : null;
  }
  /** Personal bests: more reps / longer hold than any earlier set of this exercise */
  function checkBest(r, st) {
    const key = st.mode === 'time' ? 'seconds' : 'reps', val = r[key] || 0;
    if (!val) return;
    let prev = null;
    for (const h of GF.store.history()) for (const x of h.sets || []) if (x.exId === r.exId && !x.skipped && (x.mode === 'time') === (st.mode === 'time')) prev = Math.max(prev || 0, x[key] || 0);
    for (const x of S.sets) if (x.exId === r.exId && !x.skipped) prev = Math.max(prev || 0, x[key] || 0);
    if (prev != null && val > prev) {
      r.pb = true;
      GF.fx.celebrate(`New personal best: ${val}${st.mode === 'time' ? ' s' : ' reps'} of ${exOf(st).name}!`, { count: 110 });
    } else if (r.form === 100 && (r.counts.good || 0) >= 5) GF.fx.celebrate('Perfect form!', { count: 60, say: false });
  }
  function streakDays() {
    const day = 864e5, t = new Date(); t.setHours(0, 0, 0, 0);
    let n = 0;
    for (let i = 0; i < 400; i++) { const s0 = t.getTime() - i * day; if (GF.store.history().some(h => h.completed && h.startedAt >= s0 && h.startedAt < s0 + day)) n++; else if (i > 0) break; }
    return n;
  }
  function celebrateFinish(s) {
    if (!s.record || !s.completed) return;
    const goal = SET().weeklyGoal || 3, wkDone = GF.store.history().filter(h => h.completed && h.startedAt >= GF.u.startOfWeek()).length;
    const streak = streakDays();
    if (wkDone === goal) GF.fx.celebrate('Weekly goal reached! 🎉');
    else if ([3, 5, 7, 10, 14, 21, 30, 50, 100].includes(streak)) GF.fx.celebrate(`${streak}-day streak! Keep it going!`);
    else GF.fx.confetti({ count: 70 });
  }

  function finish(completed) {
    S.completed = completed;
    if (S.cur && S.cur.startedAt && !S.cur.endedAt && cur() && cur().kind === 'work') {
      const partial = S.cur.counts.good || (S.hold && S.hold.elapsed > 1) || (cur().mode === 'time' && !trackDef(cur()) && S.timeLeft < cur().target - 1);
      S.phase = 'summary'; finalizeSet({ skipped: !partial, reps: S.el.log.innerHTML ? 0 : undefined });
    }
    setPhase('summary');
    pose.stop('finished'); S.cam = false; listen.disable();
    cv.line('transition', completed ? 'Workout complete. Nice work today.' : 'Workout ended.');
    saveSession(S, completed);
    renderSummary();
    try { celebrateFinish(S); } catch (e) { GF.crash(e, 'celebrate'); }
  }

  function saveSession(s, completed) {
    if (s.saved) return;
    s.saved = true; s.completed = completed;
    if (s.demo) return;                              // simulated sessions never count as progress
    const works = s.steps.filter(x => x.kind === 'work').length;
    const done = s.sets.filter(x => !x.skipped);
    if (!done.length) return;
    s.record = {
      id: uid('s'), workoutId: s.w.template || s.w.generated ? s.w.id : s.w.id, name: s.w.name, startedAt: s.startedAt, endedAt: Date.now(),
      durationSec: Math.round(s.elapsed), completed, stepsDone: done.length, stepsTotal: works, camUsed: s.sets.some(x => x.source === 'camera'),
      privacy: SET().privacyMode, swaps: s.swaps,
      sets: s.sets.map(x => ({ exId: x.exId, set: x.set, mode: x.mode, target: x.target, reps: x.reps, seconds: x.seconds, weight: x.weight, source: x.source, counts: x.counts, issues: x.issues, holdBreaks: x.holdBreaks, skipped: x.skipped, assessedShare: x.assessedShare, form: x.form, pb: x.pb })),
    };
    const forms = done.map(x => x.form).filter(v => v != null);
    if (forms.length) s.record.form = Math.round(forms.reduce((a, b) => a + b, 0) / forms.length);
    GF.store.addSession(s.record);
  }

  /* ======================= manual logging ======================= */
  function showManualLog() {
    const st = cur(), e = exOf(st);
    const weighted = ['dumbbells', 'barbell', 'machine', 'band'].includes(e.equip);
    S.el.log.innerHTML = `<div class="banner"><strong>Log this set</strong>
      <div class="row" style="margin-top:8px">
        <label class="field" style="flex-direction:row;align-items:center;gap:8px">Reps done <input type="number" min="0" max="500" value="${st.target}" data-log="reps"></label>
        ${weighted ? `<label class="field" style="flex-direction:row;align-items:center;gap:8px">Weight (${SET().units}) <input type="number" min="0" max="1000" step="0.5" data-log="weight" placeholder="optional"></label>` : ''}
      </div><p class="small faint" style="margin:6px 0 0">Logged by you — not measured by the camera.</p></div>`;
  }
  function manualDone() {
    const r = S.el.log.querySelector('[data-log=reps]'), wt = S.el.log.querySelector('[data-log=weight]');
    completeSet({ reps: r ? Math.max(0, +r.value || 0) : cur().target, weight: wt && wt.value ? +wt.value : null });
  }

  /* ======================= camera ======================= */
  async function camOn() {
    if (S.demo || S.camLoading) return;
    S.camLoading = true; renderControls();
    try {
      await pose.start(S.video, { deviceId: SET().cameraId, userAction: true });
      S.cam = true; msg('Camera on — loading the AI pose model…', '');
      await loadModel();
    } catch (err) {
      S.cam = false;
      const m = err.name === 'NotAllowedError' ? 'Camera permission was denied. You can allow it in your browser’s site settings, or continue without it.'
        : err.name === 'NotFoundError' ? 'No camera was found.' : err.name === 'NotReadableError' ? 'The camera is being used by another app.' : (err.message || 'Could not start the camera.');
      msg(m, 'warn'); toast(m, 'error');
    }
    S.camLoading = false; renderControls();
    if (S && S.phase === 'overview') renderOverview();
  }
  async function loadModel() {
    try { await pose.load(); if (S) { msg('', ''); S.el.banner.innerHTML = ''; } }
    catch (err) {
      console.error('Pose model failed to load', err);
      if (!S) return;
      // keep the camera preview on — only tracking is unavailable
      msg('Camera is on, but the AI pose model couldn’t be downloaded, so reps won’t be counted automatically.', 'warn');
      S.el.banner.innerHTML = `<div class="banner" role="alert"><strong>AI pose model unavailable.</strong> It downloads from Google the first time and needs internet (some school or work networks block it). You can still see yourself; log sets manually for now.
        <div class="small faint" style="margin-top:4px">${esc(String(err && err.message || err).slice(0, 140))}</div>
        <div class="row"><button class="btn sm" data-act="retry-model">Try again</button></div></div>`;
      renderControls();
    }
  }
  function renderOverviewCam() {
    const p = S.el.center.querySelector('.panel'); if (!p) return;
    if (S.cam) p.innerHTML = `<strong class="row">${icon('cam')} Camera is on</strong><p class="small muted" style="margin:6px 0 0">You should see yourself behind this card. Processing happens on this device. Turn it off any time with the camera button.</p><p class="small" style="margin:6px 0 0">AI pose model: <strong>${pose.status === 'ready' ? 'ready' : pose.status === 'error' ? 'unavailable' : 'loading…'}</strong></p>`;
  }
  function camOff() {
    const st = cur(), wasTracked = tracked();
    pose.stop('user'); S.cam = false; S.lms = null; renderControls();
    msg('Camera off. Form checks are paused — log sets yourself.', '');
    if (wasTracked && ['work', 'lost'].includes(S.phase)) {
      S.phase = 'work';
      if (st.mode === 'time') { S.timeLeft = Math.max(0, st.target - (S.hold ? S.hold.elapsed : 0)); S.cur.source = 'timer'; S.hold = null; }
      else { S.cur.source = 'manual'; showManualLog(); const r = S.el.log.querySelector('[data-log=reps]'); if (r) r.value = Math.max(S.cur.counts.good, 0) || st.target; }
    }
    if (['position', 'countdown'].includes(S.phase)) enterWork();
  }

  async function startWithCamera(b) {
    if (b) { b.disabled = true; b.innerHTML = 'Starting camera…'; }
    await camOn();
    if (!S) return;
    start();
  }
  async function micOn() { const ok = await listen.enable(onVoice); if (ok) cv.line('answer', 'Voice control on. Say pause, next, or how many reps are left.'); renderControls(); }

  /* ======================= commands ======================= */
  function onVoice(cmd, text) {
    if (!S) return;
    if (!cmd) return;
    act(cmd, 'voice', text);
  }
  function act(cmd, from) {
    const st = cur(), p = S.phase;
    switch (cmd) {
      case 'start': if (p === 'overview') start(); else if (p === 'intro' || p === 'position') enterCountdown(); else if (S.paused) togglePause(false); break;
      case 'pause': togglePause(true); break;
      case 'resume': if (S.paused) togglePause(false); else if (p === 'intro') enterCountdown(); break;
      case 'next':
        if (p === 'rest') S.restLeft = 0;
        else if (p === 'intro' || p === 'position') enterCountdown();
        else if (p === 'countdown') enterWork();
        else if (p === 'work' || p === 'lost') completeSet({ skipped: !S.cur.counts.good && !S.cur.reps && !(S.hold && S.hold.elapsed) });
        break;
      case 'done': if (p === 'work' || p === 'lost') { if (S.el.log.innerHTML) manualDone(); else completeSet({}); } else act('next', from); break;
      case 'skip': skipExercise(); break;
      case 'addSet': addSet(); break;
      case 'repeat': { const e = exOf(st); if (e) cv.line('answer', `${e.name}. ${e.steps.join(' ')}`); else if (st) cv.line('answer', `Resting. ${Math.ceil(S.restLeft)} seconds left.`); break; }
      case 'repsLeft': {
        if (!st || st.kind !== 'work') { cv.line('answer', 'You are resting right now.'); break; }
        if (st.mode === 'time') cv.line('answer', `${Math.ceil(S.hold ? st.target - S.hold.elapsed : S.timeLeft)} seconds left.`);
        else if (tracked()) cv.line('answer', `${Math.max(0, st.target - S.cur.counts.good)} reps to go.`);
        else cv.line('answer', `The target is ${st.target} reps. I'm not counting this set, so say done when you finish.`);
        break;
      }
      case 'restLeft': cv.line('answer', p === 'rest' ? `${Math.ceil(S.restLeft)} seconds of rest left.` : st && st.mode === 'time' ? `${Math.ceil(S.timeLeft)} seconds left in this set.` : 'You are not resting right now.'); break;
      case 'slow': speech.slow = true; cv.line('answer', 'Okay, slowing down. Take about three seconds on the way down, and one on the way up.'); break;
      case 'form': explainForm(); break;
      case 'end': {
        if (from === 'voice') {
          if (Date.now() - S.endArmedAt < 6000) finish(false);
          else { S.endArmedAt = Date.now(); cv.line('answer', 'Say end workout again to confirm.'); }
        } else confirmEnd();
        break;
      }
      case 'mute': GF.store.setSetting('voiceOn', false); speech.stop(); renderControls(); break;
      case 'unmute': GF.store.setSetting('voiceOn', true); renderControls(); cv.line('answer', 'Voice coaching on.'); break;
    }
  }
  function explainForm() {
    const st = cur();
    if (!st || st.kind !== 'work') { cv.line('answer', 'Ask me during a set and I will tell you what the camera is seeing.'); return; }
    const e = exOf(st);
    if (!trackDef(st)) { cv.line('answer', `I can't check ${e.name} with the camera. Focus on this: ${e.steps[1] || e.steps[0]}`); return; }
    if (!(S.cam || S.demo)) { cv.line('answer', `The camera is off, so I can't see your form. Focus on this: ${e.steps[1] || e.steps[0]}`); return; }
    if (!S.a.valid || (S.a.quality && S.a.quality.level !== 'good')) { cv.line('answer', `I can't see you clearly enough to judge your form right now. ${S.a.reason || (S.a.quality && S.a.quality.tips[0]) || ''}`); return; }
    const issues = Object.values(S.cur.issues).sort((a, b) => b.n - a.n);
    cv.line('answer', issues.length ? `So far: ${issues[0].msg.replace(/!$/, '')}. ${e.tips[0] || ''}` : `Your tracked reps look good so far. ${S.cur.counts.good} counted.`);
  }
  async function confirmEnd() {
    const wasPaused = S.paused; togglePause(true);
    const ok = await GF.u.confirmDialog('End workout?', 'Your completed sets will be saved.', 'End workout', true);
    if (!S) return;
    if (ok) finish(false); else if (!wasPaused) togglePause(false);
  }
  function togglePause(v) {
    S.paused = v !== undefined ? v : !S.paused;
    if (S.paused) { speech.stop(); msg('Paused', ''); } else msg('', '');
    renderControls();
  }
  function skipExercise() {
    const st = cur(); if (!st) return;
    let j = S.i + 1;
    if (st.kind === 'work' && !st.group) while (j < S.steps.length && (S.steps[j].kind === 'rest' || S.steps[j].itemId === st.itemId)) j++;
    if (st.kind === 'work' && S.cur && !S.cur.endedAt) finalizeSet({ skipped: true });
    cv.line('transition', 'Skipping.');
    enterStep(j);
  }
  function addSet() {
    let st = cur(); if (!st) return;
    if (st.kind === 'rest') st = S.steps.slice(0, S.i).reverse().find(x => x.kind === 'work');
    if (!st) return;
    // insert after the last step of this item
    let last = S.i; for (let j = S.i; j < S.steps.length; j++) if (S.steps[j].itemId === st.itemId) last = j;
    const item = wk.allExerciseItems(S.w).find(x => x.id === st.itemId);
    const ns = Object.assign({}, st, { set: st.sets + 1, sets: st.sets + 1 });
    S.steps.forEach(x => { if (x.itemId === st.itemId) x.sets = st.sets + 1; });
    S.steps.splice(last + 1, 0, { kind: 'rest', duration: (item && item.rest) || 60, why: 'set' }, ns);
    renderProgress(); renderExercise();
    toast(`Added another set of ${exOf(st).name} (this session only)`);
    cv.line('answer', 'Added one more set.');
  }
  function offerStruggle() {
    const st = cur(), e = exOf(st);
    if (S.struggleShown[e.id]) return; S.struggleShown[e.id] = true;
    const easier = (e.easier || []).map(id => lib.get(id)).find(Boolean);
    S.el.banner.innerHTML = `<div class="banner" role="status"><strong>This one seems tricky today.</strong> That's normal. Want some help?
      <div class="row"><button class="btn sm" data-act="simple">Explain it simply</button>${easier ? `<button class="btn sm" data-act="swap" data-to="${easier.id}">Use ${esc(easier.name)} for the rest of today</button>` : ''}<button class="btn sm ghost" data-act="dismiss">Keep going</button></div></div>`;
    cv.line('answer', SET().coaching === 'minimal' ? 'Need help? Options are on screen.' : 'This one seems tricky today. I can explain it more simply, or switch to an easier version. Options are on screen.');
  }
  function swapRest(toId) {
    const st = cur(); const from = st.exId, to = lib.get(toId);
    for (let j = S.i; j < S.steps.length; j++) {
      const x = S.steps[j];
      if (x.kind === 'work' && x.itemId === st.itemId) { x.exId = toId; x.name = to.name; if (to.mode !== x.mode) { x.mode = to.mode; x.target = to.mode === 'time' ? (to.def.duration || 30) : (to.def.reps || 10); } }
    }
    S.swaps.push({ from, to: toId, at: Date.now() });
    S.el.banner.innerHTML = `<div class="banner">Switched to ${esc(to.name)} for this session. Your saved workout hasn’t changed.</div>`;
    cv.line('transition', `Okay. Switching to ${to.name}.`);
    enterIntro(); renderExercise();
  }

  /* ======================= events ======================= */
  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    const map = { pause: 'pause', resume: 'resume', next: 'next', skip: 'skip', addset: 'addSet', repeat: 'repeat', done: 'done', mute: 'mute', unmute: 'unmute' };
    if (map[a]) return act(map[a], 'click');
    if (a === 'start') return start();
    if (a === 'start-cam') return startWithCamera(b);
    if (a === 'ov-skip-cam' || a === 'ov-next') { S.ovStep = 'ready'; return renderOverview(); }
    if (a === 'ov-back') { S.ovStep = 'camera'; return renderOverview(); }
    if (a === 'cues') { S.showCues = !S.showCues; renderExercise(); renderControls(); return; }
    if (a === 'more') { S.moreOpen = !S.moreOpen; renderControls(); return; }
    if (a === 'end') return S.phase === 'summary' || !S.startedAt ? close() : act('end', 'click');
    if (a === 'cam-on') return camOn();
    if (a === 'cam-off') return camOff();
    if (a === 'retry-model') { S.el.banner.innerHTML = ''; msg('Retrying the AI pose model download…', ''); return loadModel(); }
    if (a === 'mic-on') return micOn();
    if (a === 'mic-off') { listen.disable(); renderControls(); return; }
    if (a === 'demo3d') { const st = cur() && cur().kind === 'work' ? cur() : S.steps.slice(Math.max(0, S.i)).find(x => x.kind === 'work'); if (st) { togglePause(true); GF.ui.exerciseDetail(st.exId); } return; }
    if (a === 'simple') { const e2 = exOf(cur()); cv.line('answer', e2.simple); S.el.banner.innerHTML = `<div class="banner">${esc(e2.simple)}</div>`; return; }
    if (a === 'swap') return swapRest(b.dataset.to);
    if (a === 'dismiss') { S.el.banner.innerHTML = ''; return; }
    if (a === 'review') { const rp = S.replays[S.replays.length - 1]; if (rp) { togglePause(true); GF.views.replay.open(rp); } return; }
    if (a === 'review-i') { const rp = S.replays[+b.dataset.i]; if (rp) GF.views.replay.open(rp); return; }
    if (a === 'feedback') return showSuggestions();
    if (a === 'sum-next') { S.sumStep = 'rate'; return renderSummaryStep(); }
    if (a === 'apply') return applySuggestions();
    if (a === 'close') return close();
  }
  document.addEventListener('click', e => { if (!S) return; const o = e.target.closest('[data-overall]'); if (!o) return; S.feedback = S.feedback || { overall: null, perEx: {} }; S.feedback.overall = o.dataset.overall; S.el.center.querySelectorAll('[data-overall]').forEach(x => x.setAttribute('aria-pressed', x === o)); });
  function onChange(e) {
    const t = e.target;
    if (t.dataset.fb) { S.feedback = S.feedback || { overall: null, perEx: {} }; if (t.dataset.fb === 'overall') S.feedback.overall = t.value; else S.feedback.perEx[t.dataset.fb] = t.value; }
  }
  function onKey(e) {
    if (!S || e.target.closest('input, textarea, select') || document.querySelector('.modal-backdrop')) return;
    if (e.code === 'Space') { e.preventDefault(); if (S.phase !== 'overview' && S.phase !== 'summary') togglePause(); }
    else if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); if (S.phase === 'overview') { if (S.ovStep === 'ready') start(); } else act('done', 'key'); }
    else if (e.key === 'n' || e.key === 'N') act('next', 'key');
  }

  /* ======================= main loop ======================= */
  function loop(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(loop);
    try { loopBody(now); } catch (err) { GF.crash(err, 'workout loop'); }
  }
  function loopBody(now) {
    if (!S) return;
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
    const st = cur(), def = st && st.kind === 'work' ? trackDef(st) : null;

    // pose input (camera or simulation), only for camera-checked work
    const W = S.video.videoWidth || 1280, H = S.video.videoHeight || 720; S.W = W; S.H = H;
    let fresh = false;
    if (def && S.demo && !S.manualSet) {
      if (now - (S.lastSim || 0) > 33) { S.lastSim = now; S.lms = GF.sim.detect(W, H, def, S.phase === 'work' && !S.paused); fresh = true; }
    } else if (S.cam && pose.landmarker && S.video.readyState >= 2 && S.video.currentTime !== S.lastVT) {
      S.lastVT = S.video.currentTime; const r = pose.detect(S.video); if (r !== undefined) { S.lms = r; fresh = true; }
    } else if (!S.cam && !S.demo) S.lms = null;
    if (fresh && def) { S.a = engine.analyze(def, S.lms, W, H); S.a.unstable = S.stab.push(def, S.a) > 0.09; }
    else if (!def) S.a = { valid: false };

    if (S.startedAt && !S.paused && S.phase !== 'summary') S.elapsed += dt;
    if (!S.paused) { S.phaseT += dt; tick(dt, fresh, now); }
    if (!S) return;
    draw(now);
    S.el.clock.textContent = fmtTime(S.elapsed);
    const c0 = cur(), title = S.phase === 'summary' ? `Done · ${S.w.name}` : S.phase === 'work' && c0 && exOf(c0) ? `● ${exOf(c0).name} · ${fmtTime(S.elapsed)}` : `${S.w.name} — GhostFit`;
    if (document.title !== title) document.title = title;
  }

  function tick(dt, fresh, now) {
    const st = cur(), p = S.phase;
    if (p === 'overview' || p === 'summary' || !st) return;
    if (p === 'rest') {
      S.restLeft -= dt;
      const n = Math.ceil(S.restLeft);
      if (n <= 3 && n > 0 && !S.restTicks.has(n)) { S.restTicks.add(n); if (n === 3) cv.line('count', 'Get ready.', { remaining: 0 }); }
      S.el.count.textContent = fmtTime(Math.max(0, S.restLeft));
      if (S.restLeft <= 0) enterStep(S.i + 1);
      return;
    }
    const def = trackDef(st), a = S.a;
    if (p === 'intro') { if (S.phaseT >= S.introDur) { if (tracked()) enterPosition(); else enterCountdown(); } return; }
    if (p === 'position') {
      if (!tracked()) return enterCountdown();
      if (!S.demo && !pose.landmarker) { msg('Loading the AI pose model…', ''); return; }
      if (fresh) {
        let ready = false, why = '';
        if (def.type === 'reps') { S.tracker.feed(a, now); ready = a.valid && S.tracker.state === 'ready'; why = !a.valid ? a.reason : S.tracker.gateMsg || 'Get into the start position shown by the outline'; }
        else { const r = a.valid ? def.check(a.P) : null; ready = a.valid && !r; why = !a.valid ? a.reason : (r ? r.msg : ''); }
        S.posGood = ready ? S.posGood + dt : 0;
        msg(ready ? 'Good — hold still' : why, ready ? 'ok' : 'warn');
        if (!ready && S.phaseT - S.lastSay > 8 && S.phaseT > 2) { S.lastSay = S.phaseT; cv.line('correction', why); }
        if (S.posGood > 0.5) enterCountdown();
        if (S.phaseT > 20 && !S.el.banner.innerHTML) S.el.banner.innerHTML = `<div class="banner">Having trouble getting tracked? <div class="row"><button class="btn sm" data-act="next">Start without camera check</button></div></div>`;
      }
      return;
    }
    if (p === 'countdown') {
      const n = 3 - Math.floor(S.phaseT);
      if (n > 0 && n !== S.cdLast) { S.cdLast = n; cv.line('count', String(n), { remaining: 0 }); }
      if (tracked() && fresh && S.tracker) S.tracker.feed(a, now);
      if (S.phaseT >= 3) { S.el.banner.innerHTML = ''; enterWork(); }
      return;
    }
    if (p === 'work' || p === 'lost') {
      if (!tracked()) {
        if (st.mode === 'time') {
          S.timeLeft -= dt; S.el.count.textContent = fmtTime(Math.max(0, S.timeLeft));
          const n = Math.ceil(S.timeLeft);
          if (n <= 3 && n > 0 && n !== S.cdLast) { S.cdLast = n; cv.line('count', String(n), { remaining: n }); }
          if (S.timeLeft <= 0) completeSet({});
        }
        return;
      }
      // camera-tracked
      if (fresh) recordFrame(now);
      if (p === 'work') {
        if (!a.valid) { S.lostT += dt; if (S.lostT > 1.2) { setPhase('lost'); S.lastSay = -99; } }
        else S.lostT = 0;
      } else {
        msg(a.reason || 'I can’t see you', 'warn');
        if (S.phaseT - S.lastSay > 7) { S.lastSay = S.phaseT; cv.line('correction', a.reason || 'Step back into view'); }
        if (a.valid) { S.validT = (S.validT || 0) + dt; if (S.validT > 0.5) { S.validT = 0; setPhase('work'); if (S.tracker) S.tracker.reset(); msg('Tracking again', 'ok'); } } else S.validT = 0;
        if (S.phaseT > 15 && !S.el.banner.innerHTML) S.el.banner.innerHTML = `<div class="banner">Lost tracking. <div class="row"><button class="btn sm" data-act="cam-off">Continue without camera</button></div></div>`;
        if (def.type === 'hold') return;
        if (fresh) S.tracker.feed(a, now);
        return;
      }
      if (def.type === 'reps' && fresh) workReps(a, now, st, def);
      if (def.type === 'hold') workHold(a, dt, st, def);
    }
  }

  function workReps(a, now, st, def) {
    const r = S.cur, e = exOf(st);
    for (const ev of S.tracker.feed(a, now)) {
      if (ev.type === 'good') {
        r.counts.good++; S.badStreak = 0; flash('+1', 'ok');
        if (!ev.assessed) r.counts.unassessed++;
        r.events.push({ t: now, type: ev.assessed ? 'good' : 'unassessed' });
        S.el.count.textContent = r.counts.good;
        const left = st.target - r.counts.good;
        if (left <= 0) return completeSet({});
        msg(ev.assessed ? cv.praiseText() : 'Counted — form not assessed (tracking was limited)', ev.assessed ? 'ok' : 'warn');
        cv.line('count', left <= 2 ? (left === 1 ? 'One more.' : 'Two more.') : String(r.counts.good), { remaining: left });
        if (r.counts.good % 4 === 0) setTimeout(() => cv.line('encourage'), 900);
      } else if (ev.type === 'bad' || ev.type === 'partial') {
        const issue = ev.type === 'bad' ? ev.issue : { id: 'partial', msg: def.partial, say: def.partial };
        r.counts[ev.type]++; r.events.push({ t: now, type: ev.type, id: issue.id });
        r.issues[issue.id] = r.issues[issue.id] || { n: 0, msg: issue.msg }; r.issues[issue.id].n++;
        S.badStreak++; S.coachUntil = S.phaseT + 2.6; flash('Not counted', 'bad');
        msg(`Not counted — ${issue.msg}`, 'bad');
        cv.line('correction', issue.say, { why: whyFor(issue.id) });
        if (r.counts.bad + r.counts.partial >= 3 && S.badStreak >= 2) offerStruggle();
      }
    }
    if (S.tracker.live && S.phaseT > S.coachUntil) { msg(S.tracker.live.msg, 'bad'); cv.line('correction', S.tracker.live.say); }
    else if (S.tracker.state === 'waitStart' && S.phaseT > S.coachUntil) msg(S.tracker.gateMsg || 'Return to the start position', 'warn');
  }
  function workHold(a, dt, st, def) {
    const r = S.cur;
    for (const ev of S.hold.feed(a, dt)) {
      if (ev.type === 'break') { r.holdBreaks++; r.issues[ev.issue.id] = r.issues[ev.issue.id] || { n: 0, msg: ev.issue.msg }; r.issues[ev.issue.id].n++; cv.line('correction', `${ev.issue.say || ev.issue.msg}. Timer paused.`); }
      if (ev.type === 'resume' && S.phaseT > 1) cv.line('encourage');
    }
    r.assessedT = S.hold.assessedT || 0;
    const left = st.target - S.hold.elapsed;
    S.el.count.textContent = fmtTime(Math.max(0, left));
    if (S.hold.good) {
      msg(a.quality && a.quality.level !== 'good' ? 'Timer running — form not assessed (tracking limited)' : 'Hold steady', a.quality && a.quality.level !== 'good' ? 'warn' : 'ok');
      const n = Math.ceil(left); if (n <= 3 && n > 0 && n !== S.cdLast) { S.cdLast = n; cv.line('count', String(n), { remaining: n }); }
    } else msg(S.hold.issue ? `Timer paused — ${S.hold.issue.msg}` : 'Get into position', S.hold.elapsed > 0 ? 'bad' : 'warn');
    if (left <= 0) completeSet({});
  }
  const WHY = { chest: 'This keeps your back in a safer position.', elbows: 'It keeps the work in your biceps.', stack: 'Pressing in a straight line is stronger and easier on your shoulders.', high: 'Above shoulder height adds strain without extra benefit.', bent: 'Long arms keep tension on the shoulders.', sag: 'A straight line protects your lower back.', pike: 'A flat line makes your core do the work.', tall: 'Staying upright keeps the load on your legs.', straight: 'Straight legs work the lower abs.', partial: 'Full range builds more strength.' };
  const whyFor = id => WHY[id] || '';

  function recordFrame(now) {
    if (!S.lms || S.phase !== 'work' || !S.cur) return;
    const f = S.cur.frames; if (f.length > 1800) return; // ~2 minutes at 15 fps
    if (f.length && now - f[f.length - 1].t < 66) return;
    const lm = []; for (let i = 0; i < 33; i++) { const p = S.lms[i]; lm.push(+p.x.toFixed(4), +p.y.toFixed(4), +(p.visibility || 0).toFixed(2)); }
    f.push({ t: now, lm, m: S.tracker ? S.tracker.metric : (S.hold ? S.hold.metric : null), q: S.a.quality ? S.a.quality.level : null });
  }

  /* ======================= drawing ======================= */
  function draw(now) {
    const st = cur(), p = S.phase;
    const showDemo = p === 'intro' || p === 'rest' || p === 'summary' || (!tracked() && st && st.kind === 'work') || (p !== 'overview' && !st);
    // demo canvas (exercise animation)
    const dc = S.demoC; dc.style.display = showDemo ? 'block' : 'none';
    S.video.style.visibility = S.cam ? 'visible' : 'hidden';
    S.overlay.style.display = (S.cam || (S.demo && tracked())) && S.phase !== 'summary' ? 'block' : 'none';
    // centre content for rest / countdown / summary handled here
    renderCenter(now);
    renderChips();
    hud();
    if (showDemo) drawDemo(now);
    if (S.overlay.style.display === 'block') drawOverlay(now);
    renderSeen(now);
  }
  function demoTarget() {
    const p = S.phase, st = cur();
    if (p === 'rest' || p === 'overview') { const nx = S.steps.slice(Math.max(0, S.i + (p === 'rest' ? 1 : 0))).find(x => x.kind === 'work'); return nx ? exOf(nx) : null; }
    return st && st.kind === 'work' ? exOf(st) : null;
  }
  function drawDemo(now) {
    const c = S.demoC, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr); if (!w) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, w, h);
    if (S.phase === 'summary') return;
    const e = demoTarget(); const demo = e && lib.demoOf(e);
    if (!demo) return;
    const right = S.phase === 'rest' || S.phase === 'overview';
    let box = right ? { x: w * 0.56, y: h * 0.18, w: w * 0.4, h: h * 0.64 } : { x: w * 0.15, y: h * 0.1, w: w * 0.7, h: h * 0.72 };
    if (S.cam) { // your camera stays visible; the demo sits in a panel on top
      const pw = Math.min(w * 0.3, h * 0.5), ph = pw * 1.15, px = w - pw - 16 * dpr, py = Math.min(h - ph - 16 * dpr, 150 * dpr);
      ctx.fillStyle = 'rgba(14,15,17,0.86)'; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = dpr;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 10 * dpr); else ctx.rect(px, py, pw, ph); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a0a5ab'; ctx.font = `${11 * dpr}px system-ui`; ctx.fillText('How to do it', px + 10 * dpr, py + 18 * dpr);
      box = { x: px + pw * 0.08, y: py + ph * 0.1, w: pw * 0.84, h: ph * 0.82 };
    }
    const t = (now - (S.demoT0 || 0)) / 1000 * (speech.slow ? 0.75 : 1);
    const P = ghost.poseAt(demo, S.paused ? 0 : t);
    const T = ghost.motionFit(demo, box);
    ghost.drawProps(ctx, demo, P, T, 'rgba(255,255,255,0.14)');
    ghost.draw(ctx, P, T, { color: '#c9cdd2', alpha: S.phase === 'overview' ? 0.35 : 0.9, glow: false });
  }
  function drawOverlay(now) {
    const c = S.overlay, W = S.W, H = S.H;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, H);
    const st = cur(), def = st && st.kind === 'work' ? trackDef(st) : null, a = S.a;
    if (!def) { drawSkeleton(ctx, W, H, null, '#ffffff'); return; }
    // where to stand
    if (S.phase === 'position' || S.phase === 'lost' || S.phase === 'countdown') {
      const box = def.floor ? { x: W * 0.08, y: H * 0.3, w: W * 0.84, h: H * 0.64 } : { x: W * 0.2, y: H * 0.05, w: W * 0.6, h: H * 0.9 };
      const P = ghost.poseAt(def, 0, { e: def.type === 'hold' ? 1 : 0 });
      ghost.draw(ctx, P, ghost.motionFit(def, box), { outline: true, alpha: 0.6, color: S.posGood > 0 || S.phase === 'countdown' ? '#4cc47f' : '#d6f35a', glow: false });
    }
    // reference ghost pinned to the body after a rejected rep, or when a hold breaks
    const showRef = a.valid && ((S.phase === 'work' && S.phaseT < S.coachUntil) || (S.hold && !S.hold.good && S.hold.elapsed > 0));
    if (showRef) {
      const Pg = ghost.poseAt(def, def.type === 'hold' ? 0 : (S.phaseT - S.coachUntil + 2.6), def.type === 'hold' ? { e: 1 } : {});
      const pin = def.ghost.pin, user = pin === 'ankleA' ? a.P.ankle : pin === 'hipC' ? a.P._hip : a.P.hip;
      let flip = false;
      if (def.view === 'side') { const g0 = ghost.poseAt(def, 0, { e: 0 }); const gdx = g0.shoulder.x - g0.ankleA.x; flip = Math.abs(gdx) > 0.1 ? Math.sign(a.P.shoulder.x - a.P.ankle.x) !== Math.sign(gdx) : (a.P.nose.x - a.P.shoulder.x) < 0; }
      ghost.draw(ctx, Pg, ghost.pinTransform(Pg, pin, user, a.P._torso / ghost.LEN.torso, flip), { alpha: 0.6, color: '#7df9ff', glow: true });
    }
    if (S.demo && GF.sim.lastP) ghost.draw(ctx, GF.sim.lastP, GF.sim.lastT, { color: '#8a9096', alpha: 0.35, glow: false });
    // skeleton, coloured by state (with text equivalents shown in the panel)
    const q = a.quality ? a.quality.level : 'poor';
    const issue = (S.tracker && S.tracker.live) || (S.phase === 'work' && S.phaseT < S.coachUntil) || (S.hold && !S.hold.good && S.hold.elapsed > 0);
    const col = !a.valid ? '#ffffff' : issue ? '#e85a50' : q === 'fair' ? '#e8b53f' : '#4cc47f';
    drawSkeleton(ctx, W, H, a.valid ? def.joints.map(ch => ch.map(n => a.P[n]).filter(Boolean)) : null, col);
  }
  /** Draw every joint the AI can see (white), and the measured joints in colour. */
  function drawSkeleton(ctx, W, H, chains, col) {
    if (!SET().showSkeleton || !S.lms) return;
    const lw = Math.max(3, H * 0.006);
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = lw;
    for (const [i, j] of CONNECTIONS) { const p1 = S.lms[i], p2 = S.lms[j]; if ((p1.visibility || 0) < 0.5 || (p2.visibility || 0) < 0.5) continue; ctx.beginPath(); ctx.moveTo(p1.x * W, p1.y * H); ctx.lineTo(p2.x * W, p2.y * H); ctx.stroke(); }
    ctx.fillStyle = '#ffffff';
    for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p1 = S.lms[i]; if ((p1.visibility || 0) < 0.5) continue; ctx.beginPath(); ctx.arc(p1.x * W, p1.y * H, lw * 1.4, 0, 7); ctx.fill(); }
    if (!chains) return;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw * 2.2;
    for (const pts of chains) { ctx.beginPath(); pts.forEach((pt, k) => k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)); ctx.stroke(); pts.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x, pt.y, lw * 2.2, 0, 7); ctx.fill(); }); }
  }
  /* "What I can see" — which body parts the AI is tracking right now */
  const PARTS = [['Head', [0]], ['Shoulders', [11, 12]], ['Elbows', [13, 14]], ['Wrists', [15, 16]], ['Hips', [23, 24]], ['Knees', [25, 26]], ['Ankles', [27, 28]]];
  let lastSeen = '', lastSeenT = 0;
  function renderSeen(now) {
    if (now - lastSeenT < 250) return; lastSeenT = now;
    let html = '';
    if ((S.cam || (S.demo && tracked())) && S.phase !== 'summary') {
      if (S.cam && !pose.landmarker) html = `<div class="seen-title">${pose.status === 'error' ? 'AI model unavailable' : 'Loading AI…'}</div>`;
      else if (!S.lms) html = `<div class="seen-title">I can't see you yet — step into view</div>`;
      else {
        const st = cur(), def = st && st.kind === 'work' ? trackDef(st) : null;
        const needed = def ? def.need.map(n => n.replace(/[LR]$/, '')) : [];
        const ok = idx => idx.some(i => { const p1 = S.lms[i]; return (p1.visibility || 0) >= 0.5 && p1.x > 0.01 && p1.x < 0.99 && p1.y > 0.01 && p1.y < 0.99; });
        const map = { Shoulders: 'shoulder', Elbows: 'elbow', Wrists: 'wrist', Hips: 'hip', Knees: 'knee', Ankles: 'ankle' };
        html = `<div class="seen-title">What I can see</div>` + PARTS.map(([name, idx]) => {
          const seen = ok(idx), need = needed.includes(map[name]);
          return `<span class="seen-part ${seen ? 'ok' : 'no'} ${need ? 'need' : ''}">${seen ? '✓' : '✗'} ${name}</span>`;
        }).join('');
      }
    }
    if (html !== lastSeen) { S.el.seen.innerHTML = html; S.el.seen.hidden = !html; lastSeen = html; }
  }
  let centerKey = '';
  function renderCenter() {
    const p = S.phase, st = cur();
    if (p === 'overview' || p === 'summary') return;
    const cd = p === 'countdown' ? Math.max(1, 3 - Math.floor(S.phaseT)) : '';
    const key = [p, S.i, S.paused, cd, tracked()].join('|');
    if (key !== centerKey) {
      centerKey = key;
      let html = '';
      if (S.paused) html = `<div><div class="big">II</div><p class="muted">Paused — press Resume, Space, or say “resume”.</p></div>`;
      else if (p === 'countdown') html = `<div class="big" aria-hidden="true">${cd}</div>`;
      else if (p === 'rest') {
        const nx = S.steps.slice(S.i + 1).find(x => x.kind === 'work');
        html = `<div style="margin-right:38%"><div style="position:relative;width:160px;height:160px;margin:0 auto">
          <svg class="ring" viewBox="0 0 160 160" aria-hidden="true"><circle class="t" cx="80" cy="80" r="70"/><circle class="b" data-rest-ring cx="80" cy="80" r="70" stroke-dasharray="${RING}" stroke-dashoffset="0" transform="rotate(-90 80 80)"/></svg>
          <div class="num" data-rest-n style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:600"></div></div>
          <p style="margin-top:12px">Rest${nx ? ` · next: <strong>${esc(exOf(nx).name)}</strong>` : ''}</p>
          <div class="row" style="justify-content:center"><button class="btn sm" data-act="plus15">+15 s</button><button class="btn sm" data-act="next">Skip rest</button></div></div>`;
      } else if (p === 'intro') {
        const e = exOf(st);
        html = lib.demoOf(e) ? '' : `<div class="cam-off"><h2>${esc(e.name)}</h2><ol class="steps-ol" style="text-align:left">${e.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
      } else if (p === 'work' && st && st.kind === 'work' && !tracked() && !lib.demoOf(exOf(st))) {
        html = `<div class="cam-off"><h2>${esc(exOf(st).name)}</h2><p class="muted">${esc(exOf(st).simple)}</p></div>`;
      }
      S.el.center.innerHTML = html;
    }
    if (p === 'rest') {
      const n = S.el.center.querySelector('[data-rest-n]'), ring = S.el.center.querySelector('[data-rest-ring]');
      if (n) n.textContent = Math.max(0, Math.ceil(S.restLeft));
      if (ring) ring.setAttribute('stroke-dashoffset', RING * (1 - Math.max(0, S.restLeft) / S.restTotal));
    }
  }
  let lastChips = '', lastQ = '';
  function renderChips() {
    const st = cur(), def = st && st.kind === 'work' ? trackDef(st) : null, a = S.a;
    const chips = [];
    if (S.demo) chips.push(`<span class="chip warn">${icon('eye')}Simulated athlete</span>`);
    else if (S.cam) chips.push(`<span class="chip bad">${icon('cam')}Camera on · processed on this device</span>`);
    if (S.phase === 'position' && def) {
      const inFrame = a.valid || a.code === 'orient';
      chips.push(`<span class="chip ${inFrame ? 'ok' : ''}">${icon(inFrame ? 'check' : 'x')}In frame</span>`, `<span class="chip ${a.valid ? 'ok' : ''}">${icon(a.valid ? 'check' : 'x')}${def.view === 'side' ? 'Side-on' : 'Facing camera'}</span>`, `<span class="chip ${S.posGood > 0 ? 'ok' : ''}">${icon(S.posGood > 0 ? 'check' : 'x')}Start position</span>`);
    }
    const h = chips.join(''); if (h !== lastChips) { S.el.chips.innerHTML = h; lastChips = h; }
    // tracking quality line (text + icon, never colour alone)
    let cls = 'none', text = '';
    if (!st || st.kind !== 'work') text = '';
    else if (!def) text = st.mode === 'time' ? 'Timed — not camera-checked.' : 'Not camera-checked — you log this set.';
    else if (S.manualSet) text = 'Camera check skipped for this set.';
    else if (!(S.cam || S.demo)) text = 'Camera off — form not checked.';
    else if (S.cam && pose.status === 'error') { cls = 'fair'; text = 'AI pose model unavailable — log this set yourself.'; }
    else if (S.cam && !pose.landmarker) text = 'Loading AI pose model…';
    else if (!a.valid) { cls = 'poor'; text = `Not tracking — ${a.reason || 'step into view'}`; }
    else if (a.quality.level === 'good' && !a.unstable) { cls = 'good'; text = 'Tracking good — form checks on'; }
    else { cls = 'fair'; text = `Tracking limited — corrections paused${a.quality.tips[0] ? '. ' + a.quality.tips[0] : ''}`; }
    const ic = { good: 'check', fair: 'alert', poor: 'x', none: 'info' }[cls];
    const q = cls + text; if (q !== lastQ) { S.el.quality.className = 'quality ' + cls; S.el.quality.innerHTML = text ? `${icon(ic)}<span>${esc(text)}</span>` : ''; lastQ = q; }
  }

  /* ======================= summary + adaptation ======================= */
  function renderSummary() {
    const sets = S.sets.filter(x => !x.skipped);
    const byEx = {};
    for (const s of S.sets) { const k = s.exId; (byEx[k] = byEx[k] || []).push(s); }
    const camReps = sets.filter(s => s.source === 'camera' || s.source === 'simulated').reduce((a, s) => a + s.counts.good, 0);
    const notCounted = sets.reduce((a, s) => a + s.counts.bad + s.counts.partial, 0);
    S.el.counterWrap.hidden = true; S.el.quality.innerHTML = ''; S.el.cues.innerHTML = ''; S.el.next.innerHTML = ''; S.el.log.innerHTML = ''; S.el.banner.innerHTML = ''; msg('');
    S.el.eyebrow.textContent = S.completed ? 'Complete' : 'Ended early'; S.el.name.textContent = S.w.name; S.el.sub.textContent = fmtTime(S.elapsed);
    S.el.chips.innerHTML = '';
    const rows = Object.entries(byEx).map(([id, list]) => {
      const e = lib.get(id), done = list.filter(x => !x.skipped);
      const total = done[0] && done[0].mode === 'time' ? done.reduce((a, s) => a + s.seconds, 0) + ' s' : done.reduce((a, s) => a + s.reps, 0) + ' reps';
      const src = [...new Set(done.map(s => s.source))].map(GF.ui.sourceLabel).join(', ');
      const weight = done.filter(s => s.weight).map(s => s.weight);
      return `<tr><td>${esc(e.name)}</td><td>${done.length}/${list.length}</td><td>${total}${weight.length ? ` · up to ${Math.max(...weight)} ${SET().units}` : ''}<div class="src">${esc(src)}</div></td>
        <td><select data-fb="${id}" aria-label="How did ${esc(e.name)} feel?"><option value="">—</option>${GF.adapt.RATINGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></td></tr>`;
    }).join('');
    S.summaryRows = rows; S.summaryStats = { sets, camReps, notCounted };
    renderSummaryStep();
    renderControls();
  }
  function renderSummaryStep() {
    const { sets, camReps, notCounted } = S.summaryStats, step = S.sumStep;
    const dots = ['Results', 'How did it feel?', 'Next time'].map((t, i) => `<li class="${['results', 'rate', 'suggest'].indexOf(step) > i ? 'done' : ['results', 'rate', 'suggest'][i] === step ? 'now' : ''}"><span>${['results', 'rate', 'suggest'].indexOf(step) > i ? '✓' : i + 1}</span>${t}</li>`).join('');
    let body = '';
    if (step === 'results') body = `
      <h2>${S.completed ? 'Workout complete' : 'Workout ended'}</h2>
      <p>${S.demo ? 'Demo session — not saved to your progress.' : S.record ? 'Saved to your history on this device.' : 'No sets were completed, so nothing was saved.'}</p>
      <div class="sum-stats">
        <div><b>${fmtTime(S.elapsed)}</b><span>time</span></div>
        <div><b>${sets.length}/${S.steps.filter(x => x.kind === 'work').length}</b><span>sets</span></div>
        <div><b data-up="${camReps}">${camReps}</b><span>clean reps${notCounted ? ` · ${notCounted} not counted` : ''}</span></div>
        <div class="form-stat">${(() => { const f = sets.map(x => x.form).filter(v => v != null); const avg = f.length ? Math.round(f.reduce((a, b) => a + b, 0) / f.length) : null; return avg == null ? '<b>—</b><span>form score (camera)</span>' : `<b data-up="${avg}">${avg}</b><span>form score</span>`; })()}</div>
      </div>
      ${sets.some(x => x.pb) ? `<p class="pb-line">🏆 ${sets.filter(x => x.pb).length} new personal best${sets.filter(x => x.pb).length > 1 ? 's' : ''}</p>` : ''}
      <div class="sum-body">${GF.bodymap.render(sets.reduce((w, s) => { const e = lib.get(s.exId); return e ? GF.bodymap.add(w, e.muscles, 1) : w; }, {}), { compact: true, title: 'Muscles worked', empty: 'No sets finished — nothing worked yet.' })}</div>
      ${S.replays.length ? `<div class="row center" style="margin-bottom:12px">${S.replays.map((r, i) => `<button class="btn sm ghost-light" data-act="review-i" data-i="${i}">${icon('replay')}Review ${esc(r.label)}</button>`).join('')}</div>` : ''}
      <div class="row center"><button class="btn primary lg" data-act="sum-next">How did it feel? ${icon('right')}</button><button class="btn ghost-light" data-act="close">Finish</button></div>`;
    if (step === 'rate') body = `
      <h2>How did it feel?</h2>
      <div class="rate-big" role="group" aria-label="Overall difficulty">${[['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']].map(([k, t]) => `<button data-overall="${k}" aria-pressed="${(S.feedback || {}).overall === k}">${t}</button>`).join('')}</div>
      <details style="margin:10px 0 14px"><summary>Rate each exercise (optional)</summary>
        <table class="tbl" style="margin-top:8px"><tbody>${S.summaryRows}</tbody></table></details>
      <div class="row center"><button class="btn primary lg" data-act="feedback">See suggestions ${icon('right')}</button><button class="btn ghost-light" data-act="close">Skip</button></div>`;
    if (step === 'suggest') body = `<h2>For next time</h2><div data-el2="sugg"></div><div class="row center" style="margin-top:14px"><button class="btn primary lg" data-act="close">Done</button></div>`;
    S.el.center.innerHTML = `<div class="ov-card wide"><ol class="stepper dark">${dots}</ol>${body}</div>`;
    GF.fx.enhance(S.el.center);
    if (step === 'suggest') showSuggestionsInto();
    renderControls();
  }
  function showSuggestions() { S.sumStep = 'suggest'; renderSummaryStep(); }
  function showSuggestionsInto() {
    const fb = S.feedback || { perEx: {} };
    if (S.record) GF.store.updateSession(S.record.id, { feedback: fb });
    const box = S.el.center.querySelector('[data-el2="sugg"]');
    if (S.w.generated) { box.innerHTML = '<p class="small muted">This workout was generated by the coach and isn’t saved, so there’s nothing to adjust. Save it from the coach first to keep changes.</p>'; return; }
    const sug = GF.adapt.suggestions(S.w, fb);
    S.suggestions = sug;
    box.innerHTML = sug.length ? `<div class="panel tight"><strong>Suggested changes</strong><p class="small muted">Nothing changes unless you select it. ${S.w.template ? 'Changes are saved as a new copy — the template stays the same.' : 'Your current version is kept in the workout’s history.'}</p>
      <ul class="list">${sug.map(s => `<li>${s.safety ? icon('alert') : `<input type="checkbox" data-sug="${s.id}" aria-label="${esc(s.text)}">`}<div class="grow"><div class="title">${esc(s.text)}</div><div class="sub">${esc(s.reason)}</div></div></li>`).join('')}</ul>
      <div class="row"><button class="btn primary" data-act="apply">Apply selected</button></div></div>`
      : `<p class="small muted">${Object.keys(fb.perEx || {}).length || fb.overall ? 'No changes suggested — sounds like it was about right.' : 'Choose how each exercise felt, then ask for suggestions.'}</p>`;
  }
  async function applySuggestions() {
    const ids = [...S.el.center.querySelectorAll('[data-sug]:checked')].map(x => x.dataset.sug);
    const chosen = (S.suggestions || []).filter(s => ids.includes(s.id));
    if (!chosen.length) { toast('Select at least one change, or press Done to keep the workout as it is'); return; }
    if (!(await GF.u.confirmDialog('Apply these changes?', chosen.map(c => c.text).join('\n'), 'Apply'))) return;
    const saved = GF.adapt.apply(S.w, chosen, S.record && S.record.id);
    if (saved) { toast(`Saved changes to "${saved.name}"`); S.el.center.querySelector('[data-el2="sugg"]').innerHTML = `<p class="small">Changes saved to <a href="#/workouts/${encodeURIComponent(saved.id)}">${esc(saved.name)}</a>. You can restore the earlier version from its history.</p>`; }
  }
  // +15s rest button lives in the centre area
  document.addEventListener('click', e => { if (S && e.target.closest('[data-act="plus15"]')) { S.restLeft += 15; S.restTotal += 15; } });

  GF.views.session = { open, close, isOpen, _state: () => S };
  void listen;
})(window.GF = window.GF || {});
