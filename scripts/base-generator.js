/**
 * WorldForge – BaseGenerator
 *
 * Basisklasse voor alle generators. Definieert de verplichte interface
 * en levert gedeelde hulpfuncties zodat subclasses geen boilerplate
 * hoeven te herhalen.
 *
 * Minimale subclass:
 *
 *   export class ShopGenerator extends BaseGenerator {
 *     static codexType = "location";
 *     static folder    = "_Random Shops";
 *     static icon      = "fa-store";
 *
 *     static async generate(options = {}) { ... }
 *     static render(item)                 { ... }
 *     static getName(item)                { return item.shopName ?? "Shop"; }
 *     static getSub(item)                 { return item.shopType ?? ""; }
 *   }
 */

import { WorldForgeSettings } from "./settings.js";

export class BaseGenerator {

  // ── Subclass metadata ────────────────────────────────────────────────────────
  /** Campaign Codex type-sleutel: "npc", "location", "shop", etc. */
  static codexType = null;
  /** Foundry journal/actor map naam voor opgeslagen items */
  static folder    = "_Generated";
  /** FontAwesome icoonklasse voor de nav-knop */
  static icon      = "fa-dice";
  /** Kan een Foundry Actor aanmaken */
  static hasActor  = false;
  /** Heeft ComfyUI portret-generatie */
  static hasComfy  = false;
  /** ComfyUI render breedte */
  static comfyW    = 512;
  /** ComfyUI render hoogte */
  static comfyH    = 512;

  // ── Verplichte interface ─────────────────────────────────────────────────────

  /**
   * Genereer een data-object. Moet worden overschreven.
   * Mag asynchroon zijn; mag geen UI aanraken.
   *
   * @param   {object}          options
   * @returns {Promise<object>}
   */
  static async generate(options = {}) {
    throw new Error(`${this.name}.generate() is niet geïmplementeerd`);
  }

  /**
   * Rendert de HTML-kaart voor dit item. Moet worden overschreven.
   * Geeft een HTML-string terug; mag geen knoppen bevatten.
   *
   * @param   {object} item
   * @returns {string}
   */
  static render(item) {
    throw new Error(`${this.name}.render() is niet geïmplementeerd`);
  }

  // ── Overridable helpers ──────────────────────────────────────────────────────

  /** Primaire naam van het item (voor saved-list, drag-label, CC naam). */
  static getName(item) { return item.name ?? ""; }

  /** Ondertitel (ras·beroep, type, kwaliteit, etc.). */
  static getSub(item)  { return ""; }

  /**
   * Beste beschikbare afbeeldingspad.
   * Subclasses kunnen dit overschrijven voor type-specifieke logica.
   */
  static getImage(item) {
    return item.currentImagePath ?? item.imagePath ?? item.image ?? "";
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  /** Huidige taalinstelling vanuit WorldForgeSettings. */
  static get lang() { return WorldForgeSettings.lang ?? "nl"; }

  /**
   * Geeft de juiste waarde terug uit een tweetalig { nl, en } object.
   * Veilig met null/undefined en gewone strings.
   *
   * @param   {object|string|null} obj
   * @returns {string}
   */
  static L(obj) {
    if (typeof obj === "string") return obj ?? "";
    if (!obj) return "";
    const lang = this.lang;
    return obj[lang] ?? obj.nl ?? "";
  }

  /**
   * Geeft een gewogen willekeurig item terug uit een array.
   * Items hebben optioneel een `weight` veld (default 1).
   *
   * @param   {Array}  arr
   * @returns {any}
   */
  static weightedPick(arr) {
    if (!arr?.length) return null;
    const total = arr.reduce((s, x) => s + (x.weight ?? 1), 0);
    let roll = Math.random() * total;
    for (const item of arr) {
      roll -= (item.weight ?? 1);
      if (roll <= 0) return item;
    }
    return arr[arr.length - 1];
  }
}
