---
name: chatgpt-web-research
description: Use the ChatGPT website through ego-lite (ego-browser) as an independent research or solution-analysis assistant when the user asks to consult GPT网页版, ChatGPT网页版, 网页版 GPT, or explicitly asks ego-lite to ask ChatGPT for research, architecture, brainstorming, or a second opinion. Also use when this workflow was explicitly established earlier in the same task. Do not invoke merely because a task mentions GPT, web research, the OpenAI API, or ChatGPT product documentation; use direct research or the relevant skill instead.
---

# ChatGPT 网页辅助调研

把网页版 ChatGPT 当作一个可提供独立思路的顾问，自己仍负责本地事实核查、来源核验和最终结论。网页回答不等于真实执行、测试或可靠的一手资料。

## 启动

1. 告知用户正在使用此技能，并读取当前可用的 `ego-browser` 技能。执行 `ego-browser skill`，完整读取该版本的使用指南，按其 TaskSpace、接管和 `finish` 规则操作。不要猜 Playwright API，也不要读取或切换浏览器 profile；用户明确要求 ego-lite 时不绕到另一个浏览器或 API。
2. 能从现有上下文解决的问题不重复询问。对于代码或用户项目的咨询，先按项目规则读取最少的相关源码、配置或结果，明确哪些已验证、哪些是待查；如果目的是独立评审，可先给网页精简背景，之后再对照源码。不得将密钥、登录态、原始敏感日志、未获授权的私人或公司内容发给网页；对用户明确授权的必要信息尽量最小化、脱敏，不上传整个仓库或对话历史。
3. 在同一目标的 TaskSpace 创建或恢复一个页面，打开 `https://chatgpt.com/`。按指南处理用户拥有的页面；把空间 ID 记在工作上下文中。若未登录或遇到 CAPTCHA、2FA 或浏览器权限弹窗，调用指南中的 `handOff()` 并请用户处理；不要尝试绕过。ego-lite 不可用时按其技能安装排障说明诊断，不静默替换浏览器。

## 提问与收集

1. 用用户的目标写可执行的问题，包含必要背景、约束、已知事实与不确定之处。要求给替代方案和理由、风险与验证方式，并区分事实、假设和建议。需要可追溯资料时要求给原始链接、版本和日期。不要把有争议的假设写成结论；如果希望它独立评审，明确要求指出自身方案的反例。
2. 页面可能先显示加载骨架，再将普通输入框替换成富文本编辑器。打开后先观察最新快照，等待实际输入控件稳定；用**当前**快照中的元素或语义定位器填写。旧 ref、旧标签名（如 `textarea`）或跨次调用的 DOM 状态不可假设仍然有效；选择器找不到时重新观察，不要盲目连点。填入后检查发送按钮或输入框内容，再发送一次。
3. 发送后核实用户消息出现，避免超时后重复提交。以页面的生成中/停止按钮、回答完成提示或可继续发送的状态判断完成；不要把第一次出现的文本或中间状态当作完整回复。网页可能思考数分钟，使用分段、有界等待，每次不超过 60 秒，期间按需给用户更新。若等待超时，先查看同一页面当前状态；若仍在生成且有进展可继续等，若卡住则说明现象，保留已得到的部分，不能假称回答完成或重复提交。用户中止时遵循用户指令。
4. 读取实际回答而不是只截取视口；可使用 full-page 或当前会话的 subtree 快照。页面可能虚拟化、截断文本，`innerText` 有时只给出用户消息：优先快照，必要时分段读取或用页面可见的复制功能；不要从其他聊天、隐藏接口或浏览器存储绕过 UI。实时识别页面是否仍在生成。若回复足以支撑任务但无法确认完整，明确说明。
5. 需要进一步澄清时在同一网页会话追问，说明上次的关键矛盾、待证据点和输出长度；避免无谓要求超长报告。如需使用网页生成的资料或源链接，核实链接实际支持的结论，优先官方文档、一手代码和实测；不要把 ChatGPT 回答当成来源或声称自己做过它的测试。

## 合成与收尾

- 将网页建议与本地现状、约束和实时数据逐条对照；指出不适用、过度设计、冲突以及尚未验证之处。先给自己的结论和行动建议，再注明来自网页的观点，提供有用的原始来源链接和本地代码位置。
- 仅在用户可访问且该链接确实是已完成会话时，附上 ChatGPT 聊天链接；不要把未授权的分享链接、页面内部临时 ID 或登录信息当作公开证据。
- 按 ego-browser 当前指南，在单独的最后一次脚本中调用 `finish()`。只在用户明确需要在浏览器继续查看、或结果页面确实需要保留时保留它；登录接管、用户接管或错误阻塞时按指南处理，不用伪造完成。最终报告说明是否实际询问成功、结论的验证程度、操作失败或仍待核实的内容。
