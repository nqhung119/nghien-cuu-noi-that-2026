# Cấu trúc và mã hóa

## Vì sao dùng mô hình lai

Điều hướng theo phòng phù hợp với thiết kế và nghiệm thu; danh mục chuẩn hóa phù hợp với dự toán và mua hàng. Hạng mục lặp lại được quản lý tại nhóm chung, phòng chỉ dẫn chiếu, nhờ đó một mã sơn/sàn/đèn không bị tạo nhiều phiên bản mâu thuẫn.

## Mã phòng

| Mã | Khu vực |
|---|---|
| `ENT` | Sảnh và lối vào |
| `LIV` | Phòng khách |
| `KIT` | Bếp và phòng ăn |
| `BR1` | Phòng ngủ 1 — 14,4 m² |
| `BR2` | Phòng ngủ 2 — 9,85 m² |
| `BAT` | Phòng tắm — 4,3 m² |
| `LOG` | Lô gia |
| `COM` | Hạng mục chung/toàn căn |

## Mã bản ghi

`[PHONG]-[HANGMUC]-[PA]`, ví dụ `KIT-CAB-03` là phương án 03 của tủ bếp. Mã không đổi khi đổi nhà cung cấp; hãng/model/mã màu nằm ở cột riêng.

## Loại đối tượng

| Mã loại | Ý nghĩa | Ví dụ |
|---|---|---|
| `MAT` | Vật liệu | sơn, đá, ván, gạch |
| `FIX` | Nội thất đóng | tủ bếp, tủ áo, kệ TV |
| `LOO` | Nội thất mua sẵn | sofa, bàn, ghế, đệm |
| `ELE` | Thiết bị điện | bếp, hút mùi, điều hòa, đèn |
| `PLU` | Thiết bị nước | chậu, vòi, sen, bồn cầu |
| `ACC` | Phụ kiện | ray, bản lề, giàn phơi |
| `AUX` | Vật tư phụ | keo, silicone, nẹp, vít |
| `LAB` | Nhân công/dịch vụ | lắp đặt, che chắn, vệ sinh |

## Quy tắc tên thư mục

- Dùng số thứ tự hai chữ số để giữ thứ tự ổn định.
- Dùng chữ Latin không dấu, viết hoa và dấu gạch ngang.
- Không đưa hãng hoặc năm vào tên thư mục; hãng/năm thay đổi nhưng mã hạng mục phải bền.
- Một hạng mục chỉ có một nơi dữ liệu gốc. Dùng liên kết tương đối nếu phòng khác dùng chung.

## Trường dữ liệu bắt buộc khi chốt

`item_id`, `option_id`, `room`, `type`, `name`, `brand_model`, `material`, `key_spec`, `quantity`, `unit`, `unit_price`, `installation`, `accessories`, `tax`, `total`, `supplier`, `lead_time`, `warranty`, `status`, `approved_by`, `approved_date`, `evidence_link`, `notes`.

## Phiên bản và thay đổi

Giá, model và liên kết được phép cập nhật; tên mã không đổi. Nếu thông số nền tảng đổi, tạo phiên bản phương án mới và ghi lý do, không sửa âm thầm phương án đã duyệt.

## Khi nào tạo file riêng cho một phương án

Trong giai đoạn nghiên cứu, các phương án nằm chung trong README của hạng mục và CSV tổng để dễ so sánh/lọc. Khi một phương án vào shortlist hoặc có báo giá/mẫu thật, sao chép `TEMPLATE-PHUONG-AN-DA-CHON.md` thành `[OPTION-ID]-[HANG-MODEL].md` ngay trong thư mục hạng mục. Không tạo trước hàng trăm file lặp nội dung.
