// x-reply 靶子搜索 — 按 QUERIES 配置搜 X 的高互动英文帖，输出 JSON
// 运行方式: ego-browser nodejs < <skill-dir>/scripts/hunt.mjs
// 参数在 CONFIG.QUERIES 里改（X 搜索语法：min_faves 门槛 / since 日期 / lang:en / -filter:replies）。
// 输出字段：handle/text/time/permalink/replies/rts/likes；由调用方对照 replied.json 去重。

const CONFIG = {
  SPACE_NAME: "x-reply 靶子搜索",
  SCROLL_ROUNDS: 4,        // 每个搜索词滚动轮数
  SCROLL_PX: 1800,
  SCROLL_WAIT_MS: 1000,
  QUERIES: [
    { tag: "claude-code", q: "claude code min_faves:150 since:2026-11-21 lang:en -filter:replies -filter:links" },
    { tag: "coding-agent", q: "coding agent min_faves:100 since:2026-11-21 lang:en -filter:replies" },
    { tag: "ai-agent", q: "AI agent min_faves:400 since:2026-11-21 lang:en -filter:replies" },
    { tag: "mcp", q: "MCP server min_faves:60 since:2026-11-21 lang:en -filter:replies" },
  ],
};

const task = await taskSpace(CONFIG.SPACE_NAME);
const page = task.page("p1");

const collect = () => page.evaluate(() => {
  return [...document.querySelectorAll("article")].map((a) => {
    const textEl = a.querySelector('[data-testid="tweetText"]');
    const timeEl = a.querySelector("time");
    const statusLink = [...a.querySelectorAll('a[href*="/status/"]')]
      .map((l) => l.getAttribute("href"))
      .find((h) => /\/status\/\d+/.test(h));
    const userLink = [...a.querySelectorAll('a[href^="/"]')]
      .find((x) => /^\/[A-Za-z0-9_]{1,15}$/.test(x.getAttribute("href") || "") && x.textContent.trim());
    const metric = (tid) => a.querySelector(`[data-testid="${tid}"]`)?.textContent?.trim() || null;
    return {
      handle: userLink?.getAttribute("href")?.slice(1) || null,
      text: textEl?.textContent?.trim().slice(0, 280) || "",
      time: timeEl?.getAttribute("datetime") || null,
      permalink: statusLink ? "https://x.com" + statusLink.replace(/\/analytics$/, "").replace(/\/photo\/\d+$/, "") : null,
      replies: metric("reply"),
      rts: metric("retweet"),
      likes: metric("like"),
    };
  });
});

const out = {};
for (const { tag, q } of CONFIG.QUERIES) {
  const seen = new Map();
  await page.goto("https://x.com/search?q=" + encodeURIComponent(q) + "&f=live", { timeout: 45000 });
  await page.waitForLoadState();
  try { await page.waitForSelector("css:article", { state: "visible", timeout: 15000 }); } catch {}
  for (let round = 0; round < CONFIG.SCROLL_ROUNDS; round++) {
    for (const t of await collect()) {
      const k = (t.permalink?.match(/\/status\/(\d+)/) || [])[1];
      if (k && !seen.has(k)) seen.set(k, t);
    }
    await page.mouse.wheel(0, CONFIG.SCROLL_PX, { label: "滚动搜索结果" });
    await page.waitForTimeout(CONFIG.SCROLL_WAIT_MS);
  }
  out[tag] = [...seen.values()];
  console.error(tag + ": " + seen.size + " collected");
}
console.log(JSON.stringify(out, null, 1));
await task.finish({ keep: [] });
