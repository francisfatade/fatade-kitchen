/* Daddy's blood sugar from his FreeStyle Libre, read through Mummy's LibreLinkUp
   follower account. This is the same unofficial LibreLinkUp connection Nightscout
   and xDrip use, so Abbott may change it without notice (fix: update VERSION/PRODUCT
   here and release). It is for awareness only: real alarms come from the LibreLinkUp app.
   The login is saved only on this tablet, under its own key, never in the plan backup. */

const LLU = {
  KEY: 'fatadeKitchen.libre',
  VERSION: '4.16.0', PRODUCT: 'llu.android',
  s: {},            // email, pw, host, token, exp, acct, pid, low, high, alerts
  data: null,       // {value, trend, at, history:[{v,t}]}
  status: '', busy: false, pauseUntil: 0, lastAlert: 0,

  load(){
    try{ this.s = JSON.parse(localStorage.getItem(this.KEY) || '{}'); }catch(e){ this.s = {}; }
    this.s.low ||= 70; this.s.high ||= 180;
    if(this.s.alerts === undefined) this.s.alerts = true;
  },
  save(){ try{ localStorage.setItem(this.KEY, JSON.stringify(this.s)); }catch(e){} },
  configured(){ return !!(this.s.email && this.s.pw); },

  async req(method, path, body){
    const h = {'content-type':'application/json', 'product':this.PRODUCT, 'version':this.VERSION, 'cache-control':'no-cache'};
    if(this.s.token){ h.authorization = 'Bearer ' + this.s.token; h['account-id'] = this.s.acct; }
    const r = await httpCall(method, (this.s.host || 'https://api-us.libreview.io') + path, h, body ? JSON.stringify(body) : '');
    let j = null; try{ j = JSON.parse(r.text); }catch(e){}
    if(r.status === 429 || j?.status === 429){ this.pauseUntil = Date.now() + 15*60000; throw new Error('LibreLinkUp asked us to slow down — trying again in 15 minutes.'); }
    return {status: r.status, j};
  },

  async login(){
    this.s.token = null;
    for(let hop = 0; hop < 3; hop++){
      const r = await this.req('POST', '/llu/auth/login', {email:this.s.email, password:this.s.pw});
      const d = r.j?.data;
      if(d?.redirect && d.region){ this.s.host = `https://api-${String(d.region).toLowerCase()}.libreview.io`; continue; }
      if(r.j?.status === 2) throw new Error('The LibreLinkUp email or password is not right.');
      if(d?.step?.type) throw new Error('Open the LibreLinkUp app on the phone, accept the new terms, then tap Connect again.');
      const tok = d?.authTicket?.token, uid = d?.user?.id;
      if(!tok || !uid) throw new Error(r.j?.error?.message || `Could not sign in to LibreLinkUp (${r.status || 'no connection'}).`);
      this.s.token = tok; this.s.acct = await sha256Hex(uid);
      const ex = +d.authTicket.expires || 0; this.s.exp = ex > 1e12 ? ex : ex * 1000;
      this.save(); return;
    }
    throw new Error('LibreLinkUp kept redirecting — please try again later.');
  },

  async fetch(){
    if(!this.s.token || (this.s.exp && Date.now() > this.s.exp - 5*60000)) await this.login();
    if(!this.s.pid){
      const r = await this.req('GET', '/llu/connections');
      const list = r.j?.data || [];
      if(!list.length) throw new Error(`This LibreLinkUp account isn't following anyone yet — accept ${db.names.me}'s invitation in the LibreLinkUp app.`);
      this.s.pid = list[0].patientId; this.save();
    }
    let r = await this.req('GET', `/llu/connections/${this.s.pid}/graph`);
    if(r.status === 401 || r.j?.status === 401 || r.j?.status === 4){
      if(r.j?.status === 4) this.s.pid = null;           // follower link changed
      await this.login(); return this.fetch();
    }
    const c = r.j?.data?.connection, m = c?.glucoseMeasurement || c?.glucoseItem;
    if(!m) throw new Error('No reading from the sensor yet.');
    const history = (r.j.data.graphData || []).map(g => ({v:+g.ValueInMgPerDl, t:lluTime(g.FactoryTimestamp)})).filter(p => p.t);
    const now = {v:+m.ValueInMgPerDl, t:lluTime(m.FactoryTimestamp)};
    if(now.t && !history.some(p => p.t === now.t)) history.push(now);
    this.data = {value: now.v, trend: +m.TrendArrow || 0, at: now.t, history};
  },

  async tick(){
    if(!this.configured() || this.busy || Date.now() < this.pauseUntil) return;
    this.busy = true;
    try{ await this.fetch(); this.status = ''; }
    catch(e){ this.status = e.message || 'Could not reach LibreLinkUp.'; }
    this.busy = false;
    glucoseChanged();
  },
};

