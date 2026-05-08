#!/usr/bin/env python3
"""
Emit DAB-style task list for notebooks in linear order (each depends on previous).
Usage:
  python linear_notebook_tasks.py /path/a /path/b
  python linear_notebook_tasks.py < paths.txt

No third-party dependencies. Paths are printed as given; validate in Databricks.
"""

from __future__ import annotations

import sys


def _slug_from_path(path: str) -> str:
    base = path.rstrip("/").split("/")[-1]
    out = []
    for ch in base.lower().replace(" ", "_"):
        out.append(ch if ch.isalnum() or ch == "_" else "_")
    key = "".join(out).strip("_") or "task"
    return key[:60]


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        paths = [p for p in argv[1:] if p.strip()]
    else:
        paths = [line.strip() for line in sys.stdin if line.strip()]

    if not paths:
        print("Provide notebook paths as args or one path per line on stdin.", file=sys.stderr)
        return 2

    keys: list[str] = []
    for p in paths:
        k = _slug_from_path(p)
        if k in keys:
            k = f"{k}_{keys.count(k)}"
        keys.append(k)

    for i, (task_key, nb_path) in enumerate(zip(keys, paths)):
        print(f"- task_key: {task_key}")
        if i > 0:
            print("  depends_on:")
            print(f"    - task_key: {keys[i - 1]}")
        print("  job_cluster_key: REPLACE_ME_CLUSTER_KEY")
        print("  notebook_task:")
        print(f"    notebook_path: {nb_path}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
