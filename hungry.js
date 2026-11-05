/* "Ebi ń pa mí" — Daddy's dinner call. Plays once a day at the set time (default
   6 pm) so Mummy knows to start prepping before he gets home, and any time someone
   taps the button or says "ebi n pa mi". Tablet: chime + spoken call + prep card.
   Phone: the same message through ntfy (Settings → Send list to phone). */

const hungryCfg = () => db.home.hungry ||= {on:true, time:'18:00', speak:true, phone:true, last:'', useRec:true};

/* ---------- Daddy's own recorded call (song or voice) ----------
   Kept only on this tablet (IndexedDB), never uploaded. */
const CallRec = {
  dbp: null, url: '', has: false, rec: null, chunks: [], started: 0, timer: null, MAX: 60,
  open(){ return this.dbp ||= new Promise((res, rej) => { const r = indexedDB.open('fatade-sounds', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sounds'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async tx(mode, fn){ const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction('sounds', mode), q = fn(t.objectStore('sounds'));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); },
  async load(){
    try{ const b = await this.tx('readonly', s => s.get('dinnerCall')); if(this.url) URL.revokeObjectURL(this.url);
      this.has = !!b; this.url = b ? URL.createObjectURL(b) : ''; }catch(e){ this.has = false; }
  },
  async start(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false}});
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';
      this.rec = new MediaRecorder(stream, type ? {mimeType:type} : undefined); this.chunks = [];
      this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
      this.rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); clearInterval(this.timer);
        const blob = new Blob(this.chunks, {type: this.rec.mimeType || 'audio/webm'}); this.rec = null;
        if(blob.size > 1000){ await this.tx('readwrite', s => s.put(blob, 'dinnerCall')); await this.load(); hungryCfg().useRec = true; save(); toast('🎙️ Your dinner call is saved!'); }
        else toast('That recording was empty — try again.');
        if(view === 'settings') render();
      };
      this.rec.start(); this.started = Date.now();
      this.timer = setInterval(() => { const s = Math.floor((Date.now() - this.started) / 1000), el = $('#recTime');
        if(el) el.textContent = `0:${String(s).padStart(2, '0')} / 1:00`; if(s >= this.MAX) this.stop(); }, 250);
      if(view === 'settings') render();
    }catch(e){
      // Tablet apps before 1.3 (versionCode 4) can't hand the microphone to the page
      toast(NATIVE && appVersionCode() < 4 ? 'Recording needs the new tablet app — tap Install in the green bar.'
        : 'Microphone not available — allow it and try again.');
    }
  },
  stop(){ if(this.rec && this.rec.state !== 'inactive') this.rec.stop(); },
  // A song recorded elsewhere (e.g. Recording.m4a copied to the tablet's Download folder)
  async useFile(file){
    if(!file) return;
    if(!/^audio\//.test(file.type) && !/\.(m4a|mp3|aac|wav|ogg|opus|webm|amr|3gp)$/i.test(file.name)){ toast('Please choose a sound file.'); return; }
    if(file.size > 15 * 1024 * 1024){ toast('That file is too big — keep it under 15 MB (about 10 minutes).'); return; }
    const playable = await new Promise(res => { const a = new Audio(URL.createObjectURL(file));
      a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); setTimeout(() => res(-1), 5000); });
    if(playable === 0){ toast('The tablet can\'t play that file type — try an .m4a or .mp3.'); return; }
    await this.tx('readwrite', s => s.put(file, 'dinnerCall')); await this.load();
    hungryCfg().useRec = true; save();
    toast(`🎵 “${file.name}” is now your dinner call${playable > 0 ? ` (${Math.round(playable)} s)` : ''}.`);
    if(view === 'settings') render();
  },
  audio: null,
  play(){ return new Promise(res => { if(!this.url) return res(); this.stopPlay(); const a = this.audio = new Audio(this.url);
    a.onended = a.onerror = a.onpause = () => res(); a.play().catch(() => res()); }); },
  stopPlay(){ if(this.audio){ const a = this.audio; this.audio = null; a.pause(); } },
  async remove(){ await this.tx('readwrite', s => s.delete('dinnerCall')); await this.load(); },
};
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };

function hungryPlan(){
  const wk = weekKey(0), d = todayIdx(), m = id => { const x = getPick(wk, d, id); return x && x !== 'skip' ? mealById(x) : null; };
  const dinner = m('dinner'), late = m('meLate');
  const tWk = d === 6 ? weekKey(1) : wk, tD = (d + 1) % 7;
  const prep = [...new Set(slotsFor(tD).map(s => getPick(tWk, tD, s.id)).map(id => id && mealById(id)).filter(x => x && x.prep).map(x => x.prep))];
  return {dinner, late, prep};
}

