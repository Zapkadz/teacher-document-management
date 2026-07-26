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
});
