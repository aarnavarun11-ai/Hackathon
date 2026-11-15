/* GhostFit – Workouts: my workouts, templates, exercise library, workout detail */
(function (GF) {
  'use strict';
  const { esc, icon, fmtMin, fmtDate, DAYS, confirmDialog, toast } = GF.u;
  GF.views = GF.views || {};
  const wk = GF.wk, lib = GF.lib;
  let tab = 'mine', tabChosen = false;

  function card(w) {
    const n = wk.allExerciseItems(w).length, tr = wk.trackedCount(w);
    const eq = wk.equipmentOf(w).filter(e => !['chair', 'wall', 'mat'].includes(e));
    const fig = (wk.allExerciseItems(w).find(x => lib.trackOf(lib.get(x.exId)) && lib.demoOf(lib.get(x.exId))) || wk.allExerciseItems(w).find(x => lib.demoOf(lib.get(x.exId))) || wk.allExerciseItems(w)[0] || { exId: 'squat' }).exId;
    const tone = 't' + (1 + [...String(w.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6);
    return `<article class="wk">
      <a class="wk-art ${tone}" href="#/workouts/${encodeURIComponent(w.id)}" aria-label="${esc(w.name)} details"><canvas data-fig="${fig}" aria-hidden="true"></canvas><span class="pill">${icon('clock')}${fmtMin(wk.estimateSeconds(w))}</span></a>
      <div><h3>${esc(w.name)}</h3></div>
      <div class="meta"><span class="chip">${GF.ui.cap(w.level || 'beginner')}</span><span class="chip">${GF.ui.cap(w.category || 'strength')}</span>
        ${tr ? `<span class="chip accent">${icon('eye')}${tr}/${n} camera-checked</span>` : ''}${eq.length ? `<span class="chip">${eq.map(e => lib.EQUIP_LABEL[e]).join(', ')}</span>` : '<span class="chip">No equipment</span>'}
        ${(w.schedule || []).length ? `<span class="chip">${icon('cal')}${w.schedule.map(d => DAYS[d]).join(' ')}</span>` : ''}</div>
      <p class="desc">${esc(w.description || musclesLine(w))}</p>
      <div class="acts">
        <a class="btn primary sm" href="#/workout/${encodeURIComponent(w.id)}">${icon('play')}Start</a>
        <a class="btn sm" href="#/workouts/${encodeURIComponent(w.id)}">Details</a>
        ${w.template ? `<button class="btn sm ghost" data-custom="${w.id}">${icon('copy')}Customize</button>` : `<a class="btn sm ghost" href="#/builder/${encodeURIComponent(w.id)}">${icon('edit')}Edit</a><button class="btn sm ghost" data-dup="${w.id}">${icon('copy')}Duplicate</button><button class="btn sm ghost" data-del="${w.id}" aria-label="Delete ${esc(w.name)}">${icon('trash')}</button>`}
      </div></article>`;
  }
  const musclesLine = w => 'Works: ' + wk.musclesOf(w).slice(0, 4).join(', ');

  function listView(root) {
    const mine = GF.store.workouts();
    if (!tabChosen && !mine.length) tab = 'templates';
    root.innerHTML = `
      <header class="page-head"><div><h1>Workouts</h1><p>Pick one and press play.</p></div><a class="btn primary" href="#/builder">${icon('plus')}New workout</a></header>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="mine" aria-selected="${tab === 'mine'}">My workouts (${mine.length})</button>
        <button role="tab" data-tab="templates" aria-selected="${tab === 'templates'}">Templates</button>
        <button role="tab" data-tab="exercises" aria-selected="${tab === 'exercises'}">Exercise library</button>
      </div>
      <div class="filters">
        <input type="search" placeholder="Search" aria-label="Search" data-q style="max-width:260px">
        ${tab !== 'exercises' ? `<select data-cat aria-label="Category"><option value="">All types</option><option value="strength">Strength</option><option value="conditioning">Conditioning</option><option value="mobility">Mobility</option></select>
        <select data-lvl aria-label="Level"><option value="">All levels</option><option>beginner</option><option>intermediate</option><option>advanced</option></select>`
        : `<select data-cat aria-label="Category"><option value="">All categories</option>${Object.entries(lib.CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
           <label class="switch small"><input type="checkbox" data-tracked> Camera-checked only</label>`}
        <label class="switch small"><input type="checkbox" data-mine> Only equipment I have</label>
      </div>
      <div data-results></div>`;
    const results = root.querySelector('[data-results]');
    let sig = null, stopFig = null;
    function update(force) {
      const q = root.querySelector('[data-q]').value.toLowerCase(), cat = root.querySelector('[data-cat]').value;
      const nsig = [q, cat, root.querySelector('[data-lvl]') ? root.querySelector('[data-lvl]').value : '', root.querySelector('[data-mine]').checked, root.querySelector('[data-tracked]') ? root.querySelector('[data-tracked]').checked : ''].join('|');
      if (nsig === sig && force !== true) return; sig = nsig;
      const lvl = root.querySelector('[data-lvl]') ? root.querySelector('[data-lvl]').value : '';
      const onlyMine = root.querySelector('[data-mine]').checked, owned = GF.store.settings.equipment || [];
      if (tab === 'exercises') {
        const tr = root.querySelector('[data-tracked]').checked;
        const list = lib.list.filter(e => (!cat || e.cat.includes(cat)) && (!tr || e.track) && (!onlyMine || lib.hasEquipment(e, owned)) && (!q || (e.name + ' ' + e.muscles.p.join(' ') + ' ' + e.muscles.s.join(' ')).toLowerCase().includes(q)));
        results.innerHTML = `<p class="small muted">${list.length} exercises. Camera form checks cover ${lib.list.filter(e => e.track).length} of them — the rest are logged manually.</p>
          <div class="panel tight"><ul class="list">${list.map(e => `<li>${lib.demoOf(e) ? `<canvas class="thumb" data-fig="${e.id}" aria-hidden="true"></canvas>` : `<span class="thumb ph">${icon('target')}</span>`}<div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(GF.ui.muscleText(e))} · ${lib.EQUIP_LABEL[e.equip]} · ${lib.LEVELS[e.level]}${lib.demoOf(e) ? ' · 3D demo' : ''}</div></div>${GF.ui.trackBadge(e, true)}<button class="btn sm" data-ex="${e.id}">View</button></li>`).join('')}</ul></div>`;
        if (stopFig) stopFig(); stopFig = GF.art.animateFigures(results, 0.5);
        return;
      }
      const src = tab === 'mine' ? mine : wk.TEMPLATES;
      const list = src.filter(w => (!cat || w.category === cat) && (!lvl || w.level === lvl) && (!q || w.name.toLowerCase().includes(q))
        && (!onlyMine || wk.equipmentOf(w).every(e => lib.hasEquipment({ equip: e }, owned))));
      results.innerHTML = list.length ? `<div class="wk-list">${list.map(card).join('')}</div>`
        : tab === 'mine' && !mine.length ? `<div class="empty"><p>You haven't created any workouts yet.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#/builder">${icon('plus')}Build a workout</a><button class="btn" data-tab="templates">Start from a template</button></div></div>`
          : '<div class="empty">No workouts match these filters.</div>';
      if (stopFig) stopFig(); stopFig = GF.art.animateFigures(results, 0.5);
    }
    root.addEventListener('input', () => update()); root.addEventListener('change', () => update());
    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; tabChosen = true; GF.rerender(); return; }
      const x = e.target.closest('[data-ex]'); if (x) GF.ui.exerciseDetail(x.dataset.ex);
      const c = e.target.closest('[data-custom]'); if (c) { const copy = wk.duplicate(wk.find(c.dataset.custom)); const saved = GF.store.saveWorkout(copy, 'Created from template'); toast('Copied to My workouts'); GF.go('builder/' + saved.id); }
      const d = e.target.closest('[data-dup]'); if (d) { const w = GF.store.workout(d.dataset.dup); GF.store.saveWorkout(wk.duplicate(w)); toast('Workout duplicated'); GF.rerender(); }
      const del = e.target.closest('[data-del]'); if (del) {
        const w = GF.store.workout(del.dataset.del);
        if (await confirmDialog('Delete workout?', `"${w.name}" will be removed from this device. Your past session history is kept.`, 'Delete', true)) { GF.store.deleteWorkout(w.id); toast('Workout deleted'); GF.rerender(); }
      }
    });
    update();
  }

  function detailView(root, id) {
    const w = wk.find(id);
    if (!w) { root.innerHTML = `<div class="empty">This workout no longer exists. <a href="#/workouts">Back to workouts</a></div>`; return; }
    const v = wk.validate(w, GF.store.settings);
    const adapts = GF.store.adaptations().filter(a => a.workoutId === w.id).slice().reverse();
    const itemRow = it => {
      const e = lib.get(it.exId);
      return `<li>${lib.demoOf(e) ? `<canvas class="thumb" data-fig="${e.id}" aria-hidden="true"></canvas>` : `<span class="thumb ph">${icon('target')}</span>`}<div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${it.sets ? it.sets + ' × ' : ''}${it.mode === 'time' ? it.duration + ' s' : it.reps + ' reps'} · rest ${it.rest}s${it.tempo ? ' · tempo ' + esc(it.tempo) : ''}${it.notes ? ' · ' + esc(it.notes) : ''}</div></div>${GF.ui.trackBadge(e, true)}<button class="btn sm ghost" data-ex="${e.id}">${icon('cube')}Demo</button></li>`;
    };
    root.innerHTML = `
      <p><a href="#/workouts" class="btn ghost sm">${icon('left')}Workouts</a></p>
      <header class="page-head"><div><h1>${esc(w.name)}</h1><p>${esc(w.description || '')}</p>
        <div class="row" style="margin-top:10px"><span class="chip">${fmtMin(wk.estimateSeconds(w))}</span><span class="chip">${GF.ui.cap(w.level || '')}</span><span class="chip">${wk.trackedCount(w)}/${wk.allExerciseItems(w).length} camera-checked</span>${w.template ? '<span class="chip">Template</span>' : ''}</div></div>
        <div class="row"><a class="btn primary lg" href="#/workout/${encodeURIComponent(w.id)}">${icon('play')}Start</a>${w.template ? `<button class="btn" data-custom>${icon('copy')}Customize</button>` : `<a class="btn" href="#/builder/${encodeURIComponent(w.id)}">${icon('edit')}Edit</a>`}</div></header>
      ${v.warnings.length ? `<div class="warnings">${v.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="grid g-main">
        <div class="stack">${w.blocks.filter(b => b.items.length).map(b => `<section class="panel"><div class="panel-head"><h2>${wk.BLOCK_LABEL[b.type]}</h2></div>${b.items.map(it => {
          if (it.kind === 'exercise') return `<ul class="list">${itemRow(it)}</ul>`;
          if (it.kind === 'rest') return `<p class="muted small">${icon('clock')} Recovery: ${it.duration} s</p>`;
          return `<div class="group"><div class="group-head"><strong>${it.type === 'superset' ? 'Superset' : 'Circuit'} · ${it.rounds} rounds</strong><span class="small muted">${it.restAfterRound}s rest after each round</span></div><ul class="list">${it.items.map(itemRow).join('')}</ul></div>`;
        }).join('')}</section>`).join('')}</div>
        <div class="stack">
          <section class="panel"><h2 style="margin-bottom:10px">Muscles</h2>${GF.bodymap.render(wk.allExerciseItems(w).reduce((m, i) => { const e = lib.get(i.exId); return e ? GF.bodymap.add(m, e.muscles, i.sets || 1) : m; }, {}), { compact: true })}
            <h2 style="margin:16px 0 10px">Schedule</h2><p class="small muted">${(w.schedule || []).length ? w.schedule.map(d => DAYS[d]).join(', ') : 'Not scheduled'}${w.template ? '' : ' — change in the builder.'}</p></section>
          ${!w.template ? `<section class="panel"><h2 style="margin-bottom:10px">Change history</h2>
            ${adapts.length || (w.revisions || []).length ? `<ul class="list">${(w.revisions || []).map((r, i) => ({ r, i })).reverse().map(({ r, i }) => `<li><div class="grow"><div class="title small">${esc(r.note)}</div><div class="sub">${fmtDate(r.at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div><button class="btn sm ghost" data-restore="${i}">Restore earlier</button></li>`).join('')}</ul>`
              : '<p class="small muted">No changes yet. Edits and accepted suggestions appear here, and earlier versions can be restored.</p>'}</section>` : ''}
        </div>
      </div>`;
    const stopDetail = GF.art.animateFigures(root, 0.5);
    root.addEventListener('click', async e => {
      const x = e.target.closest('[data-ex]'); if (x) GF.ui.exerciseDetail(x.dataset.ex);
      if (e.target.closest('[data-custom]')) { const saved = GF.store.saveWorkout(wk.duplicate(w), 'Created from template'); toast('Copied to My workouts'); GF.go('builder/' + saved.id); }
      const r = e.target.closest('[data-restore]');
      if (r && await confirmDialog('Restore earlier version?', 'The current version is kept in the history, so you can switch back.', 'Restore')) { GF.store.restoreRevision(w.id, +r.dataset.restore); toast('Earlier version restored'); GF.rerender(); }
    });
  }

  GF.views.workouts = { render(root, params) { if (params[0]) detailView(root, params[0]); else listView(root); } };
})(window.GF = window.GF || {});
