from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from motor.motor_asyncio import AsyncIOMotorDatabase


class PluginConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[project_id].add(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket) -> None:
        connections = self._connections.get(project_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(project_id, None)

    def is_connected(self, project_id: str) -> bool:
        return bool(self._connections.get(project_id))

    async def send_patch(self, project_id: str, patch: dict[str, Any]) -> bool:
        connections = list(self._connections.get(project_id, set()))
        if not connections:
            return False

        message = {"type": "card_patch", "patch": patch}
        delivered = False
        for websocket in connections:
            try:
                await websocket.send_json(message)
                delivered = True
            except Exception:
                self.disconnect(project_id, websocket)
        return delivered


plugin_manager = PluginConnectionManager()


async def dispatch_patch_to_plugin(
    db: AsyncIOMotorDatabase, project_id: str, patch: dict[str, Any]
) -> None:
    now = datetime.now(timezone.utc)
    delivered = await plugin_manager.send_patch(project_id, patch)
    if delivered:
        await db.card_patches.update_one(
            {"patch_id": patch["patch_id"]},
            {"$set": {"delivery_status": "sent", "delivered_at": now}},
        )
    else:
        await db.card_patches.update_one(
            {"patch_id": patch["patch_id"]},
            {"$set": {"delivery_status": "pending"}},
        )


async def replay_pending_patches(db: AsyncIOMotorDatabase, project_id: str) -> int:
    sent_count = 0
    cursor = db.card_patches.find(
        {
            "project_id": project_id,
            "delivery_status": {"$in": ["pending", "failed"]},
        }
    ).sort("to_version", 1)

    async for patch in cursor:
        patch.pop("_id", None)
        delivered = await plugin_manager.send_patch(project_id, patch)
        if delivered:
            sent_count += 1
            await db.card_patches.update_one(
                {"patch_id": patch["patch_id"]},
                {
                    "$set": {
                        "delivery_status": "sent",
                        "delivered_at": datetime.now(timezone.utc),
                    }
                },
            )
    return sent_count


async def record_plugin_ack(
    db: AsyncIOMotorDatabase, project_id: str, patch_id: str, status: str, error: str | None = None
) -> None:
    now = datetime.now(timezone.utc)
    update: dict[str, Any] = {"ack_status": status, "acked_at": now}
    if status == "applied":
        update["delivery_status"] = "applied"
    elif status == "failed":
        update["delivery_status"] = "failed"
    if error:
        update["ack_error"] = error

    await db.card_patches.update_one(
        {"patch_id": patch_id, "project_id": project_id},
        {"$set": update},
    )


async def upsert_plugin_session(
    db: AsyncIOMotorDatabase,
    project_id: str,
    file_key: str | None,
    page_id: str,
    node_id: str | None,
) -> None:
    await db.plugin_sessions.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "project_id": project_id,
                "file_key": file_key,
                "page_id": page_id,
                "node_id": node_id,
                "updated_at": datetime.now(timezone.utc),
                "connected": True,
            }
        },
        upsert=True,
    )


async def mark_plugin_disconnected(db: AsyncIOMotorDatabase, project_id: str) -> None:
    await db.plugin_sessions.update_one(
        {"project_id": project_id},
        {"$set": {"connected": False, "updated_at": datetime.now(timezone.utc)}},
    )


async def upsert_page_snapshot(
    db: AsyncIOMotorDatabase,
    project_id: str,
    file_key: str | None,
    page_id: str,
    node_id: str | None,
    captured_at: str,
    page_json: dict[str, Any],
) -> None:
    await db.plugin_page_snapshots.update_one(
        {"project_id": project_id, "page_id": page_id},
        {
            "$set": {
                "project_id": project_id,
                "file_key": file_key,
                "page_id": page_id,
                "node_id": node_id,
                "captured_at": captured_at,
                "updated_at": datetime.now(timezone.utc),
                "page_json": page_json,
            }
        },
        upsert=True,
    )