// Short two-note chime, made in code (no sound file needed)
function chime(){
  try{
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[659.25, 0], [880, .22], [1046.5, .44]].forEach(([f, t]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0, ac.currentTime + t); g.gain.linearRampToValueAtTime(.25, ac.currentTime + t + .03);
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + t + .9);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 1);
    });
    setTimeout(() => ac.close(), 2500);
  }catch(e){}
}

async function hungryNow(source){
  const c = hungryCfg(), {dinner, late, prep} = hungryPlan(), me = db.names.me;
  const g = LLU.configured() ? shownGlucose() : null;              // what the tablet shows (guest mode aware)
  const realG = LLU.configured() ? glucoseState() : null;          // the phone message is private, so it gets the real one
  // Tablet card (screensaver gives way to it)
  if(typeof Saver !== 'undefined' && Saver.on) Saver.hide();
  if(view === 'settings') Lock.close();
  view = 'today'; render();
  $('#sheet').innerHTML = `<div class="grabber"></div>
    <div class="hungry">
      <div class="hg-emoji">🍲</div>
      <h2 class="hg-title">Ebi ń pa mí o!</h2>
      <div class="hg-sub">Ìyàwó, ${esc(me)} ń bọ̀ wálé — time to get his food ready.</div>
      <div class="card list hg-list">
        ${dinner ? `<div class="lrow"><span class="lic">${dinner.em}</span><span><small>Tonight's dinner · Oúnjẹ alẹ́</small><b>${esc(dinner.name)}</b>${dinner.tip ? `<small>💚 ${esc(dinner.tip)}</small>` : ''}</span></div>` : ''}
        ${late ? `<div class="lrow"><span class="lic">${late.em}</span><span><small>${esc(me)}'s late plate</small><b>${esc(late.name)}</b></span></div>` : ''}
        ${!dinner && !late ? `<div class="lrow"><span class="lic">🍽️</span><span><b>Nothing planned yet for tonight</b><small>Pick dinner in “This week”.</small></span></div>` : ''}
        ${g ? `<div class="lrow"><span class="lic">🩸</span><span><small>${esc(me)}'s sugar now</small><b>${Math.round(g.value)} mg/dL ${ARROWS[g.trend] || ''}</b></span></div>` : ''}
        ${prep.length ? `<div class="lrow"><span class="lic">🫙</span><span><small>Also for tomorrow</small><b>${esc(prep.join(' · '))}</b></span></div>` : ''}
      </div>
      <button class="btn hg-ok" id="hgOk">Ó dáa, I'm on it 👍</button>
      ${c.snooze ? `<button class="btn ghost hg-snooze" id="hgSnooze">😴 Snooze ${c.snooze} min</button>` : ''}
      <div class="hg-rule">${c.speak ? (c.repeat === 'repeat' ? `Keeps playing until someone taps “Ó dáa”${c.stopAfter ? ` · stops after ${c.stopAfter} min` : ''}.` : 'Plays once.') : ''}</div>
    </div>`;
  $('#sheet').classList.remove('tall');
  $('#scrim').classList.add('on');
  Alarm.start(c, {dinner, late, me});
  $('#hgOk').onclick = () => { Alarm.stop(); closePicker(); toast('👍 Ó dáa! Dinner is on its way.'); };
  const sz = $('#hgSnooze'); if(sz) sz.onclick = () => { Alarm.snooze(c.snooze); closePicker(); };
  if(c.phone && db.home.ntfy){
    const lines = [`${me} ń bọ̀ wálé — time to prep. 🍲`];
    if(dinner) lines.push(`Dinner: ${dinner.name}`);
    if(late) lines.push(`Late plate: ${late.name}`);
    if(realG) lines.push(`Sugar now: ${Math.round(realG.value)} mg/dL ${ARROWS[realG.trend] || ''}`);
    if(prep.length) lines.push(`For tomorrow: ${prep.join(' · ')}`);
    try{
      await fetch('https://ntfy.sh/', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({topic: db.home.ntfy, title: `Ebi ń pa ${me}! 🍲`, message: lines.join('\n'), priority: 4, tags: ['bell']})});
    }catch(e){}
  }
}

/* ---------- The ringing: once, or on repeat until someone taps "Ó dáa"; snooze; time limit ---------- */
const Alarm = {
  round: 0, started: 0, loop: null, snoozeT: null, active: false,   // active: card can't be dismissed by tapping outside
  start(c, info){
    this.stop(); if(!c.speak) return;
    this.active = true;
    this.started = Date.now(); this.info = info; this.cfg = c;
    this.ring(++this.round);
  },
  async ring(id){
    const c = this.cfg, {dinner, late, me} = this.info;
    if(id !== this.round) return;
    if(!$('#hgOk')) return this.stop();                                   // never ring without a stop button on screen
    if(c.stopAfter && Date.now() - this.started > c.stopAfter * 60000){ this.stop(); closePicker(); return; }
    if(document.hidden){ this.loop = setTimeout(() => this.ring(id), 5000); return; }   // app not on screen: stay quiet
    const menu = (dinner ? `Tonight's dinner is ${dinner.name}. ` : '') + (late ? `His late plate is ${late.name}.` : '');
    const say = t => new Promise(res => { if(!t || document.hidden || typeof voice === 'undefined' || voice.active) return res(); voice.speak(t, res); setTimeout(res, 30000); });
    if(c.useRec && CallRec.has){ await CallRec.play(); if(id !== this.round) return; await say(menu); }   // Daddy's own song first
    else { chime(); await new Promise(r => setTimeout(r, 1400)); if(id !== this.round) return; await say(`Ebi ń pa mí o! Ìyàwó, ${me} ń bọ̀ wálé. ` + menu); }
    if(id !== this.round) return;
    if(c.repeat !== 'repeat'){ this.active = false; return; }             // played once: the card can now be dismissed
    this.loop = setTimeout(() => { if(id === this.round) this.ring(id); }, (c.gap || 30) * 1000);
  },
  silence(){ this.round++; this.active = false; clearTimeout(this.loop); CallRec.stopPlay(); if(NATIVE) NATIVE.stopVoice(); else window.speechSynthesis?.cancel(); },
  stop(){ this.silence(); clearTimeout(this.snoozeT); this.snoozeT = null; },
  snooze(min){
    this.silence(); clearTimeout(this.snoozeT);
    this.snoozeT = setTimeout(() => { this.snoozeT = null; hungryNow('snooze'); }, min * 60000);
    toast(`😴 Snoozed — it will ring again in ${min} minutes.`);
  },
};

