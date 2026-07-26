# Kho hồ sơ giáo dục

Web app nội bộ phục vụ lưu trữ và quản lý tài liệu giáo viên. Repository hiện
hoàn thành **Phase 4**: nền tảng hệ thống, đăng nhập Google theo allowlist,
quản trị người dùng, kho cá nhân và cây thư mục cá nhân/dùng chung với lazy
loading, breadcrumbs, di chuyển, chống cycle, xóa mềm, khôi phục và permission
engine có ACL trực tiếp/kế thừa cho người dùng hoặc nhóm. Hệ thống đã hỗ trợ
upload file trực tiếp vào MinIO/S3, version 1, danh sách tài liệu, preview PDF/ảnh,
download có kiểm tra quyền và liên kết Google Drive/YouTube.

## Yêu cầu

- Node.js 22
- npm
- Docker Desktop có Docker Compose

## Chạy local

1. Tạo file môi trường local:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Điền các biến `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
   `INITIAL_ADMIN_EMAIL` và `INITIAL_ADMIN_NAME` trong `.env`. Tạo OAuth Web
   Client trong Google Cloud Console với callback:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

   Có thể đổi giới hạn file bằng `MAX_FILE_SIZE_MB` và allowlist extension bằng
   `ALLOWED_FILE_EXTENSIONS`. Nếu endpoint S3 mà server truy cập khác URL trình
   duyệt dùng để upload/download, cấu hình thêm `S3_PUBLIC_ENDPOINT`.

3. Cài dependency:

   ```powershell
   npm install
   ```

4. Khởi động PostgreSQL và MinIO:

   ```powershell
   docker compose up -d
   ```

5. Áp dụng migration và tạo quản trị viên ban đầu:

   ```powershell
   npm run db:deploy
   npm run db:seed
   ```

6. Khởi động ứng dụng:

   ```powershell
   npm run dev
   ```

Ứng dụng chạy tại [http://localhost:3000](http://localhost:3000). Health check
ở [http://localhost:3000/api/health](http://localhost:3000/api/health). MinIO
Console ở [http://localhost:9001](http://localhost:9001).

Email Google đăng nhập phải trùng với email đã seed hoặc được admin thêm tại
`/admin/users`, có trạng thái `ACTIVE`, và được Google xác minh. Hệ thống không
tự tạo người dùng từ OAuth.

`npm run db:seed` cũng tạo root `Kho dùng chung`. Admin có thể mở nút `Phân quyền`
trên thư mục để cấp quyền truy cập kho dùng chung cho người dùng `ACTIVE`. Chủ
kho cá nhân quản lý nội dung của mình nhưng không mặc định có quyền chia sẻ.
Giới hạn độ sâu cây được cấu hình qua `MAX_FOLDER_DEPTH` (mặc định 20).

Các tài khoản và mật khẩu trong `.env.example` chỉ dành cho local development.
Phải thay bằng secret riêng khi triển khai. Bucket MinIO được tạo ở chế độ
private bởi service `minio-init`.

## Các lệnh chính

| Lệnh                                  | Mục đích                                |
| ------------------------------------- | --------------------------------------- |
| `npm run dev`                         | Chạy development server                 |
| `npm run build`                       | Tạo production build                    |
| `npm run lint`                        | Kiểm tra ESLint                         |
| `npm run format`                      | Format source bằng Prettier             |
| `npm run format:check`                | Kiểm tra format                         |
| `npm run typecheck`                   | Sinh route types và kiểm tra TypeScript |
| `npm run test`                        | Chạy unit test một lần                  |
| `npm run test:watch`                  | Chạy test ở watch mode                  |
| `npm run audit:prod`                  | Audit dependency production mức cao     |
| `npm run db:generate`                 | Sinh Prisma Client                      |
| `npm run db:validate`                 | Kiểm tra Prisma schema                  |
| `npm run db:migrate -- --name <name>` | Tạo migration khi phát triển            |
| `npm run db:deploy`                   | Áp dụng migration đã commit             |
| `npm run db:seed`                     | Tạo/cập nhật quản trị viên ban đầu      |

## Kiểm tra trước khi commit

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
docker compose config --quiet
```

## Hạ tầng local

- PostgreSQL 17 lưu dữ liệu trong named volume `postgres_data`.
- MinIO dùng bucket private `teacher-documents` và named volume `minio_data`.
- Prisma 7 dùng PostgreSQL driver adapter và generated client không được commit.
- Migration baseline Phase 0 bật extension PostgreSQL `pgcrypto`.
- Migration Phase 1 tạo users, Auth.js accounts/sessions, personal workspaces,
  root folders và audit logs.
