---
name: x-reply
description: X (Twitter) reply 战略每日执行 — reply-guy 冷增长流水线。搜高互动英文靶子帖 → 起草 ≤275 加权字符的回复草稿 → 用户过目批准后用 ego-browser 自动发布并核验落地。当用户说"x-reply"、"跑 reply 轮"、"找靶子"、"发回复"、"回复战略"、"今天还没跑回复吧"，或 X 日报（x-digest）完成后想顺手推进 reply 增长时，务必使用本技能。
version: 1.0.0
---

# x-reply — X reply 战略流水线

为 X 冷增长账号执行一轮 reply-guy 增长：搜索高互动英文靶子帖 → 起草回复草稿 →
用户批准 → 自动发布 → 落地核验 → 登记 ledger。**发布必须经用户逐条批准**，
本技能永不绕过这一步。

## 账号与硬约束

- 账号：Ego Lite 浏览器中已登录的 X 账号（身份见 references/reply-profile.md 的个性化配置）
- **回复上限 280 加权字符**（无 Premium 时；CJK/emoji 按 2 计）。草稿一律 ≤275 留安全边，
  起草后必须用 `scripts/charcount.py` 校验，超限先压缩再呈现给用户
- 若账号后续开通了 Premium（长回复解锁），更新此约束与 reply-profile.md

## 每轮流程

### 1. 找靶子

```bash
ego-browser nodejs < <skill-dir>/scripts/hunt.mjs 2>&1 | tee /tmp/x-reply-hunt.json
```

脚本按 reply-profile.md 配置的搜索词（默认 coding agent / claude code / AI agent /
MCP 相关）搜最近 48h 高互动英文帖并输出 JSON。从结果中挑 2-3 条候选，标准：

- **提问帖 > 大 V 观点帖 > 项目发布帖**（提问帖的回复曝光率最高）
- 领域与 reply-profile.md 的「弹药库」有真实交集——能写出具体经验的才选
- 排除：政治/crypto/明星八卦、内容农场式 listicle 号（受众不匹配）、广告
- 查 references/replied.json：回过的帖不再回

### 2. 读原文全文

搜索结果里的正文是截断的。**发布前必须打开原帖读全文**——回复半读的帖子会被挂。
同时浏览高赞回复，避免撞车（别人写过的角度换掉）。

### 3. 起草（每条 ≤275 加权字符）

声音准则（详见 reply-profile.md）：第一人称 builder 视角；给具体经验/具体机制，不空夸；
结尾一句 quotable（可选）；不用感叹号堆情绪；不带营销链接；同一轮最多 1 条自然提自己项目。

每条草稿跑一遍校验：

```bash
<skill-dir>/scripts/charcount.py "草稿文本"
```

### 4. 用户过目

以表格呈现：目标帖（链接+作者+互动数）/ 我们的 angle / 草稿全文 / 加权字符数。
用户批准哪条发哪条；用户改稿就按改稿发布。**未经批准的草稿绝不发布。**

### 5. 发布（技术手册见下）

### 6. 核验与登记

- 每条发布后核验：弹窗关闭 + 回复时间线（`https://<handle>/with_replies`）确认出现
- **toast 不可信**（"已存草稿"也弹 toast，超限失败也弹报错 toast）
- 全部核验后把每条登记进 references/replied.json：
  `{ "<被回复帖status_id>": { "date": "YYYY-MM-DD", "target": "@handle", "url": "...", "textHead": "前60字", "chars": 272 } }`
- 同一帖发布失败 2 次 → **停手**，把最终文案交用户手动贴（反 spam 保护，勿硬刷）

### 7. 周复盘（可选）

周末拉一遍 `/with_replies`，把本周各回复的点赞/回复数记回 replied.json 的 `perf` 字段，
筛出高表现 angle 存入 reply-profile.md 的「有效 angle」小节，迭代声音。

## 发布技术手册（2026-11-23 实战踩坑全记录，照抄即可复用）

X 的编辑器是 Lexical，自动化有五个坑，全部绕过后的可靠流程：

1. **`page.fill()` 和 `execCommand('insertText')` 对 X 编辑器无效**——文本塞不进去。
   唯一可靠路径：真实鼠标点击 + 键盘逐字：
   ```js
   // 定位弹窗内输入框中心偏左，用 CDP 原生鼠标事件点击
   await page.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
   await page.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
   await page.waitForTimeout(600);
   await page.keyboard.type(text, { delay: 6 });
   ```
2. **composer 必须在 `[role="dialog"]` 作用域内找**——点主帖的回复按钮会开弹窗 composer，
   但页面 DOM 里还有一个内联 composer，裸 `querySelector('[data-testid="tweetTextarea_0"]')`
   可能抓到内联那个，点击坐标打空枪（表现为：弹窗空白、按钮永远 disabled）
3. **发送按钮分两种**：弹窗的是 `tweetButton`，内联的是 `tweetButtonInline`（基本永远 disabled）。
   只点已启用的：`document.querySelector('[role="dialog"] [data-testid="tweetButton"]:not([disabled])')`，
   轮询等待启用（500ms × 20）
4. **成功信号 = 弹窗关闭**（`[role="dialog"] [data-testid="tweetTextarea_0"]` 消失），
   外加 with_replies 时间线核验。toast 什么都说明不了
5. **ego-browser 任务空间**：`finish({ keep: [] })`；报"空间属于用户"时用新空间名，别 takeover

## 与 x-digest 的联动

每日 x-digest 日报完成并确认后，若当日尚未跑 reply 轮，主动提醒用户一次
（"今天还没跑 reply 轮，要来一轮吗"）。用户同意即进入本技能第 1 步。
