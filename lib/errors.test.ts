import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('unwraps a string detail', () => expect(errorMessage(new Error('{"detail":"Customer not found"}'))).toBe('Customer not found'));
  it('unwraps the first message of a 422 list', () => expect(errorMessage(new Error('{"detail":[{"msg":"bad"}]}'))).toBe('bad'));
  it('names the missing placeholders of an object detail', () => {
    const body = JSON.stringify({ detail: { error: 'Prompt is missing required placeholders.', missing_placeholders: ['{{a}}', '{{b}}'] } });
    expect(errorMessage(new Error(body))).toBe('Prompt is missing required placeholders. Missing: {{a}}, {{b}}');
  });
  it('uses the error text of an object detail without placeholders', () => {
    expect(errorMessage(new Error('{"detail":{"error":"nope"}}'))).toBe('nope');
  });
  it('falls back', () => expect(errorMessage(null, 'x')).toBe('x'));
});
