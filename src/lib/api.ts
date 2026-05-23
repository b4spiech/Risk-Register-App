import type { Project, ProjectStatus, Risk, RiskCreatePayload } from './types';

// /api/projects reshapes SharePoint rows to lowercase keys; adapt to
// the uppercase Project type the rest of the app uses.
interface WireProject {
  id: number;
  title: string;
  status: ProjectStatus;
}

// /api/risks reshapes SharePoint rows to a small lowercase shape (just
// the columns the live list has today). The adapter below fills the
// PMBOK fields the Risk type still carries with defaults, so existing
// render code (cards, heatmap, view tabs) keeps working until the
// SharePoint list grows those columns.
interface WireRisk {
  id: number | null;
  title: string | null;
  description: string | null;
  probability: number | null;
  impact: number | null;
  projectId: number | string | null;
}

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // cache: 'no-store' so a re-fetch after a create always hits the server,
  // not a stale browser cache entry. Backend also sets Cache-Control:
  // no-store on reads as defense in depth.
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function adaptRisk(w: WireRisk): Risk {
  return {
    ID: Number(w.id ?? 0),
    Title: w.title ?? '',
    RiskDescription: w.description ?? '',
    Probability: w.probability ?? 0,
    Impact: w.impact ?? 0,
    // Coerce on read — SharePoint may serialize the FK as a string and a
    // string-vs-number mismatch silently empties the project bucket.
    ProjectID: Number(w.projectId ?? 0),
    // Defaults for SharePoint columns that don't exist yet. When they're
    // added, expand WireRisk + the reshape on the backend.
    PMOAction: 'Mitigate',
    RiskStatus: 'Active',
    DateIdentified: '',
    ResponseOwner: null,
    ResponsePlan: null,
    ResponseTargetDate: null,
    ResponseStatus: null,
    TransferredTo: null,
    TransferMechanism: null,
    EscalatedTo: null,
    AcceptanceType: null,
    TriggerCondition: null,
    ContingencyPlan: null,
    ContingencyReserve: null,
  };
}

export const api = {
  async listProjects(): Promise<Project[]> {
    const rows = await request<WireProject[]>('/projects');
    return rows.map((r) => ({ ID: r.id, Title: r.title, ProjectStatus: r.status }));
  },
  async listRisks(projectId?: number): Promise<Risk[]> {
    const rows = await request<WireRisk[]>('/risks');
    const adapted = rows.map(adaptRisk);
    if (projectId == null) return adapted;
    const pid = Number(projectId);
    return adapted.filter((r) => r.ProjectID === pid);
  },
  createRisk(payload: RiskCreatePayload): Promise<{ status?: string }> {
    return request<{ status?: string }>('/risks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
