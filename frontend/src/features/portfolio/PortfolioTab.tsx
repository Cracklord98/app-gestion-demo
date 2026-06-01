import { useState } from "react";
import { type HealthStatus } from "../../services/api";
import { usePortfolio } from "../../hooks/usePortfolio";
import { backendHealthToResult, HEALTH_CRITERIA_TOOLTIP } from "../../utils/projectHealth";
import { PROJECT_STATUS_LABELS, label } from "../../utils/statusLabels";

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function RagBadge({ status }: { status: HealthStatus }) {
  const result = backendHealthToResult(status);
  return (
    <span
      style={{
        display: "inline-block", padding: "0.15rem 0.55rem", borderRadius: "9999px",
        background: result.color, color: "#fff", fontWeight: 700, fontSize: "0.7rem",
      }}
      title={HEALTH_CRITERIA_TOOLTIP}
    >
      {result.label}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: "var(--bg-card, #fff)", border: "1px solid #e5e7eb", borderRadius: "0.5rem",
      padding: "1rem 1.25rem", minWidth: "10rem", flex: "1 1 10rem",
    }}>
      <div style={{ fontSize: "0.68rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: accent ?? "inherit" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

function HealthSummaryBar({ green, yellow, red, total }: { green: number; yellow: number; red: number; total: number }) {
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", height: "1.2rem", borderRadius: "0.35rem", overflow: "hidden", width: "100%" }}>
      {green > 0 && (
        <div style={{ flex: green, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#fff", fontWeight: 700 }}>
          {green}
        </div>
      )}
      {yellow > 0 && (
        <div style={{ flex: yellow, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#fff", fontWeight: 700 }}>
          {yellow}
        </div>
      )}
      {red > 0 && (
        <div style={{ flex: red, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "#fff", fontWeight: 700 }}>
          {red}
        </div>
      )}
    </div>
  );
}

function BudgetBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100);
  const color = pct > 100 ? "#ef4444" : pct > 90 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: "8rem" }}>
      <div style={{ flex: 1, height: "0.45rem", background: "#e5e7eb", borderRadius: "9999px", overflow: "hidden" }}>
        <div style={{ width: `${capped}%`, height: "100%", background: color }} />
      </div>
      <span style={{ fontSize: "0.65rem", color: "#6b7280", whiteSpace: "nowrap" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

type SortField = "healthStatus" | "usedBudgetPercent" | "completionPct" | "grossMarginActualPct" | "openHighRisks";
type SortDir = "asc" | "desc";

function PortfolioSortTh({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() => onSort(field)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label} {active ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
    </th>
  );
}

export function PortfolioTab({
  onOpenProject,
}: {
  canWrite?: boolean;
  onOpenProject?: (id: string) => void;
}) {
  const { portfolio, loading, error, reload } = usePortfolio(true);
  const [healthFilter, setHealthFilter] = useState<HealthStatus | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("healthStatus");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (loading) return <div className="loading" style={{ padding: "2rem" }}>Cargando portafolio…</div>;
  if (error) return <div style={{ padding: "2rem", color: "#ef4444" }}>{error}</div>;
  if (!portfolio) return null;

  const { summary, projects, baseCurrency } = portfolio;

  // Filter & sort
  const filtered = projects.filter((p) => {
    const matchSearch = !search.trim() ||
      p.projectName.toLowerCase().includes(search.toLowerCase()) ||
      p.company.toLowerCase().includes(search.toLowerCase());
    const matchHealth = !healthFilter || p.healthStatus === healthFilter;
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchHealth && matchStatus;
  });

  const healthOrder: Record<HealthStatus, number> = { RED: 0, YELLOW: 1, GREEN: 2 };

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number;
    if (sortField === "healthStatus") {
      av = healthOrder[a.healthStatus];
      bv = healthOrder[b.healthStatus];
    } else if (sortField === "grossMarginActualPct") {
      av = a.grossMarginActualPct ?? -999;
      bv = b.grossMarginActualPct ?? -999;
    } else {
      av = a[sortField] as number;
      bv = b[sortField] as number;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function exportCsv() {
    const header = ["Proyecto", "Empresa", "Tipo", "Estado", "Salud", "Uso%", "Avance%", "CPI", "SPI", "Margen%", "Riesgos altos", "Incidentes abiertos"];
    const rows = sorted.map((p) => [
      p.projectName,
      p.company,
      p.projectType,
      p.status,
      p.healthStatus,
      p.usedBudgetPercent.toFixed(1),
      p.completionPct.toFixed(1),
      p.evm?.cpi != null ? p.evm.cpi.toFixed(2) : "",
      p.evm?.spi != null ? p.evm.spi.toFixed(2) : "",
      p.grossMarginActualPct != null ? p.grossMarginActualPct.toFixed(1) : "",
      String(p.openHighRisks),
      String(p.openIssues),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portafolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Critical projects
  const critical = projects.filter((p) => p.healthStatus === "RED").slice(0, 5);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Portafolio PMO</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="ghost" onClick={() => void reload()} style={{ fontSize: "0.8rem" }}>
            ↺ Actualizar
          </button>
          <button type="button" onClick={exportCsv} style={{ fontSize: "0.8rem" }}>
            ↓ Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <KpiCard label="Total proyectos" value={summary.totalProjects} />
        <KpiCard label="Presupuesto total" value={fmt(summary.totalBudget, baseCurrency)} sub={baseCurrency} />
        <KpiCard label="Ejecutado total" value={fmt(summary.totalSpent, baseCurrency)} />
        <KpiCard label="Ingresos totales" value={fmt(summary.totalRevenue, baseCurrency)} />
        <KpiCard label="Margen bruto" value={fmt(summary.totalGrossMargin, baseCurrency)} accent={summary.totalGrossMargin < 0 ? "#ef4444" : "#16a34a"} />
        <KpiCard label="Proyectos críticos" value={summary.criticalCount} accent={summary.criticalCount > 0 ? "#ef4444" : undefined} sub="RAG = Rojo" />
        <KpiCard label="Alertas activas" value={summary.alertCount} accent={summary.alertCount > 0 ? "#f59e0b" : undefined} />
      </div>

      {/* Health breakdown bar */}
      <div style={{ background: "var(--bg-card, #fff)", border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.75rem" }}>
          <span style={{ fontWeight: 600 }}>Distribución de salud</span>
          <span style={{ color: "#6b7280" }}>
            🟢 {summary.byHealth.GREEN} &nbsp; 🟡 {summary.byHealth.YELLOW} &nbsp; 🔴 {summary.byHealth.RED}
          </span>
        </div>
        <HealthSummaryBar green={summary.byHealth.GREEN} yellow={summary.byHealth.YELLOW} red={summary.byHealth.RED} total={summary.totalProjects} />
      </div>

      {/* Critical projects alert box */}
      {critical.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
          <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
            Proyectos en estado crítico (RAG Rojo)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {critical.map((p) => (
              <button
                key={p.projectId}
                type="button"
                style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.35rem", padding: "0.2rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "#dc2626", fontWeight: 600 }}
                onClick={() => onOpenProject?.(p.projectId)}
              >
                {p.projectName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          placeholder="Buscar proyecto o empresa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "2 1 16rem" }}
        />
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as HealthStatus | "")} style={{ flex: "0 0 auto" }}>
          <option value="">Salud: Todos</option>
          <option value="GREEN">Verde</option>
          <option value="YELLOW">Amarillo</option>
          <option value="RED">Rojo</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: "0 0 auto" }}>
          <option value="">Estado: Todos</option>
          <option value="ACTIVE">Activo</option>
          <option value="PAUSED">Pausado</option>
          <option value="CLOSED">Cerrado</option>
        </select>
      </div>

      {/* Heatmap table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <PortfolioSortTh field="healthStatus" label="Salud" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <th>Proyecto</th>
              <th>Empresa</th>
              <th>Tipo</th>
              <th>Estado</th>
              <PortfolioSortTh field="usedBudgetPercent" label="Uso presupuesto" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <PortfolioSortTh field="completionPct" label="Avance" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <th>CPI</th>
              <th>SPI</th>
              <PortfolioSortTh field="grossMarginActualPct" label="Margen %" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <PortfolioSortTh field="openHighRisks" label="Riesgos altos" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <th>Incidentes abiertos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} style={{ textAlign: "center", color: "#9ca3af" }}>Sin proyectos</td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr key={p.projectId} style={{ background: p.healthStatus === "RED" ? "#fff5f5" : p.healthStatus === "YELLOW" ? "#fffbeb" : "inherit" }}>
                <td><RagBadge status={p.healthStatus} /></td>
                <td style={{ fontWeight: 600 }}>{p.projectName}</td>
                <td>{p.company}</td>
                <td style={{ fontSize: "0.75rem" }}>
                  {p.projectType === "TIME_AND_MATERIAL" ? "T&M" : p.projectType === "FIXED_PRICE" ? "FP" : "Staff"}
                </td>
                <td>
                  <span className={`pill ${p.status === "ACTIVE" ? "ok" : p.status === "PAUSED" ? "warn" : "neutral"}`} style={{ fontSize: "0.7rem" }}>
                    {label(PROJECT_STATUS_LABELS, p.status)}
                  </span>
                </td>
                <td><BudgetBar pct={p.usedBudgetPercent} /></td>
                <td><BudgetBar pct={p.completionPct} /></td>
                <td style={{ fontWeight: 600, color: p.evm?.cpi != null ? (p.evm.cpi < 0.85 ? "#ef4444" : p.evm.cpi < 1 ? "#f59e0b" : "#22c55e") : "#9ca3af" }}>
                  {p.evm?.cpi != null ? p.evm.cpi.toFixed(2) : "—"}
                </td>
                <td style={{ fontWeight: 600, color: p.evm?.spi != null ? (p.evm.spi < 0.85 ? "#ef4444" : p.evm.spi < 1 ? "#f59e0b" : "#22c55e") : "#9ca3af" }}>
                  {p.evm?.spi != null ? p.evm.spi.toFixed(2) : "—"}
                </td>
                <td style={{ color: p.grossMarginActualPct != null ? (p.grossMarginActualPct < 0 ? "#ef4444" : p.grossMarginActualPct < 15 ? "#f59e0b" : "#22c55e") : "#9ca3af", fontWeight: 600 }}>
                  {p.grossMarginActualPct != null ? `${p.grossMarginActualPct.toFixed(1)}%` : "—"}
                </td>
                <td style={{ textAlign: "center", color: p.openHighRisks > 0 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                  {p.openHighRisks}
                </td>
                <td style={{ textAlign: "center", color: p.openIssues > 0 ? "#f59e0b" : "#22c55e" }}>
                  {p.openIssues}
                </td>
                <td>
                  {onOpenProject && (
                    <button type="button" style={{ fontSize: "0.75rem" }} onClick={() => onOpenProject(p.projectId)}>
                      Ver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
          {sorted.length} de {projects.length} proyectos · Moneda base: {baseCurrency}
        </span>
        {sorted.length > 0 && (
          <button type="button" className="ghost" onClick={exportCsv} style={{ fontSize: "0.7rem" }}>
            Exportar {sorted.length} filas como CSV
          </button>
        )}
      </div>
    </section>
  );
}
