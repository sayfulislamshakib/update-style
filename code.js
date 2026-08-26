"use strict";

// ==========================================
// 1. DEFAULT REMOTE CATALOG (FALLBACK SPEC)
// ==========================================
const DEFAULT_CATALOG = [
  {
    name: "Heading / H1",
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 32,
    lineHeight: { unit: "PIXELS", value: 40 },
    isRemote: true,
  },
  {
    name: "Heading / H2",
    fontName: { family: "Inter", style: "SemiBold" },
    fontSize: 24,
    lineHeight: { unit: "PIXELS", value: 32 },
    isRemote: true,
  },
  {
    name: "Heading / H3",
    fontName: { family: "Inter", style: "SemiBold" },
    fontSize: 20,
    lineHeight: { unit: "PIXELS", value: 28 },
    isRemote: true,
  },
  {
    name: "Body / Large",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 18,
    lineHeight: { unit: "PIXELS", value: 26 },
    isRemote: true,
  },
  {
    name: "Body / Medium",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    lineHeight: { unit: "PIXELS", value: 24 },
    isRemote: true,
  },
  {
    name: "Body / Medium Bold",
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 16,
    lineHeight: { unit: "PIXELS", value: 24 },
    isRemote: true,
  },
  {
    name: "Body / Small",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 14,
    lineHeight: { unit: "PIXELS", value: 20 },
    isRemote: true,
  },
  {
    name: "Caption",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "PIXELS", value: 16 },
    isRemote: true,
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

  for (const token of tokens) {
    if (CATEGORY_MAP[token]) {
      return CATEGORY_MAP[token];
    }
  }

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

    // 3. Category Match for Existing Style
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

    const matchByLayerName = catalog.find((c) => c.name && c.name.toLowerCase().trim() === layerNameLower);
    if (matchByLayerName) return matchByLayerName;

    const normLayerName = normalizeStyleName(trimmedLayerName);
    const matchByNormLayer = catalog.find((c) => c.name && normalizeStyleName(c.name) === normLayerName);
    if (matchByNormLayer) return matchByNormLayer;

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

  // 5. Fallback: Find closest match across catalog
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

  const stylesMap = new Map();

  // 1. Local styles (Instant)
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

  // 2. Discover Remote styles from current selection & page
  try {
    const inspectedStyleIds = new Set();

    // Inspect user's active selection first to ensure selected styles are always discovered
    try {
      const sel = figma.currentPage.selection || [];
      for (const selNode of sel) {
        if (selNode.type === "TEXT") {
          if (typeof selNode.textStyleId === "string" && selNode.textStyleId.length > 0) {
            inspectedStyleIds.add(selNode.textStyleId);
          }
        } else if (typeof selNode.findAllWithCriteria === "function") {
          const selText = selNode.findAllWithCriteria({ types: ["TEXT"] });
          for (const node of selText) {
            if (typeof node.textStyleId === "string" && node.textStyleId.length > 0) {
              inspectedStyleIds.add(node.textStyleId);
            }
          }
        }
      }
    } catch (_) {}

    let textNodesToScan = [];
    if (typeof figma.currentPage.findAllWithCriteria === "function") {
      textNodesToScan = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
    }

    // Limit to 600 nodes to keep instant execution without thread lock
    const sampleLimit = Math.min(textNodesToScan.length, 600);
    for (let i = 0; i < sampleLimit; i++) {
      const node = textNodesToScan[i];
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

    const stylePromises = Array.from(inspectedStyleIds).map((id) => getStyleSafe(id));
    const resolvedStyles = await Promise.all(stylePromises);

    for (const style of resolvedStyles) {
      if (style && style.type === "TEXT") {
        const isRemoteStyle = style.remote === true || (typeof style.id === "string" && style.id.startsWith("S:"));
        const key = style.key || style.id;
        if (!stylesMap.has(key)) {
          let fontName = style.fontName;
          let fontSize = style.fontSize;
          let lineHeight = style.lineHeight;

          // Remote styles from getStyleById often lack font properties;
          // import by key to get the full spec
          if (isRemoteStyle && style.key && (!fontName || !fontSize)) {
            try {
              const imported = await figma.importStyleByKeyAsync(style.key);
              if (imported && imported.type === "TEXT") {
                fontName = imported.fontName;
                fontSize = imported.fontSize;
                lineHeight = imported.lineHeight;
                globalStyleCache.set(style.key, imported);
                globalStyleCache.set(imported.id, imported);
              }
            } catch (_) {}
          }

          stylesMap.set(key, {
            name: style.name,
            key: style.key,
            id: style.id,
            isRemote: isRemoteStyle,
            source: isRemoteStyle ? "remote" : "local",
            fontName: fontName,
            fontSize: fontSize,
            lineHeight: lineHeight,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[discoverAllStyles] Error discovering page styles:", err);
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
    this.allDiscoveredStyles = [];
  }

  async warmup() {
    this.localStyles = await getLocalTextStylesSafe();
    this.allDiscoveredStyles = await discoverAllStyles(false);

    const allFonts = [];
    for (const item of this.catalog) {
      if (item && item.fontName) allFonts.push(item.fontName);
    }
    for (const item of this.localStyles) {
      if (item && item.fontName) allFonts.push(item.fontName);
    }
    for (const item of this.allDiscoveredStyles) {
      if (item && item.fontName) allFonts.push(item.fontName);
    }
    await preloadFonts(allFonts);
  }

  async getResolvedStyleAsync(candidate) {
    if (!candidate) return null;

    const cacheKey = candidate.key || candidate.id || candidate.name;

    // 1. If remote key is present and not a dummy, use imported style
    if (
      candidate.key &&
      typeof candidate.key === "string" &&
      candidate.key.trim().length > 0
    ) {
      if (globalStyleCache.has(candidate.key)) {
        return globalStyleCache.get(candidate.key);
      }
      try {
        const imported = await figma.importStyleByKeyAsync(candidate.key);
        if (imported && imported.type === "TEXT") {
          globalStyleCache.set(cacheKey, imported);
          globalStyleCache.set(imported.id, imported);
          if (imported.key) globalStyleCache.set(imported.key, imported);
          return imported;
        }
      } catch (_) {}
    }

    // 2. Check in-memory cache
    if (globalStyleCache.has(cacheKey)) {
      return globalStyleCache.get(cacheKey);
    }

    // 3. Check by style ID
    if (candidate.id) {
      const styleById = await getStyleSafe(candidate.id);
      if (styleById) {
        if (styleById.key && styleById.remote) {
          try {
            const imported = await figma.importStyleByKeyAsync(styleById.key);
            if (imported) {
              globalStyleCache.set(cacheKey, imported);
              globalStyleCache.set(imported.id, imported);
              return imported;
            }
          } catch (_) {}
        }
        globalStyleCache.set(cacheKey, styleById);
        return styleById;
      }
    }

    // 4. Match by exact key in localStyles
    if (candidate.key) {
      const keyMatch = this.localStyles.find((s) => s.key === candidate.key);
      if (keyMatch) {
        globalStyleCache.set(cacheKey, keyMatch);
        return keyMatch;
      }
    }

    // 5. Match by exact name in localStyles
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

    // 6. Match by exact typography specs in localStyles
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

    // 7. Match by name in all discovered styles (including remote)
    if (candidate.name) {
      const nameMatch = this.allDiscoveredStyles.find(
        (s) => s.name && s.name.toLowerCase() === candidate.name.toLowerCase()
      );
      if (nameMatch) {
        if (nameMatch.key) {
          try {
            const imported = await figma.importStyleByKeyAsync(nameMatch.key);
            if (imported && imported.type === "TEXT") {
              globalStyleCache.set(cacheKey, imported);
              return imported;
            }
          } catch (_) {}
        }
        if (nameMatch.id) {
          const styleById = await getStyleSafe(nameMatch.id);
          if (styleById) {
            globalStyleCache.set(cacheKey, styleById);
            return styleById;
          }
        }
      }
    }

    // 8. Match by font specs in all discovered styles (including remote)
    if (candidate.fontName && candidate.fontSize) {
      const candWeight = parseFontWeight(candidate.fontName.style);
      const candItalic = /italic|oblique/i.test(candidate.fontName.style || "");
      const candFamily = (candidate.fontName.family || "").toLowerCase();

      const specMatch = this.allDiscoveredStyles.find((s) => {
        if (!s.fontName || s.fontSize !== candidate.fontSize) return false;
        if ((s.fontName.family || "").toLowerCase() !== candFamily) return false;
        if (parseFontWeight(s.fontName.style) !== candWeight) return false;
        if (/italic|oblique/i.test(s.fontName.style || "") !== candItalic) return false;
        return true;
      });

      if (specMatch) {
        if (specMatch.key) {
          try {
            const imported = await figma.importStyleByKeyAsync(specMatch.key);
            if (imported && imported.type === "TEXT") {
              globalStyleCache.set(cacheKey, imported);
              return imported;
            }
          } catch (_) {}
        }
        if (specMatch.id) {
          const styleById = await getStyleSafe(specMatch.id);
          if (styleById) {
            globalStyleCache.set(cacheKey, styleById);
            return styleById;
          }
        }
      }
    }

    return null;
  }
}

// ==========================================
// 6. NODE TRAVERSAL & HELPERS
// ==========================================
const SLOT_KEYWORD_REGEX = /\b(slot|placeholder|swap|content|body|custom|inner|item|override|template|container|wrapper|target|inside)\b|slot|placeholder|swap/i;

function isInsideInstance(node) {
  let curr = node.parent;
  while (curr) {
    if (curr.type === "INSTANCE") return true;
    curr = curr.parent;
  }
  return false;
}

function isSlotNode(node) {
  if (!node) return false;

  // 1. Check node name
  if (typeof node.name === "string" && SLOT_KEYWORD_REGEX.test(node.name)) {
    return true;
  }

  // 2. If it is an INSTANCE
  if (node.type === "INSTANCE") {
    // Check mainComponent name
    try {
      const mainComp = node.mainComponent;
      if (mainComp) {
        if (typeof mainComp.name === "string" && SLOT_KEYWORD_REGEX.test(mainComp.name)) {
          return true;
        }
        if (
          mainComp.parent &&
          typeof mainComp.parent.name === "string" &&
          SLOT_KEYWORD_REGEX.test(mainComp.parent.name)
        ) {
          return true;
        }
      }
    } catch (_) {}

    // Check component property references
    try {
      if (node.componentPropertyReferences) {
        if (node.componentPropertyReferences.mainComponent) {
          return true;
        }
        for (const [key, val] of Object.entries(node.componentPropertyReferences)) {
          if (SLOT_KEYWORD_REGEX.test(key) || (typeof val === "string" && SLOT_KEYWORD_REGEX.test(val))) {
            return true;
          }
        }
      }
    } catch (_) {}

    // Check component properties
    try {
      if (node.componentProperties) {
        for (const [propName, propVal] of Object.entries(node.componentProperties)) {
          if (SLOT_KEYWORD_REGEX.test(propName)) return true;
          if (propVal && propVal.type === "INSTANCE_SWAP") return true;
        }
      }
    } catch (_) {}

    // In Figma, nested instances inside another instance are swapped slot components
    if (isInsideInstance(node)) {
      return true;
    }
  }

  // 3. If it is a COMPONENT or COMPONENT_SET
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    if (typeof node.name === "string" && SLOT_KEYWORD_REGEX.test(node.name)) {
      return true;
    }
  }

  return false;
}

function isInsideSlot(node) {
  let curr = node;
  while (curr && curr.type !== "PAGE" && curr.type !== "DOCUMENT") {
    if (isSlotNode(curr)) {
      return true;
    }
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

    // Direct text node in selection
    if (root.type === "TEXT") {
      if (!ignoreInstances || !isInsideInstance(root) || isInsideSlot(root)) {
        addNode(root);
      }
      continue;
    }

    // Direct instance selected explicitly by user
    const isDirectSelection = root.type === "INSTANCE";

    if (typeof root.findAllWithCriteria === "function") {
      const found = root.findAllWithCriteria({ types: ["TEXT"] });
      for (let j = 0; j < found.length; j++) {
        const textNode = found[j];
        if (ignoreInstances) {
          if (isInsideInstance(textNode)) {
            // Allow if it is inside a slot or inside an explicitly selected instance
            if (isInsideSlot(textNode) || isDirectSelection) {
              addNode(textNode);
            }
            continue;
          }
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
  if (!selection || selection.length === 0) {
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
        ? "No eligible text layers found (try unchecking 'Ignore component instances' or select the slot layer)."
        : "No text layers found in current selection."
    );
    return summary;
  }

  // Preload all fonts for the selected nodes & active catalog
  const fontsToLoad = await collectFontsFromTextNodes(textNodes);
  for (const item of activeCatalog) {
    if (item && item.fontName) fontsToLoad.push(item.fontName);
  }

  const manager = new FastStyleManager(activeCatalog);
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

        const closest = findBestMatchingStyle(sourceSpec, activeCatalog);
        const style = await manager.getResolvedStyleAsync(closest);

        if (style) {
          await applyNodeStyleAsync(textNode, style);
        } else if (closest && closest.fontName) {
          await preloadFonts([closest.fontName]);
          // Unlink style first if applied so setting raw properties does not throw in Figma
          if (typeof textNode.setTextStyleIdAsync === "function") {
            await textNode.setTextStyleIdAsync("");
          } else {
            textNode.textStyleId = "";
          }
          textNode.fontName = closest.fontName;
          if (closest.fontSize) textNode.fontSize = closest.fontSize;
          if (closest.lineHeight) textNode.lineHeight = closest.lineHeight;
        }

        summary.totalUpdated++;
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

          const closest = findBestMatchingStyle(segSpec, activeCatalog);
          const style = await manager.getResolvedStyleAsync(closest);

          if (style) {
            await applyRangeStyleAsync(textNode, segment.start, segment.end, style);
          } else if (closest && closest.fontName) {
            await preloadFonts([closest.fontName]);
            if (typeof textNode.setRangeTextStyleIdAsync === "function") {
              await textNode.setRangeTextStyleIdAsync(segment.start, segment.end, "");
            } else {
              textNode.setRangeTextStyleId(segment.start, segment.end, "");
            }
            textNode.setRangeFontName(segment.start, segment.end, closest.fontName);
            if (closest.fontSize) textNode.setRangeFontSize(segment.start, segment.end, closest.fontSize);
            if (closest.lineHeight) textNode.setRangeLineHeight(segment.start, segment.end, closest.lineHeight);
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
figma.showUI(__html__, { width: 360, height: 460, themeColors: true });

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
    figma.notify("🔄 Rescanned text styles.");
  }

  if (msg.type === "run-replace-styles") {
    const options = {
      ignoreInstances: msg.options?.ignoreInstances !== false,
      scope: msg.options?.scope || "all",
    };

    await saveUserSettings(options);

    figma.ui.postMessage({ type: "process-start" });
    const summary = await applyClosestStylesToSelection(options);

    if (summary.totalUpdated > 0) {
      figma.notify(`⚡ Updated ${summary.totalUpdated} text layer(s)!`);
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