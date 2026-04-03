import { describe, it, expect } from 'vitest';
import { buildOAuthUrl, generateState } from './oauth';

describe('buildOAuthUrl', () => {
  it('includes client_id, redirect_uri, scope, state', () => {
    const url = buildOAuthUrl('MY_CLIENT', 'https://example.com/cb', 'STATE123');
    expect(url).toContain('client_id=MY_CLIENT');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcb');
    expect(url).toContain('scope=repo');
    expect(url).toContain('state=STATE123');
  });

  it('starts with GitHub authorize URL', () => {
    const url = buildOAuthUrl('id', 'http://cb', 'state');
    expect(url).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);
  });
});

describe('generateState', () => {
  it('returns a 32-char hex string', () => {
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns unique values each call', () => {
    expect(generateState()).not.toBe(generateState());
  });
});
