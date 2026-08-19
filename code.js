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
// 2. FONT WEIGHT & SCORING HELPERS
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

  // Check explicit numeric weight (e.g., "500", "w600", "weight-700")
  const numMatch = str.match(/\b(100|200|300|400|500|600|700|800|900|950)\b/);
  if (numMatch) return parseInt(numMatch[1], 10);

  const normalized = str.replace(/[^a-z0-9]/g, "");
  if (weightCache.has(normalized)) return weightCache.get(normalized);

  let result = 400;
  for (const key of SORTED_WEIGHT_KEYS) {
    if (normalized.includes(key)) {
      result = FONT_WEIGHT_MAP[key];
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
  if (lineHeight.unit === "AUTO") return fontSize * 1.2;
  return fontSize * 1.2;
}

function normalizeStyleName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/[\/\\_\-\.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLeafStyleName(name) {
  if (!name) return "";
  const parts = String(name).split(/[\/\\]/);
  return parts[parts.length - 1].trim();
}

function extractNameTokens(name) {
  if (!name) return [];
  const normalized = normalizeStyleName(name);
  return normalized.split(" ").filter((t) => t.length > 1);
}

// Category synonyms mapping
const CATEGORY_MAP = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  heading: "heading",
  headings: "heading",
  header: "heading",
  headers: "heading",
  headline: "heading",
  display: "display",
  hero: "display",
  banner: "display",
  title: "title",
  titles: "title",
  subtitle: "subtitle",
  subheading: "subtitle",
  subhead: "subtitle",
  body: "body",
  paragraph: "body",
  copy: "body",
  text: "body",
  para: "body",
  content: "body",
  caption: "caption",
  footnote: "caption",
  fineprint: "caption",
  micro: "caption",
  button: "button",
  btn: "button",
  cta: "button",
  label: "label",
  badge: "label",
  tag: "label",
  chip: "label",
  code: "code",
  mono: "code",
  quote: "quote",
  lead: "lead",
  overline: "overline",
  small: "small",
};

function getStyleCategoryOrRoot(name) {
  if (!name) return "";
  const tokens = extractNameTokens(name);

  // Check specific keywords first (e.g. "h1", "body", "title")
  for (const token of tokens) {
    if (CATEGORY_MAP[token]) {
      return CATEGORY_MAP[token];
    }
  }

  // Fallback: check substrings in tokens
  for (const token of tokens) {
    for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
      if (token.includes(kw)) {
        return cat;
      }
    }
  }

  const parts = String(name).split(/[\/\\]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts[0].toLowerCase();
  }
  return "";
}

// ==========================================
// 3. PRECISION SCORING ENGINE
// ==========================================
function calculateMatchScore(source, candidate) {
  const srcSize = source.fontSize || 16;
  const candSize = candidate.fontSize || 16;
  const sizeDiff = Math.abs(srcSize - candSize);
  const sizePenalty = Math.pow(sizeDiff, 1.4) * 12;

  const sourceWeight = parseFontWeight(source.fontName ? source.fontName.style : "");
  const candidateWeight = parseFontWeight(candidate.fontName ? candidate.fontName.style : "");
  const weightDiff = Math.abs(sourceWeight - candidateWeight) / 100;
  const weightPenalty = weightDiff * 16;

  const srcLhPx = resolveLineHeightPixels(source.lineHeight, srcSize);
  const candLhPx = resolveLineHeightPixels(candidate.lineHeight, candSize);
  const lhDiff = Math.abs(srcLhPx - candLhPx);
  const lhPenalty = lhDiff > 1.5 ? lhDiff * 1.5 : 0;

  const srcFamily = source.fontName ? (source.fontName.family || "").toLowerCase() : "";
  const candFamily = candidate.fontName ? (candidate.fontName.family || "").toLowerCase() : "";
  const isSameFamily = srcFamily.length > 0 && candFamily.length > 0 && srcFamily === candFamily;
  const familyPenalty = isSameFamily ? 0 : 20;

  const srcIsItalic = /italic|oblique/i.test(source.fontName ? source.fontName.style || "" : "");
  const candIsItalic = /italic|oblique/i.test(candidate.fontName ? candidate.fontName.style || "" : "");
  const italicPenalty = srcIsItalic === candIsItalic ? 0 : 20;

  return sizePenalty + weightPenalty + lhPenalty + familyPenalty + italicPenalty;
}

