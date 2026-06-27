/**
 * WorldForge – npc-generator.js
 *
 * Genereert een willekeurige NPC op basis van Foundry Rollable Tables.
 * Gebaseerd op de originele "Random NPC" macro, omgezet naar een module.
 *
 * Exporteert:
 *  - generateNPC()            – bouwt het NPC data-object
 *  - renderNPCCard()          – genereert de Campaign Codex-stijl HTML kaart
 *  - renderNPCSimple()        – minimalistische HTML voor journals/codex
 *  - saveNPCToActor()         – slaat de NPC op als dnd5e Actor
 *  - generateAndShowNPC()     – hoofdfunctie: genereer + toon in chat
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { runComfyRender, saveComfyImageToFoundry, baseNegativePortrait } from "./comfyui.js";
import {
  clean, escapeHtml, escapeAttr, splitLang, splitJob, lowerNl,
  ensureArticle, formatForFile, decodeFileName, uniqueParts,
  randBetween, getModifier, fmtMod, pickUnique, pickRandom, sleep,
  copyToClipboard, hasValidImageExtension, openImagePopout,
  ensureJournalFolder, saveToCodex,
  wfSectionHeader, wfReadout, wfInfoRow, wfBadge, wfNpcItem
} from "./utils.js";
const wft = (key) => WorldForgeSettings.t(key);


// =============================================================================
// DATA LOADERS — via DataLoader (gecentraliseerde caching)
// =============================================================================

const loadRacesData        = () => DataLoader.load("races.json",           "races");
const loadJobsData         = () => DataLoader.load("jobs.json",            "jobs");
const loadTraitsData       = () => DataLoader.load("npc/traits.json",      "traits");
const loadAppearanceData   = () => DataLoader.load("npc/appearance.json",  "items");
const loadColorsData       = () => DataLoader.load("colors.json",          "colors");
const loadSexData          = () => DataLoader.load("sex.json",             "sex");

async function rollColor()         { return DataLoader.pick("colors.json",     "colors"); }

async function rollTrait(type) {
  const traits = await loadTraitsData();
  const filtered = traits.filter(t => t.type === type);
  return filtered[Math.floor(Math.random() * filtered.length)] ?? { nl: "", en: "" };
}

async function rollSex(forceSex = null) {
  const options = await loadSexData();
  const pool    = options.length ? options : [{ nl: "Man", en: "Male" }, { nl: "Vrouw", en: "Female" }];
  if (forceSex && forceSex !== "any") {
    const match = pool.find(o => o.en.toLowerCase() === forceSex.toLowerCase());
    if (match) return match;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function rollAppearanceItem(type) {
  const items = await loadAppearanceData();
  const filtered = items.filter(i => i.type === type);
  return filtered[Math.floor(Math.random() * filtered.length)] ?? { nl: "", en: "" };
}

async function getActiveRaces() {
  const all     = await loadRacesData();
  const setting = WorldForgeSettings.activeRaces ?? "";
  const active  = setting
    ? setting.split(",").map(s => s.trim()).filter(Boolean)
    : all.filter(r => r.enabled).map(r => r.id);
  return all.filter(r => active.includes(r.id));
}

async function rollRace(forceRace = null) {
  const races = await getActiveRaces();
  if (!races.length) return { nl: "Mens", en: "Human", id: "human" };

  if (forceRace) {
    const match = races.find(r => r.en.toLowerCase() === forceRace.toLowerCase() || r.id === forceRace.toLowerCase());
    if (match) return match;
  }

  const total = races.reduce((s, r) => s + (r.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const race of races) {
    roll -= (race.weight ?? 1);
    if (roll <= 0) return { nl: race.name.nl, en: race.name.en, id: race.id, _data: race };
  }
  const last = races[races.length - 1];
  return { nl: last.name.nl, en: last.name.en, id: last.id, _data: last };
}

async function rollJob() {
  const jobs = await loadJobsData();
  const job = jobs[Math.floor(Math.random() * jobs.length)];
  return { nl: job.nl, en: job.en, stat: job.stat, skills: job.skills ?? [],
           clothingTags: job.clothingTags ?? [], weaponHint: job.weaponHint ?? "none",
           locations: job.locations ?? [], _data: job };
}


async function rollHairColor(raceData) {
  if (!raceData?._data?.hairColors) return { nl: "bruin", en: "brown" };
  const hc      = raceData._data.hairColors;
  const weights = hc.weights ?? hc.nl.map(() => 1);
  const total   = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total, idx = 0;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) { idx = i; break; } }
  const descriptor = hc.descriptor ?? null;
  return { nl: hc.nl[idx], en: hc.en[idx], descriptor: descriptor ?? null };
}

async function rollHeight(raceData) {
  if (!raceData?._data?.height) return { nl: "gemiddeld lange", en: "average-height" };
  const h = raceData._data.height;
  const weights = h.weights ?? h.nl.map(() => 1);
  const total   = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total, idx = 0;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) { idx = i; break; } }
  return { nl: h.nl[idx], en: h.en[idx] };
}

async function rollAgeFromData(raceData) {
  if (!raceData?._data?.age?.roll) return rollAge(raceData.en);
  const roll = new Roll(raceData._data.age.roll);
  await roll.evaluate();
  return roll.total;
}

function getAgeCategoryFromData(age, raceData) {
  if (!raceData?._data?.age?.categories) return getAgeCategory(age, raceData.en);
  const cats = raceData._data.age.categories;
  for (const [, cat] of Object.entries(cats)) { if (age <= cat.max) return cat.en; }
  return "ancient";
}

/**
 * Geeft een expliciete visuele leeftijdstag terug voor de ComfyUI prompt.
 * Combineert de leeftijdscategorie met geslacht voor betere resultaten.
 * Bijv: "elderly woman", "young adult male", "middle-aged man"
 */
function getAgeVisualTag(age, raceData, sexEn) {
  const cat = getAgeCategoryFromData(age, raceData);
  const gender = sexEn?.toLowerCase().includes("female") ? "woman" : "man";
  const map = {
    young:       `young ${gender}`,
    adult:       `adult ${gender}`,
    mature:      `middle-aged ${gender}`,
    old:         `elderly ${gender}`,
    ancient:     `very old ${gender}, ancient`
  };
  return map[cat] ?? `${cat} ${gender}`;
}

/**
 * Geeft de Nederlandse leeftijdscategorie terug voor de cinematic tekst.
 */
function getAgeCategoryNl(age, raceData) {
  if (!raceData?._data?.age?.categories) return null;
  const cats = raceData._data.age.categories;
  for (const [, cat] of Object.entries(cats)) {
    if (age <= cat.max) return cat.nl; // "jong", "volwassen", "middelbaar", "oud"
  }
  return "oeroud";
}

