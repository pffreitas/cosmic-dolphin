#!/usr/bin/env bash
#
# init-worktree.sh — initialize an existing git worktree.
#
# Env files are gitignored, so a freshly-created worktree starts without them
# and without installed dependencies. Run this from inside the worktree to:
#   1. Copy every .env* file (recursively, preserving relative paths) from the
#      main worktree into this one.
#   2. Install dependencies for the whole monorepo (bun install).
#
# Usage:
#   scripts/init-worktree.sh [source-repo]
#
# Arguments:
#   source-repo  Repo to copy .env* files from. Defaults to the main worktree
#                (the first entry reported by `git worktree list`).
#
# Examples:
#   scripts/init-worktree.sh
#   scripts/init-worktree.sh /Users/me/ws/cosmic-dolphin
#
set -euo pipefail

TARGET_ROOT="$(git rev-parse --show-toplevel)"

# Default source = the main worktree (first line of `git worktree list`).
DEFAULT_SOURCE="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
SOURCE_ROOT="${1:-$DEFAULT_SOURCE}"

# Normalize to absolute paths.
SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd)"
TARGET_ROOT="$(cd "$TARGET_ROOT" && pwd)"

echo "Source repo: $SOURCE_ROOT"
echo "Target repo: $TARGET_ROOT"
echo

if [[ "$SOURCE_ROOT" == "$TARGET_ROOT" ]]; then
  echo "Source and target are the same repo — skipping .env* copy." >&2
else
  echo "Copying .env* files..."
  copied=0
  while IFS= read -r -d '' env_file; do
    rel_path="${env_file#"$SOURCE_ROOT"/}"
    dest="${TARGET_ROOT}/${rel_path}"
    mkdir -p "$(dirname "$dest")"
    cp -p "$env_file" "$dest"
    echo "  + $rel_path"
    copied=$((copied + 1))
  done < <(
    find "$SOURCE_ROOT" \
      \( -name node_modules -o -name .git -o -name .worktrees -o -name dist -o -name .next -o -name .turbo \) -prune -o \
      -type f -name '.env*' -print0
  )
  echo "Copied ${copied} .env* file(s)."
fi

echo
echo "Installing dependencies (bun install)..."
cd "$TARGET_ROOT"
bun install

echo
echo "Worktree initialized: $TARGET_ROOT"
