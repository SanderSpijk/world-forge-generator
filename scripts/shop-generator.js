/**
 * WorldForge – shop-generator.js
 *
 * Genereert een willekeurige shop. Gebouwbeschrijving komt uit
 * buildings.json / buildings-{preset}.json via building-data.js
 * in plaats van Foundry Rollable Tables.
 *
 * Exporteert:
 *  - generateAndShowShop()  – hoofdfunctie
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";
import { generateNPC } from "./npc-generator.js";
import { runComfyRender, baseNegativeExterior } from "./comfyui.js";
import {
  clean, escapeHtml, escapeAttr, formatForFile, uniqueParts,
  openImagePopout, ensureJournalFolder, saveToCodex,
  wfSectionHeader, wfReadout, wfInfoRow, wfBadge, wfNpcItem
} from "./utils.js";
const wft = (key) => WorldForgeSettings.t(key);


// =============================================================================
// NAAM HELPERS
// =============================================================================

/** Verwijder "The " van het begin van een suffix (bijv. "The Emporium" → "Emporium") */
function removeLeadingThe(text) {
  return String(text ?? "").replace(/^The\s+/i, "").trim();
}

/**
 * Geeft de bezittelijke vorm van een naam terug.
 * "James" → "James'", "Anna" → "Anna's"
 */
function getPossessiveName(name) {
  const n = clean(name);
  if (!n) return "Owner's";
  return n.toLowerCase().endsWith("s") ? `${n}'` : `${n}'s`;
}

/**
 * Bouwt de shopnaam op basis van prefix, suffix en eigenaarsnaam.
 *  - 30%: bezittelijk (bijv. "Anna's Emporium")
 *  - 55%: prefix + suffix (bijv. "The Golden Emporium")
 *  - 15%: alleen "The " + suffix (bijv. "The Emporium")
 */
function buildShopName(prefix, suffix, ownerName) {
  const p         = clean(prefix);
  const s         = removeLeadingThe(clean(suffix));
  const firstName = clean(String(ownerName ?? "").split(" ")[0]);
  const roll      = Math.random();

  if (roll < 0.30 && firstName) return `${getPossessiveName(firstName)} ${s}`.trim();
  if (roll < 0.85) return `${p} ${s}`.trim();
  return `The ${s}`.trim();
}

// =============================================================================
// COMFYUI PROMPT
// =============================================================================

/**
 * Bouwt de ComfyUI prompt voor een shop-exterieur.
 */
function buildShopComfyPrompt(shop) {
  const themeTags = WorldForgeSettings.campaignThemeTags
    .split(",").map(t => t.trim()).filter(Boolean);

  return uniqueParts([
    "wide cinematic fantasy shop exterior",
    "environment concept art",
    "high fantasy building illustration",
    "establishing shot",
    "front three-quarter view",
    ...themeTags,
    "detailed architecture",
    "weathered materials",
    "daylight", "soft dramatic lighting", "sharp focus",
    clean(shop.shopType),
    clean(shop.building.en),
    `building material clearly visible: ${clean(shop.building.en)}`,
    clean(shop.roof.en),
    clean(shop.height.en),
    clean(shop.detail.en),
    clean(shop.drukte.en),
    "shop exterior", "exterior only",
    "only the building and its surroundings",
    "no interior visible", "no people", "no characters",
    "no signage text", "no watermark"
  ]).join(", ");
}

// =============================================================================
// HTML RENDER – CHAT KAART
// =============================================================================

/**
 * Rendert de shop-kaart in Campaign Codex-stijl.
 */
