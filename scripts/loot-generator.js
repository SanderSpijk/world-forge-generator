/**
 * WorldForge – loot-generator.js
 *
 * Genereert willekeurige loot op basis van loot type en tier.
 * Gebaseerd op de Random Loot macro.
 *
 * Loot types: World, Monster, Boss, Treasure
 * Tiers: 1 (lv 1-4), 2 (lv 5-10), 3 (lv 11-16), 4 (lv 17-20)
 *
 * Exporteert:
 *  - generateLoot(lootType, tier)  – genereert loot data object
 *  - renderLootCard(loot)          – rendert de GM-preview kaart (zonder claim knop)
 *  - renderLootPublic(loot)        – rendert de publieke kaart (met claim knop)
 *  - generateAndShowLoot()         – wrapper voor WorldForge UI
 */

import { WorldForgeSettings } from "./settings.js";
import {
  escapeHtml, escapeAttr,
  wfSectionHeader
} from "./utils.js";

const wft = (key) => WorldForgeSettings.t(key);


// =============================================================================
// HELPERS
// =============================================================================

function randomChoiceWeighted(entries) {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of entries) {
    if (roll < entry.weight) return entry.value;
    roll -= entry.weight;
  }
  return entries[0]?.value ?? null;
}

async function rollFormula(formula) {
  const roll = new Roll(formula);
  await roll.evaluate();
  return roll.total ?? 0;
}

function getRarityColor(rarity) {
  const colors = {
    "Common":    "#9a9a9a",
    "Uncommon":  "#1f9d55",
    "Rare":      "#3b82f6",
    "Very Rare": "#8b5cf6",
    "Legendary": "#f59e0b",
    "Book":      "#7a1f2b"
  };
  return colors[rarity] ?? "#444444";
}

function formatCoins(coins) {
  const lang  = (typeof game !== "undefined"
    ? (game.settings?.get("world-forge-generator", "generatorLanguage") ?? "nl")
    : "nl");
  const parts = [];
  if (lang === "en") {
    if (coins.cp > 0) parts.push(`${coins.cp} Copper`);
    if (coins.sp > 0) parts.push(`${coins.sp} Silver`);
    if (coins.gp > 0) parts.push(`${coins.gp} Gold`);
    return parts.length ? parts.join(", ") : "No coins";
  }
  if (coins.cp > 0) parts.push(`${coins.cp} Stuiver${coins.cp === 1 ? "" : "s"}`);
  if (coins.sp > 0) parts.push(`${coins.sp} Gulden${coins.sp === 1 ? "" : "s"}`);
  if (coins.gp > 0) parts.push(`${coins.gp} Florijn${coins.gp === 1 ? "" : "en"}`);
  return parts.length ? parts.join(", ") : "Geen munten";
}

function hasCoins(coins) {
  return Number(coins.cp ?? 0) > 0 || Number(coins.sp ?? 0) > 0 || Number(coins.gp ?? 0) > 0;
}

function getTierLabel(tier) {
  const labels = {
    1: "Tier 1 (Level 1-4)",
    2: "Tier 2 (Level 5-10)",
    3: "Tier 3 (Level 11-16)",
    4: "Tier 4 (Level 17-20)"
  };
  return labels[tier] ?? `Tier ${tier}`;
}

function getResultUuid(result) {
  if (!result?.documentCollection || !result?.documentId) return null;
  return `${result.documentCollection}.${result.documentId}`;
}

async function getResultName(result) {
  const uuid = getResultUuid(result);
  if (uuid) {
    try {
      const doc = await fromUuid(uuid);
      if (doc?.name) return doc.name;
    } catch (err) {}
  }
  const raw = result?.description ?? result?.text ?? "Onbekend item";
  return String(raw).replace(/<[^>]*>/g, "").trim();
}

async function rollTable(name) {
  const table = game.tables.getName(name);
  if (!table) {
    ui.notifications.warn(`${wft("WF.Notify.TableNotFound")}: ${name}`);
    return null;
  }
  const draw = await table.draw({ displayChat: false });
  return draw?.results?.[0] ?? null;
}

// =============================================================================
// GENERATIE LOGICA
// =============================================================================

