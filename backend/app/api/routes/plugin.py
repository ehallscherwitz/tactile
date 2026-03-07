from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import require_mongo

router = APIRouter(prefix="/plugin", tags=["plugin"])


@router.get("/sessions/{project_id}")
async def get_plugin_session(
    project_id: str, db: AsyncIOMotorDatabase = Depends(require_mongo)
) -> dict:
    session = await db.plugin_sessions.find_one({"project_id": project_id})
    if not session:
        raise HTTPException(status_code=404, detail="No plugin session found for project")
    session.pop("_id", None)
    return session


@router.get("/snapshots/{project_id}/latest")
async def get_latest_page_snapshot(
    project_id: str, db: AsyncIOMotorDatabase = Depends(require_mongo)
) -> dict:
    snapshot = await db.plugin_page_snapshots.find_one(
        {"project_id": project_id},
        sort=[("updated_at", -1)],
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="No page snapshot found for project")
    snapshot.pop("_id", None)
    return snapshot
