"use client";

import { useEffect, useState } from "react";

type DocumentItem = {
  id: string;
  title: string;
  description: string | null;
  documentKind: "FILE" | "GOOGLE_DRIVE_LINK" | "YOUTUBE_LINK";
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  externalUrl: string | null;
  createdAt: string;
  owner: { id: string; name: string | null; email: string };
  currentVersion: {
    id: string;
    versionNumber: number;
    createdAt: string;
  } | null;
  capabilities: {
    canDownload: boolean;
    canPreview: boolean;
    canOpenLink: boolean;
  };
};

type StagedFile = {
  id: string;
  file: File;
  title: string;
  progress: number;
  status: "READY" | "UPLOADING" | "DONE" | "ERROR" | "INVALID";
  error?: string;
};

type ApiErrorBody = { error?: { message?: string } };

type UploadSettings = {
  maxSizeMb: number;
  maxSizeBytes: number;
  allowedExtensions: string[];
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? "Không thể hoàn tất thao tác");
  }
  return (await response.json()) as T;
}

function uploadObject(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Object storage trả mã ${request.status}`));
    });
    request.addEventListener("error", () =>
      reject(new Error("Không thể kết nối object storage")),
    );
    request.send(file);
  });
}

function formatBytes(value: number | null) {
  if (value === null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function kindLabel(kind: DocumentItem["documentKind"]) {
  if (kind === "GOOGLE_DRIVE_LINK") return "Google Drive";
  if (kind === "YOUTUBE_LINK") return "YouTube";
  return "File";
}

export function DocumentPanel({
  folderId,
  canUpload,
}: {
  folderId: string;
  canUpload: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkKind, setLinkKind] = useState<
    "GOOGLE_DRIVE_LINK" | "YOUTUBE_LINK"
  >("GOOGLE_DRIVE_LINK");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadSettings, setUploadSettings] = useState<UploadSettings>({
    maxSizeMb: 100,
    maxSizeBytes: 100 * 1024 * 1024,
    allowedExtensions: [
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".pdf",
      ".ppt",
      ".pptx",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
    ],
  });

  async function loadDocuments() {
    const body = await requestJson<{ data: DocumentItem[] }>(
      `/api/folders/${folderId}/documents`,
    );
    setDocuments(body.data);
  }

  useEffect(() => {
    let cancelled = false;
    requestJson<{ data: DocumentItem[] }>(`/api/folders/${folderId}/documents`)
      .then((body) => {
        if (!cancelled) setDocuments(body.data);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Không thể tải danh sách tài liệu",
          );
        }
      });
    if (canUpload) {
      requestJson<{ data: UploadSettings }>("/api/documents/upload-settings")
        .then((body) => {
          if (!cancelled) setUploadSettings(body.data);
        })
        .catch(() => {
          // Backend remains the source of truth if preliminary settings fail.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [canUpload, folderId]);

  function stageFiles(files: FileList | null) {
    if (!files) return;
    setStaged(
      Array.from(files).map((file): StagedFile => {
        const extension = file.name.includes(".")
          ? `.${file.name.split(".").pop()!.toLowerCase()}`
          : "";
        const typeAllowed =
          uploadSettings.allowedExtensions.includes(extension);
        const sizeAllowed = file.size <= uploadSettings.maxSizeBytes;
        return {
          id: crypto.randomUUID(),
          file,
          title: file.name.replace(/\.[^.]+$/, ""),
          progress: 0,
          status: typeAllowed && sizeAllowed ? "READY" : "INVALID",
          error: !typeAllowed
            ? `Định dạng ${extension || "(không có)"} không được phép`
            : !sizeAllowed
              ? `File vượt quá giới hạn ${uploadSettings.maxSizeMb} MB`
              : undefined,
        };
      }),
    );
  }

  function updateStaged(id: string, changes: Partial<StagedFile>) {
    setStaged((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  async function uploadOne(item: StagedFile) {
    updateStaged(item.id, {
      status: "UPLOADING",
      progress: 0,
      error: undefined,
    });
    try {
      const initialized = await requestJson<{
        data: {
          uploadId: string;
          uploadUrl: string;
          requiredHeaders: Record<string, string>;
        };
      }>("/api/documents/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          fileName: item.file.name,
          mimeType: item.file.type,
          sizeBytes: item.file.size,
        }),
      });
      await uploadObject(
        initialized.data.uploadUrl,
        item.file,
        initialized.data.requiredHeaders,
        (progress) => updateStaged(item.id, { progress }),
      );
      await requestJson("/api/documents/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: initialized.data.uploadId,
          title: item.title,
          description: "",
        }),
      });
      updateStaged(item.id, { status: "DONE", progress: 100 });
    } catch (error) {
      updateStaged(item.id, {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Upload thất bại",
      });
    }
  }

  async function uploadAll() {
    const ready = staged.filter(
      (item) => item.status === "READY" || item.status === "ERROR",
    );
    if (ready.length === 0) return;
    setBusy(true);
    setMessage(null);
    await Promise.all(ready.map(uploadOne));
    await loadDocuments().catch((error) =>
      setMessage(
        error instanceof Error ? error.message : "Không thể tải lại tài liệu",
      ),
    );
    setBusy(false);
  }

  async function addLink() {
    setBusy(true);
    setMessage(null);
    try {
      await requestJson("/api/documents/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          title: linkTitle,
          description: linkDescription,
          kind: linkKind,
          externalUrl: linkUrl,
        }),
      });
      setLinkTitle("");
      setLinkUrl("");
      setLinkDescription("");
      setShowLink(false);
      await loadDocuments();
      setMessage("Đã thêm liên kết.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể thêm liên kết",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openSignedUrl(
    document: DocumentItem,
    action: "download" | "preview",
  ) {
    try {
      const body = await requestJson<{
        data: { url: string; expiresIn: number };
      }>(`/api/documents/${document.id}/${action}`);
      window.open(body.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể mở tài liệu",
      );
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Tài liệu</h3>
          <p className="mt-1 text-sm text-slate-500">
            {documents.length} tài liệu trong trang hiện tại
          </p>
        </div>
        {canUpload ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setShowUpload((current) => !current);
                setShowLink(false);
              }}
              type="button"
            >
              Tải file lên
            </button>
            <button
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800"
              onClick={() => {
                setShowLink((current) => !current);
                setShowUpload(false);
              }}
              type="button"
            >
              Thêm liên kết
            </button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm" role="status">
          {message}
        </p>
      ) : null}

      {showUpload ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <label className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-emerald-300 bg-white p-8 text-center">
            <span className="font-semibold text-emerald-800">
              Chọn một hoặc nhiều file
            </span>
            <span className="mt-1 text-xs text-slate-500">
              Word, Excel, PDF, PowerPoint và hình ảnh; tối đa{" "}
              {uploadSettings.maxSizeMb} MB/file
            </span>
            <input
              accept={uploadSettings.allowedExtensions.join(",")}
              className="sr-only"
              multiple
              onChange={(event) => stageFiles(event.target.files)}
              type="file"
            />
          </label>

          {staged.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {staged.map((item) => (
                <div
                  className="rounded-xl border border-slate-200 bg-white p-3"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium">
                      Tên hiển thị
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                        disabled={item.status === "UPLOADING"}
                        onChange={(event) =>
                          updateStaged(item.id, { title: event.target.value })
                        }
                        value={item.title}
                      />
                    </label>
                    <span className="text-xs text-slate-500">
                      {formatBytes(item.file.size)}
                    </span>
                    <span className="text-xs font-semibold">
                      {item.status === "DONE"
                        ? "Hoàn tất"
                        : item.status === "ERROR" || item.status === "INVALID"
                          ? "Lỗi"
                          : `${item.progress}%`}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${
                        item.status === "ERROR" || item.status === "INVALID"
                          ? "bg-red-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  {item.error ? (
                    <p className="mt-2 text-xs text-red-700">{item.error}</p>
                  ) : null}
                </div>
              ))}
              <button
                className="justify-self-start rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                disabled={
                  busy ||
                  !staged.some(
                    (item) =>
                      (item.status === "READY" || item.status === "ERROR") &&
                      item.title.trim().length > 0,
                  )
                }
                onClick={uploadAll}
                type="button"
              >
                Upload các file đã chọn
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showLink ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Nguồn
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
              onChange={(event) =>
                setLinkKind(
                  event.target.value as "GOOGLE_DRIVE_LINK" | "YOUTUBE_LINK",
                )
              }
              value={linkKind}
            >
              <option value="GOOGLE_DRIVE_LINK">Google Drive</option>
              <option value="YOUTUBE_LINK">YouTube</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tên hiển thị
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              onChange={(event) => setLinkTitle(event.target.value)}
              value={linkTitle}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            URL
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://drive.google.com/..."
              type="url"
              value={linkUrl}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            Mô tả
            <textarea
              className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 font-normal"
              onChange={(event) => setLinkDescription(event.target.value)}
              value={linkDescription}
            />
          </label>
          {linkKind === "GOOGLE_DRIVE_LINK" ? (
            <p className="text-xs leading-5 text-amber-800 sm:col-span-2">
              Hãy bảo đảm quyền chia sẻ của file Google Drive phù hợp với người
              cần xem.
            </p>
          ) : null}
          <button
            className="justify-self-start rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            disabled={busy || !linkTitle.trim() || !linkUrl.trim()}
            onClick={addLink}
            type="button"
          >
            Lưu liên kết
          </button>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">
            Thư mục này chưa có tài liệu.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {canUpload
              ? "Tải file hoặc thêm liên kết để bắt đầu."
              : "Bạn có quyền xem nhưng chưa có quyền tải nội dung lên."}
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tên tài liệu</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Người tạo</th>
                <th className="px-4 py-3">Dung lượng</th>
                <th className="px-4 py-3">Phiên bản</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {document.title}
                    </p>
                    <p className="mt-1 max-w-72 truncate text-xs text-slate-500">
                      {document.originalFileName ??
                        document.description ??
                        document.externalUrl}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {kindLabel(document.documentKind)}
                  </td>
                  <td className="px-4 py-3">
                    {document.owner.name ?? document.owner.email}
                  </td>
                  <td className="px-4 py-3">
                    {formatBytes(document.sizeBytes)}
                  </td>
                  <td className="px-4 py-3">
                    v{document.currentVersion?.versionNumber ?? 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {document.capabilities.canPreview ? (
                        <button
                          className="font-medium text-emerald-700"
                          onClick={() => openSignedUrl(document, "preview")}
                          type="button"
                        >
                          Xem trước
                        </button>
                      ) : null}
                      {document.capabilities.canDownload ? (
                        <button
                          className="font-medium text-emerald-700"
                          onClick={() => openSignedUrl(document, "download")}
                          type="button"
                        >
                          Tải xuống
                        </button>
                      ) : null}
                      {document.capabilities.canOpenLink &&
                      document.externalUrl ? (
                        <a
                          className="font-medium text-emerald-700"
                          href={document.externalUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Mở liên kết
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
