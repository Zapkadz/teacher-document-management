"use client";

import { type FormEvent, useMemo, useState } from "react";

type AcademicYear = {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rootFolder: { id: string; name: string } | null;
  folderCount: number;
};

type FolderOption = {
  id: string;
  name: string;
  parentId: string | null;
  label: string;
  isSystemRoot: boolean;
};

type CopyPreview = {
  source: { id: string; name: string; academicYearId: string };
  target: { id: string; name: string; academicYearId: string };
  folderCount: number;
  permissionCount: number;
  documentCountExcluded: number;
  copyPermissions: boolean;
  copyDocuments: false;
  warnings: string[];
};

type ApiError = { error?: { message?: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error?.message ?? "Không thể hoàn tất thao tác");
  }
  return (await response.json()) as T;
}

function normalizeYear(year: AcademicYear): AcademicYear {
  return {
    ...year,
    startsOn: year.startsOn?.slice(0, 10) ?? null,
    endsOn: year.endsOn?.slice(0, 10) ?? null,
  };
}

export function AcademicYearsClient({
  initialYears,
  isAdmin,
}: {
  initialYears: AcademicYear[];
  isAdmin: boolean;
}) {
  const [years, setYears] = useState(initialYears);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [activateNew, setActivateNew] = useState(false);
  const [sourceYearId, setSourceYearId] = useState(
    initialYears.find(({ isActive }) => isActive)?.id ??
      initialYears[0]?.id ??
      "",
  );
  const [targetYearId, setTargetYearId] = useState(
    initialYears.find(
      ({ id }) =>
        id !==
        (initialYears.find(({ isActive }) => isActive)?.id ??
          initialYears[0]?.id),
    )?.id ?? "",
  );
  const [sourceFolders, setSourceFolders] = useState<FolderOption[]>([]);
  const [targetFolders, setTargetFolders] = useState<FolderOption[]>([]);
  const [sourceFolderId, setSourceFolderId] = useState("");
  const [targetParentId, setTargetParentId] = useState("");
  const [copyPermissions, setCopyPermissions] = useState(true);
  const [preview, setPreview] = useState<CopyPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sourceYear = useMemo(
    () => years.find(({ id }) => id === sourceYearId),
    [sourceYearId, years],
  );
  const targetYear = useMemo(
    () => years.find(({ id }) => id === targetYearId),
    [targetYearId, years],
  );

  async function createYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson<{ data: AcademicYear }>(
        "/api/academic-years",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            startsOn: startsOn || undefined,
            endsOn: endsOn || undefined,
            isActive: activateNew,
          }),
        },
      );
      const created = normalizeYear(body.data);
      setYears((current) => [
        created,
        ...current.map((year) => ({
          ...year,
          isActive: created.isActive ? false : year.isActive,
        })),
      ]);
      setName("");
      setStartsOn("");
      setEndsOn("");
      setActivateNew(false);
      setMessage("Đã tạo năm học và kho dùng chung tương ứng.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tạo năm học",
      );
    } finally {
      setBusy(false);
    }
  }

  async function activateYear(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson<{ data: AcademicYear }>(
        `/api/academic-years/${id}/activate`,
        { method: "POST" },
      );
      const activated = normalizeYear(body.data);
      setYears((current) =>
        current.map((year) =>
          year.id === id
            ? activated
            : {
                ...year,
                isActive: false,
              },
        ),
      );
      setMessage(`Đã kích hoạt năm học ${activated.name}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể kích hoạt năm học",
      );
    } finally {
      setBusy(false);
    }
  }

  async function editYear(year: AcademicYear) {
    const nextName = window.prompt("Tên năm học:", year.name);
    if (!nextName) return;
    const nextStartsOn = window.prompt(
      "Ngày bắt đầu (YYYY-MM-DD, để trống nếu không có):",
      year.startsOn ?? "",
    );
    if (nextStartsOn === null) return;
    const nextEndsOn = window.prompt(
      "Ngày kết thúc (YYYY-MM-DD, để trống nếu không có):",
      year.endsOn ?? "",
    );
    if (nextEndsOn === null) return;

    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson<{ data: AcademicYear }>(
        `/api/academic-years/${year.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nextName,
            startsOn: nextStartsOn || null,
            endsOn: nextEndsOn || null,
          }),
        },
      );
      const updated = normalizeYear(body.data);
      setYears((current) =>
        current.map((item) => (item.id === year.id ? updated : item)),
      );
      setMessage("Đã cập nhật năm học.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể cập nhật năm học",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadFolders(yearId: string, purpose: "source" | "target") {
    if (!yearId) return;
    setBusy(true);
    setMessage(null);
    setPreview(null);
    try {
      const body = await requestJson<{ data: FolderOption[] }>(
        `/api/academic-years/${yearId}/folders?purpose=${purpose}`,
      );
      if (purpose === "source") {
        const sources = body.data.filter(({ isSystemRoot }) => !isSystemRoot);
        setSourceFolders(sources);
        setSourceFolderId(sources[0]?.id ?? "");
      } else {
        setTargetFolders(body.data);
        setTargetParentId(body.data[0]?.id ?? "");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách thư mục",
      );
    } finally {
      setBusy(false);
    }
  }

  function copyPayload() {
    return {
      targetParentId,
      copyPermissions,
      copyDocuments: false,
    };
  }

  async function previewCopy() {
    if (!sourceFolderId || !targetParentId) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson<{ data: CopyPreview }>(
        `/api/folders/${sourceFolderId}/copy/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copyPayload()),
        },
      );
      setPreview(body.data);
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error ? error.message : "Không thể xem trước kết quả",
      );
    } finally {
      setBusy(false);
    }
  }

  async function executeCopy() {
    if (
      !preview ||
      !window.confirm(
        `Sao chép ${preview.folderCount} thư mục sang ${targetYear?.name ?? "năm đích"}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const body = await requestJson<{
        data: {
          copiedRootId: string;
          folderCount: number;
          permissionCount: number;
          documentCountExcluded: number;
        };
      }>(`/api/folders/${sourceFolderId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copyPayload()),
      });
      setPreview(null);
      if (targetYearId) await loadFolders(targetYearId, "target");
      setMessage(
        `Đã sao chép ${body.data.folderCount} thư mục và ${body.data.permissionCount} ACL. ` +
          `${body.data.documentCountExcluded} tài liệu được giữ lại ở năm nguồn.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể sao chép cấu trúc",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 grid gap-8">
      {message ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {isAdmin ? (
        <form
          className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/5 md:grid-cols-4"
          onSubmit={createYear}
        >
          <h2 className="text-xl font-semibold md:col-span-4">
            Tạo năm học mới
          </h2>
          <label className="grid gap-2 text-sm font-medium">
            Tên năm học
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              maxLength={100}
              minLength={3}
              onChange={(event) => setName(event.target.value)}
              placeholder="2026-2027"
              required
              value={name}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Ngày bắt đầu
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              onChange={(event) => setStartsOn(event.target.value)}
              type="date"
              value={startsOn}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Ngày kết thúc
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              onChange={(event) => setEndsOn(event.target.value)}
              type="date"
              value={endsOn}
            />
          </label>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={activateNew}
                onChange={(event) => setActivateNew(event.target.checked)}
                type="checkbox"
              />
              Kích hoạt ngay
            </label>
            <button
              className="ml-auto rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              Tạo
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {years.map((year) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-5"
            key={year.id}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950">
                {year.name}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  year.isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {year.isActive ? "Đang hoạt động" : "Không hoạt động"}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {year.startsOn ?? "Chưa đặt ngày"} →{" "}
              {year.endsOn ?? "Chưa đặt ngày"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {year.folderCount} thư mục
            </p>
            {isAdmin ? (
              <div className="mt-4 flex gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                  disabled={busy}
                  onClick={() => editYear(year)}
                  type="button"
                >
                  Chỉnh sửa
                </button>
                {!year.isActive ? (
                  <button
                    className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800"
                    disabled={busy}
                    onClick={() => activateYear(year.id)}
                    type="button"
                  >
                    Kích hoạt
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/5">
        <h2 className="text-xl font-semibold">
          Sao chép một nhánh sang năm mới
        </h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <fieldset className="grid gap-3 rounded-2xl bg-slate-50 p-4">
            <legend className="px-2 font-semibold">Nguồn</legend>
            <label className="grid gap-2 text-sm font-medium">
              Năm học nguồn
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                onChange={(event) => {
                  setSourceYearId(event.target.value);
                  setSourceFolders([]);
                  setSourceFolderId("");
                  setPreview(null);
                }}
                value={sourceYearId}
              >
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
              disabled={busy || !sourceYearId}
              onClick={() => loadFolders(sourceYearId, "source")}
              type="button"
            >
              Tải thư mục nguồn
            </button>
            <label className="grid gap-2 text-sm font-medium">
              Nhánh nguồn
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                disabled={sourceFolders.length === 0}
                onChange={(event) => {
                  setSourceFolderId(event.target.value);
                  setPreview(null);
                }}
                value={sourceFolderId}
              >
                <option value="">Chọn nhánh nguồn</option>
                {sourceFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="grid gap-3 rounded-2xl bg-slate-50 p-4">
            <legend className="px-2 font-semibold">Đích</legend>
            <label className="grid gap-2 text-sm font-medium">
              Năm học đích
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                onChange={(event) => {
                  setTargetYearId(event.target.value);
                  setTargetFolders([]);
                  setTargetParentId("");
                  setPreview(null);
                }}
                value={targetYearId}
              >
                <option value="">Chọn năm học đích</option>
                {years
                  .filter(({ id }) => id !== sourceYearId)
                  .map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
              disabled={busy || !targetYearId}
              onClick={() => loadFolders(targetYearId, "target")}
              type="button"
            >
              Tải thư mục đích
            </button>
            <label className="grid gap-2 text-sm font-medium">
              Thư mục cha đích
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                disabled={targetFolders.length === 0}
                onChange={(event) => {
                  setTargetParentId(event.target.value);
                  setPreview(null);
                }}
                value={targetParentId}
              >
                <option value="">Chọn thư mục đích</option>
                {targetFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm font-medium">
          <input
            checked={copyPermissions}
            onChange={(event) => {
              setCopyPermissions(event.target.checked);
              setPreview(null);
            }}
            type="checkbox"
          />
          Sao chép ACL trực tiếp của từng thư mục
        </label>
        <p className="mt-2 text-sm text-slate-500">
          Nguồn: {sourceYear?.name ?? "chưa chọn"} · Đích:{" "}
          {targetYear?.name ?? "chưa chọn"} · Không sao chép tài liệu.
        </p>

        <button
          className="mt-5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy || !sourceFolderId || !targetParentId}
          onClick={previewCopy}
          type="button"
        >
          Xem trước kết quả
        </button>

        {preview ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="font-semibold text-emerald-950">
              Kết quả xem trước
            </h3>
            <ul className="mt-3 grid gap-1 text-sm text-emerald-950">
              <li>{preview.folderCount} thư mục sẽ được tạo.</li>
              <li>{preview.permissionCount} ACL trực tiếp sẽ được sao chép.</li>
              <li>
                {preview.documentCountExcluded} tài liệu sẽ không được sao chép.
              </li>
            </ul>
            {preview.warnings.map((warning) => (
              <p className="mt-2 text-sm text-amber-800" key={warning}>
                {warning}
              </p>
            ))}
            <button
              className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={executeCopy}
              type="button"
            >
              Xác nhận sao chép
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
