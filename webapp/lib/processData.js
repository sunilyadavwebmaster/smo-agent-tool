// lib/processData.js
//
// JS port of scripts/process_data.py — groups raw Apify posts by the
// profile that was actually scraped (inputUrl), not the post's
// ownerUsername (which can point elsewhere on collab/reposted content),
// and computes basic per-account stats.

function sourceAccountFromUrl(inputUrl) {
  if (!inputUrl) return "unknown";
  const parts = inputUrl.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1].toLowerCase() : "unknown";
}

export function normalize(rawPosts, ownerUsername) {
  const byAccount = {};

  for (const post of rawPosts) {
    const account = sourceAccountFromUrl(post.inputUrl);
    if (!byAccount[account]) byAccount[account] = [];
    byAccount[account].push({
      id: post.id,
      shortCode: post.shortCode,
      type: post.type,
      url: post.url,
      caption: post.caption || "",
      hashtags: post.hashtags || [],
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      timestamp: post.timestamp,
      displayUrl: post.displayUrl,
    });
  }

  const accounts = {};
  for (const [account, posts] of Object.entries(byAccount)) {
    const sorted = [...posts].sort((a, b) =>
      (b.timestamp || "").localeCompare(a.timestamp || "")
    );
    const n = sorted.length;
    const likesSum = sorted.reduce((s, p) => s + p.likesCount, 0);
    const commentsSum = sorted.reduce((s, p) => s + p.commentsCount, 0);
    const topPost = sorted.reduce(
      (best, p) => (!best || p.likesCount > best.likesCount ? p : best),
      null
    );

    accounts[account] = {
      is_owner: account === ownerUsername.toLowerCase(),
      post_count: n,
      avg_likes: n ? Math.round((likesSum / n) * 10) / 10 : 0,
      avg_comments: n ? Math.round((commentsSum / n) * 10) / 10 : 0,
      top_post: topPost
        ? {
            url: topPost.url,
            likesCount: topPost.likesCount,
            caption: (topPost.caption || "").slice(0, 140),
          }
        : null,
      posts: sorted,
    };
  }

  return {
    generated_at: new Date().toISOString(),
    owner_username: ownerUsername.toLowerCase(),
    accounts,
  };
}
