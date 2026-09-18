#!/usr/bin/env bash
# Detect / cut GitHub Releases from conventional commits (git-cliff notes).
# Package stays private; distribution is git tags + GitHub Releases (install via KIT_REF).
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${RELEASE_ROOT:-$KIT_ROOT}"
cd "$ROOT"

emit() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s\n' "$1" >>"$GITHUB_OUTPUT"
  else
    echo "$1"
  fi
}

last_version_tag() {
  local from_gh=""
  if [[ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]] && command -v gh >/dev/null 2>&1; then
    from_gh="$(gh release list --limit 200 --json tagName -q '.[].tagName' 2>/dev/null \
      | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
      | sort -V \
      | tail -1 || true)"
  fi
  if [[ -n "$from_gh" ]]; then
    printf '%s' "$from_gh"
    return 0
  fi
  git tag -l 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -V \
    | tail -1 || true
}

version_tags_sorted() {
  if [[ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]] && command -v gh >/dev/null 2>&1; then
    gh release list --limit 200 --json tagName -q '.[].tagName' 2>/dev/null \
      | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
      | sort -V \
      || true
    return 0
  fi
  git tag -l 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -V \
    || true
}

bump_from_commits() {
  local since="$1"
  local range messages
  if [[ -n "$since" ]]; then
    range="${since}..HEAD"
  else
    range="HEAD"
  fi
  messages="$(git log --format=%s "$range" 2>/dev/null || true)"
  if [[ -z "$messages" ]]; then
    echo "none"
    return
  fi
  if echo "$messages" | grep -Eq '^(feat|fix|perf|refactor)(\(.+\))?!:|BREAKING CHANGE'; then
    echo "major"
    return
  fi
  if echo "$messages" | grep -Eq '^feat(\(.+\))?:'; then
    echo "minor"
    return
  fi
  if echo "$messages" | grep -Eq '^(fix|perf|refactor)(\(.+\))?:'; then
    echo "patch"
    return
  fi
  # docs/chore/ci/test alone do not cut a release
  echo "none"
}

next_version_tag() {
  local last bump version major minor patch
  last="$(last_version_tag)"
  bump="$1"
  if [[ -z "$last" ]]; then
    # First release: package.json is already 1.0.0
    echo "v1.0.0"
    return
  fi
  version="${last#v}"
  IFS='.' read -r major minor patch <<< "$version"
  case "$bump" in
    major) echo "v$((major + 1)).0.0" ;;
    minor) echo "v${major}.$((minor + 1)).0" ;;
    patch) echo "v${major}.${minor}.$((patch + 1))" ;;
    *) echo "$last" ;;
  esac
}

cmd_detect() {
  local head_msg last bump tag
  head_msg="$(git log -1 --format=%s)"
  if [[ "$head_msg" =~ ^chore\(changelog\): ]] \
    || [[ "$head_msg" =~ ^chore\(release\): ]] \
    || [[ "$head_msg" =~ ^chore\(derived\): ]]; then
    emit "skip=true"
    emit "release=false"
    echo "Skipping release: HEAD is a derived/release commit."
    return 0
  fi

  last="$(last_version_tag)"
  bump="$(bump_from_commits "$last")"
  if [[ "$bump" == "none" ]]; then
    emit "skip=false"
    emit "release=false"
    emit "bump=none"
    echo "No release-worthy conventional commits since ${last:-beginning}."
    return 0
  fi

  tag="$(next_version_tag "$bump")"
  # Avoid re-tagging the same version when last was empty→v1.0.0 already exists conceptually
  if [[ -n "$last" && "$tag" == "$last" ]]; then
    emit "skip=false"
    emit "release=false"
    echo "Next tag equals last tag; nothing to release."
    return 0
  fi

  emit "skip=false"
  emit "release=true"
  emit "bump=${bump}"
  emit "tag=${tag}"
  emit "since=${last}"
  echo "Will release ${tag} (bump=${bump}, since=${last:-none})"
}

# Version-scoped notes: cliff JSON for since..until (or until alone), rendered without [unreleased].
# Usage: notes [since-tag] [until-ref]
#   until defaults to HEAD. Empty since = first release (all commits up to until).
cmd_notes() {
  local since="${1:-}"
  local until="${2:-HEAD}"
  node --import tsx/esm "$ROOT/kit/src/release/release_notes.ts" "$since" "$until"
}

cmd_publish() {
  local tag="$1"
  local since="${2:-}"
  local notes_file target_sha
  notes_file="$(mktemp)"
  {
    echo "## ${tag}"
    echo ""
    # until-ref is HEAD (tag target) for a newly cut release
    cmd_notes "$since" "HEAD"
  } >"$notes_file"

  if grep -qi '\[unreleased\]' "$notes_file"; then
    echo "Refusing to publish: notes contain [unreleased]" >&2
    rm -f "$notes_file"
    exit 1
  fi

  target_sha="$(git rev-parse HEAD)"
  if gh release view "$tag" >/dev/null 2>&1; then
    echo "Release ${tag} already exists; updating notes."
    gh release edit "$tag" --notes-file "$notes_file"
  else
    gh release create "$tag" \
      --title "Release ${tag}" \
      --notes-file "$notes_file" \
      --target "$target_sha"
  fi
  rm -f "$notes_file"
  echo "Published ${tag} at ${target_sha}"
}

