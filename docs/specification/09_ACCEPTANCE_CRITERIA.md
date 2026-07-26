# Acceptance criteria

## Epic 1 — Đăng nhập Google

### AC-1.1

Given Gmail đã được admin thêm và đang ACTIVE
When người dùng đăng nhập Google
Then hệ thống cho truy cập và tạo session.

### AC-1.2

Given Gmail chưa được cấp quyền
When đăng nhập
Then hệ thống từ chối và không tự tạo tài khoản.

### AC-1.3

Given tài khoản bị SUSPENDED
When đăng nhập
Then hệ thống từ chối truy cập.

## Epic 2 — Kho cá nhân

### AC-2.1

Given giáo viên đã đăng nhập
When mở Kho của tôi
Then chỉ thấy nội dung kho cá nhân của mình, trừ admin.

### AC-2.2

When giáo viên tạo thư mục con hợp lệ
Then thư mục được tạo trong đúng vị trí.

### AC-2.3

When giáo viên cố truy cập kho cá nhân của người khác bằng URL trực tiếp
Then backend trả 403, trừ khi có ACL hoặc là admin.

## Epic 3 — Cây thư mục dùng chung

### AC-3.1

Given người dùng không có `VIEW`
Then thư mục không xuất hiện trong tree và API không trả metadata.

### AC-3.2

Given người dùng có quyền kế thừa từ thư mục cha
Then người dùng truy cập được thư mục con khi inheritance đang bật.

### AC-3.3

When tắt inheritance tại thư mục con
Then quyền từ cha không còn hiệu lực tại thư mục con.

## Epic 4 — Upload

### AC-4.1

Given người dùng có `UPLOAD`
When tải file hợp lệ trong giới hạn
Then file được lưu và xuất hiện trong danh sách.

### AC-4.2

Given người dùng không có `UPLOAD`
When gọi API upload trực tiếp
Then trả 403.

### AC-4.3

Given file không thuộc loại cho phép hoặc quá lớn
Then upload bị từ chối với thông báo rõ ràng.

## Epic 5 — Xem và tải xuống

### AC-5.1

Given có `VIEW` nhưng không có `DOWNLOAD`
Then người dùng xem metadata/preview nếu có nhưng không tải file được.

### AC-5.2

Given có `VIEW` và `DOWNLOAD`
Then người dùng tải file được và có audit log.

### AC-5.3

Given không có `VIEW`
Then cả preview và download đều bị từ chối.

## Epic 6 — Quyền sở hữu

### AC-6.1

Given giáo viên có `EDIT_OWN`
Then chỉ sửa được tài liệu do mình tạo.

### AC-6.2

Given giáo viên không có `EDIT_ANY`
When sửa tài liệu người khác
Then trả 403.

### AC-6.3

Given người quản lý có `EDIT_ANY`
Then sửa được metadata tài liệu trong phạm vi.

## Epic 7 — Xóa và thùng rác

### AC-7.1

When tài liệu bị xóa
Then tài liệu không còn trong danh sách thường nhưng vẫn tồn tại trong thùng rác.

### AC-7.2

Given người dùng không có quyền xóa
When gọi API delete
Then trả 403.

### AC-7.3

Given người có `RESTORE`
When khôi phục
Then tài liệu trở lại thư mục gốc hoặc thư mục đích được chọn.

### AC-7.4

Only admin can purge permanently in MVP.

## Epic 8 — Phân quyền

### AC-8.1

Given người quản lý có `MANAGE_PERMISSIONS`
When cấp quyền cho nhiều người
Then mỗi người nhận quyền đúng và audit log được tạo.

### AC-8.2

Given người dùng không có `MANAGE_PERMISSIONS`
When gọi API phân quyền
Then trả 403.

### AC-8.3

UI phải hiển thị quyền trực tiếp và quyền kế thừa khác nhau.

## Epic 9 — Khóa thư mục

### AC-9.1

Given thư mục bị khóa
Then người dùng thường vẫn xem/tải theo quyền nhưng không upload, sửa, di chuyển hoặc xóa.

### AC-9.2

Admin có thể mở khóa.

## Epic 10 — Link video

### AC-10.1

Given URL YouTube hoặc Google Drive hợp lệ
Then lưu thành tài liệu link.

### AC-10.2

Given URL ngoài allowlist
Then từ chối.

### AC-10.3

Hệ thống hiển thị cảnh báo rằng quyền Google Drive phải được thiết lập ở Google Drive.

## Epic 11 — Audit

### AC-11.1

Mỗi thao tác upload, download, delete, restore và permission change có audit log.

### AC-11.2

Người dùng chỉ xem audit trong phạm vi được phép.

### AC-11.3

Audit log không thể sửa hoặc xóa qua API thông thường.
