/**
 * Easy Suite 分发层（dl 网关）
 *
 * 职责：分发契约的单一入口。客户端与官网只认 dl 域名，后端载体（Cloudflare →
 * EdgeOne → 自建）可整体替换而不影响契约。
 *
 * 路由：
 *   /dl/<repo>/install.sh                     安装脚本代理（带缓存）
 *   /dl/<repo>/latest/<asset>                 最新版资产 302（latest 解析有 1h 缓存）
 *   /dl/<repo>/<tag>/<asset>                  指定版本资产 302
 *   /upd/<repo>/<manifest>.json               更新清单代理 + 心跳（客户端可带 ?v=&os=&arch=）
 *   /healthz                                  健康检查
 *   /                                         302 到官网
 *
 * 分流：中国大陆 IP 且资产在 Gitee 镜像清单内且为 latest → Gitee；其余 → GitHub。
 * Gitee 镜像只保留近期版本，非 latest 一律走 GitHub，避免命中已裁剪的旧镜像。
 *
 * 统计：每次命中写一条 Analytics Engine 数据点。只存当日哈希去重的 IP 摘要，
 * 不落原始 IP；统计任何一步失败都不影响主流程。
 */

export interface Env {
  /** Analytics Engine 绑定；本地 dev 或绑定缺失时自动跳过统计 */
  AE?: AnalyticsEngineDataset;
  /** 官网主入口，根路径 302 目标 */
  SITE_ORIGIN: string;
  /** AE SQL API 的读取 token（secret），/stats 看板查询用；缺失时看板降级为不可用提示 */
  AE_QUERY_TOKEN?: string;
  /** AE 所在账号 id（secret 或 var），/stats 查询用 */
  AE_ACCOUNT_ID?: string;
}

interface Target {
  /** GitHub owner/repo */
  github: string;
  /** Gitee owner/repo，空串表示无镜像 */
  gitee: string;
  /** Gitee 镜像包含的资产名（与 scripts/gitee_mirror.py 的 ASSETS 对齐） */
  mirrorAssets: ReadonlySet<string>;
}

const TARGETS: Record<string, Target> = {
  easyagent: {
    github: 'nightgopher/easyagent',
    gitee: 'weijian-huang/easyagent',
    mirrorAssets: new Set([
      'release.json',
      'checksums.txt',
      'easyagent-android.apk',
      'easyagent-native-darwin-arm64.dmg',
      'easyagent-darwin-amd64',
      'easyagent-darwin-arm64',
      'easyagent-linux-amd64',
      'easyagent-linux-arm64',
      'easyagent-bridge-darwin-amd64',
      'easyagent-bridge-darwin-arm64',
      'easyagent-bridge-linux-amd64',
      'easyagent-bridge-linux-arm64',
    ]),
  },
  easygateway: { github: 'nightgopher/easygateway', gitee: '', mirrorAssets: new Set() },
};

const LATEST_TTL = 3600; // latest tag 解析缓存
const MANIFEST_TTL = 600; // 更新清单回源缓存
const INSTALL_TTL = 300; // 安装脚本回源缓存

/** 走 dl 路由但不算"安装包下载"的资产：更新清单与校验和（安装脚本内部步骤） */
const META_ASSETS = new Set(['release.json', 'checksums.txt']);

const ASSET_RE = /^[\w][\w.{}@+-]*$/; // 资产/清单名白名单
const TAG_RE = /^v[\w.+-]+$/; // v 开头的 tag（含预发布）
const REPO_RE = /^[\w-]+$/;

