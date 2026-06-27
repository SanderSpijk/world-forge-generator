/**
 * WorldForge – inn-generator.js
 *
 * Genereert een willekeurige Inn (herberg). Gebouwbeschrijving komt uit
 * buildings.json / buildings-{preset}.json via building-data.js
 * in plaats van Foundry Rollable Tables.
 *
 * Een Inn heeft kamers (overnachten) + een gelagkamer.
 * Dit onderscheidt het van een Tavern (alleen drinken/eten).
 *
 * Exporteert:
 *  - generateAndShowInn()  – hoofdfunctie
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC } from "./npc-generator.js";
import { runComfyRender, baseNegativeExterior } from "./comfyui.js";
import {
  clean, escapeHtml, escapeAttr, lowerNl, formatForFile, uniqueParts,
  openImagePopout, ensureJournalFolder, saveToCodex,
  wfSectionHeader, wfReadout, wfInfoRow, wfBadge, wfNpcItem, wfGossip, wfMenuRow
} from "./utils.js";

const QUALITY_LABELS = {
  "Armoedig":  { nl: "Armoedig",  en: "Poor"        },
  "Eenvoudig": { nl: "Eenvoudig", en: "Simple"      },
  "Gemiddeld": { nl: "Gemiddeld", en: "Average"     },
  "Goed":      { nl: "Goed",      en: "Good"        },
  "Luxe":      { nl: "Luxe",      en: "Luxurious"   },
};
function qualityLabel(quality, lang) {
  return QUALITY_LABELS[quality]?.[lang] ?? quality;
}

const wft = (key) => WorldForgeSettings.t(key);


// =============================================================================
// KWALITEIT EN PRIJZEN
// =============================================================================

/**
 * Bepaalt het kwaliteitsniveau van de inn.
 * Gewichten: Armoedig 10%, Eenvoudig 20%, Gemiddeld 40%, Goed 20%, Luxe 10%.
 */
function getInnQuality() {
  const r = Math.random();
  if (r < 0.10) return "Armoedig";
  if (r < 0.30) return "Eenvoudig";
  if (r < 0.70) return "Gemiddeld";
  if (r < 0.90) return "Goed";
  return "Luxe";
}

/**
 * Geeft het prijsoverzicht voor elk kwaliteitsniveau.
 */
function getPrices(quality) {
  const map = {
    Armoedig:  { mealSimple:"3 sp",  mealFull:"6 sp",  breakfast:"2 sp", beer:"2 cp", wineGlass:"3 cp", wineBottle:"2 sp",  spirits:"5 cp",  dormitory:"2 sp",  groupRoom:"5 sp" },
    Eenvoudig: { mealSimple:"4 sp",  mealFull:"8 sp",  breakfast:"3 sp", beer:"3 cp", wineGlass:"4 cp", wineBottle:"3 sp",  spirits:"8 cp",  dormitory:"3 sp",  groupRoom:"8 sp",  doubleRoom:"1 gp" },
    Gemiddeld: { mealSimple:"5 sp",  mealFull:"1 gp",  breakfast:"4 sp", beer:"4 cp", wineGlass:"6 cp", wineBottle:"4 sp",  spirits:"1 sp",  dormitory:"4 sp",  groupRoom:"1 gp",  singleRoom:"8 sp",  doubleRoom:"12 sp" },
    Goed:      { mealSimple:"7 sp",  mealFull:"12 sp", breakfast:"5 sp", beer:"6 cp", wineGlass:"8 cp", wineBottle:"6 sp",  spirits:"15 cp", groupRoom:"12 sp", singleRoom:"1 gp",  doubleRoom:"15 sp" },
    Luxe:      { mealSimple:"1 gp",  mealFull:"15 sp", breakfast:"7 sp", beer:"8 cp", wineGlass:"1 sp", wineBottle:"1 gp",  spirits:"2 sp",  singleRoom:"15 sp", doubleRoom:"2 gp", groupRoom:"15 sp" }
  };
  return map[quality] ?? map.Gemiddeld;
}

/**
 * Genereert het aantal kamers per type op basis van kwaliteitsniveau.
 */
