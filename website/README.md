# Website cơ sở dữ liệu nội thất căn hộ mẫu

Website này biến toàn bộ cây thư mục `NOI-THAT-CAN-HO-MAU/` thành một knowledge base tĩnh có tìm kiếm, điều hướng theo phòng, bảng so sánh, trang chi tiết và bảng phương án có thể xuất PDF/XLSX.

## Mở website

Mở trực tiếp `index.html` bằng Chrome, Edge hoặc Firefox. Không cần cài package, chạy server hay kết nối Internet.

Nếu trình duyệt/do chính sách máy hạn chế trang `file://`, có thể chạy một web server tĩnh bất kỳ tại thư mục gốc dự án. Ví dụ khi đã có Python:

```powershell
python -m http.server 8080
```

Sau đó mở `http://localhost:8080/website/`.

## Cấu trúc

```text
website/
├── index.html                 # Khung ứng dụng
├── assets/
│   └── guides/                # Ảnh cẩm nang local + nguồn/ghi chú tạo ảnh
├── css/
│   └── styles.css             # Giao diện, responsive, dark mode, print
├── js/
│   ├── utils.js               # Chuẩn hóa tìm kiếm, route, định dạng giá
│   ├── markdown.js            # Renderer Markdown nội bộ
│   ├── export.js              # Tạo PDF/XLSX trực tiếp trong trình duyệt
│   └── app.js                 # Khởi tạo, theme, breadcrumb, hash route
├── components/
│   ├── sidebar.js             # Cây phòng/hạng mục tự sinh
│   ├── search.js              # Tìm nội dung không phân biệt dấu
│   ├── toc.js                 # Mục lục theo heading và vị trí cuộn
│   ├── selection.js           # Lưu lựa chọn, khối lượng và tính dự toán
│   └── content.js             # Tổng quan, so sánh, chi tiết, CSV
├── data/
│   ├── catalog.json           # Dữ liệu chuẩn để tích hợp tiếp
│   └── catalog.js             # Cùng dữ liệu, dùng được khi mở file trực tiếp
└── tools/
    ├── enrich-content.ps1     # Đồng bộ lớp hướng dẫn vào 48 README hạng mục
    └── build-data.ps1         # Quét cây Markdown/CSV/JSON và sinh catalog
```

## Cập nhật dữ liệu

Chỉnh sửa hoặc bổ sung Markdown/CSV trong `NOI-THAT-CAN-HO-MAU/`. Nếu thay nội dung quyết định trong `12-HUONG-DAN-HANG-MUC.json`, đồng bộ lại các README trước khi build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File website\tools\enrich-content.ps1
```

Sau đó từ thư mục gốc dự án chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File website\tools\build-data.ps1
```

Sau khi build, tải lại `website/index.html`. Script tự động:

- nhận diện mọi thư mục không gian đánh số;
- lấy trang tổng quan và các hạng mục từ Markdown;
- nối danh mục hạng mục, phương án và nhóm thương hiệu từ CSV quản lý;
- nối lớp hướng dẫn quyết định và manifest ảnh từ `12-HUONG-DAN-HANG-MUC.json`;
- đưa các Markdown mới chưa đăng ký vào điều hướng;
- tạo trang cho các bảng CSV quản lý và hồ sơ đính kèm;
- xuất metadata, nội dung tìm kiếm, bảng phương án và liên kết nguồn.

Không cần sửa danh sách phòng trong HTML hoặc JavaScript.

## Quy ước dữ liệu

Ba bảng sau là trục liên kết của hệ thống:

- `09-DANH-MUC-HANG-MUC.csv`: `item_id`, phòng, thư mục, loại, phạm vi, trạng thái gói 150 triệu.
- `10-DANH-MUC-PHUONG-AN.csv`: `option_id`, `item_id`, phân khúc, khoảng giá, đơn vị và file nguồn.
- `11-NHOM-THUONG-HIEU.csv`: nhóm thương hiệu theo `item_id`.

