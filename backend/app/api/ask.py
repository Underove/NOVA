from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.rag.qa import answer_with_context

router = APIRouter()

_PORTFOLIO_KEYWORDS = (
    "포트폴리오", "포폴", "내 주식", "보유", "수익률", "손익",
    "전반", "현황", "내 종목", "내가 가진", "내가 보유", "요약해",
    "어때", "어떠", "평가", "총액", "얼마야", "얼마나",
)


def _is_portfolio_question(q: str) -> bool:
    return any(kw in q for kw in _PORTFOLIO_KEYWORDS)


def _build_portfolio_context(username: str) -> str | None:
    try:
        from app.api.portfolio import _get_price, _load
        items = _load(username)
        if not items:
            return None
        lines = []
        for item in items[:10]:
            try:
                p = _get_price(item["stock_code"])
                cp = p["current_price"]
                pnl_pct = ((cp - item["buy_price"]) / item["buy_price"] * 100) if item["buy_price"] else 0
                pnl_amt = (cp - item["buy_price"]) * item["quantity"]
                lines.append(
                    f"- {item['corp_name']}({item['stock_code']}): "
                    f"현재가 {cp:,}원, 매수단가 {item['buy_price']:,}원, "
                    f"수량 {item['quantity']}주, 평가손익 {pnl_pct:+.1f}% ({pnl_amt:+,.0f}원)"
                )
            except Exception:
                lines.append(f"- {item['corp_name']}: 시세 조회 불가")
        return "[사용자 보유 포트폴리오]\n" + "\n".join(lines)
    except Exception:
        return None


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    n_chunks: int = Field(default=5, ge=1, le=10)


class AskSource(BaseModel):
    snippet: str
    label: str
    distance: float


class CompanySynced(BaseModel):
    corp_name: str
    stock_code: str


class AskResponse(BaseModel):
    question: str
    answer: str
    sources: list[AskSource]
    companies_synced: list[CompanySynced] = []


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest, username: str = Depends(get_current_user)) -> AskResponse:
    if not req.question.strip():
        raise HTTPException(400, "질문을 입력해주세요")

    portfolio_ctx: str | None = None
    if _is_portfolio_question(req.question):
        portfolio_ctx = _build_portfolio_context(username)

    try:
        result = answer_with_context(req.question, n_chunks=req.n_chunks, portfolio_context=portfolio_ctx)
    except Exception as e:
        raise HTTPException(500, f"답변 생성 실패: {type(e).__name__}: {e}")

    return AskResponse(
        question=req.question,
        answer=result["answer"],
        sources=[AskSource(**s) for s in result["sources"]],
        companies_synced=[CompanySynced(**c) for c in result.get("companies_synced", [])],
    )
