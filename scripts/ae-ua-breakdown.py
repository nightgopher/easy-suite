#!/usr/bin/env python3
"""一次性诊断：AE 原始命中按 UA × IP哈希拆解，回答"下载者到底是谁"。

仅供 .github/workflows/ae-debug.yml（workflow_dispatch）调用——
CLOUDFLARE_API_TOKEN 只存在于 Actions 环境，不落盘不外传；输出仅聚合行。
诊断完成后本脚本随 workflow 一并删除。
"""
import json
import os
import urllib.request

ACC = os.environ.get("AE_ACCOUNT_ID", "80b783d13428d5d24ff7e6c686bd1efa")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")


def query(sql: str):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACC}/analytics_engine/sql",
        data=sql.encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "text/plain"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode(), strict=False).get("data", [])


QUERIES = {
    "路由总量（含 install.sh 拉取）": (
        "SELECT blob1 AS route, count() AS hits FROM easy_suite_dl GROUP BY route ORDER BY hits DESC"
    ),
    "下载（dl）按 天 × IP哈希 × 国家 × 渠道 × 资产 × UA": (
        "SELECT toStartOfDay(timestamp) AS day, blob8 AS ip, blob6 AS country, blob5 AS channel, "
        "blob4 AS asset, blob9 AS ua, count() AS hits FROM easy_suite_dl WHERE blob1 = 'dl' "
        "GROUP BY day, ip, country, channel, asset, ua ORDER BY day, ip LIMIT 10000"
    ),
    "心跳（upd）按 天 × IP哈希 × 国家 × 版本 × UA": (
        "SELECT toStartOfDay(timestamp) AS day, blob8 AS ip, blob6 AS country, blob7 AS ver, "
        "blob9 AS ua, count() AS hits FROM easy_suite_dl WHERE blob1 = 'upd' "
        "GROUP BY day, ip, country, ver, ua ORDER BY day, ip LIMIT 10000"
    ),
    "安装脚本（install）按 天 × IP哈希 × UA": (
        "SELECT toStartOfDay(timestamp) AS day, blob8 AS ip, blob6 AS country, blob9 AS ua, count() AS hits "
        "FROM easy_suite_dl WHERE blob1 = 'install' GROUP BY day, ip, country, ua ORDER BY day, ip LIMIT 10000"
    ),
}


def main():
    if not TOKEN:
        print("CLOUDFLARE_API_TOKEN 未设置", file=os.sys.stderr)
        raise SystemExit(1)
    for title, sql in QUERIES.items():
        print(f"\n== {title} ==")
        rows = query(sql)
        if not rows:
            print("  （无数据）")
            continue
        keys = list(rows[0].keys())
        widths = {k: max(len(k), *(len(str(r.get(k, ""))) for r in rows)) for k in keys}
        print("  " + " | ".join(k.ljust(widths[k]) for k in keys))
        for r in rows:
            print("  " + " | ".join(str(r.get(k, "")).ljust(widths[k]) for k in keys))


if __name__ == "__main__":
    main()
