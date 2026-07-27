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

  it("accepts an academic year metadata filter", () => {
    const academicYearId = "10000000-0000-4000-8000-000000000001";
    expect(searchSchema.parse({ q: "giáo án", academicYearId })).toMatchObject({
      academicYearId,
    });
  });
});
