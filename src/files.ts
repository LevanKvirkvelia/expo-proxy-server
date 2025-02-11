import { cache } from "./localcache";
import { rootSupabase } from "./supabase";

export async function getLatestSnapshot(projectId: string) {
  const cacheKey = `latest-snapshot-${projectId}`;
  let latestSnapshotId = await cache.get(cacheKey);

  if (!latestSnapshotId) {
    const result = await rootSupabase
      .from("projects")
      .select("latest_snapshot_id")
      .eq("id", projectId)
      .single();

    if (!result.data) throw new Error("Project not found");
    if (!result.data.latest_snapshot_id) throw new Error("Snapshot not found");

    latestSnapshotId = result.data.latest_snapshot_id;
    await cache.set(cacheKey, latestSnapshotId, 10 * 1000);
  }

  return latestSnapshotId;
}

export async function fetchProjectInfo(projectId: string): Promise<{
  title: string;
}> {
  const cacheKey = `project-info-${projectId}`;
  const _result = await cache.get(cacheKey);
  if (_result) return _result;

  const result = await rootSupabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .single();

  if (!result.data) throw new Error("Project not found");

  const info = {
    title: result.data.title!,
  };

  await cache.set(cacheKey, info, 60 * 1000);

  return info;
}

export async function fetchProjectSnapshotFiles(
  projectId: string,
  snapshotId: string
): Promise<Record<string, string>> {
  let result = await cache.get(`snapshot-${projectId}-${snapshotId}`);

  result = await rootSupabase
    .from("snapshots")
    .select("bundle_map")
    .eq("project_id", projectId)
    .eq("id", snapshotId)
    .single();

  if (!result.data) throw new Error("Snapshot not found");

  await cache.set(
    `snapshot-${projectId}-${snapshotId}`,
    result.data.bundle_map
  );

  return result.data.bundle_map ?? {};
}

export async function fetchProjectAndSnapshotFiles(
  projectId: string,
  snapshotId: string
) {
  const [projectInfo, fileMap] = await Promise.all([
    fetchProjectInfo(projectId),
    fetchProjectSnapshotFiles(projectId, snapshotId),
  ]);

  return { ...projectInfo, fileMap };
}