- Migration Phase 2 bổ sung deletion batch cùng các constraint/index bảo vệ
  topology, ownership và tên thư mục đang hoạt động.
- Migration Phase 3 tạo ACL thư mục, nhóm, thành viên nhóm cùng các constraint
  bảo đảm mỗi grant chỉ trỏ tới đúng một principal.
- Migration Phase 4 tạo documents, document versions và upload sessions dùng một
  lần. Constraint database bảo đảm metadata file/link nhất quán.

## API Phase 1

- `GET /api/auth/me`: người dùng hiện tại.
- `GET /api/users`: danh sách có tìm kiếm, lọc và phân trang (admin).
- `POST /api/users`: tạo tài khoản cùng kho cá nhân (admin).
- `GET /api/users/:id`: chi tiết tài khoản (admin).
- `PATCH /api/users/:id`: cập nhật họ tên, vai trò hoặc trạng thái (admin).

Mọi endpoint quản trị đều kiểm tra lại session, trạng thái `ACTIVE` và vai trò
`ADMIN` ở backend. Không thể vô hiệu hóa quản trị viên `ACTIVE` cuối cùng.

## API Phase 2

- `GET /api/folders/tree`: tải root hoặc một cấp con; hỗ trợ personal/shared và
  danh sách nhánh đã xóa.
- `GET /api/folders/:id`: metadata, breadcrumbs và capability.
- `POST /api/folders`: tạo thư mục con.
- `PATCH /api/folders/:id`: đổi tên.
- `POST /api/folders/:id/move`: di chuyển có kiểm tra cycle và độ sâu.
- `DELETE /api/folders/:id`: xóa mềm toàn nhánh trong transaction.
- `POST /api/folders/:id/restore`: khôi phục đúng nhánh của cùng đợt xóa.

Root hệ thống không thể đổi tên, di chuyển hoặc xóa. Backend trả `403` khi người
dùng truy cập trực tiếp kho cá nhân của người khác. Integration tests dùng
PostgreSQL được bật bằng `RUN_DATABASE_TESTS=true`; CI luôn chạy bộ test này.

## API Phase 3

- `GET /api/folders/:id/permissions`: quyền trực tiếp, kế thừa và principal có
  thể được cấp quyền.
- `POST /api/folders/:id/permissions`: cấp quyền cho một hoặc nhiều user/group.
- `PATCH /api/folders/:id/permissions/:permissionId`: sửa quyền trực tiếp.
- `DELETE /api/folders/:id/permissions/:permissionId`: thu hồi quyền trực tiếp.
- `POST /api/folders/:id/inheritance`: bật hoặc tắt kế thừa từ thư mục cha.

Backend hợp nhất quyền direct, inherited và group theo phép OR, không có deny.
`inheritPermissions=false` tạo ranh giới chặn quyền ở các cấp cao hơn. Admin
bypass toàn bộ permission guard; người dùng thường chỉ nhìn thấy folder và
breadcrumb có quyền `VIEW`. Mọi thay đổi ACL/kế thừa đều được ghi audit log.

## API Phase 4

- `GET /api/folders/:id/documents`: danh sách tài liệu có phân trang.
- `POST /api/documents/upload-init`: validate file, kiểm tra `UPLOAD` và tạo
  pre-signed PUT URL có hạn 15 phút.
- `POST /api/documents/upload-complete`: đối chiếu object bằng HEAD rồi tạo
  document cùng version 1.
- `POST /api/documents/link`: lưu link Google Drive hoặc YouTube thuộc allowlist.
- `GET /api/documents/:id`: metadata tài liệu.
- `GET /api/documents/:id/download`: yêu cầu `VIEW` + `DOWNLOAD`, ghi audit và
  trả pre-signed URL có hạn 5 phút.
- `GET /api/documents/:id/preview`: yêu cầu `VIEW` + `PREVIEW`; chỉ PDF và ảnh an
  toàn được mở inline.

Object key luôn dùng UUID theo workspace/folder/document/version, không dùng tên
file làm định danh. Bucket không public. Backend kiểm tra extension, MIME, dung
lượng và marker upload trước khi ghi database. Sửa, di chuyển, xóa và restore tài
liệu vẫn thuộc Phase 5.

Muốn dừng container mà vẫn giữ dữ liệu:

```powershell
docker compose down
```

Chỉ dùng `docker compose down --volumes` khi chủ động muốn xóa toàn bộ dữ liệu
local.

## Phạm vi tài liệu

Đặc tả đầy đủ nằm trong `docs/specification`. Thứ tự phase bắt buộc được mô tả
trong `10_IMPLEMENTATION_PLAN.md` và `12_CODEX_MASTER_PROMPT.md`.
