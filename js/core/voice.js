/* GhostFit – Voice: calm spoken coaching, captions, adaptive talkativeness, and voice commands.
   Speech OUTPUT uses the operating system's voices (on-device).
   Speech INPUT uses the browser's SpeechRecognition. In Chrome and Edge this service sends
   audio to Google / Microsoft to turn it into text, so it is opt-in, clearly indicated,
   and off by default in Privacy Mode. GhostFit never records or stores audio. */
(function (GF) {
  'use strict';
  const { bus, modal, esc } = GF.u;
  const S = () => GF.store.settings;

  /* =================== speech output =================== */
  const speech = {
    cur: 0, lastText: '', lastAt: 0, _voice: null, synth: window.speechSynthesis || null,
    get supported() { return !!this.synth; },
    voices() { return this.synth ? this.synth.getVoices() : []; },
    pick() {
      const vs = this.voices(); const want = S().voiceURI;
      if (want) { const v = vs.find(x => x.voiceURI === want); if (v) return v; }
      const en = vs.filter(v => /^en/i.test(v.lang));
      const pref = [/Aria|Jenny|Sonia|Libby|Natural/i, /Google UK English Female/i, /Samantha|Karen|Moira/i, /Google US English/i];
      for (const re of pref) { const v = en.find(x => re.test(x.name)); if (v) return v; }
      return en[0] || vs[0] || null;
    },
    /** priority: 1 counts, 2 coaching, 3 transitions/answers (higher interrupts lower) */
    say(text, priority = 2) {
      if (!text) return;
      bus.emit('caption', text);
      if (!S().voiceOn || !this.synth) return;
      const now = performance.now();
      if (text === this.lastText && now - this.lastAt < 2500) return;
      if (this.synth.speaking && priority < this.cur) return;
      this.lastText = text; this.lastAt = now;
      this.synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[—–]/g, ', '));
      const v = this.pick(); if (v) u.voice = v;
      u.rate = (S().voiceRate || 0.95) * (this.slow ? 0.85 : 1);
      u.volume = S().voiceVolume != null ? S().voiceVolume : 0.9;
      u.pitch = S().voicePitch || 1;
      this.cur = priority;
      this.recent = (this.recent || []).filter(r => now - r.at < 12000).concat({ text, at: now });
      this.busyUntil = now + 15000;
      u.onstart = () => bus.emit('speaking', true);
      u.onend = u.onerror = () => { this.cur = 0; this.endedAt = performance.now(); this.busyUntil = 0; bus.emit('speaking', false); };
      this.synth.speak(u);
    },
    stop() { if (this.synth) this.synth.cancel(); this.cur = 0; bus.emit('speaking', false); },
    get speaking() { return !!(this.synth && this.synth.speaking); },
    /** Was `heard` most likely our own voice coming back through the microphone? */
    isEcho(heard) {
      const now = performance.now();
      const talking = this.speaking || now < (this.busyUntil || 0) || now - (this.endedAt || -1e9) < 1800;
      const words = w => (w || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const h = words(heard); if (!h.length) return false;
      for (const r of (this.recent || [])) {
        if (now - r.at > 12000) continue;
        const said = new Set(words(r.text));
        const hit = h.filter(x => said.has(x)).length / h.length;
        // most of what we "heard" is something the coach just said
        if (hit >= 0.6 && talking) return true;
      }
      return false;
    },
  };
  if (speech.synth) speech.synth.onvoiceschanged = () => bus.emit('voices');

  /* =================== adaptive coaching voice ===================
     Decides WHAT to say based on coaching level (minimal / balanced / detailed)
     and encouragement setting, and rate-limits corrections so users aren't nagged. */
  const GENTLE = ['Nice work.', 'Good. Keep your breathing steady.', 'Steady and controlled.', "That's it.", 'Good rep.', 'Smooth.'];
  const STANDARD = ['Great work.', 'Strong rep.', 'Keep it up.', 'Looking good.', 'Well done.'];
  const coachVoice = {
    lastCorrection: -1e9, lastEncourage: -1e9, pick: 0,
    gap() { return { minimal: 12000, balanced: 6000, detailed: 4000 }[S().coaching] || 6000; },
    /** kind: 'transition' | 'count' | 'correction' | 'encourage' | 'cue' | 'answer' | 'safety' */
    line(kind, text, extra = {}) {
      const lvl = S().coaching, now = performance.now();
      if (kind === 'safety' || kind === 'answer') return speech.say(text, 3);
      if (kind === 'transition') return speech.say(lvl === 'minimal' && extra.short ? extra.short : text, 3);
      if (kind === 'count') {
        if (lvl === 'minimal' && !(extra.remaining != null && extra.remaining <= 2)) return;
        return speech.say(text, 1);
      }
      if (kind === 'correction') {
        if (now - this.lastCorrection < this.gap()) return;
        this.lastCorrection = now;
        return speech.say(lvl === 'detailed' && extra.why ? `${text}. ${extra.why}` : text, 2);
      }
      if (kind === 'cue') {
        if (lvl === 'minimal') return;
        return speech.say(text, 2);
      }
      if (kind === 'encourage') {
        if (S().encouragement === 'off' || lvl === 'minimal') return;
        if (now - this.lastEncourage < (lvl === 'detailed' ? 8000 : 15000)) return;
        this.lastEncourage = now;
        const list = S().encouragement === 'standard' ? STANDARD : GENTLE;
        return speech.say(list[(this.pick++) % list.length], 1);
      }
    },
    praiseText() { const list = S().encouragement === 'standard' ? STANDARD : GENTLE; return list[(this.pick++) % list.length]; },
  };

  /* =================== speech input / voice commands =================== */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const COMMANDS = [
    ['end', /\b(end|stop|quit|finish|exit)\b.*\b(workout|session|training)\b|\bend session\b|\bi'?m done for today\b/],
    ['pause', /\b(pause|hold on|wait|give me a (sec|second|minute)|stop for a)\b|^ stop $/],
    ['resume', /\b(resume|continue|carry on|unpause|keep going|i'?m ready|ready)\b/],
    ['start', /\b(start|begin|let'?s go|let'?s start|go)\b/],
    ['repeat', /\b(repeat|say (that|it) again|what was that|instructions?|how do i do (this|it))\b/],
    ['skip', /\bskip\b/],
    ['next', /\b(next( exercise)?|move on)\b/],
    ['addSet', /\b(add|another|one more|extra)\b.*\bset\b/],
    ['done', /\b(done|finished|complete(d)?|that'?s it)\b/],
    ['repsLeft', /\bhow many\b.*\b(reps?|repetitions?)\b|\b(reps?|repetitions?)\b.*\b(left|remaining|to go)\b/],
    ['restLeft', /\bhow (much|long)\b.*\b(rest|break|time)\b|\b(rest|time)\b.*\b(left|remaining)\b/],
    ['slow', /\bslow(er)?\b|\btoo fast\b/],
    ['form', /\b(explain|check|how('?s| is| was)|how am i)\b.*\b(form|technique|doing)\b|\bmy form\b/],
    ['mute', /\b(mute|be quiet|stop talking|silence)\b/],
    ['unmute', /\b(unmute|talk again|speak again)\b/],
  ];
  function parse(text) {
    const t = ' ' + String(text).toLowerCase().replace(/[^a-z' ]/g, ' ') + ' ';
    for (const [cmd, re] of COMMANDS) if (re.test(t)) return cmd;
    return null;
  }

  const listen = {
    supported: !!SR, state: 'off', interim: '', rec: null, wanted: false, sessionAllowed: false, onCommand: null,
    set(state, extra) { this.state = state; bus.emit('mic', Object.assign({ state }, extra || {})); },

    /** Explain the cloud speech service and get explicit consent before the mic is ever used. */
    consent() {
      if (!this.supported) return Promise.resolve(false);
      const privacy = S().privacyMode;
      if (S().speechInputConsent && (!privacy || this.sessionAllowed)) return Promise.resolve(true);
      return new Promise(res => modal({
        title: 'Turn on voice input?',
        body: `<p>Voice input uses your browser's built-in speech recognition. In Chrome and Edge this service <strong>sends your audio to Google or Microsoft</strong> to turn it into text while the microphone is on.</p>
          <ul class="plain"><li>The microphone is only on while the mic indicator shows <em>Listening</em>.</li><li>GhostFit never records, stores or uploads audio itself — it only receives the text.</li><li>You can turn it off at any time with the mic button or in Settings.</li></ul>
          ${privacy ? '<p class="note warn">Privacy Mode is on. Allowing this will use a cloud service for this session only.</p>' : ''}`,
        actions: [{ label: 'Not now', value: false }, { label: privacy ? 'Allow for this session' : 'Allow voice input', kind: 'primary', value: true }],
        onClose: v => {
          if (v) { if (privacy) this.sessionAllowed = true; else GF.store.setSetting('speechInputConsent', true); }
          res(!!v);
        },
      }));
    },

    /** Ask the browser for the microphone first: shows the real permission prompt and gives clear errors. */
    async micAccess() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); st.getTracks().forEach(t => t.stop()); return true; }
      catch (e) {
        const m = e.name === 'NotAllowedError' ? 'Microphone blocked. Click the icon on the left of the address bar → allow Microphone, then try again.'
          : e.name === 'NotFoundError' ? 'No microphone found. Plug one in or check Windows sound settings.'
          : e.name === 'NotReadableError' ? 'Your microphone is being used by another app (Zoom, Teams, Discord…). Close it and try again.'
          : 'Could not access the microphone (' + e.name + ').';
        this.set(e.name === 'NotAllowedError' ? 'denied' : 'error', { error: m }); GF.u.toast(m, 'error'); return false;
      }
    },
    explain(code) {
      const fileHint = location.protocol === 'file:' ? ' Voice input usually needs the app opened with “start-ghostfit.bat” (it opens http://localhost:8000) instead of double-clicking index.html.' : '';
      return ({
        'not-allowed': 'The browser blocked speech recognition.' + (fileHint || ' Allow the microphone in the address bar and try again.'),
        'service-not-allowed': 'This browser’s speech service is turned off or unavailable. Use Google Chrome or Microsoft Edge.' + fileHint,
        'network': 'The speech service couldn’t be reached. It needs internet (Chrome sends audio to Google). Some browsers like Brave block it — use Chrome or Edge.',
        'audio-capture': 'No microphone was found, or another app is using it.',
        'language-not-supported': 'Your language isn’t supported by the speech service — switching to English.',
      })[code] || ('Voice input stopped (' + code + ').' + fileHint);
    },

    /** Continuous command listening (active workout). */
    async enable(onCommand) {
      if (!this.supported) { this.set('unsupported', { error: 'This browser doesn’t support voice input. Use Google Chrome or Microsoft Edge.' }); GF.u.toast('Voice input needs Chrome or Edge', 'error'); return false; }
      if (!(await this.consent())) { this.set('off'); return false; }
      if (!(await this.micAccess())) return false;
      this.errors = [];
      this.onCommand = onCommand; this.wanted = true;
      this._start(true);
      return true;
    },
    disable() {
      this.wanted = false; this.onCommand = null;
      if (this.rec) { try { this.rec.onend = null; this.rec.abort(); } catch (e) { /* ignore */ } }
      this.rec = null; this.set('off');
    },
    _start(continuous) {
      const rec = new SR();
      rec.lang = this.lang || (/^en/i.test(navigator.language || '') ? navigator.language : 'en-US'); rec.continuous = continuous; rec.interimResults = true; rec.maxAlternatives = 3;
      this.rec = rec;
      this.set('starting');
      rec.onstart = () => this.set('listening');
      rec.onresult = e => {
        let interim = '', final = '';
        let alts = [];
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) { final += r[0].transcript; for (let k = 0; k < r.length; k++) alts.push(r[k].transcript); } else interim += r[0].transcript;
        }
        if (interim && !speech.isEcho(interim)) this.set('listening', { heard: interim });
        if (final) {
          const text = final.trim();
          // ignore our own voice being picked up by the microphone
          if (speech.isEcho(text)) { this.set('listening'); return; }
          this.set('processing', { heard: text });
          const cmd = parse(text) || alts.map(parse).find(Boolean) || null;
          if (cmd && speech.speaking) speech.stop(); // user interrupts the coach
          if (this.onCommand) this.onCommand(cmd, text);
          setTimeout(() => { if (this.wanted && this.state === 'processing') this.set('listening'); }, 600);
        }
      };
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;   // normal pauses
        if (e.error === 'language-not-supported' && rec.lang !== 'en-US') { this.lang = 'en-US'; return; }
        const fatal = ['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error);
        this.errors = (this.errors || []).filter(t => Date.now() - t < 15000).concat(Date.now());
        if (fatal || this.errors.length >= 3) {
          this.wanted = false;
          const m = this.explain(e.error);
          this.set(e.error === 'not-allowed' ? 'denied' : 'error', { error: m });
          GF.u.toast(m, 'error');
        }
      };
      rec.onend = () => {
        if (this.wanted) { setTimeout(() => { if (this.wanted) { try { this._start(true); } catch (err) { this.wanted = false; this.set('error', { error: 'Could not restart voice input.' }); } } }, 300); }
        else if (this.state !== 'denied' && this.state !== 'error') this.set('off');
      };
      try { rec.start(); } catch (e) { this.set('error', { error: 'Could not start voice input.' }); }
    },

    /** One-shot dictation (chat). Resolves with the text, or '' if nothing was heard. */
    async dictate(onInterim) {
      if (!this.supported) { this.set('unsupported', { error: 'This browser doesn’t support voice input. Use Google Chrome or Microsoft Edge.' }); GF.u.toast('Voice input needs Chrome or Edge', 'error'); return ''; }
      if (!(await this.consent())) return '';
      if (!(await this.micAccess())) return '';
      return new Promise(resolve => {
        const rec = new SR(); let text = '';
        rec.lang = this.lang || (/^en/i.test(navigator.language || '') ? navigator.language : 'en-US'); rec.interimResults = true; rec.continuous = false;
        this.rec = rec; this.set('listening');
        rec.onresult = e => {
          let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          text = t; if (onInterim) onInterim(t);
          this.set('listening', { heard: t });
        };
        rec.onerror = e => { if (e.error === 'no-speech' || e.error === 'aborted') return; const m = this.explain(e.error); this.set(e.error === 'not-allowed' ? 'denied' : 'error', { error: m }); GF.u.toast(m, 'error'); };
        rec.onend = () => { if (this.state === 'listening') this.set('off'); this.rec = null; resolve(text.trim()); };
        try { rec.start(); } catch (e) { this.set('error', { error: 'Could not start voice input.' }); resolve(''); }
      });
    },
    stopDictation() { if (this.rec) try { this.rec.stop(); } catch (e) { /* ignore */ } },

    async permission() { try { return (await navigator.permissions.query({ name: 'microphone' })).state; } catch (e) { return 'unknown'; } },
  };

  // mic must never stay on when the page goes away
  window.addEventListener('pagehide', () => listen.disable());

  /* small UI helper: mic state label */
  function micLabel(st) {
    return { off: 'Voice off', starting: 'Starting microphone…', listening: 'Listening — say “pause”, “next”, “done”…', processing: 'Heard you', denied: 'Microphone blocked', error: 'Voice problem', unsupported: 'Voice not supported in this browser' }[st] || st;
  }

  GF.speech = speech; GF.coachVoice = coachVoice; GF.listen = listen; GF.voiceParse = parse; GF.micLabel = micLabel;
  void esc;
})(window.GF = window.GF || {});
