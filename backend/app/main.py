from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.db.mongo import close_mongo, init_mongo

app = FastAPI(title=settings.app_name)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
async def startup_event() -> None:
    await init_mongo()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_mongo()
