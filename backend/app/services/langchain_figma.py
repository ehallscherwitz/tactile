"""LangChain service that reads Figma page snapshots from MongoDB,
analyzes project style/content, and generates high-quality card/frame
outputs for plugin patches and frontend HTML rendering."""

from __future__ import annotations

import json
import uuid
from html import escape
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.services.style_extractor import extract_card_spec_from_page_snapshot

ADAPT_SYSTEM_PROMPT = """\
You are a senior product designer AI that creates high-quality frame cards
that feel production-ready and match an existing project's visual identity.

You will receive:
1. A summary of every node on the current Figma page (types, names, sizes).
2. An extracted style analysis (dominant colors, fonts, corner radii).

Your job: produce a single **CardPatch** JSON that creates a card/frame which
looks native to this project (not a placeholder/generic component).

### CardPatch format
```json
{
  "patch_id": "<provided>",
  "project_id": "<provided>",
  "card_id": "<provided>",
  "source_event_id": "<provided>",
  "from_version": 1,
  "to_version": 2,
  "operations": [
    {"op": "replace", "path": "/name",          "value": "Adaptive Card"},
    {"op": "replace", "path": "/eyebrow",       "value": "Design System"},
    {"op": "replace", "path": "/width",          "value": 400},
    {"op": "replace", "path": "/height",         "value": 300},
    {"op": "replace", "path": "/fill_rgb",       "value": {"r": 243, "g": 244, "b": 246}},
    {"op": "replace", "path": "/text_rgb",       "value": {"r": 20, "g": 20, "b": 20}},
    {"op": "replace", "path": "/accent_rgb",     "value": {"r": 102, "g": 179, "b": 255}},
    {"op": "replace", "path": "/corner_radius",  "value": 20},
    {"op": "replace", "path": "/font_family",    "value": "Inter"},
    {"op": "replace", "path": "/font_size",      "value": 24},
    {"op": "replace", "path": "/title",           "value": "Card Title"},
    {"op": "replace", "path": "/subtitle",        "value": "A short description"},
    {"op": "replace", "path": "/cta_text",        "value": "Start Building with Tactile"},
    {"op": "replace", "path": "/meta_text",       "value": "Design meets impact"},
    {"op": "replace", "path": "/color_scheme",   "value": "dark"},
    {"op": "replace", "path": "/liquid_glass",   "value": false}
  ]
}
```

Valid paths and value types:
- /name          – string, a descriptive frame name
- /eyebrow       – string, short overline/label above title
- /width         – int 120-1200
- /height        – int 120-1200
- /fill_rgb      – {r,g,b} each 0-255 (background color, overrides color_scheme)
- /text_rgb      – {r,g,b} each 0-255 (label text color)
- /accent_rgb    – {r,g,b} each 0-255 (CTA/button accent color)
- /corner_radius – int 0-128
- /font_family   – string (use exact family name from the project)
- /font_size     – int 8-96
- /title         – string, title text shown in the frame
- /subtitle      – string, subtitle text shown below the title
- /cta_text      – string, CTA button label
- /meta_text     – string, supporting micro-copy row
- /color_scheme  – "warm"|"cool"|"dark"|"bright"|"soft"|"moon"
- /liquid_glass  – boolean

Quality rules:
- Do NOT return generic labels like "Article Card", "Card Title", or boilerplate filler.
- Derive title/subtitle language from meaningful text in the provided page context.
- Preserve hierarchy: title should be strong and short; subtitle should support the title.
- Match typography and color intent from context, including contrast and readability.
- Choose dimensions that feel deliberate for a hero/value card, not a tiny placeholder.
- If context is sparse, use tasteful product-marketing tone consistent with "Tactile".
- Always include ALL operation paths so frame is fully defined.
- Respond with ONLY the raw JSON, no markdown fences or explanation.
"""

