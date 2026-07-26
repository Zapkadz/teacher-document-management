import { describe, expect, it } from "vitest";

import { canMutateDocument } from "./document.policy";

describe("document ownership policy", () => {
  it("allows own permissions only for the owner", () => {
    expect(
      canMutateDocument("EDIT", "owner", "owner", ["VIEW", "EDIT_OWN"]),
    ).toBe(true);
    expect(
      canMutateDocument("EDIT", "other", "owner", ["VIEW", "EDIT_OWN"]),
    ).toBe(false);
  });

  it("allows any permissions for both owned and foreign documents", () => {
    expect(canMutateDocument("DELETE", "owner", "owner", ["DELETE_ANY"])).toBe(
      true,
    );
    expect(
      canMutateDocument("DELETE", "manager", "owner", ["DELETE_ANY"]),
    ).toBe(true);
  });

  it("keeps edit, move, and delete permissions independent", () => {
    expect(canMutateDocument("MOVE", "owner", "owner", ["EDIT_OWN"])).toBe(
      false,
    );
    expect(canMutateDocument("DELETE", "manager", "owner", ["MOVE_ANY"])).toBe(
      false,
    );
  });
});
