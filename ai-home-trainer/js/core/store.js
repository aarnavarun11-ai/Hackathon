/* GhostFit – local data store.
   Everything lives in this browser's localStorage on this device. No account, no server.
   Privacy Mode and retention settings decide what is kept. */
(function (GF) {
  'use strict';
  const { clone, uid, bus } = GF.u;
  const KEY = 'ghostfit.v3';

  const DEFAULT_SETTINGS = {
    // profile
    level: 'beginner', goals: ['general'], equipment: ['none'], weeklyGoal: 3, defaultDuration: 20, units: 'kg', setupDone: false,
    // voice output
    voiceOn: true, voiceURI: '', voiceRate: 0.95, voiceVolume: 0.9, voicePitch: 1,
    coaching: 'balanced',          // minimal | balanced | detailed
    encouragement: 'gentle',       // off | gentle | standard
    captions: true,
    // voice input
    speechInputConsent: false,     // user agreed that browser speech recognition may use a cloud service
    // camera
    cameraId: '', cameraConsent: false, showSkeleton: true,
    // accessibility
    theme: 'system', reducedMotion: 'system', largeText: false, highContrast: false,
    // privacy & retention
    privacyMode: false, keepHistory: true, keepChats: true, keepMovement: false, shareContextWithCoach: true,
  };

  const state = { settings: clone(DEFAULT_SETTINGS), workouts: [], history: [], chats: [], adaptations: [], replays: [], rehab: { plan: null, log: [], baseline: {} } };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        Object.assign(state, d);
        state.settings = Object.assign(clone(DEFAULT_SETTINGS), d.settings || {});
      }
    } catch (e) {
      console.warn('Could not read saved data', e);
      try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(KEY + '.unreadable', raw); } catch (e2) { /* ignore */ }
    }
    if (!state.settings || typeof state.settings !== 'object') state.settings = clone(DEFAULT_SETTINGS);
    for (const k of ['workouts', 'history', 'chats', 'adaptations', 'replays']) if (!Array.isArray(state[k])) state[k] = [];
    if (!state.rehab || typeof state.rehab !== 'object') state.rehab = {};
    state.rehab = { plan: state.rehab.plan || null, log: Array.isArray(state.rehab.log) ? state.rehab.log : [], baseline: state.rehab.baseline || {} };
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeNow, 150);
  }
  function writeNow() {
    clearTimeout(saveTimer); saveTimer = null;
    {
      const s = state.settings;
      const out = {
        settings: s,
        workouts: state.workouts,
        history: s.keepHistory ? state.history : [],
        chats: (s.keepChats && !s.privacyMode) ? state.chats : [],
        adaptations: state.adaptations,
        replays: (s.keepMovement && !s.privacyMode) ? state.replays : [],
        rehab: s.keepHistory ? state.rehab : { plan: state.rehab.plan, log: [], baseline: state.rehab.baseline },
      };
      try { localStorage.setItem(KEY, JSON.stringify(out)); }
      catch (e) { console.warn('Save failed', e); GF.u.toast('Could not save — browser storage is full or disabled', 'error'); }
    }
  }
  // never lose a pending save when the tab is hidden, reloaded or closed
  const flush = () => { if (saveTimer) writeNow(); };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  const store = {
    DEFAULT_SETTINGS,
    get settings() { return state.settings; },
    setSetting(key, value) { state.settings[key] = value; persist(); bus.emit('settings', { key, value }); },
    setSettings(obj) { Object.assign(state.settings, obj); persist(); bus.emit('settings', obj); },

    /* workouts */
    workouts() { return state.workouts; },
    workout(id) { return state.workouts.find(w => w.id === id); },
    saveWorkout(w, note) {
      const now = Date.now();
      if (!w.id) w = Object.assign({}, w, { id: uid('w') });
      const i = state.workouts.findIndex(x => x.id === w.id);
      if (i >= 0) {
        const prev = state.workouts[i];
        const revisions = (prev.revisions || []).slice(-9);
        revisions.push({ at: now, note: note || 'Edited', snapshot: clone(Object.assign({}, prev, { revisions: undefined })) });
        state.workouts[i] = Object.assign(clone(w), { updatedAt: now, revisions });
      } else {
        state.workouts.push(Object.assign(clone(w), { createdAt: now, updatedAt: now, revisions: [] }));
      }
      persist(); bus.emit('workouts');
      return state.workouts.find(x => x.id === w.id);
    },
    deleteWorkout(id) { state.workouts = state.workouts.filter(w => w.id !== id); persist(); bus.emit('workouts'); },
    restoreRevision(id, idx) {
      const w = store.workout(id); if (!w || !w.revisions[idx]) return;
      const snap = clone(w.revisions[idx].snapshot); snap.id = id;
      store.saveWorkout(snap, 'Restored earlier version');
    },

    /* history */
    history() { return state.history; },
    addSession(s) { if (!state.settings.keepHistory) { bus.emit('history'); return; } state.history.push(s); persist(); bus.emit('history'); },
    deleteSession(id) { state.history = state.history.filter(x => x.id !== id); persist(); bus.emit('history'); },
    updateSession(id, patch) { const s = state.history.find(x => x.id === id); if (s) { Object.assign(s, patch); persist(); } },

    /* chats */
    chats() { return state.chats; },
    saveChat(chat) {
      const i = state.chats.findIndex(c => c.id === chat.id);
      if (i >= 0) state.chats[i] = chat; else state.chats.push(chat);
      state.chats = state.chats.slice(-30); persist();
    },

    /* adaptations log */
    adaptations() { return state.adaptations; },
    logAdaptation(a) { state.adaptations.push(Object.assign({ id: uid('a'), at: Date.now() }, a)); persist(); },

    /* movement replays (skeleton data only, never video) */
    replays() { return state.replays; },
    saveReplay(r) {
      if (!state.settings.keepMovement || state.settings.privacyMode) return false;
      state.replays.push(r); state.replays = state.replays.slice(-8); persist(); return true;
    },

    /* rehab */
    rehab() { return state.rehab; },
    setRehabPlan(plan) { state.rehab.plan = plan ? Object.assign({}, state.rehab.plan || {}, plan) : null; persist(); bus.emit('rehab'); },
    addRehabLog(entry) { state.rehab.log.push(Object.assign({ id: uid('r'), at: Date.now() }, entry)); state.rehab.log = state.rehab.log.slice(-200); persist(); bus.emit('rehab'); },
    setRehabBaseline(key, value) { state.rehab.baseline[key] = value; persist(); },
    resetRehab() { state.rehab = { plan: null, log: [], baseline: {} }; persist(); bus.emit('rehab'); },

    /** Drop anything in saved data that would crash the app (old versions, hand-edited files, removed exercises). */
    sanitize() {
      const lib = GF.lib, R = GF.rehab;
      const okEx = it => it && it.kind === 'exercise' ? !!lib.get(it.exId) : true;
      const fixItems = items => (Array.isArray(items) ? items : []).filter(it => it && typeof it === 'object').map(it => {
        if (it.kind === 'group' || Array.isArray(it.items)) return Object.assign({}, it, { items: fixItems(it.items).filter(okEx) });
        return it;
      }).filter(it => okEx(it) && !(Array.isArray(it.items) && !it.items.length));
      let changed = false;
      // settings: wrong types (e.g. a text weekly goal) fall back to the default
      const st = state.settings;
      for (const [k, d] of Object.entries(DEFAULT_SETTINGS)) {
        const v = st[k];
        if (v === undefined || (d !== null && typeof d !== typeof v) || (typeof d === 'number' && !isFinite(v)) || (Array.isArray(d) && !Array.isArray(v))) { st[k] = clone(d); changed = true; }
      }
      if (!['system', 'light', 'dark'].includes(st.theme)) { st.theme = 'system'; changed = true; }
      if (!(st.weeklyGoal >= 1 && st.weeklyGoal <= 14)) { st.weeklyGoal = DEFAULT_SETTINGS.weeklyGoal || 3; changed = true; }
      const before = JSON.stringify([state.workouts.length, state.history.length]);
      state.workouts = state.workouts.filter(w => w && typeof w === 'object' && w.id && Array.isArray(w.blocks))
        .map(w => Object.assign({}, w, { name: String(w.name || 'Untitled workout'), blocks: w.blocks.filter(b => b && typeof b === 'object').map(b => Object.assign({}, b, { items: fixItems(b.items) })) }));
      state.history = state.history.filter(h => h && typeof h === 'object' && isFinite(h.startedAt))
        .map(h => Object.assign({}, h, { sets: (Array.isArray(h.sets) ? h.sets : []).filter(x => x && lib.get(x.exId)).map(x => Object.assign({}, x, { counts: x.counts || { good: 0, bad: 0, partial: 0, unassessed: 0 } })) }));
      state.replays = state.replays.filter(r => r && Array.isArray(r.frames));
      state.chats = state.chats.filter(c => c && Array.isArray(c.messages || c.msgs || []));
      if (R) {
        const rh = state.rehab, p = rh.plan;
        if (p && (!R.AREAS[p.area] || ![1, 2, 3].includes(+p.stage))) { rh.plan = null; changed = true; }
        else if (p) {
          if (!R.WB.hasOwnProperty(p.wb)) p.wb = 'none';
          if (R.sided(p.area) && !['L', 'R'].includes(p.side)) p.side = 'L';
          if (!R.sided(p.area)) p.side = 'C';
          p.stage = +p.stage;
          p.custom = { add: ((p.custom && p.custom.add) || []).filter(id => R.get(id)), remove: ((p.custom && p.custom.remove) || []).filter(id => R.get(id)) };
          if (!isFinite(p.volume) || p.volume <= 0) p.volume = 1;
        }
        rh.log = rh.log.filter(l => l && typeof l === 'object' && isFinite(l.at)).map(l => {
          const rom = {}; Object.entries(l.rom || {}).forEach(([k, v]) => { if (R.ROM[k] && isFinite(v)) rom[k] = v; });
          return Object.assign({}, l, { rom, results: Array.isArray(l.results) ? l.results : [] });
        });
        Object.keys(rh.baseline).forEach(k => { if (!isFinite(rh.baseline[k])) delete rh.baseline[k]; });
      }
      if (changed || before !== JSON.stringify([state.workouts.length, state.history.length])) persist();
    },

    /* data controls */
    exportAll() {
      return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'GhostFit', note: 'All data GhostFit stores on this device. No video or audio is ever stored.', ...state }, null, 2);
    },
    clear(what) {
      if (what === 'all') {
        Object.assign(state, { settings: clone(DEFAULT_SETTINGS), workouts: [], history: [], chats: [], adaptations: [], replays: [], rehab: { plan: null, log: [], baseline: {} } });
        try { localStorage.removeItem(KEY); localStorage.removeItem('ghostfit.history'); } catch (e) { /* ignore */ }
      } else if (state[what]) state[what] = [];
      persist(); bus.emit('data-cleared', what); bus.emit('settings', {});
    },
    flush,
    usage() {
      try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; }
    },
  };

  load();
  GF.store = store;
})(window.GF = window.GF || {});
