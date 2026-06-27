/**
 * WorldForge – house-generator.js
 *
 * Genereert willekeurige huizen met familie-leden.
 * Kan standalone gebruikt worden (vanuit linker menu) of
 * met district parameter (vanuit city-generator).
 *
 * Exporteert:
 *  - generateHouse()          – genereert house + family data
 *  - renderHouseCard()        – HTML kaart voor preview
 *  - generateAndShowHouse()   – wrapper voor WorldForge UI
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC } from "./npc-generator.js";
import { runComfyRender, saveComfyImageToFoundry, baseNegativeExterior } from "./comfyui.js";
import {
  escapeHtml, escapeAttr, wfSectionHeader, wfReadout, wfBadge, wfNpcItem,
  pickRandom, randBetween, uniqueParts, clean, formatForFile
} from "./utils.js";
const wft = (key) => WorldForgeSettings.t(key);

// =============================================================================
// FAMILY COMPOSITION DEFINITIONS
// =============================================================================

const FAMILY_COMPOSITIONS = {
  // SINGLE PERSON (25%)
  elderly_man: {
    id: "elderly_man",
    nl: "Bejaarde man",
    en: "Elderly Man",
    weight: 1,
    roles: [
      { role: "patriarch", sex: "Male", minAge: 60, maxAge: 95 }
    ]
  },
  elderly_woman: {
    id: "elderly_woman",
    nl: "Bejaarde vrouw",
    en: "Elderly Woman",
    weight: 1,
    roles: [
      { role: "matriarch", sex: "Female", minAge: 60, maxAge: 95 }
    ]
  },
  young_man: {
    id: "young_man",
    nl: "Jongeman",
    en: "Young Man",
    weight: 1,
    roles: [
      { role: "bachelor", sex: "Male", minAge: 20, maxAge: 35 }
    ]
  },
  young_woman: {
    id: "young_woman",
    nl: "Jonge vrouw",
    en: "Young Woman",
    weight: 1,
    roles: [
      { role: "spinster", sex: "Female", minAge: 20, maxAge: 35 }
    ]
  },

  // COUPLE - NO CHILDREN (20%)
  young_couple: {
    id: "young_couple",
    nl: "Jonge geliefden",
    en: "Young Couple",
    weight: 1,
    roles: [
      { role: "husband", sex: "Male", minAge: 25, maxAge: 40 },
      { role: "wife", sex: "Female", minAge: 20, maxAge: 35 }
    ]
  },
  established_couple: {
    id: "established_couple",
    nl: "Gevestigde echtpaar",
    en: "Established Couple",
    weight: 1,
    roles: [
      { role: "husband", sex: "Male", minAge: 40, maxAge: 60 },
      { role: "wife", sex: "Female", minAge: 38, maxAge: 55 }
    ]
  },
  elderly_couple: {
    id: "elderly_couple",
    nl: "Oud echtpaar",
    en: "Elderly Couple",
    weight: 1,
    roles: [
      { role: "husband", sex: "Male", minAge: 60, maxAge: 95 },
      { role: "wife", sex: "Female", minAge: 58, maxAge: 90 }
    ]
  },

  // FAMILY - COUPLE + CHILDREN (45%)
  couple_1child: {
    id: "couple_1child",
    nl: "Gezin met 1 kind",
    en: "Family with 1 Child",
    weight: 2,
    roles: [
      { role: "father", sex: "Male", minAge: 30, maxAge: 45 },
      { role: "mother", sex: "Female", minAge: 28, maxAge: 42 },
      { role: "child", sex: "any", minAge: 5, maxAge: 15 }
    ]
  },
  couple_2children: {
    id: "couple_2children",
    nl: "Gezin met 2 kinderen",
    en: "Family with 2 Children",
    weight: 2,
    roles: [
      { role: "father", sex: "Male", minAge: 35, maxAge: 50 },
      { role: "mother", sex: "Female", minAge: 33, maxAge: 48 },
      { role: "elder_child", sex: "any", minAge: 8, maxAge: 18 },
      { role: "younger_child", sex: "any", minAge: 3, maxAge: 12 }
    ]
  },
  couple_3children: {
    id: "couple_3children",
    nl: "Gezin met 3 kinderen",
    en: "Family with 3 Children",
    weight: 1,
    roles: [
      { role: "father", sex: "Male", minAge: 40, maxAge: 55 },
      { role: "mother", sex: "Female", minAge: 38, maxAge: 52 },
      { role: "eldest_child", sex: "any", minAge: 12, maxAge: 22 },
      { role: "middle_child", sex: "any", minAge: 6, maxAge: 15 },
      { role: "youngest_child", sex: "any", minAge: 2, maxAge: 8 }
    ]
  },

  // SINGLE PARENT (10%)
  single_parent_1child: {
    id: "single_parent_1child",
    nl: "Alleenstaande ouder met 1 kind",
    en: "Single Parent with 1 Child",
    weight: 1,
    roles: [
      { role: "parent", sex: "any", minAge: 28, maxAge: 45 },
      { role: "child", sex: "any", minAge: 5, maxAge: 15 }
    ]
  },
  single_parent_2children: {
    id: "single_parent_2children",
    nl: "Alleenstaande ouder met 2 kinderen",
    en: "Single Parent with 2 Children",
    weight: 1,
    roles: [
      { role: "parent", sex: "any", minAge: 32, maxAge: 48 },
      { role: "elder_child", sex: "any", minAge: 8, maxAge: 16 },
      { role: "younger_child", sex: "any", minAge: 3, maxAge: 11 }
    ]
  },

  // EXTENDED FAMILY (5%)
  three_generations: {
    id: "three_generations",
    nl: "Drie generaties",
    en: "Three Generations",
    weight: 1,
    roles: [
      { role: "grandparent", sex: "any", minAge: 65, maxAge: 95 },
      { role: "parent", sex: "any", minAge: 35, maxAge: 50 },
      { role: "child", sex: "any", minAge: 5, maxAge: 15 }
    ]
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Pikt willekeurig familie-samenstelling obv house size
 */
