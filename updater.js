/* One-tap Software Update (Settings → Software Update → Update Now).
   Covers the screen with a progress view, installs the website update and, if
   there is one, the tablet-app update (Android shows one "Update" confirmation for
   that — it requires it for every app outside the Play Store), then returns to
   Today with Settings locked. Website updates also install by themselves overnight. */

const FLOW_KEY = 'fatadeKitchen.updateFlow';
const appVersionName = c => c ? '1.' + Math.max(0, c - 1) : '—';     // build 4 = 1.3, 5 = 1.4 …

const UpdUI = {
  pct: 0, target: 0, timer: null,
  show(step, target){
    let el = $('#updOverlay');
    if(!el){
      el = document.createElement('div'); el.id = 'updOverlay';
      el.innerHTML = `<div class="upd-card">
        <div class="upd-logo"><svg viewBox="0 0 64 64" width="54" height="54"><path d="M14 34h36a18 18 0 0 1-36 0z" fill="#fff"/><path d="M24 14c0 6 4 6 4 12M32 12c0 6 4 6 4 12M40 14c0 6 4 6 4 12" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg></div>
        <h2 id="updTitle">Updating Fatade Kitchen</h2>
        <div class="upd-yo" id="updYo">Ẹ dúró díẹ̀ — please wait a moment</div>
        <div class="upd-bar"><span id="updFill"></span></div>
        <div class="upd-row"><span id="updStep"></span><span id="updPct">0%</span></div>
        <div class="upd-note" id="updNote">Keep the tablet on Wi-Fi. Don't close the app.</div>
        <button class="btn upd-btn" id="updBtn" hidden>OK</button></div>`;
      document.body.appendChild(el);
    }
    el.classList.add('on'); this.step(step, target);
    clearInterval(this.timer);
    this.timer = setInterval(() => {   // glide towards the current milestone
      if(this.pct < this.target) this.pct = Math.min(this.target, this.pct + Math.max(.4, (this.target - this.pct) / 18));
      $('#updFill').style.width = this.pct + '%'; $('#updPct').textContent = Math.round(this.pct) + '%';
    }, 60);
  },
  step(text, target){ $('#updStep').textContent = text; if(target !== undefined) this.target = target; },
  note(text){ $('#updNote').textContent = text; },
  finish(title, text, after){
    this.target = 100; this.step(text, 100); $('#updTitle').textContent = title; $('#updYo').textContent = 'Ó ti parí ✓';
    $('#updNote').textContent = '';
    setTimeout(() => { this.hide(); after && after(); }, 1800);
  },
  fail(text){
    $('#updTitle').textContent = "Couldn't update right now"; $('#updYo').textContent = ''; this.step(text);
    $('#updNote').textContent = 'Check the Wi-Fi and try again.';
    const b = $('#updBtn'); b.hidden = false; b.onclick = () => { this.hide(); localStorage.removeItem(FLOW_KEY); backToToday(); };
  },
  hide(){ clearInterval(this.timer); $('#updOverlay')?.classList.remove('on'); this.pct = 0; this.target = 0; },
};
function backToToday(){ if(typeof Lock !== 'undefined') Lock.close(); view = 'today'; render(); scrollTo(0, 0); }
const setFlow = v => { try{ v ? localStorage.setItem(FLOW_KEY, JSON.stringify({...v, at: Date.now()})) : localStorage.removeItem(FLOW_KEY); }catch(e){} };
const getFlow = () => { try{ const f = JSON.parse(localStorage.getItem(FLOW_KEY) || 'null'); return f && Date.now() - f.at < 10*60000 ? f : null; }catch(e){ return null; } };

async function latestAppInfo(){
  try{ return await fetch('app/version.json?t=' + Date.now(), {cache:'no-store'}).then(r => r.json()); }catch(e){ return null; }
}
// Wait for the downloaded website version to be ready to switch to
function waitForWaiting(reg, ms = 90000){
  return new Promise(res => {
    const t0 = Date.now(), tick = () => {
      if(reg.waiting) return res(reg.waiting);
      if(Date.now() - t0 > ms) return res(null);
      setTimeout(tick, 300);
    }; tick();
  });
}

