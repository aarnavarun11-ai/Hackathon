/* GhostFit – Interactive 3D movement viewer (Three.js, bundled locally in /vendor).
   Builds a 3D skeleton from the exercise's ghost keyframes, so every demo is generated
   from the same body model the tracker uses. Loaded lazily; renders only while visible;
   disposes all GPU resources on close. */
(function (GF) {
  'use strict';
  let loading = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/three.min.js'; s.async = true;
      s.onload = () => res(window.THREE); s.onerror = () => { loading = null; rej(new Error('Could not load the 3D engine')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  const ARM_X = 0.17, LEG_X = 0.09, SH_X = 0.15, HIP_X = 0.09;
  /** 2D ghost pose → 3D joints. X = person's left, Y = up, Z = forward. */
  function pose3D(demo, t) {
    const P = GF.ghost.poseAt(demo, t);
    const J = {};
    const v = (x, y, z) => ({ x, y, z });
    if (P.view === 'side') {
      const at = (p, x) => v(x, -p.y, p.x);
      J.head = at(P.head, 0); J.neck = at(P.shoulder, 0); J.pelvis = at(P.hip, 0);
      J.shoulderL = at(P.shoulder, SH_X); J.shoulderR = at(P.shoulder, -SH_X);
      J.hipL = at(P.hip, HIP_X); J.hipR = at(P.hip, -HIP_X);
      J.elbowL = at(P.elbowA, ARM_X); J.wristL = at(P.wristA, ARM_X); J.elbowR = at(P.elbowB, -ARM_X); J.wristR = at(P.wristB, -ARM_X);
      J.kneeL = at(P.kneeA, LEG_X); J.ankleL = at(P.ankleA, LEG_X); J.toeL = at(P.toeA, LEG_X);
      J.kneeR = at(P.kneeB, -LEG_X); J.ankleR = at(P.ankleB, -LEG_X); J.toeR = at(P.toeB, -LEG_X);
    } else {
      const at = (p, z = 0) => v(p.x, -p.y, z);
      const sc = (demo.ghost.start && demo.ghost.start.thighScale) || 1;
      const kz = sc < 1 ? GF.ghost.LEN.thigh * Math.sqrt(1 - sc * sc) : 0;
      J.head = at(P.head); J.neck = at(P.shoulderC); J.pelvis = at(P.hipC);
      for (const [s, k] of [['L', 'R'], ['R', 'L']]) {      // 2D "R" (screen right) = person's left
        J['shoulder' + s] = at(P['shoulder' + k]); J['elbow' + s] = at(P['elbow' + k]); J['wrist' + s] = at(P['wrist' + k]);
        J['hip' + s] = at(P['hip' + k]); J['knee' + s] = at(P['knee' + k], kz); J['ankle' + s] = at(P['ankle' + k], kz);
        J['toe' + s] = at(P['toe' + k], kz + 0.07); J['toe' + s].y = J['ankle' + s].y - 0.02;
      }
    }
    return J;
  }

  const BONES = [
    ['head', 'neck', 0.03], ['shoulderL', 'shoulderR', 0.04], ['shoulderL', 'hipL', 0.05], ['shoulderR', 'hipR', 0.05], ['hipL', 'hipR', 0.045],
    ['shoulderL', 'elbowL', 0.034], ['elbowL', 'wristL', 0.028], ['shoulderR', 'elbowR', 0.034], ['elbowR', 'wristR', 0.028],
    ['hipL', 'kneeL', 0.045], ['kneeL', 'ankleL', 0.036], ['ankleL', 'toeL', 0.024],
    ['hipR', 'kneeR', 0.045], ['kneeR', 'ankleR', 0.036], ['ankleR', 'toeR', 0.024],
  ];
  // which 3D joints correspond to the tracker's measured chains
  function measuredJoints(track) {
    if (!track) return [];
    const out = new Set();
    for (const chain of track.joints) for (const n of chain) {
      const base = n.replace(/[LR]$/, ''), side = /[LR]$/.test(n) ? n.slice(-1) : null;
      if (side) out.add(base + side); else { out.add(base + 'L'); }
    }
    return [...out];
  }

  async function create(container, libEntry, opts = {}) {
    const demo = GF.lib.demoOf(libEntry);
    if (!demo) throw new Error('No 3D demonstration for this exercise');
    const THREE = await loadThree();
    const track = GF.lib.trackOf(libEntry);
    const W = () => container.clientWidth || 400, H = () => container.clientHeight || 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    let pr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pr); renderer.setSize(W(), H());
    const darkT = document.documentElement.dataset.theme === 'dark';
    renderer.setClearColor(darkT ? 0x0b1b1e : 0xeaf6f3);
    container.prepend(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', `3D demonstration of ${libEntry.name}. Drag to rotate.`);
    renderer.domElement.setAttribute('role', 'img');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, W() / H(), 0.05, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(2, 3, 2); scene.add(dl);

    const grid = new THREE.GridHelper(4, 16, darkT ? 0x2a4a48 : 0x9fd6cc, darkT ? 0x17302f : 0xcfe9e4); scene.add(grid);

    const disposables = [];
    const mat = new THREE.MeshStandardMaterial({ color: darkT ? 0x9bb8b4 : 0x4f6866, roughness: 0.6, metalness: 0.05 });
    const matHi = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.5 });
    const matFar = new THREE.MeshStandardMaterial({ color: darkT ? 0x56706d : 0x9fb3b0, roughness: 0.7 });
    disposables.push(mat, matHi, matFar);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 12); const sph = new THREE.SphereGeometry(1, 18, 12);
    disposables.push(cyl, sph);

    const hi = new Set(measuredJoints(track));
    const body = new THREE.Group(); scene.add(body);
    const bones = BONES.map(([a, b, r]) => {
      const m = new THREE.Mesh(cyl, (hi.has(a) && hi.has(b)) ? matHi : (/R$/.test(a) && /R$/.test(b) ? matFar : mat));
      m.userData = { a, b, r }; body.add(m); return m;
    });
    const joints = {};
    for (const n of ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']) {
      const m = new THREE.Mesh(sph, hi.has(n) ? matHi : mat); m.scale.setScalar(hi.has(n) ? 0.042 : 0.034); body.add(m); joints[n] = m;
    }
    const head = new THREE.Mesh(sph, mat); head.scale.setScalar(0.075); body.add(head);

    // movement path of the joint that travels most during a rep
    const cycle = demo.ghost.cycle || 3, samples = 48;
    let keyJoint = null, maxTravel = 0;
    const tracks = {};
    for (let i = 0; i <= samples; i++) {
      const J = pose3D(demo, (i / samples) * cycle);
      for (const k of Object.keys(J)) (tracks[k] = tracks[k] || []).push(J[k]);
    }
    for (const [k, pts] of Object.entries(tracks)) {
      if (/R$/.test(k) && demo.view === 'side') continue;
      let tr = 0; for (let i = 1; i < pts.length; i++) tr += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
      if (tr > maxTravel) { maxTravel = tr; keyJoint = k; }
    }
    let pathLine = null, arrow = null;
    if (keyJoint && maxTravel > 0.05 && demo.type !== 'hold') {
      const pts = tracks[keyJoint].slice(0, Math.ceil(samples * 0.5)).map(p => new THREE.Vector3(p.x, p.y, p.z));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const lm = new THREE.LineDashedMaterial({ color: 0x14b8a6, dashSize: 0.03, gapSize: 0.02, transparent: true, opacity: 0.8 });
      pathLine = new THREE.Line(g, lm); pathLine.computeLineDistances(); scene.add(pathLine); disposables.push(g, lm);
      const mid = Math.floor(pts.length * 0.55), a = pts[mid], b = pts[Math.min(pts.length - 1, mid + 3)];
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      if (dir.lengthSq() > 0) { arrow = new THREE.ArrowHelper(dir, a, 0.12, 0x14b8a6, 0.06, 0.04); scene.add(arrow); }
    }

    // recommended camera placement marker
    const camMarker = new THREE.Group();
    const cb = new THREE.BoxGeometry(0.12, 0.08, 0.07), cl = new THREE.CylinderGeometry(0.026, 0.026, 0.05, 16);
    const cm = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 }); disposables.push(cb, cl, cm);
    const box = new THREE.Mesh(cb, cm), lens = new THREE.Mesh(cl, cm); lens.rotation.x = Math.PI / 2; lens.position.z = -0.07;
    camMarker.add(box, lens);
    const camDist = 2.3, camY = demo.floor ? 0.3 : 0.75;
    if (demo.view === 'side') { camMarker.position.set(camDist, camY, 0.1); camMarker.lookAt(0, camY, 0.1); }
    else { camMarker.position.set(0, camY, camDist); camMarker.lookAt(0, camY, 0); }
    camMarker.rotateY(Math.PI);
    scene.add(camMarker);
    const sightG = new THREE.BufferGeometry().setFromPoints([camMarker.position.clone(), new THREE.Vector3(0, camY, demo.view === 'side' ? 0.1 : 0)]);
    const sightM = new THREE.LineDashedMaterial({ color: 0xf97316, dashSize: 0.05, gapSize: 0.05, transparent: true, opacity: 0.5 });
    const sight = new THREE.Line(sightG, sightM); sight.computeLineDistances(); scene.add(sight); disposables.push(sightG, sightM);

    // framing: centre on the movement
    const allPts = Object.values(tracks).flat();
    const c = allPts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y, z: s.z + p.z }), { x: 0, y: 0, z: 0 });
    const target = new THREE.Vector3(c.x / allPts.length, c.y / allPts.length, c.z / allPts.length);
    const views = { front: [0, 0.12], side: [Math.PI / 2, 0.12], rear: [Math.PI, 0.12], angle: [Math.PI / 4, 0.32] };
    let az = (demo.view === 'side' ? views.side : views.angle)[0], el = 0.15, dist = 3.2;
    const markerAz = demo.view === 'side' ? Math.PI / 2 : 0;
    function place() {
      // hide the camera-spot marker when we are looking from (almost) the same spot, so it never blocks the figure
      const d = Math.abs(((az - markerAz) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      const show = d > 0.5; camMarker.visible = show; sight.visible = show;
      camera.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
      camera.lookAt(target);
    }
    place();

    const v3a = new THREE.Vector3(), v3b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    function setPose(J) {
      for (const m of bones) {
        const { a, b, r } = m.userData; const A = J[a], B = J[b]; if (!A || !B) continue;
        v3a.set(A.x, A.y, A.z); v3b.set(B.x, B.y, B.z);
        const len = v3a.distanceTo(v3b);
        m.position.copy(v3a).add(v3b).multiplyScalar(0.5);
        m.scale.set(r, Math.max(0.001, len), r);
        m.quaternion.setFromUnitVectors(up, v3b.sub(v3a).normalize());
      }
      for (const [n, m] of Object.entries(joints)) if (J[n]) m.position.set(J[n].x, J[n].y, J[n].z);
      head.position.set(J.head.x, J.head.y, J.head.z);
    }

    // interaction
    let playing = opts.autoplay !== false, speed = 1, t = 0, last = performance.now(), dragging = null, visible = true, raf = 0, disposed = false;
    const el_ = renderer.domElement;
    el_.addEventListener('pointerdown', e => { dragging = { x: e.clientX, y: e.clientY, az, el }; el_.setPointerCapture(e.pointerId); kick(); });
    el_.addEventListener('pointermove', e => { if (!dragging) return; az = dragging.az - (e.clientX - dragging.x) * 0.01; el = Math.max(-0.2, Math.min(1.2, dragging.el + (e.clientY - dragging.y) * 0.01)); place(); kick(); });
    el_.addEventListener('pointerup', () => { dragging = null; });
    el_.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(1.6, Math.min(6, dist + e.deltaY * 0.002)); place(); kick(); }, { passive: false });
    el_.tabIndex = 0;
    el_.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { az -= 0.15; place(); kick(); } else if (e.key === 'ArrowRight') { az += 0.15; place(); kick(); }
      else if (e.key === ' ') { e.preventDefault(); api.toggle(); }
    });
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0.01 });
    io.observe(container);
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); kick(); });
    ro.observe(container);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('rm');
    if (reduced && opts.autoplay !== true) playing = false;
    let slowFrames = 0;
    function frame(now) {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (playing) t += dt * speed;
      setPose(pose3D(demo, playing || t ? t : 0));
      const t0 = performance.now();
      renderer.render(scene, camera);
      if (performance.now() - t0 > 25 && ++slowFrames > 20 && pr > 1) { pr = 1; renderer.setPixelRatio(pr); slowFrames = 0; }
      if (playing || dragging) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    setPose(pose3D(demo, 0)); kick();

    const api = {
      setView(name) { const v = views[name]; if (!v) return; az = v[0]; el = v[1]; place(); kick(); },
      play() { playing = true; kick(); }, pause() { playing = false; kick(); },
      toggle() { playing = !playing; kick(); return playing; },
      setSpeed(s) { speed = s; },
      get playing() { return playing; },
      cameraHint: demo.view === 'side' ? 'Side view' : 'Front view',
      keyJoint,
      dispose() {
        disposed = true; if (raf) cancelAnimationFrame(raf);
        io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
        disposables.forEach(d => d.dispose && d.dispose());
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        el_.remove();
      },
    };
    return api;
  }

  /* --- simple 2D fallback (no WebGL / no 3D needed) --- */
  function draw2D(canvas, libEntry, t, colors) {
    const demo = GF.lib.demoOf(libEntry); if (!demo) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w) return true;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h);
    const P = GF.ghost.poseAt(demo, t);
    const T = GF.ghost.motionFit(demo, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 });
    const th = colors || GF.themeColors || { a: '#14b8a6', b: '#0e7490', glow: 'rgba(20,184,166,.55)', prop: 'rgba(15,118,110,.22)' };
    const g = ctx.createLinearGradient(0, h * 0.1, w * 0.4, h * 0.95); g.addColorStop(0, th.a); g.addColorStop(1, th.b);
    GF.ghost.drawProps(ctx, demo, P, T, th.prop);
    GF.ghost.draw(ctx, P, T, { color: g, glowColor: th.glow, alpha: 0.95, glow: true });
    return true;
  }

  GF.viewer3d = { create, loadThree, pose3D, draw2D };
})(window.GF = window.GF || {});
