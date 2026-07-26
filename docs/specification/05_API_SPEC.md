# API specification

## 1. Quy ước

- Base path: `/api`.
- JSON cho metadata.
- Upload file dùng multipart hoặc pre-signed upload flow.
- Mọi endpoint private yêu cầu session hợp lệ.
- Backend luôn kiểm tra permission.
- Phân trang cursor hoặc page/limit, thống nhất toàn dự án.
- Response lỗi chuẩn:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Bạn không có quyền thực hiện thao tác này",
    "details": null
  }
}
```

## 2. Auth

### `GET /api/auth/me`

Trả thông tin người dùng hiện tại.

### `POST /api/auth/logout`

Đăng xuất.

Google OAuth dùng route do thư viện auth cung cấp.

## 3. Users

### `GET /api/users`

Quyền: admin hoặc người có quyền quản lý phù hợp nếu sau này giới hạn danh sách.

Query:

- `search`
- `status`
- `role`
- `page`
- `limit`

### `POST /api/users`

Admin thêm tài khoản.

```json
{
  "email": "teacher@example.com",
  "fullName": "Nguyễn Thị A",
  "globalRole": "USER",
  "status": "ACTIVE"
}
```

### `PATCH /api/users/:id`

Sửa thông tin, trạng thái hoặc global role.

### `GET /api/users/:id`

Chi tiết tài khoản.

## 4. Academic years

- `GET /api/academic-years`
- `POST /api/academic-years`
- `PATCH /api/academic-years/:id`
- `POST /api/academic-years/:id/activate`

## 5. Folders

### `GET /api/folders/tree`

Query:

- `workspace=personal|shared`
- `academicYearId`
- `rootId`

Chỉ trả node người dùng có quyền `VIEW`.

### `GET /api/folders/:id`

Trả metadata, quyền hiệu lực và breadcrumbs.

### `POST /api/folders`

```json
{
  "name": "Kế hoạch bài dạy",
  "parentId": "uuid",
  "workspaceType": "SHARED",
  "academicYearId": "uuid"
}
```

Quyền: `CREATE_SUBFOLDER` trên parent hoặc admin.

### `PATCH /api/folders/:id`

Đổi tên hoặc metadata.

### `POST /api/folders/:id/move`

```json
{
  "targetParentId": "uuid"
}
```

### `POST /api/folders/:id/copy`

```json
{
  "targetParentId": "uuid",
  "copyPermissions": true,
  "copyDocuments": false
}
```

### `POST /api/folders/:id/lock`

```json
{
  "locked": true,
  "applyToDescendants": true
}
```

### `DELETE /api/folders/:id`

Soft delete.

### `POST /api/folders/:id/restore`

Khôi phục.

## 6. Documents

### `GET /api/folders/:folderId/documents`

Query:

- `search`
- `kind`
- `ownerUserId`
- `sort`
- `page`
- `limit`

### `POST /api/documents/upload-init`

Khởi tạo upload và trả signed URL nếu dùng direct-to-storage.

```json
{
  "folderId": "uuid",
  "fileName": "giao-an.docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "sizeBytes": 123456
}
```

### `POST /api/documents/upload-complete`

```json
{
  "folderId": "uuid",
  "title": "Giáo án tuần 1",
  "description": "",
  "storageKey": "...",
  "mimeType": "...",
  "sizeBytes": 123456
}
```

Backend phải xác minh object đã tồn tại và metadata khớp.

### `POST /api/documents/link`

```json
{
  "folderId": "uuid",
  "title": "Video bài giảng Toán",
  "description": "",
  "kind": "YOUTUBE_LINK",
  "externalUrl": "https://www.youtube.com/watch?v=..."
}
```

### `GET /api/documents/:id`

Metadata và quyền hiệu lực.

### `PATCH /api/documents/:id`

Sửa title/description theo quyền.

### `POST /api/documents/:id/new-version`

Upload phiên bản mới.

### `POST /api/documents/:id/move`

```json
{
  "targetFolderId": "uuid"
}
```

### `GET /api/documents/:id/download`

Kiểm tra `VIEW` + `DOWNLOAD`, sau đó trả signed URL hoặc stream.

### `GET /api/documents/:id/preview`

Kiểm tra `VIEW` + `PREVIEW`.

### `DELETE /api/documents/:id`

Soft delete.

### `POST /api/documents/:id/restore`

Khôi phục.

## 7. Permissions

### `GET /api/folders/:folderId/permissions`

Trả:

- Quyền trực tiếp.
- Quyền kế thừa.
- Nguồn quyền.

### `POST /api/folders/:folderId/permissions`

```json
{
  "principalType": "USER",
  "principalIds": ["uuid-1", "uuid-2"],
  "permissions": ["VIEW", "PREVIEW", "DOWNLOAD", "UPLOAD"],
  "appliesToDescendants": true
}
```

### `PATCH /api/folders/:folderId/permissions/:permissionId`

Sửa bộ quyền.

### `DELETE /api/folders/:folderId/permissions/:permissionId`

Thu hồi.

### `POST /api/folders/:folderId/inheritance`

```json
{
  "inheritPermissions": false
}
```

## 8. Groups

- `GET /api/groups`
- `POST /api/groups`
- `PATCH /api/groups/:id`
- `DELETE /api/groups/:id`
- `POST /api/groups/:id/members`
- `DELETE /api/groups/:id/members/:userId`

Nếu MVP cần rút gọn, có thể hoãn UI nhóm nhưng giữ schema.

## 9. Trash

### `GET /api/trash`

Query theo workspace, loại entity, người xóa, ngày xóa.

### `POST /api/trash/restore`

```json
{
  "items": [
    {"entityType": "DOCUMENT", "entityId": "uuid"}
  ]
}
```

### `DELETE /api/trash/purge`

Chỉ admin.

## 10. Audit

### `GET /api/audit-logs`

Query:

- `folderId`
- `actorUserId`
- `action`
- `entityType`
- `from`
- `to`
- `page`
- `limit`

Quyền: admin hoặc `VIEW_AUDIT` trong phạm vi.

## 11. Search

### `GET /api/search`

Query:

- `q`
- `type=document|folder|all`
- `academicYearId`
- `fileType`
- `ownerUserId`

Backend chỉ tìm trong tập dữ liệu có quyền `VIEW`.

## 12. Settings

- `GET /api/settings/public`
- `GET /api/settings/admin`
- `PATCH /api/settings/admin`

Chỉ admin được sửa cấu hình.
