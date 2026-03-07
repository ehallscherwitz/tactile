from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.dependencies import require_mongo
from app.models.card import CardState

router = APIRouter(prefix="/cards", tags=["cards"])


class InitCardRequest(BaseModel):
    card_id: str = Field(min_length=1)
    width: int = Field(default=320, ge=120, le=1200)
    height: int = Field(default=200, ge=120, le=1200)
    color_scheme: str = Field(default="light")
    liquid_glass: bool = False


@router.post("/init", response_model=CardState)
async def init_card(
    payload: InitCardRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> CardState:
    existing = await db.cards.find_one({"card_id": payload.card_id})
    if existing:
        return CardState(**existing)

    state = CardState(
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
async def get_card(card_id: str, db: AsyncIOMotorDatabase = Depends(require_mongo)) -> CardState:
    card = await db.cards.find_one({"card_id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return CardState(**card)
