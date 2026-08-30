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

function parseFolderHierarchy(name) {
  if (!name) {
    return {
      hasFolders: false,
      folderPath: "",
      folders: [],
      leafName: "",
    };
  }
  const parts = String(name)
    .split(/[\/\\]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return {
      hasFolders: false,
      folderPath: "",
      folders: [],
      leafName: parts[0] || String(name).trim(),
    };
  }

  const leafName = parts.pop();
  const folderPath = parts.join(" / ");
  return {
    hasFolders: true,
    folderPath,
    folders: parts,
    leafName,
  };
}

function getLeafStyleName(name) {
  if (!name) return "";
  const parsed = parseFolderHierarchy(name);
  return parsed.leafName;
}

const GENERIC_FOLDER_NAMES = new Set([
  "typography",
  "typographies",
  "type",
  "text",
  "texts",
  "textstyle",
  "textstyles",
  "font",
  "fonts",
  "color",
  "colors",
  "colour",
  "colours",
  "style",
  "styles",
  "variable",
  "variables",
  "theme",
  "themes",
  "light",
  "dark",
  "desktop",
  "mobile",
  "tablet",
  "web",
  "ios",
  "android",
  "component",
  "components",
  "ui",
  "token",
  "tokens",
  "global",
  "base",
  "default",
  "mode",
  "modes",
]);

function getSemanticTokenCategory(str) {
  if (!str) return "";
  const s = String(str).toLowerCase();

  // Explicit word boundary or token checks
  if (/\b(h1)\b|^h1/i.test(s)) return "h1";
  if (/\b(h2)\b|^h2/i.test(s)) return "h2";
  if (/\b(h3)\b|^h3/i.test(s)) return "h3";
  if (/\b(h4)\b|^h4/i.test(s)) return "h4";
  if (/\b(h5)\b|^h5/i.test(s)) return "h5";
  if (/\b(h6)\b|^h6/i.test(s)) return "h6";

  if (/\b(overline|overlines|over-line|over_line)\b/i.test(s)) return "overline";
  if (/\b(caption|captions)\b/i.test(s)) return "caption";
  if (/\b(footnote|footnotes)\b/i.test(s)) return "footnote";
  if (/\b(callout|callouts)\b/i.test(s)) return "callout";
  if (/\b(subheading|subheadings|subheadline|subheadlines|subtitle|subtitles)\b/i.test(s)) return "subheading";
  if (/\b(heading|headings|headline|headlines|header|headers)\b/i.test(s)) return "heading";
  if (/\b(display|displays)\b/i.test(s)) return "display";
  if (/\b(title|titles)\b/i.test(s)) return "title";
  if (/\b(body|paragraph|paragraphs|content)\b/i.test(s)) return "body";
  if (/\b(button|buttons|btn)\b/i.test(s)) return "button";
  if (/\b(label|labels)\b/i.test(s)) return "label";
  if (/\b(badge|badges|tag|tags)\b/i.test(s)) return "badge";
  if (/\b(code|mono|monospace)\b/i.test(s)) return "code";
  if (/\b(quote|blockquote)\b/i.test(s)) return "quote";
  if (/\b(lead)\b/i.test(s)) return "lead";
  if (/\b(small|tiny|micro|mini)\b/i.test(s)) return "small";
  if (/\b(helper|hint|placeholder)\b/i.test(s)) return "helper";

  // Color semantic roles
  if (/\b(secondary|subtle)\b/i.test(s)) return "secondary";
  if (/\b(tertiary)\b/i.test(s)) return "tertiary";
  if (/\b(muted)\b/i.test(s)) return "muted";
  if (/\b(disabled|inactive)\b/i.test(s)) return "disabled";
  if (/\b(primary|main)\b/i.test(s)) return "primary";
  if (/\b(accent|brand)\b/i.test(s)) return "accent";
  if (/\b(link|links)\b/i.test(s)) return "link";
  if (/\b(success)\b/i.test(s)) return "success";
  if (/\b(warning|alert)\b/i.test(s)) return "warning";
  if (/\b(danger|error|destructive)\b/i.test(s)) return "danger";
  if (/\b(info|information)\b/i.test(s)) return "info";

  return "";
}

