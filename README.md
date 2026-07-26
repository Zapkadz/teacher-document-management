# Kho hồ sơ giáo dục

Web app nội bộ phục vụ lưu trữ và quản lý tài liệu giáo viên. Repository hiện
hoàn thành **Phase 1**: nền tảng hệ thống, đăng nhập Google theo allowlist,
trạng thái/vai trò người dùng, trang quản trị tài khoản và khởi tạo kho cá nhân.
Cây thư mục, ACL và upload tài liệu thuộc các phase sau, chưa được triển khai.

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

## API Phase 1

- `GET /api/auth/me`: người dùng hiện tại.
- `GET /api/users`: danh sách có tìm kiếm, lọc và phân trang (admin).
- `POST /api/users`: tạo tài khoản cùng kho cá nhân (admin).
- `GET /api/users/:id`: chi tiết tài khoản (admin).
- `PATCH /api/users/:id`: cập nhật họ tên, vai trò hoặc trạng thái (admin).

Mọi endpoint quản trị đều kiểm tra lại session, trạng thái `ACTIVE` và vai trò
`ADMIN` ở backend. Không thể vô hiệu hóa quản trị viên `ACTIVE` cuối cùng.

Muốn dừng container mà vẫn giữ dữ liệu:

```powershell
docker compose down
```

Chỉ dùng `docker compose down --volumes` khi chủ động muốn xóa toàn bộ dữ liệu
local.

## Phạm vi tài liệu

Đặc tả đầy đủ nằm trong `docs/specification`. Thứ tự phase bắt buộc được mô tả
trong `10_IMPLEMENTATION_PLAN.md` và `12_CODEX_MASTER_PROMPT.md`.
