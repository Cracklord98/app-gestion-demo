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
  role: "VIEWER" as AppRole,
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdminUser({
        email: form.email,
        displayName: form.displayName,
        microsoftOid: form.microsoftOid || undefined,
        active: form.active,
        roles: [form.role],
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
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as AppRole }))}>
            {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
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
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName}</td>
                    <td>{user.email}</td>
                    <td>{user.roles.join(", ")}</td>
                    <td>
                      <span className={`pill ${user.active ? "ok" : "neutral"}`}>{user.active ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => void handleToggleActive(user)}>
                        {user.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
    </div>
  );
}
