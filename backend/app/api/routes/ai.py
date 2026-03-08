from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.dependencies import require_mongo
from app.services.langchain_figma import (
    generate_adaptive_frame,
    generate_frontend_card_payload,
    generate_frame_patch,
    generate_reconciled_patch,
)
from app.services.plugin_sync import dispatch_patch_to_plugin

router = APIRouter(prefix="/ai", tags=["ai"])


class GenerateFrameRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(default="card-1", min_length=1)
    prompt: str = Field(min_length=1, max_length=2000)


class AdaptFrameRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(default="card-1", min_length=1)


class ReconcileFrameRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(default="card-1", min_length=1)
    final_frame_state: dict[str, Any] = Field(
        default_factory=dict,
        description="Frontend-manipulated frame state to reconcile back to design.",
    )


class FrontendCardRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(default="card-frontend-1", min_length=1)
    prompt: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional creative direction. If omitted, adapts from snapshot.",
    )
    dispatch_to_plugin: bool = Field(
        default=False,
        description="If true, also sends generated patch to connected Figma plugin.",
    )


class RunAiFrameRequest(BaseModel):
    project_id: str = Field(default="default", min_length=1)
    card_id: str = Field(default="ai-run-1", min_length=1)
    prompt: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional creative direction. If omitted, uses adaptive mode.",
    )
    include_frontend_html: bool = Field(
        default=False,
        description="Return frontend-renderable HTML snippet along with patch.",
    )


@router.post("/generate-frame")
async def generate_frame(
    body: GenerateFrameRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict[str, Any]:
    """Prompt-driven: user describes what they want, LLM generates a patch."""
    try:
        patch = await generate_frame_patch(
            db=db,
            project_id=body.project_id,
            card_id=body.card_id,
            user_prompt=body.prompt,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    await db.card_patches.insert_one({**patch, "delivery_status": "pending"})
    await dispatch_patch_to_plugin(db, body.project_id, patch)

    return {"status": "ok", "patch": patch}


@router.post("/adapt-frame")
async def adapt_frame(
    body: AdaptFrameRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict[str, Any]:
    """Automatic: reads the Figma snapshot, analyzes the project's style,
    and creates a frame that matches — no prompt needed."""
    try:
        patch = await generate_adaptive_frame(
            db=db,
            project_id=body.project_id,
            card_id=body.card_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    await db.card_patches.insert_one({**patch, "delivery_status": "pending"})
    await dispatch_patch_to_plugin(db, body.project_id, patch)

    return {"status": "ok", "patch": patch}


@router.post("/reconcile-frame")
async def reconcile_frame(
    body: ReconcileFrameRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict[str, Any]:
    """Post-CV step: reconcile manipulated frame state back to design style."""
    try:
        patch = await generate_reconciled_patch(
            db=db,
            project_id=body.project_id,
            card_id=body.card_id,
            final_frame_state=body.final_frame_state,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    await db.card_patches.insert_one({**patch, "delivery_status": "pending"})
    await dispatch_patch_to_plugin(db, body.project_id, patch)

    return {"status": "ok", "patch": patch}


@router.post("/frontend-card")
async def frontend_card(
    body: FrontendCardRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict[str, Any]:
    """Generate frontend-renderable HTML card from Figma context."""
    try:
        payload = await generate_frontend_card_payload(
            db=db,
            project_id=body.project_id,
            card_id=body.card_id,
            prompt=body.prompt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    patch = payload["patch"]
    if body.dispatch_to_plugin:
        await db.card_patches.insert_one({**patch, "delivery_status": "pending"})
        await dispatch_patch_to_plugin(db, body.project_id, patch)

    return {"status": "ok", **payload}


@router.post("/run")
async def run_ai_frame(
    body: RunAiFrameRequest,
    db: AsyncIOMotorDatabase = Depends(require_mongo),
) -> dict[str, Any]:
    """One-call AI flow for plugin testing.

    Uses latest snapshot context, generates a quality patch, persists it,
    and dispatches to connected plugin.
    """
    try:
        if body.include_frontend_html:
            payload = await generate_frontend_card_payload(
                db=db,
                project_id=body.project_id,
                card_id=body.card_id,
                prompt=body.prompt,
            )
            patch = payload["patch"]
            frontend_card = payload["frontend_card"]
        else:
            if body.prompt and body.prompt.strip():
                patch = await generate_frame_patch(
                    db=db,
                    project_id=body.project_id,
                    card_id=body.card_id,
                    user_prompt=body.prompt.strip(),
                )
            else:
                patch = await generate_adaptive_frame(
                    db=db,
                    project_id=body.project_id,
                    card_id=body.card_id,
                )
            frontend_card = None
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    await db.card_patches.insert_one({**patch, "delivery_status": "pending"})
    await dispatch_patch_to_plugin(db, body.project_id, patch)

    response: dict[str, Any] = {"status": "ok", "patch": patch}
    if frontend_card is not None:
        response["frontend_card"] = frontend_card
    return response