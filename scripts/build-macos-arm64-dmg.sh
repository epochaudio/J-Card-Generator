#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

VERSION="$(node -p "require('./package.json').version")"
PRODUCT_NAME="$(node -p "require('./package.json').build.productName")"
FINAL_OUTPUT_DIR="dist_electron_macos_arm64"
TEMP_ROOT="$(mktemp -d /tmp/tape-cover-build.XXXXXX)"
RAW_OUTPUT_DIR="$TEMP_ROOT/raw"
APP_PATH="$RAW_OUTPUT_DIR/mac-arm64/$PRODUCT_NAME.app"
DMG_PATH="$FINAL_OUTPUT_DIR/$PRODUCT_NAME-$VERSION-arm64-mac.dmg"
STAGING_DIR="$TEMP_ROOT/staging"

cleanup() {
  rm -rf "$TEMP_ROOT"
}

trap cleanup EXIT

npm run build
./node_modules/.bin/electron-builder --mac dir --arm64 -c.directories.output="$RAW_OUTPUT_DIR"

codesign --force --deep --sign - --timestamp=none "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

mkdir -p "$FINAL_OUTPUT_DIR"
mkdir -p "$STAGING_DIR"
ditto "$APP_PATH" "$STAGING_DIR/$PRODUCT_NAME.app"
ln -s /Applications "$STAGING_DIR/Applications"

hdiutil create \
  -volname "$PRODUCT_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

printf 'Created %s\n' "$DMG_PATH"
