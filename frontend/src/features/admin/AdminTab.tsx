import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "../../components/PageHeader";
import { createAdminUser, updateAdminUser, type AdminUser, type AppRole } from "../../services/api";

const roleOptions: AppRole[] = ["ADMIN", "PM", "CONSULTANT", "FINANCE", "VIEWER"];

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

  // Estados para la edición en línea de usuarios registrados
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [editCountry, setEditCountry] = useState<string>("Default");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (form.roles.length === 0) {
      onError("Por favor selecciona al menos un rol para el usuario.");
      return;
    }
    setSubmitting(true);
    try {
      await createAdminUser({
        email: form.email,
        displayName: form.displayName,
        microsoftOid: form.microsoftOid || undefined,
        active: form.active,
        roles: form.roles,
        country: form.country,
      });
      setForm(emptyForm);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo crear usuario");
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

  async function handleSaveEdit(userId: string) {
    if (editRoles.length === 0) {
      onError("Por favor selecciona al menos un rol.");
      return;
    }
    setSubmitting(true);
    try {
      await updateAdminUser(userId, {
        roles: editRoles,
        country: editCountry === "Default" ? null : editCountry,
      });
      setEditingUserId(null);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo actualizar usuario");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingUserId(user.id);
    setEditRoles(user.roles || []);
    setEditCountry(user.country || "Default");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        icon="👤"
        title="Gestión de Usuarios"
        description="Administra los usuarios del sistema, asignación de roles y permisos de acceso."
      />
      <section className="grid two-col">
        <article className="card">
          <h3>Crear usuario</h3>
          <form onSubmit={(e) => void handleCreate(e)} className="form-grid">
            <input placeholder="Correo" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            <input placeholder="Nombre" value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} required />
            <input placeholder="Microsoft OID (opcional)" value={form.microsoftOid} onChange={(e) => setForm((p) => ({ ...p, microsoftOid: e.target.value }))} />
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", margin: "0.5rem 0" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-strong)" }}>Roles *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", background: "rgba(0,0,0,0.02)", padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                {roleOptions.map((r) => (
                  <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={form.roles.includes(r)}
                      onChange={(e) => {
                        const nextRoles = e.target.checked
                          ? [...form.roles, r]
                          : form.roles.filter((role) => role !== r);
                        setForm((p) => ({ ...p, roles: nextRoles }));
                      }}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <select value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}>
              <option value="Default">País: Default</option>
              <option value="Colombia">Colombia 🇨🇴</option>
              <option value="Peru">Perú 🇵🇪</option>
              <option value="Chile">Chile 🇨🇱</option>
              <option value="Mexico">México 🇲🇽</option>
              <option value="Ecuador">Ecuador 🇪🇨</option>
              <option value="USA">Estados Unidos 🇺🇸</option>
            </select>
            <label className="check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              Activo
            </label>
            <button type="submit" disabled={submitting}>{submitting ? "Creando…" : "Crear usuario"}</button>
          </form>
        </article>

        <article className="card">
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
                    const isEditing = editingUserId === user.id;
                    return (
                      <tr key={user.id}>
                        <td>{user.displayName}</td>
                        <td>{user.email}</td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", background: "#f8fafc", padding: "0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                              {roleOptions.map((r) => (
                                <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.78rem", cursor: "pointer", fontWeight: 500 }}>
                                  <input
                                    type="checkbox"
                                    checked={editRoles.includes(r)}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...editRoles, r]
                                        : editRoles.filter((x) => x !== r);
                                      setEditRoles(next);
                                    }}
                                  />
                                  {r}
                                </label>
                              ))}
                            </div>
                          ) : (
                            user.roles.join(", ")
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select value={editCountry} onChange={(e) => setEditCountry(e.target.value)}>
                              <option value="Default">Default</option>
                              <option value="Colombia">Colombia 🇨🇴</option>
                              <option value="Peru">Perú 🇵🇪</option>
                              <option value="Chile">Chile 🇨🇱</option>
                              <option value="Mexico">México 🇲🇽</option>
                              <option value="Ecuador">Ecuador 🇪🇨</option>
                              <option value="USA">Estados Unidos 🇺🇸</option>
                            </select>
                          ) : (
                            user.country || "Default"
                          )}
                        </td>
                        <td>
                          <span className={`pill ${user.active ? "ok" : "neutral"}`}>{user.active ? "Activo" : "Inactivo"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            {isEditing ? (
                              <>
                                <button type="button" onClick={() => void handleSaveEdit(user.id)} disabled={submitting} className="btn-save" style={{ padding: "0.25rem 0.5rem" }}>
                                  {submitting && editingUserId === user.id ? "Guardando…" : "Guardar"}
                                </button>
                                <button type="button" onClick={() => setEditingUserId(null)} className="btn-cancel" style={{ padding: "0.25rem 0.5rem" }}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startEdit(user)} style={{ padding: "0.25rem 0.5rem" }}>
                                  Editar
                                </button>
                                <button type="button" onClick={() => void handleToggleActive(user)} style={{ padding: "0.25rem 0.5rem" }}>
                                  {user.active ? "Desactivar" : "Activar"}
                                </button>
                              </>
                            )}
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
    </div>
  );
}
