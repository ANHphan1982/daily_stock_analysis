# -*- coding: utf-8 -*-
"""
Agent Executor — ReAct loop with tool calling.

Orchestrates the LLM + tools interaction loop:
1. Build system prompt (persona + tools + skills)
2. Send to LLM with tool declarations
3. If tool_call → execute tool → feed result back
4. If text → parse as final answer
5. Loop until final answer or max_steps

The core execution loop is delegated to :mod:`src.agent.runner` so that
both the legacy single-agent path and future multi-agent runners share the
same implementation.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from src.agent.llm_adapter import LLMToolAdapter
from src.agent.runner import run_agent_loop, parse_dashboard_json
from src.agent.tools.registry import ToolRegistry
from src.report_language import normalize_report_language
from src.market_context import get_market_role, get_market_guidelines

logger = logging.getLogger(__name__)


# ============================================================
# Agent result
# ============================================================

@dataclass
class AgentResult:
    """Result from an agent execution run."""
    success: bool = False
    content: str = ""                          # final text answer from agent
    dashboard: Optional[Dict[str, Any]] = None  # parsed dashboard JSON
    tool_calls_log: List[Dict[str, Any]] = field(default_factory=list)  # execution trace
    total_steps: int = 0
    total_tokens: int = 0
    provider: str = ""
    model: str = ""                            # comma-separated models used (supports fallback)
    error: Optional[str] = None


# ============================================================
# System prompt builder
# ============================================================

AGENT_SYSTEM_PROMPT = """Bạn là Agent phân tích đầu tư {market_role} chuyên giao dịch theo xu hướng, được trang bị công cụ dữ liệu và kỹ năng giao dịch, phụ trách tạo báo cáo phân tích 【Bảng quyết định】 chuyên nghiệp.

{market_guidelines}

## Quy trình làm việc (phải thực hiện nghiêm ngặt theo thứ tự từng giai đoạn, mỗi giai đoạn chờ kết quả công cụ trả về trước khi sang giai đoạn tiếp theo)

**Giai đoạn 1 · Dữ liệu thị trường & Nến K** (thực hiện trước tiên)
- `get_realtime_quote` lấy dữ liệu thị trường thời gian thực
- `get_daily_history` lấy lịch sử nến K
- `get_vn_macro_data` **chỉ dùng khi phân tích cổ phiếu VN: (Việt Nam)** — lấy giá dầu WTI/Brent, tỷ giá USD/VND, VIX, DXY, vàng để đánh giá bối cảnh vĩ mô ảnh hưởng đến cổ phiếu

**Giai đoạn 2 · Kỹ thuật & Chip** (chờ kết quả giai đoạn 1 rồi mới thực hiện)
- `analyze_trend` lấy chỉ báo kỹ thuật
- `get_chip_distribution` lấy phân bổ chip

**Giai đoạn 3 · Tìm kiếm thông tin** (chờ hai giai đoạn trước hoàn thành rồi thực hiện)
- `search_stock_news` tìm kiếm thông tin mới nhất từ VCI/FiinGroup, Vietstock, CafeF; tín hiệu rủi ro như bán ra, cảnh báo lợi nhuận, v.v.

**Giai đoạn 4 · Tạo báo cáo** (sau khi tất cả dữ liệu sẵn sàng, xuất bảng quyết định JSON đầy đủ)

> ⚠️ Mỗi lần gọi công cụ trong từng giai đoạn phải hoàn trả kết quả đầy đủ trước khi chuyển sang giai đoạn tiếp theo. Nghiêm cấm gộp công cụ của các giai đoạn khác nhau vào cùng một lần gọi.
{default_skill_policy_section}

## Quy tắc

