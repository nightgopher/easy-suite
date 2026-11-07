---
title: Easy Suite 官网与博客上线
description: EasyAgent × EasyGateway 的官方网站正式上线，博客板块同步开张：一个地址看产品介绍、版本动态与构建思路。
pubDate: 2026-11-06
tags: [产品动态]
---

Easy Suite 官网今天正式上线：**https://nightgopher.github.io/easy-suite/**，EasyAgent 与 EasyGateway 两个项目从此有了一个统一的对外门面，博客板块也随之开张。

## 两个项目，一条链路

- **[EasyAgent](https://github.com/nightgopher/easyagent)** — Go 驱动的个人 AI 编程助手与 Agent 工作台，覆盖桌面、Android、Web、终端与飞书五种形态，底层能力沉淀为可复用的 Go SDK。
- **[EasyGateway](https://github.com/nightgopher/easygateway)** — 个人 AI 基础设施网关，一个端点兼容 OpenAI Chat / Responses 与 Anthropic Messages 三套协议，按模型能力调度多 Provider，带账号渠道、技能中心与签名自更新。

两者一起用体验最好：Agent 的所有模型请求走统一网关入口，技能装一次两边通用，常驻助理直接构建在 EasyAgent SDK 之上。

## 这个博客会写什么

- **产品动态**：重要版本、新功能与 breaking change 的说明；
- **构建思路**：网关的能力调度、Agent 的会话持久化等设计取舍；
- **使用技巧**：客户端接入、技能开发与日常组合玩法。

版本号在官网首页会自动从 GitHub Releases 拉取刷新，不需要手动跟进。想第一时间收到更新，可以订阅 [RSS](/easy-suite/rss.xml)。

## 一键体验

```bash
curl -fsSL https://raw.githubusercontent.com/nightgopher/easygateway/main/scripts/install.sh | bash
```

两个项目均为 MIT 许可，欢迎 Star、Issue 与 PR。