// Once a day at the set time; if the tablet was asleep, it still plays when it wakes (until 9 pm)
function hungryCheck(){
  const c = hungryCfg(); if(!c.on || c.last === todayStr()) return;
  const [h, m] = c.time.split(':').map(Number), now = new Date();
  const at = new Date(now); at.setHours(h, m, 0, 0);
  if(now >= at && now.getHours() < 21){ c.last = todayStr(); save(); hungryNow('schedule'); }
}

function hungryButtonHtml(){
  return `<button class="hungry-btn" id="hungryBtn"><span>🍲</span><span><b>Ebi ń pa mí</b><small>Tell ${esc(db.names.wife)} ${esc(db.names.me)} is hungry</small></span></button>`;
}
function hungrySettingsHtml(){
  const c = hungryCfg();
  return `<h2 class="sec">Dinner call <span class="yo-h">Ebi ń pa mí</span></h2>
    <div class="card list">
      <div class="lrow"><span class="lic">⏰</span><span style="flex:1"><b>Every day at</b><small>Plays once a day so ${esc(db.names.wife)} can prep before ${esc(db.names.me)} gets home.</small></span>
        <input type="time" id="hgTime" value="${c.time}" class="timein"></div>
      <div class="lrow rec-row"><span class="lic">🎙️</span><span style="flex:1"><b>Your own dinner call</b>
          <small>${CallRec.rec ? 'Recording… sing or speak now!' : CallRec.has ? 'Your recording plays first, then the tablet reads tonight\'s menu.' : 'Record here, or choose a song you recorded on your phone or computer (copy it to the tablet first). It stays on this tablet.'}</small></span>
        ${CallRec.rec ? `<span class="rec-dot"></span><span id="recTime" class="rec-time">0:00 / 1:00</span><button class="btn warn" id="recStop">■ Stop</button>`
          : `${CallRec.has ? `<button class="btn tinted" id="recPlay">▶ Play</button>` : ''}
             <label class="btn tinted filebtn">📁 Use a sound file<input type="file" id="recFile" accept="audio/*" hidden></label>
             <button class="btn ${CallRec.has ? 'ghost' : ''}" id="recStart">● ${CallRec.has ? 'Record again' : 'Record'}</button>
             ${CallRec.has ? `<button class="iconbtn" id="recDel" title="Delete recording">✕</button>` : ''}`}</div>
      ${CallRec.has ? `<div class="lrow"><div class="chips"><button class="chip ${c.useRec?'on':''}" id="hgUseRec">🎵 Use my recording</button></div></div>` : ''}
      <div class="lrow ring-opts"><span class="lic">🔁</span><div style="flex:1">
        <b>When it rings</b>
        <div class="optrow"><span>Play</span><div class="seg">${[['once','Once'],['repeat','On repeat until “Ó dáa”']].map(([v,t]) => `<button class="${c.repeat===v?'on':''}" data-hg="repeat" data-v="${v}">${t}</button>`).join('')}</div></div>
        ${c.repeat === 'repeat' ? `<div class="optrow"><span>Pause between</span><div class="seg">${[[10,'10 s'],[30,'30 s'],[60,'1 min'],[120,'2 min']].map(([v,t]) => `<button class="${c.gap===v?'on':''}" data-hg="gap" data-v="${v}">${t}</button>`).join('')}</div></div>
        <div class="optrow"><span>Stop after</span><div class="seg">${[[5,'5 min'],[10,'10 min'],[15,'15 min'],[30,'30 min'],[0,'Never']].map(([v,t]) => `<button class="${c.stopAfter===v?'on':''}" data-hg="stopAfter" data-v="${v}">${t}</button>`).join('')}</div></div>` : ''}
        <div class="optrow"><span>Snooze button</span><div class="seg">${[[0,'Off'],[5,'5 min'],[10,'10 min'],[15,'15 min']].map(([v,t]) => `<button class="${c.snooze===v?'on':''}" data-hg="snooze" data-v="${v}">${t}</button>`).join('')}</div></div>
      </div></div>
      <div class="lrow"><div class="chips">
        <button class="chip ${c.on?'on':''}" id="hgOn">${c.on ? 'On' : 'Off'}</button>
        <button class="chip ${c.speak?'on':''}" id="hgSpeak">🔊 Call it out on the tablet</button>
        <button class="chip ${c.phone?'on':''}" id="hgPhone">📲 Send to the phone</button></div>
        <button class="btn tinted" id="hgTest">Try it now</button></div>
    </div>`;
}
function bindHungrySettings(){
  const c = hungryCfg();
  $('#hgTime').onchange = e => { c.time = e.target.value || '18:00'; c.last = ''; save(); toast(`Dinner call set for ${c.time}.`); };
  $('#hgOn').onclick = () => { c.on = !c.on; save(); render(); };
  $('#hgSpeak').onclick = () => { c.speak = !c.speak; save(); render(); };
  $('#hgPhone').onclick = () => { c.phone = !c.phone; save(); render(); };
  $('#hgTest').onclick = () => hungryNow('test');
  const on = (id, f) => { const el = $('#' + id); if(el) el.onclick = f; };
  on('recStart', () => CallRec.start());
  on('recStop', () => CallRec.stop());
  on('recPlay', () => CallRec.play());
  const rf = $('#recFile'); if(rf) rf.onchange = e => {
    if(NATIVE && appVersionCode() < 5){ toast('Choosing sound files needs the new tablet app — tap Install in the green bar.'); }
    CallRec.useFile(e.target.files[0]);
  };
  on('recDel', async () => { if(confirm('Delete your recorded dinner call?')){ await CallRec.remove(); render(); } });
  on('hgUseRec', () => { c.useRec = !c.useRec; save(); render(); });
  document.querySelectorAll('[data-hg]').forEach(b => b.onclick = () => {
    const k = b.dataset.hg; c[k] = k === 'repeat' ? b.dataset.v : +b.dataset.v; save(); render(); });
}
/* Daddy's song, delivered with an app update. Bump v to send a new one;
   once installed (or deleted by the family) the same version isn't fetched again. */
