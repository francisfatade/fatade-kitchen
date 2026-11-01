/* Family profiles (each has its own colour theme) and the Settings code. */

/* ---------- Profiles & colour themes ---------- */
const PALETTE = [['Burgundy','#8C1D2F'],['Ruby','#C62E3B'],['Rose','#B0306A'],['Plum','#7B3FA0'],['Navy','#1F4E8C'],
  ['Sky','#0A6CFF'],['Emerald','#0F7B5F'],['Tangerine','#E0701F'],['Gold','#B8860B'],['Graphite','#3A3A3C']];
const KID_DEFAULTS = [['k1','Kid 1','#E0701F'], ['k2','Kid 2','#7B3FA0'], ['k3','Kid 3','#0F7B5F'], ['k4','Kid 4','#0A6CFF']];
const newKids = () => KID_DEFAULTS.map(([id, name, color]) => ({id, name, color, role:'kid'}));
function profiles(){
  if(!db.profiles) db.profiles = [
    {id:'family', name:'Fatade Family', color:'#8C1D2F', role:'family'},   // burgundy from the family Christmas photo
    {id:'daddy',  name:db.names.me,     color:'#1F4E8C', role:'parent'},
    {id:'mummy',  name:db.names.wife,   color:'#B0306A', role:'parent'},
    ...newKids()];
  // Older versions had one shared "Kids" profile; each child now has their own (for voting)
  if(!db.profiles.some(p => p.role === 'kid')){
    db.profiles = db.profiles.filter(p => p.id !== 'kids').map(p => ({...p, role: p.id === 'family' ? 'family' : p.role || 'parent'}));
    db.profiles.push(...newKids()); save();
  }
  return db.profiles;
}
const kidProfiles = () => profiles().filter(p => p.role === 'kid');
const currentProfile = () => profiles().find(p => p.id === db.profile) || profiles()[0];
const initials = n => (n || '?').split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('');
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [n>>16 & 255, n>>8 & 255, n & 255]; };

function applyTheme(){
  const p = currentProfile(), dark = matchMedia('(prefers-color-scheme: dark)').matches;
  // Deep colours get lifted a little on a dark screen so they stay readable
  const [r,g,b] = rgbOf(p.color).map(c => dark ? Math.round(c + (255 - c) * .3) : c);
  const s = document.documentElement.style, hex = '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
  s.setProperty('--green', hex); s.setProperty('--green-soft', `rgba(${r},${g},${b},.13)`); s.setProperty('--accent-rgb', `${r},${g},${b}`);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.color);
  const a = $('#profileBtn'); if(a){ a.textContent = initials(p.name); a.style.background = p.color; a.setAttribute('aria-label', 'Profile: ' + p.name); }
}
const profileGreeting = () => { const p = currentProfile(); return p.id === 'family' ? `${greeting()}, Ìdílé Fatade` : `${greeting()}, ${p.name}`; };

function openProfiles(){
  $('#sheet').innerHTML = `<div class="grabber"></div>
    <h2 class="sheet-title">Who's in the kitchen?</h2>
    <div class="profiles">${profiles().map(p => `<button class="prof ${p.id===currentProfile().id?'cur':''}" data-p="${p.id}">
      <span class="pav" style="background:${p.color}">${esc(initials(p.name))}</span><span class="pname">${esc(p.name)}</span></button>`).join('')}</div>
    <div class="muted" style="text-align:center;margin-top:14px">Each person gets their own colour. Edit profiles in Settings.</div>`;
  $('#sheet').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { db.profile = b.dataset.p; save(); applyTheme(); closePicker(); });
  $('#scrim').classList.add('on');
}

function profileSettingsHtml(){
  return `<h2 class="sec">Profiles & colours</h2>
    <div class="card list">${profiles().map((p,i) => `<div class="lrow prow">
      <span class="pav sm" style="background:${p.color}">${esc(initials(p.name))}</span>
      <input type="text" class="pname-in" data-pn="${p.id}" value="${esc(p.name)}" aria-label="Profile name">
      <div class="swatches">${PALETTE.map(([n,c]) => `<button class="sw ${c===p.color?'on':''}" style="background:${c}" title="${n}" data-pc="${p.id}" data-c="${c}"></button>`).join('')}</div>
      ${i ? `<button class="iconbtn" data-pdel="${p.id}" title="Remove">✕</button>` : ''}</div>`).join('')}
      <div class="lrow"><button class="btn tinted" id="addProfile">＋ Add a child</button>
        <span class="muted">Type each child's name — they vote as themselves and pick their own colour.</span></div></div>`;
}
function bindProfileSettings(){
  document.querySelectorAll('[data-pn]').forEach(i => i.onchange = () => {
    const p = profiles().find(x => x.id === i.dataset.pn); p.name = i.value.trim() || p.name; save(); applyTheme(); render(); });
  document.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => {
    profiles().find(x => x.id === b.dataset.pc).color = b.dataset.c; save(); applyTheme(); render(); });
  document.querySelectorAll('[data-pdel]').forEach(b => b.onclick = () => {
    if(!confirm('Remove this profile?')) return;
    db.profiles = profiles().filter(x => x.id !== b.dataset.pdel); if(db.profile === b.dataset.pdel) db.profile = 'family'; save(); applyTheme(); render(); });
  $('#addProfile').onclick = () => {
    const used = profiles().map(p => p.color), c = (PALETTE.find(([,c]) => !used.includes(c)) || PALETTE[0])[1];
    profiles().push({id:'p' + Date.now(), name:'New child', color:c, role:'kid'}); save(); render(); };
}

