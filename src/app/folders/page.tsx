import Link from "next/link";
import { z } from "zod";

import { listAcademicYears } from "@/modules/academic-years/academic-year.service";
import { requireActiveUserPage } from "@/modules/auth/auth.guard";
import { getFolderDetails } from "@/modules/folders/folder.service";
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

export default async function FoldersPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string | string[] }>;
}) {
  const user = await requireActiveUserPage();
  const rawFolderId = (await searchParams).folderId;
  const folderId = z
    .uuid()
    .safeParse(typeof rawFolderId === "string" ? rawFolderId : undefined);
  const initialFolder = folderId.success
    ? await getFolderDetails(folderId.data, {
        id: user.id,
        globalRole: user.globalRole,
      })
        .then(({ data }) => ({
          ...data,
          deletedAt: data.deletedAt?.toISOString() ?? null,
          createdAt: data.createdAt.toISOString(),
          updatedAt: data.updatedAt.toISOString(),
        }))
        .catch(() => null)
    : null;
  const owners =
    user.globalRole === "ADMIN"
      ? await listAllPersonalWorkspaceOwners()
      : [{ id: user.id, email: user.email, fullName: user.name }];
  const academicYears = (await listAcademicYears()).data.map((year) => ({
    id: year.id,
    name: year.name,
    isActive: year.isActive,
  }));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="flex items-center justify-between gap-4">
        <Link className="font-semibold text-emerald-800" href="/dashboard">
          ← Bảng điều khiển
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link className="font-semibold text-emerald-700" href="/search">
            Tìm kiếm
          </Link>
          <Link className="font-semibold text-slate-700" href="/activity">
            Hoạt động
          </Link>
          <span className="text-slate-500">{user.email}</span>
        </div>
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
        academicYears={academicYears}
        currentUserId={user.id}
        initialFolder={initialFolder}
        isAdmin={user.globalRole === "ADMIN"}
        owners={owners}
      />
    </main>
  );
}
