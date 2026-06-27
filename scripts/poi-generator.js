/**
 * WorldForge – poi-generator.js
 *
 * Genereert gebouwen en Points of Interest uit buildings-poi.json.
 * Elke entry heeft: description (materials/roofing/surroundings/inside),
 * een readout template, en optional/mandatory functions.
 *
 * Exporteert:
 *  - generatePOI({ category, buildingId })
 *  - renderPOICard(poi)
 *  - generateAndShowPOI()
 *  - getPOIDropdownData()
 */

import { WorldForgeSettings }  from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC }         from "./npc-generator.js";
import {
  escapeHtml, wfSectionHeader, wfReadout, wfBadge, wfNpcItem
} from "./utils.js";

const wft = (key) => WorldForgeSettings.t(key);

// =============================================================================
// HELPERS
// =============================================================================

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(arr) {
  if (!arr?.length) return null;
  const total = arr.reduce((s, e) => s + (e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const entry of arr) {
    roll -= (entry.weight ?? 1);
    if (roll <= 0) return entry;
  }
  return arr[arr.length - 1];
}

function L(obj) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return typeof obj === "object" && obj !== null
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");
}

/**
 * Bouwt de readout tekst door {placeholders} te vervangen.
 */
function buildReadout(template, building) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const tpl  = L(template);

  const material    = L(pickRandom(building.description.materials))    ?? "";
  const roofing     = L(pickRandom(building.description.roofing))      ?? "";
  const surrounding = L(pickRandom(building.description.surroundings)) ?? "";
  const inside      = L(pickRandom(building.description.inside))       ?? "";
  const name        = lang === "en" ? building.en : building.nl;
  const location    = L(pickRandom(building.locations?.[lang] ?? building.locations?.nl ?? [])) ?? "";

  return tpl
    .replace(/{building}/g, name)
    .replace(/{materials}/g, material)
    .replace(/{roofing}/g, roofing)
    .replace(/{surroundings}/g, surrounding)
    .replace(/{inside}/g, inside)
    .replace(/{locations}/g, location);
}

/**
 * Kiest 2-3 optional functions gewogen op weight.
 */
function pickOptionalFunctions(optionals, count = 3) {
  if (!optionals?.length) return [];
  const picked = [];
  const pool   = [...optionals];
  const n      = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const item = weightedPick(pool);
    if (item) {
      picked.push(item);
      pool.splice(pool.indexOf(item), 1);
    }
  }
  return picked;
}

// =============================================================================
// GENERATIE
// =============================================================================

export async function generatePOI({ category = null, buildingId = "random" } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const poiData = await DataLoader.load("buildings-poi.json");
  const buildings = poiData.buildings ?? [];

  let building;
  if (buildingId && buildingId !== "random") {
    building = buildings.find(b => b.id === buildingId);
  }
  if (!building) {
    // pickBuilding helper inline
    let pool = buildings.filter(b => b.description?.materials?.length > 0);
    if (category && category !== "random") pool = pool.filter(b => b.category === category);
    if (!pool.length) pool = buildings.filter(b => b.description?.materials?.length > 0);
    building = pickRandom(pool);
  }
  if (!building) return null;

  // Readout opbouwen uit losse description velden
  const readout = buildReadout(building.readout, building);

  // Functions — mandatory + 2-3 optional
  const mandatoryFns = building.functions?.mandatory ?? [];
  const optionalFns  = pickOptionalFunctions(building.functions?.optional ?? [], 3);
  const allFunctions = [...mandatoryFns, ...optionalFns];

  // Genereer NPCs voor alle functions
  const npcs = [];
  for (const fn of allFunctions) {
    const npc = await generateNPC();
    npc.job = { nl: fn.nl, en: fn.en };
    npcs.push(npc);
  }

  return {
    type:       "poi",
    id:         building.id,
    name:       { nl: building.nl, en: building.en },
    category:   building.category,
    isPOI:      building.isPOI ?? false,
    hasFunctions: building.hasFunctions ?? true,
    rarity:     building.rarity ?? "common",
    readout,
    npcs,
  };
}

// =============================================================================
// RENDER
// =============================================================================

export function renderPOICard(poi, { buttons = true } = {}) {
  if (!poi) return "";
  const lang = WorldForgeSettings.lang ?? "nl";

  const name     = L(poi.name);
  const rarityBadge = poi.rarity ? wfBadge(poi.rarity) : "";
  const poiBadge    = poi.isPOI  ? wfBadge(wft("WF.POI.Label.POI")) : "";

  const npcsHtml = poi.npcs?.length
    ? `${wfSectionHeader("👤", `${wft("WF.POI.Section.People")} (${poi.npcs.length})`)}
       <div class="wf-body">${poi.npcs.map(n => wfNpcItem(n)).join("")}</div>`
    : "";

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:60px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(name)}</p>
      <p class="wf-subtitle">${escapeHtml(poi.category)}</p>
      <div class="wf-meta-row">
        ${rarityBadge}
        ${poiBadge}
      </div>
    </div>
  </div>

  <!-- ── BESCHRIJVING ── -->
  ${wfSectionHeader("🏛️", wft("WF.POI.Section.Description"))}
  <div class="wf-body">
    ${wfReadout(poi.readout)}
  </div>

  <!-- ── BEWONERS / PERSONEEL ── -->
  ${npcsHtml}

</div>`;
}

// =============================================================================
// DROPDOWN DATA
// =============================================================================

export async function getPOIDropdownData() {
  const poiData = await DataLoader.load("buildings-poi.json");
  const buildings = poiData.buildings ?? [];
  const categories = [...new Set(buildings.map(b => b.category))].sort();

  return {
    categories: [
      { id: "random", label: WorldForgeSettings.t("WF.Label.Random") },
      ...categories.map(c => ({ id: c, label: c }))
    ],
    buildings: [
      { id: "random", label: WorldForgeSettings.t("WF.Label.Random") },
      ...buildings.map(b => ({
        id: b.id,
        label: WorldForgeSettings.lang === "en" ? b.en : b.nl,
        category: b.category
      }))
    ]
  };
}

// =============================================================================
// POIGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class POIGenerator extends BaseGenerator {
  static codexType = "poi";
  static folder    = "_Random POIs";
  static icon      = "fa-landmark";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generatePOI(options); }
  static render(item)                 { return renderPOICard(item, { buttons: false }); }
  static getName(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const n = item.name;
    return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "POI";
  }
  static getImage(item) { return ""; }

  static getSub(item) {
    return item.category ?? "";
  }
}

// =============================================================================
// WRAPPER
// =============================================================================

export async function generateAndShowPOI(category = "random", buildingId = "random") {
  const poi = await generatePOI({ category, buildingId });
  if (poi && window._worldForgeApp) {
    window._worldForgeApp.receiveItem("poi", poi);
  }
  return poi;
}
