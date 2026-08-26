"use strict";

// ==========================================
// 1. FONT WEIGHT & SCORING HELPERS
// ==========================================
const FONT_WEIGHT_MAP = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  plain: 400,
  roman: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
  extrablack: 950,
  fat: 950,
  poster: 950,
};

const SORTED_WEIGHT_KEYS = Object.keys(FONT_WEIGHT_MAP).sort((a, b) => b.length - a.length);
const weightCache = new Map();

function parseFontWeight(styleName) {
  if (!styleName) return 400;
  const str = String(styleName).toLowerCase();

  const numMatch = str.match(/\b(100|200|300|400|500|600|700|800|900|950)\b/);
  if (numMatch) return parseInt(numMatch[1], 10);

  if (weightCache.has(str)) return weightCache.get(str);

  for (let i = 0; i < SORTED_WEIGHT_KEYS.length; i++) {
    const key = SORTED_WEIGHT_KEYS[i];
    if (str.includes(key)) {
      const val = FONT_WEIGHT_MAP[key];
      weightCache.set(str, val);
      return val;
    }
  }

  weightCache.set(str, 400);
  return 400;
}

function normalizeStyleName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getLeafStyleName(name) {
  if (!name) return "";
  const parts = String(name).split(/[\/\\]/);
  return parts[parts.length - 1].trim();
}

function getStyleCategoryOrRoot(name) {
  if (!name) return "";
  const parts = String(name).split(/[\/\\]/);
  if (parts.length > 1) {
    return normalizeStyleName(parts[0]);
  }
  const match = String(name).match(/^(h[1-6]|heading|title|subheading|subtitle|body|paragraph|caption|button|label|display|header)/i);
  if (match) {
    return normalizeStyleName(match[1]);
  }
  return "";
}

function resolveLineHeightPixels(lh, fontSize) {
  if (!lh || typeof lh !== "object") return fontSize * 1.2;
  if (lh.unit === "PIXELS") return lh.value;
  if (lh.unit === "PERCENT") return (lh.value / 100) * fontSize;
  return fontSize * 1.2;
}

// ==========================================
// 2. SCORING & BEST MATCH ALGORITHMS
// ==========================================
function calculateMatchScore(source, candidate) {
  let score = 0;

  // 1. Font Size (Weight: 40)
  const sourceSize = typeof source.fontSize === "number" ? source.fontSize : 16;
  const candSize = typeof candidate.fontSize === "number" ? candidate.fontSize : 16;
  const sizeDiff = Math.abs(sourceSize - candSize);
  score += sizeDiff * 40;

  // 2. Font Weight (Weight: 20 per 100 unit difference)
  const sourceStyle = source.fontName ? source.fontName.style : "Regular";
  const candStyle = candidate.fontName ? candidate.fontName.style : "Regular";
  const sourceWeight = parseFontWeight(sourceStyle);
  const candWeight = parseFontWeight(candStyle);
  const weightDiff = Math.abs(sourceWeight - candWeight);
  score += (weightDiff / 100) * 20;

  // 3. Italic Mismatch (Penalty: 60)
  const isSourceItalic = /italic|oblique/i.test(sourceStyle || "");
  const isCandItalic = /italic|oblique/i.test(candStyle || "");
  if (isSourceItalic !== isCandItalic) {
    score += 60;
  }

  // 4. Font Family Mismatch (Penalty: 50)
  const sourceFamily = source.fontName ? source.fontName.family : "";
  const candFamily = candidate.fontName ? candidate.fontName.family : "";
  if (
    sourceFamily &&
    candFamily &&
    sourceFamily.trim().toLowerCase() !== candFamily.trim().toLowerCase()
  ) {
    score += 50;
  }

  // 5. Line Height (Weight: 5 per px difference)
  if (source.lineHeight && candidate.lineHeight) {
    const sLh = resolveLineHeightPixels(source.lineHeight, sourceSize);
    const cLh = resolveLineHeightPixels(candidate.lineHeight, candSize);
    const lhDiff = Math.abs(sLh - cLh);
    score += lhDiff * 5;
  }

  return score;
}

