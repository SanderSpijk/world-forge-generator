/**
 * PdfExporter
 *
 * Leest actor-data uit Foundry (dnd5e systeem), mapt die op de AcroForm-velden
 * van de officiële D&D 2024 PDF en triggert een download in de browser.
 *
 * Afhankelijkheid: pdf-lib via CDN (geladen in index.html of via importmap).
 * Voeg dit toe aan je world/game.html of laad het dynamisch (zie loadPdfLib()).
 */

export class PdfExporter {
  /**
   * @param {Actor} actor - Foundry Actor document (type "character")
   */
  constructor(actor) {
    this.actor = actor;
  }

  // ─── Publieke methode ──────────────────────────────────────────────────────

  async export() {
    ui.notifications.info("PDF Export gestart…");
    try {
      const pdfBytes = await this._buildPdfBytes();
      this._download(pdfBytes);
      ui.notifications.info("PDF gedownload!");
    } catch (err) {
      console.error("dnd2024-pdf-export |", err);
      ui.notifications.error("PDF export mislukt. Zie de console voor details.");
    }
  }

  /**
   * Bouwt de PDF bytes — ook bruikbaar door WorldForge voor blob-generatie.
   * @returns {Promise<Uint8Array>}
   */
  async _buildPdfBytes() {
    await this._loadPdfLib();
    return this._buildPdf();
  }

  // ─── PDF-lib laden (eenmalig) ──────────────────────────────────────────────

