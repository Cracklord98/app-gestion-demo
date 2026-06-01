import { describe, it, expect } from 'vitest';
import { calcDelta } from '../features/dashboard/dashboardUtils';

describe('calcDelta', () => {
  it('returns null when previous is 0', () => {
    expect(calcDelta(100, 0)).toBeNull();
  });

  it('returns "up" when current is significantly higher', () => {
    const result = calcDelta(110, 100);
    expect(result).not.toBeNull();
    expect(result?.dir).toBe('up');
    expect(result?.pct).toBeCloseTo(10, 1);
  });

  it('returns "down" when current is significantly lower', () => {
    const result = calcDelta(90, 100);
    expect(result).not.toBeNull();
    expect(result?.dir).toBe('down');
    expect(result?.pct).toBeCloseTo(10, 1);
  });

  it('returns "flat" when difference is within ±0.5%', () => {
    const result = calcDelta(100.3, 100);
    expect(result).not.toBeNull();
    expect(result?.dir).toBe('flat');
  });

  it('handles negative current value', () => {
    const result = calcDelta(-50, 100);
    expect(result).not.toBeNull();
    expect(result?.dir).toBe('down');
    expect(result?.pct).toBeCloseTo(150, 1);
  });

  it('pct is always positive', () => {
    const result = calcDelta(80, 100);
    expect(result?.pct).toBeGreaterThanOrEqual(0);
  });
});
