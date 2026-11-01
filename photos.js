/* Real photos of each meal, from Wikimedia Commons (free licences; credits are on
   the Meals page). The service worker keeps a copy so photos still show offline.
   A meal without a photo, or a photo that fails to load, falls back to its emoji. */

const MEAL_PHOTOS = {};   // filled below: id -> {file, author, license, page}

const photoUrl = (m, w = 480) => MEAL_PHOTOS[m.id]
  ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(MEAL_PHOTOS[m.id].file)}?width=${w}` : '';

// Square photo tile with the emoji underneath as a fallback
function mealPic(m, cls = ''){
  const u = photoUrl(m);
  return `<span class="mpic ${cls} ${u ? '' : 'noimg'}"><span class="mpic-em">${m.em}</span>${u
    ? `<img src="${u}" alt="${esc(m.name)}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}</span>`;
}

function photoCreditsHtml(){
  const used = allMeals().filter(m => MEAL_PHOTOS[m.id]);
  if(!used.length) return '';
  return `<details class="credits"><summary>📷 Photo credits (Wikimedia Commons)</summary>
    <ul>${used.map(m => { const p = MEAL_PHOTOS[m.id];
      return `<li><a href="${p.page}" target="_blank" rel="noopener">${esc(m.name)}</a> — ${esc(p.author || 'unknown')}, ${esc(p.license || '')}</li>`; }).join('')}</ul></details>`;
}
