/* Kids' Vote (Ìbò àwọn ọmọ) for kids' breakfast and lunchbox.
   Rules: the app offers 3 kid-friendly choices; each child taps their name, then a food.
   2 children on the same food — or Mummy's okay (Settings code) — approves and LOCKS it.
   Locked meals only change with the Settings code (Mummy or Daddy override). */

const VOTE_SLOTS = ['kidsBf', 'kidsBox'];
const isVoteSlot = id => VOTE_SLOTS.includes(id);
const voteState = (wk, day, slot) => ((((db.votes ||= {})[wk] ||= {})[day] ||= {})[slot] ||= {opts:[], v:{}, lock:null});
const peekVote = (wk, day, slot) => db.votes?.[wk]?.[day]?.[slot] || null;
let voteUI = {voter:null, approveBy:null, parentPick:false};

/* ---------- Food card: English first, Yoruba underneath ---------- */
function foodCardHtml(m, {cls = '', side = '', cost = null, tip = false, disabled = false} = {}){
  const yo = yoName(m);
  return `<button class="food ${cls}" data-m="${m.id}" ${disabled ? 'disabled' : ''}>
    ${mealPic(m, 'food-em')}
    <span class="food-txt">
      <span class="food-en">${esc(m.name)}</span>
      ${yo ? `<span class="food-yo">${esc(yo)}</span>` : ''}
      <span class="food-tags">${m.k ? '<span class="tag t-k">Kids love it</span>' : ''}${m.d ? '<span class="tag t-d">Sugar-friendly</span>' : ''}${m.p ? '<span class="tag t-p">Packs well</span>' : ''}${cost !== null ? `<span class="tag t-c">≈ ${money(cost)}</span>` : ''}</span>
      ${tip && m.tip ? `<span class="food-tip">${esc(m.tip)}</span>` : ''}
    </span>${side}</button>`;
}

/* ---------- Choices ---------- */
function voteOptions(wk, day, slotId){
  const st = voteState(wk, day, slotId);
  if(st.opts.length) return st.opts.map(mealById).filter(Boolean);
  const slot = SLOTS.find(s => s.id === slotId), cur = getPick(wk, day, slotId);
  const usedThisWeek = new Set([0,1,2,3,4,5,6].map(d => getPick(wk, d, slotId)).filter(Boolean));
  let pool = candidates(slot, false).filter(m => m.k && m.id !== cur);
  const fresh = pool.filter(m => !usedThisWeek.has(m.id)); if(fresh.length >= 3) pool = fresh;
  const pick = [];
  if(cur && cur !== 'skip' && mealById(cur)) pick.push(cur);
  while(pick.length < 3 && pool.length){
    const yor = pool.filter(m => YORUBA_IDS.has(m.id)), from = yor.length && Math.random() < .6 ? yor : pool;
    const m = from[Math.floor(Math.random() * from.length)];
    pick.push(m.id); pool = pool.filter(x => x.id !== m.id);
  }
  st.opts = pick; save();
  return pick.map(mealById);
}
function voteCounts(st){ const c = {}; Object.values(st.v).forEach(id => c[id] = (c[id] || 0) + 1); return c; }
function lockVote(wk, day, slotId, mealId, by){
  const st = voteState(wk, day, slotId);
  st.lock = {meal: mealId, by, at: Date.now()};
  setPick(wk, day, slotId, mealId);
}

/* ---------- Wording ---------- */
function voteQuestion(wk, day, slotId){
  const isThisWeek = wk === weekKey(0), t = todayIdx();
  const en = !isThisWeek ? `on ${DAYS_LONG[day]}` : day === t ? 'today' : day === (t + 1) % 7 ? 'tomorrow' : `on ${DAYS_LONG[day]}`;
  const yo = !isThisWeek ? DAYS_YO[day] : day === t ? 'òní' : day === (t + 1) % 7 ? 'ọ̀la' : DAYS_YO[day];
  return slotId === 'kidsBf'
    ? {en: `What's for breakfast ${en}?`, yo: `Kí la ó jẹ ní àárọ̀ ${yo}?`}
    : {en: `What goes in the lunchbox ${en}?`, yo: `Oúnjẹ ilé-ìwé fún ${yo}`};
}
function voteStatus(wk, day, slotId){
  const st = peekVote(wk, day, slotId);
  if(st?.lock) return {txt: `🔒 Locked · ${st.lock.by}`, cls:'locked'};
  const n = st ? Object.keys(st.v).length : 0;
  return n ? {txt: `🗳️ ${n} vote${n > 1 ? 's' : ''} so far`, cls:'voting'} : {txt: '🗳️ Kids can vote', cls:'open'};
}

