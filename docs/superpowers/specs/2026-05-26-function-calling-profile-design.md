# Sub-project B: Function Calling + 투자 성향 메모리 Design

## Goal

AI 채팅이 실시간 데이터를 능동적으로 조회(Function Calling)하고, 사용자의 투자 성향을 기억해 맞춤 답변을 제공한다.

## Architecture

기존 `qa.py` RAG 파이프라인을 유지하면서, 마지막 Gemini 호출을 `generate_answer()` → `generate_with_tools()`로 교체한다. 도구는 RAG가 제공하지 못하는 실시간 데이터 전용이다. 기존 포트폴리오 컨텍스트 주입과 뉴스 상시 검색은 도구로 이전해 불필요한 토큰을 절감한다.

## Function Calling

### Tools (read-only, 5개)

| 도구 | 입력 | 출력 |
|------|------|------|
| `get_stock_price` | `stock_code: str` | 현재가, 등락률, 거래량 |
| `get_portfolio` | (없음) | 종목별 현재가·손익·수량 |
| `search_recent_news` | `query: str` | 최근 뉴스 3건 |
| `get_technical_indicators` | `stock_code: str` | RSI, MACD, 5/20/60일 이동평균 |
| `get_dart_disclosures` | `corp_name: str` | 최근 공시 3건 |

포트폴리오 조작(매수/매도) 도구는 포함하지 않는다.

### Tool Call Loop

```
Gemini ← [RAG 컨텍스트 + 사용자 프로필 + 질문 + 5개 tool definitions]
  if tool_call → execute → 결과 반환 → 재호출 (최대 3회)
  if text → 종료
```

### 환각 최소화 규칙 (SYSTEM_INSTRUCTION 추가)

- 수치(가격·수익률·지표)는 반드시 도구 결과 또는 RAG 자료에서 인용
- 도구 실패 시 "현재 조회할 수 없습니다"로 명시, 추측 금지
- 출처 없는 미래 수익 예측 표현 금지

### 비용 절감

기존 `ask.py`의 `_build_portfolio_context()` 상시 주입과 `search_news()` 상시 호출을 제거하고 각각 `get_portfolio`, `search_recent_news` 도구로 대체한다. Gemini가 필요할 때만 호출하므로 평균 입력 토큰 감소.

## 투자 성향 메모리

### DB 스키마 (`user_profiles` 테이블, SQLite)

```sql
CREATE TABLE user_profiles (
    username      TEXT PRIMARY KEY,
    risk_level    TEXT DEFAULT 'neutral',   -- aggressive / neutral / defensive
    horizon       TEXT DEFAULT 'mid',       -- short / mid / long
    sectors       TEXT DEFAULT '[]',        -- JSON 배열, 최대 3개
    ai_memo       TEXT DEFAULT '',          -- AI 추론 메모 (1~2문장)
    updated_at    TEXT NOT NULL
);
```

### 선호 섹터 목록 (10개, 최대 3개 선택)

반도체 / 2차전지·전기차 / 바이오·제약 / 자동차 / IT·플랫폼 / 금융·보험 / 게임·엔터 / 화학·소재 / 조선·방산 / 소비재·유통

### 프롬프트 주입 형태

```
[사용자 투자 성향]
리스크: 공격적 / 기간: 단기 / 선호 섹터: 반도체, IT·플랫폼
AI 메모: 모멘텀 중심, 기술적 분석 선호, 빠른 의사결정 패턴
```

### AI 메모 업데이트

- 채팅 답변 후 FastAPI `BackgroundTasks`로 비동기 실행 (응답 지연 없음)
- 주 1회 이상 대화한 경우에만 실행 (비용 절약)
- 질문 + 답변 + 현재 ai_memo → Gemini → 1~2문장 갱신

## API

- `GET /api/profile` — 사용자 프로필 조회
- `PUT /api/profile` — risk_level, horizon, sectors 수정 (ai_memo는 서버 전용)

## 파일 구조

### 신규

- `backend/app/tools.py` — 5개 도구 정의(FunctionDeclaration) + 실행 로직
- `backend/app/api/profile.py` — GET/PUT /api/profile
- `frontend/components/ProfileSettings.tsx` — 성향 설정 패널

### 수정

- `backend/app/llm/gemini.py` — `generate_with_tools()` 추가
- `backend/app/db/trade_db.py` — `user_profiles` 테이블 + CRUD 추가
- `backend/app/api/ask.py` — 포트폴리오 주입·뉴스 제거, tool-calling 흐름 + 프로필 주입 + BackgroundTask
- `backend/main.py` — profile 라우터 등록
- `frontend/components/ChatCard.tsx` — 헤더 설정 아이콘 + ProfileSettings 연결
- `frontend/lib/types.ts` — `UserProfile` 타입 추가
- `frontend/lib/api.ts` — `getProfile()`, `updateProfile()` 추가

## Frontend UI

ChatCard 헤더 우측에 ⚙ 아이콘 추가. 클릭 시 ProfileSettings 패널이 채팅 카드 상단에 슬라이드 인.

ProfileSettings 패널:
```
리스크 성향    [공격적]  [중립]  [방어적]
투자 기간      [단기]  [중기]  [장기]
선호 섹터      [반도체] [2차전지·전기차] [바이오·제약] ...  (최대 3개)
──────────────────────────────────────
AI 메모        "..." (읽기 전용, 마지막 업데이트 날짜)
```
