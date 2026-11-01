import { describe, expect, it } from 'vitest';
import type { ProjectMetricsDetail, ProjectMetricsResponse } from '@/api/types/analytics';
import overviewJson from './fixtures/backend-projects.json';
import detailJson from './fixtures/backend-project-detail.json';
import { headlineTiles, acceptanceTile, projectCounts, detailTiles } from './headline';
import { chartPoints, originMixPoints } from './charts';
import { tableRows, sortRows } from './table';
import { parameterRows, outcomeOptions, filterByOutcome } from './detail';
import { VIEW_ORDER } from './views';

// Both fixtures are the backend's own example responses, copied verbatim from
// BDA/claude-notes/history/2026-11-01_2221_metrics-views.md (BDA 7ff979b).
const overview = overviewJson as unknown as ProjectMetricsResponse;
const detail = detailJson as unknown as ProjectMetricsDetail;

describe('contract: GET /analytics/projects (backend example)', () => {
  it('feeds the headline tiles, with candidates only on "found" views', () => {
    const [found, first] = headlineTiles(overview.summary);
    expect(found.view).toBe('final_any');
    expect(first.view).toBe('blind_first');
    expect(found.average).toBe(overview.summary.per_project_average.views.final_any.f1);
    expect(found.pooled).toBe(overview.summary.pooled.views.final_any.f1);
    expect(found.avgCandidates).toBe(overview.summary.pooled.views.final_any.avg_candidates);
    expect(first.avgCandidates).toBeNull();
    expect(projectCounts(overview.summary).total).toBe(overview.projects.length);
    expect(acceptanceTile(overview.summary).pooled).toBe(overview.summary.pooled.acceptance_rate);
  });

  it('switches every view without error and the counts follow the view', () => {
    for (const view of VIEW_ORDER) {
      const t = detailTiles(overview.summary, view);
      expect(t.correct).toBe(overview.summary.pooled.views[view].tp);
      expect(t.wrong).toBe(overview.summary.pooled.views[view].fp);
      expect(t.missed).toBe(overview.summary.pooled.views[view].fn);
      expect(chartPoints(overview.projects, view, 'all', true)).toHaveLength(
        overview.projects.filter((p) => p.approval_state === 'approved').length,
      );
      expect(tableRows(overview.projects, view)).toHaveLength(overview.projects.length);
    }
  });

  it('builds chart data keyed by project id, plus the origin mix', () => {
    const points = chartPoints(overview.projects, 'final_any', 'last5', false);
    expect(points.map((p) => p.projectId)).toEqual(overview.projects.map((p) => p.project_id));
    expect(points.every((p) => typeof p.approvedDate === 'string' && p.approvedDate.length === 10)).toBe(true);
    expect(originMixPoints(overview.projects, 'all')).toHaveLength(overview.projects.length);
  });

  it('builds sortable table rows', () => {
    const rows = tableRows(overview.projects, 'final_any');
    expect(sortRows(rows, 'f1', 'desc')).toHaveLength(rows.length);
    expect(sortRows(rows, 'leftOut', 'asc')).toHaveLength(rows.length);
  });
});

describe('contract: GET /analytics/projects/{id} (backend example)', () => {
  it('feeds the parameter table with outcomes for all four views', () => {
    expect(detail.parameters.length).toBeGreaterThan(0);
    const rows = parameterRows(detail.parameters);
    expect(rows).toHaveLength(detail.parameters.length);
    for (const r of rows) {
      for (const v of VIEW_ORDER) expect(r.outcomes[v]).toBeTruthy();
    }
  });

  it('offers only outcomes that occur and filters by them in every view', () => {
    for (const view of VIEW_ORDER) {
      const options = outcomeOptions(detail.parameters, view);
      expect(options.length).toBeGreaterThan(0);
      const total = options.reduce((n, o) => n + filterByOutcome(detail.parameters, view, o.value).length, 0);
      expect(total).toBe(detail.parameters.length);
    }
  });

  it('renders the detail row like the table does, and every matched candidate as text', () => {
    expect(tableRows([detail], 'final_any')).toHaveLength(1);
    for (const r of parameterRows(detail.parameters)) expect(typeof r.matched).toBe('string');
  });
});
