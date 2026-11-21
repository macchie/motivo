#!/usr/bin/env bash
# macOS packaging for Motivo: build the .app bundle, sign, notarize, make a .dmg.
# Used by the Makefile (make mac-*) and by .github/workflows/release.yml.
#
#   scripts/macos.sh app [binary]   Build dist/mac/Motivo.app (default binary: dist/motivo/motivo-mac_universal)
#   scripts/macos.sh sign           Sign the app (MAC_SIGN_IDENTITY, default "-" = ad-hoc)
#   scripts/macos.sh dmg            Build dist/Motivo-macOS.dmg (signed too when an identity is set)
#   scripts/macos.sh notarize       Notarize + staple the dmg (needs credentials, see below)
#   scripts/macos.sh verify         Show signature and Gatekeeper assessment
#   scripts/macos.sh release [bin]  app + sign + dmg (+ notarize when credentials are set)
#   scripts/macos.sh unquarantine [path]  Let an unsigned download run (default /Applications/Motivo.app)
#
# Environment:
#   MAC_SIGN_IDENTITY   "Developer ID Application: Name (TEAMID)" — or "-" for ad-hoc (default)
#   MAC_NOTARY_PROFILE  keychain profile created with `xcrun notarytool store-credentials`
#   or APPLE_ID + APPLE_TEAM_ID + APPLE_APP_PASSWORD (app-specific password)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
APP_NAME="Motivo"
OUT="dist/mac"
APP="$OUT/$APP_NAME.app"
DMG="dist/$APP_NAME-macOS.dmg"
IDENTITY="${MAC_SIGN_IDENTITY:--}"
ENTITLEMENTS="packaging/macos/entitlements.plist"

say() { printf '\033[33m▸\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }
need_mac() { [[ "$(uname)" == "Darwin" ]] || die "This step needs macOS (codesign, hdiutil, iconutil)."; }
version() { node -p "require('./neutralino.config.json').version" 2>/dev/null || echo "1.0.0"; }
has_notary() { [[ -n "${MAC_NOTARY_PROFILE:-}" || ( -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" ) ]]; }

cmd_app() {
  need_mac
  local bin="${1:-dist/motivo/motivo-mac_universal}"
  [[ -f "$bin" ]] || die "Missing $bin — run 'make build-embed' first (resources must be embedded)."
  say "Building $APP from $bin"
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp "$bin" "$APP/Contents/MacOS/motivo"
  chmod +x "$APP/Contents/MacOS/motivo"
  # Non-embedded builds keep resources next to the binary.
  if [[ -f "$(dirname "$bin")/resources.neu" ]]; then cp "$(dirname "$bin")/resources.neu" "$APP/Contents/MacOS/"; fi
  sed "s/__VERSION__/$(version)/g" packaging/macos/Info.plist > "$APP/Contents/Info.plist"
  printf 'APPL????' > "$APP/Contents/PkgInfo"
  # App icon: resources/icons/appIcon.png → AppIcon.icns
  local set; set="$(mktemp -d)/AppIcon.iconset"; mkdir -p "$set"
  for s in 16 32 128 256 512; do
    sips -z $s $s resources/icons/appIcon.png --out "$set/icon_${s}x${s}.png" >/dev/null
    sips -z $((s * 2)) $((s * 2)) resources/icons/appIcon.png --out "$set/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$set" -o "$APP/Contents/Resources/AppIcon.icns"
  xattr -cr "$APP"
  say "Built $APP"
}

cmd_sign() {
  need_mac
  [[ -d "$APP" ]] || die "Missing $APP — run 'scripts/macos.sh app' first."
  if [[ "$IDENTITY" == "-" ]]; then
    say "Ad-hoc signing (no Developer ID): the app runs locally, but downloads need the steps in INSTRUCTIONS.md"
    codesign --force --deep --sign - "$APP"
  else
    say "Signing with: $IDENTITY"
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$IDENTITY" "$APP/Contents/MacOS/motivo"
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$IDENTITY" "$APP"
  fi
  codesign --verify --strict --verbose=2 "$APP"
}

cmd_dmg() {
  need_mac
  [[ -d "$APP" ]] || die "Missing $APP — run 'scripts/macos.sh app' first."
  say "Building $DMG"
  local stage; stage="$(mktemp -d)"
  cp -R "$APP" "$stage/"
  ln -s /Applications "$stage/Applications"
  rm -f "$DMG"
  hdiutil create -volname "$APP_NAME" -srcfolder "$stage" -fs HFS+ -format UDZO -ov "$DMG" >/dev/null
  rm -rf "$stage"
  if [[ "$IDENTITY" != "-" ]]; then codesign --force --timestamp --sign "$IDENTITY" "$DMG"; fi
  say "Built $DMG"
}

cmd_notarize() {
  need_mac
  [[ "$IDENTITY" != "-" ]] || die "Notarization needs a Developer ID signature (set MAC_SIGN_IDENTITY)."
  has_notary || die "Set MAC_NOTARY_PROFILE, or APPLE_ID + APPLE_TEAM_ID + APPLE_APP_PASSWORD."
  [[ -f "$DMG" ]] || die "Missing $DMG — run 'scripts/macos.sh dmg' first."
  say "Submitting $DMG to Apple notary service (this can take a few minutes)"
  if [[ -n "${MAC_NOTARY_PROFILE:-}" ]]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$MAC_NOTARY_PROFILE" --wait
  else
    xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" --wait
  fi
  xcrun stapler staple "$DMG"
  say "Notarized and stapled $DMG"
}

cmd_verify() {
  need_mac
  if [[ -d "$APP" ]]; then
    codesign -dv --verbose=2 "$APP" 2>&1 | sed 's/^/  /' || true
    spctl -a -vv -t exec "$APP" 2>&1 | sed 's/^/  /' || true
  fi
  if [[ -f "$DMG" ]]; then spctl -a -vv -t open --context context:primary-signature "$DMG" 2>&1 | sed 's/^/  /' || true; fi
}

cmd_release() {
  cmd_app "${1:-}"; cmd_sign; cmd_dmg
  if [[ "$IDENTITY" != "-" ]] && has_notary; then cmd_notarize; else say "Skipping notarization (no Developer ID / credentials)"; fi
}

cmd_unquarantine() {
  local target="${1:-/Applications/$APP_NAME.app}"
  [[ -e "$target" ]] || die "Not found: $target"
  say "Removing the quarantine flag from $target"
  xattr -dr com.apple.quarantine "$target"
  say "Done — you can now open $APP_NAME normally."
}

case "${1:-}" in
  app) shift; cmd_app "$@" ;;
  sign) cmd_sign ;;
  dmg) cmd_dmg ;;
  notarize) cmd_notarize ;;
  verify) cmd_verify ;;
  release) shift; cmd_release "$@" ;;
  unquarantine) shift; cmd_unquarantine "$@" ;;
  *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
