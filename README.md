# Easy Suite

EasyAgent 与 EasyGateway 的官方网站，纯静态单页（HTML / CSS / JS，无构建链），部署于 GitHub Pages：

**https://nightgopher.github.io/easy-suite/**

- [EasyAgent](https://github.com/nightgopher/easyagent) — Go 驱动的个人 AI 编程助手与 Agent 工作台（桌面 / Android / Web / TUI / 飞书 / MCP）
- [EasyGateway](https://github.com/nightgopher/easygateway) — 个人 AI 基础设施网关（三协议兼容、能力调度、账号渠道、技能中心、记忆与助理）

## 结构

```
easy-suite/
├── index.html      # 单页全部内容
├── css/style.css   # 视觉基调源自 EasyAgent「青夜」规范
├── js/main.js      # 进场动画 / 移动端菜单 / 复制按钮 / 版本号在线刷新
└── favicon.svg
```

## 维护

- 页面上的版本号有 JS 兜底值；页面加载时会从 GitHub API 拉取最新 release 动态刷新，一般无需手工跟进版本。
- 功能或安装方式变化时，同步修改 `index.html` 中对应产品区块。

## 部署

推送 `main` 即自动发布（GitHub Pages，source = main 分支根目录）。
