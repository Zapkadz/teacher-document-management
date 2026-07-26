import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FolderExplorer } from "./folder-explorer";

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("FolderExplorer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the root first and fetches children only when expanded", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          data: [
            {
              id: "root-id",
              name: "Kho của tôi",
              parentId: null,
              workspaceType: "PERSONAL",
              ownerUserId: "user-id",
              isLocked: false,
              sortOrder: 0,
              deletedAt: null,
              hasChildren: true,
              isSystemRoot: true,
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          data: [
            {
              id: "child-id",
              name: "Kế hoạch bài dạy",
              parentId: "root-id",
              workspaceType: "PERSONAL",
              ownerUserId: "user-id",
              isLocked: false,
              sortOrder: 0,
              deletedAt: null,
              hasChildren: false,
              isSystemRoot: false,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FolderExplorer
        currentUserId="user-id"
        isAdmin={false}
        owners={[
          {
            id: "user-id",
            email: "teacher@example.com",
            fullName: "Teacher",
          },
        ]}
      />,
    );

    await waitFor(() =>
      expect(screen.getAllByText("Kho của tôi").length).toBeGreaterThan(1),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Mở rộng Kho của tôi" }),
    );

    expect(await screen.findByText("Kế hoạch bài dạy")).toBeDefined();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("rootId=root-id");
  });

  it("opens the permission panel and distinguishes direct from inherited grants", async () => {
    const root = {
      id: "root-id",
      name: "Kho phân quyền",
      parentId: null,
      workspaceType: "PERSONAL",
      ownerUserId: "user-id",
      inheritPermissions: true,
      isLocked: false,
      lockDescendants: false,
      sortOrder: 0,
      deletedAt: null,
      hasChildren: false,
      isSystemRoot: true,
      createdBy: "user-id",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      breadcrumbs: [{ id: "root-id", name: "Kho phân quyền" }],
      capabilities: {
        canCreateSubfolder: true,
        canRename: false,
        canMove: false,
        canDelete: false,
        canRestore: false,
        canManagePermissions: true,
      },
    };
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`/api/folders/${root.id}/documents`)) {
        return jsonResponse({ data: [] });
      }
      if (url.includes(`/api/folders/${root.id}/permissions`)) {
        return jsonResponse({
          data: {
            folderId: root.id,
            inheritPermissions: true,
            direct: [
              {
                id: "direct-id",
                folderId: root.id,
                folderName: root.name,
                source: "DIRECT",
                principalType: "USER",
                principal: {
                  id: "teacher-id",
                  name: "Giáo viên A",
                  email: "a@example.com",
                },
                permissions: ["VIEW", "PREVIEW"],
                appliesToDescendants: true,
              },
            ],
            inherited: [
              {
                id: "inherited-id",
                folderId: "parent-id",
                folderName: "Kho cấp trên",
                source: "INHERITED",
                principalType: "GROUP",
                principal: { id: "group-id", name: "Tổ Toán" },
                permissions: ["VIEW"],
                appliesToDescendants: true,
              },
            ],
            effectivePermissions: ["VIEW", "MANAGE_PERMISSIONS"],
            availableUsers: [],
            availableGroups: [],
          },
        });
      }
      if (url === `/api/folders/${root.id}`) {
        return jsonResponse({ data: root });
      }
      return jsonResponse({ data: [root] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FolderExplorer
        currentUserId="user-id"
        isAdmin
        owners={[
          {
            id: "user-id",
            email: "admin@example.com",
            fullName: "Admin",
          },
        ]}
      />,
    );

    fireEvent.click(await screen.findByText("Kho phân quyền"));
    fireEvent.click(await screen.findByRole("button", { name: "Phân quyền" }));

    expect(await screen.findByText("Giáo viên A")).toBeDefined();
    expect(await screen.findByText("Tổ Toán")).toBeDefined();
    expect(screen.getByText("Trực tiếp")).toBeDefined();
    expect(screen.getByText("Từ Kho cấp trên")).toBeDefined();
  });
});
