# Bảo mật và yêu cầu phi chức năng

## 1. Authentication

- Google OAuth.
- Chỉ chấp nhận email đã verified từ Google.
- Kiểm tra email allowlist trong database sau mỗi lần đăng nhập.
- Session an toàn, HTTP-only, secure trong production.
- Tài khoản bị khóa phải mất quyền truy cập ngay hoặc trong thời gian session ngắn cấu hình được.

## 2. Authorization

- Backend là nguồn quyết định cuối cùng.
- Frontend chỉ hỗ trợ UX, không phải lớp bảo mật.
- Mọi API đọc/ghi đều kiểm tra quyền.
- Search, tree và breadcrumbs không được làm lộ tên thư mục không có quyền xem.
- Signed download URL chỉ tạo sau khi kiểm tra quyền.

## 3. File security

- Validate extension và MIME type.
- Đổi tên file lưu vật lý; giữ tên gốc trong metadata.
- Chặn path traversal.
- Giới hạn kích thước.
- Bucket private.
- Có thể bổ sung virus scanning sau.
- Không render HTML/SVG nguy hiểm trực tiếp nếu chưa sanitize.

## 4. URL security

Chỉ cho phép:

- `https://drive.google.com/...`
- `https://docs.google.com/...` nếu cần.
- `https://youtube.com/...`
- `https://www.youtube.com/...`
- `https://youtu.be/...`

Không cho `javascript:`, `data:` hoặc domain không nằm trong allowlist.

## 5. Audit

- Append-only.
- Ghi actor, action, entity, thời gian, IP và user agent khi phù hợp.
- Thay đổi quyền phải lưu before/after.
- Download phải ghi log.
- Không ghi token OAuth hoặc dữ liệu bí mật vào log.

## 6. Privacy

- Không cần lưu mật khẩu Google.
- Chỉ lưu dữ liệu hồ sơ cần thiết: email, họ tên, avatar tùy chọn.
- Admin có quyền xem kho cá nhân phải được nêu rõ trong quy định sử dụng nội bộ.

## 7. Performance

Mục tiêu MVP:

- Trang cây thư mục tải trong khoảng 2 giây ở dữ liệu thông thường.
- Danh sách tài liệu có phân trang.
- Tree lazy-load.
- Không tải toàn bộ cây hoặc toàn bộ ACL vào frontend.
- Upload hiển thị progress.

## 8. Reliability

- Database migration có version.
- Backup PostgreSQL hàng ngày.
- Object storage có versioning hoặc backup nếu ngân sách cho phép.
- Không xóa object ngay khi soft delete.
- Có health check.

## 9. Scalability

Thiết kế đủ cho:

- Một trường.
- Hàng trăm tài khoản.
- Hàng chục nghìn tài liệu.
- Cây thư mục nhiều cấp.

Không cần microservice hoặc distributed permission engine.

## 10. Browser support

Ưu tiên:

- Chrome/Edge phiên bản hiện đại trên Windows.
- Safari/Chrome mobile ở mức responsive cơ bản.

## 11. Error handling

- Không trả stack trace cho client trong production.
- Mã lỗi ổn định.
- Log server có correlation/request ID.
- Upload batch trả kết quả từng file.

## 12. Rate limiting

Áp dụng ít nhất cho:

- Auth callback hoặc endpoint nhạy cảm.
- Search.
- Upload init.
- Download URL generation.

## 13. Backup và phục hồi

- Backup database tự động.
- Kiểm tra phục hồi định kỳ.
- Tài liệu phải có chính sách retention rõ ràng.
- Khi giáo viên nghỉ việc, khóa tài khoản, không xóa dữ liệu.