async function generateRooms(quality) {
  const r = async (formula) => {
    const roll = new Roll(formula);
    await roll.evaluate();
    return roll.total;
  };

  let rooms;
  switch (quality) {
    case "Armoedig":  rooms = { single:0,          double:0,              group: await r("1d2"), dormitory: await r("1d2") }; break;
    case "Eenvoudig": rooms = { single:0,          double: await r("1d4"), group: await r("1d2"), dormitory: 1 };             break;
    case "Gemiddeld": rooms = { single: await r("1d4"), double: await r("1d4"), group: await r("1d2"), dormitory: 0 };        break;
    case "Goed":      rooms = { single: await r("1d6"), double: await r("1d6"), group: await r("1d2"), dormitory: 0 };        break;
    case "Luxe":      rooms = { single: await r("1d8"), double: await r("1d4"), group: 0,              dormitory: 0 };        break;
    default:          rooms = { single: await r("1d4"), double: await r("1d4"), group: 1,              dormitory: 0 };
  }

  // Garandeer altijd minstens één slaapoptie
  if (!rooms.single && !rooms.double && !rooms.group && !rooms.dormitory) {
    rooms.dormitory = 1;
  }
  return rooms;
}

// =============================================================================
// INN-SPECIFIEKE FUNCTIES
// =============================================================================

/**
 * Geeft een inn-specifieke functietitel op basis van index en geslacht.
 */
function getInnJob(index, sex) {
  const raw    = typeof sex === "object" ? clean(sex?.en || sex?.nl || "") : clean(sex);
  const isMale = raw.toLowerCase().includes("male");
  const jobs = [
    isMale ? { nl: "serveerder",  en: "waiter"     } : { nl: "serveerster", en: "waitress"   },
    {          nl: "kok",         en: "cook"        },
    isMale ? { nl: "barman",      en: "bartender"   } : { nl: "barvrouw",   en: "bartender"  },
    {          nl: "keukenhulp",  en: "kitchen hand"},
    isMale ? { nl: "staljongen",  en: "stable hand" } : { nl: "klusjesman", en: "handyman"   },
  ];
  return jobs[index] ?? { nl: "medewerker", en: "staff" };
}

// =============================================================================
// COMFYUI PROMPT
// =============================================================================

/**
 * Bouwt de ComfyUI prompt voor een inn-exterieur.
 */

const QUALITY_EN = { "Armoedig": "poor", "Eenvoudig": "simple", "Gemiddeld": "average", "Goed": "good", "Luxe": "luxurious" };

function buildInnComfyPrompt(inn) {
  const themeTags = WorldForgeSettings.campaignThemeTags
    .split(",").map(t => t.trim()).filter(Boolean);

  return uniqueParts([
    "wide cinematic fantasy inn exterior",
    "environment concept art",
    "high fantasy tavern and inn building illustration",
    "establishing shot", "front three-quarter view",
    ...themeTags,
    "detailed architecture",
    "weathered materials",
    "daylight", "soft dramatic lighting", "sharp focus",
    QUALITY_EN[inn.quality] ?? inn.quality.toLowerCase(),
    clean(inn.building.en),
    `building material clearly visible: ${clean(inn.building.en)}`,
    clean(inn.roof.en), clean(inn.height.en),
    clean(inn.detail.en), clean(inn.sfeer.en), clean(inn.drukte.en),
    "inn exterior", "exterior only",
    "only the building and its surroundings",
    "no interior visible", "no people", "no characters",
    "no signage text", "no watermark"
  ]).join(", ");
}

// =============================================================================
// HTML RENDER – CHAT KAART
// =============================================================================

/**
 * Rendert het kamerblok als een grid.
 * Toont alleen kamertypes die daadwerkelijk aanwezig zijn.
 */
