/* Swipe planner (Ìṣètò ọ̀sẹ̀) — Mummy flicks through suggested meals for each
   meal of the week: swipe right (✓) to plan it, left (✕) for the next idea.
   Daddy's own meals only offer blood-sugar-friendly food, lowest-carb first.
   Kids' breakfast and lunchbox are left to the kids' vote. */

// Starchy ingredients and how hard they hit blood sugar (1 = fast, .5 = slower)
const CARB_WEIGHT = {
  'Rice':1, 'Ofada rice':.8, 'Brown rice':.6, 'Yam':1, 'Water yam':1, 'Yam flour (elubo)':1, 'Swallow of choice':.8,
  'Starch / swallow':1, 'Bread':1, 'Spaghetti':1, 'Noodles':1, 'Flour':1, 'Pap (ogi)':1, 'Sugar':1, 'Custard powder':1,
  'Potatoes':1, 'Ripe plantain':1, 'Tortilla wraps':.8, 'Juice':1, 'Sweet potato':.6, 'Unripe plantain':.5,
  'Okpa flour':.5, 'Rolled oats':.4, 'Steel-cut oats':.3, 'Beans':.4, 'Beans (peeled)':.4,
  'Whole grain bread':.6, 'Whole grain wrap':.6, 'Whole grain English muffin':.6, 'Bananas':.6, 'Pineapple':.5, 'Apples':.3, 'Mixed berries':.2,
};
const carbScore = m => m.ing.reduce((t, g) => t + (CARB_WEIGHT[g] || 0), 0);

// Has Daddy's sugar been running high? (average of the last 12 h of Libre readings)
function sugarRunningHigh(){
  const h = LLU.configured() && LLU.data?.history; if(!h || h.length < 12) return false;
  const avg = h.reduce((t, p) => t + p.v, 0) / h.length;
  return avg > (LLU.s.high || 180) - 20;
}

const PLAN_SLOTS = ['wifeBf', 'meBf', 'meLunch', 'dinner', 'meLate'];   // kids' meals: by vote