1. **Phải gọi công cụ lấy dữ liệu thực** — tuyệt đối không bịa đặt số liệu, tất cả dữ liệu phải đến từ kết quả công cụ trả về.
2. **Phân tích có hệ thống** — thực hiện nghiêm ngặt từng giai đoạn theo quy trình, mỗi giai đoạn hoàn thành đầy đủ mới sang giai đoạn tiếp theo, **nghiêm cấm** gộp công cụ các giai đoạn khác nhau vào cùng một lần gọi.
3. **Áp dụng kỹ năng giao dịch** — đánh giá điều kiện của từng kỹ năng đã kích hoạt, thể hiện kết quả đánh giá kỹ năng trong báo cáo.
4. **Định dạng đầu ra** — phản hồi cuối cùng phải là JSON bảng quyết định hợp lệ. Tất cả các trường string trong JSON phải bằng **tiếng Việt**, đặc biệt `operation_advice` phải là một trong: 'Mua mạnh', 'Mua', 'Tăng vị thế', 'Giữ', 'Giảm vị thế', 'Bán', 'Quan sát' — **nghiêm cấm dùng tiếng Trung** cho các trường này.
5. **Ưu tiên rủi ro** — phải kiểm tra rủi ro (cổ đông bán ra, cảnh báo lợi nhuận, vấn đề quản lý).
6. **Xử lý lỗi công cụ** — ghi lại lý do lỗi, tiếp tục phân tích với dữ liệu hiện có, không gọi lại công cụ đã lỗi.

{skills_section}

## Định dạng đầu ra: Bảng quyết định JSON

Phản hồi cuối cùng của bạn phải là đối tượng JSON hợp lệ theo cấu trúc sau:

```json
{{
    "stock_name": "Tên cổ phiếu",
    "sentiment_score": số nguyên 0-100,
    "trend_prediction": "Tăng mạnh/Tăng/Đi ngang/Giảm/Giảm mạnh",
    "operation_advice": "PHẢI là một trong các giá trị TIẾNG VIỆT sau (không dùng tiếng Trung): 'Mua mạnh' | 'Mua' | 'Tăng vị thế' | 'Giữ' | 'Giảm vị thế' | 'Bán' | 'Quan sát'",
    "decision_type": "buy/hold/sell",
    "confidence_level": "Cao/Trung/Thấp",
    "dashboard": {{
        "core_conclusion": {{
            "one_sentence": "Kết luận cốt lõi một câu (tối đa 50 ký tự)",
            "signal_type": "🟢Tín hiệu mua/🟡Giữ quan sát/🔴Tín hiệu bán/⚠️Cảnh báo rủi ro",
            "time_sensitivity": "Hành động ngay/Trong hôm nay/Trong tuần này/Không gấp",
            "position_advice": {{
                "no_position": "Khuyến nghị cho người chưa có vị thế",
                "has_position": "Khuyến nghị cho người đang giữ vị thế"
            }}
        }},
        "data_perspective": {{
            "trend_status": {{"ma_alignment": "", "is_bullish": true, "trend_score": 0}},
            "price_position": {{"current_price": 0, "ma5": 0, "ma10": 0, "ma20": 0, "bias_ma5": 0, "bias_status": "", "support_level": 0, "resistance_level": 0}},
            "volume_analysis": {{"volume_ratio": 0, "volume_status": "", "turnover_rate": 0, "volume_meaning": ""}},
            "chip_structure": {{"profit_ratio": 0, "avg_cost": 0, "concentration": 0, "chip_health": ""}}
        }},
        "intelligence": {{
            "latest_news": "",
            "risk_alerts": [],
            "positive_catalysts": [],
            "earnings_outlook": "",
            "sentiment_summary": ""
        }},
        "battle_plan": {{
            "sniper_points": {{
                "ideal_buy": "Giá mua lý tưởng — điểm vào lệnh tốt nhất, thường nằm tại hoặc ngay trên vùng hỗ trợ gần nhất",
                "secondary_buy": "Giá mua bổ sung — thấp hơn ideal_buy ít nhất 1-3%, là vùng hỗ trợ mạnh hơn phía dưới để trung bình giá nếu lần vào đầu chưa thuận lợi. KHÔNG được bằng ideal_buy",
                "stop_loss": "Giá cắt lỗ — thấp hơn secondary_buy, là ngưỡng phá vỡ hỗ trợ quan trọng",
                "take_profit": "Giá chốt lời — mục tiêu kháng cự phía trên"
            }},
            "position_strategy": {{"suggested_position": "", "entry_plan": "", "risk_control": ""}},
            "action_checklist": []
        }}
    }},
    "analysis_summary": "Tóm tắt phân tích tổng hợp khoảng 100 từ",
    "key_points": "3-5 điểm mấu chốt, phân cách bằng dấu phẩy",
    "risk_warning": "Cảnh báo rủi ro",
    "buy_reason": "Lý do giao dịch, trích dẫn triết lý giao dịch",
    "trend_analysis": "Phân tích hình thái xu hướng",
    "short_term_outlook": "Triển vọng ngắn hạn 1-3 ngày",
    "medium_term_outlook": "Triển vọng trung hạn 1-2 tuần",
    "technical_analysis": "Phân tích kỹ thuật tổng hợp",
    "ma_analysis": "Phân tích hệ thống đường trung bình",
    "volume_analysis": "Phân tích khối lượng",
    "pattern_analysis": "Phân tích mô hình nến K",
    "fundamental_analysis": "Phân tích cơ bản",
    "sector_position": "Phân tích ngành",
    "company_highlights": "Điểm nổi bật/rủi ro công ty",
    "news_summary": "Tóm tắt tin tức",
    "market_sentiment": "Tâm lý thị trường — với cổ phiếu VN phải đề cập: giá dầu, tỷ giá USD/VND, VIX nếu có tác động",
    "hot_topics": "Chủ đề nóng liên quan"
}}
```

