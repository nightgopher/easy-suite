---
name: x-digest
description: 刷用户的 X (Twitter) 并生成定制化中文日报。通过 ego-browser 打开用户已登录的 X For you 推荐流，滚动采集最近 24 小时推文，按用户兴趣画像（AI/Agent 工程、系统编程、独立开发搞钱、开发者工具）过滤广告、分类排序，在对话中输出「X 日报」。当用户说"刷一下X"、"看看今天X上有什么"、"刷X总结"、"X日报"、"帮我看看推特"、"今天推特上有什么值得看的"、"x-digest"，或询问今天 X/Twitter 的热点、想了解推荐流里有什么内容时，务必使用本技能。
tags:
  - Social
  - Summary
  - Crawler
  - Knowledge
displayName: X 日报
aliases:
  - X日报
  - 刷X
  - 刷X总结
  - 推特日报
  - Twitter日报
scenarios:
  - 用户想了解今天 X/Twitter 上有什么值得看的内容
  - 用户说"刷一下X"、"X日报"、"刷X总结"
  - 用户想了解自己的 X 推荐流平时都推些什么
version: 1.1.0
---

# x-digest — 定制化刷 X 日报

为用户采集其 X For you 推荐流，产出一份按个人兴趣筛选排序的中文日报。
核心价值在于**过滤噪声、按画像排序、给出点评**，而不是罗列推文。

## 流程

### 1. 采集

运行打包好的采集脚本（通过 stdin 传入，ego-browser 不支持直接执行脚本文件）。
`<skill-dir>` 是本 SKILL.md 所在目录（调用技能时系统会给出 base directory）：

```bash
ego-browser nodejs < <skill-dir>/scripts/collect.mjs 2>&1 | tee /tmp/x-digest-collect.json
```

JSON 结果在 stdout/stderr 混合输出里（用上面的 tee 落一份到 /tmp/x-digest-collect.json 便于解析）。
脚本会：打开 x.com/home → 滚动采样约 16 轮 → 按 `<time>` 时间戳区分 organic 与广告 →
去重 → 输出 JSON（`status`、`tweets[]`（24h 内，含 handle/name/text/time/permalink/
replies/rts/likes）、`adsHandles`、`staleCount` 等字段）。

- `status == "need_login"`：脚本已 `handOff()`。告诉用户在浏览器里登录 X，等用户确认后
  `takeOverTaskSpace(<输出的 spaceId>)` 接管，再跑一次采集脚本。
- `freshCount` 很低（< 10）：推荐流可能被刷过或加载受限，可把脚本复制到临时目录、
  调大 `CONFIG.SCROLL_ROUNDS` 或 `HOURS_WINDOW` 再跑一次；仍失败就如实告知，不要编造。
- 采集完成后不要急着 `finish()`，日报输出确认无误再收尾（见第 4 步）。

### 2. 读画像

读 `references/profile.md`。它定义了主题权重、过滤规则和排序原则，是筛选的唯一依据。
用户提出新的偏好时（"以后这类别推"），更新该文件并在「画像维护日志」记录一行。

### 3. 筛选与撰写

- 广告（脚本已标记 + `adsHandles`）全部丢弃，只在末尾报数量。
- 大厂产业新闻（融资/拆分/预算/人事）直接过滤，不进任何板块——详见 profile.md 过滤规则。
- 按画像给推文分组、排序；同一事件的多个帖子合并为一条；板块权重顺序见 profile.md。
- 每条写法：**[标题式概括](permalink)** — @handle：一句话内容 + 简短点评。
  点评从用户视角出发（对用户在做项目的借鉴、副业可复制性），不要复述原文。
- 互动数据仅作参考，不照抄进正文；@handle 用真实 handle 便于用户点击跳转。
- 筛选时同步判定「可行动性」：能写出「具体项目 + 具体动作」借鉴点的条目才保留，
  写不出的按 profile.md 点评红线直接丢弃。可行动条目追加登记进本技能目录 `backlog.md`
  （无则按下方模板创建），并在日报「🔧 可行动项」列出；深读与落地执行交给 x-follow 技能。

backlog 模板（首次创建 `backlog.md` 时写入表头即可）：

```markdown
# X 日报可行动项 backlog

> x-digest 产出日报时登记（状态=open），x-follow 跟进后销项（done/dropped + 一行结论）。

| # | 日期 | 条目 | 关联 | 建议动作 | 状态 |
|---|------|------|------|----------|------|
```

### 4. 输出与收尾

使用下面的模板（板块无内容就整块删掉；全文控制在 ~60 行内，宁缺毋滥）：

```markdown
# X 日报 · YYYY-MM-DD（HH:MM 更新，采集 N 条 / 过滤广告 M 条）

## 🎯 今日必读
- **[概括](链接)** — @handle：内容一句话。👉 点评：为什么值得你看。

## 🧩 开源项目 / 工具横评
## 🤖 AI / Agent 工程
## 💰 副业 / 搞钱 pipeline
## 🖥 自托管 / 白嫖资源
## 🦀 系统编程
## 💼 职场 / 行业
## 🌏 时事速览
- 一行一条，标题级信息

## 🔧 可行动项
- [条目概括] → 关联项目：建议动作一句话（已记入 backlog #N）

## 📊 流画像速记
- 今日推荐流话题分布一句话 + （如发现连续高质量的新账号）值得关注的账号
```

输出日报后，如本次浏览器任务仍在你的控制中，运行：

```bash
ego-browser nodejs -e 'const task = await taskSpace(<spaceId>); await task.finish({ keep: [] });'
```

## 依赖

- `ego-browser` CLI（若不可用，先读 ego-browser 技能的安装说明，不要静默降级为 WebFetch——
  未登录抓取拿不到用户定制推荐流，产出没有意义）。
- 用户在 Ego Lite 浏览器里保持 X 登录态（通常已存在）。

## 日报之后的 reply 轮（可选联动）

日报输出确认无误、收尾步骤完成后，若安装了 **x-reply** 技能且当日尚未跑 reply 轮，
可主动提醒用户一次："今天还没跑 reply 轮，要来一轮吗？"用户同意即调用 x-reply。
用户拒绝就收尾，不追问。
