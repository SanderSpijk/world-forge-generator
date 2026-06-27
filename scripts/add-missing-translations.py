#!/usr/bin/env python3
"""
Add missing translation keys to nl.json and en.json
"""

import json
import sys
import io
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# All missing keys from audit output
missing_keys = {
    "WF.Btn.Cancel": {"en": "Cancel", "nl": "Annuleren"},
    "WF.Btn.Confirm": {"en": "Confirm", "nl": "Bevestigen"},
    "WF.Faction.Label.Members": {"en": "Members", "nl": "Leden"},
    "WF.Inn.Subtitle": {"en": "Inn", "nl": "Herberg"},
    "WF.Label.LootType": {"en": "Loot Type", "nl": "Buit Type"},
    "WF.Label.Tools": {"en": "Tools", "nl": "Gereedschappen"},
    "WF.Magic.Label.Attunement": {"en": "Attunement", "nl": "Attunement"},
    "WF.Magic.NoProperties": {"en": "No properties", "nl": "Geen eigenschappen"},
    "WF.NPC.Label.PassivePerc": {"en": "Passive Perception", "nl": "Passieve Perceptie"},
    "WF.NPC.Label.Skills": {"en": "Skills", "nl": "Vaardigheden"},
    "WF.Nav.Adventure": {"en": "Adventure", "nl": "Avontuur"},
    "WF.Nav.People": {"en": "People", "nl": "Mensen"},
    "WF.Nav.Places": {"en": "Places", "nl": "Plaatsen"},
    "WF.Nav.World": {"en": "World", "nl": "Wereld"},
    "WF.Notify.ActorCreated": {"en": "Actor created", "nl": "Actor aangemaakt"},
    "WF.Notify.ActorFail": {"en": "Failed to create actor", "nl": "Actor aanmaken mislukt"},
    "WF.Notify.ArtworkReady": {"en": "Artwork ready", "nl": "Artwork gereed"},
    "WF.Notify.CodexCreated": {"en": "Saved to Campaign Codex", "nl": "Opgeslagen naar Campaign Codex"},
    "WF.Notify.CodexFail": {"en": "Failed to save to Campaign Codex", "nl": "Opslaan naar Campaign Codex mislukt"},
    "WF.Notify.CodexNPCCreated": {"en": "NPC saved to Campaign Codex", "nl": "NPC opgeslagen naar Campaign Codex"},
    "WF.Notify.ComfyFail": {"en": "ComfyUI request failed", "nl": "ComfyUI verzoek mislukt"},
    "WF.Notify.ComfyNoImage": {"en": "No image generated", "nl": "Geen afbeelding gegenereerd"},
    "WF.Notify.ComfyNoUrl": {"en": "ComfyUI URL not configured", "nl": "ComfyUI URL niet geconfigureerd"},
    "WF.Notify.ComfyRenderFail": {"en": "Render failed", "nl": "Renderen mislukt"},
    "WF.Notify.DragNotReady": {"en": "Item not ready for dragging", "nl": "Item niet klaar om te slepen"},
    "WF.Notify.InnPublished": {"en": "Inn published to chat", "nl": "Herberg gepubliceerd naar chat"},
    "WF.Notify.JournalCreated": {"en": "Journal created", "nl": "Dagboek aangemaakt"},
    "WF.Notify.JournalFail": {"en": "Failed to create journal", "nl": "Dagboek aanmaken mislukt"},
    "WF.Notify.JournalSaveFail": {"en": "Failed to save journal", "nl": "Dagboek opslaan mislukt"},
    "WF.Notify.MagicItemSaveFail": {"en": "Failed to save magic item", "nl": "Magisch item opslaan mislukt"},
    "WF.Notify.MagicItemSaved": {"en": "Magic item saved", "nl": "Magisch item opgeslagen"},
    "WF.Notify.NPCSaved": {"en": "NPC saved", "nl": "NPC opgeslagen"},
    "WF.Notify.NoCharacters": {"en": "No characters found", "nl": "Geen karakters gevonden"},
    "WF.Notify.NoMoreDistricts": {"en": "No more districts available", "nl": "Geen meer beschikbare districten"},
    "WF.Notify.OnlyCharacters": {"en": "Only characters allowed", "nl": "Alleen karakters toegestaan"},
    "WF.Notify.PdfReady": {"en": "PDF ready", "nl": "PDF gereed"},
    "WF.Notify.PdfStarted": {"en": "PDF generation started", "nl": "PDF-generatie gestart"},
    "WF.Notify.PortraitReady": {"en": "Portrait ready", "nl": "Portret gereed"},
    "WF.Notify.PublishFail": {"en": "Failed to publish", "nl": "Publiceren mislukt"},
    "WF.Notify.PublishedPlayers": {"en": "Published to players", "nl": "Gepubliceerd naar spelers"},
    "WF.Notify.RenderRunning": {"en": "Rendering in progress", "nl": "Renderen in uitvoering"},
    "WF.Notify.ShopGenFail": {"en": "Failed to generate shop", "nl": "Shop genereren mislukt"},
    "WF.Notify.TableNotFound": {"en": "Rollable table not found", "nl": "Draaitabel niet gevonden"},
    "WF.Notify.TavernPublished": {"en": "Tavern published to chat", "nl": "Taverne gepubliceerd naar chat"},
    "WF.Notify.WeatherJsonFail": {"en": "Weather config failed", "nl": "Weerconfig mislukt"},
    "WF.Notify.WeatherNoStart": {"en": "No starting weather", "nl": "Geen startend weer"},
    "WF.Notify.WeatherReset": {"en": "Weather reset", "nl": "Weer ingesteld"},
    "WF.PDF.SelectChar": {"en": "Select character to export", "nl": "Selecteer karakter om te exporteren"},
    "WF.POI.Label.Building": {"en": "Building", "nl": "Gebouw"},
    "WF.POI.Label.Category": {"en": "Category", "nl": "Categorie"},
    "WF.POI.Label.POI": {"en": "POI", "nl": "POI"},
    "WF.POI.Section.People": {"en": "Inhabitants", "nl": "Bewoners"},
    "WF.Ship.Section.CrewMembers": {"en": "Crew Members", "nl": "Bemanningsleden"},
    "WF.Ship.Spec.Cannons": {"en": "Cannons", "nl": "Kanonnen"},
    "WF.Ship.Spec.Cargo": {"en": "Cargo", "nl": "Lading"},
    "WF.Ship.Spec.Crew": {"en": "Crew", "nl": "Bemanning"},
    "WF.Ship.Spec.Decks": {"en": "Decks", "nl": "Dekken"},
    "WF.Ship.Spec.Length": {"en": "Length", "nl": "Lengte"},
    "WF.Ship.Spec.Masts": {"en": "Masts", "nl": "Masten"},
    "WF.Ship.Spec.Type": {"en": "Type", "nl": "Type"},
    "WF.Ship.Spec.Width": {"en": "Width", "nl": "Breedte"},
    "WF.Status.ArtworkReady": {"en": "Artwork Ready", "nl": "Artwork Gereed"},
    "WF.Status.NotGenerated": {"en": "Not Generated", "nl": "Niet Gegenereerd"},
    "WF.Tavern.Subtitle": {"en": "Tavern", "nl": "Taverne"},
    "WF.UI.ActorNotFound": {"en": "Actor not found", "nl": "Actor niet gevonden"},
    "WF.UI.ChooseChar": {"en": "Choose a character", "nl": "Kies een karakter"},
    "WF.UI.DropActorHint": {"en": "Drop an actor here", "nl": "Sleep hier een actor naartoe"},
    "WF.Weather.Icon": {"en": "Weather Icon", "nl": "Weer Icoon"},
    "WF.Weather.NextTypes": {"en": "Next Weather Types", "nl": "Volgende Weertypen"},
    "WF.Weather.PreviousWeather": {"en": "Previous Weather", "nl": "Vorig Weer"},
    "WF.Weather.Stat.Temperature": {"en": "Temperature", "nl": "Temperatuur"},
    "WF.Weather.Stat.WindDir": {"en": "Wind Direction", "nl": "Windrichting"},
    "WF.Weather.Stat.WindStrength": {"en": "Wind Strength", "nl": "Windkracht"},
    "WF.Weather.TechDetails": {"en": "Technical Details", "nl": "Technische Details"},
    "WF.Weather.Temp.Scorching": {"en": "Scorching", "nl": "Verschroeiend"},
    "WF.Weather.TempRange": {"en": "Temperature Range", "nl": "Temperatuurbereik"},
    "WF.Weather.Unknown": {"en": "Unknown", "nl": "Onbekend"},
    "WF.Weather.Wind.HurricaneMax": {"en": "Hurricane", "nl": "Orkaan"},
    "WF.Weather.WindRange": {"en": "Wind Range", "nl": "Windbereik"},
}

