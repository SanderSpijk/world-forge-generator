/**
 * WorldForge – tavern-generator.js
 *
 * Genereert een willekeurige Tavern (kroeg zonder kamers). Gebouwbeschrijving
 * komt uit buildings.json / buildings-{preset}.json via building-data.js
 * in plaats van Foundry Rollable Tables.
 *
 * Verschil met Inn:
 *  - Geen kamers (alleen drinken en eten)
 *  - Geen ontbijt
 *
 * Exporteert:
 *  - generateAndShowTavern()  – hoofdfunctie
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
 * Bepaalt het kwaliteitsniveau van de tavern.
 * Zelfde weging als de Inn generator (10/20/40/20/10%).
 */
function getTavernQuality() {
  const r = Math.random();
  if (r < 0.10) return "Armoedig";
  if (r < 0.30) return "Eenvoudig";
  if (r < 0.70) return "Gemiddeld";
  if (r < 0.90) return "Goed";
  return "Luxe";
}

/**
 * Prijsoverzicht per kwaliteitsniveau voor een tavern (geen kamerprijzen).
 */
function getPrices(quality) {
  const map = {
    Armoedig:  { mealSimple:"3 sp",  mealFull:"6 sp",  beer:"2 cp", wineGlass:"3 cp", wineBottle:"2 sp",  spirits:"5 cp"  },
    Eenvoudig: { mealSimple:"4 sp",  mealFull:"8 sp",  beer:"3 cp", wineGlass:"4 cp", wineBottle:"3 sp",  spirits:"8 cp"  },
    Gemiddeld: { mealSimple:"5 sp",  mealFull:"1 gp",  beer:"4 cp", wineGlass:"6 cp", wineBottle:"4 sp",  spirits:"1 sp"  },
    Goed:      { mealSimple:"7 sp",  mealFull:"12 sp", beer:"6 cp", wineGlass:"8 cp", wineBottle:"6 sp",  spirits:"15 cp" },
    Luxe:      { mealSimple:"1 gp",  mealFull:"15 sp", beer:"8 cp", wineGlass:"1 sp", wineBottle:"1 gp",  spirits:"2 sp"  }
  };
  return map[quality] ?? map.Gemiddeld;
}

// =============================================================================
// MEDEWERKER FUNCTIES
// =============================================================================

/**
 * Geeft een tavern-specifieke functietitel op basis van index en geslacht.
 */
function getTavernJob(index, sex) {
  const raw    = typeof sex === "object" ? clean(sex?.en || sex?.nl || "") : clean(sex);
  const isMale = raw.toLowerCase().includes("male");
  const jobs = [
    isMale ? { nl: "serveerder",  en: "waiter"     } : { nl: "serveerster", en: "waitress"  },
    {          nl: "kok",         en: "cook"        },
    isMale ? { nl: "barman",      en: "bartender"   } : { nl: "barvrouw",   en: "bartender" },
    {          nl: "keukenhulp",  en: "kitchen hand"},
    {          nl: "uitsmijter",  en: "bouncer"     },
  ];
  return jobs[index] ?? { nl: "medewerker", en: "staff" };
}

// =============================================================================
// COMFYUI PROMPT
// =============================================================================

/**
 * Bouwt de ComfyUI prompt voor een tavern-exterieur.
 */

const QUALITY_EN = { "Armoedig": "poor", "Eenvoudig": "simple", "Gemiddeld": "average", "Goed": "good", "Luxe": "luxurious" };

function buildTavernComfyPrompt(tavern) {
  const themeTags = WorldForgeSettings.campaignThemeTags
    .split(",").map(t => t.trim()).filter(Boolean);

  return uniqueParts([
    "wide cinematic fantasy tavern exterior",
    "environment concept art",
    "high fantasy tavern building illustration",
    "establishing shot", "front three-quarter view",
    ...themeTags,
    "detailed architecture",
    "weathered materials",
    "daylight", "soft dramatic lighting", "sharp focus",
    QUALITY_EN[tavern.quality] ?? tavern.quality.toLowerCase(),
    clean(tavern.building.en),
    `building material clearly visible: ${clean(tavern.building.en)}`,
    clean(tavern.roof.en), clean(tavern.detail.en),
    clean(tavern.sfeer.en), clean(tavern.drukte.en),
    "tavern exterior", "exterior only",
    "only the building and its surroundings",
    "no interior visible", "no people", "no characters",
    "no signage text", "no watermark"
  ]).join(", ");
}

