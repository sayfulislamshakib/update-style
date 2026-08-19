"use strict";

// ==========================================
// 1. DEFAULT REMOTE CATALOG (FALLBACK)
// ==========================================
const DEFAULT_CATALOG = [
  {
    name: "Heading / H1",
    key: "REMOTE_STYLE_KEY_H1",
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 32,
    lineHeight: { unit: "PIXELS", value: 40 },
  },
  {
    name: "Heading / H2",
    key: "REMOTE_STYLE_KEY_H2",
    fontName: { family: "Inter", style: "SemiBold" },
    fontSize: 24,
    lineHeight: { unit: "PIXELS", value: 32 },
  },
  {
    name: "Heading / H3",
    key: "REMOTE_STYLE_KEY_H3",
    fontName: { family: "Inter", style: "SemiBold" },
    fontSize: 20,
    lineHeight: { unit: "PIXELS", value: 28 },
  },
  {
    name: "Body / Large",
    key: "REMOTE_STYLE_KEY_BODY_LG",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 18,
    lineHeight: { unit: "PIXELS", value: 26 },
  },
  {
    name: "Body / Medium",
    key: "REMOTE_STYLE_KEY_BODY_MD",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    lineHeight: { unit: "PIXELS", value: 24 },
  },
  {
    name: "Body / Medium Bold",
    key: "REMOTE_STYLE_KEY_BODY_MD_BOLD",
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 16,
    lineHeight: { unit: "PIXELS", value: 24 },
  },
  {
    name: "Body / Small",
    key: "REMOTE_STYLE_KEY_BODY_SM",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 14,
    lineHeight: { unit: "PIXELS", value: 20 },
  },
  {
    name: "Caption",
    key: "REMOTE_STYLE_KEY_CAPTION",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "PIXELS", value: 16 },
  },
];

// ==========================================
// 2. FAST SCORING & MATCHING ENGINE
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
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

