"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

import { analyzePortfolio } from "../lib/api";
import type { AnalysisResult } from "../lib/types";

type State =
  | { kind: "loading" }
  | { kind: "done"; result: AnalysisResult }
  | { kind: "error"; message: string };

export function PortfolioAnalyzeModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    analyzePortfolio()
      .then(result => { if (alive) setState({ kind: "done", result }); })
      .catch(() => { if (alive) setState({ kind: "error", message: "분석에 실패했어요. 잠시 후 다시 시도해주세요." }); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div
        className="modal-backdrop-enter"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 199 }}
      />
      <div
        className="modal-enter"
        style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 480, maxHeight: "82vh",
            display: "flex", flexDirection: "column",
            background: "var(--bg)", borderRadius: 20, overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
          }}
        >
          {/* 헤더 */}
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
            padding: "16px 16px 12px", borderBottom: "0.5px solid var(--sep)",
          }}>
            <Sparkles size={17} strokeWidth={2.2} color="var(--primary)" />
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--label)", letterSpacing: "-0.01em" }}>
              AI 포트폴리오 분석
            </div>
            <button
              onClick={onClose}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--label2)", display: "flex" }}
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>

          {/* 본문 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {state.kind === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 0", color: "var(--label2)" }}>
                <Loader2 size={22} strokeWidth={2.2} color="var(--primary)" style={{ animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: 13 }}>보유 종목·공시·업로드 자료를 종합하는 중이에요…</div>
              </div>
            )}

            {state.kind === "error" && (
              <div style={{ padding: "36px 0", textAlign: "center", fontSize: 13, color: "var(--label2)", lineHeight: 1.6 }}>
                {state.message}
              </div>
            )}

            {state.kind === "done" && (
              <div style={{ fontSize: 14, color: "var(--label)", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {state.result.analysis}
              </div>
            )}
          </div>

          {/* 투자 책임 고지 */}
          <div style={{
            flexShrink: 0, padding: "6px 16px",
            borderTop: "0.5px solid var(--sep)", background: "var(--bg)",
            fontSize: 10, color: "var(--label3)", lineHeight: 1.4, textAlign: "center",
          }}>
            AI 분석은 투자 참고용이며 자문이 아니에요. 투자 판단·책임은 본인에게 있습니다.
          </div>
        </div>
      </div>
    </>
  );
}
