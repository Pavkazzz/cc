#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p static/divkit
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
npm pack @divkitframework/divkit --pack-destination "$TMPDIR" >/dev/null 2>&1
tar xzf "$TMPDIR"/divkitframework-divkit-*.tgz --strip-components=1 -C "$TMPDIR"
cp "$TMPDIR/dist/client.css" static/divkit/client.css
cp "$TMPDIR/dist/browser.js" static/divkit/browser.js
echo "DivKit assets installed to static/divkit/"
