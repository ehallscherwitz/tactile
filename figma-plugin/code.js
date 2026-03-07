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

function colorForScheme(colorScheme) {
  const normalized = (colorScheme || "light").toLowerCase();
  if (normalized === "dark") return rgb(32, 36, 44);
  if (normalized === "blue") return rgb(44, 128, 255);
  if (normalized === "green") return rgb(43, 176, 114);
  if (normalized === "purple") return rgb(145, 86, 255);
  return rgb(243, 244, 246);
}

function textColorForScheme(colorScheme) {
  const normalized = (colorScheme || "light").toLowerCase();
  if (normalized === "light") return rgb(20, 20, 20);
  return rgb(255, 255, 255);
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

function publishPageSnapshotToUi() {
  const context = getCurrentContext();
  figma.ui.postMessage({
    type: "plugin-page-snapshot",
    projectId: context.projectId,
    fileKey: context.fileKey,
    pageId: context.pageId,
    nodeId: context.nodeId,
    capturedAt: new Date().toISOString(),
    pageJson: figma.currentPage.toJSON()
  });
}

async function ensureCardNode(projectId, cardId) {
  const key = nodeMapKey(projectId, cardId);
  const existingNodeId = nodeMap[key];
  if (existingNodeId) {
    const existing = figma.getNodeById(existingNodeId);
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

  const frame = figma.createFrame();
  frame.name = `HACKAI Card ${cardId}`;
  frame.resize(320, 200);
  frame.cornerRadius = 20;
  frame.fills = [{ type: "SOLID", color: colorForScheme("light") }];
  frame.effects = [
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
  frame.paddingLeft = 16;
  frame.paddingRight = 16;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;

  const label = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  label.characters = "HACKAI Live Card";
  label.fontSize = 24;
  label.fills = [{ type: "SOLID", color: textColorForScheme("light") }];
  frame.appendChild(label);

  const viewportCenter = figma.viewport.center;
  frame.x = viewportCenter.x - frame.width / 2;
  frame.y = viewportCenter.y - frame.height / 2;
  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  nodeMap[key] = frame.id;
  await persistNodeMap();
  return frame;
}

function applyColorScheme(node, colorScheme) {
  const fill = { type: "SOLID", color: colorForScheme(colorScheme) };
  if ("fills" in node) {
    node.fills = [fill];
  }
  if ("children" in node) {
    for (const child of node.children) {
      if (child.type === "TEXT") {
        child.fills = [{ type: "SOLID", color: textColorForScheme(colorScheme) }];
      }
    }
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
        type: "LAYER_BLUR",
        visible: true,
        radius: 6
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

async function applyPatch(patch) {
  const node = await ensureCardNode(activeProjectId, patch.card_id);
  let targetWidth = null;
  let targetHeight = null;
  let colorScheme = null;
  let liquidGlass = null;

  for (const op of patch.operations || []) {
    if (op.path === "/width") targetWidth = Number(op.value);
    if (op.path === "/height") targetHeight = Number(op.value);
    if (op.path === "/color_scheme") colorScheme = String(op.value);
    if (op.path === "/liquid_glass") liquidGlass = Boolean(op.value);
  }

  if (targetWidth != null || targetHeight != null) {
    const width = clamp(targetWidth ?? node.width, 120, 1200);
    const height = clamp(targetHeight ?? node.height, 120, 1200);
    if ("resize" in node) {
      node.resize(width, height);
    }
  }
  if (colorScheme) {
    applyColorScheme(node, colorScheme);
  }
  if (liquidGlass != null) {
    applyLiquidGlass(node, liquidGlass);
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
