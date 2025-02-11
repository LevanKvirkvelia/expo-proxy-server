import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToS3(
  fileBuffer: Buffer,
  hash: string,
  mimeType?: string
) {
  const command = new PutObjectCommand({
    Bucket: "gera-ai",
    Key: hash,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
}

export async function isFileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: "gera-ai",
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}
