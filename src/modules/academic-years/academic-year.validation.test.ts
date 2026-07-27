import { describe, expect, it } from "vitest";

import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
} from "./academic-year.validation";

describe("academic year validation", () => {
  it("parses a valid academic year", () => {
    const value = createAcademicYearSchema.parse({
      name: "2026-2027",
      startsOn: "2026-08-01",
      endsOn: "2027-05-31",
    });

    expect(value.name).toBe("2026-2027");
    expect(value.startsOn).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(value.isActive).toBe(false);
  });

  it("rejects an inverted date range", () => {
    expect(() =>
      createAcademicYearSchema.parse({
        name: "2026-2027",
        startsOn: "2027-05-31",
        endsOn: "2026-08-01",
      }),
    ).toThrow();
  });

  it("requires an update field", () => {
    expect(() => updateAcademicYearSchema.parse({})).toThrow();
  });
});
