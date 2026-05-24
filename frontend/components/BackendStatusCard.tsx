"use client";

import { useEffect, useState } from "react";

import { fetchServiceInfo } from "../lib/api";
import type { BackendStatus } from "../lib/types";

const DOT: Record<BackendStatus, string> = {
  checking: "var(--orange)",
  connected: "var(--green)",
  error: "var(--red)",
};

const LABEL: Record<BackendStatus, string> = {
  checking: "연결 중",
  connected: "연결됨",
  error: "오프라인",
};

export function BackendStatusCard() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    fetchServiceInfo()
      .then(() => setStatus("connected"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "var(--surface)",
        borderRadius: 100,
        padding: "5px 10px 5px 8px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: DOT[status],
          flexShrink: 0,
          ...(status === "checking" && {
            animation: "pulse 1.4s ease-in-out infinite",
          }),
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--label2)" }}>
        {LABEL[status]}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
