import { Context } from "hono";
import { getLatestSnapshot } from "./files";

export async function getSnapshotId(context: Context) {
  if (process.env.NODE_ENV === "development") {
    return {
      projectId: "7aixy5tl555ian66k7n86",
      snapshotId: "3wqckfgwxgjjv852rh2xv",
      isLatest: false,
    };
  }

  const url = new URL(context.req.url);
  const hostname = url.hostname.split(".");

  if (hostname.length !== 3) {
    throw new Error(`Invalid hostname: ${url.hostname}`);
  }

  const subdomain = url.hostname.split(".")[0];

  const [projectId, snapshotId = null] = subdomain.split("-");

  return {
    projectId,
    snapshotId: snapshotId ?? (await getLatestSnapshot(projectId)),
    isLatest: snapshotId === null,
  };
}

export function replaceAllLocalhosts(manifest: string, url: string) {
  const urlObj = new URL(url);
  return manifest
    .replace(
      /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}|https?:\/\/localhost:\d{1,5}/g,
      urlObj.origin
    )
    .replace(/(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}|localhost:\d{1,5}/g, urlObj.host);
}
