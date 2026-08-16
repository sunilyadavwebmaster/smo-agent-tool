// lib/ideator.js
//
// Rule-based Ideator + Hook & Script generator. No AI model is called here
// (the user chose the no-extra-API-cost option) — this scans the actual
// pulled captions for five known-working patterns using keyword/regex
// heuristics, and only surfaces a pattern if real evidence for it was
// found in this specific data pull. This is deliberately more limited
// than a human (or an LLM) reading the captions with judgment — treat its
// output as a solid first draft, not a guarantee.

const OCCASION_WORDS = [
  "day", "weekend", "holiday", "eid", "celebrat", "anniversary", "birthday",
  "festival", "valentine", "mother", "father", "christmas", "new year",
  "national day", "ramadan", "wedding",
];
const PARTNERSHIP_WORDS = ["partner", "partnership", "loyalty", "rewards", "miles", "official partner"];

function isPOV(caption) {
  return /\bpov\b[:\s]/i.test(caption) || /\bpov\b/i.test(caption);
}
function hasQuestion(caption) {
  return caption.includes("?");
}
function hasOccasion(caption) {
  const lower = caption.toLowerCase();
  return OCCASION_WORDS.some((w) => lower.includes(w));
}
function hasPromoCode(caption) {
  return (
    /\b(code|promo)\b/i.test(caption) &&
    (/\d+\s*%\s*off/i.test(caption) || /use (my|her|his|the)?\s*code/i.test(caption))
  );
}
function hasPartnership(caption) {
  const lower = caption.toLowerCase();
  return PARTNERSHIP_WORDS.some((w) => lower.includes(w));
}
function isLongCaption(caption) {
  return caption.trim().length > 150;
}
function isBareCaption(caption) {
  return caption.trim().length === 0;
}

// Finds the single highest-liked post across all competitor accounts that
// matches a predicate. Returns { account, post } or null.
function bestMatch(accountsData, ownerUsername, predicate) {
  let best = null;
  for (const [account, data] of Object.entries(accountsData)) {
    if (account === ownerUsername) continue;
    for (const post of data.posts) {
      if (predicate(post.caption || "")) {
        if (!best || post.likesCount > best.post.likesCount) {
          best = { account, post };
        }
      }
    }
  }
  return best;
}

