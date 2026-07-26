# Bộ tài liệu dự án: Hệ thống Kho hồ sơ giáo dục nội bộ

## 1. Mục tiêu

Xây dựng một web app nội bộ cho trường tiểu học, phục vụ việc lưu trữ, tổ chức, chia sẻ và phân quyền tài liệu giáo viên theo mô hình cây thư mục nhiều cấp.

Hệ thống tập trung vào một chức năng chính: **Hồ sơ giáo dục**.

Các loại nội dung chính:

- Word, Excel, PDF, PowerPoint, hình ảnh và các tệp tài liệu được cấu hình cho phép.
- Liên kết video Google Drive hoặc YouTube.
- Cây thư mục dùng chung nhiều cấp.
- Kho cá nhân riêng cho từng giáo viên.
- Phân quyền chi tiết theo từng thư mục.

## 2. Đối tượng sử dụng

- **Admin**: quản trị toàn hệ thống.
- **Người quản lý thư mục**: được cấp quyền quản lý trên một hoặc nhiều thư mục cụ thể.
- **Giáo viên**: sử dụng kho cá nhân và các thư mục dùng chung được cấp quyền.

Một người dùng có thể có quyền khác nhau tại từng thư mục. Không gắn cứng chức danh tổ trưởng hoặc ban giám hiệu vào tài khoản.

## 3. Đăng nhập

- Đăng nhập bằng Google.
- Chỉ Gmail nằm trong danh sách cho phép mới được truy cập.
- Không cho phép tự đăng ký.
- Admin có thể kích hoạt, khóa hoặc vô hiệu hóa tài khoản.

## 4. Phạm vi MVP

MVP bao gồm:

1. Đăng nhập Google và Gmail allowlist.
2. Kho cá nhân của giáo viên.
3. Kho dùng chung dạng cây thư mục nhiều cấp.
4. Upload và quản lý tài liệu.
5. Thêm liên kết Google Drive hoặc YouTube.
6. Phân quyền theo thư mục, có kế thừa quyền.
7. Tách quyền xem và tải xuống.
8. Soft delete, thùng rác và khôi phục.
9. Nhật ký hoạt động.
10. Tìm kiếm và lọc tài liệu.
11. Khóa/mở khóa thư mục.
12. Sao chép cấu trúc thư mục và quyền giữa các năm học.

## 5. Ngoài phạm vi MVP

- Ký số.
- Báo cáo hồ sơ.
- Quản lý học sinh, điểm số, lịch dạy, tài chính.
- Upload video trực tiếp.
- Phê duyệt nhiều cấp.
- Ứng dụng mobile native.

## 6. Công nghệ đề xuất

Kiến trúc monolith full-stack để dễ phát triển và vận hành:

- Next.js + TypeScript.
- PostgreSQL.
- Prisma ORM.
- Auth.js hoặc giải pháp Google OAuth tương đương.
- S3-compatible storage: MinIO khi phát triển local, S3/Cloudflare R2/MinIO server khi triển khai.
- UI: Tailwind CSS + component library có khả năng truy cập tốt.
- Testing: unit, integration và end-to-end.

Không khóa cứng phiên bản thư viện trong tài liệu này. Khi bắt đầu dự án, dùng bản ổn định hiện hành và ghi lại trong `package.json`.

## 7. Thứ tự đọc tài liệu

1. `01_PRD.md`
2. `02_ROLES_AND_PERMISSIONS.md`
3. `03_USER_FLOWS.md`
4. `04_DATA_MODEL.md`
5. `05_API_SPEC.md`
6. `06_UI_UX_SPEC.md`
7. `07_ARCHITECTURE.md`
8. `08_SECURITY_AND_NON_FUNCTIONAL.md`
9. `09_ACCEPTANCE_CRITERIA.md`
10. `10_IMPLEMENTATION_PLAN.md`
11. `11_CODE_STANDARDS_AND_GIT_WORKFLOW.md`
12. `12_CODEX_MASTER_PROMPT.md`

## 8. Nguyên tắc cốt lõi

- Quyền được kiểm tra ở backend, không chỉ ẩn nút trên frontend.
- Không cho xóa vĩnh viễn trực tiếp.
- Không cho sửa hoặc xóa tài liệu của người khác nếu không có quyền quản lý tương ứng.
- Mọi thao tác quan trọng phải ghi audit log.
- Quyền thư mục có thể kế thừa xuống thư mục con.
- Admin có toàn quyền xem và quản trị toàn hệ thống.
- Video chỉ lưu metadata và đường dẫn, không lưu file video trên server.
