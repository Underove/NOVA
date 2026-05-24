import type { CSSProperties, ReactNode } from "react";

const cardStyle: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 20,
  boxShadow: "var(--shadow)",
  padding: "20px 20px",
  marginBottom: 16,
};

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <section style={{ ...cardStyle, ...style }}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.035em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>
      {description && (
        <p
          style={{
            fontSize: 15,
            color: "var(--label2)",
            margin: "5px 0 0",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--label2)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

export function Divider() {
  return (
    <div
      style={{
        height: "0.5px",
        background: "var(--sep)",
        margin: "4px -20px",
      }}
    />
  );
}
