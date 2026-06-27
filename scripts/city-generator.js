/**
 * WorldForge – city-generator.js
 *
 * Generator voor steden en dorpen.
 * Brengt alle bestaande WorldForge generators samen in één overzicht.
 */

import { generateNPC }                          from "./npc-generator.js";
import { generateInn, renderInnCard }            from "./inn-generator.js";
import { generateTavern, renderTavernCard }      from "./tavern-generator.js";
import { WorldForgeSettings }                    from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { escapeHtml, escapeAttr, wfSectionHeader, wfBadge } from "./utils.js";

const wft = (key) => WorldForgeSettings.t(key);

/**
 * Helper: genereert de juiste button of span voor een district building
 */
function buildingButton(building) {
  const name = building.name ?? "";
  if (building.shopType) {
    return `<button class="wf-city-shop-btn" data-shop-type="${escapeAttr(building.shopType)}" title="Genereer ${escapeAttr(name)}"><i class="fas fa-store"></i> ${escapeHtml(name)}</button>`;
  }
  if (building.poiId) {
    return `<button class="wf-city-shop-btn" data-poi-id="${escapeAttr(building.poiId)}" title="Genereer ${escapeAttr(name)}"><i class="fas fa-landmark"></i> ${escapeHtml(name)}</button>`;
  }
  if (building.stallCategory) {
    return `<button class="wf-city-shop-btn" data-stall-category="${escapeAttr(building.stallCategory)}" title="Genereer ${escapeAttr(name)}"><i class="fas fa-shop"></i> ${escapeHtml(name)}</button>`;
  }
  if (building.houseType) {
    return `<button class="wf-city-shop-btn" data-house-type="${escapeAttr(building.houseType)}" title="Genereer ${escapeAttr(name)}"><i class="fas fa-home"></i> ${escapeHtml(name)}</button>`;
  }
  if (building.factionType) {
    return `<button class="wf-city-shop-btn" data-faction-type="${escapeAttr(building.factionType)}" title="Genereer ${escapeAttr(name)}"><i class="fas fa-shield-alt"></i> ${escapeHtml(name)}</button>`;
  }
  return `<span class="wf-city-building-plain">${escapeHtml(name)}</span>`;
}

function wfNpcItem(npc) {
  const lang     = (typeof game !== "undefined"
    ? (game.settings?.get("world-forge-generator", "generatorLanguage") ?? "nl")
    : "nl");
  const role     = lang === "en" ? (npc.job?.en ?? npc.job?.nl ?? "") : (npc.job?.nl ?? "");
  const raceName = lang === "en" ? (npc.race?.en ?? npc.race?.nl ?? "") : (npc.race?.nl ?? "");
  const sexName  = lang === "en" ? (npc.sex?.en  ?? npc.sex?.nl  ?? "") : (npc.sex?.nl  ?? "");
  const ageLabel = lang === "en" ? `${String(npc.age)} yrs` : `${String(npc.age)} jr`;
  const npcJson  = escapeAttr(JSON.stringify(npc));
  const codexBtn = (typeof game !== "undefined" && game.modules?.get("campaign-codex")?.active)
    ? `<button class="wf-btn wf-btn-green wf-npc-to-codex" data-npc="${npcJson}" title="Opslaan in Campaign Codex"><i class="fas fa-atlas"></i></button>`
    : "";
  return `
<div class="wf-npc-item">
  <div class="wf-npc-item-top">
    <div class="wf-npc-item-meta">
      <strong>${escapeHtml(npc.name)}</strong>
      <span class="wf-npc-role">
        · ${escapeHtml(raceName)}
        ${sexName ? `· ${escapeHtml(sexName)}` : ""}
        · ${escapeHtml(ageLabel)}
        ${role ? `· <em style="font-style:normal;">${escapeHtml(role)}</em>` : ""}
      </span>
    </div>
    <div class="wf-npc-item-actions">
      <button class="wf-btn wf-btn-red wf-npc-to-actor" data-npc="${npcJson}" title="Maak Actor aan"><i class="fas fa-masks-theater"></i></button>
      ${codexBtn}
    </div>
  </div>
  <em>${escapeHtml(npc.cinematic)}</em>
</div>`;
}

// =============================================================================
// DATA LOADER — nu via DataLoader
// =============================================================================

/**
 * Kiest 1-3 dominante rassen voor de stad op basis van gecombineerde gewichten
 * van cityType en biome raceWeights × het basisgewicht uit races.json.
 * Geeft terug: { dominant: [race, race?], minority: race? }
 * @param {object[]} races     – alle rassen uit races.json
 * @param {object}   cityType  – het gekozen city type
 * @param {object}   biome     – het gekozen biome
 * @returns {object}
 */
function rollPopulationRaces(races, cityType, biome) {
  // Alleen ingeschakelde rassen
  const pool = races
    .filter(r => r.enabled !== false)
    .map(r => {
      const base     = r.weight ?? 1;
      const cityMult = cityType?.raceWeights?.[r.id] ?? 1.0;
      const biomeMult = biome?.raceWeights?.[r.id]  ?? 1.0;
      return { ...r, _weight: base * cityMult * biomeMult };
    })
    .filter(r => r._weight > 0);

  // Gewogen pick zonder teruglegging
  function weightedPick(candidates) {
    const total = candidates.reduce((s, r) => s + r._weight, 0);
    let roll = Math.random() * total;
    for (const r of candidates) {
      roll -= r._weight;
      if (roll <= 0) return r;
    }
    return candidates[candidates.length - 1];
  }

  // Dominant: altijd 1, soms 2 (als het tweede ras >30% heeft van het eerste)
  const first    = weightedPick(pool);
  const rest1    = pool.filter(r => r.id !== first.id);
  const second   = weightedPick(rest1);

  // Kans op tweede dominant ras: hoe dichter bij het eerste gewicht, hoe groter
  const secondChance = Math.min(0.85, second._weight / (first._weight + 1));
  const hasTwoDominant = Math.random() < secondChance;

  const dominant = hasTwoDominant ? [first, second] : [first];

  // Minority: 60% kans, altijd een ander ras dan de dominante
  const usedIds = dominant.map(r => r.id);
  const rest2   = pool.filter(r => !usedIds.includes(r.id));
  const minority = (Math.random() < 0.6 && rest2.length > 0)
    ? weightedPick(rest2)
    : null;

  return { dominant, minority };
}

