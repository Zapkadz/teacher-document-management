import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";

import { assertValidMoveTopology } from "./folder-topology";

describe("folder move topology", () => {
  it("allows moving a subtree to an unrelated parent", () => {
    expect(() =>
      assertValidMoveTopology({
        sourceId: "source",
        targetParentId: "target",
        targetAncestorIds: ["root", "target"],
        targetDepth: 2,
        subtreeHeight: 3,
        maxDepth: 20,
      }),
    ).not.toThrow();
  });

  it("prevents moving a folder into itself", () => {
    expect(() =>
      assertValidMoveTopology({
        sourceId: "source",
        targetParentId: "source",
        targetAncestorIds: ["root", "source"],
        targetDepth: 2,
        subtreeHeight: 1,
        maxDepth: 20,
      }),
    ).toThrowError(AppError);
  });

  it("prevents moving a folder into its descendant", () => {
    expect(() =>
      assertValidMoveTopology({
        sourceId: "source",
        targetParentId: "descendant",
        targetAncestorIds: ["root", "source", "descendant"],
        targetDepth: 3,
        subtreeHeight: 2,
        maxDepth: 20,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "INVALID_MOVE",
      }),
    );
  });

  it("prevents a move that exceeds the configured depth", () => {
    expect(() =>
      assertValidMoveTopology({
        sourceId: "source",
        targetParentId: "target",
        targetAncestorIds: ["root", "target"],
        targetDepth: 19,
        subtreeHeight: 2,
        maxDepth: 20,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "MAX_FOLDER_DEPTH_EXCEEDED",
      }),
    );
  });
});
