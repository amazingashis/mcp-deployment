---
name: nepse-share-price-history
description: >-
  Answers NEPSE (Nepal Stock Exchange) share price / OHLC / history questions
  using web search, then returns a clear summary or table. Use when the user
  asks for NEPSE share price history, OHLC, past closes, or chart-related data
  for specific stocks or tickers.
---

# NEPSE share price history

## Goal

When the user names **one or more NEPSE-listed stocks** (symbols like `NIFRA`, `HIDCL`, `NABIL`, company names, or “scrip”), **use web search** to find recent public information, then give **direct, readable output**: a short summary plus a **markdown table** when the results include enough structured numbers (date, close/LTP, and OHLC/volume if available).

This is **market data retrieval**, not investment advice. End with a one-line disclaimer: data may be delayed or incomplete; verify on the exchange or broker platform before acting.

## Method (required)

1. **Web search** — Run one or more targeted searches (e.g. `NEPSE <SYMBOL> share price history`, `NEPSE <SYMBOL> OHLC`, `Nepal stock exchange <company> LTP`). Prefer results that cite NEPSE, brokers, or reputable financial portals. **Do not** rely on direct calls to NEPSE JSON APIs unless the user explicitly asks for programmatic/API integration.
2. **Normalize symbols** — Uppercase tickers; if the user gives a company name, search to confirm the NEPSE symbol before answering.
3. **Synthesize** — From search snippets and linked pages (fetch when useful), extract **factual** figures only. **Never invent** prices, dates, or volumes. If search results conflict or lack numbers, say so and report what was found.
4. **Scope** — If the user gives a **date range**, filter or search with that range. If not, prefer **recent** data (e.g. last session, last week, or “recent history” depending on what sources show). Avoid huge tables unless requested; cap at ~30 rows and note if truncated.
5. **Output** — Lead with the **answer** (table and/or bullets: `Date | Open | High | Low | Close/LTP | Volume` — omit columns sources lack). One line citing **sources** (site names or URLs from search). No filler.

## Rules

- **No financial advice** — no buy/sell recommendations; only report what sources state.
- **No secrets** — no broker logins, no scraping behind auth, no API keys in replies.
- **Honesty** — If web search does not return usable data, say **could not retrieve** and suggest checking [NEPSE](https://www.nepalstock.com/) or the broker’s official quote page.

## When not to use

- Non-NEPSE exchanges (use a different approach).
- Real-time order execution, margin, or portfolio advice (out of scope).

## Optional: programmatic API

For direct HTTP against NEPSE’s site/API (fragile endpoints, payload IDs), see [reference.md](reference.md). **Default for this skill is web search only.**
