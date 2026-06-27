/**
 * WorldForge – settings.js
 *
 * Registreert alle module-instellingen in het Foundry Settings menu
 * (Module Settings → WorldForge). Hierdoor hoef je geen hardcoded
 * URLs of paden in de generator-code te zetten – alles is vanuit
 * de UI aanpasbaar.
 *
 * Gebruik: WorldForgeSettings.comfyUrl  (getter, leest de waarde op)
 */

export class WorldForgeSettings {

  /**
   * Registreer alle instellingen.
   * Wordt aangeroepen vanuit main.js tijdens de "init" hook.
   */
  static register() {

    const r = (key, cfg) =>
      game.settings.register("world-forge-generator", key, {
        scope:  "world",
        config: true,
        ...cfg
      });

    // ── PRIORITEIT 1: Algemene instellingen ─────────────────────────

    r("generatorLanguage", {
      name:    "WORLDFORGE.Settings.Language.Name",
      hint:    "WORLDFORGE.Settings.Language.Hint",
      type:    String,
      default: "en",
      choices: {
        nl: "WORLDFORGE.Settings.Language.NL",
        en: "WORLDFORGE.Settings.Language.EN"
      }
    });

    // ── PRIORITEIT 2: Campaign Thema ────────────────────────────────

    r("campaignThemePreset", {
      name:    "WORLDFORGE.Settings.CampaignTheme.Name",
      hint:    "WORLDFORGE.Settings.CampaignTheme.Hint",
      type:    String,
      default: "medieval",
      choices: {
        caribbean: "WORLDFORGE.Settings.CampaignTheme.Caribbean",
        medieval:  "WORLDFORGE.Settings.CampaignTheme.Medieval",
        nordic:    "WORLDFORGE.Settings.CampaignTheme.Nordic",
        desert:    "WORLDFORGE.Settings.CampaignTheme.Desert",
        gothic:    "WORLDFORGE.Settings.CampaignTheme.Gothic",
        asian:     "WORLDFORGE.Settings.CampaignTheme.Asian",
        greek:     "WORLDFORGE.Settings.CampaignTheme.Greek",
        custom:    "WORLDFORGE.Settings.CampaignTheme.Custom"
      }
    });

    r("campaignThemeTags", {
      name:     "WORLDFORGE.Settings.CampaignThemeTags.Name",
      hint:     "WORLDFORGE.Settings.CampaignThemeTags.Hint",
      type:     String,
      default:  "medieval fantasy setting, cobblestone streets, stone and timber architecture, rolling hills, overcast sky, torches and lanterns, muddy roads",
      config:   true,
      requiresReload: false
    });

    r("campaignThemeNegative", {
      name:     "WORLDFORGE.Settings.CampaignThemeNegative.Name",
      hint:     "WORLDFORGE.Settings.CampaignThemeNegative.Hint",
      type:     String,
      default:  "",
      config:   true,
      requiresReload: false
    });

    // ── PRIORITEIT 3: Artwork Folders ───────────────────────────────

    r("characterArtFolder", {
      name:    "WORLDFORGE.Settings.CharacterArtFolder.Name",
      hint:    "WORLDFORGE.Settings.CharacterArtFolder.Hint",
      type:    String,
      default: "modules/world-forge-generator/artwork/character-art"
    });

    r("buildingArtFolder", {
      name:    "WORLDFORGE.Settings.BuildingArtFolder.Name",
      hint:    "WORLDFORGE.Settings.BuildingArtFolder.Hint",
      type:    String,
      default: "modules/world-forge-generator/artwork/building-art"
    });

    r("itemArtFolder", {
      name:    "WORLDFORGE.Settings.ItemArtFolder.Name",
      hint:    "WORLDFORGE.Settings.ItemArtFolder.Hint",
      type:    String,
      default: "modules/world-forge-generator/artwork/item-art"
    });

    r("npcImageFolder", {
      name:    "WORLDFORGE.Settings.NpcImageFolder.Name",
      hint:    "WORLDFORGE.Settings.NpcImageFolder.Hint",
      type:    String,
      default: "modules/world-forge-generator/tokens"
    });

    r("defaultNpcIcon", {
      name:    "WORLDFORGE.Settings.DefaultNpcIcon.Name",
      hint:    "WORLDFORGE.Settings.DefaultNpcIcon.Hint",
      type:    String,
      default: "icons/svg/mystery-man.svg"
    });

    r("weatherIconFolder", {
      name:    "WORLDFORGE.Settings.WeatherIconFolder.Name",
      hint:    "WORLDFORGE.Settings.WeatherIconFolder.Hint",
      type:    String,
      default: "modules/world-forge-generator/artwork/weather-icons"
    });

    r("weatherJsonPath", {
      name:    "WORLDFORGE.Settings.WeatherJsonPath.Name",
      hint:    "WORLDFORGE.Settings.WeatherJsonPath.Hint",
      type:    String,
      default: "modules/world-forge-generator/assets/weather/random_weather_adjacency_cloudy.json"
    });

    r("showShipPC", {
      name:    "WORLDFORGE.Settings.ShowShipPC.Name",
      hint:    "WORLDFORGE.Settings.ShowShipPC.Hint",
      type:    Boolean,
      default: true,
      scope:   "world"
    });

    // ── PRIORITEIT 4: ComfyUI (Geavanceerd) ─────────────────────────

    r("comfyUiUrl", {
      name:    "WORLDFORGE.Settings.ComfyUiUrl.Name",
      hint:    "WORLDFORGE.Settings.ComfyUiUrl.Hint",
      type:    String,
      default: "http://127.0.0.1:8188"
    });

    r("comfyCheckpoint", {
      name:    "WORLDFORGE.Settings.ComfyCheckpoint.Name",
      hint:    "WORLDFORGE.Settings.ComfyCheckpoint.Hint",
      type:    String,
      default: "dreamshaper_8.safetensors"
    });

    r("comfyTimeoutMs", {
      name:    "WORLDFORGE.Settings.ComfyTimeoutMs.Name",
      hint:    "WORLDFORGE.Settings.ComfyTimeoutMs.Hint",
      type:    Number,
      default: 180000
    });

    r("comfyPollMs", {
      name:    "WORLDFORGE.Settings.ComfyPollMs.Name",
      hint:    "WORLDFORGE.Settings.ComfyPollMs.Hint",
      type:    Number,
      default: 1500
    });

    // ── INTERN (Niet zichtbaar in settings UI) ──────────────────────

    r("currentWeatherState", {
      name:    "Huidig Weer (intern)",
      hint:    "Intern gebruikt door de weer generator. Niet handmatig aanpassen.",
      scope:   "world",
      config:  false,
      type:    String,
      default: ""
    });
  }

