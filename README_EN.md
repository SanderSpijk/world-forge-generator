# WorldForge Generator

**Foundry VTT module for generating random NPCs, shops, inns, ships, cities, criminal organisations, factions, buildings/POIs, weather, loot, and magical items.**

System: D&D 5e | Foundry Version: v13+

---

## 🎲 What is WorldForge?

WorldForge Generator simplifies D&D campaign preparation by generating everything you need:

- **NPCs**: Characters with unique appearances, personalities, skills, and backstories
- **Shops**: Theme-aware merchants with inventories and shopkeepers
- **Inns & Taverns**: Complete with guest lists, menus, drinks, and atmosphere
- **Ships**: Both PC-owned and NPC ships with crew and specifications
- **Cities**: Full cities with districts, buildings, criminal orgs, and factions
- **Buildings & POIs**: Points of Interest filtered by biome and theme
- **Magical Items**: Varied unique items based on rarity tiers
- **Loot**: Gold, coins, and items based on loot tier
- **Weather**: Dynamic weather per theme with temperature and wind
- **Loot Tables**: Integration with Foundry Rollable Tables

**Theme-Aware**: All generated content adapts to your campaign theme (Medieval, Gothic, Tropical, Desert, Nordic, Asian, Greek, Caribbean).

---

## 🚀 Installation

### Step 1: Add Module to Foundry

1. Open Foundry VTT
2. Go to **Settings → Modules**
3. Click **Install Module**
4. Paste this URL in the search field:
   ```
   https://github.com/SanderSpijk/world-forge-generator/releases/download/v1.0.0/module.json
   ```
   (Or manually add the module to your modules folder)
5. Click **Install**

### Step 2: Enable the Module

1. Go to **Settings → Manage Modules**
2. Find **WorldForge Generator**
3. Check the checkbox to enable it
4. **Important**: Restart Foundry (F5 in browser)

### Step 3: Create Loot Rollable Tables (REQUIRED for Loot Generator)

The Loot Generator requires Rollable Tables to function. You have two options:

#### Option A: **AUTOMATIC (Recommended)** ⚡

1. Open WorldForge UI (D20 button in toolbar)
2. Go to **Tools → Loot Tables Setup**
3. Click **Setup Loot Tables**
4. All 16 tables are automatically created in a "WorldForge Loot" folder

This is the fastest way! Tables are created with placeholder items that you fill in yourself.

#### Option B: Create Manually

If you prefer manual control:

1. In Foundry: **Scenes → Rollable Tables**
2. Click **Create Table**
3. Give the table a name (e.g., `Loot - Valuables - Common`)
4. Add items (see instructions below)

#### Required Tables:

| Table Name | Contents |
|-----------|----------|
| `Loot - Consumables - Common` | Healing potions, rations, rope, etc. |
| `Loot - Consumables - Uncommon` | Scrolls, herbs, rare ingredients |
| `Loot - Consumables - Rare` | Rare potions, powerful scrolls |
| `Loot - Consumables - Very Rare` | Legendary potions, rare books |
| `Loot - Consumables - Legendary` | Artifacts, legendary scrolls |
| `Loot - Valuables - Common` | Gems, jewelry (common) |
| `Loot - Valuables - Uncommon` | Better gems, art objects |
| `Loot - Valuables - Rare` | Rare art, valuable gems |
| `Loot - Valuables - Very Rare` | Very rare treasures |
| `Loot - Valuables - Legendary` | Priceless artifacts |
| `Loot - Permanent - Common` | Common magical items |
| `Loot - Permanent - Uncommon` | Uncommon magical items |
| `Loot - Permanent - Rare` | Rare magical items |
| `Loot - Permanent - Very Rare` | Very rare magical items |
| `Loot - Permanent - Legendary` | Legendary magical items |
| `Loot - Permanent - Books` | Spellbooks, grimoires, tomes |

#### Adding Items & Setting Weight (Rarity):

