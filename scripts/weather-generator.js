/**
 * WorldForge – weather-generator.js (v0.8.2 REFACTORED)
 *
 * Genereert weer op basis van een JSON bestand met weertypen en
 * adjacency (mogelijke opvolgers). Het huidige weer wordt opgeslagen
 * als world setting zodat de volgende generatie van daaruit verder gaat.
 *
 * REFACTORED: BaseGenerator + DataLoader patroon
 * - Wind directions: via DataLoader
 * - Weather JSON: dynamische paden per preset (behouden)
 * - State: world settings (behouden)
 *
 * Exporteert:
 *  - generateWeather(isNight)      – genereert een weer object
 *  - renderWeatherCard(weather)    – rendert de kaart HTML
 *  - generateAndShowWeather()      – wrapper voor WorldForge UI
 *  - getStoredWeatherState()       – leest de opgeslagen staat
 *  - clearWeatherState()           – reset de opgeslagen staat
 *  - WeatherGenerator              – BaseGenerator klasse
 */

import { WorldForgeSettings } from "./settings.js";
import { BaseGenerator } from "./base-generator.js";
import { DataLoader } from "./data-loader.js";

const wft = (key) => WorldForgeSettings.t(key);

// =============================================================================
// CONSTANTEN
// =============================================================================

const STATE_KEY = "currentWeatherState";

// =============================================================================
// HELPERS
// =============================================================================

