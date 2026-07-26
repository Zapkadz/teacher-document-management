import Link from "next/link";

import { signOut } from "@/auth";
import { requireActiveUserPage } from "@/modules/auth/auth.guard";

export default async function DashboardPage() {
  const user = await requireActiveUserPage();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <nav className="flex items-center justify-between gap-4">
        <Link className="font-semibold text-emerald-800" href="/">
          Kho hồ sơ giáo dục
        </Link>
        <form action={logout}>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white"
            type="submit"
          >
            Đăng xuất
          </button>
        </form>
      </nav>

      <section className="mt-12 rounded-3xl border border-emerald-100 bg-white p-8 shadow-lg shadow-emerald-950/5">
        <p className="text-sm font-medium text-emerald-700">Đã đăng nhập</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Xin chào, {user.name ?? user.email}
        </h1>
        <p className="mt-3 text-slate-600">
          Tài khoản: {user.email} · Vai trò: {user.globalRole}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            href="/folders"
          >
            Mở kho hồ sơ
          </Link>
          <Link
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            href="/search"
          >
            Tìm kiếm
          </Link>
          <Link
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            href="/activity"
          >
            Hoạt động
          </Link>
          {user.globalRole === "ADMIN" ? (
            <Link
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              href="/admin/users"
            >
              Quản lý người dùng
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
