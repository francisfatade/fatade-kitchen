/* "Ebi ń pa mí" — Daddy's dinner call. Plays once a day at the set time (default
   6 pm) so Mummy knows to start prepping before he gets home, and any time someone
   taps the button or says "ebi n pa mi". Tablet: chime + spoken call + prep card.
   Phone: the same message through ntfy (Settings → Send list to phone). */

const hungryCfg = () => db.home.hungry ||= {on:true, time:'18:00', speak:true, phone:true, last:''};
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
  const g = typeof glucoseState === 'function' && LLU.configured() ? glucoseState() : null;
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
    </div>`;
  $('#scrim').classList.add('on');
  $('#hgOk').onclick = () => { if(NATIVE) NATIVE.stopVoice(); else window.speechSynthesis?.cancel(); closePicker(); };

  if(c.speak){
    chime();
    const said = `Ebi ń pa mí o! Ìyàwó, ${me} ń bọ̀ wálé. ` +
      (dinner ? `Tonight's dinner is ${dinner.name}. ` : '') + (late ? `His late plate is ${late.name}.` : '');
    setTimeout(() => { if(typeof voice !== 'undefined' && !voice.active) voice.speak(said); }, 1400);
  }
  if(c.phone && db.home.ntfy){
    const lines = [`${me} ń bọ̀ wálé — time to prep. 🍲`];
    if(dinner) lines.push(`Dinner: ${dinner.name}`);
    if(late) lines.push(`Late plate: ${late.name}`);
    if(g) lines.push(`Sugar now: ${Math.round(g.value)} mg/dL ${ARROWS[g.trend] || ''}`);
    if(prep.length) lines.push(`For tomorrow: ${prep.join(' · ')}`);
    try{
      await fetch('https://ntfy.sh/', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({topic: db.home.ntfy, title: `Ebi ń pa ${me}! 🍲`, message: lines.join('\n'), priority: 4, tags: ['bell']})});
    }catch(e){}
  }
}

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
}
function hungryInit(){
  hungryCfg();
  hungryCheck(); setInterval(hungryCheck, 30000);
}
