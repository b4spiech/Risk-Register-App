# Risk Register App

A navigational front end for a PMO risk register, backed by two SharePoint lists
(Projects + RiskRegister). Severity score and band are derived client-side and never
stored, so changing thresholds later never leaves records stale.

The current scaffold ships an in-memory FastAPI mock that mirrors the SharePoint
shape — swap `app/store.py` for a Microsoft Graph client when wiring real data.

## Layout (flat)

```
app/                  # FastAPI backend (Python)
  main.py             # routes: /projects, /risks (GET/POST/PATCH)
  models.py           # Pydantic models matching SharePoint columns
  store.py            # in-memory mock; replace with Graph client later
src/                  # React + Vite frontend (TypeScript)
  lib/severity.ts     # getSeverity pure function (Green/Yellow/Red bands)
  lib/api.ts          # fetch client → /api proxy → backend
  lib/types.ts
  screens/            # Home, ProjectList, ProjectDetail
  components/         # RiskHeatmap, RiskCard, RiskForm, ViewTabs
index.html
vite.config.ts        # dev-time /api → http://localhost:8000 proxy
package.json
tsconfig.json
requirements.txt
```

## Run locally

Two processes. Backend on `:8000`, frontend on `:5173` proxying `/api` to backend.

```bash
# 1. Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
npm install
npm run dev
```

Open http://localhost:5173. The home screen has a "Risk Registers" button →
project list (Active projects, with open-risk count + worst severity) → project
detail (heatmap + cards, with view tabs and an entry form).

## Tests

```bash
npm test     # severity logic
```

## Replacing the mock with SharePoint / Graph

The route handlers in `app/main.py` only call methods on `store`. Implement the
same surface against Microsoft Graph and swap the import:

- `list_projects(status=None) -> list[Project]`
- `list_risks(project_id=None) -> list[Risk]`
- `create_risk(payload: RiskCreate) -> Risk`  (sets `DateIdentified = today`,
  clears `RiskOwner` unless `PMOAction == "Mitigate"`)
- `update_risk(risk_id, payload: RiskUpdate) -> Risk | None`

SharePoint column internal names are deliberately set to match `models.py`
(`Title`, `RiskDescription`, `Probability`, `Impact`, `PMOAction`, `RiskOwner`,
`RiskStatus`, `ProjectID`, `DateIdentified`). Define them explicitly when
provisioning the lists; do not let SharePoint auto-generate from display names.

## Scoring

```ts
function getSeverity(probability, impact) {
  if (impact === 5) return 'Red';        // catastrophic override
  const score = probability * impact;    // 1..25
  if (score >= 15) return 'Red';
  if (score >= 7)  return 'Yellow';
  return 'Green';
}
```

Bands: Green 1–6, Yellow 7–14, Red 15–25, plus Impact = 5 forced Red.
