/**
 * WorldForge – menu-generator.js
 *
 * Genereert een uitgebreide menukaart via inn-data.js (JSON).
 * Geen Rollable Tables meer nodig.
 *
 * Het menu bevat:
 *  - Kwaliteitsniveau met bijpassende prijzen
 *  - 2 ontbijt-opties
 *  - 2 bieren/ales, 2 wijnen, 2 sterke dranken
 *  - 2 volledige maaltijden + 2 dagmaaltijden
 *
 * Exporteert:
 *  - generateMenu()         – genereert menu data object
 *  - renderMenuCard(menu)   – rendert de kaart HTML
 *  - generateAndShowMenu()  – wrapper voor WorldForge UI
 */

import {
  escapeHtml,
  wfSectionHeader, wfMenuRow
} from "./utils.js";
import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";

const wft = (key) => WorldForgeSettings.t(key);

const QUALITY_LABELS = {
  "Armoedig":  { nl: "Armoedig",  en: "Poor"      },
  "Eenvoudig": { nl: "Eenvoudig", en: "Simple"    },
  "Gemiddeld": { nl: "Gemiddeld", en: "Average"   },
  "Goed":      { nl: "Goed",      en: "Good"      },
  "Luxe":      { nl: "Luxe",      en: "Luxurious" },
};
function qualityLabel(quality, lang) { return QUALITY_LABELS[quality]?.[lang] ?? quality; }

// =============================================================================
// KWALITEIT EN PRIJZEN
// =============================================================================

function getMenuQuality() {
  const r = Math.random();
  if (r < 0.10) return "Armoedig";
  if (r < 0.30) return "Eenvoudig";
  if (r < 0.70) return "Gemiddeld";
  if (r < 0.90) return "Goed";
  return "Luxe";
}

function getPrices(quality) {
  const map = {
    Armoedig:  { breakfast:"2 sp", mealSimple:"3 sp",  mealFull:"6 sp",  beer:"2 cp", wineGlass:"3 cp", wineBottle:"2 sp",  spirits:"5 cp"  },
    Eenvoudig: { breakfast:"3 sp", mealSimple:"4 sp",  mealFull:"8 sp",  beer:"3 cp", wineGlass:"4 cp", wineBottle:"3 sp",  spirits:"8 cp"  },
    Gemiddeld: { breakfast:"4 sp", mealSimple:"5 sp",  mealFull:"1 gp",  beer:"4 cp", wineGlass:"6 cp", wineBottle:"4 sp",  spirits:"1 sp"  },
    Goed:      { breakfast:"5 sp", mealSimple:"7 sp",  mealFull:"12 sp", beer:"6 cp", wineGlass:"8 cp", wineBottle:"6 sp",  spirits:"15 cp" },
    Luxe:      { breakfast:"7 sp", mealSimple:"1 gp",  mealFull:"15 sp", beer:"8 cp", wineGlass:"1 sp", wineBottle:"1 gp",  spirits:"2 sp"  }
  };
  return map[quality] ?? map.Gemiddeld;
}

// =============================================================================
// HTML RENDER
// =============================================================================