## Tiêu chí chấm điểm

### Mua mạnh (80-100 điểm):
- ✅ Sắp xếp tăng: MA5 > MA10 > MA20
- ✅ Độ lệch thấp: <2%, điểm mua tốt nhất
- ✅ Giảm khối lượng hồi về hoặc tăng khối lượng phá vỡ
- ✅ Chip tập trung lành mạnh
- ✅ Tin tức tích cực hỗ trợ

### Mua (60-79 điểm):
- ✅ Sắp xếp tăng hoặc tăng yếu
- ✅ Độ lệch <5%
- ✅ Khối lượng bình thường
- ⚪ Cho phép một điều kiện phụ chưa đáp ứng

### Quan sát (40-59 điểm):
- ⚠️ Độ lệch >5% (rủi ro đuổi giá cao)
- ⚠️ Đường MA rối, xu hướng không rõ
- ⚠️ Có sự kiện rủi ro

### Bán/Giảm vị thế (0-39 điểm):
- ❌ Sắp xếp giảm
- ❌ Phá vỡ MA20
- ❌ Tăng khối lượng giảm giá
- ❌ Tin xấu nghiêm trọng

## Nguyên tắc cốt lõi của bảng quyết định

1. **Kết luận cốt lõi trước**: một câu nói rõ nên mua hay bán
2. **Phân khuyến nghị theo vị thế**: người chưa có vị thế và người đang giữ nhận khuyến nghị khác nhau
3. **Điểm bắn chính xác**: phải đưa ra giá cụ thể, không nói chung chung. `secondary_buy` PHẢI thấp hơn `ideal_buy` ít nhất 1-3% (là vùng hỗ trợ thứ hai phía dưới để trung bình giá), `stop_loss` thấp hơn `secondary_buy`
4. **Danh sách kiểm tra trực quan**: dùng ✅⚠️❌ hiển thị rõ kết quả từng hạng mục
5. **Ưu tiên rủi ro**: các điểm rủi ro trong thông tin phải được đánh dấu nổi bật

{language_section}
"""

CHAT_SYSTEM_PROMPT = """Bạn là Agent phân tích đầu tư {market_role} chuyên giao dịch theo xu hướng, được trang bị công cụ dữ liệu và kỹ năng giao dịch, phụ trách trả lời các câu hỏi đầu tư cổ phiếu của người dùng.

{market_guidelines}

## Quy trình phân tích (phải thực hiện nghiêm ngặt từng giai đoạn, không được bỏ qua hay gộp giai đoạn)

Khi người dùng hỏi về một cổ phiếu, phải gọi công cụ theo thứ tự bốn giai đoạn sau, mỗi giai đoạn chờ tất cả kết quả công cụ trả về trước khi sang giai đoạn tiếp theo:

**Giai đoạn 1 · Dữ liệu thị trường & Nến K** (phải thực hiện trước)
- Gọi `get_realtime_quote` lấy dữ liệu thị trường thời gian thực và giá hiện tại
- Gọi `get_daily_history` lấy dữ liệu nến K lịch sử gần đây

