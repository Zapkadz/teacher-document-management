# PRD — Hệ thống Kho hồ sơ giáo dục nội bộ

## 1. Bối cảnh

Hiện tại giáo viên tự lưu tài liệu trên máy tính cá nhân. Điều này gây ra các vấn đề:

- Tài liệu phân tán, khó tìm kiếm.
- Khó chia sẻ cho đồng nghiệp.
- Không có cơ chế phân quyền rõ ràng.
- Dễ mất dữ liệu khi máy tính hỏng hoặc giáo viên nghỉ công tác.
- Không biết ai đã tải lên, chỉnh sửa, tải xuống hoặc xóa tài liệu.

Hệ thống mới đóng vai trò như một kho hồ sơ giáo dục tập trung, có cấu trúc thư mục và phân quyền tương tự hệ thống hồ sơ điện tử hiện tại của trường, nhưng đơn giản hơn và chỉ tập trung vào quản lý tài liệu.

## 2. Mục tiêu sản phẩm

- Tập trung hóa tài liệu giáo viên.
- Cho phép mỗi giáo viên có kho cá nhân riêng.
- Cho phép tạo cây thư mục dùng chung nhiều cấp.
- Cấp quyền truy cập theo từng người, từng nhóm và từng thư mục.
- Tách rõ quyền xem, tải xuống, tải lên, tạo thư mục, chỉnh sửa, xóa và quản lý quyền.
- Ngăn người dùng xóa hoặc sửa tài liệu của người khác khi không được phép.
- Cho phép admin kiểm tra toàn bộ dữ liệu và lịch sử hoạt động.
- Hỗ trợ sử dụng trên máy tính và điện thoại bằng trình duyệt.

## 3. Người dùng và nhu cầu

### 3.1 Admin

Nhu cầu:

- Quản lý tài khoản Gmail.
- Tạo và tổ chức cây thư mục.
- Phân quyền cho người dùng.
- Xem mọi kho cá nhân và kho dùng chung.
- Khôi phục dữ liệu bị xóa.
- Xem nhật ký hoạt động.
- Sao chép cấu trúc thư mục và quyền sang năm học mới.

### 3.2 Người quản lý thư mục

Nhu cầu:

- Quản lý nội dung trong phạm vi thư mục được giao.
- Cấp hoặc thu hồi quyền nếu có quyền quản lý phân quyền.
- Khóa/mở khóa thư mục.
- Sắp xếp, di chuyển, ẩn hoặc khôi phục nội dung.

### 3.3 Giáo viên

Nhu cầu:

- Đăng nhập bằng Gmail được cấp quyền.
- Tự tạo thư mục trong kho cá nhân.
- Upload tài liệu cá nhân.
- Xem, tải xuống hoặc upload tại thư mục chung nếu được cấp quyền.
- Không bị ảnh hưởng bởi tài liệu của người khác.
- Không thể xóa hoặc sửa tài liệu của người khác nếu không có quyền.

## 4. Phạm vi chức năng

### 4.1 Xác thực và tài khoản

- Đăng nhập Google OAuth.
- Kiểm tra Gmail allowlist.
- Trạng thái tài khoản: `PENDING`, `ACTIVE`, `SUSPENDED`, `INACTIVE`.
- Không tự đăng ký.
- Admin thêm người dùng thủ công hoặc import Excel/CSV ở giai đoạn sau.

### 4.2 Kho cá nhân

- Mỗi người dùng có một workspace cá nhân logic.
- Giáo viên tự tạo thư mục và thư mục con.
- Upload, đổi tên, di chuyển, cập nhật và xóa mềm tài liệu của mình.
- Admin có thể xem và quản trị toàn bộ kho cá nhân.
- Người khác chỉ xem được nếu được chia sẻ hoặc được cấp quyền rõ ràng.

### 4.3 Kho dùng chung

- Cây thư mục không giới hạn số cấp ở mức nghiệp vụ, nhưng backend nên có giới hạn kỹ thuật cấu hình được để tránh vòng lặp hoặc cây quá sâu.
- Cho phép tạo, đổi tên, di chuyển, sao chép, khóa và xóa mềm thư mục.
- Mỗi thư mục có thể có quyền trực tiếp và quyền kế thừa.

