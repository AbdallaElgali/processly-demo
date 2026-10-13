import { describe, expect, it } from 'vitest';
import { uploadErrorText } from './upload-error';

const json = (o: unknown) => JSON.stringify(o);

describe('uploadErrorText (backend U1 error bodies)', () => {
  it('shows the detail the backend now sends', () => {
    const text = 'Upload failed: ConnectionDoesNotExistError: x';
    expect(uploadErrorText(500, json({ detail: text, message: text }))).toBe(text);
  });
  it('names the step and exception of an all-failed upload', () => {
    const text = 'All document uploads failed. a.pdf: grouping failed: TimeoutError: model did not answer';
    expect(uploadErrorText(500, json({ detail: text, message: text, errors: [] }))).toBe(text);
  });
  it('falls back to message when there is no detail', () => {
    expect(uploadErrorText(500, json({ message: 'All document uploads failed' }))).toBe('All document uploads failed');
  });
  it('reads the 404 and 422 texts', () => {
    expect(uploadErrorText(404, json({ detail: 'Project abc not found' }))).toBe('Project abc not found');
    expect(uploadErrorText(422, json({ detail: "project_id must be a project UUID, got 'T4'" }))).toContain('project UUID');
  });
  it('reads a FastAPI validation list', () => {
    expect(uploadErrorText(422, json({ detail: [{ msg: 'Field required', loc: ['body', 'files'] }] }))).toBe('Field required');
  });
  it('shows a plain-text body as written', () => {
    expect(uploadErrorText(500, 'Internal Server Error')).toBe('Internal Server Error');
  });
  it('never returns the old generic sentence, and names the status when the body is empty', () => {
    expect(uploadErrorText(502, '')).toBe('Upload failed (HTTP 502).');
    expect(uploadErrorText(500, json({ error: 'Failed to build dynamic schema' }))).toBe('Failed to build dynamic schema');
    expect(uploadErrorText(500, json({}))).not.toMatch(/Failed to upload batch/);
  });
});
