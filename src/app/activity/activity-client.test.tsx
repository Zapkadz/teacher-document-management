import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityClient } from "./activity-client";

const initialLog = {
  id: "audit-id",
  action: "DOCUMENT_DOWNLOADED",
  entityType: "DOCUMENT",
  entityId: "document-id",
  folderId: "folder-id",
  folderName: "Giáo án",
  metadata: { originalFileName: "giao-an.pdf" },
  ipAddress: null,
  createdAt: "2026-07-27T01:00:00.000Z",
  actor: {
    id: "user-id",
    name: "Giáo viên A",
    email: "a@example.com",
  },
};

describe("ActivityClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders server-loaded activity and filters using the current user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [initialLog],
          pagination: {
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ActivityClient
        actors={[]}
        currentUserId="user-id"
        initialLogs={[initialLog]}
        initialPagination={{
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
        }}
        isAdmin={false}
      />,
    );

    expect(screen.getAllByText("Document Downloaded")).toHaveLength(2);
    expect(screen.getByText("Giáo viên A")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /áp dụng bộ lọc/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "actorUserId=user-id",
    );
  });
});
