/* GhostFit – workout model: templates, validation, flattening into session steps.
   Workout = { id, name, description, category, level, schedule:[0-6], source, blocks:[Block] }
   Block   = { id, type:'warmup'|'main'|'cooldown', items:[Item] }
   Item    = exercise { kind:'exercise', exId, sets, mode:'reps'|'time', reps, duration, rest, tempo, difficulty, notes }
           | group    { kind:'group', type:'superset'|'circuit', rounds, restAfterRound, items:[exercise items] }
           | rest     { kind:'rest', duration } */
(function (GF) {
  'use strict';
  const { uid, clone } = GF.u;
  const lib = GF.lib;

  const BLOCK_LABEL = { warmup: 'Warm-up', main: 'Main set', cooldown: 'Cool-down' };

  function exItem(exId, o = {}) {
    const e = lib.get(exId);
    const d = (e && e.def) || {};
    return Object.assign({
      id: uid('i'), kind: 'exercise', exId, sets: d.sets || 3, mode: (e && e.mode) || 'reps',
      reps: d.reps || 10, duration: d.duration || 30, rest: d.rest != null ? d.rest : 60, tempo: '', difficulty: '', notes: '',
    }, o);
  }
  function group(type, items, o = {}) {
    return Object.assign({ id: uid('g'), kind: 'group', type, rounds: 3, restAfterRound: 60, items: items.map(it => Object.assign(it, { rest: it.rest != null ? it.rest : 0 })) }, o);
  }
  const restItem = (duration = 60) => ({ id: uid('r'), kind: 'rest', duration });
  const block = (type, items = []) => ({ id: uid('b'), type, items });
  function newWorkout(name = 'New workout') {
    return { id: null, name, description: '', category: 'strength', level: 'beginner', schedule: [], source: 'user', blocks: [block('warmup'), block('main'), block('cooldown')] };
  }

  /* ---------- templates (read-only presets; users duplicate to customise) ---------- */
  const T = (id, name, description, category, level, equipment, blocks) => ({ id: 'tpl_' + id, template: true, name, description, category, level, equipment, schedule: [], source: 'template', blocks });
  const WARM = () => block('warmup', [exItem('march', { sets: 1, duration: 30, rest: 10 })]);
  const COOL = () => block('cooldown', [exItem('hamstringStretch', { sets: 1, duration: 30, rest: 5 }), exItem('breathing', { sets: 1, duration: 60, rest: 0 })]);
  const TEMPLATES = [
    T('foundations', 'Full Body Foundations', 'A balanced first workout: legs, push, hips and core. Every main exercise is camera-checked.', 'strength', 'beginner', ['none'], [
      WARM(), block('main', [exItem('squat', { sets: 3, reps: 10, rest: 60 }), exItem('pushup', { sets: 3, reps: 6, rest: 75, notes: 'Swap to knee push-ups if needed.' }), exItem('bridge', { sets: 3, reps: 12, rest: 45 }), exItem('plank', { sets: 2, duration: 25, rest: 45 })]), COOL()]),
    T('lower', 'Lower Body Strength', 'Squats, lunges and bridges paired as a superset, finished with a wall sit.', 'strength', 'intermediate', ['none'], [
      WARM(), block('main', [exItem('squat', { sets: 4, reps: 12, rest: 75 }), group('superset', [exItem('lunge', { reps: 10 }), exItem('bridge', { reps: 12 })], { rounds: 3, restAfterRound: 60 }), exItem('wallsit', { sets: 2, duration: 40, rest: 60 })]), COOL()]),
    T('upper', 'Upper Body at Home', 'Push-ups plus dumbbell shoulder and arm work. Water bottles work as light weights.', 'strength', 'intermediate', ['dumbbells'], [
      block('warmup', [exItem('march', { sets: 1, duration: 30, rest: 10 })]),
      block('main', [exItem('pushup', { sets: 3, reps: 8, rest: 75 }), group('superset', [exItem('press', { reps: 10 }), exItem('dbRow', { reps: 10 })], { rounds: 3, restAfterRound: 75 }), group('superset', [exItem('curl', { reps: 12 }), exItem('lateral', { reps: 12 })], { rounds: 2, restAfterRound: 60 })]),
      COOL()]),
    T('core', 'Core Stability', 'Controlled core work that protects the lower back.', 'strength', 'beginner', ['none'], [
      block('warmup', [exItem('catCow', { sets: 1, duration: 45, rest: 10 })]),
      block('main', [exItem('deadBug', { sets: 3, reps: 10, rest: 40 }), exItem('birdDog', { sets: 3, reps: 10, rest: 40 }), exItem('plank', { sets: 3, duration: 30, rest: 45 }), exItem('legraise', { sets: 2, reps: 10, rest: 45 })]),
      block('cooldown', [exItem('childPose', { sets: 1, duration: 45, rest: 0 })])]),
    T('lowimpact', 'Low-Impact Cardio Circuit', 'Raises your heart rate without jumping.', 'conditioning', 'beginner', ['none'], [
      block('warmup', [exItem('march', { sets: 1, duration: 60, rest: 10 })]),
      block('main', [group('circuit', [exItem('stepJack', { mode: 'time', duration: 40 }), exItem('squat', { reps: 12 }), exItem('march', { mode: 'time', duration: 40 }), exItem('lunge', { reps: 10 })], { rounds: 3, restAfterRound: 60 })]),
      COOL()]),
    T('chair', 'Chair Strength', 'A fully seated workout for limited mobility. Every exercise is camera-checked.', 'strength', 'beginner', ['none'], [
      block('warmup', [exItem('seatedMarch', { sets: 1, duration: 45, rest: 10 })]),
      block('main', [exItem('seatedPress', { sets: 3, reps: 10, rest: 60 }), exItem('kneeExt', { sets: 3, reps: 10, rest: 45 }), exItem('seatedCurl', { sets: 3, reps: 12, rest: 60 }), exItem('seatedLateral', { sets: 2, reps: 10, rest: 60 })]),
      block('cooldown', [exItem('breathing', { sets: 1, duration: 60, rest: 0 })])]),
    T('mobility', 'Mobility Reset', 'Ten easy minutes for stiff hips and back. Good on rest days.', 'mobility', 'beginner', ['none'], [
      block('main', [exItem('catCow', { sets: 1, duration: 60, rest: 10 }), exItem('hipFlexorStretch', { sets: 2, duration: 30, rest: 10 }), exItem('hamstringStretch', { sets: 2, duration: 30, rest: 10 }), exItem('childPose', { sets: 1, duration: 60, rest: 10 }), exItem('breathing', { sets: 1, duration: 60, rest: 0 })])]),
    T('conditioning', 'Conditioning Intervals', 'A demanding full-body circuit for experienced exercisers.', 'conditioning', 'advanced', ['none'], [
      WARM(), block('main', [group('circuit', [exItem('jacks', { reps: 30 }), exItem('burpee', { reps: 8 }), exItem('mountainClimber', { mode: 'time', duration: 30 }), exItem('squat', { reps: 15 }), exItem('pushup', { reps: 10 })], { rounds: 3, restAfterRound: 90 })]), COOL()]),
    T('gym', 'Gym Strength Basics', 'The fundamentals with free weights. Log your weights to track strength.', 'strength', 'intermediate', ['dumbbells', 'bench'], [
      WARM(), block('main', [exItem('gobletSquat', { sets: 3, reps: 10, rest: 90 }), exItem('dbBench', { sets: 3, reps: 10, rest: 90 }), exItem('dbRow', { sets: 3, reps: 10, rest: 75 }), exItem('rdl', { sets: 3, reps: 10, rest: 90 }), exItem('plank', { sets: 2, duration: 40, rest: 45 })]), COOL()]),
  ];

  /* ---------- helpers ---------- */
  function allExerciseItems(w) {
    const out = [];
    for (const b of w.blocks) for (const it of b.items) {
      if (it.kind === 'exercise') out.push(it);
      else if (it.kind === 'group') out.push(...it.items);
    }
    return out;
  }
  function equipmentOf(w) { return [...new Set(allExerciseItems(w).map(i => (lib.get(i.exId) || {}).equip).filter(e => e && e !== 'none'))]; }
  function musclesOf(w) { const m = {}; for (const i of allExerciseItems(w)) { const e = lib.get(i.exId); if (e) e.muscles.p.forEach(x => { m[x] = (m[x] || 0) + (i.sets || 1); }); } return Object.keys(m).sort((a, b) => m[b] - m[a]); }
  const trackedCount = w => allExerciseItems(w).filter(i => lib.get(i.exId) && lib.get(i.exId).track).length;

  /** Turn a workout into an ordered list of steps the session runs. */
  function flatten(w) {
    const steps = [];
    const work = (it, set, sets, blockType, groupInfo) => {
      const e = lib.get(it.exId);
      steps.push({ kind: 'work', itemId: it.id, exId: it.exId, set, sets, mode: it.mode, target: it.mode === 'time' ? it.duration : it.reps, tempo: it.tempo, notes: it.notes, blockType, group: groupInfo || null, name: e ? e.name : it.exId });
    };
    const rest = (sec, why) => { if (sec > 0) steps.push({ kind: 'rest', duration: sec, why }); };
    for (const b of w.blocks) {
      for (const it of b.items) {
        if (it.kind === 'exercise') {
          for (let s = 1; s <= it.sets; s++) { work(it, s, it.sets, b.type); rest(it.rest, 'set'); }
        } else if (it.kind === 'group') {
          for (let r = 1; r <= it.rounds; r++) {
            it.items.forEach((c, ci) => {
              work(c, r, it.rounds, b.type, { type: it.type, index: ci, size: it.items.length, round: r, rounds: it.rounds });
              if (ci < it.items.length - 1) rest(c.rest, 'transition');
            });
            rest(it.restAfterRound, 'round');
          }
        } else if (it.kind === 'rest') rest(it.duration, 'recovery');
      }
    }
    while (steps.length && steps[steps.length - 1].kind === 'rest') steps.pop();
    return steps;
  }

  function estimateSeconds(w) {
    return flatten(w).reduce((s, st) => {
      if (st.kind === 'rest') return s + st.duration;
      const e = lib.get(st.exId), d = GF.lib.demoOf(e);
      const perRep = d && d.ghost && d.ghost.cycle ? Math.max(2.2, d.ghost.cycle) : 3;
      return s + 8 + (st.mode === 'time' ? st.target : st.target * perRep);
    }, 0);
  }

  /** Validate before saving or starting. Returns { errors:[], warnings:[] } — never edits the workout. */
  function validate(w, settings = {}) {
    const errors = [], warnings = [];
    const inRange = (v, a, b) => Number.isFinite(+v) && +v >= a && +v <= b;
    if (!String(w.name || '').trim()) errors.push('Give your workout a name.');
    const items = allExerciseItems(w);
    if (!items.length) errors.push('Add at least one exercise.');
    for (const b of w.blocks) for (const it of b.items) {
      const label = it.kind === 'exercise' ? (lib.get(it.exId) || {}).name : it.kind === 'group' ? (it.type === 'superset' ? 'Superset' : 'Circuit') : 'Rest';
      if (it.kind === 'exercise') checkEx(it, label);
      if (it.kind === 'group') {
        if (it.items.length < 2) errors.push(`${label} in ${BLOCK_LABEL[b.type]} needs at least 2 exercises.`);
        if (!inRange(it.rounds, 1, 20)) errors.push(`${label}: rounds must be 1–20.`);
        if (!inRange(it.restAfterRound, 0, 600)) errors.push(`${label}: rest after round must be 0–600 s.`);
        it.items.forEach(c => checkEx(c, (lib.get(c.exId) || {}).name, true));
      }
      if (it.kind === 'rest' && !inRange(it.duration, 5, 900)) errors.push('Rest periods must be 5–900 s.');
    }
    function checkEx(it, label, inGroup) {
      if (!lib.get(it.exId)) { errors.push(`Unknown exercise "${it.exId}".`); return; }
      if (!inGroup && !inRange(it.sets, 1, 20)) errors.push(`${label}: sets must be 1–20.`);
      if (it.mode === 'reps' && !inRange(it.reps, 1, 200)) errors.push(`${label}: reps must be 1–200.`);
      if (it.mode === 'time' && !inRange(it.duration, 5, 1800)) errors.push(`${label}: duration must be 5–1800 s.`);
      if (!inRange(it.rest, 0, 600)) errors.push(`${label}: rest must be 0–600 s.`);
    }
    const owned = settings.equipment || [];
    const missing = equipmentOf(w).filter(eq => !['chair', 'wall', 'mat'].includes(eq) && !owned.includes(eq));
    if (missing.length) warnings.push(`Needs equipment you haven't listed in Settings: ${missing.map(m => lib.EQUIP_LABEL[m]).join(', ')}.`);
    const est = estimateSeconds(w);
    if (est > 2 * 3600) warnings.push('This workout is longer than 2 hours.');
    return { errors, warnings };
  }

  /** Copy a template (or any workout) into a new editable user workout. */
  function duplicate(w, name) {
    const c = clone(w);
    c.id = null; c.template = false; c.source = 'user'; c.name = name || (w.name + (w.template ? '' : ' (copy)'));
    c.revisions = [];
    for (const b of c.blocks) { b.id = uid('b'); for (const it of b.items) { it.id = uid('i'); if (it.items) it.items.forEach(x => { x.id = uid('i'); }); } }
    return c;
  }

  /* ---------- intensity (Quick / Standard / Beast Mode) ---------- */
  const INTENSITY = {
    quick:    { name: 'Quick',      sub: 'Shorter and lighter — great for a first try', sets: s => Math.min(s, 2), reps: 0.75, hold: 0.7,  rest: 0.8,  rounds: r => Math.min(r, 2) },
    standard: { name: 'Standard',   sub: 'The workout as designed',                    sets: s => s,              reps: 1,    hold: 1,    rest: 1,    rounds: r => r },
    beast:    { name: 'Beast Mode', sub: 'More sets, more reps, less rest',            sets: s => Math.min(s + 1, 6), reps: 1.3, hold: 1.4, rest: 0.8, rounds: r => Math.min(r + 1, 6) },
  };
  /** A scaled copy of a workout for this session only (the original is never changed). */
  function withIntensity(w, level) {
    const L = INTENSITY[level] || INTENSITY.standard;
    const c = clone(w);
    const scaleEx = (it, inGroup, main) => {
      if (!main) return;                                   // warm-up and cool-down stay as they are
      if (!inGroup) it.sets = L.sets(it.sets);
      if (it.mode === 'reps') it.reps = Math.max(3, Math.round(it.reps * L.reps));
      else it.duration = Math.max(10, Math.round(it.duration * L.hold / 5) * 5);
      it.rest = Math.round(it.rest * L.rest / 5) * 5;
    };
    for (const b of c.blocks) for (const it of b.items) {
      const main = b.type === 'main';
      if (it.kind === 'exercise') scaleEx(it, false, main);
      if (it.kind === 'group') { if (main) { it.rounds = L.rounds(it.rounds); it.restAfterRound = Math.round(it.restAfterRound * L.rest / 5) * 5; } it.items.forEach(x => scaleEx(x, true, main)); }
    }
    c.name = `${w.name} · ${L.name}`;
    c.intensity = level; c.baseId = w.id;
    return c;
  }

  GF.wk = { INTENSITY, withIntensity, BLOCK_LABEL, TEMPLATES, exItem, group, restItem, block, newWorkout, flatten, estimateSeconds, validate, duplicate, allExerciseItems, equipmentOf, musclesOf, trackedCount,
    find: id => (id && id.startsWith('tpl_')) ? TEMPLATES.find(t => t.id === id) : GF.store.workout(id) };
})(window.GF = window.GF || {});