function pickFamilyComposition(houseType) {
  const compositions = Object.values(FAMILY_COMPOSITIONS);

  // Filter based on house size
  let available = compositions;
  if (houseType.size === "tiny") {
    // Tiny houses: only single or small couples
    available = compositions.filter(c =>
      c.roles.length <= 2
    );
  } else if (houseType.size === "small") {
    // Small: single, couples, or 1-2 children
    available = compositions.filter(c =>
      c.roles.length <= 4
    );
  }

  // Weight-based selection
  const totalWeight = available.reduce((sum, c) => sum + (c.weight || 1), 0);
  let roll = Math.random() * totalWeight;

  for (const comp of available) {
    roll -= (comp.weight || 1);
    if (roll <= 0) return comp;
  }

  return available[available.length - 1];
}

/**
 * Genereer unieke family name uit race
 */
async function generateFamilyName() {
  const races = await DataLoader.load("races.json", "races");
  const race = races[Math.floor(Math.random() * races.length)];

  if (race.names?.surname?.names?.length > 0) {
    const surnames = race.names.surname.names;
    return surnames[Math.floor(Math.random() * surnames.length)];
  }
  if (race.names?.surname?.prefix && race.names?.surname?.suffix) {
    const prefix = race.names.surname.prefix[Math.floor(Math.random() * race.names.surname.prefix.length)];
    const suffix = race.names.surname.suffix[Math.floor(Math.random() * race.names.surname.suffix.length)];
    return prefix + suffix;
  }

  // Fallback
  return "Smith";
}

/**
 * Genereer ComfyUI prompt voor huis (house exterior)
 * Gebaseerd op shop-generator aanpak voor consistentie
 */
function generateComfyPrompt(item) {
  const { house } = item;

  // Extract material strings (they may be objects or strings)
  const getMatString = (mat) => typeof mat === "string" ? mat : (mat?.en ?? mat?.nl ?? "unknown");
  const wallMat = getMatString(house.materials.wall);
  const roofMat = getMatString(house.materials.roof);

  // Get theme tags from settings
  const themeTags = WorldForgeSettings.campaignThemeTags
    .split(",").map(t => t.trim()).filter(Boolean);

  // Build structured prompt like shop-generator
  // CRITICAL: Very explicit "no humans" repetition to fight against portrait-trained models
  return uniqueParts([
    "wide cinematic fantasy house exterior architecture",
    "environment concept art, architectural visualization",
    "high fantasy residential fantasy building",
    "establishing architectural shot",
    "front three-quarter architectural view",
    ...themeTags,
    "detailed intricate architecture",
    "ornate structural details",
    "weathered authentic materials",
    "daylight", "soft dramatic lighting", "sharp architectural focus",
    clean(house.type),
    `walls: ${clean(wallMat)}`,
    `roof: ${clean(roofMat)}`,
    `${house.wealth} condition house structure`,
    "residential dwelling house",
    "house exterior facade",
    "exterior building view only",
    "only the building structure and surroundings",
    "no interior visible",
    "absolutely no people", "zero humans", "completely empty",
    "no characters", "no figures", "no persons", "no animals",
    "ONLY ARCHITECTURE AND LANDSCAPE",
    "no faces", "no bodies", "no figures",
    "no signage text", "no watermark"
  ]).join(", ");
}

