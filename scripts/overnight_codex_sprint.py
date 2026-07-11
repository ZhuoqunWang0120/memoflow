#!/usr/bin/env python3
"""Run a small overnight Codex inspection/docs sprint."""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Sequence


DEFAULT_TIMEOUT_SECONDS = 25 * 60
PM_TIMEOUT_SECONDS = 20 * 60


@dataclass(frozen=True)
class WorkerSpec:
    worker_id: str
    prompt_path: str
    report_filename: str
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS


WORKERS: Sequence[WorkerSpec] = (
    WorkerSpec("repo_inspector", "prompts/overnight/01_repo_inspector.md", "01_repo_inspector.md"),
    WorkerSpec("alpha_safety_inspector", "prompts/overnight/02_alpha_safety_inspector.md", "02_alpha_safety_inspector.md"),
    WorkerSpec("capacitor_scout", "prompts/overnight/03_capacitor_scout.md", "03_capacitor_scout.md"),
    WorkerSpec("backlog_docs_worker", "prompts/overnight/04_backlog_docs_worker.md", "04_backlog_docs_worker.md"),
)

PM_SUMMARIZER = WorkerSpec(
    "pm_summarizer",
    "prompts/overnight/99_pm_summarizer.md",
    "99_pm_summarizer.md",
    timeout_seconds=PM_TIMEOUT_SECONDS,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run parallel Codex overnight worker tasks.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned commands without running them.")
    parser.add_argument("--sequential", action="store_true", help="Run workers sequentially.")
    parser.add_argument(
        "--approval-mode",
        choices=("default", "never"),
        default="default",
        help="Codex approval mode for worker commands. 'never' requires a Codex CLI that supports --ask-for-approval.",
    )
    parser.add_argument(
        "--workers",
        help="Comma-separated subset of worker ids to run. Defaults to all primary workers.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="Default timeout in seconds for primary workers.",
    )
    return parser.parse_args()


def resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def ensure_dirs(paths: Sequence[Path]) -> None:
    for path in paths:
        path.mkdir(parents=True, exist_ok=True)


def selected_workers(worker_arg: str | None, timeout_seconds: int) -> List[WorkerSpec]:
    base = {worker.worker_id: worker for worker in WORKERS}
    if not worker_arg:
        chosen = list(WORKERS)
    else:
        ids = [part.strip() for part in worker_arg.split(",") if part.strip()]
        unknown = [worker_id for worker_id in ids if worker_id not in base]
        if unknown:
            raise SystemExit(f"Unknown worker ids: {', '.join(unknown)}")
        chosen = [base[worker_id] for worker_id in ids]

    return [
        WorkerSpec(
            worker_id=worker.worker_id,
            prompt_path=worker.prompt_path,
            report_filename=worker.report_filename,
            timeout_seconds=timeout_seconds if worker.worker_id != PM_SUMMARIZER.worker_id else worker.timeout_seconds,
        )
        for worker in chosen
    ]


def render_prompt(template: str, replacements: Dict[str, str]) -> str:
    rendered = template
    for key, value in replacements.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", value)
    return rendered


def detect_approval_flag() -> str | None:
    codex_path = shutil.which("codex")
    if not codex_path:
        raise SystemExit("codex CLI not found on PATH")

    help_result = subprocess.run(
        [codex_path, "exec", "--help"],
        check=False,
        capture_output=True,
        text=True,
    )
    help_text = "\n".join(part for part in (help_result.stdout, help_result.stderr) if part)
    if "--ask-for-approval" in help_text:
        return "--ask-for-approval"
    return None


def validate_approval_mode(approval_mode: str) -> str | None:
    if approval_mode != "never":
        return None

    approval_flag = detect_approval_flag()
    if approval_flag:
        return approval_flag

    raise SystemExit(
        "Requested --approval-mode never, but this local Codex CLI does not advertise "
        "`--ask-for-approval` in `codex exec --help`. The orchestrator will not guess a different flag."
    )


def codex_command(repo_root: Path, output_last_message_path: Path, approval_flag: str | None) -> List[str]:
    command = [
        "codex",
        "exec",
        "--cd",
        str(repo_root),
        "--sandbox",
        "workspace-write",
    ]
    if approval_flag:
        command.extend([approval_flag, "never"])
    command.extend(
        [
            "--output-last-message",
            str(output_last_message_path),
            "-",
        ]
    )
    return command


async def run_worker(
    worker: WorkerSpec,
    repo_root: Path,
    run_stamp: str,
    docs_dir: Path,
    logs_dir: Path,
    dry_run: bool,
    approval_flag: str | None,
) -> Dict[str, object]:
    prompt_template = (repo_root / worker.prompt_path).read_text(encoding="utf-8")
    report_path = docs_dir / f"{run_stamp}-{worker.report_filename}"
    last_message_path = logs_dir / f"{run_stamp}-{worker.worker_id}.last.txt"
    log_path = logs_dir / f"{run_stamp}-{worker.worker_id}.log"
    meta_path = logs_dir / f"{run_stamp}-{worker.worker_id}.json"

    replacements = {
        "REPORT_PATH": str(report_path),
        "RUN_STAMP": run_stamp,
        "REPO_ROOT": str(repo_root),
        "LOG_PATH": str(log_path),
    }
    prompt_text = render_prompt(prompt_template, replacements)
    command = codex_command(repo_root, last_message_path, approval_flag)

    if dry_run:
        summary = {
            "worker_id": worker.worker_id,
            "status": "dry-run",
            "command": command,
            "report_path": str(report_path),
            "log_path": str(log_path),
            "last_message_path": str(last_message_path),
            "timeout_seconds": worker.timeout_seconds,
        }
        meta_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return summary

    log_file = log_path.open("w", encoding="utf-8")
    log_file.write(f"$ {' '.join(command)}\n\n")
    log_file.flush()

    process = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=str(repo_root),
    )

    async def pump_output() -> str:
        chunks: List[str] = []
        assert process.stdout is not None
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace")
            chunks.append(text)
            log_file.write(text)
            log_file.flush()
        return "".join(chunks)

    output_task = asyncio.create_task(pump_output())
    assert process.stdin is not None
    process.stdin.write(prompt_text.encode("utf-8"))
    await process.stdin.drain()
    process.stdin.close()

    status = "success"
    timed_out = False
    try:
        returncode = await asyncio.wait_for(process.wait(), timeout=worker.timeout_seconds)
    except asyncio.TimeoutError:
        timed_out = True
        status = "timeout"
        process.kill()
        returncode = await process.wait()

    combined_output = await output_task
    log_file.close()

    if status != "timeout" and returncode != 0:
        status = "failed"

    result = {
        "worker_id": worker.worker_id,
        "status": status,
        "returncode": returncode,
        "timed_out": timed_out,
        "command": command,
        "report_path": str(report_path),
        "log_path": str(log_path),
        "last_message_path": str(last_message_path),
        "timeout_seconds": worker.timeout_seconds,
        "output_tail": combined_output[-2000:],
    }
    meta_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


