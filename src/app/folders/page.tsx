import Link from "next/link";

import { requireActiveUserPage } from "@/modules/auth/auth.guard";
import { listUsers } from "@/modules/users/user.service";

import { FolderExplorer } from "./folder-explorer";

async function listAllPersonalWorkspaceOwners() {
  const firstPage = await listUsers({ page: 1, limit: 100 });
  const remainingPages = await Promise.all(
    Array.from(
      { length: Math.max(0, firstPage.pagination.totalPages - 1) },
      (_, index) => listUsers({ page: index + 2, limit: 100 }),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) =>
    page.data.map((item) => ({
      id: item.id,
      email: item.email,
      fullName: item.fullName,
    })),
  );
}

export default async function FoldersPage() {
  const user = await requireActiveUserPage();
  const owners =
    user.globalRole === "ADMIN"
      ? await listAllPersonalWorkspaceOwners()
      : [{ id: user.id, email: user.email, fullName: user.name }];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="flex items-center justify-between gap-4">
        <Link className="font-semibold text-emerald-800" href="/dashboard">
          ← Bảng điều khiển
        </Link>
        <span className="text-sm text-slate-500">{user.email}</span>
      </nav>

      <div className="mt-8">
        <h1 className="text-3xl font-semibold text-slate-950">
          Hồ sơ giáo dục
        </h1>
        <p className="mt-2 text-slate-600">
          Quản lý cây thư mục cá nhân và dùng chung.
        </p>
      </div>

      <FolderExplorer
        currentUserId={user.id}
        isAdmin={user.globalRole === "ADMIN"}
        owners={owners}
      />
    </main>
  );
}