1. Open a Rollable Table
2. Click **Add Result**
3. Enter item description (e.g., "Amber Gemstone (500 GP)")
4. Set **Weight** based on rarity:
   - **Rarity: Common** → Weight 10 (very common)
   - **Rarity: Uncommon** → Weight 5 (normal)
   - **Rarity: Rare** → Weight 2 (rare)
   - **Rarity: Very Rare** → Weight 1 (very rare)
   - **Rarity: Legendary** → Weight 0.5 (almost never)

**How weight works**: An item with weight 10 appears 10× more often than an item with weight 1.

**Examples**:
- 5 Common items (weight 10 each) vs 1 Legendary (weight 0.5) = 100:0.5 ratio
- Add many items to the table for more variety

**Quick import tip**: Use items from D&D 5e SRD compendia:
- Open **SRD Magic Items** compendium
- Drag items to the Rollable Table
- Then set weights manually based on item rarity

---

## ⚙️ Settings Configuration

1. Open **Settings → Configure Settings**
2. Search for **WorldForge Generator**
3. Configure the following settings:

### Core Settings

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| **Generator Language** | EN / NL | EN | Language for generated content |
| **Campaign Theme** | Medieval, Gothic, Asian, Desert, Nordic, Greek, Caribbean, Custom | Medieval | Theme for theme-aware content (shops, buildings, weather) |
| **Campaign Theme Tags** | (custom) | empty | Extra tags for custom theme filtering (optional) |
| **Campaign Theme Negatives** | (custom) | empty | Exclude certain elements (e.g., "magic-heavy") |
| **Show Ship (PC)** | On / Off | On | Show PC-ship generator in World nav |

### ComfyUI Settings (for AI artwork)

| Setting | Example | Default | Description |
|---------|---------|---------|-------------|
| **ComfyUI Server URL** | `http://127.0.0.1:8188` | `http://127.0.0.1:8188` | Local or remote ComfyUI server |
| **Default Style Prompt** | "fantasy art, digital painting" | "fantasy art" | Base style for AI artwork |

---

## 🎨 ComfyUI Setup (Optional for AI Artwork)

WorldForge can use ComfyUI to automatically generate artwork for NPCs, magical items, and other content.

### ComfyUI Installation

