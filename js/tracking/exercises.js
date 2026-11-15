/* =========================================================================
   GhostFit – Exercise library + workout generator
   Every exercise defines:
     view     'side' | 'front'   which way the user should face the camera
     type     'reps' | 'hold'
     need     landmarks that MUST be clearly in frame before we track
     metric   the joint angle (or score) we track for reps
     start/end thresholds: a rep = start zone → past end → back to start
     gate     posture required before a rep can begin (blocks ghost reps)
     form     form checks; a rep with bad form is NOT counted
     ghost    keyframes for the animated ghost silhouette
   ========================================================================= */
(function (GF) {
  'use strict';

  /* ---------- geometry helpers (pixel points) ---------- */
  const deg = r => r * 180 / Math.PI;
  function ang(a, b, c) {                       // angle ABC in degrees
    const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (!m) return 180;
    return deg(Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / m))));
  }
  // angle of the vector bottom→top away from straight UP (0 = upright, 90 = horizontal)
  const lean = (top, bottom) => deg(Math.acos(Math.max(-1, Math.min(1, (bottom.y - top.y) / (Math.hypot(top.x - bottom.x, top.y - bottom.y) || 1)))));
  // angle of vector a→b away from straight DOWN
  const fromDown = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, (b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1)))));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const avg = (a, b) => (a + b) / 2;
  const both = (...names) => names.flatMap(n => [n + 'L', n + 'R']);
  // is the hip below the straight shoulder→ankle line? (sagging)
  function hipBelowLine(P) {
    const { shoulder: s, ankle: a, hip: h } = P;
    if (Math.abs(a.x - s.x) < 1) return h.y > s.y;
    const t = (h.x - s.x) / (a.x - s.x);
    return h.y > s.y + t * (a.y - s.y);
  }
  const horizontal = P => { const l = lean(P.shoulder, P.hip); return l > 55 && l < 135; };

  /* ---------- shared pieces ---------- */
  const STAND_LEGS = { thigh: 180, shin: 180 };
  const SEATED_FRONT = { thigh: 132, shin: 178, thighScale: 0.42 };

  const curlDef = {
    type: 'reps', view: 'front', joints: [['shoulderL', 'elbowL', 'wristL'], ['shoulderR', 'elbowR', 'wristR']],
    metric: P => avg(ang(P.shoulderL, P.elbowL, P.wristL), ang(P.shoulderR, P.elbowR, P.wristR)),
    start: 145, end: 60,
    endOk: P => (P.wristL.y + P.wristR.y) / 2 < (P.elbowL.y + P.elbowR.y) / 2,
    form: [{ id: 'elbows', test: P => Math.max(fromDown(P.shoulderL, P.elbowL), fromDown(P.shoulderR, P.elbowR)) > 38, msg: 'Pin your elbows to your sides!', say: 'Keep your elbows pinned to your sides' }],
    partial: 'Curl all the way up!',
    cues: ['Stand tall, arms by your sides, palms forward', 'Curl BOTH hands up to your shoulders', 'Elbows stay glued to your ribs', 'Lower slowly until arms are straight'],
  };
  const pressDef = {
    type: 'reps', view: 'front', joints: [['shoulderL', 'elbowL', 'wristL'], ['shoulderR', 'elbowR', 'wristR']],
    metric: P => avg(ang(P.shoulderL, P.elbowL, P.wristL), ang(P.shoulderR, P.elbowR, P.wristR)),
    start: 100, end: 155,
    gate: P => ((P.wristL.y + P.wristR.y) / 2 > (P.shoulderL.y + P.shoulderR.y) / 2 + 0.35 * P._torso) ? 'Bring your hands up to shoulder height' : null,
    // the top only counts with the hands above the head (stops "arms dropped to your sides" from looking like a lock-out)
    endOk: P => (P.wristL.y + P.wristR.y) / 2 < P.nose.y,
    // hands dropped well below the shoulders mid-rep = you stopped pressing, not a rep
    abort: P => (P.wristL.y + P.wristR.y) / 2 > (P.shoulderL.y + P.shoulderR.y) / 2 + 0.55 * P._torso,
    form: [{ id: 'stack', test: P => [['elbowL', 'wristL'], ['elbowR', 'wristR']].some(([e, w]) => P[w].y < P[e].y && lean(P[w], P[e]) > 52), msg: 'Press straight up — wrists over elbows!', say: 'Press straight up, wrists over elbows' }],
    partial: 'Lock out all the way overhead!',
    cues: ['Hands at shoulder height, elbows out (goal-post arms)', 'Press both hands straight up overhead', 'Keep wrists stacked over elbows', 'Lower back to shoulder height with control'],
  };
  const lateralDef = {
    type: 'reps', view: 'front', joints: [['hipL', 'shoulderL', 'elbowL'], ['hipR', 'shoulderR', 'elbowR']],
    metric: P => avg(ang(P.hipL, P.shoulderL, P.elbowL), ang(P.hipR, P.shoulderR, P.elbowR)),
    start: 30, end: 75,
    endOk: P => (P.elbowL.y + P.elbowR.y) / 2 < (P.shoulderL.y + P.shoulderR.y) / 2 + 0.3 * P._torso,
    form: [
      { id: 'high', test: P => Math.max(ang(P.hipL, P.shoulderL, P.elbowL), ang(P.hipR, P.shoulderR, P.elbowR)) > 115, msg: 'Stop at shoulder height!', say: 'Only raise to shoulder height' },
      { id: 'bent', test: P => Math.min(ang(P.shoulderL, P.elbowL, P.wristL), ang(P.shoulderR, P.elbowR, P.wristR)) < 125, msg: 'Keep your arms long!', say: 'Keep your arms long and straight' },
    ],
    partial: 'Raise your arms to shoulder height!',
    cues: ['Arms by your sides', 'Raise both arms out to the side', 'Stop when hands reach shoulder height (a T shape)', 'Lower slowly — no swinging'],
  };

  /* ---------- the library ---------- */
  const EX = {
    squat: {
      name: 'Squats', emoji: '🦵', type: 'reps', view: 'side', met: 5, repScale: 1,
      need: ['shoulder', 'hip', 'knee', 'ankle'], joints: [['hip', 'knee', 'ankle']],
      metric: P => ang(P.hip, P.knee, P.ankle), start: 160, end: 100,
      gate: P => lean(P.shoulder, P.hip) > 30 ? 'Stand up tall to start' : null,
      form: [{ id: 'chest', test: P => lean(P.shoulder, P.hip) > 52, msg: 'Keep your chest up!', say: 'Keep your chest up' }],
      partial: 'Go lower — thighs parallel!',
      cues: ['Feet shoulder-width apart', 'Push your hips back like sitting in a chair', 'Lower until thighs are parallel to the floor', 'Chest up, drive up through your heels'],
      ghost: { anchor: 'ankle', cycle: 2.6, pin: 'ankleA',
        start: { torso: 0, ...STAND_LEGS, uarm: 180, farm: 180 },
        end: { torso: 38, thigh: 102, shin: 208, uarm: 92, farm: 92 },
        bad: { torso: 72 } },
    },
    lunge: {
      name: 'Reverse Lunges', emoji: '🚶', type: 'reps', view: 'side', met: 4, repScale: 1,
      need: ['shoulder', 'hip', 'knee', 'ankle'], joints: [['hip', 'knee', 'ankle']],
      metric: P => ang(P.hip, P.knee, P.ankle), start: 155, end: 115,
      gate: P => lean(P.shoulder, P.hip) > 25 ? 'Stand up tall to start' : null,
      form: [{ id: 'tall', test: P => lean(P.shoulder, P.hip) > 32, msg: 'Stay tall — chest up!', say: 'Stay tall, chest up' }],
      partial: 'Drop that back knee lower!',
      cues: ['Stand tall, hands on hips', 'Step one foot back', 'Lower until both knees are bent ~90°', 'Push back up and switch legs'],
      ghost: { anchor: 'ankle', cycle: 2.8, pin: 'ankleA',
        start: { torso: 0, ...STAND_LEGS, uarm: 180, farm: 180 },
        end: { torso: 0, thighA: 95, shinA: 182, thighB: 188, shinB: 268, uarm: 180, farm: 180 },
        bad: { torso: 44 } },
    },
    bridge: {
      name: 'Glute Bridges', emoji: '🌉', type: 'reps', view: 'side', floor: true, met: 3.5, repScale: 1.2,
      need: ['shoulder', 'hip', 'knee', 'ankle'], joints: [['shoulder', 'hip', 'knee']],
      metric: P => ang(P.shoulder, P.hip, P.knee), start: 140, end: 168,
      gate: P => horizontal(P) ? null : 'Lie on your back, knees bent',
      form: [],
      partial: 'Push your hips higher!',
      cues: ['Lie on your back, knees bent, feet flat', 'Squeeze your glutes', 'Lift hips until knees-hips-shoulders make a line', 'Lower slowly'],
      ghost: { anchor: 'lowest', cycle: 2.8, pin: 'ankleA',
        start: { torso: -90, head: -90, thigh: 45, shin: 135, uarm: 90, farm: 90 },
        end: { torso: -120, head: -90, thigh: 58, shin: 170, uarm: 95, farm: 95 } },
    },
    wallsit: {
      name: 'Wall Sit', emoji: '🧱', type: 'hold', view: 'side', met: 4, holdScale: 1,
      need: ['shoulder', 'hip', 'knee', 'ankle'], joints: [['hip', 'knee', 'ankle']],
      metric: P => ang(P.hip, P.knee, P.ankle),
      check: P => {
        const k = ang(P.hip, P.knee, P.ankle);
        if (k > 118) return { id: 'low', msg: 'Slide lower — thighs parallel!', say: 'Slide lower, thighs parallel to the floor' };
        if (k < 62) return { id: 'high', msg: 'Come up a little!', say: 'Come up a little' };
        if (lean(P.shoulder, P.hip) > 25) return { id: 'back', msg: 'Back flat against the wall!', say: 'Keep your back flat on the wall' };
        return null;
      },
      cues: ['Back flat against a wall', 'Slide down until thighs are parallel', 'Knees over ankles', 'Hold it — breathe!'],
      ghost: { anchor: 'ankle', cycle: 3, pin: 'ankleA', props: ['wall'],
        start: { torso: 0, thigh: 90, shin: 180, uarm: 180, farm: 180 },
        bad: { thigh: 130 } },
    },
    pushup: {
      name: 'Push-ups', emoji: '🤸', type: 'reps', view: 'side', floor: true, met: 8, repScale: 0.75,
      need: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'], joints: [['shoulder', 'elbow', 'wrist'], ['shoulder', 'hip', 'ankle']],
      metric: P => ang(P.shoulder, P.elbow, P.wrist), start: 150, end: 95,
      gate: P => horizontal(P) ? null : 'Get into push-up position',
      form: [
        { id: 'sag', test: P => ang(P.shoulder, P.hip, P.ankle) < 155 && hipBelowLine(P), msg: 'Lift your hips — no sagging!', say: 'Lift your hips, keep a straight line' },
        { id: 'pike', test: P => ang(P.shoulder, P.hip, P.ankle) < 155 && !hipBelowLine(P), msg: 'Lower your hips — flat back!', say: 'Lower your hips, flat back' },
      ],
      partial: 'Lower your chest more!',
      cues: ['Hands under shoulders, body in a straight line', 'Lower until elbows hit 90°', 'Keep hips in line — no sagging', 'Knees down is fine too!'],
      ghost: { anchor: 'lowest', cycle: 2.4, pin: 'ankleA',
        start: { torso: 68, thigh: 248, shin: 248, uarm: 180, farm: 180 },
        end: { torso: 80, thigh: 260, shin: 260, uarm: 250, farm: 150 },
        bad: { torso: 62, thigh: 282, shin: 282 } },
    },
    plank: {
      name: 'Plank', emoji: '🪵', type: 'hold', view: 'side', floor: true, met: 4, holdScale: 1,
      need: ['shoulder', 'elbow', 'hip', 'ankle'], joints: [['shoulder', 'hip', 'ankle']],
      metric: P => ang(P.shoulder, P.hip, P.ankle),
      check: P => {
        if (!horizontal(P)) return { id: 'pos', msg: 'Get into plank position', say: 'Get down into your plank' };
        if (ang(P.shoulder, P.hip, P.ankle) < 160) return hipBelowLine(P)
          ? { id: 'sag', msg: 'Lift your hips!', say: 'Lift your hips' }
          : { id: 'pike', msg: 'Lower your hips — flat back!', say: 'Lower your hips, flat back' };
        return null;
      },
      cues: ['Forearms on the floor, elbows under shoulders', 'Body in one straight line', 'Squeeze your core and glutes', 'Breathe and hold!'],
      ghost: { anchor: 'lowest', cycle: 3, pin: 'ankleA',
        start: { torso: 78, thigh: 258, shin: 258, uarm: 180, farm: 90 },
        bad: { torso: 64, thigh: 282, shin: 282 } },
    },
    situp: {
      name: 'Sit-ups', emoji: '🔄', type: 'reps', view: 'side', floor: true, met: 5, repScale: 1,
      need: ['shoulder', 'hip', 'knee'], joints: [['shoulder', 'hip', 'knee']],
      metric: P => ang(P.shoulder, P.hip, P.knee), start: 115, end: 72,
      gate: P => horizontal(P) ? null : 'Lie back, knees bent',
      form: [],
      partial: 'Sit up higher!',
      cues: ['Lie back, knees bent, feet flat', 'Reach your hands toward your knees', 'Curl up until your chest is near your knees', 'Lower back down slowly'],
      ghost: { anchor: 'lowest', cycle: 2.8, pin: 'ankleA',
        start: { torso: -90, head: -90, thigh: 45, shin: 135, uarm: 60, farm: 60 },
        end: { torso: -5, head: 5, thigh: 45, shin: 135, uarm: 70, farm: 70 } },
    },
    legraise: {
      name: 'Leg Raises', emoji: '🦿', type: 'reps', view: 'side', floor: true, met: 4, repScale: 0.8,
      need: ['shoulder', 'hip', 'knee', 'ankle'], joints: [['shoulder', 'hip', 'knee'], ['hip', 'knee', 'ankle']],
      metric: P => ang(P.shoulder, P.hip, P.knee), start: 158, end: 112,
      gate: P => horizontal(P) ? null : 'Lie flat on your back',
      form: [{ id: 'straight', test: P => ang(P.hip, P.knee, P.ankle) < 140, msg: 'Keep your legs straight!', say: 'Keep your legs straight' }],
      partial: 'Lift your legs higher!',
      cues: ['Lie flat, hands by your sides', 'Keep legs straight and together', 'Lift legs up toward the ceiling', 'Lower slowly — heels hover above the floor'],
      ghost: { anchor: 'lowest', cycle: 3, pin: 'ankleA',
        start: { torso: -90, head: -90, thigh: 82, shin: 82, uarm: 90, farm: 90 },
        end: { torso: -90, head: -90, thigh: 8, shin: 8, uarm: 90, farm: 90 },
        bad: { thigh: 8, shin: 75 } },
    },
    jacks: {
      name: 'Jumping Jacks', emoji: '⭐', type: 'reps', view: 'front', met: 8, repScale: 2,
      need: both('shoulder', 'wrist', 'hip', 'ankle'), joints: [['hipL', 'shoulderL', 'wristL'], ['hipR', 'shoulderR', 'wristR']],
      metric: P => {
        const abd = avg(ang(P.hipL, P.shoulderL, P.wristL), ang(P.hipR, P.shoulderR, P.wristR));
        const spread = dist(P.ankleL, P.ankleR) / (dist(P.shoulderL, P.shoulderR) || 1);
        return 50 * clamp01((abd - 30) / 110) + 50 * clamp01((spread - 0.8) / 1.2);
      },
      start: 25, end: 75, metricUnit: '%',
      form: [],
      partial: 'Arms all the way up, feet wide!',
      cues: ['Start with feet together, arms down', 'Jump feet wide and clap hands overhead', 'Jump back to start', 'Stay light on your toes'],
      ghost: { anchor: 'feet', cycle: 1.3, pin: 'hipC',
        start: { uarm: 174, farm: 176, thigh: 178, shin: 178 },
        end: { uarm: 28, farm: 22, thigh: 158, shin: 162 } },
    },
    curl: Object.assign({}, curlDef, {
      name: 'Bicep Curls', emoji: '💪', met: 3.5, repScale: 1,
      need: both('shoulder', 'elbow', 'wrist', 'hip'),
      ghost: { anchor: 'feet', cycle: 2.4, pin: 'hipC',
        start: { uarm: 178, farm: 180, ...STAND_LEGS }, end: { uarm: 172, farm: 22 }, bad: { uarm: 120, farm: -20 } },
    }),
    press: Object.assign({}, pressDef, {
      name: 'Shoulder Press', emoji: '🙌', met: 3.5, repScale: 1,
      need: both('shoulder', 'elbow', 'wrist'),
      ghost: { anchor: 'feet', cycle: 2.4, pin: 'hipC',
        start: { uarm: 95, farm: 0, ...STAND_LEGS }, end: { uarm: 12, farm: 4 }, bad: { uarm: 55, farm: 58 } },
    }),
    lateral: Object.assign({}, lateralDef, {
      name: 'Lateral Raises', emoji: '🦅', met: 3, repScale: 1,
      need: both('shoulder', 'elbow', 'wrist', 'hip'),
      ghost: { anchor: 'feet', cycle: 2.6, pin: 'hipC',
        start: { uarm: 176, farm: 178, ...STAND_LEGS }, end: { uarm: 92, farm: 96 }, bad: { uarm: 32, farm: 30 } },
    }),

    /* ----- Chair-friendly (seated) ----- */
    seatedCurl: Object.assign({}, curlDef, {
      name: 'Seated Bicep Curls', emoji: '💪', seated: true, met: 2.5, repScale: 1,
      need: both('shoulder', 'elbow', 'wrist'),
      cues: ['Sit tall at the front of the chair', ...curlDef.cues.slice(1)],
      ghost: { anchor: 'seat', cycle: 2.4, pin: 'hipC', props: ['chair'],
        start: { uarm: 178, farm: 180, ...SEATED_FRONT }, end: { uarm: 172, farm: 22 }, bad: { uarm: 120, farm: -20 } },
    }),
    seatedPress: Object.assign({}, pressDef, {
      name: 'Seated Shoulder Press', emoji: '🙌', seated: true, met: 2.5, repScale: 1,
      need: both('shoulder', 'elbow', 'wrist'),
      cues: ['Sit tall, hands at shoulder height', ...pressDef.cues.slice(1)],
      ghost: { anchor: 'seat', cycle: 2.4, pin: 'hipC', props: ['chair'],
        start: { uarm: 95, farm: 0, ...SEATED_FRONT }, end: { uarm: 12, farm: 4 }, bad: { uarm: 55, farm: 58 } },
    }),
    seatedLateral: Object.assign({}, lateralDef, {
      name: 'Seated Lateral Raises', emoji: '🦅', seated: true, met: 2.5, repScale: 1,
      need: both('shoulder', 'elbow', 'wrist', 'hip'),
      cues: ['Sit tall, arms by your sides', ...lateralDef.cues.slice(1)],
      ghost: { anchor: 'seat', cycle: 2.6, pin: 'hipC', props: ['chair'],
        start: { uarm: 176, farm: 178, ...SEATED_FRONT }, end: { uarm: 92, farm: 96 }, bad: { uarm: 32, farm: 30 } },
    }),
    kneeExt: {
      name: 'Seated Knee Extensions', emoji: '🪑', type: 'reps', view: 'side', seated: true, met: 2, repScale: 1,
      need: ['shoulder', 'hip', 'knee', 'ankle'], joints: [['hip', 'knee', 'ankle']],
      metric: P => ang(P.hip, P.knee, P.ankle), start: 112, end: 155,
      form: [{ id: 'tall', test: P => lean(P.shoulder, P.hip) > 28, msg: 'Sit up tall!', say: 'Sit up tall' }],
      partial: 'Straighten your leg all the way!',
      cues: ['Sit tall, side-on to the camera', 'Use the leg closest to the camera', 'Straighten your knee until your leg is level', 'Lower slowly'],
      ghost: { anchor: 'seat', cycle: 2.6, pin: 'hip', props: ['chair'],
        start: { torso: -4, thigh: 90, shin: 180, uarm: 165, farm: 100 },
        end: { shin: 98 } },
    },
  };
  for (const [id, e] of Object.entries(EX)) { e.id = id; e.form = e.form || []; }

  /* ---------- Focus areas ---------- */
  const FOCUS = {
    arms:  { name: 'Arm Day',          emoji: '💪', tag: 'Sculpt & strengthen',       pool: ['pushup', 'curl', 'press', 'lateral'], color: '#ff5c8a' },
    legs:  { name: 'Leg Day',          emoji: '🦵', tag: 'Never skip it',             pool: ['squat', 'lunge', 'bridge', 'wallsit'], color: '#7c5cff' },
    core:  { name: 'Core Crusher',     emoji: '🔥', tag: 'Abs of steel',              pool: ['plank', 'situp', 'legraise', 'bridge'], color: '#ff9f1c' },
    full:  { name: 'Full Body Blast',  emoji: '⚡', tag: 'Everything, everywhere',     pool: ['jacks', 'squat', 'pushup', 'lunge', 'situp', 'plank'], color: '#00d4ff' },
    chair: { name: 'Chair Power',      emoji: '🪑', tag: 'Seated · all-access',       pool: ['seatedPress', 'seatedCurl', 'seatedLateral', 'kneeExt'], color: '#2ee59d' },
  };
  const LEVELS = {
    quick:    { name: 'Quick',      emoji: '🙂', reps: 8,  hold: 20, rest: 12, rounds: 1, maxEx: 4 },
    standard: { name: 'Standard',   emoji: '💪', reps: 12, hold: 30, rest: 20, rounds: 1, maxEx: 5 },
    beast:    { name: 'Beast Mode', emoji: '😈', reps: 15, hold: 45, rest: 15, rounds: 2, maxEx: 5 },
  };

  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** "AI" workout builder: picks, orders (standing → floor) and sets targets. */
  function generate(focusId, levelId) {
    const F = FOCUS[focusId], Lv = LEVELS[levelId];
    const chosen = shuffle(F.pool).slice(0, Math.min(Lv.maxEx, F.pool.length));
    // coach logic: standing reps first, then holds, then floor work
    const group = id => (EX[id].floor ? 2 : 0) + (EX[id].type === 'hold' ? 1 : 0);
    const ordered = chosen.slice().sort((a, b) => group(a) - group(b));
    const steps = [];
    for (let r = 0; r < Lv.rounds; r++) {
      for (const id of ordered) {
        const e = EX[id];
        steps.push(e.type === 'hold'
          ? { id, round: r + 1, target: Math.round(Lv.hold * (e.holdScale || 1)) }
          : { id, round: r + 1, target: Math.max(4, Math.round(Lv.reps * (e.repScale || 1))) });
      }
    }
    const secs = steps.reduce((s, st) => s + 12 + (EX[st.id].type === 'hold' ? st.target : st.target * EX[st.id].ghost.cycle * 0.9), 0) + Lv.rest * (steps.length - 1);
    return { focusId, levelId, focus: F, level: Lv, steps, estSeconds: Math.round(secs) };
  }

  GF.EX = EX; GF.FOCUS = FOCUS; GF.LEVELS = LEVELS; GF.generate = generate;
  GF.geo = { ang, lean, fromDown, dist, hipBelowLine };
})(window.GF = window.GF || {});
