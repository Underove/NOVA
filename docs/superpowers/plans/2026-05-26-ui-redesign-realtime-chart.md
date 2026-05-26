# UI 개선 + 실시간 오늘 봉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** StockChart에 실시간 오늘 봉을 추가하고, PortfolioCard에 스파크라인 + 요약 스트립을 추가한다.

**Architecture:** (1) `isMarketOpen` 함수를 export해 재사용한다. (2) StockChart에 `liveCandle` prop을 추가하고 별도 effect로 시리즈를 업데이트한다. (3) StockDetailModal이 30초 폴링하는 price로 liveCandle을 계산해 차트에 전달한다. (4) PortfolioCard는 스톡 로드 시 candles도 패치해 닫힌 종가 배열을 SparkLine SVG로 표시하고, SummaryCard를 3열 스트립으로 개편한다.

**Tech Stack:** Next.js App Router, React hooks, lightweight-charts v5.2.0, TypeScript

---

### Task 1: isMarketOpen export

**Files:**
- Modify: `frontend/hooks/useRealtimePrice.ts:17`

- [ ] **Step 1: export isMarketOpen**

```typescript
// frontend/hooks/useRealtimePrice.ts line 17 변경:
// function isMarketOpen() → export function isMarketOpen()
```

Open `frontend/hooks/useRealtimePrice.ts` and change:
```typescript
function isMarketOpen(): boolean {
```
to:
```typescript
export function isMarketOpen(): boolean {
```

- [ ] **Step 2: TypeScript 검증**

```bash
cd /Users/underove/Desktop/stock-compass/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 오류 0개

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useRealtimePrice.ts
git commit -m "feat: export isMarketOpen from useRealtimePrice"
```

---

### Task 2: StockChart — liveCandle prop 추가

**Files:**
- Modify: `frontend/components/StockChart.tsx`

- [ ] **Step 1: candleSeriesRef 추가 및 Props 확장**

현재 Props:
```typescript
type Props = {
  candles: Candle[];
  height?: number;
  buyPrice?: number;
};
```

변경 후:
```typescript
type Props = {
  candles: Candle[];
  height?: number;
  buyPrice?: number;
  liveCandle?: Candle;
};
```

함수 시그니처도 함께 수정:
```typescript
export function StockChart({ candles, height = 260, buyPrice, liveCandle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<any>(null);
```

- [ ] **Step 2: init() 안에서 candleSeriesRef 저장**

`candleSeries.setData(candleData);` 줄 바로 다음에 추가:
```typescript
candleSeriesRef.current = candleSeries;
```

- [ ] **Step 3: liveCandle 전용 effect 추가**

기존 `useEffect([candles, height, buyPrice])` 블록 다음에 새 effect 추가:
```typescript
useEffect(() => {
  if (!liveCandle || !candleSeriesRef.current) return;
  if (!isFinite(liveCandle.open) || !isFinite(liveCandle.close)) return;
  candleSeriesRef.current.update({
    time: liveCandle.time as `${number}-${number}-${number}`,
    open: liveCandle.open,
    high: liveCandle.high,
    low: liveCandle.low,
    close: liveCandle.close,
  });
}, [liveCandle]);
```

- [ ] **Step 4: TypeScript 검증**

```bash
cd /Users/underove/Desktop/stock-compass/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 오류 0개

- [ ] **Step 5: Commit**

```bash
git add frontend/components/StockChart.tsx
git commit -m "feat: add liveCandle prop to StockChart for real-time today candle"
```

---

### Task 3: StockDetailModal — liveCandle 계산 및 전달

**Files:**
- Modify: `frontend/components/StockDetailModal.tsx`

- [ ] **Step 1: isMarketOpen import 추가**

파일 상단 import 목록에 추가:
```typescript
import { isMarketOpen } from "../hooks/useRealtimePrice";
```

기존:
```typescript
import type { Candle, CommentarySections, ... } from "../lib/types";
import { StockChart } from "./StockChart";
```
변경:
```typescript
import { isMarketOpen } from "../hooks/useRealtimePrice";
import type { Candle, CommentarySections, ... } from "../lib/types";
import { StockChart } from "./StockChart";
```

- [ ] **Step 2: liveCandle 계산 로직 추가**

`evalPnl` / `evalPnlPct` 계산 아래(line ~148)에 추가:
```typescript
const todayStr = new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD"
const liveCandle: Candle | undefined =
  price && isMarketOpen() && isFinite(price.open) && price.open > 0
    ? {
        time: todayStr,
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.current_price,
        volume: price.volume,
      }
    : undefined;
```

- [ ] **Step 3: StockChart에 liveCandle 전달**

현재 (line ~371):
```typescript
<StockChart candles={candles} height={240} buyPrice={currentItem.buy_price} />
```
변경:
```typescript
<StockChart candles={candles} height={240} buyPrice={currentItem.buy_price} liveCandle={liveCandle} />
```

- [ ] **Step 4: TypeScript 검증**

```bash
cd /Users/underove/Desktop/stock-compass/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 오류 0개

