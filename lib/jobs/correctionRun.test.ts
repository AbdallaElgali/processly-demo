import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SseEvent } from './sse-types';

let script: SseEvent[] = [];
vi.mock('./sse', () => ({
  openSseStream: vi.fn(async () => ({})),
  readSseStream: async function* () {
    for (const event of script) yield event;
  },
}));

import { createJob } from './runtime';
import { runCorrection, runExtraction } from './runners';

vi.mock('@/lib/db', () => ({
  savePendingFiles: vi.fn(),
  loadPendingFiles: vi.fn(),
  deletePendingFiles: vi.fn(),
  sweepPendingFiles: vi.fn(),
}));

const outcomes = [
  { parameter: 'U_MAX', project_parameter_id: 'pp-1', outcome: 'new_value', correction_id: 'k-1', previous_candidate_id: 'c-old', new_candidate_id: 'c-new' },
  { parameter: 'I_MAX', project_parameter_id: 'pp-2', outcome: 'confirmed', correction_id: 'k-2', previous_candidate_id: 'c-i', new_candidate_id: 'c-i2' },
  { parameter: 'U_MIN', project_parameter_id: 'pp-3', outcome: 'no_new_value', correction_id: 'k-3', previous_candidate_id: 'c-u', new_candidate_id: null },
];

const batchJob = () => createJob('p1', { kind: 'extraction', mode: 'ITERATIVE', previousSpecs: { U_MAX: [] } });
const ctx = () => {
  const emitted: SseEvent[] = [];
  return { emitted, ctx: { signal: new AbortController().signal, emit: (e: SseEvent) => void emitted.push(e) } };
};

beforeEach(() => {
  script = [];
});

describe('batch correction stream', () => {
  it('collects the outcomes from the terminal complete event', async () => {
    script = [
      { status: 'partial_correction', parameter: 'U_MAX', specs: {} },
      { status: 'complete', final_specs: {}, flag_chain: {}, discarded_count: 0, correction_outcomes: outcomes },
    ];
    const { ctx: c } = ctx();
    const result = await runExtraction(batchJob(), c, 'u1');
    expect(result.ok).toBe(true);
    expect(result.corrections?.map((o) => o.outcome)).toEqual(['new_value', 'confirmed', 'no_new_value']);
  });

  it('a per-parameter error does not end the run or hide the other parameters', async () => {
    script = [
      { status: 'error', parameter: 'I_MAX', message: 'No document mentions this value.' },
      { status: 'partial_correction', parameter: 'U_MAX', specs: {} },
      { status: 'complete', final_specs: {}, flag_chain: {}, correction_outcomes: [outcomes[0], outcomes[2]] },
    ];
    const { ctx: c, emitted } = ctx();
    const result = await runExtraction(batchJob(), c, 'u1');
    expect(result.ok).toBe(true);
    expect(result.parameterErrors).toEqual({ I_MAX: 'No document mentions this value.' });
    expect(result.corrections).toHaveLength(2);
    // The timeline must not flip to "failed" for one parameter.
    expect(emitted.some((e) => e.status === 'error')).toBe(false);
  });

  it('an error with no parameter is still a failed run', async () => {
    script = [{ status: 'error', message: 'The analysis failed.' }];
    const { ctx: c } = ctx();
    const result = await runExtraction(batchJob(), c, 'u1');
    expect(result).toMatchObject({ ok: false, error: 'The analysis failed.' });
  });
});

describe('single-parameter correction stream', () => {
  const job = () =>
    createJob('p1', { kind: 'correction', parameterKey: 'U_MAX', previousMetrics: [], userHint: 'x' });

  it('reads its one outcome', async () => {
    script = [
      { status: 'complete', scope: 'SINGLE_PARAM', parameter: 'U_MAX', final_specs: {}, flag_chain: {}, discarded_count: 0, correction_outcomes: [outcomes[0]] },
    ];
    const { ctx: c } = ctx();
    const result = await runCorrection(job(), c, 'u1');
    expect(result.ok).toBe(true);
    expect(result.corrections).toHaveLength(1);
  });

  it('keeps an error event terminal, with the backend message', async () => {
    script = [{ status: 'error', parameter: 'U_MAX', message: 'Nothing to correct.' }];
    const { ctx: c } = ctx();
    const result = await runCorrection(job(), c, 'u1');
    expect(result).toMatchObject({ ok: false, error: 'Nothing to correct.' });
  });
});
