import { describe, expect, it } from "vitest";

import { searchSchema } from "./search.validation";

describe("search query validation", () => {
  it("trims keywords and applies pagination defaults", () => {
    expect(searchSchema.parse({ q: "  giáo án  " })).toMatchObject({
      q: "giáo án",
      type: "all",
      page: 1,
      limit: 25,
    });
  });

  it("rejects one-character searches and unsupported file types", () => {
    expect(searchSchema.safeParse({ q: "a" }).success).toBe(false);
    expect(
      searchSchema.safeParse({ q: "giáo án", fileType: "exe" }).success,
    ).toBe(false);
  });
});