/* ---------- Grown-up check (Settings code) ---------- */
function parentCheck(title){
  return new Promise(res => {
    const saved = Lock.get();
    if(!saved){
      // Grown-up actions always need the code — set one first
      res(false); $('#scrim').classList.remove('on');
      toast('🔒 Set a Settings code first — Mummy or Daddy will need it for this.');
      Lock.open = false; Lock.mode = 'create'; Lock.entry = ''; view = 'settings'; render(); return;
    }
    let entry = '', err = '';
    const draw = () => {
      $('#sheet').innerHTML = `<div class="grabber"></div><div class="lock mini">
        <div class="lock-ic"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div>
        <h2>${esc(title)}</h2><div class="muted">Mummy or Daddy — enter the Settings code.</div>
        <div class="dots ${err ? 'shake' : ''}">${[0,1,2,3].map(i => `<span class="${i < entry.length ? 'on' : ''}"></span>`).join('')}</div>
        <div class="lock-err">${esc(err)}</div>
        <div class="keypad">${[1,2,3,4,5,6,7,8,9,'',0,'del'].map(k => k === '' ? '<span></span>' : k === 'del'
          ? '<button class="key fn" data-k="del">⌫</button>' : `<button class="key" data-k="${k}"><b>${k}</b><small>${KEY_LETTERS[k] || '&nbsp;'}</small></button>`).join('')}</div>
        <div class="lock-links"><button class="link" id="pcCancel">Cancel</button></div></div>`;
      $('#sheet').querySelectorAll('.key').forEach(b => b.onclick = async () => {
        const k = b.dataset.k; err = '';
        if(k === 'del'){ entry = entry.slice(0, -1); return draw(); }
        entry += k; draw();
        if(entry.length < 4) return;
        const ok = await sha256Hex(saved.salt + ':' + entry) === saved.hash; entry = '';
        if(ok) res(true); else { err = 'Wrong code.'; draw(); }
      });
      $('#pcCancel').onclick = () => res(false);
    };
    draw(); $('#scrim').classList.add('on');
  });
}