function findClosestInCandidates(sourceSpec, candidates) {
  if (!candidates || candidates.length === 0) return null;

  let best = candidates[0];
  let minScore = calculateMatchScore(sourceSpec, best);

  for (let i = 1; i < candidates.length; i++) {
    const cand = candidates[i];
    const score = calculateMatchScore(sourceSpec, cand);
    if (score < minScore) {
      minScore = score;
      best = cand;
    }
  }

  return best;
}

function findBestMatchingStyle(sourceSpec, localCatalog) {
  if (!localCatalog || localCatalog.length === 0) return null;

  const { existingStyle, layerName } = sourceSpec;

  // 1. Direct match with existing style key/id
  if (existingStyle) {
    if (existingStyle.key) {
      const matchByKey = localCatalog.find((c) => c.key === existingStyle.key);
      if (matchByKey) return matchByKey;
    }
    if (existingStyle.id) {
      const matchById = localCatalog.find((c) => c.id === existingStyle.id);
      if (matchById) return matchById;
    }

    // 2. Direct Name Match for Existing Style
    if (existingStyle.name) {
      const existingNameLower = existingStyle.name.toLowerCase().trim();
      const matchByName = localCatalog.find((c) => c.name && c.name.toLowerCase().trim() === existingNameLower);
      if (matchByName) return matchByName;

      const normExisting = normalizeStyleName(existingStyle.name);
      const matchByNorm = localCatalog.find((c) => c.name && normalizeStyleName(c.name) === normExisting);
      if (matchByNorm) return matchByNorm;

      const leafExisting = normalizeStyleName(getLeafStyleName(existingStyle.name));
      if (leafExisting && leafExisting.length > 2) {
        const leafMatches = localCatalog.filter(
          (c) => c.name && normalizeStyleName(getLeafStyleName(c.name)) === leafExisting
        );
        if (leafMatches.length === 1) {
          return leafMatches[0];
        } else if (leafMatches.length > 1) {
          return findClosestInCandidates(sourceSpec, leafMatches);
        }
      }
    }

    // 3. Category Match for Existing Style
    if (existingStyle.name) {
      const existingCat = getStyleCategoryOrRoot(existingStyle.name);
      if (existingCat) {
        const sameCategoryCandidates = localCatalog.filter((c) => {
          if (!c.name) return false;
          const candCat = getStyleCategoryOrRoot(c.name);
          return candCat === existingCat || normalizeStyleName(c.name).includes(existingCat);
        });

        if (sameCategoryCandidates.length > 0) {
          const bestCatMatch = findClosestInCandidates(sourceSpec, sameCategoryCandidates);
          if (bestCatMatch) {
            const catScore = calculateMatchScore(sourceSpec, bestCatMatch);
            if (catScore < 100) return bestCatMatch;
          }
        }
      }
    }
  }

  // 4. Layer Name Match
  if (layerName && typeof layerName === "string" && layerName.trim().length > 0) {
    const trimmedLayerName = layerName.trim();
    const layerNameLower = trimmedLayerName.toLowerCase();

    const matchByLayerName = localCatalog.find((c) => c.name && c.name.toLowerCase().trim() === layerNameLower);
    if (matchByLayerName) return matchByLayerName;

    const normLayerName = normalizeStyleName(trimmedLayerName);
    const matchByNormLayer = localCatalog.find((c) => c.name && normalizeStyleName(c.name) === normLayerName);
    if (matchByNormLayer) return matchByNormLayer;

    const layerCat = getStyleCategoryOrRoot(trimmedLayerName);
    if (layerCat) {
      const sameLayerCatCandidates = localCatalog.filter((c) => {
        if (!c.name) return false;
        const candCat = getStyleCategoryOrRoot(c.name);
        return candCat === layerCat || normalizeStyleName(c.name).includes(layerCat);
      });

      if (sameLayerCatCandidates.length > 0) {
        const bestLayerCatMatch = findClosestInCandidates(sourceSpec, sameLayerCatCandidates);
        if (bestLayerCatMatch) {
          const layerScore = calculateMatchScore(sourceSpec, bestLayerCatMatch);
          if (layerScore < 100) return bestLayerCatMatch;
        }
      }
    }
  }

  // 5. Fallback: Find closest matching local style
  return findClosestInCandidates(sourceSpec, localCatalog);
}

