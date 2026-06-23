import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-card"
        style={{ maxWidth: "28rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ color: danger ? "#dc2626" : undefined }}>{title}</h3>
        </div>
        <div style={{ padding: "1rem 0", color: "var(--text-soft, #374151)", lineHeight: 1.5 }}>
          {message}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            style={danger ? { background: "#dc2626", borderColor: "#dc2626" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
