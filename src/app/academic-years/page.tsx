import Link from "next/link";

import { listAcademicYears } from "@/modules/academic-years/academic-year.service";
import { requireActiveUserPage } from "@/modules/auth/auth.guard";

import { AcademicYearsClient } from "./academic-years-client";

export default async function AcademicYearsPage() {
  const user = await requireActiveUserPage();
  const years = (await listAcademicYears()).data.map((year) => ({
    ...year,
    startsOn: year.startsOn?.toISOString().slice(0, 10) ?? null,
    endsOn: year.endsOn?.toISOString().slice(0, 10) ?? null,
    createdAt: year.createdAt.toISOString(),
    updatedAt: year.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="flex items-center justify-between gap-4">
        <Link className="font-semibold text-emerald-800" href="/dashboard">
          ← Bảng điều khiển
        </Link>
        <span className="text-sm text-slate-500">{user.email}</span>
      </nav>
      <header className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Phase 7
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Năm học và sao chép cấu trúc
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Quản lý cây dùng chung theo năm học, xem trước rồi sao chép cấu trúc
          và quyền. Tài liệu không được sao chép trong Phase 7.
        </p>
      </header>
      <AcademicYearsClient
        initialYears={years}
        isAdmin={user.globalRole === "ADMIN"}
      />
    </main>
  );
}