// =============================================================================
// HTML RENDER – CHAT KAART
// =============================================================================

/**
 * Rendert de tavern-kaart in Campaign Codex-stijl.
 */
export function renderTavernCard(tavern, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const imgBlock = tavern.currentImagePath ? `
    <div class="wf-art-wrap">
      <img class="wf-side-art wf-tavern-art"
           data-img="${escapeAttr(tavern.currentImagePath)}"
           data-name="${escapeAttr(tavern.tavernName)}"
           src="${escapeAttr(tavern.currentImagePath)}"
           onerror="this.closest('.wf-art-wrap').remove();"
           title="Klik om te vergroten">
    </div>` : "";

  const qualityBadge = `<span class="wf-quality wf-quality-${tavern.quality}">${escapeHtml(qualityLabel(tavern.quality, lang))}</span>`;

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(tavern.tavernName)}</p>
      <p class="wf-subtitle">${wft("WF.Tavern.Subtitle")}</p>
      <div class="wf-meta-row">${qualityBadge}</div>
    </div>
    ${imgBlock}
  </div>

  <!-- ── BESCHRIJVING ── -->
  ${wfSectionHeader("📖", wft("WF.Tavern.Section.Description"))}
  <div class="wf-body">
    ${wfReadout(tavern.description)}
  </div>

  <!-- ── MENUKAART ── -->
  ${wfSectionHeader("📜", wft("WF.Tavern.Section.Menu"))}
  <div class="wf-body">
    <div class="wf-menu-section">
      ${wfMenuRow(wft("WF.Inn.Row.Beer"),         tavern.prices.beer,       tavern.beerAle)}
      ${wfMenuRow(wft("WF.Inn.Row.Spirits"),       tavern.prices.spirits,    tavern.spirit)}
      ${wfMenuRow(wft("WF.Inn.Row.WineGlass"),        tavern.prices.wineGlass,  tavern.wine)}
      ${wfMenuRow(wft("WF.Inn.Row.WineBottle"),        tavern.prices.wineBottle, tavern.wine)}
      ${wfMenuRow(wft("WF.Inn.Row.FullMeal"), tavern.prices.mealFull,   tavern.fullMeal)}
      ${wfMenuRow(wft("WF.Inn.Row.DailyMeal"),        tavern.prices.mealSimple, tavern.randomMeal)}
    </div>
  </div>

  <!-- ── EIGENAAR ── -->
  ${wfSectionHeader("👤", wft("WF.Tavern.Section.Owner"))}
  <div class="wf-body">
    ${wfNpcItem(tavern.owner)}
  </div>

  <!-- ── MEDEWERKERS ── -->
  ${wfSectionHeader("👥", `${wft("WF.Tavern.Section.Staff")} (${tavern.employeeCount})`)}
  <div class="wf-body">
    ${tavern.employees.map(emp => wfNpcItem(emp, emp.tavernJob)).join("")}
  </div>

  <!-- ── KLANTEN ── -->
  ${wfSectionHeader("🪑", `${wft("WF.Tavern.Section.Customers")} (${tavern.customerCount})`)}
  <div class="wf-body">
    ${tavern.customers.map(c => wfNpcItem(c)).join("")}
  </div>

  <!-- ── RODDELS ── -->
  ${wfSectionHeader("💬", `${wft("WF.Tavern.Section.Gossip")} (${tavern.gossip.length})`)}
  <div class="wf-body">
    ${wfGossip(tavern.gossip)}
  </div>

  <!-- Render-statusbalk -->
  <div class="wf-status">
    <strong>${wft("WF.Status.Artwork")}:</strong> ${escapeHtml(tavern.renderStatus)}
    ${tavern.comfyFileName ? ` &nbsp;·&nbsp; <strong>Bestand:</strong> ${escapeHtml(tavern.comfyFileName)}` : ""}
  </div>

  <!-- ── ACTIEKNOPPEN ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-purple wf-send-comfy" ${tavern.isRendering ? "disabled" : ""}>${wft("WF.Btn.ComfyUI")}</button>
    <button class="wf-btn wf-btn-primary wf-publish-tavern">${wft("WF.Btn.Publish")}</button>
    <button class="wf-btn wf-save-tavern">${wft("WF.Btn.Save")}</button>
    <button class="wf-btn wf-btn-green wf-save-codex">${wft("WF.Btn.Codex")}</button>
  </div>` : ""}

</div>`;
}

