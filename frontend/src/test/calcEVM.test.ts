import { describe, it, expect } from 'vitest';
import { calcEVM } from '../features/dashboard/dashboardUtils';

describe('calcEVM', () => {
  it('computes EAC and VAC when CPI is provided', () => {
    // EV = completionPct × BAC = 80% × 100 = 80; AC = 100; CPI = 0.8
    // EAC = BAC/CPI = 125, VAC = BAC - EAC = -25
    const result = calcEVM(100, 80, 100, 0.8);
    expect(result.bac).toBe(100);
    expect(result.ev).toBe(80);
    expect(result.ac).toBe(100);
    expect(result.eac).toBeCloseTo(125, 1);
    expect(result.vac).toBeCloseTo(-25, 1);
  });

  it('derives CPI from ev/ac when cpi is null', () => {
    // EV=90 (90% complete × BAC 100), AC=100 → CPI=0.9, EAC≈111.11
    const result = calcEVM(100, 90, 100, null);
    expect(result.eac).toBeCloseTo(111.11, 1);
    expect(result.vac).toBeCloseTo(-11.11, 1);
  });

  it('returns null for EAC/VAC when CPI is 0 and ac is 0', () => {
    const result = calcEVM(100, 0, 0, null);
    expect(result.eac).toBeNull();
    expect(result.vac).toBeNull();
  });

  it('returns null for EAC/VAC when provided CPI is 0', () => {
    const result = calcEVM(100, 50, 80, 0);
    expect(result.eac).toBeNull();
    expect(result.vac).toBeNull();
  });

  it('computes positive VAC when project is under budget', () => {
    // CPI=1.2 → EAC=BAC/1.2≈83.33, VAC=100-83.33≈16.67
    const result = calcEVM(100, 120, 100, 1.2);
    expect(result.eac).toBeCloseTo(83.33, 1);
    expect(result.vac).toBeCloseTo(16.67, 1);
  });

  it('CPI=1 means on budget: EAC=BAC, VAC=0', () => {
    const result = calcEVM(100, 100, 100, 1);
    expect(result.eac).toBeCloseTo(100, 1);
    expect(result.vac).toBeCloseTo(0, 1);
  });

  it('computes CV = EV - AC', () => {
    // EV=80, AC=100 → CV=-20 (sobrecosto)
    const result = calcEVM(100, 80, 100, 0.8);
    expect(result.cv).toBeCloseTo(-20, 1);
  });

  it('computes TCPI when budget remains', () => {
    // BAC=100, EV=80, AC=100 → TCPI=(100-80)/(100-100) → null (no hay presupuesto restante)
    const r1 = calcEVM(100, 80, 100, 0.8);
    expect(r1.tcpi).toBeNull();
    // BAC=100, EV=50, AC=60 → TCPI=(100-50)/(100-60)=50/40=1.25
    const r2 = calcEVM(100, 50, 60, null);
    expect(r2.tcpi).toBeCloseTo(1.25, 2);
  });
});
