import { describe, expect, it } from "vitest";

import {
  PERMISSION_PRESETS,
  normalizePermissions,
} from "./permission.constants";

describe("permission normalization", () => {
  it("adds VIEW for dependent permissions and removes duplicates", () => {
    expect(normalizePermissions(["DOWNLOAD", "DOWNLOAD", "EDIT_ANY"])).toEqual([
      "VIEW",
      "DOWNLOAD",
      "EDIT_ANY",
    ]);
  });

  it("keeps presets ordered by the canonical permission list", () => {
    expect(normalizePermissions(PERMISSION_PRESETS.FOLDER_MANAGER)).toEqual(
      PERMISSION_PRESETS.FOLDER_MANAGER,
    );
  });
});
