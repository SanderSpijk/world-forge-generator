/**
 * WorldForge – pdf-exporter-2014.js
 *
 * Vult het officiële D&D 5e 2014 fillable character sheet PDF in.
 * Veldnamen zijn rechtstreeks afgeleid van de AcroForm velden in de PDF.
 */

export class PdfExporter2014 {

  constructor(actor) {
    this.actor = actor;
  }

  // ─── Publieke methode ──────────────────────────────────────────────────────

  async export() {
    ui.notifications.info("PDF Export (2014) gestart…");
    try {
      const pdfBytes = await this._buildPdfBytes();
      const now        = new Date();
      const dateSuffix = `_${now.getHours().toString().padStart(2,"0")}${now.getMinutes().toString().padStart(2,"0")}${now.getDate().toString().padStart(2,"0")}${(now.getMonth()+1).toString().padStart(2,"0")}${now.getFullYear().toString().slice(-2)}`;
      saveDataToFile(pdfBytes, "application/pdf",
        `${this.actor.name.replace(/[^a-z0-9]/gi, "_")}_2014_character_sheet${dateSuffix}.pdf`);
      ui.notifications.info("PDF gedownload!");
    } catch (err) {
      console.error("WorldForge | PDF 2014 export fout:", err);
      ui.notifications.error(`PDF export mislukt: ${err.message}`);
    }
  }

  async _buildPdfBytes() {
    await this._loadPdfLib();
    return this._buildPdf();
  }

  // ─── PDF-lib laden ─────────────────────────────────────────────────────────

