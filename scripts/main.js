/**
 * WorldForge – main.js
 *
 * Hoofdbestand van de module. Laadt instellingen, stelt de publieke API
 * in en injecteert de toolbar-knop die de WorldForge UI opent.
 */

import { WorldForgeSettings } from "./settings.js";
import { WorldForgeApp }      from "./worldforge-app.js";
import { PdfExportApp }       from "./pdf-export-app.js";
import { pingComfyUI }        from "./comfyui.js";
import { DataLoader }         from "./data-loader.js";

// =============================================================================
// HOOK: init – instellingen registreren
// =============================================================================

Hooks.once("init", async () => {
  console.log("WorldForge | Instellingen registreren...");

  // Laad taalbestanden VOORDAT settings worden geregistreerd
  // zodat t() functie al beschikbare translations heeft
  const MODULE_ID = "world-forge-generator";
  try {
    const [nl, en] = await Promise.all([
      fetch(`modules/${MODULE_ID}/lang/nl.json`).then(r => r.json()),
      fetch(`modules/${MODULE_ID}/lang/en.json`).then(r => r.json()),
    ]);
    const mod = game.modules.get(MODULE_ID);
    if (mod) {
      mod._translations = { nl, en };
      console.log("WorldForge | Taalbestanden geladen (nl + en)");
    }
  } catch (err) {
    console.warn("WorldForge | Taalbestanden laden mislukt bij init:", err);
  }

  WorldForgeSettings.register();
  console.log("WorldForge | Instellingen geregistreerd.");
});

// =============================================================================
// HOOK: renderSettingsConfig – preset dropdown vult tags automatisch
// =============================================================================

Hooks.on("renderSettingsConfig", (app, html) => {
  // Foundry v13 geeft html als HTMLElement, oudere versies als jQuery object
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  const presetSelect = root.querySelector(`[name="world-forge-generator.campaignThemePreset"]`);
  const tagsInput    = root.querySelector(`[name="world-forge-generator.campaignThemeTags"]`);
  const negInput     = root.querySelector(`[name="world-forge-generator.campaignThemeNegative"]`);

  // Zet de tekstvelden om naar textareas voor betere leesbaarheid
  [tagsInput, negInput].forEach(input => {
    if (!input || input.tagName === "TEXTAREA") return;
    const ta = document.createElement("textarea");
    ta.name        = input.name;
    ta.value       = input.value;
    ta.rows        = 3;
    ta.style.width = "100%";
    ta.style.resize = "vertical";
    input.replaceWith(ta);
  });

  // Haal verwijzingen opnieuw op na mogelijke vervanging
  const tagsField = root.querySelector(`[name="world-forge-generator.campaignThemeTags"]`);

  if (!presetSelect || !tagsField) return;

  presetSelect.addEventListener("change", () => {
    const preset = presetSelect.value;
    if (preset === "custom") return;
    tagsField.value = WorldForgeSettings.getPresetTags(preset);
  });
});

// =============================================================================
// HOOK: changeSetting – Herrender settings UI bij WorldForge taalwisseling
// =============================================================================

Hooks.on("changeSetting", (setting) => {
  // Theme change: invalidate DataLoader cache so cities/buildings/trade-goods use new theme
  if (setting.key === "world-forge-generator.campaignThemePreset" ||
      setting.key === "world-forge-generator.campaignThemeTags") {
    DataLoader.invalidate();
    ui.notifications.info("WorldForge cache cleared (theme changed)");
  }

  // Language change: update Foundry's i18n + herrender settings window
  if (setting.key === "world-forge-generator.generatorLanguage") {
    const lang = setting.value; // "nl" of "en"
    const mod = game.modules.get("world-forge-generator");

    // Update Foundry's i18n met de juiste taalbestanden
    if (mod?._translations?.[lang] && game.i18n.translations) {
      Object.assign(game.i18n.translations, mod._translations[lang]);
    }

    // Herrender het settings window zodat alle labels in de nieuwe taal verschijnen
    const settingsWindow = Object.values(ui.windows).find(w =>
      w.constructor.name === "SettingsConfig"
    );
    if (settingsWindow?.rendered) {
      settingsWindow.render(false);
    }
  }
});

// =============================================================================
// HOOK: ready – publieke API instellen
// =============================================================================