function getRaceVisualTags(raceData) {
  if (!raceData?._data?.comfyTags?.en) return inferRaceVisualTags(raceData.en);
  return raceData._data.comfyTags.en;
}

function shouldHaveLastName(raceData) {
  return Math.random() < (raceData?._data?.names?.hasSurname ?? 0.8);
}

// =============================================================================
// ABILITY SCORE & SKILL HELPERS
// =============================================================================

/**
 * Genereert zes ability scores gebaseerd op de hoofdstat van het beroep.
 * De hoofdstat krijgt de hoogste waarden; zwakste stats krijgen de laagste.
 * Dit geeft elke NPC een consistent karakter passend bij zijn beroep.
 *
 * @param {string} mainStat  - "str"|"dex"|"con"|"int"|"wis"|"cha"
 * @returns {object}         - { STR, DEX, CON, INT, WIS, CHA }
 */
function generateAbilities(mainStat) {
  // Volgorde van sterkste naar zwakste stat per beroepstype
  const orders = {
    str: ["STR","CON","WIS","DEX","INT","CHA"],
    dex: ["DEX","CON","WIS","STR","INT","CHA"],
    con: ["CON","STR","DEX","WIS","CHA","INT"],
    int: ["INT","CHA","CON","DEX","WIS","STR"],
    wis: ["WIS","CHA","CON","DEX","INT","STR"],
    cha: ["CHA","DEX","WIS","CON","STR","INT"]
  };
  const order = orders[String(mainStat ?? "int").toLowerCase()] ?? orders.int;

  return {
    [order[0]]: randBetween(10, 14),  // Hoofdstat: bovengemiddeld
    [order[1]]: randBetween(8,  12),  // Ondersteunende stat
    [order[2]]: randBetween(8,  12),
    [order[3]]: randBetween(8,  12),
    [order[4]]: randBetween(8,  10),  // Zwakkere stats
    [order[5]]: randBetween(6,   9)   // Zwakste stat
  };
}

// Koppeling tussen skill-naam en de bijbehorende ability score
const skillToAbility = {
  Athletics:         "STR",
  Acrobatics:        "DEX", "Sleight of Hand": "DEX", Stealth: "DEX",
  Arcana:            "INT", History: "INT", Investigation: "INT",
  Nature:            "INT", Religion: "INT",
  "Animal Handling": "WIS", Insight: "WIS", Medicine: "WIS",
  Perception:        "WIS", Survival: "WIS",
  Deception:         "CHA", Intimidation: "CHA",
  Performance:       "CHA", Persuasion: "CHA"
};

// Koppeling skill-naam → dnd5e systeemsleutel (voor Actor opslaan)
const skillToDnd5eKey = {
  Acrobatics: "acr", "Animal Handling": "ani", Arcana: "arc",
  Athletics: "ath", Deception: "dec", History: "his", Insight: "ins",
  Intimidation: "itm", Investigation: "inv", Medicine: "med",
  Nature: "nat", Perception: "prc", Performance: "prf",
  Persuasion: "per", Religion: "rel", "Sleight of Hand": "slt",
  Stealth: "ste", Survival: "sur"
};

/**
 * Kiest twee skill proficiencies die passen bij de hoofdstat.
 * Voegt ook Wisdom-skills toe als aanvulling (veelzijdige NPCs).
 */
function generateSkillProficiencies(npc) {
  const pools = {
    str: ["Athletics"],
    dex: ["Acrobatics", "Sleight of Hand", "Stealth"],
    con: ["Athletics", "Survival"],
    int: ["Arcana", "History", "Investigation", "Nature", "Religion"],
    wis: ["Animal Handling", "Insight", "Medicine", "Perception", "Survival"],
    cha: ["Deception", "Intimidation", "Performance", "Persuasion"]
  };
  const mainPool = pools[npc.job.stat] ?? [];
  const wisPool  = pools.wis;
  // Combineer de pools en kies 2 unieke skills
  return pickUnique([...mainPool, ...wisPool], 2);
}

/**
 * Berekent de skill-modifiers op basis van ability scores + proficiency bonus.
 * Formule: ability modifier + proficiency bonus
 */
function generateSkillModifiers(npc) {
  const result = {};
  for (const skill of npc.skills) {
    const abilityScore = npc.abilities[skillToAbility[skill]];
    result[skill]      = getModifier(abilityScore) + npc.proficiencyBonus;
  }
  return result;
}

// =============================================================================
// NPC-SPECIFIEKE HELPERS
// =============================================================================

/** Bepaal voornaamwoord op basis van geslacht (voor cinematische zin) */
function getPronoun(sexText)   { return clean(sexText).toLowerCase() === "male" ? "Hij"    : "Zij"; }
function getSexType(sexText)   { return clean(sexText).toLowerCase() === "male" ? "Male"   : "Female"; }
function getGenderWord(sexText){ return clean(sexText).toLowerCase() === "male" ? "male"   : "female"; }

/**
 * Bepaalt of een NPC een achternaam krijgt.
 * Orcs hebben 50% kans; andere rassen 80%.
 */
function hasLastName(race) {
  if (clean(race).toLowerCase().includes("orc")) return Math.random() < 0.5;
  return Math.random() < 0.8;
}

/**
 * Herleid een ras-beschrijving naar de basisnaam voor tabel-lookups.
 * "Half-Elf" → "Elf", "Half-Orc" → "Orc", rest ongewijzigd.
 */
function getNameRaceBase(raceText) {
  const r = clean(raceText).toLowerCase();
  if (r.includes("elf")) return "Elf";
  if (r.includes("orc")) return "Orc";
  return clean(raceText);
}

/**
 * Bepaalt de leeftijdscategorie voor de ComfyUI prompt.
 * Elven leven veel langer dan mensen, dus de grenzen verschillen.
 */
function getAgeCategory(age, raceText) {
  const base = getNameRaceBase(raceText);

  if (base === "Elf") {
    if (age < 80)  return "young adult";
    if (age < 250) return "adult";
    return "mature adult";
  }
  if (base === "Orc") {
    if (age < 18) return "young";
    if (age < 35) return "adult";
    return "older adult";
  }
  // Mensen en de meeste andere rassen
  if (age < 20) return "young adult";
  if (age < 45) return "adult";
  if (age < 65) return "middle-aged";
  return "older adult";
}

/**
 * Rolt een willekeurige leeftijd passend bij het ras.
 * Elven: 70-370, Halflings: 30-130, Orcs: 15-53, anderen: 18-73.
 */
