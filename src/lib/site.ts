/** 站点部署在 GitHub Pages 子路径 /easy-suite/，站内链接统一经 withBase 拼前缀 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path: string): string {
  if (path.startsWith('/')) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}

/**
 * 主站固定子路径：canonical / og:url / JSON-LD / RSS 始终指向主站路径，
 * 与镜像构建时的 base 无关（镜像构建设 PUBLIC_SITE_BASE=/，见 astro.config.mjs）。
 */
export const PRIMARY_PATH_BASE = '/easy-suite';

/**
 * 规范来源：canonical 统一指向主站，镜像页也会把搜索引擎引到主站，避免重复收录。
 * 如日后主站迁移自有域名，改 astro.config 的 site 即可。
 */
export const CANONICAL_ORIGIN = String(
  import.meta.env.PUBLIC_CANONICAL_ORIGIN ?? import.meta.env.SITE ?? 'https://nightgopher.github.io'
).replace(/\/+$/, '');

/** SEO 用绝对 URL：始终指向主站（含固定子路径），不受镜像构建 base 影响 */
export function absoluteUrl(path: string): string {
  return `${CANONICAL_ORIGIN}${PRIMARY_PATH_BASE}${path}`;
}

/** 默认 OG 分享图（1200×630，挂在主站） */
export const OG_IMAGE = absoluteUrl('/og-default.png');
