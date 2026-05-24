"use client";

import { useEffect, useRef, useState } from "react";

import { deleteUpload, listUploads, runFactcheck, uploadFile } from "../lib/api";
import type { FactcheckState, UploadState, UploadSummary } from "../lib/types";
import { FactcheckPanel } from "./FactcheckPanel";

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return iso?.slice(0, 10) ?? "";
  }
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16.7A4 4 0 0 0 18 9H16.7A6 6 0 1 0 6 14.3" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function UploadCard() {
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle" });
  const [factcheckState, setFactcheckState] = useState<FactcheckState>({ kind: "idle" });
  const [selectedUpload, setSelectedUpload] = useState<UploadSummary | null>(null);
  const [history, setHistory] = useState<UploadSummary[]>([]);
  const [vaultOpen, setVaultOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listUploads().then(setHistory).catch(() => {});
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedUpload(null);
    setUploadState({ kind: "uploading" });
    setFactcheckState({ kind: "idle" });
    try {
      const result = await uploadFile(file);
      setUploadState({ kind: "done", result });
      listUploads().then(setHistory).catch(() => {});
    } catch (err) {
      setUploadState({
        kind: "error",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  function reset() {
    setUploadState({ kind: "idle" });
    setFactcheckState({ kind: "idle" });
    setSelectedUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function startFactcheck() {
    const id =
      selectedUpload?.upload_id ??
      (uploadState.kind === "done" ? uploadState.result.upload_id : null);
    if (!id) return;
    setFactcheckState({ kind: "running" });
    try {
      const result = await runFactcheck(id);
      setFactcheckState({ kind: "done", result });
    } catch (err) {
      setFactcheckState({
        kind: "error",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  async function handleDelete(upload_id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteUpload(upload_id);
      setHistory(prev => prev.filter(u => u.upload_id !== upload_id));
      if (selectedUpload?.upload_id === upload_id) reset();
    } catch {
      // 실패해도 조용히 처리
    }
  }

  const showFactcheck = selectedUpload !== null || uploadState.kind === "done";

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>

      {/* 업로드 드롭존 */}
      {!selectedUpload && uploadState.kind === "idle" && (
        <label style={{ display: "block", cursor: "pointer" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div
            style={{
              border: "2px dashed var(--sep)",
              borderRadius: 16,
              padding: "32px 20px",
              textAlign: "center",
              background: "var(--surface)",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
              (e.currentTarget as HTMLElement).style.background = "rgba(0,122,255,0.04)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--sep)";
              (e.currentTarget as HTMLElement).style.background = "var(--surface)";
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <UploadIcon />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>파일을 올려주세요</div>
            <div style={{ fontSize: 13, color: "var(--label2)", marginTop: 4 }}>PDF · TXT</div>
          </div>
        </label>
      )}

      {/* 업로드 중 */}
      {uploadState.kind === "uploading" && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: "28px", textAlign: "center" }}>
          <div style={{
            width: 36, height: 36,
            border: "3px solid var(--sep)", borderTopColor: "var(--primary)",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
          }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>분석 준비 중</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 업로드 실패 */}
      {uploadState.kind === "error" && (
        <div style={{ background: "rgba(255,59,48,0.08)", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--red)", marginBottom: 6 }}>업로드 실패</div>
          <div style={{ fontSize: 14, color: "var(--red)", opacity: 0.8 }}>{uploadState.message}</div>
          <button onClick={reset} style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--red)", textDecoration: "underline" }}>
            다시 시도
          </button>
        </div>
      )}

      {/* 업로드 완료 배지 */}
      {uploadState.kind === "done" && (
        <div style={{
          background: "rgba(52,199,89,0.08)", borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--green)", fontWeight: 600, marginBottom: 2 }}>업로드 완료</div>
            <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {uploadState.result.filename}
            </div>
          </div>
          <button onClick={reset} style={{ fontSize: 13, color: "var(--label2)" }}>초기화</button>
        </div>
      )}

      {/* 선택된 저장 자료 */}
      {selectedUpload && (
        <div style={{
          background: "rgba(0,122,255,0.08)", borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {selectedUpload.filename}
          </div>
          <button onClick={reset} style={{ fontSize: 13, color: "var(--label2)" }}>취소</button>
        </div>
      )}

      {/* 팩트체크 패널 */}
      {showFactcheck && <FactcheckPanel state={factcheckState} onRun={startFactcheck} />}

      {/* ── 자료 보관함 ── */}
      {history.length > 0 && (
        <div style={{
          background: "var(--surface)",
          borderRadius: 14,
          overflow: "hidden",
          border: "0.5px solid var(--sep)",
        }}>
          {/* 보관함 헤더 (접기/펼치기) */}
          <button
            onClick={() => setVaultOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "13px 16px", textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="var(--label2)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--label)" }}>자료 보관함</span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "var(--primary)",
                background: "rgba(0,122,255,0.1)", borderRadius: 100, padding: "2px 8px",
              }}>
                {history.length}
              </span>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{ color: "var(--label3)", transform: vaultOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            >
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* 보관함 목록 */}
          {vaultOpen && (
            <div style={{ borderTop: "0.5px solid var(--sep)" }}>
              {history.map((u, i) => (
                <div key={u.upload_id}>
                  {i > 0 && <div style={{ height: "0.5px", background: "var(--sep)", marginLeft: 16 }} />}
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: "11px 16px", gap: 8,
                  }}>
                    {/* 파일명 + 날짜 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, color: "var(--label)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {u.filename || "파일"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--label2)", marginTop: 2 }}>
                        {formatDate(u.uploaded_at)}
                      </div>
                    </div>

                    {/* 검사 버튼 */}
                    <button
                      onClick={() => {
                        setSelectedUpload(u);
                        setUploadState({ kind: "idle" });
                        setFactcheckState({ kind: "idle" });
                        setVaultOpen(false);
                      }}
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", flexShrink: 0 }}
                    >
                      검사
                    </button>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => handleDelete(u.upload_id, e)}
                      style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: "rgba(255,59,48,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--red)", fontSize: 13, flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 법적 고지 */}
      <div style={{ fontSize: 12, color: "var(--label3)", lineHeight: 1.6, marginTop: "auto", paddingTop: 8 }}>
        본 서비스는 공개 자료 분석 기반의 투자 참고용입니다. 최종 투자 결정과 책임은 본인에게 있습니다.
      </div>
    </div>
  );
}
