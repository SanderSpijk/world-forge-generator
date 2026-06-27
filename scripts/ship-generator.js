/**
 * WorldForge – ship-generator.js (v0.8.2 REFACTORED)
 *
 * Genereert een willekeurig schip op basis van factie- en scheepstypdata.
 *
 * REFACTORED: BaseGenerator + DataLoader patroon
 * - ships.json laden via DataLoader (consolideerd van ship-data.js)
 * - ship-functions.json laden via DataLoader
 * - ShipGenerator extends BaseGenerator
 *
 * Bijzonder aan dit systeem:
 *  - De factie bepaalt welk scheepstype mogelijk is
 *  - Schipafmetingen worden willekeurig gegenereerd binnen een bereik
 *  - Nederlandse schepen krijgen een naam uit een aparte namenlijst
 *
 * Exporteert:
 *  - generateShip()           – genereert een schip object
 *  - renderShipCard()         – HTML kaart render
 *  - generateAndShowShip()    – wrapper voor WorldForge UI
 *  - ShipGenerator            – BaseGenerator klasse
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import {
  clean, escapeHtml, escapeAttr,
  openImagePopout, ensureJournalFolder,
  wfSectionHeader, wfReadout, wfInfoRow, wfBadge, wfNpcItem
} from "./utils.js";
import { generateNPC } from "./npc-generator.js";

const wft = (key) => WorldForgeSettings.t(key);

// =============================================================================
// PICKERS — intern, gebruikt DataLoader
// =============================================================================

/**
 * Geeft een willekeurige factie terug.
 * Alle facties hebben gelijk gewicht.
 *
 * @returns {Promise<{id, nl, en, adjective, shipTypes, dutchName}>}
 */
async function pickFaction() {
  const shipData = await DataLoader.load("ships.json");
  const factions = shipData.factions ?? [];
  if (!factions.length) {
    return {
      id: "piraten",
      nl: "Piraten",
      en: "Pirates",
      adjective: { nl: "Piraten", en: "Pirate" },
      shipTypes: ["sloep"],
      dutchName: false
    };
  }
  return factions[Math.floor(Math.random() * factions.length)];
}

/**
 * Geeft een willekeurig scheepstype terug dat bij de factie past.
 * Alle toegestane typen hebben gelijk gewicht binnen de factie.
 *
 * @param {string} factionId  - ID van de factie
 * @returns {Promise<{id, nl, en, maxLength, maxWidth, decks, cannons, masts, crew}>}
 */
async function pickShipType(factionId) {
  const shipData = await DataLoader.load("ships.json");
  const factions = shipData.factions ?? [];
  const shipTypes = shipData.shipTypes ?? [];

  const faction    = factions.find(f => f.id === factionId);
  const allowedIds = faction?.shipTypes ?? shipTypes.map(t => t.id);
  const allowed    = shipTypes.filter(t => allowedIds.includes(t.id));

  if (!allowed.length) return shipTypes[0];
  return allowed[Math.floor(Math.random() * allowed.length)];
}

/**
 * Geeft een scheepstype op ID terug.
 * Handig voor opzoeken na het laden van een opgeslagen schip.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getShipTypeById(id) {
  const shipData = await DataLoader.load("ships.json");
  const shipTypes = shipData.shipTypes ?? [];
  return shipTypes.find(t => t.id === id) ?? null;
}

/**
 * Geeft een willekeurige Nederlandse scheepsnaam terug.
 * Gebruikt door facties met dutchName: true.
 *
 * @returns {Promise<string>}
 */
async function pickDutchShipName() {
  const shipData = await DataLoader.load("ships.json");
  const namen = shipData.namen ?? {};
  const list = namen.dutch ?? [];
  if (!list.length) return "De Eendracht";
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Geeft een willekeurige scheepsnaam via prefix + suffix.
 * Gebruikt door alle niet-Nederlandse facties.
 *
 * @returns {Promise<string>}
 */
async function pickShipName() {
  const shipData = await DataLoader.load("ships.json");
  const namen = shipData.namen ?? {};
  const prefixes = namen.prefix ?? [];
  const suffixes = namen.suffix ?? [];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)] ?? "Golden";
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] ?? "Wind";
  return `${prefix} ${suffix}`;
}

/**
 * Interne helper voor omschrijving-secties.
 * @param {"uiterlijk"|"crew"} sub
 * @returns {Promise<{nl: string, en: string}>}
 */
