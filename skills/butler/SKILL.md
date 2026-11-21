---
type: skill
name: butler
description: "管家技能 — 项目感知、日报分析、知识库维护。自动扫描会话数据、分析每日工作、夜间维护 wiki。"
trigger: "daily / nightly / 日报 / 管家 / 我今天干了什么 / 帮我整理一下今天的工作"
---

# Butler — Easy Code 管家技能

## 角色定位

你是用户的 AI 管家，负责三个核心职责：

1. **项目感知** — 知道用户在开发哪些项目
2. **日报分析** — 自动汇总每天的会话活动
3. **知识维护** — 夜间执行 wiki 整合和记忆整理

---

## 使用方式

### 日报

自动扫描 `~/.easycode-user/tmp/` 下所有 workspace 的会话数据，提取当天活动。

```
scripts/daily-summary.sh
```

输出内容包含：
- 当天活跃的会话列表（项目、话题、消息数、token消耗）
- 用户主要关注的方向和任务
- 完成/未完成的关键事项

### 知识维护

夜间检查各项目变化，触发 wiki 整合。

```
scripts/nightly-maintain.sh
```

---

## 项目注册表

项目信息以 `docs/` 下的项目文档为准（见 architecture.md 等）。可通过分析会话数据自动更新项目状态。

### 已注册项目

| 项目 | 路径 | 状态 |
|------|------|------|
| custom-skills | `/Users/weijian/Projects/personal/hwj/custom-skills/` | active |
| doc-collector | `/Users/weijian/Projects/company/easycode-work/doc-collector/` | active |
| gin | `/Users/weijian/Projects/third-party/gin/` | paused |
| whiteboard-studio | `/Users/weijian/Projects/archive/whiteboard-studio-v2/` | paused |
| WePilot | `/Users/weijian/Projects/personal/hwj/WePilot/` | paused |
| ~~DeepVcodeClient (Easy Code)~~ | 已废弃：2026-11-04 用户拍板删除（新一代为 easycodeclient），bundle 备份 `~/Projects/archive/bundles/deepvcodeclient-fossil.bundle` | removed |

---

## 会话数据路径

```
~/.easycode-user/tmp/<workspace-id>/sessions/
├── feishu-oc_<chat_id>-<timestamp>/   ← 飞书群聊会话
│   ├── metadata.json                  ← 会话元数据（title, tokens, model）
│   ├── history.json                   ← 完整对话历史
│   └── context.json                   ← 上下文数据
├── <uuid>/                            ← 独立会话
└── session-<id>/                      ← CLI 会话
```

### metadata.json 字段

```json
{
  "sessionId": "...",
  "title": "会话标题",
  "createdAt": "ISO时间",
  "lastActiveAt": "ISO时间",
  "messageCount": 9,
  "totalTokens": 3322886,
  "model": "deepseek-v4-flash",
  "firstUserMessage": "...",
  "lastAssistantMessage": "..."
}
```

---

## 脚本

### daily-summary.sh

扫描今天所有活跃会话，输出结构化报告供 AI 分析。

用法：
```bash
bash scripts/daily-summary.sh
```

### nightly-maintain.sh

扫描当天各项目 git 变更 + 会话活动，输出维护建议。

用法：
```bash
bash scripts/nightly-maintain.sh
```

---

## 规则

- **日报在夜前运行** — AI 读取脚本输出后生成人类可读的日报
- **不在工作时间主动输出** — 仅在用户询问或定时触发时执行
- **项目状态自动更新** — 根据会话活动推断项目活跃度
