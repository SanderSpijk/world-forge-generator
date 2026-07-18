/**
 * WorldForge – worldforge-app.js
 *
 * De hoofdapplicatie van WorldForge. Een zwevend Foundry ApplicationV2 venster
 * met drie kolommen:
 *
 *  Links  – Navigatiemenu met de 6 generator-knoppen + Genereer-knop
 *  Midden – Het huidige gegenereerde item met acties rechtsboven
 *  Rechts – Tijdelijke opslag (max 5 per type, FIFO)
 *
 * Stijl gebaseerd op Campaign Codex: donker thema, gouden accenten, Cinzel font.
 */

import { generateNPC, renderNPCCard, saveNPCToActor,
         renderNPCSimple, getValidImagePath }        from "./npc-generator.js";
import { generateShop, renderShopCard, publishShopToChat } from "./shop-generator.js";
import { generateInn,  renderInnCard }                from "./inn-generator.js";
import { generateTavern, renderTavernCard }           from "./tavern-generator.js";
import { generateMarketStall, renderMarketStallCard,
         getMarketStallDropdownData }                 from "./market-stall-generator.js";
import { generateShip, renderShipCard }               from "./ship-generator.js";
import { generateGenericShip, renderGenericShipCard,
         getGenericShipDropdownData }                  from "./ship-generator-generic.js";
import { generateMenu, renderMenuCard }               from "./menu-generator.js";
import { generateLoot, renderLootCard,
         renderLootPublic, generateAndShowLoot }      from "./loot-generator.js";
import { generateWeather, renderWeatherCard,
         getStoredWeatherState, clearWeatherState }   from "./weather-generator.js";
import { generateMagicItem, renderMagicItemCard,
         renderMagicItemPublic, saveMagicItemToFoundry,
         renderMagicItemComfyUI,
         getMagicItemDropdownData }                   from "./magic-item-generator.js";
import { generateCity, renderCityCard, renderCityFactions, renderCityPOIs,
         renderCityPowerFactions,
         addDistrict, removeDistrict }             from "./city-generator.js";
import { generateCriminalOrg, renderCriminalOrgCard,
         getCriminalOrgDropdownData, generateAndShowCriminalOrg } from "./criminal-generator.js";
import { generatePOI, renderPOICard,
         getPOIDropdownData }                    from "./poi-generator.js";
import { generateFaction, renderFactionCard,
         getFactionDropdownData }                from "./faction-generator.js";
import { generateHouse, renderHouseCard, HouseGenerator,
         generateAndShowHouse }                  from "./house-generator.js";
import { PdfExporter }                             from "./pdf-exporter.js";
import { PdfExporter2014 }                         from "./pdf-exporter-2014.js";
import { escapeHtml, escapeAttr, ensureJournalFolder, saveToCodex } from "./utils.js";
import { CC } from "./campaign-codex.js";
import { WorldForgeSettings } from "./settings.js";
import { openLootTableSetupDialog } from "./loot-table-setup.js";
import { runComfyRender, saveComfyImageToFoundry,
         baseNegativePortrait, baseNegativeExterior,
        pingComfyUI, fetchComfyCheckpoints }  from "./comfyui.js";

const wft = (key) => WorldForgeSettings.t(key);


// =============================================================================
// CONFIGURATIE PER TYPE
// =============================================================================

