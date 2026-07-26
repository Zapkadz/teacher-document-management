# Decisions and assumptions

## Đã chốt

1. Làm web app, không làm desktop app.
2. Trường tiểu học, một hệ thống nội bộ.
3. Hệ thống chỉ tập trung vào Hồ sơ giáo dục.
4. Đăng nhập bằng Gmail/Google.
5. Gmail phải được admin cấp trước.
6. Mỗi giáo viên có kho cá nhân riêng.
7. Giáo viên tự tạo thư mục trong kho cá nhân.
8. Một giáo viên có thể có quyền ở nhiều thư mục.
9. Quyền xem và tải xuống tách riêng.
10. Admin xem được toàn bộ.
11. Người khác chỉ xem được nếu được cấp quyền.
12. Video chỉ lưu link Google Drive hoặc YouTube.
13. Chưa cần ký số.
14. Chưa cần báo cáo.
15. Có phân quyền hộp tài liệu theo người và theo thư mục.

## Mặc định kỹ thuật đề xuất

1. Personal root được hệ thống tạo logic khi tài khoản được kích hoạt; giáo viên tự tạo thư mục bên trong.
2. File tối đa 100 MB, admin có thể đổi.
3. Thùng rác giữ 30 ngày.
4. Permission kế thừa mặc định bật.
5. Không có deny rule trong MVP.
6. Không tìm kiếm nội dung bên trong file trong MVP.
7. PDF và ảnh preview trực tiếp; Office file có thể chỉ download trong MVP.
8. Có ít nhất hai admin khi triển khai thật.
9. Không sao chép file khi copy cấu trúc năm học nếu người dùng không chọn rõ.
10. Nhóm người dùng có schema sẵn; UI nhóm có thể hoãn nếu cần rút gọn MVP.

## Cần xác nhận trước production

1. Tên chính thức của hệ thống.
2. Domain triển khai.
3. Gmail cá nhân hay Google Workspace của trường.
4. Danh sách định dạng file cho phép.
5. Dung lượng dự kiến.
6. Nơi đặt server và object storage.
7. Chính sách backup của trường.
8. Người chịu trách nhiệm admin.
9. Có cần import danh sách giáo viên từ Excel ngay MVP hay không.