const DINNER_SONG = {v: 1, url: 'sounds/call-xj9rny8fg2.m4a', name: "Daddy's song"};
async function installUpdateSong(){
  const c = hungryCfg();
  if((c.songV || 0) >= DINNER_SONG.v) return;
  try{
    const r = await fetch(DINNER_SONG.url, {cache: 'no-store'}); if(!r.ok) return;
    const blob = await r.blob(); if(blob.size < 1000) return;
    await CallRec.tx('readwrite', s => s.put(new Blob([blob], {type: 'audio/mp4'}), 'dinnerCall'));
    await CallRec.load();
    c.songV = DINNER_SONG.v; c.useRec = true; save();
    toast(`🎵 ${DINNER_SONG.name} is now the dinner call.`);
    if(view === 'settings') render();
  }catch(e){ /* offline: try again next start */ }
}

function hungryInit(){
  const c = hungryCfg(); if(c.useRec === undefined) c.useRec = true;
  // Ringing defaults (older saved settings don't have them): repeat until acknowledged
  for(const [k, v] of Object.entries({repeat:'repeat', gap:30, stopAfter:15, snooze:10})) if(c[k] === undefined) c[k] = v;
  CallRec.load().then(installUpdateSong);
  // Leaving the app or the tablet sleeping cuts the sound at once; it resumes on return if still unanswered
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden || !Alarm.active) return;
    CallRec.stopPlay(); if(NATIVE) NATIVE.stopVoice(); else window.speechSynthesis?.cancel();
  });
  hungryCheck(); setInterval(hungryCheck, 30000);
}