function renderRoomBlock(inn) {
  const p     = inn.prices;
  const rooms = inn.rooms;
  const items = [];

  if (rooms.single > 0) items.push(`
    <div class="wf-room-item">
      <span class="wf-room-type">${wft("WF.Inn.Room.Single")}</span>
      <span class="wf-room-count">${rooms.single}</span>
      ${p.singleRoom ? `<span class="wf-room-price">${escapeHtml(p.singleRoom)} ${wft("WF.Inn.Room.PerNight")}</span>` : ""}
    </div>`);

  if (rooms.double > 0) items.push(`
    <div class="wf-room-item">
      <span class="wf-room-type">${wft("WF.Inn.Room.Double")}</span>
      <span class="wf-room-count">${rooms.double}</span>
      ${p.doubleRoom ? `<span class="wf-room-price">${escapeHtml(p.doubleRoom)} ${wft("WF.Inn.Room.PerNight")}</span>` : ""}
    </div>`);

  if (rooms.group > 0) items.push(`
    <div class="wf-room-item">
      <span class="wf-room-type">${wft("WF.Inn.Room.Group")}</span>
      <span class="wf-room-count">${rooms.group}</span>
      ${p.groupRoom ? `<span class="wf-room-price">${escapeHtml(p.groupRoom)} ${wft("WF.Inn.Room.PerNight")}</span>` : ""}
    </div>`);

  if (rooms.dormitory > 0) items.push(`
    <div class="wf-room-item">
      <span class="wf-room-type">${wft("WF.Inn.Room.Dormitory")}</span>
      <span class="wf-room-count">${rooms.dormitory}</span>
      ${p.dormitory ? `<span class="wf-room-price">${escapeHtml(p.dormitory)} ${wft("WF.Inn.Room.PerBed")}</span>` : ""}
    </div>`);

  return items.length
    ? `<div class="wf-rooms">${items.join("")}</div>`
    : `<p style="color:var(--wf-text-dim);font-size:12px;">Geen kamers beschikbaar.</p>`;
}

/**
 * Rendert de inn-kaart in Campaign Codex-stijl.
 */
export function renderInnCard(inn, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const imgBlock = inn.currentImagePath ? `
    <div class="wf-art-wrap">
      <img class="wf-side-art wf-inn-art"
           data-img="${escapeAttr(inn.currentImagePath)}"
           data-name="${escapeAttr(inn.innName)}"
           src="${escapeAttr(inn.currentImagePath)}"
           onerror="this.closest('.wf-art-wrap').remove();"
           title="Klik om te vergroten">
    </div>` : "";

  const qualityBadge = `<span class="wf-quality wf-quality-${inn.quality}">${escapeHtml(qualityLabel(inn.quality, lang))}</span>`;

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(inn.innName)}</p>
      <p class="wf-subtitle">${wft("WF.Inn.Subtitle")}</p>
      <div class="wf-meta-row">${qualityBadge}</div>
    </div>
    ${imgBlock}
  </div>

  <!-- ── BESCHRIJVING ── -->
  ${wfSectionHeader("📖", wft("WF.Inn.Section.Description"))}
  <div class="wf-body">
    ${wfReadout(inn.description)}
  </div>

  <!-- ── KAMERS ── -->
  ${wfSectionHeader("🛏", wft("WF.Inn.Section.Rooms"))}
  <div class="wf-body">
    ${renderRoomBlock(inn)}
  </div>

  <!-- ── MENUKAART ── -->
  ${wfSectionHeader("📜", wft("WF.Inn.Section.Menu"))}
  <div class="wf-body">
    <div class="wf-menu-section">
      ${wfMenuRow(wft("WF.Menu.Section.Breakfast"),            inn.prices.breakfast ?? "?", inn.breakfast)}
      ${wfMenuRow(wft("WF.Inn.Row.Beer"),         inn.prices.beer,             inn.beerAle)}
      ${wfMenuRow(wft("WF.Inn.Row.Spirits"),       inn.prices.spirits,          inn.spirit)}
      ${wfMenuRow(wft("WF.Inn.Row.WineGlass"),        inn.prices.wineGlass,        inn.wine)}
      ${wfMenuRow(wft("WF.Inn.Row.WineBottle"),        inn.prices.wineBottle,       inn.wine)}
      ${wfMenuRow(wft("WF.Inn.Row.FullMeal"), inn.prices.mealFull,         inn.fullMeal)}
      ${wfMenuRow(wft("WF.Inn.Row.DailyMeal"),        inn.prices.mealSimple,       inn.randomMeal)}
    </div>
  </div>

  <!-- ── EIGENAAR ── -->
  ${wfSectionHeader("👤", wft("WF.Inn.Section.Owner"))}
  <div class="wf-body">
    ${wfNpcItem(inn.owner)}
  </div>

  <!-- ── MEDEWERKERS ── -->
  ${wfSectionHeader("👥", `${wft("WF.Inn.Section.Staff")} (${inn.employeeCount})`)}
  <div class="wf-body">
    ${inn.employees.map(emp => wfNpcItem(emp, emp.innJob)).join("")}
  </div>

  <!-- ── GASTEN ── -->
  ${wfSectionHeader("🪑", `${wft("WF.Inn.Section.Guests")} (${inn.customerCount})`)}
  <div class="wf-body">
    ${inn.customers.map(c => wfNpcItem(c)).join("")}
  </div>

  <!-- ── RODDELS ── -->
  ${wfSectionHeader("💬", `${wft("WF.Inn.Section.Gossip")} (${inn.gossip.length})`)}
  <div class="wf-body">
    ${wfGossip(inn.gossip)}
  </div>

  <!-- Render-statusbalk -->
  <div class="wf-status">
    <strong>Artwork:</strong> ${escapeHtml(inn.renderStatus)}
    ${inn.comfyFileName ? ` &nbsp;·&nbsp; <strong>Bestand:</strong> ${escapeHtml(inn.comfyFileName)}` : ""}
  </div>

  <!-- ── ACTIEKNOPPEN ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-purple wf-send-comfy" ${inn.isRendering ? "disabled" : ""}>🎨 ComfyUI</button>
    <button class="wf-btn wf-btn-primary wf-publish-inn">${wft("WF.Btn.Publish")}</button>
    <button class="wf-btn wf-save-inn">${wft("WF.Btn.Save")}</button>
    <button class="wf-btn wf-btn-green wf-save-codex">${wft("WF.Btn.Codex")}</button>
  </div>` : ""}

</div>`;
}

