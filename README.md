# WorldForge Generator

**Foundry VTT module voor het genereren van willekeurige NPCs, winkels, herbergen, schepen, steden, criminele organisaties, facties, gebouwen/POIs, weer, loot en magische items.**

Systeem: D&D 5e | Foundry-versie: v13+

---

## 🎲 Wat doet WorldForge?

WorldForge Generator vereenvoudigt het voorbereiden van D&D campagnes door alles te genereren wat je nodig hebt:

- **NPCs**: Karakters met unieke uiterlijken, persoonlijkheden, vaardigheden en backstories
- **Winkels**: Thema-aware winkels met assortimenten en shopkeepers
- **Herbergen & Tavernen**: Compleet met gastenlijsten, gerechten, drankjes en sfeer
- **Schepen**: PC-ships en NPC-schepen met bemanning en specs
- **Steden**: Volledige steden met districten, gebouwen, criminele organisaties, facties
- **Gebouwen & POIs**: Points of Interest gefilterd op biome en thema
- **Magische Items**: Gevarieerde unieke items op basis van rariteit
- **Buit**: Goud, munten, en items op basis van loot tier
- **Weer**: Dynamisch weer per thema met temperatuur en windkracht
- **Loot Tables**: Integratie met Foundry Rollable Tables

**Thema-aware**: Alle gegenereerde content past zich aan aan je campaign theme (Medieval, Gothic, Tropical, Desert, Nordic, Asian, Greek, Caribbean).

---

## 🚀 Installatie

### Stap 1: Module toevoegen aan Foundry

1. Open Foundry VTT
2. Ga naar **Settings → Modules**
3. Klik **Install Module**
4. Plak deze URL in het zoekveld:
   ```
   https://github.com/[owner]/world-forge-generator/releases/download/v0.9.3/module.json
   ```
   (Of voeg de module handmatig toe in je modules folder)
5. Klik **Install**

### Stap 2: Module activeren

1. Ga naar **Settings → Manage Modules**
2. Vind **WorldForge Generator**
3. Vink het selectievakje aan om te activeren
4. **Belangrijk**: Herstart Foundry (F5 in browser)

### Stap 3: Loot Rollable Tables aanmaken (VERPLICHT voor Loot Generator)

De Loot Generator vereist Rollable Tables om te werken. Je hebt twee opties:

#### Optie A: **AUTOMATISCH (Aanbevolen)** ⚡

1. Open WorldForge UI (D20 knop in toolbar)
2. Ga naar **Tools → Loot Tables Setup**
3. Klik **Setup Loot Tables**
4. Alle 16 tabellen worden automatisch aangemaakt in een "WorldForge Loot" folder

Dit is het snelste! De tabellen worden met placeholder-items gemaakt die je daarna zelf kunt vullen.

#### Optie B: Handmatig aanmaken

Als je voorkeur hebt voor handmatig beheer:

1. In Foundry: **Scenes → Rollable Tables**
2. Klik **Create Table**
3. Geef de tabel een naam (bijv. `Loot - Valuables - Common`)
4. Voeg items toe (zie instructies hieronder)

#### Benodigde tabellen:

| Tabel naam | Items |
|-----------|-------|
| `Loot - Consumables - Common` | Healing potions, rations, rope, etc. |
| `Loot - Consumables - Uncommon` | Scrolls, herbs, rare ingredients |
| `Loot - Consumables - Rare` | Rare potions, powerful scrolls |
| `Loot - Consumables - Very Rare` | Legendary potions, rare books |
| `Loot - Consumables - Legendary` | Artifacts, legendary scrolls |
| `Loot - Valuables - Common` | Gems, jewelry (common) |
| `Loot - Valuables - Uncommon` | Better gems, art objects |
| `Loot - Valuables - Rare` | Rare art, valuable gems |
| `Loot - Valuables - Very Rare` | Zeer zeldzame schatten |
| `Loot - Valuables - Legendary` | Onschatbare artefacten |
| `Loot - Permanent - Common` | Common magical items |
| `Loot - Permanent - Uncommon` | Uncommon magical items |
| `Loot - Permanent - Rare` | Rare magical items |
| `Loot - Permanent - Very Rare` | Very rare magical items |
| `Loot - Permanent - Legendary` | Legendary magical items |
| `Loot - Permanent - Books` | Spellbooks, grimoires, tomes |

#### Items toevoegen & Weight (Rarity) instellen:

1. Open een Rollable Table
2. Klik **Add Result**
3. Voer item beschrijving in (bijv. "Amber Gemstone (500 GP)")
4. Stel **Weight** in op basis van rarity:
   - **Rarity: Common** → Weight 10 (veel voorkomend)
   - **Rarity: Uncommon** → Weight 5 (normaal)
   - **Rarity: Rare** → Weight 2 (zeldzaam)
   - **Rarity: Very Rare** → Weight 1 (zeer zeldzaam)
   - **Rarity: Legendary** → Weight 0.5 (bijna nooit)

