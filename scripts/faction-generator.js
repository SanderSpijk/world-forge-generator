/**
 * WorldForge – faction-generator.js
 *
 * Genereert willekeurige facties (machtige organisaties, huizen, gilden, orden).
 * Zelfde structuur als criminal-generator.js.
 *
 * Exporteert:
 *  - generateFaction({ forceType })   – genereert factie data object
 *  - renderFactionCard(faction)        – rendert de kaart HTML
 *  - generateAndShowFaction()          – wrapper voor WorldForge UI
 *  - getFactionDropdownData()          – geeft types voor UI dropdown
 */

import { WorldForgeSettings }  from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC }         from "./npc-generator.js";
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

function pickUnique(arr, count) {
  const pool   = [...arr];
  const result = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// =============================================================================
// GENERATIE
// =============================================================================

/**
 * Genereert een factie.
 * @param {object} [opts]
 * @param {string} [opts.forceType] – faction type id om te forceren, of "random"
 */
export async function generateFaction({ forceType = "random" } = {}) {
  // Load factions.json
  const facData = await DataLoader.load("factions.json");
  const factionTypes = facData.factionTypes ?? [];

  // Faction type kiezen
  let factionType;
  if (forceType && forceType !== "random") {
    factionType = factionTypes.find(t => t.id === forceType);
  }
  if (!factionType) {
    // Weighted pick
    const total = factionTypes.reduce((s, i) => s + (i.weight ?? 1), 0);
    let roll = Math.random() * total;
    for (const item of factionTypes) {
      roll -= item.weight ?? 1;
      if (roll <= 0) { factionType = item; break; }
    }
    if (!factionType) factionType = factionTypes[0] ?? { nl: "Factie", en: "Faction" };
  }

  // Helper: pickFactionName logica
  function pickFactionNameHelper(lang = "nl") {
    const n = facData.names ?? {};
    const weights = n.nameWeights ?? {};
    const total = (weights.adjNoun ?? 1) + (weights.adjSuffix ?? 1) + (weights.familySuffix ?? 1) +
                  (weights.adjNounSuffix ?? 1) + (weights.nounSuffix ?? 1);
    const roll = Math.random() * total;

    const adj = pickRandom(n.adjectives?.[lang] ?? n.adjectives?.en ?? []);
    const noun = pickRandom(n.nouns?.[lang] ?? n.nouns?.en ?? []);
    const family = pickRandom(n.familyNames ?? []);
    const suffix = pickRandom(n.suffixes?.[lang] ?? n.suffixes?.en ?? []);

    let cumul = 0;
    cumul += weights.adjNoun ?? 1;
    if (roll < cumul) return `${lang === "nl" ? "De " : "The "}${adj ?? ""} ${noun ?? ""}`.trim();
    cumul += weights.adjSuffix ?? 1;
    if (roll < cumul) return `${lang === "nl" ? "De " : "The "}${adj ?? ""} ${suffix ?? ""}`.trim();
    cumul += weights.familySuffix ?? 1;
    if (roll < cumul) return `${family ?? ""} ${suffix ?? ""}`.trim();
    cumul += weights.adjNounSuffix ?? 1;
    if (roll < cumul) return `${adj ?? ""} ${noun ?? ""} ${suffix ?? ""}`.trim();
    return `${lang === "nl" ? "De " : "The "}${noun ?? ""} ${suffix ?? ""}`.trim();
  }

  // Tweetalige naam
  const nameNl = pickFactionNameHelper("nl");
  const nameEn = pickFactionNameHelper("en");
  const name = { nl: nameNl, en: nameEn };

  // Ledenaantal
  const memberCount = randBetween(factionType.scaleMin ?? 5, factionType.scaleMax ?? 20);

  // Operatiestijl
  const opStyleNl = pickRandom(factionType.operationStyle?.nl ?? []);
  const opStyleEn = pickRandom(factionType.operationStyle?.en ?? factionType.operationStyle?.nl ?? []);
  const opStyle = { nl: opStyleNl, en: opStyleEn };

  // Kenmerk
  const quirkNl = pickRandom(factionType.quirks?.nl ?? []);
  const quirkEn = pickRandom(factionType.quirks?.en ?? factionType.quirks?.nl ?? []);
  const quirk = { nl: quirkNl, en: quirkEn };

  // Gedeelde pools
  const goal = {
    nl: pickRandom(facData.goals?.nl ?? []),
    en: pickRandom(facData.goals?.en ?? facData.goals?.nl ?? [])
  };

  const resource = {
    nl: pickRandom(facData.resources?.nl ?? []),
    en: pickRandom(facData.resources?.en ?? facData.resources?.nl ?? [])
  };

  const territory = {
    nl: pickRandom(facData.territories?.nl ?? []),
    en: pickRandom(facData.territories?.en ?? facData.territories?.nl ?? [])
  };

  const rival = {
    nl: pickRandom(facData.rivals?.nl ?? []),
    en: pickRandom(facData.rivals?.en ?? facData.rivals?.nl ?? [])
  };

  const ally = {
    nl: pickRandom(facData.allies?.nl ?? []),
    en: pickRandom(facData.allies?.en ?? facData.allies?.nl ?? [])
  };

  // Basis van operaties
  const bases = factionType.basesOfOperations ?? facData.basesOfOperations?.byType?.[factionType.id] ?? facData.basesOfOperations?.generic ?? {};
  const basesNl = bases.locations?.nl ?? [];
  const basesEn = bases.locations?.en ?? bases.locations?.nl ?? [];
  const entrancesNl = bases.entrances?.nl ?? [];
  const entrancesEn = bases.entrances?.en ?? bases.entrances?.nl ?? [];
  const base = {
    nl: {
      location: basesNl[Math.floor(Math.random() * basesNl.length)] ?? "",
      entrance: entrancesNl[Math.floor(Math.random() * entrancesNl.length)] ?? ""
    },
    en: {
      location: basesEn[Math.floor(Math.random() * basesEn.length)] ?? "",
      entrance: entrancesEn[Math.floor(Math.random() * entrancesEn.length)] ?? ""
    }
  };

  // Racial purity — bepaal race voor Racial Enclaves
  let forceRace = null;
  if (factionType.category === "Racial Enclave") {
    const raceMap = {
      "dwarven_enclave": "Dwarf",
      "elven_quarter": "Elf",
      "orc_settlement": "Orc",
      "gnome_district": "Gnome",
      "halfling_haven": "Halfling"
    };
    forceRace = raceMap[factionType.id];
  }

  // Leider — NPC met type-specifieke titel
  const leader = await generateNPC({ forceRace });
  const leaderTitlesNl = factionType.leaderTitles?.nl ?? facData.genericLeaderTitles?.nl ?? [];
  const leaderTitlesEn = factionType.leaderTitles?.en ?? facData.genericLeaderTitles?.en ?? [];
  leader.job = {
    nl: leaderTitlesNl[Math.floor(Math.random() * leaderTitlesNl.length)] ?? "Leider",
    en: leaderTitlesEn[Math.floor(Math.random() * leaderTitlesEn.length)] ?? "Leader"
  };

  // 2-4 leden met type-specifieke rollen
  const officerCount = 2 + Math.floor(Math.random() * 3);
  const officers = [];
  const memberRolesNl = factionType.memberRoles?.nl ?? facData.genericMemberRoles?.nl ?? [];
  const memberRolesEn = factionType.memberRoles?.en ?? facData.genericMemberRoles?.en ?? [];
  for (let i = 0; i < officerCount; i++) {
    const npc = await generateNPC({ forceRace });
    npc.job = {
      nl: memberRolesNl[Math.floor(Math.random() * memberRolesNl.length)] ?? "Lid",
      en: memberRolesEn[Math.floor(Math.random() * memberRolesEn.length)] ?? "Member"
    };
    officers.push(npc);
  }

  // Diensten — optioneel, alleen als het type services heeft
  const allServicesNl = factionType.services?.nl ?? [];
  const allServicesEn = factionType.services?.en ?? [];
  const serviceCount  = allServicesNl.length
    ? 1 + Math.floor(Math.random() * Math.min(2, allServicesNl.length))
    : 0;
  const serviceIndices = pickUnique(
    [...Array(allServicesNl.length).keys()],
    Math.min(serviceCount, allServicesNl.length)
  );
  const services = serviceIndices.map(i => ({
    name:        { nl: allServicesNl[i]?.name ?? "", en: allServicesEn[i]?.name ?? "" },
    description: { nl: allServicesNl[i]?.description ?? "", en: allServicesEn[i]?.description ?? "" },
  }));

  return {
    type:        "faction",
    name,
    factionType,
    subtitle:    { nl: factionType.nl, en: factionType.en },
    category:    factionType.category,
    memberCount,
    goal,
    resource,
    territory,
    opStyle,
    quirk,
    rival,
    ally,
    leader,
    officers,
    base,
    services,
  };
}

// =============================================================================
// RENDER
// =============================================================================

export function renderFactionCard(faction, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const L    = (obj) => (typeof obj === "object" && obj !== null)
    ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  const typeName    = L(faction.subtitle ?? faction.factionType);
  const memberLabel = `${faction.memberCount} ${wft("WF.Faction.Label.Members")}`;

  const readoutParts = [
    `${L(faction.name)} ${wft("WF.Faction.Readout.IsA")} ${typeName} ${wft("WF.Faction.Readout.OperatesFrom")} ${(faction.base?.[lang] ?? faction.base?.nl)?.location ?? ""}.`,
    `${wft("WF.Faction.Readout.Entrance")} ${(faction.base?.[lang] ?? faction.base?.nl)?.entrance ?? ""}.`,
    `${wft("WF.Faction.Readout.Resource")}: ${L(faction.resource)}.`,
    `${wft("WF.Faction.Readout.Goal")}: ${L(faction.goal)}.`,
    `${wft("WF.Faction.Readout.Territory")}: ${L(faction.territory)}.`,
    `${wft("WF.Faction.Readout.OpStyle")} ${L(faction.opStyle)}.`,
    `${wft("WF.Faction.Readout.Rival")}: ${L(faction.rival)}.`,
    `${wft("WF.Faction.Readout.Ally")}: ${L(faction.ally)}.`,
  ].join(" ");

  const servicesHtml = (faction.services ?? []).length
    ? `${wfSectionHeader("🤝", wft("WF.Faction.Section.Services"))}
       <div class="wf-body">
         ${faction.services.map(s => `
           <div class="wf-trait-item">
             <div class="wf-trait-name">${escapeHtml(L(s.name))}</div>
             <div class="wf-trait-desc">${escapeHtml(L(s.description))}</div>
           </div>`).join("")}
       </div>`
    : "";

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(L(faction.name))}</p>
      <p class="wf-subtitle">${escapeHtml(typeName)}</p>
      <div class="wf-meta-row">
        ${wfBadge(faction.category)}
        ${wfBadge(memberLabel)}
      </div>
    </div>
  </div>

  <!-- ── READOUT ── -->
  ${wfSectionHeader("🏛️", wft("WF.Faction.Section.Operations"))}
  <div class="wf-body">
    ${wfReadout(readoutParts)}
  </div>

  <!-- ── KENMERK ── -->
  ${wfSectionHeader("⚜️", wft("WF.Faction.Section.Quirk"))}
  <div class="wf-body">
    <div class="wf-quirk">${escapeHtml(L(faction.quirk))}</div>
  </div>

  <!-- ── DIENSTEN ── -->
  ${servicesHtml}

  <!-- ── LEIDER ── -->
  ${wfSectionHeader("👑", wft("WF.Faction.Section.Leader"))}
  <div class="wf-body">
    ${wfNpcItem(faction.leader)}
  </div>

  <!-- ── LEDEN ── -->
  ${wfSectionHeader("👥", `${wft("WF.Faction.Section.Officers")} (${faction.officers.length})`)}
  <div class="wf-body">
    ${faction.officers.map(o => wfNpcItem(o)).join("")}
  </div>

</div>`;
}

// =============================================================================
// DROPDOWN DATA
// =============================================================================

export async function getFactionDropdownData() {
  const lang = WorldForgeSettings.lang ?? "nl";
  const facData = await DataLoader.load("factions.json");
  const types = facData.factionTypes ?? [];

  return [
    { id: "random", label: wft("WF.Label.Random"), category: null },
    ...types.map(t => ({
      id: t.id,
      label: lang === "en" ? t.en : t.nl,
      category: t.category
    }))
  ];
}

// =============================================================================
// WRAPPER
// =============================================================================

// =============================================================================
// FactionGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class FactionGenerator extends BaseGenerator {
  static codexType = "faction";
  static folder    = "_Random Factions";
  static icon      = "fa-chess-rook";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateFaction(options); }
  static render(item)                 { return renderFactionCard(item, { buttons: false }); }
  static getName(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const n = item.name;
    return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "Faction";
  }
  static getImage(item) { return ""; }

  static getSub(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const s = item.subtitle;
    return (typeof s === "object" ? (s[lang] ?? s.nl) : s) ?? "";
  }
}

/**
 * Genereert een factie en stuurt die naar de WorldForge UI.
 */
export async function generateAndShowFaction(forceType = "random") {
  const faction = await generateFaction({ forceType });
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("faction", faction);
  }
  return faction;
}
