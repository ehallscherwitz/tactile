from typing import Any

from pydantic import BaseModel, Field


class CardOperation(BaseModel):
    op: str = Field(default="replace")
    path: str = Field(min_length=1)
    value: Any


class CardPatch(BaseModel):
    patch_id: str = Field(min_length=1)
    card_id: str = Field(min_length=1)
    source_event_id: str = Field(min_length=1)
    from_version: int = Field(ge=1)
    to_version: int = Field(ge=1)
    operations: list[CardOperation] = Field(default_factory=list)