const TYPE_CONFIG = {
  npc: {
    icon:        "fa-user",
    get label() { return wft("WF.Nav.NPC"); },
    generate:    generateNPC,
    render:      (item) => renderNPCCard(item, { buttons: false, gmTools: false }),
    folder:      "_Random NPCs",
    codexType:   "npc",
    getName:     (item) => item.name ?? "NPC",
    getSub:      (item) => { const lang = WorldForgeSettings.lang ?? "nl"; return `${(lang==="en" ? item.race?.en : null) ?? item.race?.nl ?? ""} · ${(lang==="en" ? item.job?.en : null) ?? item.job?.nl ?? ""}`; },
    hasActor:    true,
    hasComfy:    true,
    comfyW:      512,
    comfyH:      1024
  },
  shop: {
    icon:        "fa-store",
    get label() { return wft("WF.Nav.Shop"); },
    generate:    generateShop,
    render:      (item) => renderShopCard(item, { buttons: false }),
    folder:      "_Random Shops",
    codexType:   "shop",
    getName:     (item) => item.shopName ?? "Shop",
    getSub:      (item) => `${item.shopType ?? ""} · ${item.category ?? ""}`,
    hasActor:    false,
    hasComfy:    true,
    comfyW:      1024,
    comfyH:      768
  },
  inn: {
    icon:        "fa-bed",
    get label() { return wft("WF.Nav.Inn"); },
    generate:    generateInn,
    render:      (item) => renderInnCard(item, { buttons: false }),
    folder:      "_Random Inns",
    codexType:   "shop",
    getName:     (item) => item.innName ?? "Inn",
    getSub:      (item) => { const q = item.quality ?? ""; const qmap = {"Armoedig":"Poor","Eenvoudig":"Simple","Gemiddeld":"Average","Goed":"Good","Luxe":"Luxurious"}; return WorldForgeSettings.lang === "en" ? (qmap[q] ?? q) : q; },
    hasActor:    false,
    hasComfy:    true,
    comfyW:      1024,
    comfyH:      768
  },
  tavern: {
    icon:        "fa-beer-mug-empty",
    get label() { return wft("WF.Nav.Tavern"); },
    generate:    generateTavern,
    render:      (item) => renderTavernCard(item, { buttons: false }),
    folder:      "_Random Taverns",
    codexType:   "shop",
    getName:     (item) => item.tavernName ?? "Tavern",
    getSub:      (item) => { const q = item.quality ?? ""; const qmap = {"Armoedig":"Poor","Eenvoudig":"Simple","Gemiddeld":"Average","Goed":"Good","Luxe":"Luxurious"}; return WorldForgeSettings.lang === "en" ? (qmap[q] ?? q) : q; },
    hasActor:    false,
    hasComfy:    true,
    comfyW:      1024,
    comfyH:      768
  },
  marketstall: {
    icon:        "fa-shop",
    get label() { return wft("WF.Nav.MarketStall"); },
    generate:    generateMarketStall,
    render:      (item) => renderMarketStallCard(item, { buttons: false }),
    folder:      "_Random Market Stalls",
    codexType:   "marketStall",
    getName:     (item) => { const lang = WorldForgeSettings.lang ?? "nl"; const n = item.name; return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "Market Stall"; },
    getSub:      (item) => item.category ?? "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  ship_pc: {
    icon:        "fa-ship",
    get label() { return wft("WF.Nav.ShipPC"); },
    generate:    generateShip,
    render:      (item) => renderShipCard(item, { buttons: false }),
    folder:      "_Random Ships PC",
    codexType:   "ship",
    getName:     (item) => item.shipName ?? "Ship",
    getSub:      (item) => { const lang = WorldForgeSettings.lang ?? "nl"; const L = (o) => typeof o === "object" ? (o[lang] ?? o.nl ?? "") : (o ?? ""); return `${L(item.faction)} · ${L(item.shipType)}`; },
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  ship_generic: {
    icon:        "fa-anchor",
    get label() { return wft("WF.Nav.Ship"); },
    generate:    generateGenericShip,
    render:      (item) => renderGenericShipCard(item, { buttons: false }),
    folder:      "_Random Ships",
    getName:     (item) => item.shipName ?? "Ship",
    getSub:      (item) => { const lang = WorldForgeSettings.lang ?? "nl"; const l = (o) => typeof o === "object" ? (o[lang] ?? o.nl ?? "") : (o ?? ""); return `${l(item.purposeLabel)} · ${l(item.shipTypeLabel)}`; },
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  menu: {
    icon:        "fa-utensils",
    get label() { return wft("WF.Nav.Menu"); },
    generate:    generateMenu,
    render:      (item) => renderMenuCard(item, { buttons: false }),
    folder:      "_Random Menus",
    getName:     (item) => { const q = item.quality ?? ""; const qmap = {"Armoedig":"Poor","Eenvoudig":"Simple","Gemiddeld":"Average","Goed":"Good","Luxe":"Luxurious"}; const ql = WorldForgeSettings.lang === "en" ? (qmap[q] ?? q) : q; return `${wft("WF.Menu.Title")} (${ql})`; },
    getSub:      (item) => item.quality ?? "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  loot: {
    icon:        "fa-sack-dollar",
    get label() { return wft("WF.Nav.Loot"); },
    generate:    () => generateLoot("World", 1),
    render:      (item) => renderLootCard(item),
    folder:      "_Random Loot",
    getName:     (item) => `Loot (${item.lootType ?? ""} T${item.tier ?? ""})`,
    getSub:      (item) => item.lootType ?? "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  city: {
    icon:        "fa-city",
    get label() { return wft("WF.Nav.City"); },
    generate:    generateCity,
    render:      (item) => renderCityCard(item),
    folder:      "_Random Cities",
    codexType:   "city",
    getName:     (item) => item.name ?? "Stad",
    getSub:      (item) => item.subtitle ?? "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  criminal: {
    icon:        "fa-skull-crossbones",
    get label()  { return wft("WF.Nav.Criminal"); },
    generate:    generateCriminalOrg,
    render:      (item) => renderCriminalOrgCard(item),
    folder:      "_Random Criminal Orgs",
    getName:     (item) => { const lang = WorldForgeSettings.lang ?? "nl"; const n = item.name; return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "Organisation"; },
    getSub:      (item) => { const lang = WorldForgeSettings.lang ?? "nl"; return lang === "en" ? (item.orgType?.en ?? "") : (item.orgType?.nl ?? ""); },
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  faction: {
    icon:        "fa-chess-rook",
    get label()  { return wft("WF.Nav.Faction"); },
    generate:    generateFaction,
    render:      (item) => renderFactionCard(item, { buttons: false }),
    folder:      "_Random Factions",
    getName:     (item) => { const lang = WorldForgeSettings.lang ?? "nl"; const n = item.name; return (typeof n === "object" ? (n[lang] ?? n.nl) : n) ?? "Faction"; },
    getSub:      (item) => { const lang = WorldForgeSettings.lang ?? "nl"; const s = item.subtitle; return (typeof s === "object" ? (s[lang] ?? s.nl) : s) ?? ""; },
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  poi: {
    icon:        "fa-landmark",
    get label()  { return wft("WF.Nav.POI"); },
    generate:    generatePOI,
    render:      (item) => renderPOICard(item, { buttons: false }),
    folder:      "_Random POIs",
    getName:     (item) => { const lang = WorldForgeSettings.lang ?? "nl"; return (typeof item.name === "object" ? (item.name[lang] ?? item.name.nl) : item.name) ?? "POI"; },
    getSub:      (item) => item.category ?? "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  weather: {
    icon:        "fa-cloud-sun",
    get label() { return wft("WF.Nav.Weather"); },
    generate:    () => generateWeather(false),
    render:      (item) => renderWeatherCard(item, { gmView: true }),
    folder:      "_Random Weather",
    getName:     (item) => `${item.name ?? "Weer"} (${item.isNight ? wft("WF.Label.Night") : wft("WF.Label.Day")})`,
    getSub:      (item) => item.name ?? "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  magicitem: {
    icon:        "fa-hat-wizard",
    get label() { return wft("WF.Nav.MagicItem"); },
    generate:    null, // wordt dynamisch aangeroepen via _generate()
    render:      (item) => renderMagicItemCard(item),
    folder:      "_Random Magic Items",
    getName:     (item) => item.name ?? "Magic Item",
    getSub:      (item) => {
      const labels = { 1: "Gewoon", 2: "Ongewoon", 3: "Zeldzaam", 4: "Zeer Zeldzaam", 5: "Legendarisch" };
      return labels[item.rarity] ?? "";
    },
    hasActor:    false,
    hasComfy:    true,
    comfyW:      512,
    comfyH:      512
  },
  house: {
    icon:        "fa-home",
    get label() { return wft("WF.Nav.House"); },
    generate:    generateHouse,
    render:      (item) => renderHouseCard(item, { buttons: false }),
    folder:      "_Random Houses",
    codexType:   "house",
    getName:     (item) => `${item.family.name} Family`,
    getSub:      (item) => item.house.type ?? "",
    hasActor:    true,
    hasComfy:    true,
    comfyW:      1024,
    comfyH:      768
  },
  pdfexport: {
    icon:        "fa-file-pdf",
    get label() { return wft("WF.Nav.PdfExport"); },
    generate:    null,
    render:      () => "",
    folder:      null,
    getName:     () => "PDF Export",
    getSub:      () => "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  },
  loot_setup: {
    icon:        "fa-table",
    get label() { return "Loot Tables Setup"; },
    generate:    null,
    render:      () => "",
    folder:      null,
    getName:     () => "Setup",
    getSub:      () => "",
    hasActor:    false,
    hasComfy:    false,
    comfyW:      0,
    comfyH:      0
  }
};

// =============================================================================
// WORLDFORGE APPLICATION
// =============================================================================

export class WorldForgeApp extends foundry.applications.api.ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id:      "worldforge-app",
    classes: ["worldforge-ui"],
    tag:     "div",
    window: {
      title:       "WorldForge",
      resizable:    true,
      minimizable:  true
    },
    position: {
      width:  1300,
      height: 800,
      top:    300,
      left:   Math.max(0, Math.floor((window.innerWidth - 1300) / 2))
    }
  };

  constructor(options = {}) {
    super(options);
    this.activeType   = "npc";
    this.currentItem  = null;
    this.isGenerating = false;
    // Loot dropdown state
    this.lootType = "World";
    this.lootTier = 1;
    // Weer dag/nacht state
    this.weatherIsNight = false;
    // Magic item dropdown state
    this._magicItemType    = "random";
    this._magicItemSubtype = "random";
    this._magicItemRarity  = "random";
    this._magicItemDropdownData = null;
    // PDF export geschiedenis — max 5, niet persistent
    this.pdfExports      = []; // [{ name, bytes, filename, timestamp }]
    this.pdfSheetVersion = "2024";
    this.savedItems = new Map(
      Object.keys(TYPE_CONFIG).map(t => [t, []])
    );
  }

  // ---------------------------------------------------------------------------
  // FOUNDRY V13 RENDER API
  // ---------------------------------------------------------------------------

  async _prepareContext(options) {
    return {};
  }

  async _renderHTML(context, options) {
    const fragment = document.createElement("div");
    fragment.innerHTML = await this._buildLayout();
    return fragment;
  }

  _replaceHTML(result, content, options) {
    if (this._eventController) {
      this._eventController.abort();
    }
    this._eventController = new AbortController();
    content.innerHTML = "";
    content.innerHTML = result.innerHTML;
    this._bindEvents(content, this._eventController.signal);
  }

  // ---------------------------------------------------------------------------
  // HTML BUILDERS
  // ---------------------------------------------------------------------------

  async _buildLayout() {
    return `
<div class="wf-app-layout">

  <!-- ── LINKERKOLOM ── -->
  <div class="wf-app-left">
    <div class="wf-app-logo">
      <i class="fas fa-dice-d20"></i>
      <span>WorldForge</span>
    </div>
    <nav class="wf-app-nav">
      ${this._buildNav()}
    </nav>
    <div class="wf-app-generate-wrap">
      <button class="wf-app-generate-btn" id="wf-generate-btn">
        <i class="fas fa-dice"></i>
        ${wft("WF.Btn.Generate")}
      </button>
    </div>
    ${await this._buildComfyStatus()}
  </div>

  <!-- ── MIDDENKOLOM ── -->
  <div class="wf-app-middle">
    <div class="wf-app-middle-header">
      <div class="wf-app-middle-title">
        ${this.currentItem
          ? escapeHtml(TYPE_CONFIG[this.activeType].getName(this.currentItem))
          : this.isGenerating ? wft("WF.Btn.Generating") : wft("WF.UI.ChooseGenerator")}
      </div>
      <div class="wf-app-actions">
        ${this._buildActionButtons()}
      </div>
    </div>
    ${this.activeType === "loot"       ? this._buildLootControls()        : ""}
    ${this.activeType === "weather"    ? this._buildWeatherControls()     : ""}
    ${this.activeType === "magicitem"  ? await this._buildMagicItemControls() : ""}
    ${this.activeType === "loot_setup" ? this._buildLootSetupControls()   : ""}
    <div class="wf-app-middle-content">
      ${this._buildMiddleContent()}
    </div>
  </div>

  <!-- ── RECHTERKOLOM ── -->
  <div class="wf-app-right">
    ${this.activeType !== "pdfexport" ? this._buildCurrentPreview() : ""}
    <div class="wf-app-right-header">
      <i class="fas ${this.activeType === "pdfexport" ? "fa-file-pdf" : "fa-bookmark"}"></i>
      <span>${this.activeType === "pdfexport" ? wft("WF.Saved.Exports") : `${wft("WF.Saved.Title")} · ${this.activeType}`}</span>
    </div>
    <div class="wf-app-saved-list">
      ${this.activeType === "pdfexport" ? this._buildPdfExportList() : this._buildSavedList()}
    </div>
  </div>

</div>`;
  }

  /**
   * Bouwt de ComfyUI status-sectie in de linkerkolom.
   * - Als ComfyUI niet bereikbaar is: een subtiel offline-label
   * - Als ComfyUI bereikbaar is: het actieve model + een dropdown
   *   om snel van checkpoint te wisselen
   */
  async _buildComfyStatus() {
    if (!WorldForgeSettings.comfyAvailable) {
      return `
<div class="wf-comfy-status wf-comfy-offline">
  <i class="fas fa-circle-xmark"></i>
  <span>${wft("WF.UI.ComfyOffline")}</span>
</div>`;
    }

    // Laad beschikbare checkpoints (gecached na eerste aanroep)
    if (!this._comfyCheckpoints) {
      this._comfyCheckpoints = await fetchComfyCheckpoints();
    }
    const checkpoints = this._comfyCheckpoints;
    const current     = WorldForgeSettings.comfyCheckpoint;

    // Als er maar één of geen checkpoints zijn, toon alleen de status
    if (checkpoints.length <= 1) {
      return `
<div class="wf-comfy-status wf-comfy-online">
  <i class="fas fa-circle-check"></i>
  <span title="${escapeHtml(current)}">${escapeHtml(current)}</span>
</div>`;
    }

    // Meerdere checkpoints → toon dropdown
    const options = checkpoints.map(cp => `
  <option value="${escapeAttr(cp)}" ${cp === current ? "selected" : ""}>
    ${escapeHtml(cp)}
  </option>`).join("");

    return `
<div class="wf-comfy-status wf-comfy-online">
  <i class="fas fa-circle-check"></i>
  <select class="wf-comfy-model-select" data-action="comfy-model" title="Actief ComfyUI model">
    ${options}
  </select>
</div>`;
  }

  _buildNav() {
    const isGM = game.user?.isGM ?? false;
    const lang = WorldForgeSettings.lang ?? "nl";

    const categories = [
      {
        id:    "mensen",
        get label() { return wft("WF.Nav.People"); },
        types: ["npc"],
      },
      {
        id:    "plaatsen",
        get label() { return wft("WF.Nav.Places"); },
        types: ["shop", "inn", "tavern", "house", "marketstall", ...(WorldForgeSettings.showShipPC ? ["ship_pc"] : []), "ship_generic"],
      },
      {
        id:    "avontuur",
        get label() { return wft("WF.Nav.Adventure"); },
        types: ["loot", "magicitem", "menu"],
      },
      {
        id:    "wereld",
        get label() { return wft("WF.Nav.World"); },
        types: ["city", "criminal", "faction", "poi", "weather"],
      },
      {
        id:    "tools",
        label: wft("WF.Label.Tools"),
        types: isGM ? ["loot_setup", "pdfexport"] : [],
      },
    ];

    return categories.map(cat => {
      if (!cat.types.length) return "";

      const collapsed = this._collapsedCategories?.has(cat.id) ? "collapsed" : "";

      const buttons = cat.types.map(type => {
        const cfg = TYPE_CONFIG[type];
        if (!cfg || cfg.hidden) return "";
        const count = this.savedItems.get(type)?.length ?? 0;
        return `
<button class="wf-nav-btn ${this.activeType === type ? "wf-active" : ""}"
        data-type="${type}" data-action="nav">
  <i class="fas ${cfg.icon}"></i>
  <span>${cfg.label}</span>
  ${count > 0 ? `<span class="wf-nav-count">${count}</span>` : ""}
</button>`;
      }).join("");

      return `
<div class="wf-nav-category ${collapsed}" data-category="${cat.id}">
  <button class="wf-nav-category-header" data-action="toggle-category" data-category="${cat.id}">
    <span>${cat.label}</span>
    <i class="fas fa-chevron-down wf-nav-category-arrow"></i>
  </button>
  <div class="wf-nav-category-items">
    ${buttons}
  </div>
</div>`;
    }).join("");
  }

  _buildLootControls() {
    return `
<div class="wf-loot-controls">
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Label.LootType")}</label>
    <select class="wf-loot-select" id="wf-loot-type">
      ${[["World","WF.Loot.Type.World"],["Monster","WF.Loot.Type.Monster"],["Boss","WF.Loot.Type.Boss"],["Treasure","WF.Loot.Type.Treasure"]].map(([t,k]) =>
        `<option value="${t}" ${this.lootType === t ? "selected" : ""}>${t}</option>`
      ).join("")}
    </select>
  </div>
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">Tier</label>
    <select class="wf-loot-select" id="wf-loot-tier">
      <option value="1" ${this.lootTier === 1 ? "selected" : ""}>Tier 1 (Lv 1-4)</option>
      <option value="2" ${this.lootTier === 2 ? "selected" : ""}>Tier 2 (Lv 5-10)</option>
      <option value="3" ${this.lootTier === 3 ? "selected" : ""}>Tier 3 (Lv 11-16)</option>
      <option value="4" ${this.lootTier === 4 ? "selected" : ""}>Tier 4 (Lv 17-20)</option>
    </select>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-loot-generate-btn">
    <i class="fas fa-dice"></i> ${wft("WF.Btn.Generate")}
  </button>
</div>`;
  }

  _buildLootSetupControls() {
    return `
<div class="wf-loot-controls" style="padding: 1rem;">
  <div style="color: var(--wf-text-dim, #9e8e6e); font-size: 0.9em; margin-bottom: 1rem;">
    <p>⚙️ Klik de <strong>Setup</strong> knop om automatisch alle 16 Loot-tabellen aan te maken.</p>
    <p style="margin-top: 0.5rem; font-size: 0.85em;">Alle tabellen worden in een "WorldForge Loot" folder geplaatst met placeholder-items.</p>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-loot-setup-btn" style="width: 100%;">
    <i class="fas fa-cog"></i> Setup Loot Tables
  </button>
</div>`;
  }


  async _buildPOIControls() {
    let catOptions  = `<option value="random">${wft("WF.Label.Random")}</option>`;
    let bldOptions  = `<option value="random">${wft("WF.Label.Random")}</option>`;
    try {
      const data = await getPOIDropdownData();
      catOptions = data.categories.map(c =>
        `<option value="${c.id}" ${this._poiCategory === c.id ? "selected" : ""}>${c.label}</option>`
      ).join("");
      // Toon gebouwen voor de geselecteerde categorie
      const cat = this._poiCategory !== "random" ? this._poiCategory : null;
      if (cat && data.buildingsByCategory[cat]) {
        bldOptions = `<option value="random">${wft("WF.Label.Random")}</option>` +
          data.buildingsByCategory[cat].map(b =>
            `<option value="${b.id}" ${this._poiBuilding === b.id ? "selected" : ""}>${b.label}</option>`
          ).join("");
      }
    } catch (err) {
      console.warn("WorldForge | POI controls laden mislukt:", err);
    }
    return `
<div class="wf-loot-controls">
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.POI.Label.Category")}</label>
    <select class="wf-loot-select" id="wf-poi-category">${catOptions}</select>
  </div>
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.POI.Label.Building")}</label>
    <select class="wf-loot-select" id="wf-poi-building">${bldOptions}</select>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-poi-generate-btn">
    <i class="fas fa-landmark"></i> ${wft("WF.Btn.Generate")}
  </button>
</div>`;
  }

  async _buildGenericShipControls() {
    let typeOptions    = `<option value="random">${wft("WF.Label.Random")}</option>`;
    let purposeOptions = `<option value="random">${wft("WF.Label.Random")}</option>`;
    try {
      const data = await getGenericShipDropdownData();
      typeOptions    = data.types.map(t =>
        `<option value="${t.id}" ${this._genericShipType === t.id ? "selected" : ""}>${t.label}</option>`
      ).join("");
      purposeOptions = data.purposes.map(p =>
        `<option value="${p.id}" ${this._genericShipPurpose === p.id ? "selected" : ""}>${p.label}</option>`
      ).join("");
    } catch (err) {
      console.warn("WorldForge | Generic ship controls laden mislukt:", err);
    }
    return `
<div class="wf-loot-controls">
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Label.Type")}</label>
    <select class="wf-loot-select" id="wf-ship-type">${typeOptions}</select>
  </div>
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Ship.Label.Purpose")}</label>
    <select class="wf-loot-select" id="wf-ship-purpose">${purposeOptions}</select>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-ship-generate-btn">
    <i class="fas fa-anchor"></i> ${wft("WF.Btn.Generate")}
  </button>
</div>`;
  }

  // DOM-only update van de factions sectie — herrendert alleen #wf-city-factions
  _updateCityFactions(html) {
    const container = html.querySelector("#wf-city-factions");
    if (!container || !this.currentItem) return;
    const lang = WorldForgeSettings.lang ?? "nl";
    container.innerHTML = renderCityFactions(this.currentItem, lang, (key) => WorldForgeSettings.t(key));
  }

  // DOM-only update van de power factions sectie — herrendert alleen #wf-city-power-factions
  _updateCityPowerFactions(html) {
    const container = html.querySelector("#wf-city-power-factions");
    if (!container || !this.currentItem) return;
    const lang = WorldForgeSettings.lang ?? "nl";
    container.innerHTML = renderCityPowerFactions(this.currentItem, lang, (key) => WorldForgeSettings.t(key));
  }

  // DOM-only update van de POIs sectie — herrendert alleen #wf-city-pois
  _updateCityPOIs(html) {
    const container = html.querySelector("#wf-city-pois");
    if (!container || !this.currentItem) return;
    const lang = WorldForgeSettings.lang ?? "nl";
    container.innerHTML = renderCityPOIs(this.currentItem, lang, (key) => WorldForgeSettings.t(key));
  }

  async _buildCriminalControls() {
    let typeOptions = `<option value="random">${wft("WF.Label.Random")}</option>`;
    try {
      const types = await getCriminalOrgDropdownData();
      typeOptions = types.map(t =>
        `<option value="${t.id}" ${this._criminalType === t.id ? "selected" : ""}>${t.label}</option>`
      ).join("");
    } catch (err) {
      console.warn("WorldForge | Criminal controls laden mislukt:", err);
    }
    return `
<div class="wf-loot-controls">
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Nav.Criminal")}</label>
    <select class="wf-loot-select" id="wf-criminal-type">${typeOptions}</select>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-criminal-generate-btn">
    <i class="fas fa-skull-crossbones"></i> ${wft("WF.Btn.Generate")}
  </button>
</div>`;
  }

  _buildWeatherControls() {
    const folder     = WorldForgeSettings.weatherIconFolder;
    const dayIcon    = `${folder}/Clear.png`;
    const nightIcon  = `${folder}/Clear_Night.png`;
    return `
<div class="wf-loot-controls">
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Label.Moment")}</label>
    <button class="wf-weather-time-btn ${!this.weatherIsNight ? "wf-active" : ""}" id="wf-weather-day"
            style="display:flex;align-items:center;gap:6px;">
      <img src="${dayIcon}" onerror="this.style.display='none';"
           style="width:20px;height:20px;object-fit:contain;"> ${wft("WF.Label.Day")}
    </button>
    <button class="wf-weather-time-btn ${this.weatherIsNight ? "wf-active" : ""}" id="wf-weather-night"
            style="display:flex;align-items:center;gap:6px;">
      <img src="${nightIcon}" onerror="this.style.display='none';"
           style="width:20px;height:20px;object-fit:contain;"> ${wft("WF.Label.Night")}
    </button>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-weather-generate-btn">
    <i class="fas fa-dice"></i> ${wft("WF.Btn.Generate")}
  </button>
</div>`;
  }

  async _buildMagicItemControls() {
    // Laad dropdown data eenmalig
    if (!this._magicItemDropdownData) {
      this._magicItemDropdownData = await getMagicItemDropdownData();
    }
    const data = this._magicItemDropdownData;

    const typeOptions = [
      { id: "random", get label() { return wft("WF.Label.Random"); } },
      ...data.types
    ].map(t =>
      `<option value="${t.id}" ${this._magicItemType === t.id ? "selected" : ""}>${t.label}</option>`
    ).join("");

    const subtypes = this._magicItemType === "random"
      ? [{ id: "random", get label() { return wft("WF.Label.Random"); } }]
      : (data.subtypesByType[this._magicItemType] || [{ id: "random", get label() { return wft("WF.Label.Random"); } }]);

    const subtypeOptions = subtypes.map(s =>
      `<option value="${s.id}" ${this._magicItemSubtype === s.id ? "selected" : ""}>${s.label}</option>`
    ).join("");

    const rarityOptions = data.rarities.map(r =>
      `<option value="${r.id}" ${this._magicItemRarity === r.id ? "selected" : ""}>${r.label}</option>`
    ).join("");

    return `
<div class="wf-loot-controls">
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Label.Type")}</label>
    <select class="wf-loot-select" id="wf-magic-type">${typeOptions}</select>
  </div>
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Label.Subtype")}</label>
    <select class="wf-loot-select" id="wf-magic-subtype">${subtypeOptions}</select>
  </div>
  <div class="wf-loot-control-group">
    <label class="wf-loot-label">${wft("WF.Label.Rarity")}</label>
    <select class="wf-loot-select" id="wf-magic-rarity">${rarityOptions}</select>
  </div>
  <button class="wf-app-generate-btn wf-loot-generate-btn" id="wf-magic-generate-btn">
    <i class="fas fa-dice"></i> ${wft("WF.Btn.Generate")}
  </button>
</div>`;
  }

  _buildActionButtons() {
    if (!this.currentItem) return "";
    const cfg  = TYPE_CONFIG[this.activeType];
    const btns = [];

    // Loot en weer: vereenvoudigde knoppen
    if (this.activeType === "loot" || this.activeType === "weather") {
      btns.push(`<button class="wf-btn wf-btn-primary" data-action="reroll"><i class="fas fa-dice"></i> ${wft("WF.Btn.Reroll")}</button>`);
      btns.push(`<button class="wf-btn" data-action="save-temp"><i class="fas fa-bookmark"></i> ${wft("WF.Btn.Save")}</button>`);
      btns.push(`<button class="wf-btn" data-action="publish"><i class="fas fa-comments"></i> ${wft("WF.Btn.Publish")}</button>`);
      if (this.activeType === "weather") {
        btns.push(`<button class="wf-btn wf-btn-red" data-action="weather-reset"><i class="fas fa-rotate-left"></i> ${wft("WF.Btn.Reset")}</button>`);
      }
      return btns.join("");
    }

    // Magic item knoppen
    if (this.activeType === "magicitem") {
      if (WorldForgeSettings.comfyAvailable) {
        btns.push(`<button class="wf-btn wf-btn-purple" data-action="comfy"><i class="fas fa-palette"></i> ${wft("WF.Btn.ComfyUI")}</button>`);
      }
      btns.push(`<button class="wf-btn wf-btn-primary" data-action="reroll"><i class="fas fa-dice"></i> ${wft("WF.Btn.Reroll")}</button>`);
      btns.push(`<button class="wf-btn" data-action="save-temp"><i class="fas fa-bookmark"></i> ${wft("WF.Btn.Save")}</button>`);
      btns.push(`<button class="wf-btn" data-action="publish"><i class="fas fa-comments"></i> ${wft("WF.Btn.Publish")}</button>`);
      btns.push(`<button class="wf-btn" data-action="journal"><i class="fas fa-book"></i> ${wft("WF.Btn.Journal")}</button>`);
      if (WorldForgeSettings.codexAvailable) {
        btns.push(`<button class="wf-btn wf-btn-green" data-action="codex"><i class="fas fa-atlas"></i> ${wft("WF.Btn.Codex")}</button>`);
      }
      btns.push(`<button class="wf-btn wf-btn-red" data-action="save-item"><i class="fas fa-box"></i> Item</button>`);
      return btns.join("");
    }

    // Standaard knoppen
    if (cfg.hasComfy && WorldForgeSettings.comfyAvailable) {
      btns.push(`<button class="wf-btn wf-btn-purple" data-action="comfy"
          ${this.currentItem.isRendering ? "disabled" : ""}>
        <i class="fas fa-palette"></i> ${wft("WF.Btn.ComfyUI")}
      </button>`);
    }
    btns.push(`<button class="wf-btn wf-btn-primary" data-action="reroll"><i class="fas fa-dice"></i> ${wft("WF.Btn.Reroll")}</button>`);
    btns.push(`<button class="wf-btn" data-action="save-temp"><i class="fas fa-bookmark"></i> ${wft("WF.Btn.Save")}</button>`);
    btns.push(`<button class="wf-btn" data-action="publish"><i class="fas fa-comments"></i> ${wft("WF.Btn.Publish")}</button>`);
    btns.push(`<button class="wf-btn" data-action="journal"><i class="fas fa-book"></i> ${wft("WF.Btn.Journal")}</button>`);
    if (WorldForgeSettings.codexAvailable) {
      btns.push(`<button class="wf-btn wf-btn-green" data-action="codex"><i class="fas fa-atlas"></i> ${wft("WF.Btn.Codex")}</button>`);
    }
    if (cfg.hasActor) {
      btns.push(`<button class="wf-btn wf-btn-red" data-action="actor"><i class="fas fa-masks-theater"></i> ${wft("WF.Btn.Actor")}</button>`);
    }
    return btns.join("");
  }

  _buildMiddleContent() {
    if (this.activeType === "pdfexport") {
      return `
<div class="wf-pdf-sheet-select" style="padding:12px 16px 0;">
  <label class="wf-pdf-app-sheet-label">Character Sheet:</label>
  <select id="wf-pdf-sheet-version" class="wf-pdf-app-sheet-dropdown">
    <option value="2024" ${this.pdfSheetVersion === "2024" ? "selected" : ""}>D&amp;D 2024 (nieuw)</option>
    <option value="2014" ${this.pdfSheetVersion === "2014" ? "selected" : ""}>D&amp;D 5e 2014 (klassiek)</option>
  </select>
</div>
<div class="wf-pdf-dropzone" id="wf-pdf-dropzone">
  <div class="wf-pdf-dropzone-inner">
    <i class="fas fa-file-pdf"></i>
    <p>${wft("WF.UI.DropActor")}</p>
    <p class="wf-pdf-hint">${wft("WF.UI.OrClickToSelect")}</p>
  </div>
</div>
<div id="wf-pdf-status" class="wf-pdf-status" style="display:none;"></div>`;
    }

    if (this.isGenerating) {
      return `<div class="wf-app-loading">
        <i class="fas fa-dice-d20 fa-spin"></i>
        <p>Genereren...</p>
      </div>`;
    }
    if (!this.currentItem) {
      return `<div class="wf-app-empty">
        <i class="fas fa-dice-d20"></i>
        <p>${wft("WF.UI.StartHint")}</p>
      </div>`;
    }
    return TYPE_CONFIG[this.activeType].render(this.currentItem);
  }

  _buildCurrentPreview() {
    if (!this.currentItem) {
      return `
<div class="wf-app-right-preview wf-app-right-preview--empty">
  <i class="fas fa-dice-d20"></i>
  <span>${wft("WF.UI.StartHint")}</span>
</div>`;
    }
    const cfg  = TYPE_CONFIG[this.activeType];
    const lang = WorldForgeSettings.lang ?? "nl";
    const name = escapeHtml(cfg.getName(this.currentItem));
    const sub  = escapeHtml(cfg.getSub(this.currentItem));
    const img  = this.activeType === "npc"
      ? (this.currentItem.imagePath || this.currentItem.image || "")
      : "";
    const itemJson = escapeAttr(JSON.stringify(this.currentItem));

    const codex = WorldForgeSettings.codexAvailable;
    return `
<div class="wf-app-right-preview wf-app-right-preview--item"
     ${codex ? `draggable="true" data-item="${itemJson}" data-type="${this.activeType}"` : ""}
     title="${codex ? (wft("WF.Saved.DragHint") || "Sleep naar Campaign Codex") : ""}">
  ${img ? `<img class="wf-preview-img" src="${escapeAttr(img)}" alt="${name}">` : `<div class="wf-preview-img wf-preview-img--icon"><i class="fas ${cfg.icon}"></i></div>`}
  <div class="wf-preview-info">
    <div class="wf-preview-name">${name}</div>
    <div class="wf-preview-sub">${sub}</div>
  </div>
  ${codex ? `<div class="wf-preview-drag-handle"><i class="fas fa-grip-vertical"></i></div>` : ""}
</div>`;
  }

  _buildSavedList() {
    const items = this.savedItems.get(this.activeType) ?? [];
    if (!items.length) {
      return `<div class="wf-saved-empty">
        <i class="fas fa-inbox"></i>
        <p>${wft("WF.Saved.Empty")}<br>
           ${wft("WF.Saved.ClickAfter")}</p>
      </div>`;
    }
    return [...items].reverse().map((item, revIdx) => {
      const realIdx = items.length - 1 - revIdx;
      const cfg     = TYPE_CONFIG[this.activeType];
      const codex    = WorldForgeSettings.codexAvailable;
      const itemJson = escapeAttr(JSON.stringify(item));
      return `
<div class="wf-saved-card" data-action="load-saved" data-index="${realIdx}"
     ${codex ? `draggable="true" data-item="${itemJson}" data-type="${this.activeType}"` : ""}>
  ${codex ? `<div class="wf-saved-drag-handle"><i class="fas fa-grip-vertical"></i></div>` : ""}
  <div class="wf-saved-info">
    <div class="wf-saved-name">${escapeHtml(cfg.getName(item))}</div>
    <div class="wf-saved-sub">${escapeHtml(cfg.getSub(item))}</div>
  </div>
  <button class="wf-saved-delete" data-action="delete-saved"
          data-index="${realIdx}" title="Verwijder">
    <i class="fas fa-times"></i>
  </button>
</div>`;
    }).join("");
  }

  async _runPdfExport(actor, html) {
    const status = html?.querySelector?.("#wf-pdf-status");
    if (status) {
      status.style.display = "block";
      status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exporteren: ${escapeHtml(actor.name)}…`;
    }
    ui.notifications.info(`${wft("WF.Notify.PdfStarted")} ${actor.name}…`);

    try {
      const exporter  = this.pdfSheetVersion === "2014"
        ? new PdfExporter2014(actor)
        : new PdfExporter(actor);
      const pdfBytes  = await exporter._buildPdfBytes();
      const now       = new Date();
      const dateSuffix = `_${now.getHours().toString().padStart(2,"0")}${now.getMinutes().toString().padStart(2,"0")}${now.getDate().toString().padStart(2,"0")}${(now.getMonth()+1).toString().padStart(2,"0")}${now.getFullYear().toString().slice(-2)}`;
      const filename  = `${actor.name.replace(/[^a-z0-9]/gi, "_")}_character_sheet${dateSuffix}.pdf`;
      const timestamp = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

      // Sla bytes op (geen blob URL — Electron blokkeert die)
      if (this.pdfExports.length >= 5) {
        this.pdfExports.shift();
      }
      this.pdfExports.push({ name: actor.name, bytes: pdfBytes, filename, timestamp });

      if (status) status.style.display = "none";
      ui.notifications.info(`${wft("WF.Notify.PdfReady")}`);
      this.render();
    } catch (err) {
      console.error("WorldForge | PDF export fout:", err);
      if (status) {
        status.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Export mislukt: ${escapeHtml(err.message)}`;
      }
      ui.notifications.error(`PDF export mislukt: ${err.message}`);
    }
  }

  _buildPdfExportList() {
    if (!this.pdfExports.length) {
      return `<div class="wf-saved-empty">
        <i class="fas fa-file-pdf"></i>
        <p>${wft("WF.Saved.NoExports")}</p>
      </div>`;
    }
    return [...this.pdfExports].reverse().map((exp, revIdx) => {
      const realIdx = this.pdfExports.length - 1 - revIdx;
      return `
<div class="wf-saved-card wf-pdf-export-card">
  <div class="wf-saved-info">
    <div class="wf-saved-name">${escapeHtml(exp.name)}</div>
    <div class="wf-saved-sub" style="font-size:0.75em;color:var(--wf-muted,#888);">
      ${exp.timestamp}
    </div>
  </div>
  <button class="wf-btn wf-btn-primary wf-pdf-download"
          data-pdf-index="${realIdx}"
          title="Download PDF"
          style="padding:3px 8px;font-size:0.8em;flex-shrink:0;">
    <i class="fas fa-download"></i>
  </button>
</div>`;
    }).join("");
  }

  // ---------------------------------------------------------------------------
  // EVENT BINDING
  // ---------------------------------------------------------------------------

  _bindEvents(html, signal) {
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      e.stopPropagation();

      switch (action) {
        case "nav":
          this.activeType  = btn.dataset.type;
          this.currentItem = null;
          this.render();
          break;
        case "toggle-category": {
          const catId = btn.dataset.category;
          if (!this._collapsedCategories) this._collapsedCategories = new Set();
          if (this._collapsedCategories.has(catId)) {
            this._collapsedCategories.delete(catId);
          } else {
            this._collapsedCategories.add(catId);
          }
          // Animeer zonder volledige re-render
          const catEl = html.querySelector(`.wf-nav-category[data-category="${catId}"]`);
          if (catEl) catEl.classList.toggle("collapsed");
          break;
        }
        case "generate":
        case "reroll":
          this._generate();
          break;
        case "save-temp":
          this._saveToTemp();
          break;
        case "publish":
          this._publishToChat();
          break;
        case "weather-reset":
          await clearWeatherState();
          this.currentItem = null;
          ui.notifications.info(wft("WF.Notify.WeatherReset"));
          this.render();
          break;
        case "journal":
          this._saveToJournal();
          break;
        case "codex":
          this._saveToCodex();
          break;
        case "actor":
          this._createActor();
          break;
        case "save-item":
          this._saveMagicItem();
          break;
        case "comfy":
          this._runComfyUI();
          break;
        case "load-saved": {
          const idx   = parseInt(btn.dataset.index);
          const saved = this.savedItems.get(this.activeType)?.[idx];
          if (saved) { this.currentItem = saved; this.render(); }
          break;
        }
        case "delete-saved": {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          this._deleteFromTemp(idx);
          break;
        }
      }
    }, { signal });

    // Pre-flight op mousedown: CC journal alvast aanmaken zodat dragstart het UUID klaar heeft
    html.addEventListener("mousedown", (e) => {
      const card = e.target.closest("[draggable='true'][data-item]");
      if (!card || !WorldForgeSettings.codexAvailable) return;

      const type = card.dataset.type;
      let item;
      try { item = JSON.parse(card.dataset.item); } catch { return; }

      const cfg      = TYPE_CONFIG[type];
      if (!cfg) return;
      const itemName = cfg.getName(item);
      const ccType   = cfg.codexType ?? type;

      // Al een CC journal? Sla UUID op en klaar.
      const existing = game.journal?.find(j =>
        j.name === itemName && j.getFlag?.("campaign-codex", "type") === ccType
      );
      if (existing) {
        this._pendingCodexUuid = existing.uuid;
        return;
      }

      // Nog geen CC journal → maak hem aan op de achtergrond via CC integration
      this._pendingCodexUuid = null;
      CC.preflight(type, item, cfg).then(uuid => {
        this._pendingCodexUuid = uuid ?? null;
      }).catch(() => { this._pendingCodexUuid = null; });
    }, { signal });

    // Drag-and-drop van NPC/item kaarten naar Foundry canvas of Campaign Codex
    html.addEventListener("dragstart", (e) => {
      const card = e.target.closest("[draggable='true'][data-item]");
      if (!card) return;

      const type = card.dataset.type;
      let item;
      try { item = JSON.parse(card.dataset.item); } catch { return; }

      const dragData = CC.available
        ? CC.getDragData(type, item, TYPE_CONFIG[type], this._pendingCodexUuid)
        : { type: `worldforge/${type}`, data: item };

      if (CC.available && dragData.type.startsWith("worldforge/")) {
        ui.notifications?.warn(wft("WF.Notify.DragNotReady") || "CC entry nog bezig, probeer opnieuw.");
      }

      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      card.classList.add("wf-dragging");
    }, { signal });

    html.addEventListener("dragend", (e) => {
      e.target.closest("[draggable='true']")?.classList.remove("wf-dragging");
    }, { signal });

    // PDF sheet versie dropdown
    html.addEventListener("change", (e) => {
      const sel = e.target.closest("#wf-pdf-sheet-version");
      if (!sel) return;
      this.pdfSheetVersion = sel.value;
    }, { signal });

    // PDF download knop — via Foundry's saveDataToFile (werkt in Electron)
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-pdf-download");
      if (!btn) return;
      e.stopPropagation();
      const idx = parseInt(btn.dataset.pdfIndex, 10);
      const exp = this.pdfExports[idx];
      if (!exp) return;

      try {
        foundry.utils.saveDataToFile(exp.bytes, "application/pdf", exp.filename);
      } catch (err) {
        console.error("WorldForge | PDF download fout:", err);
        ui.notifications.error(`Download mislukt: ${err.message}`);
      }
    }, { signal });

    // PDF Export dropzone
    const dropzone = html.querySelector("#wf-pdf-dropzone");
    if (dropzone) {
      // Drag over — voorkom default browser gedrag en toon highlight
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        dropzone.classList.add("wf-pdf-dropzone--active");
      }, { signal });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("wf-pdf-dropzone--active");
      }, { signal });

      // Drop van Foundry actor uit de sidebar
      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("wf-pdf-dropzone--active");

        let actorId = null;
        try {
          const raw  = e.dataTransfer.getData("text/plain");
          const data = JSON.parse(raw);
          actorId    = data.uuid
            ? data.uuid.replace("Actor.", "")
            : data.id;
        } catch {
          ui.notifications.warn(wft("WF.UI.DropActorHint"));
          return;
        }

        const actor = game.actors.get(actorId)
          ?? await fromUuid(`Actor.${actorId}`).catch(() => null);

        if (!actor) {
          ui.notifications.warn(wft("WF.UI.ActorNotFound"));
          return;
        }
        if (actor.type !== "character") {
          ui.notifications.warn(wft("WF.Notify.OnlyCharacters"));
          return;
        }

        this._runPdfExport(actor, html);
      }, { signal });

      // Klik op dropzone → open actor-selectie dialog
      dropzone.addEventListener("click", async () => {
        const characters = game.actors.filter(a => a.type === "character");
        if (!characters.length) {
          ui.notifications.warn(wft("WF.Notify.NoCharacters"));
          return;
        }
        // Bouw een simpele selectie dialog
        const options = characters.map(a =>
          `<option value="${a.id}">${escapeHtml(a.name)}</option>`
        ).join("");
        const content = `
          <form>
            <div class="form-group">
              <label>${wft("WF.UI.ChooseChar")}</label>
              <select name="actorId">${options}</select>
            </div>
          </form>`;
        new Dialog({
          title:   wft("WF.PDF.SelectChar"),
          content,
          buttons: {
            export: {
              icon:     `<i class="fas fa-file-pdf"></i>`,
              label:    wft("WF.Btn.Confirm"),
              callback: (html) => {
                const id    = html.find("[name=actorId]").val();
                const actor = game.actors.get(id);
                if (actor) this._runPdfExport(actor, html);
              }
            },
            cancel: { label: wft("WF.Btn.Cancel") }
          }
        }).render(true);
      }, { signal });
    }

    // PDF download knop — anchor, geen extra handler nodig
    // Genereer-knop linkerkolom
    html.querySelector("#wf-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // ComfyUI model dropdown — wijzigt het actieve checkpoint direct in de settings
    html.querySelector(".wf-comfy-model-select")
      ?.addEventListener("change", async (e) => {
        const checkpoint = e.target.value;
        await game.settings.set("world-forge-generator", "comfyCheckpoint", checkpoint);
        ui.notifications.info(`WorldForge | ComfyUI model: ${checkpoint}`);
      }, { signal });

    // Loot dropdowns
    html.querySelector("#wf-loot-type")
      ?.addEventListener("change", (e) => { this.lootType = e.target.value; }, { signal });
    html.querySelector("#wf-loot-tier")
      ?.addEventListener("change", (e) => { this.lootTier = Number(e.target.value); }, { signal });
    html.querySelector("#wf-loot-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // Loot Tables Setup knop
    html.querySelector("#wf-loot-setup-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // Weer knoppen
    html.querySelector("#wf-weather-day")
      ?.addEventListener("click", () => { this.weatherIsNight = false; this.render(); }, { signal });
    html.querySelector("#wf-weather-night")
      ?.addEventListener("click", () => { this.weatherIsNight = true; this.render(); }, { signal });
    html.querySelector("#wf-weather-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // POI dropdowns
    html.querySelector("#wf-poi-category")
      ?.addEventListener("change", (e) => {
        this._poiCategory = e.target.value;
        this._poiBuilding = "random";
        this.render(); // herrender zodat gebouw-dropdown bijwerkt
      }, { signal });
    html.querySelector("#wf-poi-building")
      ?.addEventListener("change", (e) => { this._poiBuilding = e.target.value; }, { signal });
    html.querySelector("#wf-poi-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // Generic ship dropdowns
    html.querySelector("#wf-ship-type")
      ?.addEventListener("change", (e) => { this._genericShipType = e.target.value; }, { signal });
    html.querySelector("#wf-ship-purpose")
      ?.addEventListener("change", (e) => { this._genericShipPurpose = e.target.value; }, { signal });
    html.querySelector("#wf-ship-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // Criminal org dropdowns
    html.querySelector("#wf-criminal-type")
      ?.addEventListener("change", (e) => { this._criminalType = e.target.value; }, { signal });
    html.querySelector("#wf-criminal-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // Magic item dropdowns
    html.querySelector("#wf-magic-type")
      ?.addEventListener("change", (e) => {
        this._magicItemType    = e.target.value;
        this._magicItemSubtype = "random"; // reset subtype bij typewijziging
        this.render();
      }, { signal });
    html.querySelector("#wf-magic-subtype")
      ?.addEventListener("change", (e) => { this._magicItemSubtype = e.target.value; }, { signal });
    html.querySelector("#wf-magic-rarity")
      ?.addEventListener("change", (e) => { this._magicItemRarity = e.target.value; }, { signal });
    html.querySelector("#wf-magic-generate-btn")
      ?.addEventListener("click", () => this._generate(), { signal });

    // Loot item links
    html.addEventListener("click", async (e) => {
      const link = e.target.closest(".wf-loot-item-link");
      if (!link) return;
      e.stopPropagation();
      try {
        const doc = await fromUuid(link.dataset.uuid);
        doc?.sheet?.render(true);
      } catch (err) {
        console.error("WorldForge | Loot item fout:", err);
      }
    }, { signal });

    // Loot publiceren
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-loot-publish");
      if (!btn) return;
      e.stopPropagation();
      await this._publishLoot();
    }, { signal });

    // Klikbare afbeeldingen
    // Klikbare afbeeldingen
    html.querySelectorAll(".wf-wide-image, .wf-side-art, .wf-npc-portrait").forEach(img => {
      img.addEventListener("click", () => {
        const src  = img.dataset.img || img.getAttribute("src");
        const name = img.dataset.name || img.alt || "Afbeelding";
        if (src) new ImagePopout(src, { title: name, shareable: true }).render(true);
      }, { signal });
    });

    // Magic item afbeelding — via delegation want kan img of div zijn
    html.addEventListener("click", (e) => {
      const el = e.target.closest(".wf-art-wrap");
      if (!el) return;
      if (this.activeType !== "magicitem") return;
      const img = el.querySelector("img.wf-magic-img");
      if (!img) return;
      const src  = img.getAttribute("src");
      const name = this.currentItem?.name ?? "Magic Item";
      if (src) new ImagePopout(src, { title: name, shareable: true }).render(true);
    }, { signal });

    // City district → POI genereren en naar chat sturen
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-shop-btn");
      if (!btn) return;
      const poiId = btn.dataset.poiId;
      if (!poiId) return;
      e.stopPropagation();

      const origHtml = btn.innerHTML;
      btn.disabled   = true;
      btn.innerHTML  = `<i class="fas fa-spinner fa-spin"></i> Genereren...`;

      try {
        const poi = await generatePOI({ buildingId: poiId });
        if (poi) {
          const content = renderPOICard(poi, { buttons: false });
          await ChatMessage.create({ content });
        }
      } catch (err) {
        console.error("WorldForge | District POI fout:", err);
        ui.notifications.error(`POI genereren mislukt: ${err.message}`);
      } finally {
        btn.disabled  = false;
        btn.innerHTML = origHtml;
      }
    }, { signal });

    // City district → Shop genereren in apart venster
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-shop-btn");
      if (!btn) return;
      const shopType = btn.dataset.shopType;
      if (!shopType) return;
      e.stopPropagation();

      // Toon loading state op de knop
      const origHtml   = btn.innerHTML;
      btn.disabled     = true;
      btn.innerHTML    = `<i class="fas fa-spinner fa-spin"></i> Genereren...`;

      try {
        const shop = await generateShop({ forceType: shopType });
        await publishShopToChat(shop);
      } catch (err) {
        console.error("WorldForge | District shop fout:", err);
        ui.notifications.error(`${wft("WF.Notify.ShopGenFail")} ${err.message}`);
      } finally {
        btn.disabled  = false;
        btn.innerHTML = origHtml;
      }
    }, { signal });

    // City district → Market Stall genereren en naar chat sturen
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-shop-btn");
      if (!btn) return;
      const stallCategory = btn.dataset.stallCategory;
      if (stallCategory === undefined) return;
      e.stopPropagation();

      const origHtml = btn.innerHTML;
      btn.disabled   = true;
      btn.innerHTML  = `<i class="fas fa-spinner fa-spin"></i> Genereren...`;

      try {
        const stall = await generateMarketStall({ category: stallCategory === "random" ? "random" : stallCategory });
        if (stall) {
          const content = renderMarketStallCard(stall, { buttons: false });
          await ChatMessage.create({ content });
        }
      } catch (err) {
        console.error("WorldForge | District market stall fout:", err);
        ui.notifications.error(`Marktkraam genereren mislukt: ${err.message}`);
      } finally {
        btn.disabled  = false;
        btn.innerHTML = origHtml;
      }
    }, { signal });

    // City district → House genereren en naar chat sturen
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-shop-btn");
      if (!btn) return;
      const houseType = btn.dataset.houseType;
      if (!houseType) return;
      e.stopPropagation();

      const origHtml = btn.innerHTML;
      btn.disabled   = true;
      btn.innerHTML  = `<i class="fas fa-spinner fa-spin"></i> Genereren...`;

      try {
        const house = await generateHouse({ houseType: houseType });
        if (house) {
          const content = renderHouseCard(house, { buttons: false });
          await ChatMessage.create({ content });
        }
      } catch (err) {
        console.error("WorldForge | District house fout:", err);
        ui.notifications.error(`House genereren mislukt: ${err.message}`);
      } finally {
        btn.disabled  = false;
        btn.innerHTML = origHtml;
      }
    }, { signal });

    // City district → Faction genereren en naar chat sturen
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-shop-btn");
      if (!btn) return;
      const factionType = btn.dataset.factionType;
      if (!factionType) return;
      e.stopPropagation();

      const origHtml = btn.innerHTML;
      btn.disabled   = true;
      btn.innerHTML  = `<i class="fas fa-spinner fa-spin"></i> Genereren...`;

      try {
        const faction = await generateFaction({ forceType: factionType });
        if (faction) {
          const content = renderFactionCard(faction, { buttons: false });
          await ChatMessage.create({ content });
        }
      } catch (err) {
        console.error("WorldForge | District faction fout:", err);
        ui.notifications.error(`Factie genereren mislukt: ${err.message}`);
      } finally {
        btn.disabled  = false;
        btn.innerHTML = origHtml;
      }
    }, { signal });

    // City district → verwijder district
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-district-remove");
      if (!btn || this.activeType !== "city" || !this.currentItem) return;
      e.stopPropagation();
      removeDistrict(this.currentItem, btn.dataset.districtId);
      this.render();
    }, { signal });

    // City district → voeg willekeurig district toe
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-district-add");
      if (!btn || this.activeType !== "city" || !this.currentItem) return;
      e.stopPropagation();
      btn.disabled   = true;
      btn.innerHTML  = `<i class="fas fa-spinner fa-spin"></i>`;
      const added    = await addDistrict(this.currentItem);
      if (!added) ui.notifications.warn(wft("WF.Notify.NoMoreDistricts"));
      this.render();
    }, { signal });

    // City attach knop — toggle dropdown
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-attach-btn");
      if (!btn || this.activeType !== "city") return;
      e.stopPropagation();
      const menu = btn.closest(".wf-city-attach-wrap")?.querySelector(".wf-city-attach-menu");
      if (menu) menu.style.display = menu.style.display === "none" ? "block" : "none";
    }, { signal });

    // Sluit attach dropdown bij klik buiten
    html.addEventListener("click", (e) => {
      if (!e.target.closest(".wf-city-attach-wrap")) {
        html.querySelectorAll(".wf-city-attach-menu").forEach(m => m.style.display = "none");
      }
    }, { signal });

    // Attach item — genereer en koppel aan city
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-city-attach-item");
      if (!btn || this.activeType !== "city" || !this.currentItem) return;
      e.stopPropagation();
      const type = btn.dataset.attach;
      if (type === "district") {
        await addDistrict(this.currentItem, html);
      } else if (type === "criminal") {
        const org = await generateCriminalOrg();
        if (!this.currentItem.attachedOrgs) this.currentItem.attachedOrgs = [];
        this.currentItem.attachedOrgs.push(org);
        this._updateCityFactions(html);
      } else if (type === "poi") {
        const poi = await generatePOI();
        if (poi) {
          if (!this.currentItem.attachedPOIs) this.currentItem.attachedPOIs = [];
          this.currentItem.attachedPOIs.push(poi);
        }
        this._updateCityPOIs(html);
      } else if (type === "faction") {
        const faction = await generateFaction();
        if (faction) {
          if (!this.currentItem.attachedFactions) this.currentItem.attachedFactions = [];
          this.currentItem.attachedFactions.push(faction);
        }
        this._updateCityPowerFactions(html);
      }
    }, { signal });

    // Remove gekoppelde org
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-org-remove");
      if (!btn || this.activeType !== "city" || !this.currentItem) return;
      e.stopPropagation();
      const idx = parseInt(btn.dataset.orgIdx);
      if (this.currentItem.attachedOrgs && !isNaN(idx)) {
        this.currentItem.attachedOrgs.splice(idx, 1);
        this._updateCityFactions(html);
      }
    }, { signal });

    // Faction collapse toggle
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-faction-toggle");
      if (!btn) return;
      e.stopPropagation();
      const target = html.querySelector(`#${btn.dataset.target}`);
      if (!target) return;
      const open = target.style.display !== "none";
      target.style.display = open ? "none" : "block";
      const icon = btn.querySelector("i");
      if (icon) icon.className = open ? "fas fa-chevron-down" : "fas fa-chevron-up";
    }, { signal });

    // POI collapse toggle
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-poi-toggle");
      if (!btn) return;
      e.stopPropagation();
      const target = html.querySelector(`#${btn.dataset.target}`);
      if (!target) return;
      const open = target.style.display !== "none";
      target.style.display = open ? "none" : "block";
      const icon = btn.querySelector("i");
      if (icon) icon.className = open ? "fas fa-chevron-down" : "fas fa-chevron-up";
    }, { signal });

    // Remove gekoppeld POI
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-poi-remove");
      if (!btn || this.activeType !== "city" || !this.currentItem) return;
      e.stopPropagation();
      const idx = parseInt(btn.dataset.poiIdx);
      if (this.currentItem.attachedPOIs && !isNaN(idx)) {
        this.currentItem.attachedPOIs.splice(idx, 1);
        this._updateCityPOIs(html);
      }
    }, { signal });

    // Power faction collapse toggle
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-power-faction-toggle");
      if (!btn) return;
      e.stopPropagation();
      const target = html.querySelector(`#${btn.dataset.target}`);
      if (!target) return;
      const open = target.style.display !== "none";
      target.style.display = open ? "none" : "block";
      const icon = btn.querySelector("i");
      if (icon) icon.className = open ? "fas fa-chevron-down" : "fas fa-chevron-up";
    }, { signal });

    // Remove gekoppelde factie
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-power-faction-remove");
      if (!btn || this.activeType !== "city" || !this.currentItem) return;
      e.stopPropagation();
      const idx = parseInt(btn.dataset.factionIdx);
      if (this.currentItem.attachedFactions && !isNaN(idx)) {
        this.currentItem.attachedFactions.splice(idx, 1);
        this._updateCityPowerFactions(html);
      }
    }, { signal });

    // Inn/Tavern collapse toggle
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-city-inn-toggle");
      if (!btn) return;
      e.stopPropagation();
      const target  = html.querySelector(`#${btn.dataset.target}`);
      if (!target) return;
      const open    = target.style.display !== "none";
      target.style.display = open ? "none" : "block";
      const icon    = btn.querySelector("i");
      if (icon) {
        icon.className = open ? "fas fa-chevron-down" : "fas fa-chevron-up";
      }
    }, { signal });

    // Inn/Tavern in city → Publiceer naar chat
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-inn-publish");
      if (!btn) return;
      e.stopPropagation();
      try {
        const { kind, data } = JSON.parse(btn.dataset.inn);
        const content = kind === "inn"
          ? renderInnCard(data,    { buttons: false })
          : renderTavernCard(data, { buttons: false });
        await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients("GM") });
        ui.notifications.info(`${kind === "inn" ? wft("WF.Notify.InnPublished") : wft("WF.Notify.TavernPublished")} ${data.innName ?? data.tavernName}`);
      } catch (err) {
        console.error("WorldForge | Inn publiceer fout:", err);
        ui.notifications.error(`${wft("WF.Notify.PublishFail")} ${err.message}`);
      }
    }, { signal });

    // Inn/Tavern in city → Opslaan als Journal
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-inn-journal");
      if (!btn) return;
      e.stopPropagation();
      try {
        const { kind, data } = JSON.parse(btn.dataset.inn);
        const innName  = data.innName ?? data.tavernName ?? (kind === "inn" ? "Herberg" : "Taverne");
        const folder   = await ensureJournalFolder(kind === "inn" ? "_Random Inns" : "_Random Taverns");
        const content  = kind === "inn"
          ? renderInnCard(data,    { buttons: false })
          : renderTavernCard(data, { buttons: false });
        await JournalEntry.create({
          name:   innName,
          folder: folder.id,
          pages:  [{ name: "Beschrijving", type: "text", text: { format: 1, content } }]
        });
        ui.notifications.info(`${wft("WF.Notify.JournalCreated")} ${innName}`);
      } catch (err) {
        console.error("WorldForge | Inn journal fout:", err);
        ui.notifications.error(`${wft("WF.Notify.JournalFail")} ${err.message}`);
      }
    }, { signal });

    // NPC → Actor
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-npc-to-actor");
      if (!btn) return;
      e.stopPropagation();
      try {
        const npc   = JSON.parse(btn.dataset.npc);
        const actor = await saveNPCToActor(npc);
        ui.notifications.info(`${wft("WF.Notify.ActorCreated")} ${actor.name}`);
        actor.sheet?.render(true);
      } catch (err) {
        console.error("WorldForge | NPC Actor fout:", err);
        ui.notifications.error(`Actor aanmaken mislukt: ${err.message}`);
      }
    }, { signal });

    // NPC → Codex
    html.addEventListener("click", async (e) => {
      const btn = e.target.closest(".wf-npc-to-codex");
      if (!btn) return;
      e.stopPropagation();
      try {
        const npc = JSON.parse(btn.dataset.npc);
        await saveToCodex(
          npc.name, "_Random NPCs",
          renderNPCSimple(npc),
          getValidImagePath(npc),
          "npc"
        );
        ui.notifications.info(`Campaign Codex aangemaakt: ${npc.name}`);
      } catch (err) {
        console.error("WorldForge | NPC Codex fout:", err);
        ui.notifications.error(`Campaign Codex mislukt: ${err.message}`);
      }
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // ACTIES
  // ---------------------------------------------------------------------------

  async _generate() {
    if (this.isGenerating) return;
    this.isGenerating = true;
    this.currentItem  = null;
    this.render();

    try {
      if (this.activeType === "loot") {
        this.currentItem = await generateLoot(this.lootType, this.lootTier);
      } else if (this.activeType === "weather") {
        this.currentItem = await generateWeather(this.weatherIsNight);
      } else if (this.activeType === "magicitem") {
        this.currentItem = await generateMagicItem({
          type:       this._magicItemType,
          subtype:    this._magicItemSubtype,
          targetCost: this._magicItemRarity
        });
      } else if (this.activeType === "loot_setup") {
        await openLootTableSetupDialog();
        this.isGenerating = false;
        return;
      } else {
        const gen = TYPE_CONFIG[this.activeType]?.generate;
        if (gen) this.currentItem = await gen();
      }
    } catch (err) {
      console.error("WorldForge | Generatie fout:", err);
      ui.notifications.error(`Generatie mislukt: ${err.message}`);
    } finally {
      this.isGenerating = false;
      this.render();
    }
  }

  /**
   * Ontvangt een extern gegenereerd item.
   * Ondersteunt zowel receiveItem(type, item) als receiveItem(item).
   */
  receiveItem(typeOrItem, item) {
    if (item !== undefined) {
      this.activeType  = typeOrItem;
      this.currentItem = item;
    } else {
      this.currentItem = typeOrItem;
    }
    this.isGenerating = false;
    this.render();
  }

  _saveToTemp() {
    if (!this.currentItem) return;
    const list = this.savedItems.get(this.activeType);
    list.push(this.currentItem);
    if (list.length > 5) list.shift();
    const name = TYPE_CONFIG[this.activeType].getName(this.currentItem);
    ui.notifications.info(`${name} opgeslagen in tijdelijke lijst`);
    this.render();
  }

  _deleteFromTemp(idx) {
    const list = this.savedItems.get(this.activeType);
    if (idx >= 0 && idx < list.length) {
      const removed = list[idx];
      list.splice(idx, 1);
      if (this.currentItem === removed) this.currentItem = null;
      this.render();
    }
  }

  async _publishToChat() {
    if (!this.currentItem) return;
    if (this.activeType === "loot") {
      await this._publishLoot();
      return;
    }
    if (this.activeType === "weather") {
      const content = renderWeatherCard(this.currentItem, { gmView: false });
      await ChatMessage.create({ content });
      ui.notifications.info("Weer gepubliceerd naar spelers");
      return;
    }
    if (this.activeType === "magicitem") {
      await ChatMessage.create({ content: renderMagicItemPublic(this.currentItem) });
      ui.notifications.info("Magic item gepubliceerd naar spelers");
      return;
    }
    const content = TYPE_CONFIG[this.activeType].render(this.currentItem);
    await ChatMessage.create({ content });
    ui.notifications.info("Gepubliceerd naar spelers");
  }

  async _publishLoot() {
    if (!this.currentItem || this.activeType !== "loot") return;
    const loot    = this.currentItem;
    const content = await renderLootPublic(loot, { claimed: false, claimedBy: null });

    const msg = await ChatMessage.create({
      content,
      flags: {
        world: { wfLoot: { loot, claimed: false, claimedBy: null } }
      }
    });

    const hookId = Hooks.on("renderChatMessage", async (message, html) => {
      if (message.id !== msg.id) return;
      const claimBtn = html[0]?.querySelector(".wf-loot-claim-coins")
                    ?? html.querySelector?.(".wf-loot-claim-coins");
      if (!claimBtn) return;

      claimBtn.addEventListener("click", async () => {
        const flag = message.getFlag("world", "wfLoot");
        if (!flag || flag.claimed) {
          ui.notifications.warn("Deze munten zijn al geclaimd.");
          return;
        }
        const token = canvas.tokens?.controlled[0];
        const actor = token?.actor ?? game.user.character ?? null;
        if (!actor) {
          ui.notifications.warn("Selecteer eerst een token of gebruik een gekoppeld karakter.");
          return;
        }
        const cur = foundry.utils.duplicate(actor.system.currency ?? {});
        cur.cp = Number(cur.cp ?? 0) + Number(flag.loot.coins.cp ?? 0);
        cur.sp = Number(cur.sp ?? 0) + Number(flag.loot.coins.sp ?? 0);
        cur.gp = Number(cur.gp ?? 0) + Number(flag.loot.coins.gp ?? 0);
        await actor.update({
          "system.currency.cp": cur.cp,
          "system.currency.sp": cur.sp,
          "system.currency.gp": cur.gp
        });
        const claimedBy = actor.name ?? game.user.name;
        await message.setFlag("world", "wfLoot", { ...flag, claimed: true, claimedBy });
        const updatedContent = await renderLootPublic(flag.loot, { claimed: true, claimedBy });
        await message.update({ content: updatedContent });
        ui.notifications.info(`Munten toegevoegd aan ${actor.name}: ${flag.loot.formattedCoins}`);
      });
    });

    setTimeout(() => Hooks.off("renderChatMessage", hookId), 30000);
    ui.notifications.info("Loot gepubliceerd naar spelers");
  }

  async _saveToJournal() {
    if (!this.currentItem) return;
    const cfg  = TYPE_CONFIG[this.activeType];
    const name = cfg.getName(this.currentItem);
    try {
      const folder = await ensureJournalFolder(cfg.folder);
      await JournalEntry.create({
        name,
        folder: folder.id,
        img:    this.currentItem.currentImagePath ?? "",
        pages:  [{
          name:  "Beschrijving",
          type:  "text",
          text:  { format: 1, content: cfg.render(this.currentItem) }
        }]
      });
      ui.notifications.info(`Journal aangemaakt: ${name}`);
    } catch (err) {
      console.error("WorldForge | Journal fout:", err);
      ui.notifications.error(`Journal mislukt: ${err.message}`);
    }
  }

  async _saveToCodex() {
    if (!this.currentItem) return;
    const cfg = TYPE_CONFIG[this.activeType];

    // v1.1.0: Nested NPC export voor shops/inns/taverns
    if ((this.activeType === "shop" || this.activeType === "inn" || this.activeType === "tavern") &&
        this.currentItem.npcs?.length > 0) {
      await CC.saveWithNestedNPCs(this.activeType, this.currentItem, cfg, this.currentItem.npcs);
    } else {
      await CC.save(this.activeType, this.currentItem, cfg);
    }
  }

  // Pre-flight: maakt stil een CC journal aan voor drag. Delegeert naar CC.
  async _preflight(type, item, cfg) {
    return CC.preflight(type, item, cfg);
  }

  async _createActor() {
    if (!this.currentItem || this.activeType !== "npc") return;
    try {
      const actor = await saveNPCToActor(this.currentItem);
      ui.notifications.info(`${wft("WF.Notify.ActorCreated")} ${actor.name}`);
      actor.sheet?.render(true);
    } catch (err) {
      console.error("WorldForge | Actor fout:", err);
      ui.notifications.error("Actor aanmaken mislukt");
    }
  }

  async _saveMagicItem() {
    if (!this.currentItem || this.activeType !== "magicitem") return;
    await saveMagicItemToFoundry(this.currentItem);
  }

  async _runComfyUI() {
    if (!this.currentItem || this.currentItem.isRendering) return;
    const item = this.currentItem;
    const cfg  = TYPE_CONFIG[this.activeType];

    // Magic item heeft eigen ComfyUI flow
    if (this.activeType === "magicitem") {
      item.isRendering = true;
      this.render();
      try {
        const saved = await renderMagicItemComfyUI(item);
        if (saved) {
          item.currentImagePath = saved;
          item.image            = saved;
          ui.notifications.info(`Artwork klaar voor ${item.name}`);
        }
      } catch (err) {
        console.error("WorldForge | ComfyUI magic item fout:", err);
        ui.notifications.error(`ComfyUI fout: ${err.message}`);
      } finally {
        item.isRendering = false;
        this.render();
      }
      return;
    }

    // Standaard ComfyUI flow voor andere types
    item.isRendering  = true;
    item.renderStatus = "Render gestart...";
    this.render();

    try {
      const prompt   = item.comfyPrompt   ?? "";
      const negative = item.comfyNegative ?? (
        this.activeType === "npc" ? baseNegativePortrait() : baseNegativeExterior("")
      );
      const prefix = cfg.getName(item).replace(/[^a-zA-Z0-9_]/g, "_").substring(0, 40);

      const result = await runComfyRender({
        prompt, negativePrompt: negative,
        width:          cfg.comfyW,
        height:         cfg.comfyH,
        filenamePrefix: `${this.activeType}_${prefix}`
      });

      if (this.activeType === "npc") {
        const saved = await saveComfyImageToFoundry(result.imageUrl, item.name);
        if (saved) { item.currentImagePath = saved; item.tokenImagePath = saved; }
      } else {
        const saved = await saveComfyImageToFoundry(
          result.imageUrl, cfg.getName(item), WorldForgeSettings.buildingArtFolder
        );
        if (saved) item.currentImagePath = saved;
      }

      item.comfyFileName = result.fileName;
      item.renderStatus  = "Artwork gegenereerd";
      ui.notifications.info(`Artwork klaar voor ${cfg.getName(item)}`);
    } catch (err) {
      console.error("WorldForge | ComfyUI fout:", err);
      item.renderStatus = `Render mislukt: ${err.message}`;
      ui.notifications.error(`ComfyUI fout: ${err.message}`);
    } finally {
      item.isRendering = false;
      this.render();
    }
  }
}