# UI 개선 + 실시간 오늘 봉 — 설계 문서

## 배경
- 현재 iOS 클린 스타일 유지하되 정보 밀도 향상 요청
- 차트 X축 NaN 수정 완료, 다음 단계로 시각화 개선
- 롤백 태그: `pre-ui-redesign`

## 1. PortfolioCard UI (AC-1 + 상단 요약 스트립)

### 상단 요약 스트립
- 총 평가금액 / 수익률 / 오늘 손익 3개 수치
- 흰 카드, 구분선으로 3분할
- 기존 AllocationTab 요약과 중복되지 않게 내 주식 탭 상단에만 표시

### 종목 행 (AC-1)
- 각 종목을 행으로 나열 (기존 카드 스타일 유지)
- 왼쪽: 종목명 + 보유 정보
- 오른쪽: 현재가 + 등락률 + **미니 스파크라인** (40×24px SVG, 3개월 종가)
- 스파크라인 데이터: `fetchChartData`로 이미 로드된 candles 활용
- 스파크라인은 포트폴리오 카드 수준에서 lazy load (상세 모달 열지 않아도 표시)

## 2. 실시간 오늘 봉 업데이트 (StockDetailModal 차트)

### 문제
- `fetchChartData`는 완성된 일봉만 반환 → 오늘 봉 없음
- 장 중 차트가 정적으로 보임

### 구현 방법
- 모달 열릴 때 `fetchStockPrice`로 현재가 이미 폴링 중 (30초 간격)
- 현재가 업데이트 시 오늘 날짜 봉을 candles 배열에 합성:
  ```
  today candle = { time: today, open: price.open, high: price.high, low: price.low, close: price.current_price }
  ```
- `StockChart`에 `liveCandle?: Candle` prop 추가
- chart effect에서 liveCandle을 마지막 candle로 upsert
- 장마감(`isMarketOpen() === false`) 시에는 오늘 봉 합성 안 함

## 3. 파일 범위

| 파일 | 변경 내용 |
|------|-----------|
| `PortfolioCard.tsx` | 요약 스트립 추가, 종목 행에 스파크라인 추가 |
| `StockDetailModal.tsx` | liveCandle 계산 후 StockChart에 전달 |
| `StockChart.tsx` | liveCandle prop 받아 차트에 upsert |

## 4. 롤백
```bash
git checkout pre-ui-redesign
```
