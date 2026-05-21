import type { Project, Risk, RiskCreatePayload, RiskUpdatePayload } from './types';

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
  listProjects(status?: 'Active'): Promise<Project[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<Project[]>(`/projects${q}`);
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