async def run_primary_workers(
    workers: Sequence[WorkerSpec],
    repo_root: Path,
    run_stamp: str,
    docs_dir: Path,
    logs_dir: Path,
    dry_run: bool,
    sequential: bool,
    approval_flag: str | None,
) -> List[Dict[str, object]]:
    if sequential:
        results = []
        for worker in workers:
            results.append(await run_worker(worker, repo_root, run_stamp, docs_dir, logs_dir, dry_run, approval_flag))
        return results

    tasks = [
        asyncio.create_task(run_worker(worker, repo_root, run_stamp, docs_dir, logs_dir, dry_run, approval_flag))
        for worker in workers
    ]
    return await asyncio.gather(*tasks)


async def run_pm_summarizer(
    repo_root: Path,
    run_stamp: str,
    docs_dir: Path,
    logs_dir: Path,
    dry_run: bool,
    worker_results: Sequence[Dict[str, object]],
    approval_flag: str | None,
) -> Dict[str, object]:
    worker_reports = "\n".join(f"- {result['worker_id']}: {result['report_path']}" for result in worker_results)
    worker_statuses = "\n".join(f"- {result['worker_id']}: {result['status']}" for result in worker_results)
    prompt_template = (repo_root / PM_SUMMARIZER.prompt_path).read_text(encoding="utf-8")
    replacements = {
        "REPORT_PATH": str(repo_root / "docs" / "overnight-handoff.md"),
        "RUN_STAMP": run_stamp,
        "REPO_ROOT": str(repo_root),
        "WORKER_REPORTS": worker_reports,
        "WORKER_STATUSES": worker_statuses,
        "LOG_DIR": str(logs_dir),
    }
    temp_prompt_path = logs_dir / f"{run_stamp}-pm-prompt.md"
    temp_prompt_path.write_text(render_prompt(prompt_template, replacements), encoding="utf-8")

    spec = WorkerSpec(
        worker_id=PM_SUMMARIZER.worker_id,
        prompt_path=str(temp_prompt_path.relative_to(repo_root)),
        report_filename=PM_SUMMARIZER.report_filename,
        timeout_seconds=PM_SUMMARIZER.timeout_seconds,
    )
    return await run_worker(spec, repo_root, run_stamp, docs_dir, logs_dir, dry_run, approval_flag)


def print_summary(results: Sequence[Dict[str, object]], pm_result: Dict[str, object], handoff_path: Path) -> None:
    print("")
    print("Overnight Codex Sprint Summary")
    for result in [*results, pm_result]:
      print(f"- {result['worker_id']}: {result['status']} | log={result['log_path']}")
      print(f"  command: {' '.join(result['command'])}")
    print(f"- final_handoff: {handoff_path}")


async def async_main() -> int:
    args = parse_args()
    approval_flag = validate_approval_mode(args.approval_mode)
    repo_root = resolve_repo_root()
    run_stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    docs_dir = repo_root / "docs" / "overnight"
    logs_dir = repo_root / "logs" / "overnight"
    ensure_dirs([docs_dir, logs_dir])

    workers = selected_workers(args.workers, args.timeout)
    worker_results = await run_primary_workers(
        workers,
        repo_root,
        run_stamp,
        docs_dir,
        logs_dir,
        args.dry_run,
        args.sequential,
        approval_flag,
    )
    pm_result = await run_pm_summarizer(
        repo_root,
        run_stamp,
        docs_dir,
        logs_dir,
        args.dry_run,
        worker_results,
        approval_flag,
    )
    print_summary(worker_results, pm_result, repo_root / "docs" / "overnight-handoff.md")

    failures = [result for result in [*worker_results, pm_result] if result["status"] not in {"success", "dry-run"}]
    return 1 if failures and not args.dry_run else 0


def main() -> int:
    return asyncio.run(async_main())


if __name__ == "__main__":
    raise SystemExit(main())
