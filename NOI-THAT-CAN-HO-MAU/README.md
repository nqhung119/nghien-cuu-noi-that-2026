# Cơ sở dữ liệu lựa chọn nội thất/vật tư — căn hộ mẫu

**Thông tin nhận diện:** Đã ẩn danh

**Quy mô tham chiếu:** 61 m², 2 phòng ngủ, 1 phòng tắm
**Mốc giá:** 14/08/2026 — khoảng lập ngân sách tại Việt Nam, chưa phải báo giá  
**Hồ sơ ngân sách liên quan:** [phương án 150 triệu](../phuong-an-noi-that-can-ho-mau.md)

## Mục đích

Thư mục này là cơ sở dữ liệu để đi từ nhu cầu đến lựa chọn, khối lượng, dự toán, mua sắm, thi công và nghiệm thu. Hệ thống không chỉ lưu ảnh tham khảo; mỗi hạng mục có tiêu chí kỹ thuật, 5 phương án từ tiết kiệm đến cao hơn, cấu phần chi phí và điều kiện chọn/loại.

Giá là khoảng dự toán để sàng lọc phương án. Khi mua hoặc giao thầu phải lấy ít nhất ba báo giá trên cùng quy cách, xác minh thuế, vận chuyển, lắp đặt, phụ kiện và bảo hành.

## Cấu trúc tối ưu đã chọn

```text
NOI-THAT-CAN-HO-MAU/
├── 00-QUAN-LY-DU-AN/           # mã hóa, nguồn, tiêu chí, BOQ, sổ lựa chọn
├── 01-SANH-VA-LOI-VAO/         # tủ giày và đồ sảnh
├── 02-PHONG-KHACH/             # sofa, bàn, TV, rèm, tiện nghi nhiệt
├── 03-BEP-VA-PHONG-AN/          # tủ, mặt/ốp, phụ kiện, nước, thiết bị, bàn ăn
├── 04-PHONG-NGU-01/             # phòng 14,4 m²
├── 05-PHONG-NGU-02/             # phòng 9,85 m²
├── 06-PHONG-TAM/                # khu ướt, thiết bị nước và thông gió
├── 07-LO-GIA/                   # giặt, phơi, thoát nước
├── 08-HANG-MUC-CHUNG/           # sàn, trần, sơn, điện, đèn, đồ gỗ, vật tư phụ
└── 90-TAI-LIEU-DINH-KEM/        # báo giá, mẫu, shop drawing, nghiệm thu, bảo hành
```

Các lớp hoàn thiện lặp lại như sàn, trần, sơn, điện và tiêu chuẩn ván được quản lý một lần tại `08-HANG-MUC-CHUNG`, sau đó phòng dẫn chiếu đến mã lựa chọn. Cách này tránh cùng một vật liệu bị mô tả hoặc định giá khác nhau ở nhiều nơi.

Mỗi hạng mục gom 5–6 phương án trong một `README.md` để so sánh trực tiếp; đồng thời các trường dữ liệu lõi được chuẩn hóa trong `00-QUAN-LY-DU-AN/10-DANH-MUC-PHUONG-AN.csv`. Chỉ tạo file riêng cho phương án khi đã vào danh sách rút gọn và có model/mẫu/báo giá thật, dùng `TEMPLATE-PHUONG-AN-DA-CHON.md`. Cách này tránh hơn 200 file rỗng nhưng vẫn giữ khả năng mở rộng từng lựa chọn.

Lớp giải thích chuyên sâu được quản lý tại `00-QUAN-LY-DU-AN/12-HUONG-DAN-HANG-MUC.json` và đồng bộ vào toàn bộ 48 README bằng `website/tools/enrich-content.ps1`. Mỗi hạng mục vì vậy có định nghĩa, vị trí, mức bắt buộc, loại phổ biến, vật liệu, yếu tố giá, bảo trì, thi công, lỗi và khuyến nghị; website kết hợp lớp này với từng dòng phương án để tạo 241 trang chi tiết. Nguồn sơ cấp và quy trình kiểm chứng nằm tại `00-QUAN-LY-DU-AN/13-NGUON-VA-CACH-KIEM-CHUNG.md`.

## Cách sử dụng

1. Đọc `00-QUAN-LY-DU-AN/01-CAU-TRUC-VA-MA-HOA.md` và chốt yêu cầu người dùng.
2. Đi theo phòng, mở `README.md` của hạng mục cần chọn.
3. Loại phương án vi phạm điều kiện kỹ thuật trước khi so giá.
4. Chấm điểm theo `02-TIEU-CHI-CHAM-DIEM.md`; ghi lựa chọn vào `07-SO-DANG-KY-LUA-CHON.csv`.
5. Đo hiện trạng, điền khối lượng vào `06-BOQ-MAU.csv`.
6. Gửi `08-YEU-CAU-BAO-GIA.csv` cho các nhà cung cấp trên cùng quy cách.
7. Khóa mã vật liệu, shop drawing và mẫu duyệt trước khi đặt hàng/sản xuất.
8. Cập nhật giá thực tế, trạng thái giao hàng, bảo hành và biên bản nghiệm thu.

## Quy ước trong các hạng mục

- **Giá vật tư/sản phẩm:** giá mua hoặc giá gia công chính.
- **Thi công:** nhân công lắp, xử lý nền/bề mặt hoặc đấu nối thông thường.
- **Phụ kiện:** ray, bản lề, nẹp, keo, ống, dây, giá treo hoặc chi tiết không nằm trong thân sản phẩm.
- **Tổng dự kiến:** không cộng lại nếu nhà cung cấp đã báo trọn gói; phải phát hiện trùng chi phí.
- **Tuổi thọ:** khoảng sử dụng hợp lý khi lắp đúng, môi trường phù hợp và bảo trì; không phải thời hạn bảo hành.
- **Phù hợp căn hộ mẫu:** đánh giá theo diện tích 61 m², lối đi và phương án giữ phần hoàn thiện bàn giao.

## Nguyên tắc quyết định

- An toàn, chống nước, tải điện, thoát nước và khả năng bảo trì là điều kiện loại, không phải điểm trang trí.
- Không chọn theo tên “chống ẩm” nếu vị trí thực tế có thể ngâm hoặc tiếp xúc nước trực tiếp.
- Thiết bị âm/tủ phải mua hoặc khóa đúng mã trước khi khoét đá và sản xuất tủ.
- Đồ cồng kềnh phải kiểm tra cửa, hành lang, thang máy và bán kính quay trước khi đặt.
- Mỗi lựa chọn cuối cùng phải có mã, hãng/model hoặc mã màu, kích thước, đơn vị, giá đã gồm/chưa gồm, người duyệt và ngày duyệt.

## Trạng thái dự án gợi ý

`NHU-CAU` → `SO-SANH` → `CHON-TAM` → `LAY-MAU/BAO-GIA` → `DA-DUYET` → `DA-DAT` → `DA-LAP` → `NGHIEM-THU` → `BAO-HANH`.

## Ghi chú về phương án 150 triệu

Cơ sở dữ liệu bao quát toàn căn dù phương án B hiện tại không thi công hai phòng ngủ. Khi dùng phương án B, đặt trạng thái các hạng mục tại `04-PHONG-NGU-01` và `05-PHONG-NGU-02` là `DE-SAU`, không xóa dữ liệu vì chúng sẽ dùng cho giai đoạn 2.
