# GhostFit — privacy-first AI fitness coaching

GhostFit is a browser-based fitness coach. Build any workout, follow it with a calm voice coach, and let the camera count reps and check form — **on your device, without recording or uploading video.**

No account, no server, no analytics. Everything is stored in your browser on this computer.

---

## Look & feel (v4)

Glassy mint-to-peach gradient design with a **light / dark mode** switch (sidebar button, or Settings → Appearance; "Auto" follows your computer). Visual-first: animated ghost figures on every workout and exercise, a ghost mascot, progress ring, weekly bars, and a "what GhostFit does" strip highlighting the core features (joint tracking, form-gated reps, voice control, on-device privacy).

## Rehab — 8 body areas

The **Rehab** tab guides recovery after an injury to the **knee, ankle & foot, hip, shoulder, elbow, wrist & hand, lower back or neck** (sprains, tears, fractures, dislocations, tennis elbow, frozen shoulder, hip replacement, disc problems, whiplash and more). 55+ staged exercises.

1. **Safety first** – confirm a doctor/physio has cleared you; red-flag warning signs (plus area-specific ones, e.g. hip-replacement precautions) are always shown.
2. **Set up** – area → side → injury → how much you can use it → stage (Gentle motion / Build strength / Back to normal).
3. **Change plan any time** – tap *Change plan* to switch area, side, injury, ability, stage or session size, and add/remove individual exercises.
4. **Pain check** – 0–10 faces. 7+ means rest today; 4–6 gives a gentler session.
5. **Measured exercises** – the camera draws the joint angle live (knee, ankle, hip, shoulder, elbow, wrist, trunk, neck). Reps count automatically; *Pain — stop* and *Exit* (save or discard) are always there.
6. **Progress** – range of motion as % of normal and % of your healthy side, best-ever deltas, pain before → after, and a muscle map of what you're retraining.

GhostFit guides home exercise; it does not diagnose or replace medical advice.

## Open it on your phone (GitHub Pages)

GhostFit is plain static files, so GitHub Pages can host it for free over **https** (phones only allow the camera on https):

1. Push this folder to GitHub (repo `Goofy-Sashwin`).
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. After a minute it's live at `https://aarnavarun11-ai.github.io/Goofy-Sashwin/ai-home-trainer/` (adjust if the folder sits elsewhere).
4. On the phone, open the link → browser menu → **Add to Home Screen**. It installs like an app and, after the first visit, works offline (the pose AI is cached after first camera use).

Only the app's code comes from GitHub. Workouts, history and rehab data stay in that device's browser.

## Phone as a second camera (private)

Settings → **Phone camera → Link a phone**, or in a workout: *Add your phone as a second angle* / More → *Phone angle*.

1. The computer shows a QR code → scan it with the phone's camera app and open the link.
2. Tap **Start** on the phone → the phone shows its own QR → hold it up to the computer's webcam.
3. Linked. Put the phone at your side for exercises that need a side view; GhostFit automatically counts from whichever angle sees the exercise better (a small "Phone angle" preview shows in the corner).

