import { AppError } from "@/lib/errors/app-error";

type MoveTopology = {
  sourceId: string;
  targetParentId: string;
  targetAncestorIds: string[];
  targetDepth: number;
  subtreeHeight: number;
  maxDepth: number;
};

export function assertValidMoveTopology(input: MoveTopology): void {
  if (
    input.sourceId === input.targetParentId ||
    input.targetAncestorIds.includes(input.sourceId)
  ) {
    throw new AppError(
      "INVALID_MOVE",
      "Không thể di chuyển thư mục vào chính nó hoặc thư mục con của nó",
      409,
    );
  }

  if (input.targetDepth + input.subtreeHeight > input.maxDepth) {
    throw new AppError(
      "MAX_FOLDER_DEPTH_EXCEEDED",
      `Cây thư mục không được vượt quá ${input.maxDepth} cấp`,
      409,
    );
  }
}

export function getMaxFolderDepth(): number {
  const parsed = Number.parseInt(process.env.MAX_FOLDER_DEPTH ?? "20", 10);

  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 100) {
    return 20;
  }

  return parsed;
}
