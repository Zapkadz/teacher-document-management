# Vai trò và phân quyền

## 1. Nguyên tắc

Hệ thống dùng mô hình kết hợp:

- **Global role**: quyền toàn hệ thống, ví dụ `ADMIN`, `USER`.
- **Folder ACL**: quyền chi tiết theo từng thư mục.
- **Ownership**: quyền trên nội dung do chính người dùng tạo.
- **Inheritance**: quyền từ thư mục cha có thể áp dụng xuống thư mục con.

Không dùng chức danh tổ trưởng hoặc giáo viên làm vai trò cứng. Một người có thể quản lý thư mục A nhưng chỉ có quyền xem ở thư mục B.

## 2. Global roles

### ADMIN

- Toàn quyền hệ thống.
- Xem mọi kho cá nhân và kho dùng chung.
- Quản lý tài khoản.
- Quản lý cấu hình.
- Xóa vĩnh viễn.
- Xem toàn bộ audit log.

### USER

- Không có quyền toàn hệ thống.
- Quyền được quyết định bởi ownership và ACL theo thư mục.

## 3. Danh sách permission

| Mã quyền | Ý nghĩa |
|---|---|
| `VIEW` | Nhìn thấy thư mục, danh sách và metadata tài liệu |
| `PREVIEW` | Xem trước nội dung tài liệu nếu hỗ trợ |
| `DOWNLOAD` | Tải tài liệu xuống |
| `UPLOAD` | Upload tài liệu hoặc thêm link vào thư mục |
| `CREATE_SUBFOLDER` | Tạo thư mục con |
| `EDIT_OWN` | Sửa metadata hoặc phiên bản tài liệu do chính mình tạo |
| `DELETE_OWN` | Xóa mềm tài liệu do chính mình tạo |
| `MOVE_OWN` | Di chuyển tài liệu do chính mình tạo |
| `EDIT_ANY` | Sửa tài liệu bất kỳ trong thư mục |
| `DELETE_ANY` | Xóa mềm tài liệu bất kỳ trong thư mục |
| `MOVE_ANY` | Di chuyển tài liệu bất kỳ trong thư mục |
| `LOCK_FOLDER` | Khóa hoặc mở khóa thư mục |
| `MANAGE_PERMISSIONS` | Cấp, sửa, thu hồi quyền trên thư mục |
| `VIEW_AUDIT` | Xem audit log trong phạm vi thư mục |
| `RESTORE` | Khôi phục dữ liệu trong phạm vi thư mục |
| `PURGE` | Xóa vĩnh viễn; chỉ admin trong MVP |

## 4. Mẫu quyền

### Chỉ xem

- `VIEW`
- `PREVIEW`

### Xem và tải

- `VIEW`
- `PREVIEW`
- `DOWNLOAD`

### Người đóng góp

- `VIEW`
- `PREVIEW`
- `DOWNLOAD`
- `UPLOAD`
- `CREATE_SUBFOLDER`
- `EDIT_OWN`
- `DELETE_OWN`
- `MOVE_OWN`

### Quản lý nội dung

- Toàn bộ quyền Người đóng góp.
- `EDIT_ANY`
- `DELETE_ANY`
- `MOVE_ANY`
- `LOCK_FOLDER`
- `RESTORE`
- `VIEW_AUDIT`

### Quản lý thư mục

- Toàn bộ quyền Quản lý nội dung.
- `MANAGE_PERMISSIONS`

### Toàn quyền

- Chỉ admin.

## 5. Quy tắc kế thừa

Mỗi bản ghi quyền gồm:

- `folder_id`
- `principal_type`: `USER` hoặc `GROUP`
- `principal_id`
- `permissions`
- `applies_to_descendants`
- `granted_by`
- `created_at`

Cách tính quyền hiệu lực:

1. Nếu là admin: toàn quyền.
2. Lấy quyền trực tiếp trên thư mục hiện tại.
3. Lấy quyền từ các thư mục cha có `applies_to_descendants = true`.
4. Hợp nhất quyền theo phép OR.
5. MVP chưa hỗ trợ deny rule riêng biệt để tránh phức tạp. Khi cần ngoại lệ, tắt kế thừa ở thư mục con và cấp lại quyền.

## 6. Tắt kế thừa

Mỗi thư mục có thuộc tính:

- `inherit_permissions = true` mặc định.

Khi chuyển sang `false`:

- Không nhận quyền từ cha.
- Giữ quyền trực tiếp hiện có.
- UI phải cảnh báo vì thao tác có thể làm người dùng mất quyền truy cập.

## 7. Quy tắc ownership

Trong kho cá nhân:

- Chủ sở hữu mặc định có quyền quản lý nội dung của chính mình.
- Không tự có `MANAGE_PERMISSIONS` toàn kho trừ khi hệ thống hỗ trợ chia sẻ cá nhân ở giai đoạn sau.

Trong kho dùng chung:

- Ownership không vượt qua ACL.
- Ví dụ người dùng tạo file trong thư mục bị khóa thì không được sửa dù là chủ sở hữu, trừ admin.

## 8. Quyền phụ thuộc

- `DOWNLOAD` yêu cầu `VIEW`.
- `PREVIEW` yêu cầu `VIEW`.
- `EDIT_OWN`, `DELETE_OWN`, `MOVE_OWN` yêu cầu `VIEW`.
- `EDIT_ANY`, `DELETE_ANY`, `MOVE_ANY` yêu cầu `VIEW`.
- `MANAGE_PERMISSIONS` ngầm yêu cầu `VIEW`.
- Backend phải chuẩn hóa bộ quyền khi lưu.

## 9. Ma trận hành động

| Hành động | Giáo viên có quyền cơ bản | Người quản lý nội dung | Admin |
|---|---:|---:|---:|
| Xem thư mục | Theo ACL | Theo ACL | Có |
| Tải xuống | Theo ACL | Theo ACL | Có |
| Upload | Theo ACL | Theo ACL | Có |
| Tạo thư mục con | Theo ACL | Có | Có |
| Sửa file của mình | Theo ACL | Có | Có |
| Sửa file người khác | Không | Có | Có |
| Xóa mềm file của mình | Theo ACL | Có | Có |
| Xóa mềm file người khác | Không | Có | Có |
| Phân quyền | Không | Nếu có quyền | Có |
| Xem audit | Cá nhân hoặc theo ACL | Theo ACL | Có |
| Xóa vĩnh viễn | Không | Không | Có |
