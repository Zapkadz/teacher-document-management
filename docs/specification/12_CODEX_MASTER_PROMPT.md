# Master prompt cho Codex

Bạn đang xây dựng một web app nội bộ cho trường tiểu học có tên tạm thời là **Kho hồ sơ giáo dục**.

Trước khi code, hãy đọc toàn bộ các tài liệu trong thư mục specification theo thứ tự từ `00_README.md` đến `11_CODE_STANDARDS_AND_GIT_WORKFLOW.md`.

## Mục tiêu

Xây dựng một web app quản lý tài liệu giáo viên gồm:

- Đăng nhập Google.
- Chỉ Gmail được admin cấp mới truy cập được.
- Mỗi giáo viên có Kho của tôi riêng.
- Kho dùng chung dạng cây thư mục nhiều cấp.
- Giáo viên có thể thuộc và được cấp quyền ở nhiều thư mục.
- Phân quyền theo từng thư mục.
- Tách riêng quyền xem và tải xuống.
- Quyền có thể kế thừa xuống thư mục con.
- Giáo viên có thể tạo thư mục con trong kho cá nhân.
- Admin xem được toàn hệ thống.
- Người khác chỉ xem được thư mục/tài liệu khi có quyền.
- Upload Word, Excel, PDF, PowerPoint, hình ảnh và loại file được cấu hình.
- Video chỉ lưu link Google Drive hoặc YouTube.
- Chưa cần ký số hoặc báo cáo.
- Có soft delete, thùng rác, khôi phục và audit log.

## Kiến trúc mặc định

- Next.js full-stack với TypeScript strict.
- PostgreSQL.
- Prisma ORM.
- Google OAuth qua Auth.js hoặc giải pháp tương đương.
- MinIO local, S3-compatible storage production.
- Docker Compose cho môi trường local.
- Modular monolith.

Có thể đề xuất thay đổi nhỏ nếu có lý do kỹ thuật rõ ràng, nhưng không được thay đổi nghiệp vụ cốt lõi.

## Yêu cầu làm việc

1. Không code toàn bộ dự án trong một lần.
2. Bắt đầu bằng việc kiểm tra repository hiện tại.
3. Viết kế hoạch triển khai theo phase.
4. Tạo checklist task rõ ràng.
5. Mỗi phase phải có migration, validation, permission check, test và tài liệu cần thiết.
6. Backend phải kiểm tra quyền; không chỉ ẩn nút ở frontend.
7. Không hard-code email admin.
8. Không dùng public bucket.
9. Không xóa vật lý ngay khi người dùng xóa.
10. Mọi thay đổi quyền, upload, download, delete và restore phải có audit log.
11. Chạy lint, typecheck và test trước khi kết thúc mỗi task.
12. Sau mỗi task, tóm tắt file đã thay đổi, migration, test và rủi ro còn lại.

## Thứ tự triển khai bắt buộc

### Phase 0

- Khởi tạo Next.js + TypeScript.
- Docker Compose PostgreSQL + MinIO.
- Prisma.
- Lint, format, test, typecheck.
- `.env.example`.

### Phase 1

- Google OAuth.
- Gmail allowlist.
- User status/global role.
- Admin user management.
- Personal workspace.

### Phase 2

- Folder tree cá nhân và dùng chung.
- Create/rename/move/soft delete/restore.
- Breadcrumbs.
- Cycle prevention.

### Phase 3

- Permission engine hoàn chỉnh.
- ACL trực tiếp và kế thừa.
- UI phân quyền.
- Guards cho API.

### Phase 4

- Upload/download.
- S3/MinIO.
- File validation.
- Link Google Drive/YouTube.
- Preview cơ bản.

### Phase 5

- Ownership permissions.
- Lock folder.
- Trash and restore.

### Phase 6

- Audit.
- Search có kiểm tra quyền.

### Phase 7

- Academic year.
- Copy folder structure and permissions.

### Phase 8

- Security hardening.
- Responsive UI.
- Backup/deployment docs.

## Nhiệm vụ đầu tiên

Hãy chỉ thực hiện Phase 0.

Trước khi thay đổi code:

1. Kiểm tra repository.
2. Đưa ra plan ngắn.
3. Liệt kê những giả định.
4. Không triển khai Phase 1 trở đi.

Sau khi hoàn thành Phase 0:

- Chạy lint.
- Chạy typecheck.
- Chạy test.
- Kiểm tra Docker Compose.
- Tạo README hướng dẫn chạy local.
- Commit với Conventional Commit.
