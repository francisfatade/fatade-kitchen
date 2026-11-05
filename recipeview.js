/* Recipe screen: tap any meal (anything with data-howto="<meal id>") to see its
   photo, how-to video, ingredients and steps. It opens above everything else and
   closes back to wherever you were. Recipes are in howto.js, videos in videos.js. */

// Tablet apps before 1.5 (versionCode 6) send in-page videos out to the browser
const canEmbedVideo = () => !NATIVE || appVersionCode() >= 6;
const youtubeSearch = m => 'https://www.youtube.com/results?search_query=' +
  encodeURIComponent('how to make ' + m.name.replace(/[()]/g, ''));

function videoHtml(m, v){
  if(!v) return `<a class="rv-more" href="${youtubeSearch(m)}" target="_blank" rel="noopener">▶ Find a video on YouTube</a>`;
  const watch = `https://www.youtube.com/watch?v=${v.v}`;
  return `<button class="rv-video" id="rvPlay" data-v="${esc(v.v)}" data-watch="${watch}">
      <img src="https://i.ytimg.com/vi/${esc(v.v)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">
      <span class="rv-play">▶</span></button>
    <div class="rv-vt">${esc(v.t)}${v.c ? ` <span class="muted">· ${esc(v.c)}</span>` : ''}</div>`;
}

function openRecipe(id){
  const m = mealById(id); if(!m) return;
  const h = typeof HOWTO !== 'undefined' ? HOWTO[id] : null, v = typeof VIDEOS !== 'undefined' ? VIDEOS[id] : null;
  const u = photoUrl(m, 1000), yo = yoName(m), link = recipeOf(m), ing = h ? h.ing : m.ing;
  let el = $('#recipe'); if(!el){ el = document.createElement('div'); el.id = 'recipe'; document.body.appendChild(el); }
  el.innerHTML = `<div class="rv-bar"><button class="iconbtn lg" id="rvClose" aria-label="Close">✕</button></div>
    <div class="rv-body">
      <div class="pv-photo ${u ? '' : 'noimg'}"><span class="pv-em">${m.em}</span>
        ${u ? `<img src="${u}" alt="${esc(m.name)}" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}
        <div class="pv-cap"><div class="pv-en">${esc(m.name)}</div>${yo ? `<div class="pv-yo">${esc(yo)}</div>` : ''}</div></div>
      <div class="food-tags rv-tags">${h?.time ? `<span class="tag">⏱ ${esc(h.time)}</span>` : ''}${h?.serves ? `<span class="tag">🍽 Serves ${esc(h.serves)}</span>` : ''}${m.d ? '<span class="tag t-d">Sugar-friendly</span>' : ''}${m.k ? '<span class="tag t-k">Kids love it</span>' : ''}${m.p ? '<span class="tag t-p">Packs well</span>' : ''}</div>
      ${m.tip ? `<div class="pv-tip">💚 ${esc(m.tip)}</div>` : ''}
      ${m.prep ? `<div class="pv-tip">🫙 ${esc(m.prep)}</div>` : ''}
      <h2 class="sec">Watch how</h2>${videoHtml(m, v)}
      <h2 class="sec">Ingredients</h2>
      ${ing.length ? `<div class="card shop rv-ing">${ing.map(g => `<label><input type="checkbox"><span>${esc(g)}</span></label>`).join('')}</div>` : '<div class="card muted">Nothing extra to buy.</div>'}
      <h2 class="sec">How to make it</h2>
      ${h ? `<ol class="rv-steps">${h.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<div class="card muted">No written steps for this meal yet.</div>'}
      ${link ? `<a class="rv-more" href="${link}" target="_blank" rel="noopener">📖 Open the full recipe online</a>` : ''}
    </div>`;
  el.classList.add('on'); el.scrollTop = 0;
  $('#rvClose').onclick = closeRecipe;
  const p = $('#rvPlay'); if(p) p.onclick = () => {
    if(!canEmbedVideo()){ location.href = p.dataset.watch; return; }
    const f = document.createElement('iframe'); f.className = 'rv-frame';
    f.src = `https://www.youtube-nocookie.com/embed/${p.dataset.v}?autoplay=1&rel=0&playsinline=1&fs=0`;
    f.allow = 'autoplay; encrypted-media'; f.referrerPolicy = 'strict-origin-when-cross-origin';
    p.replaceWith(f);
  };
}
function closeRecipe(){ const el = $('#recipe'); if(el){ el.classList.remove('on'); el.innerHTML = ''; } }   // clearing it stops the video
const recipeOpen = () => !!$('#recipe.on');

// Capture phase, so tapping a recipe link inside a meal card doesn't also open the picker
document.addEventListener('click', e => {
  if(e.target.closest('[data-del]')) return;
  const t = e.target.closest('[data-howto]'); if(!t) return;
  e.preventDefault(); e.stopPropagation(); openRecipe(t.dataset.howto);
}, true);
