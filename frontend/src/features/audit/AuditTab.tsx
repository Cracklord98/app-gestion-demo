import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { listAuditLogs, type AuditLog } from "../../services/api";

export function AuditTab({ onError }: { onError: (msg: string) => void }) {
  const [filters, setFilters] = useState({
    entity: "",
    changedBy: "",
    from: "",
    to: "",
    page: 1,
  });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 50, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  async function loadLogs(page = 1) {
    setLoading(true);
    try {
      const result = await listAuditLogs({
        entity: filters.entity || undefined,
        changedBy: filters.changedBy || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
      });
      setLogs(result.data);
      setMeta(result.meta);
      setFilters((p) => ({ ...p, page }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo cargar el log de auditoría");
    } finally {
      setLoading(false);
    }
  }

  const actionColor = (action: AuditLog["action"]) => {
    if (action === "CREATE") return "ok";
    if (action === "DELETE") return "error";
    return "warn";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        icon="⊛"
        title="Bitácora de Auditoría"
        description="Consulta el historial de acciones y cambios realizados por los usuarios en la plataforma."
      />
      <section className="grid">
      <article className="card">
        <h3>Log de Auditoría</h3>
        <div className="form-grid filters-grid" style={{ marginBottom: "0.75rem" }}>
          <input
            placeholder="Entidad (ej. Project, Forecast)"
            value={filters.entity}
            onChange={(e) => setFilters((p) => ({ ...p, entity: e.target.value }))}
          />
          <input
            placeholder="Modificado por"
            value={filters.changedBy}
            onChange={(e) => setFilters((p) => ({ ...p, changedBy: e.target.value }))}
          />
          <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
          <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
          <button type="button" onClick={() => void loadLogs(1)}>
            {loading ? "Cargando…" : "Consultar"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setFilters({ entity: "", changedBy: "", from: "", to: "", page: 1 });
              setLogs([]);
            }}
          >
            Limpiar
          </button>
        </div>

        {logs.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Entidad</th>
                    <th>Acción</th>
                    <th>ID</th>
                    <th>Modificado por</th>
                    <th>Fecha</th>
                    <th>Cambios</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td><span className="pill neutral">{log.entity}</span></td>
                      <td><span className={`pill ${actionColor(log.action)}`}>{log.action}</span></td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{log.entityId.slice(0, 8)}…</td>
                      <td>{log.changedBy}</td>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        {log.action === "UPDATE" && log.before && log.after ? (
                          <details>
                            <summary style={{ cursor: "pointer", fontSize: "0.75rem" }}>Ver diff</summary>
                            <pre style={{ fontSize: "0.7rem", maxWidth: "30rem", overflow: "auto", background: "#f9fafb", padding: "0.5rem", borderRadius: "4px" }}>
                              {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                            </pre>
                          </details>
                        ) : log.action === "CREATE" ? (
                          <details>
                            <summary style={{ cursor: "pointer", fontSize: "0.75rem" }}>Ver datos</summary>
                            <pre style={{ fontSize: "0.7rem", maxWidth: "30rem", overflow: "auto", background: "#f9fafb", padding: "0.5rem", borderRadius: "4px" }}>
                              {JSON.stringify(log.after, null, 2)}
                            </pre>
                          </details>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
              <span>{meta.total} registros · página {meta.page} de {meta.totalPages}</span>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <button type="button" className="ghost" disabled={meta.page === 1} onClick={() => void loadLogs(meta.page - 1)} style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>‹</button>
                <button type="button" className="ghost" disabled={meta.page === meta.totalPages} onClick={() => void loadLogs(meta.page + 1)} style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>›</button>
              </div>
            </div>
          </>
        )}
        {!loading && logs.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Aplica filtros y presiona "Consultar" para ver el log de auditoría.</p>
        )}
      </article>
    </section>
    </div>
  );
}
