/**
 * WorldForge – criminal-generator.js
 *
 * Genereert willekeurige criminele organisaties.
 *
 * Exporteert:
 *  - generateCriminalOrg({ forceType })  – genereert organisatie data object
 *  - renderCriminalOrgCard(org)           – rendert de kaart HTML
 *  - generateAndShowCriminalOrg()         – wrapper voor WorldForge UI
 */

import { WorldForgeSettings }   from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC }          from "./npc-generator.js";
import {
  escapeHtml, escapeAttr, randBetween,
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
  const pool = [...arr];
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
 * Genereert een criminele organisatie.
 * @param {object} [opts]
 * @param {string} [opts.forceType]  – organisatie type id om te forceren
 */
export async function generateCriminalOrg({ forceType = "random" } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";

  // Load criminal-organisations.json
  const crimData = await DataLoader.load("criminal-organisations.json");
  const orgTypes = crimData.organisationTypes ?? [];

  // Organisation type kiezen
  let orgType;
  if (forceType && forceType !== "random") {
    orgType = orgTypes.find(t => t.id === forceType);
  }
  if (!orgType) {
    // Weighted pick
    const total = orgTypes.reduce((s, i) => s + (i.weight ?? 1), 0);
    let roll = Math.random() * total;
    for (const item of orgTypes) {
      roll -= item.weight ?? 1;
      if (roll <= 0) { orgType = item; break; }
    }
    if (!orgType) orgType = orgTypes[0] ?? { nl: "Organisatie", en: "Organisation" };
  }

  // Helper: pickOrgName logica
  function pickOrgNameHelper(lang = "nl") {
    const n = crimData.names ?? {};
    const weights = n.nameWeights ?? { prefixName: 40, nameSuffix: 40, prefixNameSuffix: 20 };
    const total = weights.prefixName + weights.nameSuffix + weights.prefixNameSuffix;
    const roll = Math.random() * total;

    const prefix = pickRandom(n.prefixes?.[lang] ?? n.prefixes?.en ?? []);
    const name = pickRandom(n.names?.[lang] ?? n.names?.en ?? []);
    const suffix = pickRandom(n.suffixes?.[lang] ?? n.suffixes?.en ?? []);

    if (roll < weights.prefixName) {
      return `${prefix ?? ""} ${name ?? ""}`.trim();
    } else if (roll < weights.prefixName + weights.nameSuffix) {
      return `${name ?? ""} ${suffix ?? ""}`.trim();
    } else {
      return `${prefix ?? ""} ${name ?? ""} ${suffix ?? ""}`.trim();
    }
  }

  const nameNl = pickOrgNameHelper("nl");
  const nameEn = pickOrgNameHelper("en");
  const name = { nl: nameNl, en: nameEn };

  // Aantal leden
  const memberCount = randBetween(orgType.scaleMin ?? 5, orgType.scaleMax ?? 20);

  // Operatiestijl
  const opStyle = {
    nl: pickRandom(orgType.operationStyle?.nl ?? []),
    en: pickRandom(orgType.operationStyle?.en ?? orgType.operationStyle?.nl ?? [])
  };

  // Kenmerk
  const quirk = {
    nl: pickRandom(orgType.quirks?.nl ?? []),
    en: pickRandom(orgType.quirks?.en ?? orgType.quirks?.nl ?? [])
  };

  // Gedeelde pools
  const motive = {
    nl: pickRandom(crimData.motives?.nl ?? []),
    en: pickRandom(crimData.motives?.en ?? crimData.motives?.nl ?? [])
  };

  const territory = {
    nl: pickRandom(crimData.territories?.nl ?? []),
    en: pickRandom(crimData.territories?.en ?? crimData.territories?.nl ?? [])
  };

  const enemy = {
    nl: pickRandom(crimData.enemies?.nl ?? []),
    en: pickRandom(crimData.enemies?.en ?? crimData.enemies?.nl ?? [])
  };

  const ally = {
    nl: pickRandom(crimData.allies?.nl ?? []),
    en: pickRandom(crimData.allies?.en ?? crimData.allies?.nl ?? [])
  };

  // Leider — genereer een NPC
  const leader = await generateNPC();
  const leaderTitlesNl = orgType.leaderTitles?.nl ?? [];
  const leaderTitlesEn = orgType.leaderTitles?.en ?? [];
  leader.job = {
    nl: leaderTitlesNl[Math.floor(Math.random() * leaderTitlesNl.length)] ?? "Leider",
    en: leaderTitlesEn[Math.floor(Math.random() * leaderTitlesEn.length)] ?? "Leader"
  };

  // 2-4 leden met type-specifieke rollen
  const memberCount2 = 2 + Math.floor(Math.random() * 3);
  const officers = [];
  const memberRolesNl = orgType.memberRoles?.nl ?? [];
  const memberRolesEn = orgType.memberRoles?.en ?? [];
  for (let i = 0; i < memberCount2; i++) {
    const npc = await generateNPC();
    npc.job = {
      nl: memberRolesNl[Math.floor(Math.random() * memberRolesNl.length)] ?? "Lid",
      en: memberRolesEn[Math.floor(Math.random() * memberRolesEn.length)] ?? "Member"
    };
    officers.push(npc);
  }

  const basesNl = orgType.basesOfOperations?.nl ?? [];
  const basesEn = orgType.basesOfOperations?.en ?? [];
  const base = {
    nl: basesNl[Math.floor(Math.random() * basesNl.length)] ?? { location: "", entrance: "" },
    en: basesEn[Math.floor(Math.random() * basesEn.length)] ?? { location: "", entrance: "" }
  };

  // 2-3 willekeurige services uit de type-specifieke lijst
  const allServicesNl = orgType.services?.nl ?? [];
  const allServicesEn = orgType.services?.en ?? [];
  const serviceCount  = 2 + Math.floor(Math.random() * 2);
  const serviceIndices = pickUnique(
    [...Array(allServicesNl.length).keys()],
    Math.min(serviceCount, allServicesNl.length)
  );
  const services = serviceIndices.map(i => ({
    name:        { nl: allServicesNl[i]?.name ?? "", en: allServicesEn[i]?.name ?? "" },
    description: { nl: allServicesNl[i]?.description ?? "", en: allServicesEn[i]?.description ?? "" },
  }));

  return {
    type:        "criminal",
    name,
    orgType,
    subtitle:    { nl: orgType.nl, en: orgType.en },
    memberCount,
    motive,
    territory,
    opStyle,
    quirk,
    enemy,
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

export function renderCriminalOrgCard(org) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const t = (key) => wft(key);
  const L = (obj) => (typeof obj === "object" && obj !== null) ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  const typeName = L(org.subtitle ?? org.orgType);
  const memberLabel = `${org.memberCount} ${wfwft("WF.Crime.Label.Members")}`;

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(L(org.name))}</p>
      <p class="wf-subtitle">${escapeHtml(typeName)}</p>
      <div class="wf-meta-row">
        ${wfBadge(memberLabel)}
      </div>
    </div>
  </div>

  <!-- ── READOUT ── -->
  ${wfSectionHeader("⚔️", wft("WF.Crime.Section.Operations"))}
  <div class="wf-body">
    ${wfReadout([
      `${L(org.name)} ${wft("WF.Crime.Readout.IsA")} ${typeName} ${wft("WF.Crime.Readout.OperatesFrom")} ${(org.base?.[lang] ?? org.base?.nl)?.location ?? ""}.`,
      `${wft("WF.Crime.Readout.Entrance")} ${(org.base?.[lang] ?? org.base?.nl)?.entrance ?? ""}.`,
      `${wft("WF.Crime.Readout.Territory")} ${L(org.territory)}.`,
      `${wft("WF.Crime.Readout.OpStyle")} ${L(org.opStyle)}.`,
      `${wft("WF.Crime.Readout.Motive")}: ${L(org.motive)}.`,
      `${wft("WF.Crime.Readout.Enemy")} ${L(org.enemy)}.`,
      `${wft("WF.Crime.Readout.Ally")} ${L(org.ally)}.`,
    ].join(" "))}
  </div>

  <!-- ── KENMERK ── -->
  ${wfSectionHeader("💀", wft("WF.Crime.Section.Quirk"))}
  <div class="wf-body">
    <div class="wf-quirk">${escapeHtml(L(org.quirk))}</div>
  </div>

  <!-- ── DIENSTEN ── -->
  ${wfSectionHeader("🤝", wft("WF.Crime.Section.Services"))}
  <div class="wf-body">
    ${(org.services ?? []).map(s => `
      <div class="wf-trait-item">
        <div class="wf-trait-name">${escapeHtml(L(s.name))}</div>
        <div class="wf-trait-desc">${escapeHtml(L(s.description))}</div>
      </div>`).join("")}
  </div>

  <!-- ── LEIDER ── -->
  ${wfSectionHeader("👑", wft("WF.Crime.Section.Leader"))}
  <div class="wf-body">
    ${wfNpcItem(org.leader)}
  </div>

  <!-- ── OFFICIEREN ── -->
  ${wfSectionHeader("👥", `${wft("WF.Crime.Section.Officers")} (${org.officers.length})`)}
  <div class="wf-body">
    ${org.officers.map(o => wfNpcItem(o)).join("")}
  </div>

</div>`;
}

// =============================================================================
// DROPDOWN DATA
// =============================================================================

export async function getCriminalOrgDropdownData() {
  const lang = WorldForgeSettings.lang ?? "nl";
  const crimData = await DataLoader.load("criminal-organisations.json");
  const types = crimData.organisationTypes ?? [];
  return [
    { id: "random", label: wfwft("WF.Label.Random") },
    ...types.map(t => ({ id: t.id, label: lang === "en" ? t.en : t.nl }))
  ];
}

// =============================================================================
// CriminalGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class CriminalGenerator extends BaseGenerator {
  static codexType = "criminal";
  static folder    = "_Random Criminal Orgs";
  static icon      = "fa-skull-crossbones";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) { return generateCriminalOrg(options); }
  static render(item)                 { return renderCriminalOrgCard(item); }
  static getName(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const n = item.name;
    return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "Organisation";
  }
  static getImage(item) { return ""; }

  static getSub(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    return lang === "en" ? (item.orgType?.en ?? "") : (item.orgType?.nl ?? "");
  }
}

// =============================================================================
// WRAPPER
// =============================================================================

export async function generateAndShowCriminalOrg(forceType = "random") {
  const org = await generateCriminalOrg({ forceType });
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("criminal", org);
  }
  return org;
}
