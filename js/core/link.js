/* GhostFit – Phone as a second camera, privately.
   How it stays private:
     • The phone runs the pose AI itself and sends only 33 body points (numbers) — never video or audio.
     • Phone ↔ computer talk directly (WebRTC peer-to-peer, encrypted with DTLS) over your own Wi-Fi.
     • No server and no STUN: connection details are swapped by QR codes on screen, so nothing about
       the link is sent to any company. Host addresses are hidden by the browser (mDNS).
   Pairing: 1) computer shows a QR → phone scans it with its normal camera app and opens GhostFit
            2) phone shows a QR → hold it up to the computer's webcam. Done. */
(function (GF) {
  'use strict';
  const { esc, icon, toast, bus } = GF.u;
  const RTC_CFG = { iceServers: [] };   // local network only: no STUN/TURN servers are contacted
  const PREFIX_A = 'GFA1:';

  /* ---------- compact codes for QR (deflate + base64url) ---------- */
  const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  async function pack(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      const cs = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer()));
    }
    return 'j' + b64u(raw);
  }
  async function unpack(code) {
    const kind = code[0], bytes = unb64u(code.slice(1));
    let txt;
    if (kind === 'z') { const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')); txt = await new Response(ds).text(); }
    else txt = new TextDecoder().decode(bytes);
    return JSON.parse(txt);
  }
  // keep only what a data-channel connection needs (makes the QR much smaller)
  const slim = sdp => sdp.split(/\r?\n/).filter(l => l && !/^a=(extmap|rtcp|ssrc|msid|group:LS|ice-options)/.test(l)).join('\r\n') + '\r\n';
  function gathered(pc, ms = 2500) {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, ms);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }

  /* ---------- QR helpers ---------- */
  function qrSvg(text, px = 300) {
    const q = window.qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount(), m = 4, s = n + m * 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg class="qr" viewBox="0 0 ${s} ${s}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#0b1416"/></svg>`;
  }
  let jsqrLoading = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!jsqrLoading) jsqrLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/jsQR.js'; s.onload = res; s.onerror = () => { jsqrLoading = null; rej(new Error('QR scanner failed to load')); }; document.head.appendChild(s); });
    return jsqrLoading;
  }

  /* ================= computer side (host) ================= */
  const host = {
    pc: null, dc: null, state: 'off', latest: null, info: null, fps: 0, _n: 0, _t: 0,
    get connected() { return this.state === 'connected'; },
    fresh(ms = 400) { return this.connected && this.latest && performance.now() - this.latest.rx < ms ? this.latest : null; },
    set(st) { this.state = st; bus.emit('link', { state: st }); },
    async createOffer() {
      this.close(true);
      const pc = this.pc = new RTCPeerConnection(RTC_CFG);
      const dc = this.dc = pc.createDataChannel('pose', { ordered: false, maxRetransmits: 0 });
      dc.onopen = () => { this.set('connected'); toast('Phone camera linked — only body points are shared'); };
      dc.onclose = () => { if (this.state === 'connected') { this.set('off'); toast('Phone camera disconnected'); } };
      dc.onmessage = e => this.receive(e.data);
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState) && this.state !== 'off') { this.set('off'); } };
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      this.set('waiting');
      return pack({ v: 1, s: slim(pc.localDescription.sdp) });
    },
    async acceptAnswer(text) {
      if (!this.pc) throw new Error('No pairing in progress');
      const code = text.startsWith(PREFIX_A) ? text.slice(PREFIX_A.length) : text;
      const a = await unpack(code.trim());
      if (!a || !a.s) throw new Error('That isn’t a GhostFit phone code');
      await this.pc.setRemoteDescription({ type: 'answer', sdp: a.s });
      this.set('connecting');
    },
    receive(data) {
      try {
        const m = JSON.parse(data);
        if (m.type === 'hello') { this.info = { name: m.name || 'Phone', facing: m.facing }; return; }
        if (m.type !== 'pose') return;
        const lms = m.l ? Array.from({ length: 33 }, (_, i) => ({ x: m.l[i * 3], y: m.l[i * 3 + 1], z: 0, visibility: m.l[i * 3 + 2] })) : null;
        this.latest = { lms, W: m.w || 720, H: m.h || 1280, rx: performance.now() };
        this._n++; const now = performance.now(); if (now - this._t > 1000) { this.fps = this._n; this._n = 0; this._t = now; }
      } catch (e) { /* ignore malformed packets */ }
    },
    close(silent) {
      try { this.dc && this.dc.close(); } catch (e) { /* ignore */ }
      try { this.pc && this.pc.close(); } catch (e) { /* ignore */ }
      this.pc = this.dc = null; this.latest = null;
      if (!silent || this.state !== 'off') this.set('off');
    },
  };

  /** The address a phone should open. Must be https for the phone camera to work. */
  function publicBase() {
    const here = location.href.split('#')[0];
    if (/^https:/.test(here)) return here;
    return (GF.store.settings.publicUrl || '').trim();
  }

  /* ---------- pairing dialog on the computer ---------- */
  async function pairDialog() {
    const base = publicBase();
    if (!window.RTCPeerConnection) { toast('This browser can’t link a phone. Try Chrome or Edge.', 'error'); return; }
    const body = document.createElement('div');
    body.className = 'pair';
    body.innerHTML = `<div class="pair-step" data-p1><div class="pair-spin">${icon('qr')} Preparing a private link…</div></div>`;
    let scanStop = null, unsub = null;
    const m = GF.u.modal({ title: 'Add your phone as a second camera', body, wide: true, onClose: () => { if (scanStop) scanStop(); if (unsub) unsub(); if (host.state === 'waiting' || host.state === 'connecting') host.close(); } });
    let code;
    try { code = await host.createOffer(); } catch (e) { body.innerHTML = `<p class="pair-err">${icon('alert')} Couldn’t start a link: ${esc(e.message || e)}</p>`; return; }
    if (!base) {
      body.innerHTML = `<p class="pair-err">${icon('alert')} Phones need the app’s web address (https) to open it.</p><p>Open GhostFit from its published link (e.g. GitHub Pages), or add that link in <a href="#/settings">Settings → Phone camera</a>, then try again.</p>`;
      host.close(); return;
    }
    const url = `${base}#/cam/${code}`;
    body.innerHTML = `
      <div class="pair-grid">
        <div class="pair-qr">${qrSvg(url, 300)}</div>
        <div class="pair-copy">
          <ol class="pair-steps">
            <li><b>Same Wi-Fi.</b> Phone and computer on the same network (or the computer on your phone’s hotspot).</li>
            <li><b>Scan this</b> with your phone’s camera app and open the link.</li>
            <li>On the phone tap <b>Start</b>. It will show its own code.</li>
            <li><b>Hold the phone’s screen up to this webcam.</b></li>
          </ol>
          <div class="pair-privacy">${icon('lock')}<span>Your phone sends <b>only 33 body points</b> straight to this computer, encrypted. No video, no audio, no server.</span></div>
          <div class="pair-scan"><video playsinline muted aria-label="Webcam view for scanning the phone’s code"></video><span class="pair-status" data-status>Waiting for the phone’s code…</span></div>
          <details class="pair-manual"><summary>Can’t scan? Paste the phone’s code</summary><textarea rows="2" data-code placeholder="GFA1:…" aria-label="Phone code"></textarea><button class="btn sm" data-paste>Connect</button></details>
        </div>
      </div>`;
    const status = t => { const s = body.querySelector('[data-status]'); if (s) s.textContent = t; };
    const finish = async txt => {
      try { status('Connecting…'); await host.acceptAnswer(txt); } catch (e) { status('That code didn’t work — try again'); return false; }
      return true;
    };
    body.querySelector('[data-paste]').addEventListener('click', () => finish(body.querySelector('[data-code]').value));
    unsub = bus.on('link', e => { if (e.state === 'connected') { if (scanStop) scanStop(); m.close(); bus.emit('link-ready'); } });
    // scan the phone's QR with the webcam
    try {
      await loadJsQR();
      const v = body.querySelector('.pair-scan video');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, facingMode: 'user' }, audio: false });
      v.srcObject = stream; await v.play().catch(() => {});
      const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
      let alive = true, busy = false;
      scanStop = () => { alive = false; stream.getTracks().forEach(t => t.stop()); };
      const tick = async () => {
        if (!alive) return;
        if (v.videoWidth && !busy) {
          const w = Math.min(960, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
          c.width = w; c.height = h; ctx.drawImage(v, 0, 0, w, h);
          const r = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (r && r.data && r.data.startsWith(PREFIX_A)) { busy = true; if (!(await finish(r.data))) busy = false; }
        }
        setTimeout(tick, 160);
      };
      tick();
    } catch (e) { status('Webcam unavailable for scanning — paste the code instead'); }
  }

  /* ================= phone side (camera) ================= */
  let P = null;
  function camPage(code) {
    if (P) stopCam();
    const root = document.createElement('div');
    root.className = 'camlink'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Use this phone as a camera');
    root.innerHTML = `
      <video playsinline muted aria-hidden="true"></video><canvas aria-hidden="true"></canvas>
      <div class="cl-card" data-card>
        <div class="cl-brand">${GF.art.ghost(56)}<b>GhostFit</b></div>
        <h1>Use this phone as a second camera</h1>
        <ul class="cl-points">
          <li>${icon('lock')}<span>Only <b>33 body points</b> are sent — never video or sound.</span></li>
          <li>${icon('link')}<span>Straight to your computer over your Wi-Fi. Nothing goes to the internet.</span></li>
          <li>${icon('eye')}<span>Put the phone to your <b>side</b>, 2–3 m away, whole body in view.</span></li>
        </ul>
        <div class="cl-facing" role="group" aria-label="Which camera"><button class="pchip on" data-facing="environment" aria-pressed="true">Back camera</button><button class="pchip" data-facing="user" aria-pressed="false">Front camera</button></div>
        <button class="btn primary lg" data-cl="start">${icon('cam')}Start</button>
        <button class="btn ghost-light" data-cl="cancel">Not now</button>
      </div>
      <div class="cl-top" hidden><span class="cl-dot"></span><span data-cl-status>Starting…</span><button class="btn sm ghost-light" data-cl="stop">${icon('x')}Stop</button></div>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    P = { root, code, facing: 'environment', pc: null, dc: null, raf: 0, sent: 0, wake: null };
    root.addEventListener('click', onCamClick);
  }
  function camStatus(t, live) { if (!P) return; const s = P.root.querySelector('[data-cl-status]'); if (s) s.textContent = t; P.root.querySelector('.cl-dot').classList.toggle('live', !!live); }

  async function onCamClick(e) {
    const f = e.target.closest('[data-facing]');
    if (f) { P.facing = f.dataset.facing; P.root.querySelectorAll('[data-facing]').forEach(b => { b.classList.toggle('on', b === f); b.setAttribute('aria-pressed', b === f); }); return; }
    const b = e.target.closest('[data-cl]'); if (!b) return;
    const a = b.dataset.cl;
    if (a === 'cancel' || a === 'stop') { stopCam(); GF.go('dashboard'); return; }
    if (a === 'start') { b.disabled = true; startCam().catch(err => { GF.crash(err, 'phone cam'); camStatus('Couldn’t start: ' + (err.message || err)); b.disabled = false; }); }
  }

  async function startCam() {
    const video = P.root.querySelector('video');
    await GF.pose.start(video, { userAction: true, facing: P.facing });
    P.root.querySelector('[data-card]').hidden = true; P.root.querySelector('.cl-top').hidden = false;
    camStatus('Loading the pose AI on this phone…');
    try { if ('wakeLock' in navigator) P.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }
    await GF.pose.load();
    camStatus('Creating your private code…');
    const offer = await unpack(P.code);
    const pc = P.pc = new RTCPeerConnection(RTC_CFG);
    pc.ondatachannel = ev => {
      const dc = P.dc = ev.channel;
      dc.onopen = () => { camStatus('Connected · sending body points only', true); hideAnswer(); dc.send(JSON.stringify({ type: 'hello', name: /iPhone|Android/i.exec(navigator.userAgent) ? RegExp.lastMatch : 'Phone', facing: P.facing })); };
      dc.onclose = () => { camStatus('Disconnected — tap Stop and scan again'); };
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') camStatus('Couldn’t connect. Are both on the same Wi-Fi? Try your phone’s hotspot.'); };
    await pc.setRemoteDescription({ type: 'offer', sdp: offer.s });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    const ans = PREFIX_A + await pack({ v: 1, s: slim(pc.localDescription.sdp) });
    P.answer = ans;
    showAnswer(ans);
    camStatus('Show this code to your computer’s webcam');
    loopCam();
  }
  function showAnswer(ans) {
    const d = document.createElement('div'); d.className = 'cl-answer'; d.setAttribute('data-answer', '');
    d.innerHTML = `<div class="cl-qr">${qrSvg(ans, 320)}</div><p><b>Hold this screen up to your computer’s webcam.</b><br>Turn your brightness up if it doesn’t connect.</p>
      <details><summary>Copy the code instead</summary><textarea readonly rows="3" aria-label="Phone code">${esc(ans)}</textarea></details>`;
    P.root.appendChild(d);
  }
  function hideAnswer() { const d = P && P.root.querySelector('[data-answer]'); if (d) d.remove(); }

  function loopCam() {
    if (!P) return;
    P.raf = requestAnimationFrame(loopCam);
    try {
      const video = P.root.querySelector('video'), cv = P.root.querySelector('canvas');
      if (!GF.pose.landmarker || video.readyState < 2) return;
      const now = performance.now();
      if (now - (P.last || 0) < 50) return;   // ~20 fps is plenty
      P.last = now;
      const lms = GF.pose.detect(video);
      // preview skeleton on the phone
      const W = video.videoWidth, H = video.videoHeight;
      if (cv.width !== W) { cv.width = W; cv.height = H; }
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H);
      if (lms) {
        ctx.strokeStyle = '#5eead4'; ctx.lineWidth = Math.max(3, H * 0.008); ctx.lineCap = 'round';
        for (const [a, b] of [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]]) {
          const p = lms[a], q = lms[b]; if ((p.visibility || 0) < 0.5 || (q.visibility || 0) < 0.5) continue;
          ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(q.x * W, q.y * H); ctx.stroke();
        }
      }
      if (P.dc && P.dc.readyState === 'open' && P.dc.bufferedAmount < 64000) {
        const l = lms ? lms.flatMap(p => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.visibility || 0).toFixed(2)]) : null;
        P.dc.send(JSON.stringify({ type: 'pose', l, w: W, h: H }));
        P.sent++;
      }
    } catch (err) { GF.crash(err, 'phone loop'); }
  }
  function stopCam() {
    if (!P) return;
    cancelAnimationFrame(P.raf);
    try { P.dc && P.dc.close(); P.pc && P.pc.close(); } catch (e) { /* ignore */ }
    try { P.wake && P.wake.release(); } catch (e) { /* ignore */ }
    GF.pose.stop('phone');
    P.root.remove(); document.body.style.overflow = '';
    P = null;
  }

  GF.link = { host, pairDialog, camPage, stopCam, qrSvg, pack, unpack, publicBase, loadJsQR, _cam: () => P, PREFIX_A };
})(window.GF = window.GF || {});
