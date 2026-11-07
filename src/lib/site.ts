/** 站点部署在 GitHub Pages 子路径 /easy-suite/，站内链接统一经 withBase 拼前缀 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path: string): string {
  if (path.startsWith('/')) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}

/**
 * 规范来源：canonical / og:url / JSON-LD 统一指向主站。
 * 多镜像部署时（构建时设 PUBLIC_CANONICAL_ORIGIN 不变），镜像页也会把
 * 搜索引擎引到主站，避免重复收录。
 */
export const CANONICAL_ORIGIN = String(
  import.meta.env.PUBLIC_CANONICAL_ORIGIN ?? import.meta.env.SITE ?? 'https://nightgopher.github.io'
).replace(/\/+$/, '');

/** 站内路径 → 主站绝对 URL */
export function absoluteUrl(path: string): string {
  return `${CANONICAL_ORIGIN}${withBase(path)}`;
}

/** 默认 OG 分享图（1200×630） */
export const OG_IMAGE = absoluteUrl('/og-default.png');
