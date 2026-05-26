# 매매일지 + 수익률 히스토리 설계 스펙

**Goal:** 포트폴리오 거래를 자동 기록하고, 총 평가액 변화와 실현 손익을 시각화하는 매매일지 기능 추가

**Architecture:** SQLite 기반 거래 이력 + 일별 포트폴리오 스냅샷. 기존 portfolio.py에서 거래 발생 시 자동 INSERT. 스케줄러가 매일 15:30 KST 스냅샷 저장.

**Tech Stack:** Python sqlite3 (표준 라이브러리), FastAPI, Next.js, SVG 꺾은선 그래프 (외부 차트 라이브러리 없음)

---

## 1. 데이터 모델

### trades 테이블
```sql
CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL,
    stock_code  TEXT    NOT NULL,
    corp_name   TEXT    NOT NULL,
    trade_type  TEXT    NOT NULL,  -- 'buy' | 'sell' | 'edit'
    quantity    INTEGER NOT NULL,
    price       INTEGER NOT NULL,
    buy_price   INTEGER,           -- sell/edit 시 당시 평균매수단가 스냅샷 (전량매도 후 종목 삭제돼도 pnl 계산 가능)
    memo        TEXT,
    created_at  TEXT    NOT NULL   -- KST ISO datetime, e.g. "2026-05-26T15:30:00"
);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(username, created_at DESC);
```

### portfolio_snapshots 테이블
```sql
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL,
    snapshot_date   TEXT    NOT NULL,  -- YYYY-MM-DD
    total_value     INTEGER NOT NULL,  -- 총 평가금액 (현재가 × 수량 합산)
    total_invested  INTEGER NOT NULL,  -- 총 투자원금 (매수단가 × 수량 합산)
    created_at      TEXT    NOT NULL,
    UNIQUE(username, snapshot_date)
);
```

### 실현 손익 계산 방식
- `sell` 거래 발생 시: `realized_pnl = (price - buy_price) × quantity`
- `buy_price`는 거래 INSERT 시점에 포트폴리오 `buy_price` 필드를 읽어 `trades.buy_price`에 함께 저장
- 전량 매도로 종목이 포트폴리오에서 삭제된 뒤에도 `trades.buy_price`로 손익 계산 가능
- `realized_pnl`은 DB에 컬럼으로 저장하지 않고 API 응답 시 `(price - buy_price) × quantity`로 계산해서 반환

---

## 2. 백엔드

### 신규 파일
**`backend/app/db/trade_db.py`**
- `init_db()` — 앱 시작 시 테이블 생성
- `record_trade(username, stock_code, corp_name, trade_type, quantity, price, buy_price=None)` — 거래 INSERT
- `get_trades(username, limit, offset, stock_code)` → `list[dict]`
- `update_memo(username, trade_id, memo)` — 메모 UPDATE
- `save_snapshot(username, date, total_value, total_invested)` — UPSERT
- `get_snapshots(username, days)` → `list[dict]`
- `get_realized_summary(username)` → `list[dict]` (sell 거래 + pnl 계산)

### 신규 파일
**`backend/app/api/trades.py`**
```
GET  /api/trades
     params: limit=50, offset=0, stock_code(optional)
     → { trades: [...], total: int }

POST /api/trades/{trade_id}/memo
     body: { memo: string }
     → { ok: true }

GET  /api/trades/summary
     → { items: [{ date, corp_name, stock_code, quantity, sell_price, buy_price, realized_pnl, trade_id }] }

GET  /api/portfolio/snapshots
     params: days=90
     → { snapshots: [{ snapshot_date, total_value, total_invested }] }
```

### 수정 파일
**`backend/app/api/portfolio.py`**
- 매수(`addPortfolioItem`) 후: `record_trade(..., trade_type="buy")`
- 매도(`updatePortfolioItem`, quantity 감소) 후: `record_trade(..., trade_type="sell")`
- 수정(`updatePortfolioItem`, price 변경) 후: `record_trade(..., trade_type="edit")`
- 종목 삭제(`removePortfolioItem`) 후: `record_trade(..., trade_type="sell", quantity=전체수량)`

