/** 站点部署在 GitHub Pages 子路径 /easy-suite/，站内链接统一经 withBase 拼前缀 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path: string): string {
  if (path.startsWith('/')) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}
