import { describe, expect, it } from 'vitest';
import { buildCreateInput, canCreateProject } from './create';
import { errorMessage } from '@/lib/errors';

const ok = { alias: 'Cell A', customerId: 'c-1', userId: 'u-1', templateId: 't-1', description: ' note ' };

describe('canCreateProject (backend 3.13: the customer is mandatory)', () => {
  it('needs a name, a customer and a signed-in user', () => {
    expect(canCreateProject(ok)).toBe(true);
    expect(canCreateProject({ ...ok, customerId: '' })).toBe(false);
    expect(canCreateProject({ ...ok, alias: '   ' })).toBe(false);
    expect(canCreateProject({ ...ok, userId: null })).toBe(false);
  });
});

describe('buildCreateInput', () => {
  it('always sends customer_id as a string', () => {
    const input = buildCreateInput(ok);
    expect(input.customer_id).toBe('c-1');
    expect(typeof input.customer_id).toBe('string');
    expect(input).toEqual({ alias_id: 'Cell A', description: 'note', customer_id: 'c-1', user_id: 'u-1', template_id: 't-1' });
  });
  it('sends no template when none is chosen, still with the customer', () => {
    expect(buildCreateInput({ ...ok, templateId: '' }).template_id).toBeNull();
  });
  it('refuses to build without a customer or user rather than send null', () => {
    expect(() => buildCreateInput({ ...ok, customerId: '' })).toThrow(/customer/i);
    expect(() => buildCreateInput({ ...ok, userId: null })).toThrow(/signed in/i);
  });
});

describe('a stale customer id', () => {
  it("shows the backend's 422 detail text", () => {
    const body = JSON.stringify({ detail: 'Unknown customer_id 9f1c' });
    expect(errorMessage(new Error(body))).toBe('Unknown customer_id 9f1c');
  });
});
