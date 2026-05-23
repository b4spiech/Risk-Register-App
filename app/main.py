import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from .store import store


class CreateRiskBody(BaseModel):
    """Payload the front-end POSTs to /api/risks. The "Create Risk" flow
    accepts these 5 fields; everything else lives in SharePoint."""

    Title: str
    RiskDescription: str
    Probability: int = Field(ge=1, le=5)
    Impact: int = Field(ge=1, le=5)
    ProjectID: int


def _extract_status(row: dict[str, Any]) -> Optional[str]:
    """SharePoint Choice columns come back as {Id, Value} objects. Read
    .Value when nested, otherwise pass the raw value through."""
    status = row.get("Status")
    if isinstance(status, dict):
        return status.get("Value")
    return status


def _reshape_risk(row: dict[str, Any]) -> dict[str, Any]:
    """SharePoint Risk row → wire shape the front-end consumes.

    Plain text and number columns — bare values. When Choice columns
    like PMOAction/RiskStatus get added, those will arrive as {Id,
    Value} objects and need the same unwrap as Status above."""
    return {
        "id": row.get("ID"),
        "title": row.get("Title"),
        "description": row.get("RiskDescription"),
        "probability": row.get("Probability"),
        "impact": row.get("Impact"),
        "projectId": row.get("ProjectID"),
    }


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
async def get_projects(response: Response) -> list[dict[str, Any]]:
    """Return all projects from the SharePoint list via the Power Automate
    flow. Frontend filters by status client-side. Falls back to the mock
    store when the env var is unset, so local dev keeps working until
    the flow is wired."""
    response.headers["Cache-Control"] = "no-store"
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


@api.get("/risks")
async def get_risks(response: Response) -> list[dict[str, Any]]:
    """Read all risks from the SharePoint Risk Register Master via the
    Get_Risk_URL Power Automate flow. NO fallback — SharePoint is the
    single source of truth. Empty list is a valid result. Frontend
    filters by ProjectID. Response is Cache-Control: no-store so a
    re-fetch after a create always hits the upstream."""
    response.headers["Cache-Control"] = "no-store"
    url = os.environ["Get_Risk_URL"]  # loud KeyError → 500 if missing
    print(f"[risks-get] url starts: {url[:60]}", flush=True)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            print("[risks-get] sending POST to flow...", flush=True)
            resp = await client.post(url, json={})
            print(
                f"[risks-get] flow responded: HTTP {resp.status_code}, "
                f"{len(resp.text)} bytes",
                flush=True,
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as e:
        print(f"[risks-get] flow call FAILED: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=502, detail=str(e))
    if not isinstance(rows, list):
        print(
            f"[risks-get] flow returned non-list JSON: type={type(rows).__name__}; "
            f"value={str(rows)[:500]!r}",
            flush=True,
        )
        raise HTTPException(
            status_code=502,
            detail="Flow returned JSON but not the expected array of rows",
        )
    if rows:
        print(f"[risks-get] first row keys: {list(rows[0].keys())}", flush=True)
    reshaped = [_reshape_risk(row) for row in rows]
    print(f"[risks-get] returning {len(reshaped)} risks", flush=True)
    return reshaped


@api.post("/risks", status_code=201)
async def create_risk(body: CreateRiskBody) -> dict[str, Any]:
    """Forward a new risk to the SharePoint "Create Risk" Power Automate
    flow. Shared secret is added server-side so the browser never sees
    it. NO fallback — SharePoint is the single source of truth."""
    url = os.environ["Create_Risk_URL"]  # loud KeyError → 500 if missing
    secret = os.environ["Risk_Secret"]
    print(f"[risks] url starts: {url[:60]}", flush=True)

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
