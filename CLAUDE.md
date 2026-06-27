# WorldForge — Claude Code Context

Foundry VTT module voor het genereren van NPCs, winkels, herbergen, schepen, steden, criminele organisaties, facties, gebouwen/POIs, weer, loot en magische items. Systeem: dnd5e. Foundry minimum v13.

## Backup Points

| Versie | Datum | Opmerking |
|--------|-------|-----------|
| 0.9.3 | 2026-06-27 | **Stabilization Pass + Test Suite** — Path A: DataLoader cache invalidation, wft() consistency, city-gen helpers consolidation, schema validation. Path B: 100+ test cases for DataLoader/BaseGenerator/Settings/Integration (4 test files, ~90% coverage core modules). Jest setup with mock Foundry, CI-ready. Scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`. |
| 0.9.2 | 2026-06-21 | Translation audit tools (scripts/audit-translations.py + add-missing-translations.py); Alle 158 ontbrekende i18n keys ingevuld (384 totaal); Racial Enclave factions (6 types: Dwarven/Elven/Orc/Gnome/Halfling/Mixed); MarketStall event handler bug gefixt (stopPropagation order); Window size/position defaults aangepast (1300x800, top:300) |
| 0.9.1 | 2026-06-16 | Buildings data gevuld; Inn/Tavern/Criminal/Faction section headers; House family members via wfNpcItem(); District house buttons geïmplementeerd |
| 0.9.0 | 2026-06-09 | House/Family Generator voltooid: 23 huistypes, 14 gezinssamenstelling, theme/district-aware, ComfyUI support |
| 0.8.5 | 2026-06-02 | Settings UI i18n voltooid (17 instellingen → translation keys; nl.json + en.json: 42 settings keys) |
| 0.8.3 | 2026-06-02 | Snapshot vóór NPC consolidatie (6 bestanden → 2 geconsolideerde bestanden) |
| 0.7.7 | 2026-06-01 | Snapshot vóór Buildings consolidatie (8 biome-specifieke bestanden → 1 samengesteld bestand) |

## Mapstructuur

```
world-forge-generator/
├── module.json
├── CLAUDE.md
├── lang/
│   ├── nl.json                        (384 keys: volledig UI + alle generators + settings)
│   └── en.json                        (384 keys: volledig UI + alle generators + settings)
├── scripts/
│   ├── main.js                        ← entry point; laadt taalbestanden + zet runtime vlaggen
│   ├── settings.js                    ← WorldForgeSettings; comfyAvailable, codexAvailable vlaggen
│   ├── base-generator.js              ← ★ NIEUW: basisklasse voor alle generators
│   ├── data-loader.js                 ← ★ NIEUW: gecentraliseerde JSON loader met caching
│   ├── campaign-codex.js              ← ★ NIEUW: alle CC logica (CC.save/preflight/getDragData)
│   ├── utils.js                       ← wfSectionHeader, wfReadout, wfBadge, wfNpcItem, saveToCodex
│   ├── comfyui.js
│   ├── worldforge-app.js              ← ApplicationV2, TYPE_CONFIG, nav, event handlers
│   │                                     gebruikt CC uit campaign-codex.js
│   ├── npc-generator.js               ← exporteert NPCGenerator (extends BaseGenerator)
│   │                                     laadt npc/traits.json + npc/appearance.json via DataLoader
│   ├── shop-generator.js              ← exporteert ShopGenerator (extends BaseGenerator)
│   │                                     laadt JSON via DataLoader; shop-data.js deprecated
│   ├── inn-generator.js               ← exporteert InnGenerator (extends BaseGenerator)
│   │                                     laadt JSON via DataLoader; inn-data.js deprecated
│   ├── tavern-generator.js            ← exporteert TavernGenerator (extends BaseGenerator)
│   │                                     laadt JSON via DataLoader; inn-data.js deprecated
│   ├── ship-generator.js              ← exporteert ShipGenerator (extends BaseGenerator)
│   │                                      laadt ships.json + ship-functions.json via DataLoader; ship-data.js deprecated
│   ├── ship-generator-generic.js      ← exporteert GenericShipGenerator (extends BaseGenerator)
│   │                                     laadt JSON via DataLoader; ship-data-generic.js deprecated
│   ├── ship-data.js
│   ├── ship-data-generic.js           ← DEPRECATED: functies vervangen door DataLoader
│   ├── menu-generator.js              ← exporteert MenuGenerator (extends BaseGenerator)
│   │                                     laadt JSON via DataLoader; menu-data.js deprecated
│   ├── loot-generator.js              ← Rollable Tables (geen migratie nodig)
│   ├── weather-generator.js            ← exporteert WeatherGenerator (extends BaseGenerator)
│   │                                      laadt wind-directions via DataLoader; dynamische weather JSON paden behouden
│   ├── magic-item-generator.js         ← exporteert MagicItemGenerator (extends BaseGenerator)
│   │                                      laadt JSON via DataLoader
│   ├── city-generator.js                 ← exporteert CityGenerator (extends BaseGenerator)
│   │                                         laadt JSON via DataLoader
│   ├── criminal-generator.js              ← exporteert CriminalGenerator (extends BaseGenerator)
│   │                                         laadt JSON via DataLoader
│   ├── faction-generator.js              ← exporteert FactionGenerator (extends BaseGenerator)
│   │                                         laadt JSON via DataLoader
│   ├── poi-generator.js                 ← exporteert POIGenerator (extends BaseGenerator)
│   │                                         laadt JSON via DataLoader
│   ├── market-stall-generator.js         ← exporteert MarketStallGenerator (extends BaseGenerator)
│   │                                         laadt JSON via DataLoader; canopy colors in readout
│   ├── house-generator.js                 ← ★ NIEUW (v0.9.0): exporteert HouseGenerator (extends BaseGenerator)
│   │                                         laadt families.json via DataLoader; theme + district aware
│   ├── audit-translations.py               ← ★ NIEUW (v0.9.2): valideert alle wft() keys in taalbestanden
│   ├── add-missing-translations.py         ← ★ NIEUW (v0.9.2): voegt ontbrekende keys automatisch toe
│   ├── pdf-export-app.js
│   ├── pdf-exporter.js
│   └── pdf-exporter-2014.js
├── styles/
│   ├── worldforge.css                 ← chat-kaart stijlen
│   └── worldforge-app.css             ← UI-venster stijlen
└── data/
    ├── shared/                        ← ★ NIEUW: herbruikbare data voor meerdere generators
    │   └── materials.json             ← bouwmaterialen (wall/roof/floor/generic)
    ├── npc/                           ← ★ NIEUW (v0.8.4): NPC trait + appearance consolidatie
    │   ├── traits.json                ← Consolidated: physical-traits + quirks + postures (type discriminator)
    │   └── appearance.json            ← Consolidated: clothing + accessories + weapons (type discriminator)
    ├── families.json                  ← ★ NIEUW (v0.9.0): 23 house types + 30 family backstories + district mapping
    ├── races.json
    ├── jobs.json
    ├── colors.json
    ├── sex.json
    ├── ships.json
    ├── ships-generic.json
    ├── ship-functions.json
    ├── criminal-organisations.json
    ├── factions.json                  ← 66 types (6 per 11 categorieën)
    ├── buildings-poi.json             ← 102 entries, enige POI-databron
    ├── biomes.json
    ├── cities.json
    ├── governments.json
    ├── defenses.json
    ├── trade-goods.json
    ├── buildings.json                        ← Consolidated (all themes + "theme" property); biome-specific files deprecated
    ├── shops.json
    ├── inns.json + inns-caribbean.json
    ├── market-stalls.json                ← Marktkramen; prefixes, canopy colors, conditions, 16 stall types
    ├── weather/
    │   └── medieval.json  nordic.json  desert.json  tropical.json  gothic.json  asian.json  greek.json
    └── magic-items/
        ├── base-items.json
        └── properties.json