/* ---------- The vote sheet ---------- */
function openVote(wk, day, slotId){
  const st = voteState(wk, day, slotId), q = voteQuestion(wk, day, slotId), kids = kidProfiles();
  const opts = voteUI.parentPick ? candidates(SLOTS.find(s => s.id === slotId), false).filter(m => m.k) : voteOptions(wk, day, slotId);
  const counts = voteCounts(st), byId = id => profiles().find(p => p.id === id);
  const lockedMeal = st.lock && mealById(st.lock.meal);
  const voterName = voteUI.voter && byId(voteUI.voter)?.name;
  const hint = st.lock ? '' : voteUI.parentPick ? 'Grown-ups: tap any food to choose it and lock it.'
    : voteUI.approveBy ? `${voteUI.approveBy}, tap the food you approve.`
    : voterName ? `${voterName}, tap the food you want.` : 'First, tap your name 👇';

  $('#sheet').innerHTML = `<div class="grabber"></div>
    <div class="vote-head">
      <div class="vote-kicker">🗳️ Kids' vote · <i>Ìbò àwọn ọmọ</i></div>
      <h2>${esc(q.en)}</h2><div class="vote-yo">${esc(q.yo)}</div>
      ${st.lock ? '' : `<div class="vote-rule">Two votes for the same food — or Mummy's okay — locks it in. 🔒</div>`}
    </div>
    ${lockedMeal ? `<div class="vote-locked">
        <div class="vl-badge">🔒 Locked</div>
        ${foodCardHtml(lockedMeal, {cls:'win', disabled:true})}
        <div class="vl-by">Chosen by ${esc(st.lock.by)}. Only Mummy or Daddy can change it now.</div>
      </div>` : `
      ${voteUI.parentPick || voteUI.approveBy ? '' : `<div class="voters">${kids.map(k => `<button class="voter ${k.id === voteUI.voter ? 'on' : ''}" data-kid="${k.id}">
          <span class="pav" style="background:${k.color}">${esc(initials(k.name))}</span><span class="vname">${esc(k.name)}</span>
          ${st.v[k.id] ? '<span class="vdone">✓ voted</span>' : '<span class="vdone">&nbsp;</span>'}</button>`).join('')}</div>`}
      <div class="vote-hint">${esc(hint)}</div>
      <div class="vopts ${voteUI.parentPick ? 'many' : ''}">${opts.map(m => {
        const who = Object.entries(st.v).filter(([, id]) => id === m.id).map(([kid]) => byId(kid)).filter(Boolean);
        const side = voteUI.parentPick ? '' : `<span class="vfaces">${who.map(p => `<span class="pav xs" style="background:${p.color}" title="${esc(p.name)}">${esc(initials(p.name))}</span>`).join('')}
          <span class="vcount">${counts[m.id] || 0}/2</span></span>`;
        return foodCardHtml(m, {cls: (st.v[voteUI.voter] === m.id ? 'mine ' : '') + (voteUI.approveBy ? 'approve' : ''), side});
      }).join('')}</div>`}
    <div class="grownups">
      <span class="gu-label">Grown-ups</span>
      ${st.lock
        ? `<button class="btn tinted" id="vUnlock">Unlock for a new vote</button><button class="btn tinted" id="vChange">Pick a different meal</button>`
        : voteUI.parentPick || voteUI.approveBy ? `<button class="btn ghost" id="vBack">Back to voting</button>`
        : `<button class="btn" id="vMummy">✓ ${esc(db.names.wife)} approves…</button><button class="btn tinted" id="vDaddy">${esc(db.names.me)} chooses…</button><button class="btn ghost" id="vNew">New choices</button>`}
      <span class="spacer"></span><button class="btn ghost" id="vClose">Done</button>
    </div>`;

  const S = $('#sheet'), reopen = () => openVote(wk, day, slotId);
  S.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { voteUI.voter = b.dataset.kid; reopen(); });
  S.querySelectorAll('.vopts .food').forEach(b => b.onclick = () => {
    const id = b.dataset.m;
    if(voteUI.parentPick){ lockVote(wk, day, slotId, id, `${db.names.wife} & ${db.names.me}`); voteUI = {voter:null, approveBy:null, parentPick:false}; celebrate(mealById(id), 'Grown-ups chose'); return reopen(); }
    if(voteUI.approveBy){ lockVote(wk, day, slotId, id, voteUI.approveBy); const by = voteUI.approveBy; voteUI = {voter:null, approveBy:null, parentPick:false}; celebrate(mealById(id), `${by} approved`); return reopen(); }
    if(!voteUI.voter){ toast('Tap your name first 👇'); return; }
    st.v[voteUI.voter] = id; save();
    const c = voteCounts(st);
    if(c[id] >= 2){
      const names = Object.entries(st.v).filter(([, m]) => m === id).map(([k]) => byId(k)?.name).filter(Boolean);
      lockVote(wk, day, slotId, id, listText(names)); voteUI.voter = null; celebrate(mealById(id), `${listText(names)} chose`);
    } else { toast(`${voterName || 'Your'} vote is in! 🗳️`); voteUI.voter = null; }
    reopen();
  });
  const on = (id, f) => { const el = $('#' + id); if(el) el.onclick = f; };
  on('vClose', () => { voteUI = {voter:null, approveBy:null, parentPick:false}; closePicker(); });
  on('vBack', () => { voteUI = {voter:null, approveBy:null, parentPick:false}; reopen(); });
  on('vMummy', async () => { if(await parentCheck(`${db.names.wife} approves`)){ voteUI = {voter:null, approveBy:db.names.wife, parentPick:false}; } reopen(); });
  on('vDaddy', async () => { if(await parentCheck('Choose a meal')){ voteUI = {voter:null, approveBy:null, parentPick:true}; } reopen(); });
  on('vNew', async () => { if(await parentCheck('New choices')){ st.opts = []; st.v = {}; save(); } reopen(); });
  on('vUnlock', async () => { if(await parentCheck('Unlock this meal')){ st.lock = null; st.v = {}; save(); toast('Unlocked — the kids can vote again.'); } reopen(); });
  on('vChange', async () => { if(await parentCheck('Change this meal')){ st.lock = null; voteUI = {voter:null, approveBy:null, parentPick:true}; save(); } reopen(); });
  $('#scrim').classList.add('on');
}

function celebrate(m, who){
  const burst = document.createElement('div'); burst.className = 'confetti';
  burst.innerHTML = Array.from({length: 26}, (_, i) => `<i style="--x:${Math.round(Math.random()*100)}vw;--d:${(Math.random()*.8+.9).toFixed(2)}s;--r:${Math.round(Math.random()*720-360)}deg">${['🎉','⭐','🎊',m.em][i % 4]}</i>`).join('');
  document.body.appendChild(burst); setTimeout(() => burst.remove(), 2200);
  const msg = `Ó dáa! ${who} ${m.name}. It's locked in! 🔒`;
  toast(msg);
  if(typeof voice !== 'undefined' && !voice.active) voice.speak(msg.replace(' 🔒', ''));
}

/* ---------- Today card ---------- */
function voteTodayHtml(){
  const t = todayIdx(), d = (t + 1) % 7, wk = d === 0 ? weekKey(1) : weekKey(0);
  const slots = slotsFor(d).filter(s => isVoteSlot(s.id));
  const open = slots.filter(s => !peekVote(wk, d, s.id)?.lock);
  if(!slots.length) return '';
  return `<div class="vote-card">
    <div class="vc-top"><span class="vc-ic">🗳️</span><div><b>Kids' vote for tomorrow</b><div class="vote-yo">Ìbò àwọn ọmọ fún ọ̀la</div></div></div>
    <div class="vc-btns">${slots.map(s => { const vs = voteStatus(wk, d, s.id), m = mealById(getPick(wk, d, s.id) || '');
      return `<button class="vc-btn ${vs.cls}" data-vday="${d}" data-vwk="${wk}" data-vslot="${s.id}">
        <span class="vc-what">${s.id === 'kidsBf' ? 'Breakfast' : 'Lunchbox'}</span>
        <span class="vc-meal">${vs.cls === 'locked' && m ? `${m.em} ${esc(m.name)}` : open.length ? 'Tap to vote' : ''}</span>
        <span class="vc-st">${esc(vs.txt)}</span></button>`; }).join('')}</div></div>`;
}
function bindVoteToday(){
  document.querySelectorAll('[data-vslot]').forEach(b => b.onclick = () => openVote(b.dataset.vwk, +b.dataset.vday, b.dataset.vslot));
}
