---
name: domain-created-date
description: >-
  Returns only the domain registration / creation date for a URL or hostname
  using public web lookups (ICANN Lookup, TLD registry RDAP/WHOIS pages)—no
  summary of page content, no Wayback, no certificate history. Use when the user
  asks for domain age, when a domain was created, registered on date, or WHOIS
  creation date from a website URL.
---

# Domain created date (registry lookup only)

## Goal

Given a **URL or hostname**, output **only** the **domain registration / creation date** (the registry field commonly labeled *Created*, *Registered On*, *Registration Time*, or RDAP `events` registration). Include **one authoritative source link** the user can reopen.

Do **not** summarize the website, fetch marketing copy, or report TLS, Archive, or HTTP “last modified” unless the user explicitly asks beyond this skill.

## Steps

1. **Normalize input:** Extract the **registrable domain** (e.g. `https://www.adhikariasis.com.np/path` → `adhikariasis.com.np`). Note punycode if relevant.
2. **Resolve lookup channel (web only):** Use **web search** and/or **URL fetch** to reach an **official** result:
   - Start with **[ICANN Lookup](https://lookup.icann.org/)** and follow linked **RDAP/WHOIS** output for the domain, **or**
   - The **ccTLD/gTLD registry’s** published WHOIS/RDAP web portal (find via search if ICANN does not surface the domain).
3. **Read one field:** From the rendered lookup or RDAP JSON page, copy the **creation / registration** datetime (or date-only if that is all the registry exposes).
4. **If missing or redacted:** Reply with **not retrieved** and name the registry/response limitation (privacy, thin WHOIS, unsupported TLD in tool). **Do not** substitute first Wayback capture or certificate `notBefore` as the domain created date.

## Output template (use exactly this structure; no extra sections)

```markdown
## Domain created (registration)
**Domain:** <registrable domain>
**Created / registered on:** <ISO-like or exact string from source> — *or* **not retrieved**
**Source:** <full URL of the lookup result page you used>
```

Optional **one sentence** after the block only if needed: *e.g.* “Registry returned date-only; time zone not stated.”

## Rules

- **No fabricated dates.** Value must appear on the cited lookup (or state not retrieved).
- **No page content:** Do not describe what the site does, jobs listed, or article text.
- **Privacy:** Do not paste registrant name, email, phone, or street from WHOIS—only the **registration/creation** timestamp/date and domain name, plus the **source URL**.
- **Respect access:** No paywall bypass; if only a captcha-gated portal works, say the user must open the source link locally.

## Additional reference

- Registry field names and RDAP hints: [reference.md](reference.md)