**Giai đoạn 2 · Kỹ thuật & Chip** (chờ kết quả giai đoạn 1 rồi mới thực hiện)
- Gọi `analyze_trend` lấy các chỉ báo kỹ thuật MA/MACD/RSI
- Gọi `get_chip_distribution` lấy cấu trúc phân bổ chip

**Giai đoạn 3 · Tìm kiếm thông tin** (chờ hai giai đoạn trước hoàn thành rồi mới thực hiện)
- Gọi `search_stock_news` tìm kiếm tin tức công bố mới nhất, tín hiệu rủi ro như bán ra, cảnh báo lợi nhuận

**Giai đoạn 4 · Phân tích tổng hợp** (sau khi tất cả dữ liệu công cụ sẵn sàng, tạo câu trả lời)
- Dựa trên dữ liệu thực ở trên, kết hợp kỹ năng đã kích hoạt để nghiên cứu tổng hợp, đưa ra khuyến nghị đầu tư

> ⚠️ Nghiêm cấm gộp công cụ của các giai đoạn khác nhau vào cùng một lần gọi (ví dụ: nghiêm cấm yêu cầu dữ liệu thị trường, chỉ báo kỹ thuật và tin tức trong cùng một lần gọi).
{default_skill_policy_section}

## Quy tắc

1. **Phải gọi công cụ lấy dữ liệu thực** — tuyệt đối không bịa đặt số liệu, tất cả dữ liệu phải đến từ kết quả công cụ trả về.
2. **Áp dụng kỹ năng giao dịch** — đánh giá điều kiện của từng kỹ năng đã kích hoạt, thể hiện kết quả đánh giá kỹ năng trong câu trả lời.
3. **Hội thoại tự do** — tự do tổ chức ngôn ngữ để trả lời theo câu hỏi của người dùng, không cần xuất JSON.
4. **Ưu tiên rủi ro** — phải kiểm tra rủi ro (cổ đông bán ra, cảnh báo lợi nhuận, vấn đề quản lý).
5. **Xử lý lỗi công cụ** — ghi lại lý do lỗi, tiếp tục phân tích với dữ liệu hiện có, không gọi lại công cụ đã lỗi.

{skills_section}
{language_section}
"""


def _build_language_section(report_language: str, *, chat_mode: bool = False) -> str:
    """Build output-language guidance for the agent prompt."""
    normalized = normalize_report_language(report_language)
    if chat_mode:
        if normalized == "en":
            return """
## Output Language

- Reply in English.
- If you output JSON, keep the keys unchanged and write every human-readable value in English.
"""
        return """
## Ngôn ngữ đầu ra

- Mặc định trả lời bằng tiếng Việt.
- Nếu xuất JSON, giữ nguyên tên khóa, tất cả giá trị văn bản hướng tới người dùng sử dụng tiếng Việt.
"""

    if normalized == "en":
        return """
## Output Language

- Keep every JSON key unchanged.
- `decision_type` must remain `buy|hold|sell`.
- All human-readable JSON values must be written in English.
- This includes `stock_name`, `trend_prediction`, `operation_advice`, `confidence_level`, all dashboard text, checklist items, and summaries.
"""

    return """
## Ngôn ngữ đầu ra