/**
 * Kiest willekeurige Points of Interest voor de stad.
 * Kans en aantal afhankelijk van stadsgrootte (sizeIndex 1-9).
 * Filtert op minSize, cityType/biome affinities en negatieve affinities.
 * @param {object[]} pois      – alle POIs uit points-of-interest.json
 * @param {object}   sizeData  – de gekozen town size
 * @param {object}   cityType  – het gekozen city type
 * @param {object}   biome     – het gekozen biome
 * @returns {object[]} array van gekozen POI objecten (0-3)
 */
function rollPOIs(pois, sizeData, cityType, biome) {
  const sizeOrder = ["settlement","thorp","hamlet","village","small_town","large_town","small_city","large_city","metropolis"];
  const sizeIndex = sizeOrder.indexOf(sizeData.id) + 1; // 1-9

  // Kans en max aantal per stadsgrootte
  const chanceMap = { 1: 0.20, 2: 0.30, 3: 0.50, 4: 0.70, 5: 0.85, 6: 0.95, 7: 1.0, 8: 1.0, 9: 1.0 };
  const maxMap    = { 1: 1,    2: 1,    3: 1,    4: 1,    5: 1,    6: 2,    7: 2,   8: 3,   9: 3   };

  if (Math.random() > (chanceMap[sizeIndex] ?? 0.5)) return [];

  const maxCount = maxMap[sizeIndex] ?? 1;
  const rarityWeight = { "common": 3, "uncommon": 2, "rare": 1 };

  // Filter en weeg
  const pool = pois
    .filter(p => {
      if ((p.minSize ?? 1) > sizeIndex) return false;
      if (p.negativeAffinities?.cityTypes?.includes(cityType?.id)) return false;
      if (p.negativeAffinities?.biomes?.includes(biome?.id)) return false;
      return true;
    })
    .map(p => {
      const base      = rarityWeight[p.rarity] ?? 1;
      const cityBonus = p.cityTypeAffinities?.includes(cityType?.id) ? 2.5 : 1;
      const biomeBonus = p.biomeAffinities?.includes(biome?.id)      ? 2.0 : 1;
      return { ...p, _weight: base * cityBonus * biomeBonus };
    });

  // Gewogen pick zonder teruglegging
  const chosen = [];
  const available = [...pool];
  for (let i = 0; i < maxCount; i++) {
    if (!available.length) break;
    const total = available.reduce((s, p) => s + p._weight, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < available.length; j++) {
      roll -= available[j]._weight;
      if (roll <= 0) { idx = j; break; }
    }
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }
  return chosen;
}

/**
 * Kiest 2-4 primaire handelsgoederen op basis van biome + cityType.
 * Eén item met sceneSentence wordt apart teruggegeven voor de readout.
 * @param {object[]} items     – alle handelsitems
 * @param {object}   sizeData  – de gekozen town size
 * @param {object}   cityType  – het gekozen city type
 * @param {object}   biome     – het gekozen biome
 * @returns {{ goods: object[], sceneItem: object|null }}
 */
function rollTradeGoods(items, sizeData, cityType, biome) {
  const sizeOrder = ["settlement","thorp","hamlet","village","small_town","large_town","small_city","large_city","metropolis"];
  const sizeIndex = sizeOrder.indexOf(sizeData.id) + 1;
  const rarityWeight = { "common": 3, "uncommon": 2, "rare": 1 };
  const count = sizeIndex <= 2 ? 2 : sizeIndex <= 4 ? 3 : 4;

  // ── Theme filtering (theme-aware trade goods) ───────────────────────────────
  const preset = (typeof game !== "undefined"
    ? game.settings.get("world-forge-generator", "campaignThemePreset")
    : null) ?? "medieval";

  const pool = items
    .filter(item => {
      // Theme filtering: item moet huidge theme hebben (of fallback naar medieval)
      if (item.theme) {
        const themes = item.theme.split(",").map(t => t.trim());
        if (!themes.includes(preset) && !themes.includes("medieval")) {
          return false;  // Item niet geschikt voor deze theme
        }
      }

      if (item.negativeAffinities?.cityTypes?.includes(cityType?.id)) return false;
      if (item.negativeAffinities?.biomes?.includes(biome?.id)) return false;
      return true;
    })
    .map(item => {
      const base       = rarityWeight[item.rarity] ?? 1;
      const cityBonus  = item.cityTypeAffinities?.includes(cityType?.id) ? 3.0 : 1;
      const biomeBonus = item.biomeAffinities?.includes(biome?.id)       ? 3.0 : 1;
      return { ...item, _weight: base * cityBonus * biomeBonus };
    });

  // Gewogen pick zonder teruglegging
  const chosen = [];
  const available = [...pool];
  for (let i = 0; i < count; i++) {
    if (!available.length) break;
    const total = available.reduce((s, p) => s + p._weight, 0);
    let roll = Math.random() * total;
    let idx = available.length - 1;
    for (let j = 0; j < available.length; j++) {
      roll -= available[j]._weight;
      if (roll <= 0) { idx = j; break; }
    }
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }

  // Kies het item met de hoogste _weight dat een sceneSentence heeft voor de readout
  const sceneItem = chosen
    .filter(i => i.sceneSentence)
    .sort((a, b) => b._weight - a._weight)[0] ?? null;

  return { goods: chosen, sceneItem };
}

/**
 * Kiest een verdedigingstype op basis van stadsgrootte, cityType en biome.
 * @param {object[]} defenses  – alle verdedigingstypes uit defenses.json
 * @param {object}   sizeData  – de gekozen town size
 * @param {object}   cityType  – het gekozen city type
 * @param {object}   biome     – het gekozen biome
 * @returns {object|null} het gekozen defense object met optionele tower string
 */
