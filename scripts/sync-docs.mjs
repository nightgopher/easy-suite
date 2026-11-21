/**
 * 从 easyagent 仓库拉取文档快照到 content collections。
 *
 * 每次构建前运行（package.json 的 build 预置步骤）：拉 docs/*.md 与 CHANGELOG.md，
 * 把文档内的相对 .md 链接改写为 ../slug/ 相对路径——该形式对主站子路径部署
 * （/easy-suite/docs/…）与镜像根路径部署（/docs/…）同时正确。
 *
 * 容错原则：单文件拉取失败保留本地旧快照，全部失败也仅告警不阻塞构建——
 * 文档站是增强层，快照略旧好过构建失败。
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'https://raw.githubusercontent.com/nightgopher/easyagent/main';
const DOCS = [
  'API.md', 'ARCHITECTURE.md', 'CONFIG.md', 'CONTRIBUTING.md', 'DESKTOP.md', 'FEISHU.md',
  'INTERNALS.md', 'IOS_CLIENT_DESIGN.md', 'LARK_WATCH.md', 'MCP.md', 'MINI_DEPLOY.md',
  'QA_ANDROID.md', 'README.md', 'RELAY_ACCESS_DESIGN.md', 'RELEASING.md', 'SECURITY_MODEL.md',
  'SKILL_MARKET.md', 'WORKTREES.md',
];
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DOCS = path.join(ROOT, 'src/content/docs');
const OUT_CHANGELOG = path.join(ROOT, 'src/content/changelog');

/** 顶层 docs/*.md 之间的相对链接 → ../slug/（页面上再上跳一级才对）；
 *  指向仓库内其他文件的相对链接 → GitHub 地址（docs 之外的相对路径在本站无对应页面），
 *  图片用 raw 地址保证直接可显示，其余用 tree 地址浏览。 */
function rewriteLinks(text, knownSlugs) {
  return text.replace(/(!?)\]\(([^)#\s]+)(#[^)\s]*)?\)/g, (match, bang, target, anchor) => {
    if (/^[a-z]+:|^\/|^#/.test(target)) return match;
    const base = path.basename(target).toLowerCase().replace(/\.md$/, '');
    if (!bang && target.endsWith('.md') && knownSlugs.has(base)) return `](../${base}/${anchor ?? ''})`;
    if (/^(\.\.\/|[\w.-]+$|[\w-]+\/)/.test(target)) {
      const root = bang ? 'raw.githubusercontent.com/nightgopher/easyagent/main' : 'github.com/nightgopher/easyagent/tree/main';
      const repoPath = path.posix.normalize(`docs/${target}`).replace(/^\//, '');
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
  const slugs = new Set(DOCS.map((f) => f.replace(/\.md$/, '').toLowerCase()));

  let fresh = 0;
  for (const name of DOCS) {
    try {
      const text = await fetchText(`${RAW}/docs/${name}`);
      const slug = name.replace(/\.md$/, '').toLowerCase();
      await writeFile(path.join(OUT_DOCS, `${slug}.md`), rewriteLinks(text, slugs));
      fresh += 1;
    } catch (error) {
      console.warn(`sync-docs: 保留旧快照 docs/${name}（${String(error).slice(0, 80)}）`);
    }
  }

  try {
    const text = await fetchText(`${RAW}/CHANGELOG.md`);
    await writeFile(path.join(OUT_CHANGELOG, 'changelog.md'), text);
    fresh += 1;
  } catch (error) {
    console.warn(`sync-docs: 保留旧快照 CHANGELOG.md（${String(error).slice(0, 80)}）`);
  }

  console.log(`sync-docs: ${fresh}/${DOCS.length + 1} 个文件已更新`);
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