interface HitFields {
  route: 'dl' | 'upd' | 'install';
  repo: string;
  tag: string;
  asset: string;
  channel: string;
  country: string;
  clientVersion?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // WHATWG URL 会把 path 中的 {} 等字符百分号编码（如 %7Bv%7D），匹配前先还原
    let path: string;
    try {
      path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    } catch {
      path = url.pathname.replace(/\/+$/, '');
    }
    try {
      if (path === '' || path === '/') return redirect(env.SITE_ORIGIN || 'https://www.hwj123hwj.asia');
      if (path === '/healthz') return text('ok');

      let m: RegExpMatchArray | null;

      if ((m = path.match(/^\/dl\/([^/]+)\/install\.sh$/)) && REPO_RE.test(m[1])) {
        return serveInstall(request, env, m[1], url);
      }
      if ((m = path.match(/^\/dl\/([^/]+)\/latest\/([^/]+)$/)) && REPO_RE.test(m[1]) && ASSET_RE.test(m[2])) {
        return serveDl(request, env, ctx, m[1], 'latest', m[2], url);
      }
      if ((m = path.match(/^\/dl\/([^/]+)\/(v[\w.+-]+)\/([^/]+)$/)) && REPO_RE.test(m[1]) && ASSET_RE.test(m[3])) {
        return serveDl(request, env, ctx, m[1], m[2], m[3], url);
      }
      if ((m = path.match(/^\/upd\/([^/]+)\/([^/]+\.json)$/)) && REPO_RE.test(m[1]) && ASSET_RE.test(m[2])) {
        return serveUpd(request, env, m[1], m[2], url);
      }
      // 看板统一托管在官网（/easy-suite/stats/）；dl 只保留 JSON 数据源。
      // 旧收藏 /stats 302 过去，浏览器地址栏从此只有官网一个入口。
      // 302 固定指主站（nightgopher.github.io），不随 SITE_ORIGIN（www 镜像未接入）漂移。
      if (path === '/stats') return redirect('https://nightgopher.github.io/easy-suite/stats/');
      if (path === '/stats.json') return serveStatsJson(env);
      return json({ error: 'not found' }, 404);
    } catch (error) {
      return json({ error: 'internal', detail: String(error).slice(0, 200) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

/** /dl/<repo>[/{latest|tag}]/<asset>：解析目标并 302 */
async function serveDl(request: Request, env: Env, ctx: ExecutionContext, repo: string, tagRef: string, assetRaw: string, url: URL): Promise<Response> {
  const target = TARGETS[repo];
  if (!target) return json({ error: 'unknown repo' }, 404);
  const channel = sanitizeChannel(url.searchParams.get('ch'));
  const country = requestCountry(request);

  let tag = tagRef;
  if (tagRef === 'latest') {
    const resolved = await latestTag(ctx, repo);
    // 解析失败时优雅降级：跳 GitHub 最新版页面，用户仍能找到资产
    if (!resolved) return redirect(`https://github.com/${target.github}/releases/latest`);
    tag = resolved;
  }

  const asset = assetRaw.replace('{v}', tag.replace(/^v/, ''));
  // Gitee 只对 latest + 镜像清单内资产生效；旧版本可能已被镜像裁剪
  const useGitee = Boolean(target.gitee) && country === 'CN' && target.mirrorAssets.has(assetRaw);
  const targetUrl = useGitee
    ? `https://gitee.com/${target.gitee}/releases/download/${tag}/${asset}`
    : `https://github.com/${target.github}/releases/download/${tag}/${asset}`;

  await record(env, request, { route: 'dl', repo, tag, asset, channel, country });
  return redirect(targetUrl);
}

/** /upd/<repo>/<manifest>.json：代理最新版清单并记心跳 */
async function serveUpd(request: Request, env: Env, repo: string, manifest: string, url: URL): Promise<Response> {
  const target = TARGETS[repo];
  if (!target) return json({ error: 'unknown repo' }, 404);

  const upstream = `https://github.com/${target.github}/releases/latest/download/${manifest}`;
  const response = await fetch(upstream, { cf: { cacheTtl: MANIFEST_TTL, cacheEverything: true } });
  if (!response.ok) return json({ error: 'manifest unavailable', status: response.status }, 502);

  const body = await response.text();
  // 清单里的 version 是"最新版本"，客户端自身版本走 ?v= 上报（PR-3 起携带）
  let latestVersion = 'unknown';
  try {
    latestVersion = String(JSON.parse(body)?.version ?? 'unknown');
  } catch {
    // 清单格式变化时仍照常回源响应，绝不因统计破坏更新链路
  }
  await record(env, request, {
    route: 'upd',
    repo,
    tag: latestVersion,
    asset: manifest,
    channel: 'heartbeat',
    country: requestCountry(request),
    clientVersion: url.searchParams.get('v') ?? '',
  });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${MANIFEST_TTL / 2}`,
    },
  });
}

/** /dl/<repo>/install.sh：安装脚本代理 */
async function serveInstall(request: Request, env: Env, repo: string, url: URL): Promise<Response> {
  const target = TARGETS[repo];
  if (!target) return json({ error: 'unknown repo' }, 404);
  const response = await fetch(`https://raw.githubusercontent.com/${target.github}/main/scripts/install.sh`, {
    cf: { cacheTtl: INSTALL_TTL, cacheEverything: true },
  });
  if (!response.ok) return json({ error: 'install script unavailable', status: response.status }, 502);
  await record(env, request, {
    route: 'install',
    repo,
    tag: 'main',
    asset: 'install.sh',
    channel: sanitizeChannel(url.searchParams.get('ch')),
    country: requestCountry(request),
  });
  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': 'text/x-shellscript; charset=utf-8',
      'cache-control': `public, max-age=${INSTALL_TTL}`,
    },
  });
}

