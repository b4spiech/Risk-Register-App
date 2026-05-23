import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from .models import Risk, RiskCreate, RiskUpdate
from .store import store


class CreateRiskBody(BaseModel):
    """Payload the front-end sends to POST /api/risks. The flow only
    accepts these 5 fields today; the rich Risk model still describes
    what reads return so existing render code keeps working."""

    Title: str
    RiskDescription: str
    Probability: int = Field(ge=1, le=5)
    Impact: int = Field(ge=1, le=5)
    ProjectID: int

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


@api.post("/risks", status_code=201)
async def create_risk(body: CreateRiskBody) -> dict[str, Any]:
    """Forward a new risk to the SharePoint "Create Risk" Power Automate
    flow. The shared secret is added server-side so the browser never
    sees it. Falls back to the in-memory store when env vars are unset
    so local dev keeps working."""
    url = os.environ.get("Create_Risk_URL")
    secret = os.environ.get("Risk_Secret")
    print(
        f"[risks] env vars present: url={url is not None} secret={secret is not None}; "
        f"url starts: {url[:60] if url else 'MISSING'}",
        flush=True,
    )
    if not url or not secret:
        print("[risks] FALLBACK to mock store (no flow call made)", flush=True)
        try:
            store.create_risk(
                RiskCreate(
                    Title=body.Title,
                    RiskDescription=body.RiskDescription,
                    Probability=body.Probability,
                    Impact=body.Impact,
                    ProjectID=body.ProjectID,
                    PMOAction="Mitigate",
                    RiskStatus="Active",
                )
            )
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return {"status": "created"}

    # Ints (not strings) — SharePoint Number columns reject quoted strings.
    flow_payload = {
        "secret": secret,
        "Title": body.Title,
        "RiskDescription": body.RiskDescription,
        "Probability": int(body.Probability),
        "Impact": int(body.Impact),
        "ProjectID": int(body.ProjectID),
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            print("[risks] sending POST to Create Risk flow...", flush=True)
            resp = await client.post(url, json=flow_payload)
            print(
                f"[risks] flow responded: HTTP {resp.status_code}, "
                f"{len(resp.text)} bytes",
                flush=True,
            )
            resp.raise_for_status()
    except Exception as e:
        print(f"[risks] flow call FAILED: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=502, detail=str(e))
    try:
        return resp.json()
    except ValueError:
        return {"status": "created"}


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