function findClosestInCandidates(sourceSpec, candidateList) {
  if (!candidateList || candidateList.length === 0) return null;

  let bestMatch = candidateList[0];
  let lowestScore = Infinity;

  const existingStyle = sourceSpec.existingStyle;
  const layerName = sourceSpec.layerName;

  for (let i = 0; i < candidateList.length; i++) {
    const candidate = candidateList[i];
    let score = calculateMatchScore(sourceSpec, candidate);

    // Name affinity bonus if partial name matches
    if (existingStyle && existingStyle.name && candidate.name) {
      const candNorm = normalizeStyleName(candidate.name);
      const existNorm = normalizeStyleName(existingStyle.name);
      if (candNorm.includes(existNorm) || existNorm.includes(candNorm)) {
        score -= 15;
      }
    } else if (layerName && candidate.name) {
      const candNorm = normalizeStyleName(candidate.name);
      const layerNorm = normalizeStyleName(layerName);
      if (candNorm.includes(layerNorm) || layerNorm.includes(candNorm)) {
        score -= 8;
      }
    }

    if (score < lowestScore) {
      lowestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function findBestMatchingStyle(sourceSpec, catalog) {
  if (!catalog || catalog.length === 0) return null;

  const existingStyle = sourceSpec.existingStyle;
  const layerName = sourceSpec.layerName;

  // 1. Direct Key or ID Match with Existing Style
  if (existingStyle) {
    if (existingStyle.key) {
      const matchByKey = catalog.find((c) => c.key && c.key === existingStyle.key);
      if (matchByKey) return matchByKey;
    }
    if (existingStyle.id) {
      const matchById = catalog.find((c) => c.id && c.id === existingStyle.id);
      if (matchById) return matchById;
    }

    // 2. Exact or Normalized Full Name Match
    if (existingStyle.name) {
      const existingNameLower = existingStyle.name.toLowerCase().trim();
      const matchByName = catalog.find((c) => c.name && c.name.toLowerCase().trim() === existingNameLower);
      if (matchByName) return matchByName;

      const normExisting = normalizeStyleName(existingStyle.name);
      const matchByNorm = catalog.find((c) => c.name && normalizeStyleName(c.name) === normExisting);
      if (matchByNorm) return matchByNorm;

      const leafExisting = normalizeStyleName(getLeafStyleName(existingStyle.name));
      if (leafExisting && leafExisting.length > 2) {
        const leafMatches = catalog.filter(
          (c) => c.name && normalizeStyleName(getLeafStyleName(c.name)) === leafExisting
        );
        if (leafMatches.length === 1) {
          return leafMatches[0];
        } else if (leafMatches.length > 1) {
          return findClosestInCandidates(sourceSpec, leafMatches);
        }
      }
    }

    // 3. Category Match for Existing Style (e.g. text is "Body", find available "Body" styles)
    if (existingStyle.name) {
      const existingCat = getStyleCategoryOrRoot(existingStyle.name);
      if (existingCat) {
        const sameCategoryCandidates = catalog.filter((c) => {
          if (!c.name) return false;
          const candCat = getStyleCategoryOrRoot(c.name);
          return candCat === existingCat || normalizeStyleName(c.name).includes(existingCat);
        });

        if (sameCategoryCandidates.length > 0) {
          const bestCatMatch = findClosestInCandidates(sourceSpec, sameCategoryCandidates);
          if (bestCatMatch) {
            const catScore = calculateMatchScore(sourceSpec, bestCatMatch);
            // If reasonable match within category, return it
            if (catScore < 100) return bestCatMatch;
          }
        }
      }
    }
  }

  // 4. Layer Name Match (e.g. "body-text", "title-text", "Heading 1")
  if (layerName && typeof layerName === "string" && layerName.trim().length > 0) {
    const trimmedLayerName = layerName.trim();
    const layerNameLower = trimmedLayerName.toLowerCase();

    // Exact layer name match
    const matchByLayerName = catalog.find((c) => c.name && c.name.toLowerCase().trim() === layerNameLower);
    if (matchByLayerName) return matchByLayerName;

    const normLayerName = normalizeStyleName(trimmedLayerName);
    const matchByNormLayer = catalog.find((c) => c.name && normalizeStyleName(c.name) === normLayerName);
    if (matchByNormLayer) return matchByNormLayer;

    // Category match from layer name
    const layerCat = getStyleCategoryOrRoot(trimmedLayerName);
    if (layerCat) {
      const sameLayerCatCandidates = catalog.filter((c) => {
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

  // 5. Fallback: Find closest match across entire catalog
  return findClosestInCandidates(sourceSpec, catalog);
}

// ==========================================
// 4. HIGH-SPEED ASYNC DISCOVERY & CACHE
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
      if (s.name) globalStyleCache.set(`name__${s.name.toLowerCase()}`, s);
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

  // 2. Remote styles across page & selection
  try {
    const inspectedStyleIds = new Set();

    function extractStyleIds(node, depth = 0) {
      if (depth > 50) return;
      if (node.type === "TEXT") {
        if (typeof node.textStyleId === "string" && node.textStyleId.length > 0) {
          inspectedStyleIds.add(node.textStyleId);
        } else if (node.textStyleId === figma.mixed) {
          try {
            const segments = node.getStyledTextSegments(["textStyleId"]);
            for (const seg of segments) {
              if (typeof seg.textStyleId === "string" && seg.textStyleId.length > 0) {
                inspectedStyleIds.add(seg.textStyleId);
              }
            }
          } catch (_) {}
        }
      }
      if ("children" in node) {
        for (let i = 0; i < node.children.length; i++) {
          extractStyleIds(node.children[i], depth + 1);
        }
      }
    }

    // Scan selection first
    if (figma.currentPage.selection.length > 0) {
      for (const root of figma.currentPage.selection) {
        extractStyleIds(root);
      }
    }
    // Also scan entire current page to discover all active styles
    for (const root of figma.currentPage.children) {
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
// 5. PARALLEL STYLE MANAGER
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
    for (const item of this.localStyles) {
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
                if (imported.name) globalStyleCache.set(`name__${imported.name.toLowerCase()}`, imported);
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

  async getResolvedStyleAsync(candidate) {
    if (!candidate) return null;

    const cacheKey = candidate.key || candidate.id || candidate.name;
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

    if (candidate.key && !candidate.key.startsWith("REMOTE_STYLE_KEY")) {
      try {
        const imported = await figma.importStyleByKeyAsync(candidate.key);
        if (imported && imported.type === "TEXT") {
          globalStyleCache.set(cacheKey, imported);
          globalStyleCache.set(imported.id, imported);
          if (imported.key) globalStyleCache.set(imported.key, imported);
          if (imported.name) globalStyleCache.set(`name__${imported.name.toLowerCase()}`, imported);
          return imported;
        }
      } catch (_) {}
    }

    // Match by exact key in localStyles
    if (candidate.key) {
      const keyMatch = this.localStyles.find((s) => s.key === candidate.key);
      if (keyMatch) {
        globalStyleCache.set(cacheKey, keyMatch);
        return keyMatch;
      }
    }

    // Match by exact name in localStyles
    if (candidate.name) {
      const nameMatch = this.localStyles.find(
        (s) => s.name.toLowerCase() === candidate.name.toLowerCase()
      );
      if (nameMatch) {
        globalStyleCache.set(cacheKey, nameMatch);
        return nameMatch;
      }

      const normName = normalizeStyleName(candidate.name);
      const normMatch = this.localStyles.find(
        (s) => normalizeStyleName(s.name) === normName
      );
      if (normMatch) {
        globalStyleCache.set(cacheKey, normMatch);
        return normMatch;
      }
    }

    // Match by exact typography specs (family, style/weight, size, lineHeight)
    if (candidate.fontName && candidate.fontSize) {
      const candWeight = parseFontWeight(candidate.fontName.style);
      const candItalic = /italic|oblique/i.test(candidate.fontName.style || "");
      const candFamily = (candidate.fontName.family || "").toLowerCase();
      const candLhPx = resolveLineHeightPixels(candidate.lineHeight, candidate.fontSize);

      const exactSpecMatch = this.localStyles.find((s) => {
        if (!s.fontName || s.fontSize !== candidate.fontSize) return false;
        if ((s.fontName.family || "").toLowerCase() !== candFamily) return false;
        if (parseFontWeight(s.fontName.style) !== candWeight) return false;
        if (/italic|oblique/i.test(s.fontName.style || "") !== candItalic) return false;
        const sLhPx = resolveLineHeightPixels(s.lineHeight, s.fontSize);
        if (Math.abs(sLhPx - candLhPx) > 1.5) return false;
        return true;
      });

      if (exactSpecMatch) {
        globalStyleCache.set(cacheKey, exactSpecMatch);
        return exactSpecMatch;
      }

      const weightSpecMatch = this.localStyles.find((s) => {
        if (!s.fontName || s.fontSize !== candidate.fontSize) return false;
        if ((s.fontName.family || "").toLowerCase() !== candFamily) return false;
        return parseFontWeight(s.fontName.style) === candWeight;
      });

      if (weightSpecMatch) {
        globalStyleCache.set(cacheKey, weightSpecMatch);
        return weightSpecMatch;
      }
    }

    return null;
  }
}

// ==========================================
// 6. NODE TRAVERSAL & HELPERS
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

async function applyNodeStyleAsync(textNode, style) {
  if (style.fontName) {
    await preloadFonts([style.fontName]);
  }
  if (typeof textNode.setTextStyleIdAsync === "function") {
    await textNode.setTextStyleIdAsync(style.id);
  } else if (typeof textNode.setRangeTextStyleIdAsync === "function") {
    await textNode.setRangeTextStyleIdAsync(0, textNode.characters.length, style.id);
  } else {
    textNode.textStyleId = style.id;
  }
}

async function applyRangeStyleAsync(textNode, start, end, style) {
  if (style.fontName) {
    await preloadFonts([style.fontName]);
  }
  if (typeof textNode.setRangeTextStyleIdAsync === "function") {
    await textNode.setRangeTextStyleIdAsync(start, end, style.id);
  } else {
    textNode.setRangeTextStyleId(start, end, style.id);
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

  // Apply styles
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

        const closest = findBestMatchingStyle(sourceSpec, activeCatalog);
        const style = await manager.getResolvedStyleAsync(closest);

        if (style) {
          await applyNodeStyleAsync(textNode, style);
        } else if (closest && closest.fontName) {
          await preloadFonts([closest.fontName]);
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

          const closest = findBestMatchingStyle(segSpec, activeCatalog);
          const style = await manager.getResolvedStyleAsync(closest);

          if (style) {
            await applyRangeStyleAsync(textNode, segment.start, segment.end, style);
          } else if (closest && closest.fontName) {
            await preloadFonts([closest.fontName]);
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