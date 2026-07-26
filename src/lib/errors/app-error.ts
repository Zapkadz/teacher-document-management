import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu không hợp lệ",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  console.error(error);

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Đã xảy ra lỗi hệ thống",
        details: null,
      },
    },
    { status: 500 },
  );
}
