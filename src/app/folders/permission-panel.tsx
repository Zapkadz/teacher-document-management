"use client";

import { useEffect, useState } from "react";

const permissionOptions = [
  ["VIEW", "Xem thư mục"],
  ["PREVIEW", "Xem trước"],
  ["DOWNLOAD", "Tải xuống"],
  ["UPLOAD", "Tải lên"],
  ["CREATE_SUBFOLDER", "Tạo thư mục con"],
  ["EDIT_OWN", "Sửa nội dung của mình"],
  ["DELETE_OWN", "Xóa nội dung của mình"],
  ["MOVE_OWN", "Di chuyển nội dung của mình"],
  ["EDIT_ANY", "Sửa mọi nội dung"],
  ["DELETE_ANY", "Xóa mọi nội dung"],
  ["MOVE_ANY", "Di chuyển mọi nội dung"],
  ["LOCK_FOLDER", "Khóa thư mục"],
  ["MANAGE_PERMISSIONS", "Quản lý quyền"],
  ["VIEW_AUDIT", "Xem nhật ký"],
  ["RESTORE", "Khôi phục"],
] as const;

type Permission = (typeof permissionOptions)[number][0];

const presets: Record<string, Permission[]> = {
  VIEWER: ["VIEW", "PREVIEW"],
  VIEW_DOWNLOAD: ["VIEW", "PREVIEW", "DOWNLOAD"],
  CONTRIBUTOR: [
    "VIEW",
    "PREVIEW",
    "DOWNLOAD",
    "UPLOAD",
    "CREATE_SUBFOLDER",
    "EDIT_OWN",
    "DELETE_OWN",
    "MOVE_OWN",
  ],
  CONTENT_MANAGER: permissionOptions
    .map(([permission]) => permission)
    .filter((permission) => permission !== "MANAGE_PERMISSIONS"),
  FOLDER_MANAGER: permissionOptions.map(([permission]) => permission),
};

type Principal = {
  id: string;
  name: string | null;
  email?: string | null;
};

type PermissionRecord = {
  id: string;
  folderId: string;
  folderName: string;
  source: "DIRECT" | "INHERITED";
  principalType: "USER" | "GROUP";
  principal: Principal;
  permissions: Permission[];
  appliesToDescendants: boolean;
};

type PermissionData = {
  folderId: string;
  inheritPermissions: boolean;
  direct: PermissionRecord[];
  inherited: PermissionRecord[];
  effectivePermissions: Permission[];
  availableUsers: Array<Principal & { email: string }>;
  availableGroups: Principal[];
};

type ApiErrorBody = { error?: { message?: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? "Không thể hoàn tất thao tác");
  }
  return (await response.json()) as T;
}

