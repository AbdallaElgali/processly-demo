import { describe, expect, it } from 'vitest';
import { failedJobHint, failedJobText, runningJobText } from './label';
import type { Job } from './types';

const correction = (phase: Job['phase']) =>
  ({ kind: 'correction', phase, payload: { kind: 'correction', parameterKey: 'U_MIN' } }) as unknown as Job;
const extraction = (phase: Job['phase']) =>
  ({ kind: 'extraction', phase, payload: { kind: 'extraction' } }) as unknown as Job;

describe('runningJobText', () => {
  it('says Re-extracting before a correction has any event, never "Routing sections"', () => {
    expect(runningJobText(correction('routing'))).toBe('Re-extracting U_MIN…');
  });
  it('shows the phase once a correction has progressed', () => {
    expect(runningJobText(correction('extracting'))).toBe('Re-extracting U_MIN: Extracting');
  });
  it('keeps "Routing sections" for a blind extraction', () => {
    expect(runningJobText(extraction('routing'))).toBe('Extraction: Routing sections');
  });
});

const failed = (kind: Job['kind'], error?: string) => ({ kind, status: 'failed', error }) as unknown as Job;

describe('failed jobs', () => {
  it('an upload shows its real error text and a hint to add the file again', () => {
    expect(failedJobText(failed('upload', 'Document analysis failed: timeout'))).toBe('Upload failed: Document analysis failed: timeout');
    expect(failedJobHint(failed('upload', 'x'))).toMatch(/add the file again with Add documents/i);
  });
  it('the hint never offers to run an upload again', () => {
    expect(failedJobHint(failed('upload', 'x'))).not.toMatch(/run again|retry/i);
  });
  it('falls back to a plain sentence when no error text was recorded', () => {
    expect(failedJobText(failed('extraction'))).toBe('Extraction failed');
  });
  it('an extraction has no add-file hint', () => {
    expect(failedJobHint(failed('extraction', 'x'))).toBeNull();
  });
});
