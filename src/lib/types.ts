export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Cancelled';
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

// The live Create Risk Power Automate flow only accepts these 5 fields
// today. PMBOK response fields aren't in the SharePoint schema yet, so
// they're not in the create payload. When SharePoint adds those columns,
// re-expand this interface (and the form).
export interface RiskCreatePayload {
  Title: string;
  RiskDescription: string;
  Probability: number;
  Impact: number;
  ProjectID: number;
}

export type RiskUpdatePayload = Partial<RiskCreatePayload>;