export function renderMenuCard(menu, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";

  // Helper: haalt de juiste taal uit een item (string of { nl, en })
  function itemText(item) {
    if (!item) return "";
    if (typeof item === "string") return String(item);
    if (typeof item === "object") return String(item[lang] ?? item.nl ?? "");
    return String(item);
  }

  const qualityBadge = `<span class="wf-quality wf-quality-${menu.quality}">${escapeHtml(qualityLabel(menu.quality, lang))}</span>`;

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:60px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${wft("WF.Menu.Title")}</p>
      <p class="wf-subtitle">${wft("WF.Menu.Subtitle")}</p>
      <div class="wf-meta-row">${qualityBadge}</div>
    </div>
  </div>

  <!-- ── ONTBIJT ── -->
  ${wfSectionHeader("🥣", wft("WF.Menu.Section.Breakfast"))}
  <div class="wf-body">
    <div class="wf-menu-section">
      ${wfMenuRow(`${wft("WF.Menu.Section.Breakfast")} 1`, menu.prices.breakfast, itemText(menu.breakfast[0]))}
      ${wfMenuRow(`${wft("WF.Menu.Section.Breakfast")} 2`, menu.prices.breakfast, itemText(menu.breakfast[1]))}
    </div>
  </div>

  <!-- ── DRANKEN ── -->
  ${wfSectionHeader("🍺", wft("WF.Menu.Section.Drinks"))}
  <div class="wf-body">
    <div class="wf-menu-section">
      ${wfMenuRow(`${wft("WF.Inn.Row.Beer")} 1`,         menu.prices.beer,        itemText(menu.beers[0]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.Beer")} 2`,         menu.prices.beer,        itemText(menu.beers[1]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.Spirits")} 1`,      menu.prices.spirits,     itemText(menu.spirits[0]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.Spirits")} 2`,      menu.prices.spirits,     itemText(menu.spirits[1]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.WineGlass")} 1`,    menu.prices.wineGlass,   itemText(menu.wines[0]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.WineGlass")} 2`,    menu.prices.wineGlass,   itemText(menu.wines[1]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.WineBottle")} 1`,   menu.prices.wineBottle,  itemText(menu.wines[0]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.WineBottle")} 2`,   menu.prices.wineBottle,  itemText(menu.wines[1]))}
    </div>
  </div>

  <!-- ── MAALTIJDEN ── -->
  ${wfSectionHeader("🍽", wft("WF.Menu.Section.Dinner"))}
  <div class="wf-body">
    <div class="wf-menu-section">
      ${wfMenuRow(`${wft("WF.Inn.Row.FullMeal")} 1`,   menu.prices.mealFull,   itemText(menu.fullMeals[0]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.DailyMeal")} 1`,  menu.prices.mealSimple, itemText(menu.dinnerMeals[0]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.FullMeal")} 2`,   menu.prices.mealFull,   itemText(menu.fullMeals[1]))}
      ${wfMenuRow(`${wft("WF.Inn.Row.DailyMeal")} 2`,  menu.prices.mealSimple, itemText(menu.dinnerMeals[1]))}
    </div>
  </div>

  <!-- ── ACTIEKNOPPEN ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-primary wf-publish-menu">${wft("WF.Btn.Publish")}</button>
  </div>` : ""}

</div>`;
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Helper: Pikt 2 unieke items uit een array.
 * Returns items as-is (strings or objects with {nl,en})
 */
function pickTwo(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) {
    return [{ nl: "[missing]", en: "[missing]" }, { nl: "[missing]", en: "[missing]" }];
  }
  const first = arr[Math.floor(Math.random() * arr.length)];
  let second = arr[Math.floor(Math.random() * arr.length)];
  let attempts = 0;
  while (attempts++ < 5) {
    const f = typeof first === "object" ? (first.nl ?? first) : first;
    const s = typeof second === "object" ? (second.nl ?? second) : second;
    if (f !== s) break;
    second = arr[Math.floor(Math.random() * arr.length)];
  }
  return [first, second];
}

export async function generateMenu() {
  const lang    = WorldForgeSettings.lang ?? "nl";
  const quality = getMenuQuality();
  const prices  = getPrices(quality);

  // Load inns.json data (nested structure: ontbijt, dranken.*, maaltijden.*)
  DataLoader.invalidate("inns.json");
  const menuData = await DataLoader.load("inns.json");

  // Safe nested access without optional chaining (for compatibility)
  const getDrinksCategory = (category) => {
    return (menuData.dranken && menuData.dranken[category]) ?? [];
  };
  const getMealsCategory = (category) => {
    return (menuData.maaltijden && menuData.maaltijden[category]) ?? [];
  };

  // 2 unieke items per categorie
  const breakfast   = pickTwo(menuData.ontbijt ?? []);
  const beers       = pickTwo(getDrinksCategory("bier"));
  const wines       = pickTwo(getDrinksCategory("wijn"));
  const spirits     = pickTwo(getDrinksCategory("spirits"));
  const fullMeals   = pickTwo(getMealsCategory("volledig"));
  const dinnerMeals = pickTwo(getMealsCategory("vlees"));

  return {
    quality, prices,
    breakfast, beers, wines, spirits,
    fullMeals, dinnerMeals
  };
}

// =============================================================================
// MenuGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class MenuGenerator extends BaseGenerator {
  static codexType = "menu";
  static folder    = "_Random Menus";
  static icon      = "fa-utensils";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateMenu(options); }
  static render(item)                 { return renderMenuCard(item, { buttons: false }); }
  static getName(item) {
    const q = item.quality ?? "";
    const qmap = {
      "Armoedig": "Poor",
      "Eenvoudig": "Simple",
      "Gemiddeld": "Average",
      "Goed": "Good",
      "Luxe": "Luxurious"
    };
    const ql = WorldForgeSettings.lang === "en" ? (qmap[q] ?? q) : q;
    return `${wft("WF.Menu.Title")} (${ql})`;
  }
  static getSub(item) { return item.quality ?? ""; }
}

/**
 * Genereert een menu en stuurt die naar de WorldForge UI.
 */
export async function generateAndShowMenu() {
  const menu = await generateMenu();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("menu", menu);
  }
  return menu;
}