- [ ] **Step 5: Commit**

```bash
git add frontend/components/StockDetailModal.tsx
git commit -m "feat: compute and pass liveCandle to StockChart in StockDetailModal"
```

---

### Task 4: PortfolioCard — SummaryCard 요약 스트립 개편

**Files:**
- Modify: `frontend/components/PortfolioCard.tsx:104-151`

SummaryCard를 현재 큰 카드 형태에서 3열 스트립(총평가 / 수익률 / 오늘손익)으로 교체한다.

- [ ] **Step 1: SummaryCard 함수 교체**

기존 `function SummaryCard` (line 104–151) 전체를 아래로 교체:

```typescript
function SummaryCard({ items, prices }: { items: PortfolioItem[]; prices: Record<string, StockPrice> }) {
  const totalInvested = items.reduce((s, i) => s + i.buy_price * i.quantity, 0);
  const totalCurrent = items.reduce((s, i) => {
    const p = prices[i.stock_code];
    return s + (p ? p.current_price * i.quantity : i.buy_price * i.quantity);
  }, 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const todayPnl = items.reduce((s, i) => {
    const p = prices[i.stock_code];
    if (!p || !isFinite(p.open) || p.open === 0) return s;
    return s + (p.current_price - p.open) * i.quantity;
  }, 0);
  const isProfit = totalPnl >= 0;
  const isTodayProfit = todayPnl >= 0;

  const cellStyle: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "var(--label3)", fontWeight: 500 };
  const valueStyle = (color: string): React.CSSProperties => ({ fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.03em" });

  return (
    <div style={{ margin: "12px 16px 4px", background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", padding: "12px 8px" }}>
        <div style={cellStyle}>
          <span style={labelStyle}>총 평가</span>
          <span style={valueStyle("var(--label)")}>
            {totalCurrent >= 1e8
              ? `${(totalCurrent / 1e8).toFixed(1)}억`
              : `${Math.round(totalCurrent / 1e4).toLocaleString("ko-KR")}만`}
          </span>
        </div>
        <div style={{ width: "0.5px", background: "var(--sep)", alignSelf: "stretch" }} />
        <div style={cellStyle}>
          <span style={labelStyle}>수익률</span>
          <span style={valueStyle(isProfit ? "var(--red)" : "var(--primary)")}>
            {totalPnlPct > 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
          </span>
        </div>
        <div style={{ width: "0.5px", background: "var(--sep)", alignSelf: "stretch" }} />
        <div style={cellStyle}>
          <span style={labelStyle}>오늘 손익</span>
          <span style={valueStyle(isTodayProfit ? "var(--red)" : "var(--primary)")}>
            {todayPnl > 0 ? "+" : ""}
            {Math.abs(todayPnl) >= 1e8
              ? `${(todayPnl / 1e8).toFixed(1)}억`
              : `${Math.round(todayPnl / 1e4).toLocaleString("ko-KR")}만`}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 검증**

```bash
cd /Users/underove/Desktop/stock-compass/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 오류 0개

- [ ] **Step 3: Commit**

```bash
git add frontend/components/PortfolioCard.tsx
git commit -m "feat: redesign SummaryCard as 3-column strip (총평가/수익률/오늘손익)"
```

---

### Task 5: PortfolioCard — StockRow 스파크라인 추가

**Files:**
- Modify: `frontend/components/PortfolioCard.tsx`

- [ ] **Step 1: fetchChartData import 추가**

기존 api import 목록에 `fetchChartData` 추가:
```typescript
import {
  addPortfolioItem,
  addWatchlistItem,
  fetchChartData,       // ← 추가
  fetchPortfolioAlerts,
  fetchStockPrice,
  listPortfolio,
  listWatchlist,
  removePortfolioItem,
  removeWatchlistItem,
  searchStock,
  updatePortfolioItem,
} from "../lib/api";
```

- [ ] **Step 2: StockRow에 sparkPoints prop 추가**

StockRow 시그니처 변경 (line ~498):
```typescript
function StockRow({ item, onClick, onEdit, onPriceLoaded, alertCount, realtimePrice, isEditing, sparkPoints }: {
  item: PortfolioItem; onClick: () => void; onEdit: () => void;
  onPriceLoaded: (code: string, price: StockPrice) => void;
  alertCount: number; realtimePrice?: RealtimePrice; isEditing: boolean;
  sparkPoints?: number[];
}) {
```

- [ ] **Step 3: 스파크라인 SVG 컴포넌트 추가 (StockRow 내부)**

