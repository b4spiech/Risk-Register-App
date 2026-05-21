from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .models import Project, Risk, RiskCreate, RiskUpdate
from .store import store

app = FastAPI(title="Risk Register API (mock)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/projects", response_model=list[Project])
def get_projects(status: Optional[str] = Query(default=None)) -> list[Project]:
    return store.list_projects(status=status)


@app.get("/risks", response_model=list[Risk])
def get_risks(projectId: Optional[int] = Query(default=None)) -> list[Risk]:
    return store.list_risks(project_id=projectId)


@app.post("/risks", response_model=Risk, status_code=201)
def create_risk(payload: RiskCreate) -> Risk:
    try:
        return store.create_risk(payload)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.patch("/risks/{risk_id}", response_model=Risk)
def update_risk(risk_id: int, payload: RiskUpdate) -> Risk:
    try:
        updated = store.update_risk(risk_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if updated is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    return updated


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
