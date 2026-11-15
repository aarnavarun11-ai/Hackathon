/* GhostFit – AI Coach chat (text + voice). Answers come from the on-device coach engine. */
(function (GF) {
  'use strict';
  const { esc, icon, uid, fmtDate, toast } = GF.u;
  GF.views = GF.views || {};
  const SUGGEST = ['How do I improve my squat?', 'What muscles do lunges work?', 'Why am I struggling with push-ups?', 'Create a 30-minute upper-body workout', 'What can replace burpees?', 'How long should I rest between sets?'];
  let activeId = null, readAloud = false;

  function blocksHtml(r, mi) {
    return r.blocks.map(b => {
      if (b.t === 'p') return `<p>${esc(b.text)}</p>`;
      if (b.t === 'h') return `<h4>${esc(b.text)}</h4>`;
      if (b.t === 'ol') return `<ol>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`;
      if (b.t === 'ul') return `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
      if (b.t === 'workout') {
        const w = b.workout;
        const items = GF.wk.allExerciseItems(w).map(it => { const e = GF.lib.get(it.exId); return `<li>${esc(e.name)} — ${it.sets && !w.blocks[1].items.some(g => g.kind === 'group' && g.items.includes(it)) ? it.sets + ' × ' : ''}${it.mode === 'time' ? it.duration + ' s' : it.reps + ' reps'}${e.track ? ' <span class="faint small">· camera-checked</span>' : ''}</li>`; }).join('');
        const g = w.blocks[1].items.find(x => x.kind === 'group');
        return `<div class="workout-card"><strong>${esc(w.name)}</strong>${g ? `<div class="small muted">${g.type === 'circuit' ? 'Circuit' : 'Superset'} × ${g.rounds} rounds</div>` : ''}<ol>${items}</ol>
          <div class="row"><button class="btn sm primary" data-save="${mi}">Save to my workouts</button><button class="btn sm" data-start="${mi}">${icon('play')}Start now</button></div></div>`;
      }
      return '';
    }).join('') + (r.chips && r.chips.length ? `<div class="row">${r.chips.map(id => GF.lib.get(id) ? `<button class="chip" data-ex="${id}">${esc(GF.lib.get(id).name)}</button>` : '').join('')}</div>` : '')
      + (r.exId && GF.lib.demoOf(GF.lib.get(r.exId)) ? `<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-ex="${r.exId}">${icon('cube')}See the 3D demo</button></div>` : '');
  }

  function render(root) {
    const chats = GF.store.chats();
    let chat = chats.find(c => c.id === activeId) || null;
    const s = GF.store.settings;
    const ctxOn = s.shareContextWithCoach;

    root.innerHTML = `
      <header class="page-head coach-head"><div class="row" style="gap:14px;flex-wrap:nowrap">${GF.art.ghost(64)}<div><h1>AI Coach</h1><p>Ask anything. Runs on this device.</p></div></div>
        <div class="row"><label class="switch small"><input type="checkbox" data-read ${readAloud ? 'checked' : ''}> Read replies aloud</label><button class="btn" data-new>${icon('plus')}New conversation</button></div></header>
      <div class="chat">
        <aside class="chat-side" aria-label="Conversations">
          <div class="eyebrow" style="margin-bottom:8px">History</div>
          ${chats.length ? `<ul class="list">${chats.slice().reverse().map(c => `<li data-open="${c.id}" ${chat && c.id === chat.id ? 'aria-current="true"' : ''} tabindex="0" role="button">${esc(c.title || 'Conversation')}<div class="tiny faint">${fmtDate(c.updatedAt)}</div></li>`).join('')}</ul>` : '<p class="small faint">No saved conversations.</p>'}
          <p class="tiny faint" style="margin-top:16px">${s.privacyMode || !s.keepChats ? 'Conversation history is not being saved.' : 'Saved on this device. Delete in Settings → Data.'}</p>
        </aside>
        <section class="chat-main" aria-label="Conversation">
          <div class="msgs" data-msgs aria-live="polite"></div>
          <div class="small faint" style="margin-top:8px">${ctxOn ? (GF.coachContext ? `${icon('info')} Using context from your last set (${esc(GF.lib.get(GF.coachContext.exId).name)}). Turn off in Settings.` : 'Workout context will be used after you complete a set. Turn off in Settings.') : 'Workout context is off.'}</div>
          <form class="composer" data-form>
            <label class="sr-only" for="chat-in">Message</label>
            <textarea id="chat-in" rows="1" placeholder="Ask your coach…" maxlength="500"></textarea>
            <button type="button" class="btn" data-mic aria-label="Speak your question" ${GF.listen.supported ? '' : 'disabled title="Voice input is not supported in this browser"'}>${icon('mic')}</button>
            <button type="submit" class="btn primary" aria-label="Send">${icon('send')}</button>
          </form>
          <div class="mic-state small" data-micstate></div>
        </section>
      </div>`;

    const msgsEl = root.querySelector('[data-msgs]'), input = root.querySelector('textarea');
    function draw() {
      if (!chat || !chat.messages.length) {
        msgsEl.innerHTML = `<div class="msg coach"><div class="who">${GF.art.ghost(26)} Coach</div><p>Hi. I can explain exercises, suggest alternatives, and build workouts around your equipment and level. What would you like to work on?</p>
          <div class="suggest">${SUGGEST.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
        return;
      }
      msgsEl.innerHTML = chat.messages.map((m, i) => m.role === 'user'
        ? `<div class="msg user">${esc(m.text)}<div class="t">${new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>`
        : `<div class="msg coach"><div class="who">${GF.art.ghost(26)} Coach <span class="t">${new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><button class="btn sm ghost" data-listen="${i}" aria-label="Listen to this answer">${icon('vol')}Listen</button></div>${blocksHtml(m.r, i)}${m.r.safety ? '' : ''}</div>`).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    function send(text, spoken) {
      text = text.trim(); if (!text) return;
      if (!chat) { chat = { id: uid('c'), title: text.slice(0, 48), messages: [], updatedAt: Date.now() }; activeId = chat.id; }
      chat.messages.push({ role: 'user', text, at: Date.now() });
      const ctx = GF.store.settings.shareContextWithCoach ? GF.coachContext : null;
      let r;
      try { r = GF.coach.respond(text, ctx); } catch (err) { console.error(err); r = { blocks: [{ t: 'p', text: 'Sorry — something went wrong answering that. Please try rephrasing.' }], speak: 'Sorry, something went wrong.' }; }
      chat.messages.push({ role: 'coach', r, at: Date.now() });
      chat.updatedAt = Date.now();
      if (!GF.store.settings.privacyMode && GF.store.settings.keepChats) GF.store.saveChat(chat); else { const arr = GF.store.chats(); if (!arr.includes(chat)) {/* session only */} }
      input.value = '';
      draw();
      const side = root.querySelector('.chat-side .list') || null;
      if (!side && GF.store.chats().includes(chat)) { const host = root.querySelector('.chat-side'); host.querySelector('p.small') && host.querySelector('p.small').remove(); host.insertAdjacentHTML('beforeend', `<ul class="list"><li data-open="${chat.id}" aria-current="true" tabindex="0" role="button">${esc(chat.title)}<div class="tiny faint">${fmtDate(chat.updatedAt)}</div></li></ul>`); }
      if (readAloud || spoken || r.safety) GF.speech.say(r.speak, 3);
    }
    root.querySelector('[data-form]').addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
    const micEl = root.querySelector('[data-micstate]');
    const unsub = GF.u.bus.on('mic', ev => { micEl.innerHTML = ev.state === 'off' ? '' : `<span class="dot ${ev.state === 'listening' ? 'live' : ev.state === 'error' || ev.state === 'denied' ? 'bad' : ''}"></span> ${GF.micLabel(ev.state)}${ev.error ? ' — ' + esc(ev.error) : ''}${ev.state === 'denied' ? ' — allow the microphone in site settings' : ''}`; });
    root.addEventListener('click', async e => {
      const q = e.target.closest('[data-q]'); if (q) send(q.dataset.q);
      if (e.target.closest('[data-new]')) { chat = null; activeId = null; GF.rerender(); }
      const o = e.target.closest('[data-open]'); if (o) { activeId = o.dataset.open; GF.rerender(); }
      const ex = e.target.closest('[data-ex]'); if (ex) GF.ui.exerciseDetail(ex.dataset.ex);
      const l = e.target.closest('[data-listen]'); if (l) GF.speech.say(chat.messages[+l.dataset.listen].r.speak || '', 3);
      const sv = e.target.closest('[data-save]');
      if (sv) { const w = Object.assign({}, chat.messages[+sv.dataset.save].r.workout); delete w.generated; const saved = GF.store.saveWorkout(GF.wk.duplicate(w, w.name), 'Created by coach'); toast('Saved to My workouts'); GF.go('builder/' + saved.id); }
      const st = e.target.closest('[data-start]'); if (st) { GF._pendingWorkout = chat.messages[+st.dataset.start].r.workout; GF.go('workout/__coach'); }
      const mic = e.target.closest('[data-mic]');
      if (mic) {
        if (GF.listen.state === 'listening') { GF.listen.stopDictation(); return; }
        mic.innerHTML = icon('micOff'); mic.setAttribute('aria-label', 'Stop listening');
        const text = await GF.listen.dictate(t => { input.value = t; });
        mic.innerHTML = icon('mic'); mic.setAttribute('aria-label', 'Speak your question');
        if (text) send(text, true);
      }
    });
    root.addEventListener('keydown', e => { const o = e.target.closest('[data-open]'); if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activeId = o.dataset.open; GF.rerender(); } });
    root.addEventListener('change', e => { if (e.target.matches('[data-read]')) readAloud = e.target.checked; });
    draw();
    return () => { unsub(); GF.listen.stopDictation(); };
  }
  GF.views.coach = { render };
})(window.GF = window.GF || {});
