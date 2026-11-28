export interface DocGroup {
  id: string;
  title: string;
  badge?: 'agent' | 'gateway';
  slugs: string[];
}

export const DOC_DESC: Record<string, string> = {
  // EasyAgent
  readme: 'EasyAgent 文档总览：项目定位、能力地图与各篇导览',
  config: '配置说明：Provider、密钥、环境变量与运行参数',
  desktop: '桌面端：MyGo 原生 app、命令行安装与自更新',
  mcp: 'MCP 接入：作为 MCP server 与客户端的配置',
  feishu: '飞书接入：机器人通道与卡片交互',
  lark_watch: 'Lark Watch：飞书会话的观察与归档通道',
  mini_deploy: '迷你主机部署：systemd 用户级服务与自动更新',
  skill_market: '技能市场：浏览、安装与卸载官方技能市场技能',
  architecture: '架构总览：核心、bridge、服务端与客户端的分层',
  api: 'API 参考：核心 CLI 与服务的对外接口',
  internals: '内部实现：会话、工具循环与存储细节',
  security_model: '安全模型：威胁模型、凭据边界与部署加固',
  substrate: '沙箱部署探索：作为 Substrate Actor 运行，企业级形态参照与踩坑实录',
  contributing: '参与贡献：分支、worktree 与 PR 约定',
  releasing: '发布流程：版本、资产与多平台分发',
  worktrees: 'Worktree 管理：并行任务线与收尾约定',
  relay_access_design: '扫码远程访问：手机配对、端到端 TLS 与中继设计',
  ios_client_design: 'iOS 客户端设计文档（设计阶段）',
  qa_android: 'Android QA：真机与模拟器的测试路径',
  // EasyGateway
  gateway_overview: 'EasyGateway 总览：三协议兼容、能力调度与一键安装',
  gateway_server: '网关服务端完整手册：路由、Provider、多密钥与记忆助理',
  gateway_desktop: '网关桌面管理端：MyGo 原生管理端构建、连接与发布',
  gateway_architecture: '网关架构：请求路由、熔断恢复与模块分层',
  gateway_memory: '记忆系统设计：跨客户端个人记忆层与治理机制',
};

export const DOC_GROUPS: DocGroup[] = [
  {
    id: 'gateway',
    title: 'EasyGateway 文档',
    badge: 'gateway',
    slugs: [
      'gateway_overview',
      'gateway_server',
      'gateway_desktop',
      'gateway_architecture',
      'gateway_memory',
    ],
  },
  {
    id: 'agent-start',
    title: 'EasyAgent · 开始使用',
    badge: 'agent',
    slugs: ['readme', 'config', 'desktop', 'skill_market'],
  },
  {
    id: 'agent-integrate',
    title: 'EasyAgent · 接入与部署',
    badge: 'agent',
    slugs: ['mcp', 'feishu', 'lark_watch', 'mini_deploy', 'security_model', 'substrate'],
  },
  {
    id: 'agent-arch',
    title: 'EasyAgent · 架构与接口',
    badge: 'agent',
    slugs: ['architecture', 'api', 'internals'],
  },
  {
    id: 'agent-dev',
    title: 'EasyAgent · 参与开发与专项',
    badge: 'agent',
    slugs: [
      'contributing',
      'releasing',
      'worktrees',
      'relay_access_design',
      'ios_client_design',
      'qa_android',
    ],
  },
];

const GATEWAY_SOURCE_MAP: Record<string, string> = {
  gateway_overview: 'https://github.com/nightgopher/easygateway/blob/main/README.md',
  gateway_server: 'https://github.com/nightgopher/easygateway/blob/main/go-gateway/README.md',
  gateway_desktop: 'https://github.com/nightgopher/easygateway/blob/main/desktop/README.md',
  gateway_architecture: 'https://github.com/nightgopher/easygateway/blob/main/docs/ARCHITECTURE.md',
  gateway_memory: 'https://github.com/nightgopher/easygateway/blob/main/docs/MEMORY_DESIGN.md',
};

export function sourceInfoForSlug(slug: string): { label: string; url: string } {
  if (slug in GATEWAY_SOURCE_MAP) {
    return { label: 'easygateway', url: GATEWAY_SOURCE_MAP[slug] };
  }
  return {
    label: 'easyagent/docs',
    url: `https://github.com/nightgopher/easyagent/blob/main/docs/${slug.toUpperCase()}.md`,
  };
}
