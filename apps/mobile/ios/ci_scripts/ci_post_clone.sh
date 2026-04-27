#!/bin/sh
# Xcode Cloud post-clone hook.
# The native iOS project at apps/mobile/ios/ is gitignored and regenerated
# by `expo prebuild` from app.json + the local config plugins. Without this
# script, xcodebuild can't find Notemage.xcworkspace on a fresh CI clone.

set -euxo pipefail

echo "==> Installing Node via Homebrew"
brew install node
# brew install does not modify the current shell's PATH, so corepack/npx
# (linked into Homebrew's bin dir) aren't reachable until we add it.
export PATH="$(brew --prefix)/bin:$PATH"

echo "==> Activating pnpm@9.12.0 via corepack"
corepack enable
corepack prepare pnpm@9.12.0 --activate

echo "==> Installing JS dependencies (monorepo root)"
cd "$CI_PRIMARY_REPOSITORY_PATH"
pnpm install --frozen-lockfile

echo "==> Generating iOS native project via expo prebuild"
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile"
npx expo prebuild --platform ios --no-install

echo "==> Installing CocoaPods"
cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo "==> Workspace ready: $(pwd)/Notemage.xcworkspace"
