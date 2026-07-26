import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentPanel } from "./document-panel";

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("DocumentPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads documents and blocks an oversized file before upload init", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (String(input).includes("upload-settings")) {
        return jsonResponse({
          data: {
            maxSizeMb: 1,
            maxSizeBytes: 1024 * 1024,
            allowedExtensions: [".pdf"],
          },
        });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "staged-file-id" });

    const { container } = render(
      <DocumentPanel canUpload folderId="folder-id" />,
    );
    expect(
      await screen.findByText("Thư mục này chưa có tài liệu."),
    ).toBeDefined();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Tải file lên" }));
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const file = new File(["test"], "large.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: 1024 * 1024 + 1 });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(
      await screen.findByText("File vượt quá giới hạn 1 MB"),
    ).toBeDefined();
    expect(
      (
        screen.getByRole("button", {
          name: "Upload các file đã chọn",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
