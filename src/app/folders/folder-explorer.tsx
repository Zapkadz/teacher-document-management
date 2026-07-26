"use client";

import { useEffect, useMemo, useState } from "react";

import { PermissionPanel } from "./permission-panel";

type Workspace = "PERSONAL" | "SHARED";

type OwnerOption = {
  id: string;
  email: string;
  fullName: string | null;
};

type TreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  workspaceType: Workspace;
  ownerUserId: string | null;
  isLocked: boolean;
  sortOrder: number;
  deletedAt: string | null;
  hasChildren: boolean;
  isSystemRoot: boolean;
};

type FolderDetails = TreeNode & {
  inheritPermissions: boolean;
  lockDescendants: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  breadcrumbs: Array<{ id: string; name: string }>;
  capabilities: {
    canCreateSubfolder: boolean;
    canRename: boolean;
    canMove: boolean;
    canDelete: boolean;
    canRestore: boolean;
    canManagePermissions: boolean;
  };
};

type ApiErrorBody = {
  error?: {
    message?: string;
  };
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? "Không thể hoàn tất thao tác");
  }

  return (await response.json()) as T;
}

function FolderTree({
  nodes,
  childrenByParent,
  expandedIds,
  selectedId,
  onExpand,
  onSelect,
}: {
  nodes: TreeNode[];
  childrenByParent: Record<string, TreeNode[]>;
  expandedIds: Set<string>;
  selectedId?: string;
  onExpand: (node: TreeNode) => void;
  onSelect: (node: TreeNode) => void;
}) {
  if (nodes.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Không có thư mục có thể hiển thị.
      </p>
    );
  }

  return (
    <ul className="grid gap-1" role="tree">
      {nodes.map((node) => {
        const expanded = expandedIds.has(node.id);
        const children = childrenByParent[node.id] ?? [];

        return (
          <li
            aria-selected={selectedId === node.id}
            key={node.id}
            role="treeitem"
          >
            <div
              className={`flex items-center gap-1 rounded-lg ${
                selectedId === node.id
                  ? "bg-emerald-100 text-emerald-950"
                  : "hover:bg-slate-100"
              }`}
            >
              <button
                aria-label={
                  expanded ? `Thu gọn ${node.name}` : `Mở rộng ${node.name}`
                }
                className="h-8 w-8 shrink-0 rounded text-slate-500 disabled:opacity-30"
                disabled={!node.hasChildren}
                onClick={() => onExpand(node)}
                type="button"
              >
                {node.hasChildren ? (expanded ? "▾" : "▸") : "·"}
              </button>
              <button
                className="min-w-0 flex-1 truncate py-2 pr-2 text-left text-sm font-medium"
                onClick={() => onSelect(node)}
                title={node.name}
                type="button"
              >
                <span aria-hidden="true" className="mr-2">
                  {node.isLocked ? "🔒" : "📁"}
                </span>
                {node.name}
              </button>
            </div>
            {expanded ? (
              <div className="ml-5 border-l border-slate-200 pl-2">
                <FolderTree
                  childrenByParent={childrenByParent}
                  expandedIds={expandedIds}
                  nodes={children}
                  onExpand={onExpand}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function collectLoadedNodes(
  roots: TreeNode[],
  childrenByParent: Record<string, TreeNode[]>,
): TreeNode[] {
  const result: TreeNode[] = [];
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node);
      visit(childrenByParent[node.id] ?? []);
    }
  };
  visit(roots);
  return result;
}

export function FolderExplorer({
  currentUserId,
  isAdmin,
  owners,
}: {
  currentUserId: string;
  isAdmin: boolean;
  owners: OwnerOption[];
}) {
  const [workspace, setWorkspace] = useState<Workspace>("PERSONAL");
  const [ownerUserId, setOwnerUserId] = useState(currentUserId);
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<
    Record<string, TreeNode[]>
  >({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<FolderDetails | null>(null);
  const [trash, setTrash] = useState<TreeNode[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadedNodes = useMemo(
    () => collectLoadedNodes(roots, childrenByParent),
    [childrenByParent, roots],
  );

  function treeUrl(options?: { rootId?: string; deleted?: boolean }) {
    const query = new URLSearchParams({
      workspace: workspace.toLowerCase(),
    });
    if (workspace === "PERSONAL") {
      query.set("ownerUserId", ownerUserId);
    }
    if (options?.rootId) query.set("rootId", options.rootId);
    if (options?.deleted) query.set("deleted", "true");
    return `/api/folders/tree?${query.toString()}`;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRoot() {
      setBusy(true);
      setMessage(null);
      setSelected(null);
      setChildrenByParent({});
      setExpandedIds(new Set());
      setShowTrash(false);

      try {
        const body = await requestJson<{ data: TreeNode[] }>(treeUrl());
        if (!cancelled) setRoots(body.data);
      } catch (error) {
        if (!cancelled) {
          setRoots([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "Không thể tải cây thư mục",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void loadRoot();
    return () => {
      cancelled = true;
    };
    // treeUrl is intentionally derived from these two state values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, workspace]);

  async function reloadTree(successMessage?: string) {
    setBusy(true);
    try {
      const body = await requestJson<{ data: TreeNode[] }>(treeUrl());
      setRoots(body.data);
      setChildrenByParent({});
      setExpandedIds(new Set());
      setSelected(null);
      setMoveMode(false);
      setPermissionOpen(false);
      setMessage(successMessage ?? null);
      if (showTrash) {
        const trashBody = await requestJson<{ data: TreeNode[] }>(
          treeUrl({ deleted: true }),
        );
        setTrash(trashBody.data);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải lại");
    } finally {
      setBusy(false);
    }
  }

  async function expandNode(node: TreeNode) {
    if (!node.hasChildren) return;

    if (expandedIds.has(node.id)) {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(node.id);
        return next;
      });
      return;
    }

    try {
      if (!childrenByParent[node.id]) {
        const body = await requestJson<{ data: TreeNode[] }>(
          treeUrl({ rootId: node.id }),
        );
        setChildrenByParent((current) => ({
          ...current,
          [node.id]: body.data,
        }));
      }
      setExpandedIds((current) => new Set(current).add(node.id));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tải thư mục con",
      );
    }
  }

  async function selectNode(node: TreeNode) {
    setMessage(null);
    try {
      const body = await requestJson<{ data: FolderDetails }>(
        `/api/folders/${node.id}`,
      );
      setSelected(body.data);
      setMoveMode(false);
      setPermissionOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể mở thư mục",
      );
    }
  }

  async function createChild() {
    if (!selected) return;
    const name = window.prompt("Tên thư mục mới:");
    if (!name) return;

    setBusy(true);
    try {
      await requestJson("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentId: selected.id,
          workspaceType: selected.workspaceType,
        }),
      });
      await reloadTree("Đã tạo thư mục.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo");
      setBusy(false);
    }
  }

  async function renameSelected() {
    if (!selected) return;
    const name = window.prompt("Tên thư mục mới:", selected.name);
    if (!name || name === selected.name) return;

    setBusy(true);
    try {
      await requestJson(`/api/folders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await reloadTree("Đã đổi tên thư mục.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đổi tên");
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (
      !selected ||
      !window.confirm(
        `Xóa mềm “${selected.name}” và toàn bộ thư mục con? Bạn có thể khôi phục sau.`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await requestJson(`/api/folders/${selected.id}`, { method: "DELETE" });
      await reloadTree("Đã chuyển thư mục vào thùng rác.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa");
      setBusy(false);
    }
  }

  async function moveSelected() {
    if (!selected || !moveTargetId) return;
    setBusy(true);
    try {
      await requestJson(`/api/folders/${selected.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetParentId: moveTargetId }),
      });
      await reloadTree("Đã di chuyển thư mục.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể di chuyển",
      );
      setBusy(false);
    }
  }

  async function toggleTrash() {
    if (showTrash) {
      setShowTrash(false);
      return;
    }

    setBusy(true);
    try {
      const body = await requestJson<{ data: TreeNode[] }>(
        treeUrl({ deleted: true }),
      );
      setTrash(body.data);
      setShowTrash(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể tải thùng rác",
      );
    } finally {
      setBusy(false);
    }
  }

  async function restore(node: TreeNode) {
    setBusy(true);
    try {
      await requestJson(`/api/folders/${node.id}/restore`, { method: "POST" });
      await reloadTree("Đã khôi phục thư mục và toàn bộ nhánh.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể khôi phục",
      );
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            workspace === "PERSONAL"
              ? "bg-emerald-700 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
          onClick={() => setWorkspace("PERSONAL")}
          type="button"
        >
          Kho của tôi
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            workspace === "SHARED"
              ? "bg-emerald-700 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
          onClick={() => setWorkspace("SHARED")}
          type="button"
        >
          Kho dùng chung
        </button>
        {isAdmin && workspace === "PERSONAL" ? (
          <label className="ml-auto flex items-center gap-2 text-sm">
            Kho của
            <select
              className="max-w-64 rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setOwnerUserId(event.target.value)}
              value={ownerUserId}
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.fullName ?? owner.email} — {owner.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="grid min-h-128 md:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Cây thư mục</h2>
            <button
              className="text-sm font-medium text-emerald-700 underline underline-offset-4"
              onClick={toggleTrash}
              type="button"
            >
              {showTrash ? "Đóng thùng rác" : "Thùng rác"}
            </button>
          </div>

          {showTrash ? (
            <div className="grid gap-2">
              {trash.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Chưa có thư mục đã xóa.
                </p>
              ) : (
                trash.map((node) => (
                  <div
                    className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"
                    key={node.id}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      🗑️ {node.name}
                    </span>
                    <button
                      className="text-sm font-semibold text-emerald-700"
                      disabled={busy}
                      onClick={() => restore(node)}
                      type="button"
                    >
                      Khôi phục
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <FolderTree
              childrenByParent={childrenByParent}
              expandedIds={expandedIds}
              nodes={roots}
              onExpand={expandNode}
              onSelect={selectNode}
              selectedId={selected?.id}
            />
          )}
        </aside>

        <div className="min-w-0 p-5 sm:p-7">
          {message ? (
            <p
              className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
              role="status"
            >
              {message}
            </p>
          ) : null}

          {selected ? (
            <>
              <nav
                aria-label="Breadcrumb"
                className="flex flex-wrap items-center gap-2 text-sm text-slate-500"
              >
                {selected.breadcrumbs.map((item, index) => (
                  <span className="flex items-center gap-2" key={item.id}>
                    {index > 0 ? <span aria-hidden="true">/</span> : null}
                    <button
                      className="hover:text-emerald-800 hover:underline"
                      onClick={() =>
                        selectNode({
                          ...selected,
                          id: item.id,
                          name: item.name,
                        })
                      }
                      type="button"
                    >
                      {item.name}
                    </button>
                  </span>
                ))}
              </nav>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-emerald-700">
                    {selected.workspaceType === "PERSONAL"
                      ? "Kho cá nhân"
                      : "Kho dùng chung"}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    {selected.name}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.capabilities.canCreateSubfolder ? (
                    <button
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                      disabled={busy}
                      onClick={createChild}
                      type="button"
                    >
                      + Tạo thư mục
                    </button>
                  ) : null}
                  {selected.capabilities.canRename ? (
                    <button
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                      disabled={busy}
                      onClick={renameSelected}
                      type="button"
                    >
                      Đổi tên
                    </button>
                  ) : null}
                  {selected.capabilities.canMove ? (
                    <button
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                      disabled={busy}
                      onClick={() => setMoveMode(true)}
                      type="button"
                    >
                      Di chuyển
                    </button>
                  ) : null}
                  {selected.capabilities.canDelete ? (
                    <button
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
                      disabled={busy}
                      onClick={deleteSelected}
                      type="button"
                    >
                      Xóa
                    </button>
                  ) : null}
                  {selected.capabilities.canManagePermissions ? (
                    <button
                      className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800"
                      disabled={busy}
                      onClick={() => setPermissionOpen((current) => !current)}
                      type="button"
                    >
                      Phân quyền
                    </button>
                  ) : null}
                </div>
              </div>

              {permissionOpen ? (
                <PermissionPanel
                  folderId={selected.id}
                  folderName={selected.name}
                  onClose={() => setPermissionOpen(false)}
                />
              ) : null}

              {moveMode ? (
                <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <label className="grid flex-1 gap-2 text-sm font-medium">
                    Chọn thư mục đích đã mở trong cây
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                      onChange={(event) => setMoveTargetId(event.target.value)}
                      value={moveTargetId}
                    >
                      <option value="">Chọn thư mục đích</option>
                      {loadedNodes
                        .filter((node) => node.id !== selected.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white"
                    disabled={busy || !moveTargetId}
                    onClick={moveSelected}
                    type="button"
                  >
                    Xác nhận
                  </button>
                  <button
                    className="rounded-lg px-4 py-2 text-sm font-medium"
                    onClick={() => setMoveMode(false)}
                    type="button"
                  >
                    Hủy
                  </button>
                </div>
              ) : null}

              <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="font-medium text-slate-700">
                  Thư mục này chưa có tài liệu.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Upload và tài liệu được triển khai sau permission engine.
                </p>
              </div>
            </>
          ) : (
            <div className="flex min-h-96 items-center justify-center text-center">
              <div>
                <p className="text-lg font-medium text-slate-700">
                  Chọn một thư mục để bắt đầu
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Mở từng nhánh ở cây bên trái. Hệ thống chỉ tải một cấp thư mục
                  mỗi lần.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
