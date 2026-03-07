from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.api.dependencies import require_mongo
from app.models.card import CardState
from app.models.gesture import GestureEvent
from app.models.patch import CardPatch
from app.services.gesture_engine import apply_gesture
from app.services.plugin_sync import dispatch_patch_to_plugin

router = APIRouter(prefix="/gestures", tags=["gestures"])


class GestureSimulationRequest(BaseModel):
    current_state: CardState
    event: GestureEvent


class GestureSimulationResponse(BaseModel):
    next_state: CardState
    patch: CardPatch


class GestureApplyResponse(BaseModel):
    next_state: CardState
    patch: CardPatch


@router.post("/simulate", response_model=GestureSimulationResponse)
async def simulate_gesture(payload: GestureSimulationRequest) -> GestureSimulationResponse:
    try:
        next_state, patch = apply_gesture(payload.current_state, payload.event)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GestureSimulationResponse(next_state=next_state, patch=patch)


@router.post("/apply", response_model=GestureApplyResponse)
async def apply_gesture_with_persistence(
    event: GestureEvent,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> GestureApplyResponse:
    existing_event = await db.gesture_events.find_one({"event_id": event.event_id})
    if existing_event:
        return GestureApplyResponse(
            next_state=CardState(**existing_event["result_state"]),
            patch=CardPatch(**existing_event["patch"]),
        )

    current = await db.cards.find_one({"project_id": event.project_id, "card_id": event.card_id})
    if not current:
        raise HTTPException(status_code=404, detail="Card not found. Initialize it first.")
    current.pop("_id", None)

    try:
        next_state, patch = apply_gesture(CardState(**current), event)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = await db.cards.update_one(
        {"project_id": event.project_id, "card_id": event.card_id, "version": current["version"]},
        {"$set": next_state.model_dump()},
    )
    if updated.modified_count != 1:
        raise HTTPException(status_code=409, detail="Version conflict. Retry with latest card state.")

    patch_doc = patch.model_dump()
    patch_doc["project_id"] = event.project_id
    patch_doc["delivery_status"] = "pending"
    patch_doc["created_at"] = datetime.now(timezone.utc)
    await db.card_patches.insert_one(patch_doc)
    await db.gesture_events.insert_one(
        {
            "event_id": event.event_id,
            "project_id": event.project_id,
            "card_id": event.card_id,
            "sequence_id": event.sequence_id,
            "intent": event.intent,
            "params": event.params,
            "patch": patch_doc,
            "result_state": next_state.model_dump(),
            "created_at": datetime.now(timezone.utc),
        }
    )
    await dispatch_patch_to_plugin(db=db, project_id=event.project_id, patch=patch_doc)
    return GestureApplyResponse(next_state=next_state, patch=patch)
