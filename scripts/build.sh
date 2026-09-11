#!/bin/sh
set -eu
root=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)
source=${OHECO_SOURCE:-$root/../oheco}
go_bin=${GO:-go}
output=${OHECO_SITE_OUTPUT:-$root/public}
cd "$source"
"$go_bin" run ./cmd/oo-index --packages "$root/packages" --site "$root/site" \
  --installer-template "$source/scripts/install.sh.tmpl" --output "$output" "$@"
mkdir -p "$output/schema"
cp "$root/schema/package.schema.json" "$root/schema/index.schema.json" "$output/schema/"