function rollDefense(defenses, sizeData, cityType, biome) {
  const sizeOrder = ["settlement","thorp","hamlet","village","small_town","large_town","small_city","large_city","metropolis"];
  const sizeIndex = sizeOrder.indexOf(sizeData.id) + 1;
  const rarityWeight = { "common": 3, "uncommon": 2, "rare": 1 };

  const pool = defenses
    .filter(d => {
      if (sizeIndex < (d.minSize ?? 1)) return false;
      if (sizeIndex > (d.maxSize ?? 9)) return false;
      if (d.negativeAffinities?.cityTypes?.includes(cityType?.id)) return false;
      if (d.negativeAffinities?.biomes?.includes(biome?.id)) return false;
      return true;
    })
    .map(d => {
      const base       = rarityWeight[d.rarity] ?? 1;
      const cityBonus  = d.cityTypeAffinities?.includes(cityType?.id) ? 2.5 : 1;
      const biomeBonus = d.biomeAffinities?.includes(biome?.id)       ? 2.5 : 1;
      return { ...d, _weight: base * cityBonus * biomeBonus };
    });

  if (!pool.length) return null;

  const total = pool.reduce((s, d) => s + d._weight, 0);
  let roll = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (const d of pool) {
    roll -= d._weight;
    if (roll <= 0) { chosen = d; break; }
  }

  // Wachttorens
  let towerStr = null;
  if (chosen.towers && Math.random() < (chosen.towers.chance ?? 0)) {
    const arr = chosen.towers; // bevat nl en en arrays
    const lang = (typeof game !== "undefined"
      ? (game.settings?.get("world-forge-generator", "generatorLanguage") ?? "nl")
      : "nl");
    const opts = arr[lang];
    if (opts?.length) towerStr = opts[Math.floor(Math.random() * opts.length)];
  }

  return { ...chosen, towerStr };
}

/**
 * Filtert op scope.includes("city") en kiest willekeurig.
 * @param {object[]} governments – alle bestuursvormen uit governments.json
 * @returns {object} het gekozen government object
 */
function rollGovernment(governments) {
  const pool = governments.filter(g => g.scope.includes("city"));
  return pool[Math.floor(Math.random() * pool.length)];
}

// =============================================================================
// HULPFUNCTIES
// =============================================================================

/**
 * Kiest een willekeurig element uit een array.
 * @param {any[]} arr
 * @returns {any}
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Kiest een gewogen willekeurige town size uit de tabel.
 * @param {object[]} townSizes
 * @param {string}   [forceId]  – forceer een specifiek size id, of "random"
 * @returns {object}
 */
function rollTownSize(townSizes, forceId = "random") {
  if (forceId && forceId !== "random") {
    const found = townSizes.find(s => s.id === forceId);
    if (found) return found;
  }
  const total = townSizes.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const size of townSizes) {
    roll -= size.weight;
    if (roll <= 0) return size;
  }
  return townSizes[townSizes.length - 1];
}

/**
 * Filtert cityTypes op de actieve campaign preset en kiest gewogen een type.
 * Types met een leeg themes-array zijn altijd beschikbaar.
 * Past een bonus toe voor cityTypes die in biome.cityTypeAffinities staan.
 * @param {object[]} cityTypes
 * @param {object}   [biome]    – huidig biome object (optioneel)
 * @param {string}   [forceId]  – forceer een specifiek type id, of "random"
 * @returns {object}
 */
function rollCityType(cityTypes, biome = null, forceId = "random") {
  if (forceId && forceId !== "random") {
    const found = cityTypes.find(t => t.id === forceId);
    if (found) return found;
  }
  const preset     = (typeof game !== "undefined"
    ? game.settings.get("world-forge-generator", "campaignThemePreset")
    : null) ?? "medieval";
  const affinities = biome?.cityTypeAffinities ?? [];

  const pool = cityTypes
    .filter(t => t.themes.length === 0 || t.themes.includes(preset))
    .map(t => ({
      ...t,
      _weight: t.weight * (affinities.includes(t.id) ? 2.0 : 1.0)
    }));

  const total = pool.reduce((sum, t) => sum + t._weight, 0);
  let roll = Math.random() * total;
  for (const type of pool) {
    roll -= type._weight;
    if (roll <= 0) return type;
  }
  return pool[pool.length - 1];
}

/**
 * Kiest een gewogen willekeurig biome.
 * Past themeWeights toe op basis van de actieve campaign preset.
 * @param {object[]} biomes     – alle biomes uit biomes.json
 * @param {string}   [forceId]  – forceer een specifiek biome id, of "random"
 * @returns {object} het gekozen biome object
 */
function rollBiome(biomes, forceId = "random") {
  if (forceId && forceId !== "random") {
    const found = biomes.find(b => b.id === forceId);
    if (found) return found;
  }
  const preset = (typeof game !== "undefined"
    ? game.settings.get("world-forge-generator", "campaignThemePreset")
    : null) ?? "medieval";

  // Pas themeWeight multiplier toe op het basisgewicht
  const pool = biomes.map(b => ({
    ...b,
    _weight: b.weight * (b.themeWeights?.[preset] ?? 1.0)
  })).filter(b => b._weight > 0);

  const total = pool.reduce((sum, b) => sum + b._weight, 0);
  let roll = Math.random() * total;
  for (const b of pool) {
    roll -= b._weight;
    if (roll <= 0) return b;
  }
  return pool[pool.length - 1];
}

/**
 * Uitzondering: Greek altijd type-specifiek (syllabe-systeem).
 * @param {object} cityType  – het gekozen city type object
 * @param {object} general   – het nameGeneral object uit cities.json
 * @returns {string}
 */
function pickPrefix(cityType, general) {
  if (cityType.id === "greek") return pickRandom(cityType.prefixes);
  if (Math.random() < 0.7)    return pickRandom(cityType.prefixes);
  return pickRandom(general.prefixes);
}

/**
 * Kiest een suffix: 70% type-specifiek, 30% algemeen.
 * Uitzondering: Greek altijd type-specifiek (Griekse uitgangen).
 * Greek suffixen worden direct aan de prefix geplakt zonder spatie.
 * @param {object} cityType
 * @param {object} general
 * @returns {{ suffix: string, greek: boolean }}
 */
function pickSuffix(cityType, general) {
  if (cityType.id === "greek") {
    return { suffix: pickRandom(cityType.suffixes), greek: true };
  }
  if (Math.random() < 0.7) {
    return { suffix: pickRandom(cityType.suffixes), greek: false };
  }
  return { suffix: pickRandom(general.suffixes), greek: false };
}

/**
 * Genereert een stadsnaam op basis van het city type.
 * Greek: prefix + suffix zonder spatie (bijv. "Helios" + "polis" → "Heliospolis")
 * Overige: prefix + spatie + suffix (bijv. "Salt" + "Haven" → "Salt Haven")
 * Deduplicatie: als prefix en suffix identiek zijn, herrol suffix eenmalig.
 * @param {object} cityType
 * @param {object} general
 * @returns {string}
 */
