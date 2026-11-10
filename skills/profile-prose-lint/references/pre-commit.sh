#!/usr/bin/env sh
# Lint staged Markdown with Vale. Install into the versioned hook
# (.husky/pre-commit or .githooks/pre-commit), not .git/hooks.
docs=$(git diff --cached --name-only --diff-filter=ACM | grep '\.md$' || true)

if [ -n "$docs" ]; then
  if command -v vale >/dev/null 2>&1; then
    echo "Running Vale against staged documentation..."
    printf '%s\n' "$docs" | tr '\n' '\0' | xargs -0 vale || {
      echo "Vale linting failed. Fix style issues before committing."
      exit 1
    }
  else
    echo "Vale is not installed; prose lint skipped. CI still runs it."
  fi
fi