export function renderShopCard(shop, { buttons = true } = {}) {
  const lang = WorldForgeSettings.lang ?? "nl";
  const imgBlock = shop.currentImagePath ? `
    <div class="wf-art-wrap">
      <img class="wf-side-art wf-shop-art"
           data-img="${escapeAttr(shop.currentImagePath)}"
           data-name="${escapeAttr(shop.shopName)}"
           src="${escapeAttr(shop.currentImagePath)}"
           onerror="this.closest('.wf-art-wrap').remove();"
           title="Klik om te vergroten">
    </div>` : "";

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header" style="min-height:70px;">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${escapeHtml(shop.shopName)}</p>
      <p class="wf-subtitle">${escapeHtml(shop.shopType)}</p>
      <div class="wf-meta-row">
        ${wfBadge(shop.category)}
      </div>
    </div>
    ${imgBlock}
  </div>

  <!-- ── BESCHRIJVING ── -->
  ${wfSectionHeader("📖", wft("WF.Shop.Section.Description"))}
  <div class="wf-body">
    ${wfReadout(shop.description)}
  </div>

  <!-- ── EIGENAAR ── -->
  ${wfSectionHeader("👤", wft("WF.Shop.Section.Owner"))}
  <div class="wf-body">
    ${wfNpcItem(shop.owner)}
  </div>

  <!-- ── BIJZONDERHEDEN ── -->
  ${wfSectionHeader("✦", wft("WF.Shop.Section.Quirks"))}
  <div class="wf-body">
    <div class="wf-quirk">
      <span class="wf-quirk-label">${wft("WF.Shop.Label.Flavor")}</span>
      ${escapeHtml(lang === "en" ? (shop.flavorQuirk.en ?? shop.flavorQuirk.nl) : shop.flavorQuirk.nl)}
    </div>
    <div class="wf-quirk">
      <span class="wf-quirk-label">${wft("WF.Shop.Label.Gameplay")}</span>
      ${escapeHtml(lang === "en" ? (shop.gameplayQuirk.en ?? shop.gameplayQuirk.nl) : shop.gameplayQuirk.nl)}
    </div>
  </div>

  <!-- Render-statusbalk -->
  <div class="wf-status">
    <strong>${wft("WF.Status.Artwork")}</strong> ${escapeHtml(shop.renderStatus)}
    ${shop.comfyFileName ? ` &nbsp;·&nbsp; <strong>Bestand:</strong> ${escapeHtml(shop.comfyFileName)}` : ""}
  </div>

  <!-- ── ACTIEKNOPPEN ── -->
  ${buttons ? `
  <div class="wf-actions">
    <button class="wf-btn wf-btn-purple wf-send-comfy" ${shop.isRendering ? "disabled" : ""}>🎨 ComfyUI</button>
    <button class="wf-btn wf-btn-primary wf-publish-shop">${wft("WF.Btn.Publish")}</button>
    <button class="wf-btn wf-save-shop">${wft("WF.Btn.Save")}</button>
    <button class="wf-btn wf-btn-green wf-save-codex">${wft("WF.Btn.Codex")}</button>
  </div>` : ""}

</div>`;
}

// =============================================================================
// HTML RENDER – JOURNAL / CAMPAIGN CODEX
// =============================================================================

function renderShopJournal(shop) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return `
<h1>${escapeHtml(shop.shopName)}</h1>
${shop.currentImagePath ? `<p><img src="${escapeAttr(shop.currentImagePath)}" style="max-width:100%;height:auto;"></p>` : ""}
<p><strong>${wft("WF.Ship.Spec.Type")}:</strong> ${escapeHtml(shop.shopType)} &nbsp;·&nbsp; <strong>Category:</strong> ${escapeHtml(shop.category)}</p>
<blockquote><p><em>${escapeHtml(shop.description)}</em></p></blockquote>
<h2>${wft("WF.Shop.Section.Owner")}</h2>
<p><strong>${escapeHtml(shop.owner.name)}</strong> – ${escapeHtml(lang === "en" ? (shop.owner.race.en ?? shop.owner.race.nl) : shop.owner.race.nl)} (${escapeHtml(shop.owner.age)})<br>
<em>${escapeHtml(lang === "en" ? (shop.owner.cinematicEn ?? shop.owner.cinematic) : shop.owner.cinematic)}</em></p>
<h2>${wft("WF.Shop.Section.Quirks")}</h2>
<p><strong>${wft("WF.Shop.Label.Flavor")}:</strong> ${escapeHtml(lang === "en" ? (shop.flavorQuirk.en ?? shop.flavorQuirk.nl) : shop.flavorQuirk.nl)}</p>
<p><strong>${wft("WF.Shop.Label.Gameplay")}:</strong> ${escapeHtml(lang === "en" ? (shop.gameplayQuirk.en ?? shop.gameplayQuirk.nl) : shop.gameplayQuirk.nl)}</p>`;
}

function renderShopCodex(shop) {
  const lang = WorldForgeSettings.lang ?? "nl";
  return `
<h1>${escapeHtml(shop.shopName)}</h1>
<p>${escapeHtml(shop.shopType)} · ${escapeHtml(shop.category)}</p>
<hr>
<h1>${wft("WF.Shop.Section.Description")}</h1>
<blockquote><p><em>${escapeHtml(shop.description)}</em></p></blockquote>
<h1>${wft("WF.Shop.Section.Owner")}</h1>
<p><strong>${escapeHtml(shop.owner.name)}</strong> – ${escapeHtml(lang === "en" ? (shop.owner.race.en ?? shop.owner.race.nl) : shop.owner.race.nl)} (${escapeHtml(shop.owner.age)})</p>
<p><em>${escapeHtml(lang === "en" ? (shop.owner.cinematicEn ?? shop.owner.cinematic) : shop.owner.cinematic)}</em></p>
<section class="secret">
  <h1>${wft("WF.Shop.Label.Flavor")}</h1><p>${escapeHtml(lang === "en" ? (shop.flavorQuirk.en ?? shop.flavorQuirk.nl) : shop.flavorQuirk.nl)}</p>
  <h1>${wft("WF.Shop.Label.Gameplay")}</h1><p>${escapeHtml(lang === "en" ? (shop.gameplayQuirk.en ?? shop.gameplayQuirk.nl) : shop.gameplayQuirk.nl)}</p>
</section>`;
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

/**
 * Genereert een willekeurige shop.
 *
 * Gebouwbeschrijving via building-data.js (JSON):
 *  - gebouw, dak, hoogte, detail_shop, drukte
 *
 * Rollable Tables worden nog gebruikt voor:
 *  - Shop-type, namen, quirks, menukaart
 */
export async function generateShop({ forceType = null } = {}) {
  // ── Shop type en naam ─────────────────────────────────────────────────────

  let shopType;
  if (forceType) {
    const types = await DataLoader.load("shops.json", "types");
    const found = types.find(t => t.name.toLowerCase() === forceType.toLowerCase());
    shopType    = found ?? { name: forceType, nameCategory: "Trade" };
  } else {
    const types = await DataLoader.load("shops.json", "types");
    shopType    = types[Math.floor(Math.random() * types.length)] ?? { name: "General Store", nameCategory: "Trade" };
  }

  const prefixes = await DataLoader.load("shops.json", "prefixes");
  const prefix   = prefixes[Math.floor(Math.random() * prefixes.length)] ?? "The";

  const data     = await DataLoader.load("shops.json");
  const suffixes = data.nameSuffixes?.[shopType.nameCategory] ?? data.nameSuffixes?.["Trade"] ?? [];
  const suffix   = suffixes[Math.floor(Math.random() * suffixes.length)] ?? "Emporium";

  const owner    = await generateNPC();
  owner.job      = { nl: "Eigenaar", en: "Owner" };
  const shopName = buildShopName(prefix, suffix, owner.name);

  // ── Quirks ────────────────────────────────────────────────────────────────

  const data_quirks = await DataLoader.load("shops.json");
  const flavorQuirk   = (data_quirks.quirks?.flavor ?? [])[Math.floor(Math.random() * (data_quirks.quirks?.flavor ?? []).length)] ?? { nl: "", en: "" };
  const gameplayQuirk = (data_quirks.quirks?.gameplay ?? [])[Math.floor(Math.random() * (data_quirks.quirks?.gameplay ?? []).length)] ?? { nl: "", en: "" };

  // ── Gebouwbeschrijving uit JSON ───────────────────────────────────────────

  const building = await DataLoader.pick("buildings.json", "gebouw") ?? { nl: "", en: "" };
  const roof     = await DataLoader.pick("buildings.json", "dak") ?? { nl: "", en: "" };
  const height   = await DataLoader.pick("buildings.json", "hoogte") ?? { nl: "", en: "" };
  const detail   = await DataLoader.pick("buildings.json", "detail_shop") ?? { nl: "", en: "" };
  const drukte   = await DataLoader.pick("buildings.json", "drukte") ?? { nl: "", en: "" };

  // ── Beschrijving ──────────────────────────────────────────────────────────

  const lang = WorldForgeSettings.lang;
  const description = lang === "nl"
    ? `${shopName} is ${building.nl}, met ${roof.nl}. ${height.nl} ${detail.nl} ${drukte.nl}`
    : `${shopName} is ${building.en}, with ${roof.en}. ${height.en} ${detail.en} ${drukte.en}`;

  // ── Shop object ───────────────────────────────────────────────────────────

  const shop = {
    shopName,
    shopType:     shopType.name,
    category:     shopType.nameCategory,
    description,
    building, roof, height, detail, drukte,
    flavorQuirk, gameplayQuirk, owner,
    renderStatus:     wft("WF.Status.NotGenerated"),
    comfyFileName:    null,
    currentImagePath: null,
    isRendering:      false
  };

  shop.comfyPrompt   = buildShopComfyPrompt(shop);
  shop.comfyNegative = baseNegativeExterior(shop.building.en);

  return shop;
}

// =============================================================================
// ShopGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class ShopGenerator extends BaseGenerator {
  static codexType = "shop";
  static folder    = "_Random Shops";
  static icon      = "fa-store";
  static hasActor  = false;
  static hasComfy  = true;
  static comfyW    = 1024;
  static comfyH    = 768;

  static async generate(options = {}) { return generateShop(options); }
  static render(item)                 { return renderShopCard(item, { buttons: false }); }
  static getName(item)                { return item.shopName ?? "Shop"; }
  static getImage(item)               { return item.currentImagePath ?? ""; }

  static getSub(item) {
    return `${item.shopType ?? ""} · ${item.category ?? ""}`;
  }
}

/**
 * Genereert een shop en stuurt die naar de WorldForge UI.
 */
export async function generateAndShowShop() {
  const shop = await generateShop();
  if (window._worldForgeApp) {
    window._worldForgeApp.receiveItem("shop", shop);
  }
  return shop;
}

/**
 * Stuurt een shop naar de chat (voor publiceren naar spelers).
 */
export async function publishShopToChat(shop) {
  let msg    = null;
  let hookId = null;

  const update = async () => {
    const content = renderShopCard(shop, { buttons: true });
    if (!msg) {
      msg = await ChatMessage.create({
        content,
        whisper: ChatMessage.getWhisperRecipients("GM")
      });
    } else {
      await msg.update({ content });
    }
  };

  hookId = Hooks.on("renderChatMessage", (message, html) => {
    if (!msg || message.id !== msg.id) return;

    html.find(".wf-shop-art").off("click").on("click", function () {
      openImagePopout(this.dataset.img, this.dataset.name || shop.shopName);
    });

    html.find(".wf-send-comfy").off("click").on("click", async () => {
      if (shop.isRendering) { ui.notifications.warn(wft("WF.Notify.RenderRunning")); return; }

      shop.isRendering  = true;
      shop.renderStatus = "Render gestart in ComfyUI...";
      await update();

      try {
        const result = await runComfyRender({
          prompt:         shop.comfyPrompt,
          negativePrompt: shop.comfyNegative,
          width:          1024,
          height:         768,
          filenamePrefix: `Shop_${formatForFile(shop.category)}_${formatForFile(shop.shopName)}_${Date.now()}`
        });
        shop.currentImagePath = result.imageUrl;
        shop.comfyFileName    = result.fileName;
        shop.renderStatus     = wft("WF.Status.ArtworkReady");
        await update();
        ui.notifications.info(`${wft("WF.Notify.ArtworkReady")} ${shop.shopName}`);
      } catch (err) {
        console.error("[WorldForge] Shop ComfyUI fout:", err);
        shop.renderStatus = `Render mislukt: ${err.message ?? err}`;
        await update();
        ui.notifications.error(`${wft("WF.Notify.ComfyFail")} ${err.message}`);
      } finally {
        shop.isRendering = false;
      }
    });

    html.find(".wf-publish-shop").off("click").on("click", async () => {
      await ChatMessage.create({ content: renderShopCard(shop, { buttons: false }) });
      ui.notifications.info(`${shop.shopName} ${wft("WF.Notify.PublishedPlayers")}`);
    });

    html.find(".wf-save-shop").off("click").on("click", async () => {
      try {
        const folder = await ensureJournalFolder("_Random Shops");
        await JournalEntry.create({
          name:   shop.shopName,
          folder: folder.id,
          img:    shop.currentImagePath || "",
          pages:  [{ name: "WF.Shop.Section.Description", type: "text", text: { format: 1, content: renderShopJournal(shop) } }]
        });
        ui.notifications.info(`${wft("WF.Notify.JournalCreated")} ${shop.shopName}`);
      } catch (err) {
        console.error("[WorldForge] Shop journal fout:", err);
        ui.notifications.error(wft("WF.Notify.JournalSaveFail"));
      }
    });

    html.find(".wf-save-codex").off("click").on("click", async () => {
      try {
        await saveToCodex(shop.shopName, "_Random Shops", renderShopCodex(shop), shop.currentImagePath || "");
        ui.notifications.info(`${wft("WF.Notify.CodexCreated")} ${shop.shopName}`);
      } catch (err) {
        console.error("[WorldForge] Shop Codex fout:", err);
        ui.notifications.error(`${wft("WF.Notify.CodexFail")} ${err.message}`);
      }
    });
  });

  Hooks.on("deleteChatMessage", (deleted) => {
    if (msg && deleted.id === msg.id) Hooks.off("renderChatMessage", hookId);
  });

  await update();
}
