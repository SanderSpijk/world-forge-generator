/**
 * WorldForge – utils.js
 *
 * Gedeelde hulpfuncties die door alle generators worden gebruikt.
 * Onderverdeeld in de volgende secties:
 *
 *  1. Tekst-helpers        – clean, escape, splitLang, etc.
 *  2. Getal-helpers        – randBetween, getModifier, pickRandom, etc.
 *  3. Rollable Table-helpers – rollTable, rollTableLang, rollUniqueTable, etc.
 *  4. NPC-normalisatie     – normalizeNpc (behouden voor backwards-compatibiliteit)
 *  5. Clipboard            – copyToClipboard
 *  6. Afbeelding           – hasValidImageExtension, openImagePopout
 *  7. Journal/Foundry      – ensureJournalFolder
 *  8. Campaign Codex       – saveToCodex
 *  9. HTML bouwblokken     – wfSectionHeader, wfHeading, wfReadout, etc.
 */

// =============================================================================
// 1. TEKST-HELPERS
// =============================================================================

/**
 * Verwijdert HTML-tags, regeleinden en overtollige spaties uit tekst.
 * Gebruikt overal waar rauwe tabelresultaten worden verwerkt,
 * zodat HTML-entiteiten of onzichtbare tekens niet doorsijpelen.
 */
export function clean(text) {
  return String(text ?? "")
    .replace(/<[^>]*>/g, "")   // Verwijder HTML-tags
    .replace(/\n/g, " ")       // Newlines → spaties
    .replace(/\r/g, " ")       // Carriage returns → spaties
    .replace(/\s+/g, " ")      // Meerdere spaties → één spatie
    .trim();
}

/**
 * Escapet speciale HTML-tekens zodat tekst veilig in HTML kan worden
 * geplaatst als tekstinhoud (niet als attribuut).
 */
export function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#039;");
}

/**
 * Escapet speciale tekens voor gebruik in HTML-attributen (bijv. data-img="...").
 * Iets strenger dan escapeHtml omdat ook aanhalingstekens volledig geëscapet worden.
 */
