/**
 * WorldForge – comfyui.js
 *
 * Gedeelde ComfyUI-integratie voor alle generators.
 * Alle generators (NPC, Shop, Inn, Tavern) gebruiken dezelfde
 * workflow-structuur – alleen de prompt, afmetingen en bestandsnaam
 * verschillen per generator.
 *
 * Werkwijze:
 *  1. buildComfyWorkflow()  – bouw de JSON workflow
 *  2. runComfyRender()      – stuur naar ComfyUI en wacht op resultaat
 *  3. saveComfyImageToFoundry() – download en upload naar Foundry
 */

import { WorldForgeSettings } from "./settings.js";
import { sleep, formatForFile } from "./utils.js";

// =============================================================================
// BESCHIKBAARHEID + CHECKPOINTS
// =============================================================================

/**
 * Controleert of ComfyUI bereikbaar is via een snelle ping naar /system_stats.
 * Geeft true terug als ComfyUI reageert, anders false.
 * Timeout na 3 seconden zodat de UI niet blijft hangen.
 *
 * @returns {Promise<boolean>}
 */
export async function pingComfyUI() {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 3000);
    const resp       = await fetch(
      `${WorldForgeSettings.comfyUrl}/system_stats`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Haalt alle beschikbare checkpoints op via ComfyUI's /object_info endpoint.
 * Geeft een array van bestandsnamen terug (bijv. ["dreamshaper_8.safetensors"]).
 * Geeft een lege array terug als ComfyUI niet bereikbaar is.
 *
 * @returns {Promise<string[]>}
 */
export async function fetchComfyCheckpoints() {
  try {
    const resp = await fetch(
      `${WorldForgeSettings.comfyUrl}/object_info/CheckpointLoaderSimple`
    );
    if (!resp.ok) return [];
    const data       = await resp.json();
    const checkpoints = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    return Array.isArray(checkpoints) ? checkpoints : [];
  } catch {
    return [];
  }
}

// =============================================================================
// WORKFLOW BUILDER
// =============================================================================

/**
 * Bouwt een standaard KSampler ComfyUI workflow JSON.
 * Alle node-nummers zijn vast (3=sampler, 4=checkpoint, 5=latent,
 * 6=positive prompt, 7=negative prompt, 8=VAE decode, 9=save image).
 *
 * @param {string} prompt          - Positieve prompt tekst
 * @param {string} negativePrompt  - Negatieve prompt tekst
 * @param {string} filenamePrefix  - Prefix voor de opgeslagen afbeelding
 * @param {number} width           - Breedte in pixels (standaard 512)
 * @param {number} height          - Hoogte in pixels (standaard 1024)
 */
export function buildComfyWorkflow(
  prompt, negativePrompt, filenamePrefix,
  width = 512, height = 1024
) {
  return {
    // Node 3: KSampler – de kern van de diffusie
    "3": {
      inputs: {
        seed:         Math.floor(Math.random() * 999999999999999), // Willekeurige seed per run
        steps:        28,
        cfg:          7,
        sampler_name: "euler",
        scheduler:    "normal",
        denoise:      1,
        model:        ["4", 0],        // Verwijzing naar checkpoint node
        positive:     ["6", 0],        // Verwijzing naar positieve prompt node
        negative:     ["7", 0],        // Verwijzing naar negatieve prompt node
        latent_image: ["5", 0]         // Verwijzing naar lege latent-afbeelding
      },
      class_type: "KSampler"
    },

    // Node 4: Checkpoint loader – laadt het AI-model
    "4": {
      inputs: { ckpt_name: WorldForgeSettings.comfyCheckpoint },
      class_type: "CheckpointLoaderSimple"
    },

    // Node 5: Lege latent-afbeelding – bepaalt de afmetingen
    "5": {
      inputs: { width, height, batch_size: 1 },
      class_type: "EmptyLatentImage"
    },

    // Node 6: Positieve prompt (wat er WEL in de afbeelding moet)
    "6": {
      inputs: { text: prompt, clip: ["4", 1] },
      class_type: "CLIPTextEncode"
    },

    // Node 7: Negatieve prompt (wat er NIET in de afbeelding moet)
    "7": {
      inputs: { text: negativePrompt, clip: ["4", 1] },
      class_type: "CLIPTextEncode"
    },

    // Node 8: VAE decoder – converteert latent-ruimte naar pixels
    "8": {
      inputs: { samples: ["3", 0], vae: ["4", 2] },
      class_type: "VAEDecode"
    },

    // Node 9: Sla de afbeelding op in de ComfyUI output-map
    "9": {
      inputs: { filename_prefix: filenamePrefix, images: ["8", 0] },
      class_type: "SaveImage"
    }
  };
}

// =============================================================================
// VIEW URL BUILDER
// =============================================================================

/**
 * Bouwt een URL om een gegenereerde afbeelding op te halen van ComfyUI.
 * De cacheBust-parameter voorkomt dat de browser een oude versie toont.
 *
 * @param {object} imageInfo  - Object met filename, subfolder en type
 * @returns {string}          - Volledige URL
 */
export function buildComfyViewUrl(imageInfo) {
  const { filename, subfolder = "", type = "output" } = imageInfo;
  const base = WorldForgeSettings.comfyUrl;
  return `${base}/view`
    + `?filename=${encodeURIComponent(filename)}`
    + `&subfolder=${encodeURIComponent(subfolder)}`
    + `&type=${encodeURIComponent(type)}`
    + `&cb=${Date.now()}`;   // Cache-busting timestamp
}

// =============================================================================
// RESULTAAT EXTRACTOR
// =============================================================================

/**
 * Haalt de afbeeldings-info op uit de ComfyUI history response.
 * Kijkt eerst naar node 9 (de SaveImage node), daarna naar alle
 * andere output-nodes als fallback.
 *
 * @param {object} history   - JSON response van /history/{promptId}
 * @param {string} promptId  - De prompt ID om op te zoeken
 * @returns {object|null}    - { filename, subfolder, type } of null
 */
function extractComfyImage(history, promptId) {
  const record = history?.[promptId];
  if (!record?.outputs) return null;

  // IMPORTANT: Alleen node 9 (SaveImage) gebruiken - nooit fallback naar andere nodes!
  // Fallback kan de verkeerde (intermediate) afbeelding pakken
  const n9 = record.outputs["9"];
  if (n9?.images?.length) return n9.images[0];

  // Als node 9 niets heeft, is er iets fout met de workflow
  console.warn(`ComfyUI: Node 9 (SaveImage) had geen afbeelding. promptId=${promptId}, outputs=${Object.keys(record.outputs).join(",")}`);
  return null;
}

// =============================================================================
// RENDER + POLL
// =============================================================================

/**
 * Voert een volledige ComfyUI render uit:
 *  1. Bouwt de workflow
 *  2. Stuurt naar /prompt
 *  3. Polt /history/{id} totdat de afbeelding klaar is
 *  4. Geeft de resultaat-info terug
 *
 * Gooit een Error als ComfyUI niet bereikbaar is of de timeout
 * wordt overschreden.
 *
 * @param {object} opts
 * @param {string} opts.prompt           - Positieve prompt
 * @param {string} opts.negativePrompt   - Negatieve prompt
 * @param {number} opts.width            - Breedte (standaard 512)
 * @param {number} opts.height           - Hoogte (standaard 1024)
 * @param {string} opts.filenamePrefix   - Prefix voor de bestandsnaam
 *
 * @returns {{ promptId, fileName, subfolder, type, imageUrl }}
 */
export async function runComfyRender({
  prompt, negativePrompt,
  width = 512, height = 1024,
  filenamePrefix
}) {
  const workflow = buildComfyWorkflow(
    prompt, negativePrompt, filenamePrefix, width, height
  );
  const base = WorldForgeSettings.comfyUrl;

  // Stuur de workflow naar ComfyUI
  const resp = await fetch(`${base}/prompt`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ prompt: workflow })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`ComfyUI fout ${resp.status}: ${errText}`);
  }

  const { prompt_id: promptId } = await resp.json();
  if (!promptId) throw new Error("Geen prompt_id ontvangen van ComfyUI");

  // Poll de history-endpoint totdat de afbeelding klaar is
  const timeout = WorldForgeSettings.comfyTimeoutMs;
  const poll    = WorldForgeSettings.comfyPollMs;
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const hr = await fetch(`${base}/history/${encodeURIComponent(promptId)}`);
    if (hr.ok) {
      const img = extractComfyImage(await hr.json(), promptId);
      if (img?.filename) {
        // Afbeelding is klaar – geef alle info terug
        return {
          promptId,
          fileName: img.filename,
          subfolder: img.subfolder ?? "",
          type:      img.type ?? "output",
          imageUrl:  buildComfyViewUrl(img)
        };
      }
    }
    // Wacht even voor de volgende poll
    await sleep(poll);
  }

  throw new Error("Timeout tijdens wachten op ComfyUI output");
}