function getItemCount(lootType, tier) {
  const map = {
    World:    { 1: [1,2], 2: [2,3], 3: [2,4], 4: [3,4] },
    Monster:  { 1: [1,2], 2: [2,3], 3: [2,4], 4: [3,5] },
    Boss:     { 1: [2,3], 2: [3,4], 3: [4,5], 4: [5,6] },
    Treasure: { 1: [2,3], 2: [3,4], 3: [4,5], 4: [5,7] }
  };
  const [min, max] = map[lootType]?.[tier] ?? [2, 3];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(tier) {
  const tables = {
    1: [
      { value: "Common",    weight: 70 },
      { value: "Uncommon",  weight: 25 },
      { value: "Rare",      weight: 5  }
    ],
    2: [
      { value: "Common",    weight: 40 },
      { value: "Uncommon",  weight: 40 },
      { value: "Rare",      weight: 15 },
      { value: "Very Rare", weight: 5  }
    ],
    3: [
      { value: "Uncommon",  weight: 30 },
      { value: "Rare",      weight: 40 },
      { value: "Very Rare", weight: 20 },
      { value: "Legendary", weight: 10 }
    ],
    4: [
      { value: "Rare",      weight: 30 },
      { value: "Very Rare", weight: 40 },
      { value: "Legendary", weight: 30 }
    ]
  };
  return randomChoiceWeighted(tables[tier] ?? tables[1]);
}

function rollItemCategory(lootType) {
  const tables = {
    World: [
      { value: "Valuables",   weight: 50 },
      { value: "Consumables", weight: 35 },
      { value: "Permanent",   weight: 15 }
    ],
    Monster: [
      { value: "Valuables",   weight: 30 },
      { value: "Consumables", weight: 45 },
      { value: "Permanent",   weight: 25 }
    ],
    Boss: [
      { value: "Valuables",   weight: 20 },
      { value: "Consumables", weight: 30 },
      { value: "Permanent",   weight: 50 }
    ],
    Treasure: [
      { value: "Valuables",   weight: 35 },
      { value: "Consumables", weight: 30 },
      { value: "Permanent",   weight: 35 }
    ]
  };
  return randomChoiceWeighted(tables[lootType] ?? tables.World);
}

async function generateCoins(tier, lootType) {
  const formulas = {
    1: { cp: "2d6*10", sp: "1d6*10", gp: "1d6*2"   },
    2: { cp: "1d6*10", sp: "2d6*10", gp: "2d6*10"  },
    3: {               sp: "1d6*10", gp: "4d6*10"  },
    4: {                             gp: "10d6*10" }
  };
  const multipliers = { World: 0.5, Monster: 1, Treasure: 2, Boss: 3 };
  const result = { cp: 0, sp: 0, gp: 0 };
  const multi  = multipliers[lootType] ?? 1;
  const base   = formulas[tier] ?? formulas[1];
  for (const coin of Object.keys(base)) {
    const amount   = await rollFormula(base[coin]);
    result[coin]   = Math.floor(amount * multi);
  }
  return result;
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Genereert een loot object met items en munten.
 * @param {string} lootType  – "World" | "Monster" | "Boss" | "Treasure"
 * @param {number} tier      – 1 | 2 | 3 | 4
 */
export async function generateLoot(lootType = "World", tier = 1) {
  const rawResults = [];
  const itemCount  = getItemCount(lootType, tier);

  for (let i = 0; i < itemCount; i++) {
    const category = rollItemCategory(lootType);
    const rarity   = rollRarity(tier);
    const result   = await rollTable(`Loot - ${category} - ${rarity}`);
    if (result) rawResults.push({ result, rarity });
  }

  // Boek kans bij Treasure (30%)
  if (lootType === "Treasure" && Math.random() < 0.30) {
    const book = await rollTable("Loot - Permanent - Books");
    if (book) rawResults.push({ result: book, rarity: "Book" });
  }

  // Zet resultaten om naar item objecten
  const items = [];
  for (const entry of rawResults) {
    const uuid = getResultUuid(entry.result);
    const name = await getResultName(entry.result);
    items.push({ name, uuid, rarity: entry.rarity });
  }

  const coins         = await generateCoins(tier, lootType);
  const formattedCoins = formatCoins(coins);

  return {
    lootType,
    tier,
    items,
    coins,
    formattedCoins,
    claimId: foundry.utils.randomID()
  };
}

// =============================================================================
// HTML RENDER – WORLDFORGE UI KAART (GM preview)
// =============================================================================

/**
 * Rendert de loot kaart voor de WorldForge UI middelste kolom.
 * Bevat dropdowns voor lootType en tier, en de gegenereerde loot.
 */
export function renderLootCard(loot) {
  if (!loot) return "";

  const itemsHtml = loot.items.length
    ? loot.items.map(item => {
        const color = getRarityColor(item.rarity);
        // UUID items worden klikbaar via data-uuid voor drag-and-drop in chat
        const nameHtml = item.uuid
          ? `<span class="wf-loot-item-link" data-uuid="${escapeAttr(item.uuid)}"
                  style="color:${color}; cursor:pointer;"
                  title="Klik om te openen">${escapeHtml(item.name)}</span>`
          : `<span style="color:${color};">${escapeHtml(item.name)}</span>`;
        return `
<div class="wf-loot-item">
  ${nameHtml}
  <span class="wf-loot-rarity" style="color:${color};">${escapeHtml(item.rarity)}</span>
</div>`;
      }).join("")
    : `<p class="wf-loot-empty">Geen items gegenereerd.</p>`;

  const coinsHtml = hasCoins(loot.coins)
    ? `<div class="wf-loot-coins">${escapeHtml(loot.formattedCoins)}</div>`
    : `<p class="wf-loot-empty">Geen munten.</p>`;

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:60px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${wft("WF.Loot.Title")}</p>
      <p class="wf-subtitle">${escapeHtml(loot.lootType)} · ${escapeHtml(getTierLabel(loot.tier))}</p>
    </div>
  </div>

  <!-- ── ITEMS ── -->
  ${wfSectionHeader("📦", wft("WF.Loot.Section.Items"))}
  <div class="wf-body">
    ${itemsHtml}
  </div>

  <!-- ── MUNTEN ── -->
  ${wfSectionHeader("💰", wft("WF.Loot.Section.Coins"))}
  <div class="wf-body">
    ${coinsHtml}
  </div>

</div>`;
}

// =============================================================================
// HTML RENDER – PUBLIEKE CHAT KAART
// =============================================================================

/**
 * Rendert de publieke loot kaart voor in de chat.
 * Items zijn sleepbaar via @UUID links.
 * Munten hebben een claim knop.
 */
export async function renderLootPublic(loot, claimState = { claimed: false, claimedBy: null }) {
  // Items als @UUID enriched HTML zodat ze sleepbaar zijn
  const itemLines = [];
  for (const item of loot.items) {
    const color = getRarityColor(item.rarity);
    let nameHtml;
    if (item.uuid) {
      try {
        nameHtml = await TextEditor.enrichHTML(
          `@UUID[${item.uuid}]{${item.name}}`,
          { async: true }
        );
      } catch (err) {
        nameHtml = escapeHtml(item.name);
      }
    } else {
      nameHtml = escapeHtml(item.name);
    }
    itemLines.push(`
<li style="margin:0 0 4px 0;">
  <span style="font-weight:bold; color:${color};">${nameHtml}</span>
  <span style="font-size:11px; color:${color}; opacity:0.9; margin-left:6px;">(${escapeHtml(item.rarity)})</span>
</li>`);
  }

  const itemsHtml = itemLines.length
    ? `<ul style="margin:0; padding-left:18px;">${itemLines.join("")}</ul>`
    : `<p><em>Geen items.</em></p>`;

  // Munten met claim knop
  let coinsHtml;
  if (!hasCoins(loot.coins)) {
    coinsHtml = `<p><em>Geen munten.</em></p>`;
  } else if (claimState.claimed) {
    coinsHtml = `
<div>${escapeHtml(loot.formattedCoins)}</div>
<p style="margin:6px 0 0 0;"><em>Munten geclaimd door ${escapeHtml(claimState.claimedBy ?? "onbekend")}.</em></p>`;
  } else {
    coinsHtml = `
<div>${escapeHtml(loot.formattedCoins)}</div>
<div style="margin-top:8px;">
  <button type="button" class="wf-loot-claim-coins"
          style="padding:6px 10px; border:none; background:#3d6f3d; color:white; border-radius:6px; cursor:pointer;">
    💰 Claim munten
  </button>
</div>`;
  }

  return `
<div class="wf-card">
  <div class="wf-header" style="min-height:60px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${wft("WF.Loot.Title")}</p>
      <p class="wf-subtitle">${escapeHtml(loot.lootType)} · ${escapeHtml(getTierLabel(loot.tier))}</p>
    </div>
  </div>
  ${wfSectionHeader("📦", wft("WF.Loot.Section.Items"))}
  <div class="wf-body">${itemsHtml}</div>
  ${wfSectionHeader("💰", wft("WF.Loot.Section.Coins"))}
  <div class="wf-body">${coinsHtml}</div>
</div>`;
}

// =============================================================================
// WRAPPER VOOR WORLDFORGE UI
// =============================================================================

export async function generateAndShowLoot(lootType = "World", tier = 1) {
  const loot = await generateLoot(lootType, tier);
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("loot", loot);
  }
  return loot;
}