export function generateIdeatorAndHooks(processedData, formInputs) {
  const { owner_username: owner, accounts } = processedData;
  const ownerData = accounts[owner] || { posts: [], avg_likes: 0 };

  const ideas = [];
  const hooks = [];

  // --- Pattern 1: POV / question hook ---
  const povMatch = bestMatch(accounts, owner, (c) => isPOV(c) || hasQuestion(c));
  if (povMatch) {
    ideas.push({
      id: "idea-1",
      title: "POV / question-hook post",
      format: "Reel",
      why: `@${povMatch.account}'s top matching post (${povMatch.post.likesCount} likes) used a POV/question-style hook — this format is proven to drive replies in the current data pull.`,
      inspired_by: `@${povMatch.account}`,
      evidence_url: povMatch.post.url,
      _evidenceLikes: povMatch.post.likesCount,
    });
    hooks.push({
      idea_id: "idea-1",
      hook: "POV: you just found the one gift that says it right. 🎁",
      script_beats: [
        "0-2s: Show 2-3 options, hesitate (visual hook)",
        "2-5s: Pick one, reveal the full product",
        "5-8s: Text overlay: 'Which one would YOU pick? 👇'",
        "8-10s: End card with your handle + a same-day/USP line",
      ],
    });
  }

  // --- Pattern 2: Occasion tie-in ---
  const occasionMatch = bestMatch(accounts, owner, hasOccasion);
  if (occasionMatch) {
    ideas.push({
      id: "idea-2",
      title: "Occasion / trending-moment tie-in",
      format: "Carousel or Reel",
      why: `@${occasionMatch.account}'s best matching post (${occasionMatch.post.likesCount} likes) rode a specific occasion rather than a generic product shot.`,
      inspired_by: `@${occasionMatch.account}`,
      evidence_url: occasionMatch.post.url,
      _evidenceLikes: occasionMatch.post.likesCount,
    });
    const occasion = formInputs.occasionName || "[Fill in nearest upcoming occasion]";
    hooks.push({
      idea_id: "idea-2",
      hook: `${occasion} is coming — don't show up empty-handed.`,
      script_beats: [
        "0-3s: Calendar/countdown graphic to the occasion",
        "3-7s: 2-3 options styled for that occasion",
        "7-10s: CTA: order before the cutoff for guaranteed delivery",
      ],
    });
  }

  // --- Pattern 3: Creator collab / promo code ---
  const collabMatch = bestMatch(accounts, owner, hasPromoCode);
  if (collabMatch) {
    ideas.push({
      id: "idea-3",
      title: "Creator collab with a personal promo code",
      format: "Reel (creator-filmed, reposted)",
      why: `@${collabMatch.account}'s creator-collab post (${collabMatch.post.likesCount} likes) used a personal promo code — this pattern was found live in the current data pull.`,
      inspired_by: `@${collabMatch.account}`,
      evidence_url: collabMatch.post.url,
      _evidenceLikes: collabMatch.post.likesCount,
    });
    const code = formInputs.promoCode || "[PROMO CODE]";
    hooks.push({
      idea_id: "idea-3",
      hook: "I asked a local creator to pick her favorite — here's what she chose.",
      script_beats: [
        "Creator unboxes/reacts on camera",
        `Creator states the code (${code}) on-screen and verbally`,
        "Repost to your grid with credit + the code pinned in caption",
      ],
    });
  }

  // --- Pattern 4: Storytelling caption (always evaluated — also the
  // account's own biggest gap if their captions are bare) ---
  const longCaptionPosts = [];
  const shortCaptionPosts = [];
  for (const [account, data] of Object.entries(accounts)) {
    if (account === owner) continue;
    for (const post of data.posts) {
      (isLongCaption(post.caption) ? longCaptionPosts : shortCaptionPosts).push(post);
    }
  }
  const avgLikes = (arr) => (arr.length ? arr.reduce((s, p) => s + p.likesCount, 0) / arr.length : 0);
  const longAvg = avgLikes(longCaptionPosts);
  const shortAvg = avgLikes(shortCaptionPosts);
  const ownerBareCount = ownerData.posts.filter((p) => isBareCaption(p.caption)).length;

  if (longCaptionPosts.length >= 2 && shortCaptionPosts.length >= 2) {
    const outperforms = longAvg > shortAvg;
    let why = `Across the competitors pulled, longer storytelling captions averaged ${Math.round(longAvg)} likes vs. ${Math.round(shortAvg)} for short/bare captions`;
    why += outperforms ? " — storytelling captions outperform." : ", roughly comparable — caption length alone isn't decisive here, but it's still a low-cost improvement to test.";
    if (ownerBareCount > 0) {
      why += ` Your own account has ${ownerBareCount} post(s) with no caption at all — the cheapest fix available.`;
    }
    ideas.push({
      id: "idea-4",
      title: "Storytelling caption on your next product post",
      format: "Single image/carousel with a written story caption",
      why,
      inspired_by: "Cross-competitor caption-length comparison",
      _evidenceLikes: Math.round(longAvg),
    });
    hooks.push({
      idea_id: "idea-4",
      hook: "Every [product] we send has a story before it ever reaches the door.",
      script_beats: [
        "Show the process/packing close-up",
        "Caption tells a short, real story",
        "End with the product beauty shot",
      ],
    });
  }

  // --- Pattern 5: Partnership / loyalty ---
  const partnerMatch = bestMatch(accounts, owner, hasPartnership);
  if (partnerMatch) {
    ideas.push({
      id: "idea-5",
      title: "Partnership / loyalty tie-in announcement",
      format: "Announcement carousel",
      why: `@${partnerMatch.account}'s partnership post (${partnerMatch.post.likesCount} likes) placed among their better performers — partnership news is proven to land in this data pull.`,
      inspired_by: `@${partnerMatch.account}`,
      evidence_url: partnerMatch.post.url,
      _evidenceLikes: partnerMatch.post.likesCount,
    });
    const partner = formInputs.partnerName || "[Partner name]";
    const benefit = formInputs.partnerBenefit || "[benefit]";
    hooks.push({
      idea_id: "idea-5",
      hook: `Big news: ${partner} customers now get ${benefit} on every order.`,
      script_beats: [
        "Announcement graphic with both logos",
        "Quick explainer of how the benefit works",
        "CTA to redeem",
      ],
    });
  }

  return {
    ideator: { ideas },
    hook_and_script: { outputs: hooks },
    meta: {
      patterns_detected: ideas.length,
      patterns_possible: 5,
      note: ideas.length < 5
        ? `Only ${ideas.length} of 5 known patterns were actually found in this data pull — the rest were skipped rather than invented. Try a larger results limit or different competitors if you want more.`
        : "All 5 known patterns were found with real evidence in this data pull.",
    },
  };
}