// =============================================================================
// OPSLAAN IN FOUNDRY
// =============================================================================

/**
 * Downloadt een gegenereerde afbeelding van ComfyUI en uploadt die
 * naar Foundry via FilePicker. Geeft het Foundry-pad terug.
 *
 * Dit is nodig omdat ComfyUI de afbeelding lokaal opslaat op de
 * ComfyUI-server, maar Foundry die map niet kan bereiken. Door de
 * afbeelding via de Foundry upload-API op te slaan, is hij ook
 * beschikbaar voor tokens, journals en Campaign Codex.
 *
 * @param {string} imageUrl  - URL van de ComfyUI /view endpoint
 * @param {string} name      - Naam voor de bestandsnaam (bijv. NPC naam)
 * @param {string} [folder]  - Doelmap in Foundry (optioneel, standaard: charArtFolder)
 * @returns {string}         - Foundry-pad naar de opgeslagen afbeelding
 */
export async function saveComfyImageToFoundry(imageUrl, name, folder) {
  // Download de afbeelding als blob
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error("Kon ComfyUI-afbeelding niet downloaden");
  const blob = await resp.blob();

  // Maak een unieke bestandsnaam met timestamp om conflicten te voorkomen
  const fileName = `${formatForFile(name)}_${Date.now()}.png`;
  const file     = new File([blob], fileName, { type: "image/png" });

  // Gebruik opgegeven map, anders de standaard Character Art map
  const targetFolder = folder ?? WorldForgeSettings.charArtFolder;

  // Upload naar de doelmap in Foundry (Foundry v13: use namespaced FilePicker)
  const upload = await foundry.applications.apps.FilePicker.implementation.upload(
    "data",
    targetFolder,
    file
  );

  if (!upload?.path) throw new Error("Upload naar Foundry mislukt");
  return upload.path;
}