  // ── Getters ─────────────────────────────────────────────────────

  static get(key) {
    return game.settings.get("world-forge-generator", key);
  }

  /**
   * Vertaalfunctie die WorldForgeSettings.lang gebruikt in plaats van
   * de Foundry UI taal. Leest uit de module-specifieke translations
   * of valt terug op game.i18n.
   *
   * Gebruik: WorldForgeSettings.t("WF.Nav.NPC")
   * of importeer als: const wft = (k) => WorldForgeSettings.t(k);
   */
  static t(key) {
    try {
      const lang = this.get("generatorLanguage") ?? "nl";
      const mod = game.modules.get("world-forge-generator");
      const translations = mod?._translations?.[lang];

      if (translations && key in translations) {
        return translations[key];
      }

      // Fallback: gebruik game.i18n.localize (bevat ook module translations)
      return game.i18n.localize(key);
    } catch (err) {
      console.warn("WorldForgeSettings.t() error:", err);
      return key;
    }
  }

  static get npcImageFolder()        { return this.get("npcImageFolder"); }
  static get defaultNpcIcon()        { return this.get("defaultNpcIcon"); }
  static get charArtFolder()         { return this.get("characterArtFolder"); }
  static get buildingArtFolder()     { return this.get("buildingArtFolder"); }
  static get itemArtFolder()         { return this.get("itemArtFolder"); }
  static get weatherIconFolder()     { return this.get("weatherIconFolder"); }
  static get weatherJsonPath()       { return this.get("weatherJsonPath"); }
  static get comfyUrl()              { return this.get("comfyUiUrl"); }
  static get comfyCheckpoint()       { return this.get("comfyCheckpoint"); }
  static get comfyTimeoutMs()        { return this.get("comfyTimeoutMs"); }
  static get comfyPollMs()           { return this.get("comfyPollMs"); }

  // Runtime vlaggen — worden gezet door main.js bij startup.
  // Niet opgeslagen in Foundry settings, alleen in geheugen.
  static comfyAvailable = false;
  static codexAvailable = false;
  static get lang()                  { return this.get("generatorLanguage"); }
  static get showShipPC()            { return this.get("showShipPC") !== false; }
  static get campaignThemePreset()   { return this.get("campaignThemePreset"); }
  static get campaignThemeTags()     { return this.get("campaignThemeTags"); }
  static get campaignThemeNegative() { return this.get("campaignThemeNegative"); }

  static getPresetTags(preset) {
    const presets = {
      caribbean: "17th century Caribbean, tropical port settlement, warm tropical climate, colonial Caribbean architecture, palm trees, sunlit tropical atmosphere",
      medieval:  "medieval fantasy setting, cobblestone streets, stone and timber architecture, rolling hills, overcast sky, torches and lanterns, muddy roads",
      nordic:    "nordic viking setting, longhouse architecture, snow-covered landscape, pine forests, fjords, grey overcast sky, runic carvings, wooden palisades",
      desert:    "arabian desert fantasy setting, sandstone architecture, sand dunes, palm oases, bazaar atmosphere, warm golden sunlight, ornate arches and domes",
      gothic:    "dark gothic fantasy setting, crumbling stone architecture, perpetual fog, gargoyles, iron gates, candlelight, overgrown ivy, grim atmosphere",
      asian:     "far east fantasy setting, pagoda architecture, cherry blossom trees, bamboo groves, misty mountains, paper lanterns, curved tiled rooftops",
      greek:     "ancient greek setting, white marble architecture, ionic and doric columns, mediterranean coastline, olive trees, bright sunlight, terracotta rooftiles, agora marketplace, acropolis on a hill",
      custom:    ""
    };
    return presets[preset] ?? "";
  }
}