async function runFullUpdate(){
  UpdUI.show('Checking for updates…', 15);
  if(Saver.on) Saver.hide();
  let webNew = false;
  try{ if(swReg){ await swReg.update(); webNew = !!(swReg.waiting || swReg.installing); } }catch(e){}
  const info = await latestAppInfo(), have = appVersionCode();
  const appNew = !!(NATIVE && info && info.versionCode > have);
  if(!webNew && !appNew){
    return UpdUI.finish("You're up to date", `Fatade Kitchen ${appVersion || ''} is the latest.`, () => { setFlow(null); backToToday(); });
  }
  if(webNew){
    UpdUI.step('Downloading the new version…', 60);
    const w = await waitForWaiting(swReg);
    if(!w) return UpdUI.fail('The download did not finish.');
    UpdUI.step('Installing…', 85);
    setFlow({stage: appNew ? 'app' : 'done'});
    updating = true; w.postMessage('skipWaiting');       // page reloads into the new version, then continueUpdate()
    return;
  }
  installAppStage(info);
}

function installAppStage(info){
  UpdUI.show(`Downloading the tablet app ${info.versionName}…`, 55);
  setFlow({stage: 'app-wait', code: info.versionCode});
  window.__appUpdate = s => {
    if(s === 'downloading') UpdUI.step('Downloading the tablet app…', 70);
    else if(s === 'confirm'){ UpdUI.step('Tap “Update” on the Android box to finish', 92); UpdUI.note('Android asks once for every app update — the app restarts by itself.'); }
    else if(s === 'permission'){ UpdUI.step('One-time setting needed', 60); UpdUI.note('Turn on “Allow from this source” for Fatade Kitchen, come back, and tap Update Now again.'); setFlow(null);
      const b = $('#updBtn'); b.hidden = false; b.textContent = 'OK'; b.onclick = () => { UpdUI.hide(); backToToday(); }; }
    else if(s === 'done') UpdUI.step('Finishing…', 100);
    else { setFlow(null); UpdUI.fail(String(s).replace(/^error:/, '')); }
  };
  if(NATIVE.installUpdate) NATIVE.installUpdate(APP_APK);
  else { UpdUI.note('This older app opens the download in the browser — tap the download, then Install.'); location.href = APP_APK_DIRECT; }
}

// After the reload (or the app restart) — finish the job
async function continueUpdate(){
  const f = getFlow(); if(!f) return;
  if(f.stage === 'app'){
    UpdUI.show('Website updated — checking the tablet app…', 50);
    const info = await latestAppInfo();
    if(NATIVE && info && info.versionCode > appVersionCode()) return installAppStage(info);
  }
  if(f.stage === 'app-wait' && NATIVE && appVersionCode() < (f.code || 0)){
    // App wasn't replaced (box dismissed) — nothing more to do automatically
    setFlow(null); return;
  }
  UpdUI.show('Finishing…', 90);
  setFlow(null);
  setTimeout(() => UpdUI.finish('Updated ✓', `Fatade Kitchen ${appVersion || ''}${NATIVE ? ` · tablet app ${appVersionName(appVersionCode())}` : ''}`, backToToday), 600);
}

// Website updates install by themselves at night when nobody is using the tablet
function overnightUpdate(){
  if(db.home.autoUpdate === false || !swReg) return;
  const h = new Date().getHours(); if(h < 2 || h >= 5) return;
  if(Date.now() - Saver.last < 20*60000) return;                     // someone used it recently
  swReg.update().catch(() => {}).then(() => { if(swReg.waiting){ setFlow({stage:'done'}); updating = true; swReg.waiting.postMessage('skipWaiting'); } });
}

function updateCardHtml(){
  const code = appVersionCode();
  return `<div class="card upd-settings">
    <div class="us-top"><span class="us-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg></span>
      <div style="flex:1"><b>Software Update</b><small>Fatade Kitchen ${esc(appVersion || '—')}${NATIVE ? ` · tablet app ${appVersionName(code)}` : ''}</small></div>
      <button class="btn us-btn" id="updNow">Update Now</button></div>
    <div class="us-auto"><button class="chip ${db.home.autoUpdate === false ? '' : 'on'}" id="updAuto">🌙 Install updates automatically overnight</button></div>
  </div>`;
}
function bindUpdateCard(){
  $('#updNow').onclick = runFullUpdate;
  $('#updAuto').onclick = () => { db.home.autoUpdate = db.home.autoUpdate === false; save(); render(); };
}
function updaterInit(){
  continueUpdate();
  setInterval(overnightUpdate, 5*60000);
}
