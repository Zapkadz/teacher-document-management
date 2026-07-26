import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const storageEnvSchema = z.object({
  S3_ENDPOINT: z.url(),
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

type StorageConfig = z.infer<typeof storageEnvSchema>;

let cachedConfig: StorageConfig | undefined;
let cachedInternalClient: S3Client | undefined;
let cachedPublicClient: S3Client | undefined;

function getStorageConfig(): StorageConfig {
  cachedConfig ??= storageEnvSchema.parse(process.env);
  return cachedConfig;
}

function createClient(endpoint: string) {
  const config = getStorageConfig();
  return new S3Client({
    endpoint,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
}

function getInternalClient() {
  cachedInternalClient ??= createClient(getStorageConfig().S3_ENDPOINT);
  return cachedInternalClient;
}

function getPublicClient() {
  const config = getStorageConfig();
  cachedPublicClient ??= createClient(
    config.S3_PUBLIC_ENDPOINT ?? config.S3_ENDPOINT,
  );
  return cachedPublicClient;
}

export async function createPresignedUpload({
  key,
  mimeType,
  sizeBytes,
  uploadId,
}: {
  key: string;
  mimeType: string;
  sizeBytes: number;
  uploadId: string;
}) {
  const config = getStorageConfig();
  const expiresIn = 15 * 60;
  const metadata = { "upload-session-id": uploadId };
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
    Metadata: metadata,
  });

  return {
    url: await getSignedUrl(getPublicClient(), command, { expiresIn }),
    expiresIn,
    headers: {
      "Content-Type": mimeType,
    },
  };
}

export async function headStoredObject(key: string) {
  const config = getStorageConfig();
  return getInternalClient().send(
    new HeadObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
  );
}

export async function deleteStoredObject(key: string): Promise<void> {
  const config = getStorageConfig();
  await getInternalClient().send(
    new DeleteObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
  );
}

function contentDisposition(mode: "attachment" | "inline", fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function createPresignedDownload({
  key,
  fileName,
  mode,
}: {
  key: string;
  fileName: string;
  mode: "attachment" | "inline";
}) {
  const config = getStorageConfig();
  const expiresIn = 5 * 60;
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    ResponseContentDisposition: contentDisposition(mode, fileName),
  });
  return {
    url: await getSignedUrl(getPublicClient(), command, { expiresIn }),
    expiresIn,
  };
}

export function resetStorageClientForTests() {
  cachedConfig = undefined;
  cachedInternalClient?.destroy();
  cachedPublicClient?.destroy();
  cachedInternalClient = undefined;
  cachedPublicClient = undefined;
}
