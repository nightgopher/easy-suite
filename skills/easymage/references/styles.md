# 风格提示词库（全部实战产出过成品）

## 极简产品风 · 小红书九宫格笔记（9 页 3:4）

白色底、留白、统一主体（注入用户截图则界面忠于截图）、主题色标题 + 深灰说明。
骨架：封面 1 + 内页 7 + 结尾 1；第 6 页斜向纸带跨主体，第 7 页三主体上下排列；
禁止所有页同一大图加标题。成品示例：media-lab/assets/note-01/（交互课件 9 页）。

Prompt 骨架（替换中文变量）：
```
参考我上传的 N 张截图(主体说明),按以下规范生成一套小红书图文:
风格:极简产品风——白色底、干净留白、统一主体(界面内容忠于截图);标题用
<主题色 hex>,少量深灰说明文字,优雅高对比中文标题。
版式:竖版 3:4,共 9 页 = 封面 1 + 内页 7 + 结尾 1;第 6 页斜向纸带跨主体,
第 7 页三主体上下排列;不要所有页同一张大图加标题。
九页文案:
01 封面:<钩子大字>
02 痛点:<目标人群的自问>
03-07 <逐页干货,每页一句话>
08 互动:<引导评论的问题>
09 结尾:<关注/领取钩子>
请先输出 3×3 九宫格预览(3:4 画布),并逐页列出完整文案。
```

## 攻略卡 · 旅游/教程系列（3-4 张组合）

同一会话连续生成保持风格统一。实战成品：media-lab/assets/shanghai-note/。

- **路线总览卡**（封面）：`A clean timeline route map, 3:4 vertical, white bg,
  mint green (#4fd1a5) accents. Stylized route line connecting N illustrated
  landmark icons in order, each with time label + short Chinese label. Top title
  bold Chinese: <标题>. Bottom small text: 附时间点·交通·人均消费. Minimal flat
  design, dotted path with mint dots.`
- **时间表卡**：`Same style. Generate card 2: a clean schedule table card.
  Title: <主题>时间表（实测节奏）. Rows: time + activity + transport note. Footnote: …`
- **贴士卡**：`Same style again. Generate card 3: tips card. Title: <人群>先看这 N 条.
  Numbered list with small icons. Bottom note: <一句话兜底>`

## 头像（1024², 圆裁友好）

实战成品：万事屋小事务所（夜色铺子 + OPEN 灯牌 + 机械猫）。
```
Generate one square avatar image, 1024x1024, flat minimalist vector illustration:
<主体场景描述>. Background: <深色底 hex>. Accent: <强调色 hex>.
Clean flat vector style, centered composition, designed to be cropped as a
circular social media avatar. No text other than <必要元素>.
```
坑：GitHub 头像 <1MB（原图常 1.3MB 被拒）→ `sips -Z 480 -s format jpeg
-s formatOptions 85`；B站要求 180×180。

## 横幅（宽幅 3:1）

同头像场景改全景：`wide horizontal banner, landscape 3:1 (1500x500) … panoramic
night scene … wide cinematic composition with calm empty space on both sides`。
成品：media-lab/assets/banner-wide.png。

## 红包封面（节令品，2027 春节窗口 = 12 月备货）

微信红包封面开放平台个人创作者可提交，¥1/个定价，春节是全年 90% 销量。
提示词方向（结合 vane 仓 wechat-red-packet-cover 的 36 风格分类）：
- 传统艺术类：剪纸/年画/烫金，主元素生肖 + 「福」变体
- 趣味角色类：万事屋机械猫拜年（自有 IP！差异化关键）
- 现代设计类：极简线条 + 品牌色渐变
尺寸规格提交前以开放平台最新文档为准（历史为 957×1278 竖版）。
红线：不碰 Disney/宝可梦等 IP 元素；「微信」字样不可入画。

## 组合建议（内容矩阵联动）

生成本体后按 strategy 内容矩阵改壳：九宫格笔记 → 小红书；攻略卡 → 抖音口播脚本
分镜；头像/横幅 → 全平台统一视觉。所有成品入 media-lab/assets/<选题>/。