/** latest tag 解析，边缘缓存 1 小时 */
async function latestTag(ctx: ExecutionContext, repo: string): Promise<string | null> {
  const target = TARGETS[repo];
  const cache = caches.default;
  const cacheKey = new Request(`https://easy-suite-dl.cache/latest-tag/${repo}`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const value = await hit.text();
    return value || null;
  }
  const response = await fetch(`https://api.github.com/repos/${target.github}/releases/latest`, {
    headers: { 'user-agent': 'easy-suite-dl', accept: 'application/vnd.github+json' },
    cf: { cacheTtl: LATEST_TTL, cacheEverything: true },
  });
  if (!response.ok) return null;
  let tag: string | null = null;
  try {
    tag = String(JSON.parse(await response.text())?.tag_name ?? '') || null;
  } catch {
    tag = null;
  }
  ctx.waitUntil(
    cache.put(cacheKey, new Response(tag ?? '', { headers: { 'cache-control': `public, max-age=${LATEST_TTL}` } })),
  );
  return tag;
}

/** 写一条统计数据点。只存 IP 的当日哈希，不落原始 IP；失败静默跳过 */
async function record(env: Env, request: Request, fields: HitFields): Promise<void> {
  try {
    if (!env.AE || typeof env.AE.writeDataPoint !== 'function') return;
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const day = new Date().toISOString().slice(0, 10);
    const ipHash = ip ? (await sha256Hex(ip + day)).slice(0, 12) : '';
    env.AE.writeDataPoint({
      indexes: [fields.route],
      blobs: [
        fields.route,
        fields.repo,
        fields.tag,
        fields.asset,
        fields.channel,
        fields.country,
        fields.clientVersion ?? '',
        ipHash,
        (request.headers.get('user-agent') ?? '').slice(0, 128),
      ],
      doubles: [1],
    });
  } catch {
    // 统计永不影响主流程
  }
}

/** workers-types 里 cf 属性是宽松对象，这里只取需要的国家码 */
function requestCountry(request: Request): string {
  const cf = request.cf as { country?: string } | undefined;
  return String(cf?.country ?? '');
}

function sanitizeChannel(raw: string | null): string {
  const value = (raw ?? '').toLowerCase().replace(/[^\w-]/g, '').slice(0, 32);
  return value || 'direct';
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function redirect(location: string, status: 302 = 302): Response {
  return new Response(null, { status, headers: { location, 'cache-control': 'private, max-age=0' } });
}

function text(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/* ── /stats 看板：Worker 经 SQL API 查自己的 AE 数据集，固定聚合查询，无参数入口 ── */

interface StatsPayload {
  totals: {
    /** 安装包/二进制资产命中（真实下载口径） */
    installs: number;
    /** release.json / checksums.txt 等清单与校验命中，不计入下载 */
    metaHits: number;
    /** installs + metaHits，兼容旧消费方保留 */
    downloads: number;
    heartbeats: number;
    heartbeats7d: number;
    /** 独立活跃客户端（心跳 IP 当日哈希去重）；查询失败为 null，前端显示 — */
    uniqueClients: number | null;
    /** 独立下载者（dl 路由 IP 哈希去重）；查询失败为 null */
    uniqueDownloaders: number | null;
    countries: number;
  };
  /** 每日 dl 路由全部命中（含清单/校验，兼容字段） */
  dailyDownloads: { day: string; hits: number }[];
  /** 每日安装包下载（剔除 META_ASSETS） */
  dailyInstalls: { day: string; hits: number }[];
  dailyHeartbeats: { day: string; hits: number }[];
  /** 每日独立活跃客户端；查询失败为 null */
  dailyClients: { day: string; clients: number }[] | null;
  assets: { asset: string; country: string; channel: string; hits: number }[];
  /** clientVer 为空串的行 = 未带 ?v= 的心跳，前端显示"未上报" */
  versions: { clientVer: string; heartbeats: number }[];
  generatedAt: string;
}

/** AE SQL API 单次查询；非 200 或空响应抛错，由调用方聚合降级 */
async function aeQuery(env: Env, sql: string): Promise<Record<string, string>[]> {
  const accountId = env.AE_ACCOUNT_ID;
  const token = env.AE_QUERY_TOKEN;
  if (!accountId || !token) throw new Error('AE 查询凭据未配置');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain' },
    body: sql,
  });
  if (!response.ok) throw new Error(`AE SQL ${response.status}`);
  const payload = (await response.json()) as { data?: Record<string, string>[] };
  return payload.data ?? [];
}

