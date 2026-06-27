// ============================================================
// magic-item-generator.js — WorldForge Magic Item Generator
// ============================================================

import { WorldForgeSettings } from './settings.js';
import { BaseGenerator } from './base-generator.js';
import { DataLoader } from './data-loader.js';
import { pickRandom, escapeHtml, wfSectionHeader } from './utils.js';
import { runComfyRender, saveComfyImageToFoundry, baseNegativePortrait } from './comfyui.js';

const wft = (key) => WorldForgeSettings.t(key);

// ─────────────────────────────────────────────
// Constanten
// ─────────────────────────────────────────────

const RARITY_LABELS = {
  1: { nl: 'Common',    en: 'Common',    color: '#aaaaaa' },
  2: { nl: 'Uncommon',  en: 'Uncommon',  color: '#1eff00' },
  3: { nl: 'Rare',      en: 'Rare',      color: '#0070dd' },
  4: { nl: 'Very Rare', en: 'Very Rare', color: '#a335ee' },
  5: { nl: 'Legendary', en: 'Legendary', color: '#ff8000' }
};

const TYPE_LABELS = {
  weapon:     { nl: 'Weapon',       en: 'Weapon' },
  armor:      { nl: 'Armor',        en: 'Armor' },
  wondrous:   { nl: 'Wondrous Item', en: 'Wondrous Item' },
  ammunition: { nl: 'Ammunition',   en: 'Ammunition' }
};

const SUBTYPE_LABELS = {
  simple_melee:   'Simple Melee',
  simple_ranged:  'Simple Ranged',
  martial_melee:  'Martial Melee',
  martial_ranged: 'Martial Ranged',
  light:          'Light Armor',
  medium:         'Medium Armor',
  heavy:          'Heavy Armor',
  shield:         'Shield',
  ring:           'Ring',
  necklace:       'Necklace / Amulet',
  headband:       'Headband / Circlet',
  helm:           'Helm / Crown',
  bracers:        'Bracers',
  boots:          'Boots',
  cloak:          'Cloak / Cape',
  belt:           'Belt',
  gloves:         'Gloves / Gauntlets',
  legguards:      'Legguards',
  eyes:           'Eyes',
  misc:           'Misc',
  arrow:          'Arrow',
  bolt:           'Bolt'
};

// ─────────────────────────────────────────────
// Data laden via DataLoader
// ─────────────────────────────────────────────

async function getAllBaseItems() {
  const baseItems = await DataLoader.load('magic-items/base-items.json');
  return [
    ...(baseItems.weapons    || []),
    ...(baseItems.armor      || []),
    ...(baseItems.wondrous   || []),
    ...(baseItems.ammunition || [])
  ];
}

async function getProperties() {
  return await DataLoader.load('magic-items/properties.json');
}

// ─────────────────────────────────────────────
// Hulpfuncties
// ─────────────────────────────────────────────

function rarityFromCost(cost) {
  if (cost <= 1) return 1;
  if (cost <= 2) return 2;
  if (cost <= 3) return 3;
  if (cost <= 4) return 4;
  return 5;
}

function rarityLabel(cost, lang = 'nl') {
  return RARITY_LABELS[rarityFromCost(cost)]?.[lang] ?? 'Onbekend';
}

function rarityColor(cost) {
  return RARITY_LABELS[rarityFromCost(cost)]?.color ?? '#aaaaaa';
}

function dnd5eRarity(cost) {
  const map = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'veryRare', 5: 'legendary' };
  return map[rarityFromCost(cost)] ?? 'common';
}

async function getValidProperties(baseItem, excludeIds = []) {
  const properties = await getProperties();
  return (properties.properties || []).filter(p => {
    if (excludeIds.includes(p.id)) return false;
    if (!p.allowedTypes.includes(baseItem.type)) return false;
    if (p.allowedSubtypes[0] !== '*') {
      if (!p.allowedSubtypes.includes(baseItem.subtype)) return false;
    }
    if (p.excludeSubtypes.includes(baseItem.subtype)) return false;
    return true;
  });
}

