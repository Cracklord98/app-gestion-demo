import type { Toast } from "../hooks/useToast";

const ICONS: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "i",
};

const COLORS: Record<string, { bg: string; border: string; color: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", color: "#15803d" },
  error: { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626" },
  warning: { bg: "#fffbeb", border: "#fcd34d", color: "#d97706" },
  info: { bg: "#eff6ff", border: "#93c5fd", color: "#2563eb" },
};

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 9999,
        maxWidth: "22rem",
      }}
    >
      {toasts.map((toast) => {
        const c = COLORS[toast.type] ?? COLORS.info;
        return (
          <div
            key={toast.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              animation: "slideIn 0.2s ease",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.25rem",
                height: "1.25rem",
                borderRadius: "50%",
                background: c.border,
                color: c.color,
                fontSize: "0.7rem",
                fontWeight: 700,
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              {ICONS[toast.type]}
            </span>
            <span style={{ flex: 1, fontSize: "0.875rem", color: "#374151", lineHeight: 1.4, whiteSpace: "pre-line" }}>
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9ca3af",
                fontSize: "1rem",
                lineHeight: 1,
                padding: 0,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