### 4.4 Quản lý tài liệu

Hỗ trợ:

- Word.
- Excel.
- PDF.
- PowerPoint.
- Hình ảnh.
- Các định dạng khác được admin cấu hình.
- Link Google Drive.
- Link YouTube.

Metadata tối thiểu:

- Tên tài liệu.
- Loại tài liệu.
- MIME type hoặc loại liên kết.
- Dung lượng.
- Người tạo.
- Ngày tạo.
- Ngày cập nhật.
- Mô tả.
- Thư mục chứa.
- Trạng thái.
- Phiên bản.

### 4.5 Tìm kiếm

- Tìm theo tên tài liệu.
- Tìm theo người tải lên.
- Tìm theo loại file.
- Tìm theo thư mục.
- Tìm theo ngày tải lên.
- Tìm theo từ khóa metadata.
- Chỉ trả về kết quả mà người dùng có quyền xem.

### 4.6 Phân quyền

- Cấp quyền cho một hoặc nhiều người.
- Cấp quyền cho nhóm người dùng nếu hệ thống bật tính năng nhóm.
- Chọn phạm vi chỉ thư mục hiện tại hoặc cả thư mục con.
- Xem nguồn quyền: trực tiếp hoặc kế thừa.
- Ghi lịch sử thay đổi quyền.

### 4.7 Thùng rác

- Xóa mềm.
- Giữ mặc định 30 ngày, cấu hình được.
- Khôi phục.
- Chỉ admin hoặc người có quyền đặc biệt mới xóa vĩnh viễn.

### 4.8 Nhật ký hoạt động

Ghi lại:

- Đăng nhập thành công/thất bại cần thiết cho bảo mật.
- Upload.
- Download.
- Xem trước.
- Tạo/sửa/xóa/khôi phục thư mục.
- Tạo/sửa/xóa/khôi phục tài liệu.
- Thay đổi quyền.
- Khóa/mở khóa thư mục.
- Thay đổi tài khoản.

## 5. Quy tắc nghiệp vụ quan trọng

1. Người dùng không có quyền `VIEW` thì không nhìn thấy thư mục hoặc tài liệu.
2. Quyền `DOWNLOAD` không tự động bao gồm `VIEW`; khi cấp `DOWNLOAD`, hệ thống phải tự thêm hoặc yêu cầu có `VIEW`.
3. Quyền `UPLOAD` không cho phép sửa hoặc xóa tài liệu của người khác.
4. Chủ sở hữu tài liệu chỉ được sửa/xóa tài liệu của mình nếu thư mục và trạng thái cho phép.
5. Thư mục bị khóa không cho upload, sửa, di chuyển hoặc xóa nội dung, trừ admin hoặc quyền override rõ ràng.
6. Admin bỏ qua kiểm tra ACL nhưng mọi thao tác vẫn phải ghi audit log.
7. Video chỉ lưu đường dẫn và metadata.
8. Link Google Drive có thể không truy cập được nếu người tạo chưa chia sẻ đúng ở Google Drive; hệ thống phải hiển thị cảnh báo.
9. Không cho tạo vòng lặp khi di chuyển thư mục.
10. Không xóa vĩnh viễn trực tiếp từ giao diện thông thường.

## 6. Giả định MVP

- Một trường, chưa cần multi-tenant.
- Không tích hợp dữ liệu học sinh.
- Không cần chữ ký số.
- Không cần phê duyệt nhiều cấp.
- Không lưu video trực tiếp.
- Preview file phụ thuộc khả năng trình duyệt hoặc dịch vụ preview; không đảm bảo preview mọi định dạng.
- File tối đa mặc định 100 MB, cấu hình được.

## 7. Chỉ số thành công

- 100% giáo viên được cấp tài khoản có thể đăng nhập bằng Gmail.
- Người dùng chỉ nhìn thấy dữ liệu được phép xem.
- Không có thao tác xóa vĩnh viễn ngoài luồng admin.
- Mọi thay đổi quyền đều có audit log.
- Tìm kiếm trả kết quả trong phạm vi quyền của người dùng.
- Upload và tải xuống ổn định với file trong giới hạn cấu hình.
