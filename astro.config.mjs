// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 部署于 GitHub Pages 项目站点子路径：https://nightgopher.github.io/easy-suite/
export default defineConfig({
  site: 'https://nightgopher.github.io',
  base: '/easy-suite',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
    },
  },
});
