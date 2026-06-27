/**
 * WorldForge – DataLoader
 *
 * Centrale JSON loader met caching. Vervangt de tientallen losse
 * load*Data() functies in elke generator.
 *
 * Gebruik:
 *   const races = await DataLoader.load("races.json", "races");
 *   const all   = await DataLoader.load("buildings.json");          // volledig object
 *   DataLoader.invalidate("buildings.json");                        // cache wissen
 */

const BASE_PATH = "modules/world-forge-generator/data/";

// Validation rules per file type
// All data files are objects at root level; the array key is specified below
const VALIDATION_SCHEMAS = {
  "races.json": { objectKey: "races" },
  "jobs.json": { objectKey: "jobs" },
  "colors.json": { objectKey: "colors" },
  "sex.json": { objectKey: "sex" },
  "governments.json": { objectKey: "governments" },
  "defenses.json": { objectKey: "defenses" },
  "trade-goods.json": { objectKey: "trade_goods" },
  "biomes.json": { objectKey: "biomes" },
  "cities.json": { objectKey: "cities" },
  "buildings.json": { objectKey: "buildings" },
  "buildings-poi.json": { objectKey: "buildings" },
  "shops.json": { objectKey: "shops" },
  "inns.json": { objectKey: "inns" },
  "ships.json": { objectKey: "ships" },
  "criminal-organisations.json": { objectKey: "criminal_orgs" },
  "factions.json": { objectKey: "factions" },
  "market-stalls.json": { objectKey: "stalls" },
  "families.json": { objectKey: "houses" },
  "npc/traits.json": { objectKey: "traits" },
  "npc/appearance.json": { objectKey: "items" },
  "shared/materials.json": { objectKey: null }, // No specific key, return full object
  "inns-caribbean.json": { objectKey: "inns" },
  "ships-generic.json": { objectKey: "ships" },
  "ship-functions.json": { objectKey: "functions" }
};

export class DataLoader {
  static _cache = new Map();

  /**
   * Validates loaded data against expected schema.
   * @param {string} path - File path for schema lookup
   * @param {any} data - Data to validate
   * @returns {boolean} - true if valid, logs warning if not
   */
  static _validateSchema(path, data) {
    // DISABLED: Validation schema needs rework for correct object-based validation
    // For now, accept all data and log issues only if critical
    if (!data) {
      console.warn(`WorldForge | DataLoader: ${path} returned null/undefined`);
      return false;
    }
    if (typeof data !== "object") {
      console.warn(`WorldForge | DataLoader: ${path} is not an object`);
      return false;
    }
    return true;
  }

  /**
   * Laadt een JSON bestand en cached het resultaat.
   *
   * @param {string}      path  - Relatief pad t.o.v. data/, bijv. "races.json" of "shared/materials.json"
   * @param {string|null} key   - Root-sleutel om uit het JSON object te plukken (bijv. "races")
   * @returns {Promise<any>}    - Array of object, afhankelijk van key
   */
  static async load(path, key = null) {
    const cacheKey = key != null ? `${path}#${key}` : path;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    try {
      const resp = await fetch(`${BASE_PATH}${path}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data   = await resp.json();

      // Validate schema
      if (!this._validateSchema(path, data)) {
        console.warn(`WorldForge | DataLoader: schema validation failed for ${path}, using fallback`);
        const fallback = key != null ? [] : {};
        this._cache.set(cacheKey, fallback);
        return fallback;
      }

      const result = key != null ? (data[key] ?? []) : data;
      this._cache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.error(`WorldForge | DataLoader: kon ${path} niet laden:`, err);
      const fallback = key != null ? [] : {};
      this._cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  /**
   * Haal één willekeurig item op uit een geladen array.
   * Combineert load() + random pick in één aanroep.
   *
   * @param {string}      path
   * @param {string|null} key
   * @returns {Promise<any>}
   */
  static async pick(path, key = null) {
    const arr = await this.load(path, key);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Verwijder één of alle cache-entries.
   * Nuttig wanneer settings (bijv. campaignThemePreset) wijzigen.
   *
   * @param {string|null} path  - Pad om te invalideren, of null voor alles
   */
  static invalidate(path = null) {
    if (path) {
      for (const key of this._cache.keys()) {
        if (key === path || key.startsWith(`${path}#`)) this._cache.delete(key);
      }
    } else {
      this._cache.clear();
    }
  }
}
