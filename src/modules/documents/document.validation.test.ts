import { afterEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";

import {
  isPreviewableMimeType,
  validateExternalUrl,
  validateFile,
} from "./document.validation";

const originalMaxSize = process.env.MAX_FILE_SIZE_MB;
const originalExtensions = process.env.ALLOWED_FILE_EXTENSIONS;

afterEach(() => {
  if (originalMaxSize === undefined) delete process.env.MAX_FILE_SIZE_MB;
  else process.env.MAX_FILE_SIZE_MB = originalMaxSize;
  if (originalExtensions === undefined)
    delete process.env.ALLOWED_FILE_EXTENSIONS;
  else process.env.ALLOWED_FILE_EXTENSIONS = originalExtensions;
});

describe("document file validation", () => {
  it("accepts a valid PDF and generates a storage-safe name", () => {
    expect(
      validateFile({
        fileName: "Giáo án tuần 1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    ).toMatchObject({
      originalFileName: "Giáo án tuần 1.pdf",
      safeFileName: "Giao-an-tuan-1.pdf",
      fileExtension: ".pdf",
    });
  });

  it("rejects path traversal, MIME mismatch, and unsupported files", () => {
    for (const input of [
      {
        fileName: "../secret.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      },
      {
        fileName: "report.pdf",
        mimeType: "text/html",
        sizeBytes: 100,
      },
      {
        fileName: "payload.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 100,
      },
    ]) {
      expect(() => validateFile(input)).toThrowError(AppError);
    }
  });

  it("rejects files above the configured size", () => {
    process.env.MAX_FILE_SIZE_MB = "1";
    expect(() =>
      validateFile({
        fileName: "large.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024 * 1024 + 1,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "FILE_TOO_LARGE", status: 413 }),
    );
  });
});

describe("document link and preview validation", () => {
  it("allows only the configured Google and YouTube hosts over HTTPS", () => {
    expect(
      validateExternalUrl(
        "GOOGLE_DRIVE_LINK",
        "https://drive.google.com/file/d/example/view",
      ),
    ).toContain("drive.google.com");
    expect(
      validateExternalUrl("YOUTUBE_LINK", "https://youtu.be/example-video"),
    ).toContain("youtu.be");
    expect(() =>
      validateExternalUrl(
        "YOUTUBE_LINK",
        "https://youtube.com.evil.example/video",
      ),
    ).toThrowError(AppError);
    expect(() =>
      validateExternalUrl(
        "GOOGLE_DRIVE_LINK",
        "http://drive.google.com/file/example",
      ),
    ).toThrowError(AppError);
  });

  it("previews only PDF and safe image MIME types", () => {
    expect(isPreviewableMimeType("application/pdf")).toBe(true);
    expect(isPreviewableMimeType("image/png")).toBe(true);
    expect(isPreviewableMimeType("image/svg+xml")).toBe(false);
    expect(
      isPreviewableMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(false);
  });
});