export function escapeAttr(text) {
  return String(text ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/"/g,  "&quot;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;");
}

/**
 * Splitst een tabel-resultaat van de vorm "Nederlandse tekst|English text"
 * in een { nl, en } object. Als er geen | staat, wordt dezelfde tekst
 * voor beide talen gebruikt.
 *
 * Voorbeeld: "een grote mens|a tall human" → { nl: "een grote mens", en: "a tall human" }
 */
export function splitLang(text) {
  const raw   = clean(text);
  const parts = raw.split("|").map(p => p.trim());
  return { nl: parts[0] || raw, en: parts[1] || parts[0] || raw };
}

/**
 * Splitst een beroep-resultaat van de vorm "NL naam|EN naam|stat"
 * in een { nl, en, stat } object.
 * De stat bepaalt welke ability score dominant is (bijv. "int" voor een wizard).
 *
 * Voorbeeld: "smid|blacksmith|str" → { nl: "smid", en: "blacksmith", stat: "str" }
 */
export function splitJob(text) {
  const parts = clean(text).split("|").map(p => p.trim());
  return {
    nl:   parts[0] || "",
    en:   parts[1] || parts[0] || "",
    stat: parts[2] || "int"   // Fallback: intelligentie als hoofdstat
  };
}

/**
 * Zorgt ervoor dat een waarde altijd een { nl, en } object is,
 * ongeacht of de invoer al een object is of een ruwe string.
 * Handig in normalizeNpc() voor het normaliseren van externe NPC-data.
 */
export function ensureLangObject(value) {
  if (value && typeof value === "object" && ("nl" in value || "en" in value)) {
    return {
      nl: clean(value.nl ?? value.en ?? ""),
      en: clean(value.en ?? value.nl ?? "")
    };
  }
  return splitLang(value);
}

/** Hulpfunctie: geef tekst terug als lowercase string */
export function lowerNl(value) {
  return clean(value).toLowerCase();
}

/**
 * Voegt een lidwoord toe aan een Nederlandse zin als die er nog niet
 * mee begint (een, de, het). Gebruikt bij kledingbeschrijvingen.
 *
 * Voorbeeld: "rode mantel" → "een rode mantel"
 *            "de blauwe jas" → "de blauwe jas" (ongewijzigd)
 */
export function ensureArticle(text) {
  const lower = clean(text).toLowerCase();
  if (lower.startsWith("een ") || lower.startsWith("de ") || lower.startsWith("het ")) {
    return lower;
  }
  return "een " + lower;
}

/**
 * Maakt een bestandsnaam-veilige versie van tekst door speciale
 * tekens en spaties te verwijderen.
 * Gebruikt voor ComfyUI filename prefixes en token-bestand zoekopdrachten.
 */
export function formatForFile(text) {
  return clean(text)
    .replace(/[\/\\:*?"<>|]/g, "")  // Verboden bestandsnaam-tekens
    .replace(/\s+/g, "");           // Spaties verwijderen
}

/**
 * Haalt de bestandsnaam zonder extensie op uit een volledig pad.
 * Gebruikt bij het matchen van token-afbeeldingen op naam.
 *
 * Voorbeeld: "assets/Tokens/Human_Guard_Male_01.png" → "Human_Guard_Male_01"
 */
export function decodeFileName(path) {
  return decodeURIComponent(path.split("/").pop() ?? "")
    .replace(/\.[^/.]+$/, "");  // Verwijder de extensie
}

/**
 * Verwijdert duplicaten uit een lijst van strings (case-insensitive)
 * en lege waarden. Gebruikt bij het bouwen van ComfyUI prompts om
 * herhaalde woorden te voorkomen.
 */
export function uniqueParts(parts) {
  const seen = new Set();
  const out  = [];
  for (const part of parts) {
    const value = clean(part);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// =============================================================================
// 2. GETAL-HELPERS
// =============================================================================

/**
 * Geeft een willekeurig geheel getal terug tussen min en max (inclusief).
 * Gebruikt voor ability score generatie.
 */
export function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Berekent de D&D 5e ability modifier op basis van een ability score.
 * Formule: floor((score - 10) / 2)
 * Voorbeeld: score 14 → modifier +2, score 8 → modifier -1
 */
export function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Formateert een modifier met een + of - teken.
 * Voorbeeld: 2 → "+2", -1 → "-1", 0 → "+0"
 */
export function fmtMod(mod) {
  return (mod >= 0 ? "+" : "") + mod;
}

/**
 * Kiest `count` unieke elementen uit een array (zonder teruglegging).
 * Gebruikt voor skill proficiency selectie.
 */
export function pickUnique(arr, count) {
  const pool = [...new Set(arr)].filter(Boolean);
  const out  = [];
  while (pool.length && out.length < count) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * Kiest een willekeurig element uit een array.
 * Geeft null terug als de array leeg of undefined is.
 */
export function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Wacht een opgegeven aantal milliseconden.
 * Gebruikt in de ComfyUI polling-loop.
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// =============================================================================
// 3. ROLLABLE TABLE-HELPERS
// =============================================================================

/**
 * Rolt op een Foundry Rollable Table en geeft de tekst van het eerste
 * resultaat terug. Geeft "Unknown" terug als de tabel niet bestaat
 * of geen resultaat heeft.
 *
 * @param {string} name       - Naam van de tabel in Foundry
 * @param {object} opts
 * @param {boolean} opts.silent - Toon geen waarschuwing als de tabel niet bestaat
 * @param {Roll}   opts.roll    - Gebruik een bestaande Roll (bijv. voor factie-rolls)
 */
export async function rollTable(name, { silent = false, roll = null } = {}) {
  const table = game.tables.getName(name);
  if (!table) {
    if (!silent) ui.notifications.warn(`Table '${name}' ${wft("WF.Notify.TableNotFound")}`);
    return "Unknown";
  }
  const opts = { displayChat: false };
  if (roll) opts.roll = roll;
  const draw   = await table.draw(opts);
  const result = draw?.results?.[0];
  if (!result) return "Unknown";

  // Foundry v13: tekst zit in result.description (name is leeg, text is deprecated)
  // Volgorde: description → name → text (text geeft deprecation warning maar werkt nog)
  const resultText = result.description || result.name || result.text || "";
  if (resultText) return clean(resultText);

  // Gelinkt document als fallback (bijv. als het resultaat een Actor/Item is)
  const doc = result.documentCollection && result.documentId
    ? await fromUuid(`${result.documentCollection}.${result.documentId}`) : null;
  return doc?.name ? clean(doc.name) : "Unknown";
}

/**
 * Rolt op een tabel en splitst het resultaat direct in { nl, en }.
 * Handig voor alle tabel-kolommen die tweetalige waarden bevatten.
 */
export async function rollTableLang(name, opts = {}) {
  return splitLang(await rollTable(name, opts));
}

/**
 * Probeert meerdere tabellen in volgorde en geeft het eerste
 * niet-"Unknown" resultaat terug. Handig als fallback-ketens nodig zijn
 * (bijv. Elf Female Names → Human Female Names → "Nameless").
 *
 * @param {string[]} names    - Lijst van tabelnamen om te proberen
 * @param {string}  fallback  - Waarde als alle tabellen "Unknown" geven
 */
export async function safeRollTable(names, fallback = "Unknown") {
  for (const name of names) {
    const result = await rollTable(name, { silent: true });
    if (result !== "Unknown") return result;
  }
  return fallback;
}

/**
 * Rolt meerdere keren op een tabel en geeft `count` unieke resultaten
 * terug. Stopt na 50 pogingen om oneindige loops te voorkomen.
 * Gebruikt voor cargo, dranken, roddels, etc.
 */
export async function rollUniqueTable(name, count) {
  const results = [];
  let attempts  = 0;
  while (results.length < count && attempts < 50) {
    const r = await rollTable(name, { silent: true });
    if (!results.includes(r)) results.push(r);
    attempts++;
  }
  return results;
}

/**
 * Rolt op een tabel en geeft de volledige draw-response terug
 * (inclusief alle resultaten). Gebruikt door de Ship generator
 * die meerdere resultaten uit één draw haalt.
 */
export async function drawTableRaw(name, options = {}) {
  const table = game.tables.getName(name);
  if (!table) {
    ui.notifications.warn(`Table '${name}' ${wft("WF.Notify.TableNotFound")}`);
    return null;
  }
  return table.draw({ displayChat: false, ...options });
}

// =============================================================================
// 4. NPC-NORMALISATIE
// =============================================================================

/**
 * Bepaalt het Nederlands voornaamwoord op basis van geslacht.
 * Accepteert zowel strings als { nl, en } objecten.
 *
 * Voorbeeld: "Male" → "Hij", "Female" → "Zij"
 */
export function getPronounNl(sexValue) {
  const raw = typeof sexValue === "object"
    ? clean(sexValue?.en || sexValue?.nl || "")
    : clean(sexValue);
  return raw.toLowerCase().includes("male") ? "Hij" : "Zij";
}

/**
 * Normaliseert een NPC-object zodat alle velden gegarandeerd aanwezig
 * zijn als { nl, en } objecten. Dit is nodig omdat NPC-data via de
 * NPC Helper macro kan komen, die een andere structuur kan hebben dan
 * de WorldForge NPC generator.
 *
 * Ook bouwt het de cinematische beschrijving opnieuw op als die
 * ontbreekt of een | bevat (wat betekent dat het een rauwe tabelwaarde is).
 */
export function normalizeNpc(npc) {
  const race          = ensureLangObject(npc?.race);
  const sex           = ensureLangObject(npc?.sex);
  const height        = ensureLangObject(npc?.height);
  const posture       = ensureLangObject(npc?.posture);
  const hairColor     = ensureLangObject(npc?.hairColor);
  const physicalTrait = ensureLangObject(npc?.physicalTrait);
  const clothing      = ensureLangObject(npc?.clothing);
  const weapon        = ensureLangObject(npc?.weapon);
  const job           = ensureLangObject(npc?.job);
  const name          = clean(npc?.name ?? "Unknown");
  const age           = clean(String(npc?.age ?? "?"));
  const pronoun       = npc?.pronoun ? clean(npc.pronoun) : getPronounNl(sex);

  // Bouw de cinematische zin opnieuw als die ontbreekt of nog rauwe data bevat
  let cinematic = clean(npc?.cinematic ?? "");
  if (!cinematic || cinematic.includes("|")) {
    cinematic = `Een ${lowerNl(height.nl)}, ${lowerNl(posture.nl)} ${lowerNl(race.nl)} `
      + `met ${lowerNl(hairColor.nl)} haar en ${lowerNl(physicalTrait.nl)}. `
      + `${pronoun} draagt ${lowerNl(clothing.nl)} en heeft ${lowerNl(weapon.nl)} bij zich.`;
  }

  return { name, age, race, sex, height, posture, hairColor, physicalTrait, clothing, weapon, job, cinematic, pronoun };
}

// =============================================================================
// 5. CLIPBOARD
// =============================================================================

/**
 * Kopieert tekst naar het klembord. Probeert eerst de moderne
 * Clipboard API en valt terug op de verouderde execCommand methode
 * voor browsers die de Clipboard API niet ondersteunen.
 *
 * @returns {boolean} true als kopiëren gelukt is
 */
export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback: tijdelijk textarea-element
    const el = document.createElement("textarea");
    el.value            = text;
    el.style.position   = "fixed";
    el.style.left       = "-9999px";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

// =============================================================================
// 6. AFBEELDING
// =============================================================================

/**
 * Controleert of een pad een geldige afbeeldingsextensie heeft.
 * Gebruikt om te voorkomen dat ComfyUI view-URLs (die geen extensie
 * hebben) als afbeelding worden behandeld.
 */
export function hasValidImageExtension(path) {
  return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(
    String(path ?? "").split("?")[0]
  );
}

/**
 * Opent een afbeelding in een Foundry ImagePopout venster.
 * Klikken op een portret of artwork roept dit aan.
 */
export function openImagePopout(imgPath, title) {
  new ImagePopout(imgPath, { title, shareable: true }).render(true);
}

// =============================================================================
// 7. JOURNAL / FOUNDRY
// =============================================================================

/**
 * Zorgt dat een Journal-map bestaat en maakt hem aan als dat niet zo is.
 * Gebruikt door alle generators om NPCs, shops, inns, etc. op te slaan
 * in een georganiseerde mappenstructuur.
 *
 * @param {string} name  - Naam van de map (bijv. "_Random NPCs")
 * @returns {Folder}
 */
export async function ensureJournalFolder(name) {
  let folder = game.folders.getName(name);
  if (!folder) {
    folder = await Folder.create({ name, type: "JournalEntry" });
  }
  return folder;
}

// =============================================================================
// 8. CAMPAIGN CODEX
// =============================================================================

/**
 * Maakt een Campaign Codex entry aan voor een willekeurig gegenereerd item.
 * De logica is volledig ingebouwd — geen externe macro vereist.
 *
 * @param {string} name             - Naam van het item
 * @param {string} folderName       - Map in de Journal sectie
 * @param {string} descriptionHtml  - HTML beschrijving
 * @param {string} imagePath        - Pad naar afbeelding (optioneel)
 * @param {string} type             - Campaign Codex type: "npc", "shop", "inn", "tavern", "ship"
 */
export async function saveToCodex(name, folderName, descriptionHtml, imagePath, type = "shop") {
  const campaignCodexAPI = game.modules.get("campaign-codex")?.api;
  if (!campaignCodexAPI?.convertJournalToCCSheet) {
    throw new Error("Campaign Codex API niet beschikbaar");
  }

  if (!name?.trim())            throw new Error("Geen naam opgegeven voor Campaign Codex");
  if (!descriptionHtml?.trim()) throw new Error("Geen beschrijving opgegeven voor Campaign Codex");

  // ── Stap 1: zorg dat de map bestaat ──────────────────────────────────────
  let folder = game.folders.getName(folderName);
  if (!folder) {
    folder = await Folder.create({ name: folderName, type: "JournalEntry" });
  }

  // ── Stap 2: maak een bronjournal aan ─────────────────────────────────────
  const pages = [];
  if (imagePath) {
    pages.push({ name: "Portrait", type: "image", src: imagePath });
  }
  pages.push({
    name: "Beschrijving",
    type: "text",
    text: { format: 1, content: descriptionHtml }
  });

  const sourceJournal = await JournalEntry.create({
    name,
    folder: folder.id,
    img:    imagePath || "",
    pages
  });

  // ── Stap 3: converteer naar Campaign Codex sheet ──────────────────────────
  const existingIds = new Set(
    game.journal
      .filter(j => j.name === name && j.getFlag("campaign-codex", "type") === type)
      .map(j => j.id)
  );

  await campaignCodexAPI.convertJournalToCCSheet(sourceJournal.uuid, type, false);

  // ── Stap 4: zoek de nieuw aangemaakte Codex entry ────────────────────────
  const findEntry = () => game.journal
    .filter(j =>
      j.name === name &&
      !existingIds.has(j.id) &&
      j.getFlag("campaign-codex", "type") === type
    )
    .sort((a, b) =>
      (b._stats?.modifiedTime ?? b._stats?.createdTime ?? 0) -
      (a._stats?.modifiedTime ?? a._stats?.createdTime ?? 0)
    )[0] ?? null;

  let ccEntry = findEntry();
  if (!ccEntry) {
    await new Promise(r => setTimeout(r, 300));
    ccEntry = findEntry();
  }
  if (!ccEntry) {
    throw new Error(`Campaign Codex ${type} niet gevonden na conversie`);
  }

  // ── Stap 5: sla beschrijving en afbeelding op in de Codex entry ──────────
  const updateData = {
    "flags.campaign-codex.data.description": descriptionHtml
  };
  if (imagePath) {
    updateData.img = imagePath;
    updateData["flags.campaign-codex.image"] = imagePath;
  }
  await ccEntry.update(updateData);

  return {
    success:           true,
    sourceJournalUuid: sourceJournal.uuid,
    codexUuid:         ccEntry.uuid,
    codexName:         ccEntry.name
  };
}

// =============================================================================
// 9. HTML BOUWBLOKKEN (Campaign Codex-stijl)
// =============================================================================

/**
 * Genereert een sectieheader-balk zoals Campaign Codex gebruikt:
 * ronde gouden cirkel met icoon + HOOFDLETTER label.
 *
 * Voorbeeld: wfSectionHeader("👤", "Eigenaar")
 * Produceert: <div class="wf-section-header"><div class="wf-icon">👤</div><span>EIGENAAR</span></div>
 */
export function wfSectionHeader(iconChar, label) {
  return `<div class="wf-section-header">
    <div class="wf-icon">${iconChar}</div>
    <span>${escapeHtml(label)}</span>
  </div>`;
}

/**
 * Genereert een tussenkopje binnen een inhoudsgebied.
 * Gebruikt voor "Uiterlijk", "Persoonlijkheid", "Menu", etc.
 */
export function wfHeading(text) {
  return `<h3 class="wf-heading">${escapeHtml(text)}</h3>`;
}

/**
 * Genereert een cursief read-out blok (voor hardop voorlezen aan spelers).
 * Gouden linkerbalk zoals Campaign Codex blockquotes.
 */
export function wfReadout(text) {
  return `<blockquote class="wf-readout">${escapeHtml(text)}</blockquote>`;
}

/**
 * Genereert één rij voor een wf-info-table.
 * Label in goud links, waarde rechts.
 * De `value` parameter mag HTML bevatten (is niet ge-escaped).
 */
export function wfInfoRow(label, value) {
  return `<tr><td>${escapeHtml(label)}</td><td>${value}</td></tr>`;
}

/**
 * Genereert een kleine badge (pill) voor de meta-rij in de header.
 * Bijv. ras, leeftijd, geslacht, kwaliteit.
 */
export function wfBadge(text) {
  return `<span class="wf-badge">${escapeHtml(text)}</span>`;
}

/**
 * Genereert een compacte NPC-weergave met naam, ras, leeftijd, rol
 * en een korte beschrijving. Gebruikt voor eigenaren, medewerkers
 * en klanten in Shop/Inn/Tavern/Ship.
 *
 * @param {object} npc           - Genormaliseerd NPC object
 * @param {string} roleOverride  - Overschrijf de rol (bijv. "Barman")
 */
export function wfNpcItem(npc, roleOverride = null) {
  const lang    = (typeof game !== "undefined"
    ? (game.settings?.get("world-forge-generator", "generatorLanguage") ?? "nl")
    : "nl");
  const role    = roleOverride
    ? (typeof roleOverride === "object" ? (lang === "en" ? (roleOverride.en ?? roleOverride.nl) : roleOverride.nl) : roleOverride)
    : (lang === "en" ? (npc.job?.en ?? npc.job?.nl ?? "") : (npc.job?.nl ?? ""));
  const raceName   = lang === "en" ? (npc.race?.en ?? npc.race?.nl ?? "") : (npc.race?.nl ?? "");
  const sexName    = lang === "en" ? (npc.sex?.en  ?? npc.sex?.nl  ?? "") : (npc.sex?.nl  ?? "");
  const ageLabel   = lang === "en" ? `${String(npc.age)} yrs` : `${String(npc.age)} jr`;
  const cinematic  = lang === "en" ? (npc.cinematicEn ?? npc.cinematic) : npc.cinematic;
  // Sla de NPC-data op als JSON in een data-attribuut zodat de knoppen
  // de juiste NPC meekrijgen, ongeacht waar het item gerenderd wordt
  const npcJson = escapeAttr(JSON.stringify(npc));
  const codexBtn = (typeof game !== "undefined" && game.modules?.get("campaign-codex")?.active)
    ? `<button class="wf-btn wf-btn-green wf-npc-to-codex" data-npc="${npcJson}" title="Opslaan in Campaign Codex"><i class="fas fa-atlas"></i></button>`
    : "";
  return `
<div class="wf-npc-item">
  <div class="wf-npc-item-top">
    <div class="wf-npc-item-meta">
      <strong>${escapeHtml(npc.name)}</strong>
      <span class="wf-npc-role">
        · ${escapeHtml(raceName)}
        ${sexName ? `· ${escapeHtml(sexName)}` : ""}
        · ${escapeHtml(ageLabel)}
        ${role ? `· <em style="font-style:normal;">${escapeHtml(role)}</em>` : ""}
      </span>
    </div>
    <div class="wf-npc-item-actions">
      <button class="wf-btn wf-btn-red wf-npc-to-actor" data-npc="${npcJson}" title="Maak Actor aan"><i class="fas fa-masks-theater"></i></button>
      ${codexBtn}
    </div>
  </div>
  <em>${escapeHtml(cinematic)}</em>
</div>`;
}

/**
 * Genereert een lijst van gossip/roddel-items met een gouden ruit als bullet.
 *
 * @param {string[]} items  - Lijst van gossip-teksten
 */
export function wfGossip(items) {
  return items
    .map(g => `<div class="wf-gossip-item">${escapeHtml(g)}</div>`)
    .join("");
}

/**
 * Genereert één menukaart-rij met label, gerecht/drank en prijs.
 * Het label staat boven de rij als een categorie-header.
 *
 * @param {string} label  - Categorienaam (bijv. "Bier & Ale")
 * @param {string} price  - Prijs (bijv. "4 cp")
 * @param {string} value  - Naam van het gerecht of de drank
 */
export function wfMenuRow(label, price, value) {
  return `
<div class="wf-menu-label">${escapeHtml(label)}</div>
<div class="wf-menu-row">
  <span class="wf-menu-item">${escapeHtml(value)}</span>
  <span class="wf-menu-price">${escapeHtml(price)}</span>
</div>`;
}
