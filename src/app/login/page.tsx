import { redirect } from "next/navigation";
import Link from "next/link";

import { auth, signIn } from "@/auth";

const errorMessages: Record<string, string> = {
  AccessDenied:
    "Tài khoản chưa được cấp quyền hoặc đang bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
  Configuration:
    "Cấu hình đăng nhập chưa hoàn tất. Vui lòng liên hệ quản trị viên.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user.status === "ACTIVE") {
    redirect("/dashboard");
  }

  const error = (await searchParams).error;
  const message = error
    ? (errorMessages[error] ?? "Không thể đăng nhập. Vui lòng thử lại.")
    : null;

  async function loginWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-emerald-950/5">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          Kho hồ sơ giáo dục
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Đăng nhập
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          Sử dụng tài khoản Google đã được quản trị viên cấp quyền.
        </p>

        {message ? (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            {message}
          </div>
        ) : null}

        <form action={loginWithGoogle} className="mt-8">
          <button
            className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            type="submit"
          >
            Đăng nhập bằng Google
          </button>
        </form>

        <Link
          className="mt-6 block text-center text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800"
          href="/"
        >
          Quay lại trang chủ
        </Link>
      </section>
    </main>
  );
}