  async _loadPdfLib() {
    if (window.PDFLib) return; // al geladen

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error("Kon pdf-lib niet laden. Controleer je internetverbinding."));
      document.head.appendChild(script);
    });
  }

  // ─── PDF bouwen ────────────────────────────────────────────────────────────

  async _buildPdf() {
    const { PDFDocument } = PDFLib;

    const templateUrl = `modules/world-forge-generator/data/DnD_2024_CharacterSheet.pdf`;
    const response = await fetch(templateUrl);
    if (!response.ok)
      throw new Error(
        `Kon template PDF niet laden (${response.status}). Zet de PDF in de module-map.`
      );
    const templateBytes = await response.arrayBuffer();

    const pdfDoc = await PDFDocument.load(templateBytes, {
      ignoreEncryption: true,
    });

    const form = pdfDoc.getForm();
    const data = this._extractActorData();

    this._fillFields(form, data);

    // ── Character portrait op pagina 2 ──────────────────────────────────────
    await this._embedPortrait(pdfDoc);

    form.flatten();
    return pdfDoc.save();
  }

  /**
   * Embed de actor portrait afbeelding op pagina 2 van de PDF.
   */
  async _embedPortrait(pdfDoc) {
    // Probeer eerst actor.img (character art), dan token texture als fallback
    let imgSrc = this.actor.img
               ?? this.actor.prototypeToken?.texture?.src;

    if (!imgSrc) return;

    // Skip SVG en mystery-man placeholder
    if (imgSrc.includes("mystery-man") || imgSrc.endsWith(".svg") || imgSrc.includes(".svg?")) return;

    // Zorg dat het pad absoluut is
    if (!imgSrc.startsWith("http") && !imgSrc.startsWith("data:") && !imgSrc.startsWith("blob:")) {
      imgSrc = `${window.location.origin}/${imgSrc.replace(/^\/+/, "")}`;
    }

    console.log(`WorldForge | Portrait laden van: ${imgSrc}`);

    try {
      const response = await fetch(imgSrc);
      if (!response.ok) {
        console.warn(`WorldForge | Portrait fetch mislukt (${response.status}): ${imgSrc}`);
        return;
      }
      const bytes = await response.arrayBuffer();
      const ct    = (response.headers.get("content-type") ?? "").toLowerCase();
      const url   = imgSrc.toLowerCase().split("?")[0]; // strip query params

      let image = null;

      // Probeer op basis van content-type eerst
      if (ct.includes("png")) {
        image = await pdfDoc.embedPng(bytes).catch(() => null);
      } else if (ct.includes("jpeg") || ct.includes("jpg")) {
        image = await pdfDoc.embedJpg(bytes).catch(() => null);
      } else if (ct.includes("webp") || url.endsWith(".webp")) {
        // WebP: converteer via canvas naar PNG bytes
        image = await this._webpToPng(bytes, pdfDoc).catch(() => null);
      }

      // Fallback op extensie als content-type niet helpt
      if (!image) {
        if (url.endsWith(".png")) {
          image = await pdfDoc.embedPng(bytes).catch(() => null);
        } else if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
          image = await pdfDoc.embedJpg(bytes).catch(() => null);
        } else {
          // Laatste poging: probeer beide
          image = await pdfDoc.embedPng(bytes).catch(() => null)
                 ?? await pdfDoc.embedJpg(bytes).catch(() => null);
        }
      }

      if (!image) {
        console.warn(`WorldForge | Portrait kon niet worden ingebed — probeer een PNG of JPG afbeelding als actor art.`);
        return;
      }

      const page = pdfDoc.getPages()[1];
      if (!page) return;

      const x = 410.587, y = 482.3, w = 177.5, h = 148.0;
      const imgDims = image.scaleToFit(w, h);
      const offsetX = x + (w - imgDims.width)  / 2;
      const offsetY = y + (h - imgDims.height) / 2;

      page.drawImage(image, {
        x:      offsetX,
        y:      offsetY,
        width:  imgDims.width,
        height: imgDims.height,
      });

      console.log(`WorldForge | Portrait succesvol ingebed.`);
    } catch (err) {
      console.warn("WorldForge | Portrait embed fout:", err.message);
    }
  }

  /**
   * Converteert WebP bytes naar PNG via een canvas element.
   * pdf-lib ondersteunt geen WebP direct.
   */
  async _webpToPng(webpBytes, pdfDoc) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([webpBytes], { type: "image/webp" });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();

      img.onload = async () => {
        try {
          const canvas  = document.createElement("canvas");
          canvas.width  = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);

          canvas.toBlob(async (pngBlob) => {
            URL.revokeObjectURL(url);
            const pngBuffer = await pngBlob.arrayBuffer();
            const embedded  = await pdfDoc.embedPng(pngBuffer).catch(() => null);
            resolve(embedded);
          }, "image/png");
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("WebP laden mislukt")); };
      img.src = url;
    });
  }

  // ─── Actor data extraheren ─────────────────────────────────────────────────

  _extractActorData() {
    const a = this.actor;
    const sys = a.system;
    const abilities = sys.abilities; // str, dex, con, int, wis, cha
    const skills = sys.skills;
    const spells = sys.spells;

    // Helper: modifier als string met teken (+3, -1, +0)
    const mod = (val) => (val >= 0 ? `+${val}` : `${val}`);
    const abilityMod = (key) =>
      mod(Math.floor((abilities[key].value - 10) / 2));

    // Helper: vaardigheidswaarde
    const skillVal = (key) => mod(skills[key]?.total ?? 0);

    // Saving throw: proficiency check
    const saveVal = (key) => mod(abilities[key]?.saveBonus ?? abilities[key]?.save?.value ?? 0);

    // Wapendata (eerste 6 items)
    const weapons = a.items
      .filter((i) => i.type === "weapon")
      .slice(0, 6);

    // Spreuken (eerste 30 prepared spells / cantrips)
    const preparedSpells = a.items
      .filter((i) => i.type === "spell")
      .sort((a, b) => {
        const lvlA = a.system?.level ?? 0;
        const lvlB = b.system?.level ?? 0;
        if (lvlA !== lvlB) return lvlA - lvlB;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 60);

    // Uitrusting (alle niet-wapens, niet-spreuken)
    const equipmentItems = a.items
      .filter((i) => !["weapon", "spell", "feat", "background", "class", "subclass"].includes(i.type))
      .map((i) => `${i.name}${i.system?.quantity > 1 ? ` x${i.system.quantity}` : ""}`);

    const equipment   = equipmentItems.slice(0, 20).join("\n");
    const equipment3  = equipmentItems.slice(20, 40).join("\n");
    const equipment4  = equipmentItems.slice(40, 60).join("\n");

    // Features & Class features
    const classFeatures = a.items
      .filter((i) => i.type === "feat" && i.system?.type?.value === "class")
      .map((i) => i.name)
      .join("\n");

    const speciesTraits = a.items
      .filter((i) => i.type === "feat" && i.system?.type?.value === "race")
      .map((i) => i.name)
      .join("\n");

    const feats = a.items
      .filter((i) => i.type === "feat" && i.system?.type?.value === "feat")
      .map((i) => i.name)
      .join("\n");

    // dnd5e 2024 slaat currency op als { [itemId]: amount }
    // De klassieke velden cp/sp/ep/gp/pp zijn mogelijk niet aanwezig
    const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    if (sys.currency?.cp !== undefined) {
      // Klassiek dnd5e 2014 formaat
      currency.cp = sys.currency.cp ?? 0;
      currency.sp = sys.currency.sp ?? 0;
      currency.ep = sys.currency.ep ?? 0;
      currency.gp = sys.currency.gp ?? 0;
      currency.pp = sys.currency.pp ?? 0;
    } else if (sys.currency) {
      // dnd5e 2024 formaat — zoek via currency items
      const currencyItems = a.items.filter(i => i.type === "currency" || i.system?.denomination);
      currencyItems.forEach(item => {
        const denom = item.system?.denomination?.toLowerCase();
        const qty   = item.system?.quantity ?? 0;
        if (denom && currency[denom] !== undefined) currency[denom] += qty;
      });
      if (currencyItems.length === 0) {
        a.items.filter(i => i.type === "loot" || i.type === "currency").forEach(item => {
          const name = item.name?.toLowerCase();
          const qty  = item.system?.quantity ?? 0;
          if (name?.includes("copper"))   currency.cp += qty;
          if (name?.includes("silver"))   currency.sp += qty;
          if (name?.includes("electrum")) currency.ep += qty;
          if (name?.includes("gold"))     currency.gp += qty;
          if (name?.includes("platinum")) currency.pp += qty;
        });
      }
    }

    return {
      // ── Basisinfo ──
      Name: a.name,
      Background: sys.details?.background?.name ?? sys.details?.background ?? "",
      Class: a.items.find((i) => i.type === "class")?.name ?? "",
      Species: sys.details?.race?.name ?? sys.details?.race ?? "",
      Subclass: a.items.find((i) => i.type === "subclass")?.name ?? "",
      Level: String(sys.details?.level ?? ""),
      "XP Points": String(sys.details?.xp?.value ?? ""),
      PERSONALITY: sys.details?.biography?.value
        ? this._stripHtml(sys.details.biography.value).slice(0, 500)
        : "",

      // ── HP & AC ──
      "Armor Class": String(sys.attributes?.ac?.value ?? ""),
      "Current HP": String(sys.attributes?.hp?.value ?? ""),
      "Max HP": String(sys.attributes?.hp?.max ?? ""),
      "Temp HP": String(sys.attributes?.hp?.temp ?? ""),
      "Max HD": `${sys.attributes?.hd?.max ?? ""}d${sys.attributes?.hd?.denomination ?? ""}`,
      "Spent HD": String(sys.attributes?.hd?.spent ?? ""),

      // ── Stats ──
      "STR SCORE": String(abilities.str?.value ?? ""),
      "STR MOD": abilityMod("str"),
      "DEX SCORE": String(abilities.dex?.value ?? ""),
      "DEX MOD": abilityMod("dex"),
      "CON SCORE": String(abilities.con?.value ?? ""),
      "CON MOD": abilityMod("con"),
      "INT SCORE": String(abilities.int?.value ?? ""),
      "INT MOD": abilityMod("int"),
      "WIS SCORE": String(abilities.wis?.value ?? ""),
      "WIS MOD": abilityMod("wis"),
      "CHA SCORE": String(abilities.cha?.value ?? ""),
      "CHA MOD": abilityMod("cha"),

      // ── Combat ──
      init: mod(sys.attributes?.init?.total ?? 0),
      SPEED: String(sys.attributes?.movement?.walk ?? ""),
      SIZE: sys.traits?.size ?? "",
      "PASSIVE PERCEPTION": String(10 + (skills.prc?.total ?? 0)),
      "PROF BONUS": mod(sys.attributes?.prof ?? 0),

      // ── Saving throws ──
      "STR SAVE": saveVal("str"),
      "DEX SAVE": saveVal("dex"),
      "CON SAVE": saveVal("con"),
      "INT SAVE": saveVal("int"),
      "WIS MOD":  saveVal("wis"),   // PDF heeft geen WIS SAVE veld — staat in WIS MOD
      "CHA SAVE": saveVal("cha"),

      // ── Skills ──
      ACROBATICS: skillVal("acr"),
      "ANIMAL HANDLING": skillVal("ani"),
      ARCANA: skillVal("arc"),
      ATHLETICS: skillVal("ath"),
      DECEPTION: skillVal("dec"),
      HISTORY: skillVal("his"),
      INSIGHT: skillVal("ins"),
      INTIMIDATE: skillVal("itm"),
      INVESTIGATION: skillVal("inv"),
      MEDICINE: skillVal("med"),
      NATURE: skillVal("nat"),
      PERCEPTION: skillVal("prc"),
      PERFORMANCE: skillVal("prf"),
      PERSUASION: skillVal("per"),
      RELIGION: skillVal("rel"),
      "SLEIGHT OF HAND": skillVal("slt"),
      STEALTH: skillVal("ste"),
      SURVIVAL: skillVal("sur"),

      // ── Proficiencies ──
      LANGUAGES: [...(sys.traits?.languages?.value ?? [])].join(", "),
      "WEAPON PROF": [...(sys.traits?.weaponProf?.value ?? [])]
        .map(w => ({
          sim:       "Simple Weapons",
          mar:       "Martial Weapons",
          simpleM:   "Simple Melee",
          simpleR:   "Simple Ranged",
          martialM:  "Martial Melee",
          martialR:  "Martial Ranged",
        }[w] ?? w))
        .join(", "),
      "TOOL PROF": [...(sys.traits?.toolProf?.value ?? [])].join(", "),

      // ── Features ──
      "CLASS FEATURES 1": classFeatures,
      "SPECIES TRAITS": speciesTraits,
      FEATS: feats,
      EQUIPMENT: equipment,
      "EQUIPMENT 3": equipment3,
      "EQUIPMENT 4": equipment4,

      // ── Spellcasting ──
      "SPELLCASTING ABILITY": sys.attributes?.spellcasting ?? "",
      "SPELLCASTING MOD": mod(
        abilities[sys.attributes?.spellcasting]?.mod ?? 0
      ),
      // SPELL SAVE DC = 8 + prof bonus + spellcasting ability modifier
      "SPELL SAVE DC": (() => {
        const spellAbility = sys.attributes?.spellcasting;
        if (!spellAbility) return "";
        const abilityMod = abilities[spellAbility]?.mod ?? 0;
        const profBonus  = sys.attributes?.prof ?? 0;
        return String(8 + abilityMod + profBonus);
      })(),
      "SPELL ATTACK BONUS": mod(sys.attributes?.spellAttack ?? 0),

      // Herhaal spellcasting info op pagina 3 en 4
      "SPELLCASTING ABILITY 3": sys.attributes?.spellcasting ?? "",
      "SPELLCASTING MOD 3":     mod(abilities[sys.attributes?.spellcasting]?.mod ?? 0),
      "SPELL SAVE DC 3": (() => {
        const spellAbility = sys.attributes?.spellcasting;
        if (!spellAbility) return "";
        const abilityMod = abilities[spellAbility]?.mod ?? 0;
        const profBonus  = sys.attributes?.prof ?? 0;
        return String(8 + abilityMod + profBonus);
      })(),
      "SPELL ATTACK BONUS 3":   mod(sys.attributes?.spellAttack ?? 0),
      "SPELLCASTING ABILITY 4": sys.attributes?.spellcasting ?? "",
      "SPELLCASTING MOD 4":     mod(abilities[sys.attributes?.spellcasting]?.mod ?? 0),
      "SPELL SAVE DC 4": (() => {
        const spellAbility = sys.attributes?.spellcasting;
        if (!spellAbility) return "";
        const abilityMod = abilities[spellAbility]?.mod ?? 0;
        const profBonus  = sys.attributes?.prof ?? 0;
        return String(8 + abilityMod + profBonus);
      })(),
      "SPELL ATTACK BONUS 4":   mod(sys.attributes?.spellAttack ?? 0),

      // Spell slots
      "LVL1 TOTAL": String(spells?.spell1?.max ?? ""),
      "LVL2 TOTAL": String(spells?.spell2?.max ?? ""),
      "LVL3 TOTAL": String(spells?.spell3?.max ?? ""),
      "LVL4 TOTAL": String(spells?.spell4?.max ?? ""),
      "LVL5 TOTAL": String(spells?.spell5?.max ?? ""),
      "LVL6 TOTAL": String(spells?.spell6?.max ?? ""),
      "LVL7 TOTAL": String(spells?.spell7?.max ?? ""),
      "LVL8 TOTAL": String(spells?.spell8?.max ?? ""),
      "LVL9 TOTAL": String(spells?.spell9?.max ?? ""),

      // Munten — dnd5e 2024 gebruikt mogelijk andere pad
      CP: String(sys.currency?.cp ?? sys.attributes?.currency?.cp ?? ""),
      SP: String(sys.currency?.sp ?? sys.attributes?.currency?.sp ?? ""),
      EP: String(sys.currency?.ep ?? sys.attributes?.currency?.ep ?? ""),
      GP: String(sys.currency?.gp ?? sys.attributes?.currency?.gp ?? ""),
      PP: String(sys.currency?.pp ?? sys.attributes?.currency?.pp ?? ""),

      // Wapens (dynamisch uitgevouwen hieronder)
      ...this._weaponFields(weapons),

      // Spreuken (dynamisch uitgevouwen hieronder)
      ...this._spellFields(preparedSpells),
    };
  }

  // ─── Wapen helper ──────────────────────────────────────────────────────────

  _weaponFields(weapons) {
    const out = {};
    weapons.forEach((w, i) => {
      const n = i + 1;
      out[`NAME - WEAPON ${n}`] = w.name;
      out[`BONUS/DC - WEAPON ${n}`] = this._weaponBonus(w);
      out[`DAMAGE/TYPE - WEAPON ${n}`] = this._weaponDamage(w);
      out[`NOTES - WEAPON ${n}`] = w.system?.description?.value
        ? this._stripHtml(w.system.description.value).slice(0, 60)
        : "";
    });
    return out;
  }

  _weaponBonus(weapon) {
    const atk = weapon.system?.attack;
    if (!atk) return "";
    const total = (atk.bonus ?? 0) + (atk.flat ?? 0);
    return total >= 0 ? `+${total}` : `${total}`;
  }

  _weaponDamage(weapon) {
    const dmg = weapon.system?.damage?.base;
    if (!dmg) return "";
    return `${dmg.number ?? ""}d${dmg.denomination ?? ""} ${dmg.types?.[0] ?? ""}`.trim();
  }

  // ─── Spreuk helper ─────────────────────────────────────────────────────────

  _spellFields(spells) {
    const out = {};
    spells.forEach((s, i) => {
      out[`SPELL NAME${i}`]    = s.name;
      out[`SPELL LEVEL${i}`]   = String(s.system?.level ?? "");
      out[`CASTING TIME${i}`]  = s.system?.activation?.type ?? "";
      out[`RANGE${i}`]         = this._spellRange(s);
      out[`SPELL NOTES${i}`]   = this._spellFlags(s);
    });
    return out;
  }

  _spellRange(spell) {
    const r = spell.system?.range;
    if (!r) return "";
    if (r.units === "self") return "Self";
    if (r.units === "touch") return "Touch";
    return `${r.value ?? ""} ${r.units ?? ""}`.trim();
  }

  _spellFlags(spell) {
    const flags = [];
    if (spell.system?.duration?.concentration) flags.push("C");
    if (spell.system?.properties?.has("ritual")) flags.push("R");
    if (spell.system?.materials?.value) flags.push("M");
    return flags.join(" ");
  }

  // ─── Velden invullen ───────────────────────────────────────────────────────

  // Velden met vaste kleine font size
  _smallFontFields = {
    "CLASS FEATURES 1": 7,
    "CLASS FEATURES 2": 7,
    "SPECIES TRAITS":   7,
    "FEATS":            7,
    "EQUIPMENT":        7,
    "EQUIPMENT 3":      7,
    "EQUIPMENT 4":      7,
    "LANGUAGES":        8,
    "WEAPON PROF":      8,
    "TOOL PROF":        8,
    "PERSONALITY":      8,
    // Range en casting time velden — voorkomt grote letters bij korte waarden
    ...Object.fromEntries(
      Array.from({length: 90}, (_, i) => [
        [`RANGE${i}`, 8],
        [`CASTING TIME${i}`, 8],
      ]).flat()
    ),
    "CASTING TIM1":  8,   // hernoemd naar CASTING TIME11 in PDF — kan weg maar geen kwaad
  };

  _fillFields(form, data) {
    for (const [fieldName, value] of Object.entries(data)) {
      if (value === undefined || value === null || value === "") continue;
      try {
        const field = form.getTextField(fieldName);
        field.setText(String(value));

        // Forceer font size door DA string direct op de widget te zetten
        const fontSize = this._smallFontFields[fieldName];
        if (fontSize) {
          const widgets = field.acroField.getWidgets();
          for (const widget of widgets) {
            widget.dict.set(
              PDFLib.PDFName.of("DA"),
              PDFLib.PDFString.of(`/Helv ${fontSize} Tf 0 0 0 rg`)
            );
            widget.dict.delete(PDFLib.PDFName.of("AP"));
          }
          field.acroField.dict.set(
            PDFLib.PDFName.of("DA"),
            PDFLib.PDFString.of(`/Helv ${fontSize} Tf 0 0 0 rg`)
          );
        }
      } catch (e) {
        // getTextField mislukt — probeer via getFields()
        try {
          const match = form.getFields().find(f => f.getName() === fieldName);
          if (match) match.setText(String(value));
        } catch (_) {}
      }
    }

    // Skill proficiency checkboxes
    this._fillSkillCheckboxes(form);
  }

  _fillSkillCheckboxes(form) {
    const a = this.actor;
    const skills = a.system.skills;
    const abilities = a.system.abilities;

    // Map van skill-sleutel naar PDF checkbox naam
    const checkboxMap = {
      acr: "ACROBATICS CHK",
      ani: "ANIMAL HANDLING CHK",
      arc: "ARCANA CHK",
      ath: "ATHLETICS CHK",
      dec: "DECEPTION CHK",
      his: "HISTORY CHK",
      ins: "INSIGHT CHK",
      itm: "INTIMIDATION CHK",
      inv: "INVESTIGATION CHK",
      med: "MEDICINE CHK",
      nat: "NATURE CHK",
      prc: "PERCEPTION CHK",
      prf: "PERFORMANCE CHK",
      per: "PERSUASION CHK",
      rel: "RELIGION CHK",
      slt: "SLEIGHT OF HAND CHK",
      ste: "STEALTH CHK",
      sur: "SURVIVAL CHK",
    };

    const saveCheckboxMap = {
      str: "STR CHK SAVE",
      dex: "DEX CHK SAVE",
      con: "CON CHK SAVE",
      int: "INT CHK SAVE",
      wis: "WIS CHK SAVE",
      cha: "CHA CHK SAVE",
    };

    for (const [key, cbName] of Object.entries(checkboxMap)) {
      const profVal = skills[key]?.proficient ?? 0;
      if (profVal > 0) {
        try {
          form.getCheckBox(cbName).check();
        } catch (_) {}
      }
    }

    for (const [key, cbName] of Object.entries(saveCheckboxMap)) {
      const hasSaveProficiency =
        abilities[key]?.proficient ?? abilities[key]?.save?.proficient ?? false;
      if (hasSaveProficiency) {
        try {
          form.getCheckBox(cbName).check();
        } catch (_) {}
      }
    }

    // Armor training checkboxes
    const armorProf = a.system.traits?.armorProf?.value ?? new Set();
    const armorMap = {
      lgt: "CHK ARMOR LIGHT",
      med: "CHK ARMOR MEDIUM",
      hvy: "CHK ARMOR HEAVY",
      shl: "CHK ARMOR SHIELDS",
    };
    for (const [key, cbName] of Object.entries(armorMap)) {
      if (armorProf.has(key)) {
        try {
          form.getCheckBox(cbName).check();
        } catch (_) {}
      }
    }
  }

  // ─── Hulpfuncties ─────────────────────────────────────────────────────────

  _stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  _download(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.actor.name.replace(/[^a-z0-9]/gi, "_")}_character_sheet.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
