/* Real photos of each meal, from Wikimedia Commons (free licences; credits are on
   the Meals page). The service worker keeps a copy so photos still show offline.
   A meal without a photo, or a photo that fails to load, falls back to its emoji. */

// id: [Commons file name, author, licence]. "asun" is left out on purpose (unclear source).
const PHOTO_LIST = {
  'moimoi-egg':['Moi moi with fresh fish and boiled egg.jpg','Bukky658','CC BY-SA 4.0'],
  'egg-plantain':['Boiled Plantain with Egg Sauce.jpg','James Moore200','CC BY-SA 4.0'],
  'veg-omelette':['Bell Pepper Omelette kolkata West Bengal 03.jpg','Sgsamrat2021','CC BY-SA 4.0'],
  'okpa':['Okpa (A traditional Igbo steamed delicacy).jpg','Confidence24','CC BY-SA 4.0'],
  'oats-nuts':['Oatmeal with Berries.jpg','Clarissa Savel','CC BY-SA 4.0'],
  'akara-pap':['Pap and Akara.jpg','Aderiqueza','CC BY-SA 4.0'],
  'yam-egg':['Boiled yam and egg sauce.jpg','Sunday Glory','CC BY-SA 4.0'],
  'bread-egg':['Liat Portal for Foodie Disorder – Fried Egg on Whole Grain Bread with Fresh Vegetables.jpg','HaJunkiyada','CC BY-SA 4.0'],
  'custard':['CUSTARD PAP.jpg','Salma kyari','CC0'],
  'indomie-egg':['Indomie and egg.jpg','Jidda3711','CC0'],
  'pancakes':['Pancake, Egg, and Sausage.jpg','Ralff Nestor Nacor','CC BY-SA 4.0'],
  'sweet-potato-egg':['Boiled sweet Potatoes and carrot with vegetable fish sauce.jpg','Halima Waziri','CC BY-SA 4.0'],
  'jollof-chicken':['A plate of jollof rice and chicken.jpg','Obaniyi covenant','CC BY-SA 4.0'],
  'fried-rice':['Fried Rice and Fried Plantain aka dodo.jpg','Deemayjee','CC BY-SA 4.0'],
  'jollof-spag':['Fish spaghetti jollof.jpg','Halima Waziri','CC BY-SA 4.0'],
  'meatpie':['Meat pie in Northern Nigeria.jpg','Zahraswaty','CC BY-SA 4.0'],
  'sandwich':['Liat Portal for Foodie Disorder - Egg sandwich with fresh vegetables.jpg','HaJunkiyada','CC BY-SA 4.0'],
  'plantain-beans':['Beans and plantain (African good).jpg','Beendy234','CC BY-SA 4.0'],
  'yam-chips':['Nigerian Small Chops.jpg','Taoheedah','CC BY-SA 4.0'],
  'puffpuff-snack':['Puff Puff.jpg','Halima Waziri','CC BY-SA 4.0'],
  'beans-unripe':['Beans and plantain porridge with dried fish.jpg','Bukky658','CC BY-SA 4.0'],
  'fish-salad':['Grilled fish in Northern Nigeria.jpg','Zahraswaty','CC BY-SA 4.0'],
  'chicken-veg':['Peppered Chicken.jpg','Aderiqueza','CC BY-SA 4.0'],
  'cauli-fried':['Easy Fried Cauliflower Rice-1 (31717741910).jpg','Sharon Chen','CC BY 2.0'],
  'ofada-small':['Rice and Ayamase sauce.jpg','Taoheedah','CC BY-SA 4.0'],
  'brown-jollof':['Jollof rice and turkey.jpg','Olohunkemi Bushiro','CC0'],
  'moimoi-salad':['Moi Moi and fried plantain with side pasta salad.jpg','Nancy Nwachukwu','CC BY-SA 4.0'],
  'gizdodo-lite':['Peppered gizzards.jpg','Xtacywura','CC BY-SA 4.0'],
  'efo-swallow':['Efo riro and pounded yam.jpg','Atimukoh','CC BY-SA 4.0'],
  'egusi-swallow':['Egusi soup with pounded yam and assorted meats.jpg','Onyenachi64','CC BY-SA 4.0'],
  'okra-swallow':['Eba and Okra Soup.jpg','Halima Waziri','CC BY-SA 4.0'],
  'ogbono':['Ogbono soup with swallow.jpg','Fatimah Bello','CC BY-SA 4.0'],
  'edikaikong':['Edikang ikong.jpg','Aderiqueza','CC BY-SA 4.0'],
  'banga':['Eba served with Fresh fish banga soup in a clay pot.jpg','Justdifference','CC BY-SA 4.0'],
  'stew-rice':['White rice and stew with fish in White plate.jpg','Halima Waziri','CC BY-SA 4.0'],
  'asaro':['Asaro ( Yam Porridge).jpg','Oyebolaesther','CC BY-SA 4.0'],
  'pepper-soup':['Spicy Goat meat pepper soup.jpg','Halima Waziri','CC BY-SA 4.0'],
  'chicken-stew-plantain':['Spicy Tomato Chicken Stew.jpg','NiferO','CC BY-SA 4.0'],
  'eggs-cucumber':['Liat Portal for Foodie Disorder - Israeli vegetable plate with hard boiled egg and Tzfatit cheese.jpg','HaJunkiyada','CC BY-SA 4.0'],
  'nuts-gardenegg':['PXL 20230219 141725959.NIGHT.jpg','Stephanie cheks','CC BY-SA 4.0'],
  'soup-only':['Egusi soup in a plate.jpg','Tesleemah','CC BY-SA 4.0'],
  'suya-salad':['Nigerian Beef-Suya.jpg','Ooreoluwa4578420','CC0'],
  'yoghurt-tiger':['Tigernuts.jpg','Halima Waziri','CC BY-SA 4.0'],
  'abula':['Amala and Gbegiri with Ewedu soup.jpg','Bukky658','CC BY-SA 4.0'],
  'plantain-amala':['Plantain Fufu.jpg','Enoch Appiah jr.','CC BY-SA 4.0'],
  'ewa-agoyin':['Ewa Aganyin (Bean).jpg','Radiant04','CC BY-SA 4.0'],
  'ikokore':['Water Yam Porridge 03.jpg','Psalmbusy','CC BY-SA 4.0'],
  'ila-alasepo':['Okro soup with beef and Seafoods.jpg','Bukky658','CC BY-SA 4.0'],
  'ekuru':['Ekuru and ata din din.jpg','Atimukoh','CC BY-SA 4.0'],
  'ata-dindin-plantain':['Tasty Pepper Sauce.jpg','BishopNana','CC BY 4.0'],
  'boli-epa':['Roasted plantain with groundnut.jpg','Edithobayaa1','CC BY-SA 4.0'],
  'garden-egg-stew':['Boiled plantain and garden egg stew.jpg','Maame1Yaa','CC BY-SA 4.0'],
  'ojojo':['Ọ̀jọ̀jọ̀ (Yam Fritters).jpg','Aderiqueza','CC BY-SA 4.0'],
  'scotch-eggs':['Cameroonian scotch eggs 01.jpg','Black Lyn','CC BY-SA 4.0'],
  'coconut-rice':['Coconut rice and chicken.jpg','Fatimah Bello','CC0'],
  'chicken-shawarma':['Nigerian shawarma (cropped).jpg','Omar 180','CC BY 3.0'],
  'unripe-plantain-porridge':['Unripe plantain porridge.jpg','Nancy Nwachukwu','CC BY-SA 4.0'],
  'cauli-jollof':['Jollof rice with chicken and cauliflower.jpg','Halima Waziri','CC BY-SA 4.0'],
  'peppered-croaker':['Peppered Grilled fish with fried Irish, ketchup and lemon.jpg','Halima Waziri','CC BY-SA 4.0'],
  'chicken-suya':['Suya chicken meat.jpg','MOIBARDE','CC BY-SA 4.0'],
  'afang-soup':['Soup (Afang) and swallow (fufu). (Nigerian cuisine).jpg','Beendy234','CC BY-SA 4.0'],
  'groundnut-soup':['Banku and groundnut soup.jpg','Kwameghana','CC BY-SA 4.0'],
  'db-oatmeal':['Blueberry oatmeal.jpg','Shisma','CC BY 4.0'],
  'db-avocado-toast':['Smashed avocado & poached eggs - M&S Café 2023-12-28.jpg','Andy Li','CC0'],
  'db-parfait':['Child Care Recipes (Team Nutiriton) (20211231-FNS-UNC-0031).jpg','USDAgov','Public domain'],
  'db-veggie-omelet':['Omlette-fold.jpg','Masoud Shafaee','CC BY-SA 3.0'],
  'db-green-smoothie':['Green Smoothie.jpg','Annapowell','CC BY-SA 4.0'],
  'db-cottage-bowl':['Child Care Recipes (Team Nutiriton) (20230123-FNS-UNK-002).jpg','USDAgov','Public domain'],
  'db-chia-pudding':['Chia Pudding.PNG','Sarahchoe','CC BY-SA 4.0'],
  'db-pancakes':['Oatmeal pancake with fruit.jpg','Drhnn','CC BY 4.0'],
  'db-tofu-scramble':['Tofu Scramble in New Orleans.jpg','Bart Everson','CC BY 2.0'],
  'db-overnight-oats':['Protein overnight oats.jpg','Nervy8924','CC BY-SA 4.0'],
  'db-smoothie-bowl':['Smoothie bowl.jpg','Marife.altabano','CC BY-SA 4.0'],
  'db-nut-muffin':['Peanut butter and marmalade on toasted English muffins - Massachusetts.jpg','Daderot','CC0'],
  'db-egg-plate':['Boiled Eggs and Tomato slices meal.jpg','MmaBaggio','CC BY-SA 4.0'],
  'db-fruit-nut-bowl':['Healthy Breakfast - Homamade - Assam - DSC 003.jpg','Gitika Gayan','CC BY-SA 4.0'],
  'db-turkey-wrap':['Turkey wrap from Spangles restaurant.jpg','Ser Amantio di Nicolao','CC BY-SA 4.0'],
  'db-apple-yogurt':['Yoghurt met appelmoes en walnoten 2025.jpg','JopkeB','CC BY-SA 4.0'],
};
const MEAL_PHOTOS = Object.fromEntries(Object.entries(PHOTO_LIST).map(([id, [file, author, license]]) =>
  [id, {file, author, license, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'))}]));

const photoUrl = (m, w = 480) => MEAL_PHOTOS[m.id]
  ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(MEAL_PHOTOS[m.id].file)}?width=${w}` : '';

// Square photo tile with the emoji underneath as a fallback
function mealPic(m, cls = ''){
  const u = photoUrl(m);
  return `<span class="mpic ${cls} ${u ? '' : 'noimg'}"><span class="mpic-em">${m.em}</span>${u
    ? `<img src="${u}" alt="${esc(m.name)}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}</span>`;
}

/* Large preview shown while choosing a meal (picker and kids' vote) */
function bigPreviewHtml(m, {cost = null, tip = false, action = '', actionId = 'pvGo', extra = ''} = {}){
  if(!m) return `<div class="pv-empty">Tap a meal to see it big 👀</div>`;
  const u = photoUrl(m, 1000), yo = yoName(m);
  return `<div class="pv-photo ${u ? '' : 'noimg'}" data-howto="${m.id}">
      <span class="pv-em">${m.em}</span>
      ${u ? `<img src="${u}" alt="${esc(m.name)}" decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}
      <div class="pv-cap"><div class="pv-en">${esc(m.name)}</div>${yo ? `<div class="pv-yo">${esc(yo)}</div>` : ''}</div>
    </div>
    <div class="pv-info">
      <div class="food-tags">${m.k ? '<span class="tag t-k">Kids love it</span>' : ''}${m.d ? '<span class="tag t-d">Sugar-friendly</span>' : ''}${m.p ? '<span class="tag t-p">Packs well</span>' : ''}${cost !== null ? `<span class="tag t-c">≈ ${money(cost)}</span>` : ''}
        <span class="rlink" data-howto="${m.id}">📖 Recipe & video</span></div>
      ${tip && m.tip ? `<div class="pv-tip">💚 ${esc(m.tip)}</div>` : ''}
      ${extra}
      ${action ? `<button class="btn pv-go" id="${actionId}">${action}</button>` : ''}
    </div>`;
}

function photoCreditsHtml(){
  const used = allMeals().filter(m => MEAL_PHOTOS[m.id]);
  if(!used.length) return '';
  return `<details class="credits"><summary>📷 Photo credits (Wikimedia Commons)</summary>
    <ul>${used.map(m => { const p = MEAL_PHOTOS[m.id];
      return `<li><a href="${p.page}" target="_blank" rel="noopener">${esc(m.name)}</a> — ${esc(p.author || 'unknown')}, ${esc(p.license || '')}</li>`; }).join('')}</ul></details>`;
}
