// lib/apify.js
//
// Talks to Apify's REST API directly (no SDK, keeps the deploy lean).
// Uses the ASYNC run pattern (start → poll status → fetch dataset) rather
// than a synchronous call, because Vercel serverless functions have a hard
// execution time limit and the instagram-scraper actor can take 1-3+
// minutes for several profiles — a sync call would just time out.

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-scraper";

function getToken() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      "APIFY_API_TOKEN is not set. Add it in your Vercel project's Environment Variables."
    );
  }
  return token;
}

// Starts an actor run for the given Instagram profile URLs. Returns the
// Apify run object (contains id, defaultDatasetId, status, etc).
export async function startInstagramScraperRun(profileUrls, resultsLimit = 30) {
  const token = getToken();
  const input = {
    directUrls: profileUrls,
    resultsType: "posts",
    resultsLimit,
    searchType: "user",
  };

  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify run start failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.data; // { id, actId, status, defaultDatasetId, ... }
}

// Checks the status of a run. Returns the run object.
export async function getRunStatus(runId) {
  const token = getToken();
  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify run status check failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.data;
}

// Fetches the dataset items (the actual scraped posts) once a run has
// succeeded.
export async function getDatasetItems(datasetId) {
  const token = getToken();
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify dataset fetch failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Normalizes whatever the user typed (bare handle or full URL) into a full
// profile URL the actor expects.
export function toProfileUrl(handleOrUrl) {
  const trimmed = handleOrUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/?(\?.*)?$/, "/");
  }
  const handle = trimmed.replace(/^@/, "");
  return `https://www.instagram.com/${handle}/`;
}
