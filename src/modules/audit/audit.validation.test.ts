import { describe, expect, it } from "vitest";

import { listAuditLogsSchema } from "./audit.validation";

describe("audit query validation", () => {
  it("parses bounded pagination and ISO date filters", () => {
    expect(
      listAuditLogsSchema.parse({
        action: "DOCUMENT_DOWNLOADED",
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-07-31T23:59:59.999Z",
        page: "2",
        limit: "50",
      }),
    ).toMatchObject({
      action: "DOCUMENT_DOWNLOADED",
      page: 2,
      limit: 50,
    });
  });

  it("rejects invalid codes, oversized pages, and reversed dates", () => {
    expect(
      listAuditLogsSchema.safeParse({ action: "drop table" }).success,
    ).toBe(false);
    expect(listAuditLogsSchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(
      listAuditLogsSchema.safeParse({
        from: "2026-08-01",
        to: "2026-07-01",
      }).success,
    ).toBe(false);
  });
});
