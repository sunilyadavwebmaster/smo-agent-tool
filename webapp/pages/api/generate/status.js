import { getRunStatus, getDatasetItems, toProfileUrl } from "../../../lib/apify";
import { requireAuth } from "../../../lib/auth";
import { normalize } from "../../../lib/processData";
import { generateIdeatorAndHooks } from "../../../lib/ideator";
import { build30DayCalendar, buildOnlyTrending } from "../../../lib/calendar";
import { renderDashboard } from "../../../lib/renderDashboard";

const TERMINAL_STATES = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { runId, formData } = req.body;
    if (!runId || !formData) return res.status(400).json({ error: "runId and formData are required" });

    const run = await getRunStatus(runId);

    if (!TERMINAL_STATES.includes(run.status)) {
      return res.status(200).json({ status: "RUNNING", apifyStatus: run.status });
    }
    if (run.status !== "SUCCEEDED") {
      return res.status(200).json({ status: "FAILED", apifyStatus: run.status });
    }

    const rawPosts = await getDatasetItems(run.defaultDatasetId);
    const ownerHandle = formData.ownerHandle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");

    const processedData = normalize(rawPosts, ownerHandle);

    const ideatorResult = generateIdeatorAndHooks(processedData, formData);

    const startDate = formData.startDate || new Date().toISOString().slice(0, 10);
    const blockedDates = (formData.blockedDates || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const calendar30 = build30DayCalendar(ideatorResult, processedData, formData, startDate, blockedDates);
    const trending = buildOnlyTrending(ideatorResult, processedData, formData, startDate, blockedDates);

    const html = renderDashboard({
      processedData,
      ideatorResult,
      calendar30,
      trending,
      ownerHandle,
    });

    return res.status(200).json({ status: "READY", html });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to check status" });
  }
}
