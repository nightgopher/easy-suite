# easy-suite-dl · Easy Suite 分发层

EasyAgent / EasyGateway 的统一分发入口：302 分流 + 更新清单代理 + 匿名统计。
这是「契约稳定、载体可换」策略的落点——客户端与官网只认 `dl.hwj123hwj.asia`，
后端从 Cloudflare 迁 EdgeOne 或自建时，本 Worker 代码结构可整体平移，客户端零改动。

## URL 契约（对外永久稳定）

| 路由 | 行为 |
|---|---|
| `GET /dl/<repo>/install.sh` | 安装脚本代理（边缘缓存 5 分钟） |
| `GET /dl/<repo>/latest/<asset>?ch=<渠道>` | 最新版资产 302；latest 解析缓存 1 小时 |
| `GET /dl/<repo>/<tag>/<asset>` | 指定版本资产 302；资产名支持 `{v}` 占位符（替换为去掉 v 前缀的版本号） |
| `GET /upd/<repo>/<manifest>.json?v=<客户端版本>` | 更新清单代理（回源 GitHub latest，边缘缓存 10 分钟）+ 心跳统计 |
| `GET /healthz` | 健康检查 |
| `GET /stats` | **分发看板**：下载/心跳总量、每日趋势、资产明细、客户端版本分布（服务端渲染，零外部依赖） |
| `GET /stats.json` | 看板数据 JSON 版（程序化消费） |
| `GET /` | 302 到官网 |

**看板依赖**：secret `AE_QUERY_TOKEN`（AE SQL API 读 token）+ var `AE_ACCOUNT_ID`。SQL API 方言注意：
时间列叫 `timestamp`（非 `_timestamp`/`interval_start`）、`count()` 无参、无 `uniq`（活跃客户端以
心跳次数近似）、时间函数用 `toStartOfDay`/`NOW() - INTERVAL 'N' DAY`。统计任何一步失败不影响主流程。

`<repo>` 当前支持：`easyagent`、`easygateway`（`worker/src/index.ts` 的 `TARGETS`）。

**分流规则**：中国大陆 IP ∩ 资产在 Gitee 镜像清单内 ∩ latest → Gitee（`weijian-huang/easyagent`，
与 `scripts/gitee_mirror.py` 的 `ASSETS` 清单对齐）；其余 → GitHub。非 latest 一律走 GitHub
（Gitee 镜像会裁剪旧版本，避免 404）。

**降级链**：分发层挂了不影响安装与更新——`install.sh` 回退 GitHub、再回退 Gitee（现有三源结构）；
更新器回退 GitHub latest（PR-3 引入）。dl 是增强层，不是单点。

## 统计口径

每次命中写一条 Cloudflare Analytics Engine 数据点（dataset `easy_suite_dl`）：

```
indexes: 路由类型（dl / upd / install）
blobs:   [路由, repo, 版本/清单版本, 资产, 渠道(ch=), 国家码, 客户端版本(?v=), IP当日哈希, UA(截断128)]
```

- 不落原始 IP：仅存 `sha256(ip + 当日UTC日期)` 前 12 位，用于当日去重
- 心跳语义：客户端每次拉更新清单 = 一次活跃证明；`?v=` 上报客户端自身版本（PR-3 起携带），
  汇聚出**活跃安装数 / 版本分布 / 升级速度**
- 查询示例（Analytics Engine SQL API）：

```sql
-- 近 7 天按天活跃客户端（心跳去重）
SELECT interval_start, COUNT(DISTINCT blob8) AS active_clients
FROM easy_suite_dl WHERE blob1 = 'upd' AND timestamp > NOW() - 7d
GROUP BY interval_start;

-- 各渠道下载量
SELECT blob5 AS channel, COUNT(*) FROM easy_suite_dl
WHERE blob1 = 'dl' AND timestamp > NOW() - 30d GROUP BY blob5;
```

## 本地开发与部署

```bash
cd worker
npm install
npm run dev          # http://localhost:8787，本地 dev 无真实 cf.country，分流全走 GitHub
npm run typecheck
npm run deploy       # 需先 npx wrangler login（或 CLOUDFLARE_API_TOKEN）
```

### 首次上线步骤（一次性）

1. **Cloudflare 加站点**：dashboard → Add site → `hwj123hwj.asia`（Free 档）。
   迁移前先在 CF 的 DNS 面板复制现有记录——当前唯一在用的是
   `www` CNAME → `www.hwj123hwj.asia.pages.dnsoe4.com`（EdgeOne Pages，保持 **DNS only** 灰云，
   避免 CF 代理影响国内可达性）。
2. **NS 切换**：回域名注册商把 NS 改为 Cloudflare 分配的两条 NS（当前 DNS 托管在 DNSPod）。
   生效后 `dl.hwj123hwj.asia` 即可在 CF 托管。
3. **绑定自定义域**：取消 `wrangler.jsonc` 中 `routes` 的注释（`dl.hwj123hwj.asia` custom_domain），
   `npm run deploy`。验证：`curl -I https://dl.hwj123hwj.asia/healthz`。
4. **关预览域**（可选）：稳定后把 `workers_dev` 改为 `false`。
5. 备案完成后迁 EdgeOne：平移本 Worker 逻辑到 EdgeOne 边缘函数 + 重建 AE 聚合导出即可，契约不变。

## 与后续 PR 的关系

- **PR-2**（easyagent）：`scripts/install.sh` 源列表首位加 `https://dl.hwj123hwj.asia/dl/easyagent`
  （保留 GitHub / Gitee 回退），安装资产与校验全走 dl，统计即安装漏斗。
- **PR-3**（easyagent）：`desktop-native/update_proxy.go` 的 `updateFeedBase` 指向
  `https://dl.hwj123hwj.asia/upd/easyagent`（失败回退 GitHub latest），心跳从此进统计。
- **PR-4**（easy-suite）：docs 站 + 博客同步 CHANGELOG，与本 Worker 无耦合。
