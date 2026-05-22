export type ProjectStatus = 'Active' | 'On Hold' | 'Complete' | 'Cancelled';
export type PMOAction = 'Avoid' | 'Mitigate' | 'Transfer' | 'Escalate' | 'Accept' | 'Ignore';
export type RiskStatus = 'Active' | 'Monitoring' | 'Closed';
export type ResponseStatus = 'Not Started' | 'In Progress' | 'Complete';
export type TransferMechanism = 'Insurance' | 'Bond' | 'Contract' | 'Warranty' | 'Other';
export type AcceptanceType = 'Passive' | 'Active';

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
  RiskStatus: RiskStatus;
  ProjectID: number;
  DateIdentified: string; // ISO date
  ResponseOwner: string | null;
  ResponsePlan: string | null;
  ResponseTargetDate: string | null;
  ResponseStatus: ResponseStatus | null;
  TransferredTo: string | null;
  TransferMechanism: TransferMechanism | null;
  EscalatedTo: string | null;
  AcceptanceType: AcceptanceType | null;
  TriggerCondition: string | null;
  ContingencyPlan: string | null;
  ContingencyReserve: string | null;
}

export interface RiskCreatePayload {
  Title: string;
  RiskDescription: string;
  Probability: number;
  Impact: number;
  PMOAction: PMOAction;
  RiskStatus: RiskStatus;
  ProjectID: number;
  ResponseOwner?: string | null;
  ResponsePlan?: string | null;
  ResponseTargetDate?: string | null;
  ResponseStatus?: ResponseStatus | null;
  TransferredTo?: string | null;
  TransferMechanism?: TransferMechanism | null;
  EscalatedTo?: string | null;
  AcceptanceType?: AcceptanceType | null;
  TriggerCondition?: string | null;
  ContingencyPlan?: string | null;
  ContingencyReserve?: string | null;
}

export type RiskUpdatePayload = Partial<RiskCreatePayload>;
