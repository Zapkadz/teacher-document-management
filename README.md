# Kho hồ sơ giáo dục

Web app nội bộ phục vụ lưu trữ và quản lý tài liệu giáo viên. Repository hiện
chỉ hoàn thành **Phase 0**: nền Next.js, PostgreSQL, Prisma, MinIO, kiểm thử và
CI. Authentication, người dùng, thư mục, phân quyền và tài liệu chưa được triển
khai.

## Yêu cầu

- Node.js 22
- npm
- Docker Desktop có Docker Compose

## Chạy local

1. Tạo file môi trường local:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Cài dependency:

   ```powershell
   npm install
   ```

3. Khởi động PostgreSQL và MinIO:

   ```powershell
   docker compose up -d
   ```

4. Áp dụng migration:

   ```powershell
   npm run db:deploy
   ```

5. Khởi động ứng dụng:

   ```powershell
   npm run dev
   ```

Ứng dụng chạy tại [http://localhost:3000](http://localhost:3000). Health check
ở [http://localhost:3000/api/health](http://localhost:3000/api/health). MinIO
Console ở [http://localhost:9001](http://localhost:9001).

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
- Migration baseline Phase 0 bật extension PostgreSQL `pgcrypto`; chưa có bảng
  nghiệp vụ.

Muốn dừng container mà vẫn giữ dữ liệu:

```powershell
docker compose down
```

Chỉ dùng `docker compose down --volumes` khi chủ động muốn xóa toàn bộ dữ liệu
local.

## Phạm vi tài liệu

Đặc tả đầy đủ nằm trong `docs/specification`. Thứ tự phase bắt buộc được mô tả
trong `10_IMPLEMENTATION_PLAN.md` và `12_CODEX_MASTER_PROMPT.md`.
