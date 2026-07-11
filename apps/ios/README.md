# MemoFlow iOS App

This directory contains the native Apple-first MemoFlow scaffold.

## Goals of this baseline

- keep the existing web app untouched
- add a native SwiftUI + SwiftData target in the same repo
- preserve the real MemoFlow loop shape:
  - capture
  - AI suggestions
  - review
  - save item
  - memory
  - pending dumps
- use development-only direct AI configuration for local native parity work

## Requirements

- Xcode 15.4 or newer
- `xcodegen`

Install `xcodegen` with Homebrew:

```bash
brew install xcodegen
```

## Generate the project

From repo root:

```bash
./scripts/generate_ios_project.sh
```

Use the script instead of raw `xcodegen generate` so the checked-in project stays aligned with the repo's expected generated shape.

## Development-only AI configuration

The native app reads these environment variables at runtime when launched from Xcode:

- `MEMOFLOW_OPENAI_API_KEY`
- `MEMOFLOW_OPENAI_MODEL`
- `MEMOFLOW_OPENAI_BASE_URL` optional

Recommended default model:

```text
gpt-4o-mini
```

Do not commit real API keys into this repo.

## Current scope

This scaffold is intentionally small. It adds:

- SwiftData record models designed with later CloudKit compatibility in mind
- a development-only direct AI client
- native capture/pending/items/memory tabs
- correction-event logging for edited approvals

It does not yet claim full production readiness, public distribution safety, or CloudKit sync.

## Current local build prerequisites

Native build verification on this machine also requires the matching iOS platform files for the selected Xcode install. If `xcodebuild` reports:

```text
iOS 17.5 is not installed
```

open Xcode and install the matching iOS platform/components before expecting a full device build.

## Native regression coverage

The repo currently keeps two forms of native regression coverage:

- `MemoFlowIOSTests` for approval/save view-model logic
- `npm run eval:native-guards` for the specific native UI wiring regressions caught during simulator testing

The guard eval is intentionally narrow and checks for:

- stable suggestion-ID approval/discard wiring
- menu-style type selection
- approval navigation to the Items tab