/* ---------- Settings code ----------
   Stored only on this tablet (hashed), separate from the plan backup.
   Forgotten code: a one-time reset code is pushed to the family phone (ntfy),
   or Mummy's LibreLinkUp password unlocks it. */
const Lock = {
  KEY: 'fatadeKitchen.lock',
  open: false, mode: 'enter', entry: '', first: '', err: '', fails: 0, waitUntil: 0, reset: null,
  get(){ try{ return JSON.parse(localStorage.getItem(this.KEY) || 'null'); }catch(e){ return null; } },
  put(v){ try{ v ? localStorage.setItem(this.KEY, JSON.stringify(v)) : localStorage.removeItem(this.KEY); }catch(e){} },
  needed(){ return !this.open; },
  close(){ this.open = false; this.entry = ''; this.err = ''; this.mode = this.get() ? 'enter' : 'create'; },
};
const LOCK_TEXT = {
  enter:   ['Enter Settings Code', 'Ask Daddy or Mummy for the code.'],
  create:  ['Create a Settings Code', 'Choose 4 numbers the grown-ups will remember.'],
  confirm: ['Confirm Your Code', 'Enter the same 4 numbers again.'],
  reset:   ['Enter Reset Code', 'Type the 6-digit code that was sent to the phone.'],
  pw:      ['Unlock with Password', `Type ${'Mummy'}'s LibreLinkUp password.`],
};
const KEY_LETTERS = ['', '', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];

