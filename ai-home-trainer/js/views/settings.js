/* GhostFit – Settings & privacy center */
(function (GF) {
  'use strict';
  const { esc, icon, toast, confirmDialog, download, modal } = GF.u;
  GF.views = GF.views || {};

  function render(root, params) {
    const s = GF.store.settings;
    const voices = GF.speech.voices();
    const sw = (key, label, help, extra = '') => `<div class="set-row"><div class="lbl">${label}${help ? `<small>${help}</small>` : ''}</div><label class="switch"><input type="checkbox" data-k="${key}" ${s[key] ? 'checked' : ''} ${extra}><span class="sr-only">${label}</span></label></div>`;
    const seg = (key, opts, label, help) => `<div class="set-row"><div class="lbl">${label}${help ? `<small>${help}</small>` : ''}</div><div class="seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button data-seg="${key}" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}">${t}</button>`).join('')}</div></div>`;
    const usage = GF.store.usage();

    root.innerHTML = `
      <header class="page-head"><div><h1>Settings</h1><p>Everything is stored on this device. No account is needed.</p></div></header>

      <section class="set-section" aria-labelledby="s-profile"><div><h2 id="s-profile">Training profile</h2><p>Used for recommendations and coach-built workouts.</p></div><div>
        ${seg('level', [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], 'Experience level')}
        <div class="set-row"><div class="lbl">Goals</div><div class="row">${[['general', 'General'], ['strength', 'Strength'], ['endurance', 'Endurance'], ['mobility', 'Mobility'], ['flexibility', 'Flexibility']].map(([k, v]) => `<button class="chip" data-goal="${k}" aria-pressed="${s.goals.includes(k)}">${v}</button>`).join('')}</div></div>
        <div class="set-row"><div class="lbl">Equipment you have<small>Chair, wall and mat are always assumed.</small></div><div class="row">${[['dumbbells', 'Dumbbells'], ['band', 'Band'], ['bench', 'Bench'], ['barbell', 'Barbell & rack'], ['bar', 'Pull-up bar'], ['machine', 'Gym machines']].map(([k, v]) => `<button class="chip" data-eq="${k}" aria-pressed="${s.equipment.includes(k)}">${v}</button>`).join('')}</div></div>
        <div class="set-row"><div class="lbl">Weekly workout goal</div><input type="number" min="1" max="7" value="${s.weeklyGoal}" data-num="weeklyGoal" aria-label="Weekly workout goal"></div>
        <div class="set-row"><div class="lbl">Default workout length (minutes)</div><input type="number" min="10" max="90" step="5" value="${s.defaultDuration}" data-num="defaultDuration" aria-label="Default workout length"></div>
        ${seg('units', [['kg', 'kg'], ['lb', 'lb']], 'Weight units')}
      </div></section>

      <section class="set-section" aria-labelledby="s-voice"><div><h2 id="s-voice">Voice coaching</h2><p>Spoken guidance uses your device's built-in voices.</p></div><div>
        ${sw('voiceOn', 'Spoken coaching', 'The coach talks you through each set.')}
        <div class="set-row"><div class="lbl">Voice</div><select data-sel="voiceURI" aria-label="Voice" style="max-width:280px"><option value="">Automatic (calm English voice)</option>${voices.map(v => `<option value="${esc(v.voiceURI)}" ${s.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></div>
        <div class="set-row"><div class="lbl">Speaking speed <small>${s.voiceRate.toFixed(2)}×</small></div><input type="range" min="0.7" max="1.3" step="0.05" value="${s.voiceRate}" data-range="voiceRate" aria-label="Speaking speed" style="max-width:260px"></div>
        <div class="set-row"><div class="lbl">Volume</div><input type="range" min="0.2" max="1" step="0.1" value="${s.voiceVolume}" data-range="voiceVolume" aria-label="Voice volume" style="max-width:260px"></div>
        <div class="set-row"><div class="lbl"></div><button class="btn sm" data-test-voice>${icon('vol')}Test voice</button></div>
        ${seg('coaching', [['minimal', 'Minimal'], ['balanced', 'Balanced'], ['detailed', 'Detailed']], 'Coaching style', 'Minimal: only essentials and corrections. Balanced: counts and key cues. Detailed: full instructions and why each correction matters.')}
        ${seg('encouragement', [['off', 'Off'], ['gentle', 'Gentle'], ['standard', 'Standard']], 'Encouragement')}
        ${sw('captions', 'Captions', 'Show spoken instructions as text during workouts.')}
      </div></section>

      <section class="set-section" aria-labelledby="s-cam"><div><h2 id="s-cam">Camera</h2><p>Only turned on when you press “Turn on camera” in a workout. Video is processed on this device and never recorded or uploaded.</p></div><div>
        <div class="set-row"><div class="lbl">Browser permission<small data-camperm>Checking…</small></div><button class="btn sm" data-cam-test>${icon('cam')}Test camera</button></div>
        <div class="set-row"><div class="lbl">Preferred camera<small>Camera names appear after you allow camera access once.</small></div><select data-sel="cameraId" data-camlist aria-label="Preferred camera" style="max-width:280px"><option value="">Default camera</option></select></div>
        ${sw('showSkeleton', 'Show tracked skeleton', 'Draws the joints the AI sees over your video.')}
        <p class="small faint">To revoke camera access completely, use the camera icon in your browser's address bar or its site settings.</p>
      </div></section>

      <section class="set-section" aria-labelledby="s-mic"><div><h2 id="s-mic">Microphone &amp; voice input</h2><p>Optional. Used for voice commands and speaking to the coach.</p></div><div>
        <div class="set-row"><div class="lbl">Support<small>${GF.listen.supported ? 'Your browser supports speech recognition.' : 'Speech recognition is not available in this browser (try Chrome or Edge). Everything else works without it.'}</small></div></div>
        <div class="set-row"><div class="lbl">Browser permission<small data-micperm>Checking…</small></div></div>
        <div class="set-row"><div class="lbl">Cloud speech consent<small>${s.speechInputConsent ? 'You allowed browser speech recognition. In Chrome/Edge this sends audio to Google/Microsoft for transcription while the mic is on.' : 'Not given. You will be asked before the microphone is ever used.'}</small></div>${s.speechInputConsent ? '<button class="btn sm" data-revoke-speech>Withdraw consent</button>' : ''}</div>
      </div></section>

      <section class="set-section" aria-labelledby="s-a11y"><div><h2 id="s-a11y">Accessibility</h2><p>All features work with a keyboard. Important information is always shown as text as well as colour.</p></div><div>
        ${seg('theme', [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], 'Appearance')}
        ${seg('reducedMotion', [['system', 'Follow system'], ['on', 'Reduce motion']], 'Motion')}
        ${sw('largeText', 'Larger text', '')}
        ${sw('highContrast', 'Higher contrast', '')}
      </div></section>

      <section class="set-section" id="privacy" aria-labelledby="s-priv"><div><h2 id="s-priv">Privacy</h2><p>What runs where, and what is kept.</p></div><div>
        ${sw('privacyMode', 'Privacy Mode', 'Keeps processing local and minimises what is stored: no chat history, no saved movement data, voice input off unless you allow it per session.')}
        ${sw('keepHistory', 'Keep workout history', 'Needed for Progress and recommendations.')}
        ${sw('keepChats', 'Keep coach conversations', s.privacyMode ? 'Off while Privacy Mode is on.' : '', s.privacyMode ? 'disabled' : '')}
        ${sw('keepMovement', 'Keep movement data for review', 'Saves the skeleton landmarks of recent sets (never video) so you can review them later. ' + (s.privacyMode ? 'Off while Privacy Mode is on.' : ''), s.privacyMode ? 'disabled' : '')}
        ${sw('shareContextWithCoach', 'Let the coach use my workout context', 'Your last set (exercise, counts, flagged issues) is used to personalise answers. Stays on this device.')}
        <table class="tbl privacy-table" style="margin-top:12px"><thead><tr><th>Feature</th><th>Where it runs</th><th>What leaves this device</th></tr></thead><tbody>
          <tr><td>Pose estimation (camera)</td><td>On this device</td><td>Nothing. The AI model is downloaded once from Google's CDN (cdn.jsdelivr.net, storage.googleapis.com); no video or images are sent.</td></tr>
          <tr><td>3D demonstrations</td><td>On this device</td><td>Nothing (3D engine is bundled).</td></tr>
          <tr><td>Spoken coaching</td><td>Your device's voices</td><td>Nothing. (Some “online” voices in Edge/Chrome are processed by Microsoft/Google — choose a local voice to avoid this.)</td></tr>
          <tr><td>Voice commands &amp; dictation</td><td>Browser speech service</td><td>${GF.listen.supported ? 'Audio is sent to Google (Chrome) or Microsoft (Edge) while the mic is on. Opt-in only.' : 'Not available in this browser.'}</td></tr>
          <tr><td>AI Coach chat</td><td>On this device</td><td>Nothing. Answers come from GhostFit's built-in exercise knowledge.</td></tr>
          <tr><td>Workouts, history, settings</td><td>This browser's storage</td><td>Nothing. There is no account, analytics or sync.</td></tr>
        </tbody></table>
      </div></section>

      <section class="set-section" aria-labelledby="s-data"><div><h2 id="s-data">Your data</h2><p>Using ${(usage / 1024).toFixed(1)} KB of browser storage.</p></div><div>
        <div class="set-row"><div class="lbl">Export everything<small>A JSON file with all workouts, history, settings and conversations.</small></div><button class="btn sm" data-export>${icon('download')}Export</button></div>
        <div class="set-row"><div class="lbl">Workout history<small>${GF.store.history().length} sessions</small></div><button class="btn sm danger" data-clear="history">Delete</button></div>
        <div class="set-row"><div class="lbl">Coach conversations<small>${GF.store.chats().length} saved</small></div><button class="btn sm danger" data-clear="chats">Delete</button></div>
        <div class="set-row"><div class="lbl">Movement data<small>${GF.store.replays().length} saved set reviews (skeleton only)</small></div><button class="btn sm danger" data-clear="replays">Delete</button></div>
        <div class="set-row"><div class="lbl">My workouts<small>${GF.store.workouts().length} workouts</small></div><button class="btn sm danger" data-clear="workouts">Delete</button></div>
        <div class="set-row"><div class="lbl"><strong>About</strong><small>GhostFit v6 · everything runs and is stored on this device</small></div></div>
        <div class="set-row"><div class="lbl"><strong>Delete all GhostFit data</strong><small>Resets the app on this device.</small></div><button class="btn danger" data-clear="all">Delete everything</button></div>
        <p class="small faint">Video and audio recordings: GhostFit does not record either, so there is nothing to delete.</p>
      </div></section>`;

    // permission + device status (never triggers a prompt)
    GF.pose.permission().then(p => { const el = root.querySelector('[data-camperm]'); if (el) el.textContent = { granted: 'Allowed — the camera still only turns on when you press the button.', denied: 'Blocked in browser settings.', prompt: 'Not yet requested. You will be asked when you first turn the camera on.' }[p] || 'Unknown in this browser.'; });
    GF.listen.permission().then(p => { const el = root.querySelector('[data-micperm]'); if (el) el.textContent = { granted: 'Allowed.', denied: 'Blocked in browser settings.', prompt: 'Not yet requested.' }[p] || 'Unknown in this browser.'; });
    GF.pose.devices().then(list => { const sel = root.querySelector('[data-camlist]'); if (!sel) return; list.forEach(d => { if (!d.id) return; const o = document.createElement('option'); o.value = d.id; o.textContent = d.label; if (d.id === s.cameraId) o.selected = true; sel.appendChild(o); }); }).catch(() => {});
    if (params[0] === 'privacy') setTimeout(() => { const el = root.querySelector('#privacy'); if (el) el.scrollIntoView(); }, 30);

    root.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.k) {
        GF.store.setSetting(t.dataset.k, t.checked);
        if (t.dataset.k === 'privacyMode' && t.checked) { GF.listen.disable(); toast('Privacy Mode on'); }
        if (['privacyMode'].includes(t.dataset.k)) GF.rerender();
      }
      if (t.dataset.sel) GF.store.setSetting(t.dataset.sel, t.value);
      if (t.dataset.num) GF.store.setSetting(t.dataset.num, Math.max(+t.min, Math.min(+t.max, +t.value || +t.min)));
      if (t.dataset.range) { GF.store.setSetting(t.dataset.range, +t.value); const sm = t.closest('.set-row').querySelector('small'); if (sm && t.dataset.range === 'voiceRate') sm.textContent = (+t.value).toFixed(2) + '×'; }
    });
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.seg) { GF.store.setSetting(b.dataset.seg, b.dataset.v); root.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach(x => x.setAttribute('aria-pressed', x === b)); }
      if (b.dataset.goal) { const g = b.dataset.goal; let goals = s.goals.includes(g) ? s.goals.filter(x => x !== g) : [...s.goals, g]; if (!goals.length) goals = ['general']; GF.store.setSetting('goals', goals); b.setAttribute('aria-pressed', goals.includes(g)); }
      if (b.dataset.eq) { const q = b.dataset.eq; const eq = s.equipment.includes(q) ? s.equipment.filter(x => x !== q) : [...s.equipment.filter(x => x !== 'none'), q]; GF.store.setSetting('equipment', eq); b.setAttribute('aria-pressed', eq.includes(q)); }
      if (b.hasAttribute('data-test-voice')) { const was = GF.store.settings.voiceOn; GF.store.settings.voiceOn = true; GF.speech.say('Nice work. Keep your breathing steady. Three more repetitions.', 3); GF.store.settings.voiceOn = was; }
      if (b.hasAttribute('data-revoke-speech')) { GF.store.setSetting('speechInputConsent', false); GF.listen.disable(); toast('Consent withdrawn. The microphone will not be used.'); GF.rerender(); }
      if (b.hasAttribute('data-export')) { download(`ghostfit-data-${new Date().toISOString().slice(0, 10)}.json`, GF.store.exportAll()); toast('Export downloaded'); }
      if (b.dataset.clear) {
        const what = b.dataset.clear;
        const label = { history: 'your workout history', chats: 'all coach conversations', replays: 'all saved movement data', workouts: 'all your custom workouts', all: 'ALL GhostFit data on this device' }[what];
        if (await confirmDialog('Delete data?', `This permanently deletes ${label}. This can’t be undone.`, 'Delete', true)) {
          GF.store.clear(what); if (what === 'all' || what === 'chats') GF.coachContext = null; toast('Deleted'); GF.rerender();
        }
      }
      if (b.hasAttribute('data-cam-test')) cameraTest();
    });
  }

  function cameraTest() {
    const body = document.createElement('div');
    body.innerHTML = `<p class="small muted">The preview is processed nowhere — it is just shown here. Close this window to turn the camera off.</p>
      <video playsinline muted style="width:100%;border-radius:8px;background:#000;transform:scaleX(-1)" aria-label="Camera preview"></video><p class="small" data-st>Starting camera…</p>`;
    const video = body.querySelector('video');
    modal({ title: 'Camera test', body, onClose: () => GF.pose.stop('test') });
    GF.pose.start(video, { deviceId: GF.store.settings.cameraId, userAction: true })
      .then(() => { body.querySelector('[data-st]').textContent = 'Camera is on. If you can see yourself, you are ready for camera tracking.'; GF.rerender(); })
      .catch(err => { body.querySelector('[data-st]').textContent = err.name === 'NotAllowedError' ? 'Permission was denied. Allow the camera in your browser’s site settings.' : (err.message || 'Could not start the camera.'); });
  }
  GF.views.settings = { render };
})(window.GF = window.GF || {});