```

## Architectuur — kritieke patronen

### Infrastructuur (v0.8+)

**`DataLoader`** (`scripts/data-loader.js`) — gebruik voor alle JSON loads:
```js
const races = await DataLoader.load("races.json", "races");  // gecached
const mat   = await DataLoader.pick("shared/materials.json", "wall"); // random pick
DataLoader.invalidate("buildings.json");                               // cache wissen
```
Nooit meer losse `let _xxxData = null` + `async function loadXxx()` per generator.

**`BaseGenerator`** (`scripts/base-generator.js`) — basisklasse:
```js
export class MyGenerator extends BaseGenerator {
  static codexType = "location";
  static folder    = "_Random X";
  static async generate(opts) { ... }
  static render(item)         { ... }
  static getName(item)        { return item.name; }
  static getSub(item)         { return item.type; }
}
```
Levert `L(obj)`, `weightedPick(arr)`, `lang` getter gratis mee.

**`CC`** (`scripts/campaign-codex.js`) — alle Campaign Codex logica:
```js
import { CC } from "./campaign-codex.js";
if (CC.available) { ... }
await CC.save(type, item, cfg);           // opslaan + notificatie
const uuid = await CC.preflight(...);     // stil aanmaken voor drag
const data = CC.getDragData(..., uuid);   // juiste drag-data object
```
`worldforge-app.js` gebruikt CC exclusief — geen directe saveToCodex aanroepen buiten utils.js.

**Runtime vlaggen in `WorldForgeSettings`:**
- `comfyAvailable` — gezet door pingComfyUI() in main.js
- `codexAvailable` — gezet op basis van `game.modules.get("campaign-codex")?.active` in main.js

**Rechterkolom UI (v0.8):**
- Preview-card bovenaan: huidig gegenereerd item met thumbnail + drag handle
- Saved list eronder: opgeslagen items met drag handle
- `draggable="true"` + grip-icoon alleen zichtbaar als `CC.available`
- Pre-flight op `mousedown`: CC journal aanmaken voordat drag start

### i18n

`main.js` laadt bij `ready` beide taalbestanden in `mod._translations = { nl, en }`.

`WorldForgeSettings.t(key)` leest `WorldForgeSettings.lang` (nl/en) — **onafhankelijk van Foundry UI-taal**.

Elke generator na imports:
```js
const wft = (key) => WorldForgeSettings.t(key);
```

**Nooit** `game.i18n.localize()` gebruiken voor WorldForge UI-teksten — ook niet in `_update*` methodes van worldforge-app.js.

### Tweetalige data

Alle gegenereerde teksten opslaan als `{ nl, en }` objecten. Bij renderen:
```js
const lang = WorldForgeSettings.lang ?? "nl";
const L = (obj) => typeof obj === "object" ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");
```

DnD-termen (conditions, ability scores, damage types, spell namen) **nooit** vertalen.

### Generator structuur

```
generate*({ force... })      → puur data, geen UI
render*Card(item)            → HTML string, geen knoppen
generateAndShow*()           → wrapper voor WorldForge UI
```

### TYPE_CONFIG

In `worldforge-app.js`. Elke entry:
```js
icon, get label() { return wft("..."); }, generate, render, folder,
getName, getSub, hasActor, hasComfy, comfyW, comfyH
```

Nav volgorde: People → Places → Adventure → World → Tools.
World bevat: city, criminal, **faction**, poi, weather.
Ship (PC) conditioneel via `WorldForgeSettings.showShipPC`.

### Event binding — AbortController

```js
this._abortController?.abort();
this._abortController = new AbortController();
const { signal } = this._abortController;
html.addEventListener("click", handler, { signal });
```

Alle listeners gebruiken `{ signal }` — nooit gestapelde handlers.

### wf-active

Gebruik `wf-active` i.p.v. `active` op knoppen — conflict met Foundry's `.active` styling.

## buildings-poi.json structuur

```json
{
  "id": "cathedral",
  "category": "Religious",
  "nl": "Kathedraal", "en": "Cathedral",
  "minSize": 5, "rarity": "rare",
  "isPOI": true, "hasFunctions": true,
  "article": { "nl": "de", "en": "the" },
  "cityTypeAffinities": ["holy", "medieval"],
  "biomeAffinities": ["temperate_forest"],
  "negativeAffinities": { "cityTypes": ["pirate"], "biomes": ["arctic"] },
  "locations": { "nl": ["op het centrale plein"], "en": ["on the central square"] },
  "description": {
    "materials": [{ "nl": "...", "en": "..." }],
    "roofing":   [{ "nl": "...", "en": "..." }],
    "surroundings": [{ "nl": "...", "en": "..." }],
    "inside":    [{ "nl": "...", "en": "..." }]
  },
  "readout": {
    "nl": "De {building} is opgetrokken uit {materials} met {roofing}...",
    "en": "The {building} is built from {materials} with {roofing}..."
  },
  "functions": {
    "mandatory": [{ "nl": "Abt", "en": "Abbot", "weight": 3 }],
    "optional":  [{ "nl": "Priester", "en": "Priest", "weight": 5 }]
  }
}
```

Categorieën: Religious, Military, Civic & Government, Trade & Commerce, Knowledge & Magic, Leisure & Culture, Industry & Crafts, Landmark, Underworld, **Academic** (nieuw v0.7.4).

`isPOI === true` = landmark zichtbaar in city biome readout.
`isPOI === false` = genereerbaar gebouw, niet als stadslandmark.

## factions.json structuur

```json
{
  "id": "noble_family",
  "category": "Noble House",
  "nl": "Adellijk Huis", "en": "Noble Family",
  "weight": 3, "minSize": 3,
  "scaleMin": 8, "scaleMax": 40,
  "cityTypeAffinities": [...], "biomeAffinities": [...],
  "negativeAffinities": { "cityTypes": [...], "biomes": [...] },
  "operationStyle": { "nl": [...], "en": [...] },
  "quirks":         { "nl": [...], "en": [...] },
  "leaderTitles":   { "nl": [...], "en": [...] },
  "memberRoles":    { "nl": [...], "en": [...] },
  "services": {
    "nl": [{ "name": "...", "description": "..." }],
    "en": [{ "name": "...", "description": "..." }]
  }
}
```

Gedeelde pools in factions.json: `names`, `goals`, `resources`, `territories`, `rivals`, `allies`, `basesOfOperations`, `genericLeaderTitles`, `genericMemberRoles`.

11 categorieën (elk 4 types): Noble House, Governmental Organisation, Guild, Merchant Power, Religious Organisation, Big Company, Trade Organisation, Royalty & Court, Arcane Organisation, Military Order, Adventurers & Explorers.

## City generator — koppelingen

De city card heeft drie attach-types via de **+** dropdown:
- `data-attach="criminal"` → genereert criminele org, opgeslagen in `city.attachedOrgs[]`
- `data-attach="poi"` → genereert POI/gebouw, opgeslagen in `city.attachedPOIs[]`
- `data-attach="faction"` → genereert factie, opgeslagen in `city.attachedFactions[]`

District-gebouwen in cities.json kunnen als klikbare buttons worden getoond (`wf-city-shop-btn` class):
- `poiId` → genereert POI/gebouw naar chat
- `shopType` → genereert Shop naar chat
- `stallCategory` → genereert Market Stall naar chat (kategorie: "random", "Food", etc.)
- `houseType` → genereert House/Family naar chat (house ID uit families.json, bijv. "house", "large_house", "shack", "villa")

Bijv. Market district heeft "Stalls" (stallCategory: "random") en "Food stalls" (stallCategory: "Food"). Residential districts hebben houses: Noble ("villa", "coach_house"), Middle Class ("house", "large_house"), Lower Class ("small_house"), Slums ("shack", "tent").

## CSS

```
worldforge-app.css  → UI venster
  grid: 185px (nav) | 1fr (content) | 220px (saved)