async function fetchStats(env: Env): Promise<StatsPayload> {
  // AE 的 ClickHouse 子集：count() 无参、时间列为 timestamp、无 uniq/无子查询——
  // 独立客户端去重用等价写法：GROUP BY day, blob8 的返回行数 = 该日去重客户端数
  // （每组一行，数行数即数组数）。两个去重查询失败不拖垮看板，降级为 null。
  const [dailyDlAsset, dailyUpd, assets, versions, active, updClients, dlClients] = await Promise.all([
    aeQuery(env, "SELECT toStartOfDay(timestamp) AS day, blob4 AS asset, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' GROUP BY day, asset ORDER BY day LIMIT 10000"),
    aeQuery(env, "SELECT toStartOfDay(timestamp) AS day, count() AS hits FROM easy_suite_dl WHERE blob1 = 'upd' GROUP BY day ORDER BY day"),
    aeQuery(env, "SELECT blob4 AS asset, blob6 AS country, blob5 AS channel, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' GROUP BY blob4, blob6, blob5 ORDER BY hits DESC LIMIT 30"),
    aeQuery(env, "SELECT blob7 AS clientVer, count() AS heartbeats FROM easy_suite_dl WHERE blob1 = 'upd' AND blob7 != '' GROUP BY clientVer ORDER BY heartbeats DESC LIMIT 15"),
    aeQuery(env, "SELECT count() AS heartbeats7d FROM easy_suite_dl WHERE blob1 = 'upd' AND timestamp > NOW() - INTERVAL '7' DAY"),
    distinctClients(env, 'upd'),
    distinctClients(env, 'dl'),
  ]);

  const dailyDownloads = rollupDaily(dailyDlAsset);
  const dailyInstalls = rollupDaily(dailyDlAsset.filter((r) => !META_ASSETS.has(String(r.asset || ''))));
  const downloads = dailyDownloads.reduce((sum, r) => sum + r.hits, 0);
  const installs = dailyInstalls.reduce((sum, r) => sum + r.hits, 0);
  const heartbeats = dailyUpd.reduce((sum, r) => sum + Number(r.hits || 0), 0);
  const countries = new Set(assets.map((r) => r.country).filter(Boolean)).size;

  // 版本表补"未上报"行：心跳总数 - 已带 ?v= 之和（两次独立查询间 AE 近似可能有
  // 毫秒级漂移，负值钳 0），让表与总量对得上而不是像数据坏了
  const versionRows = versions.map((r) => ({ clientVer: r.clientVer || '', heartbeats: Number(r.heartbeats || 0) }));
  const reported = versionRows.reduce((sum, r) => sum + r.heartbeats, 0);
  const unreported = Math.max(0, heartbeats - reported);
  if (unreported > 0) versionRows.push({ clientVer: '', heartbeats: unreported });

  return {
    totals: {
      installs,
      metaHits: downloads - installs,
      downloads,
      heartbeats,
      heartbeats7d: Number(active[0]?.heartbeats7d || 0),
      uniqueClients: updClients?.total ?? null,
      uniqueDownloaders: dlClients?.total ?? null,
      countries,
    },
    dailyDownloads,
    dailyInstalls,
    dailyHeartbeats: dailyUpd.map((r) => ({ day: String(r.day), hits: Number(r.hits || 0) })),
    dailyClients: updClients
      ? [...updClients.byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, clients]) => ({ day, clients }))
      : null,
    assets: assets.map((r) => ({ asset: r.asset || '', country: r.country || '', channel: r.channel || '', hits: Number(r.hits || 0) })),
    versions: versionRows,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  };
}

/** 按天汇总（行内可带 asset 等任意分组维度，只累加 hits） */
function rollupDaily(rows: Record<string, string>[]): { day: string; hits: number }[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = String(r.day || '');
    byDay.set(day, (byDay.get(day) ?? 0) + Number(r.hits || 0));
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, hits]) => ({ day, hits }));
}

/**
 * 独立客户端去重（指定路由）：GROUP BY day, blob8 每组返回一行，
 * 该日的行数 = 当日去重 IP 哈希数，总行数 = 窗口内去重客户端数。
 * 行数受 AE 单查询 1 万行上限约束——按当前流量够用数年，超限只会少算不会报错。
 * 失败返回 null（看板显示 —），不影响其余面板。
 */
async function distinctClients(env: Env, route: 'dl' | 'upd'): Promise<{ byDay: Map<string, number>; total: number } | null> {
  try {
    const rows = await aeQuery(
      env,
      `SELECT toStartOfDay(timestamp) AS day, blob8 AS ipHash, count() AS hits FROM easy_suite_dl WHERE blob1 = '${route}' AND blob8 != '' GROUP BY day, ipHash LIMIT 10000`,
    );
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const day = String(r.day || '');
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return { byDay, total: rows.length };
  } catch {
    return null;
  }
}

async function serveStatsJson(env: Env): Promise<Response> {
  try {
    const stats = await fetchStats(env);
    // 官网 /easy-suite/stats/ 页面跨域拉取此端点渲染看板
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return json({ error: 'stats unavailable', detail: String(error).slice(0, 120) }, 503);
  }
}
