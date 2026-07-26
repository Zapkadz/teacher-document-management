import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the application identity and health link", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Kho hồ sơ giáo dục" }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Kiểm tra trạng thái hệ thống" })
        .getAttribute("href"),
    ).toBe("/api/health");
    expect(
      screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href"),
    ).toBe("/login");
  });
});
