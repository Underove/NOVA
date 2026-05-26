# backend/app/collectors/screener_collector.py
"""KIS REST + Naver Finance 기반 전 종목 기본적 지표 + TA 배치 수집."""
import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# 앱 섹터 → KIS bstp_kor_isnm 키워드 매핑
_KIS_SECTOR_KEYWORDS: dict[str, list[str]] = {
    "반도체":        ["반도체", "디스플레이", "전자부품"],
    "2차전지·전기차": ["이차전지", "2차전지", "전기차", "자동차부품"],
    "바이오·제약":   ["제약", "바이오", "의료", "헬스케어"],
    "자동차":        ["자동차", "운수장비"],
    "IT·플랫폼":     ["소프트웨어", "인터넷", "통신", "IT서비스", "게임"],
    "금융·보험":     ["은행", "보험", "증권", "금융"],
    "게임·엔터":     ["게임", "엔터테인먼트", "미디어", "방송"],
    "화학·소재":     ["화학", "정유", "소재", "철강", "비금속"],
    "조선·방산":     ["조선", "방위산업", "기계", "항공"],
    "소비재·유통":   ["유통", "음식료", "소비재", "섬유", "의류"],
}

_DART_CORP_CODES = Path(__file__).resolve().parent.parent.parent / "data" / "dart" / "corp_codes.json"


def _load_dart_codes() -> list[dict]:
    """DART corp_codes.json에서 종목 코드+이름 목록 반환."""
    if not _DART_CORP_CODES.exists():
        return []
    with open(_DART_CORP_CODES, encoding="utf-8") as f:
        return json.load(f)


def _kis_sector_to_app(sector_name: str) -> str:
    """KIS bstp_kor_isnm → 앱 섹터 문자열 매핑."""
    if not sector_name:
        return "기타"
    name_lower = sector_name.lower()
    for app_sector, keywords in _KIS_SECTOR_KEYWORDS.items():
        if any(kw in sector_name for kw in keywords):
            return app_sector
    return "기타"


def _naver_batch_market_cap(codes: list[str]) -> dict[str, int]:
    """네이버 금융 polling API로 시가총액(억 원) 배치 조회. {code: 억원} 반환."""
    result: dict[str, int] = {}
    batch_size = 100
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "ko-KR,ko",
    }
    for i in range(0, len(codes), batch_size):
        batch = codes[i : i + batch_size]
        codes_str = ",".join(batch)
        try:
            r = httpx.get(
                f"https://polling.finance.naver.com/api/realtime/domestic/stock/{codes_str}",
                headers=headers,
                timeout=10,
            )
            if r.status_code != 200:
                continue
            data = r.json()
            # polling API 응답: {"datas": {"005930": {"stockName": ..., "closePriceRaw": ..., "marketValueFullRaw": ...}}}
            items = data.get("datas") or {}
            if isinstance(items, list):
                for item in items:
                    code = str(item.get("itemCode") or item.get("code") or "").zfill(6)
                    raw_cap = item.get("marketValueFullRaw") or 0
                    if code and raw_cap:
                        result[code] = int(raw_cap) // 100_000_000
            elif isinstance(items, dict):
                for code_key, item in items.items():
                    code = str(code_key).zfill(6)
                    raw_cap = item.get("marketValueFullRaw") or 0
                    if raw_cap:
                        result[code] = int(raw_cap) // 100_000_000
        except Exception as e:
            logger.debug("[스크리너] 네이버 배치 시총 실패 (%d~): %s", i, e)
        time.sleep(0.1)
    return result


def fetch_all_fundamentals() -> list[dict]:
    """전 종목 기본적 지표 + 섹터 수집. 반환: list of screener_snapshot 행 dict."""
    from app.collectors.kis_rest import _inquire_price, get_fundamental_kis

    corps = _load_dart_codes()
    if not corps:
        logger.error("[스크리너] DART corp_codes.json 없음")
        return []

    all_codes = [c["stock_code"] for c in corps if c.get("stock_code")]
    corp_name_map = {c["stock_code"]: c["corp_name"] for c in corps if c.get("stock_code")}

    logger.info("[스크리너] 네이버 배치 시총 조회: %d종목", len(all_codes))
    cap_map = _naver_batch_market_cap(all_codes)

    # 시총 상위 250 종목만 KIS로 정밀 조회
    TOP_N = 250
    top_codes = sorted(cap_map, key=lambda c: cap_map[c], reverse=True)[:TOP_N]
    logger.info("[스크리너] KIS 기본적 지표 조회: %d종목", len(top_codes))

    result: list[dict] = []
    for i, code in enumerate(top_codes):
        try:
            out = _inquire_price(code)
            per = _pos(out.get("per"))
            pbr = _pos(out.get("pbr"))
            avls = out.get("hts_avls")
            market_cap = int(float(avls) * 1e8) // 100_000_000 if avls else cap_map.get(code, 0)

            sector_raw = out.get("bstp_kor_isnm") or ""
            sector = _kis_sector_to_app(sector_raw)

            corp_name = out.get("hts_kor_isnm") or corp_name_map.get(code, code)

            momentum = _compute_momentum_20d(code)

            result.append({
                "stock_code":   code,
                "corp_name":    corp_name,
                "sector":       sector,
                "market_cap":   market_cap,
                "per":          per,
                "pbr":          pbr,
                "momentum_20d": momentum,
                "rsi":          None,
                "ma_status":    None,
                "has_ta":       0,
            })
        except Exception as e:
            logger.debug("[스크리너] %s 처리 실패: %s", code, e)

        # KIS 요청 레이트 리밋: 초당 ~15건
        if (i + 1) % 15 == 0:
            time.sleep(1)
        if (i + 1) % 50 == 0:
            logger.info("[스크리너] 진행: %d/%d", i + 1, len(top_codes))

    logger.info("[스크리너] 기본적 지표 수집 완료: %d종목", len(result))
    return result


def _pos(v) -> float | None:
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def _compute_momentum_20d(stock_code: str) -> float | None:
    """최근 20거래일 수익률(%)."""
    try:
        from app.collectors.krx import get_chart_data
        candles = get_chart_data(stock_code, days=25)
        if len(candles) < 20:
            return None
        price_now = candles[-1]["close"]
        price_20d_ago = candles[-20]["close"]
        if price_20d_ago == 0:
            return None
        return round((price_now - price_20d_ago) / price_20d_ago * 100, 2)
    except Exception:
        return None


def compute_ta_for_top_n(n: int = 300) -> list[dict]:
    """시총 상위 n개 종목의 RSI·MA 상태 계산. 반환: list of {stock_code, rsi, ma_status}."""
    from app.collectors.ta_engine import analyze
    from app.db.trade_db import get_top_market_cap_codes

    codes = get_top_market_cap_codes(n)
    logger.info("[스크리너] TA 배치 계산 시작: %d종목", len(codes))

    results: list[dict] = []
    for i, code in enumerate(codes):
        try:
            ta = analyze(code)
            if ta.get("error"):
                continue
            results.append({
                "stock_code": code,
                "rsi":        ta.get("rsi"),
                "ma_status":  ta.get("cross_5_20"),
            })
        except Exception as e:
            logger.debug("[스크리너] TA 계산 실패 (%s): %s", code, e)
        if (i + 1) % 50 == 0:
            logger.info("[스크리너] TA 진행: %d/%d", i + 1, len(codes))

    logger.info("[스크리너] TA 배치 완료: %d종목", len(results))
    return results
