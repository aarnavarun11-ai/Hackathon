/* GhostFit – Custom workout builder
   Create from scratch: warm-up / main / cool-down blocks, exercises, supersets, circuits and
   rest periods; reorder (buttons or drag), duplicate, replace (keeps parameters), remove,
   per-exercise sets/reps/duration/rest/tempo/difficulty/notes, schedule, validation. */
(function (GF) {
  'use strict';
  const { esc, icon, clone, DAYS, toast, confirmDialog } = GF.u;
  GF.views = GF.views || {};
  const wk = GF.wk, lib = GF.lib;
  const drafts = {};

  function render(root, params) {
    const id = params[0];
    let source = id ? wk.find(id) : null;
    if (id && !source) { root.innerHTML = `<div class="empty">Workout not found. <a href="#/builder">Start a new one</a></div>`; return; }
    const key = id || 'new';
    let w = drafts[key] ? drafts[key] : (source ? (source.template ? wk.duplicate(source) : clone(source)) : wk.newWorkout(''));
    const restored = !!drafts[key];
    let dirty = restored, showErrors = false, dragPath = null;
    const openIds = new Set();

    const getList = path => { const [b, i] = path.split('.').map(Number); return i === undefined || isNaN(i) ? w.blocks[b].items : w.blocks[b].items[i].items; };
    function at(path) {
      const p = path.split('.').map(Number);
      if (p.length === 2) return { list: w.blocks[p[0]].items, idx: p[1], item: w.blocks[p[0]].items[p[1]] };
      const g = w.blocks[p[0]].items[p[1]];
      return { list: g.items, idx: p[2], item: g.items[p[2]], group: g };
    }
    const touch = () => { dirty = true; drafts[key] = w; };

    function exRow(it, path, inGroup) {
      const e = lib.get(it.exId) || { name: it.exId, muscles: { p: [], s: [] } };
      const n = path.split('.').length;
      return `<div class="item" draggable="true" data-path="${path}">
        <span class="handle" title="Drag to reorder" aria-hidden="true">${icon('grip')}</span>
        <div class="nm">${esc(e.name)}<div class="sub">${GF.ui.trackBadge(e, true)}<span>${esc(e.muscles.p.join(', '))}</span></div></div>
        <div class="params">
          ${!inGroup ? `<label>Sets<input type="number" min="1" max="20" value="${it.sets}" data-f="sets" data-path="${path}" aria-label="Sets for ${esc(e.name)}"></label>` : ''}
          <label>Type<select data-f="mode" data-path="${path}" aria-label="Reps or time for ${esc(e.name)}"><option value="reps" ${it.mode === 'reps' ? 'selected' : ''}>Reps</option><option value="time" ${it.mode === 'time' ? 'selected' : ''}>Time</option></select></label>
          ${it.mode === 'reps' ? `<label>Reps<input type="number" min="1" max="200" value="${it.reps}" data-f="reps" data-path="${path}" aria-label="Reps for ${esc(e.name)}"></label>`
            : `<label>Seconds<input type="number" min="5" max="1800" step="5" value="${it.duration}" data-f="duration" data-path="${path}" aria-label="Seconds for ${esc(e.name)}"></label>`}
          <label>${inGroup ? 'Rest after' : 'Rest (s)'}<input type="number" min="0" max="600" step="5" value="${it.rest}" data-f="rest" data-path="${path}" aria-label="Rest seconds for ${esc(e.name)}"></label>
          ${(openIds.has(it.id) || it.tempo || it.notes || it.difficulty) ? `
          <label>Tempo<input type="text" placeholder="e.g. 3-1-1" value="${esc(it.tempo)}" data-f="tempo" data-path="${path}" style="width:84px" aria-label="Tempo for ${esc(e.name)}"></label>
          <label>Difficulty<select data-f="difficulty" data-path="${path}" style="width:104px" aria-label="Difficulty for ${esc(e.name)}">${['', 'Easy', 'Moderate', 'Hard'].map(d => `<option value="${d}" ${it.difficulty === d ? 'selected' : ''}>${d || '—'}</option>`).join('')}</select></label>
          <label style="flex:1;min-width:120px">Notes<input type="text" placeholder="Coaching note" value="${esc(it.notes)}" data-f="notes" data-path="${path}" style="width:100%" aria-label="Notes for ${esc(e.name)}"></label>`
          : `<button class="btn sm ghost" data-act="more" data-id="${it.id}" aria-label="More options for ${esc(e.name)}: tempo, difficulty, notes">More…</button>`}
        </div>
        <div class="acts">
          <button class="icon-btn sm" data-act="up" data-path="${path}" aria-label="Move ${esc(e.name)} up" ${+path.split('.')[n - 1] === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="icon-btn sm" data-act="down" data-path="${path}" aria-label="Move ${esc(e.name)} down">${icon('down')}</button>
          <button class="icon-btn sm" data-act="replace" data-path="${path}" aria-label="Replace ${esc(e.name)}" title="Replace (keeps sets, reps and rest)">${icon('swap')}</button>
          <button class="icon-btn sm" data-act="dup" data-path="${path}" aria-label="Duplicate ${esc(e.name)}">${icon('copy')}</button>
          <button class="icon-btn sm" data-act="info" data-ex="${it.exId}" aria-label="Details for ${esc(e.name)}">${icon('info')}</button>
          <button class="icon-btn sm" data-act="remove" data-path="${path}" aria-label="Remove ${esc(e.name)}">${icon('trash')}</button>
        </div></div>`;
    }
    function itemHtml(it, b, i) {
      const path = `${b}.${i}`;
      if (it.kind === 'exercise') return exRow(it, path, false);
      if (it.kind === 'rest') return `<div class="item" draggable="true" data-path="${path}"><span class="handle" aria-hidden="true">${icon('grip')}</span><div class="nm">${icon('clock')} Recovery period</div>
        <div class="params"><label>Seconds<input type="number" min="5" max="900" step="5" value="${it.duration}" data-f="duration" data-path="${path}" aria-label="Recovery seconds"></label></div>
        <div class="acts"><button class="icon-btn sm" data-act="up" data-path="${path}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="icon-btn sm" data-act="down" data-path="${path}" aria-label="Move down">${icon('down')}</button><button class="icon-btn sm" data-act="remove" data-path="${path}" aria-label="Remove recovery period">${icon('trash')}</button></div></div>`;
      const label = it.type === 'superset' ? 'Superset' : 'Circuit';
      return `<div class="group" draggable="true" data-path="${path}">
        <div class="group-head">
          <div class="row"><span class="handle" aria-hidden="true">${icon('grip')}</span><strong>${label}</strong><span class="small muted">${it.type === 'superset' ? 'Exercises back-to-back' : 'Exercises in rotation'}, then rest</span></div>
          <div class="params">
            <label>Type<select data-f="type" data-path="${path}" aria-label="Group type"><option value="superset" ${it.type === 'superset' ? 'selected' : ''}>Superset</option><option value="circuit" ${it.type === 'circuit' ? 'selected' : ''}>Circuit</option></select></label>
            <label>Rounds<input type="number" min="1" max="20" value="${it.rounds}" data-f="rounds" data-path="${path}" aria-label="${label} rounds"></label>
            <label>Rest after round<input type="number" min="0" max="600" step="5" value="${it.restAfterRound}" data-f="restAfterRound" data-path="${path}" aria-label="${label} rest after round"></label>
            <button class="icon-btn sm" data-act="up" data-path="${path}" aria-label="Move ${label} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
            <button class="icon-btn sm" data-act="down" data-path="${path}" aria-label="Move ${label} down">${icon('down')}</button>
            <button class="icon-btn sm" data-act="dup" data-path="${path}" aria-label="Duplicate ${label}">${icon('copy')}</button>
            <button class="icon-btn sm" data-act="remove" data-path="${path}" aria-label="Remove ${label}">${icon('trash')}</button>
          </div></div>
        ${it.items.map((c, ci) => exRow(c, `${b}.${i}.${ci}`, true)).join('') || `<p class="small muted" style="padding:8px">Add at least two exercises.</p>`}
        <div style="padding:6px 4px"><button class="btn sm" data-act="add-to-group" data-path="${path}">${icon('plus')}Add to ${label.toLowerCase()}</button></div>
      </div>`;
    }

    function draw() {
      const v = wk.validate(w, GF.store.settings);
      const est = wk.estimateSeconds(w);
      root.innerHTML = `
        <header class="page-head"><div><h1>${id && !source.template ? 'Edit workout' : 'Build a workout'}</h1><p>${source && source.template ? `Customising a copy of "${esc(source.name)}" — the template stays unchanged.` : 'Everything is editable. Nothing changes until you save.'}</p></div>
          <div class="row"><span class="chip">${icon('clock')}About ${Math.round(est / 60)} min</span><span class="chip">${wk.allExerciseItems(w).length} exercises</span></div></header>
        ${restored ? `<div class="banner" role="status">Unsaved changes were restored. <button class="btn sm ghost" data-act="discard">Discard them</button></div><br>` : ''}
        ${showErrors && v.errors.length ? `<div class="errors" role="alert"><strong>Please fix before saving:</strong><ul>${v.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${v.warnings.length ? `<div class="warnings" role="status">${v.warnings.map(esc).join('<br>')}</div>` : ''}
        <div class="builder-top">
          <label class="field">Workout name<input type="text" value="${esc(w.name)}" data-top="name" placeholder="e.g. Tuesday upper body" maxlength="80" required></label>
          <label class="field">Type<select data-top="category">${['strength', 'conditioning', 'mobility', 'endurance', 'flexibility'].map(c => `<option value="${c}" ${w.category === c ? 'selected' : ''}>${GF.ui.cap(c)}</option>`).join('')}</select></label>
          <label class="field">Level<select data-top="level">${['beginner', 'intermediate', 'advanced'].map(c => `<option value="${c}" ${w.level === c ? 'selected' : ''}>${GF.ui.cap(c)}</option>`).join('')}</select></label>
        </div>
        <div class="grid g2" style="margin-bottom:16px">
          <label class="field">Description (optional)<input type="text" value="${esc(w.description || '')}" data-top="description" maxlength="200"></label>
          <div class="field"><span>Schedule</span><div class="day-picks" role="group" aria-label="Schedule days">${DAYS.map((d, i) => `<button data-day="${i}" aria-pressed="${(w.schedule || []).includes(i)}">${d}</button>`).join('')}</div></div>
        </div>
        ${w.blocks.map((b, bi) => `<section class="block" aria-label="${wk.BLOCK_LABEL[b.type]}">
          <div class="block-head"><h3>${wk.BLOCK_LABEL[b.type]}</h3><span class="small muted">${b.items.length ? '' : b.type === 'main' ? 'Your main exercises' : 'Optional'}</span></div>
          <div class="block-body" data-list="${bi}">${b.items.map((it, i) => itemHtml(it, bi, i)).join('') || `<p class="small faint" style="padding:8px 6px">Empty</p>`}</div>
          <div class="block-foot">
            <button class="btn sm" data-act="add" data-b="${bi}">${icon('plus')}Exercise</button>
            ${b.type === 'main' ? `<button class="btn sm ghost" data-act="add-group" data-type="superset" data-b="${bi}">${icon('plus')}Superset</button><button class="btn sm ghost" data-act="add-group" data-type="circuit" data-b="${bi}">${icon('plus')}Circuit</button>` : ''}
            <button class="btn sm ghost" data-act="add-rest" data-b="${bi}">${icon('clock')}Recovery period</button>
          </div></section>`).join('')}
        <div class="row end" style="margin-top:8px">
          <button class="btn ghost" data-act="cancel">Cancel</button>
          <button class="btn" data-act="save">Save</button>
          <button class="btn primary" data-act="save-start">${icon('play')}Save &amp; start</button>
        </div>`;
    }

    async function onClick(e) {
      const day = e.target.closest('[data-day]');
      if (day) { const d = +day.dataset.day; w.schedule = (w.schedule || []).includes(d) ? w.schedule.filter(x => x !== d) : [...(w.schedule || []), d].sort(); touch(); draw(); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, path = b.dataset.path;
      if (act === 'info') return GF.ui.exerciseDetail(b.dataset.ex);
      if (act === 'more') { openIds.add(b.dataset.id); draw(); const f = root.querySelector(`[data-f=tempo][data-path]`); return; }
      if (act === 'add') { const ex = await GF.ui.pickExercise(); if (ex) { w.blocks[+b.dataset.b].items.push(wk.exItem(ex)); touch(); draw(); } return; }
      if (act === 'add-group') { w.blocks[+b.dataset.b].items.push(wk.group(b.dataset.type, [], { rounds: 3, restAfterRound: 60 })); touch(); draw(); return; }
      if (act === 'add-rest') { w.blocks[+b.dataset.b].items.push(wk.restItem(60)); touch(); draw(); return; }
      if (act === 'add-to-group') { const ex = await GF.ui.pickExercise({ title: 'Add to group' }); if (ex) { at(path).item.items.push(wk.exItem(ex, { rest: 0 })); touch(); draw(); } return; }
      if (act === 'discard') { delete drafts[key]; GF.rerender(); return; }
      if (act === 'cancel') {
        if (dirty && !(await confirmDialog('Discard changes?', 'Your unsaved changes to this workout will be lost.', 'Discard', true))) return;
        delete drafts[key]; dirty = false; GF.go(id && !source.template ? 'workouts/' + id : 'workouts'); return;
      }
      if (act === 'save' || act === 'save-start') {
        const v = wk.validate(w, GF.store.settings);
        if (v.errors.length) { showErrors = true; draw(); root.querySelector('.errors').scrollIntoView({ block: 'center' }); GF.u.announce('Please fix the errors before saving'); return; }
        const saved = GF.store.saveWorkout(w, w.id ? 'Edited in builder' : undefined);
        delete drafts[key]; dirty = false; toast('Workout saved');
        GF.go(act === 'save-start' ? 'workout/' + saved.id : 'workouts/' + saved.id); return;
      }
      if (!path) return;
      const loc = at(path);
      if (act === 'up' && loc.idx > 0) { [loc.list[loc.idx - 1], loc.list[loc.idx]] = [loc.list[loc.idx], loc.list[loc.idx - 1]]; }
      if (act === 'down' && loc.idx < loc.list.length - 1) { [loc.list[loc.idx + 1], loc.list[loc.idx]] = [loc.list[loc.idx], loc.list[loc.idx + 1]]; }
      if (act === 'dup') { const c = clone(loc.item); c.id = GF.u.uid('i'); if (c.items) c.items.forEach(x => { x.id = GF.u.uid('i'); }); loc.list.splice(loc.idx + 1, 0, c); }
      if (act === 'remove') { loc.list.splice(loc.idx, 1); }
      if (act === 'replace') {
        const ex = await GF.ui.pickExercise({ title: 'Replace exercise', current: loc.item.exId });
        if (!ex) return;
        const ne = lib.get(ex); loc.item.exId = ex;
        if (ne.mode !== loc.item.mode) { // keep everything else; switch counting type to what the new exercise needs
          loc.item.mode = ne.mode;
          if (ne.mode === 'time' && !loc.item.duration) loc.item.duration = ne.def.duration || 30;
          if (ne.mode === 'reps' && !loc.item.reps) loc.item.reps = ne.def.reps || 10;
          toast(`${ne.name} is ${ne.mode === 'time' ? 'timed' : 'rep-based'} — counting type switched, other settings kept`);
        }
      }
      touch(); draw();
      const again = root.querySelector(`[data-act="${act}"][data-path="${act === 'up' ? path.replace(/\d+$/, n => Math.max(0, n - 1)) : act === 'down' ? path.replace(/\d+$/, n => +n + 1) : path}"]`);
      if (again && (act === 'up' || act === 'down')) again.focus();
    }
    function onChange(e) {
      const t = e.target;
      if (t.dataset.top) { w[t.dataset.top] = t.value; touch(); if (t.dataset.top !== 'name' && t.dataset.top !== 'description') draw(); return; }
      if (!t.dataset.f || !t.dataset.path) return;
      const { item } = at(t.dataset.path);
      const f = t.dataset.f;
      item[f] = ['sets', 'reps', 'duration', 'rest', 'rounds', 'restAfterRound'].includes(f) ? (t.value === '' ? '' : Number(t.value)) : t.value;
      touch();
      if (f === 'mode' || f === 'type') draw();
    }
    function onInput(e) { if (e.target.dataset.top === 'name' || e.target.dataset.top === 'description') { w[e.target.dataset.top] = e.target.value; touch(); } }

    // drag & drop reordering (keyboard users use the arrow buttons)
    function onDragStart(e) { const el = e.target.closest('[data-path][draggable]'); if (!el) return; dragPath = el.dataset.path; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragPath); }
    function onDragOver(e) { const el = e.target.closest('[data-path][draggable]'); if (!el || !dragPath) return; e.preventDefault(); root.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over')); el.classList.add('drag-over'); }
    function onDrop(e) {
      const el = e.target.closest('[data-path][draggable]'); if (!el || !dragPath) return;
      e.preventDefault();
      const from = dragPath.split('.'), to = el.dataset.path.split('.'); dragPath = null;
      if (from.length !== to.length) return;                                       // only within the same level
      if (from.length === 3 && (from[0] !== to[0] || from[1] !== to[1])) return;   // group children stay in their group
      const src = at(from.join('.')), dst = at(to.join('.'));
      const [moved] = src.list.splice(src.idx, 1);
      let idx = dst.idx; if (src.list === dst.list && src.idx < dst.idx) idx--;
      dst.list.splice(idx, 0, moved);
      touch(); draw();
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('dragstart', onDragStart);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragend', () => { dragPath = null; root.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over')); });
    draw();
    void getList;
    return () => { if (dirty) drafts[key] = w; };
  }
  GF.views.builder = { render };
})(window.GF = window.GF || {});
