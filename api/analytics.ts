import { config } from './config';

const API_URL = config.api;

const ANALYTICS_BASE_URL = API_URL + '/analytics';
const AUTH_BASE_URL = API_URL + '/auth';

// --- Response types mirror the backend Pydantic schema ---

export interface GlobalMetrics {
  accepted_count: number;
  corrected_count: number;
  pending_count: number;
  total_parameters: number;
  acceptance_rate_percent: number;
}

export interface ErrorHotspot {
  parameter_key: string;
  total_reviews: number;
  total_modifications: number;
  error_rate: number;
}

export interface ABTestMetric {
  extraction_type: string;
  total_parameters: number;
  acceptance_rate: number;
}

export interface ConfidenceMetrics {
  avg_ai_confidence_accepted: number;
  avg_ai_confidence_modified: number;
}

export interface VelocityMetric {
  review_date: string;
  parameters_verified: number;
}

export interface DashboardAnalytics {
  global_metrics: GlobalMetrics;
  hotspots: ErrorHotspot[];
  ab_test: ABTestMetric[];
  confidence: ConfidenceMetrics;
  velocity: VelocityMetric[];
}

export const apiGetDashboardAnalytics = async (): Promise<DashboardAnalytics> => {
  const response = await fetch(`${ANALYTICS_BASE_URL}/dashboard`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

// --- Admin actions ---

export interface RegisterUserInput {
  username: string;
  department: string;
}

export interface RegisteredUser {
  id: string;
  username: string;
  department: string;
}

export const apiRegisterUser = async (data: RegisterUserInput): Promise<RegisteredUser> => {
  const response = await fetch(`${AUTH_BASE_URL}/register-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
