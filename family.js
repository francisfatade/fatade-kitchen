/* Family photos, branded background, screensaver and screen rotation.
   Photos are kept ONLY on this device (IndexedDB) — they are never uploaded,
   and this public website contains no family pictures. */

const look = () => db.look ||= {bg:null, saverMin:3};
const NATIVE = window.AndroidApp || null;   // present inside the installed Android app

/* ---------- Photo store ---------- */
const Photos = {
  dbp: null, urls: [],
  open(){
    return this.dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open('fatade-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', {keyPath:'id'});
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn){
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction('photos', mode), out = fn(t.objectStore('photos'));
      t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error);
    });
  },
  async load(){
    try{
      const list = await this.tx('readonly', s => s.getAll());
      this.urls.forEach(p => URL.revokeObjectURL(p.url));
      this.urls = (list||[]).sort((a,b)=>a.id-b.id).map(p => ({id:p.id, url:URL.createObjectURL(p.blob)}));
    }catch(e){ this.urls = []; }
    return this.urls;
  },
  add: blob => Photos.tx('readwrite', s => s.put({id:Date.now()+Math.random(), blob})),
  remove: id => Photos.tx('readwrite', s => s.delete(id)),
  bgUrl(){ const l = look(); return (this.urls.find(p=>p.id===l.bg) || this.urls[0] || {}).url || ''; },
};

// Phone photos are huge; store a screen-sized JPEG instead (also fixes sideways photos)
async function shrinkPhoto(file, max=1920){
  let img;
  try{ img = await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch(e){ img = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); }); }
  const s = Math.min(1, max/Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', .85));
}

/* ---------- Branding ---------- */
function applyBackdrop(){
  const url = Photos.bgUrl();
  document.body.classList.toggle('has-photo', !!url);
  $('#backdrop').style.backgroundImage = url ? `url("${url}")` : '';
}
function heroHtml(){
  const url = Photos.bgUrl();
  return `<div class="hero ${url?'':'nophoto'}" ${url?`style="background-image:url('${url}')"`:''}>
    <div class="hero-txt"><div class="hero-title">The Fatade Family</div>
      <div class="hero-sub">Ìdílé Fatade · ${greeting()}!</div>
      ${url ? '' : `<button class="btn" id="heroAdd">📷 Add family photos</button>`}</div></div>`;
}

/* ---------- Screensaver ---------- */
const Saver = {
  last: Date.now(), on: false, i: 0, timer: null,
  poke(){ Saver.last = Date.now(); if(Saver.on) Saver.hide(); },
  busy(){ return $('#scrim').classList.contains('on') || (typeof voice!=='undefined' && voice.active) || document.activeElement?.tagName==='INPUT'; },
  check(){
    const m = look().saverMin;
    if(!Saver.on && m && Date.now()-Saver.last > m*60000 && !Saver.busy()) Saver.show();
  },
  show(){
    Saver.on = true; Saver.i = 0;
    const el = $('#saver'); el.classList.add('on');
    Saver.paint(); Saver.slide();
    clearInterval(Saver.timer); Saver.timer = setInterval(() => { Saver.paint(); Saver.slide(); }, 12000);
  },
  hide(){ Saver.on = false; clearInterval(Saver.timer); $('#saver').classList.remove('on'); },
  slide(){
    const pics = Photos.urls, layers = document.querySelectorAll('#saver .ss-img');
    if(!pics.length){ layers.forEach(l=>l.classList.remove('show')); return; }
    const next = layers[Saver.i % 2], prev = layers[(Saver.i+1) % 2];
    next.style.setProperty('--img', `url("${pics[Saver.i % pics.length].url}")`);
    next.classList.remove('show'); void next.offsetWidth; next.classList.add('show'); prev.classList.remove('show');
    Saver.i++;
  },
  paint(){
    const now = new Date(), d = todayIdx(), wk = weekKey(0);
    const dn = mealById(getPick(wk,d,'dinner')||''), lp = mealById(getPick(wk,d,'meLate')||'');
    $('#saver .ss-info').innerHTML = `
      <div class="ss-time">${now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</div>
      <div class="ss-date">${fmtDate(now)} · <i>${DAYS_YO[d]}</i></div>
      <div class="ss-greet">${greeting()}, Ìdílé Fatade</div>
      ${dn ? `<div class="ss-meal">Tonight · <i>Oúnjẹ alẹ́</i>: ${dn.em} ${esc(dn.name)}</div>` : ''}
      ${lp ? `<div class="ss-meal">${esc(db.names.me)}'s late plate: ${lp.em} ${esc(lp.name)}</div>` : ''}`;
  },
};

