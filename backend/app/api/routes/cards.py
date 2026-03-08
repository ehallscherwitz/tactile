import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.dependencies import require_mongo
from app.models.card import CardState
from app.models.card_spec import CardSpec
from app.models.patch import CardOperation, CardPatch
from app.services.plugin_sync import dispatch_patch_to_plugin
from app.services.style_extractor import extract_card_spec_from_page_snapshot

router = APIRouter(prefix="/cards", tags=["cards"])


class InitCardRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(min_length=1)
    width: int = Field(default=320, ge=120, le=1200)
    height: int = Field(default=200, ge=120, le=1200)
    color_scheme: str = Field(default="light")
    liquid_glass: bool = False


class BootstrapCardFromSnapshotRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(min_length=1)
    overwrite_existing_card: bool = False
    liquid_glass: bool = False


class BootstrapCardFromSnapshotResponse(BaseModel):
    card_state: CardState
    card_spec: CardSpec
    snapshot_page_id: str
    snapshot_file_key: str | None = None


class BootstrapAndPushRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(default="main", min_length=1)
    color_scheme: str = Field(default="", description="Theme override; empty = use detected theme")
    liquid_glass: bool = False


@router.post("/init", response_model=CardState)
async def init_card(
    payload: InitCardRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> CardState:
    existing = await db.cards.find_one({"project_id": payload.project_id, "card_id": payload.card_id})
    if existing:
        existing.pop("_id", None)
        return CardState(**existing)

    state = CardState(
        project_id=payload.project_id,
        card_id=payload.card_id,
        version=1,
        width=payload.width,
        height=payload.height,
        color_scheme=payload.color_scheme,
        liquid_glass=payload.liquid_glass,
    )
    try:
        await db.cards.insert_one(state.model_dump())
    except Exception as exc:  # pragma: no cover - guarded by unique index.
        raise HTTPException(status_code=409, detail="Card already initialized") from exc
    return state


@router.get("/{card_id}", response_model=CardState)
async def get_card(
    card_id: str,
    project_id: str = "default",
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> CardState:
    card = await db.cards.find_one({"project_id": project_id, "card_id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card.pop("_id", None)
    return CardState(**card)


@router.get("/{card_id}/history")
async def get_card_history(
    card_id: str,
    project_id: str = "default",
    limit: int = 25,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict[str, list[dict]]:
    safe_limit = max(1, min(limit, 100))
    events_cursor = db.gesture_events.find(
        {"project_id": project_id, "card_id": card_id}
    ).sort("_id", -1).limit(safe_limit)
    patches_cursor = db.card_patches.find(
        {"project_id": project_id, "card_id": card_id}
    ).sort("to_version", -1).limit(safe_limit)

    events: list[dict] = []
    patches: list[dict] = []

    async for event in events_cursor:
        event.pop("_id", None)
        events.append({k: str(v) if type(v).__name__ == "ObjectId" else v for k, v in event.items()})
    async for patch in patches_cursor:
        patch.pop("_id", None)
        patches.append({k: str(v) if type(v).__name__ == "ObjectId" else v for k, v in patch.items()})

    return {"events": events, "patches": patches}


@router.get("/{card_id}/spec", response_model=CardSpec)
async def get_card_spec(
    card_id: str,
    project_id: str = "default",
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> CardSpec:
    spec = await db.card_specs.find_one({"project_id": project_id, "card_id": card_id})
    if not spec:
        raise HTTPException(status_code=404, detail="Card spec not found")
    spec.pop("_id", None)
    return CardSpec(**spec)


@router.post("/bootstrap-from-snapshot", response_model=BootstrapCardFromSnapshotResponse)
async def bootstrap_card_from_snapshot(
    payload: BootstrapCardFromSnapshotRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> BootstrapCardFromSnapshotResponse:
    snapshot = await db.plugin_page_snapshots.find_one(
        {"project_id": payload.project_id},
        sort=[("updated_at", -1)],
    )
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail="No plugin snapshot found. Connect plugin and sync page JSON first.",
        )

    spec = extract_card_spec_from_page_snapshot(
        project_id=payload.project_id,
        card_id=payload.card_id,
        source_file_key=snapshot.get("file_key"),
        source_page_id=snapshot["page_id"],
        page_json=snapshot.get("page_json", {}),
    )

    now = datetime.now(timezone.utc)
    spec_doc = spec.model_dump()
    spec_doc["updated_at"] = now
    await db.card_specs.update_one(
        {"project_id": payload.project_id, "card_id": payload.card_id},
        {"$set": spec_doc},
        upsert=True,
    )

    existing_card = await db.cards.find_one(
        {"project_id": payload.project_id, "card_id": payload.card_id}
    )
    if existing_card and not payload.overwrite_existing_card:
        existing_card.pop("_id", None)
        card_state = CardState(**existing_card)
    else:
        min_width = max(spec.width, 320)
        title_lines = max(1, len(spec.title) * spec.font_size // max(min_width - 48, 100))
        min_height = max(spec.height, 48 + title_lines * (spec.font_size + 8) + 40)
        min_width = max(120, min(1200, min_width))
        min_height = max(120, min(1200, min_height))

        card_state = CardState(
            project_id=payload.project_id,
            card_id=payload.card_id,
            version=1 if not existing_card else int(existing_card.get("version", 1)) + 1,
            width=min_width,
            height=min_height,
            color_scheme=spec.color_scheme,
            liquid_glass=payload.liquid_glass,
            title=spec.title,
            subtitle=spec.subtitle,
            font_family=spec.font_family,
            font_size=spec.font_size,
            corner_radius=spec.corner_radius,
        )
        await db.cards.update_one(
            {"project_id": payload.project_id, "card_id": payload.card_id},
            {"$set": card_state.model_dump()},
            upsert=True,
        )

    return BootstrapCardFromSnapshotResponse(
        card_state=card_state,
        card_spec=spec,
        snapshot_page_id=snapshot["page_id"],
        snapshot_file_key=snapshot.get("file_key"),
    )


@router.post("/{card_id}/push")
async def push_card_to_figma(
    card_id: str,
    project_id: str = "default",
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict:
    """Push the full current card state to the Figma plugin via WebSocket."""
    card = await db.cards.find_one({"project_id": project_id, "card_id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card.pop("_id", None)
    state = CardState(**card)

    operations = [
        CardOperation(op="replace", path="/width", value=state.width),
        CardOperation(op="replace", path="/height", value=state.height),
        CardOperation(op="replace", path="/color_scheme", value=state.color_scheme),
        CardOperation(op="replace", path="/liquid_glass", value=state.liquid_glass),
        CardOperation(op="replace", path="/title", value=state.title),
        CardOperation(op="replace", path="/subtitle", value=state.subtitle),
        CardOperation(op="replace", path="/font_family", value=state.font_family),
        CardOperation(op="replace", path="/font_size", value=state.font_size),
        CardOperation(op="replace", path="/corner_radius", value=state.corner_radius),
    ]

    patch_id = f"push-{uuid.uuid4().hex[:12]}"
    patch = CardPatch(
        patch_id=patch_id,
        project_id=project_id,
        card_id=card_id,
        source_event_id="manual-push",
        from_version=state.version,
        to_version=state.version,
        operations=operations,
    )

    patch_dict = patch.model_dump()
    patch_doc = {**patch_dict, "delivery_status": "pending", "created_at": datetime.now(timezone.utc)}
    await db.card_patches.insert_one(patch_doc)
    await dispatch_patch_to_plugin(db, project_id, patch_dict)

    updated = await db.card_patches.find_one({"patch_id": patch_id})
    delivery = updated.get("delivery_status", "unknown") if updated else "unknown"

    return {"status": "pushed", "patch_id": patch_id, "delivered": delivery, "card_state": state.model_dump()}


@router.post("/bootstrap-and-push")
async def bootstrap_and_push(
    payload: BootstrapAndPushRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict:
    """One-shot: read latest snapshot, build card with optional theme override, push to plugin."""
    snapshot = await db.plugin_page_snapshots.find_one(
        {"project_id": payload.project_id},
        sort=[("updated_at", -1)],
    )
    if not snapshot:
        raise HTTPException(404, "No snapshot found. Connect plugin and sync page JSON first.")

    spec = extract_card_spec_from_page_snapshot(
        project_id=payload.project_id,
        card_id=payload.card_id,
        source_file_key=snapshot.get("file_key"),
        source_page_id=snapshot["page_id"],
        page_json=snapshot.get("page_json", {}),
    )

    scheme = payload.color_scheme.strip() if payload.color_scheme else spec.color_scheme
    if not scheme:
        scheme = spec.color_scheme

    THEME_FONTS = {
        "warm": "Georgia",
        "cool": "DM Sans",
        "dark": "Courier New",
        "bright": "Helvetica Neue",
        "soft": "Georgia",
        "moon": "Georgia",
    }
    font_family = THEME_FONTS.get(scheme, spec.font_family)

    min_width = max(spec.width, 320)
    card_state = CardState(
        project_id=payload.project_id,
        card_id=payload.card_id,
        version=1,
        width=min_width,
        height=max(spec.height, 200),
        color_scheme=scheme,
        liquid_glass=payload.liquid_glass,
        title=spec.title,
        subtitle=spec.subtitle,
        font_family=font_family,
        font_size=spec.font_size,
        corner_radius=spec.corner_radius,
    )
    await db.cards.update_one(
        {"project_id": payload.project_id, "card_id": payload.card_id},
        {"$set": card_state.model_dump()},
        upsert=True,
    )

    operations = [
        CardOperation(op="replace", path="/width", value=card_state.width),
        CardOperation(op="replace", path="/height", value=card_state.height),
        CardOperation(op="replace", path="/color_scheme", value=card_state.color_scheme),
        CardOperation(op="replace", path="/liquid_glass", value=card_state.liquid_glass),
        CardOperation(op="replace", path="/title", value=card_state.title),
        CardOperation(op="replace", path="/subtitle", value=card_state.subtitle),
        CardOperation(op="replace", path="/font_family", value=card_state.font_family),
        CardOperation(op="replace", path="/font_size", value=card_state.font_size),
        CardOperation(op="replace", path="/corner_radius", value=card_state.corner_radius),
    ]

    patch_id = f"push-{uuid.uuid4().hex[:12]}"
    patch = CardPatch(
        patch_id=patch_id,
        project_id=payload.project_id,
        card_id=payload.card_id,
        source_event_id="bootstrap-and-push",
        from_version=card_state.version,
        to_version=card_state.version,
        operations=operations,
    )

    patch_dict = patch.model_dump()
    patch_doc = {**patch_dict, "delivery_status": "pending", "created_at": datetime.now(timezone.utc)}
    await db.card_patches.insert_one(patch_doc)
    await dispatch_patch_to_plugin(db, payload.project_id, patch_dict)

    updated = await db.card_patches.find_one({"patch_id": patch_id})
    delivery = updated.get("delivery_status", "unknown") if updated else "unknown"

    return {
        "status": "pushed",
        "patch_id": patch_id,
        "delivered": delivery,
        "card_state": card_state.model_dump(),
        "spec_extracted": spec.model_dump(),
    }
