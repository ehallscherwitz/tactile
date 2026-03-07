from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any

from app.models.card import ColorScheme
from app.models.card_spec import CardSpec, RGBColor


@dataclass
class _CandidateFrame:
    width: float
    height: float
    corner_radius: float
    fill_rgb: tuple[int, int, int] | None
    area: float


def _to_rgb_255(color: dict[str, Any]) -> tuple[int, int, int] | None:
    if not isinstance(color, dict):
        return None
    try:
        r = int(round(float(color.get("r", 0)) * 255))
        g = int(round(float(color.get("g", 0)) * 255))
        b = int(round(float(color.get("b", 0)) * 255))
    except (TypeError, ValueError):
        return None
    r = max(0, min(255, r))
    g = max(0, min(255, g))
    b = max(0, min(255, b))
    return (r, g, b)


def _extract_solid_fill_rgb(node: dict[str, Any]) -> tuple[int, int, int] | None:
    fills = node.get("fills")
    if not isinstance(fills, list):
        return None
    for fill in fills:
        if not isinstance(fill, dict):
            continue
        if fill.get("visible", True) is False:
            continue
        if fill.get("type") != "SOLID":
            continue
        rgb = _to_rgb_255(fill.get("color", {}))
        if rgb is not None:
            return rgb
    return None


def _iter_nodes(root: dict[str, Any]) -> list[dict[str, Any]]:
    stack = [root]
    nodes: list[dict[str, Any]] = []
    while stack:
        node = stack.pop()
        if not isinstance(node, dict):
            continue
        nodes.append(node)
        children = node.get("children")
        if isinstance(children, list):
            stack.extend(reversed([child for child in children if isinstance(child, dict)]))
    return nodes


def _luma(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _nearest_scheme(rgb: tuple[int, int, int]) -> ColorScheme:
    r, g, b = rgb
    if _luma(rgb) > 200:
        return "light"
    if _luma(rgb) < 55:
        return "dark"
    if b >= r and b >= g:
        return "blue"
    if g >= r and g >= b:
        return "green"
    return "purple"


def _default_text_rgb(background: tuple[int, int, int]) -> tuple[int, int, int]:
    return (20, 20, 20) if _luma(background) > 140 else (255, 255, 255)


def extract_card_spec_from_page_snapshot(
    *,
    project_id: str,
    card_id: str,
    source_file_key: str | None,
    source_page_id: str,
    page_json: dict[str, Any],
) -> CardSpec:
    all_nodes = _iter_nodes(page_json)

    frame_candidates: list[_CandidateFrame] = []
    fill_counter: Counter[tuple[int, int, int]] = Counter()
    text_counter: Counter[tuple[str, int]] = Counter()

    for node in all_nodes:
        node_type = str(node.get("type", ""))
        width = node.get("width")
        height = node.get("height")
        corner_radius = node.get("cornerRadius", 0) or 0
        fill_rgb = _extract_solid_fill_rgb(node)

        if fill_rgb is not None:
            fill_counter[fill_rgb] += 1

        if node_type in {"FRAME", "RECTANGLE", "COMPONENT", "INSTANCE"} and isinstance(width, (int, float)) and isinstance(height, (int, float)):
            area = float(width) * float(height)
            frame_candidates.append(
                _CandidateFrame(
                    width=float(width),
                    height=float(height),
                    corner_radius=float(corner_radius) if isinstance(corner_radius, (int, float)) else 0.0,
                    fill_rgb=fill_rgb,
                    area=area,
                )
            )

        if node_type == "TEXT":
            style = node.get("style", {})
            family = str(style.get("fontFamily", "")).strip() or "Inter"
            size_raw = style.get("fontSize", 16)
            try:
                size = int(round(float(size_raw)))
            except (TypeError, ValueError):
                size = 16
            size = max(8, min(96, size))
            text_counter[(family, size)] += 1

    # Pick a likely "card" candidate: medium-ish frame with strong area.
    card_candidate = None
    filtered = [
        candidate
        for candidate in frame_candidates
        if 120 <= candidate.width <= 1200 and 120 <= candidate.height <= 1200
    ]
    if filtered:
        filtered.sort(key=lambda candidate: abs((candidate.width / candidate.height) - 1.6) + (1 / max(candidate.area, 1)))
        card_candidate = filtered[0]
    elif frame_candidates:
        frame_candidates.sort(key=lambda candidate: candidate.area, reverse=True)
        card_candidate = frame_candidates[0]

    width = int(round(card_candidate.width)) if card_candidate else 320
    height = int(round(card_candidate.height)) if card_candidate else 200
    width = max(120, min(1200, width))
    height = max(120, min(1200, height))
    corner_radius = int(round(card_candidate.corner_radius)) if card_candidate else 20
    corner_radius = max(0, min(128, corner_radius))

    background_rgb = (
        card_candidate.fill_rgb
        if card_candidate and card_candidate.fill_rgb is not None
        else (fill_counter.most_common(1)[0][0] if fill_counter else (243, 244, 246))
    )
    scheme = _nearest_scheme(background_rgb)
    text_rgb = _default_text_rgb(background_rgb)
    primary_rgb = fill_counter.most_common(1)[0][0] if fill_counter else background_rgb

    if text_counter:
        (font_family, font_size), _ = text_counter.most_common(1)[0]
    else:
        font_family, font_size = ("Inter", 24)

    return CardSpec(
        project_id=project_id,
        card_id=card_id,
        source_file_key=source_file_key,
        source_page_id=source_page_id,
        width=width,
        height=height,
        color_scheme=scheme,
        background_rgb=RGBColor(r=background_rgb[0], g=background_rgb[1], b=background_rgb[2]),
        text_rgb=RGBColor(r=text_rgb[0], g=text_rgb[1], b=text_rgb[2]),
        primary_rgb=RGBColor(r=primary_rgb[0], g=primary_rgb[1], b=primary_rgb[2]),
        font_family=font_family,
        font_size=font_size,
        corner_radius=corner_radius,
    )
