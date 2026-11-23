#!/usr/bin/env python3
"""拉取 Analytics Engine 聚合数据，生成 stats-snapshot.json 快照。

用途：GitHub Actions 定时任务（deploy.yml 的 stats-snapshot job）每小时跑一次，
快照提交进仓库后随 Pages 部署上线——官网 /stats/ 页面在 dl 分发层不可达时
（大陆直连 Cloudflare 不稳）回退读取同源快照，看板永不白屏。

需要环境变量 CLOUDFLARE_API_TOKEN（Analytics Read 权限）与 AE_ACCOUNT_ID。
"""
import json
import os
import sys
import urllib.request

ACC = os.environ.get("AE_ACCOUNT_ID", "80b783d13428d5d24ff7e6c686bd1efa")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "stats-snapshot.json")

QUERIES = {
    # 每日 × 资产（拿天粒度，安装包/清单口径在内存里拆）
    "dailyDlAsset": "SELECT toStartOfDay(timestamp) AS day, blob4 AS asset, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' GROUP BY day, asset ORDER BY day LIMIT 10000",
    "dailyHeartbeats": "SELECT toStartOfDay(timestamp) AS day, count() AS hits FROM easy_suite_dl WHERE blob1 = 'upd' GROUP BY day ORDER BY day",
    "assets": "SELECT blob4 AS asset, blob6 AS country, blob5 AS channel, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' GROUP BY blob4, blob6, blob5 ORDER BY hits DESC LIMIT 30",
    "versions": "SELECT blob7 AS clientVer, count() AS heartbeats FROM easy_suite_dl WHERE blob1 = 'upd' AND blob7 != '' GROUP BY clientVer ORDER BY heartbeats DESC LIMIT 15",
    "heartbeats7d": "SELECT count() AS heartbeats7d FROM easy_suite_dl WHERE blob1 = 'upd' AND timestamp > NOW() - INTERVAL '7' DAY",
}
# 独立客户端去重（AE 无 uniq）：GROUP BY day, blob8 的返回行数 = 该日去重客户端数
DISTINCT_SQL = (
    "SELECT toStartOfDay(timestamp) AS day, blob8 AS ipHash, count() AS hits "
    "FROM easy_suite_dl WHERE blob1 = '{route}' AND blob8 != '' "
    "GROUP BY day, ipHash LIMIT 10000"
)

META_ASSETS = {"release.json", "checksums.txt"}


def query(sql: str):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACC}/analytics_engine/sql",
        data=sql.encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "text/plain"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = json.loads(response.read().decode(), strict=False)
            return payload.get("data", [])
        except Exception as error:  # 网络抖动重试
            if attempt == 3:
                raise
            print(f"  查询失败（{str(error)[:60]}），重试 {attempt + 1}/3", file=sys.stderr)
            import time
            time.sleep(10)


def query_soft(sql: str):
    """去重查询失败不拖垮快照，降级为 None（前端显示 —）"""
    try:
        return query(sql)
    except Exception as error:
        print(f"  去重查询降级：{str(error)[:80]}", file=sys.stderr)
        return None


def distinct_clients(route: str):
    rows = query_soft(DISTINCT_SQL.format(route=route))
    if rows is None:
        return None
    by_day = {}
    for r in rows:
        by_day[str(r["day"])] = by_day.get(str(r["day"]), 0) + 1
    return {"by_day": dict(sorted(by_day.items())), "total": len(rows)}


def main():
    if not TOKEN:
        print("CLOUDFLARE_API_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    result = {}
    daily_dl_asset = query(QUERIES["dailyDlAsset"])
    daily_upd = query(QUERIES["dailyHeartbeats"])
    # 按天汇总 + 拆口径
    def rollup(rows, installer_only=False):
        by_day = {}
        for r in rows:
            if installer_only and str(r.get("asset", "")) in META_ASSETS:
                continue
            day = str(r["day"])
            by_day[day] = by_day.get(day, 0) + int(r["hits"])
        return [{"day": d, "hits": h} for d, h in sorted(by_day.items())]

    result["dailyDownloads"] = rollup(daily_dl_asset)
    result["dailyInstalls"] = rollup(daily_dl_asset, installer_only=True)
    result["dailyHeartbeats"] = [{"day": str(r["day"]), "hits": int(r["hits"])} for r in daily_upd]
    result["assets"] = [
        {"asset": r["asset"], "country": r["country"], "channel": r["channel"], "hits": int(r["hits"])}
        for r in query(QUERIES["assets"])
    ]
    versions = [
        {"clientVer": r["clientVer"], "heartbeats": int(r["heartbeats"])} for r in query(QUERIES["versions"])
    ]
    heartbeats = sum(x["hits"] for x in result["dailyHeartbeats"])
    unreported = max(0, heartbeats - sum(x["heartbeats"] for x in versions))
    if unreported > 0:
        versions.append({"clientVer": "", "heartbeats": unreported})  # 空串行 = 未上报，前端显示"未上报"
    result["versions"] = versions

    upd_clients = distinct_clients("upd")
    dl_clients = distinct_clients("dl")
    result["dailyClients"] = (
        [{"day": d, "clients": c} for d, c in upd_clients["by_day"].items()] if upd_clients else None
    )
    installs = sum(x["hits"] for x in result["dailyInstalls"])
    downloads = sum(x["hits"] for x in result["dailyDownloads"])
    result["totals"] = {
        "installs": installs,
        "metaHits": downloads - installs,
        "downloads": downloads,
        "heartbeats": heartbeats,
        "heartbeats7d": int((query(QUERIES["heartbeats7d"]) or [{"heartbeats7d": 0}])[0]["heartbeats7d"]),
        "uniqueClients": upd_clients["total"] if upd_clients else None,
        "uniqueDownloaders": dl_clients["total"] if dl_clients else None,
        "countries": len({a["country"] for a in result["assets"] if a["country"]}),
    }
    result["generatedAt"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    with open(OUT, "w") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=1)
    print(f"快照已写入 {OUT}（installs={installs} downloads={downloads} heartbeats={heartbeats} uniqueClients={result['totals']['uniqueClients']}）")


if __name__ == "__main__":
    main()
