---
name: databricks-secrets-and-logging
description: >-
  Guides safe configuration for Databricks jobs and notebooks: secret scopes,
  parameters vs secrets, structured logging without sensitive data, and failure
  modes when secrets are missing. Use when wiring credentials, fixing logging,
  or hardening a Databricks workflow for production.
disable-model-invocation: true
---

# Databricks secrets and logging

## Secrets

- Read credentials via **Databricks secrets** (e.g. `dbutils.secrets.get(scope, key)`) or organization-approved injection—never commit secrets to repos, YAML, or notebooks.
- Fail fast with a **clear, non-leaking** error when a required secret or scope is missing (message: which scope/key name is missing, not the value).

## Parameters

- Use job/task **parameters** for non-secret run controls (dates, environment flags).
- Do not pass secrets as default widget values or job parameters visible in UI history if policy forbids it.

## Logging

- Structured, concise logs; **no** raw row data, tokens, connection strings, or identifiers that qualify as PII/PHI under policy.
- Prefer stable event messages with correlation IDs where the platform provides them.

## Generated artifacts

When generating `databricks.yml` or Jobs JSON, use **placeholders** and comments for secret-backed values; point to the scope/key name in documentation text, not inline secret material.
