---
name: "stock_analyzer"
description: "Phân tích cổ phiếu và thị trường. Gọi khi người dùng muốn phân tích một hoặc nhiều cổ phiếu, hoặc thực hiện tổng kết thị trường."
---

# Bộ phân tích cổ phiếu

Kỹ năng này dựa trên logic của `analyzer_service.py`, cung cấp chức năng phân tích cổ phiếu riêng lẻ và toàn bộ thị trường.

## Cấu trúc đầu ra (`AnalysisResult`)

Các hàm phân tích trả về một đối tượng `AnalysisResult` (hoặc danh sách), có cấu trúc phong phú. Dưới đây là tổng quan ngắn gọn về các thành phần chính kèm ví dụ đầu ra thực tế:

Thuộc tính `dashboard` chứa phân tích cốt lõi, chia thành bốn phần chính:
1.  **`core_conclusion`**: Tóm tắt một câu, loại tín hiệu và khuyến nghị vị thế.
2.  **`data_perspective`**: Dữ liệu kỹ thuật gồm trạng thái xu hướng, vị trí giá, phân tích khối lượng và cấu trúc chip.
3.  **`intelligence`**: Thông tin định tính như tin tức, cảnh báo rủi ro và chất xúc tác tích cực.
4.  **`battle_plan`**: Chiến lược hành động gồm điểm bắn (mục tiêu mua/bán), chiến lược vị thế và danh sách kiểm soát rủi ro.

## Cấu hình (`Config`)

Tất cả các hàm phân tích đều có thể nhận một đối tượng `config` tùy chọn. Đối tượng này chứa toàn bộ cấu hình ứng dụng như API key, cài đặt thông báo và tham số phân tích.

Nếu không truyền đối tượng `config`, hàm sẽ tự động dùng instance singleton toàn cục được nạp từ file `.env`.

**Tham chiếu:** [`Config`](src/config.py)

## Các hàm

### 1. Phân tích một cổ phiếu

**Mô tả:** Phân tích một cổ phiếu và trả về kết quả phân tích.

**Khi nào dùng:** Khi người dùng yêu cầu phân tích một cổ phiếu cụ thể.

**Đầu vào:**
- `stock_code` (str): Mã cổ phiếu cần phân tích.
- `config` (Config, tùy chọn): Đối tượng cấu hình. Mặc định là `None`.
- `full_report` (bool, tùy chọn): Có tạo báo cáo đầy đủ không. Mặc định là `False`.
- `notifier` (NotificationService, tùy chọn): Đối tượng dịch vụ thông báo. Mặc định là `None`.

**Đầu ra:** `Optional[AnalysisResult]`
Một đối tượng `AnalysisResult` chứa kết quả phân tích, hoặc `None` nếu phân tích thất bại.

**Ví dụ:**

```python
from analyzer_service import analyze_stock

# Phân tích một cổ phiếu
result = analyze_stock("600989")
if result:
    print(f"Cổ phiếu: {result.name} ({result.code})")
    print(f"Điểm tâm lý: {result.sentiment_score}")
    print(f"Khuyến nghị giao dịch: {result.operation_advice}")
```

**Tham chiếu:** [`analyze_stock`](./analyzer_service.py)

### 2. Phân tích nhiều cổ phiếu

**Mô tả:** Phân tích một danh sách cổ phiếu và trả về danh sách kết quả.

**Khi nào dùng:** Khi người dùng muốn phân tích nhiều cổ phiếu cùng lúc.

**Đầu vào:**
- `stock_codes` (List[str]): Danh sách mã cổ phiếu cần phân tích.
- `config` (Config, tùy chọn): Đối tượng cấu hình. Mặc định là `None`.
- `full_report` (bool, tùy chọn): Có tạo báo cáo đầy đủ cho từng cổ phiếu không. Mặc định là `False`.
- `notifier` (NotificationService, tùy chọn): Đối tượng dịch vụ thông báo. Mặc định là `None`.

**Đầu ra:** `List[AnalysisResult]`
Danh sách các đối tượng `AnalysisResult`.

**Ví dụ:**

```python
from analyzer_service import analyze_stocks

# Phân tích nhiều cổ phiếu
results = analyze_stocks(["600989", "000001"])
for result in results:
    print(f"Cổ phiếu: {result.name}, Khuyến nghị: {result.operation_advice}")
```

**Tham chiếu:** [`analyze_stocks`](./analyzer_service.py)


### 3. Tổng kết thị trường

**Mô tả:** Thực hiện tổng kết toàn bộ thị trường và trả về một báo cáo.

**Khi nào dùng:** Khi người dùng yêu cầu tổng quan, tóm tắt hoặc tổng kết thị trường.

**Đầu vào:**
- `config` (Config, tùy chọn): Đối tượng cấu hình. Mặc định là `None`.
- `notifier` (NotificationService, tùy chọn): Đối tượng dịch vụ thông báo. Mặc định là `None`.

**Đầu ra:** `Optional[str]`
Một chuỗi chứa báo cáo tổng kết thị trường, hoặc `None` nếu thất bại.

**Ví dụ:**

```python
from analyzer_service import perform_market_review

# Tổng kết thị trường
report = perform_market_review()
if report:
    print(report)
```

**Tham chiếu:** [`perform_market_review`](./analyzer_service.py)
