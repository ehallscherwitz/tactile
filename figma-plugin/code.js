figma.showUI(__html__, { width: 380, height: 560, themeColors: true });

const NODE_MAP_STORAGE_KEY = "hackai-node-map";
let nodeMap = {};
let activeProjectId = "default";

async function loadNodeMap() {
  nodeMap = (await figma.clientStorage.getAsync(NODE_MAP_STORAGE_KEY)) || {};
}

async function persistNodeMap() {
  await figma.clientStorage.setAsync(NODE_MAP_STORAGE_KEY, nodeMap);
}

function nodeMapKey(projectId, cardId) {
  return `${projectId}::${cardId}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rgb(r, g, b) {
  return { r: r / 255, g: g / 255, b: b / 255 };
}

var THEMES = {
  warm:   { cardBg: rgb(36, 18, 8),   border: rgb(139, 58, 26),  accent: rgb(232, 135, 58), text: rgb(242, 223, 192) },
  cool:   { cardBg: rgb(13, 20, 36),  border: rgb(30, 58, 95),   accent: rgb(74, 156, 200), text: rgb(200, 223, 239) },
  dark:   { cardBg: rgb(10, 10, 10),  border: rgb(45, 27, 78),   accent: rgb(123, 47, 190), text: rgb(232, 232, 232) },
  bright: { cardBg: rgb(255, 255, 255), border: rgb(255, 107, 43), accent: rgb(255, 107, 43), text: rgb(15, 15, 15) },
  soft:   { cardBg: rgb(250, 245, 255), border: rgb(201, 168, 224), accent: rgb(181, 123, 220), text: rgb(61, 33, 82) },
  moon:   { cardBg: rgb(13, 17, 23),   border: rgb(56, 68, 89),   accent: rgb(136, 176, 225), text: rgb(201, 215, 230) }
};

function colorForScheme(colorScheme) {
  var t = THEMES[(colorScheme || "dark").toLowerCase()];
  return t ? t.cardBg : THEMES.dark.cardBg;
}

function borderForScheme(colorScheme) {
  var t = THEMES[(colorScheme || "dark").toLowerCase()];
  return t ? t.border : THEMES.dark.border;
}

function textColorForScheme(colorScheme) {
  var t = THEMES[(colorScheme || "dark").toLowerCase()];
  return t ? t.text : THEMES.dark.text;
}

function accentForScheme(colorScheme) {
  var t = THEMES[(colorScheme || "dark").toLowerCase()];
  return t ? t.accent : THEMES.dark.accent;
}

function colorLuma(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function contrastTextForColor(c) {
  return colorLuma(c) > 0.55 ? rgb(15, 15, 15) : rgb(250, 250, 250);
}

function getCurrentContext() {
  const selected = figma.currentPage.selection[0] || null;
  return {
    type: "plugin-context",
    projectId: activeProjectId,
    fileKey: figma.fileKey || null,
    pageId: figma.currentPage.id,
    nodeId: selected ? selected.id : null
  };
}

function publishContextToUi() {
  figma.ui.postMessage(getCurrentContext());
}

function safeProp(node, key) {
  try {
    var val = node[key];
    if (typeof val === "symbol") return undefined;
    return val;
  } catch (e) {
    return undefined;
  }
}

function safeClone(val) {
  if (val === undefined || val === null || typeof val === "symbol") return undefined;
  try { return JSON.parse(JSON.stringify(val)); } catch (e) { return undefined; }
}

function nodeToJson(node, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 10) return { id: node.id, name: node.name, type: node.type };
  var obj = {
    id: node.id,
    name: node.name,
    type: node.type
  };
  var num = function (k) { var v = safeProp(node, k); if (typeof v === "number") obj[k] = v; };
  var bool = function (k) { var v = safeProp(node, k); if (typeof v === "boolean") obj[k] = v; };
  var str = function (k) { var v = safeProp(node, k); if (typeof v === "string") obj[k] = v; };
  var clone = function (k) { var v = safeClone(safeProp(node, k)); if (v !== undefined) obj[k] = v; };

  num("width"); num("height"); num("x"); num("y");
  num("cornerRadius"); num("opacity"); num("fontSize");
  num("strokeWeight");
  bool("visible");
  str("characters");
  clone("fills"); clone("strokes"); clone("effects"); clone("fontName");

  if ("children" in node && node.children) {
    obj.children = [];
    for (var i = 0; i < node.children.length; i++) {
      obj.children.push(nodeToJson(node.children[i], depth + 1));
    }
  }
  return obj;
}

function publishPageSnapshotToUi() {
  var context = getCurrentContext();
  var pageJson = nodeToJson(figma.currentPage, 0);
  figma.ui.postMessage({
    type: "plugin-page-snapshot",
    projectId: context.projectId,
    fileKey: context.fileKey,
    pageId: context.pageId,
    nodeId: context.nodeId,
    capturedAt: new Date().toISOString(),
    pageJson: pageJson
  });
}

async function ensureCardNode(projectId, cardId) {
  const key = nodeMapKey(projectId, cardId);
  const existingNodeId = nodeMap[key];
  if (existingNodeId) {
    const existing = await figma.getNodeByIdAsync(existingNodeId);
    if (existing && "resize" in existing) {
      return existing;
    }
  }

  const selected = figma.currentPage.selection[0];
  if (selected && "resize" in selected) {
    nodeMap[key] = selected.id;
    await persistNodeMap();
    return selected;
  }

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  var frame = figma.createFrame();
  frame.name = "HACKAI Card " + cardId;
  frame.resize(320, 200);
  frame.cornerRadius = 20;
  frame.fills = [{ type: "SOLID", color: colorForScheme("dark") }];
  frame.strokes = [{ type: "SOLID", color: borderForScheme("dark") }];
  frame.strokeWeight = 1.5;
  frame.effects = [
    {
      type: "DROP_SHADOW",
      visible: true,
      blendMode: "NORMAL",
      color: { r: 0, g: 0, b: 0, a: 0.18 },
      offset: { x: 0, y: 8 },
      radius: 20,
      spread: 0
    }
  ];
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "MIN";
  frame.itemSpacing = 10;
  frame.paddingLeft = 24;
  frame.paddingRight = 24;
  frame.paddingTop = 24;
  frame.paddingBottom = 24;

  var eyebrowNode = figma.createText();
  eyebrowNode.name = "eyebrow";
  eyebrowNode.fontName = { family: "Inter", style: "Regular" };
  eyebrowNode.characters = "Design System";
  eyebrowNode.fontSize = 12;
  eyebrowNode.letterSpacing = { value: 8, unit: "PERCENT" };
  eyebrowNode.textCase = "UPPER";
  eyebrowNode.fills = [{ type: "SOLID", color: textColorForScheme("dark") }];
  eyebrowNode.opacity = 0.68;
  eyebrowNode.textAutoResize = "HEIGHT";
  eyebrowNode.resize(272, eyebrowNode.height);
  frame.appendChild(eyebrowNode);

  var titleNode = figma.createText();
  titleNode.name = "title";
  titleNode.fontName = { family: "Inter", style: "Regular" };
  titleNode.characters = "Give your design soul";
  titleNode.fontSize = 42;
  titleNode.lineHeight = { value: 108, unit: "PERCENT" };
  titleNode.fills = [{ type: "SOLID", color: textColorForScheme("dark") }];
  titleNode.textAutoResize = "HEIGHT";
  titleNode.resize(272, titleNode.height);
  frame.appendChild(titleNode);

  var subtitleNode = figma.createText();
  subtitleNode.name = "subtitle";
  subtitleNode.fontName = { family: "Inter", style: "Regular" };
  subtitleNode.characters = "Transform your ideas into meaningful products through natural gesture-driven iteration.";
  subtitleNode.fontSize = 16;
  subtitleNode.lineHeight = { value: 145, unit: "PERCENT" };
  subtitleNode.fills = [{ type: "SOLID", color: textColorForScheme("dark") }];
  subtitleNode.opacity = 0.84;
  subtitleNode.textAutoResize = "HEIGHT";
  subtitleNode.resize(272, subtitleNode.height);
  frame.appendChild(subtitleNode);

  var ctaFrame = figma.createFrame();
  ctaFrame.name = "cta_button";
  ctaFrame.layoutMode = "HORIZONTAL";
  ctaFrame.primaryAxisSizingMode = "AUTO";
  ctaFrame.counterAxisSizingMode = "AUTO";
  ctaFrame.primaryAxisAlignItems = "CENTER";
  ctaFrame.counterAxisAlignItems = "CENTER";
  ctaFrame.paddingLeft = 14;
  ctaFrame.paddingRight = 14;
  ctaFrame.paddingTop = 10;
  ctaFrame.paddingBottom = 10;
  ctaFrame.cornerRadius = 999;
  ctaFrame.fills = [{ type: "SOLID", color: accentForScheme("dark") }];
  ctaFrame.strokes = [];

  var ctaTextNode = figma.createText();
  ctaTextNode.name = "cta_text";
  ctaTextNode.fontName = { family: "Inter", style: "Regular" };
  ctaTextNode.characters = "Start Building with Tactile";
  ctaTextNode.fontSize = 14;
  ctaTextNode.lineHeight = { value: 120, unit: "PERCENT" };
  ctaTextNode.fills = [{ type: "SOLID", color: contrastTextForColor(accentForScheme("dark")) }];
  ctaTextNode.textAutoResize = "WIDTH_AND_HEIGHT";
  ctaFrame.appendChild(ctaTextNode);
  frame.appendChild(ctaFrame);

  var metaNode = figma.createText();
  metaNode.name = "meta";
  metaNode.fontName = { family: "Inter", style: "Regular" };
  metaNode.characters = "Design meets impact";
  metaNode.fontSize = 12;
  metaNode.lineHeight = { value: 130, unit: "PERCENT" };
  metaNode.opacity = 0.72;
  metaNode.fills = [{ type: "SOLID", color: textColorForScheme("dark") }];
  metaNode.textAutoResize = "HEIGHT";
  metaNode.resize(272, metaNode.height);
  frame.appendChild(metaNode);

  var maxX = -Infinity;
  for (var i = 0; i < figma.currentPage.children.length; i++) {
    var child = figma.currentPage.children[i];
    var right = child.x + child.width;
    if (right > maxX) maxX = right;
  }
  if (maxX === -Infinity) {
    frame.x = 0;
    frame.y = 0;
  } else {
    frame.x = maxX + 80;
    frame.y = 0;
  }
  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  nodeMap[key] = frame.id;
  await persistNodeMap();
  return frame;
}

function applyColorScheme(node, colorScheme) {
  if ("fills" in node) {
    node.fills = [{ type: "SOLID", color: colorForScheme(colorScheme) }];
  }
  if ("strokes" in node) {
    node.strokes = [{ type: "SOLID", color: borderForScheme(colorScheme) }];
  }
}

function applyLiquidGlass(node, enabled) {
  if (!("effects" in node)) return;
  if (enabled) {
    node.effects = [
      {
        type: "DROP_SHADOW",
        visible: true,
        blendMode: "NORMAL",
        color: { r: 0, g: 0, b: 0, a: 0.18 },
        offset: { x: 0, y: 14 },
        radius: 28,
        spread: 0
      },
      {
        type: "BACKGROUND_BLUR",
        visible: true,
        radius: 12
      }
    ];
  } else {
    node.effects = [
      {
        type: "DROP_SHADOW",
        visible: true,
        blendMode: "NORMAL",
        color: { r: 0, g: 0, b: 0, a: 0.12 },
        offset: { x: 0, y: 14 },
        radius: 24,
        spread: 0
      }
    ];
  }
}

function findChildByName(node, name) {
  if (!("children" in node)) return null;
  for (var i = 0; i < node.children.length; i++) {
    if (node.children[i].name === name) return node.children[i];
  }
  return null;
}

async function ensureRichCardChildren(node, colorScheme) {
  if (!("children" in node)) return;
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  var scheme = colorScheme || "dark";
  var textColor = textColorForScheme(scheme);
  var accentColor = accentForScheme(scheme);

  var eyebrowNode = findChildByName(node, "eyebrow");
  if (!eyebrowNode) {
    eyebrowNode = figma.createText();
    eyebrowNode.name = "eyebrow";
    eyebrowNode.fontName = { family: "Inter", style: "Regular" };
    eyebrowNode.characters = "Design System";
    eyebrowNode.fontSize = 12;
    eyebrowNode.textCase = "UPPER";
    eyebrowNode.letterSpacing = { value: 8, unit: "PERCENT" };
    eyebrowNode.opacity = 0.68;
    eyebrowNode.fills = [{ type: "SOLID", color: textColor }];
    eyebrowNode.textAutoResize = "HEIGHT";
    eyebrowNode.resize(Math.max(100, node.width - 48), eyebrowNode.height);
    node.appendChild(eyebrowNode);
  }

  var ctaFrame = findChildByName(node, "cta_button");
  if (!ctaFrame) {
    ctaFrame = figma.createFrame();
    ctaFrame.name = "cta_button";
    ctaFrame.layoutMode = "HORIZONTAL";
    ctaFrame.primaryAxisSizingMode = "AUTO";
    ctaFrame.counterAxisSizingMode = "AUTO";
    ctaFrame.primaryAxisAlignItems = "CENTER";
    ctaFrame.counterAxisAlignItems = "CENTER";
    ctaFrame.paddingLeft = 14;
    ctaFrame.paddingRight = 14;
    ctaFrame.paddingTop = 10;
    ctaFrame.paddingBottom = 10;
    ctaFrame.cornerRadius = 999;
    ctaFrame.fills = [{ type: "SOLID", color: accentColor }];
    ctaFrame.strokes = [];
    node.appendChild(ctaFrame);
  }

  var ctaTextNode = findChildByName(ctaFrame, "cta_text");
  if (!ctaTextNode) {
    ctaTextNode = figma.createText();
    ctaTextNode.name = "cta_text";
    ctaTextNode.fontName = { family: "Inter", style: "Regular" };
    ctaTextNode.characters = "Start Building with Tactile";
    ctaTextNode.fontSize = 14;
    ctaTextNode.fills = [{ type: "SOLID", color: contrastTextForColor(accentColor) }];
    ctaTextNode.textAutoResize = "WIDTH_AND_HEIGHT";
    ctaFrame.appendChild(ctaTextNode);
  }

  var metaNode = findChildByName(node, "meta");
  if (!metaNode) {
    metaNode = figma.createText();
    metaNode.name = "meta";
    metaNode.fontName = { family: "Inter", style: "Regular" };
    metaNode.characters = "Design meets impact";
    metaNode.fontSize = 12;
    metaNode.opacity = 0.72;
    metaNode.fills = [{ type: "SOLID", color: textColor }];
    metaNode.textAutoResize = "HEIGHT";
    metaNode.resize(Math.max(100, node.width - 48), metaNode.height);
    node.appendChild(metaNode);
  }

  var order = ["eyebrow", "title", "subtitle", "cta_button", "meta"];
  var insertAt = 0;
  for (var j = 0; j < order.length; j++) {
    var child = findChildByName(node, order[j]);
    if (child) {
      node.insertChild(insertAt, child);
      insertAt += 1;
    }
  }
}

async function applyPatch(patch) {
  var node = await ensureCardNode(activeProjectId, patch.card_id);
  var targetWidth = null;
  var targetHeight = null;
  var colorScheme = null;
  var liquidGlass = null;
  var title = null;
  var subtitle = null;
  var fontFamily = null;
  var fontSize = null;
  var cornerRadius = null;
  var fillRgb = null;
  var textRgb = null;
  var accentRgb = null;
  var frameName = null;
  var eyebrow = null;
  var ctaText = null;
  var metaText = null;

  for (var i = 0; i < (patch.operations || []).length; i++) {
    var op = patch.operations[i];
    if (op.path === "/width") targetWidth = Number(op.value);
    if (op.path === "/height") targetHeight = Number(op.value);
    if (op.path === "/color_scheme") colorScheme = String(op.value);
    if (op.path === "/liquid_glass") liquidGlass = Boolean(op.value);
    if (op.path === "/title") title = String(op.value);
    if (op.path === "/subtitle") subtitle = String(op.value);
    if (op.path === "/font_family") fontFamily = String(op.value);
    if (op.path === "/font_size") fontSize = Number(op.value);
    if (op.path === "/corner_radius") cornerRadius = Number(op.value);
    if (op.path === "/fill_rgb") fillRgb = op.value;
    if (op.path === "/text_rgb") textRgb = op.value;
    if (op.path === "/accent_rgb") accentRgb = op.value;
    if (op.path === "/name") frameName = String(op.value);
    if (op.path === "/eyebrow") eyebrow = String(op.value);
    if (op.path === "/cta_text") ctaText = String(op.value);
    if (op.path === "/meta_text") metaText = String(op.value);
  }

  await ensureRichCardChildren(node, colorScheme);

  if (targetWidth != null) {
    var width = clamp(targetWidth, 120, 1200);
    if ("resize" in node) {
      node.resize(width, node.height);
    }
  }

  if (cornerRadius != null) {
    node.cornerRadius = clamp(cornerRadius, 0, 128);
  }

  if (fillRgb && typeof fillRgb === "object") {
    var color = rgb(
      clamp(fillRgb.r || 0, 0, 255),
      clamp(fillRgb.g || 0, 0, 255),
      clamp(fillRgb.b || 0, 0, 255)
    );
    if ("fills" in node) {
      node.fills = [{ type: "SOLID", color: color }];
    }
  } else if (colorScheme) {
    applyColorScheme(node, colorScheme);
    var tn = findChildByName(node, "title");
    if (tn && tn.type === "TEXT") {
      tn.fills = [{ type: "SOLID", color: textColorForScheme(colorScheme) }];
    }
    var sn = findChildByName(node, "subtitle");
    if (sn && sn.type === "TEXT") {
      sn.fills = [{ type: "SOLID", color: textColorForScheme(colorScheme) }];
    }
  }

  if (textRgb && typeof textRgb === "object") {
    var txtColor = rgb(
      clamp(textRgb.r || 0, 0, 255),
      clamp(textRgb.g || 0, 0, 255),
      clamp(textRgb.b || 0, 0, 255)
    );
    var titleChild = findChildByName(node, "title");
    if (titleChild && titleChild.type === "TEXT") {
      titleChild.fills = [{ type: "SOLID", color: txtColor }];
    }
    var subtitleChild = findChildByName(node, "subtitle");
    if (subtitleChild && subtitleChild.type === "TEXT") {
      subtitleChild.fills = [{ type: "SOLID", color: txtColor }];
    }
    var eyebrowChild = findChildByName(node, "eyebrow");
    if (eyebrowChild && eyebrowChild.type === "TEXT") {
      eyebrowChild.fills = [{ type: "SOLID", color: txtColor }];
    }
    var metaChild = findChildByName(node, "meta");
    if (metaChild && metaChild.type === "TEXT") {
      metaChild.fills = [{ type: "SOLID", color: txtColor }];
    }
  }

  if (accentRgb && typeof accentRgb === "object") {
    var accentColor = rgb(
      clamp(accentRgb.r || 0, 0, 255),
      clamp(accentRgb.g || 0, 0, 255),
      clamp(accentRgb.b || 0, 0, 255)
    );
    var cta = findChildByName(node, "cta_button");
    if (cta && cta.type === "FRAME") {
      cta.fills = [{ type: "SOLID", color: accentColor }];
      var ctaLabel = findChildByName(cta, "cta_text");
      if (ctaLabel && ctaLabel.type === "TEXT") {
        ctaLabel.fills = [{ type: "SOLID", color: contrastTextForColor(accentColor) }];
      }
    }
  } else if (colorScheme) {
    var ctaByScheme = findChildByName(node, "cta_button");
    if (ctaByScheme && ctaByScheme.type === "FRAME") {
      var schemeAccent = accentForScheme(colorScheme);
      ctaByScheme.fills = [{ type: "SOLID", color: schemeAccent }];
      var ctaLabelByScheme = findChildByName(ctaByScheme, "cta_text");
      if (ctaLabelByScheme && ctaLabelByScheme.type === "TEXT") {
        ctaLabelByScheme.fills = [{ type: "SOLID", color: contrastTextForColor(schemeAccent) }];
      }
    }
  }

  if (frameName && "name" in node) {
    node.name = frameName;
  }

  if (liquidGlass != null) {
    applyLiquidGlass(node, liquidGlass);
  }

  if (
    title != null || subtitle != null || fontFamily != null || fontSize != null ||
    eyebrow != null || ctaText != null || metaText != null
  ) {
    var font = fontFamily || "Inter";
    try {
      await figma.loadFontAsync({ family: font, style: "Regular" });
    } catch (e) {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      font = "Inter";
    }

    var titleFontSize = fontSize ? clamp(fontSize, 8, 96) : null;
    var subtitleFontSize = titleFontSize ? Math.max(8, Math.round(titleFontSize * 0.58)) : null;

    var textWidth = Math.max(100, node.width - 48);

    var titleNode = findChildByName(node, "title");
    var eyebrowNode = findChildByName(node, "eyebrow");
    if (titleNode && titleNode.type === "TEXT") {
      titleNode.fontName = { family: font, style: "Regular" };
      if (titleFontSize) titleNode.fontSize = titleFontSize;
      if (title != null) titleNode.characters = title;
      titleNode.textAutoResize = "HEIGHT";
      titleNode.resize(textWidth, titleNode.height);
    }
    if (eyebrowNode && eyebrowNode.type === "TEXT") {
      eyebrowNode.fontName = { family: font, style: "Regular" };
      if (eyebrow != null) eyebrowNode.characters = eyebrow;
      eyebrowNode.textAutoResize = "HEIGHT";
      eyebrowNode.resize(textWidth, eyebrowNode.height);
    }
    var subtitleNode = findChildByName(node, "subtitle");
    if (subtitleNode && subtitleNode.type === "TEXT") {
      subtitleNode.fontName = { family: font, style: "Regular" };
      if (subtitleFontSize) subtitleNode.fontSize = subtitleFontSize;
      if (subtitle != null) subtitleNode.characters = subtitle || " ";
      subtitleNode.textAutoResize = "HEIGHT";
      subtitleNode.resize(textWidth, subtitleNode.height);
    }

    var ctaNode = findChildByName(node, "cta_button");
    if (ctaNode && ctaNode.type === "FRAME") {
      var ctaLabelNode = findChildByName(ctaNode, "cta_text");
      if (ctaLabelNode && ctaLabelNode.type === "TEXT") {
        ctaLabelNode.fontName = { family: font, style: "Regular" };
        if (ctaText != null) ctaLabelNode.characters = ctaText || "Start Building";
      }
    }

    var metaNode = findChildByName(node, "meta");
    if (metaNode && metaNode.type === "TEXT") {
      metaNode.fontName = { family: font, style: "Regular" };
      if (metaText != null) metaNode.characters = metaText;
      metaNode.textAutoResize = "HEIGHT";
      metaNode.resize(textWidth, metaNode.height);
    }
  }

  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

figma.ui.onmessage = async (message) => {
  if (message.type === "set-project") {
    activeProjectId = String(message.projectId || "default");
    figma.notify(`Connected project: ${activeProjectId}`);
    publishContextToUi();
    return;
  }

  if (message.type === "request-context") {
    publishContextToUi();
    return;
  }

  if (message.type === "request-page-snapshot") {
    try {
      publishPageSnapshotToUi();
    } catch (error) {
      figma.ui.postMessage({
        type: "plugin-page-snapshot-error",
        error: error instanceof Error ? error.message : "Failed to serialize current page"
      });
    }
    return;
  }

  if (message.type === "apply-patch") {
    const { patch } = message;
    try {
      await applyPatch(patch);
      figma.ui.postMessage({
        type: "apply-result",
        patchId: patch.patch_id,
        status: "applied"
      });
      figma.notify(`Applied patch ${patch.patch_id.slice(0, 8)}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown patch error";
      figma.ui.postMessage({
        type: "apply-result",
        patchId: patch.patch_id,
        status: "failed",
        error: errorMessage
      });
      figma.notify(`Patch failed: ${errorMessage}`);
    }
  }
};

loadNodeMap();
figma.on("selectionchange", publishContextToUi);
figma.on("currentpagechange", publishContextToUi);
