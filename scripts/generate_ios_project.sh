#!/bin/sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
SPEC_PATH="$REPO_ROOT/apps/ios/project.yml"

xcodegen generate --spec "$SPEC_PATH"
echo "Generated $REPO_ROOT/apps/ios/MemoFlowIOS.xcodeproj/project.pbxproj"
