/**
 * WorldForge – ship-generator-generic.js
 *
 * Generieke scheepsgenerator zonder factiongebonden logica.
 * Scheepstype en doel zijn vrij instelbaar via dropdowns.
 *
 * Exporteert:
 *  - generateGenericShip({ forceType, forcePurpose })
 *  - renderGenericShipCard(ship)
 *  - generateAndShowGenericShip()
 *  - getGenericShipDropdownData()
 */

import { WorldForgeSettings }  from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC }         from "./npc-generator.js";
import {
  escapeHtml, escapeAttr, wfSectionHeader, wfReadout,
  wfInfoRow, wfBadge, wfNpcItem, ensureJournalFolder
} from "./utils.js";

const wft = (key) => WorldForgeSettings.t(key);

// =============================================================================
// SHIP-FUNCTIONS LOADER
// =============================================================================

async function rollShipFunction() {
  const data = await DataLoader.load("ship-functions.json");
  const fns = data.shipFunctions ?? [];
  return fns[Math.floor(Math.random() * fns.length)] ?? { nl: "Matroos", en: "Sailor" };
}

// =============================================================================
// RENDER
// =============================================================================

export function renderGenericShipCard(ship, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const L    = (obj) => typeof obj === "object" ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  const specsHtml = `
<div class="wf-ship-specs">
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Type")}</span>
    <span class="wf-spec-value" style="font-size:10px;">${escapeHtml(L(ship.shipTypeLabel))}</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Length")}</span>
    <span class="wf-spec-value">${ship.shipLength}m</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Width")}</span>
    <span class="wf-spec-value">${ship.shipWidth}m</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Decks")}</span>
    <span class="wf-spec-value">${escapeHtml(String(ship.shipDecks))}</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Cannons")}</span>
    <span class="wf-spec-value">${escapeHtml(String(ship.shipCannons))}</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Masts")}</span>
    <span class="wf-spec-value">${escapeHtml(String(ship.shipMasts))}</span>
  </div>
</div>`;

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(ship.shipName)}</p>
      <p class="wf-subtitle">${escapeHtml(L(ship.purposeLabel))}</p>
      <div class="wf-meta-row">
        ${wfBadge(L(ship.shipTypeLabel))}
      </div>
    </div>
  </div>

  <!-- ── SCHIP ── -->
  ${wfSectionHeader("⚓", wft("WF.Ship.Section.Ship"))}
  <div class="wf-body">
    ${wfReadout(L(ship.shipAppearance))}
    ${specsHtml}
    <table class="wf-info-table">
      <tr><td>${wft("WF.Ship.Spec.Crew")}</td><td>${escapeHtml(String(ship.shipCrew))}</td></tr>
      <tr><td>${wft("WF.Ship.Spec.Cargo")}</td><td>${escapeHtml(ship.cargoItems.join(", "))}</td></tr>
    </table>
  </div>

  <!-- ── BEMANNING ── -->
  ${wfSectionHeader("🧑‍✈️", wft("WF.Ship.Section.Crew"))}
  <div class="wf-body">
    ${wfReadout(L(ship.crewDescription))}
    ${wfNpcItem(ship.captain)}
  </div>

  <!-- ── BEMANNINGSLEDEN ── -->
  ${wfSectionHeader("👥", `${wft("WF.Ship.Section.CrewMembers")} (${ship.crewMembers.length})`)}
  <div class="wf-body">
    ${ship.crewMembers.map(c => wfNpcItem(c)).join("")}
  </div>

  <!-- ── ACTIEKNOPPEN ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-primary wf-publish-ship">${wft("WF.Btn.Publish")}</button>
    <button class="wf-btn wf-save-ship">${wft("WF.Btn.Save")}</button>
    <button class="wf-btn wf-btn-green wf-save-journal-ship">${wft("WF.Btn.Journal")}</button>
  </div>` : ""}

</div>`;
}

// =============================================================================
// GENERATIE
// =============================================================================

