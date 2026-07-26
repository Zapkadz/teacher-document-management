# Kiến trúc hệ thống

## 1. Kiến trúc đề xuất

Dùng modular monolith để giảm độ phức tạp triển khai:

```text
Browser
   |
Next.js application
   |-- UI
   |-- Server actions/API routes hoặc service layer
   |-- Auth
   |-- Permission engine
   |-- Audit service
   |
PostgreSQL ------- Object Storage
```

Không cần microservices ở giai đoạn đầu.

## 2. Module nghiệp vụ

- `auth`
- `users`
- `academic-years`
- `folders`
- `documents`
- `permissions`
- `groups`
- `audit`
- `trash`
- `settings`
- `search`

Mỗi module nên tách:

- schema/types.
- validation.
- service.
- repository/query.
- permission policy.
- API/controller.
- tests.

## 3. Permission engine

Hàm trung tâm:

```ts
getEffectivePermissions(userId, folderId): Promise<PermissionSet>
```

Yêu cầu:

- Admin short-circuit toàn quyền.
- Đọc quyền trực tiếp.
- Duyệt ancestor đến khi gặp `inherit_permissions = false`.
- Hợp nhất quyền user và group.
- Cache ngắn hạn nếu cần.
- Invalidate cache khi ACL, group membership hoặc folder inheritance thay đổi.

Không phân tán logic quyền vào nhiều component.

## 4. File storage

### Local development

- MinIO bằng Docker Compose.

### Production

- S3-compatible object storage.
- Bucket private.
- Không public URL trực tiếp.
- Download qua signed URL thời hạn ngắn hoặc backend stream.

Quy tắc storage key:

```text
school/{workspace}/{folder-id}/{document-id}/{version-id}/{safe-filename}
```

Không dùng tên file người dùng làm key duy nhất.

## 5. Upload flow

Khuyến nghị direct-to-storage:

1. Client xin upload URL.
2. Backend validate quyền, loại file và kích thước.
3. Backend tạo signed upload URL.
4. Client upload trực tiếp lên object storage.
5. Client gọi complete endpoint.
6. Backend xác minh object và tạo database record.

Với MVP đơn giản có thể upload qua server, nhưng direct upload tốt hơn khi file lớn.

## 6. Preview

- PDF và ảnh: preview trực tiếp.
- Video link: embed nếu nguồn cho phép.
- Office documents: có thể dùng trình xem online hoặc chỉ hiển thị icon và nút download trong MVP.
- Không gửi file private sang dịch vụ preview bên thứ ba nếu chưa được trường chấp thuận.

## 7. Search

MVP:

- PostgreSQL search theo title, description, owner và loại.
- Lọc permission sau hoặc trước truy vấn bằng accessible folder IDs.

Không tìm nội dung bên trong file trong MVP.

## 8. Soft delete

- `deleted_at` và `deleted_by` trên folder/document.
- Query mặc định loại bỏ record đã xóa.
- Job định kỳ dọn object quá thời gian retention, nhưng chỉ khi admin cấu hình.
- Audit log không bị xóa theo entity.

## 9. Transaction

Bắt buộc transaction cho:

- Tạo personal workspace cùng user.
- Di chuyển cây thư mục.
- Sao chép cấu trúc và quyền.
- Xóa/khôi phục cây thư mục.
- Thay đổi ACL hàng loạt.

## 10. Background jobs

MVP có thể dùng cron/job runner đơn giản cho:

- Dọn thùng rác quá hạn.
- Kiểm tra upload dở dang.
- Tạo thumbnail nếu triển khai.
- Sao chép cây lớn.

Nếu chưa cần queue chuyên dụng, viết interface để có thể thay thế sau.

## 11. Deployment local

Docker Compose gồm:

- app.
- postgres.
- minio.

Tạo `.env.example` và script:

- `dev`
- `db:migrate`
- `db:seed`
- `test`
- `lint`
- `typecheck`

## 12. Deployment production

- Reverse proxy HTTPS.
- PostgreSQL managed hoặc server riêng có backup.
- Object storage private.
- OAuth redirect URI đúng domain.
- Backup DB hàng ngày.
- Theo dõi dung lượng storage.
