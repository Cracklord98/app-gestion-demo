export function AlertBadge({ level }: { level: "ok" | "warning" | "exceeded" }) {
  const map = {
    exceeded: { bg: "#fee2e2", color: "#991b1b", icon: "●", text: "Superado" },
    warning:  { bg: "#fef9c3", color: "#92400e", icon: "●", text: "Cerca límite" },
    ok:       { bg: "#dcfce7", color: "#166534", icon: "●", text: "OK" },
  };
  const s = map[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      background: s.bg, color: s.color,
      borderRadius: "9999px", padding: "0.2rem 0.6rem",
      fontSize: "0.72rem", fontWeight: 700,
    }}>
      {s.icon} {s.text}
    </span>
  );
}