**Hoe weight werkt**: Een item met weight 10 is 10× vaker dan een item met weight 1.

**Voorbeelden**:
- 5 Common items (weight 10 elk) vs 1 Legendary (weight 0.5) = 100:0.5 ratio
- Zet veel items in de tabel voor meer variatie

**Snelle import tip**: Items uit D&D 5e SRD compendiums:
- Open **SRD Magic Items** compendium
- Sleep items naar de Rollable Table
- Stel weight daarna in op basis van item rarity

---

## ⚙️ Settings Configuratie

1. Open **Settings → Configure Settings**
2. Zoek naar **WorldForge Generator**
3. Configureer de volgende instellingen:

### Basis Instellingen

| Instelling | Opties | Standaard | Beschrijving |
|-----------|--------|-----------|-------------|
| **Generator Taal** | NL / EN | NL | Taal voor gegenereerde content |
| **Campaign Theme** | Medieval, Gothic, Asian, Desert, Nordic, Greek, Caribbean, Custom | Medieval | Theme voor thema-aware content (winkels, gebouwen, weer) |
| **Campaign Theme Tags** | (custom) | empty | Extra tags voor custom theme filtering (optioneel) |
| **Campaign Theme Negatives** | (custom) | empty | Uitsluiten bepaalde elementen (bijv. "magic-heavy") |
| **Show Ship (PC)** | On / Off | On | Toon PC-ship generator in World nav |

### ComfyUI Instellingen (voor AI artwork)

| Instelling | Voorbeeld | Standaard | Beschrijving |
|-----------|-----------|-----------|-------------|
| **ComfyUI Server URL** | `http://127.0.0.1:8188` | `http://127.0.0.1:8188` | Lokale of remote ComfyUI server |
| **Default Style Prompt** | "fantasy art, digital painting" | "fantasy art" | Base style voor AI artwork |

---

## 🎨 ComfyUI Setup (Optioneel voor AI Artwork)

WorldForge kan ComfyUI gebruiken om automatisch artwork te genereren voor NPCs, magische items, en andere content.

### ComfyUI Installatie

1. **Installeer ComfyUI** (als je het nog niet hebt):
   - Clone of download van https://github.com/comfyanonymous/ComfyUI
   - Volg installation instructions in de ComfyUI repo

2. **Start ComfyUI server**:
   ```bash
   python main.py
   ```
   Server draait op `http://127.0.0.1:8188`

### Foundry Koppeling

1. Open Foundry **Settings → Configure Settings**
2. Zoek **WorldForge Generator → ComfyUI Server URL**
3. Voer server URL in:
   ```
   http://127.0.0.1:8188
   ```
   (Of remote URL indien ComfyUI op ander systeem draait)

4. **Asset folders worden automatisch aangemaakt!** ✨
   
   WorldForge maakt deze folders automatisch aan bij de eerste keer laden:
   
   ```
   FoundryVTT/Data/assets/WorldForge/
   ├── Buildings/         (voor gebouwen/POIs)
   ├── CharacterArt/      (voor NPCs)
   └── Items/             (voor magische items)
   ```
   
   **Niets handmatig te doen!** De folders verschijnen automatisch in je File Browser wanneer je WorldForge voor het eerst laadt. Dit gebeurt op de achtergrond en je ziet het in de console logs.
   
   > 💡 **Tip**: Als je wilt controleren dat ze aangemaakt zijn, check **File Browser → Assets** in Foundry. Je ziet "WorldForge" folder met de 3 subfolders.

5. Test de verbinding:
   - Open WorldForge UI (D20 knop in toolbar)
   - Genereer een NPC
   - Klik **Generate Artwork**
   - Als succesvol: ComfyUI icoon verschijnt groen in WorldForge
   - Artwork wordt opgeslagen in `CharacterArt/` folder

### ComfyUI Workflow

WorldForge gebruikt standaard ComfyUI workflow voor:
- **NPC Portretten**: Bepaald op basis van race, uiterlijk, gender
- **Magische Item Artwork**: Rariteit en item type bepalen stijl
- **Gebouwen/POIs**: Biome en architectuurstijl bepalen uiterlijk

**Opmerking**: ComfyUI moet actief draaien. Als WorldForge ComfyUI niet kan bereiken, worden artwork-knoppen verborgen (maar generatie werkt normaal).

---

## 📖 Gebruik

### WorldForge UI openen

1. Klik de **D20 knop** in de toolbar (bovenaan links)
2. Of gebruik commando in console: `game.worldforge.open()`

