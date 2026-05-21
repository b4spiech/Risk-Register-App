import os
from typing import Optional

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from .models import Project, Risk, RiskCreate, RiskUpdate
from .store import store


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


@api.get("/projects", response_model=list[Project])
def get_projects(status: Optional[str] = Query(default=None)) -> list[Project]:
    return store.list_projects(status=status)


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
