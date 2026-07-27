import { describe, expect, it } from "vitest";

import {
  copyFolderSchema,
  folderNameSchema,
  folderTreeQuerySchema,
  lockFolderSchema,
} from "./folder.validation";

describe("folder validation", () => {
  it("trims a valid folder name", () => {
    expect(folderNameSchema.parse("  Kế hoạch bài dạy  ")).toBe(
      "Kế hoạch bài dạy",
    );
  });

  it.each(["", ".", "..", "a/b", "a\\b", "a\u0000b"])(
    "rejects unsafe folder name %j",
    (name) => {
      expect(folderNameSchema.safeParse(name).success).toBe(false);
    },
  );

  it("parses a lazy tree query without treating false as true", () => {
    expect(
      folderTreeQuerySchema.parse({
        workspace: "personal",
        deleted: "false",
      }),
    ).toMatchObject({
      workspace: "PERSONAL",
      deleted: false,
    });
  });

  it("normalizes descendant lock scope when omitted", () => {
    expect(lockFolderSchema.parse({ locked: true })).toEqual({
      locked: true,
      applyToDescendants: false,
    });
    expect(
      lockFolderSchema.safeParse({
        locked: true,
        applyToDescendants: true,
        bypass: true,
      }).success,
    ).toBe(false);
  });

  it("defaults structure copy safely and rejects document copying", () => {
    const targetParentId = "10000000-0000-4000-8000-000000000001";
    expect(copyFolderSchema.parse({ targetParentId })).toEqual({
      targetParentId,
      copyPermissions: true,
      copyDocuments: false,
    });
    expect(
      copyFolderSchema.safeParse({
        targetParentId,
        copyDocuments: true,
      }).success,
    ).toBe(false);
  });
});