Hooks.once("ready", () => {
  const MODULE_ID = "world-forge-generator";
  const mod = game.modules.get(MODULE_ID);

  // Zorg ervoor dat Foundry's i18n ook de translations heeft (voor settings labels)
  // Standaard Engels voor nieuwe gebruikers
  if (mod?._translations?.en && game.i18n.translations) {
    Object.assign(game.i18n.translations, mod._translations.en);
  }

  // Asset folders: gebruikers maken deze manueel aan of ComfyUI doet het automatisch
  // _createAssetFolders().catch(err => {
  //   console.warn("WorldForge | Asset folders aanmaken mislukt:", err);
  // });

  // DEBUG MODE — zet op false wanneer prompts correct zijn
  window.DEBUG_MODE = true;

  console.log("WorldForge | Module geladen.");

  // Controleer of Campaign Codex actief is
  WorldForgeSettings.codexAvailable = !!(game.modules.get("campaign-codex")?.active);
  console.log(`WorldForge | Campaign Codex: ${WorldForgeSettings.codexAvailable ? "actief" : "niet gevonden — Codex-knoppen worden verborgen."}`);

  // Ping ComfyUI op de achtergrond — zet de vlag zonder de UI te blokkeren
  pingComfyUI().then(available => {
    WorldForgeSettings.comfyAvailable = available;
    if (available) {
      console.log("WorldForge | ComfyUI bereikbaar op", WorldForgeSettings.comfyUrl);
    } else {
      console.log("WorldForge | ComfyUI niet bereikbaar — ComfyUI knoppen worden verborgen.");
    }
    // Herrender de app als die al open is zodat de knoppen direct bijwerken
    if (window._worldForgeApp?.rendered) {
      window._worldForgeApp.render(false);
    }
  });

  // Maak de app-instantie aan en sla die op als globale referentie.
  // window._worldForgeApp wordt gebruikt door de generateAndShow* wrappers
  // in de generators zodat ze items naar de UI kunnen sturen.
  window._worldForgeApp = new WorldForgeApp();

  // Publieke API – voor gebruik vanuit macros of de console
  game.worldforge = {
    /** Open of focus de WorldForge UI */
    open: () => {
      if (!window._worldForgeApp.rendered) {
        window._worldForgeApp.render(true);
      } else {
        window._worldForgeApp.bringToTop();
      }
    },
    /** Sluit de WorldForge UI */
    close: () => window._worldForgeApp.close(),
    /** Directe toegang tot de app instantie */
    app:  window._worldForgeApp,
    /** Versie */
    version: game.modules.get("world-forge-generator")?.version ?? "unknown"
  };

  // GM: WorldForge D20 knop
  if (game.user?.isGM) {
    document.getElementById("wf-toolbar-btn")?.closest("li")?.remove();
    _injectWFButton();
  }

  // Alle gebruikers (ook spelers): PDF Export knop
  window._wfPdfApp = new PdfExportApp();
  document.getElementById("wf-pdf-toolbar-btn")?.closest("li")?.remove();
  _injectPdfButton();
});

// =============================================================================
// GM TOOLBAR KNOP — volledige WorldForge UI
// =============================================================================

/**
 * Voegt de WorldForge knop toe aan #scene-controls-layers.
 * Klikken opent de WorldForge UI (of brengt hem naar de voorgrond als
 * hij al open is).
 */
function _injectWFButton() {
  const menu = document.getElementById("scene-controls-layers");
  if (!menu) {
    setTimeout(_injectWFButton, 1000);
    return;
  }

  const li  = document.createElement("li");
  const btn = document.createElement("button");
  btn.id        = "wf-toolbar-btn";
  btn.type      = "button";
  btn.className = "control ui-control layer icon fa-solid fa-dice-d20";
  btn.setAttribute("data-tooltip", "WorldForge");
  btn.setAttribute("aria-label",   "WorldForge");
  btn.setAttribute("aria-pressed", "false");

  btn.addEventListener("click", () => {
    game.worldforge.open();
    btn.setAttribute("aria-pressed",
      window._worldForgeApp.rendered ? "true" : "false");
  });

  li.appendChild(btn);
  menu.appendChild(li);
  console.log("WorldForge | Toolbar knop toegevoegd.");
}

// =============================================================================
// SPELER TOOLBAR KNOP — PDF Export popup
// =============================================================================

/**
 * Voegt een PDF Export knop toe voor alle gebruikers (inclusief spelers).
 * Opent een simpele popup met dropzone en downloadlijst.
 */
function _injectPdfButton() {
  const menu = document.getElementById("scene-controls-layers");
  if (!menu) {
    setTimeout(_injectPdfButton, 1000);
    return;
  }

  const li  = document.createElement("li");
  const btn = document.createElement("button");
  btn.id        = "wf-pdf-toolbar-btn";
  btn.type      = "button";
  btn.className = "control ui-control layer icon fa-solid fa-file-pdf";
  btn.setAttribute("data-tooltip", "PDF Export");
  btn.setAttribute("aria-label",   "PDF Export");
  btn.setAttribute("aria-pressed", "false");

  btn.addEventListener("click", () => {
    if (!window._wfPdfApp.rendered) {
      window._wfPdfApp.render(true);
    } else {
      window._wfPdfApp.bringToTop();
    }
    btn.setAttribute("aria-pressed",
      window._wfPdfApp.rendered ? "true" : "false");
  });

  li.appendChild(btn);
  menu.appendChild(li);
  console.log("WorldForge | PDF toolbar knop toegevoegd.");
}

// =============================================================================
// ASSET FOLDER SETUP — Automatisch ComfyUI folders aanmaken
// =============================================================================

/**
 * Maak ComfyUI asset folders aan als ze niet bestaan.
 * Folders: WorldForge/Buildings, WorldForge/CharacterArt, WorldForge/Items
 */
async function _createAssetFolders() {
  const folderNames = ["Buildings", "CharacterArt", "Items"];

  // Zoek naar bestaande WorldForge folder
  let worldForgeFolder = game.folders.getName("WorldForge");

  // Maak WorldForge folder aan als die niet bestaat
  if (!worldForgeFolder) {
    try {
      worldForgeFolder = await Folder.create({
        name: "WorldForge",
        parent: null,
      });
      console.log("WorldForge | Asset folder 'WorldForge' aangemaakt.");
    } catch (err) {
      console.warn("WorldForge | Kon WorldForge folder niet aanmaken:", err);
      return;
    }
  }

  // Maak subfolders aan
  for (const folderName of folderNames) {
    const exists = game.folders.contents.some(
      f => f.name === folderName && f.parent?.id === worldForgeFolder.id
    );

    if (!exists) {
      try {
        await Folder.create({
          name: folderName,
          parent: worldForgeFolder.id,
        });
        console.log(`WorldForge | Asset subfolder '${folderName}' aangemaakt.`);
      } catch (err) {
        console.warn(`WorldForge | Kon folder '${folderName}' niet aanmaken:`, err);
      }
    }
  }

  console.log("WorldForge | Asset folders setup compleet.");
}
