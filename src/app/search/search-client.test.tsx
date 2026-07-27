import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchClient } from "./search-client";

describe("SearchClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits metadata filters and renders authorized results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "FOLDER",
              id: "folder-id",
              name: "Giáo án Toán",
              workspaceType: "SHARED",
              creator: {
                id: "owner-id",
                name: "Giáo viên A",
                email: "a@example.com",
              },
              updatedAt: new Date().toISOString(),
            },
          ],
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

    render(<SearchClient isAdmin={false} owners={[]} />);
    fireEvent.change(screen.getByLabelText("Từ khóa"), {
      target: { value: "giáo án" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));

    expect(await screen.findByText("Giáo án Toán")).toBeDefined();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "q=gi%C3%A1o+%C3%A1n",
    );
    expect(screen.getByRole("link", { name: "Mở thư mục" })).toBeDefined();
  });
});
