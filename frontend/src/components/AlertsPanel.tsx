import { useState } from "react";
import { resolveAlert, type AppAlert } from "../services/api";

type AlertGroup = {
  key: string;
  label: string;
  icon: string;
  items: AppAlert[];
};

const TYPE_GROUPS: { types: string[]; key: string; label: string; icon: string }[] = [
  { key: "budget",   types: ["BUDGET_EXCEEDED", "BUDGET_WARNING"],     label: "Presupuesto",          icon: "💰" },
  { key: "cpi",      types: ["FORECAST_DEVIATION"],                     label: "CPI / Desviación",     icon: "📉" },
  { key: "margin",   types: ["MARGIN_BELOW_THRESHOLD"],                 label: "Margen bajo umbral",   icon: "⚠️" },
  { key: "assign",   types: ["ASSIGNMENT_ENDING"],                      label: "Asignaciones",         icon: "👤" },
  { key: "capacity", types: ["CONSULTANT_OVERLOADED"],                  label: "Capacidad",            icon: "🔴" },
  { key: "other",    types: [],                                          label: "Otras alertas",        icon: "🔔" },
];

function groupAlerts(alerts: AppAlert[]): AlertGroup[] {
  const buckets: Record<string, AppAlert[]> = {};
  for (const g of TYPE_GROUPS) buckets[g.key] = [];

  for (const alert of alerts) {
    const matched = TYPE_GROUPS.find((g) => g.types.includes(alert.type));
    const key = matched ? matched.key : "other";
    buckets[key].push(alert);
  }

  return TYPE_GROUPS
    .filter((g) => buckets[g.key].length > 0)
    .map((g) => ({ key: g.key, label: g.label, icon: g.icon, items: buckets[g.key] }));
}

const SEV_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  CRITICAL: { bg: "#fee2e2", color: "#991b1b", label: "Crítico" },
  WARNING:  { bg: "#fef9c3", color: "#92400e", label: "Advertencia" },
  INFO:     { bg: "#eff6ff", color: "#1d4ed8", label: "Info" },
};

export function AlertsPanel({
  alerts,
  unreadCount,
  canRun,
  onReload,
  onError,
}: {
  alerts: AppAlert[];
  unreadCount: number;
  canRun: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["budget", "cpi"]));

  async function handleResolve(id: string) {
    try {
      await resolveAlert(id);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo resolver la alerta");
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar alertas");
    } finally {
      setRunning(false);
    }
  }

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const groups = groupAlerts(alerts);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen(true)}
        style={{ position: "relative" }}
        aria-label={`Alertas, ${unreadCount} activas`}
      >
        🔔 Alertas
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: "-4px", right: "-6px",
              background: "#dc2626", color: "#fff",
              borderRadius: "9999px", fontSize: "0.62rem", fontWeight: 800,
              minWidth: "1.15rem", height: "1.15rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 0.2rem", lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)",
            zIndex: 300,
          }}
        />
      )}

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Panel de alertas"
        aria-modal="true"
        style={{
          position: "fixed", top: 0, right: open ? 0 : "-26rem",
          width: "min(25rem, 100vw)", height: "100dvh",
          background: "#fffdf9", borderLeft: "1px solid #f4d4b6",
          boxShadow: "-6px 0 28px rgba(15,23,42,0.14)",
          zIndex: 301, display: "flex", flexDirection: "column",
          transition: "right 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "1rem 1.25rem", borderBottom: "1px solid #f4d4b6",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#fff8f0",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#5f2f00" }}>
              🔔 Alertas activas
            </h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#9a4f0f" }}>
              {unreadCount} sin resolver
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {canRun && (
              <button
                type="button" className="ghost"
                onClick={() => void handleRun()}
                disabled={running}
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
              >
                {running ? "Actualizando…" : "↺ Actualizar"}
              </button>
            )}
            <button
              type="button"
              className="ghost"
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel de alertas"
              style={{ fontSize: "1.1rem", padding: "0.2rem 0.5rem", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
          {groups.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#9a4f0f" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
              <p style={{ fontWeight: 700 }}>Sin alertas activas</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key} style={{ marginBottom: "0.75rem" }}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between", background: "#fff4ea",
                    border: "1px solid #f4d4b6", borderRadius: "8px",
                    padding: "0.5rem 0.75rem", cursor: "pointer",
                    color: "#5f2f00", fontWeight: 700, fontSize: "0.82rem",
                  }}
                  aria-expanded={expanded.has(group.key)}
                >
                  <span>{group.icon} {group.label} ({group.items.length})</span>
                  <span style={{ fontSize: "0.65rem" }}>{expanded.has(group.key) ? "▲" : "▼"}</span>
                </button>

                {/* Alerts */}
                {expanded.has(group.key) && (
                  <div style={{ marginTop: "0.3rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {group.items.map((alert) => {
                      const sev = SEV_COLOR[alert.severity] ?? SEV_COLOR.INFO;
                      return (
                        <div
                          key={alert.id}
                          style={{
                            padding: "0.6rem 0.75rem", borderRadius: "8px",
                            background: sev.bg, border: `1px solid ${sev.color}30`,
                            display: "flex", gap: "0.5rem", alignItems: "flex-start",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.2rem", flexWrap: "wrap" }}>
                              <span style={{
                                background: sev.color, color: "#fff",
                                borderRadius: "9999px", fontSize: "0.6rem",
                                fontWeight: 800, padding: "0.1rem 0.4rem",
                              }}>
                                {sev.label}
                              </span>
                              {alert.project && (
                                <span style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>
                                  {alert.project.name}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "#374151", lineHeight: 1.4 }}>
                              {alert.message}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => void handleResolve(alert.id)}
                            style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            Resolver
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
