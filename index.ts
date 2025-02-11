import "dotenv/config";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { stream } from "hono/streaming";
import mime from "mime-types";
import qrcode from "qrcode-terminal";
import { z } from "zod";
import { generateDeepLinkPreview } from "./src/app-preview.html";
import {
  fetchProjectAndSnapshotFiles,
  fetchProjectSnapshotFiles,
} from "./src/files";
import { getLanIP } from "./src/getLanIP";
import { Manifest } from "./src/manifest.type";
import { MultipartResponse } from "./src/mixed-response";
import { toReadableStream } from "./src/response-async-stream";
import { s3Client } from "./src/s3";
import { getCachedS3Object } from "./src/cached";
import { getSnapshotId, replaceAllLocalhosts } from "./src/utils";

console.log("Starting server...");

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get(
  "/message",
  upgradeWebSocket(async (c) => {
    return {
      async onOpen(evt, ws) {
        try {
          const { projectId, snapshotId } = await getSnapshotId(c);
          console.log("WebSocket opened", projectId, snapshotId);
        } catch (error) {
          console.error("Error getting snapshot ID:", error);
        }
      },
      onMessage(evt, ws) {
        if (typeof evt.data !== "string") {
          console.log("Received binary message");
          return;
        }
        // const message = JSON.parse(evt.data);
        console.log("Message received", evt.data);
      },
    };
  })
);

const ERROR_SCHEMA = z.object({
  type: z.literal("log"),
  level: z.literal("error"),
  mode: z.literal("NOBRIDGE"),
  data: z.array(z.string()).or(z.string()),
});

app.get(
  "/hot",
  upgradeWebSocket((c) => ({
    onOpen(evt, ws) {},
    onMessage(evt, ws) {
      if (typeof evt.data !== "string") return;
      const message = JSON.parse(evt.data);
      console.log("Message received", message);
      const error = ERROR_SCHEMA.safeParse(message);
      if (!error.error) {
        console.error("Error message:", error.data.data);
      }
    },
  }))
);

const ALLOWED_PLATFORMS = z
  .union([z.literal("ios"), z.literal("android")])
  .default("ios");

app.get(
  "/assets/*",
  //  compress(),
  async (c) => {
    const { projectId, snapshotId, isLatest } = await getSnapshotId(c);
    const fileMap = await fetchProjectSnapshotFiles(projectId, snapshotId);

    // Extract the unstable_path query parameter
    const url = new URL(c.req.url);
    const unstablePath = url.searchParams.get("unstable_path");

    // Determine the requested asset path
    const requestedAsset = unstablePath
      ? decodeURIComponent(unstablePath)
      : c.req.url.split("/assets/").slice(1).join("/assets/");

    if (!requestedAsset) {
      return c.text("Asset not found", { status: 404 });
    }

    // console.log("Requested asset:", requestedAsset);

    const assetKey = fileMap[requestedAsset] ?? fileMap[`./${requestedAsset}`];
    if (!assetKey) {
      return c.text("Asset not found", { status: 404 });
    }

    console.log("Asset key:", requestedAsset, assetKey);

    c.header("X-Content-Type-Options", "nosniff");
    c.header(
      "Content-Type",
      mime.lookup(requestedAsset) || "application/octet-stream"
    );

    if (isLatest) {
      c.header("Surrogate-Control", "no-store");
      c.header(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      c.header("Pragma", "no-cache");
      c.header("Expires", "0");
    }

    c.header("vary", "Accept-Encoding");

    const chunks: Buffer[] = [];
    for await (const chunk of getCachedS3Object("gera-ai", assetKey)) {
      chunks.push(chunk);
    }
    return c.body(Buffer.concat(chunks));
  }
);

app.get("/status", async (c) => {
  return new Response("packager-status:running", {
    status: 200,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Surrogate-Control": "no-store",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-React-Native-Project-Root": "/Users/levankvirkvelia/tetri-app",
      Connection: "keep-alive",
      "Keep-Alive": "timeout=5",
    },
  });
});

