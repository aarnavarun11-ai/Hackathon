/* GhostFit – exercise library
   One entry per exercise, with the coaching knowledge used by the builder, the active
   workout and the built-in coach.
     track:  id of a camera-tracked definition in tracking/exercises.js (null = no camera form check)
     ghost:  animated demonstration (own keyframes) or ghostFrom: reuse a tracked exercise's ghost
   Exercises without `track` are run with manual set logging or a timer — the app never
   claims to check their form. */
(function (GF) {
  'use strict';

  const SIDE = 'side', FRONT = 'front';
  const L = [
    /* ---------------- lower body ---------------- */
    { id: 'squat', name: 'Bodyweight Squat', aliases: ['squat', 'squats', 'air squat'], cat: ['strength'], muscles: { p: ['quads', 'glutes'], s: ['hamstrings', 'core'] }, equip: 'none', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 60 }, track: 'squat', ghostFrom: 'squat', view: SIDE,
      steps: ['Stand with feet about shoulder-width apart, toes slightly out.', 'Push your hips back and bend your knees as if sitting into a chair.', 'Lower until your thighs are about parallel to the floor, or as low as is comfortable.', 'Press through your whole foot to stand back up.'],
      mistakes: ['Chest dropping forward', 'Heels lifting off the floor', 'Knees collapsing inward', 'Stopping too high'], tips: ['Keep your weight over the middle of your feet.', 'Breathe in on the way down, out on the way up.'],
      simple: 'Sit back like there is a chair behind you, then stand up. Keep your chest up and heels down.', easier: ['chairSquat', 'wallsit'], harder: ['gobletSquat'], alt: ['lunge', 'chairSquat'] },
    { id: 'chairSquat', name: 'Chair Sit-to-Stand', aliases: ['sit to stand', 'box squat', 'chair squat'], cat: ['strength'], muscles: { p: ['quads', 'glutes'], s: ['core'] }, equip: 'chair', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: 'squat', ghostFrom: 'squat', view: SIDE,
      steps: ['Stand in front of a sturdy chair, feet hip-width apart.', 'Sit back slowly until you lightly touch the seat.', 'Lean slightly forward and stand up by pushing through your feet.'],
      mistakes: ['Dropping onto the chair', 'Using hands to push up (unless you need to)'], tips: ['Slow and controlled on the way down.'],
      simple: 'Slowly sit down on a chair and stand back up without using your hands.', easier: [], harder: ['squat'], alt: ['squat', 'wallsit'] },
    { id: 'gobletSquat', name: 'Goblet Squat', aliases: ['goblet squat', 'dumbbell squat'], cat: ['strength'], muscles: { p: ['quads', 'glutes'], s: ['core', 'upper back'] }, equip: 'dumbbells', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 75 }, track: 'squat', ghostFrom: 'squat', view: SIDE, setting: ['home', 'gym'],
      steps: ['Hold one dumbbell vertically against your chest.', 'Squat down between your knees, elbows inside your knees.', 'Keep the weight close and your chest tall.', 'Drive up through your feet.'],
      mistakes: ['Letting the weight pull you forward', 'Rounding the upper back'], tips: ['Use the weight as a counterbalance to sit deeper.'],
      simple: 'A squat while hugging a dumbbell to your chest.', easier: ['squat'], harder: ['backSquat'], alt: ['squat', 'lunge'] },
    { id: 'backSquat', name: 'Barbell Back Squat', aliases: ['back squat', 'barbell squat'], cat: ['strength'], muscles: { p: ['quads', 'glutes'], s: ['hamstrings', 'core', 'lower back'] }, equip: 'barbell', level: 3, impact: 'low', mode: 'reps', def: { sets: 4, reps: 6, rest: 150 }, track: 'squat', ghostFrom: 'squat', view: SIDE, setting: ['gym'],
      steps: ['Set the bar on your upper back in a rack, hands just outside shoulders.', 'Unrack, step back, feet shoulder-width.', 'Brace your core, sit down and back to depth.', 'Drive up keeping the bar over mid-foot.'],
      mistakes: ['Losing core brace', 'Knees caving', 'Hips rising faster than chest'], tips: ['Use safety pins or a spotter.', 'Add load gradually.'],
      simple: 'A squat with a barbell on your upper back. Learn the bodyweight squat first.', easier: ['gobletSquat'], harder: [], alt: ['gobletSquat'] },
    { id: 'lunge', name: 'Reverse Lunge', aliases: ['lunge', 'lunges', 'reverse lunge', 'step back lunge'], cat: ['strength'], muscles: { p: ['quads', 'glutes'], s: ['hamstrings', 'core'] }, equip: 'none', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: 'lunge', ghostFrom: 'lunge', view: SIDE,
      steps: ['Stand tall with hands on hips.', 'Step one foot back and lower until both knees are bent about 90°.', 'Keep your front knee over your ankle.', 'Push through the front foot to return, then switch legs.'],
      mistakes: ['Leaning the torso forward', 'Front knee drifting past toes', 'Short steps'], tips: ['Hold a wall for balance if needed.'],
      simple: 'Step back, bend both knees, then step forward again. Keep standing tall.', easier: ['chairSquat'], harder: ['gobletSquat'], alt: ['squat', 'hipFlexorStretch'] },
    { id: 'bridge', name: 'Glute Bridge', aliases: ['bridge', 'glute bridge', 'hip bridge', 'hip raise'], cat: ['strength'], muscles: { p: ['glutes'], s: ['hamstrings', 'core', 'lower back'] }, equip: 'mat', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 45 }, track: 'bridge', ghostFrom: 'bridge', view: SIDE, floor: true,
      steps: ['Lie on your back, knees bent, feet flat and hip-width apart.', 'Press through your heels and squeeze your glutes.', 'Lift your hips until knees, hips and shoulders form a line.', 'Lower slowly.'],
      mistakes: ['Arching the lower back at the top', 'Pushing through toes instead of heels'], tips: ['Pause one second at the top.'],
      simple: 'Lying on your back, push your hips up toward the ceiling and lower them.', easier: [], harder: [], alt: ['superman', 'rdl'] },
    { id: 'wallsit', name: 'Wall Sit', aliases: ['wall sit', 'wall squat'], cat: ['endurance', 'strength'], muscles: { p: ['quads'], s: ['glutes', 'core'] }, equip: 'wall', level: 1, impact: 'low', mode: 'time', def: { sets: 2, duration: 30, rest: 60 }, track: 'wallsit', ghostFrom: 'wallsit', view: SIDE,
      steps: ['Stand with your back against a wall.', 'Walk feet forward and slide down until thighs are about parallel.', 'Keep knees above ankles and back flat on the wall.', 'Hold and breathe steadily.'],
      mistakes: ['Knees past toes', 'Holding your breath'], tips: ['Go less deep if your knees feel uncomfortable.'],
      simple: 'Lean on a wall like you are sitting on an invisible chair and hold.', easier: ['chairSquat'], harder: [], alt: ['squat'] },
    { id: 'rdl', name: 'Romanian Deadlift', aliases: ['rdl', 'romanian deadlift', 'hip hinge', 'deadlift'], cat: ['strength'], muscles: { p: ['hamstrings', 'glutes'], s: ['lower back', 'core'] }, equip: 'dumbbells', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 75 }, track: null, view: SIDE,
      ghost: { anchor: 'ankle', cycle: 3, start: { torso: 0, thigh: 180, shin: 180, uarm: 180, farm: 180 }, end: { torso: 78, thigh: 192, shin: 174, uarm: 180, farm: 180 } },
      steps: ['Stand holding weights in front of your thighs, knees softly bent.', 'Push your hips back, sliding the weights down your legs.', 'Keep your back flat; stop when you feel a stretch in your hamstrings.', 'Squeeze your glutes to return to standing.'],
      mistakes: ['Rounding the back', 'Bending the knees too much (turns into a squat)', 'Letting weights drift away from legs'], tips: ['Think "hips back", not "bend down".'],
      simple: 'Push your hips back with a flat back, feel the back of your legs stretch, then stand up.', easier: ['bridge'], harder: [], alt: ['bridge'] },
    { id: 'calfRaise', name: 'Calf Raise', aliases: ['calf raise', 'calf raises', 'heel raise'], cat: ['strength', 'endurance'], muscles: { p: ['calves'], s: [] }, equip: 'none', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 15, rest: 45 }, track: null, view: SIDE,
      steps: ['Stand tall, holding a wall lightly for balance.', 'Rise onto the balls of your feet.', 'Pause at the top, then lower slowly.'],
      mistakes: ['Bouncing', 'Rolling onto the outside of the feet'], tips: ['Slow lowering builds more strength.'],
      simple: 'Go up on your toes and slowly come back down.', easier: [], harder: [], alt: [] },

    /* ---------------- upper body ---------------- */
    { id: 'pushup', name: 'Push-up', aliases: ['push up', 'pushup', 'push-ups', 'pushups', 'press up'], cat: ['strength'], muscles: { p: ['chest', 'triceps'], s: ['shoulders', 'core'] }, equip: 'none', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 8, rest: 75 }, track: 'pushup', ghostFrom: 'pushup', view: SIDE, floor: true,
      steps: ['Hands slightly wider than shoulders, body in a straight line from head to heels.', 'Lower your chest toward the floor, elbows about 45° from your body.', 'Go down until elbows reach about 90°.', 'Press the floor away to return.'],
      mistakes: ['Hips sagging', 'Hips piked up', 'Elbows flared straight out', 'Half range of motion'], tips: ['Squeeze glutes and core to hold the line.'],
      simple: 'Keep your body straight like a plank and lower your chest, then push back up.', easier: ['kneePushup', 'inclinePushup'], harder: [], alt: ['inclinePushup', 'dbBench'] },
    { id: 'kneePushup', name: 'Knee Push-up', aliases: ['knee push up', 'kneeling push up', 'modified push up'], cat: ['strength'], muscles: { p: ['chest', 'triceps'], s: ['shoulders', 'core'] }, equip: 'mat', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: null, view: SIDE, floor: true,
      ghost: { anchor: 'lowest', anchorX: 'kneeA', cycle: 2.4, start: { torso: 72, thigh: 232, shin: 285, uarm: 180, farm: 180 }, end: { torso: 84, thigh: 238, shin: 285, uarm: 250, farm: 150 } },
      steps: ['Start on hands and knees, then walk hands forward so hips, shoulders and knees line up.', 'Lower your chest between your hands.', 'Push back up keeping the line.'],
      mistakes: ['Hips staying high', 'Head dropping'], tips: ['Build to 3 sets of 12 before trying full push-ups.'],
      simple: 'A push-up with your knees on the floor.', easier: ['inclinePushup'], harder: ['pushup'], alt: ['inclinePushup'] },
    { id: 'inclinePushup', name: 'Incline Push-up', aliases: ['incline push up', 'wall push up', 'counter push up'], cat: ['strength'], muscles: { p: ['chest', 'triceps'], s: ['shoulders', 'core'] }, equip: 'chair', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: null, view: SIDE,
      steps: ['Place hands on a sturdy table, counter or wall.', 'Walk feet back so your body is straight.', 'Lower your chest toward your hands, then push away.'],
      mistakes: ['Using an unstable surface', 'Sagging hips'], tips: ['The higher the surface, the easier it is.'],
      simple: 'A push-up with your hands on a table or wall.', easier: [], harder: ['kneePushup', 'pushup'], alt: ['kneePushup'] },
    { id: 'curl', name: 'Bicep Curl', aliases: ['curl', 'curls', 'bicep curl', 'biceps curl', 'dumbbell curl'], cat: ['strength'], muscles: { p: ['biceps'], s: ['forearms'] }, equip: 'dumbbells', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 60 }, track: 'curl', ghostFrom: 'curl', view: FRONT,
      steps: ['Stand tall, weights at your sides, palms forward.', 'Curl both hands toward your shoulders.', 'Keep elbows close to your ribs.', 'Lower slowly until arms are straight.'],
      mistakes: ['Swinging the body', 'Elbows drifting forward', 'Dropping the weight quickly'], tips: ['No dumbbells? Use water bottles or a resistance band.'],
      simple: 'Bend your elbows to bring your hands to your shoulders, keeping elbows at your sides.', easier: ['seatedCurl'], harder: ['hammerCurl'], alt: ['hammerCurl', 'seatedCurl'] },
    { id: 'hammerCurl', name: 'Hammer Curl', aliases: ['hammer curl'], cat: ['strength'], muscles: { p: ['biceps', 'forearms'], s: [] }, equip: 'dumbbells', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 60 }, track: 'curl', ghostFrom: 'curl', view: FRONT,
      steps: ['Hold dumbbells with palms facing each other.', 'Curl up keeping elbows by your sides.', 'Lower with control.'], mistakes: ['Swinging', 'Shrugging shoulders'], tips: [],
      simple: 'A curl with palms facing each other.', easier: ['curl'], harder: [], alt: ['curl'] },
    { id: 'press', name: 'Shoulder Press', aliases: ['shoulder press', 'overhead press', 'military press', 'dumbbell press'], cat: ['strength'], muscles: { p: ['shoulders'], s: ['triceps', 'upper back', 'core'] }, equip: 'dumbbells', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 75 }, track: 'press', ghostFrom: 'press', view: FRONT,
      steps: ['Hold weights at shoulder height, elbows under wrists.', 'Brace your core and press straight up.', 'Finish with arms extended overhead, biceps near ears.', 'Lower back to shoulder height with control.'],
      mistakes: ['Arching the lower back', 'Pressing forward instead of up', 'Flaring wrists out past elbows'], tips: ['Squeeze your glutes to protect your lower back.'],
      simple: 'Push your hands straight up over your head and bring them back to your shoulders.', easier: ['seatedPress'], harder: [], alt: ['seatedPress', 'lateral'] },
    { id: 'lateral', name: 'Lateral Raise', aliases: ['lateral raise', 'side raise', 'lateral raises'], cat: ['strength'], muscles: { p: ['shoulders'], s: ['upper back'] }, equip: 'dumbbells', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 60 }, track: 'lateral', ghostFrom: 'lateral', view: FRONT,
      steps: ['Stand tall, light weights at your sides.', 'Raise arms out to the sides with a slight elbow bend.', 'Stop at shoulder height.', 'Lower slowly.'],
      mistakes: ['Going above shoulder height', 'Shrugging', 'Swinging'], tips: ['Use lighter weights than you think.'],
      simple: 'Lift your arms out to the side until they make a T, then lower.', easier: ['seatedLateral'], harder: [], alt: ['press'] },
    { id: 'dbRow', name: 'Bent-over Dumbbell Row', aliases: ['row', 'rows', 'dumbbell row', 'bent over row'], cat: ['strength'], muscles: { p: ['back', 'lats'], s: ['biceps', 'rear shoulders'] }, equip: 'dumbbells', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 75 }, track: null, view: SIDE,
      ghost: { anchor: 'ankle', cycle: 2.6, start: { torso: 68, thigh: 196, shin: 168, uarm: 180, farm: 180 }, end: { uarmA: 238, farmA: 178 } },
      steps: ['Hinge forward with a flat back, weights hanging below shoulders.', 'Pull the weights toward your hips, elbows close.', 'Squeeze your shoulder blades together.', 'Lower with control.'],
      mistakes: ['Rounding the back', 'Jerking the weight up', 'Shrugging toward ears'], tips: ['Support one hand on a bench for a one-arm version.'],
      simple: 'Lean forward with a flat back and pull the weights up to your sides.', easier: [], harder: [], alt: ['latPulldown', 'superman'] },
    { id: 'dbBench', name: 'Dumbbell Bench Press', aliases: ['bench press', 'dumbbell bench', 'chest press'], cat: ['strength'], muscles: { p: ['chest'], s: ['triceps', 'shoulders'] }, equip: 'bench', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 90 }, track: null, view: SIDE, setting: ['gym'],
      steps: ['Lie on a bench, weights at chest level.', 'Press up until arms are extended over your chest.', 'Lower slowly until elbows are slightly below the bench.'],
      mistakes: ['Bouncing weights off the chest', 'Lifting hips off the bench'], tips: ['Keep feet planted.'],
      simple: 'Lying on a bench, push the weights up from your chest.', easier: ['pushup'], harder: [], alt: ['pushup'] },
    { id: 'latPulldown', name: 'Lat Pulldown', aliases: ['lat pulldown', 'pulldown', 'pull down'], cat: ['strength'], muscles: { p: ['lats', 'back'], s: ['biceps'] }, equip: 'machine', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 75 }, track: null, view: FRONT, setting: ['gym'],
      ghost: { anchor: 'seat', cycle: 2.8, props: ['chair'], start: { uarm: 18, farm: 8, thigh: 132, shin: 178, thighScale: 0.42 }, end: { uarm: 128, farm: 18 } },
      steps: ['Sit with thighs under the pad, hands slightly wider than shoulders.', 'Pull the bar to your upper chest, elbows down.', 'Control the bar back up.'],
      mistakes: ['Leaning far back', 'Pulling behind the neck'], tips: [],
      simple: 'Pull the bar down to your chest, then let it rise slowly.', easier: [], harder: ['pullup'], alt: ['dbRow'] },
    { id: 'pullup', name: 'Pull-up', aliases: ['pull up', 'pullup', 'chin up'], cat: ['strength'], muscles: { p: ['lats', 'back'], s: ['biceps', 'core'] }, equip: 'bar', level: 3, impact: 'low', mode: 'reps', def: { sets: 3, reps: 5, rest: 120 }, track: null, view: FRONT, setting: ['gym', 'home'],
      steps: ['Hang from a bar, hands just wider than shoulders.', 'Pull your chest toward the bar.', 'Lower all the way with control.'], mistakes: ['Kipping/swinging', 'Partial reps'], tips: ['Use a band for assistance.'],
      simple: 'Hang from a bar and pull yourself up.', easier: ['latPulldown'], harder: [], alt: ['latPulldown', 'dbRow'] },
    { id: 'tricepDip', name: 'Chair Tricep Dip', aliases: ['dip', 'dips', 'tricep dip', 'bench dip'], cat: ['strength'], muscles: { p: ['triceps'], s: ['chest', 'shoulders'] }, equip: 'chair', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: null, view: SIDE,
      steps: ['Sit on the edge of a sturdy chair, hands beside hips.', 'Slide forward and lower by bending your elbows to about 90°.', 'Press back up.'], mistakes: ['Shoulders rolling forward', 'Going too deep'], tips: ['Bend knees more to make it easier.'],
      simple: 'Hands on a chair behind you, bend your elbows to lower and push back up.', easier: [], harder: [], alt: ['overheadTricep'] },
    { id: 'overheadTricep', name: 'Overhead Tricep Extension', aliases: ['tricep extension', 'overhead extension'], cat: ['strength'], muscles: { p: ['triceps'], s: [] }, equip: 'dumbbells', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 60 }, track: null, view: SIDE,
      ghost: { anchor: 'ankle', cycle: 2.6, start: { torso: 0, thigh: 180, shin: 180, uarm: 6, farm: 6 }, end: { farm: -158 } },
      steps: ['Hold one dumbbell overhead with both hands.', 'Bend elbows to lower it behind your head.', 'Extend back up; keep elbows pointing forward.'], mistakes: ['Elbows flaring out', 'Arching the back'], tips: [],
      simple: 'Hold a weight above your head, lower it behind you by bending your elbows, then straighten.', easier: [], harder: [], alt: ['tricepDip'] },

    /* ---------------- core ---------------- */
    { id: 'plank', name: 'Forearm Plank', aliases: ['plank', 'planks', 'front plank'], cat: ['strength', 'endurance'], muscles: { p: ['core'], s: ['shoulders', 'glutes'] }, equip: 'mat', level: 1, impact: 'low', mode: 'time', def: { sets: 3, duration: 30, rest: 45 }, track: 'plank', ghostFrom: 'plank', view: SIDE, floor: true,
      steps: ['Forearms on the floor, elbows under shoulders.', 'Step feet back so your body forms a straight line.', 'Squeeze glutes and brace your core.', 'Breathe steadily and hold.'],
      mistakes: ['Hips sagging', 'Hips too high', 'Holding the breath'], tips: ['Drop to your knees if your form breaks.'],
      simple: 'Hold your body straight like a board, resting on your forearms and toes.', easier: ['birdDog'], harder: [], alt: ['deadBug', 'birdDog'] },
    { id: 'sidePlank', name: 'Side Plank', aliases: ['side plank'], cat: ['strength', 'endurance'], muscles: { p: ['obliques', 'core'], s: ['shoulders', 'glutes'] }, equip: 'mat', level: 2, impact: 'low', mode: 'time', def: { sets: 2, duration: 20, rest: 30 }, track: null, view: FRONT, floor: true,
      steps: ['Lie on your side, elbow under shoulder.', 'Lift your hips so your body is straight.', 'Hold, then switch sides.'], mistakes: ['Hips dropping', 'Rolling forward'], tips: ['Bend the bottom knee to make it easier.'],
      simple: 'Balance on one forearm and the side of your feet with hips lifted.', easier: ['plank'], harder: [], alt: ['plank'] },
    { id: 'situp', name: 'Sit-up', aliases: ['sit up', 'situp', 'sit-ups', 'crunch', 'crunches'], cat: ['strength'], muscles: { p: ['core'], s: ['hip flexors'] }, equip: 'mat', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 45 }, track: 'situp', ghostFrom: 'situp', view: SIDE, floor: true,
      steps: ['Lie back with knees bent, feet flat.', 'Reach toward your knees and curl up.', 'Lower back down slowly.'], mistakes: ['Pulling on the neck', 'Using momentum'], tips: ['Exhale as you come up.'],
      simple: 'Lying down with knees bent, curl up toward your knees and lower slowly.', easier: ['deadBug'], harder: ['legraise'], alt: ['deadBug', 'legraise'] },
    { id: 'legraise', name: 'Lying Leg Raise', aliases: ['leg raise', 'leg raises', 'lying leg raise'], cat: ['strength'], muscles: { p: ['core', 'hip flexors'], s: [] }, equip: 'mat', level: 2, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 45 }, track: 'legraise', ghostFrom: 'legraise', view: SIDE, floor: true,
      steps: ['Lie flat, hands by your sides or under your hips.', 'Keep legs straight and lift them toward the ceiling.', 'Lower slowly without letting your lower back arch.'], mistakes: ['Arching the lower back', 'Bending the knees', 'Dropping legs fast'], tips: ['Bend knees slightly to make it easier.'],
      simple: 'Lying flat, lift straight legs up and lower them slowly.', easier: ['deadBug'], harder: [], alt: ['deadBug', 'situp'] },
    { id: 'deadBug', name: 'Dead Bug', aliases: ['dead bug', 'deadbug'], cat: ['strength', 'mobility'], muscles: { p: ['core'], s: ['hip flexors'] }, equip: 'mat', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 45 }, track: null, view: SIDE, floor: true,
      ghost: { anchor: 'lowest', anchorX: 'hip', cycle: 3, start: { torso: -90, head: -90, uarm: 0, farm: 0, thigh: 0, shin: 90 }, end: { uarmA: -78, farmA: -78, thighB: 76, shinB: 84 } },
      steps: ['Lie on your back, arms up, knees bent 90° above hips.', 'Lower one arm overhead and the opposite leg toward the floor.', 'Keep your lower back pressed down.', 'Return and switch sides.'], mistakes: ['Lower back arching', 'Moving too fast'], tips: ['Exhale as you extend.'],
      simple: 'On your back, slowly stretch out the opposite arm and leg while keeping your back flat.', easier: [], harder: ['legraise'], alt: ['birdDog'] },
    { id: 'birdDog', name: 'Bird Dog', aliases: ['bird dog', 'birddog'], cat: ['strength', 'mobility'], muscles: { p: ['core', 'lower back'], s: ['glutes', 'shoulders'] }, equip: 'mat', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 45 }, track: null, view: SIDE, floor: true,
      ghost: { anchor: 'lowest', anchorX: 'kneeA', cycle: 3.2, start: { torso: 90, head: 90, uarm: 180, farm: 180, thigh: 180, shin: 270 }, end: { uarmA: 92, farmA: 92, thighB: 268, shinB: 270 } },
      steps: ['Start on hands and knees, hands under shoulders, knees under hips.', 'Extend one arm forward and the opposite leg back.', 'Keep hips level; pause.', 'Return and switch sides.'], mistakes: ['Twisting the hips', 'Arching the back'], tips: ['Imagine balancing a cup on your lower back.'],
      simple: 'On hands and knees, reach one arm forward and the opposite leg back.', easier: [], harder: ['plank'], alt: ['deadBug', 'superman'] },
    { id: 'superman', name: 'Superman Hold', aliases: ['superman', 'back extension'], cat: ['strength'], muscles: { p: ['lower back', 'glutes'], s: ['upper back'] }, equip: 'mat', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 45 }, track: null, view: SIDE, floor: true,
      ghost: { anchor: 'lowest', anchorX: 'hip', cycle: 3, start: { torso: 90, head: 90, thigh: 270, shin: 270, uarm: 90, farm: 90 }, end: { torso: 80, head: 76, thigh: 279, shin: 281, uarm: 78, farm: 78 } },
      steps: ['Lie face down, arms extended overhead.', 'Lift arms, chest and legs slightly off the floor.', 'Hold briefly, then lower.'], mistakes: ['Cranking the neck up', 'Lifting too high'], tips: ['Keep your gaze on the floor.'],
      simple: 'Lying on your belly, lift your arms and legs a little and hold.', easier: ['birdDog'], harder: [], alt: ['bridge', 'birdDog'] },
    { id: 'mountainClimber', name: 'Mountain Climbers', aliases: ['mountain climber', 'mountain climbers'], cat: ['conditioning'], muscles: { p: ['core', 'hip flexors'], s: ['shoulders', 'quads'] }, equip: 'none', level: 2, impact: 'high', mode: 'time', def: { sets: 3, duration: 30, rest: 45 }, track: null, view: SIDE, floor: true,
      ghost: { anchor: 'lowest', anchorX: 'wristA', cycle: 0.9, start: { torso: 68, thigh: 248, shin: 248, uarm: 180, farm: 180 }, end: { thighA: 150, shinA: 205 } },
      steps: ['Start in a high plank, hands under shoulders.', 'Drive one knee toward your chest.', 'Switch legs quickly while keeping hips low.'], mistakes: ['Hips bouncing high', 'Shoulders drifting behind hands'], tips: ['Slow it down to make it low-impact.'],
      simple: 'In a push-up position, run your knees toward your chest one at a time.', easier: ['march'], harder: ['burpee'], alt: ['highKnees', 'plank'] },

    /* ---------------- conditioning ---------------- */
    { id: 'jacks', name: 'Jumping Jacks', aliases: ['jumping jack', 'jumping jacks', 'star jumps'], cat: ['conditioning'], muscles: { p: ['full body'], s: ['calves', 'shoulders'] }, equip: 'none', level: 1, impact: 'high', mode: 'reps', def: { sets: 3, reps: 20, rest: 30 }, track: 'jacks', ghostFrom: 'jacks', view: FRONT,
      steps: ['Stand with feet together, arms at your sides.', 'Jump feet wide while raising arms overhead.', 'Jump back to the start.'], mistakes: ['Landing heavily', 'Arms only half way up'], tips: ['Land softly on the balls of your feet.'],
      simple: 'Jump your feet out and arms up, then back together.', easier: ['stepJack'], harder: ['burpee'], alt: ['stepJack', 'highKnees'] },
    { id: 'stepJack', name: 'Step Jacks (low impact)', aliases: ['step jack', 'low impact jumping jack'], cat: ['conditioning'], muscles: { p: ['full body'], s: [] }, equip: 'none', level: 1, impact: 'low', mode: 'time', def: { sets: 3, duration: 30, rest: 30 }, track: null, view: FRONT,
      steps: ['Step one foot out to the side while raising both arms.', 'Step back in and lower arms.', 'Alternate sides at a steady pace.'], mistakes: ['Rushing'], tips: ['A good warm-up or low-impact cardio option.'],
      simple: 'A jumping jack without the jump — step out to the side instead.', easier: [], harder: ['jacks'], alt: ['march'] },
    { id: 'highKnees', name: 'High Knees', aliases: ['high knees', 'running in place'], cat: ['conditioning'], muscles: { p: ['hip flexors', 'quads'], s: ['calves', 'core'] }, equip: 'none', level: 2, impact: 'high', mode: 'time', def: { sets: 3, duration: 30, rest: 30 }, track: null, view: SIDE,
      ghost: { anchor: 'lowest', anchorX: 'hip', cycle: 0.7, start: { torso: 4, thigh: 180, shin: 180, uarmA: 150, farmA: 80, uarmB: 205, farmB: 140 }, end: { thighA: 88, shinA: 178, uarmA: 205, farmA: 140, uarmB: 150, farmB: 80 } },
      steps: ['Run in place, driving knees to hip height.', 'Pump your arms.', 'Stay light on the balls of your feet.'], mistakes: ['Leaning back', 'Heavy landings'], tips: ['March instead for a low-impact version.'],
      simple: 'Run in place lifting your knees high.', easier: ['march'], harder: [], alt: ['march', 'jacks'] },
    { id: 'burpee', name: 'Burpee', aliases: ['burpee', 'burpees'], cat: ['conditioning'], muscles: { p: ['full body'], s: ['chest', 'quads', 'core'] }, equip: 'none', level: 3, impact: 'high', mode: 'reps', def: { sets: 3, reps: 8, rest: 60 }, track: null, view: SIDE,
      steps: ['Squat down and place hands on the floor.', 'Step or jump feet back to a plank.', 'Step or jump feet back in.', 'Stand up (add a small jump if you like).'], mistakes: ['Sagging hips in the plank', 'Landing with straight knees'], tips: ['Step instead of jumping for a lower-impact version.'],
      simple: 'Squat, put hands down, kick back to a plank, come back in and stand up.', easier: ['mountainClimber', 'squat'], harder: [], alt: ['mountainClimber', 'jacks'] },

    /* ---------------- warm-up / mobility / flexibility ---------------- */
    { id: 'march', name: 'Marching in Place', aliases: ['march', 'marching', 'march in place'], cat: ['mobility', 'conditioning'], muscles: { p: ['hip flexors'], s: ['calves'] }, equip: 'none', level: 1, impact: 'low', mode: 'time', def: { sets: 1, duration: 60, rest: 15 }, track: null, view: SIDE,
      ghost: { anchor: 'lowest', anchorX: 'hip', cycle: 1.4, start: { torso: 0, thigh: 180, shin: 180, uarmA: 165, farmA: 110, uarmB: 195, farmB: 160 }, end: { thighA: 108, shinA: 182, uarmA: 195, farmA: 160, uarmB: 165, farmB: 110 } },
      steps: ['Stand tall and march in place.', 'Lift knees to a comfortable height.', 'Swing your arms naturally.'], mistakes: [], tips: ['Great for warming up.'],
      simple: 'Walk in place, lifting your knees.', easier: ['seatedMarch'], harder: ['highKnees'], alt: ['stepJack'] },
    { id: 'seatedMarch', name: 'Seated March', aliases: ['seated march', 'chair march'], cat: ['mobility', 'conditioning'], muscles: { p: ['hip flexors'], s: ['core'] }, equip: 'chair', level: 1, impact: 'low', mode: 'time', def: { sets: 1, duration: 45, rest: 15 }, track: null, view: SIDE,
      ghost: { anchor: 'seat', cycle: 1.6, props: ['chair'], start: { torso: -2, thigh: 90, shin: 180, uarm: 170, farm: 120 }, end: { thighA: 62, shinA: 172 } },
      steps: ['Sit tall near the front of a chair.', 'Lift one knee, then the other, in a marching rhythm.', 'Keep your back tall.'], mistakes: ['Slouching'], tips: [],
      simple: 'Sit on a chair and march your knees up and down.', easier: [], harder: ['march'], alt: ['march'] },
    { id: 'armCircles', name: 'Arm Circles', aliases: ['arm circles'], cat: ['mobility'], muscles: { p: ['shoulders'], s: [] }, equip: 'none', level: 1, impact: 'low', mode: 'time', def: { sets: 1, duration: 30, rest: 10 }, track: null, view: FRONT,
      steps: ['Stand with arms out to the sides.', 'Make small circles, gradually getting larger.', 'Reverse direction halfway.'], mistakes: ['Shrugging'], tips: [],
      simple: 'Hold your arms out and draw circles with them.', easier: [], harder: [], alt: [] },
    { id: 'catCow', name: 'Cat–Cow', aliases: ['cat cow', 'cat-cow', 'cat camel'], cat: ['mobility', 'flexibility'], muscles: { p: ['spine', 'lower back'], s: ['core'] }, equip: 'mat', level: 1, impact: 'low', mode: 'time', def: { sets: 1, duration: 45, rest: 10 }, track: null, view: SIDE, floor: true,
      steps: ['Start on hands and knees.', 'Breathe in: let your belly drop and lift your chest (cow).', 'Breathe out: round your back toward the ceiling (cat).', 'Move slowly with your breath.'], mistakes: ['Moving too fast'], tips: [],
      simple: 'On hands and knees, gently arch and round your back with your breathing.', easier: [], harder: [], alt: ['childPose'] },
    { id: 'hipFlexorStretch', name: 'Kneeling Hip Flexor Stretch', aliases: ['hip flexor stretch', 'kneeling lunge stretch'], cat: ['flexibility'], muscles: { p: ['hip flexors'], s: ['quads'] }, equip: 'mat', level: 1, impact: 'low', mode: 'time', def: { sets: 2, duration: 30, rest: 10 }, track: null, view: SIDE, type: 'hold',
      ghost: { anchor: 'lowest', anchorX: 'ankleA', cycle: 4, start: { torso: 0, thighA: 100, shinA: 180, thighB: 205, shinB: 270, uarm: 180, farm: 180 } },
      steps: ['Kneel on one knee, other foot in front.', 'Tuck your pelvis slightly and shift forward.', 'Feel the stretch at the front of the back hip. Switch sides.'], mistakes: ['Arching the lower back'], tips: ['Use a cushion under the knee.'],
      simple: 'Kneel on one knee and gently push your hips forward.', easier: [], harder: [], alt: ['lunge'] },
    { id: 'hamstringStretch', name: 'Standing Hamstring Stretch', aliases: ['hamstring stretch', 'toe touch'], cat: ['flexibility'], muscles: { p: ['hamstrings'], s: ['lower back'] }, equip: 'none', level: 1, impact: 'low', mode: 'time', def: { sets: 2, duration: 30, rest: 10 }, track: null, view: SIDE, type: 'hold',
      ghost: { anchor: 'ankle', cycle: 4, start: { torso: 68, thigh: 186, shin: 178, uarm: 172, farm: 172 } },
      steps: ['Stand with feet hip-width, knees soft.', 'Hinge at the hips and reach toward your shins.', 'Hold where you feel a gentle stretch.'], mistakes: ['Bouncing', 'Forcing the range'], tips: ['Never stretch into pain.'],
      simple: 'Bend forward from your hips and reach toward your toes. Hold gently.', easier: [], harder: [], alt: [] },
    { id: 'childPose', name: "Child's Pose", aliases: ["child's pose", 'child pose'], cat: ['flexibility'], muscles: { p: ['lower back'], s: ['shoulders', 'hips'] }, equip: 'mat', level: 1, impact: 'low', mode: 'time', def: { sets: 1, duration: 45, rest: 10 }, track: null, view: SIDE, floor: true, type: 'hold',
      ghost: { anchor: 'lowest', anchorX: 'kneeA', cycle: 5, start: { torso: 118, head: 125, thigh: 140, shin: 275, uarm: 98, farm: 98 } },
      steps: ['Kneel and sit back toward your heels.', 'Reach your arms forward on the floor.', 'Rest your forehead down and breathe.'], mistakes: [], tips: ['Widen your knees for more comfort.'],
      simple: 'Kneel, sit back on your heels and stretch your arms forward on the floor.', easier: [], harder: [], alt: ['catCow'] },
    { id: 'breathing', name: 'Breathing with Arm Raise', aliases: ['breathing', 'deep breathing', 'cool down breathing'], cat: ['mobility'], muscles: { p: ['shoulders'], s: [] }, equip: 'none', level: 1, impact: 'low', mode: 'time', def: { sets: 1, duration: 60, rest: 0 }, track: null, view: FRONT,
      ghost: { anchor: 'feet', cycle: 8, start: { uarm: 172, farm: 176, thigh: 180, shin: 180 }, end: { uarm: 22, farm: 18 } },
      steps: ['Stand tall, arms by your sides.', 'Breathe in slowly as you raise your arms overhead.', 'Breathe out slowly as you lower them.'], mistakes: ['Rushing the breath'], tips: ['About 4 seconds in, 4 seconds out.'],
      simple: 'Raise your arms as you breathe in, lower them as you breathe out.', easier: [], harder: [], alt: [] },

    /* ---------------- seated / chair ---------------- */
    { id: 'seatedPress', name: 'Seated Shoulder Press', aliases: ['seated press', 'seated shoulder press'], cat: ['strength'], muscles: { p: ['shoulders'], s: ['triceps'] }, equip: 'chair', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: 'seatedPress', ghostFrom: 'seatedPress', view: FRONT,
      steps: ['Sit tall, hands at shoulder height.', 'Press straight up overhead.', 'Lower with control.'], mistakes: ['Leaning back', 'Pressing forward'], tips: ['Light weights or water bottles work.'],
      simple: 'Sitting tall, push your hands up over your head and back down.', easier: [], harder: ['press'], alt: ['press'] },
    { id: 'seatedCurl', name: 'Seated Bicep Curl', aliases: ['seated curl'], cat: ['strength'], muscles: { p: ['biceps'], s: [] }, equip: 'chair', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 12, rest: 60 }, track: 'seatedCurl', ghostFrom: 'seatedCurl', view: FRONT,
      steps: ['Sit tall, arms by your sides.', 'Curl both hands to your shoulders.', 'Lower slowly.'], mistakes: ['Swinging'], tips: [],
      simple: 'Sitting, bend your elbows to bring your hands to your shoulders.', easier: [], harder: ['curl'], alt: ['curl'] },
    { id: 'seatedLateral', name: 'Seated Lateral Raise', aliases: ['seated lateral raise'], cat: ['strength'], muscles: { p: ['shoulders'], s: [] }, equip: 'chair', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 60 }, track: 'seatedLateral', ghostFrom: 'seatedLateral', view: FRONT,
      steps: ['Sit tall, arms by your sides.', 'Raise arms out to shoulder height.', 'Lower slowly.'], mistakes: ['Going too high', 'Shrugging'], tips: [],
      simple: 'Sitting, lift your arms out to the side to a T and lower.', easier: [], harder: ['lateral'], alt: ['lateral'] },
    { id: 'kneeExt', name: 'Seated Knee Extension', aliases: ['knee extension', 'seated leg extension'], cat: ['strength', 'mobility'], muscles: { p: ['quads'], s: [] }, equip: 'chair', level: 1, impact: 'low', mode: 'reps', def: { sets: 3, reps: 10, rest: 45 }, track: 'kneeExt', ghostFrom: 'kneeExt', view: SIDE,
      steps: ['Sit tall, side-on to the camera.', 'Straighten one knee until the leg is level.', 'Lower slowly; switch legs between sets.'], mistakes: ['Leaning back', 'Kicking quickly'], tips: ['Pause one second at the top.'],
      simple: 'Sitting, straighten your leg out in front of you and lower it.', easier: [], harder: ['chairSquat'], alt: ['chairSquat'] },
  ];

  const byId = {};
  for (const e of L) {
    byId[e.id] = e;
    e.type = e.type || (e.mode === 'time' ? 'hold' : 'reps');
    e.setting = e.setting || ['home', 'gym'];
  }

  const EQUIP_LABEL = { none: 'No equipment', chair: 'Chair', wall: 'Wall', mat: 'Mat', dumbbells: 'Dumbbells', barbell: 'Barbell & rack', bench: 'Bench', bar: 'Pull-up bar', machine: 'Gym machine', band: 'Band' };
  const CATS = { strength: 'Strength', endurance: 'Endurance', mobility: 'Mobility', flexibility: 'Flexibility', conditioning: 'Conditioning' };
  const LEVELS = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

  /** Something the ghost renderer can animate, or null if this exercise has no demo. */
  function demoOf(e) {
    if (!e) return null;
    if (e.ghostFrom && GF.EX[e.ghostFrom]) return GF.EX[e.ghostFrom];
    if (e.ghost) return { id: e.id, view: e.view, type: e.type, ghost: e.ghost, floor: e.floor };
    return null;
  }
  const trackOf = e => (e && e.track && GF.EX[e.track]) || null;

  /** Find an exercise in free text (longest alias match wins). */
  function find(text) {
    const t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9' -]/g, ' ') + ' ';
    let best = null, bestLen = 0;
    for (const e of L) {
      for (const a of [e.name.toLowerCase(), ...(e.aliases || [])]) {
        const pat = ' ' + a.toLowerCase() + ' ';
        if (t.includes(pat) || t.includes(' ' + a.toLowerCase().replace(/s$/, '') + ' ')) {
          if (a.length > bestLen) { best = e; bestLen = a.length; }
        }
      }
    }
    return best;
  }

  function hasEquipment(e, owned) {
    const free = ['none', 'chair', 'wall', 'mat'];
    return free.includes(e.equip) || (owned || []).includes(e.equip);
  }

  GF.lib = { list: L, byId, get: id => byId[id], demoOf, trackOf, find, hasEquipment, EQUIP_LABEL, CATS, LEVELS };
})(window.GF = window.GF || {});
