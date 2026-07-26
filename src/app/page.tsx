export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-emerald-950/5 sm:p-12">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-emerald-500"
          />
          Phase 0 đã sẵn sàng
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Kho hồ sơ giáo dục
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
          Nền tảng quản lý tài liệu giáo viên nội bộ đang được xây dựng theo
          từng giai đoạn. Hạ tầng ứng dụng, cơ sở dữ liệu và lưu trữ local đã
          được thiết lập.
        </p>

        <div className="mt-10 border-t border-slate-100 pt-6">
          <a
            className="font-medium text-emerald-700 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-900"
            href="/api/health"
          >
            Kiểm tra trạng thái hệ thống
          </a>
        </div>
      </section>
    </main>
  );
}