worldforge.css  → chat-kaart
  --wf-bg, --wf-gold, fonts: Cinzel + Crimson Text
```

Foundry focus-glow fix:
```css
.wf-app { --button-focus-outline-color: transparent; }
.wf-app button:focus, .wf-app button:active {
  outline: none !important; box-shadow: none !important;
}
```

## Rollable Tables — vereist voor Loot

Loot generator vereist Rollable Tables in Foundry (UUID drag-and-drop). Dit is een bewuste keuze, geen openstaand werk.

Vereiste tabellen:
- `Loot - {Valuables|Consumables|Permanent} - {Common|Uncommon|Rare|Very Rare|Legendary}`
- `Loot - Permanent - Books`

**TODO installatie-documentatie:** In de README/installation instructions moet komen te staan dat gebruikers deze Rollable Tables handmatig moeten aanmaken of importeren vanuit een meegeleverd compendium.

## Openstaand werk (v0.8 refactor)

| Onderdeel | Status |
|-----------|--------|
| `DataLoader` + `BaseGenerator` + `CC` infrastructuur | ✅ Gedaan |
| `NPCGenerator` extends BaseGenerator (proof of concept) | ✅ Gedaan |
| `ShopGenerator` extends BaseGenerator; shop-data.js deprecated | ✅ Gedaan |
| `InnGenerator` extends BaseGenerator; inn-data.js deprecated | ✅ Gedaan |
| `TavernGenerator` extends BaseGenerator; inn-data.js deprecated | ✅ Gedaan |
| `MenuGenerator` extends BaseGenerator; menu-data.js deprecated | ✅ Gedaan |
| `GenericShipGenerator` extends BaseGenerator; ship-data-generic.js deprecated | ✅ Gedaan |
| `FactionGenerator` extends BaseGenerator; faction-data.js deprecated | ✅ Gedaan |
| `CriminalGenerator` extends BaseGenerator; criminal-data.js deprecated | ✅ Gedaan |
| `CityGenerator` extends BaseGenerator; alle load*() functies deprecated | ✅ Gedaan |
| `POIGenerator` extends BaseGenerator; poi-data.js deprecated | ✅ Gedaan |
| `MagicItemGenerator` extends BaseGenerator; laadt JSON via DataLoader | ✅ Gedaan |
| `MarketStallGenerator` extends BaseGenerator; laadt JSON via DataLoader | ✅ Gedaan |
| `data/shared/materials.json` | ✅ Gedaan |
| `worldforge-app.js` gebruikt CC voor save/preflight/drag | ✅ Gedaan |
| Taalbestanden (nl.json/en.json) geupdate voor Market Stall labels | ✅ Gedaan |
| `WeatherGenerator` extends BaseGenerator; wind-directions via DataLoader | ✅ Gedaan |
| `ShipGenerator` extends BaseGenerator; ships.json + ship-functions.json via DataLoader | ✅ Gedaan |
| Buildings consolidatie: 7 biome-bestanden → 1 buildings.json met "theme" tagging | ✅ Gedaan |
| `npc/traits.json` — physical-traits + quirks + postures samenvoegen (type discriminator) | ✅ Gedaan |
| `npc/appearance.json` — clothing + accessories + weapons samenvoegen (type discriminator) | ✅ Gedaan |
| Loot generator — Rollable Tables (geen migratie nodig) | ✅ N.v.t. |
| Alle overige generators voltooid voor v0.8.2-0.8.4 | Voltooid |

## Improvement Backlog (Toekomstige Verbeteringen)

Gesorteerd op prioriteit en impact:

| # | Verbetering | Type | Impact | Notities |
|---|-------------|------|--------|----------|
| 1 | Trade-goods consolidatie: biome-specifieke items tagged met `theme` property | Data | ✅ Gedaan | Alle 78 items hebben `theme` (medieval, nordic, tropical, etc.); city-generator filtert op theme |
| 2 | NPC traits consolidatie: `npc/traits.json` | Data | ✅ Gedaan | 358 items: 100 physical-traits + 198 quirks + 60 postures; type discriminator; 1 DataLoader call |
| 3 | NPC appearance consolidatie: `npc/appearance.json` | Data | ✅ Gedaan | 208 items: 21 clothing + 36 accessories + 151 weapons; type discriminator; 1 DataLoader call |
| 4 | Settings labels vertaling (i18n) | i18n | ✅ Gedaan | settings.js: 17 instellingen naar translation keys (WORLDFORGE.Settings.*); nl.json + en.json: 42 keys voor settings names/hints/choices |
| 5 | Code cleanup: dead code audit | Refactor | Low | Ongebruikte functies/helpers verwijderen; CLAUDE.md validatie |
| 6 | Taalbestand audit: i18n keys validatie | QA | ✅ Gedaan | 316 total keys, 202 used, 114 unused (36%); meeste zijn intentioneel (future features/settings) |
| 7 | Unit test suite (DataLoader, BaseGenerator) | Testing | ✅ Gedaan (v0.9.3) | 100+ test cases, 90% coverage core modules, Jest + mock Foundry, CI-ready |
| 8 | Schema validation in DataLoader | QA | ✅ Gedaan (v0.9.3) | 22 file types validated, graceful fallback on corruption |
| 9 | Cache invalidation on settings change | Bugfix | ✅ Gedaan (v0.9.3) | Theme/tag changes now invalidate DataLoader cache |
| 10 | wft() consistency fix | Refactor | ✅ Gedaan (v0.9.3) | magic-item, loot generators fixed to use WorldForgeSettings.t() |

**Voortgang:** Alle generators naar BaseGenerator + DataLoader voltooid (v0.8.2-0.8.4). Buildings + NPC consolidaties afgerond.

## v1.0.0 Roadmap

- **Loot Rollable Tables installatie-documentatie** — Complete module README met installation guide, setup instructions, feature overview. Gebruikers moeten weten dat ze 12+ Rollable Tables handmatig moeten aanmaken of importeren.

## Fixes & Known Issues

- **Critical wft() bugs (v0.9.3 hotfix 27-06-2026):** Path A refactoring introduceerde `t()` calls zonder `wft` definitie in city-generator.js (~20 calls) en criminal-generator.js (~15 calls). Gefixed: alle `t("WF.*)` → `wft("WF.*)`. Root cause: helpers consolidatie was incomplete.
- **DataLoader validation schema (v0.9.3 hotfix):** VALIDATION_SCHEMAS zei alle files waren arrays, terwijl ze allemaal objects zijn met een root key (bijv. `{ "races": [...] }`). Veroorzaakte fallback `[]` for families.json. Gefixed: validation system vereenvoudigd, alleen type-check (object) i.p.v. complex schema validatie.
- **families.json validation (v0.9.3 hotfix):** Schema zei array, moet object. Gefixed: `{ objectKey: "houses" }` in VALIDATION_SCHEMAS.
- **Buildings data consolidatie (v0.9.1):** buildings.json was onvolledig — dak, hoogte, drukte, detail_inn, detail_shop, sfeer, bouwmateriaal arrays waren leeg. Gevuld met generic fallback items zodat shop/inn/tavern descriptions correct genereren.
- **Section headers ontbrekende keys (v0.9.1):** Inn/Tavern/Criminal/Faction generators gebruikten translation keys die niet bestonden in nl.json/en.json:
  - Inn/Tavern: `WF.Inn.Section.Staff`, `WF.Inn.Section.Guests`, `WF.Inn.Section.Gossip`, room labels (Single, Double, Group, Dormitory, PerNight, PerBed)
  - Criminal: `WF.Crime.Section.Operations`, `WF.Crime.Section.Quirk`, `WF.Crime.Section.Services`, `WF.Crime.Section.Officers`, alle `WF.Crime.Readout.*` keys
  - Faction: Alle `WF.Faction.Readout.*` keys
  - Gefixed door ontbrekende keys toe te voegen aan taalbestanden
- **House generator debug prompts (v0.9.1):** DEBUG ComfyUI prompt display verwijderd; family members nu via `wfNpcItem()` met actor/codex action buttons
- **District house button links (v0.9.1):** Geimplementeerd via `houseType` attribute in cities.json districts (Noble/Middle Class/Lower Class/Slums); event handler toegevoegd in worldforge-app.js; city-generator aangepast voor button rendering
- **Wizards Tower duplicatie (v0.9.1):** Arcane district had "Wizards Tower" twee keer (shopType + poiId) — shopType versie verwijderd, poiId behouden
- **Settings labels vertaling (v0.8.5):** Settings labels veranderen nu mee met de WorldForge language setting. Implementatie:
  - `main.js` ready hook: laadt nl.json + en.json in `game.modules.get("world-forge-generator")._translations`
  - `main.js` changeSetting hook: bijwerken van `game.i18n.translations` bij taalwissel + herrenderen van SettingsConfig window
  - Settings registration in `settings.js`: alle labels nu via WORLDFORGE.Settings.* keys
- **Menu generator [object Object] bug (v0.8.4):** menu-generator.js probeerde naar `menuData.volledige` en `menuData.dagmaaltijd` maar inns.json structuur is `dranken.{bier,wijn,spirits}` en `maaltijden.{volledig,vlees}` — gefixed door keys aan te passen
- **City addDistrict bug (v0.8.1):** Functie riep deprecated `loadCityData()` aan — vervangen met `DataLoader.load("cities.json")`

## Veelgemaakte fouten

- **wft() moet NA imports zijn (KRITIEK):** `import { WorldForgeSettings } from "./settings.js"; const wft = (key) => WorldForgeSettings.t(key);` — niet ervoor! Een vergeten `wft` in een file introduceert `undefined is not a function` errors die alles breken.
- **Refactoring patroon (v0.8+):** `import { DataLoader } from "./data-loader.js"; import { BaseGenerator } from "./base-generator.js"; const wft = (key) => WorldForgeSettings.t(key);` — ALTIJD in deze volgorde, want wft() moet na imports beschikbaar zijn
- `DataLoader.load()` geeft altijd een array/object terug (nooit null/undefined) — cache is permanent per sessie; `DataLoader.invalidate()` bij preset-wijziging
- `DataLoader.pick()` kiest willekeurig uit een array; fallback: `... ?? { nl: "", en: "" }`
- Nieuwe generators: extend `BaseGenerator`, gebruik `DataLoader`, importeer `CC` — geen losse load*() functies meer
- `CC.save()` vervangt directe `saveToCodex()` aanroepen in worldforge-app.js
- `wft()` ALTIJD na de laatste import (ES module vereiste)
- `TYPE_CONFIG` labels zijn `get label()` getters (lazy — wft() pas beschikbaar na init)
- `receiveItem()` twee signaturen: `receiveItem("type", item)` en `receiveItem(item)`
- Loot blijft Rollable Tables — UUID drag-and-drop vereist dit
- ComfyUI knoppen alleen zichtbaar als `WorldForgeSettings.comfyAvailable === true`
- Weather JSON pad: `modules/world-forge-generator/data/weather/` (niet `../data/`)
- **DataLoader validation (v0.9.3+)**: JSON schema validatie gebeurt automatisch; beschadigde bestanden loggen warning + fallback (lege array/object), game gaat niet crash
- Magic item ComfyUI prompt: geen campaign tags (voorkomt omgevingsdrift)
- `wf-active` gebruiken, nooit `active` op WorldForge knoppen
- `buildings-poi.json` is de enige POI-databron — `poi-data.js` én `city-generator.js` laden dit bestand; city-generator filtert op `isPOI === true` voor de biome readout
- `city-generator.js` importeert `WorldForgeSettings` — `wft()` gebruikt `.t()`, nooit `game.i18n.localize()`
- `_updateCity*` methodes in worldforge-app.js gebruiken `(key) => WorldForgeSettings.t(key)` als wftFn — nooit `game.i18n.localize()`
- Faction services arrays moeten in NL en EN evenveel items hebben — index-gebaseerde koppeling

## Versiegeschiedenis

| Versie | Hoogtepunten |
|--------|-------------|
| 0.2.0 | Loot generator, basis UI |
| 0.3.0 | Weather generator, races.json, jobs.json |
| 0.5.0 | Magic item generator |
| 0.6.0 | JSON-migratie Shop/Inn/Tavern/Ship, ComfyUI detectie |
| 0.7.0 | i18n systeem, City generator, Criminal Organisation |
| 0.7.1 | Ship generator (generiek), weather JSON tweetalig |
| 0.7.2 | WorldForgeSettings.t(), wf-active, loot labels, nav vertaling |
| 0.7.3 | Building/POI generator, buildings-poi.json (62 entries) |
| 0.7.4 | Faction generator (44 types), POI/Faction city integratie, buildings-poi uitgebreid naar 77 entries + Academic categorie, governments.json descEn, Ship (PC) i18n, NPC geslacht fix, wft() consistentie doorheen city-generator |
| 0.7.5 | NPC Rollable Tables volledig verwijderd; 5 biome-specifieke building files (Greek, Asian, Nordic, Desert, Gothic); buildings-poi 77→102 entries; factions 44→66 types (6 per categorie); alle POIs gekoppeld in cities.json districts |
| 0.8.0 | Architectuur refactor: DataLoader, BaseGenerator, CampaignCodexIntegration (CC); NPCGenerator als proof-of-concept; data/shared/materials.json; rechterkolom split met draggable preview+saved cards; CC.available vlag via WorldForgeSettings |
| 0.8.1 | DataLoader + BaseGenerator migratie voltooid voor Shop, Inn, Tavern, Menu, GenericShip generators; shop-data.js, inn-data.js, menu-data.js, ship-data-generic.js deprecated |
| 0.8.2 | Volledige refactor voltooid: alle generators (Crime, Faction, POI, MagicItem, City, Weather, Ship PC) nu via DataLoader + BaseGenerator; Market Stall generator nieuw (16 types, canopy kleuren in readout); City addDistrict() bug gefixt; ship-data.js consolidated in ship-generator.js |
| 0.8.3 | Buildings consolidation: 7 biome-specifieke bestanden samengevoegd in één buildings.json met "theme" property; inn-generator & tavern-generator nu theme-aware; Trade-goods (78 items) ook theme-tagged; city-generator filtert beide op theme |
| 0.8.4 | NPC data consolidatie: physical-traits.json + quirks.json + postures.json → npc/traits.json (358 items, type discriminator); clothing.json + accessories.json + weapons.json → npc/appearance.json (208 items, type discriminator); npc-generator refactored: 6 DataLoader calls → 2, 6 picker functions → 2 |
| 0.9.0 | House/Family Generator volledig uitgewerkt: 23 huistypes (Shack t/m Palace), 14 gezinssamenstelling (Single → Three Generations), theme-aware + district-aware filtering, shared materials (wall/roof/floor), family name sharing, ComfyUI artwork generation, Campaign Codex export, Actor creation, 30 unique backstories |
| 0.8.5 | Settings UI i18n voltooid: 17 instellingen van hardcoded strings naar translation keys (WORLDFORGE.Settings.*); nl.json + en.json: 42 settings-related translations; settings name/hint/choice labels veranderen nu mee met language setting |
| 0.9.1 | 2026-06-16 | Buildings data gevuld (dak/hoogte/drukte/detail_inn/detail_shop/sfeer/bouwmateriaal); Inn/Tavern/Criminal/Faction section headers + readout keys voltooid; House family members via wfNpcItem() met actor/codex buttons; Family composition badge in header; District house buttons geimplementeerd; Alle translation keys voor generators afgerond |
