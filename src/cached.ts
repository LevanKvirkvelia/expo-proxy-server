import { GetObjectCommand } from "@aws-sdk/client-s3";
import { cache } from "./localcache";
import { Readable } from "stream";
import { s3Client } from "./s3";

export async function* getCachedS3Object(
  bucket: string,
  key: string,
  ttl?: number
): AsyncGenerator<Buffer> {
  const cacheKey = `s3:${bucket}:${key}`;

  // Try to get from cache first
  const cachedFile = await cache.getFile(cacheKey);
  if (cachedFile) {
    yield cachedFile.data;
    return;
  }

  // If not in cache, fetch from S3
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("Asset not found");
  }

  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    chunks.push(buffer);
    yield buffer;
  }

  // Store complete buffer in cache
  const completeBuffer = Buffer.concat(chunks);
  await cache.setFile(
    cacheKey,
    completeBuffer,
    response.ContentType || "application/octet-stream",
    ttl
  );
}
