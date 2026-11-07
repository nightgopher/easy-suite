---
title: 为什么用 Astro 自建博客
description: 官网博客没有上 WordPress，也没有继续手写 HTML——选择 Astro 的三个理由：静态托管适配、Markdown 写作体验、内容集合工程化。
pubDate: 2026-11-06
tags: [构建思路, Astro]
---

给 Easy Suite 官网补博客板块时，面前有几条路：WordPress（配 Astra 之类主题）、继续手写 HTML、或用一个静态站点框架。最终选了 **Astro**，理由如下。

## 1. 部署形态决定上限

站点托管在 GitHub Pages——纯静态、无服务端。WordPress 需要 PHP + 数据库，意味着额外买服务器、做运维、管安全更新，为一篇博客引入一整套常驻基础设施，不值。Astro 构建产物就是纯 HTML/CSS/JS，`astro build` 之后推给 GitHub Pages 即可，零常驻成本。

## 2. Markdown 写作体验

博客的核心是长期写作。Astro 的内容集合（Content Collections）让每篇文章就是 `src/content/blog/` 下的一个 Markdown 文件：

```markdown
---
title: 文章标题
description: 一句话摘要
pubDate: 2026-11-06
tags: [构建思路]
---

正文从这里开始。
```

Frontmatter 有 zod schema 校验，字段写错构建时直接报错；列表页和详情页由框架生成，代码块用 Shiki 高亮，写作时只管内容本身。

## 3. 与现有代码无缝拼装

官网首页原本是手写单页，迁入 Astro 后整站共享同一份「青夜」视觉 tokens 与导航布局，博客页看起来就是官网的一部分，而不是另一套模板。构建输出挂在 `/easy-suite/` 子路径下，与 GitHub Pages 项目站点的部署方式完全兼容。

## 部署链

CI 用 GitHub Actions：推送 `main` 自动构建并发布，构建失败则站点保持上一版本。

```yaml
- run: npm ci
- run: npm run build   # astro build → dist/
- uses: actions/upload-pages-artifact@v3
```

这套组合（静态托管 + Markdown + 内容集合）对个人产品官网博客来说，是复杂度和体验之间最平衡的落点。以后如果要加标签页、全文搜索或 MDX 交互组件，都是在现有结构上做增量，不用推翻。
