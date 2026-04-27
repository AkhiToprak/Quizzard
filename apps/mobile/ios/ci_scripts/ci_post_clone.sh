#!/bin/sh
# Xcode Cloud post-clone hook.
# The native iOS project at apps/mobile/ios/ is gitignored and regenerated
# by `expo prebuild` from app.json + the local config plugins. Without this
# script, xcodebuild can't find Notemage.xcworkspace on a fresh CI clone.

set -euxo pipefail

echo "==> Installing Node via Homebrew"
brew install node
# Point PATH at node's keg bin directly. Xcode Cloud's brew install does
# NOT seem to link binaries into /usr/local/bin (corepack stays missing
# even with /usr/local/bin on PATH), but the keg always has them.
NODE_BIN="$(brew --prefix node)/bin"
export PATH="$NODE_BIN:$PATH"
ls -la "$NODE_BIN" | head -20  # diagnostic: confirm node/npm/corepack exist

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