# Idempotently rewrite GitHub Release bodies for every vX.Y.Z tag (previous..this).
cmd_sync_notes() {
  local tags=() tag prev notes_file
  if [[ -z "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
    echo "sync-notes requires GH_TOKEN or GITHUB_TOKEN" >&2
    exit 1
  fi
  if ! command -v gh >/dev/null 2>&1; then
    echo "sync-notes requires gh" >&2
    exit 1
  fi

  mapfile -t tags < <(version_tags_sorted)
  if [[ "${#tags[@]}" -eq 0 ]]; then
    echo "No vX.Y.Z GitHub Releases to sync."
    return 0
  fi

  # Ensure annotated/lightweight release tags exist locally (Promote checkout may lack them
  # until fetch-tags; publish may have just created a new tag on the remote).
  git fetch --tags --force 2>/dev/null || true

  prev=""
  for tag in "${tags[@]}"; do
    if ! gh release view "$tag" >/dev/null 2>&1; then
      echo "Skipping ${tag}: no GitHub Release"
      continue
    fi
    if ! git rev-parse "${tag}^{commit}" >/dev/null 2>&1; then
      echo "Skipping ${tag}: tag not present in local git" >&2
      continue
    fi
    notes_file="$(mktemp)"
    {
      echo "## ${tag}"
      echo ""
      cmd_notes "$prev" "$tag"
    } >"$notes_file"
    if grep -qi '\[unreleased\]' "$notes_file"; then
      echo "Refusing to sync ${tag}: notes contain [unreleased]" >&2
      rm -f "$notes_file"
      exit 1
    fi
    gh release edit "$tag" --notes-file "$notes_file"
    rm -f "$notes_file"
    echo "Synced notes for ${tag} (since=${prev:-beginning})"
    prev="$tag"
  done
}

# Push date-grouped CHANGELOG.md back to the branch tip.
# Regenerates on the latest origin tip, then retries the push once if main advanced.
# Never --force. CI-only unless FORCE_CHANGELOG_PUSH=1.
cmd_commit_changelog() {
  local branch="${1:-${GITHUB_REF_NAME:-main}}"
  local attempt

  if [[ "${CI:-}" != "true" && "${FORCE_CHANGELOG_PUSH:-}" != "1" ]]; then
    echo "commit-changelog is for CI. Set FORCE_CHANGELOG_PUSH=1 to run locally." >&2
    return 1
  fi

  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

  for attempt in 1 2; do
    git fetch origin "$branch"
    git checkout -B "$branch" "origin/${branch}"
    git reset --hard "origin/${branch}"
    if [[ -n "${CHANGELOG_CMD:-}" ]]; then
      bash -c "$CHANGELOG_CMD"
    else
      pnpm changelog
    fi
    if git diff --quiet -- CHANGELOG.md; then
      echo "CHANGELOG.md already up to date."
      return 0
    fi
    git add CHANGELOG.md
    git commit -m "chore(changelog): regenerate from conventional commits"
    if git push origin "HEAD:refs/heads/${branch}"; then
      return 0
    fi
    if [[ "$attempt" -eq 1 ]]; then
      echo "Push rejected; retrying once after fetching latest ${branch}."
      continue
    fi
    echo "Push rejected after retry." >&2
    return 1
  done
}

usage() {
  cat <<'EOF'
Usage: bin/release.sh <detect|notes|publish|sync-notes|commit-changelog> [args]

  detect                     Emit GitHub Actions outputs for whether to release
  notes [since-tag] [until]  Print version-scoped notes (until defaults to HEAD)
  publish <tag> [since-tag]  Create/update GitHub Release for HEAD
  sync-notes                 Rewrite notes for all existing vX.Y.Z GitHub Releases
  commit-changelog [branch]  Regenerate CHANGELOG.md on the latest tip and push
                             (retries once if the branch advanced; never --force)
EOF
}

case "${1:-}" in
  detect) cmd_detect ;;
  notes) shift; cmd_notes "${1:-}" "${2:-HEAD}" ;;
  publish)
    shift
    [[ -n "${1:-}" ]] || { usage >&2; exit 1; }
    cmd_publish "$1" "${2:-}"
    ;;
  sync-notes) cmd_sync_notes ;;
  commit-changelog)
    shift
    cmd_commit_changelog "${1:-}"
    ;;
  -h|--help|help) usage ;;
  *) usage >&2; exit 1 ;;
esac
