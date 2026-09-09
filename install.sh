#!/bin/sh
# Bootstrap Waykit: clone or reuse a checkout, link ~/.agents, put wk on PATH.
# curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh
# POSIX sh (dash, busybox ash, macOS /bin/sh). Do not require bash.
set -eu

GITHUB_REPO="${KIT_GITHUB_REPO:-mzworthington/waykit}"
KIT_DIR="${KIT_DIR:-}"
GIT_REF="${KIT_REF:-main}"
INSTALL_MCP="${INSTALL_MCP:-1}"
INSTALL_EXTERNAL_SKILLS="${INSTALL_EXTERNAL_SKILLS:-0}"
MIN_NODE_MAJOR=22

usage() {
  cat <<'EOF'
Waykit installer

  curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh
  curl -fsSL .../install.sh | sh -s -- [options]

From a Waykit checkout:
  ./install.sh [options]

Puts wk on PATH (~/.local/bin), links ~/.agents, and installs the default MCP profile.

Then, in an app repo:
  wk init . --mcp default --hook

Options:
  --dir <path>     Clone destination (default: $HOME/.local/share/waykit)
  --ref <git-ref>  Branch or tag to clone (default: main)
  -h, --help       Show this help

Environment:
  KIT_DIR                    Same as --dir
  KIT_REF                    Same as --ref
  KIT_GITHUB_REPO            GitHub owner/repo (default: mzworthington/waykit)
  INSTALL_MCP                Set to 0 to skip MCP compose
  INSTALL_EXTERNAL_SKILLS    Set to 1 to sync Cloudflare/Vercel skills
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)
      KIT_DIR="${2:-}"
      if [ -z "${KIT_DIR}" ]; then
        echo "error: --dir requires a path" >&2
        exit 1
      fi
      shift 2
      ;;
    --ref)
      GIT_REF="${2:-}"
      if [ -z "${GIT_REF}" ]; then
        echo "error: --ref requires a branch or tag" >&2
        exit 1
      fi
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

is_kit_checkout() {
  _dir="$1"
  [ -f "${_dir}/bin/kit.ts" ] && [ -f "${_dir}/package.json" ] && [ -f "${_dir}/AGENTS.md" ]
}

# Piped stdin (curl | sh): $0 is the shell name, not this file.
resolve_self_dir() {
  _source=$0
  case "${_source}" in
    - | sh | */sh | dash | */dash | bash | */bash | zsh | */zsh | ksh | */ksh) return 1 ;;
  esac
  if [ ! -f "${_source}" ]; then
    return 1
  fi
  _dir=$(CDPATH= cd -- "$(dirname -- "${_source}")" && pwd) || return 1
  printf '%s\n' "${_dir}"
}

resolve_agents_checkout() {
  _target="${HOME}/.agents"
  if [ ! -e "${_target}" ]; then
    return 1
  fi
  _resolved=$(CDPATH= cd -- "${_target}" && pwd) || return 1
  if is_kit_checkout "${_resolved}"; then
    printf '%s\n' "${_resolved}"
    return 0
  fi
  return 1
}

need_cmd() {
  _name="$1"
  if ! command -v "${_name}" >/dev/null 2>&1; then
    echo "error: ${_name} is required to install kit" >&2
    exit 1
  fi
}

ensure_node() {
  need_cmd node
  _major=$(node -p 'process.versions.node.split(".")[0]')
  if [ -z "${_major}" ] || [ "${_major}" -lt "${MIN_NODE_MAJOR}" ]; then
    echo "error: Node ${MIN_NODE_MAJOR}+ is required (found $(node -v))" >&2
    exit 1
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  if command -v corepack >/dev/null 2>&1; then
    echo "Enabling pnpm via corepack"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate
    return 0
  fi
  echo "error: pnpm is required. Install Node ${MIN_NODE_MAJOR}+ (includes corepack) or: npm install -g pnpm" >&2
  exit 1
}