app.get("/", async (c) => {
  if (
    c.req.url.includes("localhost") &&
    process.env.NODE_ENV === "production"
  ) {
    return new Response("ok", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const headerPlatform = c.req.header("expo-platform");
  const platform = ALLOWED_PLATFORMS.parse(headerPlatform);

  const { projectId, snapshotId } = await getSnapshotId(c);
  const { fileMap, title } = await fetchProjectAndSnapshotFiles(
    projectId,
    snapshotId
  );
  let manifest = fileMap[`./.gera/outputs/${platform}/manifest.json`];
  if (!manifest) throw new Error("Manifest not found");
  manifest = replaceAllLocalhosts(manifest, c.req.url);
  const parsedManifest = JSON.parse(manifest) as Manifest;
  parsedManifest.id = crypto.randomUUID();
  parsedManifest.createdAt = new Date().toISOString();
  parsedManifest.extra.expoClient.name = title;

  if (!headerPlatform) {
    return c.html(generateDeepLinkPreview(parsedManifest, c.req.url));
  }

  const mixed = new MultipartResponse();
  mixed.boundary = `--------------------------${crypto.randomUUID()}`;

  mixed.addFile(JSON.stringify(parsedManifest), "application/json", {
    headers: { "Content-Disposition": 'form-data; name="manifest"' },
  });

  return mixed.toResponse({
    "expo-protocol-version": "0",
    "expo-sfv-version": "0",
    "cache-control": "private, max-age=0",
  });
});

app.get("/node_modules/*", compress(), async (c) => {
  const platform = ALLOWED_PLATFORMS.parse(c.req.query("platform"));
  const { snapshotId, projectId, isLatest } = await getSnapshotId(c);
  const fileMap = await fetchProjectSnapshotFiles(projectId, snapshotId);

  const bundleKey = fileMap[`./.gera/outputs/${platform}/bundle.bundle`];

  const bundleStream = await s3Client.send(
    new GetObjectCommand({ Bucket: "gera-ai", Key: bundleKey })
  );

  const boundary = crypto.randomUUID();

  async function* generateMultipartResponse() {
    yield "If you are seeing this, your client does not support multipart response\r\n";
    yield `--${boundary}\r\n`;

    const headers = {
      "X-Metro-Files-Changed-Count": "0",
      "X-Metro-Delta-ID": "5ebd4d45d10e0c73",
      "Content-Location": c.req.url,
      "Last-Modified": new Date().toUTCString(),
      "Content-Length": bundleStream.ContentLength!.toString(),
      "Content-Type": "application/javascript; charset=UTF-8",
    };

    for (const [key, value] of Object.entries(headers)) {
      yield `${key}: ${value}\r\n`;
    }

    yield "\r\n";

    if (bundleStream.Body) {
      for await (const chunk of bundleStream.Body as AsyncIterable<Uint8Array>) {
        yield chunk;
        // yield replaceAllLocalhosts(chunk.toString(), c.req.url);
      }
    }

    yield `\r\n--${boundary}--\r\n`;
  }

  const asyncIterable = generateMultipartResponse();
  return new Response(toReadableStream(asyncIterable), {
    headers: {
      "X-Content-Type-Options": "nosniff",
      ...(isLatest
        ? {
            "Surrogate-Control": "no-store",
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          }
        : {}),
      "Content-Type": `multipart/mixed; boundary="${boundary}"`,
    },
  });
});

app.onError((err, c) => {
  if (!(err instanceof z.ZodError) && !err.message.includes("reading asset")) {
    console.error("An error occurred:", err);
  }
  return c.text(err.message, { status: 500 });
});

console.log("Starting server...");

const PORT = process.env.PORT ? Number(process.env.PORT) : 2228;
const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server: http://${getLanIP()}:${PORT}`);
  qrcode.generate(`exp://${getLanIP()}:${PORT}`, { small: true });
});

injectWebSocket(server);
