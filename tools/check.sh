#!/usr/bin/env bash
# Pre-PR check: typecheck (fails only on files you changed vs origin/main, so old gym errors don't block) + production build.
set -u
cd "$(dirname "$0")/.."
changed=$( { git diff --name-only origin/main; git ls-files --others --exclude-standard; } | grep -E '\.(ts|tsx)$' | sort -u)
out=$(npx tsc --noEmit 2>&1 | grep "error TS")
bad=""
for f in $changed; do m=$(echo "$out" | grep "^$f(" ); [ -n "$m" ] && bad="$bad$m"$'\n'; done
echo "typecheck: $(echo "$out" | grep -c 'error TS') errors repo-wide (old gym ones), $(echo -n "$bad" | grep -c .) in files you changed"
[ -n "$bad" ] && { echo "$bad"; exit 1; }
npx vite build --outDir "${TMPDIR:-/tmp}/site-check-dist" 2>&1 | grep -E "error|built in" ; exit "${PIPESTATUS[0]}"
