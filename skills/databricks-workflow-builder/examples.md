# Examples: notebook paths → workflow

## Input (user message)

> Notebooks: `/Shared/pipelines/01_extract`, `/Shared/pipelines/02_clean`, `/Shared/pipelines/03_load`. Linear order. One job cluster.

## Expected output shape

- `task_key`: `extract`, `clean`, `load`
- `depends_on`: none on `extract`; `clean` depends on `extract`; `load` depends on `clean`
- Three `notebook_task` entries with the given paths
- Single `job_cluster_key` on all tasks

## Input (DAG)

> `normalize` and `enrich` can run after `ingest` in parallel; `publish` after both finish.

## DAG

- `ingest` → `normalize` and `enrich` (parallel)
- `normalize` → `publish`
- `enrich` → `publish`

`publish` has `depends_on` with **two** `task_key` entries.
