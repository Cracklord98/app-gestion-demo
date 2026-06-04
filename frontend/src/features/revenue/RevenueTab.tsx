import { useState } from "react";
import type { FormEvent } from "react";
import {
  createRevenueEntry,
  deleteRevenueEntry,
  updateRevenueEntry,
  type Project,
  type RevenueEntry,
} from "../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SectionLayout } from "../../components/SectionLayout";
import { downloadCsv } from "../../utils/csv";
import { formatDate } from "../../utils/formatDate";
import { ValidationErrorBox, isValidationError } from "../../components/ValidationErrorBox";
import { CurrencyInput } from "../../components/CurrencyInput";

const currencyOptions = ["COP", "USD", "EUR", "MXN", "PEN", "CLP"];

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function numberish(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInput(value: string) {
  return value.slice(0, 10);
}

type EditForm = {
  id: string;
  projectId: string;
  entryDate: string;
  amount: string;
  currency: string;
  description: string;
};

const emptyForm = {
  projectId: "",
  entryDate: "",
  amount: "",
  currency: "USD",
  description: "",
};

export function RevenueTab({
  revenueEntries,
  projects,
  loading,
  canWrite,
  onReload,
  onError,
}: {
  revenueEntries: RevenueEntry[];
  projects: Project[];
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
  const [deleteTarget, setDeleteTarget] = useState<RevenueEntry | null>(null);

  function handleExport() {
    downloadCsv(
      revenueEntries.map((e) => ({
        proyecto: e.project?.name ?? e.projectId,
        fecha: e.entryDate.slice(0, 10),
        monto: numberish(e.amount).toFixed(2),
        moneda: e.currency,
        descripcion: e.description ?? "",
      })),
      [
        { key: "proyecto", label: "Proyecto" },
        { key: "fecha", label: "Fecha" },
        { key: "monto", label: "Monto" },
        { key: "moneda", label: "Moneda" },
        { key: "descripcion", label: "Descripción" },
      ],
      "ingresos",
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await createRevenueEntry({
        projectId: form.projectId,
        entryDate: form.entryDate,
        amount: Number(form.amount),
        currency: form.currency,
        description: form.description || undefined,
      });
      setForm(emptyForm);
      await onReload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo registrar ingreso";
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
      await updateRevenueEntry(editForm.id, {
        projectId: editForm.projectId,
        entryDate: editForm.entryDate,
        amount: Number(editForm.amount),
        currency: editForm.currency,
        description: editForm.description || undefined,
      });
      setEditForm(null);
      await onReload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo actualizar ingreso";
      if (isValidationError(msg)) {
        setEditError(msg);
      } else {
        onError(msg);
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteRevenueEntry(id);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo eliminar ingreso");
    }
  }

  return (
    <>
      <SectionLayout
        title="Ingresos registrados"
        newLabel="+ Nuevo ingreso"
        canWrite={canWrite}
        onExport={handleExport}
        exportDisabled={revenueEntries.length === 0}
        form={
          <form onSubmit={(e) => void handleCreate(e)} className="form-inline">
            <ValidationErrorBox message={formError} />
            <select value={form.projectId} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))} required>
              <option value="" disabled hidden>Selecciona proyecto...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={form.entryDate} onChange={(e) => setForm((p) => ({ ...p, entryDate: e.target.value }))} required />
            <CurrencyInput
              currency={form.currency}
              placeholder="Monto"
              value={form.amount}
              onChange={(v) => setForm((p) => ({ ...p, amount: v }))}
              required
            />
            <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} required>
              {currencyOptions.map((c) => <option key={`rev-${c}`} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="Descripción (opcional)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <button type="submit" disabled={submitting}>{submitting ? "Registrando…" : "Registrar ingreso"}</button>
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
                    <th>Proyecto</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Descripción</th>
                    {canWrite && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {revenueEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.project?.name ?? entry.projectId}</td>
                      <td>{formatDate(entry.entryDate)}</td>
                      <td>{money(numberish(entry.amount), entry.currency)}</td>
                      <td>{entry.description || "—"}</td>
                      {canWrite && (
                        <td>
                          <div className="inline-actions">
                            <button
                              type="button"
                              onClick={() =>
                                setEditForm({
                                  id: entry.id,
                                  projectId: entry.projectId,
                                  entryDate: toDateInput(entry.entryDate),
                                  amount: String(numberish(entry.amount)),
                                  currency: entry.currency,
                                  description: entry.description || "",
                                })
                              }
                            >
                              Editar
                            </button>
                            <button type="button" className="ghost" onClick={() => setDeleteTarget(entry)}>
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
              <h3>Editar ingreso</h3>
              <button type="button" className="ghost" onClick={() => { setEditForm(null); setEditError(""); }}>Cerrar</button>
            </div>
            <form className="form-grid" onSubmit={(e) => void handleUpdate(e)}>
              <ValidationErrorBox message={editError} />
              <select value={editForm.projectId} onChange={(e) => setEditForm((p) => p && { ...p, projectId: e.target.value })} required>
                <option value="" disabled hidden>Selecciona proyecto...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" value={editForm.entryDate} onChange={(e) => setEditForm((p) => p && { ...p, entryDate: e.target.value })} required />
              <CurrencyInput
                currency={editForm.currency}
                value={editForm.amount}
                onChange={(v) => setEditForm((p) => p && { ...p, amount: v })}
                required
              />
              <select value={editForm.currency} onChange={(e) => setEditForm((p) => p && { ...p, currency: e.target.value })}>
                {currencyOptions.map((c) => <option key={`edit-rev-${c}`} value={c}>{c}</option>)}
              </select>
              <textarea value={editForm.description} onChange={(e) => setEditForm((p) => p && { ...p, description: e.target.value })} placeholder="Descripción" />
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
        title="Eliminar ingreso"
        message="¿Eliminar este ingreso?"
        confirmLabel="Eliminar"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