// =============================================================================
// HTML RENDER – JOURNAL / CAMPAIGN CODEX
// =============================================================================

function renderInnJournal(inn) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return `
<h1>${escapeHtml(inn.innName)}</h1>
${inn.currentImagePath ? `<p><img src="${escapeAttr(inn.currentImagePath)}" style="max-width:100%;height:auto;"></p>` : ""}
<p><strong>${wft("WF.Inn.Section.Rooms")}:</strong> ${escapeHtml(qualityLabel(inn.quality, lang))}</p>
<blockquote><p><em>${escapeHtml(inn.description)}</em></p></blockquote>
<h2>${wft("WF.Inn.Section.Owner")}</h2>
<p><strong>${escapeHtml(inn.owner.name)}</strong> – ${escapeHtml(lang === "en" ? (inn.owner.race.en ?? inn.owner.race.nl) : inn.owner.race.nl)} (${escapeHtml(inn.owner.age)})<br>
<em>${escapeHtml(lang === "en" ? (inn.owner.cinematicEn ?? inn.owner.cinematic) : inn.owner.cinematic)}</em></p>`;
}

function renderInnCodex(inn) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return `
<h1>${escapeHtml(inn.innName)}</h1>
<p>${escapeHtml(qualityLabel(inn.quality, lang))}</p>
<hr>
<h1>${wft("WF.Inn.Section.Description")}</h1>
<blockquote><p><em>${escapeHtml(inn.description)}</em></p></blockquote>
<h1>${wft("WF.Inn.Section.Owner")}</h1>
<p><strong>${escapeHtml(inn.owner.name)}</strong> – ${escapeHtml(lang === "en" ? (inn.owner.race.en ?? inn.owner.race.nl) : inn.owner.race.nl)} (${escapeHtml(inn.owner.age)})</p>
<p><em>${escapeHtml(lang === "en" ? (inn.owner.cinematicEn ?? inn.owner.cinematic) : inn.owner.cinematic)}</em></p>
<h1>${wft("WF.Menu.Section.Breakfast")}</h1>
<p>${escapeHtml(inn.breakfast)}</p>
<h1>${wft("WF.Inn.Section.Menu")}</h1>
<p><strong>${wft("WF.Inn.Row.Beer")}:</strong> ${escapeHtml(inn.beerAle)}</p>
<p><strong>${wft("WF.Inn.Row.Spirits")}:</strong> ${escapeHtml(inn.spirit)}</p>
<p><strong>${wft("WF.Inn.Row.WineGlass")}:</strong> ${escapeHtml(inn.wine)}</p>
<p><strong>${wft("WF.Inn.Row.FullMeal")}:</strong> ${escapeHtml(inn.fullMeal)}</p>
<p><strong>Dagmaaltijd:</strong> ${escapeHtml(inn.randomMeal)}</p>
<section class="secret">
  <h1>Roddels</h1>
  <p>${inn.gossip.map(g => `• ${escapeHtml(g)}`).join("<br>")}</p>
</section>`;
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Genereert een willekeurige Inn.
 *
 * Gebouwbeschrijving via building-data.js (JSON):
 *  - gebouw, dak, hoogte, sfeer, detail_inn, drukte
 *
 * Rollable Tables worden nog gebruikt voor:
 *  - Namen, menukaart, roddels
 */