function renderLock(){
  if(!Lock.get() && Lock.mode === 'enter') Lock.mode = 'create';
  const m = Lock.mode, len = m === 'reset' ? 6 : 4, [title, sub] = LOCK_TEXT[m];
  const wait = Math.ceil((Lock.waitUntil - Date.now()) / 1000);
  const keys = [1,2,3,4,5,6,7,8,9,'',0,'del'].map(k => k === '' ? '<span></span>'
    : k === 'del' ? `<button class="key fn" data-k="del" aria-label="Delete">⌫</button>`
    : `<button class="key" data-k="${k}"><b>${k}</b><small>${KEY_LETTERS[k] || '&nbsp;'}</small></button>`).join('');
  $('#main').innerHTML = `<div class="lock">
    <div class="lock-ic"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div>
    <h2>${title}</h2><div class="muted">${m === 'pw' ? `Type ${esc(db.names.wife)}'s LibreLinkUp password.` : sub}</div>
    ${m === 'pw' ? `<div class="pwrow"><input type="password" id="lockPw" autocomplete="off"><button class="btn" id="lockPwGo">Unlock</button></div>`
      : `<div class="dots ${Lock.err ? 'shake' : ''}">${Array.from({length:len}, (_,i) => `<span class="${i < Lock.entry.length ? 'on' : ''}"></span>`).join('')}</div>
         <div class="lock-err">${esc(wait > 0 ? `Too many tries — wait ${wait} seconds.` : Lock.err)}</div>
         <div class="keypad">${keys}</div>`}
    <div class="lock-links">
      ${m === 'enter' ? `<button class="link" id="lockForgot">Forgot code?</button>` : ''}
      ${m === 'create' && !Lock.get() ? `<button class="link" id="lockSkip">Not now</button>` : ''}
      ${['reset','pw','confirm'].includes(m) ? `<button class="link" id="lockBack">Cancel</button>` : ''}
    </div></div>`;
  document.querySelectorAll('.key').forEach(b => b.onclick = () => lockKey(b.dataset.k));
  $('#lockForgot') && ($('#lockForgot').onclick = lockForgot);
  $('#lockSkip') && ($('#lockSkip').onclick = () => { Lock.open = true; render(); });
  $('#lockBack') && ($('#lockBack').onclick = () => { Lock.close(); render(); });
  if($('#lockPwGo')){
    const go = () => { if(LLU.s.pw && $('#lockPw').value === LLU.s.pw){ Lock.mode = 'create'; Lock.entry = ''; Lock.err = ''; render(); toast('Unlocked — now choose a new code.'); }
      else toast('That password is not right.'); };
    $('#lockPwGo').onclick = go; $('#lockPw').onkeydown = e => { if(e.key === 'Enter') go(); };
  }
  if(wait > 0) setTimeout(() => { if(view === 'settings' && !Lock.open) render(); }, 1000);
}

async function lockKey(k){
  if(Date.now() < Lock.waitUntil) return;
  Lock.err = '';
  if(k === 'del'){ Lock.entry = Lock.entry.slice(0, -1); return render(); }
  const len = Lock.mode === 'reset' ? 6 : 4;
  if(Lock.entry.length >= len) return;
  Lock.entry += k; render();
  if(Lock.entry.length < len) return;
  const code = Lock.entry; Lock.entry = '';
  await new Promise(r => setTimeout(r, 120));   // let the last dot fill in
  const saved = Lock.get();
  if(Lock.mode === 'enter'){
    if(saved && await sha256Hex(saved.salt + ':' + code) === saved.hash){ Lock.open = true; Lock.fails = 0; }
    else { Lock.err = 'Wrong code. Try again.'; if(++Lock.fails >= 5){ Lock.fails = 0; Lock.waitUntil = Date.now() + 30000; } }
  } else if(Lock.mode === 'create'){ Lock.first = code; Lock.mode = 'confirm'; }
  else if(Lock.mode === 'confirm'){
    if(code === Lock.first){
      const salt = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2,'0')).join('');
      Lock.put({salt, hash: await sha256Hex(salt + ':' + code)});
      Lock.open = true; Lock.mode = 'enter'; toast('🔒 Settings code saved.');
    } else { Lock.err = "Those didn't match — start again."; Lock.mode = 'create'; }
  } else if(Lock.mode === 'reset'){
    if(Lock.reset && Date.now() < Lock.reset.exp && code === Lock.reset.code){ Lock.reset = null; Lock.mode = 'create'; toast('Reset code accepted — choose a new code.'); }
    else Lock.err = 'That reset code is not right or has expired.';
  }
  render();
}

function lockForgot(){
  const canPhone = !!db.home.ntfy, canPw = !!(LLU.s && LLU.s.pw);
  $('#sheet').innerHTML = `<div class="grabber"></div><h2 class="sheet-title">Forgot the code?</h2>
    <div class="card list">
      ${canPhone ? `<button class="lrow act" id="fgPhone"><span class="lic">📲</span><span><b>Send a reset code to the phone</b><small>A 6-digit code arrives in the ntfy app.</small></span></button>` : ''}
      ${canPw ? `<button class="lrow act" id="fgPw"><span class="lic">🔑</span><span><b>Use ${esc(db.names.wife)}'s LibreLinkUp password</b><small>The one used for the blood sugar display.</small></span></button>` : ''}
      ${!canPhone && !canPw ? `<div class="lrow"><span>No reset option is set up on this tablet yet. Reinstalling the app clears the code (and everything else).</span></div>` : ''}
    </div>`;
  $('#scrim').classList.add('on');
  $('#fgPhone') && ($('#fgPhone').onclick = async () => {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    Lock.reset = {code, exp: Date.now() + 15*60000};
    try{
      const r = await fetch('https://ntfy.sh/', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({topic: db.home.ntfy, title: 'Fatade Kitchen · Settings', priority: 4, tags: ['key'],
          message: `Your Settings reset code is ${code}. It works for 15 minutes. If nobody asked for this, you can ignore it.`})});
      if(!r.ok) throw 0;
      $('#scrim').classList.remove('on'); Lock.mode = 'reset'; Lock.entry = ''; render(); toast('Reset code sent to the phone.');
    }catch(e){ toast('Could not send — is the tablet online?'); }
  });
  $('#fgPw') && ($('#fgPw').onclick = () => { $('#scrim').classList.remove('on'); Lock.mode = 'pw'; render(); });
}

function lockSettingsHtml(){
  const on = !!Lock.get();
  return `<h2 class="sec">Settings code</h2>
    <div class="card list"><div class="lrow"><span class="lic">🔒</span><span style="flex:1"><b>${on ? 'Settings are protected' : 'No code set'}</b>
      <small>${on ? 'The code is asked every time Settings is opened.' : 'Anyone can change Settings.'}</small></span>
      <button class="btn tinted" id="lockChange">${on ? 'Change code' : 'Set a code'}</button>
      ${on ? '<button class="btn warn" id="lockOff">Turn off</button>' : ''}</div></div>`;
}
function bindLockSettings(){
  $('#lockChange').onclick = () => { Lock.open = false; Lock.mode = 'create'; Lock.entry = ''; Lock.err = ''; render(); };
  $('#lockOff') && ($('#lockOff').onclick = () => { if(confirm('Turn off the Settings code?')){ Lock.put(null); render(); } });
}