function generateCityName(cityType, general) {
  const prefix      = pickPrefix(cityType, general);
  let   { suffix, greek } = pickSuffix(cityType, general);

  // Voorkom dubbelen (bijv. "Bay Bay")
  if (!greek && suffix.toLowerCase() === prefix.toLowerCase()) {
    const { suffix: retry } = pickSuffix(cityType, general);
    suffix = retry;
  }

  return greek
    ? `${prefix}${suffix.toLowerCase()}`
    : `${prefix} ${suffix}`;
}

/**
 * Rolt een willekeurig getal tussen min en max (inclusief).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Formatteert een getal met punten als duizendtalscheider (NL stijl).
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return n.toLocaleString("nl-NL");
}

/**
 * Selecteert willekeurige unieke districten voor de stad.
 * Filtert op minSize <= districtCount en past govBonus toe als de
 * government category overeenkomt met het district's govBonus array.
 * Gebruikt gewogen selectie zonder herhaling (Fisher-Yates variant).
 *
 * @param {object[]} allDistricts  – alle districten uit cities.json
 * @param {number}   count         – aantal te selecteren districten
 * @param {string}   govCategory   – actieve government category (bijv. "Theocracy")
 * @returns {object[]} geselecteerde districten met buildings array (3 items)
 */
function rollDistricts(allDistricts, count, govCategory) {
  if (count === 0) return [];

  // Filter op stadsgrootte en ken gewicht toe op basis van govBonus
  const pool = allDistricts
    .filter(d => d.minSize <= count)
    .map(d => ({
      ...d,
      _weight: (d.govBonus?.includes(govCategory) ? d.bonusWeight : 1) ?? 1
    }));

  // Gewogen selectie zonder herhaling
  const selected = [];
  const remaining = [...pool];

  for (let i = 0; i < Math.min(count, remaining.length); i++) {
    const totalWeight = remaining.reduce((sum, d) => sum + d._weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenIdx = 0;
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j]._weight;
      if (roll <= 0) { chosenIdx = j; break; }
    }
    selected.push(remaining.splice(chosenIdx, 1)[0]);
  }

  // Geef alle gebouwen terug als objecten (name + optioneel shopType/poiId/stallCategory/houseType)
  return selected.map(district => ({
    id:        district.id,
    nl:        district.nl,
    en:        district.en,
    category:  district.category,
    buildings: district.buildings.map(b =>
      typeof b === "string"
        ? { name: b }
        : { name: b.name, ...(b.shopType ? { shopType: b.shopType } : {}), ...(b.poiId ? { poiId: b.poiId } : {}), ...(b.stallCategory ? { stallCategory: b.stallCategory } : {}), ...(b.houseType ? { houseType: b.houseType } : {}), ...(b.factionType ? { factionType: b.factionType } : {}) }
    )
  }));
}

// =============================================================================
// GENEREER FUNCTIE
// =============================================================================

/**
 * Genereert een city/town data object.
 * @param {object} [opts]
 * @param {string} [opts.forceSize]     – town size id om te forceren, of "random"
 * @param {string} [opts.forceCityType] – city type id om te forceren, of "random"
 * @param {string} [opts.forceBiome]    – biome id om te forceren, of "random"
 * @returns {Promise<object>} city data object
 */
export async function generateCity({ forceSize = "random", forceCityType = "random", forceBiome = "random" } = {}) {
  // Load all data via DataLoader
  const data        = await DataLoader.load("cities.json");
  const govData     = await DataLoader.load("governments.json");
  const biomeData_  = await DataLoader.load("biomes.json");
  const races       = await DataLoader.load("races.json", "races");
  const poiData     = await DataLoader.load("buildings-poi.json", "buildings");
  const defenseData = await DataLoader.load("defenses.json", "defenses");
  const tradeData   = await DataLoader.load("trade-goods.json");

  // Extract arrays from DataLoader objects (which may have different structures)
  const govs = govData.governments ?? govData ?? [];
  const biomes = biomeData_.biomes ?? biomeData_ ?? [];
  const defenseList = defenseData.defenses ?? defenseData ?? [];
  const pois = Array.isArray(poiData) ? poiData.filter(b => b.isPOI === true) : (poiData.buildings?.filter(b => b.isPOI === true) ?? []);

  const biomeData  = rollBiome(biomes, forceBiome);
  const sizeData   = rollTownSize(data.townSizes, forceSize);
  const typeData   = rollCityType(data.cityTypes, biomeData, forceCityType);
  const government = rollGovernment(govs);
  const population = randBetween(sizeData.minPop, sizeData.maxPop);
  const name       = generateCityName(typeData, data.nameGeneral);
  const districts  = rollDistricts(data.districts, sizeData.districts, government.category);
  const popRaces   = rollPopulationRaces(races, typeData, biomeData);
  const pointsOfInterest = rollPOIs(pois, sizeData, typeData, biomeData);
  const defense    = rollDefense(defenseList, sizeData, typeData, biomeData);
  const trade      = rollTradeGoods(tradeData.items ?? tradeData.items, sizeData, typeData, biomeData);

  // Genereer de leider als NPC, forceer geslacht op basis van leaderGender
  const leader = await generateNPC({ forceSex: government.leaderGender });
  leader.job   = { nl: government.leader, en: government.leaderEn ?? government.leader };

  // Kleine nederzettingen (0 districten) krijgen een Inn of Tavern (50/50)
  let localInn = null;
  if (sizeData.districts === 0) {
    if (Math.random() < 0.5) {
      localInn = { kind: "inn",    data: await generateInn() };
    } else {
      localInn = { kind: "tavern", data: await generateTavern() };
    }
  }

  return {
    type:          "city",
    name,
    subtitle:      `${sizeData.nl} · ${typeData.nl} · ${biomeData.nl}`,
    size:          sizeData,
    cityType:      typeData,
    biome:         biomeData,
    government,
    leader,
    localInn,
    population,
    populationFmt: formatNumber(population),
    districtCount: sizeData.districts,
    districts,
    popRaces,
    pointsOfInterest,
    defense,
    trade,
    isEmpty:       false,
  };
}

// =============================================================================
// CityGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class CityGenerator extends BaseGenerator {
  static codexType = "city";
  static folder    = "_Random Cities";
  static icon      = "fa-city";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateCity(options); }
  static render(item)                 { return renderCityCard(item); }
  static getName(item)                { return item.name ?? "City"; }
  static getImage(item)               { return ""; }

  static getSub(item) {
    return item.subtitle ?? "";
  }
}

// =============================================================================
// RENDER FUNCTIES
// =============================================================================

