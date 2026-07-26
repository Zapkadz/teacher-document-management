"use client";

import { type FormEvent, useMemo, useState } from "react";

type Role = "ADMIN" | "USER";
type Status = "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";

export type UserItem = {
  id: string;
  email: string;
  fullName: string | null;
  globalRole: Role;
  status: Status;
  createdAt: string;
};

type ApiError = {
  error?: { message?: string };
};

async function getErrorMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return body.error?.message ?? "Không thể hoàn tất thao tác";
}

export function UserAdminClient({
  initialUsers,
}: {
  initialUsers: UserItem[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query),
    );
  }, [search, users]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        fullName: form.get("fullName"),
        globalRole: form.get("globalRole"),
        status: form.get("status"),
      }),
    });

    if (!response.ok) {
      setMessage(await getErrorMessage(response));
      setBusy(false);
      return;
    }

    const body = (await response.json()) as { data: UserItem };
    setUsers((current) => [body.data, ...current]);
    formElement.reset();
    setMessage("Đã tạo tài khoản và kho cá nhân.");
    setBusy(false);
  }

  async function updateUser(
    id: string,
    changes: Partial<Pick<UserItem, "globalRole" | "status">>,
  ) {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });

    if (!response.ok) {
      setMessage(await getErrorMessage(response));
      setBusy(false);
      return;
    }

    const body = (await response.json()) as { data: UserItem };
    setUsers((current) =>
      current.map((user) => (user.id === id ? body.data : user)),
    );
    setMessage("Đã cập nhật người dùng.");
    setBusy(false);
  }

  return (
    <div className="mt-8 grid gap-8">
      <form
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2"
        onSubmit={createUser}
      >
        <h2 className="text-xl font-semibold text-slate-950 md:col-span-2">
          Thêm người dùng
        </h2>
        <label className="grid gap-2 text-sm font-medium">
          Họ và tên
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            name="fullName"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Email Google
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            name="email"
            required
            type="email"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Vai trò
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            defaultValue="USER"
            name="globalRole"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Trạng thái
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            defaultValue="ACTIVE"
            name="status"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <button
          className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50 md:col-span-2"
          disabled={busy}
          type="submit"
        >
          Tạo tài khoản
        </button>
      </form>

      {message ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">
            Danh sách người dùng
          </h2>
          <input
            aria-label="Tìm người dùng"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc email"
            value={search}
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Người dùng</th>
                <th className="px-3 py-3 font-medium">Vai trò</th>
                <th className="px-3 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr className="border-b border-slate-100" key={user.id}>
                  <td className="px-3 py-4">
                    <div className="font-medium text-slate-900">
                      {user.fullName}
                    </div>
                    <div className="mt-1 text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-3 py-4">
                    <select
                      aria-label={`Vai trò của ${user.email}`}
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      disabled={busy}
                      onChange={(event) =>
                        updateUser(user.id, {
                          globalRole: event.target.value as Role,
                        })
                      }
                      value={user.globalRole}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-3 py-4">
                    <select
                      aria-label={`Trạng thái của ${user.email}`}
                      className="rounded-lg border border-slate-300 px-2 py-2"
                      disabled={busy}
                      onChange={(event) =>
                        updateUser(user.id, {
                          status: event.target.value as Status,
                        })
                      }
                      value={user.status}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PENDING">PENDING</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
