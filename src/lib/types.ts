export type ProjectStatus = 'Active' | 'On Hold' | 'Complete' | 'Cancelled';
export type PMOAction = 'Accept' | 'Mitigate' | 'Ignore';
export type RiskStatus = 'Active' | 'Monitoring' | 'Closed';

export interface Project {
  ID: number;
  Title: string;
  ProjectStatus: ProjectStatus;
}

export interface Risk {
  ID: number;
  Title: string;
  RiskDescription: string;
  Probability: number; // 1..5
  Impact: number; // 1..5
  PMOAction: PMOAction;
  RiskOwner: string | null;
  RiskStatus: RiskStatus;
  ProjectID: number;
  DateIdentified: string; // ISO date
}

export interface RiskCreatePayload {
  Title: string;
  RiskDescription: string;
  Probability: number;
  Impact: number;
  PMOAction: PMOAction;
  RiskOwner?: string | null;
  RiskStatus: RiskStatus;
  ProjectID: number;
}

export type RiskUpdatePayload = Partial<RiskCreatePayload>;
