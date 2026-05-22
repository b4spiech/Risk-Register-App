import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from .models import Risk, RiskCreate, RiskUpdate
from .store import store

# Power Automate flow URL (HTTP-triggered, POST). Set on Railway; the
# handler reads it per-request so a redeploy isn't required if the var
# is changed at runtime, and so a missing/typo'd var is visible in logs
# on every call rather than silently captured as None at import time.


def _extract_status(row: dict[str, Any]) -> Optional[str]:
    """SharePoint Choice columns come back as {Id, Value} objects, not plain
    strings. Read .Value when nested, otherwise pass through."""
    status = row.get("Status")
    if isinstance(status, dict):
        return status.get("Value")
    return status


class SPAStaticFiles(StaticFiles):
    """StaticFiles that falls back to index.html for client-side routes.

    Vite's default html=True only serves index.html at directory roots,
    so unmatched paths like /projects/3 return 404. For an SPA we want
    those to hit index.html so React Router can take over.
    """

    async def get_response(self, path: str, scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise

app = FastAPI(title="Risk Register API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/projects")
async def get_projects() -> list[dict[str, Any]]:
    """Return all projects from the SharePoint list via the Power Automate
    flow. Frontend filters by status client-side. Falls back to the mock
    store when the env var is unset, so local dev keeps working until
    the flow is wired."""
    url = os.environ.get("Get_Projects_URL")
    print(
        f"[projects] env var present: {url is not None}; "
        f"url starts: {url[:60] if url else 'MISSING'}",
        flush=True,
    )
    if not url:
        print("[projects] FALLBACK to mock store (no flow call made)", flush=True)
        return [
            {"id": p.ID, "title": p.Title, "status": p.ProjectStatus}
            for p in store.list_projects()
        ]
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            print("[projects] sending POST to flow...", flush=True)
            resp = await client.post(url, json={})
            print(
                f"[projects] flow responded: HTTP {resp.status_code}, "
                f"{len(resp.text)} bytes",
                flush=True,
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as e:
        print(f"[projects] flow call FAILED: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=502, detail=str(e))
    if not isinstance(rows, list):
        print(
            f"[projects] flow returned non-list JSON: type={type(rows).__name__}; "
            f"value={str(rows)[:500]!r}",
            flush=True,
        )
        raise HTTPException(
            status_code=502,
            detail="Flow returned JSON but not the expected array of rows",
        )
    if rows:
        print(f"[projects] first row keys: {list(rows[0].keys())}", flush=True)
    return [
        {"id": r.get("ID"), "title": r.get("Title"), "status": _extract_status(r)}
        for r in rows
    ]


@api.get("/risks", response_model=list[Risk])
def get_risks(projectId: Optional[int] = Query(default=None)) -> list[Risk]:
    return store.list_risks(project_id=projectId)


@api.post("/risks", response_model=Risk, status_code=201)
def create_risk(payload: RiskCreate) -> Risk:
    try:
        return store.create_risk(payload)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@api.patch("/risks/{risk_id}", response_model=Risk)
def update_risk(risk_id: int, payload: RiskUpdate) -> Risk:
    try:
        updated = store.update_risk(risk_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if updated is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    return updated


@api.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)


# Serve the built React SPA from /dist when present (production deploy).
# StaticFiles(html=True) returns index.html for any unmatched path, which
# is the right behavior for client-side routing. API routes registered
# above match first because FastAPI matches routes before mounts.
DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")
if os.path.isdir(DIST_DIR):
    app.mount("/", SPAStaticFiles(directory=DIST_DIR, html=True), name="spa")