### Generators beschikbaar

**People (Mensen)**
- NPC Generator

**Places (Plaatsen)**
- Shop Generator
- Inn/Tavern Generator
- Market Stall Generator
- House/Family Generator

**Adventure (Avontuur)**
- Loot Generator
- Magic Item Generator
- Weather Generator

**World (Wereld)**
- City Generator
- Criminal Organisation Generator
- Faction Generator
- POI/Building Generator
- Ship Generator (PC & NPC)

**Tools**
- PDF Export (alle gegenereerde items exporteren naar PDF)

### Gegenereerde Items Opslaan

**Naar Campaign Codex** (optioneel, vereist Campaign Codex module):
- Gegenereerde items hebben knop **Save to Codex**
- Maakt automatisch journal entry aan

**Naar Character Actor**:
- NPCs hebben knop **Create Actor**
- Maakt automatisch karaktersheet aan in Foundry

**Naar Chat**:
- Alle items kunnen gepost naar chat
- Drag & drop naar canvas voor tokens/markers

---

## 🐛 Troubleshooting

### "ComfyUI bereikbaar, maar artwork genereert niet"

**Oorzaken**:
- ComfyUI model missing
- Workflow corrupt
- VRAM insufficient

**Oplossing**:
1. Check ComfyUI console voor errors
2. Zorg dat standaard SDXL model gedownload is
3. Herstart ComfyUI server
4. Check URL in Foundry settings

### "Loot Generator zegt: Rollable table not found"

**Oorzaken**:
- Juiste tabel niet aangemaakt
- Tabel naam is anders (case-sensitive!)

**Oplossing**:
1. Maak tabel aan met EXACT juiste naam (hoofdletters tellen!)
2. Zorg dat tabel minstens 1 item bevat
3. Refresh Foundry (F5)

### "Gegenereerde NPCs hebben verkeerde taal"

**Oorzaak**: Generator Taal setting is niet ingesteld

**Oplossing**:
1. Ga naar **Settings → Configure Settings → WorldForge Generator**
2. Stel **Generator Taal** in op **NL** of **EN**
3. Refresh Foundry

### "Theme-aware filtering werkt niet"

**Oorzaak**: Campaign Theme niet correct ingesteld

**Oplossing**:
1. Stel **Campaign Theme** in op correcte waarde
2. Zorg dat theme match met beschikbare opties:
   - Medieval, Gothic, Asian, Desert, Nordic, Greek, Caribbean
3. Genereer nieuw item

---

## 💾 Gegevensopslag

WorldForge slaat alles op in de **Foundry world database** (niet extern):
- Settings worden opgeslagen in `world.json`
- Gegenereerde items kunnen naar Rollable Tables of Actors gaan
- Campaign Codex items worden in Journal entries opgeslagen

**Backup**: Reguliere world backups beveiligen ook WorldForge data!

---

## 🔒 Privacy & Beveiliging

- ✅ Alles draait lokaal (geen data naar cloud)
- ✅ ComfyUI artwork generatie: optioneel (kan lokaal draaien)
- ✅ Geen tracking of analytics
- ✅ Geen authenticatie vereist

---

## 📝 Licentie

[Vul in: MIT, CC, etc.]

---

## 🐙 GitHub & Updates

**Repository**: https://github.com/[owner]/world-forge-generator
**Issues rapporteren**: https://github.com/[owner]/world-forge-generator/issues
**Feature requests**: https://github.com/[owner]/world-forge-generator/discussions

---

## 🙏 Credits

- **D&D 5e System Reference Document** (SRD)
- **Foundry VTT** for the amazing VTT framework
- **ComfyUI** for AI image generation
- **Campaign Codex** for journal integration

---

## FAQ

**V: Kan ik offline werken?**
A: Ja! WorldForge werkt volledig offline. ComfyUI is optioneel voor artwork.

**V: Werkt dit met andere D&D systemen (Pathfinder, etc)?**
A: Nee, WorldForge is D&D 5e-specifiek. Andere systemen kunnen problemen geven.

**V: Kan ik custom content toevoegen?**
A: Momenteel niet via UI, maar je kunt JSON files in de data/ folder editten voor custom generators.

**V: Hoe update ik naar nieuwe versie?**
A: Foundry update module automatisch via **Settings → Manage Modules**. Herstart Foundry daarna (F5).

**V: Kan ik gebruikersverwachtingen zetten op gegenereerde artwork?**
A: ComfyUI output varieert. Voor consistency, probeer: "D&D fantasy art, 4k, digital painting"

---

**Vragen?** Maak een issue op GitHub of vraag in de Foundry community!

Veel plezier met WorldForge! 🎲✨
