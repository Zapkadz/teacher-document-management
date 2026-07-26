# User flows

## 1. Đăng nhập

1. Người dùng mở hệ thống.
2. Chọn `Đăng nhập bằng Google`.
3. Google xác thực tài khoản.
4. Backend nhận email đã xác minh.
5. Backend kiểm tra tài khoản:
   - Không tồn tại: từ chối và hiển thị hướng dẫn liên hệ admin.
   - `SUSPENDED` hoặc `INACTIVE`: từ chối.
   - `ACTIVE`: tạo session và cho truy cập.
6. Ghi audit log đăng nhập.

## 2. Admin thêm tài khoản giáo viên

1. Admin vào `Quản lý người dùng`.
2. Chọn `Thêm người dùng`.
3. Nhập họ tên và Gmail.
4. Chọn trạng thái `ACTIVE`.
5. Chọn global role `USER` hoặc `ADMIN`.
6. Lưu.
7. Hệ thống tạo personal workspace logic cho người dùng.
8. Ghi audit log.

## 3. Giáo viên tạo thư mục trong Kho của tôi

1. Giáo viên mở `Kho của tôi`.
2. Chọn `Tạo thư mục`.
3. Nhập tên.
4. Backend kiểm tra tên hợp lệ và không trùng theo quy tắc cấu hình.
5. Tạo thư mục.
6. Ghi audit log.

## 4. Upload file

1. Người dùng mở thư mục.
2. Chọn `Tải lên`.
3. Chọn một hoặc nhiều file.
4. Frontend kiểm tra sơ bộ định dạng và dung lượng.
5. Backend kiểm tra quyền `UPLOAD`.
6. Backend kiểm tra MIME type, phần mở rộng và dung lượng.
7. Upload object storage.
8. Ghi metadata vào database.
9. Ghi audit log.
10. Hiển thị kết quả từng file; file lỗi không làm hỏng toàn bộ batch.

## 5. Thêm link video

1. Chọn `Thêm liên kết`.
2. Chọn loại Google Drive hoặc YouTube.
3. Nhập tên, URL và mô tả.
4. Backend kiểm tra quyền `UPLOAD`.
5. Validate URL theo domain cho phép.
6. Lưu metadata.
7. Hiển thị cảnh báo về quyền chia sẻ Google Drive.
8. Ghi audit log.

## 6. Cấp quyền thư mục

1. Người quản lý chọn thư mục.
2. Chọn `Phân quyền`.
3. Xem danh sách quyền hiện tại.
4. Chọn `Thêm quyền`.
5. Chọn một hoặc nhiều người dùng.
6. Chọn mẫu quyền hoặc tùy chỉnh.
7. Chọn phạm vi:
   - Chỉ thư mục hiện tại.
   - Thư mục hiện tại và thư mục con.
8. Xác nhận.
9. Backend kiểm tra `MANAGE_PERMISSIONS`.
10. Lưu quyền và người cấp.
11. Xóa cache quyền nếu có.
12. Ghi audit log chi tiết trước/sau.

## 7. Sửa quyền

1. Chọn bản ghi quyền.
2. Chọn `Sửa`.
3. Thay đổi quyền hoặc phạm vi.
4. Backend kiểm tra quyền quản lý.
5. Lưu thay đổi.
6. Ghi audit log.

## 8. Thu hồi quyền

1. Chọn bản ghi quyền.
2. Chọn `Thu hồi`.
3. UI cảnh báo người dùng có thể mất quyền với thư mục con.
4. Xác nhận.
5. Backend xóa hoặc vô hiệu hóa bản ghi ACL.
6. Ghi audit log.

## 9. Tải xuống tài liệu

1. Người dùng chọn `Tải xuống`.
2. Backend kiểm tra `VIEW` và `DOWNLOAD` tại thư mục chứa tài liệu.
3. Nếu hợp lệ, tạo signed URL thời hạn ngắn hoặc stream file.
4. Ghi audit log download.
5. Trả file.

## 10. Xóa tài liệu

1. Người dùng chọn `Xóa`.
2. Backend kiểm tra:
   - Chủ sở hữu và có `DELETE_OWN`; hoặc
   - Có `DELETE_ANY`; hoặc
   - Là admin.
3. Nếu thư mục bị khóa và không phải admin: từ chối.
4. Đặt `deleted_at`, `deleted_by`.
5. Không xóa object ngay.
6. Ghi audit log.

## 11. Khôi phục tài liệu

1. Người có `RESTORE` hoặc admin mở thùng rác.
2. Chọn tài liệu.
3. Nếu thư mục gốc còn tồn tại: khôi phục về vị trí cũ.
4. Nếu thư mục gốc không tồn tại: yêu cầu chọn thư mục đích.
5. Xóa `deleted_at`.
6. Ghi audit log.

## 12. Khóa thư mục

1. Người có `LOCK_FOLDER` chọn thư mục.
2. Chọn `Khóa`.
3. Xác nhận phạm vi khóa:
   - Chỉ thư mục hiện tại.
   - Cả thư mục con.
4. Khi khóa:
   - Vẫn xem/tải theo quyền.
   - Không upload, sửa, di chuyển, xóa.
5. Ghi audit log.

## 13. Sao chép cấu trúc năm học

1. Admin hoặc người được cấp quyền chọn năm nguồn và năm đích.
2. Chọn thư mục nguồn.
3. Chọn tùy chọn:
   - Sao chép cấu trúc.
   - Sao chép quyền.
   - Không sao chép file mặc định.
4. Xem trước kết quả.
5. Xác nhận.
6. Thực hiện transaction theo từng nhánh.
7. Ghi audit log và báo cáo kết quả.
