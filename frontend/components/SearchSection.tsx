"use client";

import { useState } from "react";

import { search } from "../lib/api";
import type { SearchState } from "../lib/types";

export function SearchSection() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  async function run() {
    if (!query.trim()) return;
    setState({ kind: "searching" });
    try {
      const data = await search(query);
      setState({ kind: "done", query: data.query, matches: data.matches });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  const isSearching = state.kind === "searching";

  return (
    <details className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
      <summary className="cursor-pointer px-5 sm:px-6 py-4 font-medium text-zinc-700">
        의미 검색 (개발 도구)
      </summary>
      <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
        <p className="text-xs text-zinc-500">
          LLM 없이 원시 청크만 보고 싶을 때 사용.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
            placeholder="예: 리딩방 사기, 임상 결과, 횡령 공시"
            className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <button
            onClick={run}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-zinc-700 transition"
          >
            {isSearching ? "검색 중" : "검색"}
          </button>
        </div>
        {state.kind === "error" && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-600">
            {state.message}
          </div>
        )}
        {state.kind === "done" && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-600">{state.matches.length}건 매칭</div>
            {state.matches.map((m, i) => (
              <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">#{i + 1}</span>
                  <span className="text-xs font-mono text-zinc-400">
                    dist: {m.distance.toFixed(3)}
                  </span>
                </div>
                <pre className="text-xs text-zinc-700 whitespace-pre-wrap break-words font-mono">
                  {m.text.length > 300 ? `${m.text.slice(0, 300)}…` : m.text}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