  async _loadPdfLib() {
    if (window.PDFLib) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
      script.onload  = resolve;
      script.onerror = () => reject(new Error("Kon pdf-lib niet laden."));
      document.head.appendChild(script);
    });
  }

  // ─── PDF bouwen ────────────────────────────────────────────────────────────

  async _buildPdf() {
    const { PDFDocument } = PDFLib;

    const templateUrl = `modules/world-forge-generator/data/5E_CharacterSheet_Fillable.pdf`;
    const response    = await fetch(templateUrl);
    if (!response.ok)
      throw new Error(`Kon template PDF niet laden (${response.status}).`);

    const pdfDoc = await PDFDocument.load(await response.arrayBuffer(), {
      ignoreEncryption: true
    });

    const form = pdfDoc.getForm();
    const data = this._extractActorData();
    this._fillFields(form, data);
    this._fillCheckboxes(form);
    form.flatten();

    return pdfDoc.save();
  }

  // ─── Actor data ────────────────────────────────────────────────────────────

  _extractActorData() {
    const a   = this.actor;
    const sys = a.system;
    const ab  = sys.abilities;
    const sk  = sys.skills;
    const sp  = sys.spells;

    const mod  = (v) => v >= 0 ? `+${v}` : `${v}`;
    const abMod = (k) => mod(Math.floor((ab[k].value - 10) / 2));
    const skVal = (k) => mod(sk[k]?.total ?? 0);
    const stVal = (k) => mod(ab[k]?.saveBonus ?? ab[k]?.save?.value ?? 0);

    const weapons = a.items.filter(i => i.type === "weapon").slice(0, 3);

    const classItem    = a.items.find(i => i.type === "class");
    const classLevel   = classItem
      ? `${classItem.name} ${classItem.system?.levels ?? sys.details?.level ?? ""}`
      : String(sys.details?.level ?? "");

    const features = a.items
      .filter(i => ["feat","background"].includes(i.type) ||
                   (i.type === "feat" && i.system?.type?.value))
      .map(i => `${i.name}: ${this._stripHtml(i.system?.description?.value ?? "")}`.slice(0, 200))
      .join("\n");

    const equipment = a.items
      .filter(i => !["weapon","spell","feat","background","class","subclass"].includes(i.type))
      .map(i => `${i.name}${i.system?.quantity > 1 ? ` x${i.system.quantity}` : ""}`)
      .join("\n");

    // Spreuken — gesorteerd op level, naam per regel
    const spellsByLevel = {};
    a.items.filter(i => i.type === "spell").forEach(s => {
      const lvl = s.system?.level ?? 0;
      if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
      spellsByLevel[lvl].push(s.name);
    });

    return {
      // ── Basisinfo ──
      CharacterName:    a.name,
      ClassLevel:       classLevel,
      Background:       sys.details?.background?.name ?? sys.details?.background ?? "",
      PlayerName:       game.user?.name ?? "",
      "Race ":          sys.details?.race?.name ?? sys.details?.race ?? "",
      Alignment:        sys.details?.alignment ?? "",
      XP:               String(sys.details?.xp?.value ?? ""),

      // ── Stats ──
      STR:    String(ab.str?.value ?? ""),
      STRmod: abMod("str"),
      DEX:    String(ab.dex?.value ?? ""),
      "DEXmod ": abMod("dex"),
      CON:    String(ab.con?.value ?? ""),
      CONmod: abMod("con"),
      INT:    String(ab.int?.value ?? ""),
      INTmod: abMod("int"),
      WIS:    String(ab.wis?.value ?? ""),
      WISmod: abMod("wis"),
      CHA:    String(ab.cha?.value ?? ""),
      CHamod: abMod("cha"),

      // ── Combat ──
      AC:           String(sys.attributes?.ac?.value ?? ""),
      Initiative:   mod(sys.attributes?.init?.total ?? 0),
      Speed:        String(sys.attributes?.movement?.walk ?? ""),
      HPMax:        String(sys.attributes?.hp?.max ?? ""),
      HPCurrent:    String(sys.attributes?.hp?.value ?? ""),
      HPTemp:       String(sys.attributes?.hp?.temp ?? ""),
      HDTotal:      String(sys.attributes?.hd?.max ?? ""),
      HD:           `d${sys.attributes?.hd?.denomination ?? ""}`,
      Inspiration:  String(sys.attributes?.inspiration ? 1 : ""),
      ProfBonus:    mod(sys.attributes?.prof ?? 0),
      Passive:      String(10 + (sk.prc?.total ?? 0)),

      // ── Saving throws ──
      "ST Strength":     stVal("str"),
      "ST Dexterity":    stVal("dex"),
      "ST Constitution": stVal("con"),
      "ST Intelligence": stVal("int"),
      "ST Wisdom":       stVal("wis"),
      "ST Charisma":     stVal("cha"),

      // ── Skills ──
      Acrobatics:      skVal("acr"),
      Animal:          skVal("ani"),
      Arcana:          skVal("arc"),
      Athletics:       skVal("ath"),
      "Deception ":    skVal("dec"),
      "History ":      skVal("his"),
      Insight:         skVal("ins"),
      Intimidation:    skVal("itm"),
      "Investigation ":skVal("inv"),
      Medicine:        skVal("med"),
      Nature:          skVal("nat"),
      "Perception ":   skVal("prc"),
      Performance:     skVal("prf"),
      Persuasion:      skVal("per"),
      Religion:        skVal("rel"),
      SleightofHand:   skVal("slt"),
      "Stealth ":      skVal("ste"),
      Survival:        skVal("sur"),

      // ── Proficiencies ──
      ProficienciesLang: [
        ...(sys.traits?.languages?.value ?? []),
        ...(sys.traits?.weaponProf?.value ?? []),
        ...(sys.traits?.toolProf?.value ?? []),
        ...(sys.traits?.armorProf?.value ?? []),
      ].join(", "),

      // ── Uitrusting & Features ──
      Equipment:          equipment,
      "Feat+Traits":      features,
      "Features and Traits": features,

      // ── Munten ──
      CP: String(sys.currency?.cp ?? ""),
      SP: String(sys.currency?.sp ?? ""),
      EP: String(sys.currency?.ep ?? ""),
      GP: String(sys.currency?.gp ?? ""),
      PP: String(sys.currency?.pp ?? ""),

      // ── Achtergrond (pagina 2) ──
      "CharacterName 2": a.name,
      Backstory: sys.details?.biography?.value
        ? this._stripHtml(sys.details.biography.value).slice(0, 1000)
        : "",
      PersonalityTraits: this._stripHtml(sys.details?.trait ?? ""),
      Ideals:  this._stripHtml(sys.details?.ideal ?? ""),
      Bonds:   this._stripHtml(sys.details?.bond ?? ""),
      Flaws:   this._stripHtml(sys.details?.flaw ?? ""),

      // ── Spellcasting (pagina 3) ──
      "Spellcasting Class 2":  classItem?.name ?? "",
      "SpellcastingAbility 2": sys.attributes?.spellcasting ?? "",
      "SpellSaveDC  2":        String(sys.attributes?.spelldc ?? ""),
      "SpellAtkBonus 2":       mod(sys.attributes?.spellAttack ?? 0),

      // Spell slots
      "SlotsTotal 19":     String(sp?.spell1?.max ?? ""),
      "SlotsRemaining 19": String(sp?.spell1?.value ?? ""),
      "SlotsTotal 20":     String(sp?.spell2?.max ?? ""),
      "SlotsRemaining 20": String(sp?.spell2?.value ?? ""),
      "SlotsTotal 21":     String(sp?.spell3?.max ?? ""),
      "SlotsRemaining 21": String(sp?.spell3?.value ?? ""),
      "SlotsTotal 22":     String(sp?.spell4?.max ?? ""),
      "SlotsRemaining 22": String(sp?.spell4?.value ?? ""),
      "SlotsTotal 23":     String(sp?.spell5?.max ?? ""),
      "SlotsRemaining 23": String(sp?.spell5?.value ?? ""),
      "SlotsTotal 24":     String(sp?.spell6?.max ?? ""),
      "SlotsRemaining 24": String(sp?.spell6?.value ?? ""),
      "SlotsTotal 25":     String(sp?.spell7?.max ?? ""),
      "SlotsRemaining 25": String(sp?.spell7?.value ?? ""),
      "SlotsTotal 26":     String(sp?.spell8?.max ?? ""),
      "SlotsRemaining 26": String(sp?.spell8?.value ?? ""),
      "SlotsTotal 27":     String(sp?.spell9?.max ?? ""),
      "SlotsRemaining 27": String(sp?.spell9?.value ?? ""),

      // Wapens
      ...this._weaponFields(weapons),

      // Spreuken
      ...this._spellFields(spellsByLevel),
    };
  }

  // ─── Wapen helper ──────────────────────────────────────────────────────────

  _weaponFields(weapons) {
    const out  = {};
    const names  = ["Wpn Name",   "Wpn Name 2",    "Wpn Name 3"];
    const atk    = ["Wpn1 AtkBonus", "Wpn2 AtkBonus ", "Wpn3 AtkBonus  "];
    const dmg    = ["Wpn1 Damage",   "Wpn2 Damage ",   "Wpn3 Damage "];

    weapons.forEach((w, i) => {
      out[names[i]] = w.name;
      const atkData = w.system?.attack;
      if (atkData) {
        const total = (atkData.bonus ?? 0) + (atkData.flat ?? 0);
        out[atk[i]] = total >= 0 ? `+${total}` : `${total}`;
      }
      const dmgData = w.system?.damage?.base;
      if (dmgData) {
        out[dmg[i]] = `${dmgData.number ?? ""}d${dmgData.denomination ?? ""} ${dmgData.types?.[0] ?? ""}`.trim();
      }
    });
    return out;
  }

  // ─── Spreuk helper ─────────────────────────────────────────────────────────

  _spellFields(spellsByLevel) {
    const out = {};

    // Veldnamen per level — afgeleid uit de AcroForm velden
    // Patroon: 'Spells 1014' t/m 'Spells 1099' + 'Spells 10100' e.v.
    // Level 0 (cantrips): Spells 1014–1021 (8 velden)
    // Level 1: Spells 1022–1034 (13 velden)
    // Level 2: Spells 1035–1045 (11 velden)
    // Level 3: Spells 1046–1058 (13 velden)
    // Level 4: Spells 1059–1069 (11 velden)
    // Level 5: Spells 1070–1079 (10 velden)
    // Level 6: Spells 1080–1087 (8 velden)
    // Level 7: Spells 1088–1095 (8 velden)
    // Level 8: Spells 1096–1099 + 10100–10103 (8 velden)
    // Level 9: Spells 10104–10113 (10 velden)

    const levelRanges = {
      0: { start: 14,    count: 8  },
      1: { start: 22,    count: 13 },
      2: { start: 35,    count: 11 },
      3: { start: 46,    count: 13 },
      4: { start: 59,    count: 11 },
      5: { start: 70,    count: 10 },
      6: { start: 80,    count: 8  },
      7: { start: 88,    count: 8  },
      8: { start: 96,    count: 8  },
      9: { start: 104,   count: 10 },
    };

    for (const [lvl, { start, count }] of Object.entries(levelRanges)) {
      const spells = spellsByLevel[parseInt(lvl)] ?? [];
      for (let i = 0; i < count; i++) {
        const fieldNum = start + i;
        const fieldName = fieldNum < 100
          ? `Spells 10${fieldNum}`
          : `Spells 1${fieldNum}`;
        out[fieldName] = spells[i] ?? "";
      }
    }

    return out;
  }

  // ─── Velden invullen ───────────────────────────────────────────────────────

  _fillFields(form, data) {
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined || value === null || value === "") continue;
      try {
        form.getTextField(name).setText(String(value));
      } catch (_) {}
    }
  }

  _fillCheckboxes(form) {
    const a   = this.actor;
    const sk  = a.system.skills;
    const ab  = a.system.abilities;

    // Skill proficiency checkboxen — Check Box 11 t/m 28 in volgorde van de PDF
    const skillOrder = [
      "acr","ani","arc","ath","dec","his","ins","itm",
      "inv","med","nat","prc","prf","per","rel","slt","ste","sur"
    ];
    skillOrder.forEach((key, i) => {
      const profVal = sk[key]?.proficient ?? 0;
      if (profVal > 0) {
        try { form.getCheckBox(`Check Box ${11 + i}`).check(); } catch (_) {}
      }
    });

    // Saving throw proficiency checkboxen — Check Box 35-40
    const saveOrder = ["str","dex","con","int","wis","cha"];
    saveOrder.forEach((key, i) => {
      const prof = ab[key]?.proficient ?? ab[key]?.save?.proficient ?? false;
      if (prof) {
        try { form.getCheckBox(`Check Box ${35 + i}`).check(); } catch (_) {}
      }
    });
  }

  // ─── Hulpfuncties ─────────────────────────────────────────────────────────

  _stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
}