function PermissionChecks({
  value,
  onChange,
}: {
  value: Permission[];
  onChange: (permissions: Permission[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {permissionOptions.map(([permission, label]) => (
        <label
          className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-xs"
          key={permission}
        >
          <input
            checked={value.includes(permission)}
            className="mt-0.5"
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, permission]
                  : value.filter((item) => item !== permission),
              )
            }
            type="checkbox"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function DirectPermissionEditor({
  folderId,
  record,
  onReload,
  onError,
}: {
  folderId: string;
  record: PermissionRecord;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [permissions, setPermissions] = useState(record.permissions);
  const [descendants, setDescendants] = useState(record.appliesToDescendants);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (permissions.length === 0) {
      onError("Hãy chọn ít nhất một quyền.");
      return;
    }
    setBusy(true);
    try {
      await requestJson(`/api/folders/${folderId}/permissions/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions,
          appliesToDescendants: descendants,
        }),
      });
      await onReload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Không thể lưu quyền");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm("Thu hồi toàn bộ quyền trực tiếp này?")) return;
    setBusy(true);
    try {
      await requestJson(`/api/folders/${folderId}/permissions/${record.id}`, {
        method: "DELETE",
      });
      await onReload();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Không thể thu hồi quyền",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">
            {record.principal.name ?? record.principal.email}
          </p>
          <p className="text-xs text-slate-500">
            {record.principalType === "GROUP" ? "Nhóm" : record.principal.email}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
          Trực tiếp
        </span>
      </div>
      <PermissionChecks onChange={setPermissions} value={permissions} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={descendants}
            onChange={(event) => setDescendants(event.target.checked)}
            type="checkbox"
          />
          Áp dụng cho thư mục con
        </label>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
            disabled={busy}
            onClick={revoke}
            type="button"
          >
            Thu hồi
          </button>
          <button
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
            disabled={busy}
            onClick={save}
            type="button"
          >
            Lưu
          </button>
        </div>
      </div>
    </article>
  );
}

export function PermissionPanel({
  folderId,
  folderName,
  onClose,
}: {
  folderId: string;
  folderName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PermissionData | null>(null);
  const [principalType, setPrincipalType] = useState<"USER" | "GROUP">("USER");
  const [principalId, setPrincipalId] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>(presets.VIEWER);
  const [descendants, setDescendants] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const body = await requestJson<{ data: PermissionData }>(
      `/api/folders/${folderId}/permissions`,
    );
    setData(body.data);
  }

  useEffect(() => {
    let cancelled = false;
    requestJson<{ data: PermissionData }>(
      `/api/folders/${folderId}/permissions`,
    )
      .then((body) => {
        if (!cancelled) setData(body.data);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Không thể tải quyền",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  async function grant() {
    if (!principalId || permissions.length === 0) {
      setMessage("Hãy chọn principal và ít nhất một quyền.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await requestJson(`/api/folders/${folderId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principalType,
          principalIds: [principalId],
          permissions,
          appliesToDescendants: descendants,
        }),
      });
      setPrincipalId("");
      await load();
      setMessage("Đã cấp quyền.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể cấp quyền",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleInheritance() {
    if (!data) return;
    setBusy(true);
    try {
      await requestJson(`/api/folders/${folderId}/inheritance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inheritPermissions: !data.inheritPermissions,
        }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể đổi kế thừa quyền",
      );
    } finally {
      setBusy(false);
    }
  }

  const principals =
    principalType === "USER"
      ? (data?.availableUsers ?? [])
      : (data?.availableGroups ?? []);

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Phân quyền thư mục
          </p>
          <h3 className="mt-1 text-xl font-semibold">{folderName}</h3>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onClick={onClose}
          type="button"
        >
          Đóng
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm" role="status">
          {message}
        </p>
      ) : null}

      {!data ? (
        <p className="mt-5 text-sm text-slate-500">Đang tải quyền…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="font-medium">Kế thừa từ thư mục cha</p>
              <p className="mt-1 text-xs text-slate-500">
                {data.inheritPermissions
                  ? "Đang nhận các grant áp dụng xuống từ cấp trên."
                  : "Đã chặn toàn bộ grant từ cấp trên."}
              </p>
            </div>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
              disabled={busy}
              onClick={toggleInheritance}
              type="button"
            >
              {data.inheritPermissions ? "Tắt kế thừa" : "Bật kế thừa"}
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold">Cấp quyền trực tiếp</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Loại principal
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  onChange={(event) => {
                    setPrincipalType(event.target.value as "USER" | "GROUP");
                    setPrincipalId("");
                  }}
                  value={principalType}
                >
                  <option value="USER">Người dùng</option>
                  <option value="GROUP">Nhóm</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Principal
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  onChange={(event) => setPrincipalId(event.target.value)}
                  value={principalId}
                >
                  <option value="">Chọn principal</option>
                  {principals.map((principal) => (
                    <option key={principal.id} value={principal.id}>
                      {principal.name ?? principal.email}{" "}
                      {principal.email ? `— ${principal.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Preset
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  onChange={(event) =>
                    setPermissions(presets[event.target.value] ?? [])
                  }
                  defaultValue="VIEWER"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="VIEW_DOWNLOAD">Xem và tải xuống</option>
                  <option value="CONTRIBUTOR">Contributor</option>
                  <option value="CONTENT_MANAGER">Content manager</option>
                  <option value="FOLDER_MANAGER">Folder manager</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  checked={descendants}
                  onChange={(event) => setDescendants(event.target.checked)}
                  type="checkbox"
                />
                Áp dụng cho thư mục con
              </label>
            </div>
            <div className="mt-4">
              <PermissionChecks onChange={setPermissions} value={permissions} />
            </div>
            <button
              className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
              disabled={busy}
              onClick={grant}
              type="button"
            >
              Cấp quyền
            </button>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold">
              Quyền trực tiếp ({data.direct.length})
            </h4>
            <div className="mt-3 grid gap-3">
              {data.direct.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Chưa có quyền trực tiếp.
                </p>
              ) : (
                data.direct.map((record) => (
                  <DirectPermissionEditor
                    folderId={folderId}
                    key={record.id}
                    onError={setMessage}
                    onReload={load}
                    record={record}
                  />
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold">
              Quyền kế thừa ({data.inherited.length})
            </h4>
            <div className="mt-3 grid gap-2">
              {data.inherited.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Không có quyền kế thừa đang hiệu lực.
                </p>
              ) : (
                data.inherited.map((record) => (
                  <article
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    key={record.id}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-medium">
                        {record.principal.name ?? record.principal.email}
                      </p>
                      <span className="text-xs text-slate-500">
                        Từ {record.folderName}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {record.permissions.join(", ")}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