/* ---------- helpers ---------- */
let httpSeq = 0; const httpWaiting = {};
window.__httpDone = (id, status, text) => { const f = httpWaiting[id]; delete httpWaiting[id]; f && f({status, text}); };
// Inside the Android app requests go through the app (LibreLinkUp blocks in-page requests)
function httpCall(method, url, headers, body){
  if(NATIVE && NATIVE.http){
    const id = 'h' + (++httpSeq);
    return new Promise(res => { httpWaiting[id] = res; NATIVE.http(id, method, url, JSON.stringify(headers), body || ''); });
  }
  return fetch(url, {method, headers, body: body || undefined})
    .then(async r => ({status: r.status, text: await r.text()}))
    .catch(() => ({status: 0, text: 'Live blood sugar only works in the Fatade Kitchen tablet app.'}));
}
async function sha256Hex(s){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
}
// "11/1/2026 1:28:00 PM" (UTC) -> ms
function lluTime(s){
  const m = /^(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) ?(AM|PM)?/i.exec(s || ''); if(!m) return 0;
  let h = +m[4] % 12; if((m[7]||'').toUpperCase() === 'PM') h += 12; if(!m[7]) h = +m[4];
  return Date.UTC(+m[3], +m[1]-1, +m[2], h, +m[5], +m[6]);
}
const ARROWS = ['', '↓', '↘', '→', '↗', '↑'];
const TREND_WORDS = ['', 'falling fast', 'falling', 'steady', 'rising', 'rising fast'];

function glucoseState(){
  const d = LLU.data; if(!d) return null;
  const mins = Math.round((Date.now() - d.at) / 60000), stale = mins > 15;
  const lvl = stale ? 'stale' : d.value <= LLU.s.low ? 'low' : d.value >= LLU.s.high ? 'high' : 'ok';
  return {...d, mins, stale, lvl};
}

