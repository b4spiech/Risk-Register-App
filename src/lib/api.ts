import type { Project, ProjectStatus, Risk, RiskCreatePayload, RiskUpdatePayload } from './types';

// The /api/projects endpoint returns SharePoint rows reshaped to lowercase
// keys. The rest of the app uses an uppercase Project type, so adapt here.
interface WireProject {
  id: number;
  title: string;
  status: ProjectStatus;
}

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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

export const api = {
  async listProjects(): Promise<Project[]> {
    const rows = await request<WireProject[]>('/projects');
    return rows.map((r) => ({ ID: r.id, Title: r.title, ProjectStatus: r.status }));
  },
  listRisks(projectId?: number): Promise<Risk[]> {
    const q = projectId != null ? `?projectId=${projectId}` : '';
    return request<Risk[]>(`/risks${q}`);
  },
  createRisk(payload: RiskCreatePayload): Promise<Risk> {
    return request<Risk>('/risks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateRisk(id: number, payload: RiskUpdatePayload): Promise<Risk> {
    return request<Risk>(`/risks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
