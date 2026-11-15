/* GhostFit – adaptation logic
   • recommend(): picks suitable workouts from goals, level, equipment and recent training
   • recovery(): gentle recovery reminders based on what was trained recently
   • suggestions(): turns post-workout feedback into PROPOSED changes (never applied automatically)
   • apply(): applies only the suggestions the user accepted, keeps the original as a revision,
     and logs every accepted change. Intensity is never increased without the user choosing it. */
(function (GF) {
  'use strict';
  const { clone, uid, dayKey } = GF.u;
  const lib = GF.lib, wk = GF.wk;
  const LVL = { beginner: 1, intermediate: 2, advanced: 3 };
  const GOAL_CAT = { strength: ['strength'], endurance: ['conditioning', 'endurance', 'strength'], mobility: ['mobility', 'flexibility'], flexibility: ['mobility', 'flexibility'], general: ['strength', 'conditioning', 'mobility'] };

  function recentMuscles(history, days) {
    const since = Date.now() - days * 864e5, m = {};
    for (const s of history) if (s.startedAt > since) for (const set of s.sets || []) { const e = lib.get(set.exId); if (e) e.muscles.p.forEach(x => { m[x] = (m[x] || 0) + 1; }); }
    return m;
  }
  function consecutiveDays(history) {
    const days = new Set(history.map(s => dayKey(s.startedAt)));
    let n = 0; const d = new Date(); d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
    return n + (days.has(new Date().toDateString()) ? 1 : 0);
  }

  function recommend(limit = 3) {
    const s = GF.store.settings, history = GF.store.history();
    const lvl = LVL[s.level] || 1;
    const recent = recentMuscles(history, 1.5);
    const streak = consecutiveDays(history);
    const pool = [...wk.TEMPLATES, ...GF.store.workouts()];
    const scored = pool.map(w => {
      let score = 0; const why = [];
      const wl = LVL[w.level] || 1;
      score -= Math.abs(wl - lvl) * 2; if (wl === lvl) why.push('matches your level');
      const cats = new Set((s.goals || ['general']).flatMap(g => GOAL_CAT[g] || []));
      if (cats.has(w.category)) { score += 2; why.push('fits your goals'); }
      const eq = wk.equipmentOf(w).filter(e => !['chair', 'wall', 'mat'].includes(e));
      const missing = eq.filter(e => !(s.equipment || []).includes(e));
      if (missing.length) score -= 4; else if (!eq.length) why.push('no equipment needed');
      const overlap = wk.musclesOf(w).slice(0, 3).filter(m => recent[m]).length;
      if (overlap) { score -= overlap * 1.5; } else if (Object.keys(recent).length) why.push('gives recently trained muscles a rest');
      if (streak >= 3 && w.category === 'mobility') { score += 4; why.unshift('a lighter day after several sessions'); }
      const mins = wk.estimateSeconds(w) / 60;
      score -= Math.abs(mins - (s.defaultDuration || 20)) / 15;
      return { w, score, why };
    }).sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  function recovery() {
    const history = GF.store.history().slice().sort((a, b) => a.startedAt - b.startedAt);
    const streak = consecutiveDays(history);
    const last = history[history.length - 1];
    const tips = [];
    if (streak >= 4) tips.push(`You've trained ${streak} days in a row. A rest or mobility day helps your body adapt.`);
    if (last && Date.now() - last.startedAt < 864e5 * 1.2) {
      const m = wk.musclesOf({ blocks: [{ items: (last.sets || []).map(x => ({ kind: 'exercise', exId: x.exId, sets: 1 })) }] }).slice(0, 2);
      if (m.length) tips.push(`Yesterday's session worked your ${m.join(' and ')}. Consider training different muscles today.`);
    }
    const pain = history.slice(-3).some(s => s.feedback && Object.values(s.feedback.perEx || {}).includes('pain'));
    if (pain) tips.unshift('You reported pain recently. Please rest that area, and see a healthcare professional if it continues.');
    return tips;
  }

  /* ---------- feedback → suggestions ---------- */
  const RATINGS = [
    ['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too difficult'], ['uncomfortable', 'Uncomfortable'], ['pain', 'Pain or discomfort'], ['recovery', 'Not enough rest'],
  ];
  function suggestions(workout, feedback) {
    const out = [];
    if (!workout || workout.generated) return out;
    const items = [];
    for (const b of workout.blocks) for (const it of b.items) {
      if (it.kind === 'exercise') items.push({ it, parent: null });
      if (it.kind === 'group') it.items.forEach(c => items.push({ it: c, parent: it }));
    }
    for (const [exId, rating] of Object.entries(feedback.perEx || {})) {
      const e = lib.get(exId); if (!e) continue;
      const targets = items.filter(x => x.it.exId === exId);
      if (!targets.length) continue;
      const first = targets[0].it;
      const easier = (e.easier || []).find(id => lib.get(id)) || (e.impact === 'high' ? (e.alt || []).find(id => lib.get(id) && lib.get(id).impact === 'low') : null);
      const harder = (e.harder || []).find(id => lib.get(id));
      const add = (o) => out.push(Object.assign({ id: uid('s'), exId, itemIds: targets.map(x => x.it.id), accepted: false }, o));
      if (rating === 'easy') {
        if (first.mode === 'reps') add({ type: 'reps', delta: 2, text: `${e.name}: add 2 reps (${first.reps} → ${first.reps + 2})`, reason: 'You rated it too easy. This is optional — only accept if you want more challenge.' });
        else add({ type: 'duration', delta: 10, text: `${e.name}: hold 10 s longer (${first.duration}s → ${first.duration + 10}s)`, reason: 'You rated it too easy. Optional.' });
        if (harder) add({ type: 'replace', to: harder, text: `${e.name}: try ${lib.get(harder).name} instead`, reason: 'A harder variation, if you want progression. Optional.' });
      } else if (rating === 'hard') {
        if (first.mode === 'reps' && first.reps > 4) add({ type: 'reps', delta: -2, text: `${e.name}: reduce to ${first.reps - 2} reps`, reason: 'You rated it too difficult. Fewer reps with good form is better than more reps with poor form.' });
        if (first.mode === 'time' && first.duration > 15) add({ type: 'duration', delta: -10, text: `${e.name}: shorten to ${first.duration - 10}s`, reason: 'You rated it too difficult.' });
        add({ type: 'rest', delta: 30, text: `${e.name}: rest 30 s longer between sets`, reason: 'More recovery can make the next set more manageable.' });
        if (easier) add({ type: 'replace', to: easier, text: `${e.name}: swap for ${lib.get(easier).name}`, reason: 'An easier variation that trains similar muscles.' });
      } else if (rating === 'uncomfortable') {
        if (easier) add({ type: 'replace', to: easier, text: `${e.name}: swap for ${lib.get(easier).name}`, reason: 'A gentler alternative for the same muscles.' });
        if (first.mode === 'reps' && first.reps > 4) add({ type: 'reps', delta: -2, text: `${e.name}: reduce to ${first.reps - 2} reps`, reason: 'Lower volume while you build comfort.' });
      } else if (rating === 'pain') {
        add({ type: 'note', text: `${e.name}: you reported pain`, reason: 'Please stop doing exercises that cause pain. If pain is sharp, persistent or comes with swelling, numbness, chest pain or dizziness, seek medical advice. GhostFit cannot diagnose injuries.', safety: true });
        if (easier) add({ type: 'replace', to: easier, text: `${e.name}: replace with ${lib.get(easier).name}`, reason: 'Only if it is completely pain-free.' });
        add({ type: 'remove', text: `${e.name}: remove from this workout`, reason: 'You can add it back any time in the builder.' });
      } else if (rating === 'recovery') {
        add({ type: 'rest', delta: 30, text: `${e.name}: rest 30 s longer between sets (${first.rest}s → ${first.rest + 30}s)`, reason: 'You said you needed more recovery.' });
      }
    }
    if (feedback.overall === 'hard') out.push({ id: uid('s'), type: 'restAll', delta: 15, text: 'Whole workout: add 15 s of rest after every set', reason: 'You rated the whole workout too difficult.', itemIds: [], accepted: false });
    return out;
  }

  /** Apply accepted suggestions. Returns the saved workout (a new copy if it was a template). */
  function apply(workout, accepted, sessionId) {
    if (!accepted.length) return null;
    let w = clone(workout);
    const isTemplate = !!workout.template;
    if (isTemplate) w = wk.duplicate(workout, workout.name + ' (adjusted)');
    const idMap = {};
    if (isTemplate) { // map old item ids → new copy by position
      const a = wk.allExerciseItems(workout), b = wk.allExerciseItems(w);
      a.forEach((it, i) => { idMap[it.id] = b[i].id; });
    }
    const findItems = ids => wk.allExerciseItems(w).filter(it => ids.map(i => idMap[i] || i).includes(it.id));
    const notes = [];
    for (const s of accepted) {
      if (s.type === 'note') continue;
      if (s.type === 'restAll') { wk.allExerciseItems(w).forEach(it => { it.rest = Math.min(600, it.rest + s.delta); }); notes.push(s.text); continue; }
      const its = findItems(s.itemIds);
      for (const it of its) {
        if (s.type === 'reps') it.reps = Math.max(1, it.reps + s.delta);
        if (s.type === 'duration') it.duration = Math.max(5, it.duration + s.delta);
        if (s.type === 'rest') it.rest = Math.min(600, it.rest + s.delta);
        if (s.type === 'replace') { it.exId = s.to; const ne = lib.get(s.to); if (ne.mode !== it.mode) { it.mode = ne.mode; if (ne.mode === 'time') it.duration = ne.def.duration || 30; else it.reps = ne.def.reps || 10; } }
      }
      if (s.type === 'remove') {
        const ids = its.map(i => i.id);
        for (const b of w.blocks) {
          b.items = b.items.filter(it => !(it.kind === 'exercise' && ids.includes(it.id)));
          b.items.forEach(it => { if (it.kind === 'group') it.items = it.items.filter(c => !ids.includes(c.id)); });
          b.items = b.items.filter(it => !(it.kind === 'group' && it.items.length === 0));
          b.items = b.items.map(it => (it.kind === 'group' && it.items.length === 1) ? Object.assign(it.items[0], { sets: it.rounds, rest: it.restAfterRound }) : it);
        }
      }
      notes.push(s.text);
    }
    const saved = GF.store.saveWorkout(w, 'Adapted after workout: ' + notes.join('; '));
    GF.store.logAdaptation({ workoutId: saved.id, workoutName: saved.name, fromTemplate: isTemplate ? workout.id : null, sessionId, changes: notes });
    return saved;
  }

  GF.adapt = { recommend, recovery, suggestions, apply, RATINGS, consecutiveDays };
})(window.GF = window.GF || {});
