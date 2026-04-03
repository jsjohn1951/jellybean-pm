import { describe, it, expect } from 'vitest';
import { formatIssueId, parseIssueNumber } from './issue-id';

describe('formatIssueId', () => {
  it('pads single digits', () => expect(formatIssueId(1)).toBe('ISS-001'));
  it('pads double digits', () => expect(formatIssueId(42)).toBe('ISS-042'));
  it('does not pad triple digits', () => expect(formatIssueId(100)).toBe('ISS-100'));
  it('handles large numbers', () => expect(formatIssueId(1000)).toBe('ISS-1000'));
});

describe('parseIssueNumber', () => {
  it('parses ISS-001 → 1', () => expect(parseIssueNumber('ISS-001')).toBe(1));
  it('parses ISS-042 → 42', () => expect(parseIssueNumber('ISS-042')).toBe(42));
  it('parses ISS-100 → 100', () => expect(parseIssueNumber('ISS-100')).toBe(100));
});
