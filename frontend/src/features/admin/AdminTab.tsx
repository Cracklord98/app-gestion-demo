import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "../../components/PageHeader";
import { createAdminUser, updateAdminUser, listSupportedCountries, type AdminUser, type AppRole } from "../../services/api";

const roleOptions: AppRole[] = ["ADMIN", "PM", "CONSULTANT", "FINANCE", "VIEWER"];

const roleLabels: Record<AppRole, string> = {
  ADMIN: "Admin",
  PM: "PM",
  CONSULTANT: "Consultor",
  FINANCE: "Financiero",
  VIEWER: "Lector",
};

const emptyForm = {
  email: "",
  displayName: "",
  microsoftOid: "",
  active: true,
  roles: ["VIEWER"] as AppRole[],
  country: "Default",
};

export function AdminTab({
  adminUsers,
  loading,
  onReload,
  onError,
}: {
  adminUsers: AdminUser[];
  loading: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Estados para el Modal de creación y edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Fetch supported countries from backend
  const [supportedCountries, setSupportedCountries] = useState<string[]>([]);
  useEffect(() => {
    void listSupportedCountries().then(setSupportedCountries).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.roles.length === 0) {
      onError("Por favor selecciona al menos un rol para el usuario.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingUser) {
        // Modo Edición
        await updateAdminUser(editingUser.id, {
          displayName: form.displayName,
          microsoftOid: form.microsoftOid || undefined,
          active: form.active,
          roles: form.roles,
          country: form.country === "Default" ? null : form.country,
        });
      } else {
        // Modo Creación
        await createAdminUser({
          email: form.email,
          displayName: form.displayName,
          microsoftOid: form.microsoftOid || undefined,
          active: form.active,
          roles: form.roles,
          country: form.country === "Default" ? null : form.country,
        });
      }
      setIsModalOpen(false);
      setForm(emptyForm);
      setEditingUser(null);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo guardar usuario");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user: AdminUser) {
    try {
      await updateAdminUser(user.id, { active: !user.active });
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo cambiar estado del usuario");
    }
  }

  function startEdit(user: AdminUser) {
    setEditingUser(user);
    setForm({
      email: user.email,
      displayName: user.displayName,
      microsoftOid: user.microsoftOid || "",
      active: user.active,
      roles: user.roles || ["VIEWER"],
      country: user.country || "Default",
    });
    setIsModalOpen(true);
  }

  function startCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        icon="👤"
        title="Gestión de Usuarios"
        description="Administra los usuarios del sistema, asignación de roles y permisos de acceso."
        actions={
          <button
            type="button"
            onClick={startCreate}
            style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px" }}
          >
            + Crear usuario
          </button>
        }
      />
      
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <article className="card" style={{ width: "100%" }}>
          <h3>Usuarios registrados</h3>
          {loading ? (
            <p className="loading">Cargando...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Roles</th>
                    <th>País</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => {
                    return (
                      <tr key={user.id}>
                        <td>{user.displayName}</td>
                        <td>{user.email}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                            {user.roles.map((r) => {
                              const roleClass = r.toLowerCase();
                              return (
                                <span key={r} className={`role-badge role-${roleClass}`} style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}>
                                  {roleLabels[r] || r}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td>{user.country || "Default"}</td>
                        <td>
                          <span className={`pill ${user.active ? "ok" : "neutral"}`}>{user.active ? "Activo" : "Inactivo"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button type="button" onClick={() => startEdit(user)} style={{ padding: "0.25rem 0.5rem" }}>
                              Editar
                            </button>
                            <button type="button" onClick={() => void handleToggleActive(user)} style={{ padding: "0.25rem 0.5rem" }}>
                              {user.active ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {/* Modal para Crear / Editar Usuario */}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); setEditingUser(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: "0.75rem", marginBottom: "1.25rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-strong, #1e293b)" }}>
                {editingUser ? "Editar usuario" : "Crear usuario"}
              </h2>
              <button
                type="button"
                className="ghost"
                onClick={() => { setIsModalOpen(false); setEditingUser(null); }}
                style={{ fontSize: "1.1rem", padding: "0.2rem 0.5rem", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="form-grid two-col" style={{ gap: "1.5rem", alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-strong)" }}>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="Correo"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  disabled={!!editingUser}
                  style={{ opacity: editingUser ? 0.7 : 1 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-strong)" }}>Nombre completo</label>
                <input
                  placeholder="Nombre"
                  value={form.displayName}
                  onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-strong)" }}>Microsoft OID (opcional)</label>
                <input
                  placeholder="Microsoft OID (opcional)"
                  value={form.microsoftOid}
                  onChange={(e) => setForm((p) => ({ ...p, microsoftOid: e.target.value }))}
                />
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-strong)" }}>País</label>
                <select value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}>
                  {supportedCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {supportedCountries.length === 0 && <option value="Default">Default</option>}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", margin: "0.5rem 0", gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-strong)" }}>Roles *</label>
                <div className="role-chip-group" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {roleOptions.map((r) => {
                    const isSelected = form.roles.includes(r);
                    const roleClass = r.toLowerCase();
                    return (
                      <label
                        key={r}
                        className={`role-badge role-chip ${isSelected ? `role-${roleClass}` : "inactive"}`}
                        style={{
                          cursor: "pointer",
                          padding: "0.4rem 0.8rem",
                          border: isSelected ? "1px solid transparent" : "1px solid #cbd5e1",
                          borderRadius: "20px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          background: isSelected ? "var(--accent-light, #f1f5f9)" : "#fff",
                          opacity: isSelected ? 1 : 0.7,
                          transition: "all 0.2s"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const nextRoles = e.target.checked
                              ? [...form.roles, r]
                              : form.roles.filter((role) => role !== r);
                            setForm((p) => ({ ...p, roles: nextRoles }));
                          }}
                        />
                        <span style={{ display: "inline-block", width: "14px", textAlign: "center", fontWeight: "bold" }}>
                          {isSelected ? "✓" : "+"}
                        </span>
                        {roleLabels[r]}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="check" style={{ marginTop: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-strong)" }}>
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} style={{ marginRight: "0.5rem" }}/>
                  Usuario Activo
                </label>
              </div>

              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", gridColumn: "1 / -1", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => { setIsModalOpen(false); setEditingUser(null); }}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Guardando…" : editingUser ? "Guardar cambios" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
