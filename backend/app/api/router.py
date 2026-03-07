from fastapi import APIRouter

from app.api.routes.cards import router as cards_router
from app.api.routes.gestures import router as gestures_router
from app.api.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(cards_router)
api_router.include_router(gestures_router)
