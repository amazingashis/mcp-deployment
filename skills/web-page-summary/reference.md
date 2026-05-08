# Domain created date — reference

## What “domain created” means here

Only the **registry record** of when the domain name was **registered / created** (WHOIS/RDAP **registration** event). It is **not**:

- Website “go live” or first blog post  
- TLS certificate `notBefore`  
- Internet Archive first snapshot  
- HTTP `Last-Modified` or Next.js build headers  

If the registry does not show creation, answer **not retrieved**—do not proxy with those signals.

## Web lookups (preferred)

1. **[ICANN Lookup](https://lookup.icann.org/)** — search the domain; open linked **RDAP** / WHOIS-style result; use the **registration / creation** field from that page. Cite the **final results URL** in the output.
2. **TLD-specific registry** — for some ccTLDs, ICANN may redirect or omit data; use **web search** (`<domain> WHOIS`, `<sld.tld> RDAP`) to find the **official** registry WHOIS/RDAP page.

## Common field labels

- WHOIS text: `Creation Date`, `Registered on`, `Registration Time`, `Created`  
- RDAP JSON (if you fetch API): `events` with `eventAction` `registration` and `eventDate`

## Privacy / redaction

Many registrars redact contacts but still show **dates**. If **creation** is hidden, report **not retrieved** and cite the page that shows redaction.
