"use client";
import { useEffect, useRef, useState } from "react";
import type { Trade } from "../lib/types";
import { updateTradeMemo } from "../lib/api";

interface Props {
  trade: Trade;
  currentPrice?: number;
  onClose: () => void;
  onMemoSaved?: (tradeId: number, memo: string) => void;
}

const BADGE_STYLE: Record<Trade["trade_type"], { label: string; bg: string; color: string }> = {
  buy: { label: "매수", bg: "var(--success)", color: "#fff" },
  sell: { label: "매도", bg: "var(--danger)", color: "#fff" },
  edit: { label: "수정", bg: "var(--primary)", color: "#fff" },
};

export default function TradeDetailModal({ trade, currentPrice, onClose, onMemoSaved }: Props) {
  const [memo, setMemo] = useState(trade.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const badge = BADGE_STYLE[trade.trade_type];
  const total = trade.price * trade.quantity;
  const date = trade.created_at.replace("T", " ").slice(0, 16);

  let evalPnl: number | null = null;
  let evalPnlPct: number | null = null;
  if (trade.trade_type !== "sell" && currentPrice != null && trade.price > 0) {
    evalPnl = (currentPrice - trade.price) * trade.quantity;
    evalPnlPct = ((currentPrice - trade.price) / trade.price) * 100;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateTradeMemo(trade.id, memo);
      setSaved(true);
      onMemoSaved?.(trade.id, memo);
      setTimeout(() => setSaved(false), 1500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: "24px",
      }}
    >
      <div style={{
        background: "var(--surface2)", borderRadius: 16,
        width: "100%", maxWidth: 400, padding: "24px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px",
                borderRadius: 6, background: badge.bg, color: badge.color,
              }}>{badge.label}</span>
              <span style={{ fontSize: 13, color: "var(--label2)" }}>{date}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--label1)" }}>
              {trade.corp_name}
              <span style={{ fontSize: 12, color: "var(--label3)", marginLeft: 6 }}>
                {trade.stock_code}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--label3)", fontSize: 20, padding: "0 4px",
            }}
          >✕</button>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          {[
            { label: "수량", value: `${trade.quantity.toLocaleString()}주` },
            { label: "단가", value: `${trade.price.toLocaleString()}원` },
            { label: "총액", value: `${total.toLocaleString()}원` },
            ...(currentPrice != null
              ? [{ label: "현재가", value: `${currentPrice.toLocaleString()}원` }]
              : []),
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "var(--surface3)", borderRadius: 10,
              padding: "10px 14px",
            }}>
              <div style={{ fontSize: 11, color: "var(--label3)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--label1)" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Eval P&L */}
        {evalPnl != null && evalPnlPct != null && (
          <div style={{
            background: evalPnl >= 0 ? "rgba(255,59,48,0.12)" : "rgba(30,144,255,0.12)",
            borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{ fontSize: 11, color: "var(--label3)", marginBottom: 2 }}>평가손익 (현재가 기준)</div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: evalPnl >= 0 ? "var(--danger)" : "#1e90ff",
            }}>
              {evalPnl >= 0 ? "+" : ""}{evalPnl.toLocaleString()}원
              <span style={{ fontSize: 12, marginLeft: 6 }}>
                ({evalPnlPct >= 0 ? "+" : ""}{evalPnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {/* Memo */}
        <div>
          <div style={{ fontSize: 12, color: "var(--label3)", marginBottom: 6 }}>메모</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="거래 메모를 입력하세요"
            rows={3}
            style={{
              width: "100%", resize: "none", boxSizing: "border-box",
              background: "var(--surface3)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 12px", color: "var(--label1)",
              fontSize: 14, lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 8, width: "100%", padding: "10px",
              background: saved ? "var(--success)" : "var(--primary)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saved ? "저장됨" : saving ? "저장 중…" : "메모 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
