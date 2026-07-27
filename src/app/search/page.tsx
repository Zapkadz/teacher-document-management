import Link from "next/link";

import { listAcademicYears } from "@/modules/academic-years/academic-year.service";
import { requireActiveUserPage } from "@/modules/auth/auth.guard";
import { listUsers } from "@/modules/users/user.service";

import { SearchClient } from "./search-client";

async function getOwnerOptions(
  isAdmin: boolean,
  currentUser: {
    id: string;
    email: string;
    name: string | null;
  },
) {
  if (!isAdmin) {
    return [
      {
        id: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.name,
      },
    ];
  }

  const first = await listUsers({ page: 1, limit: 100 });
  const rest = await Promise.all(
    Array.from(
      { length: Math.max(0, first.pagination.totalPages - 1) },
      (_, index) => listUsers({ page: index + 2, limit: 100 }),
    ),
  );
  return [first, ...rest].flatMap(({ data }) =>
    data.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    })),
  );
}

export default async function SearchPage() {
  const user = await requireActiveUserPage();
  const owners = await getOwnerOptions(user.globalRole === "ADMIN", user);
  const academicYears = (await listAcademicYears()).data.map((year) => ({
    id: year.id,
    name: year.name,
    isActive: year.isActive,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="flex items-center justify-between gap-4">
        <Link className="font-semibold text-emerald-800" href="/dashboard">
          ← Bảng điều khiển
        </Link>
        <span className="text-sm text-slate-500">{user.email}</span>
      </nav>
      <header className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Phase 6
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Tìm kiếm hồ sơ
        </h1>
        <p className="mt-2 text-slate-600">
          Chỉ hiển thị thư mục và tài liệu bạn có quyền xem.
        </p>
      </header>
      <SearchClient
        academicYears={academicYears}
        isAdmin={user.globalRole === "ADMIN"}
        owners={owners}
      />
    </main>
  );
}
