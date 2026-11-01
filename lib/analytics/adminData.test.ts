import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('AdminData', () => {
  const src = readFileSync(new URL('../../hooks/AdminData.tsx', import.meta.url), 'utf8');
  it('no longer computes the overview numbers from /audit/projects', () => {
    expect(src).not.toMatch(/f1Score|avgF1|avgAcceptanceRate|dashboardData|\.slice\(0, 5\)|substring\(0, 10\)/);
  });
  it('still serves the sidebar list from /audit/projects and the feedback list', () => {
    expect(src).toMatch(/\/audit\/projects/);
    expect(src).toMatch(/fetch_all_feedback/);
  });
});