// ==========================================
// 3. ASYNC LOCAL STYLES DISCOVERY & CACHE
// ==========================================
const globalLoadedFonts = new Set();
const globalStyleCache = new Map();
let cachedDiscoveredStyles = null;

async function getLocalTextStylesSafe() {
  if (typeof figma.getLocalTextStylesAsync === "function") {
    return await figma.getLocalTextStylesAsync();
  }
  return figma.getLocalTextStyles();
}

async function getStyleSafe(id) {
  if (!id) return null;
  if (globalStyleCache.has(id)) return globalStyleCache.get(id);

  try {
    const style =
      typeof figma.getStyleByIdAsync === "function"
        ? await figma.getStyleByIdAsync(id)
        : figma.getStyleById(id);

    if (style && style.type === "TEXT") {
      globalStyleCache.set(id, style);
      if (style.key) globalStyleCache.set(style.key, style);
      if (style.name) globalStyleCache.set(`name__${style.name.toLowerCase()}`, style);
      return style;
    }
  } catch (_) {}
  return null;
}

async function preloadFonts(fontNames = []) {
  const pending = [];
  for (const fn of fontNames) {
    if (!fn || !fn.family || !fn.style) continue;
    const fontKey = `${fn.family}__${fn.style}`;
    if (!globalLoadedFonts.has(fontKey)) {
      globalLoadedFonts.add(fontKey);
      pending.push(
        figma.loadFontAsync(fn).catch((err) => {
          console.warn(`Font load warning for ${fontKey}:`, err);
        })
      );
    }
  }
  if (pending.length > 0) {
    await Promise.all(pending);
  }
}

async function collectFontsFromTextNodes(nodes) {
  const fonts = [];
  for (const node of nodes) {
    if (!node || node.hasMissingFont) continue;
    if (node.fontName !== figma.mixed && node.fontName) {
      fonts.push(node.fontName);
    } else {
      try {
        const segments = node.getStyledTextSegments(["fontName"]);
        for (const seg of segments) {
          if (seg.fontName) fonts.push(seg.fontName);
        }
      } catch (_) {}
    }
  }
  return fonts;
}

async function discoverAllStyles(forceRefresh = false) {
  if (cachedDiscoveredStyles && !forceRefresh) {
    return cachedDiscoveredStyles;
  }

  const list = [];
  try {
    const localStyles = await getLocalTextStylesSafe();
    for (const s of localStyles) {
      globalStyleCache.set(s.id, s);
      if (s.key) globalStyleCache.set(s.key, s);
      if (s.name) globalStyleCache.set(`name__${s.name.toLowerCase()}`, s);
      list.push({
        name: s.name,
        key: s.key,
        id: s.id,
        fontName: s.fontName,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
      });
    }
  } catch (err) {
    console.warn("[discoverAllStyles] Error loading local styles:", err);
  }

  cachedDiscoveredStyles = list;
  return cachedDiscoveredStyles;
}

// ==========================================
// 4. FAST STYLE MANAGER (LOCAL ONLY)
// ==========================================
class FastStyleManager {
  constructor(localStyles = []) {
    this.localStyles = localStyles;
  }

  async warmup() {
    const allFonts = [];
    for (const item of this.localStyles) {
      if (item && item.fontName) allFonts.push(item.fontName);
    }
    await preloadFonts(allFonts);
  }

  async getResolvedStyleAsync(candidate) {
    if (!candidate) return null;
    const cacheKey = candidate.id || candidate.key || candidate.name;

    if (globalStyleCache.has(cacheKey)) {
      return globalStyleCache.get(cacheKey);
    }

    if (candidate.id) {
      const styleById = await getStyleSafe(candidate.id);
      if (styleById) {
        globalStyleCache.set(cacheKey, styleById);
        return styleById;
      }
    }

    return null;
  }
}

// ==========================================
// 5. NODE TRAVERSAL & HELPERS
// ==========================================
function isInsideInstance(node) {
  let curr = node;
  while (curr && curr.type !== "PAGE" && curr.type !== "DOCUMENT") {
    if (curr.type === "INSTANCE") return true;
    curr = curr.parent;
  }
  return false;
}

