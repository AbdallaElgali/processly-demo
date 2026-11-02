import { describe, expect, it } from 'vitest';
import { LOGIN_EXPIRED_MESSAGE, LOGIN_EXPIRED_URL } from './session';

describe('expired session', () => {
  it('sends the person to the login page with the message', () => {
    expect(LOGIN_EXPIRED_URL).toBe('/login?expired=1');
    expect(LOGIN_EXPIRED_MESSAGE).toBe('Please log in again.');
  });
});
