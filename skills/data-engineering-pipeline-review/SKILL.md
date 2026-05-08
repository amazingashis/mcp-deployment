---
name: data-engineering-pipeline-review
description: >-
  Reviews Spark, Delta, and batch pipeline code for data engineering quality:
  partitioning, incremental patterns, shuffle risk, idempotency, and operational
  safety. Use when reviewing ETL notebooks, PySpark jobs, Delta MERGE/INSERT, or
  when the user asks for a data pipeline code review.
disable-model-invocation: true
---

# Data engineering pipeline review

## Scope

Spark/Delta pipelines, file ingestion, MERGE/upsert, SCD-style patterns, small-vs-large table joins, and write semantics.

## Checklist

- **Filter early**, **project early**: unnecessary columns increase shuffle and IO.
- **Joins**: risk of skew; broadcast only when the small side is truly small and stable; avoid accidental Cartesian products.
- **Actions**: `count()`, `collect()`, full scans—justify or flag for large data.
- **Delta**: prefer explicit schema; MERGE for upserts; avoid blind `overwrite` on shared tables; document `replaceWhere` if used.
- **Writes**: idempotent job reruns; partition columns stable and not ultra-high cardinality unless justified.
- **Determinism**: avoid relying on non-deterministic ordering unless required.
- **Caching**: only when reused; unpersist when done.

## Compliance (brief)

- No PHI/PII or credentials in logs or printed output.
- Secrets from approved secret mechanisms only (e.g. Databricks secret scopes / dbutils)—never hardcoded.

## Feedback format

- **Blocker**: correctness, data loss, security, or compliance violation
- **Risk**: performance or operational issues at scale
- **Suggestion**: clarity, maintainability, minor optimizations
