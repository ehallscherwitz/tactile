from typing import Any, Literal

from pydantic import BaseModel, Field


class PluginHelloMessage(BaseModel):
    type: Literal["hello"]
    project_id: str = Field(min_length=1)
    file_key: str | None = None
    page_id: str = Field(min_length=1)
    node_id: str | None = None


class PluginPageSnapshotMessage(BaseModel):
    type: Literal["page_snapshot"]
    project_id: str = Field(min_length=1)
    file_key: str | None = None
    page_id: str = Field(min_length=1)
    node_id: str | None = None
    captured_at: str
    page_json: dict[str, Any]


class PluginAckMessage(BaseModel):
    type: Literal["ack"]
    patch_id: str = Field(min_length=1)
    status: Literal["applied", "failed"]
    error: str | None = None
