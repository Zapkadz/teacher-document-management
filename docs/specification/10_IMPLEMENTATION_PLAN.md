# Kế hoạch triển khai

## Phase 0 — Khởi tạo dự án

- Tạo repository.
- Khởi tạo Next.js + TypeScript.
- Docker Compose cho PostgreSQL và MinIO.
- Thiết lập Prisma.
- Thiết lập lint, format, typecheck và test.
- Tạo `.env.example`.
- Tạo CI cơ bản.

Deliverable:

- App chạy local.
- DB migration đầu tiên.
- Health check.

## Phase 1 — Authentication và users

- Google OAuth.
- Gmail allowlist.
- User status và global role.
- Admin user management.
- Personal workspace creation.
- Auth middleware.

Tests:

- Allowed email login.
- Unknown email rejected.
- Suspended user rejected.

## Phase 2 — Folder tree

- Shared tree và personal tree.
- Create/rename/move/soft delete/restore folder.
- Breadcrumbs.
- Lazy loading.
- Cycle prevention.
- Folder lock fields.

Tests:

- Move folder.
- Prevent moving into descendant.
- Personal isolation.

## Phase 3 — Permission engine

- ACL schema.
- Effective permission calculation.
- Inheritance.
- Group support hoặc tối thiểu user ACL.
- Permission management UI.
- Permission guards.

Tests:

- Direct permission.
- Inherited permission.
- Inheritance disabled.
- Admin bypass.
- Unauthorized API access.

Không làm upload trước khi permission engine đủ ổn định.

## Phase 4 — Document storage

- Upload init/complete.
- File validation.
- Metadata.
- List documents.
- Download signed URL.
- Preview PDF/image.
- Link Google Drive/YouTube.

Tests:

- Valid upload.
- Invalid type.
- Oversized file.
- Download permission.

## Phase 5 — Ownership, edit, move và delete

- `EDIT_OWN`, `DELETE_OWN`, `MOVE_OWN`.
- `EDIT_ANY`, `DELETE_ANY`, `MOVE_ANY`.
- Soft delete.
- Trash and restore.
- Folder lock enforcement.

## Phase 6 — Audit và search

- Audit middleware/service.
- Audit UI.
- Search theo metadata.
- Permission-aware search.

## Phase 7 — Academic year và copy structure

- Quản lý năm học.
- Sao chép cấu trúc.
- Sao chép ACL.
- Preview trước khi copy.
- Job hoặc transaction an toàn.

## Phase 8 — Hardening

- Security review.
- Rate limiting.
- Error handling.
- Performance test.
- Responsive UI.
- Backup guide.
- Seed/demo data.
- User manual ngắn.

## Definition of Done cho mỗi task

- Có migration nếu thay schema.
- Có validation.
- Có permission check backend.
- Có audit nếu là thao tác quan trọng.
- Có unit/integration test phù hợp.
- `lint`, `typecheck`, `test` pass.
- Cập nhật tài liệu khi thay đổi hành vi.
- Commit rõ ràng.
