---
name: delta-table-operations
description: >-
  Delta Lake table operations for data engineers: MERGE, incremental append,
  ZORDER, OPTIMIZE tradeoffs, VACuum cautions, and time travel caveats. Use when
  the user designs or debugs Delta tables, small files, or table maintenance jobs.
disable-model-invocation: true
---

# Delta table operations

## Writes

- **Append**: simple inserts; watch duplicate runs without dedupe keys.
- **MERGE**: primary pattern for upserts; ensure match keys are selective and well-distributed.
- **Overwrite**: use with explicit predicates (`replaceWhere`) when appropriate; dangerous on shared tables without guardrails.

## Maintenance

- **OPTIMIZE**: reduces small files; costs IO; run on a schedule aligned with churn.
- **ZORDER**: few columns, high filter benefit; not a substitute for good partition design.
- **VACUUM**: understand retention vs time travel requirements before lowering retention.

## Schema

- Prefer **explicit schemas** in production pipelines; avoid unreviewed schema inference on large or external sources.

## Workflow note

Maintenance steps (`OPTIMIZE`, `VACUUM`) are often **separate job tasks** after ETL, with their own cluster sizing and schedules.