function collectTextNodes(selection, ignoreInstances = false) {
  const textNodes = [];
  const visitedIds = new Set();

  function addNode(node) {
    if (!node || visitedIds.has(node.id)) return;
    visitedIds.add(node.id);
    textNodes.push(node);
  }

  for (let i = 0; i < selection.length; i++) {
    const root = selection[i];
    if (!root) continue;

    // If ignoring instances, skip if the root itself is an instance
    if (ignoreInstances && isInsideInstance(root)) {
      continue;
    }

    // Direct text node in selection
    if (root.type === "TEXT") {
      if (!ignoreInstances || !isInsideInstance(root)) {
        addNode(root);
      }
      continue;
    }

    // Container selection (FRAME, GROUP, SECTION, COMPONENT, etc.)
    if (typeof root.findAllWithCriteria === "function") {
      const found = root.findAllWithCriteria({ types: ["TEXT"] });
      for (let j = 0; j < found.length; j++) {
        const textNode = found[j];
        if (ignoreInstances && isInsideInstance(textNode)) {
          continue;
        }
        addNode(textNode);
      }
    }
  }

  return textNodes;
}

async function applyNodeStyleAsync(textNode, style) {
  if (style && style.fontName) {
    await preloadFonts([style.fontName]);
  }
  if (textNode.fontName !== figma.mixed && textNode.fontName) {
    await preloadFonts([textNode.fontName]);
  }
  if (typeof textNode.setTextStyleIdAsync === "function") {
    await textNode.setTextStyleIdAsync(style.id);
  } else {
    textNode.textStyleId = style.id;
  }
}

async function applyRangeStyleAsync(textNode, start, end, style) {
  if (style && style.fontName) {
    await preloadFonts([style.fontName]);
  }
  if (typeof textNode.setRangeTextStyleIdAsync === "function") {
    await textNode.setRangeTextStyleIdAsync(start, end, style.id);
  } else {
    textNode.setRangeTextStyleId(start, end, style.id);
  }
}

// ==========================================
// 6. HIGH-PERFORMANCE REPLACEMENT PIPELINE
// ==========================================
async function applyClosestStylesToSelection(options = { ignoreInstances: true }) {
  const summary = {
    totalInspected: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    errors: [],
  };

  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    figma.notify("⚠️ Please select at least one frame or text layer.");
    return summary;
  }

  const localStyles = await discoverAllStyles(false);
  if (localStyles.length === 0) {
    figma.notify("⚠️ No local text styles found in this document. Please create local text styles first.");
    return summary;
  }

  const textNodes = collectTextNodes(selection, options.ignoreInstances);

  if (textNodes.length === 0) {
    figma.notify(
      options.ignoreInstances
        ? "No eligible text layers found (try unchecking 'Ignore component instances')."
        : "No text layers found in current selection."
    );
    return summary;
  }

  // Preload all fonts for the selected nodes & local styles
  const fontsToLoad = await collectFontsFromTextNodes(textNodes);
  for (const item of localStyles) {
    if (item && item.fontName) fontsToLoad.push(item.fontName);
  }

  const manager = new FastStyleManager(localStyles);
  await Promise.all([preloadFonts(fontsToLoad), manager.warmup()]);

  // Apply styles with yielding to keep UI 100% smooth
  for (let i = 0; i < textNodes.length; i++) {
    // Yield every 25 nodes to prevent any freezing
    if (i > 0 && i % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const textNode = textNodes[i];
    summary.totalInspected++;

    try {
      if (textNode.hasMissingFont) {
        summary.totalSkipped++;
        summary.errors.push(`Layer "${textNode.name}" has missing fonts and was skipped.`);
        continue;
      }

      const isMixedFont = textNode.fontName === figma.mixed;
      const isMixedSize = textNode.fontSize === figma.mixed;
      const isMixedLh = textNode.lineHeight === figma.mixed;

      if (!isMixedFont && !isMixedSize && !isMixedLh) {
        if (textNode.fontName) {
          await preloadFonts([textNode.fontName]);
        }

        let existingStyle = null;
        if (typeof textNode.textStyleId === "string" && textNode.textStyleId.length > 0) {
          existingStyle = await getStyleSafe(textNode.textStyleId);
        }

        const sourceSpec = {
          fontName: textNode.fontName,
          fontSize: textNode.fontSize,
          lineHeight: textNode.lineHeight,
          existingStyle,
          layerName: textNode.name,
        };

        const closest = findBestMatchingStyle(sourceSpec, localStyles);
        const style = await manager.getResolvedStyleAsync(closest);

        if (style) {
          await applyNodeStyleAsync(textNode, style);
          summary.totalUpdated++;
        } else {
          summary.totalSkipped++;
        }
      } else {
        const segments = textNode.getStyledTextSegments([
          "fontName",
          "fontSize",
          "lineHeight",
          "textStyleId",
        ]);

        const segFonts = segments.map((s) => s.fontName).filter(Boolean);
        await preloadFonts(segFonts);

        for (let s = 0; s < segments.length; s++) {
          const segment = segments[s];
          let segExistingStyle = null;
          if (typeof segment.textStyleId === "string" && segment.textStyleId.length > 0) {
            segExistingStyle = await getStyleSafe(segment.textStyleId);
          }

          const segSpec = {
            fontName: segment.fontName,
            fontSize: segment.fontSize,
            lineHeight: segment.lineHeight,
            existingStyle: segExistingStyle,
            layerName: textNode.name,
          };

          const closest = findBestMatchingStyle(segSpec, localStyles);
          const style = await manager.getResolvedStyleAsync(closest);

          if (style) {
            await applyRangeStyleAsync(textNode, segment.start, segment.end, style);
          }
        }

        summary.totalUpdated++;
      }
    } catch (err) {
      summary.totalSkipped++;
      summary.errors.push(`Failed on "${textNode.name}": ${err?.message || err}`);
    }
  }

  return summary;
}

