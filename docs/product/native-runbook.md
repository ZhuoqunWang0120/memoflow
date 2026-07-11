# MemoFlow Native Runbook

Date: 2026-07-11

## Goal

Get the native MemoFlow baseline running locally in Xcode with the real AI loop enabled for development.

## Preconditions

- Xcode 15.4 or newer is installed
- `xcodegen` is installed
- the matching iOS platform/components are installed in Xcode
- you have a development-only AI API key

## 1. Install missing Xcode platform files

If local build verification reports:

```text
iOS 17.5 is not installed
```

fix that first in Xcode:

1. Open Xcode.
2. Go to `Xcode > Settings > Components` or the current platform-download UI for your version.
3. Install the iOS platform/runtime that matches the selected Xcode toolchain.

Do not continue until `xcodebuild` no longer reports the missing iOS platform.

## 2. Regenerate the project

From repo root:

```bash
./scripts/generate_ios_project.sh
```

Why:

- this generates `apps/ios/MemoFlowIOS.xcodeproj`
- it also patches the generated project format so local Xcode 15.4 can open it

## 3. Open the project in Xcode

Open:

```text
apps/ios/MemoFlowIOS.xcodeproj
```

Use the `MemoFlowIOS` scheme.

## 4. Set the development team

In Xcode:

1. Select the `MemoFlowIOS` project.
2. Select the `MemoFlowIOS` target.
3. Open `Signing & Capabilities`.
4. Choose your Apple development team.

This is required for normal local device or simulator workflows.

## 5. Add development-only AI environment variables

In Xcode:

1. Edit the `MemoFlowIOS` scheme.
2. Open `Run > Arguments`.
3. Add environment variables:

```text
MEMOFLOW_OPENAI_API_KEY=...
MEMOFLOW_OPENAI_MODEL=gpt-4o-mini
```

Optional:

```text
MEMOFLOW_OPENAI_BASE_URL=https://api.openai.com/v1/responses
```

Notes:

- this is for internal development only
- do not commit the key
- this is not the future public-distribution AI architecture

## 6. First-run verification checklist

The first local run should prove the core loop, not polish.

Verify in this order:

1. App launches successfully.
2. Capture screen accepts raw text.
3. `Save dump for later` creates a pending dump.
4. Pending tab shows that dump.
5. Review from Pending loads the dump back into Capture.
6. `Generate suggestions` returns at least one real AI suggestion.
7. Approving a suggestion creates a saved item.
8. Items tab shows the saved item.
9. Archive works.
10. Unarchive works.
11. Memory tab can save one memory entry.
12. A later suggestion run still works with `Use memory` and `Use context` toggles.

## 7. If build verification is needed from CLI

From repo root:

```bash
./scripts/generate_ios_project.sh
xcodebuild -project apps/ios/MemoFlowIOS.xcodeproj -scheme MemoFlowIOS -destination 'generic/platform=iOS' -derivedDataPath .xcode-derived-data CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

Interpretation:

- if this fails on missing iOS platform files, fix Xcode components
- if it fails on signing, set your development team in Xcode
- if it fails on app compile errors, fix the native code

## 8. Narrow next step after first successful run

Do not jump to CloudKit, public alpha, or subscriptions next.

After the first successful local run, the next engineering step should be:

- compare actual native behavior against `specs/native-parity-checklist.md`
- fix the highest-value parity gaps in the capture -> AI suggestion -> review -> save loop
