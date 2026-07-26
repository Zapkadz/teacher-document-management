import { describe, expect, it, vi } from "vitest";

import { evaluateGoogleAccess } from "./google-access";

describe("evaluateGoogleAccess", () => {
  it("allows a verified, pre-provisioned ACTIVE email", async () => {
    const findUser = vi.fn().mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
    });

    const result = await evaluateGoogleAccess(
      { email: " Teacher@Example.com ", emailVerified: true },
      findUser,
    );

    expect(result).toEqual({
      allowed: true,
      email: "teacher@example.com",
      user: { id: "user-1", status: "ACTIVE" },
    });
    expect(findUser).toHaveBeenCalledWith("teacher@example.com");
  });

  it("rejects an email that is not on the allowlist", async () => {
    const result = await evaluateGoogleAccess(
      { email: "unknown@example.com", emailVerified: true },
      vi.fn().mockResolvedValue(null),
    );

    expect(result).toMatchObject({
      allowed: false,
      reason: "EMAIL_NOT_ALLOWLISTED",
    });
  });

  it("rejects a SUSPENDED account", async () => {
    const result = await evaluateGoogleAccess(
      { email: "teacher@example.com", emailVerified: true },
      vi.fn().mockResolvedValue({ id: "user-1", status: "SUSPENDED" }),
    );

    expect(result).toMatchObject({
      allowed: false,
      reason: "ACCOUNT_NOT_ACTIVE",
    });
  });

  it("rejects an unverified Google email before querying the allowlist", async () => {
    const findUser = vi.fn();
    const result = await evaluateGoogleAccess(
      { email: "teacher@example.com", emailVerified: false },
      findUser,
    );

    expect(result).toEqual({
      allowed: false,
      reason: "EMAIL_NOT_VERIFIED",
    });
    expect(findUser).not.toHaveBeenCalled();
  });
});