async function buildPropertyList(baseItem, targetCost) {
  let budget     = targetCost;
  let chosen     = [];
  let excludeIds = [];
  const usedCategories = new Set();

  if (Math.random() < 0.5 && budget >= 2) {
    const enhancements = (await getValidProperties(baseItem, excludeIds))
      .filter(p => p.category === 'enhancement' && p.cost <= budget);
    if (enhancements.length > 0) {
      const pick = pickRandom(enhancements);
      chosen.push(pick);
      budget -= pick.cost;
      excludeIds.push(...pick.incompatibleWith, pick.id);
      usedCategories.add('enhancement');
    }
  }

  let attempts = 0;
  while (budget > 0 && attempts < 50) {
    attempts++;
    const valid = (await getValidProperties(baseItem, excludeIds)).filter(p => {
      if (p.cost > budget) return false;
      if (p.category === 'enhancement' && usedCategories.has('enhancement')) return false;
      if (['ability', 'saving'].includes(p.category) && usedCategories.has(p.category)) return false;
      return true;
    });
    if (valid.length === 0) break;
    const pick = pickRandom(valid);
    chosen.push(pick);
    budget -= pick.cost;
    excludeIds.push(...pick.incompatibleWith, pick.id);
    usedCategories.add(pick.category);
  }

  return chosen;
}

// ─────────────────────────────────────────────
// Naam genereren
// ─────────────────────────────────────────────

function generateName(baseItem, properties) {
  const namePool = [baseItem.name, ...(baseItem.synonyms || [])];
  const baseName = pickRandom(namePool);

  const namingProps = properties.filter(p => p.category !== 'enhancement');
  if (namingProps.length === 0) return baseName;

  const allPrefixes = namingProps.flatMap(p => p.prefixes || []);
  const allSuffixes = namingProps.flatMap(p => p.suffixes || []);

  const hasPrefix = allPrefixes.length > 0;
  const hasSuffix = allSuffixes.length > 0;

  if (!hasPrefix && !hasSuffix) return baseName;

  const roll = Math.random();
  if (hasPrefix && hasSuffix && roll < 0.10) {
    return `${pickRandom(allPrefixes)} ${baseName} ${pickRandom(allSuffixes)}`;
  } else if (hasPrefix && (!hasSuffix || roll < 0.55)) {
    return `${pickRandom(allPrefixes)} ${baseName}`;
  } else {
    return `${baseName} ${pickRandom(allSuffixes)}`;
  }
}

// ─────────────────────────────────────────────
// ComfyUI prompt
// ─────────────────────────────────────────────

