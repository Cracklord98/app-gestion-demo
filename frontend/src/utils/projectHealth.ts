/**
 * Función unificada de salud de proyecto (PMBOK-aligned).
 * Usada en Dashboard, Portafolio y Proyectos para garantizar consistencia.
 *
 * Criterios:
 *  VERDE   — Uso presupuesto < 70% Y proyectado ≤ presupuesto Y margen ≥ 0
 *  AMARILLO — Uso 70-90% O proyectado entre 90-100% del presupuesto O margen < 10%
 *  ROJO    — Uso 90-100% O proyectado > presupuesto O margen < 0
 *  CRÍTICO — Uso > 100% O proyectado > 120% del presupuesto
 */

export type HealthLevel = "VERDE" | "AMARILLO" | "ROJO" | "CRITICO";

export type ProjectHealthResult = {
  nivel: HealthLevel;
  label: string;
  color: string;
  /** Clase CSS pill: "ok" | "warn" | "error" */
  pillClass: "ok" | "warn" | "error";
  /** Icono breve para tablas */
  icon: string;
};

const HEALTH_MAP: Record<HealthLevel, Omit<ProjectHealthResult, "nivel">> = {
  VERDE:    { label: "Verde",   color: "#6bb42d", pillClass: "ok",    icon: "●" },
  AMARILLO: { label: "Amarillo", color: "#f1a323", pillClass: "warn",  icon: "●" },
  ROJO:     { label: "Rojo",    color: "#a8194c", pillClass: "error", icon: "●" },
  CRITICO:  { label: "Crítico", color: "#a8194c", pillClass: "error", icon: "▲" },
};

export function calcularSaludProyecto(params: {
  /** % del presupuesto ya gastado (0-∞) */
  usedBudgetPercent: number;
  /** % del presupuesto cubierto por gasto real + proyectado (0-∞) */
  projectedPct: number;
  /** Margen bruto real en % (null si no disponible) */
  grossMarginActualPct: number | null;
}): ProjectHealthResult {
  const { usedBudgetPercent, projectedPct, grossMarginActualPct } = params;

  let nivel: HealthLevel;

  if (usedBudgetPercent > 100 || projectedPct > 120) {
    nivel = "CRITICO";
  } else if (
    usedBudgetPercent > 90 ||
    projectedPct > 100 ||
    (grossMarginActualPct !== null && grossMarginActualPct < 0)
  ) {
    nivel = "ROJO";
  } else if (
    usedBudgetPercent > 70 ||
    projectedPct > 90 ||
    (grossMarginActualPct !== null && grossMarginActualPct < 10)
  ) {
    nivel = "AMARILLO";
  } else {
    nivel = "VERDE";
  }

  return { nivel, ...HEALTH_MAP[nivel] };
}

/**
 * Convierte el HealthStatus del backend ("GREEN" | "YELLOW" | "RED") al tipo unificado.
 * Usar cuando el dato viene del API y no hay projectedPct disponible.
 */
export function backendHealthToResult(status: "GREEN" | "YELLOW" | "RED"): ProjectHealthResult {
  const map: Record<"GREEN" | "YELLOW" | "RED", HealthLevel> = {
    GREEN: "VERDE",
    YELLOW: "AMARILLO",
    RED: "ROJO",
  };
  const nivel = map[status] ?? "VERDE";
  return { nivel, ...HEALTH_MAP[nivel] };
}

/** Texto del tooltip para mostrar al usuario los criterios de salud */
export const HEALTH_CRITERIA_TOOLTIP =
  "VERDE: uso < 70%, proyectado ≤ 100%, margen ≥ 0% | " +
  "AMARILLO: uso 70-90% o proyectado 90-100% o margen < 10% | " +
  "ROJO: uso 90-100% o proyectado > presupuesto o margen < 0% | " +
  "CRÍTICO: uso > 100% o proyectado > 120% del presupuesto";
