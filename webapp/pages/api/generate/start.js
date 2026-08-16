import { startInstagramScraperRun, toProfileUrl } from "../../../lib/apify";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { ownerHandle, competitors, resultsLimit } = req.body;
    if (!ownerHandle || !Array.isArray(competitors) || competitors.length === 0) {
      return res.status(400).json({ error: "ownerHandle and at least one competitor are required" });
    }

    const allHandles = [ownerHandle, ...competitors].filter(Boolean);
    const urls = allHandles.map(toProfileUrl).filter(Boolean);
    if (urls.length < 2) {
      return res.status(400).json({ error: "Need your handle plus at least one competitor" });
    }

    const limit = Math.max(5, Math.min(100, Number(resultsLimit) || 30));
    const run = await startInstagramScraperRun(urls, limit);

    return res.status(200).json({ runId: run.id, datasetId: run.defaultDatasetId, status: run.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to start run" });
  }
}