Privacy: the phone runs the pose AI itself and sends **only 33 body-point coordinates** — never video or audio — **directly** to the computer over your Wi-Fi (WebRTC peer-to-peer, DTLS-encrypted). There is **no server and no STUN**: connection details are exchanged by the two QR codes. Both devices must be on the same network (if the venue Wi-Fi blocks device-to-device traffic, connect the computer to the phone's hotspot).

## Backups

Settings → Data: **Export** downloads everything as JSON; **Import** loads a backup — *Merge* (add what's new) or *Replace everything*.

## 60-second tour (for judges & first-time users)

Home → **60-second tour** (or open `#/tour`). It plays the highlights automatically with narration: a simulated athlete running through the real tracking engine (clean reps count, bad form and half reps don't), form score, rehab angle measuring, progress + physio report, muscle map, privacy and voice. ← → to move, Space to pause, Esc to close.

## Rep-counting accuracy

`node tests/accuracy.js` runs 16 realistic scenarios (camera noise, tracking dropouts, arms dropped between presses, wide-grip presses, half reps, fast/slow reps, bad form, standing still) through the real engine. Current result: **16/16 exact (100%)** — up from 5/13 before the v8 fixes:
- brief tracking dropouts (motion blur, an arm crossing the body) no longer throw away a rep in progress;
- a rep only counts when the end position is really reached and held for 2+ frames (e.g. hands above the head for a press) — dropping your arms to your sides is no longer mistaken for a rep;
- form checks need a fault in a meaningful share of the rep before rejecting it; the press check is less picky about wide grips;
- if someone walks behind you, tracking stays locked on the person training;
- **Settings → Rep counting**: Relaxed / Standard / Strict.

## Form score, personal bests & reports

- **Form score (0–100)** for every camera-checked set: the share of clean reps (or how much of a hold stayed in good form). Shown after each set, in the workout summary and on Progress.
- **Personal bests** (more reps / longer holds than ever before), **weekly-goal** and **streak** milestones are celebrated with confetti. Rehab celebrates a new best range of motion.
- **Report for your physio** (Rehab → *Report for physio*): plan details, range-of-motion table and trend charts, pain before/after, session log, current home programme, your questions and space for clinician notes. *Print / Save as PDF*.

## Reliability

Saved data is checked on start-up (removed exercises, old formats and corrupted values are cleaned up), every page and camera loop is crash-guarded, and leaving the tab mid-workout asks first.

## Muscle map

After every workout (and on Progress, workout pages and Rehab) a front + back body diagram lights up the muscles you worked — teal for light work through to orange for the most worked.

## Run it

**Double-click `start-ghostfit.bat`.** It opens GhostFit at http://localhost:8000 in your browser (keep the black window open while you use it). This is the most reliable way: the camera and **voice input usually don't work if you double-click `index.html`.** Use Chrome or Edge.

Then: **1 Focus → 2 Intensity (Quick / Standard / Beast Mode) → 3 Camera → 4 Go.**

The first time you turn the camera on, the AI pose model (~5 MB) downloads from Google. If your network blocks it, you'll still see yourself and can log sets by hand.

**Demo Mode** — open any workout's URL with `/demo` at the end (e.g. `#/workout/tpl_foundations/demo`). A clearly labelled *simulated athlete* performs the movements so you can show every tracking feature without a camera. Demo sessions are never saved to progress.

---

## What's in it

| Area | What it does |
|---|---|
| **Dashboard** | Today's (scheduled or recommended) workout, weekly goal progress, streak, recent sessions, recovery reminders, recommendations, quick access to the coach and builder. |
| **Workouts** | Your workouts, 9 templates, and a 46-exercise library with search and filters. Templates are read-only — “Customize” makes your own copy. |
| **Builder** | Create from scratch: warm-up / main / cool-down, supersets, circuits, recovery periods, sets, reps or time, rest, tempo, difficulty, notes, schedule. Reorder (buttons or drag), duplicate, **replace without losing settings**, validation before saving or starting. Every save keeps the previous version (restorable). |
| **Active workout** | Large, readable from a distance. Intro → get-in-position guide → 3-2-1 → set → rest. Pause/resume, skip, add a set, end. Never advances while you're doing a rep-based set. |
| **Camera form tracking** | 20 camera-checked exercises. A rep counts only with full range **and** good form. Corrections only when tracking confidence is good; otherwise it tells you why (hidden joint, lighting, distance, off-centre, wrong angle) and says “form not assessed” rather than guessing. Green / yellow / red always come with an icon and text. |
| **Voice** | Calm spoken coaching with Minimal / Balanced / Detailed levels, adjustable voice, speed and volume, captions. Opt-in voice commands: *start, pause, resume, next, repeat, skip, add another set, done, how many reps left, how much rest left, slow down, explain my form, end workout, mute*. |
| **3D movement guide** | Three.js skeleton built from the same body model the tracker uses. Front / side / rear / 3-4 views, drag to rotate, movement path, measured joints highlighted, recommended camera position. Bundled locally; disposed on close. |
| **Movement review** | After a camera-tracked set: replay your skeleton beside a reference, with the joint-angle timeline and every rep marked. Skeleton data only — never video. |
| **AI Coach** | Built-in, on-device coach. Technique, muscles, alternatives, struggling, rest, warm-ups, soreness, progression — and it builds workouts (“30-minute upper body with dumbbells”, “20-minute seated workout”). Text or voice, read-aloud answers, conversation history. Safety first; honest when a question is outside what it knows. |
| **Adaptation** | After a workout, rate each exercise (too easy / right / too difficult / uncomfortable / pain / not enough rest). You get *suggestions* — nothing changes unless you select it, intensity is never raised automatically, templates are never modified, and every accepted change is logged. |
| **Progress** | Workouts, weekly frequency vs goal, 4-week consistency, personal records, strength progression from weights you log, completion rate, session details. Every number says where it came from: *camera-counted (estimate)*, *logged by you*, or *timer*. |
| **Settings & privacy** | Profile, voice, coaching style, camera (test / preferred device), microphone consent, accessibility, Privacy Mode, retention controls, export everything (JSON), delete by category or everything. |

---

## Privacy & security

| Feature | Runs | Leaves the device |
|---|---|---|
| Pose estimation | In the browser | Nothing. Model files are downloaded once from `cdn.jsdelivr.net` / `storage.googleapis.com`. |
| 3D demos | In the browser | Nothing (Three.js is bundled in `/vendor`). |
| Spoken coaching | OS voices | Nothing (some “online” voices in Edge/Chrome are cloud voices — pick a local one to avoid this). |
| Voice commands / dictation | Browser speech recognition | **Audio goes to Google (Chrome) or Microsoft (Edge)** while the mic is on. Opt-in with an explanation; off in Privacy Mode unless allowed for that session. |
| AI Coach | In the browser | Nothing. |
| Data | localStorage | Nothing — no account, sync or analytics. |

- Camera and mic only start from a deliberate click; the camera requests **video only** (no audio, no screen capture).
- Turning the camera off, ending/leaving a workout, closing the tab, or revoking permission stops **every** track immediately.
- No video or audio is ever recorded or stored. Movement review uses skeleton points, kept in memory unless you opt in.
- A Content-Security-Policy restricts scripts and network access to this folder plus the two model hosts.

---

## Accessibility

Keyboard-operable throughout (skip link, visible focus, focus-trapped dialogs, arrow-key 3D rotation), screen-reader labels and live regions, captions for spoken instructions, large text, high contrast, reduced motion, large touch targets on the workout screen, responsive desktop / tablet / phone layouts. Automated WCAG 2.1 AA audit (axe-core): **0 violations** on every page.

---

## Tests

```
node tests/unit.js              # library, workouts, voice parsing, coach, adaptation, confidence logic
node tests/exercise-check.js    # every tracked exercise: good / bad-form / half reps, standing still = 0 reps
node tests/exercise-check.js --flip
```

Browser end-to-end tests were run for: builder (create, superset, reorder, duplicate, replace, validate, save, revisions), full sessions (camera-tracked, timer, manual logging, rest, summary, replay, feedback → adaptation), the camera (consent-gated start, mid-workout off, unplug/revoke, full shutdown), chat, 3D viewer, settings (Privacy Mode, export, delete all), mobile layout, and a long session (steady 60 fps, flat memory).

---

## Honest limitations

- Camera form checks cover 20 exercises. Others are logged manually or timed, and are labelled that way.
- Tracking is a 2D estimate from one camera — not a medical or biomechanical assessment.
- The AI Coach is a built-in knowledge engine, not a general chatbot. It says so when a question is outside its knowledge.
- Voice commands need Chrome or Edge (and internet, for the browser's speech service).
- Data lives in this browser only. Use **Settings → Export** to back it up.

---

## Code map

```
index.html                 app shell + CSP
css/app.css                design system
vendor/three.min.js        Three.js r149 (MIT, bundled)
js/core/util.js            DOM helpers, icons, modal, toast
js/core/store.js           local data store, retention, export/delete
js/core/voice.js           speech output, adaptive coaching voice, voice commands
js/core/viewer3d.js        3D movement viewer
js/core/coach-engine.js    on-device AI coach
js/core/adapt.js           recommendations, recovery, feedback → suggestions
js/core/app.js             routing & navigation
js/data/library.js         46-exercise knowledge base
js/data/workouts.js        workout model, templates, validation, flattening
js/tracking/ghost.js       2D body model + ghost renderer
js/tracking/exercises.js   camera-tracking definitions (angles, thresholds, form checks)
js/tracking/engine.js      confidence scoring, rep counter, hold timer
js/tracking/pose.js        camera manager + MediaPipe pose model
js/tracking/sim.js         demo athlete
js/views/*.js              dashboard, workouts, builder, session, replay, coach, progress, settings
tests/                     unit + tracker tests
```
