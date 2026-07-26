import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";

import {
  assertFolderAccess,
  canAccessFolder,
  type FolderActor,
} from "./folder.policy";

const owner: FolderActor = { id: "owner-1", globalRole: "USER" };
const otherUser: FolderActor = { id: "user-2", globalRole: "USER" };
const admin: FolderActor = { id: "admin-1", globalRole: "ADMIN" };

describe("folder access policy before ACL is introduced", () => {
  it("isolates personal folders by owner", () => {
    const folder = {
      workspaceType: "PERSONAL" as const,
      ownerUserId: owner.id,
    };

    expect(canAccessFolder(owner, folder)).toBe(true);
    expect(canAccessFolder(otherUser, folder)).toBe(false);
    expect(() => assertFolderAccess(otherUser, folder)).toThrowError(AppError);
  });

  it("lets an admin access every personal folder", () => {
    expect(
      canAccessFolder(admin, {
        workspaceType: "PERSONAL",
        ownerUserId: owner.id,
      }),
    ).toBe(true);
  });

  it("does not expose shared folders to regular users before Phase 3 ACL", () => {
    expect(
      canAccessFolder(otherUser, {
        workspaceType: "SHARED",
        ownerUserId: null,
      }),
    ).toBe(false);
  });
});
