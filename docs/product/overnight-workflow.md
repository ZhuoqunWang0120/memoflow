# Overnight Codex Workflow

## Goal

Run a small unattended inspection/docs sprint with multiple safe `codex exec`
workers in parallel, then generate one PM handoff.

## Scope

- repo inspection
- friends-alpha safety inspection
- Capacitor iOS shell scouting
- backlog/docs review
- PM summary handoff

## Non-Goals

- no deployment
- no merge
- no branch/tag mutation
- no destructive git commands
- no product feature implementation by default

## Default Outputs

- worker logs: `logs/overnight/`
- worker reports: `docs/overnight/`
- final handoff: `docs/overnight-handoff.md`

## How It Works

1. `scripts/overnight_codex_sprint.py` builds a timestamped run id.
2. It launches independent worker prompts with `codex exec`.
3. Each worker writes its own markdown report.
4. Failures do not stop the other workers.
5. A PM summarizer runs last and writes the final handoff.

## Safe Defaults

- `workspace-write` sandbox
- no approval bypass
- no deployment or merge instructions
- explicit per-worker timeouts
- `--dry-run` mode for command preview only
- `--sequential` fallback mode

## Approval Mode

- `--approval-mode default` keeps the current Codex CLI approval behavior
- `--approval-mode never` is intended for unattended overnight runs while still keeping `--sandbox workspace-write`
- when supported by the local Codex CLI, worker commands include `--ask-for-approval never`
- if the local `codex exec --help` output does not advertise `--ask-for-approval`, the script stops with a clear error instead of guessing another flag

Recommended unattended command when the local CLI supports the flag:

```bash
python3 scripts/overnight_codex_sprint.py --approval-mode never --sequential --timeout 1800
```

Risk note:

- this allows unattended Codex actions inside the workspace sandbox
- worker prompts still prohibit destructive commands, deployment, merge, branch/tag mutation, secrets exposure, and unrelated product feature work

## Example Usage

Dry run:

```bash
python3 scripts/overnight_codex_sprint.py --dry-run
```

Dry run with unattended approval mode:

```bash
python3 scripts/overnight_codex_sprint.py --dry-run --approval-mode never
```

Sequential fallback:

```bash
python3 scripts/overnight_codex_sprint.py --sequential
```

Normal overnight run:

```bash
python3 scripts/overnight_codex_sprint.py
```
