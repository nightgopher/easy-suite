# Easy Suite

EasyAgent 与 EasyGateway 的官方网站（Astro 静态站点），部署于 GitHub Pages：

**https://nightgopher.github.io/easy-suite/**

- [EasyAgent](https://github.com/nightgopher/easyagent) — Go 驱动的个人 AI 编程助手与 Agent 工作台（桌面 / Android / Web / TUI / 飞书 / MCP）
- [EasyGateway](https://github.com/nightgopher/easygateway) — 个人 AI 基础设施网关（三协议兼容、能力调度、账号渠道、技能中心、记忆与助理）

官网自带博客（`/blog/`，产品动态与技术文章）与 RSS 订阅（`/rss.xml`）。

## 结构

```
easy-suite/
├── astro.config.mjs        # site + base=/easy-suite + Shiki 深色主题
├── public/favicon.svg
├── src/
│   ├── content.config.ts   # blog 集合 schema（title/description/pubDate/tags/draft）
│   ├── content/blog/*.md   # 文章（文件名即 URL slug）
│   ├── layouts/Base.astro  # 共享导航/页脚 + 交互脚本（菜单/复制/版本号刷新）
│   ├── pages/
│   │   ├── index.astro     # 首页（产品介绍）
│   │   ├── 404.astro
│   │   ├── rss.xml.js
│   │   └── blog/{index.astro,[slug].astro}   # 博客列表 / 文章详情
│   ├── styles/{site.css,blog.css}            # 「青夜」视觉 tokens + 博客样式
│   └── lib/{site.ts,format.ts}
└── .github/workflows/deploy.yml              # push main → 构建并发布
```

## 写文章

往 `src/content/blog/` 新增一个 `.md` 文件（文件名即 slug）：

```markdown
---
title: 文章标题
description: 一句话摘要（列表卡片与 RSS 用）
pubDate: 2026-11-06
tags: [产品动态]
---

正文，支持 Markdown 与 Shiki 代码高亮。
```

`draft: true` 的文章不会构建发布。日期按日历日期展示，无时区偏移。

## 本地开发

```bash
npm install
npm run dev       # 开发服务器
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物（含 /easy-suite/ 前缀）
```

## 维护

- 页面上的版本号有 JS 兜底值；页面加载时会从 GitHub API 拉取最新 release 动态刷新，一般无需手工跟进版本。
- 功能或安装方式变化时，同步修改 `src/pages/index.astro` 中对应产品区块。

## 部署

推送 `main` 即自动构建发布（GitHub Actions：`.github/workflows/deploy.yml`，Pages source = GitHub Actions）。构建失败时线上站点保持上一版本。