1. **Install ComfyUI** (if you don't have it):
   - Clone or download from https://github.com/comfyanonymous/ComfyUI
   - Follow installation instructions in the ComfyUI repo

2. **Start ComfyUI server**:
   ```bash
   python main.py
   ```
   Server runs on `http://127.0.0.1:8188`

### Foundry Integration

1. Open Foundry **Settings → Configure Settings**
2. Find **WorldForge Generator → ComfyUI Server URL**
3. Enter server URL:
   ```
   http://127.0.0.1:8188
   ```
   (Or remote URL if ComfyUI runs on another system)

4. **Asset folders are created automatically!** ✨
   
   WorldForge creates these folders automatically on first load:
   
   ```
   FoundryVTT/Data/assets/WorldForge/
   ├── Buildings/         (for buildings/POIs)
   ├── CharacterArt/      (for NPCs)
   └── Items/             (for magical items)
   ```
   
   **Nothing to do manually!** The folders appear automatically in your File Browser when you load WorldForge for the first time. This happens in the background and you'll see it in the console logs.
   
   > 💡 **Tip**: To verify they were created, check **File Browser → Assets** in Foundry. You'll see "WorldForge" folder with the 3 subfolders.

5. Test the connection:
   - Open WorldForge UI (D20 button in toolbar)
   - Generate an NPC
   - Click **Generate Artwork**
   - If successful: ComfyUI icon appears green in WorldForge
   - Artwork is saved in `CharacterArt/` folder

### ComfyUI Workflow

WorldForge uses default ComfyUI workflows for:
- **NPC Portraits**: Determined by race, appearance, gender
- **Magical Item Artwork**: Rarity and item type determine style
- **Buildings/POIs**: Biome and architectural style determine appearance

**Note**: ComfyUI must be running actively. If WorldForge cannot reach ComfyUI, artwork buttons are hidden (but generation works normally).

---

## 📖 Usage

### Open WorldForge UI

1. Click the **D20 button** in the toolbar (top left)
2. Or use console command: `game.worldforge.open()`

### Available Generators

**People**
- NPC Generator

**Places**
- Shop Generator
- Inn/Tavern Generator
- Market Stall Generator
- House/Family Generator

**Adventure**
- Loot Generator
- Magic Item Generator
- Weather Generator

**World**
- City Generator
- Criminal Organisation Generator
- Faction Generator
- POI/Building Generator
- Ship Generator (PC & NPC)

**Tools**
- PDF Export (export all generated items to PDF)

### Saving Generated Items

**To Campaign Codex** (optional, requires Campaign Codex module):
- Generated items have **Save to Codex** button
- Automatically creates journal entry

**To Character Actor**:
- NPCs have **Create Actor** button
- Automatically creates character sheet in Foundry

**To Chat**:
- All items can be posted to chat
- Drag & drop to canvas for tokens/markers

---

## 🐛 Troubleshooting

### "ComfyUI reachable, but artwork won't generate"

**Causes**:
- ComfyUI model missing
- Workflow corrupted
- Insufficient VRAM

**Solution**:
1. Check ComfyUI console for errors
2. Ensure default SDXL model is downloaded
3. Restart ComfyUI server
4. Verify URL in Foundry settings

### "Loot Generator says: Rollable table not found"

**Causes**:
- Correct table not created
- Table name is different (case-sensitive!)

**Solution**:
1. Create table with EXACTLY correct name (case matters!)
2. Ensure table has at least 1 item
3. Refresh Foundry (F5)

### "Generated NPCs have wrong language"

**Cause**: Generator Language setting not set

**Solution**:
1. Go to **Settings → Configure Settings → WorldForge Generator**
2. Set **Generator Language** to **EN** or **NL**
3. Refresh Foundry

### "Theme-aware filtering not working"

**Cause**: Campaign Theme not set correctly

**Solution**:
1. Set **Campaign Theme** to correct value
2. Ensure theme matches available options:
   - Medieval, Gothic, Asian, Desert, Nordic, Greek, Caribbean
3. Generate new item

---

## 💾 Data Storage

WorldForge stores everything in the **Foundry world database** (not externally):
- Settings stored in `world.json`
- Generated items can go to Rollable Tables or Actors
- Campaign Codex items stored in Journal entries

**Backup**: Regular world backups also protect WorldForge data!

---

## 🔒 Privacy & Security

- ✅ Everything runs locally (no data sent to cloud)
- ✅ ComfyUI artwork generation: optional (can run locally)
- ✅ No tracking or analytics
- ✅ No authentication required

---

## 📝 License

[Fill in: MIT, CC, etc.]

---

## 🐙 GitHub & Updates

**Repository**: https://github.com/SanderSpijk/world-forge-generator
**Report Issues**: https://github.com/SanderSpijk/world-forge-generator/issues
**Feature Requests**: https://github.com/SanderSpijk/world-forge-generator/discussions

---

## 🙏 Credits

- **D&D 5e System Reference Document** (SRD)
- **Foundry VTT** for the amazing VTT framework
- **ComfyUI** for AI image generation
- **Campaign Codex** for journal integration

---

## FAQ

**Q: Can I work offline?**
A: Yes! WorldForge works completely offline. ComfyUI is optional for artwork.

**Q: Does this work with other D&D systems (Pathfinder, etc)?**
A: No, WorldForge is D&D 5e specific. Other systems may have issues.

**Q: Can I add custom content?**
A: Not via UI currently, but you can edit JSON files in the data/ folder for custom generators.

**Q: How do I update to a new version?**
A: Foundry automatically updates the module via **Settings → Manage Modules**. Restart Foundry after (F5).

**Q: Should I set expectations on generated artwork?**
A: ComfyUI output varies. For consistency, try: "D&D fantasy art, 4k, digital painting"

---

**Questions?** Create an issue on GitHub or ask in the Foundry community!

Enjoy using WorldForge! 🎲✨
