/** Format a number as currency using Intl.NumberFormat */
export function fmt(value: number, currency = "USD") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export type DeltaResult = { pct: number; dir: "up" | "down" | "flat" } | null;

export function calcDelta(current: number, previous: number): DeltaResult {
  if (previous === 0) return null;
  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const dir = raw > 0.5 ? "up" : raw < -0.5 ? "down" : "flat";
  return { pct: Math.abs(raw), dir };
}

export function calcEVM(budget: number, ev: number, spent: number, cpi: number | null | undefined) {
  const bac = budget;
  const ac = spent;
  const effectiveCpi = cpi ?? (ac > 0 ? ev / ac : null);
  const eac = effectiveCpi && effectiveCpi > 0 ? bac / effectiveCpi : null;
  const vac = eac != null ? bac - eac : null;
  const cv = ev - ac;
  const tcpi = bac - ac > 0 ? (bac - ev) / (bac - ac) : null;
  return { bac, ev, ac, eac, vac, cv, tcpi };
}
