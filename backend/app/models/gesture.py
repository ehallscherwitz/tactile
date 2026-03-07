from typing import Any, Literal

from pydantic import BaseModel, Field

GestureIntent = Literal[
    "increase_size",
    "decrease_size",
    "change_color_scheme",
    "toggle_liquid_glass",
]


class GestureEvent(BaseModel):
    event_id: str = Field(min_length=1)
    card_id: str = Field(min_length=1)
    sequence_id: str = Field(min_length=1)
    intent: GestureIntent
    params: dict[str, Any] = Field(default_factory=dict)