/* ---------- UI ---------- */
function sparkline(hist){
  const W = 600, H = 120, t1 = Date.now(), t0 = t1 - 12*3600000, lo = 40, hi = 300;
  const x = t => ((t - t0) / (t1 - t0)) * W, y = v => H - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * H;
  const pts = hist.filter(p => p.t >= t0).sort((a,b)=>a.t-b.t);
  const band = `<rect x="0" y="${y(LLU.s.high)}" width="${W}" height="${y(LLU.s.low)-y(LLU.s.high)}" class="gband"/>`;
  if(pts.length < 2) return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="gspark">${band}</svg>`;
  const last = pts[pts.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="gspark">${band}
    <polyline points="${pts.map(p=>`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" class="gline" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(last.t)}" cy="${y(last.v)}" r="5" class="gdot"/></svg>`;
}
function glucoseCardHtml(){
  if(!LLU.configured()) return '';
  const g = glucoseState(), who = esc(db.names.me);
  if(!g) return `<div class="gcard g-stale" id="gcard"><div class="gmeta">${who}'s blood sugar · <i>Ṣúgà ẹ̀jẹ̀</i></div>
    <div class="gmsg">${esc(LLU.status || 'Connecting to LibreLinkUp…')}</div></div>`;
  const ago = g.mins <= 0 ? 'just now' : g.mins === 1 ? '1 min ago' : g.mins < 90 ? `${g.mins} min ago` : `${Math.round(g.mins/60)} h ago`;
  const note = g.lvl === 'low' ? `⚠️ LOW — check on ${who} now` : g.lvl === 'high' ? 'Above range' : g.stale ? 'No new reading — sensor or phone may be out of range' : 'In range';
  return `<div class="gcard g-${g.lvl}" id="gcard">
    <div class="gtop"><div><div class="gmeta">${who}'s blood sugar · <i>Ṣúgà ẹ̀jẹ̀</i></div>
      <div class="gnow"><span class="gval">${Math.round(g.value)}</span><span class="garr">${ARROWS[g.trend]||''}</span><span class="gunit">mg/dL</span></div>
      <div class="gnote">${note} · ${TREND_WORDS[g.trend]||''} · ${ago}</div></div></div>
    ${sparkline(g.history)}
    <div class="gaxis"><span>12 h ago</span><span>range ${LLU.s.low}–${LLU.s.high}</span><span>now</span></div>
    ${LLU.status ? `<div class="gmsg">${esc(LLU.status)}</div>` : ''}</div>`;
}
function glucoseSaverHtml(){
  const g = LLU.configured() && glucoseState(); if(!g) return '';
  return `<div class="ss-gluc g-${g.lvl}">${esc(db.names.me)}: <b>${Math.round(g.value)}</b> ${ARROWS[g.trend]||''} mg/dL${g.stale?' (old)':''}</div>`;
}
function glucoseChanged(){
  const el = $('#gcard'); if(el) el.outerHTML = glucoseCardHtml();
  if(typeof Saver !== 'undefined' && Saver.on) Saver.paint();
  const st = $('#gStatus'); if(st) st.textContent = glucoseStatusText();
  const g = glucoseState();
  if(g && g.lvl === 'low' && Date.now() - LLU.lastAlert > 15*60000){
    LLU.lastAlert = Date.now();
    if(Saver.on) Saver.hide();
    if(view !== 'today'){ view = 'today'; render(); }
    const msg = `Attention. ${db.names.me}'s blood sugar is low: ${Math.round(g.value)}, ${TREND_WORDS[g.trend]||''}.`;
    toast('⚠️ ' + msg);
    if(LLU.s.alerts && typeof voice !== 'undefined' && !voice.active) voice.speak(msg);
  }
}
function glucoseStatusText(){
  if(!LLU.configured()) return 'Not connected.';
  const g = glucoseState();
  return LLU.status ? '⚠️ ' + LLU.status : g ? `✅ Connected — last reading ${Math.round(g.value)} mg/dL.` : 'Connecting…';
}
function glucoseSettingsHtml(){
  const s = LLU.s, who = esc(db.names.me);
  return `<h2 style="margin-top:28px">${who}'s blood sugar <span class="yo-h">Ṣúgà ẹ̀jẹ̀ · FreeStyle Libre</span></h2>
    <div class="card form">
      <div id="gStatus" style="font-weight:600">${esc(glucoseStatusText())}</div>
      <div class="muted">Sign in with <b>${esc(db.names.wife)}'s LibreLinkUp</b> account (the one following ${who}). It is saved on this tablet only.</div>
      <label>LibreLinkUp email<input type="email" id="gEmail" value="${esc(s.email||'')}" autocomplete="off"></label>
      <label>LibreLinkUp password<input type="password" id="gPw" placeholder="${s.pw ? '•••••••• (saved)' : ''}" autocomplete="off"></label>
      <div class="row"><label style="flex:1">Low below (mg/dL)<input type="text" inputmode="numeric" id="gLow" value="${s.low}"></label>
        <label style="flex:1">High above (mg/dL)<input type="text" inputmode="numeric" id="gHigh" value="${s.high}"></label></div>
      <div class="chips"><button class="chip ${s.alerts?'on':''}" id="gAlerts">🔊 Say it out loud when low</button></div>
      <div class="row"><button class="btn" id="gConnect">${LLU.configured() ? 'Save & reconnect' : 'Connect'}</button>
        ${LLU.configured() ? '<button class="btn warn" id="gOff">Disconnect</button>' : ''}</div>
      <div class="muted" style="font-size:15px">For awareness only — readings can lag a few minutes. Keep LibreLinkUp alarms on the phone. Uses the unofficial LibreLinkUp connection, which Abbott may change.</div>
    </div>`;
}
function bindGlucoseSettings(){
  $('#gAlerts').onclick = () => { LLU.s.alerts = !LLU.s.alerts; LLU.save(); $('#gAlerts').classList.toggle('on', LLU.s.alerts); };
  $('#gConnect').onclick = async () => {
    const email = $('#gEmail').value.trim(), pw = $('#gPw').value;
    if(!email || (!pw && !LLU.s.pw)){ toast('Enter the LibreLinkUp email and password.'); return; }
    const changed = email !== LLU.s.email || pw;
    LLU.s.email = email; if(pw) LLU.s.pw = pw;
    LLU.s.low = Math.max(40, parseInt($('#gLow').value) || 70); LLU.s.high = Math.min(400, parseInt($('#gHigh').value) || 180);
    if(changed){ LLU.s.token = null; LLU.s.pid = null; LLU.s.host = null; LLU.data = null; }
    LLU.save(); LLU.pauseUntil = 0;
    $('#gStatus').textContent = 'Connecting…';
    await LLU.tick(); render();
  };
  const off = $('#gOff'); if(off) off.onclick = () => {
    if(!confirm('Disconnect the blood sugar display?')) return;
    LLU.s = {low:LLU.s.low, high:LLU.s.high, alerts:LLU.s.alerts}; LLU.data = null; LLU.status = ''; LLU.save(); render();
  };
}
function glucoseInit(){
  LLU.load();
  LLU.tick();
  setInterval(() => LLU.tick(), 60000);            // Libre 3 sends a reading every minute
  setInterval(() => { const el = $('#gcard'); if(el) el.outerHTML = glucoseCardHtml(); }, 30000); // keep "x min ago" fresh
}
