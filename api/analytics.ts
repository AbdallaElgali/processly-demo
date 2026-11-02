import { apiFetch } from '@/lib/http/apiFetch';
import { config } from './config';
import { analyticsErrorMessage } from '@/lib/analytics/detail';
import type { ProjectMetricsDetail, ProjectMetricsResponse } from './types/analytics';

const BASE = config.api + '/analytics';

/** A non-2xx answer, with the status so a screen can word 404 differently. */
export class AnalyticsError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(analyticsErrorMessage(status));
    this.status = status;
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(url, { signal });
  if (!response.ok) throw new AnalyticsError(response.status);
  return (await response.json()) as T;
}

/** GET /analytics/projects: the portfolio summary and every project's row. */
export const getProjectMetrics = (signal?: AbortSignal) => getJson<ProjectMetricsResponse>(`${BASE}/projects`, signal);

/** GET /analytics/projects/{id}: one project's row plus every approved parameter's outcome. */
export const getProjectMetricsDetail = (projectId: string, signal?: AbortSignal) =>
  getJson<ProjectMetricsDetail>(`${BASE}/projects/${encodeURIComponent(projectId)}`, signal);
