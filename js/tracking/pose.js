/* GhostFit – Camera manager + on-device pose model (Google MediaPipe Pose Landmarker).
   Privacy rules enforced here:
     • the camera is only requested from an explicit user action (callers must pass userAction:true)
     • only a video stream is requested (never audio, never screen capture)
     • frames are processed in memory on this device; nothing is recorded or uploaded
     • stop() ends every track; revoked permissions / unplugged cameras are detected
   The model files are downloaded once from Google's CDN (the only network request this makes). */
(function (GF) {
  'use strict';
  const bus = () => GF.u.bus;

  const VERSION = '0.10.14';
  const LIB = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
  const WASM = `${LIB}/wasm`;
  const params = new URLSearchParams(location.search);
  const MODEL_KIND = params.get('model') === 'full' ? 'full' : 'lite';
  const MODEL = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${MODEL_KIND}/float16/1/pose_landmarker_${MODEL_KIND}.task`;

  const pose = {
    status: 'idle', error: null, landmarker: null, stream: null, loading: null, lastTs: 0, video: null,
    MODEL_HOSTS: ['cdn.jsdelivr.net', 'storage.googleapis.com'],

    load() {
      if (this.loading) return this.loading;
      this.status = 'loading'; bus().emit('model', this.status);
      this.loading = (async () => {
        this.tries = (this.tries || 0) + 1;
        // a failed module download is cached by the browser, so retries use a fresh URL
        const mp = await import(this.tries > 1 ? `${LIB}?retry=${this.tries}` : LIB);
        const vision = await mp.FilesetResolver.forVisionTasks(WASM);
        const make = delegate => mp.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 2,
          minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.6,
        });
        try { this.landmarker = await make('GPU'); } catch (e) { console.warn('GPU unavailable, using CPU', e); this.landmarker = await make('CPU'); }
        this.status = 'ready'; bus().emit('model', this.status);
      })().catch(err => { this.status = 'error'; this.error = err; this.loading = null; bus().emit('model', this.status); throw err; });
      return this.loading;
    },

    get active() { return !!(this.stream && this.stream.getVideoTracks().some(t => t.readyState === 'live')); },

    async permission() {
      try { const p = await navigator.permissions.query({ name: 'camera' }); return p.state; } catch (e) { return 'unknown'; }
    },

    async devices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      const list = await navigator.mediaDevices.enumerateDevices();
      return list.filter(d => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
    },

    /** Start the camera. Must be called from a deliberate user action. */
    async start(video, { deviceId, userAction, facing } = {}) {
      if (!userAction) throw new Error('Camera can only be started by the user.');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const e = new Error('This browser does not support camera access. Try Chrome or Edge.'); e.name = 'NotSupportedError'; throw e;
      }
      this.stop();
      const vc = { width: { ideal: 1280 }, height: { ideal: 720 } };
      if (deviceId) vc.deviceId = { exact: deviceId }; else vc.facingMode = facing || 'user';
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false }); }
      catch (e) {
        if (deviceId && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        else throw e;
      }
      this.stream = stream; this.video = video;
      stream.getVideoTracks().forEach(t => { t.onended = () => { this.stop('ended'); }; });
      video.srcObject = stream;
      await video.play().catch(() => {});
      this.watchPermission();
      bus().emit('camera', { on: true });
    },

    /** Stop every track and detach the stream. Safe to call any time. */
    stop(reason) {
      const had = !!this.stream;
      if (this.stream) this.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
      this.stream = null;
      if (this.video) { try { this.video.pause(); } catch (e) { /* ignore */ } this.video.srcObject = null; }
      if (had) bus().emit('camera', { on: false, reason: reason || 'user' });
    },

    async watchPermission() {
      if (this._watching) return;
      try {
        const p = await navigator.permissions.query({ name: 'camera' });
        this._watching = true;
        p.onchange = () => { if (p.state !== 'granted' && this.stream) this.stop('revoked'); };
      } catch (e) { /* Permissions API unavailable — track 'ended' events still catch revocation */ }
    },

    detect(video) {
      if (!this.landmarker || !video || video.readyState < 2) return undefined;
      let ts = performance.now();
      if (ts <= this.lastTs) ts = this.lastTs + 1;
      this.lastTs = ts;
      const r = this.landmarker.detectForVideo(video, ts);
      return this.pick(r && r.landmarks);
    },

    /** With someone else in the room, stay locked on the person training:
        the biggest body, strongly preferring whoever we were tracking a moment ago. */
    pick(list) {
      if (!list || !list.length) return null;
      if (list.length === 1) { this.lastC = centre(list[0]) || this.lastC; return list[0]; }
      let best = null, bestScore = -Infinity;
      for (const lm of list) {
        const c = centre(lm); if (!c) continue;
        const near = this.lastC ? Math.hypot(c.x - this.lastC.x, c.y - this.lastC.y) : 0;
        const score = c.size - near * 1.5;
        if (score > bestScore) { bestScore = score; best = lm; }
      }
      if (best) this.lastC = centre(best);
      return best || list[0];
    },
  };

  /** centre + size (torso length) of a detected person, from shoulders and hips */
  function centre(lm) {
    const pts = [11, 12, 23, 24].map(i => lm[i]).filter(p => p && (p.visibility == null || p.visibility > 0.3));
    if (pts.length < 2) return null;
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length, y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const sh = lm[11] && lm[12] ? { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 } : null;
    const hp = lm[23] && lm[24] ? { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 } : null;
    return { x, y, size: sh && hp ? Math.hypot(sh.x - hp.x, sh.y - hp.y) : 0 };
  }

  // Never leave a camera running when the page goes away.
  window.addEventListener('pagehide', () => pose.stop('page'));

  GF.pose = pose;
})(window.GF = window.GF || {});
