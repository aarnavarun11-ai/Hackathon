/* GhostFit – shared UI components: exercise detail (3D), exercise picker, badges */
(function (GF) {
  'use strict';
  const { esc, icon, modal } = GF.u;
  const lib = GF.lib;

  function trackBadge(e, short) {
    return e.track
      ? `<span class="chip accent" title="The camera can count reps and check form for this exercise">${icon('eye')}${short ? 'Camera check' : 'Camera form check'}</span>`
      : `<span class="chip" title="No camera form check — you log sets yourself">${short ? 'Manual' : 'Manual logging'}</span>`;
  }
  const muscleText = e => [...e.muscles.p, ...e.muscles.s.slice(0, 2)].join(', ');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- exercise detail with 3D viewer ---------- */
  function exerciseDetail(exId) {
    const e = lib.get(exId); if (!e) return;
    const demo = lib.demoOf(e);
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="ex-detail">
        <div>
          ${demo ? `<div class="viewer" id="vw">
              <span class="viewer-note">${icon('cam')} Recommended camera: ${demo.view === 'side' ? 'side view' : 'front view'}</span>
              <span class="viewer-legend"><span><i style="background:#14b8a6"></i>Measured / path</span><span><i style="background:#f97316"></i>Camera spot</span></span>
              <div class="viewer-ctrl">
                <div class="seg" role="group" aria-label="Viewing angle">
                  <button data-view="front" aria-pressed="false">Front</button><button data-view="side" aria-pressed="false">Side</button><button data-view="rear" aria-pressed="false">Rear</button><button data-view="angle" aria-pressed="false">3/4</button>
                </div>
                <div class="seg"><button data-play aria-pressed="true">${icon('pause')}<span class="sr-only">Play or pause</span></button><button data-speed="0.5" aria-pressed="false">0.5×</button><button data-speed="1" aria-pressed="true">1×</button></div>
              </div>
            </div>
            <p class="small faint" style="margin-top:8px">Drag to rotate · scroll to zoom · arrow keys rotate when focused. Demonstration only — your body proportions and range may differ.</p>`
          : `<div class="empty">No animated demonstration for this exercise yet. Follow the written steps.</div>`}
        </div>
        <div>
          <div class="row" style="margin-bottom:12px">${trackBadge(e)}<span class="chip">${lib.LEVELS[e.level]}</span><span class="chip">${lib.EQUIP_LABEL[e.equip]}</span><span class="chip">${e.impact === 'high' ? 'Higher impact' : 'Low impact'}</span></div>
          <p class="small"><span class="muted">Primary:</span> ${esc(e.muscles.p.map(cap).join(', '))}${e.muscles.s.length ? ` · <span class="muted">Also:</span> ${esc(e.muscles.s.join(', '))}` : ''}</p>
          <h3 style="margin:14px 0 6px">How to do it</h3>
          <ol class="steps-ol">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          ${e.mistakes.length ? `<h3 style="margin:14px 0 6px">Common mistakes</h3><ul class="plain">${e.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
          ${e.tips.length ? `<p class="note">${esc(e.tips.join(' '))}</p>` : ''}
          ${e.track ? `<p class="small muted">${icon('cam')} For camera tracking: ${e.view === 'side' ? 'stand side-on to the camera' : 'face the camera'}${e.floor ? ', with the camera low' : ''}, about 2–3 m away, whole ${GF.EX[e.track].need.some(n => /ankle|knee/.test(n)) ? 'body' : 'upper body'} in view.</p>` : ''}
          ${(e.easier.length || e.alt.length) ? `<h3 style="margin:14px 0 6px">Alternatives</h3><div class="row">${[...new Set([...e.easier, ...e.alt])].map(id => lib.get(id) ? `<button class="chip" data-open="${id}">${esc(lib.get(id).name)}${e.easier.includes(id) ? ' · easier' : ''}</button>` : '').join('')}</div>` : ''}
        </div>
      </div>`;
    let viewer = null, t2d = null;
    const m = modal({ title: e.name, body, wide: true, onClose: () => { if (viewer) viewer.dispose(); if (t2d) cancelAnimationFrame(t2d); } });
    body.addEventListener('click', ev => {
      const o = ev.target.closest('[data-open]'); if (o) { m.close(); exerciseDetail(o.dataset.open); return; }
      if (!viewer) return;
      const v = ev.target.closest('[data-view]'); if (v) { viewer.setView(v.dataset.view); body.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b === v)); }
      const p = ev.target.closest('[data-play]'); if (p) { const on = viewer.toggle(); p.innerHTML = icon(on ? 'pause' : 'play') + '<span class="sr-only">Play or pause</span>'; p.setAttribute('aria-pressed', on); }
      const s = ev.target.closest('[data-speed]'); if (s) { viewer.setSpeed(+s.dataset.speed); body.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', b === s)); }
    });
    if (demo) {
      const host = body.querySelector('#vw');
      GF.viewer3d.create(host, e, { autoplay: true }).then(v => {
        viewer = v; if (!document.body.contains(host)) { v.dispose(); return; }
        if (!v.playing) { const p = body.querySelector('[data-play]'); p.innerHTML = icon('play') + '<span class="sr-only">Play or pause</span>'; p.setAttribute('aria-pressed', 'false'); }
      }).catch(err => {
        console.warn(err);
        host.innerHTML = '<canvas class="demo2d" aria-label="2D demonstration"></canvas><span class="viewer-note">3D unavailable on this device — showing 2D</span>';
        const c = host.querySelector('canvas'); const t0 = performance.now();
        const loop = () => { if (!document.body.contains(c)) return; GF.viewer3d.draw2D(c, e, (performance.now() - t0) / 1000); t2d = requestAnimationFrame(loop); };
        loop();
      });
    }
  }

  /* ---------- exercise picker ---------- */
  function pickExercise({ title = 'Add exercise', current = null } = {}) {
    return new Promise(resolve => {
      const owned = GF.store.settings.equipment || [];
      const body = document.createElement('div');
      body.innerHTML = `
        <div class="picker-tools">
          <input type="search" placeholder="Search exercises or muscles" aria-label="Search exercises" autofocus>
          <select data-f="cat" aria-label="Category"><option value="">All categories</option>${Object.entries(lib.CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select data-f="equip" aria-label="Equipment"><option value="">Any equipment</option><option value="mine">Equipment I have</option>${Object.entries(lib.EQUIP_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <label class="switch small"><input type="checkbox" data-f="tracked"> Camera-checked only</label>
        </div>
        ${current ? `<p class="small muted">Replacing <strong>${esc(lib.get(current).name)}</strong>. Sets, reps and rest are kept.</p>` : ''}
        <ul class="list picker-list" aria-label="Exercises"></ul>`;
      let chosen = null;
      const m = modal({ title, body, wide: true, onClose: () => resolve(chosen) });
      const ul = body.querySelector('ul'), q = body.querySelector('input[type=search]');
      let sig = null;
      function render() {
        const text = q.value.trim().toLowerCase(), cat = body.querySelector('[data-f=cat]').value, eq = body.querySelector('[data-f=equip]').value, tr = body.querySelector('[data-f=tracked]').checked;
        const nsig = [text, cat, eq, tr].join('|'); if (nsig === sig) return; sig = nsig;
        let list = lib.list.filter(e => (!cat || e.cat.includes(cat)) && (!tr || e.track) && (!eq || (eq === 'mine' ? lib.hasEquipment(e, owned) : e.equip === eq))
          && (!text || (e.name + ' ' + e.aliases.join(' ') + ' ' + e.muscles.p.join(' ') + ' ' + e.muscles.s.join(' ')).toLowerCase().includes(text)));
        if (current) { const c = lib.get(current); list.sort((a, b) => (c.alt.concat(c.easier, c.harder).includes(b.id) ? 1 : 0) - (c.alt.concat(c.easier, c.harder).includes(a.id) ? 1 : 0)); }
        ul.innerHTML = list.length ? list.map(e => `<li>
            <div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(muscleText(e))} · ${lib.EQUIP_LABEL[e.equip]} · ${lib.LEVELS[e.level]}</div></div>
            ${trackBadge(e, true)}
            <button class="btn sm ghost" data-info="${e.id}" aria-label="Details for ${esc(e.name)}">${icon('info')}</button>
            <button class="btn sm" data-pick="${e.id}">${current ? 'Use' : 'Add'}</button></li>`).join('')
          : '<li class="muted">No exercises match.</li>';
      }
      body.addEventListener('input', render); body.addEventListener('change', render);
      body.addEventListener('click', ev => {
        const p = ev.target.closest('[data-pick]'); if (p) { chosen = p.dataset.pick; m.close(); }
        const i = ev.target.closest('[data-info]'); if (i) exerciseDetail(i.dataset.info);
      });
      render();
    });
  }

  /* ---------- session summary text helpers ---------- */
  function sourceLabel(src) { return { camera: 'Camera-counted (estimate)', manual: 'Logged by you', timer: 'Timer', simulated: 'Simulated demo' }[src] || src; }

  GF.ui = { trackBadge, exerciseDetail, pickExercise, muscleText, sourceLabel, cap };
})(window.GF = window.GF || {});
