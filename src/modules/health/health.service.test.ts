import { describe, expect, it, vi } from "vitest";

import { getHealthStatus } from "./health.service";

describe("getHealthStatus", () => {
  it("reports a healthy database", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);

    const result = await getHealthStatus(checkDatabase);

    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("ok");
    expect(result.body.services.database).toBe("up");
    expect(checkDatabase).toHaveBeenCalledOnce();
  });

  it("reports a degraded service without exposing the database error", async () => {
    const checkDatabase = vi
      .fn()
      .mockRejectedValue(new Error("secret connection details"));

    const result = await getHealthStatus(checkDatabase);

    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("degraded");
    expect(result.body.services.database).toBe("down");
    expect(JSON.stringify(result.body)).not.toContain(
      "secret connection details",
    );
  });
});
