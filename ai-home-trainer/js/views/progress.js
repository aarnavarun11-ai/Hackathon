/* GhostFit – Progress & analytics. Only real recorded data — nothing is estimated except
   camera-counted reps, which are labelled as estimates. */
(function (GF) {
  'use strict';
  const { esc, icon, fmtMin, fmtDate, relDay, startOfWeek, dayKey, confirmDialog, toast } = GF.u;
  GF.views = GF.views || {};
  const lib = GF.lib;

  function weeklyChart(history, goal) {
    const weeks = [], now = startOfWeek();
    for (let i = 7; i >= 0; i--) { const s = now - i * 7 * 864e5; weeks.push({ s, n: history.filter(h => h.completed && h.startedAt >= s && h.startedAt < s + 7 * 864e5).length }); }
    const max = Math.max(goal, ...weeks.map(w => w.n), 1), W = 560, H = 160, bw = W / weeks.length;
    const y = v => H - 24 - v / max * (H - 40);
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Completed workouts per week for the last 8 weeks: ${weeks.map(w => w.n).join(', ')}. Weekly goal ${goal}.">
      <line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" style="stroke:var(--faint)" stroke-dasharray="4 4"/><text x="4" y="${y(goal) - 4}">goal ${goal}/week</text>
      ${weeks.map((w, i) => `<rect x="${i * bw + bw * 0.22}" y="${y(w.n)}" width="${bw * 0.56}" height="${Math.max(0, H - 24 - y(w.n))}" rx="6" style="fill:${w.n >= goal ? 'var(--grad-a)' : 'var(--ring-track)'}"/>
        <text x="${i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${fmtDate(w.s)}</text>${w.n ? `<text x="${i * bw + bw / 2}" y="${y(w.n) - 5}" text-anchor="middle">${w.n}</text>` : ''}`).join('')}
    </svg>`;
  }
  function heat(history) {
    const byDay = {}; history.forEach(h => { const k = dayKey(h.startedAt); byDay[k] = (byDay[k] || 0) + (h.durationSec || 0); });
    const cells = []; const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 27);
    for (let i = 0; i < 28; i++) { const sec = byDay[d.toDateString()] || 0; cells.push(`<i class="${sec ? sec > 1800 ? 'l3' : sec > 900 ? 'l2' : 'l1' : ''}" title="${d.toDateString()}: ${sec ? fmtMin(sec) : 'rest'}"></i>`); d.setDate(d.getDate() + 1); }
    return `<div class="heat" role="img" aria-label="Training days in the last 4 weeks: ${Object.keys(byDay).filter(k => Date.now() - new Date(k) < 28 * 864e5).length} days">${cells.join('')}</div><div class="row small faint" style="margin-top:6px"><span>4 weeks ago</span><span style="margin-left:auto">Today</span></div>`;
  }
  function spark(points) {
    if (points.length < 2) return '';
    const W = 120, H = 32, lo = Math.min(...points), hi = Math.max(...points), r = hi - lo || 1;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline fill="none" style="stroke:var(--grad-a)" stroke-width="2.5" points="${points.map((p, i) => `${i / (points.length - 1) * (W - 4) + 2},${H - 4 - (p - lo) / r * (H - 8)}`).join(' ')}"/></svg>`;
  }

  function render(root) {
    const history = GF.store.history().slice().sort((a, b) => a.startedAt - b.startedAt), s = GF.store.settings;
    const done = history.filter(h => h.completed);
    const thisWeek = history.filter(h => h.completed && h.startedAt >= startOfWeek()).length;
    const totalSec = history.reduce((a, h) => a + (h.durationSec || 0), 0);
    const planned = history.reduce((a, h) => a + (h.stepsTotal || 0), 0), completedSets = history.reduce((a, h) => a + (h.stepsDone || 0), 0);
    // per exercise aggregates
    const ex = {};
    for (const h of history) for (const set of h.sets || []) {
      if (set.skipped) continue;
      const e = ex[set.exId] = ex[set.exId] || { sessions: new Set(), reps: 0, secs: 0, last: 0, bestReps: null, bestHold: null, bestWeight: null, weights: [], sources: new Set(), camGood: 0, camBad: 0 };
      e.sessions.add(h.id); e.last = Math.max(e.last, h.startedAt); e.sources.add(set.source);
      if (set.mode === 'time') { e.secs += set.seconds || 0; if (!e.bestHold || set.seconds > e.bestHold.v) e.bestHold = { v: set.seconds, src: set.source, at: h.startedAt }; }
      else { e.reps += set.reps || 0; if (!e.bestReps || set.reps > e.bestReps.v) e.bestReps = { v: set.reps, src: set.source, at: h.startedAt }; }
      if (set.weight) { e.weights.push({ at: h.startedAt, w: set.weight }); if (!e.bestWeight || set.weight > e.bestWeight.v) e.bestWeight = { v: set.weight, reps: set.reps, at: h.startedAt }; }
      if (set.source === 'camera') { e.camGood += set.counts.good; e.camBad += set.counts.bad + set.counts.partial; }
    }
    const exRows = Object.entries(ex).sort((a, b) => b[1].last - a[1].last);
    const strength = exRows.filter(([, e]) => e.weights.length);
    const adaptations = GF.store.adaptations().slice().reverse();
    const replays = GF.store.replays().slice().reverse();

    root.innerHTML = `
      <header class="page-head"><div><h1>Progress</h1><p>Your sessions, on this device only.</p></div></header>
      ${!history.length ? `<div class="empty"><p>No sessions yet. Finish a workout and your progress will appear here.</p><a class="btn primary" href="#/workouts">${icon('play')}Find a workout</a></div>` : `
      <section class="stats panel" aria-label="Summary">
        <div class="stat"><div class="v" data-up="${done.length}">${done.length}</div><div class="k">workouts completed</div></div>
        <div class="stat"><div class="v">${thisWeek}<span class="muted small"> / ${s.weeklyGoal}</span></div><div class="k">this week</div></div>
        <div class="stat"><div class="v">${Math.round(totalSec / 60)}</div><div class="k">minutes trained</div></div>
        <div class="stat"><div class="v">${planned ? Math.round(completedSets / planned * 100) : 0}%</div><div class="k">of planned sets completed</div></div>
        <div class="stat"><div class="v">${(() => { const f = history.filter(h => h.form != null).slice(-10); return f.length ? `<span data-up="${Math.round(f.reduce((a, h) => a + h.form, 0) / f.length)}">${Math.round(f.reduce((a, h) => a + h.form, 0) / f.length)}</span>` : '—'; })()}</div><div class="k">avg form score (last 10)</div></div>
      </section>
      <section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Muscles this week</h2><span class="small muted">From the sets you finished</span></div>
        ${GF.bodymap.render(history.filter(h => h.startedAt >= startOfWeek()).reduce((m, h) => { (h.sets || []).filter(x => !x.skipped).forEach(x => { const e = lib.get(x.exId); if (e) GF.bodymap.add(m, e.muscles, 1); }); return m; }, {}), { empty: 'No workouts yet this week.' })}</section>
      <div class="grid g-main" style="margin-top:16px">
        <section class="panel"><div class="panel-head"><h2>Weekly frequency</h2><span class="small muted">last 8 weeks</span></div>${weeklyChart(history, s.weeklyGoal)}</section>
        <section class="panel"><div class="panel-head"><h2>Consistency</h2><span class="chip">${icon('flame')}${GF.adapt.consecutiveDays(history)}-day streak</span></div>${heat(history)}</section>
      </div>
      <section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Personal records</h2></div>
        <p class="small muted">Sources: <strong>Camera-counted</strong> reps are estimates from on-device tracking (good-form reps only). <strong>Logged by you</strong> is what you entered. <strong>Timer</strong> is measured time.</p>
        <table class="tbl"><thead><tr><th>Exercise</th><th>Best set</th><th>Total</th><th>Sessions</th><th>Last</th></tr></thead><tbody>
        ${exRows.map(([id, e]) => { const L = lib.get(id); if (!L) return ''; const best = e.bestHold ? `${e.bestHold.v} s <div class="src">${GF.ui.sourceLabel(e.bestHold.src)}</div>` : e.bestReps ? `${e.bestReps.v} reps <div class="src">${GF.ui.sourceLabel(e.bestReps.src)}</div>` : '—';
          return `<tr><td>${esc(L.name)}${e.camGood + e.camBad ? `<div class="src">Camera: ${e.camGood} counted, ${e.camBad} not counted</div>` : ''}</td><td>${best}</td><td>${e.secs ? fmtMin(e.secs) : e.reps + ' reps'}</td><td>${e.sessions.size}</td><td>${relDay(e.last)}</td></tr>`; }).join('')}
        </tbody></table></section>
      ${strength.length ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Strength progression</h2><span class="small muted">weights you logged</span></div>
        <ul class="list">${strength.map(([id, e]) => `<li><div class="grow"><div class="title">${esc(lib.get(id).name)}</div><div class="sub">Best: ${e.bestWeight.v} ${s.units} × ${e.bestWeight.reps} · ${fmtDate(e.bestWeight.at)}</div></div>${spark(e.weights.slice().sort((a, b) => a.at - b.at).map(x => x.w))}</li>`).join('')}</ul></section>` : ''}
      <section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Sessions</h2></div>
        <ul class="list">${history.slice().reverse().slice(0, 30).map(h => `<li><div class="grow"><div class="title">${esc(h.name)}</div><div class="sub">${fmtDate(h.startedAt, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtMin(h.durationSec || 0)} · ${h.stepsDone}/${h.stepsTotal} sets${h.camUsed ? ' · camera used' : ''}${h.feedback && h.feedback.overall ? ' · felt ' + ({ easy: 'easy', right: 'about right', hard: 'difficult' }[h.feedback.overall] || '') : ''}</div></div>
          ${h.completed ? `<span class="chip ok">${icon('check')}Complete</span>` : '<span class="chip">Partial</span>'}<button class="btn sm ghost" data-sess="${h.id}">Details</button><button class="icon-btn sm" data-delsess="${h.id}" aria-label="Delete session from ${fmtDate(h.startedAt)}">${icon('trash')}</button></li>`).join('')}</ul></section>
      `}
      ${adaptations.length ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><h2>How your workouts changed</h2></div><ul class="list">${adaptations.map(a => `<li><div class="grow"><div class="title small">${esc(a.workoutName)}</div><div class="sub">${esc(a.changes.join('; '))}</div></div><span class="small faint">${fmtDate(a.at)}</span></li>`).join('')}</ul></section>` : ''}
      ${replays.length ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Saved movement reviews</h2><span class="small muted">skeleton data only</span></div><ul class="list">${replays.map((r, i) => `<li><div class="grow"><div class="title small">${esc(r.label)}</div><div class="sub">${fmtDate(r.at)}</div></div><button class="btn sm" data-rp="${i}">${icon('replay')}Review</button></li>`).join('')}</ul></section>` : ''}`;

    root.addEventListener('click', async e => {
      const d = e.target.closest('[data-sess]');
      if (d) {
        const h = history.find(x => x.id === d.dataset.sess);
        GF.u.modal({ title: h.name, wide: true, body: `<p class="muted small">${new Date(h.startedAt).toLocaleString()} · ${fmtMin(h.durationSec)}</p>
          <table class="tbl"><thead><tr><th>Exercise</th><th>Set</th><th>Result</th><th>Source</th></tr></thead><tbody>${(h.sets || []).map(x => `<tr><td>${esc((lib.get(x.exId) || {}).name || x.exId)}</td><td>${x.set}</td><td>${x.skipped ? 'Skipped' : x.mode === 'time' ? x.seconds + ' s' : x.reps + ' reps'}${x.weight ? ` · ${x.weight} ${s.units}` : ''}${x.source === 'camera' && (x.counts.bad + x.counts.partial) ? ` · ${x.counts.bad + x.counts.partial} not counted` : ''}${x.source === 'camera' && x.counts.unassessed ? ` · ${x.counts.unassessed} not form-assessed` : ''}</td><td class="src">${GF.ui.sourceLabel(x.source || '')}</td></tr>`).join('')}</tbody></table>
          ${(h.swaps || []).length ? `<p class="small muted">Swapped during session: ${h.swaps.map(w => `${lib.get(w.from).name} → ${lib.get(w.to).name}`).join(', ')}</p>` : ''}` });
      }
      const del = e.target.closest('[data-delsess]');
      if (del && await confirmDialog('Delete this session?', 'It will be removed from your history on this device.', 'Delete', true)) {
        GF.store.deleteSession(del.dataset.delsess); toast('Session deleted'); GF.rerender();
      }
      const rp = e.target.closest('[data-rp]'); if (rp) GF.views.replay.open(replays[+rp.dataset.rp]);
    });
  }
  GF.views.progress = { render };
})(window.GF = window.GF || {});
