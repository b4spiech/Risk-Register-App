import { describe, expect, it } from 'vitest';
import { getSeverity, worstSeverity } from './severity';

describe('getSeverity', () => {
  it('returns Green for low scores', () => {
    expect(getSeverity(1, 1)).toBe('Green');
    expect(getSeverity(2, 3)).toBe('Green');
    expect(getSeverity(3, 2)).toBe('Green');
  });

  it('returns Yellow in the 7-14 band', () => {
    expect(getSeverity(2, 4)).toBe('Yellow'); // 8
    expect(getSeverity(3, 3)).toBe('Yellow'); // 9
    expect(getSeverity(4, 3)).toBe('Yellow'); // 12
  });

  it('returns Red for scores >= 15', () => {
    expect(getSeverity(3, 5)).toBe('Red');
    expect(getSeverity(4, 4)).toBe('Red');
    expect(getSeverity(5, 5)).toBe('Red');
  });

  it('forces Red when Impact is 5 (catastrophic override)', () => {
    expect(getSeverity(1, 5)).toBe('Red');
    expect(getSeverity(2, 5)).toBe('Red');
  });
});

describe('worstSeverity', () => {
  it('returns null for empty input', () => {
    expect(worstSeverity([])).toBeNull();
  });

  it('picks the highest band', () => {
    expect(worstSeverity(['Green', 'Yellow', 'Green'])).toBe('Yellow');
    expect(worstSeverity(['Green', 'Yellow', 'Red'])).toBe('Red');
    expect(worstSeverity(['Green', 'Green'])).toBe('Green');
  });
});