ensure_deps() {
  _repo_dir="$1"
  ensure_node
  ensure_pnpm
  echo "Installing kit dependencies in ${_repo_dir}"
  (cd "${_repo_dir}" && pnpm install)
}

clone_or_update() {
  _dest="$1"
  _url="https://github.com/${GITHUB_REPO}.git"
  if [ -d "${_dest}/.git" ]; then
    _origin=$(git -C "${_dest}" remote get-url origin 2>/dev/null || true)
    case "${_origin}" in
      *"${GITHUB_REPO}"*|*"mzworthington/waykit"*|*"mzworthington/agent-lifecycle-kit"*) ;;
      *)
        echo "error: ${_dest} origin is ${_origin:-unset}, expected ${GITHUB_REPO}" >&2
        exit 1
        ;;
    esac
    echo "Updating ${_dest} (${GIT_REF})"
    git -C "${_dest}" fetch --depth 1 origin "${GIT_REF}"
    git -C "${_dest}" checkout -q "${GIT_REF}"
    git -C "${_dest}" pull --ff-only origin "${GIT_REF}"
    return 0
  fi
  if [ -e "${_dest}" ]; then
    echo "error: ${_dest} exists and is not a kit git checkout. Pass --dir to pick another path." >&2
    exit 1
  fi
  mkdir -p "$(dirname -- "${_dest}")"
  echo "Cloning ${_url} (${GIT_REF}) into ${_dest}"
  git clone --depth 1 --branch "${GIT_REF}" "${_url}" "${_dest}"
}

link_agents() {
  _repo_dir="$1"
  _target="${HOME}/.agents"
  if [ -L "${_target}" ]; then
    _current=$(readlink "${_target}")
    if [ "${_current}" = "${_repo_dir}" ]; then
      echo "OK: ${_target} already points to this checkout"
      return 0
    fi
    echo "WARN: ${_target} is a symlink to ${_current}"
    echo "      Remove it first if you want to repoint to ${_repo_dir}"
    return 1
  fi

  if [ -e "${_target}" ] && [ ! -L "${_target}" ]; then
    echo "ERROR: ${_target} exists and is not a symlink. Move or rename it first."
    return 1
  fi

  ln -s "${_repo_dir}" "${_target}"
  echo "Linked ${_target} -> ${_repo_dir}"
}

ensure_system_config() {
  _repo_dir="$1"
  if [ ! -f "${_repo_dir}/system/config.json" ]; then
    cp "${_repo_dir}/system/config.example.json" "${_repo_dir}/system/config.json"
    echo "Created system/config.json from example (edit project name as needed)"
  fi
}

install_mcp_profile() {
  _repo_dir="$1"
  if [ "${INSTALL_MCP}" != "1" ]; then
    echo "Skipping MCP install (INSTALL_MCP=${INSTALL_MCP})"
    return 0
  fi

  _kit="${_repo_dir}/bin/kit"
  if [ ! -x "${_kit}" ]; then
    echo "WARN: ${_kit} missing or not executable; skipping MCP install"
    return 0
  fi

  echo ""
  echo "Installing default MCP profile for Cursor, Claude Code, Copilot, and Antigravity"
  "${_kit}" mcp default --install || {
    echo "WARN: MCP compose/install failed; continue and run wk mcp default --install"
    return 0
  }
  echo "Set GITHUB_PERSONAL_ACCESS_TOKEN in the environment that launches the host for the GitHub MCP."
  echo "More profiles: collab | personal | lab | devtools | cloud | project-example"
  echo "  wk mcp collab --install"
  echo "  wk mcp personal --install   # Bitwarden/LinkedIn/Polyglot/Obsidian (local)"
  echo "  wk mcp lab --install        # Raspberry Pi over SSH (local)"
  echo "  wk mcp default --install --host claude   # one host only"
  echo "Project-scoped: wk mcp project-example --project"
  echo "Skip later with: INSTALL_MCP=0 ./install.sh"
}