RECONCILE_SYSTEM_PROMPT = """\
You are a Figma design assistant that maps a manipulated frame state back into
the original design language and returns a CardPatch JSON.

You will receive:
1. A summary of the original Figma page/snapshot style.
2. An extracted style baseline from that page.
3. A final manipulated frame state from computer-vision gesture edits.

Your job:
- Preserve the original design language (font family, visual hierarchy, color intent).
- Respect the manipulated intent (size, theme, title/subtitle edits).
- Return a CardPatch JSON that can be applied by the plugin.

Rules:
- Output ONLY valid JSON object for CardPatch (no markdown).
- Include all relevant operations so frame is fully defined.
- Keep values in valid ranges:
  - width/height: 120-1200
  - corner_radius: 0-128
  - font_size: 8-96
"""

QUALITY_HINTS = (
    "Quality goals: avoid placeholders (like 'Article Card' or 'Card Title'). "
    "Use context-aware product copy, stronger headline craft, and cleaner visual hierarchy. "
    "Favor premium SaaS landing-card quality over demo scaffolding."
)

GENERIC_COPY_MARKERS = {
    "article card",
    "card title",
    "a short description",
    "lorem ipsum",
    "sample subtitle",
    "sample title",
    "new article",
    "your title",
}

PLUGIN_SUPPORTED_PATHS = {
    "/name",
    "/eyebrow",
    "/width",
    "/height",
    "/fill_rgb",
    "/text_rgb",
    "/accent_rgb",
    "/corner_radius",
    "/font_family",
    "/font_size",
    "/title",
    "/subtitle",
    "/cta_text",
    "/meta_text",
    "/color_scheme",
    "/liquid_glass",
}

PLUGIN_OPERATION_ORDER = [
    "/name",
    "/eyebrow",
    "/width",
    "/height",
    "/fill_rgb",
    "/text_rgb",
    "/accent_rgb",
    "/corner_radius",
    "/font_family",
    "/font_size",
    "/title",
    "/subtitle",
    "/cta_text",
    "/meta_text",
    "/color_scheme",
    "/liquid_glass",
]

PLUGIN_DEFAULTS: dict[str, Any] = {
    "/name": "Tactile Card",
    "/eyebrow": "Design System",
    "/width": 420,
    "/height": 240,
    "/fill_rgb": {"r": 10, "g": 10, "b": 10},
    "/text_rgb": {"r": 232, "g": 232, "b": 232},
    "/accent_rgb": {"r": 102, "g": 179, "b": 255},
    "/corner_radius": 20,
    "/font_family": "Inter",
    "/font_size": 24,
    "/title": "Give your design soul",
    "/subtitle": "Shape polished interfaces through natural gestures and live feedback.",
    "/cta_text": "Start Building with Tactile",
    "/meta_text": "Design meets impact",
    "/color_scheme": "dark",
    "/liquid_glass": False,
}


def _get_llm() -> Any:
    provider = settings.llm_provider.strip().lower()
    if provider == "groq":
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured.")
        return ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.2,
        )

    if provider in {"google", "gemini"}:
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY is not configured.")
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=settings.google_api_key,
            temperature=0.2,
        )

    raise RuntimeError("LLM_PROVIDER must be one of: groq, google, gemini")


async def _invoke_patch_json(messages: list[Any]) -> dict[str, Any]:
    llm = _get_llm()
    response = await llm.ainvoke(messages)
    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


