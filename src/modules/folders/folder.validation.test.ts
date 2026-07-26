import { describe, expect, it } from "vitest";

import { folderNameSchema, folderTreeQuerySchema } from "./folder.validation";

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
});
