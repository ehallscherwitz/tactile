from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.db.mongo import get_mongo_db
from app.models.plugin import PluginAckMessage, PluginHelloMessage, PluginPageSnapshotMessage
from app.services.plugin_sync import (
    mark_plugin_disconnected,
    plugin_manager,
    record_plugin_ack,
    replay_pending_patches,
    upsert_page_snapshot,
    upsert_plugin_session,
)

router = APIRouter(prefix="/ws/plugin", tags=["plugin"])


@router.websocket("/{project_id}")
async def plugin_websocket(
    websocket: WebSocket,
    project_id: str,
) -> None:
    try:
        db = get_mongo_db()
    except RuntimeError:
        await websocket.accept()
        await websocket.send_json(
            {"type": "error", "message": "MongoDB is not configured. Set MONGODB_URI in backend/.env."}
        )
        await websocket.close(code=1011)
        return

    await plugin_manager.connect(project_id, websocket)
    await replay_pending_patches(db, project_id)
    try:
        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type")
            if message_type == "ack":
                try:
                    message = PluginAckMessage(**payload)
                except ValidationError:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid ack message format"}
                    )
                    continue
                await record_plugin_ack(
                    db=db,
                    project_id=project_id,
                    patch_id=message.patch_id,
                    status=message.status,
                    error=message.error,
                )
                continue

            if message_type == "hello":
                try:
                    hello = PluginHelloMessage(**payload)
                except ValidationError:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid hello message format"}
                    )
                    continue
                if hello.project_id != project_id:
                    await websocket.send_json(
                        {"type": "error", "message": "hello.project_id must match websocket project_id"}
                    )
                    continue
                await upsert_plugin_session(
                    db=db,
                    project_id=hello.project_id,
                    file_key=hello.file_key,
                    page_id=hello.page_id,
                    node_id=hello.node_id,
                )
                await websocket.send_json({"type": "hello_ack", "project_id": hello.project_id})
                continue

            if message_type == "page_snapshot":
                try:
                    snapshot = PluginPageSnapshotMessage(**payload)
                except ValidationError:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid page_snapshot message format"}
                    )
                    continue
                if snapshot.project_id != project_id:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "page_snapshot.project_id must match websocket project_id",
                        }
                    )
                    continue
                await upsert_page_snapshot(
                    db=db,
                    project_id=snapshot.project_id,
                    file_key=snapshot.file_key,
                    page_id=snapshot.page_id,
                    node_id=snapshot.node_id,
                    captured_at=snapshot.captured_at,
                    page_json=snapshot.page_json,
                )
                await websocket.send_json(
                    {
                        "type": "page_snapshot_ack",
                        "project_id": snapshot.project_id,
                        "page_id": snapshot.page_id,
                    }
                )
                continue

            await websocket.send_json({"type": "error", "message": "Unknown websocket message type"})
    except WebSocketDisconnect:
        plugin_manager.disconnect(project_id, websocket)
        await mark_plugin_disconnected(db, project_id)
