from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING

from app.core.config import settings

mongo_client: AsyncIOMotorClient | None = None
mongo_db: AsyncIOMotorDatabase | None = None


async def init_mongo() -> None:
    global mongo_client, mongo_db
    if not settings.mongodb_uri:
        mongo_client = None
        mongo_db = None
        return

    mongo_client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo_db = mongo_client[settings.mongodb_db_name]
    await _ensure_indexes(mongo_db)


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.cards.create_index([("project_id", ASCENDING), ("card_id", ASCENDING)], unique=True)
    await db.gesture_events.create_index([("event_id", ASCENDING)], unique=True)
    await db.card_patches.create_index([("patch_id", ASCENDING)], unique=True)
    await db.card_patches.create_index([("project_id", ASCENDING), ("to_version", ASCENDING)])
    await db.plugin_sessions.create_index([("project_id", ASCENDING)], unique=True)
    await db.plugin_page_snapshots.create_index([("project_id", ASCENDING), ("page_id", ASCENDING)])
    await db.plugin_page_snapshots.create_index([("project_id", ASCENDING), ("updated_at", ASCENDING)])
    await db.card_specs.create_index([("project_id", ASCENDING), ("card_id", ASCENDING)], unique=True)


async def close_mongo() -> None:
    global mongo_client, mongo_db
    if mongo_client is not None:
        mongo_client.close()
    mongo_client = None
    mongo_db = None


def get_mongo_db() -> AsyncIOMotorDatabase:
    if mongo_db is None:
        raise RuntimeError("MongoDB is not configured. Set MONGODB_URI in backend/.env.")
    return mongo_db
