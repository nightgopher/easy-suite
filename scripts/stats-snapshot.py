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
    "dailyDownloads": "SELECT toStartOfDay(timestamp) AS day, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' GROUP BY day ORDER BY day",
    "dailyHeartbeats": "SELECT toStartOfDay(timestamp) AS day, count() AS hits FROM easy_suite_dl WHERE blob1 = 'upd' GROUP BY day ORDER BY day",
    "assets": "SELECT blob4 AS asset, blob6 AS country, blob5 AS channel, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' GROUP BY blob4, blob6, blob5 ORDER BY hits DESC LIMIT 30",
    "versions": "SELECT blob7 AS clientVer, count() AS heartbeats FROM easy_suite_dl WHERE blob1 = 'upd' AND blob7 != '' GROUP BY blob7 ORDER BY heartbeats DESC LIMIT 15",
    "heartbeats7d": "SELECT count() AS heartbeats7d FROM easy_suite_dl WHERE blob1 = 'upd' AND timestamp > NOW() - INTERVAL '7' DAY",
}


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


def main():
    if not TOKEN:
        print("CLOUDFLARE_API_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    result = {}
    daily_dl = query(QUERIES["dailyDownloads"])
    daily_upd = query(QUERIES["dailyHeartbeats"])
    result["dailyDownloads"] = [{"day": str(r["day"]), "hits": int(r["hits"])} for r in daily_dl]
    result["dailyHeartbeats"] = [{"day": str(r["day"]), "hits": int(r["hits"])} for r in daily_upd]
    result["assets"] = [
        {"asset": r["asset"], "country": r["country"], "channel": r["channel"], "hits": int(r["hits"])}
        for r in query(QUERIES["assets"])
    ]
    result["versions"] = [
        {"clientVer": r["clientVer"], "heartbeats": int(r["heartbeats"])} for r in query(QUERIES["versions"])
    ]
    result["totals"] = {
        "downloads": sum(x["hits"] for x in result["dailyDownloads"]),
        "heartbeats": sum(x["hits"] for x in result["dailyHeartbeats"]),
        "heartbeats7d": int((query(QUERIES["heartbeats7d"]) or [{"heartbeats7d": 0}])[0]["heartbeats7d"]),
        "countries": len({a["country"] for a in result["assets"] if a["country"]}),
    }
    result["generatedAt"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(OUT, "w") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=1)
    print(f"快照已写入 {OUT}（downloads={result['totals']['downloads']} heartbeats={result['totals']['heartbeats']}）")


if __name__ == "__main__":
    main()