/**
 * Get negative prompt using the proven baseNegativeExterior from comfyui.js
 */
function getComfyNegative(item) {
  const { house } = item;
  const getMatString = (mat) => typeof mat === "string" ? mat : (mat?.en ?? mat?.nl ?? "");
  const wallMat = getMatString(house.materials.wall);
  return baseNegativeExterior(wallMat);
}

// =============================================================================
// MAIN GENERATION
// =============================================================================

export async function generateHouse({ district = null, theme = null } = {}) {
  const campaignTheme = theme ?? WorldForgeSettings.campaignThemePreset ?? "medieval";

  // Load data
  const familiesData = await DataLoader.load("families.json");
  const citiesData = district ? await DataLoader.load("cities.json") : null;

  // Get all houses
  const allHouses = familiesData.houses || [];

  // Filter by theme
  let filtered = allHouses.filter(h => h.theme.includes(campaignTheme));

  // If district specified, further filter
  if (district && citiesData) {
    const districtData = citiesData.districts?.find(d =>
      d.nl === district || d.en === district
    );

    if (districtData) {
      filtered = filtered.filter(h =>
        h.districts.includes(districtData.nl) || h.districts.includes(districtData.en)
      );
    }
  }

  // Fallback to generic if no matches
  if (!filtered.length) {
    filtered = allHouses.filter(h => h.theme.includes("generic"));
  }

  // Pick random house
  const houseType = filtered[Math.floor(Math.random() * filtered.length)];

  // Pick wealth level (weighted)
  const wealthKeys = Object.keys(houseType.wealth || {});
  const totalWeight = Object.values(houseType.wealth || {}).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let wealthLevel = "modest";
  for (const key of wealthKeys) {
    roll -= houseType.wealth[key];
    if (roll <= 0) {
      wealthLevel = key;
      break;
    }
  }

  // Generate materials
  const wall = await DataLoader.pick("shared/materials.json", "wall");
  const roof = await DataLoader.pick("shared/materials.json", "roof");
  const floor = await DataLoader.pick("shared/materials.json", "floor");

  // Generate family
  const familyName = await generateFamilyName();
  const composition = pickFamilyComposition(houseType);

  const members = [];
  for (const role of composition.roles) {
    const npc = await generateNPC({
      forceSex: role.sex === "any" ? null : role.sex,
      forcedLastName: familyName,
      minAge: role.minAge,
      maxAge: role.maxAge
    });
    members.push({
      ...npc,
      role: role.role
    });
  }

  // Pick backstory
  const backstories = familiesData.familyBackstories || [];
  const backstory = backstories[Math.floor(Math.random() * backstories.length)];

  // ★ CRITICAL: Generate and store ComfyUI prompts so worldforge-app._runComfyUI() can use them
  const tempItem = {
    house: {
      id: houseType.id,
      type: houseType.type,
      theme: campaignTheme,
      size: houseType.size,
      wealth: wealthLevel,
      district: district || null,
      materials: {
        wall,
        roof,
        floor
      },
      description: houseType.description,
      image: null
    },
    family: {
      name: familyName,
      size: members.length,
      composition: composition.id,
      members: members,
      backstory: backstory
    }
  };

  // Store ComfyUI prompts in the item object
  tempItem.comfyPrompt = generateComfyPrompt(tempItem);
  tempItem.comfyNegative = getComfyNegative(tempItem);

  return tempItem;
}

// =============================================================================
// HTML RENDER
// =============================================================================

