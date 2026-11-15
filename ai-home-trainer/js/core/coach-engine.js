/* GhostFit – built-in AI coach (runs entirely on this device; no API, no network).
   It understands fitness questions using intent rules + the exercise library knowledge base,
   generates workouts, and uses workout context only if the user allows it.
   It never claims to have seen the user's movement unless camera tracking actually ran,
   never diagnoses, and always puts safety first. */
(function (GF) {
  'use strict';
  const lib = GF.lib, wk = GF.wk;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

  const R = () => ({ blocks: [], speak: '' });
  const P = (r, text) => { r.blocks.push({ t: 'p', text }); return r; };
  const H = (r, text) => { r.blocks.push({ t: 'h', text }); return r; };
  const OL = (r, items) => { if (items.length) r.blocks.push({ t: 'ol', items }); return r; };
  const UL = (r, items) => { if (items.length) r.blocks.push({ t: 'ul', items }); return r; };

  /* ---------------- safety ---------------- */
  const RED_FLAGS = /\b(chest pain|chest (hurts|tight)|tight(ness)? in (my )?chest|dizz|faint|light ?headed|pass(ed)? out|short(ness)? of breath|can'?t breathe|trouble breathing|heart (is )?(racing|pounding)|irregular heartbeat|numb|tingling|sharp pain|shooting pain|pop(ped)? and (it )?(hurts|swell)|swelling)\b/;
  const PAIN = /\b(pain|hurts?|hurting|ache|aching|injur(y|ed)|sore (knee|back|shoulder|wrist|neck|hip))\b/;
  function safety(text) {
    const r = R();
    H(r, 'Please stop exercising now');
    P(r, 'Chest pain, dizziness, fainting, trouble breathing, numbness or sharp pain are signs to stop straight away. I can’t assess medical symptoms.');
    UL(r, ['Sit or lie down somewhere safe and rest.', 'If you have chest pain, severe shortness of breath, or feel faint, contact emergency services now.', 'For sharp or persistent pain, swelling or numbness, see a doctor or physiotherapist before training that area again.']);
    r.speak = 'Please stop exercising now. Chest pain, dizziness, trouble breathing, numbness or sharp pain are signs to stop. If symptoms are severe, contact emergency services.';
    r.safety = true; return r;
  }
  function painAnswer(text, e) {
    const r = R();
    H(r, 'Direct answer');
    P(r, `Don’t push through pain${e ? ` during ${e.name.toLowerCase()}s` : ''}. Stop the movement that hurts. I can’t diagnose what’s causing it.`);
    H(r, 'What you can do');
    const alts = e ? [...new Set([...(e.easier || []), ...(e.alt || [])])].map(id => lib.get(id)).filter(Boolean) : [];
    UL(r, [
      'Skip or stop the exercise that hurts. Mild muscle burning during effort is normal; sharp, joint or lingering pain is not.',
      e ? 'Try a smaller range of motion only if it is completely pain-free.' : 'Train other areas that are pain-free in the meantime.',
      ...(alts.length ? [`Pain-free alternatives to try carefully: ${list(alts.slice(0, 3).map(a => a.name))}.`] : []),
      'Use the “Pain or discomfort” option after your workout so I can suggest changes to your plan.',
    ]);
    H(r, 'Safety');
    P(r, 'If the pain is sharp, lasts more than a few days, or comes with swelling, numbness or instability, please see a doctor or physiotherapist.');
    r.speak = `Please don't push through pain. Stop the movement that hurts. If it's sharp or lasts more than a few days, see a doctor or physiotherapist.`;
    return r;
  }

  /* ---------------- exercise answers ---------------- */
  function howTo(e, ctx) {
    const r = R();
    H(r, 'Direct answer');
    P(r, `${e.simple}`);
    H(r, 'Why it works');
    P(r, `${e.name} mainly trains your ${list(e.muscles.p)}${e.muscles.s.length ? `, with help from your ${list(e.muscles.s)}` : ''}. Good technique keeps the work in those muscles and off your joints.`);
    H(r, 'Step by step'); OL(r, e.steps);
    if (e.mistakes.length) { H(r, 'Common mistakes'); UL(r, e.mistakes); }
    H(r, 'Practical recommendations');
    const rec = [...e.tips];
    if (e.mode === 'reps') rec.push(`Start with ${e.def.sets} sets of ${e.def.reps}, resting about ${e.def.rest} seconds.`);
    else rec.push(`Start with ${e.def.sets} × ${e.def.duration} seconds, resting about ${e.def.rest} seconds.`);
    rec.push('Move slowly — about 2 seconds down and 1–2 seconds up.');
    if (e.track) rec.push(`GhostFit can check this one with your camera: ${e.view === 'side' ? 'stand side-on' : 'face the camera'} so I can see the key joints.`);
    UL(r, rec);
    if (ctx && ctx.lastSet && ctx.lastSet.exId === e.id) addContextNote(r, ctx);
    H(r, 'Safety'); P(r, 'Work in a pain-free range. Stop if you feel sharp pain.');
    r.speak = `${e.simple} Key points: ${e.steps.slice(1, 3).join(' ')}`;
    r.exId = e.id; return r;
  }
  function muscles(e) {
    const r = R();
    H(r, 'Direct answer');
    P(r, `${e.name} mainly works your ${list(e.muscles.p)}.${e.muscles.s.length ? ` Your ${list(e.muscles.s)} help as supporting muscles.` : ''}`);
    H(r, 'How to feel the right muscles');
    UL(r, [e.steps[e.steps.length - 1] || '', ...e.tips.slice(0, 1)].filter(Boolean));
    r.speak = `${e.name} mainly works your ${list(e.muscles.p)}.`;
    r.exId = e.id; return r;
  }
  function alternatives(e, text) {
    const r = R();
    const owned = GF.store.settings.equipment || [];
    const ids = [...new Set([...(e.alt || []), ...(e.easier || []), ...(e.harder || [])])];
    // add exercises sharing a primary muscle
    lib.list.forEach(x => { if (x.id !== e.id && x.muscles.p.some(m => e.muscles.p.includes(m)) && !ids.includes(x.id)) ids.push(x.id); });
    let alts = ids.map(id => lib.get(id)).filter(Boolean);
    if (/no equipment|bodyweight|at home|without/.test(text)) alts = alts.filter(a => lib.hasEquipment(a, []));
    else alts = alts.filter(a => lib.hasEquipment(a, owned));
    if (/low.?impact|joint|knee/.test(text)) alts = alts.filter(a => a.impact === 'low');
    alts = alts.slice(0, 5);
    H(r, 'Direct answer');
    P(r, alts.length ? `Good replacements for ${e.name.toLowerCase()}s that train similar muscles (${list(e.muscles.p)}):` : `I couldn't find a replacement with your current equipment settings. Try adding equipment in Settings.`);
    UL(r, alts.map(a => `${a.name} — ${a.muscles.p.join(', ')}${e.easier.includes(a.id) ? ' (easier)' : e.harder.includes(a.id) ? ' (harder)' : ''}${a.track ? ' · camera-checked' : ''}`));
    H(r, 'Tip'); P(r, 'In the workout builder, use Replace (the ⇄ button) to swap an exercise without losing your sets, reps and rest.');
    r.speak = alts.length ? `You could replace ${e.name} with ${list(alts.slice(0, 3).map(a => a.name))}.` : 'I could not find a replacement with your equipment.';
    r.chips = alts.map(a => a.id); r.exId = e.id; return r;
  }
  function struggling(e, ctx) {
    const r = R();
    H(r, 'Direct answer');
    P(r, `Struggling with ${e.name.toLowerCase()}s is very common. It usually comes down to strength in the ${list(e.muscles.p)}, technique, or doing too many reps too soon.`);
    H(r, 'Common reasons'); UL(r, e.mistakes.length ? e.mistakes.map(m => `${m}`) : ['Range of motion is too large for current strength', 'Moving too fast']);
    H(r, 'What to do');
    const easier = (e.easier || []).map(id => lib.get(id)).filter(Boolean);
    UL(r, [
      ...(easier.length ? [`Build up with an easier version: ${list(easier.map(x => x.name))}. Aim for 3 sets of 10–12 with good form, then progress.`] : []),
      'Do fewer reps with excellent form rather than many rushed reps.',
      'Slow the lowering phase to about 3 seconds — it builds strength fast.',
      'Train it 2–3 times a week, with a rest day between.',
    ]);
    if (ctx && ctx.lastSet && ctx.lastSet.exId === e.id) addContextNote(r, ctx);
    r.speak = `That's common. Try ${easier.length ? easier[0].name + ' first, ' : ''}fewer reps with good form, and a slower lowering phase.`;
    r.chips = easier.map(x => x.id); r.exId = e.id; return r;
  }
  function simpler(e) {
    const r = R(); P(r, e.simple); UL(r, e.steps.slice(0, 2));
    r.speak = e.simple; r.exId = e.id; return r;
  }
  function addContextNote(r, ctx) {
    const ls = ctx.lastSet;
    H(r, 'From your last set');
    if (!ls.tracked) P(r, 'Camera tracking was not active for that set, so I can’t comment on your movement — only on what you logged.');
    else if (!ls.assessedShare || ls.assessedShare < 0.5) P(r, 'Tracking confidence was too low during that set for me to assess your form reliably.');
    else {
      const issues = Object.values(ls.issues || {}).sort((a, b) => b.n - a.n);
      P(r, issues.length ? `The camera estimate flagged: ${issues.map(i => `${i.msg.replace(/!$/, '')} (${i.n}×)`).join(', ')}. Treat this as an approximate 2D estimate.` : `No form issues were flagged on the reps that were tracked with good confidence (${ls.good} counted).`);
    }
  }

  /* ---------------- general topics ---------------- */
  function restAnswer(e) {
    const r = R(); H(r, 'Direct answer');
    if (e) P(r, `For ${e.name.toLowerCase()}s, rest about ${e.def.rest} seconds between sets${e.level >= 3 ? ', or 2–3 minutes when lifting heavy' : ''}.`);
    else P(r, 'It depends on your goal:');
    UL(r, ['Heavy strength (1–6 reps): 2–3 minutes.', 'Building muscle (8–12 reps): 60–90 seconds.', 'Endurance and circuits: 30–60 seconds.', 'Mobility and stretching: little or no rest.']);
    H(r, 'Practical tip'); P(r, 'If your form slips at the start of the next set, rest longer. Ask “how much rest is left?” during a workout to hear the timer.');
    r.speak = e ? `Rest about ${e.def.rest} seconds between sets of ${e.name}.` : 'For strength, rest two to three minutes. For muscle building, sixty to ninety seconds. For endurance, thirty to sixty seconds.';
    return r;
  }
  const TOPICS = [
    [/\bwarm ?(up|ing)\b/, () => { const r = R(); H(r, 'Direct answer'); P(r, 'Warm up for 5–10 minutes before training: start with gentle movement, then rehearse the exercises you’re about to do with lighter effort.'); OL(r, ['2–3 minutes of marching or step jacks.', 'Arm circles and cat–cow to loosen joints.', 'One easy set of your first exercise.']); r.speak = 'Warm up for five to ten minutes. March in place, do some arm circles, then one easy set of your first exercise.'; return r; }],
    [/\b(cool ?down|stretch(ing)?)\b/, () => { const r = R(); H(r, 'Direct answer'); P(r, 'After training, take 5 minutes to bring your breathing down and gently stretch the muscles you used. Hold each stretch 20–40 seconds without bouncing.'); UL(r, ['Hamstring stretch', 'Kneeling hip flexor stretch', 'Child’s pose', 'Slow breathing with arm raises']); r.speak = 'Cool down for about five minutes. Hold gentle stretches for twenty to forty seconds without bouncing.'; return r; }],
    [/\b(sore|soreness|doms)\b/, () => { const r = R(); H(r, 'Direct answer'); P(r, 'Muscle soreness 1–2 days after a new or harder workout is normal and usually fades within 3 days. Gentle movement, sleep and hydration help.'); H(r, 'When to be careful'); P(r, 'Sharp pain, joint pain, swelling, or soreness that gets worse instead of better is not normal soreness — rest and consider seeing a professional.'); r.speak = 'Soreness one to two days after a harder workout is normal and fades within a few days. Sharp or joint pain is different — rest and get it checked.'; return r; }],
    [/\bhow often|times a week|frequency|every day\b/, () => { const r = R(); H(r, 'Direct answer'); P(r, 'Most people progress well with 3–4 sessions a week, giving each muscle group about 48 hours of recovery. Mobility work can be done daily.'); r.speak = 'Three to four sessions a week works well for most people, with about two days of recovery for each muscle group.'; return r; }],
    [/\bbreath(e|ing)\b/, () => { const r = R(); H(r, 'Direct answer'); P(r, 'Breathe out during the hardest part of the movement (standing up from a squat, pushing up from a push-up) and breathe in as you lower. Never hold your breath for long.'); r.speak = 'Breathe out on the effort, and in as you lower. Try not to hold your breath.'; return r; }],
    [/\b(progress(ive|ion)?|overload|get stronger|plateau\w*)\b/, () => { const r = R(); H(r, 'Direct answer'); P(r, 'Progress gradually: once you can complete all sets with good form, add 1–2 reps, a little weight, a slower tempo, or a harder variation — one change at a time.'); r.speak = 'Once all your sets feel solid, add one or two reps, a little weight, or a harder variation. Change one thing at a time.'; return r; }],
    [/\b(sets? and reps?|how many (sets|reps))\b/, () => { const r = R(); H(r, 'Direct answer'); UL(r, ['Strength: 3–5 sets of 3–6 reps.', 'Muscle and general fitness: 2–4 sets of 8–12 reps.', 'Endurance: 2–3 sets of 15+ reps or 30–60 seconds.']); r.speak = 'For general fitness, two to four sets of eight to twelve reps is a good starting point.'; return r; }],
  ];

  /* ---------------- workout generation ---------------- */
  const FOCUS = [
    ['upper', /\b(upper|arms?|chest|back|shoulders?|biceps?|triceps?|push|pull)\b/, ['chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps']],
    ['lower', /\b(lower|legs?|leg day|glutes?|quads?|hamstrings?|calves)\b/, ['quads', 'glutes', 'hamstrings', 'calves']],
    ['core', /\b(core|abs?|abdominals?|stomach)\b/, ['core', 'obliques', 'lower back']],
    ['mobility', /\b(mobility|stretch(ing)?|flexib|yoga|recovery|loosen|stiff)\b/, null],
    ['cardio', /\b(cardio|hiit|conditioning|fat|sweat|interval|endurance)\b/, null],
    ['full', /\b(full|whole|total) ?body\b/, null],
  ];
  function genWorkout(text) {
    const s = GF.store.settings;
    const m = /(\d+)\s*(?:-|\s)?\s*(?:min|minute)/.exec(text);
    const minutes = Math.max(10, Math.min(75, m ? +m[1] : (s.defaultDuration || 20)));
    let focus = 'full', muscles = null;
    for (const [k, re, mus] of FOCUS) if (re.test(text)) { focus = k; muscles = mus; break; }
    const level = /\badvanced\b/.test(text) ? 3 : /\bintermediate\b/.test(text) ? 2 : /\bbeginner|easy\b/.test(text) ? 1 : ({ beginner: 1, intermediate: 2, advanced: 3 }[s.level] || 1);
    const seated = /\b(seated|chair|wheelchair|sitting)\b/.test(text);
    const lowImpact = seated || /\b(low.?impact|no jump|quiet|apartment|knees?)\b/.test(text);
    const noEquip = /\b(no equipment|bodyweight|without equipment|no weights)\b/.test(text);
    const gym = /\bgym\b/.test(text);
    const said = [['dumbbells', /\bdumb ?bells?\b|\bweights\b/], ['band', /\b(resistance )?bands?\b/], ['bench', /\bbench\b/], ['barbell', /\bbarbell\b/], ['bar', /\bpull.?up bar\b/]].filter(([, re]) => re.test(text)).map(([k]) => k);
    const owned = noEquip ? [] : gym ? ['dumbbells', 'barbell', 'bench', 'machine', 'bar'] : [...new Set([...(s.equipment || []), ...said])];
    const basePool = slack => lib.list.filter(e => lib.hasEquipment(e, owned) && e.level <= level + slack && (!lowImpact || e.impact === 'low'));
    let pool = basePool(level === 1 ? 0 : 1);
    const SEATED = ['seatedPress', 'seatedCurl', 'seatedLateral', 'kneeExt', 'seatedMarch'];
    pool = seated ? pool.filter(e => SEATED.includes(e.id)) : pool.filter(e => !SEATED.includes(e.id));
    const isWarmCool = e => ['march', 'armCircles', 'seatedMarch', 'breathing', 'hamstringStretch', 'hipFlexorStretch', 'childPose', 'catCow', 'stepJack'].includes(e.id);
    let main;
    if (focus === 'mobility') main = pool.filter(e => e.cat.includes('mobility') || e.cat.includes('flexibility'));
    else if (focus === 'cardio') main = pool.filter(e => e.cat.includes('conditioning') || ['squat', 'lunge', 'pushup', 'kneePushup'].includes(e.id));
    else if (muscles) main = pool.filter(e => e.muscles.p.some(x => muscles.includes(x)) && !isWarmCool(e));
    else main = pool.filter(e => e.cat.includes('strength') && !isWarmCool(e));
    if (seated && focus !== 'mobility') main = pool.filter(e => e.id !== 'seatedMarch');
    if (main.length < 3 && !seated && muscles) {   // small pool: allow the next level up, and secondary-muscle exercises
      const SEATED_IDS = ['seatedPress', 'seatedCurl', 'seatedLateral', 'kneeExt', 'seatedMarch'];
      main = basePool(level === 1 ? 1 : 2).filter(e => !SEATED_IDS.includes(e.id) && !isWarmCool(e) && !(e.cat.length === 1 && e.cat[0] === 'conditioning') && (e.muscles.p.some(x => muscles.includes(x)) || e.muscles.s.some(x => muscles.includes(x))));
    }
    // prefer camera-checked and level-appropriate, avoid duplicates of the same pattern
    const seen = new Set();
    main = main.sort((a, b) => (said.includes(b.equip) ? 2 : 0) - (said.includes(a.equip) ? 2 : 0) + (b.track ? 1 : 0) - (a.track ? 1 : 0) + (Math.abs(a.level - level) - Math.abs(b.level - level)) * 0.5 + (Math.random() - 0.5) * 0.6)
      .filter(e => { const key = e.track || e.id; if (seen.has(key)) return false; seen.add(key); return true; });
    if (focus === 'full') { // balance push / legs / pull / core
      const pick = (pred) => main.find(e => pred(e) && !e._used);
      const order = [e => e.muscles.p.some(m => ['quads', 'glutes'].includes(m)), e => e.muscles.p.includes('chest') || e.muscles.p.includes('shoulders'), e => e.muscles.p.some(m => ['hamstrings', 'glutes', 'back', 'lats'].includes(m)), e => e.muscles.p.includes('core')];
      const chosen = []; order.forEach(fn => { const e = pick(fn); if (e) { e._used = true; chosen.push(e); } }); main.forEach(e => delete e._used);
      main = [...chosen, ...main.filter(e => !chosen.includes(e))];
    }
    const nMain = Math.max(3, Math.min(7, Math.round((minutes - 6) / 4.5)));
    main = main.slice(0, nMain);
    const repsFor = e => Math.round((e.def.reps || 10) * (level === 1 ? 0.9 : level === 3 ? 1.25 : 1));
    const durFor = e => Math.round((e.def.duration || 30) * (level === 1 ? 0.85 : level === 3 ? 1.3 : 1) / 5) * 5;
    const warm = seated ? [wk.exItem('seatedMarch', { sets: 1, duration: 60, rest: 10 })] : [wk.exItem('march', { sets: 1, duration: 60, rest: 10 }), wk.exItem('armCircles', { sets: 1, duration: 30, rest: 10 })];
    const cool = seated ? [wk.exItem('breathing', { sets: 1, duration: 60, rest: 0 })] : [wk.exItem('hamstringStretch', { sets: 1, duration: 30, rest: 5 }), wk.exItem('breathing', { sets: 1, duration: 45, rest: 0 })];
    let mainItems;
    if (focus === 'cardio' && main.length >= 3) {
      mainItems = [wk.group('circuit', main.map(e => wk.exItem(e.id, { mode: e.mode, reps: repsFor(e), duration: durFor(e), rest: 15 })), { rounds: 3, restAfterRound: 60 })];
    } else {
      mainItems = main.map(e => wk.exItem(e.id, { sets: focus === 'mobility' ? 1 : (level === 1 ? 2 : 3), reps: repsFor(e), duration: durFor(e) }));
    }
    const w = { id: null, generated: true, source: 'coach', name: `${minutes}-minute ${{ upper: 'upper-body', lower: 'lower-body', core: 'core', mobility: 'mobility', cardio: 'conditioning', full: 'full-body' }[focus]} workout`,
      description: `Created by the coach${lowImpact ? ' · low impact' : ''}${!owned.length ? ' · no equipment' : ''}.`, category: focus === 'mobility' ? 'mobility' : focus === 'cardio' ? 'conditioning' : 'strength',
      level: ['', 'beginner', 'intermediate', 'advanced'][level], schedule: [],
      blocks: [wk.block('warmup', focus === 'mobility' ? [] : warm), wk.block('main', mainItems), wk.block('cooldown', focus === 'mobility' ? [] : cool)] };
    // fit to the requested time by adjusting sets / rounds
    for (let i = 0; i < 6; i++) {
      const est = wk.estimateSeconds(w) / 60;
      const its = w.blocks[1].items;
      if (est > minutes * 1.15) { its.forEach(it => { if (it.kind === 'group') it.rounds = Math.max(2, it.rounds - 1); else if (it.sets > 1) it.sets--; }); }
      else if (est < minutes * 0.8) { its.forEach(it => { if (it.kind === 'group') it.rounds = Math.min(6, it.rounds + 1); else it.sets = Math.min(5, it.sets + 1); }); }
      else break;
    }
    if (!main.length) return null;
    return w;
  }
  function workoutAnswer(text) {
    const w = genWorkout(text);
    const r = R();
    if (!w) { P(r, 'I couldn’t build that with your equipment settings. Try “no equipment”, or add equipment in Settings.'); r.speak = 'I could not build that workout with your equipment.'; return r; }
    const mins = Math.round(wk.estimateSeconds(w) / 60);
    H(r, 'Here’s a plan');
    P(r, `${w.name} — about ${mins} minutes, ${wk.allExerciseItems(w).length} exercises. ${wk.trackedCount(w)} of them can be camera-checked.`);
    r.blocks.push({ t: 'workout', workout: w });
    H(r, 'How to use it'); P(r, 'Save it to your workouts to edit anything — sets, reps, rest, order — or start it right away.');
    r.speak = `Here's a ${w.name}, about ${mins} minutes. You can save it or start now.`;
    r.workout = w; return r;
  }

  /* ---------------- context answers ---------------- */
  function formReview(ctx) {
    const r = R();
    if (!ctx || !ctx.lastSet) { P(r, 'I don’t have a recent set to look at. Camera form tracking only runs during a workout, and only when you turn the camera on.'); r.speak = 'I have no recent tracked set to review.'; return r; }
    const e = lib.get(ctx.lastSet.exId);
    H(r, `Your last set: ${e ? e.name : 'exercise'}`);
    addContextNote(r, ctx);
    if (ctx.lastSet.tracked) P(r, `Counted: ${ctx.lastSet.good}. Not counted: ${ctx.lastSet.bad || 0}.`);
    r.speak = r.blocks.filter(b => b.t === 'p').map(b => b.text).join(' ');
    return r;
  }
  function focusNext(ctx) {
    const r = R();
    if (!ctx || !ctx.lastSet) { P(r, 'Start a workout and I can suggest a focus between sets. For now: move slowly, breathe out on the effort, and stop each set while your form is still good.'); r.speak = r.blocks[0].text; return r; }
    const e = lib.get(ctx.lastSet.exId);
    const issues = Object.values(ctx.lastSet.issues || {}).sort((a, b) => b.n - a.n);
    H(r, 'Focus for your next set');
    if (ctx.lastSet.tracked && ctx.lastSet.assessedShare >= 0.5 && issues.length) P(r, `${issues[0].msg.replace(/!$/, '')}. ${e && e.tips[0] ? e.tips[0] : ''}`);
    else P(r, `${e ? e.steps[Math.min(2, e.steps.length - 1)] : 'Control the movement.'} ${ctx.lastSet.tracked ? '' : '(Camera tracking was off, so this is general advice.)'}`);
    r.speak = r.blocks[1].text; return r;
  }

  function help() {
    const r = R();
    P(r, 'I’m your built-in GhostFit coach. I run on this device and know every exercise in the library. You can ask me things like:');
    UL(r, ['How do I improve my squat?', 'What muscles do lunges work?', 'What can replace burpees?', 'Create a 30-minute upper-body workout with no equipment', 'How long should I rest between sets?', 'Why am I struggling with push-ups?']);
    P(r, 'I’m not a general-purpose AI, so I’ll tell you when a question is outside what I know.');
    r.speak = 'Ask me how to do an exercise, what it works, alternatives, rest times, or ask me to build a workout.';
    return r;
  }
  function fallback(e) {
    const r = R();
    if (e) return howTo(e);
    P(r, 'I’m not sure how to answer that one — I only know about exercise technique, workouts, rest and recovery from GhostFit’s library.');
    UL(r, ['Try naming an exercise, e.g. “How do I do a plank?”', 'Or ask for a workout, e.g. “20-minute core workout”.']);
    r.speak = 'I am not sure about that one. Try asking about a specific exercise, or ask me to build a workout.';
    return r;
  }

  /** Main entry: text in → structured answer out. ctx is only provided if the user allows it. */
  function respond(text, ctx) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    if (RED_FLAGS.test(t)) return safety(t);
    let e = lib.find(t);
    if (!e && ctx && /\b(this|it|that|current|the exercise)\b/.test(t) && ctx.exId) e = lib.get(ctx.exId);
    if (PAIN.test(t) && !/\b(no pain|without pain|pain-?free)\b/.test(t)) return painAnswer(t, e);
    if (/\b(create|make|build|give me|plan|design|generate|write)\b.*\b(workout|routine|session|circuit|plan|program)\b|\b\d+\s*-?\s*min(ute)?s?\b.*\b(workout|routine|session)\b/.test(t)) return workoutAnswer(t);
    if (/\b(simpl\w*|plain english|easier to understand|explain (it|this) (again|simply)|eli5)\b/.test(t)) return e ? simpler(e) : (ctx && ctx.exId ? simpler(lib.get(ctx.exId)) : help());
    if (/\b(my form|how did i do|how was my|review my)\b/.test(t)) return formReview(ctx);
    if (/\b(focus|next set|what should i (focus|think|concentrate))\b/.test(t)) return focusNext(ctx);
    if (/\b(rest|between sets|recover(y)? time)\b/.test(t) && !/\b(rest day)\b/.test(t)) return restAnswer(e);
    if (e && /\b(replac\w*|alternatives?|substitut\w*|instead|swap\w*|other than|can'?t do|no (\w+ )?equipment for|switch\w*)\b/.test(t)) return alternatives(e, t);
    if (e && /\b(muscles?|target|work(s|ing)?|hit|train)\b/.test(t) && !/\bhow (do|to|should)\b/.test(t)) return muscles(e);
    if (e && /\b(struggl\w*|can'?t|cannot|hard|difficult\w*|weak\w*|fail\w*|unable|stuck)\b/.test(t)) return struggling(e, ctx);
    for (const [re, fn] of TOPICS) if (re.test(t)) return fn();
    if (e) return howTo(e, ctx);
    if (/\b(hi|hello|hey|help|what can you)\b/.test(t)) return help();
    return fallback(null);
  }

  GF.coach = { respond, genWorkout };
  void cap;
})(window.GF = window.GF || {});
