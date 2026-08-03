#!/usr/bin/env bash
# Bootstrap multiplataforma (Linux / macOS / WSL / Git Bash).
# Un comando:
#   curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
set -euo pipefail

REPO="${ORQUESTA_SKILLS_REPO:-0PValencia/orquesta}"
BRANCH="${ORQUESTA_SKILLS_BRANCH:-master}"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}/install.mjs"

need_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi
  echo "Necesitás Node.js (incluye npx)." >&2
  echo "  https://nodejs.org/  — instalá LTS y volvé a correr el mismo comando." >&2
  exit 1
}

need_node

# Si hay install.mjs junto a este script (clone local), usarlo
SELF="${BASH_SOURCE[0]:-}"
if [[ -n "$SELF" && -f "$SELF" ]]; then
  DIR="$(cd "$(dirname "$SELF")" && pwd)"
  if [[ -f "$DIR/install.mjs" ]]; then
    exec node "$DIR/install.mjs" "$@"
  fi
fi

# curl|bash: bajar install.mjs a temp y ejecutar (stdin libre vía /dev/tty lo maneja Node TTY)
TMP="$(mktemp "${TMPDIR:-/tmp}/orquesta-install.XXXXXX.mjs")"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$RAW" -o "$TMP"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP" "$RAW"
else
  echo "Instalá curl o wget." >&2
  exit 1
fi

# Reabrir stdin desde la terminal real cuando venimos de un pipe
if [[ ! -t 0 ]] && [[ -r /dev/tty ]]; then
  exec < /dev/tty
fi

node "$TMP" "$@"