function generateComfyPrompt(baseItem, properties, itemName) {
  const subtypeContext = {
    simple_melee:   'melee weapon, sword or axe or hammer',
    simple_ranged:  'ranged weapon, bow or crossbow',
    martial_melee:  'melee weapon, sword or axe or spear',
    martial_ranged: 'ranged weapon, bow or crossbow',
    light:          'light armor, leather armor, wearable armor suit',
    medium:         'medium armor, chainmail armor, wearable armor suit',
    heavy:          'heavy armor, full plate armor, wearable armor suit',
    shield:         'shield, round shield, defensive shield',
    ring:           'jewelry ring, single finger ring, metal ring',
    necklace:       'necklace, pendant on a chain, jewelry necklace',
    headband:       'headband, cloth headband, worn on head',
    helm:           'helmet, metal helmet, head armor',
    bracers:        'bracers, wrist guards, leather or metal bracers',
    boots:          'boots, leather boots, footwear',
    cloak:          'cloak, fabric cloak, flowing cloak garment',
    belt:           'belt, leather belt, waist belt',
    gloves:         'gloves, leather gloves, hand gloves',
    legguards:      'leg armor, metal greaves, leg protection',
    eyes:           'goggles or glasses, eyewear, lens eyepiece',
    misc:           'magical trinket, small magical object',
    arrow:          'single arrow, archery arrow, wooden arrow with metal tip',
    bolt:           'single crossbow bolt, short bolt, crossbow projectile'
  };

  const context = subtypeContext[baseItem.subtype] || 'magical item';

  const propVisuals = {
    flaming:           'engulfed in flames, fire magic effect, burning orange glow',
    frost_brand:       'covered in frost and ice crystals, cold blue glow, freezing aura',
    shock:             'crackling with lightning arcs, electric blue sparks',
    venom:             'dripping green poison, toxic green glow',
    thundering:        'crackling with thunder energy, blue-white sonic energy',
    holy_avenger:      'glowing with holy golden light, divine radiance',
    vorpal:            'impossibly sharp gleaming edge, razor thin blade',
    dancing:           'glowing movement runes etched on surface',
    etherealness:      'semi-transparent, ghostly shimmer, partially ethereal',
    adamantine:        'dark near-black metal surface, adamantine material',
    mithral:           'bright silver metal, lightweight gleaming mithral',
    plus1:             'faint magical blue glow, subtle enchantment',
    plus2:             'moderate magical glow, glowing runes on surface',
    plus3:             'strong magical aura, bright glowing runes, powerful enchantment',
    shadow:            'dark shadowy aura, wisps of darkness',
    shadow_improved:   'deep shadow aura, darkness clinging to surface',
    shadow_greater:    'consumed by shadow, void-black aura',
    ring_invisibility: 'faint shimmer of invisibility, magical translucency',
    blurring:          'blurred edges, distorted magical outline',
    displacement:      'phase-shifted appearance, double image effect'
  };

  const propEffects = properties.map(p => propVisuals[p.id]).filter(Boolean).join(', ');

  const materialTags = (baseItem.tags || [])
    .filter(t => ['blade', 'metal', 'wood', 'leather', 'chain', 'cloth', 'crystal', 'stone', 'glass', 'jewelry'].includes(t))
    .join(', ');

  const background = 'isolated on white background, grey ink paint splatter background, no scenery, no landscape, no environment, no people, no characters, no humans, no faces, no persons, no figures, item only';

  const parts = [
    `a single fantasy ${context}`,
    itemName ? `named "${itemName}"` : '',
    propEffects,
    materialTags,
    'fantasy RPG item, detailed craftsmanship, ornate design',
    background,
    'product shot, studio lighting, centered, high quality render, no text, no watermark'
  ].filter(Boolean);

  return parts.join(', ');
}

// ─────────────────────────────────────────────
// Hoofd generator
// ─────────────────────────────────────────────

export async function generateMagicItem({ type = 'random', subtype = 'random', targetCost = 'random' } = {}) {
  const allItems     = await getAllBaseItems();
  const validTypes   = ['weapon', 'armor', 'wondrous', 'ammunition'];
  const resolvedType = type === 'random' ? pickRandom(validTypes) : type;

  let candidates = allItems.filter(i => i.type === resolvedType);
  if (subtype !== 'random' && subtype !== 'all') {
    const filtered = candidates.filter(i => i.subtype === subtype);
    if (filtered.length > 0) candidates = filtered;
  }

  const baseItem = pickRandom(candidates);

  let cost;
  if (targetCost === 'random') {
    const weights = [0, 15, 35, 30, 15, 5];
    const roll    = Math.random() * 100;
    let acc = 0;
    cost = 2;
    for (let i = 1; i <= 5; i++) {
      acc += weights[i];
      if (roll < acc) { cost = i; break; }
    }
  } else {
    cost = parseInt(targetCost);
  }
  cost = Math.max(1, Math.min(5, cost));

  const properties         = await buildPropertyList(baseItem, cost);
  const actualCost         = properties.reduce((sum, p) => sum + p.cost, 0);
  const requiresAttunement = properties.some(p => p.attunement);
  const name               = generateName(baseItem, properties);
  const comfyPrompt        = generateComfyPrompt(baseItem, properties, name);
  const lang               = WorldForgeSettings.lang || 'nl';
  const descriptions       = properties.map(p => p.description?.[lang] || p.description?.en || '').filter(Boolean);

  return {
    name,
    baseItem,
    properties,
    actualCost,
    rarity: rarityFromCost(actualCost),
    requiresAttunement,
    descriptions,
    comfyPrompt,
    image: null
  };
}