`12-HUONG-DAN-HANG-MUC.json` bổ sung cho từng `item_id`: định nghĩa, vị trí, mức bắt buộc, loại phổ biến, vật liệu, yếu tố giá, lỗi, khuyến nghị, bảo trì, thi công, nghiệm thu và figure có caption/credit. Script `enrich-content.ps1` dùng các marker `GUIDE:START/END` để cập nhật đúng khối sinh tự động mà không làm mất bảng phương án hay ghi chú viết tay.

Trang chi tiết của mọi phương án lấy dữ liệu riêng từ dòng `Mã` trong README và kết hợp với hướng dẫn của hạng mục để trình bày công dụng, đặc điểm, ưu/nhược, độ bền, bảo trì, chi phí, thi công, trường hợp phù hợp/không phù hợp, vị trí so sánh và đánh giá định tính.

Trong README của hạng mục, bảng phương án cần có cột đầu là `Mã`; mã từng dòng phải trùng `option_id`. Các cột còn lại được giữ linh hoạt theo chuyên môn của từng hạng mục và sẽ tự xuất hiện trong trang so sánh/chi tiết.

## Điều hướng và sử dụng

- Route tài liệu: `#/doc/{document-id}`.
- Route phương án: `#/option/{option-id}`.
- Route bảng đã chọn: `#/selection`.
- `Ctrl+K` hoặc `Cmd+K`: mở tìm kiếm toàn cục.
- Tìm kiếm không phân biệt dấu, quét tên, mã, phòng và toàn bộ nội dung.
- Trong trang hạng mục, chọn tối đa bốn phương án để so sánh cạnh nhau.
- Nút `Chọn phương án` dùng cho bảng dự toán; mỗi hạng mục giữ một phương án và lựa chọn mới sẽ thay thế lựa chọn cũ của cùng hạng mục.
- Trang `Đã chọn` cho phép nhập số lượng, xem khoảng chi phí từng hạng mục và tổng, rồi xuất PDF hoặc XLSX ngay cả khi chưa chọn đủ danh mục.
- Phương án có cơ sở giá theo `% giá tủ` cần nhập thêm giá tủ cơ sở. Nếu chưa nhập, phương án vẫn có trong tệp xuất nhưng được ghi rõ là chưa cộng vào tổng.
- Trên màn hình nhỏ, sidebar chuyển thành drawer; bảng vẫn cuộn ngang độc lập.
- Theme sáng/tối, trạng thái thu gọn sidebar và danh sách phương án đã chọn được lưu trên trình duyệt.

## Mở rộng tiếp

`data/catalog.json` là lớp dữ liệu trung gian để tạo bảng lựa chọn, tính số lượng × khoảng giá và xuất hồ sơ. PDF và XLSX được tạo hoàn toàn trong trình duyệt, không gửi lựa chọn lên máy chủ. Giao diện hiện tại không phụ thuộc framework và không dùng CDN, nên có thể đặt lên GitHub Pages, Netlify, Vercel hoặc máy chủ nội bộ như một website tĩnh.

## Giới hạn dữ liệu giá

Website chỉ trình bày khoảng giá và giả định có trong nguồn. Trước khi mua sắm/giao thầu vẫn cần xác nhận model, tồn kho, thuế, vận chuyển, phụ kiện, lắp đặt và bảo hành bằng báo giá cùng thời điểm.

## Kiểm tra nhanh

Máy có Node.js và Chrome/Edge có thể chạy bài kiểm tra trình duyệt:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File website\tools\validate-content.ps1
node website\tools\browser-smoke-test.js
```

Script đầu kiểm tra độ phủ 48 hạng mục, marker README, dòng của 241 phương án, figure/caption/credit và catalog đã build. Bài kiểm tra trình duyệt mở Chrome/Edge ẩn để xác minh trang bắt đầu, tìm kiếm, so sánh Sofa, nội dung giải thích, ảnh local, lựa chọn một phần, tính tổng, chữ ký tệp PDF/XLSX, CSV đã render, drawer mobile và lỗi JavaScript runtime.
