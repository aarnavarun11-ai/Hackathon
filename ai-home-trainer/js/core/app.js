/* GhostFit – app shell: routing, navigation, global status indicators, settings application */
(function (GF) {
  'use strict';
  const { $, icon, bus } = GF.u;
  const NAV = [
    ['dashboard', 'Home', 'home'], ['workouts', 'Workouts', 'list'],
    ['rehab', 'Rehab', 'heart'], ['coach', 'AI Coach', 'chat'], ['progress', 'Progress', 'chart'], ['settings', 'Settings', 'gear'],
  ];
  const VIEWS = {
    dashboard: GF.views.dashboard, workouts: GF.views.workouts, builder: GF.views.builder,
    rehab: GF.views.rehab, coach: GF.views.coach, progress: GF.views.progress, settings: GF.views.settings,
  };

  document.querySelectorAll('[data-nav]').forEach(a => { const n = NAV.find(x => x[0] === a.dataset.nav); if (n) a.innerHTML = `${icon(n[2])}<span>${n[1]}</span>`; else a.remove(); });

  let cleanup = null, current = '';
  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [name, ...rest] = hash.split('/');
    const params = rest.map(decodeURIComponent);

    // active workout runs as a full-screen layer on top of the app
    if (name === 'workout') { GF.views.session.open(params[0], { demo: params.includes('demo') }); return; }
    if (GF.views.session.isOpen()) GF.views.session.close('navigate');

    const view = VIEWS[name] || VIEWS.dashboard;
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    const root = $('#view');
    root.innerHTML = '';
    current = name;
    document.querySelectorAll('[data-nav]').forEach(a => {
      const active = name === 'builder' ? 'workouts' : (VIEWS[name] ? name : 'dashboard');
      if (a.dataset.nav === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const page = document.createElement('div'); page.className = 'page'; root.appendChild(page);
    try { cleanup = view.render(page, params) || null; }
    catch (err) {
      GF.crash(err, 'view ' + name);
      page.innerHTML = `<section class="glass pad crash-card"><h1>This page hit a problem</h1><p class="muted">Your workouts and history are safe on this device.</p>
        <div class="row"><a class="btn primary" href="#/dashboard">${icon('home')}Go home</a><button class="btn" data-reload>Reload</button></div></section>`;
    }
    GF.fx.enhance(page);
    const label = (NAV.find(n => n[0] === name) || NAV[0])[1];
    document.title = `${label} — GhostFit`;
    const h1 = page.querySelector('h1'); if (h1) { h1.tabIndex = -1; }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => { if (e.target.closest('[data-reload]')) location.reload(); });
  // don't lose a workout in progress by closing the tab by accident
  window.addEventListener('beforeunload', e => {
    const w = GF.views.session.isOpen() && GF.views.session._state && GF.views.session._state();
    const r = GF.views.rehab && GF.views.rehab._state && GF.views.rehab._state();
    const busy = (w && w.startedAt && w.phase !== 'summary' && !w.demo) || (r && !r.demo && ['work', 'rest', 'intro'].includes(r.phase) && Object.keys(r.results || {}).length);
    if (busy) { e.preventDefault(); e.returnValue = ''; }
  });
  GF.go = path => { if (location.hash === '#/' + path) route(); else location.hash = '#/' + path; };
  GF.rerender = () => { if (!GF.views.session.isOpen()) route(); };

  /* ---- global settings → document ---- */
  function applySettings() {
    const s = GF.store.settings, html = document.documentElement;
    html.classList.toggle('large', !!s.largeText);
    html.classList.toggle('hc', !!s.highContrast);
    html.classList.toggle('rm', s.reducedMotion === 'on');
    const dark = s.theme === 'dark' || (s.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    html.dataset.theme = dark ? 'dark' : 'light';
    GF.themeColors = dark
      ? { a: '#5eead4', b: '#22d3ee', glow: 'rgba(94,234,212,.7)', prop: 'rgba(148,233,220,.22)' }
      : { a: '#14b8a6', b: '#0e7490', glow: 'rgba(20,184,166,.45)', prop: 'rgba(15,118,110,.22)' };
    const tb = document.getElementById('theme-toggle');
    if (tb) { tb.innerHTML = icon(dark ? 'sun' : 'moon') + `<span>${dark ? 'Light mode' : 'Dark mode'}</span>`; tb.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode'); }
    setStatus('st-priv', s.privacyMode ? 'Privacy Mode on' : 'Data stays on this device', s.privacyMode ? 'ok' : '');
  }
  function setStatus(id, text, cls) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = `<span class="dot ${cls || ''}"></span>${text}`;
  }
  bus.on('settings', applySettings);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    GF.store.setSetting('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    applySettings(); GF.rerender();
  });
  bus.on('camera', e => setStatus('st-cam', e.on ? 'Camera on' : 'Camera off', e.on ? 'live' : ''));
  bus.on('mic', e => setStatus('st-mic', ['listening', 'processing', 'starting'].includes(e.state) ? 'Microphone on' : 'Microphone off', ['listening', 'processing', 'starting'].includes(e.state) ? 'live' : ''));
  try { GF.store.sanitize(); } catch (e) { GF.crash(e, 'sanitize'); }
  applySettings();

  route();
})(window.GF = window.GF || {});
