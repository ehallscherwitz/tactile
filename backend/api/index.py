"""
Vercel serverless entrypoint (api/ folder).
Served at /api; handles /api, /api/v1/health, etc.
Set Vercel Root Directory to "backend".
"""
import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.main import app


class RestoreApiPathMiddleware(BaseHTTPMiddleware):
    """If Vercel passes path without /api (e.g. /v1/health), restore /api so routes match."""
    async def dispatch(self, request: Request, call_next):
        scope = request.scope
        path = scope.get("path", "")
        if not path.startswith("/api") and (path.startswith("/v1/") or path == "/v1"):
            scope["path"] = "/api" + path
        return await call_next(request)


app.add_middleware(RestoreApiPathMiddleware)

__all__ = ["app"]
