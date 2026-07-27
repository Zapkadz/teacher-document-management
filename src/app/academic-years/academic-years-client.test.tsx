import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AcademicYearsClient } from "./academic-years-client";

const years = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "2025-2026",
    startsOn: "2025-08-01",
    endsOn: "2026-05-31",
    isActive: true,
    createdAt: "2025-07-01T00:00:00.000Z",
    updatedAt: "2025-07-01T00:00:00.000Z",
    rootFolder: {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Kho dùng chung · 2025-2026",
    },
    folderCount: 3,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "2026-2027",
    startsOn: "2026-08-01",
    endsOn: "2027-05-31",
    isActive: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    rootFolder: {
      id: "20000000-0000-4000-8000-000000000002",
      name: "Kho dùng chung · 2026-2027",
    },
    folderCount: 1,
  },
];

describe("AcademicYearsClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows years and loads permission-aware source folders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              name: "Khối 1",
              parentId: "20000000-0000-4000-8000-000000000001",
              label: "Kho dùng chung · 2025-2026 / Khối 1",
              isSystemRoot: false,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AcademicYearsClient initialYears={years} isAdmin={false} />);

    expect(screen.getAllByText("2025-2026").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Tải thư mục nguồn" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/academic-years/10000000-0000-4000-8000-000000000001/folders?purpose=source",
    );
    expect(await screen.findByText(/Khối 1/)).toBeDefined();
  });
});