export async function generateGenericShip({ forceType = "random", forcePurpose = "random" } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";

  // Load ships-generic.json
  const shipData = await DataLoader.load("ships-generic.json");
  const shipTypes = shipData.shipTypes ?? [];
  const purposes = shipData.purposes ?? [];

  // Scheepstype en doel
  let shipTypeData;
  if (forceType && forceType !== "random") {
    shipTypeData = shipTypes.find(t => t.id === forceType);
  }
  if (!shipTypeData) {
    shipTypeData = shipTypes[Math.floor(Math.random() * shipTypes.length)] ?? { maxLength: 30, maxWidth: 10, decks: 2, cannons: 0, masts: 3, nl: "Schip", en: "Ship" };
  }

  let purposeData;
  if (forcePurpose && forcePurpose !== "random") {
    purposeData = purposes.find(p => p.en === forcePurpose || p.nl === forcePurpose);
  }
  if (!purposeData) {
    purposeData = purposes[Math.floor(Math.random() * purposes.length)] ?? { nl: "Doelen", en: "Purposes" };
  }

  // Afmetingen binnen type-bereik
  const maxLen    = shipTypeData.maxLength ?? 30;
  const maxWid    = shipTypeData.maxWidth ?? 10;
  const minLen    = Math.floor(maxLen * 0.7);
  const minWid    = Math.floor(maxWid  * 0.7);
  const shipLength = Math.floor(Math.random() * (maxLen - minLen)) + minLen;
  const shipWidth  = Math.floor(Math.random() * (maxWid - minWid)) + minWid;

  // Omschrijvingen en lading
  const shipNames = shipData.namen ?? { prefix: [], suffix: [], connectors: [""] };
  const prefix     = shipNames.prefix[Math.floor(Math.random() * (shipNames.prefix ?? []).length)] ?? "Golden";
  const suffix     = shipNames.suffix[Math.floor(Math.random() * (shipNames.suffix ?? []).length)] ?? "Wind";
  const connector  = shipNames.connectors[Math.floor(Math.random() * (shipNames.connectors ?? []).length)] ?? "";

  let shipName;
  const roll = Math.random();
  if (roll < 0.40) shipName = `${prefix} ${suffix}`;
  else if (roll < 0.80) shipName = connector ? `${prefix} ${connector} ${suffix}` : `${prefix} ${suffix}`;
  else shipName = `The ${suffix}`;

  const uiterlijk = shipData.omschrijving?.uiterlijk ?? [];
  const shipAppearance = uiterlijk[Math.floor(Math.random() * uiterlijk.length)] ?? { nl: "", en: "" };

  const crew = shipData.omschrijving?.crew ?? [];
  const crewDescription = crew[Math.floor(Math.random() * crew.length)] ?? { nl: "", en: "" };

  const cargo = shipData.cargo ?? [];
  const cargoRaw = [...cargo].sort(() => Math.random() - 0.5).slice(0, Math.min(3, cargo.length));
  const cargoItems = cargoRaw.map(c => lang === "en" ? (c.en ?? c.nl) : c.nl);

  // Kapitein
  const captain = await generateNPC();
  captain.job = { nl: "Kapitein", en: "Captain" };

  // 2-4 bemanningsleden
  const crewCount  = 2 + Math.floor(Math.random() * 3);
  const crewMembers = [];
  for (let i = 0; i < crewCount; i++) {
    const npc = await generateNPC();
    npc.job   = await rollShipFunction();
    crewMembers.push(npc);
  }

  return {
    type:          "ship_generic",
    shipName,
    shipTypeLabel: { nl: shipTypeData.nl, en: shipTypeData.en },
    shipTypeId:    shipTypeData.id,
    purposeLabel:  { nl: purposeData.nl, en: purposeData.en },
    shipLength,    shipWidth,
    shipDecks:     shipTypeData.decks,
    shipCannons:   shipTypeData.cannons,
    shipMasts:     shipTypeData.masts,
    shipCrew:      shipTypeData.crew,
    shipAppearance, crewDescription, cargoItems,
    captain, crewMembers,
  };
}

// =============================================================================
// DROPDOWN DATA
// =============================================================================

export async function getGenericShipDropdownData() {
  const lang = WorldForgeSettings.lang ?? "nl";
  const shipData = await DataLoader.load("ships-generic.json");
  const types = shipData.shipTypes ?? [];
  const purposes = shipData.purposes ?? [];
  return {
    types: [
      { id: "random", label: wft("WF.Label.Random") },
      ...types.map(t => ({ id: t.id, label: lang === "en" ? t.en : t.nl }))
    ],
    purposes: [
      { id: "random", label: wft("WF.Label.Random") },
      ...purposes.map(p => ({ id: p.en, label: lang === "en" ? p.en : p.nl }))
    ]
  };
}

// =============================================================================
// GenericShipGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class GenericShipGenerator extends BaseGenerator {
  static codexType = "ship";
  static folder    = "_Random Ships";
  static icon      = "fa-anchor";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateGenericShip(options); }
  static render(item)                 { return renderGenericShipCard(item, { buttons: false }); }
  static getName(item)                { return item.shipName ?? "Ship"; }
  static getImage(item)               { return ""; }

  static getSub(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const l = (o) => typeof o === "object" ? (o[lang] ?? o.nl ?? "") : (o ?? "");
    return `${l(item.purposeLabel)} · ${l(item.shipTypeLabel)}`;
  }
}

// =============================================================================
// WRAPPER
// =============================================================================

export async function generateAndShowGenericShip(forceType = "random", forcePurpose = "random") {
  const ship = await generateGenericShip({ forceType, forcePurpose });
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("ship_generic", ship);
  }
  return ship;
}