async function pickOmschrijving(sub) {
  const shipData = await DataLoader.load("ships.json");
  const omschrijving = shipData.omschrijving ?? {};
  const list = omschrijving[sub] ?? [];
  if (!list.length) return { nl: "", en: "" };
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Geeft een willekeurige uiterlijk-omschrijving als { nl, en }.
 * @returns {Promise<{nl: string, en: string}>}
 */
async function pickShipAppearance() {
  return pickOmschrijving("uiterlijk");
}

/**
 * Geeft een willekeurige crew-omschrijving als { nl, en }.
 * @returns {Promise<{nl: string, en: string}>}
 */
async function pickCrewDescription() {
  return pickOmschrijving("crew");
}

/**
 * Pikt `count` unieke cargo-items uit de cargolijst.
 * Geeft een array van { nl, en } objecten terug.
 *
 * @param {number} count  - Aantal gewenste unieke items (standaard 3)
 * @returns {Promise<{nl: string, en: string}[]>}
 */
async function pickCargo(count = 3) {
  const shipData = await DataLoader.load("ships.json");
  const cargo = shipData.cargo ?? [];
  if (!cargo.length) return [];
  const shuffled = [...cargo].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// =============================================================================
// SHIP-FUNCTIONS LOADER
// =============================================================================

async function rollShipFunction() {
  const shipFunctionsData = await DataLoader.load("ship-functions.json");
  const functions = shipFunctionsData.shipFunctions ?? [];
  if (!functions.length) {
    // Fallback
    const fallback = [
      { nl: "Matroos", en: "Sailor" },
      { nl: "Stuurman", en: "Bosun" },
      { nl: "Kanonnier", en: "Cannoneer" },
      { nl: "Kok", en: "Cook" },
      { nl: "Scheepstimmerman", en: "Carpenter" }
    ];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return functions[Math.floor(Math.random() * functions.length)];
}

// =============================================================================
// HTML RENDER – CHAT KAART
// =============================================================================

/**
 * Rendert de schip-kaart in Campaign Codex-stijl.
 * Toont factie, specs, lading, kapitein en bemanningsleden.
 */
export function renderShipCard(ship, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const L    = (obj) => typeof obj === "object" && obj !== null
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  const specsHtml = `
<div class="wf-ship-specs">
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Type")}</span>
    <span class="wf-spec-value" style="font-size:10px;">${escapeHtml(L(ship.shipType))}</span>
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
    <span class="wf-spec-value">${escapeHtml(ship.shipDecks)}</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Cannons")}</span>
    <span class="wf-spec-value">${escapeHtml(ship.shipCanons)}</span>
  </div>
  <div class="wf-spec">
    <span class="wf-spec-label">${wft("WF.Ship.Spec.Masts")}</span>
    <span class="wf-spec-value">${escapeHtml(ship.shipMasts)}</span>
  </div>
</div>`;

  return `
<div class="wf-card">

  <!-- ── HEADER: scheepsnaam + factie ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(ship.shipName)}</p>
      <p class="wf-subtitle">${escapeHtml(L(ship.faction))}</p>
      <div class="wf-meta-row">
        ${wfBadge(L(ship.factionAdjective))}
        ${wfBadge(L(ship.shipType))}
      </div>
    </div>
  </div>

  <!-- ── SCHEEPSBESCHRIJVING ── -->
  ${wfSectionHeader("⚓", wft("WF.Ship.Section.Ship"))}
  <div class="wf-body">
    ${wfReadout(L(ship.shipAppearance))}
    ${specsHtml}
    <table class="wf-info-table">
      ${wfInfoRow(wft("WF.Ship.Spec.Crew"),  escapeHtml(ship.shipCrew))}
      ${wfInfoRow(wft("WF.Ship.Spec.Cargo"), escapeHtml(ship.cargoItems.map(c => L(c)).join(", ")))}
    </table>
  </div>

  <!-- ── BEMANNING ── -->
  ${wfSectionHeader("🧑‍✈️", wft("WF.Ship.Section.Crew"))}
  <div class="wf-body">
    ${wfReadout(L(ship.crewDescription))}
    <div class="wf-quirk">
      <span class="wf-quirk-label">${wft("WF.Ship.Section.Crew")}</span>
      ${wfNpcItem(ship.captain)}
    </div>
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
  </div>` : ""}

</div>`;
}

// =============================================================================
// HTML RENDER – JOURNAL
// =============================================================================

function renderShipJournal(ship) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const L    = (obj) => typeof obj === "object" && obj !== null
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");
  const raceName = (npc) => lang === "en" ? (npc.race?.en ?? npc.race?.nl ?? "") : (npc.race?.nl ?? "");
  const jobName  = (npc) => lang === "en" ? (npc.job?.en  ?? npc.job?.nl  ?? "") : (npc.job?.nl  ?? "");

  return `
<h1>${escapeHtml(ship.shipName)}</h1>
<p><strong>${wft("WF.Ship.Section.Ship")}:</strong> ${escapeHtml(L(ship.faction))} (${escapeHtml(L(ship.factionAdjective))})</p>
<p><strong>${wft("WF.Ship.Spec.Type")}:</strong> ${escapeHtml(L(ship.shipType))} · <strong>${wft("WF.Ship.Spec.Length")}:</strong> ${ship.shipLength}m · <strong>${wft("WF.Ship.Spec.Width")}:</strong> ${ship.shipWidth}m</p>
<p><strong>${wft("WF.Ship.Spec.Decks")}:</strong> ${escapeHtml(ship.shipDecks)} · <strong>${wft("WF.Ship.Spec.Cannons")}:</strong> ${escapeHtml(ship.shipCanons)} · <strong>${wft("WF.Ship.Spec.Masts")}:</strong> ${escapeHtml(ship.shipMasts)}</p>
<blockquote><p><em>${escapeHtml(L(ship.shipAppearance))}</em></p></blockquote>
<p><strong>${wft("WF.Ship.Spec.Cargo")}:</strong> ${escapeHtml(ship.cargoItems.map(c => L(c)).join(", "))}</p>
<p><strong>${wft("WF.Ship.Spec.Crew")}:</strong> ${escapeHtml(ship.shipCrew)}<br><em>${escapeHtml(L(ship.crewDescription))}</em></p>
<h2>${wft("WF.Ship.Section.Crew")}</h2>
<p><strong>${escapeHtml(ship.captain.name)}</strong> – ${escapeHtml(raceName(ship.captain))} (${escapeHtml(ship.captain.age)})<br>
<em>${escapeHtml(lang === "en" ? (ship.captain.cinematicEn ?? ship.captain.cinematic) : ship.captain.cinematic)}</em></p>
<h2>${wft("WF.Ship.Section.CrewMembers")}</h2>
${ship.crewMembers.map(c => `<p><strong>${escapeHtml(c.name)}</strong> – ${escapeHtml(raceName(c))} – ${escapeHtml(jobName(c))}</p>`).join("")}`;
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Genereert een willekeurig schip.
 *
 * Factie en scheepstype komen uit ships.json via DataLoader.
 * Elke factie heeft een lijst toegestane scheepstypen.
 * Elk scheepstype bevat alle specs (afmetingen, dekken, kanonnen, masten, crew).
 */
export async function generateShip() {
  // ── Factie: uit ships.json ────────────────────────────────────────────────

  const faction        = await pickFaction();
  const factionName    = { nl: faction.nl,            en: faction.en            };
  const factionAdj     = { nl: faction.adjective.nl,  en: faction.adjective.en  };

  // ── Scheepstype: gefilterd op factie ─────────────────────────────────────

  const shipTypeData   = await pickShipType(faction.id);
  const shipType       = { nl: shipTypeData.nl, en: shipTypeData.en };
  const maxShipLength  = shipTypeData.maxLength;
  const maxShipWidth   = shipTypeData.maxWidth;
  const shipDecks      = shipTypeData.decks;
  const shipCanons     = shipTypeData.cannons;
  const shipMasts      = shipTypeData.masts;
  const shipCrew       = shipTypeData.crew;

  // Genereer willekeurige afmetingen binnen het type-bereik
  const minShipLength  = Math.floor(maxShipLength * 0.7);
  const shipLength     = Math.floor(Math.random() * (maxShipLength - minShipLength)) + minShipLength;
  const minShipWidth   = Math.floor(maxShipWidth  * 0.7);
  const shipWidth      = Math.floor(Math.random() * (maxShipWidth  - minShipWidth))  + minShipWidth;

  // ── Overige scheepsgegevens uit JSON ─────────────────────────────────────

  const shipAppearance  = await pickShipAppearance();   // { nl, en }
  const crewDescription = await pickCrewDescription();  // { nl, en }

  // Nederlandse schepen (dutchName: true) gebruiken een aparte namenlijst
  const shipName = faction.dutchName
    ? await pickDutchShipName()
    : await pickShipName();

  // 3 unieke lading-items — bewaar als [{ nl, en }]
  const cargoItems = await pickCargo(3);

  // ── Bemanning genereren via interne NPC generator ────────────────────────

  const captain = await generateNPC();
  captain.job = { nl: "Kapitein", en: "Captain" };

  // 3 bemanningsleden met een beroep uit ship-functions.json
  const crewMembers = [];
  for (let i = 0; i < 3; i++) {
    const npc = await generateNPC();
    npc.job = await rollShipFunction();
    crewMembers.push(npc);
  }

  // ── Bouw het schip-object ─────────────────────────────────────────────────

  const ship = {
    type: "ship",
    shipName,
    faction:          factionName,
    factionAdjective: factionAdj,
    factionId:        faction.id,
    shipType, shipLength, shipWidth,
    shipDecks, shipCanons, shipMasts, shipCrew,
    shipAppearance, crewDescription, cargoItems,
    captain, crewMembers
  };
  return ship;
}

// =============================================================================
// ShipGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class ShipGenerator extends BaseGenerator {
  static codexType = "ship";
  static folder    = "_Random Ships PC";
  static icon      = "fa-ship";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateShip(); }
  static render(item)                 { return renderShipCard(item, { buttons: false }); }
  static getName(item)                { return item.shipName ?? "Ship"; }
  static getImage(item)               { return ""; }

  static getSub(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const L = (obj) => typeof obj === "object" ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");
    return `${L(item.faction)} · ${L(item.shipType)}`;
  }
}

// =============================================================================
// WRAPPERS VOOR WORLDFORGE UI
// =============================================================================

/**
 * Genereert een ship en stuurt die naar de WorldForge UI.
 * Wrapper om generateShip() – gebruik die als je alleen data nodig hebt.
 */
export async function generateAndShowShip() {
  const ship = await generateShip();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("ship_pc", ship);
  }
  return ship;
}
