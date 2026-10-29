#!/bin/sh
set -eu
# Keep version and checksums together for local development, CI and the image.
case "$(uname -m)" in
  x86_64) asset=x86_64; checksum=ae7d01d261efb9e480e18ce3424533332883863bcf70b12a4321b5733f37e19e ;;
  aarch64|arm64) asset=aarch64; checksum=ac546dfc43c533430da92b75ab36f2a29da7d6324d5d38baf606ef2e0d849345 ;;
  *) echo 'Unsupported Lightpanda architecture' >&2; exit 1 ;;
esac
if [ "$(uname -s)" != Linux ]; then
  echo 'This pinned installer targets Linux; use the upstream macOS release for development.' >&2
  exit 1
fi
destination=${1:-/usr/local/bin/lightpanda}
artifact=$(mktemp)
trap 'rm -f "$artifact"' EXIT
curl -fsSL --retry 3 --max-time 120 "https://github.com/lightpanda-io/browser/releases/download/1.0.2/lightpanda-${asset}-linux" -o "$artifact"
echo "$checksum  $artifact" | sha256sum -c -
install -m 755 "$artifact" "$destination"
"$destination" version
