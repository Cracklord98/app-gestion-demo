import React from "react";

interface PageHeaderProps {
  icon: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, description, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #f4d4b6",
      paddingBottom: "1rem",
      marginBottom: "1.5rem",
      flexWrap: "wrap",
      gap: "1rem",
      width: "100%"
    }}>
      <div>
        <h2 style={{
          fontFamily: "var(--display, inherit)",
          fontSize: "1.6rem",
          color: "var(--text-strong, #5f2f00)",
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          fontWeight: 700
        }}>
          <span style={{ fontSize: "1.7rem" }}>{icon}</span>
          <span>{title}</span>
        </h2>
        <p style={{
          color: "var(--text-soft, #6b7280)",
          fontSize: "0.85rem",
          marginTop: "0.25rem",
          marginBottom: 0,
          lineHeight: "1.4"
        }}>
          {description}
        </p>
      </div>
      {actions && (
        <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
