/* GhostFit – Rehab programme data (knee + ankle).
   Gentle, staged exercises commonly used after sprains, ligament/meniscus tears, fractures and
   surgery around the knee and ankle. The camera measures range of motion (ROM) on the injured
   side. This is a guided home programme, NOT a replacement for a doctor or physiotherapist:
   users confirm they are cleared to exercise and pick the stage their clinician recommends. */
(function (GF) {
  'use strict';

  /* ---------- geometry on pixel points ---------- */
  const deg = r => r * 180 / Math.PI;
  function ang(a, b, c) {
    const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    return m ? deg(Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / m)))) : 180;
  }
  function between(u, v) {
    const m = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    return m ? deg(Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / m)))) : 0;
  }
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

  /** MediaPipe landmark indices per body side */
  const IDX = {
    L: { shoulder: 11, elbow: 13, wrist: 15, index: 19, hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31, nose: 0 },
    R: { shoulder: 12, elbow: 14, wrist: 16, index: 20, hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32, nose: 0 },
  };
  const UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 };

  /** Joint measurements in degrees. range = gauge scale */
  const METRICS = {
    kneeFlex: { need: ['hip', 'knee', 'ankle'], joint: 'knee', range: [0, 150], fn: p => 180 - ang(p.hip, p.knee, p.ankle) },
    footAngle: { need: ['knee', 'ankle', 'heel', 'toe'], joint: 'ankle', range: [60, 150], fn: p => between(sub(p.knee, p.ankle), sub(p.toe, p.heel)) },
    shinTilt: { need: ['knee', 'ankle'], joint: 'ankle', range: [0, 50], fn: p => between(sub(p.knee, p.ankle), UP) },
    legRaise: { need: ['shoulder', 'hip', 'knee'], joint: 'hip', range: [0, 120], fn: p => 180 - ang(p.shoulder, p.hip, p.knee) },
    legOut: { need: ['hip', 'knee'], joint: 'hip', range: [0, 50], fn: p => between(sub(p.knee, p.hip), DOWN) },
    hipLine: { need: ['shoulder', 'hip', 'knee'], joint: 'hip', range: [100, 180], fn: p => ang(p.shoulder, p.hip, p.knee) },
    armRaise: { need: ['hip', 'shoulder', 'elbow'], joint: 'shoulder', range: [0, 180], fn: p => ang(p.hip, p.shoulder, p.elbow) },
    elbowFlex: { need: ['shoulder', 'elbow', 'wrist'], joint: 'elbow', range: [0, 160], fn: p => 180 - ang(p.shoulder, p.elbow, p.wrist) },
    wristBend: { need: ['elbow', 'wrist', 'index'], joint: 'wrist', range: [0, 90], fn: p => between(sub(p.wrist, p.elbow), sub(p.index, p.wrist)) },
    trunkLean: { need: ['shoulder', 'hip'], joint: 'hip', range: [0, 90], fn: p => between(sub(p.shoulder, p.hip), UP) },
    trunkSide: { need: ['shoulderC', 'hipC'], joint: 'hipC', range: [0, 40], fn: p => between(sub(p.shoulderC, p.hipC), UP) },
    neckFlex: { need: ['nose', 'shoulder', 'hip'], joint: 'shoulder', range: [0, 60], fn: p => Math.max(0, between(sub(p.nose, p.shoulder), sub(p.shoulder, p.hip)) - 28) },
  };

  /** Range-of-motion scores tracked over the weeks. full = a typical healthy value. */
  const ROM = {
    kneeBend:      { area: 'knee',     label: 'Knee bend',          full: 135, better: 'higher', short: 'Bend' },
    kneeStraight:  { area: 'knee',     label: 'Knee straightening', full: 0,   better: 'lower',  short: 'Straighten', worst: 40 },
    legRaise:      { area: 'knee',     label: 'Straight-leg lift',  full: 60,  better: 'higher', short: 'Leg lift' },
    ankleUp:       { area: 'ankle',    label: 'Toes up',            full: 20,  better: 'higher', short: 'Toes up' },
    ankleDown:     { area: 'ankle',    label: 'Toes down',          full: 45,  better: 'higher', short: 'Toes down' },
    shinTilt:      { area: 'ankle',    label: 'Knee over toes',     full: 35,  better: 'higher', short: 'Knee-to-wall' },
    hipFlex:       { area: 'hip',      label: 'Knee lift',          full: 100, better: 'higher', short: 'Lift' },
    hipExt:        { area: 'hip',      label: 'Leg back',           full: 20,  better: 'higher', short: 'Back' },
    hipAbd:        { area: 'hip',      label: 'Leg out to side',    full: 40,  better: 'higher', short: 'Side' },
    shoulderFlex:  { area: 'shoulder', label: 'Arm forward & up',   full: 170, better: 'higher', short: 'Forward' },
    shoulderAbd:   { area: 'shoulder', label: 'Arm out & up',       full: 170, better: 'higher', short: 'Side' },
    elbowBend:     { area: 'elbow',    label: 'Elbow bend',         full: 145, better: 'higher', short: 'Bend' },
    elbowStraight: { area: 'elbow',    label: 'Elbow straightening', full: 0,  better: 'lower',  short: 'Straighten', worst: 40 },
    wristUp:       { area: 'wrist',    label: 'Wrist up',           full: 60,  better: 'higher', short: 'Up' },
    wristDown:     { area: 'wrist',    label: 'Wrist down',         full: 60,  better: 'higher', short: 'Down' },
    trunkFlex:     { area: 'back',     label: 'Bend forward',       full: 80,  better: 'higher', short: 'Forward' },
    trunkExt:      { area: 'back',     label: 'Bend back',          full: 25,  better: 'higher', short: 'Back' },
    trunkSide:     { area: 'back',     label: 'Side bend',          full: 30,  better: 'higher', short: 'Side' },
    neckFlex:      { area: 'neck',     label: 'Chin to chest',      full: 45,  better: 'higher', short: 'Nod' },
  };
  /** fraction of normal range reached (0..1) */
  function romPct(key, v) {
    const r = ROM[key]; if (v == null) return 0;
    if (r.better === 'lower') return Math.max(0, Math.min(1, 1 - (v - r.full) / (r.worst - r.full)));
    return Math.max(0, Math.min(1, v / r.full));
  }

  const STAND = { torso: 0, thigh: 180, shin: 180, uarm: 180, farm: 180 };
  const HOLDING = { uarm: 125, farm: 95 };          // hands resting on a counter / chair back
  const SEATED = { torso: 0, thigh: 90, shin: 180, uarm: 165, farm: 120 };
  const LEGOUT = { torso: 0, thigh: 131, shin: 131, uarm: 165, farm: 120 };   // seated, leg straight out, heel on floor
  const LYING = { torso: -90, head: -90, uarm: 90, farm: 90, thigh: 45, shin: 135 };   // on your back, knees bent
  const FOURS = { torso: 90, head: 100, uarm: 180, farm: 180, thigh: 180, shin: 270, foot: 270 };   // hands and knees
  const TABLE = { ...SEATED, uarmA: 160, farmA: 90 };   // seated, forearm resting forward on a table
  const FSTAND = { lean: 0, uarm: 180, farm: 180, thigh: 180, shin: 180 };   // front view standing

  /* ---------- the exercises ----------
     areas: which injury areas use it      phases: stages it belongs to (1 Gentle, 2 Strength, 3 Normal)
     mode:  reps  → count reps on `metric` moving from `restAt` to `reach` and back (no metric = tap to count)
            hold  → hold for `hold` seconds; with the camera, time only runs while `holdOk` is met
            timed → follow along for `time` seconds
     wb:    how much the injured part may be used: none | partial | full
     rom:   which ROM scores this exercise measures      view: side (default) | front */
  const EX = [
    // ================= KNEE =================
    { id: 'k_quadset', areas: ['knee'], phases: [1], wb: 'none', pos: 'Sitting on the floor', name: 'Thigh Squeeze', muscles: { p: ['quads'] },
      short: 'Wake up the thigh muscle', steps: ['Sit with your leg straight out', 'Push the back of your knee down and tighten your thigh', 'Hold, then relax'],
      mode: 'hold', sets: 8, hold: 5, rest: 4, metric: 'kneeFlex', holdOk: { below: 20, msg: 'Straighten your knee' },
      ghost: { anchor: 'lowest', cycle: 3, start: { torso: 5, thigh: 90, shin: 92, uarm: 160, farm: 160 } }, type: 'hold', floor: true },
    { id: 'k_heelslide', areas: ['knee', 'hip'], phases: [1], wb: 'none', pos: 'Lying on your back', name: 'Heel Slide', muscles: { p: ['hamstrings'], s: ['quads', 'hip flexors'] },
      short: 'Bend the knee with no weight', steps: ['Lie on your back, legs straight', 'Slide your heel toward your bottom', 'Slide it back out slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'kneeFlex', restAt: 30, reach: 60, rom: { kneeBend: 'max' },
      ghost: { anchor: 'lowest', cycle: 3.4, start: { ...LYING, thighA: 90, shinA: 90, thighB: 90, shinB: 90 }, end: { thighA: 42, shinA: 140 } }, type: 'reps', floor: true },
    { id: 'k_ext', areas: ['knee'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting on a chair', name: 'Knee Straightening', muscles: { p: ['quads'] },
      short: 'Get your knee fully straight', steps: ['Sit tall on a chair', 'Slowly straighten your knee as far as you can', 'Pause, then lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'kneeFlex', restAt: 55, reach: 25, rom: { kneeStraight: 'min' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 3.2, start: { ...SEATED }, end: { shinA: 98 } }, type: 'reps' },
    { id: 'k_seatbend', areas: ['knee'], phases: [1, 2], wb: 'none', pos: 'Sitting on a chair', name: 'Seated Knee Bend', muscles: { p: ['hamstrings'], s: ['quads'] },
      short: 'Get your bend back', steps: ['Sit on a chair, foot on the floor', 'Slide your foot back under the chair', 'Stop at a gentle stretch, then slide forward'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'kneeFlex', restAt: 70, reach: 90, rom: { kneeBend: 'max' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 3.4, start: { ...SEATED, shinA: 150 }, end: { shinA: 215 } }, type: 'reps' },
    { id: 'k_slr', areas: ['knee'], phases: [1, 2], wb: 'none', pos: 'Lying on your back', name: 'Straight-Leg Raise', muscles: { p: ['quads', 'hip flexors'] },
      short: 'Strengthen without bending', steps: ['Lie down, other knee bent', 'Tighten your thigh, keep the knee straight', 'Lift the leg to the height of your other knee, lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'legRaise', restAt: 10, reach: 28, rom: { legRaise: 'max' },
      check: { metric: 'kneeFlex', above: 22, msg: 'Keep that knee straight' },
      ghost: { anchor: 'lowest', cycle: 3.2, start: { ...LYING, thighA: 90, shinA: 90 }, end: { thighA: 48, shinA: 48 } }, type: 'reps', floor: true },
    { id: 'k_minisquat', areas: ['knee'], phases: [2], wb: 'partial', pos: 'Standing, hands on a counter', name: 'Mini Squat', muscles: { p: ['quads', 'glutes'] },
      short: 'Small, safe knee bends', steps: ['Hold a counter or chair back', 'Bend both knees a little — like starting to sit', 'Stand back up tall'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'kneeFlex', restAt: 12, reach: 28, limit: { above: 65, msg: 'Not so deep yet — small bends only' },
      ghost: { anchor: 'ankle', cycle: 2.8, start: { ...STAND, ...HOLDING }, end: { torso: 14, thigh: 160, shin: 200 } }, type: 'reps' },
    { id: 'k_sitstand', areas: ['knee', 'hip'], phases: [2, 3], wb: 'partial', pos: 'Sitting on a chair', name: 'Sit to Stand', muscles: { p: ['quads', 'glutes'], s: ['core'] },
      short: 'Everyday strength', steps: ['Sit near the front of a firm, higher chair', 'Lean forward and stand up (use your hands if needed)', 'Sit back down slowly'],
      mode: 'reps', sets: 2, reps: 8, rest: 40, metric: 'kneeFlex', restAt: 70, reach: 20,
      ghost: { anchor: 'ankle', cycle: 3.4, start: { torso: 28, thigh: 95, shin: 180, uarm: 120, farm: 110 }, end: { ...STAND } }, type: 'reps' },
    { id: 'k_hamcurl', areas: ['knee'], phases: [2, 3], wb: 'partial', pos: 'Standing, hands on a counter', name: 'Standing Knee Curl', muscles: { p: ['hamstrings'] },
      short: 'Bend against gravity', steps: ['Stand holding a counter', 'Bend your injured knee, bringing the heel up behind you', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'kneeFlex', restAt: 25, reach: 60, rom: { kneeBend: 'max' },
      ghost: { anchor: 'feet', anchorX: 'ankleB', cycle: 3, start: { ...STAND, ...HOLDING }, end: { thighA: 186, shinA: 272 } }, type: 'reps' },
    { id: 'k_wallsit', areas: ['knee'], phases: [3], wb: 'full', pos: 'Back against a wall', name: 'Short Wall Sit', muscles: { p: ['quads', 'glutes'] },
      short: 'Build staying power', steps: ['Back flat against a wall', 'Slide down until your knees bend a little', 'Hold, then slide up'],
      mode: 'hold', sets: 3, hold: 20, rest: 30, metric: 'kneeFlex', holdOk: { above: 35, msg: 'Slide down a little more' }, limit: { above: 95, msg: 'That’s deep enough — come up a little' },
      ghost: { anchor: 'ankle', props: ['wall'], cycle: 3, start: { torso: 0, thigh: 120, shin: 180, uarm: 180, farm: 180 } }, type: 'hold' },
    { id: 'k_squat3', areas: ['knee'], phases: [3], wb: 'full', pos: 'Standing', name: 'Chair-Height Squat', muscles: { p: ['quads', 'glutes'], s: ['hamstrings'] },
      short: 'Back to full squats', steps: ['Feet hip-width apart', 'Sit back until your thighs are nearly level', 'Stand up through your heels'],
      mode: 'reps', sets: 2, reps: 10, rest: 40, metric: 'kneeFlex', restAt: 15, reach: 65, limit: { above: 115, msg: 'That’s deep enough' },
      ghost: { anchor: 'ankle', cycle: 2.8, start: { ...STAND }, end: { torso: 35, thigh: 108, shin: 205, uarm: 95, farm: 95 } }, type: 'reps' },

    // ================= ANKLE =================
    { id: 'a_pumps', areas: ['ankle'], phases: [1, 2], wb: 'none', pos: 'Sitting, leg out', name: 'Ankle Pumps', muscles: { p: ['calves', 'shins'] },
      short: 'Move the ankle both ways', steps: ['Sit with your leg out, heel on the floor', 'Pull your toes up toward you', 'Then point them away — slow and smooth'],
      mode: 'reps', sets: 2, reps: 15, rest: 20, metric: 'footAngle', restAt: 95, reach: 112, rom: { ankleUp: 'up', ankleDown: 'down' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2.6, start: { ...LEGOUT, footA: 25 }, end: { footA: 85 } }, type: 'reps' },
    { id: 'a_alphabet', areas: ['ankle'], phases: [1], wb: 'none', pos: 'Sitting, leg out', name: 'Ankle Alphabet', muscles: { p: ['ankle'] },
      short: 'Draw letters with your toes', steps: ['Sit with your leg out', 'Trace A to Z in the air with your big toe', 'Move only the ankle'],
      mode: 'timed', time: 60, sets: 1, rest: 15,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 1.8, start: { ...LEGOUT, footA: 30 }, end: { footA: 70 } }, type: 'reps' },
    { id: 'a_towelcurl', areas: ['ankle'], phases: [1, 2], wb: 'none', pos: 'Sitting on a chair', name: 'Towel Scrunch', muscles: { p: ['ankle'] },
      short: 'Wake up the foot muscles', steps: ['Sit with a towel under your foot', 'Scrunch the towel toward you with your toes', 'Spread it out and repeat'],
      mode: 'timed', time: 45, sets: 1, rest: 15,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 1.6, start: { ...SEATED, footA: 90 }, end: { footA: 100 } }, type: 'reps' },
    { id: 'a_towel', areas: ['ankle'], phases: [1, 2], wb: 'none', pos: 'Sitting on the floor', name: 'Towel Calf Stretch', muscles: { p: ['calves'] },
      short: 'Gentle calf stretch', steps: ['Sit with your leg straight', 'Loop a towel around the ball of your foot', 'Pull your toes toward you and hold'],
      mode: 'hold', sets: 3, hold: 25, rest: 10, metric: 'footAngle', holdOk: { below: 90, msg: 'Pull your toes toward you' }, rom: { ankleUp: 'up' }, avoid: ['achilles'],
      ghost: { anchor: 'lowest', cycle: 3, start: { torso: 12, thigh: 90, shin: 90, footA: -14, footB: 0, uarm: 100, farm: 95 } }, type: 'hold', floor: true },
    { id: 'a_seatraise', areas: ['ankle'], phases: [1, 2], wb: 'partial', pos: 'Sitting on a chair', name: 'Seated Heel Raise', muscles: { p: ['calves'] },
      short: 'Light calf work', steps: ['Sit with feet flat', 'Lift your heels, keep the toes down', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 15, rest: 30, metric: 'footAngle', restAt: 100, reach: 114, rom: { ankleDown: 'down' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2.6, start: { ...SEATED, footA: 90 }, end: { thighA: 84, footA: 132 } }, type: 'reps' },
    { id: 'a_side', areas: ['ankle'], phases: [2], wb: 'partial', pos: 'Sitting, leg out', name: 'Ankle Side-to-Side', muscles: { p: ['ankle', 'shins'] },
      short: 'Sideways control', steps: ['Sit with your leg out', 'Turn the sole of your foot in, then out', 'Keep the knee still'],
      mode: 'timed', time: 45, sets: 2, rest: 15,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2, start: { ...LEGOUT, footA: 40 }, end: { footA: 55 } }, type: 'reps' },
    { id: 'a_raise', areas: ['ankle'], phases: [2, 3], wb: 'full', pos: 'Standing, hands on a counter', name: 'Heel Raise', muscles: { p: ['calves'] },
      short: 'Rebuild calf strength', steps: ['Stand holding a counter', 'Rise up onto your toes', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 12, rest: 40, metric: 'footAngle', restAt: 100, reach: 116, rom: { ankleDown: 'down' },
      ghost: { anchor: 'lowest', cycle: 2.6, start: { ...STAND, ...HOLDING, foot: 90 }, end: { foot: 138 } }, type: 'reps' },
    { id: 'a_kneewall', areas: ['ankle'], phases: [2, 3], wb: 'full', pos: 'Standing, facing a wall', name: 'Knee to Wall', muscles: { p: ['calves'], s: ['shins'] },
      short: 'Bend the ankle forward', steps: ['Face a wall, injured foot in front', 'Keep the heel down and push the knee toward the wall', 'Come back and repeat'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'shinTilt', restAt: 8, reach: 18, rom: { shinTilt: 'max' }, avoidEarly: ['achilles'],
      ghost: { anchor: 'ankle', cycle: 2.8, start: { torso: 0, thighA: 176, shinA: 180, footA: 90, thighB: 196, shinB: 196, uarm: 110, farm: 80 }, end: { thighA: 150, shinA: 208 } }, type: 'reps' },
    { id: 'a_single', areas: ['ankle'], phases: [3], wb: 'full', pos: 'Standing on one leg', name: 'One-Leg Heel Raise', muscles: { p: ['calves'], s: ['glutes'] },
      short: 'Full-strength calf', steps: ['Stand on your injured leg, hold a counter', 'Rise up onto your toes', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 45, metric: 'footAngle', restAt: 100, reach: 114, rom: { ankleDown: 'down' },
      ghost: { anchor: 'lowest', cycle: 2.8, start: { ...STAND, ...HOLDING, thighB: 180, shinB: 250, footA: 90 }, end: { footA: 136 } }, type: 'reps' },
    { id: 'balance', areas: ['knee', 'ankle', 'hip'], phases: [3], wb: 'full', pos: 'Standing near a counter', name: 'One-Leg Balance', muscles: { p: ['ankle', 'glutes'], s: ['core'] },
      short: 'Retrain balance', steps: ['Stand on your injured leg', 'Lift the other foot', 'Hold steady — touch the counter if you wobble'],
      mode: 'timed', time: 30, sets: 2, rest: 20,
      ghost: { anchor: 'ankle', cycle: 3, start: { ...STAND, uarm: 150, farm: 140, thighB: 135, shinB: 185 } }, type: 'hold' },

    // ================= HIP =================
    { id: 'h_glutesq', areas: ['hip', 'back'], phases: [1], wb: 'none', pos: 'Lying on your back', name: 'Glute Squeeze', muscles: { p: ['glutes'] },
      short: 'Switch the glutes back on', steps: ['Lie on your back, knees bent', 'Squeeze your buttocks together', 'Hold, then relax'],
      mode: 'hold', sets: 8, hold: 5, rest: 4,
      ghost: { anchor: 'lowest', cycle: 3, start: { ...LYING } }, type: 'hold', floor: true },
    { id: 'h_sideleg', areas: ['hip'], view: 'front', phases: [1, 2, 3], wb: 'partial', pos: 'Standing, facing the camera', name: 'Side Leg Raise', muscles: { p: ['glutes', 'hips'] },
      short: 'Strengthen the side of the hip', steps: ['Stand tall holding a chair', 'Lift your leg out to the side, toes forward', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'legOut', restAt: 8, reach: 18, rom: { hipAbd: 'max' },
      ghost: { anchor: 'feet', cycle: 2.8, start: { ...FSTAND }, end: { thighR: 152, shinR: 152 } }, type: 'reps' },
    { id: 'h_kneeraise', areas: ['hip'], phases: [2, 3], wb: 'partial', pos: 'Standing, hands on a counter', name: 'Standing Knee Lift', muscles: { p: ['hip flexors'], s: ['core'] },
      short: 'Lift the knee in front', steps: ['Stand holding a counter', 'Lift your knee up in front of you', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'legRaise', restAt: 20, reach: 50, rom: { hipFlex: 'max' },
      injuryLimit: { replacement: { above: 85, msg: 'Keep it below hip height (hip precaution)' } },
      ghost: { anchor: 'feet', anchorX: 'ankleB', cycle: 2.8, start: { ...STAND, ...HOLDING }, end: { thighA: 105, shinA: 185 } }, type: 'reps' },
    { id: 'h_backleg', areas: ['hip'], phases: [1, 2, 3], wb: 'partial', pos: 'Standing, hands on a counter', name: 'Leg Back Kick', muscles: { p: ['glutes'], s: ['hamstrings'] },
      short: 'Straighten through the hip', steps: ['Stand holding a counter', 'Move your straight leg back', 'Don’t lean forward or arch your back'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'legRaise', restAt: 6, reach: 14, rom: { hipExt: 'max' },
      ghost: { anchor: 'feet', anchorX: 'ankleB', cycle: 2.8, start: { ...STAND, ...HOLDING }, end: { thighA: 203, shinA: 206 } }, type: 'reps' },
    { id: 'h_bridge', areas: ['hip', 'knee', 'back'], phases: [2, 3], wb: 'partial', pos: 'Lying on your back', name: 'Bridge', muscles: { p: ['glutes'], s: ['hamstrings', 'lower back'] },
      short: 'Hips up, glutes on', steps: ['Lie on your back, knees bent', 'Squeeze your glutes and lift your hips', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'hipLine', restAt: 145, reach: 163,
      ghost: { anchor: 'lowest', cycle: 2.8, start: { ...LYING }, end: { torso: -120, thigh: 58, shin: 170 } }, type: 'reps', floor: true },
    { id: 'h_clam', areas: ['hip'], phases: [1, 2], wb: 'none', pos: 'Lying on your side', name: 'Clamshell', muscles: { p: ['glutes', 'hips'] },
      short: 'Gentle hip opener', steps: ['Lie on your side, knees bent', 'Keep feet together and lift the top knee', 'Lower slowly — tap +1 each time'],
      mode: 'reps', sets: 2, reps: 10, rest: 30,
      ghost: { anchor: 'lowest', cycle: 2.6, start: { ...LYING, torso: -90, thighB: 45 }, end: { thighB: 15 } }, type: 'reps', floor: true },

    // ================= SHOULDER =================
    { id: 's_pendulum', areas: ['shoulder'], phases: [1], wb: 'none', pos: 'Leaning on a table', name: 'Pendulum Swing', muscles: { p: ['shoulders'] },
      short: 'Let the arm swing loose', steps: ['Lean on a table with your good hand', 'Let the injured arm hang down', 'Gently swing it in small circles'],
      mode: 'timed', time: 40, sets: 2, rest: 15,
      ghost: { cycle: 2.2, start: { torso: 55, head: 70, thigh: 175, shin: 180, uarmB: 115, farmB: 140, uarmA: 172, farmA: 172 }, end: { uarmA: 196, farmA: 196 } }, type: 'reps' },
    { id: 's_tableslide', areas: ['shoulder'], phases: [1, 2], wb: 'none', pos: 'Sitting at a table', name: 'Table Slide', muscles: { p: ['shoulders'] },
      short: 'Reach forward with support', steps: ['Sit at a table, forearm resting on it', 'Slide your hand forward as far as is comfortable', 'Slide back'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'armRaise', restAt: 45, reach: 65, rom: { shoulderFlex: 'max' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 3.2, start: { ...SEATED, uarmA: 150, farmA: 95 }, end: { uarmA: 96, farmA: 92 } }, type: 'reps' },
    { id: 's_wallwalk', areas: ['shoulder'], phases: [1, 2], wb: 'partial', pos: 'Standing, facing a wall', name: 'Wall Walk', muscles: { p: ['shoulders'] },
      short: 'Climb the wall with your fingers', steps: ['Stand facing a wall', 'Walk your fingers up as high as is comfortable', 'Walk them back down'],
      mode: 'reps', sets: 2, reps: 8, rest: 30, metric: 'armRaise', restAt: 85, reach: 120, rom: { shoulderFlex: 'max' },
      ghost: { cycle: 4, start: { ...STAND, uarmA: 120, farmA: 110 }, end: { uarmA: 30, farmA: 25 } }, type: 'reps' },
    { id: 's_squeeze', areas: ['shoulder', 'neck'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting or standing tall', name: 'Shoulder Blade Squeeze', muscles: { p: ['upper back'], s: ['rear shoulders'] },
      short: 'Good posture muscles', steps: ['Sit or stand tall', 'Squeeze your shoulder blades back and down', 'Hold, then relax'],
      mode: 'hold', sets: 8, hold: 5, rest: 4,
      ghost: { cycle: 3, start: { ...STAND, uarm: 196, farm: 150 } }, type: 'hold' },
    { id: 's_frontraise', areas: ['shoulder'], phases: [2, 3], wb: 'partial', pos: 'Standing side-on', name: 'Front Raise', muscles: { p: ['shoulders'] },
      short: 'Lift forward to shoulder height', steps: ['Stand tall, arm by your side', 'Lift the arm forward to shoulder height', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'armRaise', restAt: 30, reach: 70, rom: { shoulderFlex: 'max' },
      ghost: { cycle: 3, start: { ...STAND }, end: { uarmA: 90, farmA: 90 } }, type: 'reps' },
    { id: 's_sideraise', areas: ['shoulder'], view: 'front', phases: [2, 3], wb: 'partial', pos: 'Standing, facing the camera', name: 'Side Raise', muscles: { p: ['shoulders'] },
      short: 'Lift out to the side', steps: ['Stand facing the camera', 'Lift your arm out to the side to shoulder height', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'armRaise', restAt: 30, reach: 70, rom: { shoulderAbd: 'max' },
      ghost: { anchor: 'feet', cycle: 3, start: { ...FSTAND }, end: { uarmR: 90, farmR: 90 } }, type: 'reps' },
    { id: 's_extrot', areas: ['shoulder'], view: 'front', phases: [2, 3], wb: 'partial', pos: 'Standing, elbow at your side', name: 'Outward Rotation', muscles: { p: ['rotator cuff'] },
      short: 'Strengthen the rotator cuff', steps: ['Elbow tucked at your side, bent to 90°', 'Turn your hand out away from your belly', 'Come back — tap +1 each time'],
      mode: 'reps', sets: 2, reps: 12, rest: 30,
      ghost: { anchor: 'feet', cycle: 2.8, start: { ...FSTAND, farmR: 150 }, end: { farmR: 100 } }, type: 'reps' },
    { id: 's_overhead', areas: ['shoulder'], view: 'front', phases: [3], wb: 'full', pos: 'Standing, facing the camera', name: 'Overhead Press', muscles: { p: ['shoulders'], s: ['triceps'] },
      short: 'Full reach overhead', steps: ['Hands at shoulder height', 'Press straight up overhead', 'Lower back to shoulders'],
      mode: 'reps', sets: 2, reps: 10, rest: 40, metric: 'armRaise', restAt: 110, reach: 145, rom: { shoulderAbd: 'max' },
      ghost: { anchor: 'feet', cycle: 3, start: { ...FSTAND, uarm: 95, farm: 5 }, end: { uarm: 15, farm: 5 } }, type: 'reps' },
    { id: 'u_wallpush', areas: ['shoulder', 'elbow', 'wrist'], phases: [3], wb: 'full', pos: 'Leaning on a wall', name: 'Wall Push-Up', muscles: { p: ['chest', 'triceps'], s: ['shoulders'] },
      short: 'Push with your whole arm', steps: ['Hands on a wall at shoulder height', 'Bend your elbows to bring your chest in', 'Push back out'],
      mode: 'reps', sets: 2, reps: 10, rest: 40, metric: 'elbowFlex', restAt: 30, reach: 70,
      ghost: { anchor: 'feet', cycle: 2.8, start: { torso: 22, thigh: 202, shin: 202, uarm: 95, farm: 95 }, end: { uarm: 140, farm: 40 } }, type: 'reps' },

    // ================= ELBOW =================
    { id: 'e_bend', areas: ['elbow'], phases: [1, 2, 3], wb: 'none', pos: 'Standing side-on', name: 'Elbow Bend & Straighten', muscles: { p: ['biceps', 'triceps'] },
      short: 'Get the full range back', steps: ['Arm by your side, palm forward', 'Bend the elbow as far as you can', 'Straighten it all the way'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'elbowFlex', restAt: 40, reach: 100, rom: { elbowBend: 'max', elbowStraight: 'min' },
      ghost: { cycle: 3, start: { ...STAND }, end: { farmA: 35 } }, type: 'reps' },
    { id: 'e_rotate', areas: ['elbow', 'wrist'], phases: [1, 2], wb: 'none', pos: 'Sitting, elbow bent', name: 'Palm Up, Palm Down', muscles: { p: ['forearms'] },
      short: 'Turn the forearm', steps: ['Sit, elbow at your side bent to 90°', 'Turn your palm up to the ceiling', 'Then down to the floor'],
      mode: 'timed', time: 40, sets: 2, rest: 15,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2, start: { ...SEATED, uarmA: 180, farmA: 90 } }, type: 'hold' },
    { id: 'e_curl', areas: ['elbow'], phases: [2, 3], wb: 'partial', pos: 'Standing side-on', name: 'Light Curl', muscles: { p: ['biceps'], s: ['forearms'] },
      short: 'Hold a water bottle', steps: ['Hold a light bottle, arm by your side', 'Curl it up to your shoulder', 'Lower slowly all the way'],
      mode: 'reps', sets: 2, reps: 12, rest: 30, metric: 'elbowFlex', restAt: 40, reach: 100, rom: { elbowBend: 'max' },
      ghost: { cycle: 2.8, start: { ...STAND }, end: { farmA: 40 } }, type: 'reps' },
    { id: 'e_overhead', areas: ['elbow'], phases: [3], wb: 'full', pos: 'Standing side-on', name: 'Overhead Elbow Straighten', muscles: { p: ['triceps'] },
      short: 'Lock the elbow out', steps: ['Raise your arm, hand behind your head', 'Straighten the elbow up to the ceiling', 'Lower behind your head'],
      mode: 'reps', sets: 2, reps: 10, rest: 30, metric: 'elbowFlex', restAt: 110, reach: 30, rom: { elbowStraight: 'min' },
      ghost: { cycle: 3, start: { ...STAND, uarmA: 10, farmA: 170 }, end: { farmA: 10 } }, type: 'reps' },

    // ================= WRIST & HAND =================
    { id: 'w_up', areas: ['wrist', 'elbow'], phases: [1, 2], wb: 'none', pos: 'Forearm on a table', name: 'Wrist Up', muscles: { p: ['forearms'] },
      short: 'Bend the wrist back', steps: ['Rest your forearm on a table, hand over the edge', 'Lift your hand up', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 12, rest: 20, metric: 'wristBend', restAt: 15, reach: 32, rom: { wristUp: 'max' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2.6, start: { ...TABLE, hand: 0 }, end: { hand: -55 } }, type: 'reps' },
    { id: 'w_down', areas: ['wrist'], phases: [1, 2], wb: 'none', pos: 'Forearm on a table', name: 'Wrist Down', muscles: { p: ['forearms'] },
      short: 'Bend the wrist forward', steps: ['Rest your forearm on a table, palm down', 'Let your hand drop down', 'Lift back to level'],
      mode: 'reps', sets: 2, reps: 12, rest: 20, metric: 'wristBend', restAt: 15, reach: 32, rom: { wristDown: 'max' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2.6, start: { ...TABLE, hand: 0 }, end: { hand: 55 } }, type: 'reps' },
    { id: 'w_side', areas: ['wrist'], phases: [1, 2], wb: 'none', pos: 'Forearm on a table', name: 'Wrist Side-to-Side', muscles: { p: ['forearms'] },
      short: 'Wave like a windscreen wiper', steps: ['Forearm on a table, thumb up', 'Tilt your hand up and down', 'Keep the forearm still'],
      mode: 'timed', time: 40, sets: 1, rest: 15,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2, start: { ...TABLE } }, type: 'hold' },
    { id: 'w_fist', areas: ['wrist'], phases: [1], wb: 'none', pos: 'Sitting', name: 'Fist & Spread', muscles: { p: ['forearms'] },
      short: 'Get the fingers moving', steps: ['Make a gentle fist', 'Open and spread your fingers wide', 'Keep going slowly'],
      mode: 'timed', time: 40, sets: 2, rest: 15,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2, start: { ...TABLE } }, type: 'hold' },
    { id: 'w_grip', areas: ['wrist', 'elbow'], phases: [1, 2, 3], wb: 'none', pos: 'Holding a soft ball or towel', name: 'Grip Squeeze', muscles: { p: ['forearms'] },
      short: 'Rebuild grip strength', steps: ['Hold a rolled towel or soft ball', 'Squeeze firmly but comfortably', 'Hold, then let go'],
      mode: 'hold', sets: 8, hold: 5, rest: 4,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2, start: { ...TABLE } }, type: 'hold' },
    { id: 'w_prayer', areas: ['wrist'], phases: [2, 3], wb: 'partial', pos: 'Standing, hands together', name: 'Prayer Stretch', muscles: { p: ['forearms'] },
      short: 'Stretch the wrist back', steps: ['Press your palms together in front of your chest', 'Slowly lower your hands until you feel a stretch', 'Hold'],
      mode: 'hold', sets: 3, hold: 20, rest: 10,
      ghost: { view: 'front', anchor: 'feet', cycle: 3, start: { ...FSTAND, uarm: 150, farm: 30 } }, type: 'hold' },
    { id: 'w_curl', areas: ['wrist', 'elbow'], phases: [3], wb: 'full', pos: 'Forearm on a table', name: 'Wrist Curl with Weight', muscles: { p: ['forearms'] },
      short: 'Hold a light bottle', steps: ['Forearm on a table, palm up, holding a bottle', 'Curl the hand up', 'Lower slowly'],
      mode: 'reps', sets: 2, reps: 12, rest: 30, metric: 'wristBend', restAt: 15, reach: 32, rom: { wristDown: 'max' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 2.6, start: { ...TABLE, hand: 0 }, end: { hand: 55 } }, type: 'reps' },

    // ================= LOWER BACK =================
    { id: 'b_tilt', areas: ['back'], phases: [1], wb: 'none', pos: 'Lying on your back', name: 'Pelvic Tilt', muscles: { p: ['core'], s: ['lower back'] },
      short: 'Flatten your back gently', steps: ['Lie on your back, knees bent', 'Tighten your tummy and flatten your lower back to the floor', 'Hold, then relax'],
      mode: 'hold', sets: 10, hold: 5, rest: 3,
      ghost: { anchor: 'lowest', cycle: 3, start: { ...LYING } }, type: 'hold', floor: true },
    { id: 'b_kneechest', areas: ['back'], phases: [1, 2], wb: 'none', pos: 'Lying on your back', name: 'Knee to Chest', muscles: { p: ['lower back', 'glutes'] },
      short: 'Ease a stiff back', steps: ['Lie on your back, knees bent', 'Hug one knee toward your chest', 'Lower and switch'],
      mode: 'reps', sets: 2, reps: 8, rest: 20, metric: 'legRaise', restAt: 60, reach: 85,
      ghost: { anchor: 'lowest', cycle: 3.4, start: { ...LYING }, end: { thighA: -10, shinA: 110, uarmA: 40, farmA: 10 } }, type: 'reps', floor: true },
    { id: 'b_catcow', areas: ['back', 'neck'], phases: [1, 2, 3], wb: 'none', pos: 'On hands and knees', name: 'Cat–Cow', muscles: { p: ['spine'], s: ['core'] },
      short: 'Move your spine gently', steps: ['On hands and knees', 'Round your back up like a cat', 'Then let it sag gently, head up'],
      mode: 'timed', time: 45, sets: 1, rest: 15,
      ghost: { anchor: 'lowest', cycle: 4, start: { ...FOURS, torso: 82, head: 120 }, end: { torso: 98, head: 75 } }, type: 'reps', floor: true },
    { id: 'b_ext', areas: ['back'], phases: [1, 2], wb: 'partial', pos: 'Standing side-on', name: 'Standing Back Bend', muscles: { p: ['lower back'] },
      short: 'Gentle backward bend', steps: ['Stand, hands on your lower back', 'Lean back gently, look up', 'Come back to upright'],
      mode: 'reps', sets: 2, reps: 8, rest: 20, metric: 'trunkLean', restAt: 4, reach: 9, rom: { trunkExt: 'max' },
      ghost: { cycle: 3, start: { ...STAND, uarm: 205, farm: 140 }, end: { torso: -16, head: -25 } }, type: 'reps' },
    { id: 'b_bend', areas: ['back'], phases: [2, 3], wb: 'partial', pos: 'Standing side-on', name: 'Forward Bend', muscles: { p: ['lower back', 'hamstrings'] },
      short: 'Reach toward your toes', steps: ['Stand, knees soft', 'Bend forward and let your arms hang', 'Roll back up slowly'],
      mode: 'reps', sets: 2, reps: 8, rest: 20, metric: 'trunkLean', restAt: 15, reach: 40, rom: { trunkFlex: 'max' }, avoidEarly: ['disc'],
      ghost: { cycle: 4, start: { ...STAND }, end: { torso: 75, head: 140, thigh: 175 } }, type: 'reps' },
    { id: 'b_sidebend', areas: ['back'], view: 'front', phases: [2, 3], wb: 'partial', pos: 'Standing, facing the camera', name: 'Side Bend', muscles: { p: ['obliques'], s: ['lower back'] },
      short: 'Stretch the side', steps: ['Stand facing the camera', 'Slide your hand down the side of your leg', 'Come up and switch sides'],
      mode: 'reps', sets: 2, reps: 8, rest: 20, metric: 'trunkSide', restAt: 6, reach: 14, rom: { trunkSide: 'max' },
      ghost: { anchor: 'feet', cycle: 3.2, start: { ...FSTAND }, end: { lean: 22 } }, type: 'reps' },
    { id: 'b_birddog', areas: ['back', 'hip'], phases: [2, 3], wb: 'partial', pos: 'On hands and knees', name: 'Bird Dog', muscles: { p: ['core', 'lower back', 'glutes'] },
      short: 'Steady core control', steps: ['On hands and knees', 'Reach one arm forward and the opposite leg back', 'Return — tap +1 each time'],
      mode: 'reps', sets: 2, reps: 8, rest: 30,
      ghost: { anchor: 'lowest', cycle: 3.2, start: { ...FOURS }, end: { uarmA: 90, farmA: 90, thighB: 270, shinB: 270, footB: 270 } }, type: 'reps', floor: true },

    // ================= NECK =================
    { id: 'n_tuck', areas: ['neck'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting tall', name: 'Chin Tuck', muscles: { p: ['neck'] },
      short: 'Line your head up', steps: ['Sit tall, look straight ahead', 'Slide your chin straight back (make a double chin)', 'Hold, then relax'],
      mode: 'hold', sets: 8, hold: 5, rest: 4,
      ghost: { anchor: 'seat', props: ['chair'], cycle: 3, start: { ...SEATED, head: -8 } }, type: 'hold' },
    { id: 'n_nod', areas: ['neck'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting side-on', name: 'Chin to Chest', muscles: { p: ['neck'] },
      short: 'Gentle forward nod', steps: ['Sit tall, side-on to the camera', 'Lower your chin toward your chest', 'Lift back to level'],
      mode: 'reps', sets: 2, reps: 8, rest: 20, metric: 'neckFlex', restAt: 10, reach: 24, rom: { neckFlex: 'max' },
      ghost: { anchor: 'seat', props: ['chair'], cycle: 3.2, start: { ...SEATED, head: 0 }, end: { head: 42 } }, type: 'reps' },
    { id: 'n_tilt', areas: ['neck'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting, facing the camera', name: 'Ear to Shoulder', muscles: { p: ['neck'] },
      short: 'Stretch the side of the neck', steps: ['Sit tall, shoulders down', 'Tilt your ear toward your shoulder', 'Hold, then switch sides'],
      mode: 'timed', time: 40, sets: 1, rest: 10,
      ghost: { view: 'front', anchor: 'feet', cycle: 3, start: { ...FSTAND } }, type: 'hold' },
    { id: 'n_turn', areas: ['neck'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting, facing the camera', name: 'Look Over Your Shoulder', muscles: { p: ['neck'] },
      short: 'Turn the head', steps: ['Sit tall', 'Turn your head slowly to look over one shoulder', 'Then the other'],
      mode: 'timed', time: 40, sets: 1, rest: 10,
      ghost: { view: 'front', anchor: 'feet', cycle: 3, start: { ...FSTAND } }, type: 'hold' },
    { id: 'n_roll', areas: ['neck', 'shoulder'], phases: [1, 2, 3], wb: 'none', pos: 'Sitting or standing', name: 'Shoulder Rolls', muscles: { p: ['upper back', 'shoulders'] },
      short: 'Loosen tight shoulders', steps: ['Lift your shoulders up', 'Roll them back and down', 'Slow, big circles'],
      mode: 'timed', time: 30, sets: 1, rest: 10,
      ghost: { cycle: 2, start: { ...STAND, uarm: 182 }, end: { uarm: 196 } }, type: 'reps' },
  ];
  EX.forEach(e => {
    if (e.ghost && e.ghost.view) { e.view = e.ghost.view; delete e.ghost.view; }
    e.view = e.view || 'side';
    if (e.ghost && !e.ghost.anchor) e.ghost.anchor = 'feet';
  });
  const byId = Object.fromEntries(EX.map(e => [e.id, e]));

  /* ---------- areas ---------- */
  const GROUP_WB = {
    leg:   { none: ['No weight yet', 'Crutches or boot, not standing on it'], partial: ['Some weight', 'Walking with some help'], full: ['Full weight', 'Walking normally'] },
    arm:   { none: ['Gentle only', 'Sling or cast just off'], partial: ['Light use', 'Everyday tasks are OK'], full: ['Normal use', 'Lifting and carrying again'] },
    trunk: { none: ['Lying down is easiest', 'Moving is painful'], partial: ['Light movement', 'Walking and sitting are OK'], full: ['Normal movement', 'Most activities are OK'] },
  };
  const AREAS = {
    knee:     { name: 'Knee', group: 'leg', limb: 'leg', dot: [80, 316], injuries: [['ligament', 'Torn ligament (ACL, MCL…)'], ['meniscus', 'Meniscus tear'], ['fracture', 'Broken bone near the knee'], ['kneecap', 'Kneecap pain or dislocation'], ['surgery', 'After knee surgery / replacement'], ['other', 'Something else']] },
    ankle:    { name: 'Ankle & foot', group: 'leg', limb: 'leg', dot: [80, 402], injuries: [['sprain', 'Sprain / torn ligament'], ['fracture', 'Broken ankle or foot'], ['achilles', 'Achilles injury'], ['plantar', 'Heel pain (plantar fasciitis)'], ['surgery', 'After ankle surgery'], ['other', 'Something else']] },
    hip:      { name: 'Hip', group: 'leg', limb: 'leg', dot: [84, 216], injuries: [['fracture', 'Broken hip'], ['replacement', 'Hip replacement'], ['strain', 'Pulled muscle / groin strain'], ['labral', 'Labral tear'], ['bursitis', 'Bursitis or tendon pain'], ['other', 'Something else']] },
    shoulder: { name: 'Shoulder', group: 'arm', limb: 'arm', dot: [64, 94], injuries: [['cuff', 'Rotator cuff tear or tendon pain'], ['dislocation', 'Dislocated shoulder'], ['frozen', 'Frozen shoulder'], ['fracture', 'Broken collarbone or upper arm'], ['surgery', 'After shoulder surgery'], ['other', 'Something else']] },
    elbow:    { name: 'Elbow', group: 'arm', limb: 'arm', dot: [54, 160], injuries: [['fracture', 'Broken elbow or forearm'], ['tennis', 'Tennis elbow'], ['golfer', 'Golfer’s elbow'], ['dislocation', 'Dislocated elbow'], ['surgery', 'After elbow surgery'], ['other', 'Something else']] },
    wrist:    { name: 'Wrist & hand', group: 'arm', limb: 'arm', dot: [45, 222], injuries: [['fracture', 'Broken wrist'], ['sprain', 'Sprained wrist'], ['carpal', 'Carpal tunnel'], ['tendon', 'Tendon injury'], ['surgery', 'After surgery / cast off'], ['other', 'Something else']] },
    back:     { name: 'Lower back', group: 'trunk', limb: 'body', dot: [100, 196], injuries: [['strain', 'Pulled muscle / back strain'], ['disc', 'Disc problem or sciatica'], ['stiff', 'Stiff, achy back'], ['surgery', 'After back surgery'], ['other', 'Something else']] },
    neck:     { name: 'Neck', group: 'trunk', limb: 'body', dot: [100, 66], injuries: [['stiff', 'Stiff neck / strain'], ['whiplash', 'Whiplash'], ['nerve', 'Pinched nerve'], ['surgery', 'After neck surgery'], ['other', 'Something else']] },
  };
  const sided = area => AREAS[area] && AREAS[area].group !== 'trunk';
  const wbInfo = (area, k) => GROUP_WB[(AREAS[area] || AREAS.knee).group][k];
  const STAGES = {
    1: { name: 'Gentle motion', sub: 'Early days — get it moving' },
    2: { name: 'Build strength', sub: 'Moving well — start loading' },
    3: { name: 'Back to normal', sub: 'Full function and confidence' },
  };
  const WB = { none: 0, partial: 1, full: 2 };

  const RED_FLAGS = [
    'Sharp or sudden pain that doesn’t settle',
    'New swelling, heat or redness',
    'Numbness, tingling, or cold / pale skin below the injury',
    'Calf pain, swelling or tenderness — get urgent care (possible blood clot)',
    'A pop, the joint giving way, or it can’t take load like before',
    'Fever, or changes in a surgical wound',
  ];
  const AREA_FLAGS = {
    back: ['Numbness around your bottom or groin, or new bladder/bowel problems — call emergency services', 'Weakness spreading down a leg'],
    neck: ['Dizziness, blurred vision or trouble swallowing', 'Weakness or numbness spreading down an arm'],
    hip: ['After a replacement: don’t bend the hip past 90°, cross your legs or twist the leg inward unless your surgeon says it’s OK'],
  };
  const redFlags = area => RED_FLAGS.concat(AREA_FLAGS[area] || []);

  function why(e, plan) {
    if (!e.areas.includes(plan.area)) return 'Not for this area';
    if (WB[e.wb] > WB[plan.wb]) return `Needs “${wbInfo(plan.area, e.wb)[0]}”`;
    if ((e.avoid || []).includes(plan.injury) || (plan.stage < 3 && (e.avoidEarly || []).includes(plan.injury))) return 'Often avoided after this injury — ask your physio';
    return null;
  }
  /** Exercises for a plan (area, stage, ability, injury, custom picks) */
  function routine(plan) {
    const notes = [], custom = plan.custom || { add: [], remove: [] };
    const base = EX.filter(e => e.areas.includes(plan.area) && e.phases.includes(plan.stage) && !(custom.remove || []).includes(e.id));
    const extra = (custom.add || []).map(id => byId[id]).filter(e => e && e.areas.includes(plan.area) && !base.includes(e));
    const list = base.concat(extra).filter(e => {
      const w = why(e, plan);
      if (w) { notes.push(`${e.name}: ${w}.`); return false; }
      return true;
    });
    return { list, notes };
  }
  /** Every exercise for this area, with whether it's in today's routine */
  function catalogue(plan) {
    const inList = new Set(routine(plan).list.map(e => e.id));
    return EX.filter(e => e.areas.includes(plan.area)).map(e => ({ e, on: inList.has(e.id), blocked: why(e, plan), stageMatch: e.phases.includes(plan.stage) }));
  }

  /** Scale sets/reps for a gentle day (pain 4–6) and the plan's volume factor */
  function dose(e, plan, gentle) {
    const f = (plan.volume || 1) * (gentle ? 0.6 : 1);
    return {
      sets: Math.max(1, Math.round((e.sets || 1) * (gentle ? 0.5 : 1))),
      reps: e.reps ? Math.max(4, Math.round(e.reps * f)) : 0,
      hold: e.hold || 0,
      time: e.time ? Math.max(15, Math.round(e.time * (gentle ? 0.7 : 1))) : 0,
    };
  }

  /** Read one side's points (pixels) from MediaPipe landmarks, plus body-centre points; null if not clearly visible.
      side 'C' (back / neck) uses whichever side the camera sees better. */
  function points(lms, side, W, H, need, minVis = 0.5) {
    if (!lms) return null;
    if (side === 'C') {
      const a = points(lms, 'L', W, H, need, minVis), b = points(lms, 'R', W, H, need, minVis);
      if (a && b) { const va = need.reduce((s, n) => s + (a[n].v || 0), 0), vb = need.reduce((s, n) => s + (b[n].v || 0), 0); return va >= vb ? a : b; }
      return a || b;
    }
    const ix = IDX[side], p = {};
    const at = i => { const l = lms[i]; return l ? { x: l.x * W, y: l.y * H, v: l.visibility == null ? 1 : l.visibility } : null; };
    for (const n of Object.keys(ix)) { const q = at(ix[n]); if (q) p[n] = q; }
    const mid = (i, j) => { const a = at(i), b = at(j); return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) } : null; };
    p.shoulderC = mid(11, 12); p.hipC = mid(23, 24);
    for (const n of need) if (!p[n] || p[n].v < minVis) return null;
    return p;
  }

  /** Convert a set's measured min/max into ROM scores */
  function romFrom(e, mn, mx) {
    const out = {};
    for (const [k, how] of Object.entries(e.rom || {})) {
      if (how === 'max' && mx != null) out[k] = Math.round(mx);
      if (how === 'min' && mn != null) out[k] = Math.max(0, Math.round(mn));
      if (how === 'up' && mn != null) out[k] = Math.max(0, Math.round(90 - mn));
      if (how === 'down' && mx != null) out[k] = Math.max(0, Math.round(mx - 90));
    }
    return out;
  }
  /** Demo athlete: landmarks for exercise e at progress amt (0..1), as if the LEFT side were injured. */
  function simLandmarks(e, amt, W, H) {
    const G = GF.ghost;
    const P = G.poseAt(e, 0, { e: amt });
    const box = e.floor ? { x: W * 0.12, y: H * 0.32, w: W * 0.76, h: H * 0.6 } : { x: W * 0.28, y: H * 0.06, w: W * 0.44, h: H * 0.88 };
    const T = G.motionFit(e, box);
    const lm = G.toLandmarks(P, T, W, H);
    const st = e.ghost.start || {}, en = e.ghost.end || {};
    if (st.hand !== undefined) {   // the ghost has no hands — add an index finger for wrist exercises
      const h1 = en.hand !== undefined ? en.hand : st.hand, hb = (st.hand + (h1 - st.hand) * amt) * Math.PI / 180;
      const w = lm[15], el = lm[13];
      const dx = (w.x - el.x) * W, dy = (w.y - el.y) * H, c = Math.cos(hb), s2 = Math.sin(hb);
      lm[19] = { x: w.x + (dx * c - dy * s2) * 0.45 / W, y: w.y + (dx * s2 + dy * c) * 0.45 / H, z: 0, visibility: 0.95 };
      lm[20] = { ...lm[19], visibility: 0.3 };
    }
    return { lm, P, T };
  }
  const better = (k, a, b) => b == null || (ROM[k].better === 'lower' ? a < b : a > b);

  GF.rehab = { EX, get: id => byId[id], METRICS, ROM, romPct, AREAS, STAGES, WB, wbInfo, sided, redFlags, RED_FLAGS, IDX, routine, catalogue, dose, points, romFrom, better, simLandmarks };
})(window.GF = window.GF || {});
