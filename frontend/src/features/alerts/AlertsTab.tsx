import { useState, useMemo } from "react";
import { PageHeader } from "../../components/PageHeader";
import { resolveAlert, runAlertEngine, type AppAlert } from "../../services/api";

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

export function AlertsTab({
  alerts,
  unreadCount,
  loading,
  canRun,
  onReload,
  onError,
}: {
  alerts: AppAlert[];
  unreadCount: number;
  loading: boolean;
  canRun: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

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
      await runAlertEngine();
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al ejecutar el motor de alertas");
    } finally {
      setRunning(false);
    }
  }

  // Filter alerts by search query and severity
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q ||
        alert.message.toLowerCase().includes(q) ||
        (alert.project && alert.project.name.toLowerCase().includes(q));
      
      const matchesSeverity = !severityFilter || alert.severity === severityFilter;
      
      return matchesSearch && matchesSeverity;
    });
  }, [alerts, search, severityFilter]);

  const groups = groupAlerts(filteredAlerts);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        icon="🔔"
        title="Centro de Alertas"
        description="Bandeja de entrada de notificaciones del sistema sobre desvíos presupuestarios y horas extras."
        actions={
          <>
            {canRun && (
              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={running || loading}
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px" }}
              >
                {running ? "Procesando motor…" : "⚡ Ejecutar motor de alertas"}
              </button>
            )}
            <button
              type="button"
              className="ghost"
              onClick={() => void onReload()}
              disabled={loading}
              style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px" }}
            >
              {loading ? "Actualizando…" : "↺ Actualizar"}
            </button>
          </>
        }
      />

      {/* KPI stats bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{
          background: "var(--bg-card, #fff)", border: "1px solid #f4d4b6", borderRadius: "0.5rem",
          padding: "1rem 1.25rem", minWidth: "10rem", flex: "1 1 10rem",
        }}>
          <div style={{ fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Alertas activas</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: unreadCount > 0 ? "#dc2626" : "#16a34a" }}>{unreadCount}</div>
          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.15rem" }}>Pendientes de resolución</div>
        </div>

        <div style={{
          background: "var(--bg-card, #fff)", border: "1px solid #f4d4b6", borderRadius: "0.5rem",
          padding: "1rem 1.25rem", minWidth: "10rem", flex: "1 1 10rem",
        }}>
          <div style={{ fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Alertas Críticas</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#991b1b" }}>
            {alerts.filter(a => a.severity === "CRITICAL").length}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.15rem" }}>Prioridad alta</div>
        </div>

        <div style={{
          background: "var(--bg-card, #fff)", border: "1px solid #f4d4b6", borderRadius: "0.5rem",
          padding: "1rem 1.25rem", minWidth: "10rem", flex: "1 1 10rem",
        }}>
          <div style={{ fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>Advertencias</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#92400e" }}>
            {alerts.filter(a => a.severity === "WARNING").length}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.15rem" }}>Riesgo moderado</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por proyecto o mensaje de alerta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "2 1 16rem" }}
        />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{ flex: "0 0 auto", minWidth: "10rem" }}
        >
          <option value="">Severidad: Todas</option>
          <option value="CRITICAL">Crítico</option>
          <option value="WARNING">Advertencia</option>
          <option value="INFO">Informativo</option>
        </select>
      </div>

      {/* Alerts Board */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {groups.length === 0 ? (
          <div className="alert-empty-state" style={{
            background: "#fff", border: "1px solid #f4d4b6", borderRadius: "14px",
            padding: "3rem 1rem", textAlign: "center", color: "#5f2f00"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎉</div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>¡Todo al día!</h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
              No hay alertas activas que coincidan con la búsqueda.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.key} style={{
              background: "#fff", border: "1px solid #f4d4b6", borderRadius: "14px",
              padding: "1rem 1.25rem", boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)"
            }}>
              {/* Category Header */}
              <h3 style={{
                margin: "0 0 0.75rem", fontSize: "0.95rem", color: "#5f2f00",
                display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700
              }}>
                <span>{group.icon}</span>
                <span>{group.label}</span>
                <span style={{
                  fontSize: "0.75rem", background: "#fff3e8", color: "#9a3412",
                  padding: "0.1rem 0.5rem", borderRadius: "99px", fontWeight: 600
                }}>
                  {group.items.length}
                </span>
              </h3>

              {/* Category List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {group.items.map((alert) => {
                  const sev = SEV_COLOR[alert.severity] ?? SEV_COLOR.INFO;
                  return (
                    <div
                      key={alert.id}
                      className={`alert-card sev-${alert.severity.toLowerCase()}`}
                      style={{
                        padding: "0.75rem 1rem", borderRadius: "10px",
                        background: sev.bg, border: `1px solid ${sev.color}25`,
                        display: "flex", gap: "1rem", alignItems: "center",
                        justifyContent: "space-between", flexWrap: "wrap"
                      }}
                    >
                      <div style={{ flex: "1 1 20rem", minWidth: 0 }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                          <span style={{
                            background: sev.color, color: "#fff",
                            borderRadius: "9999px", fontSize: "0.65rem",
                            fontWeight: 800, padding: "0.15rem 0.5rem",
                          }}>
                            {sev.label}
                          </span>
                          {alert.project && (
                            <span className="alert-project-name" style={{ fontSize: "0.8rem", color: "#5f2f00", fontWeight: 700 }}>
                              {alert.project.name}
                            </span>
                          )}
                          <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
                            {new Date(alert.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="alert-message-text" style={{ margin: 0, fontSize: "0.85rem", color: "#374151", lineHeight: 1.4, fontWeight: 500 }}>
                          {alert.message}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => void handleResolve(alert.id)}
                          style={{ fontSize: "0.78rem", padding: "0.4rem 0.8rem", background: "#fff", fontWeight: 700 }}
                        >
                          ✓ Resolver
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