**`backend/app/scheduler/jobs.py`**
- 기존 스케줄러에 매일 15:30 KST job 추가
- 전체 유저 순회 → 포트폴리오 로드 → KIS REST로 현재가 조회 → `save_snapshot()`

**`backend/main.py`**
- 앱 시작 시 `init_db()` 호출
- trades 라우터 등록

---

## 3. 프론트엔드

### 신규 파일
**`frontend/components/TradeJournal.tsx`**
- 상단: 수익률 그래프 영역
  - `[총 평가액] [실현 손익]` 토글 버튼
  - 기간 선택: `[1M] [3M] [6M] [1Y]`
  - SVG 꺾은선 그래프 (StockChart 패턴 참고, 외부 라이브러리 없음)
- 하단: 거래 이력 리스트
  - 날짜 / 종목명 / 매수·매도·수정 뱃지 / 수량·단가 / 메모 첫 줄
  - 행 클릭 → `TradeDetailModal` 열기

**`frontend/components/TradeDetailModal.tsx`**
- 종목명, 거래 유형, 날짜
- 수량 / 단가 / 총액
- 현재가 기준 평가손익 (포트폴리오에 종목이 있을 때만)
- 메모 `<textarea>` + 저장 버튼 (POST /api/trades/{id}/memo)
- 닫기 버튼

### 수정 파일
**`frontend/components/PortfolioCard.tsx`**
- `type Tab = "stocks" | "watchlist" | "allocation" | "journal"` 추가
- TabBar에 `{ key: "journal", label: "일지" }` 추가
- `activeTab === "journal"` 블록에 `<TradeJournal />` 렌더링

**`frontend/lib/types.ts`**
```typescript
export interface Trade {
  id: number;
  stock_code: string;
  corp_name: string;
  trade_type: "buy" | "sell" | "edit";
  quantity: number;
  price: number;
  memo: string | null;
  created_at: string;
}

export interface TradeSummaryItem {
  trade_id: number;
  date: string;
  corp_name: string;
  stock_code: string;
  quantity: number;
  sell_price: number;
  buy_price: number;
  realized_pnl: number;
}

export interface PortfolioSnapshot {
  snapshot_date: string;
  total_value: number;
  total_invested: number;
}
```

**`frontend/lib/api.ts`**
```typescript
fetchTrades(params?: { limit?: number; offset?: number; stock_code?: string })
  → Promise<{ trades: Trade[]; total: number }>

updateTradeMemo(tradeId: number, memo: string) → Promise<void>

fetchTradeSummary() → Promise<{ items: TradeSummaryItem[] }>

fetchPortfolioSnapshots(days?: number) → Promise<{ snapshots: PortfolioSnapshot[] }>
```

---

## 4. 그래프 구현 방식

**총 평가액 그래프:**
- X축: 날짜 (스냅샷 기준)
- Y축: total_value
- 기간 필터로 snapshots 슬라이싱
- 시작 대비 수익률을 우상단에 표시 (예: +12.4%)

**실현 손익 누적 그래프:**
- X축: 매도 날짜
- Y축: realized_pnl 누적합
- 양수 구간 빨강, 음수 구간 파랑 (한국 주식 관습)
- 거래가 없으면 "아직 실현된 손익이 없어요" 빈 상태

두 그래프 모두 StockChart.tsx의 SVG 패턴을 재사용해 일관성 유지.

---

## 5. 에러 처리 & 엣지케이스

- 스냅샷이 0개일 때: 그래프 대신 "데이터를 모으는 중이에요 · 오늘 장 마감 후 첫 기록이 저장됩니다" 안내
- 거래 이력이 0개일 때: "아직 기록된 거래가 없어요" 빈 상태 뷰
- 스케줄러 KIS 조회 실패 시: 해당 날 스냅샷 스킵 (다음 날 재시도)
- SQLite 파일 경로: `backend/data/compass.db` (기존 data/ 폴더와 동일)

---

## 6. 롤백 가이드

구현 시작 전 체크포인트 커밋 생성. 롤백 필요 시:
```bash
git log --oneline -5          # checkpoint 커밋 해시 확인
git reset --hard <hash>       # 해당 시점으로 복원
```
SQLite 파일(`backend/data/compass.db`)은 gitignore 대상이므로 별도 삭제 필요:
```bash
rm backend/data/compass.db
```
