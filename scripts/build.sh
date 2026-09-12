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
mkdir -p "$output/schema/v1"
cp "$root/schema/v1/package.schema.json" "$root/schema/v1/index.schema.json" "$output/schema/v1/"
mkdir -p "$output/schema/v2"
cp "$root/schema/v2/package.schema.json" "$root/schema/v2/index.schema.json" "$output/schema/v2/"
mkdir -p "$output/schema/v3"
cp "$root/schema/v3/package.schema.json" "$root/schema/v3/index.schema.json" "$output/schema/v3/"