/**
 * Rendert de city card HTML voor de middelste kolom van de WorldForge UI.
 * @param {object} city – het city data object
 * @returns {string} HTML string
 */
export function renderCityCard(city) {
  const lang = (typeof game !== "undefined"
    ? (game.settings?.get("world-forge-generator", "generatorLanguage") ?? "nl")
    : "nl");
  if (!city || city.isEmpty) {
    return `
<div class="wf-card wf-city-placeholder">
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${wfwft("WF.Nav.City")}</p>
      <p class="wf-subtitle">${wfwft("WF.UI.NoCityGenerated")}</p>
    </div>
  </div>
  <div class="wf-body">
    <p style="color:var(--wf-muted,#888);font-style:italic;text-align:center;padding:2rem 1rem;">
      ${wfwft("WF.UI.CityStartHint")}
    </p>
  </div>
</div>`;
  }

  const size = city.size;
  const type = city.cityType;

  // Groepeer districten op categorie voor overzichtelijke weergave
  const byCategory = {};
  for (const d of (city.districts ?? [])) {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push(d);
  }

  const districtsHtml = city.districtCount === 0
    ? `<p style="color:var(--wf-muted,#888);font-style:italic;">${wfwft("WF.City.TooSmall")}</p>`
    : Object.entries(byCategory).map(([cat, list]) => `
        <div class="wf-city-cat-header">${escapeHtml(cat)}</div>
        ${list.map(d => `
        <div class="wf-npc-item">
          <div class="wf-npc-item-top">
            <div class="wf-npc-item-meta">
              <strong>${escapeHtml(lang === "en" ? (d.en ?? d.nl) : d.nl)}</strong>
              <span class="wf-npc-role"> · <em>${escapeHtml(d.en)}</em></span>
            </div>
            <button class="wf-city-district-remove wf-btn"
                    data-district-id="${escapeAttr(d.id)}"
                    title="${wft('WF.City.RemoveDistrict')}"
                    style="padding:2px 7px;margin-left:auto;font-size:0.8em;">
              <i class="fas fa-minus"></i>
            </button>
          </div>
          <div class="wf-city-buildings">
            ${d.buildings.map(b => buildingButton(b)).join("")}
          </div>
        </div>`).join("")}
      `).join("");

  // Inn of Tavern voor kleine nederzettingen (0 districten) — collapsable
  const localInnHtml = (() => {
    if (!city.localInn) return "";
    const { kind, data } = city.localInn;
    const label      = kind === "inn" ? "Herberg" : "Taverne";
    const icon       = kind === "inn" ? "🛏️" : "🍺";
    const innName    = data.innName ?? data.tavernName ?? label;
    const desc       = data.description ?? "";
    const dataAttr   = escapeAttr(JSON.stringify({ kind, data }));
    const collapseId = `wf-inn-collapse-${Math.random().toString(36).slice(2, 7)}`;

    // Volledige card zonder header (naam staat al in de collapsed header)
    const fullCardHtml = kind === "inn"
      ? renderInnCard(data, { buttons: false })
      : renderTavernCard(data, { buttons: false });

    return `
  ${wfSectionHeader(icon, label)}
  <div class="wf-body">
    <div class="wf-city-inn-collapsed">

      <!-- Altijd zichtbaar: naam + beschrijving + toggle -->
      <div class="wf-city-inn-summary">
        <div>
          <strong style="color:var(--wf-gold);font-family:var(--wf-font-head);letter-spacing:.05em;">
            ${escapeHtml(innName)}
          </strong>
          <p style="margin:4px 0 0;font-style:italic;font-size:0.9em;color:var(--wf-text-dim,#9e8e6e);">
            ${escapeHtml(desc)}
          </p>
        </div>
        <button class="wf-city-inn-toggle wf-btn" data-target="${collapseId}"
                title="${wfwft("WF.Label.MoreDetails")}" style="margin-left:auto;padding:2px 8px;align-self:flex-start;">
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>

      <!-- Verborgen details -->
      <div id="${collapseId}" class="wf-city-inn-details" style="display:none;margin-top:8px;">
        ${fullCardHtml}
      </div>

      <!-- Actieknoppen altijd zichtbaar -->
      <div class="wf-city-inn-actions">
        <button class="wf-btn wf-btn-primary wf-inn-publish" data-inn="${dataAttr}">
          <i class="fas fa-comment"></i> ${wfwft("WF.Btn.Publish")}
        </button>
        <button class="wf-btn wf-inn-journal" data-inn="${dataAttr}">
          <i class="fas fa-book"></i> ${wfwft("WF.Btn.Journal")}
        </button>
      </div>
    </div>
  </div>`;
  })();

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(city.name)}</p>
      <p class="wf-subtitle">${escapeHtml(lang === "en" ? (size.en ?? size.nl) : size.nl)} · ${escapeHtml(lang === "en" ? (type.en ?? type.nl) : type.nl)}</p>
      <div class="wf-meta-row">
        ${wfBadge(city.populationFmt + " " + wfwft("WF.City.Label.Inhabitants"))}
        ${city.districtCount > 0 ? wfBadge(city.districtCount + " " + wfwft("WF.City.Label.Districts")) : ""}
        ${city.biome ? wfBadge(lang === "en" ? (city.biome.en ?? city.biome.nl) : city.biome.nl) : ""}
      </div>
    </div>
    <!-- ── TOEVOEG KNOP ── -->
    <div class="wf-city-attach-wrap">
      <button class="wf-city-attach-btn wf-btn" title="${wfwft("WF.City.Attach.Add")}">
        <i class="fas fa-plus"></i> ${wfwft("WF.City.Attach.Add")}
      </button>
      <div class="wf-city-attach-menu" style="display:none;">
        <button class="wf-city-attach-item" data-attach="district">
          <i class="fas fa-map"></i> ${wfwft("WF.City.Attach.District")}
        </button>
        <button class="wf-city-attach-item" data-attach="poi">
          <i class="fas fa-landmark"></i> ${wfwft("WF.City.Attach.POI")}
        </button>
        <button class="wf-city-attach-item" data-attach="faction">
          <i class="fas fa-chess-rook"></i> ${wfwft("WF.City.Attach.Faction")}
        </button>
        <button class="wf-city-attach-item" data-attach="criminal">
          <i class="fas fa-skull-crossbones"></i> ${wfwft("WF.City.Attach.CriminalOrg")}
        </button>
      </div>
    </div>
  </div>

  <!-- ── BIOOM ── -->
  ${city.biome ? (() => {
    const b    = city.biome;
    const f    = b.flavour ?? {};
    const lang = (typeof game !== "undefined"
      ? (game.settings?.get("world-forge-generator", "generatorLanguage") ?? "nl")
      : "nl");

    function pick(arr) {
      if (!arr?.length) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    }

    const style       = pick(f.buildingStyles?.[lang]);
    const roofing     = pick(f.roofingMaterials?.[lang]);
    const atmo        = pick(f.atmosphere?.[lang]);
    const adjective   = pick(city.cityType?.adjectives?.[lang]);
    const decoration  = pick(city.cityType?.decorationStyle?.[lang]);

    const sizeNl   = city.size?.nl   ?? "";
    const typeNl   = city.cityType?.nl ?? "";
    const sizeEn   = city.size?.en   ?? "";
    const typeEn   = city.cityType?.en ?? "";

    let description = "";
    if (lang === "nl") {
      const basis = adjective
        ? `Een ${adjective} ${sizeNl.toLowerCase()}, voornamelijk gebouwd in ${style}`
        : `Een ${sizeNl.toLowerCase()} gebouwd in ${style}`;
      const dak  = roofing    ? ` met ${roofing} daken` : "";
      const deco = decoration ? `, versierd met ${decoration}` : "";
      description = `${basis}${dak}${deco}. ${atmo ?? ""}`.trim();
    } else {
      const article = /^[aeiou]/i.test(adjective ?? sizeEn) ? "An" : "A";
      const basis = adjective
        ? `${article} ${adjective} ${sizeEn.toLowerCase()}, primarily built in ${style}`
        : `${article} ${sizeEn.toLowerCase()} built in ${style}`;
      const dak  = roofing    ? ` with ${roofing} roofs` : "";
      const deco = decoration ? `, decorated with ${decoration}` : "";
      description = `${basis}${dak}${deco}. ${atmo ?? ""}`.trim();
    }

    const pr = city.popRaces;
    let popSentence = "";
    if (pr) {
      const rName = (r) => escapeHtml(r.namePlural?.[lang] ?? r.name?.[lang] ?? r.name?.nl ?? r.id);
      if (lang === "nl") {
        const dom    = pr.dominant.map(rName);
        const domStr = dom.length === 1 ? `voornamelijk ${dom[0]}` : `voornamelijk ${dom[0]} en ${dom[1]}`;
        const minStr = pr.minority ? `, maar ook een kleine groep ${rName(pr.minority)}` : "";
        popSentence  = ` Er wonen ${domStr}${minStr}.`;
      } else {
        const dom    = pr.dominant.map(rName);
        const domStr = dom.length === 1 ? `mostly ${dom[0]}` : `mostly ${dom[0]} and ${dom[1]}`;
        const minStr = pr.minority ? `, with a small community of ${rName(pr.minority)}` : "";
        popSentence  = ` The population is ${domStr}${minStr}.`;
      }
    }

    // Verdedigingszin
    let defenseSentence = "";
    const def = city.defense;
    if (def && def.id !== "none") {
      const defSentence = def.sentence?.[lang];
      const defStr = defSentence?.[Math.floor(Math.random() * defSentence.length)] ?? "";
      const towerStr = def.towerStr ? ` ${def.towerStr}` : "";
      if (defStr) {
        defenseSentence = lang === "nl"
          ? ` De stad is ${defStr}${towerStr}.`
          : ` The city is ${defStr}${towerStr}.`;
      }
    }
    // Handelsgoederen sceneSentence
    let tradeSentence = "";
    const sceneItem = city.trade?.sceneItem;
    if (sceneItem?.sceneSentence?.[lang]) {
      const opts = sceneItem.sceneSentence[lang];
      tradeSentence = " " + opts[Math.floor(Math.random() * opts.length)];
    }

    let poiSentence = "";
    const pois = city.pointsOfInterest ?? [];
    if (pois.length > 0) {
      function pickLocation(poi) {
        const locs = poi.locations?.[lang];
        if (!locs?.length) return null;
        return locs[Math.floor(Math.random() * locs.length)];
      }
      function poiArticle(poi) {
        return poi.article?.[lang] ?? (lang === "en" ? "the" : "de");
      }
      if (lang === "nl") {
        if (pois.length === 1) {
          const loc = pickLocation(pois[0]);
          const art = poiArticle(pois[0]);
          poiSentence = loc
            ? ` ${escapeHtml(loc.charAt(0).toUpperCase() + loc.slice(1))} staat ${art} ${escapeHtml(pois[0].nl)}.`
            : ` Opmerkelijk is ${art} ${escapeHtml(pois[0].nl)}.`;
        } else {
          const parts = pois.map(p => {
            const loc = pickLocation(p);
            const art = poiArticle(p);
            return loc
              ? `${escapeHtml(loc)} ${art} ${escapeHtml(p.nl)}`
              : `${art} ${escapeHtml(p.nl)}`;
          });
          const last = parts.pop();
          poiSentence = ` Opmerkelijk zijn ${parts.join(", ")} en ${last}.`;
        }
      } else {
        if (pois.length === 1) {
          const loc = pickLocation(pois[0]);
          const art = poiArticle(pois[0]);
          poiSentence = ` Notable is ${art} ${escapeHtml(pois[0].en)}${loc ? `, ${escapeHtml(loc)}` : ""}.`;
        } else {
          const parts = pois.map(p => {
            const loc = pickLocation(p);
            const art = poiArticle(p);
            return loc
              ? `${art} ${escapeHtml(p.en)} ${escapeHtml(loc)}`
              : `${art} ${escapeHtml(p.en)}`;
          });
          const last = parts.pop();
          poiSentence = ` Notable are ${parts.join(", ")} and ${last}.`;
        }
      }
    }

    const tradeGoods = city.trade?.goods ?? [];
    const tradeHtml = tradeGoods.length ? `
  ${wfSectionHeader("💰", wfwft("WF.City.Section.Trade"))}
  <div class="wf-body">
    <table class="wf-info-table">
      ${tradeGoods.map(g => `<tr><td>${escapeHtml(g[lang] ?? g.nl)}</td><td style="color:var(--wf-text-dim);font-size:0.85em;">${escapeHtml(g.category)}</td></tr>`).join("")}
    </table>
  </div>` : "";

    const biomeName = lang === "nl" ? b.nl : b.en;
    return `
  ${wfSectionHeader("🌿", `${wfwft("WF.City.Section.Biome")} · ${escapeHtml(biomeName)}`)}
  <div class="wf-body">
    <div class="wf-readout">${escapeHtml(description)}${popSentence}${defenseSentence}${tradeSentence}${poiSentence}</div>
  </div>
  ${tradeHtml}`;
  })() : ""}

  <!-- ── BESTUUR & BELEID ── -->
  ${wfSectionHeader("⚖️", wfwft("WF.City.Section.Government"))}
  <div class="wf-body">
    <div class="wf-npc-item">
      <div class="wf-npc-item-top">
        <div class="wf-npc-item-meta">
          <strong>${escapeHtml(city.government.form)}</strong>
          <span class="wf-npc-role"> · <em>${escapeHtml(lang === "en" ? city.government.form : city.government.nl)}</em></span>
        </div>
        <div>${wfBadge(city.government.category)}</div>
      </div>
      <div style="margin-top:6px;font-style:italic;color:var(--wf-text-dim,#9e8e6e);font-size:0.9em;">
        ${escapeHtml(lang === "en" ? (city.government.descEn ?? city.government.desc) : city.government.desc)}
      </div>
    </div>
  </div>

  <!-- ── LEIDER ── -->
  ${wfSectionHeader("👑", wfwft("WF.City.Section.Leader"))}
  <div class="wf-body">
    ${wfNpcItem(city.leader)}
  </div>

  <!-- ── DISTRICTEN / INN ── -->
  ${city.districtCount > 0 ? `
  <div class="wf-section-header">
    <div class="wf-icon">🗺️</div>
    <span>${wfwft("WF.City.Section.Districts")} (${city.districts?.length ?? 0})</span>
    <button class="wf-city-district-add wf-btn"
            title="${wft('WF.City.AddDistrict')}"
            style="margin-left:auto;padding:2px 7px;font-size:0.8em;">
      <i class="fas fa-plus"></i>
    </button>
  </div>
  <div class="wf-body">${districtsHtml}</div>` : localInnHtml}

  <!-- ── GEKOPPELDE GEBOUWEN / POIs ── -->
  <div class="wf-city-pois-container" id="wf-city-pois">
    ${renderCityPOIs(city, lang, wft)}
  </div>

  <!-- ── GEKOPPELDE FACTIES ── -->
  <div class="wf-city-power-factions-container" id="wf-city-power-factions">
    ${renderCityPowerFactions(city, lang, wft)}
  </div>

  <!-- ── GEKOPPELDE ORGANISATIES / FACTIES ── -->
  <div class="wf-city-factions-container" id="wf-city-factions">
    ${renderCityFactions(city, lang, wft)}
  </div>