// =============================================================================
// HTML RENDER – JOURNAL / CAMPAIGN CODEX
// =============================================================================

function renderTavernJournal(tavern) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return `
<h1>${escapeHtml(tavern.tavernName)}</h1>
${tavern.currentImagePath ? `<p><img src="${escapeAttr(tavern.currentImagePath)}" style="max-width:100%;height:auto;"></p>` : ""}
<p><strong>${wft("WF.Inn.Section.Rooms")}:</strong> ${escapeHtml(qualityLabel(tavern.quality, lang))}</p>
<blockquote><p><em>${escapeHtml(tavern.description)}</em></p></blockquote>
<h2>${wft("WF.Tavern.Section.Owner")}</h2>
<p><strong>${escapeHtml(tavern.owner.name)}</strong> – ${escapeHtml(lang === "en" ? (tavern.owner.race.en ?? tavern.owner.race.nl) : tavern.owner.race.nl)} (${escapeHtml(tavern.owner.age)})<br>
<em>${escapeHtml(lang === "en" ? (tavern.owner.cinematicEn ?? tavern.owner.cinematic) : tavern.owner.cinematic)}</em></p>`;
}

function renderTavernCodex(tavern) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return `
<h1>${escapeHtml(tavern.tavernName)}</h1>
<p>${escapeHtml(qualityLabel(tavern.quality, lang))}</p>
<hr>
<h1>${wft("WF.Tavern.Section.Description")}</h1>
<blockquote><p><em>${escapeHtml(tavern.description)}</em></p></blockquote>
<h1>${wft("WF.Tavern.Section.Owner")}</h1>
<p><strong>${escapeHtml(tavern.owner.name)}</strong> – ${escapeHtml(lang === "en" ? (tavern.owner.race.en ?? tavern.owner.race.nl) : tavern.owner.race.nl)} (${escapeHtml(tavern.owner.age)})</p>
<p><em>${escapeHtml(lang === "en" ? (tavern.owner.cinematicEn ?? tavern.owner.cinematic) : tavern.owner.cinematic)}</em></p>
<h1>${wft("WF.Tavern.Section.Menu")}</h1>
<p><strong>${wft("WF.Inn.Row.Beer")}:</strong> ${escapeHtml(tavern.beerAle)}</p>
<p><strong>${wft("WF.Inn.Row.Spirits")}:</strong> ${escapeHtml(tavern.spirit)}</p>
<p><strong>${wft("WF.Inn.Row.WineGlass")}:</strong> ${escapeHtml(tavern.wine)}</p>
<p><strong>${wft("WF.Inn.Row.FullMeal")}:</strong> ${escapeHtml(tavern.fullMeal)}</p>
<p><strong>${wft("WF.Inn.Row.DailyMeal")}:</strong> ${escapeHtml(tavern.randomMeal)}</p>
<section class="secret">
  <h1>${wft("WF.Tavern.Section.Gossip")}</h1>
  <p>${tavern.gossip.map(g => `• ${escapeHtml(g)}`).join("<br>")}</p>
</section>`;
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Genereert een willekeurige Tavern.
 *
 * Gebouwbeschrijving via building-data.js (JSON):
 *  - gebouw, dak, sfeer, detail_inn, drukte
 *  (geen hoogte: taverns zijn doorgaans één verdieping)
 *
 * Rollable Tables worden nog gebruikt voor:
 *  - Namen, menukaart, roddels
 */
