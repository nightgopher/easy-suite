// x-digest 采集脚本 — 在 X 的 For you 推荐流滚动采样并输出 JSON
// 运行方式: ego-browser nodejs < /path/to/collect.mjs
// 说明: 脚本不读取环境变量；如需调整参数，改下面 CONFIG 里的值。

const CONFIG = {
  SPACE_NAME: "x-digest 采集",   // 任务空间名，同名空间会被复用
  SCROLL_ROUNDS: 16,             // 滚动轮数上限
  SCROLL_PX: 1800,               // 每轮滚动像素
  SCROLL_WAIT_MS: 1100,          // 每轮滚动后等待
  MAX_FRESH: 70,                 // 收集到这么多 24h 内推文就提前结束
  HOURS_WINDOW: 24,              // “今天”= 最近 N 小时
  TEXT_LIMIT: 500,               // 单条正文截断长度
};

const task = await taskSpace(CONFIG.SPACE_NAME);
const page = task.page("p1");
await page.goto("https://x.com/home", { timeout: 45000 });
await page.waitForLoadState();

// 等时间线文章出现；等不到则判断是否登录墙
const needsLogin = await (async () => {
  try {
    await page.waitForSelector("css:article", { state: "visible", timeout: 20000 });
    return false;
  } catch {
    const u = await page.url();
    const probe = await page.evaluate(() => document.body?.innerText?.slice(0, 1500) || "");
    return u.includes("/login") || /sign in to x|sign up now|登录 x|登录以继续/i.test(probe);
  }
})();

if (needsLogin) {
  console.log(JSON.stringify({ status: "need_login", spaceId: task.spaceId }, null, 1));
  await task.handOff();
  // 脚本到此结束；SKILL.md 会指导模型在用户登录后 takeOverTaskSpace 重跑采集
} else {
  await harvest();
}

async function harvest() {
const seen = new Map();
const collect = () => page.evaluate(({ textLimit }) => {
  return [...document.querySelectorAll("article")].map((a) => {
    const textEl = a.querySelector('[data-testid="tweetText"]');
    const timeEl = a.querySelector("time");
    const statusLink = [...a.querySelectorAll('a[href*="/status/"]')]
      .map((l) => l.getAttribute("href"))
      .find((h) => /\/status\/\d+/.test(h));
    const userLink = [...a.querySelectorAll('a[href^="/"]')]
      .find((x) => /^\/[A-Za-z0-9_]{1,15}$/.test(x.getAttribute("href") || "") && x.textContent.trim());
    let displayName = userLink?.textContent?.trim() || null;
    if (displayName && displayName.includes("@")) displayName = displayName.split("@")[0].trim();
    const metric = (tid) => a.querySelector(`[data-testid="${tid}"]`)?.textContent?.trim() || null;
    return {
      handle: userLink?.getAttribute("href")?.slice(1) || null,
      name: displayName,
      text: textEl?.textContent?.trim().slice(0, textLimit) || "",
      time: timeEl?.getAttribute("datetime") || null,   // null => 推广/广告的强特征
      permalink: statusLink ? "https://x.com" + statusLink.replace(/\/analytics$/, "").replace(/\/photo\/\d+$/, "") : null,
      replies: metric("reply"),
      rts: metric("retweet"),
      likes: metric("like"),
    };
  });
}, { textLimit: CONFIG.TEXT_LIMIT });

const key = (p) => (p?.match(/\/status\/(\d+)/) || [])[1] || p;
let stagnant = 0, prevCount = -1;

for (let round = 0; round < CONFIG.SCROLL_ROUNDS; round++) {
  for (const t of await collect()) {
    const k = key(t.permalink);
    if (k && t.text !== undefined && !seen.has(k)) seen.set(k, t);
    else if (k && seen.has(k) && !seen.get(k).text && t.text) seen.set(k, t); // 补全文本
  }
  if (seen.size === prevCount) { stagnant++; if (stagnant >= 3) break; } else { stagnant = 0; prevCount = seen.size; }
  if ([...seen.values()].filter((t) => t.time).length >= CONFIG.MAX_FRESH) break;
  await page.mouse.wheel(0, CONFIG.SCROLL_PX, { label: "滚动 For you 时间线" });
  await page.waitForTimeout(CONFIG.SCROLL_WAIT_MS);
}
for (const t of await collect()) {
  const k = key(t.permalink);
  if (k && !seen.has(k)) seen.set(k, t);
}

const cutoff = Date.now() - CONFIG.HOURS_WINDOW * 3600 * 1000;
const fresh = [], stale = [], ads = [];
for (const t of seen.values()) {
  if (!t.time) { ads.push(t.handle); continue; }              // 无时间戳 = 推广
  const ts = Date.parse(t.time);
  if (Number.isNaN(ts)) continue;
  if (ts >= cutoff) fresh.push(t); else stale.push(t);
}
fresh.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

console.log(JSON.stringify({
  status: "ok",
  spaceId: task.spaceId,
  hoursWindow: CONFIG.HOURS_WINDOW,
  freshCount: fresh.length,
  staleCount: stale.length,
  adsCount: ads.length,
  adsHandles: [...new Set(ads)],
  tweets: fresh,
}, null, 1));
}