function clean(text) {
  return String(text ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function randBetween(min, max) {
  min = Number(min ?? 0);
  max = Number(max ?? min);
  if (max < min) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(entries) {
  if (!entries?.length) return null;
  const total = entries.reduce((s, e) => s + Number(e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= Number(entry.weight ?? 1);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

// =============================================================================
// WIND EN TEMPERATUUR BESCHRIJVINGEN — tweetalig
// =============================================================================

export function getWindDescription(wind) {
  const keys = [
    { max: 0,  key: "WF.Weather.Wind.Calm"         },
    { max: 1,  key: "WF.Weather.Wind.VeryWeak"     },
    { max: 2,  key: "WF.Weather.Wind.Weak"         },
    { max: 3,  key: "WF.Weather.Wind.Moderate"     },
    { max: 4,  key: "WF.Weather.Wind.Fresh"        },
    { max: 5,  key: "WF.Weather.Wind.Strong"       },
    { max: 6,  key: "WF.Weather.Wind.NearGale"     },
    { max: 7,  key: "WF.Weather.Wind.Gale"         },
    { max: 8,  key: "WF.Weather.Wind.SevereGale"   },
    { max: 9,  key: "WF.Weather.Wind.Storm"        },
    { max: 10, key: "WF.Weather.Wind.ViolentStorm" },
    { max: 11, key: "WF.Weather.Wind.Hurricane"    },
  ];
  for (const level of keys) {
    if (wind <= level.max) return wft(level.key);
  }
  return wft("WF.Weather.Wind.HurricaneMax");
}

export function getTemperatureDescription(temp) {
  const levels = [
    { max: 0,  key: "WF.Weather.Temp.Unbearable" },
    { max: 10, key: "WF.Weather.Temp.Cool"       },
    { max: 18, key: "WF.Weather.Temp.Pleasant"   },
    { max: 24, key: "WF.Weather.Temp.Warm"       },
    { max: 30, key: "WF.Weather.Temp.Tropical"   },
    { max: 36, key: "WF.Weather.Temp.Hot"        },
  ];
  for (const level of levels) {
    if (temp <= level.max) return wft(level.key);
  }
  return wft("WF.Weather.Temp.Scorching");
}

function describeTrend(previousScore, newScore) {
  if (previousScore == null) return "WF.Weather.Trend.First";
  if (newScore > previousScore) return "WF.Weather.Trend.Worsening";
  if (newScore < previousScore) return "WF.Weather.Trend.Improving";
  return "WF.Weather.Trend.Stable";
}

function formatNextTypes(nextEntries) {
  if (!Array.isArray(nextEntries) || !nextEntries.length) return "-";
  return nextEntries.map(e =>
    typeof e === "string" ? e
    : e?.name ? `${e.name} (${e.weight ?? 1})`
    : null
  ).filter(Boolean).join(", ");
}

// =============================================================================
// ICOONNAMEN
// =============================================================================

function getIconBaseName(weatherName) {
  return clean(weatherName).replace(/\s+/g, "");
}

export function getWeatherIconPath(weatherName, isNight = false) {
  const folder = WorldForgeSettings.weatherIconFolder;
  const base   = getIconBaseName(weatherName);
  return isNight
    ? `${folder}/${base}_Night.png`
    : `${folder}/${base}.png`;
}

// =============================================================================
// WIND DIRECTIONS — via DataLoader
// =============================================================================

async function rollWindDirection() {
  const lang = WorldForgeSettings.lang ?? "nl";
  try {
    const data = await DataLoader.load("weather/wind-directions.json");
    const dirs = data.windDirections ?? data ?? [];
    const pick = pickRandom(dirs);
    return lang === "en" ? (pick?.en ?? wft("WF.Weather.Unknown")) : (pick?.nl ?? wft("WF.Weather.Unknown"));
  } catch (e) {
    console.warn("WorldForge | Kon wind-directions.json niet laden:", e);
    // Fallback
    const fallback = [
      { nl: "Noord", en: "North" }, { nl: "Noordoost", en: "Northeast" },
      { nl: "Oost",  en: "East"  }, { nl: "Zuidoost",  en: "Southeast" },
      { nl: "Zuid",  en: "South" }, { nl: "Zuidwest",  en: "Southwest" },
      { nl: "West",  en: "West"  }, { nl: "Noordwest", en: "Northwest" },
    ];
    const pick = pickRandom(fallback);
    return lang === "en" ? pick.en : pick.nl;
  }
}

// =============================================================================
// STATE — opgeslagen in world setting
// =============================================================================

export function getStoredWeatherState() {
  try {
    const raw = game.settings.get("world-forge-generator", STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("WorldForge | Kon weather state niet lezen:", err);
    return null;
  }
}

export async function setStoredWeatherState(state) {
  await game.settings.set("world-forge-generator", STATE_KEY, JSON.stringify(state));
}

export async function clearWeatherState() {
  await game.settings.set("world-forge-generator", STATE_KEY, "");
}

// =============================================================================
// WEER LOGICA
// =============================================================================

function buildWeatherMap(data) {
  const map = new Map();
  for (const item of data.weather_types) {
    map.set(clean(item.name), item);
  }
  return map;
}

function getInitialWeather(weatherMap) {
  const candidates = [
    "Clear", "Partly Cloudy", "Fog", "Cloudy", "Overcast", "Light Rain"
  ].filter(n => weatherMap.has(n));
  const name = pickRandom(candidates) || [...weatherMap.keys()][0];
  return name ? weatherMap.get(name) : null;
}

function chooseNextWeather(current, weatherMap) {
  const nextEntries = Array.isArray(current.next) ? current.next : [];
  if (!nextEntries.length) return current;

  const candidates = nextEntries.map(entry => {
    const name    = typeof entry === "string" ? entry : entry?.name;
    const weight  = typeof entry === "object" ? Number(entry?.weight ?? 1) : 1;
    const weather = weatherMap.get(clean(name));
    return weather ? { weather, weight } : null;
  }).filter(Boolean);

  const picked = weightedPick(candidates);
  return picked?.weather ?? current;
}

function sanitize(entry) {
  const desc = entry.description;
  const descObj = (typeof desc === "object" && desc !== null)
    ? desc
    : { nl: clean(desc ?? ""), en: clean(desc ?? "") };

  return {
    ...entry,
    name:        clean(entry.name),
    score:       Number(entry.score    ?? 0),
    min_temp:    Number(entry.min_temp ?? 0),
    max_temp:    Number(entry.max_temp ?? 0),
    min_wind:    Number(entry.min_wind ?? 0),
    max_wind:    Number(entry.max_wind ?? 0),
    description: descObj,
    next:        Array.isArray(entry.next) ? entry.next : []
  };
}

// =============================================================================
// WEER LADEN (dynamische paden per preset)
// =============================================================================

async function loadWeatherData() {
  const path = WorldForgeSettings.weatherJsonPath;
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.weather_types?.length) throw new Error("Geen weather_types in JSON");
    return data;
  } catch (err) {
    console.error("WorldForge | Fout bij laden weather JSON:", err);
    ui.notifications.error(`${wft("WF.Notify.WeatherJsonFail")} ${path}`);
    return null;
  }
}

// =============================================================================
// HOOFDFUNCTIE
// =============================================================================

export async function generateWeather(isNight = false) {
  const data = await loadWeatherData();
  if (!data) return null;

  const lang          = WorldForgeSettings.lang ?? "nl";
  const weatherMap    = buildWeatherMap(data);
  const previousState = getStoredWeatherState();

  let selected;
  let previousName  = null;
  let previousScore = null;

  if (previousState?.name && weatherMap.has(clean(previousState.name))) {
    const prev    = sanitize(weatherMap.get(clean(previousState.name)));
    previousName  = prev.name;
    previousScore = prev.score;
    selected      = sanitize(chooseNextWeather(prev, weatherMap));
  } else {
    const initial = getInitialWeather(weatherMap);
    if (!initial) {
      ui.notifications.error(wft("WF.Notify.WeatherNoStart"));
      return null;
    }
    selected = sanitize(initial);
  }

  const windDirection = await rollWindDirection();

  let temperature = randBetween(selected.min_temp, selected.max_temp);
  if (isNight) temperature -= randBetween(2, 4);

  let windStrength = randBetween(selected.min_wind, selected.max_wind);
  if (selected.name === "Tornado")      windStrength = Math.max(windStrength, 9);
  if (selected.name === "Storm")        windStrength = Math.max(windStrength, 6);
  if (selected.name === "Thunderstorm") windStrength = Math.max(windStrength, 5);
  if (selected.name === "Blizzard")     windStrength = Math.max(windStrength, 6);
  if (selected.name === "Heatwave")     temperature  = Math.max(temperature,  32);

  const temperatureText = getTemperatureDescription(temperature);
  const windText        = getWindDescription(windStrength);

  const descNl = selected.description.nl ||
    `Tijdens de ${isNight ? "nacht" : "dag"} is het ${selected.name.toLowerCase()} ` +
    `met een ${getWindDescription(windStrength).toLowerCase()}e wind uit ${windDirection.toLowerCase()}. ` +
    `De lucht voelt ${getTemperatureDescription(temperature).toLowerCase()} aan.`;

  const descEn = selected.description.en ||
    `During the ${isNight ? "night" : "day"} it is ${selected.name.toLowerCase()} ` +
    `with a ${getWindDescription(windStrength).toLowerCase()} wind from ${windDirection}. ` +
    `The air feels ${getTemperatureDescription(temperature).toLowerCase()}.`;

  const description = { nl: descNl, en: descEn };

  const weather = {
    ...selected,
    description,
    isNight,
    windDirection,
    temperature,
    windStrength,
    temperatureText,
    windText,
    previousName,
    trend: describeTrend(previousScore, selected.score)
  };

  await setStoredWeatherState({
    name:          weather.name,
    score:         weather.score,
    isNight:       weather.isNight,
    temperature:   weather.temperature,
    windStrength:  weather.windStrength,
    windDirection: weather.windDirection,
    generatedAt:   new Date().toISOString()
  });

  return weather;
}

// =============================================================================
// HTML RENDER
// =============================================================================

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderWeatherCard(weather, { gmView = false } = {}) {
  if (!weather) return "";

  const lang       = WorldForgeSettings.lang ?? "nl";
  const L          = (obj) => typeof obj === "object" ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");

  const iconPath    = getWeatherIconPath(weather.name, weather.isNight);
  const iconDayPath = getWeatherIconPath(weather.name, false);
  const folder      = WorldForgeSettings.weatherIconFolder;
  const momentText  = weather.isNight ? wft("WF.Label.Night") : wft("WF.Label.Day");
  const momentIcon  = weather.isNight
    ? `${folder}/Clear_Night.png`
    : `${folder}/Clear.png`;

  const trendKey   = weather.trend ?? "WF.Weather.Trend.Stable";
  const trendLabel = wft(trendKey);
  const trendColor = trendKey === "WF.Weather.Trend.Worsening" ? "#c0392b"
    : trendKey === "WF.Weather.Trend.Improving" ? "#27ae60"
    : "#888";

  const techDetails = gmView ? `
  <details style="margin-top:8px;">
    <summary style="cursor:pointer; font-size:11px; color:var(--wf-text-dim);">${wft("WF.Weather.TechDetails")}</summary>
    <div style="margin-top:6px; font-size:11px; color:var(--wf-text-dim);">
      <div><strong>${wft("WF.Weather.TempRange")}</strong> ${weather.min_temp}–${weather.max_temp}°C</div>
      <div><strong>${wft("WF.Weather.WindRange")}</strong> ${weather.min_wind}–${weather.max_wind}</div>
      <div><strong>${wft("WF.Weather.NextTypes")}</strong> ${formatNextTypes(weather.next)}</div>
      <div><strong>${wft("WF.Weather.Icon")}</strong> ${getIconBaseName(weather.name)}${weather.isNight ? "_Night" : ""}.png</div>
    </div>
  </details>` : "";

  return `
<div class="wf-card">

  <!-- ── HEADER ── -->
  <div class="wf-header wf-weather-header">
    <div class="wf-title-block" style="border-left:none;">
      <p class="wf-name">${weather.name}</p>
      <p class="wf-subtitle">
        <img src="${momentIcon}"
             onerror="this.style.display='none';"
             style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px;">
        ${momentText}
        &nbsp;·&nbsp;
        <span style="color:${trendColor};">${trendLabel}</span>
      </p>
    </div>
    <div class="wf-weather-icon-wrap">
      <img src="${iconPath}"
           onerror="this.onerror=null; this.src='${iconDayPath}';"
           class="wf-weather-icon"
           title="${weather.name}">
    </div>
  </div>

  <!-- ── WEER DETAILS ── -->
  <div class="wf-body wf-weather-body">
    <div class="wf-weather-stats">
      <div class="wf-weather-stat">
        <span class="wf-weather-stat-label">${wft("WF.Weather.Stat.Temperature")}</span>
        <span class="wf-weather-stat-value">${weather.temperature}°C</span>
        <span class="wf-weather-stat-sub">${L(weather.temperatureText)}</span>
      </div>
      <div class="wf-weather-stat">
        <span class="wf-weather-stat-label">${wft("WF.Weather.Stat.WindStrength")}</span>
        <span class="wf-weather-stat-value">${weather.windStrength}</span>
        <span class="wf-weather-stat-sub">${L(weather.windText)}</span>
      </div>
      <div class="wf-weather-stat">
        <span class="wf-weather-stat-label">${wft("WF.Weather.Stat.WindDir")}</span>
        <span class="wf-weather-stat-value">${weather.windDirection}</span>
        <span class="wf-weather-stat-sub">&nbsp;</span>
      </div>
    </div>

    <div class="wf-readout" style="margin-top:8px;">
      ${escapeHtml(L(weather.description))}
    </div>

    ${weather.previousName ? `
    <div style="margin-top:6px; font-size:11px; color:var(--wf-text-dim);">
      ${wft("WF.Weather.PreviousWeather")} ${weather.previousName}
    </div>` : ""}

    ${techDetails}
  </div>

</div>`;
}

// =============================================================================
// WeatherGenerator KLASSE (BaseGenerator implementatie)
// =============================================================================

export class WeatherGenerator extends BaseGenerator {
  static codexType = "weather";
  static folder    = "_Random Weather";
  static icon      = "fa-cloud-sun";
  static hasActor  = false;
  static hasComfy  = false;
  static comfyW    = 0;
  static comfyH    = 0;

  static async generate(options = {}) {
    return generateWeather(options.isNight ?? false);
  }
  static render(item) {
    return renderWeatherCard(item, { buttons: false });
  }
  static getName(item) {
    return item.name ?? "Weather";
  }
  static getImage(item) {
    return getWeatherIconPath(item.name, item.isNight);
  }
  static getSub(item) {
    const lang = WorldForgeSettings.lang ?? "nl";
    const L = (obj) => typeof obj === "object" ? (obj[lang] ?? obj.nl ?? "") : (obj ?? "");
    return `${L(item.temperatureText)} · ${L(item.windText)}`;
  }
}

// =============================================================================
// WRAPPER VOOR WORLDFORGE UI
// =============================================================================

export async function generateAndShowWeather(isNight = false) {
  const weather = await generateWeather(isNight);
  if (weather && window._worldForgeApp) {
    window._worldForgeApp.receiveItem("weather", weather);
  }
  return weather;
}