// ==========================================
// 7. PERSISTENT CLIENT STORAGE
// ==========================================
const SETTINGS_KEY = "figma_text_style_sync_settings_v2";

async function loadUserSettings() {
  try {
    const saved = await figma.clientStorage.getAsync(SETTINGS_KEY);
    if (saved && typeof saved === "object") {
      return {
        ignoreInstances: saved.ignoreInstances !== false,
      };
    }
  } catch (_) {}
  return { ignoreInstances: true };
}

async function saveUserSettings(settings) {
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch (_) {}
}

// ==========================================
// 8. PLUGIN LIFECYCLE & MESSAGE DISPATCH
// ==========================================
figma.showUI(__html__, { width: 360, height: 420, themeColors: true });

async function broadcastDiscoveredStyles(forceRefresh = false) {
  const styles = await discoverAllStyles(forceRefresh);

  figma.ui.postMessage({
    type: "styles-detected",
    count: styles.length,
  });
}

// Initialize and restore saved settings immediately
(async () => {
  const settings = await loadUserSettings();
  figma.ui.postMessage({
    type: "load-settings",
    settings,
  });
  await broadcastDiscoveredStyles(false);
})();

figma.ui.onmessage = async (msg) => {
  if (msg.type === "save-settings" && msg.settings) {
    await saveUserSettings(msg.settings);
  }

  if (msg.type === "rescan-styles") {
    cachedDiscoveredStyles = null;
    globalStyleCache.clear();
    await broadcastDiscoveredStyles(true);
    figma.notify("🔄 Rescanned local text styles.");
  }

  if (msg.type === "run-replace-styles") {
    const options = {
      ignoreInstances: msg.options?.ignoreInstances !== false,
    };

    await saveUserSettings(options);

    figma.ui.postMessage({ type: "process-start" });
    const summary = await applyClosestStylesToSelection(options);

    if (summary.totalUpdated > 0) {
      figma.notify(`⚡ Updated ${summary.totalUpdated} text layer(s) to local styles!`);
    } else if (summary.errors.length > 0) {
      figma.notify("⚠️ Process finished with warnings. Check plugin window for logs.");
    } else {
      figma.notify("ℹ️ No text layers needed updates.");
    }

    figma.ui.postMessage({ type: "process-complete", summary });
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};