import Link from "next/link";

import { requireAdminPage } from "@/modules/auth/auth.guard";
import { listUsers } from "@/modules/users/user.service";

import { UserAdminClient } from "./user-admin-client";

export default async function AdminUsersPage() {
  await requireAdminPage();
  const result = await listUsers({ page: 1, limit: 100 });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <nav className="flex items-center justify-between gap-4">
        <Link className="font-semibold text-emerald-800" href="/dashboard">
          ← Bảng điều khiển
        </Link>
      </nav>
      <h1 className="mt-10 text-3xl font-semibold text-slate-950">
        Quản lý người dùng
      </h1>
      <p className="mt-3 text-slate-600">
        Cấp trước tài khoản Google và kiểm soát vai trò, trạng thái đăng nhập.
      </p>
      <UserAdminClient
        initialUsers={result.data.map((user) => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          globalRole: user.globalRole,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
