// Shared audit/admin dashboard types. Single home for these so the admin hook
// and the audit API client cannot drift (they previously defined them twice with
// differing `permission_type` nullability).

export interface AuditUser {
  user_id: string;
  username: string;
  department: string;
  permission_type: string | null;
}

export interface ProjectMetrics {
  id: string;
  name: string;
  date: string;
  users: AuditUser[];
  f1Score: number;
  totalParams: number;
  aiParams: number;
  acceptedParams: number;
}

export interface ChartDataPoint {
  name: string;
  f1Score: number;
  totalParams: number;
  aiParams: number;
}

export interface DashboardInsights {
  avgF1: string | number;
  avgAcceptanceRate: string | number;
  totalAssistedProjects: number;
  totalAiParams: number;
}

export interface DashboardData {
  chartData: ChartDataPoint[];
  insights: DashboardInsights;
}

export interface GroupInsights {
  totalExtractionRuns: number;
  acceptanceRate: number;
  totalFlags: number;
}


export interface ProjectSummary {
  parameterKey: string;
  finalValue: string | null;
  reviewAction: string;
  isHumanModified: boolean;
  totalCandidates: number;
  totalFlags: number;
  lastAiUpdate: string | null;
  isAiAccepted: boolean;
  totalExtractionRuns: number;
}

export interface FlagDetail {
  flagId: string;
  flagReason: string | null;
  status: string;
  flagType: string | null;
  createdAt: string;
  resolvedByCandidateId: string | null;
}

export interface ParameterLineageEvent {
  candidateId: string;
  extractionRunId: string;
  value: string | null;
  unit: string | null;
  extractionLogic: string | null;
  confidence: number;
  createdAt: string;
  flag: FlagDetail | null;
  isWinner: boolean;
}

export interface ParameterLineageResponse {
  parameterKey: string;
  finalValue: string | null;
  reviewAction: string | null;
  isAiAccepted: boolean;
  events: ParameterLineageEvent[];
}