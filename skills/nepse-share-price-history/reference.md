# NEPSE API notes (optional)

The main skill uses **web search** by default. Use this file only if you need **direct** integration with NEPSE’s JSON API (URLs and payloads change often).

## Base (verify live)

- Official site: [nepalstock.com](https://www.nepalstock.com/) — API host/path may differ from historical `newweb.nepalstock.com` references.
- Historical prefix used in community clients: `https://newweb.nepalstock.com/api/nots/` (may be deprecated or moved).

## List securities (symbol → `securityId`)

- **GET** `{base}/api/nots/securityDailyTradeStat/58`  
  Array of objects with **`symbol`** and **`securityId`** (camelCase).

## Daily graph / history

- **POST** `{base}/api/nots/market/graphdata/{security_id}`  
- Body often includes **`{"id": <payload_id>}`** where `payload_id` is obtained the same way the live frontend does (third-party helpers have broken in the past).

## Row field names (typical)

| Concept | Typical fields |
|---------|------------------|
| Date | `businessDate` |
| OHLC | `openPrice`, `highPrice`, `lowPrice`, `closePrice` |
| Volume | `totalTradedQuantity` |

## Community references

- [nepse-api (PyPI)](https://pypi.org/project/nepse-api/), [GitHub CaffeineDuck/nepse-api](https://github.com/CaffeineDuck/nepse-api) — illustrative; may be outdated.

Do not hardcode `payload_id` or credentials in the repo.