function planSuggestions(wk, day, slot, usedIds){
  const forDaddy = slot.who === 'me', strict = sugarRunningHigh();
  let pool = candidates(slot, false);                            // Daddy's slots: sugar-friendly only
  if(slot.id === 'meLate') pool = pool.filter(m => carbScore(m) <= .5);   // late plate: low-carb only
  const fresh = pool.filter(m => !usedIds.has(m.id)); if(fresh.length >= 3) pool = fresh;
  const score = m => {
    let s = Math.random() * 2;                                    // variety
    if(YORUBA_IDS.has(m.id)) s += 1.5;                            // Yoruba home cooking first
    if(forDaddy || slot.who === 'family') s += (m.d ? 2 : 0) - carbScore(m) * (strict ? 2.5 : 1);
    return s;
  };
  return pool.map(m => [m, score(m)]).sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

const Planner = {
  open: false, wk: '', steps: [], i: 0, deck: [], k: 0, history: [], used: {},
  start(wk = weekKey()){
    this.wk = wk; this.open = true; this.i = 0; this.history = []; this.used = {};
    for(let d = 0; d < 7; d++) for(const s of slotsFor(d)) if(PLAN_SLOTS.includes(s.id)){
      const p = getPick(wk, d, s.id); if(p && p !== 'skip') (this.used[s.id] ||= new Set()).add(p);
    }
    // Every meal of the week, emptiest first so a half-planned week continues where it left off
    this.steps = [];
    for(let d = 0; d < 7; d++) for(const s of slotsFor(d)) if(PLAN_SLOTS.includes(s.id)) this.steps.push({d, s});
    const firstEmpty = this.steps.findIndex(st => !getPick(wk, st.d, st.s.id));
    this.i = firstEmpty >= 0 ? firstEmpty : 0;
    this.loadDeck(); this.draw();
  },
  loadDeck(){
    const st = this.steps[this.i]; if(!st) return;
    this.deck = planSuggestions(this.wk, st.d, st.s, this.used[st.s.id] || new Set()); this.k = 0;
  },
  cur(){ return this.deck[this.k]; },
  yes(){
    const st = this.steps[this.i], m = this.cur(); if(!st || !m) return;
    this.history.push({i: this.i, prev: getPick(this.wk, st.d, st.s.id) || null});
    setPick(this.wk, st.d, st.s.id, m.id); (this.used[st.s.id] ||= new Set()).add(m.id);
    this.next();
  },
  skipSlot(){
    const st = this.steps[this.i]; this.history.push({i: this.i, prev: getPick(this.wk, st.d, st.s.id) || null});
    this.next();
  },
  nope(){ this.k = (this.k + 1) % Math.max(1, this.deck.length); this.draw('left'); },
  next(){ this.i++; if(this.i >= this.steps.length) return this.finish(); this.loadDeck(); this.draw('right'); },
  undo(){
    const h = this.history.pop(); if(!h) return;
    const st = this.steps[h.i]; setPick(this.wk, st.d, st.s.id, h.prev); this.i = h.i; this.loadDeck(); this.draw();
  },
  close(){ this.open = false; $('#planner')?.classList.remove('on'); render(); },
  finish(){
    const n = this.steps.filter(st => getPick(this.wk, st.d, st.s.id)).length;
    $('#planner').innerHTML = `<div class="pl-done">
      <div class="pl-done-ic">🎉</div><h2>The week is planned!</h2><div class="vote-yo">Ọ̀sẹ̀ yìí ti ṣetán</div>
      <p>${n} meals are on the calendar. The kids still vote on their breakfast and lunchbox.</p>
      <div class="row" style="justify-content:center"><button class="btn" id="plSeeWeek">See the week</button><button class="btn ghost" id="plShop">Shopping list</button></div></div>`;
    $('#plSeeWeek').onclick = () => { this.close(); view = 'week'; render(); };
    $('#plShop').onclick = () => { this.close(); view = 'shop'; render(); };
  },

  draw(dir){
    let el = $('#planner'); if(!el){ el = document.createElement('div'); el.id = 'planner'; document.body.appendChild(el); }
    el.classList.add('on');
    const st = this.steps[this.i], m = this.cur(); if(!st) return this.finish();
    const slot = st.s, isMe = slot.who === 'me', cur = getPick(this.wk, st.d, slot.id), curM = cur && cur !== 'skip' && mealById(cur);
    const dates = weekDates(); const pct = Math.round(this.i / this.steps.length * 100);
    const u = m && photoUrl(m, 1000), nextM = this.deck[(this.k + 1) % this.deck.length];
    el.innerHTML = `
      <div class="pl-top">
        <button class="iconbtn lg" id="plClose" aria-label="Close">✕</button>
        <div class="pl-where"><div class="pl-day">${DAYS_LONG[st.d]} ${dates[st.d].getDate()} · <i>${DAYS_YO[st.d]}</i></div>
          <div class="pl-slot who-${slot.who}">${esc(slot.label(db.names, st.d >= 5))} <span class="yo-h">${slot.yo}</span></div></div>
        <button class="iconbtn lg" id="plUndo" aria-label="Undo" ${this.history.length ? '' : 'disabled'}>↶</button>
      </div>
      <div class="pl-progress"><span style="width:${pct}%"></span></div>
      ${isMe ? `<div class="pl-note">💚 ${sugarRunningHigh() ? `${esc(db.names.me)}'s sugar has been running high — lowest-carb choices first.` : `Only blood-sugar-friendly meals for ${esc(db.names.me)}${slot.id === 'meLate' ? ' · low-carb late plate' : ''}.`}</div>`
        : slot.who === 'family' ? `<div class="pl-note">💚 Sugar-friendly dinners come first — ${esc(db.names.me)}'s swap tip is on each card.</div>` : ''}
      ${curM ? `<div class="pl-cur">Planned now: ${esc(curM.name)} — swipe right to replace it, or Skip to keep it.</div>` : ''}
      <div class="pl-stack">
        ${nextM && nextM !== m ? `<div class="pl-card behind">${nextM && photoUrl(nextM, 600) ? `<img src="${photoUrl(nextM, 1000)}" alt="">` : ''}</div>` : ''}
        ${m ? `<div class="pl-card ${dir ? 'in-' + dir : ''}" id="plCard">
          <span class="pv-em">${m.em}</span>${u ? `<img src="${u}" alt="${esc(m.name)}" draggable="false" onerror="this.remove()">` : ''}
          <span class="pl-stamp yes">YES ✓</span><span class="pl-stamp no">NEXT</span>
          <div class="pl-cap"><div class="pv-en">${esc(m.name)}</div>${yoName(m) ? `<div class="pv-yo">${esc(yoName(m))}</div>` : ''}
            <div class="food-tags">${m.d ? '<span class="tag t-d">Sugar-friendly</span>' : ''}${m.k ? '<span class="tag t-k">Kids love it</span>' : ''}<span class="tag t-c">≈ ${money(mealCost(m, servingsFor(slot)))}</span>${carbScore(m) <= .5 ? '<span class="tag t-d">Low-carb</span>' : ''}</div>
            ${(isMe || slot.who === 'family') && m.tip ? `<div class="pl-tip">💚 ${esc(m.tip)}</div>` : ''}</div>
        </div>` : `<div class="pv-empty">No more ideas for this meal.</div>`}
      </div>
      <div class="pl-btns">
        <button class="pl-b no" id="plNo" aria-label="Next idea">✕</button>
        <button class="pl-b skip" id="plSkip">Skip</button>
        ${m ? `<button class="pl-b skip" data-howto="${m.id}">📖 Recipe</button>` : ''}
        <button class="pl-b yes" id="plYes" aria-label="Plan it">✓</button>
      </div>
      <div class="pl-hint">Swipe right to plan it · left for another idea · ${this.i + 1} of ${this.steps.length}</div>`;
    $('#plClose').onclick = () => this.close();
    $('#plUndo').onclick = () => this.undo();
    $('#plYes').onclick = () => this.fling(1);
    $('#plNo').onclick = () => this.fling(-1);
    $('#plSkip').onclick = () => this.skipSlot();
    this.bindSwipe();
  },
  fling(dirn){
    const c = $('#plCard'); if(!c) return dirn > 0 ? this.skipSlot() : this.nope();
    c.style.transition = 'transform .28s ease, opacity .28s'; c.style.transform = `translateX(${dirn * 120}%) rotate(${dirn * 18}deg)`; c.style.opacity = '0';
    setTimeout(() => dirn > 0 ? this.yes() : this.nope(), 220);
  },
  bindSwipe(){
    const c = $('#plCard'); if(!c) return;
    let x0 = null, dx = 0;
    c.onpointerdown = e => { x0 = e.clientX; dx = 0; c.setPointerCapture(e.pointerId); c.style.transition = 'none'; };
    c.onpointermove = e => { if(x0 === null) return; dx = e.clientX - x0;
      c.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
      c.classList.toggle('show-yes', dx > 60); c.classList.toggle('show-no', dx < -60); };
    c.onpointerup = c.onpointercancel = () => { if(x0 === null) return; x0 = null;
      if(dx > 110) return this.fling(1); if(dx < -110) return this.fling(-1);
      c.style.transition = 'transform .25s ease'; c.style.transform = ''; c.classList.remove('show-yes', 'show-no'); };
  },
};
