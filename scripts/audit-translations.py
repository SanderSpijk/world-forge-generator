#!/usr/bin/env python3
"""
WorldForge Translation Audit Script

Valideert dat alle wft(...) calls in JS files corresponderende keys hebben
in zowel nl.json als en.json.

Gebruik: python scripts/audit-translations.py
"""

import json
import re
import os
import sys
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ANSI colors
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[96m'
    RESET = '\033[0m'

def log_error(msg):
    print(f"{Colors.RED}✗{Colors.RESET} {msg}")

def log_success(msg):
    print(f"{Colors.GREEN}✓{Colors.RESET} {msg}")

def log_warn(msg):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {msg}")

def log_info(msg):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {msg}")

def load_translations(lang):
    """Laad translation JSON file"""
    file_path = Path(__file__).parent.parent / f"lang/{lang}.json"
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as err:
        log_error(f"Kan {lang}.json niet laden: {err}")
        sys.exit(1)

def find_translation_keys():
    """Vind alle wft() calls in JS files"""
    project_dir = Path(__file__).parent.parent
    keys = set()
    keys_with_files = {}

    # Vind alle JS files recursief (behalve audit-translations.js)
    js_files_found = list(project_dir.rglob("*.js"))

    for js_file in js_files_found:
        if "audit-translations" in js_file.name or "node_modules" in str(js_file):
            continue

        try:
            with open(js_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Regex: wft("KEY") of wft('KEY') - aanpassen voor alle cases
            # Matches: WF.*, WORLDFORGE.*, enz.
            regex = r'wft\s*\(\s*["\']([A-Za-z0-9._]+)["\']\s*\)'
            matches = re.findall(regex, content)

            for key in matches:
                keys.add(key)
                if key not in keys_with_files:
                    keys_with_files[key] = []
                rel_path = js_file.relative_to(project_dir)
                keys_with_files[key].append(str(rel_path))
        except Exception as err:
            log_warn(f"Kan {js_file.name} niet lezen: {err}")

    return sorted(list(keys)), keys_with_files

def audit():
    """Voer audit uit"""
    print("\n📋 WorldForge Translation Audit\n")

    nl_translations = load_translations('nl')
    en_translations = load_translations('en')
    keys, keys_with_files = find_translation_keys()

    log_info(f"Gevonden {len(keys)} unieke translation keys in code")
    log_info(f"NL translations: {len(nl_translations)} keys")
    log_info(f"EN translations: {len(en_translations)} keys")

    print("\n--- VALIDATIE ---\n")

    errors = 0
    missing_nl = []
    missing_en = []

    for key in keys:
        in_nl = key in nl_translations
        in_en = key in en_translations

        if not in_nl:
            missing_nl.append(key)
            errors += 1
        if not in_en:
            missing_en.append(key)
            errors += 1

        if in_nl and in_en:
            continue  # OK
        else:
            status = []
            if not in_nl:
                status.append("NL ✗")
            if not in_en:
                status.append("EN ✗")
            log_error(f"{key} — {', '.join(status)}")

            files = keys_with_files.get(key, [])
            for f in files:
                print(f"     └─ {f}")

    print("\n--- SAMENVATTING ---\n")

    if errors == 0:
        log_success("Alle translation keys zijn compleet!")
        print()
        return 0
    else:
        log_error(f"{errors} ontbrekende translations gevonden\n")

        if missing_nl:
            print(f"{Colors.YELLOW}Ontbreekt in nl.json:{Colors.RESET}")
            for key in missing_nl:
                print(f'  "{key}": ""')

        if missing_en:
            print(f"\n{Colors.YELLOW}Ontbreekt in en.json:{Colors.RESET}")
            for key in missing_en:
                print(f'  "{key}": ""')

        print()
        return 1

if __name__ == "__main__":
    exit_code = audit()
    sys.exit(exit_code)