// =============================================================================
// NEGATIEVE PROMPT HELPERS
// =============================================================================

/**
 * Standaard negatieve prompt voor NPC-portretten.
 * Voorkomt slechte anatomie, moderne kleding, foto-realisme, etc.
 */
export function baseNegativePortrait() {
  return [
    "blurry", "low quality", "worst quality",
    "bad anatomy", "deformed face", "extra limbs", "extra fingers",
    "text", "watermark",
    "modern clothing", "sci-fi armor", "helmet",
    "full plate armor", "leather armor",
    "photograph", "photo", "3d render"
  ].join(", ");
}

/**
 * Standaard negatieve prompt voor gebouw-exterieurs (shops, inns, ships).
 * Voegt ook materiaal-specifieke negaties toe als het gebouw GEEN hout is
 * (om te voorkomen dat het toch houten muren krijgt).
 *
 * @param {string} buildingEn  - Engelse beschrijving van het gebouwmateriaal
 */
export function baseNegativeExterior(buildingEn = "") {
  const materialNeg = buildingEn.toLowerCase().includes("wood")
    ? []  // Hout is correct, geen extra negaties nodig
    : ["wooden building", "timber walls", "wood plank walls"];  // Voorkom hout bij steen/brick

  // Haal de campaign negatieve tags op uit de instellingen
  const themNeg = (WorldForgeSettings.campaignThemeNegative ?? "")
    .split(",").map(t => t.trim()).filter(Boolean);

  return [
    "blurry", "low quality", "worst quality", "poorly rendered",
    "text", "watermark", "signature", "logo",
    // ★ ZEER STERKE HUMAN NEGATIES ★
    "human", "humans", "person", "people", "peoples",
    "character", "characters", "character portrait",
    "portrait", "face", "faces", "facial",
    "head", "body", "arm", "arms", "leg", "legs", "hand", "hands",
    "man", "woman", "male", "female", "boy", "girl",
    "nude", "naked", "undressed", "exposed", "nsfw", "sexual",
    "skin", "torso", "breast", "breasts", "butt", "buttocks",
    "figure", "figures", "figurative", "anatomy",
    "crowd", "group", "silhouette",
    // ★ INTERIOR/INTERIOR VIEWS ★
    "interior", "inside view", "indoor", "indoors",
    "interior design", "room", "rooms", "hallway", "hallway",
    // ★ MODERN/WRONG ELEMENTS ★
    "modern", "contemporary", "modern vehicles", "car", "cars", "automobile",
    "electric lights", "street lights", "lamp", "neon",
    "sci-fi", "futuristic", "steampunk", "cyberpunk",
    "3d render", "3d model", "cgi", "digital art",
    "photograph", "photo", "photorealistic", "real photo",
    "painting", "drawing", "sketch",
    "anime", "cartoon", "comic",
    ...materialNeg,
    ...themNeg
  ].join(", ");
}
