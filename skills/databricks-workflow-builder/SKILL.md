---
name: databricks-workflow-builder
description: >-
  Builds Databricks Jobs workflows from user-supplied notebook paths: Databricks
  Asset Bundle (DAB) YAML, job task graphs, cluster or job-cluster settings, and
  optional task dependencies. Use when the user lists workspace or repo notebook
  paths, asks for a Databricks job, workflow, DAG, or bundle definition for those
  notebooks, or wants tasks.json / jobs API shape from paths.
---

# Databricks workflow from notebook paths

## Goal

Produce a **runnable-shaped** Databricks workflow where each task points at the correct notebook path, dependencies form a DAG, and compute settings are parameterized (not hardcoded secrets).

## Inputs to collect (ask if missing)

- **Notebook paths**: Databricks workspace paths (e.g. `/Shared/etl/bronze_ingest`) and/or repo-relative paths if using Repos/Git folders—state which naming the output must use.
- **Order / DAG**: Linear order, explicit `depends_on`, or parallel branches.
- **Compute**: `job_cluster_key` reuse, existing cluster ID placeholder, or serverless if applicable to the workspace.
- **Parameters / widgets**: Per-task `base_parameters` or job-level parameters.
- **Schedule / trigger**: None, cron, or file arrival (describe at high level in comments only).
- **Libraries**: Maven/PyPI/Wheel requirements per task if known.

## Output options (pick what the user asked for; default to DAB)

1. **Databricks Asset Bundle** fragment: `resources.jobs.<job_name>.tasks[]` compatible with `databricks.yml` / included YAML. See [templates/databricks-job-tasks.example.yml](templates/databricks-job-tasks.example.yml).
2. **Flat task list** with suggested `task_key`, `depends_on`, and `notebook_task.notebook_path` for each path.
3. **Jobs API JSON** skeleton: `name`, `tasks`, optional `job_clusters`—see [templates/job-api-skeleton.json](templates/job-api-skeleton.json).

## Rules

- Use **stable `task_key` values** (snake_case, unique): derive from notebook filename or path segment.
- **First task** with no upstream dependencies unless user specifies otherwise.
- **`depends_on`** references other tasks by `task_key`.
- Notebook task shape:

```yaml
- task_key: example_task
  notebook_task:
    notebook_path: /Workspace/Shared/path/to/notebook
    source: WORKSPACE   # or WORKSPACE for workspace paths; use GIT if using Repos
  # optional:
  # job_cluster_key: shared_cluster
  # libraries: []
  # max_retries: 1
  # timeout_seconds: 3600
```

- **Do not** embed tokens, passwords, storage keys, or PHI/PII. Use `${var.*}` / bundle variables or `{{secrets/scope/key}}`-style placeholders only if the user’s standard allows; otherwise comment “inject via CI / UI”.
- If paths are ambiguous (repo vs workspace), output **both** variants in a short table and pick one primary artifact.

## Workflow checklist

1. Normalize paths and confirm workspace vs repo layout.
2. Assign `task_key` and edges (`depends_on`).
3. Choose compute model (job cluster vs existing cluster placeholder).
4. Emit primary artifact + short “how to deploy” (bundle deploy vs Jobs UI vs API).
5. Note **permissions** (service principal, job owner, cluster policy) without inventing IDs.

## Optional utility

Linear chain from paths (stdout = YAML task fragments):

```bash
python scripts/linear_notebook_tasks.py /Workspace/a /Workspace/b
```

(Run from this skill’s directory `.cursor/skills/databricks-workflow-builder/`, or pass the full path to the script.)

## Additional reference

- Field notes and DAB layout tips: [reference.md](reference.md)
- Walkthrough patterns: [examples.md](examples.md)
