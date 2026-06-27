/**
 * WorldForge – market-stall-generator.js
 *
 * Genereert willekeurige marktkriamen/standaarden met eigenaar,
 * canopy kleur, beschrijving en inhoud.
 *
 * Exporteert:
 *  - generateMarketStall({ category, stallType })
 *  - renderMarketStallCard(stall)
 *  - generateAndShowMarketStall()
 *  - getMarketStallDropdownData()
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC } from "./npc-generator.js";
import {
  escapeHtml, randBetween,
  wfSectionHeader, wfReadout, wfBadge, wfNpcItem
} from "./utils.js";

const wft = (key) => WorldForgeSettings.t(key);

// =============================================================================
// HELPERS
// =============================================================================

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function L(obj) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return typeof obj === "object" && obj !== null
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");
}

/**
 * Zet busy level (1-5) om naar beschrijving met context
 */
function getBusyLevelDescription(level) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const descriptions = {
    nl: {
      1: "Het is erg rustig",
      2: "Het is niet erg druk",
      3: "Het is matig bezocht",
      4: "Het is druk",
      5: "Het is erg druk"
    },
    en: {
      1: "It's very quiet",
      2: "It's not very busy",
      3: "It's moderately busy",
      4: "It's busy",
      5: "It's very busy"
    }
  };
  const desc = descriptions[lang]?.[level] || "";
  return desc;
}

// =============================================================================
// GENERATIE
// =============================================================================

export async function generateMarketStall({ category = "random", stallType = "random" } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const stallData = await DataLoader.load("market-stalls.json");
  const types = stallData.types ?? [];

  // Kies stall type
  let stall;
  if (stallType && stallType !== "random") {
    stall = types.find(t => t.id === stallType);
  }
  if (!stall) {
    let pool = types;
    if (category && category !== "random") {
      pool = types.filter(t => t.category === category);
    }
    stall = pickRandom(pool ?? types);
  }
  if (!stall) return null;

  // Kies canopy kleur
  const colors = stallData.canopyColors ?? [];
  const canopyColor = pickRandom(colors) ?? { nl: "versleten grijs", en: "worn grey" };

  // Kies stall condition
  const conditions = stallData.stallConditions ?? [];
  const condition = pickRandom(conditions) ?? { nl: "goed onderhouden", en: "well-maintained" };

  // Kies items
  const stallItems = stall.items ?? [];
  const itemCount = stallItems.length > 3 ? 3 : stallItems.length;
  const selectedItems = [];
  for (let i = 0; i < itemCount; i++) {
    const item = stallItems[i];
    if (item) selectedItems.push(L(item));
  }
  const itemsText = selectedItems.join(", ");

  // Genereer drukte level
  const busyLevel = randBetween(1, 5);

  // Bouw beschrijving op met canopy kleur, items, toestand, en drukte
  const descTemplate = stall.description?.[lang] ?? stall.description?.en ?? "";
  const conditionText = L(condition);
  const busyLevelText = getBusyLevelDescription(busyLevel);
  const description = descTemplate
    .replace("{canopyColor}", L(canopyColor))
    .replace("{items}", itemsText)
    .replace(/{condition}/g, conditionText)
    .replace(/{busyLevel}/g, busyLevelText);

  // Eigenaar genereren
  const owner = await generateNPC();
  owner.job = { nl: "Marktverkoper", en: "Market Vendor" };

  // Prijs voor huur/licentie
  const stallFee = randBetween(5, 25) + " sp";

  // Kies tweetalige prefix
  const prefixNl = pickRandom(stallData.prefixes)?.nl ?? "Bescheiden";
  const prefixEn = pickRandom(stallData.prefixes)?.en ?? "Humble";

  return {
    type: "marketStall",
    id: stall.id,
    name: { nl: `${prefixNl} ${stall.nl}`, en: `${prefixEn} ${stall.en}` },
    stallType: stall.nl,
    stallTypeEn: stall.en,
    category: stall.category,
    canopyColor,
    condition,
    description,
    owner,
    items: selectedItems,
    stallFee,
    busyLevel,
  };
}

// =============================================================================
// RENDER
// =============================================================================

