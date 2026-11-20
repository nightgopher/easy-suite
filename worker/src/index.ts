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
