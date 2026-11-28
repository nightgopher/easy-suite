/**
 * 从 easyagent 与 easygateway 仓库拉取文档快照到 content collections。
 *
 * 每次构建前运行（package.json 的 build 预置步骤）：拉取双项目文档与 CHANGELOG.md，
 * 把同目录相对 .md 链接改写为 ../slug/ 相对路径——该形式对主站子路径部署
 * （/easy-suite/docs/…）与镜像根路径部署（/docs/…）同时正确。
 *
 * 容错原则：单文件拉取失败保留本地旧快照，全部失败也仅告警不阻塞构建——
 * 文档站是增强层，快照略旧好过构建失败。
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const AGENT_RAW = 'https://raw.githubusercontent.com/nightgopher/easyagent/main';
const GATEWAY_RAW = 'https://raw.githubusercontent.com/nightgopher/easygateway/main';

const AGENT_DOCS = [
  'API.md', 'ARCHITECTURE.md', 'CONFIG.md', 'CONTRIBUTING.md', 'DESKTOP.md', 'FEISHU.md',
  'INTERNALS.md', 'IOS_CLIENT_DESIGN.md', 'LARK_WATCH.md', 'MCP.md', 'MINI_DEPLOY.md',
  'QA_ANDROID.md', 'README.md', 'RELAY_ACCESS_DESIGN.md', 'RELEASING.md', 'SECURITY_MODEL.md',
  'SKILL_MARKET.md', 'SUBSTRATE.md', 'WORKTREES.md',
];

const GATEWAY_DOCS = [
  { remote: 'README.md', slug: 'gateway_overview', baseDir: '' },
  { remote: 'go-gateway/README.md', slug: 'gateway_server', baseDir: 'go-gateway' },
  { remote: 'desktop/README.md', slug: 'gateway_desktop', baseDir: 'desktop' },
  { remote: 'docs/ARCHITECTURE.md', slug: 'gateway_architecture', baseDir: 'docs' },
  { remote: 'docs/MEMORY_DESIGN.md', slug: 'gateway_memory', baseDir: 'docs' },
];

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DOCS = path.join(ROOT, 'src/content/docs');
const OUT_CHANGELOG = path.join(ROOT, 'src/content/changelog');

/**
 * 改写文档内的相对链接：
 * 1) 仅当目标是同目录兄弟文档（不含跨目录斜杠，如 CONFIG.md 或 ./CONFIG.md）且在 knownSlugs 中时，
 *    改写为 ../slug/；避免把 ../README.md 或 ../mobile-native/README.md 误判为 docs/README.md 导致死循环。
 * 2) 其余仓库内相对路径改写为对应 GitHub 仓库的绝对 URL（图片用 raw，其余用 tree）。
 */
function rewriteLinks(text, siblingMap, repo, baseDir) {
  return text.replace(/(!?)\]\(([^)#\s]+)(#[^)\s]*)?\)/g, (match, bang, target, anchor) => {
    if (/^[a-z]+:|^\/|^#/.test(target)) return match;
    const cleanTarget = target.replace(/^\.\//, '');
    if (!bang && !cleanTarget.includes('/') && cleanTarget.endsWith('.md')) {
      const key = cleanTarget.toLowerCase().replace(/\.md$/, '');
      if (siblingMap.has(key)) {
        return `](../${siblingMap.get(key)}/${anchor ?? ''})`;
      }
    }
    if (/^(\.\.\/|[\w.-]+$|[\w-]+\/)/.test(target)) {
      const root = bang
        ? `raw.githubusercontent.com/nightgopher/${repo}/main`
        : `github.com/nightgopher/${repo}/tree/main`;
      const joined = baseDir ? `${baseDir}/${target}` : target;
      const repoPath = path.posix.normalize(joined).replace(/^\/+/, '');
      return `](https://${root}/${repoPath}${anchor ?? ''})`;
    }
    return match;
  });
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function main() {
  await mkdir(OUT_DOCS, { recursive: true });
  await mkdir(OUT_CHANGELOG, { recursive: true });

  const agentSiblings = new Map(
    AGENT_DOCS.map((f) => {
      const slug = f.replace(/\.md$/, '').toLowerCase();
      return [slug, slug];
    }),
  );

  const gatewaySiblings = new Map([
    ['architecture', 'gateway_architecture'],
    ['memory_design', 'gateway_memory'],
  ]);

  let fresh = 0;
  const total = AGENT_DOCS.length + GATEWAY_DOCS.length + 1;

  for (const name of AGENT_DOCS) {
    try {
      const text = await fetchText(`${AGENT_RAW}/docs/${name}`);
      const slug = name.replace(/\.md$/, '').toLowerCase();
      await writeFile(
        path.join(OUT_DOCS, `${slug}.md`),
        rewriteLinks(text, agentSiblings, 'easyagent', 'docs'),
      );
      fresh += 1;
    } catch (error) {
      console.warn(`sync-docs: 保留旧快照 easyagent/docs/${name}（${String(error).slice(0, 80)}）`);
    }
  }

  for (const item of GATEWAY_DOCS) {
    try {
      const text = await fetchText(`${GATEWAY_RAW}/${item.remote}`);
      const sibMap = item.baseDir === 'docs' ? gatewaySiblings : new Map();
      await writeFile(
        path.join(OUT_DOCS, `${item.slug}.md`),
        rewriteLinks(text, sibMap, 'easygateway', item.baseDir),
      );
      fresh += 1;
    } catch (error) {
      console.warn(`sync-docs: 保留旧快照 easygateway/${item.remote}（${String(error).slice(0, 80)}）`);
    }
  }

  try {
    const text = await fetchText(`${AGENT_RAW}/CHANGELOG.md`);
    await writeFile(path.join(OUT_CHANGELOG, 'changelog.md'), text);
    fresh += 1;
  } catch (error) {
    console.warn(`sync-docs: 保留旧快照 CHANGELOG.md（${String(error).slice(0, 80)}）`);
  }

  console.log(`sync-docs: ${fresh}/${total} 个文件已更新`);
  if (fresh === 0) {
    try {
      await readFile(path.join(OUT_DOCS, 'config.md'));
      console.log('sync-docs: 网络不可达，使用本地快照继续构建');
    } catch {
      console.error('sync-docs: 无网络且无本地快照，docs 页面将为空集');
    }
  }
}

main();