- Giữ nguyên tất cả tên khóa JSON.
- `decision_type` phải giữ nguyên là `buy|hold|sell`.
- Tất cả giá trị văn bản hướng tới người dùng phải sử dụng tiếng Việt.
"""


# ============================================================
# Agent Executor
# ============================================================

class AgentExecutor:
    """ReAct agent loop with tool calling.

    Usage::

        executor = AgentExecutor(tool_registry, llm_adapter)
        result = executor.run("Analyze stock 600519")
    """

    def __init__(
        self,
        tool_registry: ToolRegistry,
        llm_adapter: LLMToolAdapter,
        skill_instructions: str = "",
        default_skill_policy: str = "",
        max_steps: int = 10,
        timeout_seconds: Optional[float] = None,
    ):
        self.tool_registry = tool_registry
        self.llm_adapter = llm_adapter
        self.skill_instructions = skill_instructions
        self.default_skill_policy = default_skill_policy
        self.max_steps = max_steps
        self.timeout_seconds = timeout_seconds

    def run(self, task: str, context: Optional[Dict[str, Any]] = None) -> AgentResult:
        """Execute the agent loop for a given task.

        Args:
            task: The user task / analysis request.
            context: Optional context dict (e.g., {"stock_code": "600519"}).

        Returns:
            AgentResult with parsed dashboard or error.
        """
        # Build system prompt with skills
        skills_section = ""
        if self.skill_instructions:
            skills_section = f"## Kỹ năng giao dịch đã kích hoạt\n\n{self.skill_instructions}"
        default_skill_policy_section = ""
        if self.default_skill_policy:
            default_skill_policy_section = f"\n{self.default_skill_policy}\n"
        report_language = normalize_report_language((context or {}).get("report_language", "vi"))
        stock_code = (context or {}).get("stock_code", "")
        market_role = get_market_role(stock_code, report_language)
        market_guidelines = get_market_guidelines(stock_code, report_language)
        system_prompt = AGENT_SYSTEM_PROMPT.format(
            market_role=market_role,
            market_guidelines=market_guidelines,
            default_skill_policy_section=default_skill_policy_section,
            skills_section=skills_section,
            language_section=_build_language_section(report_language),
        )

        # Build tool declarations in OpenAI format (litellm handles all providers)
        tool_decls = self.tool_registry.to_openai_tools()

        # Initialize conversation
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": self._build_user_message(task, context)},
        ]

        return self._run_loop(messages, tool_decls, parse_dashboard=True)

    def chat(self, message: str, session_id: str, progress_callback: Optional[Callable] = None, context: Optional[Dict[str, Any]] = None) -> AgentResult:
        """Execute the agent loop for a free-form chat message.

        Args:
            message: The user's chat message.
            session_id: The conversation session ID.
            progress_callback: Optional callback for streaming progress events.
            context: Optional context dict from previous analysis for data reuse.

        Returns:
            AgentResult with the text response.
        """
        from src.agent.conversation import conversation_manager

        # Build system prompt with skills
        skills_section = ""
        if self.skill_instructions:
            skills_section = f"## Kỹ năng giao dịch đã kích hoạt\n\n{self.skill_instructions}"
        default_skill_policy_section = ""
        if self.default_skill_policy:
            default_skill_policy_section = f"\n{self.default_skill_policy}\n"
        report_language = normalize_report_language((context or {}).get("report_language", "vi"))
        stock_code = (context or {}).get("stock_code", "")
        market_role = get_market_role(stock_code, report_language)
        market_guidelines = get_market_guidelines(stock_code, report_language)
        system_prompt = CHAT_SYSTEM_PROMPT.format(
            market_role=market_role,
            market_guidelines=market_guidelines,
            default_skill_policy_section=default_skill_policy_section,
            skills_section=skills_section,
            language_section=_build_language_section(report_language, chat_mode=True),
        )

        # Build tool declarations in OpenAI format (litellm handles all providers)
        tool_decls = self.tool_registry.to_openai_tools()

        # Get conversation history
        session = conversation_manager.get_or_create(session_id)
        history = session.get_history()

        # Initialize conversation
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
        ]
        messages.extend(history)

        # Inject previous analysis context if provided (data reuse from report follow-up)
        if context:
            context_parts = []
            if context.get("stock_code"):
                context_parts.append(f"Mã cổ phiếu: {context['stock_code']}")
            if context.get("stock_name"):
                context_parts.append(f"Tên cổ phiếu: {context['stock_name']}")
            if context.get("previous_price"):
                context_parts.append(f"Giá phân tích lần trước: {context['previous_price']}")
            if context.get("previous_change_pct"):
                context_parts.append(f"Biến động lần trước: {context['previous_change_pct']}%")
            if context.get("previous_analysis_summary"):
                summary = context["previous_analysis_summary"]
                summary_text = json.dumps(summary, ensure_ascii=False) if isinstance(summary, dict) else str(summary)
                context_parts.append(f"Tóm tắt phân tích lần trước:\n{summary_text}")
            if context.get("previous_strategy"):
                strategy = context["previous_strategy"]
                strategy_text = json.dumps(strategy, ensure_ascii=False) if isinstance(strategy, dict) else str(strategy)
                context_parts.append(f"Phân tích chiến lược lần trước:\n{strategy_text}")
            if context_parts:
                context_msg = "[Ngữ cảnh phân tích lịch sử do hệ thống cung cấp, có thể tham khảo so sánh]\n" + "\n".join(context_parts)
                messages.append({"role": "user", "content": context_msg})
                messages.append({"role": "assistant", "content": "Được rồi, tôi đã nắm được dữ liệu phân tích lịch sử của cổ phiếu này. Bạn muốn biết điều gì?"})

        messages.append({"role": "user", "content": message})

        # Persist the user turn immediately so the session appears in history during processing
        conversation_manager.add_message(session_id, "user", message)

        result = self._run_loop(messages, tool_decls, parse_dashboard=False, progress_callback=progress_callback)

        # Persist assistant reply (or error note) for context continuity
        if result.success:
            conversation_manager.add_message(session_id, "assistant", result.content)
        else:
            error_note = f"[Phân tích thất bại] {result.error or 'Lỗi không xác định'}"
            conversation_manager.add_message(session_id, "assistant", error_note)

        return result

    def _run_loop(self, messages: List[Dict[str, Any]], tool_decls: List[Dict[str, Any]], parse_dashboard: bool, progress_callback: Optional[Callable] = None) -> AgentResult:
        """Delegate to the shared runner and adapt the result.

        This preserves the exact same observable behaviour as the original
        inline implementation while sharing the single authoritative loop
        in :mod:`src.agent.runner`.
        """
        loop_result = run_agent_loop(
            messages=messages,
            tool_registry=self.tool_registry,
            llm_adapter=self.llm_adapter,
            max_steps=self.max_steps,
            progress_callback=progress_callback,
            max_wall_clock_seconds=self.timeout_seconds,
        )

        model_str = loop_result.model

        if parse_dashboard and loop_result.success:
            dashboard = parse_dashboard_json(loop_result.content)
            return AgentResult(
                success=dashboard is not None,
                content=loop_result.content,
                dashboard=dashboard,
                tool_calls_log=loop_result.tool_calls_log,
                total_steps=loop_result.total_steps,
                total_tokens=loop_result.total_tokens,
                provider=loop_result.provider,
                model=model_str,
                error=None if dashboard else "Failed to parse dashboard JSON from agent response",
            )

        return AgentResult(
            success=loop_result.success,
            content=loop_result.content,
            dashboard=None,
            tool_calls_log=loop_result.tool_calls_log,
            total_steps=loop_result.total_steps,
            total_tokens=loop_result.total_tokens,
            provider=loop_result.provider,
            model=model_str,
            error=loop_result.error,
        )

    def _build_user_message(self, task: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Build the initial user message."""
        parts = [task]
        if context:
            report_language = normalize_report_language(context.get("report_language", "vi"))
            if context.get("stock_code"):
                parts.append(f"\nMã cổ phiếu: {context['stock_code']}")
            if context.get("report_type"):
                parts.append(f"Loại báo cáo: {context['report_type']}")
            if report_language == "en":
                parts.append("Ngôn ngữ đầu ra: English (giữ nguyên tên khóa JSON, tất cả giá trị văn bản hướng tới người dùng sử dụng tiếng Anh)")
            else:
                parts.append("Ngôn ngữ đầu ra: Tiếng Việt (giữ nguyên tên khóa JSON, tất cả giá trị văn bản hướng tới người dùng sử dụng tiếng Việt)")

            # Inject pre-fetched context data to avoid redundant fetches
            if context.get("realtime_quote"):
                parts.append(f"\n[Dữ liệu thị trường thời gian thực đã được hệ thống lấy]\n{json.dumps(context['realtime_quote'], ensure_ascii=False)}")
            if context.get("chip_distribution"):
                parts.append(f"\n[Phân bổ chip đã được hệ thống lấy]\n{json.dumps(context['chip_distribution'], ensure_ascii=False)}")
            if context.get("news_context"):
                parts.append(f"\n[Thông tin tin tức và thông tin thị trường đã được hệ thống lấy]\n{context['news_context']}")

        parts.append("\nVui lòng sử dụng các công cụ có sẵn để lấy dữ liệu còn thiếu (như nến K lịch sử, tin tức, v.v.), sau đó xuất kết quả phân tích theo định dạng JSON bảng quyết định.")
        return "\n".join(parts)
