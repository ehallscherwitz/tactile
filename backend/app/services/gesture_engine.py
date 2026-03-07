from uuid import uuid4

from app.models.card import CardState
from app.models.gesture import GestureEvent
from app.models.patch import CardOperation, CardPatch

MIN_SIZE = 120
MAX_SIZE = 1200
DEFAULT_SIZE_STEP = 16
MAX_SIZE_STEP = 200
ALLOWED_COLOR_SCHEMES = {"light", "dark", "blue", "green", "purple"}


def _clamp_size(value: int) -> int:
    return max(MIN_SIZE, min(MAX_SIZE, value))


def apply_gesture(current: CardState, event: GestureEvent) -> tuple[CardState, CardPatch]:
    if current.card_id != event.card_id:
        raise ValueError("event.card_id must match current_state.card_id")

    size_step = abs(int(event.params.get("size_step", DEFAULT_SIZE_STEP)))
    size_step = min(size_step, MAX_SIZE_STEP)
    next_state = current.model_copy(deep=True)
    operations: list[CardOperation] = []

    if event.intent == "increase_size":
        next_width = _clamp_size(next_state.width + size_step)
        next_height = _clamp_size(next_state.height + size_step)
        if next_width != next_state.width:
            operations.append(CardOperation(path="/width", value=next_width))
            next_state.width = next_width
        if next_height != next_state.height:
            operations.append(CardOperation(path="/height", value=next_height))
            next_state.height = next_height
    elif event.intent == "decrease_size":
        next_width = _clamp_size(next_state.width - size_step)
        next_height = _clamp_size(next_state.height - size_step)
        if next_width != next_state.width:
            operations.append(CardOperation(path="/width", value=next_width))
            next_state.width = next_width
        if next_height != next_state.height:
            operations.append(CardOperation(path="/height", value=next_height))
            next_state.height = next_height
    elif event.intent == "change_color_scheme":
        color_scheme = str(event.params.get("color_scheme", "")).strip().lower()
        if color_scheme and color_scheme not in ALLOWED_COLOR_SCHEMES:
            raise ValueError("Unsupported color_scheme provided")
        if color_scheme and color_scheme != next_state.color_scheme:
            operations.append(CardOperation(path="/color_scheme", value=color_scheme))
            next_state.color_scheme = color_scheme
    elif event.intent == "toggle_liquid_glass":
        next_value = not next_state.liquid_glass
        operations.append(CardOperation(path="/liquid_glass", value=next_value))
        next_state.liquid_glass = next_value

    next_state.version = current.version + 1
    operations.append(CardOperation(path="/version", value=next_state.version))

    patch = CardPatch(
        patch_id=str(uuid4()),
        card_id=current.card_id,
        source_event_id=event.event_id,
        from_version=current.version,
        to_version=next_state.version,
        operations=operations,
    )
    return next_state, patch