def _normalize_operations(operations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert alternative LLM patch formats to plugin-compatible op/path/value."""
    normalized: list[dict[str, Any]] = []
    text_seen = 0

    for item in operations:
        if not isinstance(item, dict):
            continue

        # Already in expected schema.
        if "path" in item and "value" in item:
            normalized.append(
                {
                    "op": str(item.get("op", "replace")),
                    "path": str(item["path"]),
                    "value": item["value"],
                }
            )
            continue

        item_type = str(item.get("type", "")).upper()
        if item_type == "UPDATE_FRAME":
            if "width" in item:
                normalized.append({"op": "replace", "path": "/width", "value": item["width"]})
            if "height" in item:
                normalized.append({"op": "replace", "path": "/height", "value": item["height"]})
            continue

        if item_type == "UPDATE_TEXT":
            text_seen += 1
            path = "/title" if text_seen == 1 else "/subtitle"
            if "text" in item:
                normalized.append({"op": "replace", "path": path, "value": item["text"]})
            if "font_family" in item:
                normalized.append(
                    {"op": "replace", "path": "/font_family", "value": item["font_family"]}
                )
            if "font_size" in item:
                normalized.append(
                    {"op": "replace", "path": "/font_size", "value": item["font_size"]}
                )
            continue

        if item_type == "UPDATE_APPEARANCE":
            if "color_scheme" in item:
                normalized.append(
                    {"op": "replace", "path": "/color_scheme", "value": item["color_scheme"]}
                )
            if "corner_radius" in item:
                normalized.append(
                    {"op": "replace", "path": "/corner_radius", "value": item["corner_radius"]}
                )
            if "liquid_glass" in item:
                normalized.append(
                    {"op": "replace", "path": "/liquid_glass", "value": bool(item["liquid_glass"])}
                )
            continue

    return normalized


def _int_in_range(value: Any, lo: int, hi: int, default: int) -> int:
    try:
        return max(lo, min(hi, int(round(float(value)))))
    except Exception:
        return default


def _normalize_rgb_value(value: Any, default: dict[str, int]) -> dict[str, int]:
    if not isinstance(value, dict):
        return dict(default)
    return {
        "r": _int_in_range(value.get("r"), 0, 255, default["r"]),
        "g": _int_in_range(value.get("g"), 0, 255, default["g"]),
        "b": _int_in_range(value.get("b"), 0, 255, default["b"]),
    }


def _normalize_path_value(path: str, value: Any) -> Any:
    if path in {"/name", "/eyebrow", "/font_family", "/title", "/subtitle", "/cta_text", "/meta_text"}:
        return str(value or PLUGIN_DEFAULTS[path]).strip() or PLUGIN_DEFAULTS[path]
    if path == "/width":
        return _int_in_range(value, 120, 1200, int(PLUGIN_DEFAULTS[path]))
    if path == "/height":
        return _int_in_range(value, 120, 1200, int(PLUGIN_DEFAULTS[path]))
    if path == "/corner_radius":
        return _int_in_range(value, 0, 128, int(PLUGIN_DEFAULTS[path]))
    if path == "/font_size":
        return _int_in_range(value, 8, 96, int(PLUGIN_DEFAULTS[path]))
    if path in {"/fill_rgb", "/text_rgb", "/accent_rgb"}:
        return _normalize_rgb_value(value, PLUGIN_DEFAULTS[path])
    if path == "/color_scheme":
        scheme = str(value or PLUGIN_DEFAULTS[path]).strip().lower()
        if scheme not in {"warm", "cool", "dark", "bright", "soft", "moon"}:
            return PLUGIN_DEFAULTS[path]
        return scheme
    if path == "/liquid_glass":
        return bool(value)
    return value


def _sanitize_plugin_operations(operations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Keep only paths supported by figma-plugin/code.js, last write wins.
    by_path: dict[str, Any] = {}
    for op in operations:
        if not isinstance(op, dict):
            continue
        path = str(op.get("path", "")).strip()
        if path not in PLUGIN_SUPPORTED_PATHS:
            continue
        by_path[path] = _normalize_path_value(path, op.get("value"))

    for path in PLUGIN_OPERATION_ORDER:
        if path not in by_path:
            by_path[path] = _normalize_path_value(path, PLUGIN_DEFAULTS[path])

    return [{"op": "replace", "path": path, "value": by_path[path]} for path in PLUGIN_OPERATION_ORDER]


def _finalize_patch(
    patch: dict[str, Any],
    *,
    patch_id: str,
    project_id: str,
    card_id: str,
    event_id: str,
) -> dict[str, Any]:
    operations = patch.get("operations", [])
    if isinstance(operations, list):
        normalized = _normalize_operations(operations)
        patch["operations"] = _sanitize_plugin_operations(normalized)
    else:
        patch["operations"] = _sanitize_plugin_operations([])

    patch.setdefault("patch_id", patch_id)
    patch.setdefault("project_id", project_id)
    patch.setdefault("card_id", card_id)
    patch.setdefault("source_event_id", event_id)
    patch.setdefault("from_version", 1)
    patch.setdefault("to_version", 2)

    return patch


async def _get_latest_snapshot(
    db: AsyncIOMotorDatabase, project_id: str
) -> dict[str, Any] | None:
    snapshot = await db.plugin_page_snapshots.find_one(
        {"project_id": project_id},
        sort=[("updated_at", -1)],
    )
    if snapshot:
        snapshot.pop("_id", None)
    return snapshot


def _summarise_figma_tree(
    node: dict[str, Any], depth: int = 0, max_depth: int = 4
) -> str:
    indent = "  " * depth
    node_type = node.get("type", "?")
    name = node.get("name", "")
    dims = ""
    w, h = node.get("width"), node.get("height")
    if w is not None and h is not None:
        dims = f" ({int(w)}x{int(h)})"

    fills_info = ""
    fills = node.get("fills", [])
    if isinstance(fills, list):
        for fill in fills:
            if isinstance(fill, dict) and fill.get("type") == "SOLID":
                c = fill.get("color", {})
                r = int(round(float(c.get("r", 0)) * 255))
                g = int(round(float(c.get("g", 0)) * 255))
                b = int(round(float(c.get("b", 0)) * 255))
                fills_info = f" fill=rgb({r},{g},{b})"
                break

    font_info = ""
    if node_type == "TEXT":
        style = node.get("style", {})
        fam = style.get("fontFamily", "")
        sz = style.get("fontSize", "")
        chars = (node.get("characters", "") or "")[:40]
        if fam:
            font_info = f' font="{fam}" size={sz}'
        if chars:
            font_info += f' text="{chars}"'

    cr = node.get("cornerRadius")
    cr_info = f" radius={int(cr)}" if cr else ""

    line = f"{indent}- [{node_type}] \"{name}\"{dims}{fills_info}{cr_info}{font_info}"
    lines = [line]

    if depth < max_depth:
        for child in node.get("children", []):
            if isinstance(child, dict):
                lines.append(
                    _summarise_figma_tree(child, depth + 1, max_depth)
                )

    return "\n".join(lines)


def _style_summary(spec: Any) -> str:
    return (
        f"Extracted style:\n"
        f"  Dominant size: {spec.width}x{spec.height}\n"
        f"  Background: rgb({spec.background_rgb.r},{spec.background_rgb.g},{spec.background_rgb.b})\n"
        f"  Text color: rgb({spec.text_rgb.r},{spec.text_rgb.g},{spec.text_rgb.b})\n"
        f"  Primary accent: rgb({spec.primary_rgb.r},{spec.primary_rgb.g},{spec.primary_rgb.b})\n"
        f"  Font: {spec.font_family} {spec.font_size}px\n"
        f"  Corner radius: {spec.corner_radius}px\n"
        f"  Color scheme: {spec.color_scheme}"
    )


def _iter_nodes(node: dict[str, Any]) -> list[dict[str, Any]]:
    stack = [node]
    nodes: list[dict[str, Any]] = []
    while stack:
        cur = stack.pop()
        if not isinstance(cur, dict):
            continue
        nodes.append(cur)
        children = cur.get("children")
        if isinstance(children, list):
            for child in reversed(children):
                if isinstance(child, dict):
                    stack.append(child)
    return nodes


def _extract_text_candidates(page_json: dict[str, Any]) -> dict[str, list[str]]:
    entries: list[tuple[str, int]] = []
    for node in _iter_nodes(page_json):
        if str(node.get("type", "")).upper() != "TEXT":
            continue
        txt = str(node.get("characters", "")).strip()
        if not txt:
            continue
        txt = " ".join(txt.split())
        if len(txt) < 3:
            continue
        size_raw = node.get("fontSize")
        if size_raw is None and isinstance(node.get("style"), dict):
            size_raw = node["style"].get("fontSize")
        try:
            size = int(round(float(size_raw)))
        except Exception:
            size = 14
        entries.append((txt, size))

    # Keep first occurrence order while deduplicating.
    seen: set[str] = set()
    unique: list[tuple[str, int]] = []
    for txt, size in entries:
        key = txt.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append((txt, size))

    unique.sort(key=lambda x: x[1], reverse=True)
    headlines = [t for t, s in unique if s >= 24][:6]
    supporting = [t for t, s in unique if 12 <= s < 24][:8]
    tiny = [t for t, s in unique if s < 12][:8]
    return {"headlines": headlines, "supporting": supporting, "tiny": tiny}


def _context_copy_summary(page_json: dict[str, Any]) -> str:
    c = _extract_text_candidates(page_json)
    h = c["headlines"][:4]
    s = c["supporting"][:6]
    t = c["tiny"][:4]
    return (
        "Copy candidates from source page:\n"
        f"- Headline candidates: {json.dumps(h, ensure_ascii=True)}\n"
        f"- Supporting copy candidates: {json.dumps(s, ensure_ascii=True)}\n"
        f"- UI microcopy candidates: {json.dumps(t, ensure_ascii=True)}"
    )


def _is_generic_text(value: str) -> bool:
    v = " ".join((value or "").strip().lower().split())
    if not v:
        return True
    if v in GENERIC_COPY_MARKERS:
        return True
    for marker in GENERIC_COPY_MARKERS:
        if marker in v:
            return True
    # Generic patterns like "title", "subtitle", "description" without context.
    if len(v) <= 22 and any(token in v for token in {"title", "subtitle", "description"}):
        return True
    return False


def _set_operation_value(operations: list[dict[str, Any]], path: str, value: Any) -> None:
    for op in operations:
        if isinstance(op, dict) and str(op.get("path")) == path:
            op["value"] = value
            return
    operations.append({"op": "replace", "path": path, "value": value})


def _get_operation_value(operations: list[dict[str, Any]], path: str) -> Any:
    for op in operations:
        if isinstance(op, dict) and str(op.get("path")) == path:
            return op.get("value")
    return None


def _enforce_patch_quality(
    patch: dict[str, Any], *, page_json: dict[str, Any] | None = None
) -> dict[str, Any]:
    operations = patch.get("operations", [])
    if not isinstance(operations, list):
        patch["operations"] = []
        return patch

    # Keep cards intentionally sized for readable, high-quality composition.
    width = _get_operation_value(operations, "/width")
    height = _get_operation_value(operations, "/height")
    try:
        if width is None or int(width) < 340:
            _set_operation_value(operations, "/width", 420 if width is None else max(340, int(width)))
    except Exception:
        _set_operation_value(operations, "/width", 420)
    try:
        if height is None or int(height) < 200:
            _set_operation_value(operations, "/height", 240 if height is None else max(200, int(height)))
    except Exception:
        _set_operation_value(operations, "/height", 240)

    # Ensure readable title size.
    fs = _get_operation_value(operations, "/font_size")
    try:
        if fs is None or int(fs) < 18:
            _set_operation_value(operations, "/font_size", 24 if fs is None else max(18, int(fs)))
    except Exception:
        _set_operation_value(operations, "/font_size", 24)

    title = str(_get_operation_value(operations, "/title") or "").strip()
    subtitle = str(_get_operation_value(operations, "/subtitle") or "").strip()

    if page_json:
        candidates = _extract_text_candidates(page_json)
        headline_candidates = candidates["headlines"] + candidates["supporting"]
        support_candidates = candidates["supporting"] + candidates["tiny"]

        def pick_distinct(options: list[str], avoid: set[str]) -> str | None:
            for option in options:
                norm = option.strip()
                if not norm:
                    continue
                if _is_generic_text(norm):
                    continue
                if norm.lower() in avoid:
                    continue
                return norm
            return None

        if _is_generic_text(title):
            replacement_title = pick_distinct(headline_candidates, set())
            if replacement_title:
                title = replacement_title
                _set_operation_value(operations, "/title", title)

        if _is_generic_text(subtitle) or subtitle.lower() == title.lower():
            replacement_sub = pick_distinct(support_candidates, {title.lower()})
            if replacement_sub:
                subtitle = replacement_sub
                _set_operation_value(operations, "/subtitle", subtitle)

    # Last-resort high-quality fallback copy.
    if _is_generic_text(title):
        title = "Give your design soul"
        _set_operation_value(operations, "/title", title)
    if _is_generic_text(subtitle) or subtitle.lower() == title.lower():
        _set_operation_value(
            operations,
            "/subtitle",
            "Shape polished interfaces through natural gestures and live feedback.",
        )

    # Frame name should be contextual, not generic.
    name = str(_get_operation_value(operations, "/name") or "").strip()
    if _is_generic_text(name):
        _set_operation_value(operations, "/name", f"{title[:36]} Card")

    patch["operations"] = _sanitize_plugin_operations(operations)
    return patch


def _op_value(operations: list[dict[str, Any]], path: str, default: Any) -> Any:
    for op in operations:
        if isinstance(op, dict) and str(op.get("path")) == path:
            return op.get("value")
    return default


def _rgb_to_css(rgb: dict[str, Any], fallback: str) -> str:
    try:
        r = int(rgb.get("r", 0))
        g = int(rgb.get("g", 0))
        b = int(rgb.get("b", 0))
        r = max(0, min(255, r))
        g = max(0, min(255, g))
        b = max(0, min(255, b))
        return f"rgb({r}, {g}, {b})"
    except Exception:
        return fallback


def _theme_css_palette(scheme: str) -> tuple[str, str]:
    palettes = {
        "warm": ("#241208", "#F2DFC0"),
        "cool": ("#0D1424", "#C8DFEF"),
        "dark": ("#0A0A0A", "#E8E8E8"),
        "bright": ("#FFFFFF", "#0F0F0F"),
        "soft": ("#FAF5FF", "#3D2152"),
        "moon": ("#0D1117", "#C9D7E6"),
    }
    return palettes.get((scheme or "dark").lower(), palettes["dark"])


def render_frontend_card_html(patch: dict[str, Any]) -> dict[str, Any]:
    """Convert a patch into a frontend-ready HTML snippet + design tokens."""
    operations = patch.get("operations", [])

    width = int(_op_value(operations, "/width", 360))
    height = int(_op_value(operations, "/height", 220))
    width = max(240, min(1200, width))
    height = max(140, min(1200, height))

    corner = int(_op_value(operations, "/corner_radius", 20))
    corner = max(0, min(128, corner))

    title = str(_op_value(operations, "/title", "Tactile"))
    subtitle = str(
        _op_value(
            operations,
            "/subtitle",
            "Design with your hands. Shape interfaces through gesture.",
        )
    )
    font_family = str(_op_value(operations, "/font_family", "Inter"))
    font_size = int(_op_value(operations, "/font_size", 24))
    font_size = max(12, min(64, font_size))
    subtitle_size = max(12, int(round(font_size * 0.62)))

    color_scheme = str(_op_value(operations, "/color_scheme", "dark"))
    default_bg, default_text = _theme_css_palette(color_scheme)
    fill_rgb = _op_value(operations, "/fill_rgb", None)
    text_rgb = _op_value(operations, "/text_rgb", None)
    background = _rgb_to_css(fill_rgb, default_bg) if isinstance(fill_rgb, dict) else default_bg
    text_color = _rgb_to_css(text_rgb, default_text) if isinstance(text_rgb, dict) else default_text

    border = "rgba(255,255,255,0.22)" if color_scheme in {"dark", "moon"} else "rgba(0,0,0,0.12)"
    shadow = "0 16px 38px rgba(0,0,0,0.20)"

    safe_title = escape(title)
    safe_subtitle = escape(subtitle)
    safe_font = escape(font_family)

    html = f"""<section class="hackai-card" role="region" aria-label="Generated frame card">
  <div class="hackai-card__badge">Generated from Figma context</div>
  <h2 class="hackai-card__title">{safe_title}</h2>
  <p class="hackai-card__subtitle">{safe_subtitle}</p>
  <div class="hackai-card__cta-row">
    <button class="hackai-card__cta">Open in Editor</button>
    <span class="hackai-card__meta">Style matched to source design</span>
  </div>
</section>
<style>
  .hackai-card {{
    width: {width}px;
    min-height: {height}px;
    border-radius: {corner}px;
    padding: 24px;
    box-sizing: border-box;
    border: 1px solid {border};
    background: linear-gradient(165deg, color-mix(in oklab, {background} 94%, white), {background});
    color: {text_color};
    box-shadow: {shadow};
    font-family: "{safe_font}", sans-serif;
    display: flex;
    flex-direction: column;
    gap: 14px;
    justify-content: flex-start;
  }}
  .hackai-card__badge {{
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.72;
  }}
  .hackai-card__title {{
    margin: 0;
    font-size: {font_size}px;
    line-height: 1.12;
    font-weight: 700;
    max-width: 18ch;
  }}
  .hackai-card__subtitle {{
    margin: 0;
    font-size: {subtitle_size}px;
    line-height: 1.45;
    opacity: 0.88;
    max-width: 46ch;
  }}
  .hackai-card__cta-row {{
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }}
  .hackai-card__cta {{
    border: none;
    border-radius: 999px;
    padding: 10px 16px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    background: color-mix(in oklab, {text_color} 20%, transparent);
    color: {text_color};
    cursor: pointer;
  }}
  .hackai-card__meta {{
    font-size: 12px;
    opacity: 0.72;
  }}
</style>
"""

    return {
        "html": html,
        "tokens": {
            "width": width,
            "height": height,
            "corner_radius": corner,
            "font_family": font_family,
            "font_size": font_size,
            "background": background,
            "text_color": text_color,
            "color_scheme": color_scheme,
        },
    }


async def generate_adaptive_frame(
    db: AsyncIOMotorDatabase,
    project_id: str,
    card_id: str,
) -> dict[str, Any]:
    """Read the latest Figma snapshot from MongoDB, analyze the project's
    visual style using the style extractor + Gemini, and return a CardPatch
    that creates a frame matching the project."""
    snapshot = await _get_latest_snapshot(db, project_id)
    if not snapshot or not snapshot.get("page_json"):
        raise ValueError(
            "No page snapshot found. Open the Figma plugin and let it send "
            "a snapshot first."
        )

    page_json = snapshot["page_json"]
    page_id = snapshot.get("page_id", "unknown")
    file_key = snapshot.get("file_key")

    tree_summary = _summarise_figma_tree(page_json)

    spec = extract_card_spec_from_page_snapshot(
        project_id=project_id,
        card_id=card_id,
        source_file_key=file_key,
        source_page_id=page_id,
        page_json=page_json,
    )
    style_text = _style_summary(spec)
    copy_context = _context_copy_summary(page_json)

    patch_id = str(uuid.uuid4())
    event_id = f"ai-adapt-{uuid.uuid4()}"

    messages = [
        SystemMessage(content=ADAPT_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"## Current Figma page (project={project_id}, page={page_id})\n\n"
            f"{tree_summary}\n\n"
            f"---\n\n"
            f"{style_text}\n\n"
            f"{copy_context}\n\n"
            f"---\n\n"
            f"patch_id: {patch_id}\n"
            f"project_id: {project_id}\n"
            f"card_id: {card_id}\n"
            f"source_event_id: {event_id}\n\n"
            f"Create a new frame that fits visually with this project. "
            f"Match the colors, fonts, corner radii, and sizing. "
            f"{QUALITY_HINTS} "
            f"Respond with ONLY the JSON."
        )),
    ]

    patch = await _invoke_patch_json(messages)

    patch = _finalize_patch(
        patch,
        patch_id=patch_id,
        project_id=project_id,
        card_id=card_id,
        event_id=event_id,
    )
    return _enforce_patch_quality(patch, page_json=page_json)


async def generate_frame_patch(
    db: AsyncIOMotorDatabase,
    project_id: str,
    card_id: str,
    user_prompt: str,
) -> dict[str, Any]:
    """Prompt-driven frame generation. If a snapshot exists the LLM sees
    it for context, otherwise it creates a generic frame."""
    snapshot = await _get_latest_snapshot(db, project_id)

    context_block = "No page snapshot available yet."
    if snapshot and snapshot.get("page_json"):
        page_json = snapshot["page_json"]
        context_block = (
            f"Current Figma page (project={project_id}):\n"
            + _summarise_figma_tree(page_json)
        )
        context_block += "\n\n" + _context_copy_summary(page_json)

    patch_id = str(uuid.uuid4())
    event_id = f"ai-{uuid.uuid4()}"

    messages = [
        SystemMessage(content=ADAPT_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context_block}\n\n"
            f"---\n"
            f"patch_id: {patch_id}\n"
            f"project_id: {project_id}\n"
            f"card_id: {card_id}\n"
            f"source_event_id: {event_id}\n\n"
            f"User request: {user_prompt}\n\n"
            f"{QUALITY_HINTS}\n\n"
            f"Respond with ONLY the JSON CardPatch object."
        )),
    ]

    patch = await _invoke_patch_json(messages)

    patch = _finalize_patch(
        patch,
        patch_id=patch_id,
        project_id=project_id,
        card_id=card_id,
        event_id=event_id,
    )
    return _enforce_patch_quality(
        patch, page_json=snapshot["page_json"] if snapshot and snapshot.get("page_json") else None
    )


async def generate_frontend_card_payload(
    db: AsyncIOMotorDatabase,
    project_id: str,
    card_id: str,
    prompt: str | None = None,
) -> dict[str, Any]:
    """Generate patch + frontend HTML snippet for rendering in web UI."""
    if prompt and prompt.strip():
        patch = await generate_frame_patch(
            db=db,
            project_id=project_id,
            card_id=card_id,
            user_prompt=prompt.strip(),
        )
    else:
        patch = await generate_adaptive_frame(
            db=db,
            project_id=project_id,
            card_id=card_id,
        )

    frontend_card = render_frontend_card_html(patch)
    return {"patch": patch, "frontend_card": frontend_card}


async def generate_reconciled_patch(
    db: AsyncIOMotorDatabase,
    project_id: str,
    card_id: str,
    final_frame_state: dict[str, Any],
) -> dict[str, Any]:
    """Create a patch that maps manipulated frame state back into project style."""
    snapshot = await _get_latest_snapshot(db, project_id)
    if not snapshot or not snapshot.get("page_json"):
        raise ValueError(
            "No page snapshot found. Open the Figma plugin and let it send "
            "a snapshot first."
        )

    page_json = snapshot["page_json"]
    page_id = snapshot.get("page_id", "unknown")
    file_key = snapshot.get("file_key")
    tree_summary = _summarise_figma_tree(page_json)

    spec = extract_card_spec_from_page_snapshot(
        project_id=project_id,
        card_id=card_id,
        source_file_key=file_key,
        source_page_id=page_id,
        page_json=page_json,
    )
    style_text = _style_summary(spec)

    patch_id = str(uuid.uuid4())
    event_id = f"ai-reconcile-{uuid.uuid4()}"

    messages = [
        SystemMessage(content=RECONCILE_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"## Original Figma page (project={project_id}, page={page_id})\n\n"
            f"{tree_summary}\n\n"
            f"---\n\n"
            f"{style_text}\n\n"
            f"---\n\n"
            f"Final manipulated frame state (JSON):\n"
            f"{json.dumps(final_frame_state, ensure_ascii=True)}\n\n"
            f"---\n\n"
            f"patch_id: {patch_id}\n"
            f"project_id: {project_id}\n"
            f"card_id: {card_id}\n"
            f"source_event_id: {event_id}\n\n"
            f"Return CardPatch JSON only."
        )),
    ]

    patch = await _invoke_patch_json(messages)

    patch = _finalize_patch(
        patch,
        patch_id=patch_id,
        project_id=project_id,
        card_id=card_id,
        event_id=event_id,
    )
    return _enforce_patch_quality(patch, page_json=page_json)
