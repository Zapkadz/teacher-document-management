"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

type OwnerOption = {
  id: string;
  email: string;
  fullName: string | null;
};

type FolderResult = {
  type: "FOLDER";
  id: string;
  name: string;
  workspaceType: "PERSONAL" | "SHARED";
  creator: { id: string; name: string | null; email: string };
  updatedAt: string;
};

type DocumentResult = {
  type: "DOCUMENT";
  id: string;
  title: string;
  description: string | null;
  documentKind: "FILE" | "GOOGLE_DRIVE_LINK" | "YOUTUBE_LINK";
  originalFileName: string | null;
  fileExtension: string | null;
  sizeBytes: number | null;
  externalUrl: string | null;
  owner: { id: string; name: string | null; email: string };
  folder: {
    id: string;
    name: string;
    workspaceType: "PERSONAL" | "SHARED";
  };
  updatedAt: string;
  capabilities: {
    canDownload: boolean;
    canPreview: boolean;
    canOpenLink: boolean;
  };
};

type SearchResult = FolderResult | DocumentResult;
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
type ApiError = { error?: { message?: string } };

function formatBytes(value: number | null) {
  if (value === null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function SearchClient({
  owners,
  isAdmin,
}: {
  owners: OwnerOption[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [resultType, setResultType] = useState("all");
  const [fileType, setFileType] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runSearch(page = 1) {
    const params = new URLSearchParams({
      q: query.trim(),
      type: resultType,
      page: String(page),
      limit: "25",
    });
    if (fileType) params.set("fileType", fileType);
    if (ownerUserId) params.set("ownerUserId", ownerUserId);
    if (from) params.set("from", `${from}T00:00:00.000Z`);
    if (to) params.set("to", `${to}T23:59:59.999Z`);

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(body.error?.message ?? "Không thể tìm kiếm");
      }
      const body = (await response.json()) as {
        data: SearchResult[];
        pagination: Pagination;
      };
      setResults(body.data);
      setPagination(body.pagination);
      setSearched(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tìm kiếm");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(1);
  }

  async function openSignedUrl(
    documentId: string,
    action: "download" | "preview",
  ) {
    setMessage(null);
    const response = await fetch(`/api/documents/${documentId}/${action}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiError;
      setMessage(body.error?.message ?? "Không thể mở tài liệu");
      return;
    }
    const body = (await response.json()) as { data: { url: string } };
    window.open(body.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mt-8">
      <form
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/5 md:grid-cols-3"
        onSubmit={submit}
      >
        <label className="grid gap-2 text-sm font-medium md:col-span-3">
          Từ khóa
          <input
            className="rounded-xl border border-slate-300 px-4 py-3 text-base font-normal"
            minLength={2}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên tài liệu, mô tả, file, người tải lên hoặc thư mục"
            required
            value={query}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Loại kết quả
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setResultType(event.target.value)}
            value={resultType}
          >
            <option value="all">Tất cả</option>
            <option value="document">Tài liệu</option>
            <option value="folder">Thư mục</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Loại file
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            disabled={resultType === "folder"}
            onChange={(event) => setFileType(event.target.value)}
            value={fileType}
          >
            <option value="">Mọi loại</option>
            <option value="file">Tất cả file</option>
            <option value="word">Word</option>
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
            <option value="powerpoint">PowerPoint</option>
            <option value="image">Hình ảnh</option>
            <option value="google_drive">Google Drive</option>
            <option value="youtube">YouTube</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Người tạo
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setOwnerUserId(event.target.value)}
            value={ownerUserId}
          >
            <option value="">Mọi người</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.fullName ?? owner.email}
                {isAdmin ? ` — ${owner.email}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Từ ngày
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Đến ngày
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </label>
        <button
          className="self-end rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          disabled={busy || query.trim().length < 2}
          type="submit"
        >
          {busy ? "Đang tìm…" : "Tìm kiếm"}
        </button>
      </form>

      {message ? (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
      ) : null}

      {searched ? (
        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">
            {pagination.total} kết quả
          </h2>
          <span className="text-sm text-slate-500">
            Trang {pagination.page}/{Math.max(1, pagination.totalPages)}
          </span>
        </div>
      ) : null}

      {searched && results.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
          Không tìm thấy dữ liệu phù hợp trong phạm vi bạn được phép xem.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        {results.map((result) =>
          result.type === "FOLDER" ? (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5"
              key={`folder-${result.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    📁 Thư mục ·{" "}
                    {result.workspaceType === "PERSONAL"
                      ? "Kho cá nhân"
                      : "Kho dùng chung"}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    {result.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Tạo bởi {result.creator.name ?? result.creator.email}
                  </p>
                </div>
                <Link
                  className="font-semibold text-emerald-700"
                  href={`/folders?folderId=${encodeURIComponent(result.id)}`}
                >
                  Mở thư mục
                </Link>
              </div>
            </article>
          ) : (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5"
              key={`document-${result.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    📄 Tài liệu · {result.folder.name}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    {result.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {result.owner.name ?? result.owner.email} ·{" "}
                    {result.fileExtension ?? result.documentKind} ·{" "}
                    {formatBytes(result.sizeBytes)}
                  </p>
                  {result.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {result.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link
                    className="font-semibold text-emerald-700"
                    href={`/folders?folderId=${encodeURIComponent(result.folder.id)}`}
                  >
                    Mở thư mục
                  </Link>
                  {result.capabilities.canPreview ? (
                    <button
                      className="font-semibold text-emerald-700"
                      onClick={() => openSignedUrl(result.id, "preview")}
                      type="button"
                    >
                      Xem trước
                    </button>
                  ) : null}
                  {result.capabilities.canDownload ? (
                    <button
                      className="font-semibold text-emerald-700"
                      onClick={() => openSignedUrl(result.id, "download")}
                      type="button"
                    >
                      Tải xuống
                    </button>
                  ) : null}
                  {result.capabilities.canOpenLink && result.externalUrl ? (
                    <a
                      className="font-semibold text-emerald-700"
                      href={result.externalUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Mở liên kết
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ),
        )}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            disabled={busy || pagination.page <= 1}
            onClick={() => runSearch(pagination.page - 1)}
            type="button"
          >
            Trang trước
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            disabled={busy || pagination.page >= pagination.totalPages}
            onClick={() => runSearch(pagination.page + 1)}
            type="button"
          >
            Trang sau
          </button>
        </div>
      ) : null}
    </section>
  );
}
