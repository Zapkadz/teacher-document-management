import Link from "next/link";

import { listAuditLogs } from "@/modules/audit/audit.service";
import { requireActiveUserPage } from "@/modules/auth/auth.guard";
import { listUsers } from "@/modules/users/user.service";

import { ActivityClient } from "./activity-client";

async function getActorOptions(isAdmin: boolean) {
  if (!isAdmin) return [];
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

export default async function ActivityPage() {
  const user = await requireActiveUserPage();
  const isAdmin = user.globalRole === "ADMIN";
  const initialResult = await listAuditLogs(
    {
      actorUserId: isAdmin ? undefined : user.id,
      page: 1,
      limit: 25,
    },
    user,
  );

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
          Nhật ký append-only
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Hoạt động hệ thống
        </h1>
        <p className="mt-2 text-slate-600">
          {isAdmin
            ? "Quản trị viên xem được toàn bộ hoạt động."
            : "Bạn xem được hoạt động của mình và phạm vi có quyền VIEW_AUDIT."}
        </p>
      </header>
      <ActivityClient
        actors={await getActorOptions(isAdmin)}
        currentUserId={user.id}
        initialLogs={initialResult.data.map((log) => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
        }))}
        initialPagination={initialResult.pagination}
        isAdmin={isAdmin}
      />
    </main>
  );
}