function getStyleCategoryOrRoot(name) {
  if (!name) return "";
  const str = String(name).trim();

  // 1. Try finding a known semantic category in the entire name/path
  const semantic = getSemanticTokenCategory(str);
  if (semantic) return semantic;

  // 2. If hierarchy exists, inspect non-generic folders
  const parsed = parseFolderHierarchy(str);
  if (parsed.hasFolders && parsed.folders.length > 0) {
    for (const folder of parsed.folders) {
      const norm = normalizeStyleName(folder);
      if (norm && !GENERIC_FOLDER_NAMES.has(norm)) {
        const folderSemantic = getSemanticTokenCategory(folder);
        return folderSemantic || norm;
      }
    }
    return normalizeStyleName(parsed.folders[0]);
  }

  // 3. Regex match on leading token (including overline & caption)
  const match = str.match(/^(h[1-6]|heading|title|subheading|subtitle|body|paragraph|caption|overline|button|label|display|header|footnote|callout|badge|tag|small|code|lead)/i);
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
let cachedDiscoveredPaintStyles = null;

async function getLocalTextStylesSafe() {
  if (typeof figma.getLocalTextStylesAsync === "function") {
    return await figma.getLocalTextStylesAsync();
  }
  return figma.getLocalTextStyles();
}

async function getLocalPaintStylesSafe() {
  if (typeof figma.getLocalPaintStylesAsync === "function") {
    return await figma.getLocalPaintStylesAsync();
  }
  return figma.getLocalPaintStyles();
}

async function getLocalColorVariablesSafe() {
  if (typeof figma.variables !== "undefined") {
    try {
      if (typeof figma.variables.getLocalVariablesAsync === "function") {
        const allVars = await figma.variables.getLocalVariablesAsync();
        return allVars.filter((v) => v.resolvedType === "COLOR" || v.type === "COLOR");
      }
    } catch (_) { }
    try {
      if (typeof figma.variables.getLocalVariables === "function") {
        const allVars = figma.variables.getLocalVariables();
        return allVars.filter((v) => v.resolvedType === "COLOR" || v.type === "COLOR");
      }
    } catch (_) { }
  }
  return [];
}

async function getAllVariableCollectionsSafe(localVars = []) {
  const collectionMap = new Map();

  if (typeof figma.variables !== "undefined" && typeof figma.variables.getLocalVariableCollectionsAsync === "function") {
    try {
      const localCols = await figma.variables.getLocalVariableCollectionsAsync();
      for (const col of localCols) {
        if (col && col.id) collectionMap.set(col.id, col);
      }
    } catch (_) { }
  }

  for (const v of localVars) {
    if (v && v.variableCollectionId && !collectionMap.has(v.variableCollectionId)) {
      if (typeof figma.variables !== "undefined" && typeof figma.variables.getVariableCollectionByIdAsync === "function") {
        try {
          const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
          if (col && col.id) collectionMap.set(col.id, col);
        } catch (_) { }
      }
    }
  }

  try {
    const selection = figma.currentPage.selection;
    if (selection && selection.length > 0) {
      for (const node of selection) {
        if (node.boundVariables) {
          for (const key in node.boundVariables) {
            const bv = node.boundVariables[key];
            if (Array.isArray(bv)) {
              for (const item of bv) {
                if (item && item.id) {
                  const v = await getStyleSafe(item.id);
                  if (v && v.variableCollectionId && !collectionMap.has(v.variableCollectionId)) {
                    const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
                    if (col && col.id) collectionMap.set(col.id, col);
                  }
                }
              }
            } else if (bv && bv.id) {
              const v = await getStyleSafe(bv.id);
              if (v && v.variableCollectionId && !collectionMap.has(v.variableCollectionId)) {
                const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
                if (col && col.id) collectionMap.set(col.id, col);
              }
            }
          }
        }
      }
    }
  } catch (_) { }

  return Array.from(collectionMap.values());
}

async function getStyleSafe(id) {
  if (!id) return null;
  if (globalStyleCache.has(id)) return globalStyleCache.get(id);

  if (id.startsWith("VariableID:")) {
    if (typeof figma.variables !== "undefined" && typeof figma.variables.getVariableByIdAsync === "function") {
      try {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (v) {
          globalStyleCache.set(id, v);
          return v;
        }
      } catch (_) { }
    }
  }

  try {
    const style =
      typeof figma.getStyleByIdAsync === "function"
        ? await figma.getStyleByIdAsync(id)
        : figma.getStyleById(id);

    if (style && (style.type === "TEXT" || style.type === "PAINT")) {
      globalStyleCache.set(id, style);
      if (style.key) globalStyleCache.set(style.key, style);
      if (style.name) globalStyleCache.set(`name__${style.name.toLowerCase()}`, style);
      return style;
    }
  } catch (_) { }
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
    if (!node || node.type !== 'TEXT' || node.hasMissingFont) continue;
    if (node.fontName !== figma.mixed && node.fontName) {
      fonts.push(node.fontName);
    } else {
      try {
        const segments = node.getStyledTextSegments(["fontName"]);
        for (const seg of segments) {
          if (seg.fontName) fonts.push(seg.fontName);
        }
      } catch (_) { }
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
      const folderInfo = parseFolderHierarchy(s.name);
      list.push({
        name: s.name,
        leafName: folderInfo.leafName,
        folderPath: folderInfo.folderPath,
        folders: folderInfo.folders,
        hasFolders: folderInfo.hasFolders,
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

async function discoverAllPaintStyles(forceRefresh = false) {
  if (cachedDiscoveredPaintStyles && !forceRefresh) {
    return cachedDiscoveredPaintStyles;
  }

  const list = [];
  try {
    const localStyles = await getLocalPaintStylesSafe();
    for (const s of localStyles) {
      globalStyleCache.set(s.id, s);
      if (s.key) globalStyleCache.set(s.key, s);
      if (s.name) globalStyleCache.set(`name__${s.name.toLowerCase()}`, s);
      const folderInfo = parseFolderHierarchy(s.name);
      list.push({
        name: s.name,
        leafName: folderInfo.leafName,
        folderPath: folderInfo.folderPath,
        folders: folderInfo.folders,
        hasFolders: folderInfo.hasFolders,
        key: s.key,
        id: s.id,
        paints: s.paints,
      });
    }
  } catch (err) {
    console.warn("[discoverAllPaintStyles] Error loading local paint styles:", err);
  }

  cachedDiscoveredPaintStyles = list;
  return cachedDiscoveredPaintStyles;
}

let cachedDiscoveredColorVariables = null;
let lastUsedVariableMode = "AUTO";

function parseSelectedMode(selectedModeValue, collectionMap = new Map()) {
  if (!selectedModeValue || selectedModeValue === "AUTO") {
    return { isAuto: true, colId: null, modeId: null, modeName: null };
  }

  let colId = null;
  let modeId = null;
  let modeName = null;

  if (typeof selectedModeValue === "object") {
    colId = selectedModeValue.colId || null;
    modeId = selectedModeValue.modeId || null;
    modeName = selectedModeValue.modeName || selectedModeValue.name || null;
  } else if (typeof selectedModeValue === "string") {
    const trimmed = selectedModeValue.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        colId = parsed.colId || null;
        modeId = parsed.modeId || null;
        modeName = parsed.modeName || parsed.name || null;
      } catch (_) { }
    } else if (trimmed.startsWith("NAME:")) {
      modeName = trimmed.slice(5).trim();
    } else if (trimmed.includes(":::")) {
      const parts = trimmed.split(":::");
      colId = parts[0] || null;
      modeId = parts[1] || null;
      modeName = parts[2] || null;
    } else {
      for (const [cId, col] of collectionMap.entries()) {
        if (col && col.modes) {
          for (const m of col.modes) {
            const mId = m.modeId || m.id;
            if (mId === trimmed || (m.name && m.name.toLowerCase() === trimmed.toLowerCase())) {
              colId = cId;
              modeId = mId;
              modeName = m.name;
              break;
            }
            if (`${cId}:${mId}` === trimmed) {
              colId = cId;
              modeId = mId;
              modeName = m.name;
              break;
            }
          }
          if (modeId) break;
        }
      }

      if (!modeId) {
        modeName = trimmed;
      }
    }
  }

  if (colId && modeId && !modeName && collectionMap.has(colId)) {
    const col = collectionMap.get(colId);
    const m = col?.modes?.find((m) => (m.modeId || m.id) === modeId);
    if (m) modeName = m.name;
  }

  return { isAuto: false, colId, modeId, modeName };
}

async function resolveVariableColor(variable, selectedModeValue, varMap, collectionMap, depth = 0) {
  if (depth > 8 || !variable || !variable.valuesByMode) return null;
  const col = collectionMap.get(variable.variableCollectionId);

  const parsed = parseSelectedMode(selectedModeValue, collectionMap);
  let targetModeId = null;

  if (!parsed.isAuto) {
    // 1. Direct match if variable collection matches selected collection
    if (parsed.colId && variable.variableCollectionId === parsed.colId && parsed.modeId && variable.valuesByMode[parsed.modeId] !== undefined) {
      targetModeId = parsed.modeId;
    }
    // 2. Match by mode name across collections (e.g. "Dark", "Light")
    else if (parsed.modeName && col && col.modes) {
      const modeNameLower = parsed.modeName.toLowerCase();
      const matchedMode = col.modes.find((m) => m.name && m.name.toLowerCase() === modeNameLower);
      const mId = matchedMode ? (matchedMode.modeId || matchedMode.id) : null;
      if (mId && variable.valuesByMode[mId] !== undefined) {
        targetModeId = mId;
      }
    }
    // 3. Fallback to modeId if present in valuesByMode
    if (!targetModeId && parsed.modeId && variable.valuesByMode[parsed.modeId] !== undefined) {
      targetModeId = parsed.modeId;
    }
  }

  if (!targetModeId) {
    targetModeId = col?.defaultModeId || Object.keys(variable.valuesByMode)[0];
  }

  const val = variable.valuesByMode[targetModeId];
  if (val === undefined || val === null) return null;

  if (typeof val === "object") {
    if (val.type === "VARIABLE_ALIAS" && val.id) {
      let targetVar = varMap.get(val.id);
      if (!targetVar) {
        targetVar = await getStyleSafe(val.id);
      }
      if (targetVar && targetVar.variableCollectionId && !collectionMap.has(targetVar.variableCollectionId)) {
        if (typeof figma.variables !== "undefined" && typeof figma.variables.getVariableCollectionByIdAsync === "function") {
          try {
            const c = await figma.variables.getVariableCollectionByIdAsync(targetVar.variableCollectionId);
            if (c && c.id) collectionMap.set(c.id, c);
          } catch (_) { }
        }
      }
      return await resolveVariableColor(targetVar, selectedModeValue, varMap, collectionMap, depth + 1);
    }
    if ("r" in val && "g" in val && "b" in val) {
      return val;
    }
  }
  return null;
}

async function discoverAllColorVariables(forceRefresh = false, selectedMode = "AUTO") {
  const modeKey = typeof selectedMode === "object" ? JSON.stringify(selectedMode) : String(selectedMode);
  if (cachedDiscoveredColorVariables && !forceRefresh && lastUsedVariableMode === modeKey) {
    return cachedDiscoveredColorVariables;
  }

  const list = [];
  try {
    const localVars = await getLocalColorVariablesSafe();
    const collections = await getAllVariableCollectionsSafe(localVars);

    const varMap = new Map();
    for (const v of localVars) {
      varMap.set(v.id, v);
    }

    const collectionMap = new Map();
    for (const c of collections) {
      collectionMap.set(c.id, c);
    }

    const parsedSelectedMode = parseSelectedMode(selectedMode, collectionMap);

    for (const v of localVars) {
      globalStyleCache.set(v.id, v);
      if (v.key) globalStyleCache.set(v.key, v);
      if (v.name) globalStyleCache.set(`name__${v.name.toLowerCase()}`, v);

      const colorVal = await resolveVariableColor(v, selectedMode, varMap, collectionMap);

      if (colorVal) {
        const mockPaints = [
          {
            type: "SOLID",
            color: { r: colorVal.r, g: colorVal.g, b: colorVal.b },
            opacity: colorVal.a !== undefined ? colorVal.a : 1,
          },
        ];

        const folderInfo = parseFolderHierarchy(v.name);
        const col = collectionMap.get(v.variableCollectionId);
        const collectionName = col ? col.name : "";
        const colNameLower = (collectionName || "").toLowerCase().trim();

        let isAlias = false;
        if (v.valuesByMode) {
          for (const mId in v.valuesByMode) {
            const mVal = v.valuesByMode[mId];
            if (mVal && typeof mVal === "object" && mVal.type === "VARIABLE_ALIAS") {
              isAlias = true;
              break;
            }
          }
        }

        const isFoundation =
          colNameLower.includes("foundation") ||
          colNameLower.includes("primitive") ||
          colNameLower.includes("base") ||
          colNameLower.includes("raw") ||
          colNameLower.includes("palette") ||
          colNameLower.includes("global") ||
          colNameLower.includes("core");

        const isSemantic =
          colNameLower.includes("mode") ||
          colNameLower.includes("alias") ||
          colNameLower.includes("semantic") ||
          colNameLower.includes("theme") ||
          colNameLower.includes("brand") ||
          colNameLower.includes("token") ||
          colNameLower.includes("component") ||
          isAlias;

        const isFromSelectedCol = Boolean(!parsedSelectedMode.isAuto && parsedSelectedMode.colId && v.variableCollectionId === parsedSelectedMode.colId);

        list.push({
          isVariable: true,
          name: v.name,
          leafName: folderInfo.leafName,
          folderPath: folderInfo.folderPath,
          folders: folderInfo.folders,
          hasFolders: folderInfo.hasFolders,
          collectionName: collectionName,
          collectionId: v.variableCollectionId,
          isAlias,
          isFoundation,
          isSemantic,
          isFromSelectedCol,
          key: v.key,
          id: v.id,
          paints: mockPaints,
        });
      }
    }

    // Sort catalog so selected collection and semantic/alias tokens appear before raw foundation tokens
    list.sort((a, b) => {
      if (a.isFromSelectedCol !== b.isFromSelectedCol) return a.isFromSelectedCol ? -1 : 1;
      if (a.isSemantic !== b.isSemantic) return a.isSemantic ? -1 : 1;
      if (a.isFoundation !== b.isFoundation) return a.isFoundation ? 1 : -1;
      return 0;
    });
  } catch (err) {
    console.warn("[discoverAllColorVariables] Error loading local color variables:", err);
  }

  lastUsedVariableMode = modeKey;
  cachedDiscoveredColorVariables = list;
  return cachedDiscoveredColorVariables;
}

function calculatePaintMatchScore(sourcePaints, candPaints) {
  if (!sourcePaints || !candPaints || sourcePaints.length !== candPaints.length) return 10000;

  let score = 0;
  for (let i = 0; i < sourcePaints.length; i++) {
    const s = sourcePaints[i];
    const c = candPaints[i];
    if (s.type !== c.type) return 10000;
    if (s.type === 'SOLID') {
      const rDiff = s.color.r - c.color.r;
      const gDiff = s.color.g - c.color.g;
      const bDiff = s.color.b - c.color.b;
      const aDiff = (s.opacity !== undefined ? s.opacity : 1) - (c.opacity !== undefined ? c.opacity : 1);
      score += (rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) * 5000;
      score += aDiff * aDiff * 5000;
    } else {
      score += 5000;
    }
  }
  return score;
}

function calculateContextualPaintScore(sourceSpec, candidate) {
  let score = calculatePaintMatchScore(sourceSpec.paints, candidate.paints);
  if (score >= 10000) return score;

  const selMode = sourceSpec.selectedModeInfo;

  // 1. Prioritize candidate from user's specifically selected collection or mode
  if (selMode && !selMode.isAuto) {
    if (selMode.colId && candidate.collectionId === selMode.colId) {
      score -= 500; // Strong bonus for user's selected collection
    } else if (selMode.modeName && candidate.collectionName) {
      const colNameLower = candidate.collectionName.toLowerCase();
      if (colNameLower.includes(selMode.modeName.toLowerCase())) {
        score -= 300;
      }
    }
  }

  // 2. Prioritize Semantic / Alias / Mode collections over Foundation / Primitives
  if (candidate.isSemantic || candidate.isAlias) {
    score -= 200;
  }
  if (candidate.isFoundation) {
    score += 600; // Heavy penalty for raw/primitive/foundation colors so semantic tokens win
  }

  // 3. Category match bonuses
  const targetCategory =
    sourceSpec.semanticCategory ||
    (sourceSpec.textStyleName ? getStyleCategoryOrRoot(sourceSpec.textStyleName) : "") ||
    (sourceSpec.existingStyle ? getStyleCategoryOrRoot(sourceSpec.existingStyle.name) : "") ||
    (sourceSpec.existingVariable ? getStyleCategoryOrRoot(sourceSpec.existingVariable.name) : "") ||
    (sourceSpec.layerName ? getStyleCategoryOrRoot(sourceSpec.layerName) : "");

  const candCat = getStyleCategoryOrRoot(candidate.name);
  const candNameLower = (candidate.name || "").toLowerCase();

  if (targetCategory) {
    if (candCat === targetCategory || candNameLower.includes(targetCategory)) {
      // Direct semantic category bonus
      score -= 100;
    } else if (
      (targetCategory === "caption" && (candCat === "overline" || candNameLower.includes("overline"))) ||
      (targetCategory === "overline" && (candCat === "caption" || candNameLower.includes("caption")))
    ) {
      // Heavy penalty to avoid mismatching caption color with overline or overline with caption
      score += 300;
    } else if (
      (targetCategory === "caption" || targetCategory === "overline") &&
      (candCat === "primary" || candCat === "body" || candCat === "heading")
    ) {
      score += 50;
    }
  } else {
    // If target has no specific caption/overline context, de-prioritize caption/overline specific colors when multiple colors tie
    if (candCat === "caption" || candCat === "overline" || candNameLower.includes("caption") || candNameLower.includes("overline")) {
      score += 30;
    }
  }

  return score;
}

function findClosestPaintInCandidates(sourceSpec, candidates) {
  if (!candidates || candidates.length === 0) return null;
  let best = candidates[0];
  let minScore = calculateContextualPaintScore(sourceSpec, best);
  for (let i = 1; i < candidates.length; i++) {
    const cand = candidates[i];
    const score = calculateContextualPaintScore(sourceSpec, cand);
    if (score < minScore) {
      minScore = score;
      best = cand;
    }
  }
  return best;
}

function findBestMatchingPaintStyle(sourceSpec, localCatalog) {
  if (!localCatalog || localCatalog.length === 0) return null;
  const { existingStyle, existingVariable, layerName, textStyleName, paints, selectedModeInfo } = sourceSpec;

  const existing = existingStyle || existingVariable;

  // If existing is from Foundation or if a different mode/collection is selected,
  // do not blindly lock into the existing Foundation variable
  const isSelectedModeActive = selectedModeInfo && !selectedModeInfo.isAuto && selectedModeInfo.colId;
  const existingMatchesSelectedCol = existingVariable && isSelectedModeActive && existingVariable.variableCollectionId === selectedModeInfo.colId;
  const isExistingFoundation = existing && existing.name && (
    existing.name.toLowerCase().includes("foundation") ||
    existing.name.toLowerCase().includes("primitive") ||
    existing.name.toLowerCase().includes("base")
  );

  // 1. Direct match with existing style/variable key or id (only if not an existing foundation token when a specific mode/collection is selected)
  if (existing && (!isSelectedModeActive || existingMatchesSelectedCol) && !isExistingFoundation) {
    if (existing.key) {
      const matchByKey = localCatalog.find((c) => c.key === existing.key);
      if (matchByKey) return matchByKey;
    }
    if (existing.id) {
      const matchById = localCatalog.find((c) => c.id === existing.id);
      if (matchById) return matchById;
    }

    // 2. Direct Name Match for Existing Style / Variable
    if (existing.name) {
      const existingNameLower = existing.name.toLowerCase().trim();
      const matchByName = localCatalog.find((c) => c.name && c.name.toLowerCase().trim() === existingNameLower);
      if (matchByName) return matchByName;

      const normExisting = normalizeStyleName(existing.name);
      const matchByNorm = localCatalog.find((c) => c.name && normalizeStyleName(c.name) === normExisting);
      if (matchByNorm) return matchByNorm;

      const leafExisting = normalizeStyleName(getLeafStyleName(existing.name));
      if (leafExisting && leafExisting.length > 2) {
        const leafMatches = localCatalog.filter(
          (c) => c.name && normalizeStyleName(getLeafStyleName(c.name)) === leafExisting
        );
        if (leafMatches.length === 1) {
          const score = paints ? calculatePaintMatchScore(paints, leafMatches[0].paints) : 0;
          if (score < 300) return leafMatches[0];
        } else if (leafMatches.length > 1 && paints) {
          const best = findClosestPaintInCandidates(sourceSpec, leafMatches);
          if (best && calculatePaintMatchScore(paints, best.paints) < 300) return best;
        }
      }

      // 3. Category Match for Existing Style
      const existingCat = getStyleCategoryOrRoot(existing.name);
      if (existingCat) {
        const sameCategoryCandidates = localCatalog.filter((c) => {
          if (!c.name) return false;
          const candCat = getStyleCategoryOrRoot(c.name);
          return candCat === existingCat || normalizeStyleName(c.name).includes(existingCat);
        });

        if (sameCategoryCandidates.length > 0 && paints) {
          const bestCatMatch = findClosestPaintInCandidates(sourceSpec, sameCategoryCandidates);
          if (bestCatMatch) {
            const catScore = calculatePaintMatchScore(sourceSpec.paints, bestCatMatch.paints);
            if (catScore < 250) return bestCatMatch;
          }
        }
      }
    }
  }

  // 4. Semantic Category Match from Text Style (for text layers)
  const targetCategory =
    sourceSpec.semanticCategory ||
    (textStyleName ? getStyleCategoryOrRoot(textStyleName) : "") ||
    (layerName ? getStyleCategoryOrRoot(layerName) : "");

  if (targetCategory && paints) {
    const semCategoryCandidates = localCatalog.filter((c) => {
      if (!c.name) return false;
      const candCat = getStyleCategoryOrRoot(c.name);
      return candCat === targetCategory || normalizeStyleName(c.name).includes(targetCategory);
    });

    if (semCategoryCandidates.length > 0) {
      const bestSemMatch = findClosestPaintInCandidates(sourceSpec, semCategoryCandidates);
      if (bestSemMatch) {
        const score = calculatePaintMatchScore(sourceSpec.paints, bestSemMatch.paints);
        if (score < 250) return bestSemMatch;
      }
    }
  }

  // 5. Layer Name Match (only if color is visually compatible)
  if (layerName && typeof layerName === "string" && layerName.trim().length > 0) {
    const trimmedLayerName = layerName.trim();
    const layerNameLower = trimmedLayerName.toLowerCase();

    const matchByLayerName = localCatalog.find((c) => c.name && c.name.toLowerCase().trim() === layerNameLower);
    if (matchByLayerName && paints) {
      const score = calculatePaintMatchScore(paints, matchByLayerName.paints);
      if (score < 250) return matchByLayerName;
    }

    const normLayerName = normalizeStyleName(trimmedLayerName);
    const matchByNormLayer = localCatalog.find((c) => c.name && normalizeStyleName(c.name) === normLayerName);
    if (matchByNormLayer && paints) {
      const score = calculatePaintMatchScore(paints, matchByNormLayer.paints);
      if (score < 250) return matchByNormLayer;
    }
  }

  // 6. Contextual visual color difference match
  return findClosestPaintInCandidates(sourceSpec, localCatalog);
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

function collectEligibleNodes(selection, ignoreInstances = false, ignoreShapes = false) {
  const nodes = [];
  const visitedIds = new Set();

  function addNode(node) {
    if (!node || visitedIds.has(node.id) || node.type === "SECTION") return;
    visitedIds.add(node.id);
    nodes.push(node);
  }

  function isEligible(n) {
    if (!n || n.type === "SECTION") return false;
    if (ignoreShapes && n.type !== "TEXT") return false;
    return ('fills' in n) || ('strokes' in n) || n.type === 'TEXT';
  }

  for (let i = 0; i < selection.length; i++) {
    const root = selection[i];
    if (!root) continue;

    if (ignoreInstances && isInsideInstance(root)) {
      continue;
    }

    if (isEligible(root)) {
      if (!ignoreInstances || !isInsideInstance(root)) {
        addNode(root);
      }
    }

    if (typeof root.findAll === "function") {
      const found = root.findAll(n => isEligible(n));
      for (let j = 0; j < found.length; j++) {
        const node = found[j];
        if (ignoreInstances && isInsideInstance(node)) {
          continue;
        }
        addNode(node);
      }
    }
  }

  return nodes;
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

async function ensureNodeFontsLoaded(node) {
  if (node.type !== "TEXT") return;
  if (node.hasMissingFont) return;
  if (node.fontName !== figma.mixed && node.fontName) {
    await preloadFonts([node.fontName]);
  } else {
    try {
      const segments = node.getStyledTextSegments(["fontName"]);
      const fonts = segments.map((s) => s.fontName).filter(Boolean);
      await preloadFonts(fonts);
    } catch (_) { }
  }
}

async function applyFillToNodeOrSegment(node, styleOrVar, isVariable, start = null, end = null) {
  if (node.type === "TEXT") {
    await ensureNodeFontsLoaded(node);
  }

  if (start !== null && end !== null && node.type === "TEXT") {
    if (isVariable) {
      if (typeof figma.variables !== "undefined" && typeof figma.variables.setBoundVariableForPaint === "function") {
        const segFills = node.getRangeFills(start, end);
        if (Array.isArray(segFills)) {
          const newPaints = segFills.map((p) => {
            if (p.type === "SOLID") {
              return figma.variables.setBoundVariableForPaint(p, "color", styleOrVar);
            }
            return p;
          });
          if (typeof node.setRangeFillsAsync === "function") {
            await node.setRangeFillsAsync(start, end, newPaints);
          } else {
            node.setRangeFills(start, end, newPaints);
          }
          return true;
        }
      }
    } else {
      if (typeof node.setRangeFillStyleIdAsync === "function") {
        await node.setRangeFillStyleIdAsync(start, end, styleOrVar.id);
      } else {
        node.setRangeFillStyleId(start, end, styleOrVar.id);
      }
      return true;
    }
  } else {
    if (isVariable) {
      if (typeof figma.variables !== "undefined" && typeof figma.variables.setBoundVariableForPaint === "function") {
        if (Array.isArray(node.fills)) {
          const newPaints = node.fills.map((p) => {
            if (p.type === "SOLID") {
              return figma.variables.setBoundVariableForPaint(p, "color", styleOrVar);
            }
            return p;
          });
          if (typeof node.setFillsAsync === "function") {
            await node.setFillsAsync(newPaints);
          } else {
            node.fills = newPaints;
          }
          return true;
        }
      }
    } else {
      if (typeof node.setFillStyleIdAsync === "function") {
        await node.setFillStyleIdAsync(styleOrVar.id);
      } else {
        node.fillStyleId = styleOrVar.id;
      }
      return true;
    }
  }
  return false;
}

// ==========================================
// 6. HIGH-PERFORMANCE REPLACEMENT PIPELINE
// ==========================================
async function applyClosestStylesToSelection(options = { ignoreInstances: true, ignoreShapes: false, variableMode: "AUTO" }) {
  const summary = {
    totalInspected: 0,
    totalUpdated: 0,
    textUpdated: 0,
    colorUpdated: 0,
    totalSkipped: 0,
    appliedDetails: [],
    errors: [],
  };

  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    figma.notify("⚠️ Please select at least one layer.");
    return summary;
  }

  const localVars = await getLocalColorVariablesSafe();
  const collections = await getAllVariableCollectionsSafe(localVars);
  const collectionMap = new Map();
  for (const c of collections) {
    if (c && c.id) collectionMap.set(c.id, c);
  }
  const selectedModeInfo = parseSelectedMode(options.variableMode || "AUTO", collectionMap);

  const localStyles = await discoverAllStyles(false);
  const localPaintStyles = await discoverAllPaintStyles(false);
  const localColorVars = await discoverAllColorVariables(false, options.variableMode || "AUTO");
  const localColorsAndVars = [...localColorVars, ...localPaintStyles];
  if (localStyles.length === 0 && localColorsAndVars.length === 0) {
    figma.notify("⚠️ No local styles or variables found in this document. Please create some first.");
    return summary;
  }

  const nodes = collectEligibleNodes(selection, options.ignoreInstances, options.ignoreShapes);

  if (nodes.length === 0) {
    let msg = "No eligible layers found in current selection.";
    if (options.ignoreShapes && options.ignoreInstances) {
      msg = "No eligible text layers found (try unchecking 'Ignore shapes' or 'Ignore component instances').";
    } else if (options.ignoreShapes) {
      msg = "No text layers found in current selection (try unchecking 'Ignore shapes').";
    } else if (options.ignoreInstances) {
      msg = "No eligible layers found (try unchecking 'Ignore component instances').";
    }
    figma.notify(msg);
    return summary;
  }

  const fontsToLoad = await collectFontsFromTextNodes(nodes);
  for (const item of localStyles) {
    if (item && item.fontName) fontsToLoad.push(item.fontName);
  }

  const manager = new FastStyleManager([...localStyles, ...localColorsAndVars]);
  await Promise.all([preloadFonts(fontsToLoad), manager.warmup()]);

  for (let i = 0; i < nodes.length; i++) {
    if (i > 0 && i % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const node = nodes[i];
    if (!node || node.type === "SECTION") continue;
    if (options.ignoreShapes && node.type !== "TEXT") continue;
    summary.totalInspected++;

    try {
      let updatedThisNode = false;
      let matchedTextStyle = null;
      let existingTextStyle = null;

      // Handle Text Styles (Typography)
      if (node.type === "TEXT") {
        if (node.hasMissingFont) {
          summary.errors.push(`Layer "${node.name}" has missing fonts and typography sync was skipped.`);
        } else {
          const isMixedFont = node.fontName === figma.mixed;
          const isMixedSize = node.fontSize === figma.mixed;
          const isMixedLh = node.lineHeight === figma.mixed;

          if (!isMixedFont && !isMixedSize && !isMixedLh) {
            if (node.fontName) {
              await preloadFonts([node.fontName]);
            }

            if (typeof node.textStyleId === "string" && node.textStyleId.length > 0) {
              existingTextStyle = await getStyleSafe(node.textStyleId);
            }

            const sourceSpec = {
              fontName: node.fontName,
              fontSize: node.fontSize,
              lineHeight: node.lineHeight,
              existingStyle: existingTextStyle,
              layerName: node.name,
            };

            const closest = findBestMatchingStyle(sourceSpec, localStyles);
            matchedTextStyle = closest;
            const style = await manager.getResolvedStyleAsync(closest);

            if (style) {
              await applyNodeStyleAsync(node, style);
              updatedThisNode = true;
              summary.textUpdated++;
              if (summary.appliedDetails.length < 50) {
                summary.appliedDetails.push({
                  id: node.id,
                  layer: node.name,
                  target: closest.name,
                  folderPath: closest.folderPath || "",
                  leafName: closest.leafName || closest.name,
                  type: "text",
                });
              }
            }
          } else {
            const segments = node.getStyledTextSegments([
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
                layerName: node.name,
              };

              const closest = findBestMatchingStyle(segSpec, localStyles);
              segment._matchedTextStyle = closest;
              const style = await manager.getResolvedStyleAsync(closest);

              if (style) {
                await applyRangeStyleAsync(node, segment.start, segment.end, style);
                updatedThisNode = true;
              }
            }
            if (updatedThisNode) {
              summary.textUpdated++;
            }
          }
        }
      }

      const activeTextStyle = matchedTextStyle || existingTextStyle;
      const textStyleName = activeTextStyle ? activeTextStyle.name : "";
      const semanticCategory =
        (activeTextStyle ? getStyleCategoryOrRoot(activeTextStyle.name) : "") ||
        getStyleCategoryOrRoot(node.name);

      // Handle Paint Styles and Variables (Fills)
      if ('fills' in node && node.fills && node.fills !== figma.mixed && Array.isArray(node.fills) && node.fills.length > 0) {
        if (node.type !== "TEXT" || node.fillStyleId !== figma.mixed) {
          // Standard node or uniform text fill
          const hasVisibleFills = node.fills.some(p => p.visible !== false);
          if (hasVisibleFills) {
            let existingStyle = null;
            if (typeof node.fillStyleId === "string" && node.fillStyleId.length > 0) {
              existingStyle = await getStyleSafe(node.fillStyleId);
            }
            let existingVariable = null;
            const boundVar = node.fills.find(p => p.boundVariables && p.boundVariables.color)?.boundVariables?.color;
            if (boundVar && boundVar.id) {
              existingVariable = await getStyleSafe(boundVar.id);
            }

            const spec = {
              paints: node.fills,
              existingStyle,
              existingVariable,
              layerName: node.name,
              textStyleName,
              semanticCategory,
              selectedModeInfo,
            };

            const closestPaint = findBestMatchingPaintStyle(spec, localColorsAndVars);
            if (closestPaint) {
              const isAlreadyApplied = closestPaint.isVariable
                ? node.fills.every(p => p.boundVariables && p.boundVariables.color && p.boundVariables.color.id === closestPaint.id)
                : node.fillStyleId === closestPaint.id;

              if (!isAlreadyApplied) {
                const styleOrVar = await manager.getResolvedStyleAsync(closestPaint);
                if (styleOrVar) {
                  const applied = await applyFillToNodeOrSegment(node, styleOrVar, closestPaint.isVariable);
                  if (applied) {
                    updatedThisNode = true;
                    summary.colorUpdated++;
                    if (summary.appliedDetails.length < 50) {
                      summary.appliedDetails.push({
                        id: node.id,
                        layer: node.name,
                        target: closestPaint.name,
                        folderPath: closestPaint.folderPath || "",
                        leafName: closestPaint.leafName || closestPaint.name,
                        collection: closestPaint.collectionName || "",
                        type: closestPaint.isVariable ? "variable" : "color",
                      });
                    }
                  }
                }
              }
            }
          }
        } else if (node.type === "TEXT") {
          // Text layer with mixed fill segments
          try {
            await ensureNodeFontsLoaded(node);
            const segments = node.getStyledTextSegments(["fills", "fillStyleId", "boundVariables", "fontName", "textStyleId"]);
            let anySegUpdated = false;
            for (let seg of segments) {
              if (seg.fills && Array.isArray(seg.fills) && seg.fills.length > 0) {
                let existingStyle = null;
                if (typeof seg.fillStyleId === "string" && seg.fillStyleId.length > 0) {
                  existingStyle = await getStyleSafe(seg.fillStyleId);
                }
                let existingVariable = null;
                const boundVar = seg.fills.find(p => p.boundVariables && p.boundVariables.color)?.boundVariables?.color;
                if (boundVar && boundVar.id) {
                  existingVariable = await getStyleSafe(boundVar.id);
                }

                let segTextStyle = seg._matchedTextStyle;
                if (!segTextStyle && typeof seg.textStyleId === "string" && seg.textStyleId.length > 0) {
                  segTextStyle = await getStyleSafe(seg.textStyleId);
                }
                const segTextStyleName = segTextStyle ? segTextStyle.name : textStyleName;
                const segSemanticCategory =
                  (segTextStyle ? getStyleCategoryOrRoot(segTextStyle.name) : "") ||
                  semanticCategory;

                const spec = {
                  paints: seg.fills,
                  existingStyle,
                  existingVariable,
                  layerName: node.name,
                  textStyleName: segTextStyleName,
                  semanticCategory: segSemanticCategory,
                  selectedModeInfo,
                };

                const closestPaint = findBestMatchingPaintStyle(spec, localColorsAndVars);
                if (closestPaint) {
                  const isAlreadyApplied = closestPaint.isVariable
                    ? seg.fills.every(p => p.boundVariables && p.boundVariables.color && p.boundVariables.color.id === closestPaint.id)
                    : seg.fillStyleId === closestPaint.id;

                  if (!isAlreadyApplied) {
                    const styleOrVar = await manager.getResolvedStyleAsync(closestPaint);
                    if (styleOrVar) {
                      const applied = await applyFillToNodeOrSegment(node, styleOrVar, closestPaint.isVariable, seg.start, seg.end);
                      if (applied) {
                        anySegUpdated = true;
                      }
                    }
                  }
                }
              }
            }
            if (anySegUpdated) {
              updatedThisNode = true;
              summary.colorUpdated++;
            }
          } catch (e) {
            console.warn("Error updating mixed text fills:", e);
          }
        }
      }

      // Handle Paint Styles and Variables (Strokes)
      if ('strokes' in node && node.strokes && node.strokes !== figma.mixed && Array.isArray(node.strokes) && node.strokes.length > 0) {
        let existingStyle = null;
        if (typeof node.strokeStyleId === "string" && node.strokeStyleId.length > 0) {
          existingStyle = await getStyleSafe(node.strokeStyleId);
        }
        let existingVariable = null;
        const boundVar = node.strokes.find(p => p.boundVariables && p.boundVariables.color)?.boundVariables?.color;
        if (boundVar && boundVar.id) {
          existingVariable = await getStyleSafe(boundVar.id);
        }

        const spec = {
          paints: node.strokes,
          existingStyle,
          existingVariable,
          layerName: node.name,
          textStyleName,
          semanticCategory,
          selectedModeInfo,
        };

        const closestPaint = findBestMatchingPaintStyle(spec, localColorsAndVars);
        if (closestPaint) {
          const isAlreadyApplied = closestPaint.isVariable
            ? node.strokes.every(p => p.boundVariables && p.boundVariables.color && p.boundVariables.color.id === closestPaint.id)
            : node.strokeStyleId === closestPaint.id;

          if (!isAlreadyApplied) {
            const styleOrVar = await manager.getResolvedStyleAsync(closestPaint);
            if (styleOrVar) {
              if (node.type === "TEXT") {
                await ensureNodeFontsLoaded(node);
              }
              if (closestPaint.isVariable) {
                if (typeof figma.variables !== "undefined" && typeof figma.variables.setBoundVariableForPaint === "function") {
                  const newPaints = node.strokes.map(p => {
                    if (p.type === 'SOLID') {
                      return figma.variables.setBoundVariableForPaint(p, "color", styleOrVar);
                    }
                    return p;
                  });
                  if (typeof node.setStrokesAsync === "function") {
                    await node.setStrokesAsync(newPaints);
                  } else {
                    node.strokes = newPaints;
                  }
                  updatedThisNode = true;
                  summary.colorUpdated++;
                }
              } else {
                if (typeof node.setStrokeStyleIdAsync === "function") {
                  await node.setStrokeStyleIdAsync(styleOrVar.id);
                } else {
                  node.strokeStyleId = styleOrVar.id;
                }
                updatedThisNode = true;
                summary.colorUpdated++;
              }
            }
          }
        }
      }

      if (updatedThisNode) {
        summary.totalUpdated++;
      } else {
        summary.totalSkipped++;
        if (summary.skippedDetails.length < 100) {
          let fontInfo = "";
          if (node.type === "TEXT") {
            if (node.fontName && node.fontName !== figma.mixed) {
              fontInfo = `${node.fontName.family} ${node.fontName.style} (${node.fontSize}px)`;
            } else if (node.hasMissingFont) {
              fontInfo = "Missing Font(s)";
            } else {
              fontInfo = "Mixed Text";
            }
          }
          summary.skippedDetails.push({
            id: node.id,
            layer: node.name,
            type: node.type,
            reason: node.hasMissingFont ? "Missing Font" : "No style change needed",
            fontInfo,
          });
        }
      }

    } catch (err) {
      summary.totalSkipped++;
      summary.errors.push(`Failed on "${node.name}": ${err?.message || err}`);
      if (summary.skippedDetails.length < 100) {
        summary.skippedDetails.push({
          id: node.id,
          layer: node.name,
          type: node.type,
          reason: `Error: ${err?.message || err}`,
          fontInfo: "",
        });
      }
    }
  }

  // If a specific variable mode was selected, set explicit variable mode on selection root and container nodes
  if (options.variableMode && options.variableMode !== "AUTO") {
    try {
      const localVars = await getLocalColorVariablesSafe();
      const collections = await getAllVariableCollectionsSafe(localVars);
      const collectionMap = new Map();
      for (const c of collections) {
        if (c && c.id) collectionMap.set(c.id, c);
      }

      const parsedMode = parseSelectedMode(options.variableMode, collectionMap);
      if (parsedMode && !parsedMode.isAuto) {
        const targetModesToApply = [];
        if (parsedMode.colId && parsedMode.modeId) {
          targetModesToApply.push({ colId: parsedMode.colId, modeId: parsedMode.modeId });
        }
        if (parsedMode.modeName) {
          for (const [cId, col] of collectionMap.entries()) {
            if (col && col.modes && cId !== parsedMode.colId) {
              const match = col.modes.find((m) => m.name && m.name.toLowerCase() === parsedMode.modeName.toLowerCase());
              if (match) {
                targetModesToApply.push({ colId: cId, modeId: match.modeId || match.id });
              }
            }
          }
        }

        if (targetModesToApply.length > 0) {
          for (const selNode of selection) {
            if (selNode && typeof selNode.setExplicitVariableMode === "function") {
              for (const tm of targetModesToApply) {
                try {
                  selNode.setExplicitVariableMode(tm.colId, tm.modeId);
                } catch (_) { }
              }
            }
          }
          for (const n of nodes) {
            if (n && typeof n.setExplicitVariableMode === "function") {
              for (const tm of targetModesToApply) {
                try {
                  n.setExplicitVariableMode(tm.colId, tm.modeId);
                } catch (_) { }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[applyClosestStylesToSelection] Error setting explicit variable mode:", e);
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
        ignoreShapes: saved.ignoreShapes === true,
        variableMode: saved.variableMode || "AUTO",
      };
    }
  } catch (_) { }
  return { ignoreInstances: true, ignoreShapes: false, variableMode: "AUTO" };
}

async function saveUserSettings(settings) {
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch (_) { }
}

// ==========================================
// 8. PLUGIN LIFECYCLE & MESSAGE DISPATCH
// ==========================================
figma.showUI(__html__, { width: 360, height: 580, themeColors: true });

async function broadcastDiscoveredStyles(forceRefresh = false) {
  const localVars = await getLocalColorVariablesSafe();
  const [textStyles, colorStyles, colorVars, collections] = await Promise.all([
    discoverAllStyles(forceRefresh),
    discoverAllPaintStyles(forceRefresh),
    discoverAllColorVariables(forceRefresh),
    getAllVariableCollectionsSafe(localVars),
  ]);

  const allItems = [...textStyles, ...colorStyles, ...colorVars];
  const uniqueFolderPaths = new Set();
  const varFolderPaths = new Set();
  const varFoldersByColId = new Map();

  for (const item of allItems) {
    if (item.hasFolders && item.folderPath) {
      uniqueFolderPaths.add(item.folderPath);
    }
  }

  for (const v of colorVars) {
    if (v.hasFolders && v.folderPath) {
      varFolderPaths.add(v.folderPath);
      const colId = v.collectionId || "default";
      if (!varFoldersByColId.has(colId)) {
        varFoldersByColId.set(colId, new Set());
      }
      varFoldersByColId.get(colId).add(v.folderPath);
    }
  }

  const availableModes = [];
  const uniqueNamesSet = new Set();
  const structuredCollections = [];

  for (const col of collections) {
    if (col) {
      const colModes = [];
      if (col.modes && col.modes.length > 0) {
        for (const m of col.modes) {
          availableModes.push({
            id: m.modeId,
            name: m.name,
            collectionName: col.name,
            collectionId: col.id,
          });
          colModes.push({
            id: m.modeId,
            name: m.name,
          });
          uniqueNamesSet.add(m.name);
        }
      }
      const colFolders = Array.from(varFoldersByColId.get(col.id) || []);
      structuredCollections.push({
        id: col.id,
        name: col.name,
        defaultModeId: col.defaultModeId,
        modes: colModes,
        folders: colFolders,
      });
    }
  }

  figma.ui.postMessage({
    type: "styles-detected",
    textCount: textStyles.length,
    colorCount: colorStyles.length + colorVars.length,
    folderCount: uniqueFolderPaths.size,
    variableFolderCount: varFolderPaths.size,
    variableFolders: Array.from(varFolderPaths),
    modes: availableModes,
    collections: structuredCollections,
    uniqueModeNames: Array.from(uniqueNamesSet),
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
    cachedDiscoveredPaintStyles = null;
    cachedDiscoveredColorVariables = null;
    globalStyleCache.clear();
    await broadcastDiscoveredStyles(true);
    figma.notify("🔄 Rescanned local styles & variable modes.");
  }

  if (msg.type === "select-node" && msg.nodeId) {
    try {
      const node =
        typeof figma.getNodeByIdAsync === "function"
          ? await figma.getNodeByIdAsync(msg.nodeId)
          : figma.getNodeById(msg.nodeId);

      if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        figma.notify(`🔍 Selected "${node.name}" on canvas`);
      } else {
        figma.notify("⚠️ Layer not found or was removed.");
      }
    } catch (e) {
      figma.notify(`⚠️ Could not select layer: ${e.message || e}`);
    }
  }

  if (msg.type === "select-all-skipped" && Array.isArray(msg.nodeIds)) {
    try {
      const targetNodes = [];
      for (const id of msg.nodeIds) {
        const n =
          typeof figma.getNodeByIdAsync === "function"
            ? await figma.getNodeByIdAsync(id).catch(() => null)
            : figma.getNodeById(id);
        if (n && n.type !== "DOCUMENT" && n.type !== "PAGE") {
          targetNodes.push(n);
        }
      }
      if (targetNodes.length > 0) {
        figma.currentPage.selection = targetNodes;
        figma.viewport.scrollAndZoomIntoView(targetNodes);
        figma.notify(`🔍 Selected ${targetNodes.length} skipped layer(s) on canvas`);
      } else {
        figma.notify("⚠️ No skipped layers could be found on canvas.");
      }
    } catch (e) {
      figma.notify(`⚠️ Could not select layers: ${e.message || e}`);
    }
  }

  if (msg.type === "run-replace-styles") {
    const options = {
      ignoreInstances: msg.options?.ignoreInstances !== false,
      ignoreShapes: msg.options?.ignoreShapes === true,
      variableMode: msg.options?.variableMode || "AUTO",
    };

    await saveUserSettings(options);

    figma.ui.postMessage({ type: "process-start" });
    const summary = await applyClosestStylesToSelection(options);

    if (summary.totalUpdated > 0) {
      const parts = [];
      if (summary.textUpdated > 0) parts.push(`${summary.textUpdated} text`);
      if (summary.colorUpdated > 0) parts.push(`${summary.colorUpdated} color`);
      const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      figma.notify(`⚡ Updated ${summary.totalUpdated} layer(s)${details} with local styles!`);
    } else if (summary.errors.length > 0) {
      figma.notify("⚠️ Process finished with warnings. Check plugin window for logs.");
    } else {
      figma.notify("ℹ️ No layers needed updates.");
    }

    figma.ui.postMessage({ type: "process-complete", summary });
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};