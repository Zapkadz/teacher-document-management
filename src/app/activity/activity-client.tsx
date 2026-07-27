"use client";

import { useState } from "react";

import { AUDIT_ACTIONS } from "@/modules/audit/audit.constants";

type ActorOption = {
  id: string;
  email: string;
  fullName: string | null;
};
type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  folderId: string | null;
  folderName: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
type ApiError = { error?: { message?: string } };

function actionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ActivityClient({
  currentUserId,
  isAdmin,
  actors,
  initialLogs,
  initialPagination,
}: {
  currentUserId: string;
  isAdmin: boolean;
  actors: ActorOption[];
  initialLogs: AuditLog[];
  initialPagination: Pagination;
}) {
  const [scope, setScope] = useState(isAdmin ? "all" : "mine");
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadLogs(page = 1) {
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
    });
    const selectedActor =
      scope === "mine" ? currentUserId : isAdmin ? actorUserId : "";
    if (selectedActor) params.set("actorUserId", selectedActor);
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (from) params.set("from", `${from}T00:00:00.000Z`);
    if (to) params.set("to", `${to}T23:59:59.999Z`);

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(body.error?.message ?? "Không thể tải nhật ký");
      }
      const body = (await response.json()) as {
        data: AuditLog[];
        pagination: Pagination;
      };
      setLogs(body.data);
      setPagination(body.pagination);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tải nhật ký",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/5 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          Phạm vi
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setScope(event.target.value)}
            value={scope}
          >
            <option value="mine">Hoạt động của tôi</option>
            <option value="authorized">
              {isAdmin ? "Toàn hệ thống" : "Phạm vi được cấp quyền"}
            </option>
          </select>
        </label>
        {isAdmin && scope === "authorized" ? (
          <label className="grid gap-2 text-sm font-medium">
            Người thực hiện
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              onChange={(event) => setActorUserId(event.target.value)}
              value={actorUserId}
            >
              <option value="">Mọi người</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.fullName ?? actor.email} — {actor.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-medium">
          Hành động
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setAction(event.target.value)}
            value={action}
          >
            <option value="">Mọi hành động</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {actionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Loại đối tượng
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setEntityType(event.target.value)}
            value={entityType}
          >
            <option value="">Mọi loại</option>
            {["AUTH", "USER", "FOLDER", "DOCUMENT", "ACADEMIC_YEAR"].map(
              (item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Từ ngày
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Đến ngày
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </label>
        <button
          className="self-end rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => loadLogs(1)}
          type="button"
        >
          {busy ? "Đang tải…" : "Áp dụng bộ lọc"}
        </button>
      </div>

      {message ? (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-950">
          {pagination.total} hoạt động
        </h2>
        <span className="text-sm text-slate-500">
          Trang {pagination.page}/{Math.max(1, pagination.totalPages)}
        </span>
      </div>

      {logs.length === 0 && !busy ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
          Chưa có hoạt động phù hợp trong phạm vi được phép xem.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-240 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Thư mục</th>
                <th className="px-4 py-3">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "medium",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }).format(new Date(log.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    {log.actor?.name ?? log.actor?.email ?? "Hệ thống"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {actionLabel(log.action)}
                  </td>
                  <td className="px-4 py-3">
                    {log.entityType}
                    {log.entityId ? (
                      <span className="block max-w-36 truncate text-xs text-slate-400">
                        {log.entityId}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {log.folderName ?? (log.folderId ? "Đã xóa" : "—")}
                  </td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer font-medium text-emerald-700">
                        Xem metadata
                      </summary>
                      <pre className="mt-2 max-h-48 max-w-lg overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            disabled={busy || pagination.page <= 1}
            onClick={() => loadLogs(pagination.page - 1)}
            type="button"
          >
            Trang trước
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            disabled={busy || pagination.page >= pagination.totalPages}
            onClick={() => loadLogs(pagination.page + 1)}
            type="button"
          >
            Trang sau
          </button>
        </div>
      ) : null}
    </section>
  );
}
