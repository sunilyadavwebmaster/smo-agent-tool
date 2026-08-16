// lib/calendar.js
//
// Builds the 30-day calendar and the 12-post "Only Trending" list.
// Rule-based, same as ideator.js: no AI model in the loop. Ideas/hooks
// detected from the real data (ideator.js) are rotated in; the remaining
// slots are filled with fixed evergreen pillars (weekend reminder, UGC
// ask, meme, BTS, educational, product showcase, recap) that don't need
// per-post data-backed reasoning to justify — they're standard low-risk
// filler content types.
//
// IMPORTANT: this tool does NOT know your local public holidays (that
// requires a live lookup, which needs a model/web-search in the loop —
// out of scope for the no-AI version). Pass `blockedDates` yourself
// (dates you want treated as respectful/no-hard-sell, e.g. religious or
// national holidays) via the form if that matters to you.

function topHashtags(accounts, owner, limit = 6) {
  const counts = {};
  for (const [account, data] of Object.entries(accounts)) {
    if (account === owner) continue;
    for (const post of data.posts) {
      for (const tag of post.hashtags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function brandTag(ownerUsername) {
  return ownerUsername.replace(/[^a-z0-9]/gi, "");
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function weekdayName(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

const EVERGREEN_PILLARS = [
  {
    pillar: "Weekend reminder",
    format: "Image",
    hook: "Weekend plans? Don't show up empty-handed.",
    body: "Same-day delivery, all weekend long.",
    cta: "Tap link in bio to order",
    why: "Low-production filler post timed to when gifting occasions (visits, catch-ups) naturally cluster — keeps posting cadence going cheaply.",
  },
  {
    pillar: "UGC / testimonial ask",
    format: "Story repost or Image",
    hook: "This is what it looks like when a gift lands right.",
    body: "Tag us in your moments — we'd love to feature you here.",
    cta: "Ask customers to tag the brand",
    why: "Builds a pipeline of real customer content at zero extra production cost — most accounts starting out have none yet.",
  },
  {
    pillar: "Meme / relatable",
    format: "Reel or Image meme",
    hook: "When you forgot the occasion but the gift saved you.",
    body: "😅 Same-day delivery = you're welcome in advance.",
    cta: "Tag someone who always forgets occasions",
    why: "Cheap, shareable, low production — keeps the feed from feeling like a constant ad.",
  },
  {
    pillar: "Behind the scenes",
    format: "Reel",
    hook: "What actually happens before your order ships.",
    body: "Hand-packed, checked twice, wrapped with care.",
    cta: "None needed — pure trust-building",
    why: "Process/BTS content builds trust and differentiates from purely promotional posts.",
  },
  {
    pillar: "Educational / FAQ",
    format: "Carousel",
    hook: "Here's exactly how same-day delivery works.",
    body: "Order before the cutoff, we prep and pack by hand, delivered same day.",
    cta: "Save this post for next time",
    why: "Answers common questions upfront — doubles as pre-emptive DM deflection and is easy to make evergreen.",
  },
  {
    pillar: "Product showcase",
    format: "Carousel",
    hook: "This week's picks, ready for same-day delivery.",
    body: "Swipe through what's new.",
    cta: "Tap to shop",
    why: "Keeps the feed rotating through catalog range rather than repeating one product type.",
  },
];

function buildCaption(hook, body, brand, tags) {
  const hashtagLine = tags.map((t) => `#${t}`).join(" ");
  const parts = [hook, body, hashtagLine].map((s) => (s || "").trim()).filter(Boolean);
  return parts.join("\n\n");
}

// Returns a rotation list of idea_ids sized to `slots`, weighting ideas
// with stronger evidence (higher likesCount on their matched post) more
// heavily, and interleaving with evergreen pillar placeholders (null) to
// fill out the rest.
function buildRotation(ideas, slots, evergreenRatio) {
  const evergreenSlots = Math.round(slots * evergreenRatio);
  const ideaSlots = slots - evergreenSlots;
  const rotation = [];

  if (ideas.length > 0) {
    // sort by evidence strength (posts without evidence_url go last)
    const sorted = [...ideas].sort(
      (a, b) => (b._evidenceLikes || 0) - (a._evidenceLikes || 0)
    );
    for (let i = 0; i < ideaSlots; i++) {
      rotation.push(sorted[i % sorted.length].id);
    }
  }
  for (let i = 0; i < evergreenSlots; i++) {
    rotation.push(null); // null = pull next evergreen pillar
  }
  // interleave idea slots and evergreen slots roughly evenly
  const ideaItems = rotation.filter((x) => x !== null);
  const evergreenItems = rotation.filter((x) => x === null);
  const interleaved = [];
  let ii = 0, ei = 0;
  const ratio = ideaItems.length / Math.max(1, evergreenItems.length);
  let acc = 0;
  while (ii < ideaItems.length || ei < evergreenItems.length) {
    acc += ratio || 1;
    if (acc >= 1 && ii < ideaItems.length) {
      interleaved.push(ideaItems[ii++]);
      acc -= 1;
    } else if (ei < evergreenItems.length) {
      interleaved.push(evergreenItems[ei++]);
    } else if (ii < ideaItems.length) {
      interleaved.push(ideaItems[ii++]);
    }
  }
  return interleaved.slice(0, slots);
}

function buildPostsFromRotation(rotation, ideasById, hooksById, startDate, blockedDates, brand, tags, formInputs) {
  const blocked = new Set(blockedDates || []);
  const posts = [];
  let cursor = new Date(startDate);
  let evergreenCursor = 0;
  const counts = {};

  for (let i = 0; i < rotation.length; i++) {
    while (blocked.has(isoDate(cursor))) cursor = addDays(cursor, 1);
    const date = isoDate(cursor);
    const weekday = weekdayName(cursor);
    const idId = rotation[i];

    if (idId) {
      const idea = ideasById[idId];
      const hook = hooksById[idId];
      counts[idId] = (counts[idId] || 0) + 1;
      posts.push({
        date, weekday,
        pillar: idea.title,
        format: idea.format,
        idea_id: idId,
        rotation: counts[idId],
        hook: hook.hook,
        script_beats: hook.script_beats,
        caption: buildCaption(hook.hook, "", brand, tags),
        hashtags: tags,
        cta: "See script beats for the full shot list",
        reason: idea.why,
        inspired_by: idea.inspired_by || null,
        needs_input: /\[.*\]/.test(hook.hook),
      });
    } else {
      const p = EVERGREEN_PILLARS[evergreenCursor % EVERGREEN_PILLARS.length];
      evergreenCursor++;
      posts.push({
        date, weekday,
        pillar: p.pillar,
        format: p.format,
        idea_id: null,
        rotation: null,
        hook: p.hook,
        script_beats: [],
        caption: buildCaption(p.hook, p.body, brand, tags),
        hashtags: tags,
        cta: p.cta,
        reason: p.why,
        inspired_by: null,
        needs_input: false,
      });
    }
    cursor = addDays(cursor, 1);
  }
  return posts;
}

export function build30DayCalendar(ideatorResult, processedData, formInputs, startDate, blockedDates) {
  const ideas = ideatorResult.ideator.ideas;
  const hooksById = Object.fromEntries(
    ideatorResult.hook_and_script.outputs.map((h) => [h.idea_id, h])
  );
  const ideasById = Object.fromEntries(ideas.map((i) => [i.id, i]));
  const tags = topHashtags(processedData.accounts, processedData.owner_username);
  const brand = brandTag(processedData.owner_username);

  const rotation = buildRotation(ideas, 30, 0.5); // ~50% evergreen filler
  const posts = buildPostsFromRotation(
    rotation, ideasById, hooksById, startDate, blockedDates, brand, tags, formInputs
  );
  return {
    range: `${posts[0]?.date} to ${posts[posts.length - 1]?.date}`,
    note: "Rule-based (no AI): ideas/hooks are pulled from the Ideator/Hook & Script results actually detected in your data pull; the rest are fixed evergreen pillars.",
    days: posts.map((p, i) => ({ day: i + 1, ...p })),
  };
}

export function buildOnlyTrending(ideatorResult, processedData, formInputs, startDate, blockedDates) {
  const ideas = ideatorResult.ideator.ideas;
  const hooksById = Object.fromEntries(
    ideatorResult.hook_and_script.outputs.map((h) => [h.idea_id, h])
  );
  const ideasById = Object.fromEntries(ideas.map((i) => [i.id, i]));
  const tags = topHashtags(processedData.accounts, processedData.owner_username);
  const brand = brandTag(processedData.owner_username);

  if (ideas.length === 0) {
    return {
      source: "No known patterns were detected with real evidence in this data pull.",
      note: "Try a larger results limit, different competitors, or fill in the calendar manually.",
      posts: [],
    };
  }

  const rotation = buildRotation(ideas, 12, 0); // 0% evergreen — only real ideas
  const posts = buildPostsFromRotation(
    rotation, ideasById, hooksById, startDate, blockedDates, brand, tags, formInputs
  );
  return {
    source: `Pulled directly from the ${ideas.length} pattern(s) actually detected in this data pull — no new content added.`,
    note: "Ideas repeat to fill 12 slots since fewer than 12 distinct patterns were found; stronger-evidence ideas repeat more.",
    posts: posts.map((p, i) => ({ post: i + 1, ...p })),
  };
}
