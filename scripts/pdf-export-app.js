/**
 * WorldForge – pdf-export-app.js
 *
 * Simpele PDF Export popup voor spelers (en GM).
 * Toont een dropzone voor character actors en een lijst van recente exports.
 * Spelers zien alleen hun eigen characters, GM ziet alle characters.
 */

import { PdfExporter }     from "./pdf-exporter.js";
import { PdfExporter2014 } from "./pdf-exporter-2014.js";

export class PdfExportApp extends foundry.applications.api.ApplicationV2 {

  // ---------------------------------------------------------------------------
  // STATIC CONFIG
  // ---------------------------------------------------------------------------

  static DEFAULT_OPTIONS = {
    id:       "wf-pdf-export-app",
    classes:  ["worldforge", "wf-pdf-app"],
    window: {
      title:     "PDF Export — Character Sheet",
      resizable: false,
    },
    position: {
      width:  420,
      height: "auto",
    }
  };

  // ---------------------------------------------------------------------------
  // CONSTRUCTOR
  // ---------------------------------------------------------------------------

  constructor() {
    super();
    this.pdfExports  = [];
    this.sheetVersion = "2024"; // "2024" of "2014"
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  async _prepareContext() { return {}; }

  async _renderHTML() {
    const el = document.createElement("div");
    el.innerHTML = this._buildLayout();
    return el;
  }

  _replaceHTML(result, content, options) {
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    content.replaceChildren(...result.childNodes);
    this._bindEvents(content, signal);
  }

  // ---------------------------------------------------------------------------
  // LAYOUT
  // ---------------------------------------------------------------------------

  _buildLayout() {
    return `
<div class="wf-pdf-app-inner">

  <!-- Sheet versie keuze -->
  <div class="wf-pdf-app-sheet-select">
    <label class="wf-pdf-app-sheet-label">Character Sheet:</label>
    <select id="wf-pdf-sheet-version" class="wf-pdf-app-sheet-dropdown">
      <option value="2024" ${this.sheetVersion === "2024" ? "selected" : ""}>D&amp;D 2024 (nieuw)</option>
      <option value="2014" ${this.sheetVersion === "2014" ? "selected" : ""}>D&amp;D 5e 2014 (klassiek)</option>
    </select>
  </div>

  <!-- Dropzone -->
  <div class="wf-pdf-dropzone" id="wf-pdf-app-dropzone">
    <div class="wf-pdf-dropzone-inner">
      <i class="fas fa-file-pdf"></i>
      <p>Sleep je <strong>Character</strong> hierheen</p>
      <p class="wf-pdf-hint">Of klik om te selecteren</p>
    </div>
  </div>

  <!-- Status -->
  <div id="wf-pdf-app-status" class="wf-pdf-status" style="display:none;"></div>

  <!-- Exports lijst -->
  <div class="wf-pdf-app-exports">
    <div class="wf-pdf-app-exports-header">
      <i class="fas fa-download"></i> Recente exports
    </div>
    <div id="wf-pdf-app-list">
      ${this._buildExportList()}
    </div>
  </div>

</div>`;
  }

  _buildExportList() {
    if (!this.pdfExports.length) {
      return `<p class="wf-pdf-app-empty">Nog geen exports deze sessie.</p>`;
    }
    return [...this.pdfExports].reverse().map((exp, revIdx) => {
      const realIdx = this.pdfExports.length - 1 - revIdx;
      return `
<div class="wf-pdf-app-export-row">
  <div class="wf-pdf-app-export-info">
    <span class="wf-pdf-app-export-name">${this._esc(exp.name)}</span>
    <span class="wf-pdf-app-export-time">${exp.timestamp}</span>
  </div>
  <button class="wf-btn wf-btn-primary wf-pdf-app-download"
          data-pdf-index="${realIdx}"
          title="Download PDF"
          style="padding:3px 10px;font-size:0.85em;flex-shrink:0;">
    <i class="fas fa-download"></i>
  </button>
</div>`;
    }).join("");
  }

  _esc(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------------------
  // EVENT BINDING
  // ---------------------------------------------------------------------------

  _bindEvents(html, signal) {
    const dropzone = html.querySelector("#wf-pdf-app-dropzone");
    const status   = html.querySelector("#wf-pdf-app-status");

    // Sheet versie dropdown
    const sheetSelect = html.querySelector("#wf-pdf-sheet-version");
    if (sheetSelect) {
      sheetSelect.addEventListener("change", (e) => {
        this.sheetVersion = e.target.value;
      }, { signal });
    }

    // Drag over
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      dropzone.classList.add("wf-pdf-dropzone--active");
    }, { signal });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("wf-pdf-dropzone--active");
    }, { signal });

    // Drop
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
        ui.notifications.warn("Sleep een actor vanuit de Actors sidebar.");
        return;
      }

      const actor = game.actors.get(actorId)
        ?? await fromUuid(`Actor.${actorId}`).catch(() => null);

      if (!actor) { ui.notifications.warn("Actor niet gevonden."); return; }
      if (actor.type !== "character") {
        ui.notifications.warn("Alleen karakters kunnen geëxporteerd worden.");
        return;
      }

      // Spelers mogen alleen hun eigen character exporteren
      if (!game.user.isGM && !actor.isOwner) {
        ui.notifications.warn("Je kunt alleen je eigen karakter exporteren.");
        return;
      }

      this._runExport(actor, status);
    }, { signal });

    // Klik → selectie dialog
    dropzone.addEventListener("click", async () => {
      // Filter: GM ziet alles, spelers alleen hun eigen characters
      const characters = game.actors.filter(a =>
        a.type === "character" && (game.user.isGM || a.isOwner)
      );

      if (!characters.length) {
        ui.notifications.warn("Geen exporteerbare karakters gevonden.");
        return;
      }

      const options = characters.map(a =>
        `<option value="${a.id}">${this._esc(a.name)}</option>`
      ).join("");

      new Dialog({
        title:   "PDF Export — Kies karakter",
        content: `<form><div class="form-group">
                    <label>Karakter:</label>
                    <select name="actorId">${options}</select>
                  </div></form>`,
        buttons: {
          export: {
            icon:     `<i class="fas fa-file-pdf"></i>`,
            label:    "Exporteer",
            callback: (html) => {
              const id    = html.find("[name=actorId]").val();
              const actor = game.actors.get(id);
              if (actor) this._runExport(actor, status);
            }
          },
          cancel: { label: "Annuleer" }
        }
      }).render(true);
    }, { signal });

    // Download knop
    html.addEventListener("click", (e) => {
      const btn = e.target.closest(".wf-pdf-app-download");
      if (!btn) return;
      e.stopPropagation();
      const exp = this.pdfExports[parseInt(btn.dataset.pdfIndex, 10)];
      if (!exp) return;
      saveDataToFile(exp.bytes, "application/pdf", exp.filename);
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // EXPORT LOGICA
  // ---------------------------------------------------------------------------

  async _runExport(actor, statusEl) {
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exporteren: ${this._esc(actor.name)}…`;
    }

    try {
      const exporter = this.sheetVersion === "2014"
        ? new PdfExporter2014(actor)
        : new PdfExporter(actor);
      const bytes    = await exporter._buildPdfBytes();
      const now        = new Date();
      const dateSuffix = `_${now.getHours().toString().padStart(2,"0")}${now.getMinutes().toString().padStart(2,"0")}${now.getDate().toString().padStart(2,"0")}${(now.getMonth()+1).toString().padStart(2,"0")}${now.getFullYear().toString().slice(-2)}`;
      const filename   = `${actor.name.replace(/[^a-z0-9]/gi, "_")}_character_sheet${dateSuffix}.pdf`;
      const timestamp  = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;

      if (this.pdfExports.length >= 5) this.pdfExports.shift();
      this.pdfExports.push({ name: actor.name, bytes, filename, timestamp });

      if (statusEl) statusEl.style.display = "none";
      ui.notifications.info(`PDF klaar: ${actor.name}`);
      this.render();
    } catch (err) {
      console.error("WorldForge | PDF export fout:", err);
      if (statusEl) {
        statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Mislukt: ${this._esc(err.message)}`;
      }
      ui.notifications.error(`PDF export mislukt: ${err.message}`);
    }
  }
}