export function renderHouseCard(item, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const L = (obj) => typeof obj === "object" ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  const { house, family } = item;

  // Image block
  const imgBlock = item.currentImagePath ? `
    <div class="wf-art-wrap">
      <img class="wf-side-art wf-house-art"
           data-img="${escapeAttr(item.currentImagePath)}"
           data-name="${escapeAttr(family.name)}"
           src="${escapeAttr(item.currentImagePath)}"
           onerror="this.closest('.wf-art-wrap').remove();"
           title="Klik om te vergroten">
    </div>` : "";

  // Family members list with wfNpcItem for action buttons
  const membersHtml = family.members.map(m => wfNpcItem(m, m.role)).join("");

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(family.name)} ${wft("WF.Family.Family")}</p>
      <p class="wf-subtitle">${escapeHtml(house.type)}</p>
      <div class="wf-meta-row">
        ${wfBadge(house.size)} ${wfBadge(house.wealth)} ${wfBadge(family.composition.replace(/_/g, " ").toUpperCase())}
      </div>
    </div>
    ${imgBlock}
  </div>

  <!-- ── HOUSE DESCRIPTION ── -->
  ${wfSectionHeader("📖", wft("WF.House.Section.Description"))}
  <div class="wf-body">
    ${wfReadout(`${escapeHtml(L(house.description))} Walls are built from ${escapeHtml(L(house.materials.wall))}. The roof features ${escapeHtml(L(house.materials.roof))}, and the floor is made of ${escapeHtml(L(house.materials.floor))}.`)}
  </div>

  <!-- ── FAMILY COMPOSITION ── -->
  ${wfSectionHeader("👨‍👩‍👧‍👦", wft("WF.Family.Family"))}
  <div class="wf-body">
    ${wfReadout(L(family.backstory))}
    <div style="margin-top: 16px;">
      ${membersHtml}
    </div>
  </div>

  <!-- Render-statusbalk -->
  ${item.currentImagePath ? `
  <div class="wf-status">
    <strong>${wft("WF.Status.Artwork")}</strong> ${escapeHtml(item.renderStatus ?? "Generated")}
  </div>` : ""}

  <!-- ── ACTIEKNOPPEN ── -->
  ${buttons ? `
  <div class="wf-actions">
    ${WorldForgeSettings.comfyAvailable ? `
    <button class="wf-btn wf-btn-purple wf-house-comfy" ${item.isRendering ? "disabled" : ""}>
      🎨 ${wft("WF.Btn.ComfyUI")}
    </button>` : ""}
    <button class="wf-btn wf-btn-primary wf-house-publish">
      ${wft("WF.Btn.Publish")}
    </button>
    <button class="wf-btn wf-house-save">
      ${wft("WF.Btn.Save")}
    </button>
    <button class="wf-btn wf-btn-green wf-house-codex">
      ${wft("WF.Btn.Codex")}
    </button>
    <button class="wf-btn wf-btn-red wf-house-actors">
      ${wft("WF.Btn.CreateActors")}
    </button>
  </div>` : ""}

</div>`;
}

// =============================================================================
// HOUSEGENERATOR CLASS (BaseGenerator)
// =============================================================================

export class HouseGenerator extends BaseGenerator {
  static codexType = "house";
  static folder = "_Random Houses";
  static icon = "fa-home";
  static hasActor = true;
  static hasComfy = true;
  static comfyW = 1024;
  static comfyH = 768;

  static async generate(options = {}) {
    return generateHouse(options);
  }

  static render(item) {
    return renderHouseCard(item, { buttons: false });
  }

  static getName(item) {
    return `${item.family.name} Family`;
  }

  static getSub(item) {
    return item.house.type;
  }

  static async generateComfyArtwork(item) {
    const prompt = generateComfyPrompt(item);
    const negative = getComfyNegative(item);

    const result = await runComfyRender({
      prompt: prompt,
      negativePrompt: negative,
      width: 1024,
      height: 768,
      filenamePrefix: `House_${formatForFile(item.family.name)}_${Date.now()}`
    });

    const filename = `house_${item.family.name.replace(/\s/g, "_")}`;
    const path = await saveComfyImageToFoundry(
      result.imageUrl,
      filename,
      WorldForgeSettings.buildingArtFolder
    );

    return path;
  }
}

// =============================================================================
// GENERATE AND SHOW
// =============================================================================

export async function generateAndShowHouse() {
  const house = await generateHouse();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("house", house);
  }
  return house;
}
