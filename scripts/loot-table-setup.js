/**
 * WorldForge – loot-table-setup.js
 *
 * Utility to create all required Loot Rollable Tables automatically.
 * User clicks a button in WorldForge UI → this creates missing tables in a folder.
 */

import { WorldForgeSettings } from "./settings.js";

const wft = (key) => WorldForgeSettings.t(key);

// All required Loot tables
const LOOT_TABLES = [
  { name: "Loot - Consumables - Common", rarity: "common", type: "consumable" },
  { name: "Loot - Consumables - Uncommon", rarity: "uncommon", type: "consumable" },
  { name: "Loot - Consumables - Rare", rarity: "rare", type: "consumable" },
  { name: "Loot - Consumables - Very Rare", rarity: "very_rare", type: "consumable" },
  { name: "Loot - Consumables - Legendary", rarity: "legendary", type: "consumable" },

  { name: "Loot - Valuables - Common", rarity: "common", type: "valuable" },
  { name: "Loot - Valuables - Uncommon", rarity: "uncommon", type: "valuable" },
  { name: "Loot - Valuables - Rare", rarity: "rare", type: "valuable" },
  { name: "Loot - Valuables - Very Rare", rarity: "very_rare", type: "valuable" },
  { name: "Loot - Valuables - Legendary", rarity: "legendary", type: "valuable" },

  { name: "Loot - Permanent - Common", rarity: "common", type: "permanent" },
  { name: "Loot - Permanent - Uncommon", rarity: "uncommon", type: "permanent" },
  { name: "Loot - Permanent - Rare", rarity: "rare", type: "permanent" },
  { name: "Loot - Permanent - Very Rare", rarity: "very_rare", type: "permanent" },
  { name: "Loot - Permanent - Legendary", rarity: "legendary", type: "permanent" },

  { name: "Loot - Permanent - Books", rarity: "books", type: "permanent" },
];

/**
 * Get status of all loot tables
 * @returns {Promise<{total: number, existing: number, missing: Object[]}>}
 */
export async function getLootTableStatus() {
  const existing = [];
  const missing = [];

  for (const table of LOOT_TABLES) {
    const found = game.tables.getName(table.name);
    if (found) {
      existing.push(table);
    } else {
      missing.push(table);
    }
  }

  return {
    total: LOOT_TABLES.length,
    existing: existing.length,
    missing: missing,
    allComplete: missing.length === 0,
  };
}

/**
 * Create all missing loot tables in a WorldForge Loot folder
 * @returns {Promise<{created: number, skipped: number, folderId: string}>}
 */
export async function createMissingLootTables() {
  const status = await getLootTableStatus();

  if (status.allComplete) {
    ui.notifications.info("Alle Loot tabellen bestaan al!");
    return { created: 0, skipped: status.existing.length };
  }

  // Create or get "WorldForge Loot" folder
  let folder = game.folders.getName("WorldForge Loot");
  if (!folder) {
    folder = await Folder.create({
      name: "WorldForge Loot",
      type: "RollTable",
      parent: null,
    });
  }

  let created = 0;

  for (const tableSpec of status.missing) {
    try {
      // Create empty table with 1 placeholder entry
      const tableData = {
        name: tableSpec.name,
        type: "text",
        results: [
          {
            type: "text",
            text: `[Placeholder - voeg items toe]`,
            weight: 1,
            range: [1, 1],
          },
        ],
        folder: folder.id,
      };

      await RollTable.create(tableData);
      created++;
    } catch (err) {
      console.error(`WorldForge | Kon tabel niet maken: ${tableSpec.name}`, err);
    }
  }

  ui.notifications.info(
    `✅ ${created} Loot tabellen aangemaakt in "WorldForge Loot" folder`
  );

  return {
    created: created,
    skipped: status.existing.length,
    folderId: folder.id,
  };
}

/**
 * Open detailed setup dialog showing all tables
 */
export async function openLootTableSetupDialog() {
  const status = await getLootTableStatus();

  const content = `
    <div style="padding: 1rem;">
      <h2>Loot Tables Setup</h2>

      <div style="margin: 1rem 0; padding: 0.5rem; background: var(--color-bg-alt); border-radius: 4px;">
        <strong>Status:</strong> ${status.existing} / ${status.total} tabellen aangemaakt
        <div style="width: 100%; background: #ddd; height: 20px; border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
          <div style="width: ${(status.existing / status.total) * 100}%; height: 100%; background: #4caf50;"></div>
        </div>
      </div>

      <div style="margin: 1rem 0;">
        <h3>Ontbrekende tabellen (${status.missing.length}):</h3>
        <ul style="font-size: 0.9em; max-height: 300px; overflow-y: auto;">
          ${status.missing
            .map(
              (t) => `
            <li>${t.name}</li>
          `
            )
            .join("")}
        </ul>
      </div>

      <div style="margin: 1rem 0; padding: 0.75rem; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 2px;">
        <strong>⚠️ Let op:</strong> De tabellen worden met placeholder-items aangemaakt.
        Vul ze handmatig in met jouw eigen loot items.
      </div>

      <div style="margin: 1rem 0; text-align: center;">
        ${
          status.allComplete
            ? '<p style="color: #4caf50;"><strong>✅ Alle tabellen bestaan al!</strong></p>'
            : `<button id="create-loot-tables" style="padding: 0.75rem 1.5rem; background: #0070dd; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em;">
          Maak ${status.missing.length} tabellen aan
        </button>`
        }
      </div>
    </div>
  `;

  // Create dialog
  const dialog = new Dialog({
    title: "WorldForge Loot Tables Setup",
    content: content,
    buttons: {
      close: {
        label: "Sluiten",
        callback: () => {},
      },
    },
    default: "close",
    width: 500,
  });

  dialog.render(true);

  // Add event listener after render
  setTimeout(() => {
    const btn = document.getElementById("create-loot-tables");
    if (btn) {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Bezig met aanmaken...";

        await createMissingLootTables();

        dialog.close();
      });
    }
  }, 100);
}