</div>`;
}

// =============================================================================
// FACTIONS RENDER — apart exporteerbaar voor DOM-only updates
// =============================================================================

export function renderCityFactions(city, lang, wftFn) {
  const orgs = city.attachedOrgs ?? [];
  if (orgs.length === 0) return "";

  const t = wftFn ?? wft;
  const L = (obj) => (typeof obj === "object" && obj !== null)
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  return `
  ${wfSectionHeader("⚔️", wfwft("WF.City.Section.Factions"))}
  <div class="wf-body">
    ${orgs.map((org, idx) => {
      const collapseId = `wf-faction-${idx}`;
      const orgName    = L(org.name);
      const orgType    = lang === "en" ? (org.orgType?.en ?? "") : (org.orgType?.nl ?? "");
      const location   = (org.base?.[lang] ?? org.base?.nl)?.location ?? "";

      // Bouw de volledige org card inhoud (zonder header — die staat in de collapse header)
      const readoutParts = [
        `${orgName} ${wft("WF.Crime.Readout.IsA")} ${orgType} ${wft("WF.Crime.Readout.OperatesFrom")} ${location}.`,
        `${wft("WF.Crime.Readout.Entrance")} ${(org.base?.[lang] ?? org.base?.nl)?.entrance ?? ""}.`,
        `${wft("WF.Crime.Readout.Territory")} ${L(org.territory)}.`,
        `${wft("WF.Crime.Readout.OpStyle")} ${L(org.opStyle)}.`,
        `${wft("WF.Crime.Readout.Motive")}: ${L(org.motive)}.`,
        `${wft("WF.Crime.Readout.Enemy")} ${L(org.enemy)}.`,
        `${wft("WF.Crime.Readout.Ally")} ${L(org.ally)}.`,
      ].join(" ");

      const quirk    = L(org.quirk);
      const services = (org.services ?? []).map(s => `
        <div class="wf-trait-item">
          <div class="wf-trait-name">${escapeHtml(L(s.name))}</div>
          <div class="wf-trait-desc">${escapeHtml(L(s.description))}</div>
        </div>`).join("");

      const members = [
        org.leader ? wfNpcItem(org.leader) : "",
        ...(org.officers ?? []).map(o => wfNpcItem(o))
      ].join("");

      return `
      <div class="wf-city-faction-card">
        <!-- Collapsed header — altijd zichtbaar -->
        <div class="wf-city-faction-header">
          <div class="wf-city-faction-title">
            <strong>${escapeHtml(orgName)}</strong>
            <span class="wf-muted"> · ${escapeHtml(orgType)}</span>
          </div>
          <div class="wf-city-faction-actions">
            <button class="wf-city-faction-toggle wf-btn" data-target="${collapseId}"
                    title="${wft("WF.City.ExpandFaction")}">
              <i class="fas fa-chevron-down"></i>
            </button>
            <button class="wf-city-org-remove wf-btn" data-org-idx="${idx}"
                    title="${wft("WF.City.RemoveOrg")}">
              <i class="fas fa-minus"></i>
            </button>
          </div>
        </div>
        <!-- Altijd zichtbaar: readout -->
        <div class="wf-city-faction-readout">${escapeHtml(readoutParts)}</div>

        <!-- Uitklapbaar: services, NPCs -->
        <div id="${collapseId}" class="wf-city-faction-details" style="display:none;">
          ${services ? `<div class="wf-city-faction-services">${services}</div>` : ""}
          <div class="wf-city-faction-members">${members}</div>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// =============================================================================
// POI RENDER — apart exporteerbaar voor DOM-only updates
// =============================================================================

export function renderCityPOIs(city, lang, wftFn) {
  const pois = city.attachedPOIs ?? [];
  if (!pois.length) return "";

  const t = wftFn ?? wft;
  const L = (obj) => (typeof obj === "object" && obj !== null)
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  return `
  ${wfSectionHeader("🏛️", wfwft("WF.City.Section.POIs"))}
  <div class="wf-body">
    ${pois.map((poi, idx) => {
      const collapseId = `wf-city-poi-${idx}`;
      const poiName    = L(poi.name);
      const category   = poi.category ?? "";
      const npcsHtml   = (poi.npcs ?? []).map(n => wfNpcItem(n)).join("");

      return `
      <div class="wf-city-faction-card">
        <div class="wf-city-faction-header">
          <div class="wf-city-faction-title">
            <strong>${escapeHtml(poiName)}</strong>
            <span class="wf-muted"> · ${escapeHtml(category)}</span>
          </div>
          <div class="wf-city-faction-actions">
            ${npcsHtml ? `<button class="wf-city-poi-toggle wf-btn" data-target="${collapseId}"
                    title="${wft("WF.City.ExpandFaction")}">
              <i class="fas fa-chevron-down"></i>
            </button>` : ""}
            <button class="wf-city-poi-remove wf-btn" data-poi-idx="${idx}"
                    title="${wft("WF.City.RemovePOI")}">
              <i class="fas fa-minus"></i>
            </button>
          </div>
        </div>
        <div class="wf-city-faction-readout">${escapeHtml(poi.readout ?? "")}</div>
        ${npcsHtml ? `<div id="${collapseId}" class="wf-city-faction-details" style="display:none;">
          <div class="wf-city-faction-members">${npcsHtml}</div>
        </div>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

// =============================================================================
// POWER FACTIONS RENDER — apart exporteerbaar voor DOM-only updates
// =============================================================================

export function renderCityPowerFactions(city, lang, wftFn) {
  const factions = city.attachedFactions ?? [];
  if (!factions.length) return "";

  const t = wftFn ?? wft;
  const L = (obj) => (typeof obj === "object" && obj !== null)
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  return `
  ${wfSectionHeader("🏛️", wfwft("WF.City.Section.PowerFactions"))}
  <div class="wf-body">
    ${factions.map((faction, idx) => {
      const collapseId  = `wf-power-faction-${idx}`;
      const factionName = L(faction.name);
      const typeName    = L(faction.subtitle ?? faction.factionType);
      const category    = faction.category ?? "";

      const readoutParts = [
        `${factionName} ${wft("WF.Faction.Readout.IsA")} ${typeName} ${wft("WF.Faction.Readout.OperatesFrom")} ${(faction.base?.[lang] ?? faction.base?.nl)?.location ?? ""}.`,
        `${wft("WF.Faction.Readout.Goal")}: ${L(faction.goal)}.`,
        `${wft("WF.Faction.Readout.Rival")}: ${L(faction.rival)}.`,
      ].join(" ");

      const servicesHtml = (faction.services ?? []).map(s => `
        <div class="wf-trait-item">
          <div class="wf-trait-name">${escapeHtml(L(s.name))}</div>
          <div class="wf-trait-desc">${escapeHtml(L(s.description))}</div>
        </div>`).join("");

      const membersHtml = [
        faction.leader ? wfNpcItem(faction.leader) : "",
        ...(faction.officers ?? []).map(o => wfNpcItem(o))
      ].join("");

      return `
      <div class="wf-city-faction-card">
        <div class="wf-city-faction-header">
          <div class="wf-city-faction-title">
            <strong>${escapeHtml(factionName)}</strong>
            <span class="wf-muted"> · ${escapeHtml(typeName)}</span>
            <span class="wf-muted" style="font-size:0.8em;"> · ${escapeHtml(category)}</span>
          </div>
          <div class="wf-city-faction-actions">
            <button class="wf-city-power-faction-toggle wf-btn" data-target="${collapseId}"
                    title="${wft("WF.City.ExpandFaction")}">
              <i class="fas fa-chevron-down"></i>
            </button>
            <button class="wf-city-power-faction-remove wf-btn" data-faction-idx="${idx}"
                    title="${wft("WF.City.RemoveFaction")}">
              <i class="fas fa-minus"></i>
            </button>
          </div>
        </div>
        <div class="wf-city-faction-readout">${escapeHtml(readoutParts)}</div>
        <div id="${collapseId}" class="wf-city-faction-details" style="display:none;">
          ${servicesHtml ? `<div class="wf-city-faction-services">${servicesHtml}</div>` : ""}
          <div class="wf-city-faction-members">${membersHtml}</div>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

// =============================================================================
// DISTRICT MUTATIE HELPERS (voor gebruik vanuit worldforge-app.js)
// =============================================================================

/**
 * Verwijdert een district uit de stad op basis van id.
 * Muteert city.districts direct.
 * @param {object} city        – het city data object
 * @param {string} districtId  – id van het te verwijderen district
 */
export function removeDistrict(city, districtId) {
  city.districts = city.districts.filter(d => d.id !== districtId);
}

/**
 * Voegt een willekeurig nieuw district toe dat nog niet in de stad zit.
 * Respecteert govBonus gewichten.
 * @param {object} city – het city data object
 * @returns {Promise<boolean>} true als een district toegevoegd is, false als pool leeg is
 */
export async function addDistrict(city) {
  const data           = await DataLoader.load("cities.json");
  const existingIds    = new Set(city.districts.map(d => d.id));
  const govCategory    = city.government?.category ?? "";

  // Filter: nog niet in de stad, minSize <= huidig aantal districten (of altijd beschikbaar)
  const pool = (data.districts ?? [])
    .filter(d => !existingIds.has(d.id))
    .map(d => ({
      ...d,
      _weight: (d.govBonus?.includes(govCategory) ? d.bonusWeight : 1) ?? 1
    }));

  if (!pool.length) return false;

  // Gewogen selectie
  const total = pool.reduce((s, d) => s + d._weight, 0);
  let roll    = Math.random() * total;
  let chosen  = pool[pool.length - 1];
  for (const d of pool) {
    roll -= d._weight;
    if (roll <= 0) { chosen = d; break; }
  }

  // Zet buildings om naar objecten
  const buildings = (chosen.buildings ?? []).map(b =>
    typeof b === "string" ? { name: b } : { name: b.name, ...(b.shopType ? { shopType: b.shopType } : {}), ...(b.poiId ? { poiId: b.poiId } : {}) }
  );

  city.districts.push({
    id:        chosen.id,
    nl:        chosen.nl,
    en:        chosen.en,
    category:  chosen.category,
    buildings
  });

  return true;
}
