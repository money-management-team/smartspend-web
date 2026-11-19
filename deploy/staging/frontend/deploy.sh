#!/usr/bin/env bash
# SmartSpend frontend STAGING: the server-side half of .github/workflows/deploy-staging.yml.
#
# Install by hand, once, as <STAGING_REMOTE_BASE>/deploy.sh (chmod 700, owned by the deploy user). It is a template: nothing in this
# repository can install or run it. The staging web root is <STAGING_REMOTE_BASE>/current, and the staging domain's document root
# (hPanel) is set to exactly that path, so this script never writes anywhere outside its own base directory.
#
# Fail closed: anything it cannot establish stops it before the live link moves.
#
#   usage: deploy.sh <40-hex revision>        (the workflow has already uploaded the build to incoming/<revision>)
#
# One-time files next to this script (created by the owner, mode 600, never committed):
#   never-deploy-to.list   absolute paths of everything production owns here (its deploy dirs and web roots), one per line.
#                          REQUIRED and must not be empty: the script refuses to run without it.
#   never-in-build.list    production host names, one per line (for example the production API and web hosts). REQUIRED.
set -euo pipefail
umask 077

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REVISION="${1:-}"

die() { printf 'STAGING_DEPLOY_REFUSED: %s\n' "$1" >&2; exit 1; }

[[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || die "the revision must be a full 40-character commit hash"

# 1. This directory is a staging directory and is not production's, nor inside, nor around it.
[[ "$BASE" == *staging* ]] || die "the base directory name must contain 'staging' ($BASE)"
[[ -s "$BASE/never-deploy-to.list" ]] || die "never-deploy-to.list is missing or empty"
[[ -s "$BASE/never-in-build.list" ]] || die "never-in-build.list is missing or empty"
while IFS= read -r production || [[ -n "$production" ]]; do
  [[ -z "$production" || "$production" == \#* ]] && continue
  production="$(realpath -m "$production")"
  if [[ "$BASE" == "$production" || "$BASE" == "$production"/* || "$production" == "$BASE"/* ]]; then
    die "the base directory is, is inside, or contains a production path ($production)"
  fi
done < "$BASE/never-deploy-to.list"

# 2. The upload is where the workflow said it would be, and is a staging build.
INCOMING="$BASE/incoming/$REVISION"
[[ -d "$INCOMING" ]] || die "no incoming build for this revision"
[[ -f "$INCOMING/index.html" ]] || die "the incoming build has no index.html"
[[ -f "$INCOMING/deploy-revision-$REVISION.txt" ]] || die "the incoming build does not carry its revision file"
while IFS= read -r host || [[ -n "$host" ]]; do
  [[ -z "$host" || "$host" == \#* ]] && continue
  if grep -R -I -F -q -- "$host" "$INCOMING"; then die "the build mentions a production host ($host)"; fi
done < "$BASE/never-in-build.list"

# 3. Release directory, then the live link, atomically.
mkdir -p "$BASE/releases"
RELEASE="$BASE/releases/$REVISION"
rm -rf "$RELEASE"
mv "$INCOMING" "$RELEASE"
chmod -R u=rwX,go=rX "$RELEASE"
ln -sfn "$RELEASE" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"

# 4. Keep the last five releases, never the live one.
LIVE="$(readlink -f "$BASE/current")"
ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +6 | while IFS= read -r old; do
  [[ "$(readlink -f "$old")" == "$LIVE" ]] || rm -rf "$old"
done

printf '%s %s\n' "$(date -u +%FT%TZ)" "$REVISION" >> "$BASE/deploy.log"
printf 'STAGING_FRONTEND_DEPLOYED=%s\n' "$REVISION"
