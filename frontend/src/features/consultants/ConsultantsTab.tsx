import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "../../components/PageHeader";
import {
  createConsultant,
  deleteConsultant,
  updateConsultant,
  type Consultant,
} from "../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SectionLayout } from "../../components/SectionLayout";
import { downloadCsv } from "../../utils/csv";
import { ValidationErrorBox } from "../../components/ValidationErrorBox";
import { isValidationError } from "../../utils/validation";
import { CurrencyInput } from "../../components/CurrencyInput";

const currencyOptions = ["COP", "USD", "EUR", "MXN", "PEN", "CLP"];
const roleOptions = ["Analista", "Desarrollador", "QA", "Arquitecto", "PM", "Data Engineer"];

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function numberish(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type EditForm = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  hourlyRate: string;
  rateCurrency: string;
  active: boolean;
  allowWeekendWork: boolean;
};

const emptyForm = {
  fullName: "",
  email: "",
  role: "",
  hourlyRate: "",
  rateCurrency: "USD",
  active: true,
  allowWeekendWork: false,
};

export function ConsultantsTab({
  consultants,
  loading,
  canWrite,
  onReload,
  onError,
}: {
  consultants: Consultant[];
  loading: boolean;
  canWrite: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Consultant | null>(null);
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [fxLoading, setFxLoading] = useState(false);

  useEffect(() => {
    setFxLoading(true);
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((res) => res.json())
      .then((data: { rates: Record<string, number> }) => {
        setFxRates(data.rates);
      })
      .catch(() => { /* fxRates queda vacío, la columna mostrará "—" */ })
      .finally(() => setFxLoading(false));
  }, []);

  function toUSD(amount: number, currency: string): string {
    if (currency === "USD") return money(amount, "USD");
    const rate = fxRates[currency];
    if (!rate) return "—";
    return money(amount / rate, "USD");
  }

  function handleExport() {
    downloadCsv(
      consultants.map((c) => ({
        nombre: c.fullName,
        correo: c.email ?? "",
        rol: c.role,
        tarifa: numberish(c.hourlyRate).toFixed(2),
        moneda: c.rateCurrency ?? "USD",
        pais: c.country ?? "",
        estado: c.active ? "Activo" : "Inactivo",
      })),
      [
        { key: "nombre", label: "Nombre" },
        { key: "correo", label: "Correo" },
        { key: "rol", label: "Rol" },
        { key: "tarifa", label: "Tarifa/h" },
        { key: "moneda", label: "Moneda" },
        { key: "pais", label: "País" },
        { key: "estado", label: "Estado" },
      ],
      "consultores",
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await createConsultant({
        fullName: form.fullName,
        email: form.email || undefined,
        role: form.role,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        rateCurrency: form.rateCurrency,
        active: form.active,
        allowWeekendWork: form.allowWeekendWork,
      });
      setForm(emptyForm);
      await onReload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear consultor";
      if (isValidationError(msg)) {
        setFormError(msg);
      } else {
        onError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditError("");
    setEditSubmitting(true);
    try {
      await updateConsultant(editForm.id, {
        fullName: editForm.fullName,
        email: editForm.email || undefined,
        role: editForm.role,
        hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : undefined,
        rateCurrency: editForm.rateCurrency,
        active: editForm.active,
        allowWeekendWork: editForm.allowWeekendWork,
      });
      setEditForm(null);
      await onReload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo actualizar consultor";
      if (isValidationError(msg)) {
        setEditError(msg);
      } else {
        onError(msg);
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleToggleActive(consultant: Consultant) {
    try {
      await updateConsultant(consultant.id, {
        fullName: consultant.fullName,
        email: consultant.email || undefined,
        role: consultant.role,
        hourlyRate: numberish(consultant.hourlyRate),
        rateCurrency: consultant.rateCurrency || "USD",
        active: !consultant.active,
        allowWeekendWork: consultant.allowWeekendWork || false,
      });
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo cambiar estado del consultor");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteConsultant(id);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo eliminar consultor");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        icon="◐"
        title="Gestión de Consultores"
        description="Administra los perfiles de los consultores, tarifas por hora y asignaciones operativas."
      />
      <SectionLayout
        title="Consultores"
        newLabel="+ Nuevo consultor"
        canWrite={canWrite}
        onExport={handleExport}
        exportDisabled={consultants.length === 0}
        form={
          <form onSubmit={(e) => void handleCreate(e)} className="form-inline">
            <ValidationErrorBox message={formError} />
            <input placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
            <input type="email" placeholder="Correo" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} required>
              <option value="" disabled hidden>Selecciona un rol...</option>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={form.rateCurrency} onChange={(e) => setForm((p) => ({ ...p, rateCurrency: e.target.value }))}>
              {currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <CurrencyInput
              currency={form.rateCurrency}
              placeholder={`Tarifa/h (${form.rateCurrency})`}
              value={form.hourlyRate}
              onChange={(v) => setForm((p) => ({ ...p, hourlyRate: v }))}
            />
            <label className="check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              Activo
            </label>
            <label className="check">
              <input type="checkbox" checked={form.allowWeekendWork} onChange={(e) => setForm((p) => ({ ...p, allowWeekendWork: e.target.checked }))} />
              Finde/Festivos
            </label>
            <button type="submit" disabled={submitting}>{submitting ? "Creando…" : "Crear consultor"}</button>
          </form>
        }
        table={
          loading ? (
            <p className="loading">Cargando...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Tarifa</th>
                    <th>Tarifa en USD</th>
                    <th>Estado</th>
                    {canWrite && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {consultants.map((c) => (
                    <tr key={c.id}>
                      <td>{c.fullName}</td>
                      <td>{c.role}</td>
                      <td>{money(numberish(c.hourlyRate), c.rateCurrency || "USD")}</td>
                      <td>{fxLoading ? "…" : toUSD(numberish(c.hourlyRate), c.rateCurrency || "USD")}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span className={`pill ${c.active ? "ok" : "neutral"}`}>{c.active ? "Activo" : "Inactivo"}</span>
                          {c.allowWeekendWork && (
                            <span className="pill warning" style={{ fontSize: "0.7rem", background: "#fef3c7", color: "#d97706", fontWeight: 700 }} title="Autorizado para registrar en fines de semana y festivos">
                              📅 Finde
                            </span>
                          )}
                        </div>
                      </td>
                      {canWrite && (
                        <td>
                          <div className="inline-actions">
                            <button
                              type="button"
                              onClick={() =>
                                setEditForm({
                                  id: c.id,
                                  fullName: c.fullName,
                                  email: c.email || "",
                                  role: c.role,
                                  hourlyRate: String(numberish(c.hourlyRate)),
                                  rateCurrency: c.rateCurrency || "USD",
                                  active: c.active,
                                  allowWeekendWork: c.allowWeekendWork || false,
                                })
                              }
                            >
                              Editar
                            </button>
                            <button type="button" onClick={() => void handleToggleActive(c)}>
                              {c.active ? "Desactivar" : "Activar"}
                            </button>
                            <button type="button" className="ghost" onClick={() => setDeleteTarget(c)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      />

      {editForm && (
        <div className="modal-overlay" onClick={() => { setEditForm(null); setEditError(""); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar consultor</h3>
              <button type="button" className="ghost" onClick={() => { setEditForm(null); setEditError(""); }}>Cerrar</button>
            </div>
            <form className="form-grid" onSubmit={(e) => void handleUpdate(e)}>
              <ValidationErrorBox message={editError} />
              <input value={editForm.fullName} onChange={(e) => setEditForm((p) => p && { ...p, fullName: e.target.value })} placeholder="Nombre completo" required />
              <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => p && { ...p, email: e.target.value })} placeholder="Correo" />
              <select value={editForm.role} onChange={(e) => setEditForm((p) => p && { ...p, role: e.target.value })} required>
                <option value="" disabled hidden>Selecciona un rol...</option>
                {roleOptions.map((r) => <option key={`edit-${r}`} value={r}>{r}</option>)}
              </select>
              <select value={editForm.rateCurrency} onChange={(e) => setEditForm((p) => p && { ...p, rateCurrency: e.target.value })}>
                {currencyOptions.map((c) => <option key={`edit-cur-${c}`} value={c}>{`Moneda tarifa: ${c}`}</option>)}
              </select>
              <CurrencyInput
                currency={editForm.rateCurrency}
                value={editForm.hourlyRate}
                onChange={(v) => setEditForm((p) => p && { ...p, hourlyRate: v })}
                placeholder={`Tarifa/hora (${editForm.rateCurrency})`}
              />
              <label className="check">
                <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm((p) => p && { ...p, active: e.target.checked })} />
                Activo
              </label>
              <label className="check">
                <input type="checkbox" checked={editForm.allowWeekendWork} onChange={(e) => setEditForm((p) => p && { ...p, allowWeekendWork: e.target.checked })} />
                Permitir Fin de Semana/Festivos
              </label>
              <div className="modal-actions">
                <button type="submit" disabled={editSubmitting}>{editSubmitting ? "Guardando…" : "Guardar cambios"}</button>
                <button type="button" className="ghost" onClick={() => { setEditForm(null); setEditError(""); }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar consultor"
        message={`¿Eliminar a "${deleteTarget?.fullName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
