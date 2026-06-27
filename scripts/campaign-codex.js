/**
 * WorldForge – CampaignCodexIntegration
 *
 * Alle Campaign Codex logica op één plek.
 * Vervangt de verspreide CC-checks, _preflight(), _saveToCodex() en drag-logica
 * in worldforge-app.js, en de saveToCodex() aanroepen verspreid over generators.
 *
 * Gebruik:
 *   import { CC } from "./campaign-codex.js";
 *
 *   if (CC.available) { ... }
 *   await CC.save(type, item, cfg);
 *   const uuid = await CC.preflight(type, item, cfg);
 *   const data = CC.getDragData(type, item, cfg, cachedUuid);
 */

import { WorldForgeSettings } from "./settings.js";
import { saveToCodex } from "./utils.js";

export const CC = {

  // ── Status ──────────────────────────────────────────────────────────────────

  /** Is Campaign Codex geïnstalleerd én actief? */
  get available() {
    return WorldForgeSettings.codexAvailable === true;
  },

  // ── Opslaan ─────────────────────────────────────────────────────────────────

  /**
   * Sla een gegenereerd item op als Campaign Codex entry.
   * Toont success/fout notificaties.
   *
   * @param {string} type  - Generator type ("npc", "shop", etc.)
   * @param {object} item  - Het gegenereerde data-object
   * @param {object} cfg   - TYPE_CONFIG entry met getName, folder, render, codexType
   */
  async save(type, item, cfg) {
    if (!this.available) return;
    const name = cfg.getName(item);
    try {
      await saveToCodex(
        name,
        cfg.folder,
        cfg.render(item),
        this._getImage(item, cfg),
        cfg.codexType ?? type
      );
      ui.notifications.info(`Campaign Codex aangemaakt: ${name}`);
    } catch (err) {
      console.error("WorldForge | CC save fout:", err);
      ui.notifications.error(`Campaign Codex mislukt: ${err.message}`);
    }
  },

  // ── Pre-flight voor drag ─────────────────────────────────────────────────────

  /**
   * Maak stil een CC entry aan (pre-flight voor drag-and-drop).
   * Sluit het sheet dat CC automatisch opent direct na aanmaak.
   *
   * @param {string} type
   * @param {object} item
   * @param {object} cfg
   * @returns {Promise<string|null>}  UUID van de CC entry, of null bij fout
   */
  async preflight(type, item, cfg) {
    if (!this.available) return null;
    try {
      const result = await saveToCodex(
        cfg.getName(item),
        cfg.folder,
        cfg.render(item),
        this._getImage(item, cfg),
        cfg.codexType ?? type
      );
      // CC opent het sheet automatisch na conversie — sluit het stil
      if (result?.codexUuid) {
        for (const app of foundry.applications.instances.values()) {
          if (app.document?.uuid === result.codexUuid) { app.close(); break; }
        }
      }
      return result?.codexUuid ?? null;
    } catch (err) {
      console.warn("WorldForge | CC preflight fout (stil):", err.message);
      return null;
    }
  },

  // ── Drag data ───────────────────────────────────────────────────────────────

  /**
   * Geeft het juiste drag-data object voor een item.
   * Prioriteit:
   *   1. cachedUuid  – pre-flight UUID (meest vers)
   *   2. bestaand CC journal op naam+type
   *   3. linked Foundry Actor UUID (NPC-specifiek)
   *   4. WorldForge fallback (type + raw data)
   *
   * @param {string}      type
   * @param {object}      item
   * @param {object}      cfg
   * @param {string|null} cachedUuid  - UUID uit een eerder _preflight() resultaat
   * @returns {{ type: string, uuid?: string, data?: object }}
   */
  getDragData(type, item, cfg, cachedUuid = null) {
    if (cachedUuid) return { type: "JournalEntry", uuid: cachedUuid };

    const existing = this.findExistingUuid(type, item, cfg);
    if (existing)  return { type: "JournalEntry", uuid: existing };

    if (item.actorUuid) return { type: "Actor", uuid: item.actorUuid };

    return { type: `worldforge/${type}`, data: item };
  },

  // ── Zoeken ──────────────────────────────────────────────────────────────────

  /**
   * Zoek synchroon het UUID van een bestaande CC entry voor dit item.
   * @returns {string|null}
   */
  findExistingUuid(type, item, cfg) {
    if (!this.available) return null;
    const name   = cfg.getName(item);
    const ccType = cfg.codexType ?? type;
    return game.journal
      ?.find(j => j.name === name && j.getFlag?.("campaign-codex", "type") === ccType)
      ?.uuid ?? null;
  },

  // ── Intern ──────────────────────────────────────────────────────────────────

  _getImage(item, cfg) {
    if (typeof cfg.getImage === "function") return cfg.getImage(item);
    return item.currentImagePath ?? item.imagePath ?? item.image ?? "";
  }
};
