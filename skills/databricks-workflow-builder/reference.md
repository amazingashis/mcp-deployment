# Databricks workflow builder — reference

## Task keys and dependencies

- `task_key`: unique string per task; referenced by `depends_on: [{ task_key: "upstream" }]`.
- Cycles are invalid; validate mentally before emitting.

## `notebook_task`

- `notebook_path`: required for workspace notebooks.
- `source`: `WORKSPACE` for workspace paths; use platform docs for Git/Repo sources if notebooks live in a linked repo.

## Job clusters (typical DAB pattern)

Define `job_clusters` at job level with a `job_cluster_key`, then reference `job_cluster_key` on each task. Keeps cluster config DRY.

## Bundles (DAB)

- Top-level `bundle.name`, `include` of YAML fragments, `targets` for dev/staging/prod.
- Jobs live under `resources.jobs.<name>`.

## Jobs API vs bundle

- **Bundle**: versioned YAML, `databricks bundle deploy`, good for CI/CD.
- **Jobs API** `POST /api/2.1/jobs/create`: JSON body; fine for one-off exports or scripts.

## Compliance reminders (non-exhaustive)

- No secrets in YAML/JSON committed to git; use secret scopes or bundle variable injection in CI.
- Logs and parameters must not include PHI/PII or raw identifiers if policy forbids it.
