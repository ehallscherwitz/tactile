from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_mongo_db


def require_mongo() -> AsyncIOMotorDatabase:
    try:
        return get_mongo_db()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