install_external_skills() {
  _repo_dir="$1"
  if [ "${INSTALL_EXTERNAL_SKILLS}" != "1" ]; then
    echo "Skipping external skills (set INSTALL_EXTERNAL_SKILLS=1 to sync Cloudflare/Vercel skills)"
    return 0
  fi

  _kit="${_repo_dir}/bin/kit"
  if [ ! -x "${_kit}" ]; then
    echo "WARN: ${_kit} missing or not executable; skipping external skills"
    return 0
  fi

  echo ""
  echo "Syncing external skills from skills/external.lock.json"
  "${_kit}" sync --install || {
    echo "WARN: external skills sync failed; run wk sync --install manually"
    return 0
  }
}

export_ide_rules() {
  _repo_dir="$1"
  _kit="${_repo_dir}/bin/kit"
  if [ -x "${_kit}" ]; then
    echo ""
    echo "Exporting Multi-IDE rules (CLAUDE.md, .windsurfrules, Copilot)..."
    "${_kit}" export-rules || true
  fi
}

install_cli_bin() {
  _repo_dir="$1"
  _target_bin="${HOME}/.local/bin"
  if [ ! -d "${_target_bin}" ] && [ -d "${HOME}/bin" ]; then
    _target_bin="${HOME}/bin"
  fi
  mkdir -p "${_target_bin}"
  ln -sf "${_repo_dir}/bin/kit" "${_target_bin}/wk"
  for _alias in kit agent-kit; do
    if [ -L "${_target_bin}/${_alias}" ]; then
      rm -f "${_target_bin}/${_alias}"
    fi
  done
  echo "Linked CLI: ${_target_bin}/wk -> ${_repo_dir}/bin/kit"
  case ":${PATH}:" in
    *":${_target_bin}:"*) ;;
    *)
      echo ""
      echo "Add ${_target_bin} to PATH, then open a new shell:"
      echo "  export PATH=\"${_target_bin}:\$PATH\""
      ;;
  esac
}

install_shell_completions() {
  _repo_dir="$1"
  _kit="${_repo_dir}/bin/kit"
  if [ ! -x "${_kit}" ]; then
    return 0
  fi
  echo ""
  echo "Installing live shell completions (stub stays valid across wk upgrades)"
  "${_kit}" completion install || {
    echo "WARN: completion install failed; run wk completion install"
    return 0
  }
}

bootstrap_checkout() {
  _repo_dir="$1"
  ensure_deps "${_repo_dir}"
  link_agents "${_repo_dir}"
  ensure_system_config "${_repo_dir}"
  export_ide_rules "${_repo_dir}"
  install_mcp_profile "${_repo_dir}"
  install_external_skills "${_repo_dir}"
  install_cli_bin "${_repo_dir}"
  install_shell_completions "${_repo_dir}"

  echo ""
  echo "Waykit is ready."
  echo "CLI: wk (or pnpm wk from this repo)"
  echo "In an app repo:"
  echo "  wk init . --mcp default --hook"
  echo "External skills: INSTALL_EXTERNAL_SKILLS=1 ./install.sh  or  wk sync --install"
}

SELF_DIR=$(resolve_self_dir || true)

if [ -n "${SELF_DIR}" ] && is_kit_checkout "${SELF_DIR}"; then
  bootstrap_checkout "${SELF_DIR}"
  exit 0
fi

need_cmd git
ensure_node

DEST="${KIT_DIR}"
if [ -z "${DEST}" ]; then
  DEST=$(resolve_agents_checkout || true)
fi
if [ -z "${DEST}" ]; then
  if [ -d "${HOME}/.local/share/agent-lifecycle-kit/.git" ] && [ ! -d "${HOME}/.local/share/waykit/.git" ]; then
    DEST="${HOME}/.local/share/agent-lifecycle-kit"
  else
    DEST="${HOME}/.local/share/waykit"
  fi
fi

clone_or_update "${DEST}"
if ! is_kit_checkout "${DEST}"; then
  echo "error: ${DEST} is not a kit checkout after clone" >&2
  exit 1
fi
exec sh "${DEST}/install.sh"