def add_missing_keys():
    project_dir = Path(__file__).parent.parent

    # Load existing translations
    nl_path = project_dir / "lang" / "nl.json"
    en_path = project_dir / "lang" / "en.json"

    with open(nl_path, 'r', encoding='utf-8') as f:
        nl_trans = json.load(f)
    with open(en_path, 'r', encoding='utf-8') as f:
        en_trans = json.load(f)

    # Add missing keys
    added_nl = 0
    added_en = 0

    for key, values in sorted(missing_keys.items()):
        if key not in nl_trans:
            nl_trans[key] = values["nl"]
            added_nl += 1
        if key not in en_trans:
            en_trans[key] = values["en"]
            added_en += 1

    # Save back
    with open(nl_path, 'w', encoding='utf-8') as f:
        json.dump(nl_trans, f, ensure_ascii=False, indent=2)
    with open(en_path, 'w', encoding='utf-8') as f:
        json.dump(en_trans, f, ensure_ascii=False, indent=2)

    print(f"✓ Added {added_nl} keys to nl.json")
    print(f"✓ Added {added_en} keys to en.json")
    print(f"✓ Total keys now in nl.json: {len(nl_trans)}")
    print(f"✓ Total keys now in en.json: {len(en_trans)}")

if __name__ == "__main__":
    add_missing_keys()