const weightCache = new Map();
function parseFontWeight(styleName) {
  const normalized = (styleName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (weightCache.has(normalized)) return weightCache.get(normalized);

  let result = 400;
  for (const [key, weight] of Object.entries(FONT_WEIGHT_MAP)) {
    if (normalized.includes(key)) {
      result = weight;
      break;
    }
  }
  weightCache.set(normalized, result);
  return result;
}

function resolveLineHeightPixels(lineHeight, fontSize) {
  if (!lineHeight) return fontSize * 1.2;
  if (lineHeight.unit === "PIXELS") return lineHeight.value;
  if (lineHeight.unit === "PERCENT") return (fontSize * lineHeight.value) / 100;
  return fontSize * 1.2;
}

function calculateMatchScore(source, candidate) {
  const sizeDiff = Math.abs(source.fontSize - candidate.fontSize);
  const sizePenalty = Math.pow(sizeDiff, 1.5) * 10;

  const sourceWeight = parseFontWeight(source.fontName.style);
  const candidateWeight = parseFontWeight(candidate.fontName.style);
  const weightDiff = Math.abs(sourceWeight - candidateWeight) / 100;
  const weightPenalty = weightDiff * 15;

  const srcLhPx = resolveLineHeightPixels(source.lineHeight, source.fontSize);
  const candLhPx = resolveLineHeightPixels(candidate.lineHeight, candidate.fontSize);
  const lhDiff = Math.abs(srcLhPx - candLhPx);
  const lhPenalty = lhDiff * 2;

  const isSameFamily =
    (source.fontName.family || "").toLowerCase() === (candidate.fontName.family || "").toLowerCase();
  const familyPenalty = isSameFamily ? 0 : 25;

  const srcIsItalic = /italic|oblique/i.test(source.fontName.style || "");
  const candIsItalic = /italic|oblique/i.test(candidate.fontName.style || "");
  const italicPenalty = srcIsItalic === candIsItalic ? 0 : 20;

  return sizePenalty + weightPenalty + lhPenalty + familyPenalty + italicPenalty;
}

function findClosestStyle(source, catalog) {
  let bestMatch = catalog[0];
  let lowestScore = Infinity;

  for (let i = 0; i < catalog.length; i++) {
    const candidate = catalog[i];
    const score = calculateMatchScore(source, candidate);
    if (score < lowestScore) {
      lowestScore = score;
      bestMatch = candidate;
      if (score === 0) break;
    }
  }

  return bestMatch;
}

// ==========================================
// 3. HIGH-SPEED ASYNC DISCOVERY & CACHE
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

async function discoverAllStyles(forceRefresh = false) {
  if (cachedDiscoveredStyles && !forceRefresh) {
    return cachedDiscoveredStyles;
  }

  const stylesMap = new Map();

  // 1. Local styles
  try {
    const localStyles = await getLocalTextStylesSafe();
    for (const s of localStyles) {
      const key = s.key || s.id;
      globalStyleCache.set(s.id, s);
      if (s.key) globalStyleCache.set(s.key, s);
      stylesMap.set(key, {
        name: s.name,
        key: s.key,
        id: s.id,
        isRemote: false,
        source: "local",
        fontName: s.fontName,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
      });
    }
  } catch (err) {
    console.warn("[discoverAllStyles] Error loading local styles:", err);
  }

  // 2. Remote styles from selection/page
  try {
    const targetNodes =
      figma.currentPage.selection.length > 0
        ? figma.currentPage.selection
        : figma.currentPage.children;

    const inspectedStyleIds = new Set();

    function extractStyleIds(node, depth = 0) {
      if (depth > 6) return;
      if (node.type === "TEXT" && typeof node.textStyleId === "string" && node.textStyleId.length > 0) {
        inspectedStyleIds.add(node.textStyleId);
      }
      if ("children" in node) {
        for (const child of node.children) {
          extractStyleIds(child, depth + 1);
        }
      }
    }

    for (const root of targetNodes) {
      extractStyleIds(root);
    }

    const stylePromises = Array.from(inspectedStyleIds).map((id) => getStyleSafe(id));
    const resolvedStyles = await Promise.all(stylePromises);

    for (const style of resolvedStyles) {
      if (style && style.type === "TEXT") {
        const key = style.key || style.id;
        if (!stylesMap.has(key)) {
          stylesMap.set(key, {
            name: style.name,
            key: style.key,
            id: style.id,
            isRemote: style.remote === true,
            source: style.remote ? "remote" : "local",
            fontName: style.fontName,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[discoverAllStyles] Error scanning nodes:", err);
  }

  cachedDiscoveredStyles = Array.from(stylesMap.values());
  return cachedDiscoveredStyles;
}

// ==========================================
// 4. PARALLEL STYLE MANAGER
// ==========================================
class FastStyleManager {
  constructor(catalog = []) {
    this.catalog = catalog;
    this.localStyles = [];
  }

  async warmup() {
    this.localStyles = await getLocalTextStylesSafe();

    const allFonts = [];
    for (const item of this.catalog) {
      if (item.fontName) allFonts.push(item.fontName);
    }
    await preloadFonts(allFonts);

    const remoteImports = [];
    for (const candidate of this.catalog) {
      const cacheKey = candidate.key || candidate.id || candidate.name;
      if (globalStyleCache.has(cacheKey)) continue;

      const isRealKey =
        candidate.key &&
        !candidate.key.startsWith("REMOTE_STYLE_KEY") &&
        candidate.key.length >= 20;

      if (isRealKey) {
        remoteImports.push(
          figma
            .importStyleByKeyAsync(candidate.key)
            .then((imported) => {
              if (imported && imported.type === "TEXT") {
                globalStyleCache.set(candidate.key, imported);
                globalStyleCache.set(imported.id, imported);
              }
            })
            .catch(() => {})
        );
      }
    }

    if (remoteImports.length > 0) {
      await Promise.all(remoteImports);
    }
  }

  getResolvedStyle(candidate) {
    const cacheKey = candidate.key || candidate.id || candidate.name;
    if (globalStyleCache.has(cacheKey)) {
      return globalStyleCache.get(cacheKey);
    }

    if (candidate.id && globalStyleCache.has(candidate.id)) {
      return globalStyleCache.get(candidate.id);
    }

    const localMatch = this.localStyles.find(
      (s) =>
        (candidate.key && s.key === candidate.key) ||
        s.name.toLowerCase() === candidate.name.toLowerCase()
    );

    if (localMatch) {
      globalStyleCache.set(cacheKey, localMatch);
      return localMatch;
    }

    const specMatch = this.localStyles.find(
      (s) =>
        s.fontSize === candidate.fontSize &&
        s.fontName.family.toLowerCase() === candidate.fontName.family.toLowerCase()
    );

    if (specMatch) {
      globalStyleCache.set(cacheKey, specMatch);
      return specMatch;
    }

    return null;
  }
}

// ==========================================
// 5. NODE TRAVERSAL & HELPERS
// ==========================================
function isInsideInstance(node) {
  let curr = node.parent;
  while (curr) {
    if (curr.type === "INSTANCE") return true;
    curr = curr.parent;
  }
  return false;
}

function collectTextNodes(selection, ignoreInstances = false) {
  const textNodes = [];

  function traverse(node) {
    if (ignoreInstances && node.type === "INSTANCE") return;

    if (node.type === "TEXT") {
      if (ignoreInstances && isInsideInstance(node)) return;
      textNodes.push(node);
      return;
    }

    if ("children" in node) {
      for (let i = 0; i < node.children.length; i++) {
        traverse(node.children[i]);
      }
    }
  }

  for (let i = 0; i < selection.length; i++) {
    traverse(selection[i]);
  }

  return textNodes;
}

// ==========================================
// 6. ASYNC NODE STYLE APPLICATION (DYNAMIC-PAGE SAFE)
// ==========================================
async function applyNodeStyleAsync(textNode, styleId) {
  if (typeof textNode.setTextStyleIdAsync === "function") {
    await textNode.setTextStyleIdAsync(styleId);
  } else if (typeof textNode.setRangeTextStyleIdAsync === "function") {
    await textNode.setRangeTextStyleIdAsync(0, textNode.characters.length, styleId);
  } else {
    textNode.textStyleId = styleId;
  }
}

async function applyRangeStyleAsync(textNode, start, end, styleId) {
  if (typeof textNode.setRangeTextStyleIdAsync === "function") {
    await textNode.setRangeTextStyleIdAsync(start, end, styleId);
  } else {
    textNode.setRangeTextStyleId(start, end, styleId);
  }
}

// ==========================================
// 7. HIGH-PERFORMANCE REPLACEMENT PIPELINE
// ==========================================
async function applyClosestStylesToSelection(options = { ignoreInstances: true, scope: "all" }) {
  const summary = {
    totalInspected: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    errors: [],
  };

  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify("⚠️ Please select at least one frame or text layer.");
    return summary;
  }

  let discovered = await discoverAllStyles(false);

  if (options.scope === "local") {
    discovered = discovered.filter((s) => !s.isRemote);
  } else if (options.scope === "remote") {
    discovered = discovered.filter((s) => s.isRemote);
  }

  const activeCatalog = discovered.length > 0 ? discovered : DEFAULT_CATALOG;
  const textNodes = collectTextNodes(selection, options.ignoreInstances);

  if (textNodes.length === 0) {
    figma.notify(
      options.ignoreInstances
        ? "No eligible text layers found (all inside instances or empty)."
        : "No text layers found in current selection."
    );
    return summary;
  }

  // Preload all fonts in parallel
  const fontsToLoad = [];
  for (const textNode of textNodes) {
    if (textNode.hasMissingFont) continue;
    if (textNode.fontName !== figma.mixed) {
      fontsToLoad.push(textNode.fontName);
    } else {
      try {
        const segments = textNode.getStyledTextSegments(["fontName"]);
        for (const seg of segments) {
          fontsToLoad.push(seg.fontName);
        }
      } catch (_) {}
    }
  }

  const manager = new FastStyleManager(activeCatalog);
  await Promise.all([preloadFonts(fontsToLoad), manager.warmup()]);

  // Apply styles with dynamic-page async setters
  for (let i = 0; i < textNodes.length; i++) {
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
        const sourceSpec = {
          fontName: textNode.fontName,
          fontSize: textNode.fontSize,
          lineHeight: textNode.lineHeight,
        };

        const closest = findClosestStyle(sourceSpec, activeCatalog);
        const style = manager.getResolvedStyle(closest);

        if (style) {
          await applyNodeStyleAsync(textNode, style.id);
        } else {
          textNode.fontName = closest.fontName;
          textNode.fontSize = closest.fontSize;
          textNode.lineHeight = closest.lineHeight;
        }

        summary.totalUpdated++;
      } else {
        const segments = textNode.getStyledTextSegments([
          "fontName",
          "fontSize",
          "lineHeight",
          "textStyleId",
        ]);

        for (let s = 0; s < segments.length; s++) {
          const segment = segments[s];
          const closest = findClosestStyle(
            {
              fontName: segment.fontName,
              fontSize: segment.fontSize,
              lineHeight: segment.lineHeight,
            },
            activeCatalog
          );

          const style = manager.getResolvedStyle(closest);

          if (style) {
            await applyRangeStyleAsync(textNode, segment.start, segment.end, style.id);
          } else {
            textNode.setRangeFontName(segment.start, segment.end, closest.fontName);
            textNode.setRangeFontSize(segment.start, segment.end, closest.fontSize);
            textNode.setRangeLineHeight(segment.start, segment.end, closest.lineHeight);
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
// 8. PERSISTENT CLIENT STORAGE
// ==========================================
const SETTINGS_KEY = "figma_text_style_sync_settings_v1";

async function loadUserSettings() {
  try {
    const saved = await figma.clientStorage.getAsync(SETTINGS_KEY);
    if (saved && typeof saved === "object") {
      return {
        ignoreInstances: saved.ignoreInstances !== false,
        scope: saved.scope || "all",
      };
    }
  } catch (_) {}
  return { ignoreInstances: true, scope: "all" };
}

async function saveUserSettings(settings) {
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch (_) {}
}

// ==========================================
// 9. PLUGIN LIFECYCLE & MESSAGE DISPATCH
// ==========================================
figma.showUI(__html__, { width: 360, height: 500, themeColors: true });

async function broadcastDiscoveredStyles(forceRefresh = false) {
  const styles = await discoverAllStyles(forceRefresh);
  const localCount = styles.filter((s) => !s.isRemote).length;
  const remoteCount = styles.filter((s) => s.isRemote).length;

  figma.ui.postMessage({
    type: "styles-detected",
    totalCount: styles.length,
    localCount,
    remoteCount,
  });
}

// Initialize and restore saved settings
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
    await broadcastDiscoveredStyles(true);
    figma.notify("🔄 Rescanned local and remote styles in document.");
  }

  if (msg.type === "run-replace-styles") {
    const options = {
      ignoreInstances: msg.options?.ignoreInstances !== false,
      scope: msg.options?.scope || "all",
    };

    // Persist settings on run
    await saveUserSettings(options);

    figma.ui.postMessage({ type: "process-start" });
    const summary = await applyClosestStylesToSelection(options);

    if (summary.totalUpdated > 0) {
      figma.notify(`⚡ Updated ${summary.totalUpdated} text layer(s)!`);
    } else if (summary.errors.length > 0) {
      figma.notify("⚠️ Process finished with warnings. Check plugin window for logs.");
    }

    figma.ui.postMessage({ type: "process-complete", summary });
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};