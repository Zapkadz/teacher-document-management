# UI/UX specification

## 1. Mục tiêu thiết kế

- Giữ cách sử dụng quen thuộc giống hệ thống hồ sơ điện tử: cây thư mục bên trái, danh sách tài liệu bên phải.
- Giao diện hiện đại, dễ nhìn, responsive.
- Chỉ hiện thao tác mà người dùng có quyền thực hiện.
- Hạn chế menu sâu và thuật ngữ kỹ thuật.

## 2. Bố cục trang chính

```text
┌──────────────────────────────────────────────────────────────┐
│ Logo | Hồ sơ giáo dục | Năm học | Tìm kiếm | Người dùng     │
├──────────────────────────────────────────────────────────────┤
│ Toolbar: +Thư mục | Tải lên | Thêm link | Tải xuống | ...  │
├───────────────────────┬──────────────────────────────────────┤
│ Cây thư mục           │ Breadcrumb                           │
│                       │ Danh sách tài liệu                    │
│ Kho của tôi           │                                      │
│ Kho dùng chung        │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

## 3. Navigation

Menu chính:

- Hồ sơ giáo dục.
- Kho của tôi.
- Kho dùng chung.
- Thùng rác.
- Hoạt động của tôi.
- Quản trị, chỉ admin.

## 4. Cây thư mục

Tính năng:

- Expand/collapse.
- Lazy load node con.
- Context menu theo quyền.
- Drag/drop có thể triển khai sau; MVP ưu tiên dialog di chuyển để tránh nhầm.
- Icon khóa nếu thư mục bị khóa.
- Badge cho quyền kế thừa hoặc thư mục cá nhân nếu cần.
- Hiển thị tooltip khi tên dài.

## 5. Toolbar

Nút đề xuất:

- `Tạo thư mục`.
- `Tải lên`.
- `Thêm liên kết`.
- `Tải xuống`.
- `Di chuyển`.
- `Đổi tên`.
- `Xóa`.
- `Chức năng`.

Menu `Chức năng`:

- Phân quyền hộp tài liệu.
- Khóa/Mở khóa thư mục.
- Sao chép thư mục.
- Sao chép cấu trúc và quyền từ năm trước.
- Xem lịch sử hoạt động.
- Quản lý kế thừa quyền.

Các nút bị ẩn hoặc disabled theo quyền. Khi disabled phải có tooltip giải thích.

## 6. Danh sách tài liệu

Cột mặc định:

- Checkbox.
- Tên tài liệu.
- Loại.
- Người tạo.
- Ngày tải lên.
- Dung lượng.
- Trạng thái.
- Thao tác.

Chế độ hiển thị:

- Table mặc định.
- Grid có thể để giai đoạn sau.

Thao tác nhanh:

- Xem trước.
- Tải xuống.
- Mở liên kết.
- Menu ba chấm.

## 7. Màn hình phân quyền

Bố cục desktop:

```text
┌──────────────────────┬───────────────────────────────────────┐
│ Cây thư mục          │ Danh sách người và quyền hiện tại    │
│                      │ [+ Thêm quyền] [Sửa] [Thu hồi]       │
└──────────────────────┴───────────────────────────────────────┘
```

Bảng quyền:

- Họ tên.
- Gmail.
- Loại đối tượng: người dùng/nhóm.
- Quyền.
- Phạm vi.
- Nguồn: trực tiếp/kế thừa.
- Người cấp.
- Ngày cấp.
- Thao tác.

## 8. Dialog thêm quyền

### Bước 1 — Chọn đối tượng

- Tab Người dùng.
- Tab Nhóm.
- Tìm kiếm theo tên/Gmail.
- Chọn nhiều.

### Bước 2 — Chọn quyền

Preset:

- Chỉ xem.
- Xem và tải.
- Người đóng góp.
- Quản lý nội dung.
- Quản lý thư mục.

Cho phép mở phần `Tùy chỉnh nâng cao` để tick từng quyền.

### Bước 3 — Phạm vi

- Chỉ thư mục hiện tại.
- Thư mục và toàn bộ thư mục con.

### Bước 4 — Xác nhận

Hiển thị tóm tắt rõ ràng trước khi lưu.

## 9. Upload dialog

- Drag and drop.
- Chọn nhiều file.
- Hiển thị tiến trình từng file.
- Hiển thị lỗi từng file.
- Cho phép sửa tên hiển thị trước khi upload.
- Không chặn toàn batch khi một file lỗi.

## 10. Thêm link video

Fields:

- Tên.
- Nguồn: Google Drive/YouTube.
- URL.
- Mô tả.

Validation:

- URL hợp lệ.
- Domain hợp lệ.
- Cảnh báo Google Drive cần cấu hình quyền chia sẻ ngoài hệ thống.

## 11. Trạng thái rỗng và lỗi

Ví dụ:

- Chưa có tài liệu: `Thư mục này chưa có tài liệu.`
- Không có quyền: `Bạn không có quyền truy cập nội dung này.`
- Tài khoản chưa được cấp: `Tài khoản Gmail này chưa được quản trị viên cấp quyền.`
- File quá lớn: hiển thị giới hạn cụ thể từ settings.

## 12. Responsive

Desktop là ưu tiên chính.

Mobile/tablet:

- Cây thư mục mở bằng drawer.
- Toolbar thu gọn vào menu.
- Bảng chuyển thành card list.
- Các dialog thành full-screen sheet nếu cần.

## 13. Accessibility

- Hỗ trợ điều hướng bàn phím.
- Focus state rõ ràng.
- Label đầy đủ cho input và icon button.
- Không chỉ dùng màu để biểu đạt trạng thái.
- Confirm dialog cho thao tác nguy hiểm.
