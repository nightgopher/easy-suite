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

- **主站**：推送 `main` 自动构建发布到 GitHub Pages（`.github/workflows/deploy.yml`，Pages source = GitHub Actions）。构建失败时线上站点保持上一版本。
- **镜像**：同一仓库接入腾讯 EdgeOne Pages（免费、默认域名免备案、国内可访问）后，push `main` 双站同步更新。

### 镜像接入（EdgeOne Pages，一次性）

1. 登录 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages) → 创建项目 → 导入 Git 仓库 `nightgopher/easy-suite`（GitHub 授权）。
2. 构建配置（框架一般自动识别为 Astro）：
   - **构建命令**：`PUBLIC_SITE_BASE=/ npm run build`（关键：根路径部署必须切换 base）
   - **输出目录**：`dist`
   - **生产分支**：`main`
3. 部署完成获得默认域名（`*.edgeone.app`），国内可直接访问。

镜像适配已内置：镜像构建的 canonical / og:url / sitemap / RSS 始终指向主站 `nightgopher.github.io/easy-suite`，搜索引擎只收录主站，镜像只服务访问主站有困难的人群。若构建报 Node 版本错误，在项目环境变量设 `NODE_VERSION=22`（仓库已带 `.nvmrc`）。
