// lib/renderDashboard.js
//
// JS port of the original scripts/build_dashboard.py — same look, same
// dataviz-skill-validated palette, same tab structure, now fed by
// dynamically pulled + rule-based-generated data instead of hand-authored
// JSON files. Returns a single self-contained HTML string.

function esc(s) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

export function renderDashboard({ processedData, ideatorResult, calendar30, trending, ownerHandle }) {
  const dataJson = JSON.stringify(processedData);
  const agentJson = JSON.stringify(ideatorResult);
  const cal30Json = JSON.stringify(calendar30);
  const trendJson = JSON.stringify(trending);

  const competitorAccounts = Object.keys(processedData.accounts).filter(
    (a) => a !== processedData.owner_username
  );
  const totalCompetitorPosts = competitorAccounts.reduce(
    (s, a) => s + processedData.accounts[a].post_count, 0
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ownerHandle)} — Content Agent Dashboard</title>
<style>
  :root {
    color-scheme: light;
    --surface-1:      #fcfcfb;
    --page-plane:     #f9f9f7;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --muted:          #898781;
    --gridline:       #e1e0d9;
    --baseline:       #c3c2b7;
    --border:         rgba(11,11,11,0.10);
    --good:           #006300;
    --series-1:       #2a78d6;
    --series-2:       #eb6834;
    --series-3:       #1baf7a;
    --series-4:       #eda100;
    --series-5:       #e87ba4;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page-plane); color: var(--text-primary); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { padding: 24px 32px 16px; border-bottom: 1px solid var(--border); background: var(--surface-1); }
  header h1 { margin: 0 0 4px; font-size: 20px; }
  header .sub { color: var(--text-secondary); font-size: 13px; }
  nav { display: flex; gap: 4px; padding: 0 32px; background: var(--surface-1); border-bottom: 1px solid var(--border); overflow-x: auto; }
  nav button { appearance: none; border: none; background: none; padding: 12px 16px; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
  nav button.active { color: var(--text-primary); border-bottom-color: var(--series-1); }
  main { padding: 24px 32px 64px; max-width: 1100px; margin: 0 auto; }
  section.tab { display: none; }
  section.tab.active { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  .stat-tile .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .stat-tile .value { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stat-tile .value.owner { color: var(--series-1); }
  .card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; margin-bottom: 14px; }
  .card h3 { margin: 0 0 6px; font-size: 15px; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--gridline); color: var(--text-secondary); margin-right: 6px; }
  .why { color: var(--text-secondary); font-size: 13px; margin-top: 6px; }
  .hook-text { font-size: 15px; font-weight: 500; margin: 8px 0; }
  ol.beats { margin: 8px 0 0; padding-left: 20px; color: var(--text-secondary); font-size: 13px; }
  ol.beats li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--gridline); }
  th { color: var(--muted); font-weight: 500; }
  td.num { font-variant-numeric: tabular-nums; text-align: right; }
  th.num { text-align: right; }
  a { color: var(--series-1); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .chart { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .chart h3 { margin: 0 0 16px; font-size: 14px; color: var(--text-secondary); }
  .bars { display: flex; align-items: flex-end; gap: 16px; height: 180px; padding-bottom: 24px; position: relative; border-bottom: 1px solid var(--baseline); }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; }
  .bar-val { font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .bar { width: 100%; max-width: 56px; border-radius: 4px 4px 0 0; }
  .bar-label { position: absolute; bottom: -22px; font-size: 11px; color: var(--text-secondary); text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note { font-size: 12px; color: var(--muted); margin-top: 8px; }
  .placeholder { background: var(--surface-1); border: 1px dashed var(--border); border-radius: 10px; padding: 32px; text-align: center; color: var(--text-secondary); }
  .placeholder h3 { color: var(--text-primary); margin-top: 0; }
  .cap-list { list-style: none; padding: 0; margin: 16px auto 0; max-width: 380px; text-align: left; }
  .cap-list li { padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--gridline); }
  .cap-list li::before { content: "○ "; color: var(--muted); }
  .callout { background: #fdf6ec; border: 1px solid #eda100; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: var(--text-primary); margin-bottom: 18px; }
  .cal-controls { display: flex; gap: 8px; margin-bottom: 14px; }
  .cal-controls button { appearance: none; border: 1px solid var(--border); background: var(--surface-1); border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; color: var(--text-secondary); }
  .cal-day { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
  .cal-day.needs-input { border-color: var(--series-4); }
  .cal-day-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; user-select: none; flex-wrap: wrap; }
  .cal-day-header:hover { background: var(--page-plane); }
  .cal-daynum { font-weight: 600; font-size: 13px; min-width: 56px; color: var(--text-primary); }
  .cal-date { font-size: 12px; color: var(--muted); min-width: 130px; }
  .cal-pillar { font-size: 12px; color: var(--text-secondary); flex: 1; }
  .cal-format { font-size: 11px; color: var(--muted); }
  .cal-flag { font-size: 10px; background: var(--series-4); color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .cal-chevron { color: var(--muted); font-size: 12px; transition: transform 0.15s; }
  .cal-day.open .cal-chevron { transform: rotate(90deg); }
  .cal-day-body { display: none; padding: 0 16px 16px 84px; }
  .cal-day.open .cal-day-body { display: block; }
  .cal-hook { font-weight: 500; font-size: 14px; margin-bottom: 8px; }
  .cal-caption { white-space: pre-line; font-size: 13px; color: var(--text-secondary); background: var(--page-plane); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  .cal-hashtags { font-size: 12px; color: var(--series-1); margin-bottom: 8px; }
  .cal-cta { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
  .cal-cta b { color: var(--text-primary); }
  .cal-reason { font-size: 12px; color: var(--text-secondary); border-left: 2px solid var(--series-1); padding-left: 10px; }
  .cal-reason b { color: var(--text-primary); }
</style>
</head>
<body>

<header>
  <h1>${esc(ownerHandle)} — Content Agent Dashboard</h1>
  <div class="sub">@${esc(processedData.owner_username)} · generated ${esc(processedData.generated_at)} · ${totalCompetitorPosts} competitor posts across ${competitorAccounts.length} accounts · ${esc(ideatorResult.meta.note)}</div>
</header>

<nav id="tabs">
  <button data-tab="overview" class="active">Overview</button>
  <button data-tab="analyst">Analyst</button>
  <button data-tab="ideator">Ideator</button>
  <button data-tab="hooks">Hook &amp; Script</button>
  <button data-tab="planner">Planner</button>
  <button data-tab="trending">Only Trending</button>
  <button data-tab="dm">DM Manager</button>
</nav>

<main>
  <section class="tab active" id="tab-overview">
    <div class="grid" id="overview-tiles"></div>
    <div class="card">
      <h3>What the rule-based pass found</h3>
      <p style="color:var(--text-secondary); font-size:14px; margin:0;">${esc(ideatorResult.meta.note)} No AI model was used to generate this analysis — everything is pattern-matched directly from the pulled captions.</p>
    </div>
  </section>

  <section class="tab" id="tab-analyst">
    <div class="chart"><h3>Avg. likes per post — you vs. comparable competitors</h3><div class="bars" id="chart-likes"></div></div>
    <div class="chart"><h3>Avg. comments per post — you vs. comparable competitors</h3><div class="bars" id="chart-comments"></div></div>
    <div class="grid" id="benchmark-tile"></div>
    <div class="card"><h3>All tracked accounts</h3><table id="analyst-table"></table></div>
  </section>

  <section class="tab" id="tab-ideator"><div id="ideator-cards"></div></section>
  <section class="tab" id="tab-hooks"><div id="hook-cards"></div></section>

  <section class="tab" id="tab-planner">
    <div class="callout" id="planner-callout"></div>
    <div class="cal-controls"><button id="cal-expand-all">Expand all</button><button id="cal-collapse-all">Collapse all</button></div>
    <div id="calendar-30day"></div>
  </section>

  <section class="tab" id="tab-trending">
    <div class="callout" id="trending-callout"></div>
    <div class="cal-controls"><button id="trend-expand-all">Expand all</button><button id="trend-collapse-all">Collapse all</button></div>
    <div id="calendar-trending"></div>
  </section>

  <section class="tab" id="tab-dm">
    <div class="placeholder">
      <h3>DM Manager — not connected yet</h3>
      <p>The scraper can only read public posts, not your DMs. Real DM handling needs Instagram's official Business API (Meta app review required).</p>
      <ul class="cap-list">
        <li>Auto-triage incoming DMs (price question / order status / general)</li>
        <li>Draft suggested replies from a saved FAQ/price list</li>
        <li>Flag DMs needing a human reply</li>
        <li>Daily DM summary alongside the content report</li>
      </ul>
    </div>
  </section>
</main>

<script>
const DATA = ${dataJson};
const AGENT = ${agentJson};
const CALENDAR30 = ${cal30Json};
const TRENDING = ${trendJson};

document.querySelectorAll('#tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('section.tab').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const owner = DATA.owner_username;
const accounts = DATA.accounts;
const accountNames = Object.keys(accounts);
function fmt(n) { return Number(n).toLocaleString(undefined, {maximumFractionDigits: 1}); }
function median(nums) {
  const s = [...nums].sort((a,b) => a-b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid-1] + s[mid]) / 2;
}
// A competitor is treated as a market-leader outlier (excluded from
// peer comparisons) if its avg likes is >3x the group median — generic,
// no hardcoded handles, so this works for any competitor set.
const competitorNamesAll = accountNames.filter(a => a !== owner);
const likesMedian = competitorNamesAll.length >= 3 ? median(competitorNamesAll.map(a => accounts[a].avg_likes)) : null;
const outlierAccounts = likesMedian && likesMedian > 0 ? competitorNamesAll.filter(a => accounts[a].avg_likes > likesMedian * 3) : [];
const peerAccountNames = accountNames.filter(a => !outlierAccounts.includes(a));

{
  const ownerData = accounts[owner] || { post_count: 0, avg_likes: 0 };
  const competitorAccounts = accountNames.filter(a => a !== owner);
  const peerCompetitors = competitorAccounts.filter(a => !outlierAccounts.includes(a));
  const peerAvgLikes = peerCompetitors.length
    ? peerCompetitors.reduce((s,a) => s + accounts[a].avg_likes, 0) / peerCompetitors.length : 0;
  const tiles = [
    ['Your posts pulled', ownerData.post_count, false],
    ['Your avg. likes/post', fmt(ownerData.avg_likes), true],
    [outlierAccounts.length ? 'Peer avg. likes/post (excl. market leader)' : 'Competitor avg. likes/post', fmt(Math.round(peerAvgLikes*10)/10), false],
    ['Competitors tracked', competitorAccounts.length, false],
  ];
  const el = document.getElementById('overview-tiles');
  tiles.forEach(([label, value, isOwner]) => {
    const d = document.createElement('div');
    d.className = 'stat-tile';
    d.innerHTML = \`<div class="label">\${label}</div><div class="value\${isOwner ? ' owner' : ''}">\${value}</div>\`;
    el.appendChild(d);
  });
}

function renderBars(containerId, key) {
  const el = document.getElementById(containerId);
  const vals = peerAccountNames.map(a => accounts[a][key]);
  const max = Math.max(...vals, 1);
  peerAccountNames.forEach((a, i) => {
    const v = accounts[a][key];
    const heightPct = Math.max((v / max) * 100, 2);
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = \`
      <div class="bar-val">\${fmt(v)}</div>
      <div class="bar" style="height:\${heightPct}%; background:\${PALETTE[i % PALETTE.length]}"></div>
      <div class="bar-label">\${a === owner ? '★ ' + a : a}</div>
    \`;
    el.appendChild(col);
  });
}
renderBars('chart-likes', 'avg_likes');
renderBars('chart-comments', 'avg_comments');

if (outlierAccounts.length) {
  const el = document.getElementById('benchmark-tile');
  outlierAccounts.forEach(a => {
    const d = document.createElement('div');
    d.className = 'stat-tile';
    d.innerHTML = \`<div class="label">Market-leader reference — @\${a} (shown separately, different scale)</div>
      <div class="value">\${fmt(accounts[a].avg_likes)} avg likes · \${fmt(accounts[a].avg_comments)} avg comments</div>\`;
    el.appendChild(d);
  });
}

{
  const tbl = document.getElementById('analyst-table');
  let rows = \`<tr><th>Account</th><th class="num">Posts</th><th class="num">Avg likes</th><th class="num">Avg comments</th><th>Top post</th></tr>\`;
  accountNames.forEach(a => {
    const d = accounts[a];
    const label = a === owner ? \`★ \${a} (you)\` : a;
    const top = d.top_post ? \`<a href="\${d.top_post.url}" target="_blank">\${fmt(d.top_post.likesCount)} likes ↗</a>\` : '—';
    rows += \`<tr><td>\${label}</td><td class="num">\${d.post_count}</td><td class="num">\${fmt(d.avg_likes)}</td><td class="num">\${fmt(d.avg_comments)}</td><td>\${top}</td></tr>\`;
  });
  tbl.innerHTML = rows;
}

{
  const el = document.getElementById('ideator-cards');
  if (AGENT.ideator.ideas.length === 0) {
    el.innerHTML = '<div class="placeholder"><h3>No patterns detected</h3><p>None of the 5 known patterns were found with real evidence in this data pull.</p></div>';
  }
  AGENT.ideator.ideas.forEach(idea => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = \`<span class="badge">\${idea.format}</span><span class="badge">inspired by \${idea.inspired_by}</span>
      <h3>\${idea.title}</h3><div class="why">\${idea.why}</div>\`;
    el.appendChild(d);
  });
}

{
  const el = document.getElementById('hook-cards');
  const ideasById = Object.fromEntries(AGENT.ideator.ideas.map(i => [i.id, i]));
  AGENT.hook_and_script.outputs.forEach(h => {
    const idea = ideasById[h.idea_id];
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = \`<span class="badge">\${idea ? idea.title : h.idea_id}</span>
      <div class="hook-text">"\${h.hook}"</div>
      <ol class="beats">\${h.script_beats.map(b => \`<li>\${b}</li>\`).join('')}</ol>\`;
    el.appendChild(d);
  });
}

function renderCalendarAccordion(containerId, calloutId, calloutHtml, items, itemNumKey) {
  document.getElementById(calloutId).innerHTML = calloutHtml;
  const el = document.getElementById(containerId);
  items.forEach(p => {
    const row = document.createElement('div');
    row.className = 'cal-day' + (p.needs_input ? ' needs-input' : '');
    row.innerHTML = \`
      <div class="cal-day-header">
        <span class="cal-chevron">▶</span>
        <span class="cal-daynum">\${itemNumKey} \${p[itemNumKey === 'Day' ? 'day' : 'post']}</span>
        <span class="cal-date">\${p.date} · \${p.weekday}</span>
        <span class="cal-pillar">\${p.pillar}</span>
        <span class="cal-format">\${p.format}</span>
        \${p.idea_id ? \`<span class="badge">\${p.idea_id}\${p.rotation ? ' · repeat #' + p.rotation : ''}</span>\` : ''}
        \${p.needs_input ? '<span class="cal-flag">NEEDS YOUR INPUT</span>' : ''}
      </div>
      <div class="cal-day-body">
        <div class="cal-hook">\${p.hook}</div>
        \${p.script_beats && p.script_beats.length ? \`<ol class="beats">\${p.script_beats.map(b => \`<li>\${b}</li>\`).join('')}</ol>\` : ''}
        <div class="cal-caption">\${p.caption}</div>
        <div class="cal-hashtags">\${p.hashtags.map(h => '#' + h).join('  ')}</div>
        <div class="cal-cta"><b>CTA:</b> \${p.cta}</div>
        <div class="cal-reason" style="margin-top:8px;"><b>Why:</b> \${p.reason}</div>
        \${p.inspired_by ? \`<div class="cal-cta" style="margin-top:4px;"><b>Inspired by:</b> \${p.inspired_by}</div>\` : ''}
      </div>
    \`;
    row.querySelector('.cal-day-header').addEventListener('click', () => row.classList.toggle('open'));
    el.appendChild(row);
  });
}

renderCalendarAccordion(
  'calendar-30day', 'planner-callout',
  \`<div><b>\${CALENDAR30.range}</b> — \${CALENDAR30.note}</div>\`,
  CALENDAR30.days, 'Day'
);
document.getElementById('cal-expand-all').addEventListener('click', () => document.querySelectorAll('#calendar-30day .cal-day').forEach(r => r.classList.add('open')));
document.getElementById('cal-collapse-all').addEventListener('click', () => document.querySelectorAll('#calendar-30day .cal-day').forEach(r => r.classList.remove('open')));

renderCalendarAccordion(
  'calendar-trending', 'trending-callout',
  \`<div><b>\${TRENDING.posts.length} posts</b> — \${TRENDING.source}</div><div>\${TRENDING.note}</div>\`,
  TRENDING.posts, 'Post'
);
document.getElementById('trend-expand-all').addEventListener('click', () => document.querySelectorAll('#calendar-trending .cal-day').forEach(r => r.classList.add('open')));
document.getElementById('trend-collapse-all').addEventListener('click', () => document.querySelectorAll('#calendar-trending .cal-day').forEach(r => r.classList.remove('open')));
</script>

</body>
</html>`;
}
