# ChatGPT + Ego Lite 操作细节（DOM/选器/API 速查）

> 全部条目实战验证于 2026-11-22（ChatGPT 界面版本迭代后需复查）。

## 页面结构

- 输入框：`[contenteditable='true']`（无 id/testid），先 `click()` 聚焦再
  `keyboard.insertText()`；回车发送
- 简单生图轮询 1-3 分钟；Pro 代理流（会显示 确定布局方案/正在运行命令/子智能体
  Paper、Source qa）5-8 分钟
- busy 判据：页面文本含「正在思考」「正在运行命令」「正在生成」
- 成品形态两种：内联大图（oaiusercontent/azure URL）**或** 文件卡
  （「xxx.png」+ 打开预览/另存为 按钮）——轮询时都要查

## 参考图注入（合成 paste）

ego-browser 的 setInputFiles 对 ChatGPT 输入框无效，用 DataTransfer 合成 paste：

```js
// Node 侧先把图片读成 base64 传进 evaluate
const pasted = await page.evaluate(async (paths) => {
  const ce = document.querySelector("[contenteditable='true']");
  if (!ce) return "no-composer";
  ce.focus();
  const dt = new DataTransfer();
  for (const p of paths) {
    const bytes = Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0));
    dt.items.add(new File([bytes], p.name, { type: "image/png" }));
  }
  ce.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  return "pasted:" + dt.items.length;
}, payload);
```

粘贴后截图确认缩略图挂载再发送。

## 取成品三条路

1. 下载事件：预览弹窗顶部/消息动作栏 aria-label=「下载」按钮；先
   `page.waitForEvent("download")` 再坐标点；`download.saveAs(绝对路径)`
2. library 链接：文案区「查看高清原图」href = `chatgpt.com/library?file_id=…`
   → 打开 → 页内大图 src = `chatgpt.com/api/library/files/<file_id>/content`
   → `page.fetch(src, { saveAs })`
3. files API（sediment 指针）：会话 JSON（`/backend-api/conversation/<id>` 带
   Bearer，token 从 `/api/auth/session`）里 `"asset_pointer":"sediment://file_xxx"`
   → `GET /backend-api/files/<fid>/download` → `download_url`（estuary）→ fetch

## 九宫格切页（canvas）

在 library 预览页执行（图已加载）：

```js
const img = [...document.querySelectorAll("img")].find((i) => i.getBoundingClientRect().width > 300);
const full = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = img.src; });
const cw = Math.floor(full.naturalWidth / 3), ch = Math.floor(full.naturalHeight / 3);
// 3×3 循环：canvas.drawImage 裁格 → toDataURL("image/png") → Node 侧 Buffer 写盘
```

## ChatGPT 限制备忘

- GitHub 头像 <1MB（PNG 原图常超）→ sips 转 480px JPG
- X 非 Premium 单条 280 字符（thread 每条都要压）
- 生成同一风格多张：**同一会话连续追加**（"Same style again…"）保持一致性
- 账号 More 菜单（…）含删除——坐标操作避开 (1267,25) 附近

## 小红书 creator 发布速查

- 域名：creator.xiaohongshu.com/publish/publish（默认视频 tab）
- 切图文：点 `.creator-tab` 文本=「上传图文」（页内 tab 元素有重名副本，
  class 含 title 的不是可点项）
- 图片 input：`input[type='file']`（accept 含 .jpg/.png，multiple），一次喂 9 张保序
- 标题：placeholder「填写标题会有更多赞哦」，**≤20 字**（超限发布键禁用）
- 正文：`[contenteditable='true']`，逐行 insertText + Enter 保换行；emoji 用 insertText
- 话题：正文输入 `#xxx` 触发下拉 → **必须鼠标点选下拉项**（如 #交互课件 246.7万浏览）
  → 下拉会遮挡发布按钮，选完重新定位
- 发布按钮：文本「发布」精确匹配常失效 → `getBoundingClientRect` 动态定位 +
  `page.mouse.click(x, y)`；成功判据 = URL 出现 `published=true`
- 新号首笔记审核：几分钟-几小时；状态查
  主页 `xiaohongshu.com/user/profile/<id>` 的笔记列表
- 位置权限弹窗会出现一次 → handOff 让用户点拒绝

## 万事屋视觉基线（跨内容统一）

- 深色底 #0b1412 / 强调 #4fd1a5（官网同源）
- 头像/横幅源文件：media-lab/assets/{avatar-1024,banner-wide}.png
- 红包封面等节令品在基线上做节日变体，不换基色
