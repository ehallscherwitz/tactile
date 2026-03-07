from typing import Literal

from pydantic import BaseModel, Field

ColorScheme = Literal["light", "dark", "blue", "green", "purple"]


class CardState(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(min_length=1)
    version: int = Field(default=1, ge=1)
    width: int = Field(default=320, ge=120, le=1200)
    height: int = Field(default=200, ge=120, le=1200)
    color_scheme: ColorScheme = "light"
    liquid_glass: bool = False
