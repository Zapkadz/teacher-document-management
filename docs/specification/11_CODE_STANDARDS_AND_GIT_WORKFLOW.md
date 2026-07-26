# Quy chuẩn code và Git workflow

## 1. Nguyên tắc code

- TypeScript strict mode.
- Không dùng `any` nếu không có lý do rõ ràng.
- Validation ở boundary bằng schema validation.
- Không truy cập database trực tiếp từ UI component.
- Không viết permission logic trong component.
- Không lặp enum permission ở nhiều nơi; dùng một source of truth.
- Service phải có tên hành động rõ ràng.
- Function ngắn, một trách nhiệm.
- Tránh over-engineering.

## 2. Cấu trúc thư mục gợi ý

```text
src/
  app/
  components/
  modules/
    auth/
    users/
    folders/
    documents/
    permissions/
    audit/
    trash/
  lib/
    db/
    storage/
    validation/
    errors/
  tests/
prisma/
  schema.prisma
  migrations/
  seed.ts
```

## 3. Error handling

Dùng error class hoặc error code chuẩn:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `FILE_TOO_LARGE`
- `FILE_TYPE_NOT_ALLOWED`
- `FOLDER_LOCKED`
- `INVALID_MOVE`

Không phụ thuộc vào chuỗi message để xử lý logic frontend.

## 4. Database

- Dùng migration, không chỉnh database thủ công.
- Soft delete phải được xử lý thống nhất trong query helper.
- Dùng transaction cho thao tác nhiều bước.
- Tránh N+1 query.
- Index cho foreign key và field tìm kiếm.

## 5. Security checklist trong code review

- Endpoint đã kiểm tra auth chưa?
- Đã kiểm tra permission ở backend chưa?
- Có làm lộ folder/document không có quyền không?
- Có validate file và URL không?
- Có audit log không?
- Có transaction không?
- Có chống folder cycle không?
- Có test unauthorized path không?

## 6. Testing

### Unit test

- Permission merge.
- Permission inheritance.
- File validation.
- URL validation.
- Folder cycle detection.

### Integration test

- API với database test.
- ACL enforcement.
- Soft delete/restore.
- Upload metadata flow.

### E2E

- Login.
- Admin tạo user.
- Giáo viên upload.
- Admin cấp quyền.
- Người khác xem/tải theo quyền.

## 7. Git branches

Đề xuất trunk-based nhẹ:

- `main`: luôn có thể deploy.
- Nhánh task: `feat/...`, `fix/...`, `chore/...`.
- Pull request nhỏ, review được.

Ví dụ:

- `feat/google-auth`
- `feat/folder-permissions`
- `fix/prevent-folder-cycle`

## 8. Commit convention

Dùng Conventional Commits:

- `feat: add Google allowlist login`
- `fix: block download without permission`
- `refactor: centralize permission evaluation`
- `test: add inherited ACL cases`
- `docs: update upload flow`
- `chore: configure docker compose`

## 9. Quy trình một task

1. Đọc tài liệu liên quan.
2. Viết plan ngắn.
3. Xác định schema/API/permission bị ảnh hưởng.
4. Viết hoặc cập nhật test.
5. Code.
6. Chạy lint/typecheck/test.
7. Tự review security checklist.
8. Cập nhật docs.
9. Commit.
10. Tạo PR hoặc merge theo quy trình dự án.

## 10. Không được làm

- Không bypass permission tạm thời rồi quên.
- Không hard-code email admin trong source code.
- Không public object storage bucket.
- Không xóa file vật lý ngay khi người dùng nhấn xóa.
- Không tin MIME type từ client.
- Không lưu OAuth token không cần thiết.