// ─────────────────────────────────────────────
// Render — Chat kaart HTML
// ─────────────────────────────────────────────

export function renderMagicItemCard(item) {
  const lang  = WorldForgeSettings.lang || 'nl';
  const color = rarityColor(item.actualCost);
  const rar   = rarityLabel(item.actualCost, lang);

  const imgHtml = item.image
    ? `<img class="wf-magic-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
    : `<div class="wf-magic-img wf-magic-img--placeholder"><i class="fas fa-hat-wizard"></i></div>`;

  const baseInfo = [];
  if (item.baseItem.type === 'weapon') {
    if (item.baseItem.damage) baseInfo.push(`${item.baseItem.damage} ${item.baseItem.damage_type}`);
    if (item.baseItem.properties?.length > 0) baseInfo.push(item.baseItem.properties.join(', '));
  }
  if (item.baseItem.type === 'armor') {
    const acMod = item.baseItem.ac_modifier === 'dex'      ? ' + Dex'
                : item.baseItem.ac_modifier === 'dex_max2' ? ' + Dex (max 2)'
                : '';
    baseInfo.push(`AC ${item.baseItem.ac}${acMod}`);
  }

  const bonusProp = item.properties.find(p => p.category === 'enhancement');
  const bonusStr  = bonusProp ? ` +${bonusProp.bonus}` : '';

  const displayProps       = item.properties.filter(p => p.category !== 'enhancement');
  const allPropsForDisplay = displayProps.length > 0 ? displayProps : item.properties;

  const propsHtml = allPropsForDisplay.map(p => {
    const desc = p.description?.[lang] || p.description?.en || '';
    return `<div class="wf-trait-item">
      <span class="wf-trait-name">${escapeHtml(p.name)}</span>
      <span class="wf-trait-desc">${escapeHtml(desc)}</span>
    </div>`;
  }).join('');

  const attunementHtml = item.requiresAttunement
    ? `<span class="wf-badge wf-badge--attune">${wft("WF.Magic.Label.Attunement")}</span>`
    : '';

  const baseInfoHtml = baseInfo.length > 0
    ? `<div class="wf-magic-base-info">${baseInfo.map(escapeHtml).join(' &bull; ')}</div>`
    : '';

  const subtypeLabel = SUBTYPE_LABELS[item.baseItem.subtype] || item.baseItem.subtype;
  const typeLabel    = TYPE_LABELS[item.baseItem.type]?.[lang] || item.baseItem.type;

  const bodyHtml = (item.properties.length > 0
    ? wfSectionHeader('✦', wft('WF.Magic.Section.Properties')) + propsHtml
    : `<p class="wf-readout">${wft('WF.Magic.NoProperties')}</p>`)
    + `<div style="margin-top:8px;padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid #5c4a1e;border-radius:3px;font-size:10px;color:#9e8e6e;font-family:monospace;word-break:break-word;">
        <span style="color:#c9a227;font-family:'Cinzel',serif;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;">ComfyUI Prompt (debug)</span><br>
        ${escapeHtml(item.comfyPrompt)}
       </div>`;

  return `<div class="wf-card wf-magic-card">
    <div class="wf-header" style="border-bottom: 2px solid ${color};">
      <div class="wf-title-block">
        <div class="wf-name" style="color: ${color};">${escapeHtml(item.name)}${escapeHtml(bonusStr)}</div>
        <div class="wf-sub">${escapeHtml(typeLabel)} &bull; ${escapeHtml(subtypeLabel)}</div>
        <div class="wf-sub">
          <span style="color:${color}; font-weight:bold;">${escapeHtml(rar)}</span>
          ${attunementHtml}
        </div>
        ${baseInfoHtml}
      </div>
      <div class="wf-art-wrap">
        ${imgHtml}
      </div>
    </div>
    <div class="wf-body">
      ${bodyHtml}
    </div>
  </div>`;
}

export function renderMagicItemPublic(item) {
  // Publieke versie zonder debug prompt
  const lang  = WorldForgeSettings.lang || 'nl';
  const color = rarityColor(item.actualCost);
  const rar   = rarityLabel(item.actualCost, lang);

  const imgHtml = item.image
    ? `<img class="wf-magic-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
    : `<div class="wf-magic-img wf-magic-img--placeholder"><i class="fas fa-hat-wizard"></i></div>`;

  const baseInfo = [];
  if (item.baseItem.type === 'weapon') {
    if (item.baseItem.damage) baseInfo.push(`${item.baseItem.damage} ${item.baseItem.damage_type}`);
    if (item.baseItem.properties?.length > 0) baseInfo.push(item.baseItem.properties.join(', '));
  }
  if (item.baseItem.type === 'armor') {
    const acMod = item.baseItem.ac_modifier === 'dex'      ? ' + Dex'
                : item.baseItem.ac_modifier === 'dex_max2' ? ' + Dex (max 2)'
                : '';
    baseInfo.push(`AC ${item.baseItem.ac}${acMod}`);
  }

  const bonusProp = item.properties.find(p => p.category === 'enhancement');
  const bonusStr  = bonusProp ? ` +${bonusProp.bonus}` : '';

  const displayProps       = item.properties.filter(p => p.category !== 'enhancement');
  const allPropsForDisplay = displayProps.length > 0 ? displayProps : item.properties;

  const propsHtml = allPropsForDisplay.map(p => {
    const desc = p.description?.[lang] || p.description?.en || '';
    return `<div class="wf-trait-item">
      <span class="wf-trait-name">${escapeHtml(p.name)}</span>
      <span class="wf-trait-desc">${escapeHtml(desc)}</span>
    </div>`;
  }).join('');

  const attunementHtml = item.requiresAttunement
    ? `<span class="wf-badge wf-badge--attune">${wft('WF.Magic.Label.Attunement')}</span>`
    : '';

  const baseInfoHtml = baseInfo.length > 0
    ? `<div class="wf-magic-base-info">${baseInfo.map(escapeHtml).join(' &bull; ')}</div>`
    : '';

  const subtypeLabel = SUBTYPE_LABELS[item.baseItem.subtype] || item.baseItem.subtype;
  const typeLabel    = TYPE_LABELS[item.baseItem.type]?.[lang] || item.baseItem.type;

  const bodyHtml = item.properties.length > 0
    ? wfSectionHeader('✦', wft('WF.Magic.Section.Properties')) + propsHtml
    : `<p class="wf-readout">${wft('WF.Magic.NoProperties')}</p>`;

  return `<div class="wf-card wf-magic-card">
    <div class="wf-header" style="border-bottom: 2px solid ${color};">
      <div class="wf-title-block">
        <div class="wf-name" style="color: ${color};">${escapeHtml(item.name)}${escapeHtml(bonusStr)}</div>
        <div class="wf-sub">${escapeHtml(typeLabel)} &bull; ${escapeHtml(subtypeLabel)}</div>
        <div class="wf-sub">
          <span style="color:${color}; font-weight:bold;">${escapeHtml(rar)}</span>
          ${attunementHtml}
        </div>
        ${baseInfoHtml}
      </div>
      <div class="wf-art-wrap">
        ${imgHtml}
      </div>
    </div>
    <div class="wf-body">
      ${bodyHtml}
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// Foundry Item export
// ─────────────────────────────────────────────

export async function saveMagicItemToFoundry(item) {
  const lang        = WorldForgeSettings.lang || 'nl';
  const dndTypeMap  = { weapon: 'weapon', armor: 'equipment', wondrous: 'equipment', ammunition: 'consumable' };
  const dndType     = dndTypeMap[item.baseItem.type] || 'equipment';
  const bonusProp   = item.properties.find(p => p.category === 'enhancement');
  const attackBonus = bonusProp?.bonus ?? 0;
  const descHtml    = item.descriptions.map(d => `<p>${d}</p>`).join('') || '';
  const attunement  = item.requiresAttunement ? { value: 'required' } : { value: '' };

  let systemData = {
    description: { value: descHtml },
    rarity:      dnd5eRarity(item.actualCost),
    attunement,
    price:       { value: _rarityToPrice(item.actualCost), denomination: 'gp' }
  };

  if (item.baseItem.type === 'weapon') {
    const dmgParts  = item.baseItem.damage ? [[item.baseItem.damage, item.baseItem.damage_type]] : [];
    item.properties.filter(p => p.category === 'elemental' && p.id !== 'venom').forEach(p => {
      const elemMap = { flaming: ['1d6', 'fire'], frost_brand: ['1d6', 'cold'], shock: ['1d6', 'lightning'], thundering: ['1d6', 'thunder'], flame_tongue: ['2d6', 'fire'] };
      if (elemMap[p.id]) dmgParts.push(elemMap[p.id]);
    });
    const wpnProps  = {};
    (item.baseItem.properties || []).forEach(prop => { wpnProps[prop] = { value: true }; });
    const isRanged  = item.baseItem.subtype?.includes('ranged');
    const isMartial = item.baseItem.subtype?.includes('martial');
    systemData = {
      ...systemData,
      type:       { value: isMartial ? (isRanged ? 'martialR' : 'martialM') : (isRanged ? 'simpleR' : 'simpleM'), baseItem: item.baseItem.id },
      damage:     { parts: dmgParts, versatile: '' },
      attackBonus,
      proficient: null,
      properties: wpnProps,
      actionType: isRanged ? 'rwak' : 'mwak',
      ability:    item.baseItem.properties?.includes('finesse') ? 'str' : (isRanged ? 'dex' : 'str'),
      critical:   { threshold: null, damage: '' },
      range:      { value: null, long: null, units: isRanged ? 'ft' : '' }
    };
    if (item.baseItem.properties?.includes('finesse')) systemData.properties.fin = { value: true };
  }

  if (item.baseItem.type === 'armor') {
    const armorTypeMap = { light: 'light', medium: 'medium', heavy: 'heavy', shield: 'shield' };
    systemData = {
      ...systemData,
      type:     { value: armorTypeMap[item.baseItem.subtype] || 'light', baseItem: item.baseItem.id },
      armor:    { value: item.baseItem.ac ?? 10, magicalBonus: attackBonus, dex: item.baseItem.ac_modifier === 'dex' ? null : item.baseItem.ac_modifier === 'dex_max2' ? 2 : 0 },
      stealth:  item.baseItem.stealth_disadvantage ?? false,
      strength: 0,
      equipped: false
    };
  }

  if (item.baseItem.type === 'wondrous') {
    systemData = { ...systemData, type: { value: 'trinket', baseItem: item.baseItem.id }, equipped: false };
  }

  if (item.baseItem.type === 'ammunition') {
    systemData = {
      ...systemData,
      type:           { value: 'ammo' },
      damage:         { parts: [[item.baseItem.damage ?? '1', item.baseItem.damage_type ?? 'piercing']], versatile: '' },
      attackBonus,
      quantity:       1,
      consumableType: 'ammo'
    };
  }

  const itemData = {
    name:   item.name,
    type:   dndType,
    img:    item.image || WorldForgeSettings.defaultNpcIcon,
    system: systemData,
    flags:  { 'world-forge-generator': { magicItem: true, baseItemId: item.baseItem.id, properties: item.properties.map(p => p.id), rarity: item.rarity, comfyPrompt: item.comfyPrompt } }
  };

  try {
    const created = await Item.create(itemData);
    ui.notifications.info(`${wft("WF.Notify.MagicItemSaved")}`);
    return created;
  } catch (err) {
    console.error('WorldForge | Fout bij aanmaken magic item:', err);
    ui.notifications.error(wft("WF.Notify.MagicItemSaveFail"));
    return null;
  }
}

function _rarityToPrice(cost) {
  const prices = { 1: 50, 2: 500, 3: 5000, 4: 50000, 5: 200000 };
  return prices[rarityFromCost(cost)] ?? 50;
}

// ─────────────────────────────────────────────
// ComfyUI render
// ─────────────────────────────────────────────

export async function renderMagicItemComfyUI(item) {
  const comfyUrl = WorldForgeSettings.comfyUrl;
  if (!comfyUrl) {
    ui.notifications.warn(wft("WF.Notify.ComfyNoUrl"));
    return null;
  }

  const folder         = WorldForgeSettings.itemArtFolder;
  const filenamePrefix = item.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    const result = await runComfyRender({
      prompt:         item.comfyPrompt,
      negativePrompt: baseNegativePortrait() + ', character, person, human, face, portrait, figure, body, anime, manga',
      width:          512,
      height:         512,
      filenamePrefix
    });

    if (!result?.imageUrl) {
      ui.notifications.warn(wft("WF.Notify.ComfyNoImage"));
      return null;
    }

    const savedPath = await saveComfyImageToFoundry(result.imageUrl, filenamePrefix, folder);
    return savedPath;
  } catch (err) {
    console.error('WorldForge | ComfyUI magic item render mislukt:', err);
    ui.notifications.error(`${wft("WF.Notify.ComfyFail")} ${err.message ?? err}`);
    return null;
  }
}

// ─────────────────────────────────────────────
// MagicItemGenerator KLASSE (BaseGenerator implementatie)
// ─────────────────────────────────────────────

export class MagicItemGenerator extends BaseGenerator {
  static codexType = "magicItem";
  static folder    = "_Random Magic Items";
  static icon      = "fa-wand-magic-sparkles";
  static hasActor  = false;
  static hasComfy  = true;
  static comfyW    = 1024;
  static comfyH    = 768;

  static async generate(options = {}) { return generateMagicItem(options); }
  static render(item)                 { return renderMagicItemCard(item); }
  static getName(item)                { return item.name ?? "Magic Item"; }
  static getImage(item)               { return item.image ?? ""; }

  static getSub(item) {
    return `${item.baseItem?.type ?? ""} · ${RARITY_LABELS[item.actualCost]?.nl ?? ""}`;
  }
}

// ─────────────────────────────────────────────
// Wrappers voor UI
// ─────────────────────────────────────────────

export async function generateAndShowMagicItem(app, options = {}) {
  const item = await generateMagicItem(options);
  app.receiveItem(item);
  return item;
}

export async function getMagicItemDropdownData() {
  const lang = WorldForgeSettings.lang ?? "nl";
  const allItems = await getAllBaseItems();

  const subtypesByType = {};
  for (const item of allItems) {
    if (!subtypesByType[item.type]) subtypesByType[item.type] = new Set();
    subtypesByType[item.type].add(item.subtype);
  }

  return {
    types: Object.entries(TYPE_LABELS).map(([id, labels]) => ({ id, label: labels[lang] ?? labels.nl })),
    subtypesByType: Object.fromEntries(
      Object.entries(subtypesByType).map(([type, subtypes]) => [
        type,
        ['all', ...subtypes].map(s => ({ id: s, label: s === 'all' ? wft('WF.Label.Random') : (SUBTYPE_LABELS[s] || s) }))
      ])
    ),
    rarities: [
      { id: 'random', label: wft('WF.Label.Random') },
      { id: '1',      label: 'Gewoon (Common)' },
      { id: '2',      label: 'Ongewoon (Uncommon)' },
      { id: '3',      label: 'Zeldzaam (Rare)' },
      { id: '4',      label: 'Zeer Zeldzaam (Very Rare)' },
      { id: '5',      label: 'Legendarisch (Legendary)' }
    ]
  };
}