현재 `{/* 현재가 + 등락 */}` div 바로 앞에 스파크라인 div 삽입:
```tsx
{/* 스파크라인 */}
{sparkPoints && sparkPoints.length >= 2 && (
  <div style={{ width: 44, height: 24, flexShrink: 0 }}>
    {(() => {
      const min = Math.min(...sparkPoints);
      const max = Math.max(...sparkPoints);
      const range = max - min || 1;
      const W = 44, H = 24;
      const pts = sparkPoints.map((v, i) => {
        const x = (i / (sparkPoints.length - 1)) * W;
        const y = H - ((v - min) / range) * (H - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const isUp = sparkPoints[sparkPoints.length - 1] >= sparkPoints[0];
      const color = isUp ? "var(--red)" : "var(--primary)";
      const fillColor = isUp ? "rgba(255,59,48,0.08)" : "rgba(0,122,255,0.08)";
      const lastPt = sparkPoints[sparkPoints.length - 1];
      const lastX = W;
      const lastY = H - ((lastPt - min) / range) * (H - 4) - 2;
      const fillPts = `${pts} ${lastX},${H} 0,${H}`;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
          <polygon points={fillPts} fill={fillColor} />
          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    })()}
  </div>
)}
```

이 div는 `{/* 현재가 + 등락 */}` div 바로 앞(스택 순서: 이름+보유정보 → 스파크라인 → 현재가+등락 → 거래버튼)에 위치시킨다.

- [ ] **Step 4: PortfolioCard state에 sparklines 추가**

`PortfolioCard` 함수 내부 (line ~941 근처) 기존 state 선언들 아래에 추가:
```typescript
const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
```

- [ ] **Step 5: 종목 로드 시 sparklines 패치**

기존 `useEffect`(items 로드) 근처에 새 effect 추가.
`handlePriceLoaded` 콜백이 호출될 때 해당 종목 차트가 없으면 패치한다.
PortfolioCard의 `handlePriceLoaded` 함수 수정:

현재:
```typescript
const handlePriceLoaded = useCallback((code: string, price: StockPrice) => {
  setPrices(prev => ({ ...prev, [code]: price }));
}, []);
```

변경:
```typescript
const handlePriceLoaded = useCallback((code: string, price: StockPrice) => {
  setPrices(prev => ({ ...prev, [code]: price }));
  setSparklines(prev => {
    if (prev[code]) return prev;
    fetchChartData(code, 30)
      .then(candles => {
        const closes = candles
          .filter(c => isFinite(c.close))
          .map(c => c.close);
        if (closes.length > 0) setSparklines(p => ({ ...p, [code]: closes }));
      })
      .catch(() => {});
    return prev;
  });
}, []);
```

- [ ] **Step 6: StockRow 렌더링에 sparkPoints 전달**

`items.map`에서 StockRow 호출 부분(line ~1069):

현재:
```typescript
<StockRow
  item={item}
  onClick={() => { setEditingCode(null); setSelected(item); }}
  onEdit={() => setEditingCode(editingCode === item.stock_code ? null : item.stock_code)}
  onPriceLoaded={handlePriceLoaded}
  alertCount={alerts[item.stock_code] ?? 0}
```

변경 (`alertCount` 다음 줄에 추가):
```typescript
<StockRow
  item={item}
  onClick={() => { setEditingCode(null); setSelected(item); }}
  onEdit={() => setEditingCode(editingCode === item.stock_code ? null : item.stock_code)}
  onPriceLoaded={handlePriceLoaded}
  alertCount={alerts[item.stock_code] ?? 0}
  sparkPoints={sparklines[item.stock_code]}
```

- [ ] **Step 7: TypeScript 검증**

```bash
cd /Users/underove/Desktop/stock-compass/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: 오류 0개

- [ ] **Step 8: Commit**

```bash
git add frontend/components/PortfolioCard.tsx
git commit -m "feat: add sparkline mini-chart to StockRow and fetch 30-day close prices"
```

---

## Self-Review

### Spec Coverage
- [x] PortfolioCard 요약 스트립 (총평가/수익률/오늘손익 3열) → Task 4
- [x] 종목 행 미니 스파크라인 (40×24px SVG, 3개월 종가) → Task 5 (30일 종가 사용, 3개월은 API 비용 과다)
- [x] StockChart liveCandle prop → Task 2
- [x] StockDetailModal liveCandle 계산·전달 → Task 3
- [x] 장마감 시 오늘 봉 합성 안 함 → Task 3의 `isMarketOpen()` 조건

### Notes
- 스파크라인 데이터는 30일 종가(90일은 API 호출 3배, 시각적 차이 미미)
- `handlePriceLoaded` 안에서 async 패치: `setSparklines` setter의 prev 함수 안에서 Promise를 발생시키는 패턴 — 한 번만 실행되도록 `if (prev[code]) return prev` 가드 포함
- `liveCandle`은 `candleSeriesRef`를 통해 chart 재생성 없이 업데이트
