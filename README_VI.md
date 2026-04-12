<div align="center">

# 📈 Hệ Thống Phân Tích Cổ Phiếu Thông Minh

[![GitHub stars](https://img.shields.io/github/stars/ZhuLinsen/daily_stock_analysis?style=social)](https://github.com/ZhuLinsen/daily_stock_analysis/stargazers)
[![CI](https://github.com/ZhuLinsen/daily_stock_analysis/actions/workflows/ci.yml/badge.svg)](https://github.com/ZhuLinsen/daily_stock_analysis/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Ready-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/)

<p>
  <a href="https://trendshift.io/repositories/18527" target="_blank"><img src="https://trendshift.io/api/badge/repositories/18527" alt="ZhuLinsen%2Fdaily_stock_analysis | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
  <a href="https://hellogithub.com/repository/ZhuLinsen/daily_stock_analysis" target="_blank"><img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=6daa16e405ce46ed97b4a57706aeb29f&claim_uid=pfiJMqhR9uvDGlT&theme=neutral" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

> 🤖 Hệ thống phân tích cổ phiếu thông minh dựa trên AI (A-share/HK/US/Việt Nam), tự động phân tích hàng ngày và đẩy «Bảng quyết định» đến WeChat Work/Lark/Telegram/Discord/Slack/Email

[**Tính năng**](#-tính-năng) · [**Bắt đầu nhanh**](#-bắt-đầu-nhanh) · [**Kết quả gửi thông báo**](#-kết-quả-gửi-thông-báo) · [**Hướng dẫn đầy đủ**](docs/full-guide.md) · [**FAQ**](docs/FAQ.md) · [**Nhật ký cập nhật**](docs/CHANGELOG.md)

[简体中文](README.md) | [English](docs/README_EN.md) | [繁體中文](docs/README_CHT.md) | **Tiếng Việt**

</div>

## 💖 Nhà tài trợ (Sponsors)
<div align="center">
  <a href="https://serpapi.com/baidu-search-api?utm_source=github_daily_stock_analysis" target="_blank">
    <img src="./sources/serpapi_banner_zh.png" alt="Dễ dàng thu thập dữ liệu tin tức tài chính thời gian thực từ công cụ tìm kiếm - SerpApi" height="160">
  </a>
</div>
<br>


## ✨ Tính năng

| Module | Tính năng | Mô tả |
|--------|-----------|-------|
| AI | Bảng quyết định | Kết luận cốt lõi một câu + Điểm mua/bán chính xác + Danh sách kiểm tra thao tác |
| Phân tích | Đa chiều | Kỹ thuật (MA thời gian thực trong phiên/sắp xếp tăng) + Phân bổ chip + Tin tức/Tâm lý + Giá thời gian thực |
| Thị trường | Toàn cầu | Hỗ trợ A-share, HK, US và chỉ số Mỹ (SPX, DJI, IXIC,...), cổ phiếu Việt Nam (VN: prefix) |
| Cơ bản | Tổng hợp có cấu trúc | Thêm `fundamental_context` (valuation/growth/earnings/institution/capital_flow/dragon_tiger/boards, trong đó `earnings.data` bổ sung `financial_report` và `dividend`, `boards` là bảng xếp hạng ngành), giảm cấp fail-open ở luồng chính |
| Chiến lược | Hệ thống chiến lược thị trường | Tích hợp sẵn chiến lược «Ba giai đoạn phục hồi A-share» và «Regime Strategy» Mỹ, xuất kế hoạch tấn công/cân bằng/phòng thủ hoặc risk-on/neutral/risk-off, kèm ghi chú "chỉ tham khảo, không phải tư vấn đầu tư" |
| Phục hồi | Tổng quan thị trường | Tổng quan hàng ngày, biến động ngành; hỗ trợ chuyển đổi cn(A-share)/us(Mỹ)/both |
| Tự động hoàn thành | Tự động hoàn thành thông minh (MVP) | **[Thử nghiệm]** Hộp tìm kiếm trang chủ hỗ trợ gợi ý mã/tên/pinyin/alias; chỉ mục đã bao phủ A-share, HK, US, hỗ trợ cập nhật qua Tushare hoặc AkShare |
| Nhập thông minh | Nhập đa nguồn | Hỗ trợ ảnh, CSV/Excel, dán clipboard; Vision LLM trích xuất mã+tên; xác nhận theo ngưỡng tin cậy; phân giải tên→mã (local+pinyin+AkShare) |
| Lịch sử | Quản lý hàng loạt | Hỗ trợ chọn nhiều, chọn tất cả, xóa hàng loạt lịch sử phân tích, tối ưu UI/UX |
| Backtest | Xác thực AI Backtest | Tự động đánh giá độ chính xác phân tích lịch sử, tỷ lệ thắng hướng, tỷ lệ đạt stop-loss/take-profit |
| **Agent Hỏi AI** | **Hỏi chiến lược** | **Hỏi đáp chiến lược đa lượt, hỗ trợ 11 chiến lược tích hợp sẵn như MA golden cross/Chân luận/Sóng Elliott, toàn chuỗi Web/Bot/API** |
| Thông báo | Đa kênh | WeChat Work, Lark, Telegram, Discord, Slack, DingTalk, Email, Pushover |
| Tự động hóa | Chạy theo lịch | GitHub Actions chạy theo lịch, không cần máy chủ |

> Chi tiết lịch sử báo cáo sẽ ưu tiên hiển thị văn bản «Điểm bắn» gốc từ AI, tránh bị nén thành số đơn lẻ khi xem lại khi có nội dung phức tạp như giá theo khoảng, điều kiện kèm theo.

> Xác thực quản trị Web hỗ trợ bật/tắt trong thời gian chạy; nếu hệ thống đã lưu mật khẩu quản trị, khi bật lại xác thực phải cung cấp mật khẩu hiện tại, tránh lấy phiên quản trị mới trong cửa sổ tắt xác thực.
> Khi triển khai đa tiến trình/đa worker, thay đổi trạng thái xác thực chỉ có hiệu lực ngay tức thì trong tiến trình hiện tại; cần khởi động lại hoặc rolling restart toàn bộ worker để đồng bộ trạng thái.

> Ghi chú quản lý danh mục: Ghi nhập bán bây giờ sẽ xác thực vị thế khả dụng trước khi ghi; bán vượt sẽ bị từ chối trực tiếp; nếu ghi nhầm giao dịch/dòng tiền/sự kiện công ty trong lịch sử, có thể xóa trực tiếp trong danh sách sự kiện trang `/portfolio` trên Web rồi khôi phục snapshot. Trong trường hợp ghi đồng thời cao, interface ghi vị thế trực tiếp có thể trả về `409 portfolio_busy`, thông báo sổ kế toán đang xử lý thay đổi khác; import CSV vẫn duy trì ngữ nghĩa ghi từng bước và thành công một phần.

### Công nghệ sử dụng & Nguồn dữ liệu

| Loại | Hỗ trợ |
|------|---------|
| Mô hình AI | [AIHubMix](https://aihubmix.com/?aff=CfMq), Gemini, OpenAI compatible, DeepSeek, Qwen, Claude, Ollama local model... (thống nhất qua [LiteLLM](https://github.com/BerriAI/litellm), hỗ trợ cân bằng tải multi-key) |
| Dữ liệu giá | AkShare, Tushare, Pytdx, Baostock, YFinance, vnstock (Việt Nam) |
| Tìm kiếm tin tức | Tavily, SerpAPI, Bocha, Brave, MiniMax |
| Tâm lý xã hội | [Stock Sentiment API](https://api.adanos.org/docs) (Reddit/X/Polymarket, chỉ US, tùy chọn) |

> Lưu ý: Dữ liệu lịch sử và giá thời gian thực US thống nhất dùng YFinance, đảm bảo nhất quán điều chỉnh.

### Kỷ luật giao dịch tích hợp

| Quy tắc | Mô tả |
|---------|-------|
| Cấm đuổi giá cao | Tự động cảnh báo khi lệch giá vượt ngưỡng (mặc định 5%, có thể cấu hình); cổ phiếu xu hướng mạnh tự động nới lỏng |
| Giao dịch theo xu hướng | MA5 > MA10 > MA20 sắp xếp tăng |
| Điểm chính xác | Giá mua vào, giá cắt lỗ, giá mục tiêu |
| Danh sách kiểm tra | Mỗi điều kiện được đánh dấu «Đạt / Chú ý / Không đạt» |
| Thời hạn tin tức | Có thể cấu hình thời hạn tin tức tối đa (mặc định 3 ngày), tránh dùng thông tin lỗi thời |

## 🚀 Bắt đầu nhanh

### Cách 1: GitHub Actions (Khuyến nghị)

> Triển khai trong 5 phút, chi phí bằng 0, không cần máy chủ.

#### 1. Fork kho lưu trữ này

Nhấn nút `Fork` ở góc trên phải (tiện thể nhấn Star⭐ ủng hộ nhé)

#### 2. Cấu hình Secrets

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

**Cấu hình mô hình AI (cấu hình ít nhất một cái)**

> Hướng dẫn cấu hình chi tiết xem tại [Hướng dẫn cấu hình LLM](docs/LLM_CONFIG_GUIDE.md) (ba lớp cấu hình, chế độ kênh, cấu hình YAML nâng cao, Vision, Agent, xử lý lỗi). Người dùng GitHub Actions cũng có thể dùng cấu hình YAML nâng cao. Người dùng nâng cao có thể cấu hình `LITELLM_MODEL`, `LITELLM_FALLBACK_MODELS` hoặc `LLM_CHANNELS` chế độ đa kênh.

> Khuyến nghị thống nhất viết cấu hình đa mô hình thành `LLM_CHANNELS + LLM_<NAME>_PROTOCOL/BASE_URL/API_KEY/MODELS/ENABLED`. Trang cài đặt Web và `.env` dùng chung bộ trường, dễ dàng chuyển đổi qua lại.

> 💡 **Khuyến nghị [AIHubMix](https://aihubmix.com/?aff=CfMq)**: Một Key dùng được Gemini, GPT, Claude, DeepSeek và các mô hình hàng đầu toàn cầu, không cần VPN, có mô hình miễn phí (glm-5, gpt-4o-free...), mô hình trả phí ổn định cao không giới hạn đồng thời. Dự án này được **ưu đãi 10% nạp tiền**.

| Tên Secret | Mô tả | Bắt buộc |
|-----------|-------|:--------:|
| `AIHUBMIX_KEY` | [AIHubMix](https://aihubmix.com/?aff=CfMq) API Key, một Key dùng toàn bộ mô hình, có mô hình miễn phí | Tùy chọn |
| `GEMINI_API_KEY` | Lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/) (cần VPN) | Tùy chọn |
| `ANTHROPIC_API_KEY` | [Anthropic Claude](https://console.anthropic.com/) API Key | Tùy chọn |
| `ANTHROPIC_MODEL` | Mô hình Claude (ví dụ: `claude-3-5-sonnet-20241022`) | Tùy chọn |
| `OPENAI_API_KEY` | OpenAI compatible API Key (hỗ trợ DeepSeek, Qwen...) | Tùy chọn |
| `OPENAI_BASE_URL` | Địa chỉ OpenAI compatible API (ví dụ: `https://api.deepseek.com/v1`) | Tùy chọn |
| `OPENAI_MODEL` | Tên mô hình (ví dụ: `gemini-3.1-pro-preview`, `deepseek-chat`) | Tùy chọn |
| `OPENAI_VISION_MODEL` | Mô hình nhận diện ảnh chuyên dụng (một số mô hình bên thứ ba không hỗ trợ ảnh; để trống thì dùng `OPENAI_MODEL`) | Tùy chọn |
| `OLLAMA_API_BASE` | Địa chỉ dịch vụ Ollama local (ví dụ: `http://localhost:11434`), dùng khi deploy local/Docker, **không** dùng `OPENAI_BASE_URL` để cấu hình Ollama, xem [Hướng dẫn LLM - Ollama](docs/LLM_CONFIG_GUIDE.md) | Tùy chọn |

> Lưu ý: Ưu tiên AI: Gemini > Anthropic > OpenAI (bao gồm AIHubmix) > Ollama, cấu hình ít nhất một. `AIHUBMIX_KEY` không cần cấu hình `OPENAI_BASE_URL`, hệ thống tự động thích ứng. Nhận diện ảnh cần mô hình có khả năng Vision. Chế độ suy luận DeepSeek (deepseek-reasoner, deepseek-r1, qwq, deepseek-chat) tự động nhận diện theo tên mô hình, không cần cấu hình thêm. **Mô hình local Ollama** (không cần API Key) bắt buộc dùng `OLLAMA_API_BASE`, dùng nhầm `OPENAI_BASE_URL` sẽ gây lỗi 404.

<details>
<summary><b>Cấu hình kênh thông báo</b> (nhấp để mở rộng, cấu hình ít nhất một kênh)</summary>

| Tên Secret | Mô tả | Bắt buộc |
|-----------|-------|:--------:|
| `WECHAT_WEBHOOK_URL` | WeChat Work Webhook URL | Tùy chọn |
| `FEISHU_WEBHOOK_URL` | Lark Webhook URL | Tùy chọn |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token (lấy từ @BotFather) | Tùy chọn |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | Tùy chọn |
| `TELEGRAM_MESSAGE_THREAD_ID` | Telegram Topic ID (gửi vào chủ đề con) | Tùy chọn |
| `DISCORD_WEBHOOK_URL` | Discord Webhook URL | Tùy chọn |
| `DISCORD_BOT_TOKEN` | Discord Bot Token (chọn một trong Webhook) | Tùy chọn |
| `DISCORD_MAIN_CHANNEL_ID` | Discord Channel ID (cần khi dùng Bot) | Tùy chọn |
| `SLACK_BOT_TOKEN` | Slack Bot Token (khuyến nghị, hỗ trợ upload ảnh; ưu tiên hơn Webhook khi cấu hình cả hai) | Tùy chọn |
| `SLACK_CHANNEL_ID` | Slack Channel ID (cần khi dùng Bot) | Tùy chọn |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL (chỉ văn bản, không hỗ trợ ảnh) | Tùy chọn |
| `EMAIL_SENDER` | Email người gửi (ví dụ: `xxx@qq.com`) | Tùy chọn |
| `EMAIL_PASSWORD` | Mã xác thực email (không phải mật khẩu đăng nhập) | Tùy chọn |
| `EMAIL_RECEIVERS` | Email người nhận (nhiều địa chỉ phân cách bằng dấu phẩy, để trống thì gửi cho chính mình) | Tùy chọn |
| `EMAIL_SENDER_NAME` | Tên hiển thị người gửi email (mặc định: daily_stock_analysis股票分析助手, hỗ trợ tự động encode header) | Tùy chọn |
| `STOCK_GROUP_N` / `EMAIL_GROUP_N` | Phân nhóm cổ phiếu gửi đến email khác nhau (ví dụ: `STOCK_GROUP_1=600519,300750` `EMAIL_GROUP_1=user1@example.com`) | Tùy chọn |
| `PUSHPLUS_TOKEN` | PushPlus Token ([lấy tại đây](https://www.pushplus.plus), dịch vụ push nội địa Trung Quốc) | Tùy chọn |
| `PUSHPLUS_TOPIC` | PushPlus mã nhóm (push một-nhiều, sau khi cấu hình tin nhắn được push đến tất cả người dùng đăng ký nhóm) | Tùy chọn |
| `SERVERCHAN3_SENDKEY` | Server酱³ Sendkey ([lấy tại đây](https://sc3.ft07.com/), dịch vụ push qua ứng dụng điện thoại) | Tùy chọn |
| `CUSTOM_WEBHOOK_URLS` | Webhook tùy chỉnh (hỗ trợ DingTalk..., nhiều địa chỉ phân cách bằng dấu phẩy) | Tùy chọn |
| `CUSTOM_WEBHOOK_BEARER_TOKEN` | Bearer Token cho Webhook tùy chỉnh (dùng cho Webhook cần xác thực) | Tùy chọn |
| `WEBHOOK_VERIFY_SSL` | Xác thực chứng chỉ HTTPS Webhook (mặc định true). Đặt false để hỗ trợ chứng chỉ tự ký. Cảnh báo: Tắt có rủi ro bảo mật nghiêm trọng, chỉ dùng trong mạng nội bộ tin cậy | Tùy chọn |
| `SCHEDULE_RUN_IMMEDIATELY` | Chế độ lịch: có thực thi phân tích ngay khi khởi động không | Tùy chọn |
| `RUN_IMMEDIATELY` | Chế độ không lịch: có thực thi phân tích ngay khi khởi động không | Tùy chọn |
| `SINGLE_STOCK_NOTIFY` | Chế độ push từng cổ phiếu: đặt `true` thì push ngay sau khi phân tích xong mỗi cổ phiếu | Tùy chọn |
| `REPORT_TYPE` | Loại báo cáo: `simple`(tóm tắt), `full`(đầy đủ), `brief`(3-5 câu), môi trường Docker khuyến nghị đặt `full` | Tùy chọn |
| `REPORT_LANGUAGE` | Ngôn ngữ báo cáo: `zh`(mặc định tiếng Trung) / `en`(tiếng Anh) / `vi`(tiếng Việt); ảnh hưởng đến Prompt, template Markdown, fallback thông báo và văn bản cố định trang Web | Tùy chọn |
| `REPORT_SUMMARY_ONLY` | Chỉ tóm tắt kết quả phân tích: đặt `true` thì chỉ push tổng hợp, không có chi tiết từng cổ phiếu | Tùy chọn |
| `REPORT_TEMPLATES_DIR` | Thư mục template Jinja2 (relative từ gốc dự án, mặc định `templates`) | Tùy chọn |
| `REPORT_RENDERER_ENABLED` | Bật render template Jinja2 (mặc định `false`, đảm bảo không hồi quy) | Tùy chọn |
| `REPORT_INTEGRITY_ENABLED` | Bật kiểm tra tính toàn vẹn báo cáo, thử lại hoặc điền placeholder khi thiếu trường bắt buộc (mặc định `true`) | Tùy chọn |
| `REPORT_INTEGRITY_RETRY` | Số lần thử lại kiểm tra tính toàn vẹn (mặc định `1`, `0` chỉ điền placeholder không thử lại) | Tùy chọn |
| `REPORT_HISTORY_COMPARE_N` | Số tín hiệu lịch sử để so sánh, `0` tắt (mặc định), `>0` bật | Tùy chọn |
| `ANALYSIS_DELAY` | Độ trễ giữa phân tích từng cổ phiếu và phân tích thị trường (giây), tránh giới hạn API, ví dụ `10` | Tùy chọn |
| `MAX_WORKERS` | Số luồng đồng thời của hàng đợi tác vụ phân tích bất đồng bộ (mặc định `3`); tự động áp dụng khi hàng đợi rảnh sau khi lưu, trì hoãn khi bận | Tùy chọn |
| `MERGE_EMAIL_NOTIFICATION` | Gộp push từng cổ phiếu và tổng quan thị trường (mặc định false), giảm số lượng email | Tùy chọn |
| `MARKDOWN_TO_IMAGE_CHANNELS` | Các kênh chuyển Markdown thành ảnh (phân cách bằng dấu phẩy): `telegram,wechat,custom,email,slack` | Tùy chọn |
| `MARKDOWN_TO_IMAGE_MAX_CHARS` | Không chuyển ảnh khi vượt quá độ dài này, tránh ảnh quá lớn (mặc định `15000`) | Tùy chọn |
| `MD2IMG_ENGINE` | Engine chuyển ảnh: `wkhtmltoimage`(mặc định) hoặc `markdown-to-file`(emoji tốt hơn) | Tùy chọn |

> Cấu hình ít nhất một kênh, cấu hình nhiều kênh thì push đồng thời. Chi tiết gửi ảnh và cài đặt engine xem [Hướng dẫn đầy đủ](docs/full-guide.md)

</details>

**Cấu hình khác**

| Tên Secret | Mô tả | Bắt buộc |
|-----------|-------|:--------:|
| `STOCK_LIST` | Mã cổ phiếu quan tâm, ví dụ: `600519,hk00700,AAPL,TSLA,VN:VIC,VN:HPG` | ✅ |
| `TAVILY_API_KEYS` | [Tavily](https://tavily.com/) Search API (tìm kiếm tin tức) | Khuyến nghị |
| `MINIMAX_API_KEYS` | [MiniMax](https://platform.minimaxi.com/) Coding Plan Web Search (kết quả tìm kiếm có cấu trúc) | Tùy chọn |
| `SERPAPI_API_KEYS` | [SerpAPI](https://serpapi.com/baidu-search-api?utm_source=github_daily_stock_analysis) tìm kiếm đa kênh | Tùy chọn |
| `BOCHA_API_KEYS` | [Bocha Search](https://open.bocha.cn/) Web Search API (tối ưu tìm kiếm tiếng Trung, hỗ trợ tóm tắt AI, nhiều key phân cách bằng dấu phẩy) | Tùy chọn |
| `BRAVE_API_KEYS` | [Brave Search](https://brave.com/search/api/) API (ưu tiên bảo mật, tối ưu US, nhiều key phân cách bằng dấu phẩy) | Tùy chọn |
| `SEARXNG_BASE_URLS` | Instance SearXNG tự dựng (không giới hạn quota, cần bật format: json trong settings.yml); để trống thì tự động tìm instance công cộng | Tùy chọn |
| `SEARXNG_PUBLIC_INSTANCES_ENABLED` | Có tự động lấy instance công cộng từ `searx.space` khi `SEARXNG_BASE_URLS` trống không (mặc định `true`) | Tùy chọn |
| `SOCIAL_SENTIMENT_API_KEY` | [Stock Sentiment API](https://api.adanos.org/docs) (tâm lý xã hội Reddit/X/Polymarket, chỉ US) | Tùy chọn |
| `SOCIAL_SENTIMENT_API_URL` | Địa chỉ API tâm lý xã hội tùy chỉnh (mặc định `https://api.adanos.org`) | Tùy chọn |
| `TUSHARE_TOKEN` | [Tushare Pro](https://tushare.pro/weborder/#/login?reg=834638) Token | Tùy chọn |
| `TICKFLOW_API_KEY` | [TickFlow](https://tickflow.org) API Key (tăng cường chỉ số tổng quan thị trường A-share; nếu gói hỗ trợ truy vấn danh sách, cũng có thể tăng cường thống kê thị trường) | Tùy chọn |
| `PREFETCH_REALTIME_QUOTES` | Công tắc tải trước giá thời gian thực: đặt `false` để tắt tải trước toàn thị trường (mặc định `true`) | Tùy chọn |
| `WECHAT_MSG_TYPE` | Loại tin nhắn WeChat Work, mặc định markdown, hỗ trợ cấu hình kiểu text | Tùy chọn |
| `NEWS_STRATEGY_PROFILE` | Cấu hình cửa sổ chiến lược tin tức: `ultra_short`(1 ngày) / `short`(3 ngày) / `medium`(7 ngày) / `long`(30 ngày), mặc định `short` | Tùy chọn |
| `NEWS_MAX_AGE_DAYS` | Giới hạn thời hạn tin tức tối đa (ngày), mặc định 3; cửa sổ thực tế `effective_days = min(profile_days, NEWS_MAX_AGE_DAYS)` | Tùy chọn |
| `BIAS_THRESHOLD` | Ngưỡng lệch giá (%), mặc định 5.0, vượt quá thì cảnh báo không đuổi giá cao; cổ phiếu xu hướng mạnh tự động nới lỏng | Tùy chọn |
| `AGENT_MODE` | Bật chế độ Agent hỏi chiến lược (`true`/`false`, mặc định false) | Tùy chọn |
| `AGENT_LITELLM_MODEL` | Mô hình chính Agent (tùy chọn); để trống thì kế thừa `LITELLM_MODEL` | Tùy chọn |
| `AGENT_SKILLS` | ID chiến lược kỹ năng được kích hoạt (phân cách bằng dấu phẩy), `all` bật tất cả; để trống thì dùng chiến lược mặc định (`bull_trend`) | Tùy chọn |
| `AGENT_MAX_STEPS` | Số bước suy luận tối đa của Agent (mặc định 10) | Tùy chọn |
| `AGENT_SKILL_DIR` | Thư mục chiến lược kỹ năng tùy chỉnh (mặc định dùng `strategies/` tích hợp) | Tùy chọn |
| `TRADING_DAY_CHECK_ENABLED` | Kiểm tra ngày giao dịch (mặc định `true`): bỏ qua ngoài ngày giao dịch; đặt `false` hoặc dùng `--force-run` để bắt buộc thực thi | Tùy chọn |
| `ENABLE_CHIP_DISTRIBUTION` | Bật phân bổ chip (Actions mặc định false; khi cần dữ liệu chip thì đặt true trong Variables, interface có thể không ổn định) | Tùy chọn |
| `ENABLE_FUNDAMENTAL_PIPELINE` | Công tắc tổng thể pipeline cơ bản; tắt thì luồng chính không thay đổi | Tùy chọn |
| `FUNDAMENTAL_STAGE_TIMEOUT_SECONDS` | Tổng ngân sách thời gian giai đoạn cơ bản (giây) | Tùy chọn |
| `FUNDAMENTAL_FETCH_TIMEOUT_SECONDS` | Timeout gọi từng nguồn năng lực (giây) | Tùy chọn |
| `FUNDAMENTAL_RETRY_MAX` | Số lần thử lại năng lực cơ bản (bao gồm lần đầu) | Tùy chọn |
| `FUNDAMENTAL_CACHE_TTL_SECONDS` | TTL cache cơ bản (giây) | Tùy chọn |
| `FUNDAMENTAL_CACHE_MAX_ENTRIES` | Số entry tối đa cache cơ bản (tránh bộ nhớ tăng khi chạy lâu) | Tùy chọn |

> Ngữ nghĩa timeout cơ bản:
> - Hiện tại áp dụng soft timeout `best-effort` (fail-open), timeout sẽ giảm cấp ngay và tiếp tục luồng chính;
> - Không đảm bảo cứng ngắt luồng gọi bên thứ ba, vì vậy `P95 <= 1.5s` là mục tiêu giai đoạn chứ không phải SLA cứng;
> - Nếu nghiệp vụ cần SLA cứng, có thể nâng cấp lên phương án hard timeout "cô lập subprocess + kill" ở giai đoạn sau.
> - Hợp đồng trường:
>   - `fundamental_context.boards.data` = `sector_rankings` (bảng xếp hạng ngành, cấu trúc `{top, bottom}`);
>   - `fundamental_context.earnings.data.financial_report` = tóm tắt báo cáo tài chính;
>   - `fundamental_context.earnings.data.dividend` = chỉ số cổ tức;
>   - `get_stock_info.belong_boards` = danh sách ngành của cổ phiếu;
>   - `get_stock_info.boards` là alias tương thích, giá trị giống `belong_boards`.

#### 3. Bật Actions

Tab `Actions` → `I understand my workflows, go ahead and enable them`

#### 4. Kiểm tra thủ công

`Actions` → `每日股票分析` → `Run workflow` → `Run workflow`

#### Hoàn thành

Mặc định tự động thực thi vào **18:00 (giờ Bắc Kinh) mỗi ngày làm việc**, cũng có thể kích hoạt thủ công. Mặc định không thực thi vào ngày không phải ngày giao dịch (bao gồm ngày nghỉ A/H/US).

> 💡 **Về hai cơ chế bỏ qua kiểm tra ngày giao dịch:**
> | Cơ chế | Cách cấu hình | Phạm vi hiệu lực | Trường hợp sử dụng |
> |--------|--------------|-----------------|-------------------|
> | `TRADING_DAY_CHECK_ENABLED=false` | Biến môi trường/Secrets | Toàn cục, hiệu lực lâu dài | Môi trường test, tắt kiểm tra lâu dài |
> | `force_run` (tích trên UI) | Chọn khi kích hoạt thủ công Actions | Chạy một lần | Tạm thời thực thi một lần ngoài ngày giao dịch |

### Cách 2: Chạy local / Triển khai Docker

```bash
# Clone dự án
git clone https://github.com/ZhuLinsen/daily_stock_analysis.git && cd daily_stock_analysis

# Cài đặt dependencies
pip install -r requirements.txt

# Cấu hình biến môi trường
cp .env.example .env && vim .env

# Chạy phân tích
python main.py
```

Nếu không dùng Web, khuyến nghị viết trực tiếp trong `.env`:

```env
LLM_CHANNELS=primary
LLM_PRIMARY_PROTOCOL=openai
LLM_PRIMARY_BASE_URL=https://api.deepseek.com/v1
LLM_PRIMARY_API_KEY=sk-xxxxxxxx
LLM_PRIMARY_MODELS=deepseek-chat
LITELLM_MODEL=openai/deepseek-chat
```

Sau khi lưu cũng có thể tiếp tục chỉnh sửa cùng bộ trường trong trang cài đặt Web; không yêu cầu file cấu hình thêm.

Nếu đồng thời bật `LITELLM_CONFIG`, YAML vẫn là nguồn duy nhất cho mô hình chính/fallback/Vision trong thời gian chạy; trình chỉnh sửa kênh chỉ lưu các mục kênh, không ghi đè lựa chọn thời gian chạy của YAML.

> Triển khai Docker, cấu hình tác vụ theo lịch xem tại [Hướng dẫn đầy đủ](docs/full-guide.md)
> Đóng gói desktop client xem tại [Hướng dẫn đóng gói desktop](docs/desktop-package.md)

## 📱 Kết quả gửi thông báo

### Bảng quyết định
```
🎯 2026-02-08 Bảng quyết định
Đã phân tích 3 cổ phiếu | 🟢Mua:0 🟡Quan sát:2 🔴Bán:1

📊 Tóm tắt kết quả phân tích
⚪ Zhongtung Hi-Tech(000657): Quan sát | Điểm 65 | Tăng
⚪ Yongding(600105): Quan sát | Điểm 48 | Dao động
🟡 Xinlai(300260): Bán | Điểm 35 | Giảm

⚪ Zhongtung Hi-Tech (000657)
📰 Thông tin quan trọng nhanh
💭 Tâm lý thị trường: Thị trường chú ý đến thuộc tính AI và tăng trưởng lợi nhuận cao, tâm lý tích cực, nhưng cần tiêu hóa áp lực chốt lời ngắn hạn và dòng tiền chủ lực rút ra.
📊 Kỳ vọng lợi nhuận: Dựa trên thông tin tâm lý, lợi nhuận 3 quý đầu 2025 tăng mạnh so cùng kỳ, cơ bản vững chắc hỗ trợ giá cổ phiếu.

🚨 Cảnh báo rủi ro:
Điểm rủi ro 1: Ngày 5/2 dòng tiền chủ lực ròng bán ra 363 triệu, cần thận trọng áp lực bán ngắn hạn.
Điểm rủi ro 2: Độ tập trung chip 35.15%, cho thấy chip phân tán, sức cản kéo giá có thể lớn.
Điểm rủi ro 3: Tâm lý đề cập hồ sơ vi phạm lịch sử và cảnh báo rủi ro tái cơ cấu, cần theo dõi.
✨ Xúc tác tích cực:
Lợi thế 1: Công ty được thị trường định vị là nhà cung cấp cốt lõi HDI AI server, hưởng lợi từ sự phát triển của ngành AI.
Lợi thế 2: Lợi nhuận ròng loại trừ bất thường 9 tháng đầu 2025 tăng vọt 407.52% so cùng kỳ, kết quả kinh doanh xuất sắc.
📢 Tin tức mới nhất: [MỚI NHẤT] Tâm lý cho thấy công ty là đầu ngành micro-drill PCB AI, gắn kết sâu với các nhà sản xuất PCB/substrate hàng đầu toàn cầu. Ngày 5/2 dòng tiền chủ lực ròng bán 363 triệu, cần theo dõi dòng tiền tiếp theo.

---
Thời gian tạo: 18:00
```

### Tổng quan thị trường
```
🎯 2026-01-10 Tổng quan thị trường

📊 Chỉ số chính
- Shanghai Composite: 3250.12 (🟢+0.85%)
- Shenzhen Component: 10521.36 (🟢+1.02%)
- ChiNext Index: 2156.78 (🟢+1.35%)

📈 Tổng quan thị trường
Tăng: 3920 | Giảm: 1349 | Tăng trần: 155 | Giảm sàn: 3

🔥 Hiệu suất ngành
Dẫn đầu tăng: Dịch vụ Internet, Truyền thông văn hóa, Kim loại nhỏ
Dẫn đầu giảm: Bảo hiểm, Hàng không sân bay, Thiết bị quang điện
```

## ⚙️ Hướng dẫn cấu hình

> 📖 Biến môi trường đầy đủ, cấu hình tác vụ theo lịch xem tại [Hướng dẫn cấu hình đầy đủ](docs/full-guide.md)
> Thông báo email hiện dựa trên mã xác thực SMTP/xác thực cơ bản; nếu tài khoản Outlook/Exchange hoặc tenant bắt buộc OAuth2, phiên bản hiện tại chưa hỗ trợ.


## 🖥️ Giao diện Web

![img.png](sources/fastapi_server.png)

Bao gồm quản lý cấu hình đầy đủ, giám sát tác vụ và chức năng phân tích thủ công.

**Bảo vệ mật khẩu tùy chọn**: Đặt `ADMIN_AUTH_ENABLED=true` trong `.env` để bật đăng nhập Web, lần đầu truy cập thiết lập mật khẩu ban đầu trên trang web, bảo vệ API key và cấu hình nhạy cảm trong Settings. Cài đặt hệ thống hỗ trợ bật/tắt xác thực trong thời gian chạy; tắt xác thực không xóa mật khẩu đã lưu, sau đó có thể bật lại trực tiếp. Khi bật xác thực, `POST /api/v1/auth/logout` cũng cần phiên hợp lệ; nếu phiên đã hết hạn, frontend sẽ chuyển thẳng về trang đăng nhập. Xem [Hướng dẫn đầy đủ](docs/full-guide.md).

### Nhập thông minh

Trong **Cài đặt → Cài đặt cơ bản** tìm phần «Nhập thông minh», hỗ trợ ba cách thêm cổ phiếu quan tâm:

1. **Ảnh**: Kéo thả hoặc chọn ảnh chụp màn hình danh sách quan tâm (ví dụ: trang danh mục APP, danh sách giá), Vision AI tự động nhận diện mã+tên và đưa ra độ tin cậy
2. **File**: Upload CSV hoặc Excel (.xlsx), tự động phân tích cột mã/tên
3. **Dán**: Sao chép từ Excel hoặc bảng rồi dán, nhấn «Phân tích» là xong

**Xem trước & Gộp**: Độ tin cậy cao mặc định được tích, độ tin cậy trung/thấp cần tích thủ công; hỗ trợ loại trùng theo mã, xóa hết, chọn tất cả; chỉ gộp các mục đã tích và phân tích thành công.

**Cấu hình & Giới hạn**:
- Ảnh cần cấu hình Vision API (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY` hoặc `OPENAI_API_KEY` ít nhất một)
- Ảnh: JPG/PNG/WebP/GIF, ≤5MB; File: ≤2MB; Dán văn bản: ≤100KB

**API**: `POST /api/v1/stocks/extract-from-image` (ảnh), `POST /api/v1/stocks/parse-import` (file/dán). Xem [Hướng dẫn đầy đủ](docs/full-guide.md).

### Tự động hoàn thành tìm kiếm thông minh (MVP)

Hộp nhập phân tích trang chủ đã được nâng cấp thành hộp hoàn thành «kiểu công cụ tìm kiếm», giảm đáng kể việc phải ghi nhớ:

- **Khớp đa chiều**: Hỗ trợ nhập mã cổ phiếu, tên, viết tắt pinyin hoặc alias (ví dụ: `gzmt` -> Guizhou Moutai, `tencent` -> Tencent Holdings, `aapl` -> Apple Inc.).
- **Đa thị trường**: Chỉ mục local đã bao phủ **A-share, HK, US** ba thị trường; tạo qua nguồn dữ liệu Tushare hoặc AkShare, hỗ trợ cập nhật chỉ mục theo yêu cầu.
- **Logic giảm cấp tự động**:
  - **Cổ phiếu mới/bất thường**: Nếu chỉ mục chưa cập nhật kịp hoặc tải thất bại, hệ thống sẽ liền mạch quay về chế độ nhập thông thường, đảm bảo chuỗi phân tích 100% khả dụng.
  - **Không khớp**: Khi tìm kiếm không khớp, người dùng nhấn Enter trực tiếp để theo luồng nhập thủ công hiện có, hoàn toàn không ảnh hưởng phân tích.

> 💡 **Gợi ý cập nhật chỉ mục**: Nếu cần cập nhật dữ liệu chỉ mục, có thể dùng `scripts/fetch_tushare_stock_list.py` để lấy danh sách cổ phiếu mới nhất, rồi chạy `scripts/generate_index_from_csv.py` để tạo lại file chỉ mục.

**Tra cứu lượng sử dụng LLM**: `GET /api/v1/usage/summary?period=today|month|all`, trả về tóm tắt tiêu thụ token theo loại gọi và mô hình.

**Ghi chú API phân tích**: `POST /api/v1/analysis/analyze` khi `async_mode=false` chỉ hỗ trợ một cổ phiếu; `stock_codes` hàng loạt cần `async_mode=true`. Phản hồi bất đồng bộ `202` trả về `task_id` cho một cổ phiếu, trả về cấu trúc `accepted` / `duplicates` cho hàng loạt.

### Chi tiết báo cáo lịch sử

Trong lịch sử trang chủ chọn một bản ghi phân tích, nhấn nút «Báo cáo phân tích đầy đủ» để xem báo cáo Markdown đầy đủ trong ngăn kéo bên phải, bao gồm tin tức/tâm lý, kết luận cốt lõi, dữ liệu và kế hoạch chiến đấu.

Đầu báo cáo cung cấp hai cách sao chép:
- «Sao chép mã nguồn Markdown»: Giữ nguyên cấu trúc Markdown gốc, thích hợp chỉnh sửa, chia sẻ cộng đồng kỹ thuật và lưu trữ ghi chú.
- «Sao chép văn bản thuần»: Bỏ các ký tự định dạng Markdown thông thường, thích hợp chia sẻ trong WeChat, nhóm chat và các nơi chỉ nhận văn bản thuần.

### 🤖 Agent Hỏi AI Chiến lược

Đặt `AGENT_MODE=true` trong `.env` rồi khởi động dịch vụ, truy cập trang `/chat` để bắt đầu hỏi đáp chiến lược đa lượt.

> Với văn bản hướng đến người dùng, dự án này vẫn chủ yếu gọi là "chiến lược"; mã, cấu hình và trường API chính thống nhất dùng `skill`, có thể hiểu là "gói năng lực chiến lược có thể tái sử dụng".

- **Chọn chiến lược**: MA golden cross, Chân luận, Sóng Elliott, Xu hướng tăng và 11 chiến lược tích hợp khác
- **Đặt câu hỏi tự nhiên**: Ví dụ «Phân tích 600519 theo Chân luận», Agent tự động gọi giá thời gian thực, K-line, chỉ báo kỹ thuật, tin tức và các công cụ khác
- **Phản hồi tiến trình streaming**: Hiển thị real-time lộ trình suy nghĩ AI (lấy giá → phân tích kỹ thuật → tìm kiếm tin tức → tạo kết luận)
- **Hội thoại đa lượt**: Hỗ trợ hỏi thêm theo ngữ cảnh, lịch sử phiên được lưu trữ vĩnh viễn
- **Xuất & Gửi**: Có thể xuất phiên thành file .md, hoặc gửi đến các kênh thông báo đã cấu hình
- **Thực thi nền**: Chuyển trang không ngắt phân tích, hoàn thành thì icon Dock hiển thị badge
- **Lệnh Bot**: `/ask` phân tích kỹ năng (hỗ trợ so sánh nhiều cổ phiếu), `/chat` hội thoại tự do
- **Chiến lược tùy chỉnh (Skill)**: Tạo file YAML mới trong thư mục `strategies/` hoặc đặt bundle `SKILL.md` vào thư mục skill tùy chỉnh để thêm chiến lược giao dịch mới, không cần viết code
- **Kiến trúc đa Agent** (thử nghiệm): Đặt `AGENT_ARCH=multi` để bật điều phối đa Agent Technical → Intel → Risk → Specialist → Decision, kiểm soát độ sâu qua `AGENT_ORCHESTRATOR_MODE` (quick/standard/full/specialist). Khi timeout hoặc parse JSON thất bại ở giai đoạn giữa, hệ thống ưu tiên giữ kết quả giai đoạn đã hoàn thành và giảm cấp tạo bảng quyết định tối thiểu khả dụng. Xem [Hướng dẫn cấu hình đầy đủ](docs/full-guide.md)

> **Lưu ý**: Sau khi cấu hình bất kỳ AI API Key nào, chức năng hội thoại Agent tự động khả dụng, không cần đặt `AGENT_MODE=true` thủ công. Để tắt rõ ràng thì đặt `AGENT_MODE=false`. Mỗi lần hội thoại sẽ phát sinh chi phí gọi LLM API.

### Cách khởi động

1. **Khởi động dịch vụ** (mặc định tự động build frontend)
   ```bash
   python main.py --webui       # Khởi động giao diện Web + thực thi phân tích theo lịch
   python main.py --webui-only  # Chỉ khởi động giao diện Web
   ```
   Khi khởi động sẽ tự động thực thi `npm install && npm run build` trong `apps/dsa-web`.
   Để tắt tự động build, đặt `WEBUI_AUTO_BUILD=false`, và thực thi thủ công:
   ```bash
   cd ./apps/dsa-web
   npm install && npm run build
   cd ../..
   ```

Truy cập `http://127.0.0.1:8000` để sử dụng.

> Sau khi triển khai trên máy chủ đám mây, không biết nhập địa chỉ gì trong trình duyệt? Xem [Hướng dẫn truy cập giao diện Web trên máy chủ đám mây](docs/deploy-webui-cloud.md).

> Cũng có thể dùng `python main.py --serve` (lệnh tương đương)

## 🗺️ Lộ trình

Xem các tính năng đã hỗ trợ và kế hoạch tương lai: [Nhật ký cập nhật](docs/CHANGELOG.md)

> Có đề xuất? Chào mừng [gửi Issue](https://github.com/ZhuLinsen/daily_stock_analysis/issues)

> ⚠️ **Thông báo điều chỉnh UI**: Dự án hiện đang liên tục điều chỉnh và nâng cấp Web UI, một số trang trong giai đoạn chuyển tiếp có thể còn vấn đề về style, tương tác hoặc tương thích. Chào mừng phản hồi qua [Issue](https://github.com/ZhuLinsen/daily_stock_analysis/issues) hoặc trực tiếp gửi [Pull Request](https://github.com/ZhuLinsen/daily_stock_analysis/pulls) để hoàn thiện cùng nhau.

---

## ☕ Ủng hộ dự án

Nếu dự án này hữu ích với bạn, chào mừng ủng hộ để dự án tiếp tục được duy trì và phát triển, cảm ơn sự hỗ trợ 🙏

| Alipay | WeChat Pay | Ko-fi |
| :---: | :---: | :---: |
| <img src="./sources/alipay.jpg" width="200" alt="Alipay"> | <img src="./sources/wechatpay.jpg" width="200" alt="WeChat Pay"> | <a href="https://ko-fi.com/mumu157" target="_blank"><img src="./sources/ko-fi.png" width="200" alt="Ko-fi"></a> |

---

## 🤝 Đóng góp

Chào mừng gửi Issue và Pull Request!

Xem chi tiết tại [Hướng dẫn đóng góp](docs/CONTRIBUTING.md)

### Kiểm tra local (khuyến nghị chạy trước)

```bash
pip install -r requirements.txt
pip install flake8 pytest
./scripts/ci_gate.sh
```

Nếu sửa frontend (`apps/dsa-web`):

```bash
cd apps/dsa-web
npm ci
npm run lint
npm run build
```

## 📄 Giấy phép
[MIT License](LICENSE) © 2026 ZhuLinsen

Nếu bạn sử dụng hoặc phát triển thứ cấp dựa trên dự án này,
rất chào mừng ghi nguồn và đính kèm link kho lưu trữ này trong README hoặc tài liệu.
Điều này sẽ giúp cho việc duy trì và phát triển cộng đồng dự án.

## 📬 Liên hệ & Hợp tác
- GitHub Issues: [Gửi Issue](https://github.com/ZhuLinsen/daily_stock_analysis/issues)
- Email hợp tác: zhuls345@gmail.com

## ⭐ Lịch sử Star
**Nếu thấy hữu ích, hãy nhấn ⭐ Star ủng hộ nhé!**

<a href="https://star-history.com/#ZhuLinsen/daily_stock_analysis&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ZhuLinsen/daily_stock_analysis&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=ZhuLinsen/daily_stock_analysis&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ZhuLinsen/daily_stock_analysis&type=Date" />
 </picture>
</a>

## ⚠️ Tuyên bố miễn trách nhiệm

Dự án này chỉ dành cho mục đích học tập và nghiên cứu, không cấu thành bất kỳ lời khuyên đầu tư nào. Thị trường chứng khoán có rủi ro, đầu tư cần thận trọng. Tác giả không chịu trách nhiệm về bất kỳ tổn thất nào phát sinh từ việc sử dụng dự án này.

---