export async function generateInn() {
  // ── Naam en kwaliteit ─────────────────────────────────────────────────────

  // DataLoader handle inns.json + preset thema bestand
  const innData  = await DataLoader.load("inns.json");
  const prefixes = innData.prefixes ?? [];
  const suffixes = innData.suffixes ?? [];
  const prefix   = prefixes[Math.floor(Math.random() * prefixes.length)] ?? "The";
  const suffix   = suffixes[Math.floor(Math.random() * suffixes.length)] ?? "Inn";
  const innName  = `${prefix} ${suffix}`;

  const quality = getInnQuality();
  const prices  = getPrices(quality);

  // ── Gebouwbeschrijving uit JSON — theme-aware ─────────────────────────────

  // Detecteer huidge theme preset
  const preset = (typeof game !== "undefined"
    ? game.settings.get("world-forge-generator", "campaignThemePreset")
    : null) ?? "medieval";

  // Load buildings data
  const buildingsData = await DataLoader.load("buildings.json");

  // Helper: pick random item from theme, fallback to generic
  const pickFromTheme = (key, theme) => {
    const items = buildingsData[key] ?? [];
    const themed = items.filter(item => item.theme === theme || item.theme === "generic");
    if (themed.length === 0) return { nl: "", en: "" };
    return themed[Math.floor(Math.random() * themed.length)];
  };

  const building = pickFromTheme("gebouw", preset);
  const roof     = pickFromTheme("dak", preset);
  const height   = pickFromTheme("hoogte", preset);
  const sfeer    = pickFromTheme("sfeer", preset);
  const detail   = pickFromTheme("detail_inn", preset);
  const drukte   = pickFromTheme("drukte", preset);

  // ── Beschrijving ──────────────────────────────────────────────────────────

  const lang = WorldForgeSettings.lang;
  const description = lang === "nl"
    ? `De herberg is ${building.nl}, met ${roof.nl}, en is ${height.nl}. ${drukte.nl} Binnen ${detail.nl} ${sfeer.nl}`
    : `The inn is ${building.en}, with ${roof.en}, and is ${height.en}. ${drukte.en} Inside, ${detail.en} ${sfeer.en}`;

  // ── Kamers ────────────────────────────────────────────────────────────────

  const rooms = await generateRooms(quality);

  // ── Menukaart ─────────────────────────────────────────────────────────────

  const menuData = await DataLoader.load("inns.json");

  // Helper: safely get nested menu items
  const getMenuItem = (arr, lang) => {
    if (!arr || arr.length === 0) return "";
    const item = arr[Math.floor(Math.random() * arr.length)];
    if (typeof item === "string") return item;
    return lang === "en" ? (item.en ?? item.nl ?? "") : (item.nl ?? "");
  };

  const ontbijtItem = (menuData.ontbijt ?? [])[Math.floor(Math.random() * (menuData.ontbijt ?? []).length)] ?? { nl: "", en: "" };
  const breakfast   = lang === "en" ? (ontbijtItem.en ?? ontbijtItem.nl) : ontbijtItem.nl;
  const beerAle    = getMenuItem(menuData.dranken?.bier ?? [], lang);
  const spirit     = getMenuItem(menuData.dranken?.spirits ?? [], lang);
  const wine       = getMenuItem(menuData.dranken?.wijn ?? [], lang);
  const fullMealObj  = (menuData.maaltijden?.volledig ?? [])[Math.floor(Math.random() * (menuData.maaltijden?.volledig ?? []).length)] ?? { nl: "", en: "" };
  const fullMeal     = lang === "en" ? (fullMealObj.en ?? fullMealObj.nl) : fullMealObj.nl;

  // Dagmaaltijd: {prefix} {meat}, with {starch} and {vegetable}
  const mealPrefix  = getMenuItem(menuData.maaltijden?.prefix ?? [], lang);
  const mealMeat    = getMenuItem(menuData.maaltijden?.vlees ?? [], lang);
  const mealStarch  = getMenuItem(menuData.maaltijden?.starch ?? [], lang);
  const mealVeg     = getMenuItem(menuData.maaltijden?.groenten ?? [], lang);
  const randomMeal  = lang === "en"
    ? `${mealPrefix} ${mealMeat}, with ${mealStarch} and ${mealVeg}`
    : `${mealPrefix} ${mealMeat}, met ${mealStarch} en ${mealVeg}`;

  // ── Eigenaar ──────────────────────────────────────────────────────────────

  const owner = await generateNPC();
  owner.job = { nl: "Herbergier", en: "Innkeeper" };

  // ── Medewerkers (1-5) ─────────────────────────────────────────────────────

  const employeeCount = Math.floor(Math.random() * 5) + 1;
  const employees     = [];

  for (let i = 0; i < employeeCount; i++) {
    const npc = await generateNPC();
    employees.push({
      ...npc,
      innJob:           getInnJob(i, npc.sex),
      shortDescription: lang === "en"
          ? `A ${npc.height.en?.toLowerCase()}, ${npc.posture.en?.toLowerCase()} ${npc.race.en?.toLowerCase()} with ${npc.hairColor.en?.toLowerCase()} hair.`
          : `Een ${lowerNl(npc.height.nl)}, ${lowerNl(npc.posture.nl)} ${lowerNl(npc.race.nl)} met ${lowerNl(npc.hairColor.nl)} haar.`
    });
  }

  // ── Gasten ────────────────────────────────────────────────────────────────

  const customerCount = employeeCount + 1;
  const customers     = [];
  for (let i = 0; i < customerCount; i++) {
    customers.push(await generateNPC());
  }

  // ── Roddels ───────────────────────────────────────────────────────────────

  const gossip = [];
  const gossipData = await DataLoader.load("inns.json");
  const roddels = gossipData.roddels ?? gossipData.roddel ?? [];
  for (let i = 0; i < employeeCount; i++) {
    const roddel = roddels[Math.floor(Math.random() * roddels.length)] ?? { nl: "", en: "" };
    gossip.push(lang === "en" ? (roddel.en ?? roddel.nl) : roddel.nl);
  }

  // ── Inn object ────────────────────────────────────────────────────────────

  const inn = {
    innName, quality, prices,
    building, roof, height, sfeer, detail, drukte, description,
    rooms, breakfast, beerAle, spirit, wine, fullMeal, randomMeal,
    owner, employeeCount, customerCount, employees, customers, gossip,
    renderStatus: "Nog niet gegenereerd",
    comfyFileName: null, currentImagePath: null, isRendering: false
  };

  inn.comfyPrompt   = buildInnComfyPrompt(inn);
  inn.comfyNegative = baseNegativeExterior(inn.building.en);
  return inn;
}

/**
 * Genereert een inn en stuurt die naar de WorldForge UI.
 */
// =============================================================================
// InnGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class InnGenerator extends BaseGenerator {
  static codexType = "inn";
  static folder    = "_Random Inns";
  static icon      = "fa-bed";
  static hasActor  = false;
  static hasComfy  = true;
  static comfyW    = 1024;
  static comfyH    = 768;

  static async generate(options = {}) { return generateInn(options); }
  static render(item)                 { return renderInnCard(item, { buttons: false }); }
  static getName(item)                { return item.innName ?? "Inn"; }
  static getImage(item)               { return item.currentImagePath ?? ""; }

  static getSub(item) {
    const q = item.quality ?? "";
    const qmap = {
      "Armoedig": "Poor",
      "Eenvoudig": "Simple",
      "Gemiddeld": "Average",
      "Goed": "Good",
      "Luxe": "Luxurious"
    };
    return WorldForgeSettings.lang === "en" ? (qmap[q] ?? q) : q;
  }
}

/**
 * Genereert een inn en stuurt die naar de WorldForge UI.
 */
export async function generateAndShowInn() {
  const inn = await generateInn();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("inn", inn);
  }
  return inn;
}