export function renderMarketStallCard(stall, { buttons = true } = {}) {
  if (!stall) return "";
  const lang = WorldForgeSettings.lang ?? "nl";

  const name = L(stall.name);
  const categoryBadge = wfBadge(stall.category);
  const conditionBadge = wfBadge(L(stall.condition));
  const feeBadge = wfBadge(stall.stallFee);

  const itemsHtml = stall.items?.length
    ? `<ul style="margin:0.5rem 0; padding-left:1.5rem;">
         ${stall.items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
       </ul>`
    : "";

  const ownerHtml = stall.owner ? wfNpcItem(stall.owner) : "";

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:4px solid ${getCanopyColorHex(stall.canopyColor)};">
      <p class="wf-name">${escapeHtml(name)}</p>
      <p class="wf-subtitle">${escapeHtml(stall.stallTypeEn)}</p>
      <div class="wf-meta-row">
        ${categoryBadge}
        ${conditionBadge}
        ${feeBadge}
      </div>
    </div>
  </div>

  <!-- ── BESCHRIJVING ── -->
  ${wfSectionHeader("🏪", wft("WF.MarketStall.Section.Description"))}
  <div class="wf-body">
    ${wfReadout(stall.description)}
  </div>

  <!-- ── VOORRAAD ── -->
  ${wfSectionHeader("📦", wft("WF.MarketStall.Section.Stock"))}
  <div class="wf-body">
    ${itemsHtml}
  </div>

  <!-- ── EIGENAAR ── -->
  ${wfSectionHeader("👤", wft("WF.MarketStall.Section.Vendor"))}
  <div class="wf-body">
    ${ownerHtml}
  </div>

  <!-- ── ACTION BUTTONS ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-primary wf-publish-stall">${wft("WF.Btn.Publish")}</button>
    <button class="wf-btn wf-save-stall">${wft("WF.Btn.Save")}</button>
  </div>` : ""}

</div>`;
}

function getCanopyColorHex(canopyObj) {
  const colorMap = {
    "rood": "#c41e3a", "red": "#c41e3a",
    "blauw": "#0052cc", "blue": "#0052cc",
    "groen": "#228b22", "green": "#228b22",
    "geel": "#d4af37", "yellow": "#d4af37",
    "wit": "#d4af37", "white": "#d4af37",
    "grijs": "#808080", "grey": "#808080",
    "bruin": "#8b4513", "brown": "#8b4513",
    "oranje": "#ff8c00", "orange": "#ff8c00",
    "paars": "#8b00ff", "purple": "#8b00ff",
    "zwart": "#1a1a1a", "black": "#1a1a1a",
    "cremekleurig": "#d4af37", "cream": "#d4af37",
    "gestreept rood-wit": "#c41e3a", "red and white striped": "#c41e3a",
    "gestreept blauw-wit": "#0052cc", "blue and white striped": "#0052cc",
    "gestreept geel-wit": "#d4af37", "yellow and white striped": "#d4af37",
    "versleten grijs": "#a9a9a9", "worn grey": "#a9a9a9",
    "vlekkerig bruin": "#8b4513", "mottled brown": "#8b4513"
  };
  const color = L(canopyObj);
  return colorMap[color] || "#d4af37";
}

// =============================================================================
// DROPDOWN DATA
// =============================================================================

export async function getMarketStallDropdownData() {
  const lang = WorldForgeSettings.lang ?? "nl";
  const stallData = await DataLoader.load("market-stalls.json");
  const types = stallData.types ?? [];
  const categories = [...new Set(types.map(t => t.category))].sort();

  return {
    categories: [
      { id: "random", label: wft("WF.Label.Random") },
      ...categories.map(c => ({ id: c, label: c }))
    ],
    types: [
      { id: "random", label: wft("WF.Label.Random") },
      ...types.map(t => ({
        id: t.id,
        label: lang === "en" ? t.en : t.nl,
        category: t.category
      }))
    ]
  };
}

// =============================================================================
// MarketStallGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class MarketStallGenerator extends BaseGenerator {
  static codexType = "marketStall";
  static folder    = "_Random Market Stalls";
  static icon      = "fa-shop";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateMarketStall(options); }
  static render(item)                 { return renderMarketStallCard(item, { buttons: false }); }
  static getName(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const n = item.name;
    return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "Market Stall";
  }
  static getImage(item) { return ""; }

  static getSub(item) {
    return item.category ?? "";
  }
}

// =============================================================================
// WRAPPER
// =============================================================================

export async function generateAndShowMarketStall(category = "random", stallType = "random") {
  const stall = await generateMarketStall({ category, stallType });
  if (stall && window._worldForgeApp) {
    window._worldForgeApp.receiveItem("marketStall", stall);
  }
  return stall;
}