export async function generateTavern() {
  // ── Naam en kwaliteit ─────────────────────────────────────────────────────

  // DataLoader handle inns.json + preset thema bestand
  const innData  = await DataLoader.load("inns.json");
  const prefixes = innData.prefixes ?? [];
  const suffixes = innData.suffixes ?? [];
  const prefix   = prefixes[Math.floor(Math.random() * prefixes.length)] ?? "The";
  const suffix   = suffixes[Math.floor(Math.random() * suffixes.length)] ?? "Tavern";
  const tavernName = `${prefix} ${suffix}`;

  const quality = getTavernQuality();
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
  const sfeer    = pickFromTheme("sfeer", preset);
  const detail   = pickFromTheme("detail_inn", preset);
  const drukte   = pickFromTheme("drukte", preset);

  // ── Beschrijving ──────────────────────────────────────────────────────────

  const lang = WorldForgeSettings.lang;
  const description = lang === "nl"
    ? `De tavern is ${building.nl}, met ${roof.nl}. ${drukte.nl} Binnen ${detail.nl} ${sfeer.nl}`
    : `The tavern is ${building.en}, with ${roof.en}. ${drukte.en} Inside, ${detail.en} ${sfeer.en}`;

  // ── Menukaart ─────────────────────────────────────────────────────────────

  const menuData = await DataLoader.load("inns.json");

  // Helper: safely get nested menu items
  const getMenuItem = (arr, lang) => {
    if (!arr || arr.length === 0) return "";
    const item = arr[Math.floor(Math.random() * arr.length)];
    if (typeof item === "string") return item;
    return lang === "en" ? (item.en ?? item.nl ?? "") : (item.nl ?? "");
  };

  const beerAle    = getMenuItem(menuData.dranken?.bier ?? [], lang);
  const spirit     = getMenuItem(menuData.dranken?.spirits ?? [], lang);
  const wine       = getMenuItem(menuData.dranken?.wijn ?? [], lang);
  const fullMealObj   = (menuData.maaltijden?.volledig ?? [])[Math.floor(Math.random() * (menuData.maaltijden?.volledig ?? []).length)] ?? { nl: "", en: "" };
  const fullMeal      = lang === "en" ? (fullMealObj.en ?? fullMealObj.nl) : fullMealObj.nl;

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
      tavernJob:        getTavernJob(i, npc.sex),
      shortDescription: lang === "en"
          ? `A ${npc.height.en?.toLowerCase()}, ${npc.posture.en?.toLowerCase()} ${npc.race.en?.toLowerCase()} with ${npc.hairColor.en?.toLowerCase()} hair.`
          : `Een ${lowerNl(npc.height.nl)}, ${lowerNl(npc.posture.nl)} ${lowerNl(npc.race.nl)} met ${lowerNl(npc.hairColor.nl)} haar.`
    });
  }

  // ── Klanten ───────────────────────────────────────────────────────────────

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

  // ── Tavern object ─────────────────────────────────────────────────────────

  const tavern = {
    tavernName, quality, prices,
    building, roof, sfeer, detail, drukte, description,
    beerAle, spirit, wine, fullMeal, randomMeal,
    owner, employeeCount, customerCount, employees, customers, gossip,
    renderStatus: wft("WF.Status.NotGenerated"),
    comfyFileName: null, currentImagePath: null, isRendering: false
  };

  tavern.comfyPrompt   = buildTavernComfyPrompt(tavern);
  tavern.comfyNegative = baseNegativeExterior(tavern.building.en);
  return tavern;
}

/**
 * Genereert een tavern en stuurt die naar de WorldForge UI.
 */
// =============================================================================
// TavernGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class TavernGenerator extends BaseGenerator {
  static codexType = "tavern";
  static folder    = "_Random Taverns";
  static icon      = "fa-beer-mug-empty";
  static hasActor  = false;
  static hasComfy  = true;
  static comfyW    = 1024;
  static comfyH    = 768;

  static async generate(options = {}) { return generateTavern(options); }
  static render(item)                 { return renderTavernCard(item, { buttons: false }); }
  static getName(item)                { return item.tavernName ?? "Tavern"; }
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
 * Genereert een tavern en stuurt die naar de WorldForge UI.
 */
export async function generateAndShowTavern() {
  const tavern = await generateTavern();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("tavern", tavern);
  }
  return tavern;
}
