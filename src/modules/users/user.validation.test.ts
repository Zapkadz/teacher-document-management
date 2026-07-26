import { describe, expect, it } from "vitest";

import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "./user.validation";

describe("user validation", () => {
  it("normalizes email and applies safe creation defaults", () => {
    expect(
      createUserSchema.parse({
        email: " Teacher@Example.com ",
        fullName: " Nguyễn Thị A ",
      }),
    ).toEqual({
      email: "teacher@example.com",
      fullName: "Nguyễn Thị A",
      globalRole: "USER",
      status: "ACTIVE",
    });
  });

  it("rejects an empty update", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it("bounds pagination values", () => {
    expect(
      listUsersQuerySchema.safeParse({ page: "0", limit: "101" }).success,
    ).toBe(false);
  });
});
