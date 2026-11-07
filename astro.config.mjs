// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 主站部署于 GitHub Pages 项目站点子路径：https://nightgopher.github.io/easy-suite/
// 镜像（EdgeOne Pages 等根路径部署）构建时设 PUBLIC_SITE_BASE=/ 切换；
// canonical/og/sitemap 始终指向主站（见 src/lib/site.ts 的 PRIMARY_PATH_BASE），搜索引擎只收录主站。
const SITE_ORIGIN = 'https://nightgopher.github.io';
const PRIMARY_PATH_BASE = '/easy-suite';

export default defineConfig({
  site: SITE_ORIGIN,
  base: process.env.PUBLIC_SITE_BASE ?? PRIMARY_PATH_BASE,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // sitemap URL 归一化到主站固定子路径：镜像构建（base=/）与主站构建产物一致
      serialize(item) {
        const u = new URL(item.url);
        let path = u.pathname;
        const buildBase = (process.env.PUBLIC_SITE_BASE ?? PRIMARY_PATH_BASE).replace(/\/+$/, '');
        if (buildBase && path.startsWith(buildBase)) {
          path = path.slice(buildBase.length) || '/';
        }
        u.pathname = PRIMARY_PATH_BASE + path;
        item.url = u.href;
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
    },
  },
});
