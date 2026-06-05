import { parseValidationErrors } from "../utils/validation";

export function ValidationErrorBox({ message }: { message: string }) {
  const items = parseValidationErrors(message);
  if (items.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        margin: "0 0 0.75rem 0",
        padding: "0.75rem 1rem",
        background: "#fff5f5",
        border: "1px solid #fca5a5",
        borderLeft: "4px solid #dc2626",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.78rem",
          fontWeight: 700,
          color: "#dc2626",
          letterSpacing: "0.01em",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.15rem",
            height: "1.15rem",
            borderRadius: "50%",
            background: "#dc2626",
            color: "#fff",
            fontSize: "0.65rem",
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          !
        </span>
        Revisa los siguientes campos:
      </p>
      <ul
        style={{
          margin: 0,
          padding: "0 0 0 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: "0.80rem",
              color: "#991b1b",
              lineHeight: 1.45,
            }}
          >
            {item.replace(/^!\s*/, "")}
          </li>
        ))}
      </ul>
    </div>
  );
}