/* ---------- Settings section ---------- */
function displaySettingsHtml(){
  const l = look(), o = NATIVE ? NATIVE.getOrientation() : '';
  return `<h2 style="margin-top:28px">Family photos <span class="yo-h">Àwòrán ìdílé</span></h2>
    <div class="card">
      <div class="photos">${Photos.urls.map(p=>`<div class="ph ${p.id===l.bg || (!l.bg && p===Photos.urls[0])?'bg':''}" style="background-image:url('${p.url}')">
        <button class="chip" data-bg="${p.id}" title="Use as background">★</button><button class="chip" data-rmph="${p.id}" title="Remove">✕</button></div>`).join('')}
        <label class="ph add">＋<span>Add photos</span><input type="file" id="phIn" accept="image/*" multiple hidden></label></div>
      <div class="muted" style="margin-top:10px">★ = background photo. Photos stay on this tablet only — they are never uploaded.</div>
    </div>
    <h2 style="margin-top:28px">Screensaver</h2>
    <div class="card row">
      <span>Show photos after</span>
      <div class="chips">${[[0,'Off'],[1,'1 min'],[3,'3 min'],[5,'5 min'],[10,'10 min']].map(([v,t])=>`<button class="chip ${l.saverMin===v?'on':''}" data-saver="${v}">${t}</button>`).join('')}</div>
      <button class="btn ghost" id="saverPrev">Preview</button>
    </div>
    ${NATIVE ? `<h2 style="margin-top:28px">Screen</h2>
    <div class="card row"><span>Rotation</span><div class="chips">
      ${[['auto','🔄 Auto-rotate'],['portrait','▯ Portrait'],['landscape','▭ Landscape']].map(([v,t])=>`<button class="chip ${o===v?'on':''}" data-orient="${v}">${t}</button>`).join('')}
    </div></div>` : ''}`;
}
function bindDisplaySettings(){
  $('#phIn').onchange = async e => {
    const files = [...e.target.files]; if(!files.length) return;
    $('#updMsg') && ($('#updMsg').textContent = '');
    for(const f of files){ try{ await Photos.add(await shrinkPhoto(f)); }catch(err){ alert('Could not add one of the photos.'); } }
    await Photos.load(); applyBackdrop(); render();
  };
  document.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => { look().bg = +b.dataset.bg; save(); applyBackdrop(); render(); });
  document.querySelectorAll('[data-rmph]').forEach(b => b.onclick = async () => {
    if(!confirm('Remove this photo from the tablet?')) return;
    const id = +b.dataset.rmph; await Photos.remove(id); if(look().bg===id) look().bg = null; save();
    await Photos.load(); applyBackdrop(); render();
  });
  document.querySelectorAll('[data-saver]').forEach(b => b.onclick = () => { look().saverMin = +b.dataset.saver; save(); render(); });
  $('#saverPrev').onclick = () => Saver.show();
  document.querySelectorAll('[data-orient]').forEach(b => b.onclick = () => { NATIVE.setOrientation(b.dataset.orient); render(); });
}

/* ---------- Start-up ---------- */
function familyInit(){
  ['pointerdown','keydown','touchstart'].forEach(ev => addEventListener(ev, Saver.poke, {passive:true, capture:true}));
  setInterval(Saver.check, 15000);
  // Android back button (installed app): close pop-ups, then go Home
  window.__back = () => { if(Saver.on) Saver.hide(); else if($('#scrim').classList.contains('on')) closePicker(); else { view='today'; render(); } };
  matchMedia('(orientation: portrait)').addEventListener('change', () => { if(view==='week') render(); });
  Photos.load().then(() => { applyBackdrop(); if(view==='today' || view==='settings') render(); });
}
