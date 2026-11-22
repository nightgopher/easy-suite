---
name: easymage
description: |
  Browser-based image generation studio: drive ChatGPT (logged-in session in Ego Lite)
  to produce styled social-media image sets — xiaohongshu nine-grid notes, single guide
  cards, WeChat red-packet covers, avatars, banners — using proven style prompt templates.
  Includes reference-image injection, generation polling, output retrieval (download
  events / library API / files API), and nine-grid slicing via canvas.
  Trigger: "生成配图", "小红书图文", "九宫格", "红包封面", "生图", "头像", "横幅",
  "攻略卡片", "easymage", "生成笔记配图".
allowed-tools: Bash(ego-browser *), Bash(cp *), Bash(sips *)
aliases:
  - 生图
  - 小红书图文
  - 配图生成
  - 红包封面
  - 九宫格
tags:
  - Content
  - Image
  - SocialMedia
---

# EasyMage · 浏览器生图工坊

用 Ego Lite 驱动已登录的 ChatGPT，按成熟风格模板批量产出社媒配图。本技能是 4 轮实战
（X 头像/横幅、小红书九宫格笔记、上海攻略卡）验证过的流水线固化。

## 前置条件

- Ego Lite 已登录 chatgpt.com（先 `ego-browser skill` 读用法）
- 输出目录约定：`media-lab/assets/<选题名>/`（无 media-lab 仓库时用 ~/Downloads）

## 工作流（五步）

### 1. 选风格（references/styles.md）

按用途挑模板：小红书笔记 → 极简产品风/手帐拼贴；攻略卡 → 路线图/时间表/贴士卡；
头像 → 夜色小事务所系；横幅 → 宽幅全景；红包封面 → 见 styles.md 节令段。

### 2. 注入参考图（可选，强烈推荐真实截图）

把用户素材（产品截图/界面实拍）经合成 paste 事件注入 ChatGPT 输入框——生成的图会
忠于截图内容，比纯文字描述好一个档次：

```js
// ego-browser nodejs 内，图片先转 base64 传入
const dt = new DataTransfer();
for (const p of paths) {
  const bytes = Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0));
  dt.items.add(new File([bytes], p.name, { type: "image/png" }));
}
document.querySelector("[contenteditable='true']").dispatchEvent(
  new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
```

粘贴后等 2-3s 确认缩略图出现，再打字发送需求。

### 3. 发需求 + 轮询

输入框是 contenteditable（无 id/testid），`click` → `keyboard.insertText(brief)` → `Enter`。
轮询生成状态（简单生图 1-3 分钟；Pro 代理流可达 5-8 分钟）：

```js
// busy = 正在思考|正在运行命令|正在生成；完成 = busy==0 且出现 oaiusercontent/azure/blob 大图
```

**注意**：出图可能以文件卡形式出现（如「万事屋不打烊-交互课件九宫格.png」），不一定有
内联大图——检查 body 文本里的文件名与下载/预览按钮。

### 4. 取成品（三条路，按序尝试）

1. **下载事件**：找 aria-label=「下载」按钮（预览弹窗顶部 / 消息动作栏），先武装
   `waitForEvent("download")` 再坐标点击
2. **查看高清原图链接**：文案区可能有「查看高清原图」→ href 是
   `chatgpt.com/library?file_id=libfile_xxx` → 打开该页 → 取
   `chatgpt.com/api/library/files/<file_id>/content`（带 cookie fetch 存盘）
3. **files API**（新 sediment 指针）：会话 JSON 里 `"asset_pointer":"sediment://file_xxx"`
   → 先 `GET /api/auth/session` 取 accessToken → `GET /backend-api/files/<fid>/download`
   （带 Bearer）→ 返回 `download_url`（estuary content）→ fetch 存盘

### 5. 后处理

- **九宫格切页**：预览页 canvas 画 3×3 切片（见 references/chatgpt-flow.md 完整代码），
  每页 1080×1440
- **尺寸压缩**：GitHub 头像 <1MB；小红书 ≤20MB；`sips -Z 480 -s format jpeg -s formatOptions 85`
- **归档**：成品 + 源 prompt 写入 media-lab/assets/<选题>/，发布记录进 posts/

## 发布到小红书（可选延伸，流程已验证）

creator.xiaohongshu.com/publish/publish → 点 `.creator-tab`「上传图文」→
`input[type='file']`（multiple）按序喂图 → 标题 input（placeholder「填写标题」，
**≤20 字**）→ 正文 `[contenteditable='true']` 逐行 insertText → `#话题` 触发下拉后
**必须从下拉点选**（纯文本话题也能被索引，但点选权重更好）→ 发布按钮文本匹配易失效，
用 `getBoundingClientRect` 动态定位或视口坐标点击 → 成功判据：URL 含 `published=true`

**坑位清单**（每条都踩过）：
- 小红书发布页会弹位置权限 → 让用户点拒绝
- 话题下拉会挡住发布按钮 → 选完话题后重新定位按钮
- 新号首笔记进审核（几分钟到几小时），`published=true` 即成功
- ChatGPT 会话 More 菜单（…按钮）含「删除」——坐标操作前看清目标，绝不盲点 (1267,25)

## 风格模板与 API 细节

见 `references/styles.md`（全部实战 prompt）与 `references/chatgpt-flow.md`（DOM/选器/API）。
方法论来源：[vane-gpt-image-skills](https://github.com/VaneAi888/vane-gpt-image-skills)
（MIT）——本技能是其小红书图文方法在 Ego Lite 浏览器自动化上的移植与扩展。
