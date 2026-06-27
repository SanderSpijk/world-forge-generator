#!/usr/bin/env node
/**
 * WorldForge Translation Audit Script
 *
 * Valideert dat alle wft(...) calls in JS files corresponderende keys hebben
 * in zowel nl.json als en.json.
 *
 * Gebruik: node scripts/audit-translations.js
 *
 * Exit code: 0 (OK) of 1 (fouten gevonden)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ANSI colors voor output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

const log = {
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`)
};

// Laad translation files
function loadTranslations(lang) {
  const filePath = path.join(__dirname, `../lang/${lang}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    log.error(`Kan ${lang}.json niet laden: ${err.message}`);
    process.exit(1);
  }
}

// Vind alle wft() calls in JS files
function findTranslationKeys() {
  const jsFiles = glob.sync(path.join(__dirname, '**/*.js'), {
    ignore: [
      path.join(__dirname, 'audit-translations.js'),
      path.join(__dirname, 'node_modules/**')
    ]
  });

  const keys = new Set();
  const keysWithFiles = new Map(); // key -> [files where used]

  jsFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      // Regex: wft("KEY") of wft('KEY') of wft(\`KEY\`)
      const regex = /wft\s*\(\s*["'`]([A-Z0-9._]+)["'`]\s*\)/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        keys.add(key);

        if (!keysWithFiles.has(key)) {
          keysWithFiles.set(key, []);
        }
        keysWithFiles.get(key).push(path.relative(process.cwd(), file));
      }
    } catch (err) {
      log.warn(`Kan ${file} niet lezen: ${err.message}`);
    }
  });

  return { keys: Array.from(keys).sort(), keysWithFiles };
}

// Main audit
function audit() {
  console.log('\n📋 WorldForge Translation Audit\n');

  const nlTranslations = loadTranslations('nl');
  const enTranslations = loadTranslations('en');
  const { keys, keysWithFiles } = findTranslationKeys();

  log.info(`Gevonden ${keys.length} unieke translation keys in code`);
  log.info(`NL translations: ${Object.keys(nlTranslations).length} keys`);
  log.info(`EN translations: ${Object.keys(enTranslations).length} keys`);

  console.log('\n--- VALIDATIE ---\n');

  let errors = 0;
  const missing = {
    nl: [],
    en: []
  };

  keys.forEach(key => {
    const inNl = key in nlTranslations;
    const inEn = key in enTranslations;

    if (!inNl) {
      missing.nl.push(key);
      errors++;
    }
    if (!inEn) {
      missing.en.push(key);
      errors++;
    }

    if (inNl && inEn) {
      // OK
    } else {
      const status = [];
      if (!inNl) status.push('NL ✗');
      if (!inEn) status.push('EN ✗');
      log.error(`${key} — ${status.join(', ')}`);

      const files = keysWithFiles.get(key);
      files.forEach(f => console.log(`     └─ ${f}`));
    }
  });

  console.log('\n--- SAMENVATTING ---\n');

  if (errors === 0) {
    log.success('Alle translation keys zijn compleet!');
    console.log();
    return 0;
  } else {
    log.error(`${errors} ontbrekende translations gevonden\n`);

    if (missing.nl.length > 0) {
      console.log(`${colors.yellow}Ontbreekt in nl.json:${colors.reset}`);
      missing.nl.forEach(key => {
        console.log(`  "${key}": ""`);
      });
    }

    if (missing.en.length > 0) {
      console.log(`\n${colors.yellow}Ontbreekt in en.json:${colors.reset}`);
      missing.en.forEach(key => {
        console.log(`  "${key}": ""`);
      });
    }

    console.log();
    return 1;
  }
}

// Run
const exitCode = audit();
process.exit(exitCode);
