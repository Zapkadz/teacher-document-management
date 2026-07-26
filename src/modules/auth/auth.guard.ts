import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

export async function getCurrentActiveUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      globalRole: true,
      status: true,
    },
  });

  return user?.status === "ACTIVE" ? user : null;
}

export async function requireActiveUser() {
  const user = await getCurrentActiveUser();

  if (!user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Bạn cần đăng nhập bằng tài khoản đang hoạt động",
      401,
    );
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireActiveUser();

  if (user.globalRole !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền thực hiện thao tác này",
      403,
    );
  }

  return user;
}

export async function requireActiveUserPage() {
  const user = await getCurrentActiveUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdminPage() {
  const user = await requireActiveUserPage();

  if (user.globalRole !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