async function rollAge(raceText) {
  const ageFormulas = {
    Elf:      "3d100+70",
    Halfling: "1d100+30",
    Orc:      "2d20+13",
    default:  "5d12+13"
  };
  const formula = ageFormulas[getNameRaceBase(raceText)] ?? ageFormulas.default;
  const roll    = new Roll(formula);
  await roll.evaluate();
  return roll.total;
}

// =============================================================================
// NAAM GENERATIE
// =============================================================================

/**
 * Genereert een volledige naam op basis van ras en geslacht.
 * Iedere rasgroep heeft eigen tabellen; er is altijd een fallback
 * naar Human tabellen als de ras-specifieke tabel niet bestaat.
 *
 * Speciale gevallen:
 *  - Dwarfs: achternaam uit prefix + suffix tabel ("Stone" + "hammer")
 *  - Gnome/Tiefling: eigen voornaamtabellen
 *  - Dragonborn: menselijke namen
 */
/**
 * Pikt een willekeurige naam uit een array.
 * Valt terug op "Nameless" als de array leeg is.
 */
function pickName(arr) {
  if (!arr || !arr.length) return "Nameless";
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Genereert een volledige naam op basis van de namen-arrays in races.json.
 * Alle naam-tabellen zijn vervangen door directe arrays per ras.
 *
 * Naamstructuur in races.json per ras:
 *  - male/female: { names: [...] }
 *  - surname:     { names: [...] }  of  { type: "compound", prefix: [...], suffix: [...] }
 *  - hasSurname:  kans op een achternaam (0.0 - 1.0)
 */
async function generateName(raceText, sexText, raceData = null, forcedLastName = null) {
  const sexType     = getSexType(sexText);
  const useLastName = shouldHaveLastName(raceData ?? { en: raceText });
  const nameCfg     = raceData?._data?.names;

  // Geen namen config: fallback naar Human tabellen
  if (!nameCfg) {
    const races = await loadRacesData();
    const human = races.find(r => r.id === "human");
    const hCfg  = human?.names;
    const firstName = pickName(sexType === "Male" ? hCfg?.male?.names : hCfg?.female?.names) || "Nameless";

    // Als een achternaam geforceerd is, gebruik die
    if (forcedLastName) {
      return `${firstName} ${forcedLastName}`;
    }

    const lastName  = useLastName ? pickName(hCfg?.surname?.names) : "";
    return lastName ? `${firstName} ${lastName}` : firstName;
  }

  // Voornaam: kies uit de geslacht-specifieke array
  const firstNames = sexType === "Male" ? nameCfg.male?.names : nameCfg.female?.names;
  const firstName  = pickName(firstNames) || "Nameless";

  // Achternaam
  let lastName = "";

  // Als een achternaam geforceerd is, gebruik die in plaats van random genereren
  if (forcedLastName) {
    lastName = forcedLastName;
  } else if (useLastName && nameCfg.surname) {
    if (nameCfg.surname.type === "compound") {
      // Dwarf-stijl: prefix + suffix samenvoegen
      const pre = pickName(nameCfg.surname.prefix);
      const suf = pickName(nameCfg.surname.suffix);
      lastName = pre && suf ? `${pre}${suf}` : "";
    } else if (nameCfg.surname.names?.length) {
      lastName = pickName(nameCfg.surname.names);
    }
  }

  return lastName ? `${firstName} ${lastName}` : firstName;
}

// =============================================================================
// WAPEN & KLEDING GENERATIE
// =============================================================================

/**
 * Genereert een wapen (of wapencombo) voor de NPC.
 * 10% kans op twee wapens, 20% kans op wapen + schild.
 */
async function generateWeapon() {
  const shields = [
    "een schild|shield",
    "een houten schild|wooden shield",
    "een rond schild|round shield",
    "een buckler|buckler",
    "een stalen schild|steel shield",
    "een gouden schild|golden shield"
  ].map(s => {
    const [nl, en] = s.split("|");
    return { nl, en };
  });

  const roll = Math.random();

  // 10% kans: twee wapens (eventueel met schild)
  if (roll < 0.10) {
    let w1 = await rollAppearanceItem("weapon");
    let w2 = await rollAppearanceItem("weapon");
    let attempts = 0;
    while (clean(w1.nl) === clean(w2.nl) && attempts++ < 5) {
      w2 = await rollAppearanceItem("weapon");
    }
    if (Math.random() < 0.2) {
      const s = pickRandom(shields);
      return {
        nl: `${w1.nl.toLowerCase()} en ${w2.nl.toLowerCase()} en ${s.nl.toLowerCase()}`,
        en: `${w1.en.toLowerCase()} and ${w2.en.toLowerCase()} and ${s.en.toLowerCase()}`
      };
    }
    return {
      nl: `${w1.nl.toLowerCase()} en ${w2.nl.toLowerCase()}`,
      en: `${w1.en.toLowerCase()} and ${w2.en.toLowerCase()}`
    };
  }

  // 90% kans: één wapen, eventueel met schild
  let weapon = await rollAppearanceItem("weapon");
  if (Math.random() < 0.2) {
    const s = pickRandom(shields);
    return {
      nl: `${weapon.nl.toLowerCase()} en ${s.nl.toLowerCase()}`,
      en: `${weapon.en.toLowerCase()} and ${s.en.toLowerCase()}`
    };
  }
  return { nl: weapon.nl.toLowerCase(), en: weapon.en.toLowerCase() };
}

/**
 * Vervangt de placeholder "clr" in een kledingstuk door een willekeurige kleur.
 * Bijv. "clr mantel" → "blauwe mantel"
 */
async function resolveColor(text) {
  const value = clean(text);
  if (!value.toLowerCase().includes("clr")) return value;
  const color = await rollColor();
  return value
    .replace(/\bclr\b/gi, color.nl.toLowerCase())
    .replace(/\bCLR\b/g,  color.nl);
}

/**
 * Genereert één kledingstuk en één accessoire voor de NPC.
 * Als een resultaat "clr" bevat wordt dat vervangen door een kleur uit Rnd - Colors Adj.
 */
async function generateClothing() {
  let c1 = await rollAppearanceItem("clothing");
  let c2 = await rollAppearanceItem("accessory");

  // Vervang kleur-placeholders
  c1 = { nl: await resolveColor(c1.nl), en: await resolveColor(c1.en) };
  c2 = { nl: await resolveColor(c2.nl), en: await resolveColor(c2.en) };

  return {
    nl: `${ensureArticle(c1.nl)} en ${ensureArticle(c2.nl)}`,
    en: `${c1.en}, ${c2.en}`
  };
}

// =============================================================================
// COMFYUI PROMPT BUILDER
// =============================================================================

/**
 * Voegt ras-specifieke visuele tags toe aan de ComfyUI prompt.
 * Zorgt dat Tieflings hoorntjes krijgen, Elfen puntige oren, etc.
 */
function inferRaceVisualTags(raceText) {
  const r = clean(raceText).toLowerCase();
  const tags = [];
  if (r.includes("tiefling"))   tags.push("small horns", "fiendish features");
  if (r.includes("dragonborn")) tags.push("draconic features");
  if (r.includes("elf"))        tags.push("pointed ears");
  if (r.includes("orc"))        tags.push("orc features");
  if (r.includes("dwarf"))      tags.push("dwarven features");
  if (r.includes("halfling"))   tags.push("short stature");
  if (r.includes("gnome"))      tags.push("small stature");
  return tags;
}

/**
 * Vertaalt een beroep naar een visuele kledingomschrijving voor de prompt.
 * Bijv. "guard" → "guard uniform", "priest" → "priest robes"
 */
function inferJobVisualTag(jobEn) {
  const j = clean(jobEn).toLowerCase();
  if (j.includes("guard"))      return "guard uniform";
  if (j.includes("pirate"))     return "pirate clothing";
  if (j.includes("sailor"))     return "sailor clothing";
  if (j.includes("merchant"))   return "merchant clothing";
  if (j.includes("noble"))      return "noble clothing";
  if (j.includes("blacksmith")) return "blacksmith apron";
  if (j.includes("priest"))     return "priest robes";
  if (j.includes("hunter"))     return "hunter clothing";
  if (j.includes("farmer"))     return "simple work clothes";
  return `${j} clothing`;
}

/**
 * Bouwt de volledige ComfyUI positieve prompt voor een NPC-portret.
 * Combineert ras, geslacht, leeftijdscategorie, houding, haar,
 * kleding en wapen tot één geoptimaliseerde prompt-string.
 */
function buildNPCComfyPrompt(npc) {
  return uniqueParts([
    `${npc.race.en.toLowerCase()} ${getGenderWord(npc.sex.en)}`,
    getAgeCategoryFromData(npc.age, npc.race),
    getAgeVisualTag(npc.age, npc.race, npc.sex.en),
    ...getRaceVisualTags(npc.race),
    npc.posture.en,
    npc.height.en,
    // Haarkleur alleen als het echt haar is (niet schubben/vacht)
    npc.hairColor.descriptor ? `${npc.hairColor.en} ${npc.hairColor.descriptor.en}` : `${npc.hairColor.en} hair`,
    // Job: gebruik clothing tags uit jobs.json, valt terug op inferJobVisualTag
    ...(npc.job.clothingTags?.length ? npc.job.clothingTags : [inferJobVisualTag(npc.job.en)]),
    `${npc.job.en.toLowerCase()} outfit`,
    npc.clothing.en,
    // Wapen alleen toevoegen als het geen "geen wapen" resultaat is
    npc.weapon.en.toLowerCase().includes("no weapon") ? "" : `holding ${npc.weapon.en}`,
    "high fantasy character portrait",
    "detailed digital illustration",
    "fantasy concept art",
    "waist-up portrait",
    "centered composition",
    "dramatic soft lighting",
    "detailed face",
    "sharp focus",
    "neutral background",
    "no text",
    "no watermark"
  ]).join(", ");
}

/**
 * Bouwt de Leonardo.ai prompt (alternatief voor ComfyUI).
 * Iets uitgebreider met kwaliteitsindicatoren.
 */
function buildLeonardoPrompt(npc) {
  return uniqueParts([
    "high fantasy character portrait",
    "detailed digital illustration",
    "realistic fantasy style",
    "waist-up portrait",
    "centered composition",
    "neutral background",
    "dramatic soft lighting",
    "highly detailed face",
    "sharp focus",
    `${npc.race.en} ${getGenderWord(npc.sex.en)}`,
    getAgeCategory(npc.age, npc.race.en),
    npc.job.en,
    npc.height.en,
    npc.posture.en,
    npc.hairColor.en,
    npc.physicalTrait.en,
    `wearing ${npc.clothing.en}`,
    npc.weapon.en.toLowerCase().includes("no weapon") ? "" : `carrying ${npc.weapon.en}`,
    `personality impression: ${npc.quirk.en}`,
    "fantasy NPC concept art",
    "no text", "no watermark", "no frame"
  ]).filter(Boolean).join(", ");
}

// =============================================================================
// TOKEN AFBEELDING PICKER
// =============================================================================

// Cache om herhaalde FilePicker.browse() calls te voorkomen
let tokenFilesCache = null;

/** Haalt de lijst van token-bestanden op (gecached na eerste aanroep) */
async function getTokenFiles() {
  if (tokenFilesCache) return tokenFilesCache;
  try {
	const FP     = foundry.applications.apps.FilePicker.implementation;
	const browse = await FP.browse("data", WorldForgeSettings.npcImageFolder);
    tokenFilesCache = browse.files ?? [];
  } catch {
    tokenFilesCache = [];
  }
  return tokenFilesCache;
}

/**
 * Zoekt een passende token-afbeelding voor de NPC op basis van
 * ras, beroep en geslacht. Bestandsnamen moeten de vorm hebben:
 *   Race_Job_Sex_*.png   (exacte match)
 *   Race_Sex_*.png       (fallback als er geen job-specifieke is)
 *
 * Geeft het standaard NPC-icoon terug als er niets gevonden wordt.
 */
async function getNPCImagePath(npc) {
  const files = await getTokenFiles();
  if (!files.length) return WorldForgeSettings.defaultNpcIcon;

  const race = formatForFile(npc.race.en);
  const job  = formatForFile(npc.job.en);
  const sex  = getSexType(npc.sex.en);

  // Probeer eerst exacte match (ras + beroep + geslacht)
  const exact = files.filter(f =>
    decodeFileName(f).startsWith(`${race}_${job}_${sex}_`)
  );
  if (exact.length) return pickRandom(exact);

  // Fallback: alleen ras + geslacht
  const fallback = files.filter(f =>
    decodeFileName(f).startsWith(`${race}_${sex}_`)
  );
  return fallback.length ? pickRandom(fallback) : WorldForgeSettings.defaultNpcIcon;
}

/**
 * Geeft het beste beschikbare afbeeldingspad terug voor de NPC.
 * ComfyUI view-URLs bevatten geen extensie en worden afgewezen.
 */
export function getValidImagePath(npc) {
  const cur = npc.currentImagePath ?? "";
  if (hasValidImageExtension(cur) && !cur.includes("/view?")) return cur;
  if (hasValidImageExtension(npc.tokenImagePath)) return npc.tokenImagePath;
  return WorldForgeSettings.defaultNpcIcon;
}

// =============================================================================
// KERN GENERATOR
// =============================================================================

/**
 * Genereert een volledig NPC-object door op alle relevante tabellen
 * te rollen en de resultaten samen te voegen.
 *
 * Rolvolgorde:
 *  1. Ras, geslacht, beroep (bepaalt de rest)
 *  2. Naam (afhankelijk van ras + geslacht)
 *  3. Leeftijd (afhankelijk van ras)
 *  4. Uiterlijk (hoogte, houding, haar, kenmerk)
 *  5. Uitrusting (kleding, wapen)
 *  6. Persoonlijkheid (quirk)
 *  7. Stats + skills
 *  8. Token afbeelding
 *  9. AI prompts
 *
 * @returns {object}  Het volledige NPC-object
 */
export async function generateNPC({
  forceSex = null,
  forceRace = null,       // ← NEW: Geforceerd ras (voor Racial Enclaves)
  forcedLastName = null,  // ← NEW: Geforceerde achternaam (voor families)
  minAge = null,          // ← NEW: Minimum leeftijd
  maxAge = null           // ← NEW: Maximum leeftijd
} = {}) {
  // Basisgegevens — ras en beroep nu uit JSON
  const race = await rollRace(forceRace);
  const sex  = await rollSex(forceSex);
  const job  = await rollJob();

  // Genereer leeftijd en pas min/max toe
  let age = await rollAgeFromData(race);
  if (minAge !== null && maxAge !== null) {
    age = Math.max(minAge, Math.min(maxAge, age));
  } else if (minAge !== null) {
    age = Math.max(minAge, age);
  } else if (maxAge !== null) {
    age = Math.min(maxAge, age);
  }

  const npc = {
    race, sex, job,
    name:          await generateName(race.en, sex.en, race, forcedLastName),
    age:           age,
    height:        await rollHeight(race),
    posture:       await rollTrait("posture"),
    physicalTrait: await rollTrait("physical_trait"),
    hairColor:     await rollHairColor(race),
    clothing:      await generateClothing(),
    quirk:         await rollTrait("quirk"),
    weapon:        await generateWeapon(),
    pronoun:       getPronoun(sex.en),
    abilities:     generateAbilities(job.stat),
    proficiencyBonus: 2,
    // Render-status velden (worden bijgehouden tijdens ComfyUI render)
    renderStatus:  "Nog niet gegenereerd",
    isRendering:   false,
    comfyFileName: null,
    comfyImageUrl: null,
    currentImagePath: null,
    tokenImagePath: null
  };

  // Skills zijn afhankelijk van abilities, dus na de ability generatie
  npc.skills          = generateSkillProficiencies(npc);
  npc.skillModifiers  = generateSkillModifiers(npc);
  npc.passivePerception = 10 + (npc.skillModifiers["Perception"] ?? getModifier(npc.abilities.WIS));

  // Cinematische beschrijving voor in de chat-kaart
  // Haarkleur: gebruik descriptor (schubben/vacht) als die beschikbaar is
  const hairDesc = npc.hairColor.descriptor
    ? `${npc.hairColor.nl.toLowerCase()} ${npc.hairColor.descriptor.nl}`
    : `${npc.hairColor.nl.toLowerCase()} haar`;

  // Leeftijdscategorie tekstueel inpassen (alleen bij "oud" of "oeroud")
  const ageCatNl = getAgeCategoryNl(npc.age, npc.race);
  const agePrefix = (ageCatNl === "oud" || ageCatNl === "oeroud")
    ? `${ageCatNl}e `
    : ageCatNl === "jong" ? "jonge " : "";

  npc.cinematic = `Een ${npc.height.nl.toLowerCase()}, ${npc.posture.nl.toLowerCase()} `
    + `${agePrefix}${npc.race.nl.toLowerCase()} met ${hairDesc} en `
    + `${npc.physicalTrait.nl.toLowerCase()} ${npc.pronoun} draagt `
    + `${npc.clothing.nl.toLowerCase()} en heeft ${npc.weapon.nl.toLowerCase()} bij zich.`;

  // Engelse cinematic
  const ageCatData   = npc.race?._data?.age?.categories;
  const ageCatEn     = ageCatData
    ? (() => { for (const [, c] of Object.entries(ageCatData)) { if (npc.age <= c.max) return c.en; } return "ancient"; })()
    : null;
  const agePrefixEn  = (ageCatEn === "old" || ageCatEn === "ancient") ? `${ageCatEn} ` : ageCatEn === "young" ? "young " : "";
  const pronounEn    = npc.sex?.en?.toLowerCase().includes("female") ? "She wears" : "He wears";
  const hairDescEn   = npc.hairColor?.en
    ? (npc.hairColor.descriptor ? `${npc.hairColor.descriptor} ${npc.hairColor.en.toLowerCase()}` : npc.hairColor.en.toLowerCase())
    : "unknown hair";
  npc.cinematicEn = `A ${npc.height.en.toLowerCase()}, ${npc.posture.en.toLowerCase()} `
    + `${agePrefixEn}${npc.race.en.toLowerCase()} with ${hairDescEn} and `
    + `${npc.physicalTrait.en.toLowerCase()}. ${pronounEn} `
    + `${npc.clothing.en.toLowerCase()} and carries ${npc.weapon.en.toLowerCase()}.`;

  // Token afbeelding ophalen
  npc.tokenImagePath   = await getNPCImagePath(npc);
  npc.currentImagePath = npc.tokenImagePath;

  // AI prompts vooraf berekenen
  npc.comfyPrompt    = buildNPCComfyPrompt(npc);
  npc.comfyNegative  = baseNegativePortrait();
  npc.leonardoPrompt = buildLeonardoPrompt(npc);

  return npc;
}

// =============================================================================
// HTML RENDER – CHAT KAART
// =============================================================================

/**
 * Rendert de stat-tabel (6 ability scores met modifiers + skill-lijst).
 * Gebaseerd op de Campaign Codex visuele stijl.
 */
function renderStatBlock(npc) {
  // Bouw de 6 ability score blokjes
  const statHtml = ["STR","DEX","CON","INT","WIS","CHA"].map(s => {
    const score = npc.abilities[s];
    const mod   = getModifier(score);
    return `
<div class="wf-stat">
  <span class="wf-stat-label">${s}</span>
  <span class="wf-stat-value">${score}</span>
  <span class="wf-stat-mod">${fmtMod(mod)}</span>
</div>`;
  }).join("");

  // Bouw de skill-modifier tekst
  const skillsHtml = npc.skills.map(sk => {
    return `${escapeHtml(sk)} ${fmtMod(npc.skillModifiers[sk])}`;
  }).join(" &nbsp;·&nbsp; ");

  return `
<div class="wf-stats">${statHtml}</div>
<table class="wf-info-table">
  ${skillsHtml ? `<tr><td>${wft("WF.NPC.Label.Skills")}</td><td>${skillsHtml}</td></tr>` : ""}
  <tr><td>${wft("WF.NPC.Label.PassivePerc")}</td><td>${npc.passivePerception}</td></tr>
</table>`;
}

/**
 * Rendert de volledige NPC-kaart in Campaign Codex-stijl.
 *
 * @param {object} npc         - Het NPC-object
 * @param {boolean} buttons    - Toon publiceer/opslaan knoppen (voor GM whisper)
 * @param {boolean} gmTools    - Toon ComfyUI/Codex/Actor knoppen + prompts (GM only)
 */
export function renderNPCCard(npc, { buttons = false, gmTools = false } = {}) {
  const imgPath    = npc.currentImagePath || WorldForgeSettings.defaultNpcIcon;
  const isRendering = !!npc.isRendering;
  const lang       = WorldForgeSettings.lang ?? "nl";

  return `
<div class="wf-card">

  <!-- ── HEADER: naam/meta links, portret rechts ── -->
  <div class="wf-header">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(npc.name)}</p>
      <p class="wf-subtitle">${escapeHtml(lang === "en" ? (npc.job.en ?? npc.job.nl) : npc.job.nl)}</p>
      <div class="wf-meta-row">
        ${wfBadge(lang === "en" ? (npc.race.en ?? npc.race.nl) : npc.race.nl)}
        ${wfBadge(String(npc.age) + (lang === "en" ? " yrs" : " jr"))}
        ${wfBadge(lang === "en" ? (npc.sex.en ?? npc.sex.nl) : npc.sex.nl)}
      </div>
    </div>
    <div class="wf-portrait-wrap">
      <img class="wf-npc-portrait"
           data-img="${escapeAttr(imgPath)}"
           data-name="${escapeAttr(npc.name)}"
           src="${escapeAttr(imgPath)}"
           onerror="this.src='${escapeAttr(WorldForgeSettings.defaultNpcIcon)}';"
           title="Klik om te vergroten">
    </div>
  </div>

  <!-- ── UITERLIJK ── -->
  ${wfSectionHeader("👁", wft("WF.NPC.Section.Appearance"))}
  <div class="wf-body">
    ${wfReadout(lang === "en" ? (npc.cinematicEn ?? npc.cinematic) : npc.cinematic)}
  </div>

  <!-- ── PERSOONLIJKHEID ── -->
  ${wfSectionHeader("✦", wft("WF.NPC.Section.Personality"))}
  <div class="wf-body">
    <div class="wf-quirk">
      ${npc.quirk.title ? `<strong>${escapeHtml(lang === "en" ? (npc.quirk.title.en ?? npc.quirk.title.nl) : npc.quirk.title.nl)}</strong> — ` : ""}${escapeHtml(lang === "en" ? (npc.quirk.description?.en ?? npc.quirk.en ?? npc.quirk.nl) : (npc.quirk.description?.nl ?? npc.quirk.nl))}
    </div>
  </div>

  <!-- ── STATS ── -->
  ${wfSectionHeader("⚔", wft("WF.NPC.Section.Stats"))}
  <div class="wf-body">
    ${renderStatBlock(npc)}
  </div>

  <!-- ── RAS TRAITS ── -->
  ${(() => {
    const traits = npc.race?._data?.traits ?? [];
    if (!traits.length) return "";
    const items = traits.map(t => `
<div class="wf-trait-item">
  <strong class="wf-trait-name">${escapeHtml(t.name)}</strong>
  <span class="wf-trait-desc">${escapeHtml(t.description)}</span>
</div>`).join("");
    return `${wfSectionHeader("★", wft("WF.NPC.Section.RaceTraits"))}<div class="wf-body wf-traits-body">${items}</div>`;
  })()}

  <!-- ── GM TOOLS (alleen zichtbaar in GM whisper) ── -->
  ${gmTools ? `
  ${wfSectionHeader("⚙", wft("WF.NPC.Section.GMTools"))}
  <div class="wf-body">

    <!-- Verberg prompts in een <details> om de kaart compact te houden -->
    <details>
      <summary>Leonardo Prompt</summary>
      <div class="wf-prompt-block">${escapeHtml(npc.leonardoPrompt)}</div>
      <div class="wf-actions" style="border:none; padding:4px 0 8px;">
        <button class="wf-btn wf-copy-leonardo">📋 Copy Leonardo</button>
      </div>
    </details>

    <details>
      <summary>ComfyUI Prompts</summary>
      <div class="wf-prompt-block">${escapeHtml(npc.comfyPrompt)}</div>
      <div class="wf-prompt-block" style="margin-top:4px;">${escapeHtml(npc.comfyNegative)}</div>
      <div class="wf-actions" style="border:none; padding:4px 0 8px;">
        <button class="wf-btn wf-copy-comfy">📋 Copy Prompt</button>
        <button class="wf-btn wf-copy-negative">📋 Copy Negative</button>
      </div>
    </details>
  </div>

  <!-- Render-statusbalk -->
  <div class="wf-status">
    <strong>Portrait:</strong> ${escapeHtml(npc.renderStatus)}
    ${npc.comfyFileName ? ` &nbsp;·&nbsp; <strong>Bestand:</strong> ${escapeHtml(npc.comfyFileName)}` : ""}
  </div>

  <!-- GM actieknoppen -->
  <div class="wf-actions">
    <button class="wf-btn wf-btn-purple wf-send-comfy" ${isRendering ? "disabled" : ""}>${wft("WF.Btn.ComfyUI")}</button>
    <button class="wf-btn wf-btn-green  wf-save-codex">${wft("WF.Btn.Codex")}</button>
    <button class="wf-btn wf-btn-red    wf-save-actor">🎭 Actor</button>
  </div>
  ` : ""}

  <!-- ── PUBLICEER / OPSLAAN knoppen ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-primary wf-publish-npc">${wft("WF.Btn.Publish")}</button>
    <button class="wf-btn wf-save-npc">${wft("WF.Btn.Save")}</button>
  </div>
  ` : ""}

</div>`;
}

// =============================================================================
// HTML RENDER – EENVOUDIG (Journal / Campaign Codex)
// =============================================================================

/**
 * Rendert een minimalistische HTML-versie van de NPC voor journals
 * en Campaign Codex entries. Geen stijlklassen – puur semantische HTML.
 */
export function renderNPCSimple(npc) {
  const skillsHtml = npc.skills
    .map(sk => `${escapeHtml(sk)} ${fmtMod(npc.skillModifiers[sk])}`)
    .join(", ");

  return `
<h1>${escapeHtml(npc.name)}</h1>
<p>
  <strong>Ras:</strong> ${escapeHtml(npc.race.nl)} &nbsp;·&nbsp;
  <strong>Leeftijd:</strong> ${npc.age} &nbsp;·&nbsp;
  <strong>Geslacht:</strong> ${escapeHtml(npc.sex.nl)} &nbsp;·&nbsp;
  <strong>Beroep:</strong> ${escapeHtml(npc.job.nl)}
</p>
<h2>Read-out</h2>
<blockquote><p><em>${escapeHtml(npc.cinematic)}</em></p></blockquote>
<h2>Uiterlijk</h2>
<p>
  <strong>Lengte:</strong> ${escapeHtml(npc.height.nl)}<br>
  <strong>Houding:</strong> ${escapeHtml(npc.posture.nl)}<br>
  <strong>Haar:</strong> ${escapeHtml(npc.hairColor.nl)}<br>
  <strong>Kenmerk:</strong> ${escapeHtml(npc.physicalTrait.nl)}<br>
  <strong>Kleding:</strong> ${escapeHtml(npc.clothing.nl)}<br>
  <strong>Wapen:</strong> ${escapeHtml(npc.weapon.nl)}
</p>
<h2>Persoonlijkheid</h2>
<p>${npc.quirk.title ? `<strong>${escapeHtml(npc.quirk.title.nl)}</strong> — ` : ""}${escapeHtml(npc.quirk.description?.nl ?? npc.quirk.nl)}</p>
<h2>Stats</h2>
<table>
  <tr><th>STR</th><th>DEX</th><th>CON</th><th>INT</th><th>WIS</th><th>CHA</th></tr>
  <tr>
    <td>${npc.abilities.STR}</td><td>${npc.abilities.DEX}</td>
    <td>${npc.abilities.CON}</td><td>${npc.abilities.INT}</td>
    <td>${npc.abilities.WIS}</td><td>${npc.abilities.CHA}</td>
  </tr>
</table>
<p>${skillsHtml}<br><strong>Passive Perception:</strong> ${npc.passivePerception}</p>`;
}

// =============================================================================
// OPSLAAN ALS ACTOR
// =============================================================================

/**
 * Maakt een dnd5e NPC Actor aan in Foundry op basis van het NPC-object.
 * Stelt HP, AC, ability scores en skill proficiencies in.
 * Voegt de NPC toe aan de map "_Random NPC Actors".
 */
export async function saveNPCToActor(npc) {
  // Zorg dat de map bestaat
  let folder = game.folders.getName("_Random NPC Actors");
  if (!folder) {
    folder = await Folder.create({ name: "_Random NPC Actors", type: "Actor" });
  }

  const imagePath = getValidImagePath(npc);

  // Simpele HP en AC berekening voor een NPC
  const hp = Math.max(1, 4 + getModifier(npc.abilities.CON));
  const ac = 10 + getModifier(npc.abilities.DEX);

  // Maak de Actor aan met alle basisgegevens
  const actor = await Actor.create({
    name:   npc.name,
    type:   "npc",
    img:    imagePath,
    folder: folder.id,
    prototypeToken: {
      name:       npc.name,
      img:        imagePath,
      actorLink:  false,    // NPC tokens zijn niet gelinkt aan de actor
      disposition: 0        // Neutraal
    },
    system: {
      abilities: {
        str: { value: npc.abilities.STR }, dex: { value: npc.abilities.DEX },
        con: { value: npc.abilities.CON }, int: { value: npc.abilities.INT },
        wis: { value: npc.abilities.WIS }, cha: { value: npc.abilities.CHA }
      },
      attributes: {
        ac: { flat: ac, calc: "flat" },
        hp: { value: hp, max: hp },
        movement: { walk: 30, units: "ft" },
        prof: npc.proficiencyBonus
      },
      details: {
        biography: { value: renderNPCSimple(npc), public: "" },
        race:      npc.race.nl,
        type:      { value: "humanoid", subtype: npc.race.nl },
        alignment: "",
        cr:        0
      },
      traits: { size: "med" }
    }
  });

  // Stel skill proficiencies in als aparte update
  // (dnd5e systeem vereist dit als een tweede stap)
  const updates = {};
  for (const skill of npc.skills) {
    const key = skillToDnd5eKey[skill];
    if (key) updates[`system.skills.${key}.value`] = 1; // 1 = proficient
  }
  if (Object.keys(updates).length) await actor.update(updates);

  // Ras traits toevoegen uit races.json
  try {
    const raceTraits = npc.race?._data?.traits ?? [];
    if (raceTraits.length) {
      const itemData = raceTraits.map(trait => ({
        name: trait.name, type: "feat", img: "icons/svg/book.svg",
        system: {
          description: { value: `<p>${trait.description}</p>`, chat: "" },
          type: { value: "race" },
          requirements: npc.race.en
        }
      }));
      await actor.createEmbeddedDocuments("Item", itemData);
      console.log(`WorldForge | ${raceTraits.length} ras traits toegevoegd aan ${npc.name}`);
    }
  } catch (err) {
    console.warn("WorldForge | Kon ras traits niet toevoegen:", err);
  }

  return actor;
}

// =============================================================================
// NPcgenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class NPCGenerator extends BaseGenerator {
  static codexType = "npc";
  static folder    = "_Random NPCs";
  static icon      = "fa-user";
  static hasActor  = true;
  static hasComfy  = true;
  static comfyW    = 512;
  static comfyH    = 1024;

  static async generate(options = {}) { return generateNPC(options); }
  static render(item)                 { return renderNPCCard(item, { buttons: false, gmTools: false }); }
  static getName(item)                { return item.name ?? "NPC"; }
  static getImage(item)               { return getValidImagePath(item); }

  static getSub(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const race = lang === "en" ? (item.race?.en ?? item.race?.nl ?? "") : (item.race?.nl ?? "");
    const job  = lang === "en" ? (item.job?.en  ?? item.job?.nl  ?? "") : (item.job?.nl  ?? "");
    return `${race} · ${job}`;
  }
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Hoofdfunctie: genereer een NPC en toon die als GM-whisper in de chat.
 *
 * Lifecycle:
 *  1. Genereer NPC data
 *  2. Maak een chatbericht aan
 *  3. Registreer een renderChatMessage hook voor de knoppen
 *  4. Bij klikacties: update het bestaande chatbericht (re-render)
 *  5. Bij verwijderen van het bericht: cleanup hooks
 *
 * De hook-ID's worden bijgehouden zodat ze netjes verwijderd kunnen
 * worden als het chatbericht wordt verwijderd.
 */
export async function generateAndShowNPC() {
  // Genereer de NPC en stuur naar de WorldForge UI
  const npc = await generateNPC();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("npc", npc);
    return npc;
  }
  // Fallback naar chat als de UI niet open is

  // Referenties die we bijhouden over de lifecycle
  let msg        = null;
  let hookId     = null;
  let deleteHookId = null;

  /**
   * Maak aan of update het chatbericht met de huidige NPC-staat.
   * Wordt aangeroepen na elke statuswijziging (ComfyUI start/klaar/fout).
   */
  const update = async () => {
    const content = renderNPCCard(npc, { buttons: true, gmTools: true });
    if (!msg) {
      msg = await ChatMessage.create({
        content,
        whisper: ChatMessage.getWhisperRecipients("GM")
      });
    } else {
      await msg.update({ content });
    }
  };

  /**
   * Koppel alle knop-event handlers aan het chatbericht.
   * Wordt aangeroepen na elke update zodat de handlers altijd
   * aan de meest recente HTML zijn gekoppeld.
   */
  const bindHooks = () => {
    // Verwijder bestaande hooks om dubbele registraties te voorkomen
    if (hookId)       Hooks.off("renderChatMessage", hookId);
    if (deleteHookId) Hooks.off("deleteChatMessage", deleteHookId);

    // Hook: koppel knoppen nadat het chatbericht gerenderd is
    hookId = Hooks.on("renderChatMessage", (message, html) => {
      if (!msg || message.id !== msg.id) return;

      // Portret-klik: open in ImagePopout
      html.find(".wf-npc-portrait").off("click").on("click", function () {
        openImagePopout(
          this.dataset.img || WorldForgeSettings.defaultNpcIcon,
          this.dataset.name || "NPC"
        );
      });

      // Prompt kopieer-knoppen
      html.find(".wf-copy-leonardo").off("click").on("click", async () => {
        const ok = await copyToClipboard(npc.leonardoPrompt);
        ui.notifications[ok ? "info" : "warn"](ok ? "Leonardo prompt gekopieerd" : "Kopiëren mislukt");
      });
      html.find(".wf-copy-comfy").off("click").on("click", async () => {
        const ok = await copyToClipboard(npc.comfyPrompt);
        ui.notifications[ok ? "info" : "warn"](ok ? "Comfy prompt gekopieerd" : "Kopiëren mislukt");
      });
      html.find(".wf-copy-negative").off("click").on("click", async () => {
        const ok = await copyToClipboard(npc.comfyNegative);
        ui.notifications[ok ? "info" : "warn"](ok ? "Negative prompt gekopieerd" : "Kopiëren mislukt");
      });

      // ComfyUI render knop
      html.find(".wf-send-comfy").off("click").on("click", async () => {
        if (npc.isRendering) { ui.notifications.warn(wft("WF.Notify.RenderRunning")); return; }

        npc.isRendering  = true;
        npc.renderStatus = "Render gestart in ComfyUI...";
        await update();

        try {
          // Start de render en wacht op het resultaat
          const result = await runComfyRender({
            prompt:         npc.comfyPrompt,
            negativePrompt: npc.comfyNegative,
            width:          512,
            height:         1024,
            filenamePrefix: `${formatForFile(npc.race.en)}_${formatForFile(npc.job.en)}_${getSexType(npc.sex.en)}`
          });

          npc.comfyFileName = result.fileName;
          npc.comfyImageUrl = result.imageUrl;

          // Sla de afbeelding op in Foundry
          const savedPath = await saveComfyImageToFoundry(result.imageUrl, npc.name);
          if (savedPath) {
            npc.currentImagePath = savedPath;
            npc.tokenImagePath   = savedPath;
            npc.renderStatus     = "Portrait opgeslagen in Foundry";
          } else {
            npc.renderStatus = "Portrait gegenereerd (niet opgeslagen)";
          }
          ui.notifications.info(`${wft("WF.Notify.PortraitReady")} ${npc.name}`);

        } catch (err) {
          console.error("[WorldForge] ComfyUI fout:", err);
          npc.renderStatus = `Render mislukt: ${err.message ?? err}`;
          ui.notifications.error(wft("WF.Notify.ComfyRenderFail"));
        } finally {
          npc.isRendering = false;
          await update();
        }
      });

      // Campaign Codex opslaan
      html.find(".wf-save-codex").off("click").on("click", async () => {
        try {
          await saveToCodex(npc.name, "_Random NPCs", renderNPCSimple(npc), getValidImagePath(npc));
          ui.notifications.info(`${wft("WF.Notify.CodexNPCCreated")} ${npc.name}`);
        } catch (err) {
          console.error("[WorldForge] Codex fout:", err);
          ui.notifications.error(`${wft("WF.Notify.CodexFail")} ${err.message}`);
        }
      });

      // Actor aanmaken
      html.find(".wf-save-actor").off("click").on("click", async () => {
        try {
          const actor = await saveNPCToActor(npc);
          ui.notifications.info(`${wft("WF.Notify.ActorCreated")} ${actor.name}`);
          actor.sheet?.render(true);
        } catch (err) {
          console.error("[WorldForge] Actor fout:", err);
          ui.notifications.error(wft("WF.Notify.ActorFail"));
        }
      });

      // Publiceer naar alle spelers (zonder GM-knoppen)
      html.find(".wf-publish-npc").off("click").on("click", async () => {
        await ChatMessage.create({
          content: renderNPCCard(npc, { buttons: false, gmTools: false })
        });
        ui.notifications.info(`${npc.name} ${wft("WF.Notify.PublishedPlayers")}`);
      });

      // Opslaan als Journal Entry
      html.find(".wf-save-npc").off("click").on("click", async () => {
        try {
          const folder = await ensureJournalFolder("_Random NPCs");
          await JournalEntry.create({
            name:   npc.name,
            folder: folder.id,
            img:    getValidImagePath(npc),
            pages:  [{
              name: "Beschrijving",
              type: "text",
              text: { format: 1, content: renderNPCSimple(npc) }
            }]
          });
          ui.notifications.info(`${wft("WF.Notify.NPCSaved")} ${npc.name}`);
        } catch (err) {
          console.error("[WorldForge] Journal fout:", err);
          ui.notifications.error(wft("WF.Notify.JournalSaveFail"));
        }
      });
    });

    // Cleanup hook: verwijder handlers als het chatbericht wordt verwijderd
    deleteHookId = Hooks.on("deleteChatMessage", (deleted) => {
      if (msg && deleted.id === msg.id) {
        Hooks.off("renderChatMessage", hookId);
        Hooks.off("deleteChatMessage", deleteHookId);
      }
    });
  };

  // Start de lifecycle
  bindHooks();
  await update();
}
