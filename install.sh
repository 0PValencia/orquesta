#!/usr/bin/env bash
# Un comando (Linux / macOS / WSL / Git Bash):
#   curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
set -euo pipefail

REPO="${ORQUESTA_SKILLS_REPO:-0PValencia/orquesta}"
BRANCH="${ORQUESTA_SKILLS_BRANCH:-master}"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}/install.mjs"

c_green=$'\033[38;2;57;255;20m'
c_bold=$'\033[1m'
c_dim=$'\033[2m'
c_reset=$'\033[0m'

log() { printf '%s\n' "${c_dim}>${c_reset} $*" >&2; }
die() { printf '%s\n' "$*" >&2; exit 1; }

printf '%s\n' "${c_green}${c_bold}Orquesta skills${c_reset} — instalador" >&2
log "preparando…"

if ! command -v node >/dev/null 2>&1; then
  die "Falta Node.js (LTS): https://nodejs.org/ — instalá y volvé a correr el mismo curl|bash."
fi
log "Node $(node -v)"

# Clone local (no /dev/fd de curl|bash)
SCRIPT_FILE="${BASH_SOURCE[0]:-}"
LOCAL_MJS=""
if [[ -n "$SCRIPT_FILE" && -f "$SCRIPT_FILE" ]]; then
  case "$SCRIPT_FILE" in
    /dev/fd/*|/proc/*/fd/*|-)
      ;;
    *)
      _dir="$(cd "$(dirname "$SCRIPT_FILE")" && pwd)"
      [[ -f "$_dir/install.mjs" ]] && LOCAL_MJS="$_dir/install.mjs"
      ;;
  esac
fi

run_node() {
  local mjs="$1"
  shift
  # Probar si /dev/tty es usable (con curl|bash stdin es el pipe)
  if [[ -e /dev/tty ]] && { true </dev/tty; } 2>/dev/null; then
    node "$mjs" "$@" </dev/tty >/dev/tty 2>/dev/tty
    return $?
  fi
  log "sin TTY — si no ves menú, usá: bash -s -- -g -a cursor -y"
  node "$mjs" "$@"
}

if [[ -n "$LOCAL_MJS" ]]; then
  log "install.mjs local"
  run_node "$LOCAL_MJS" "$@"
  exit $?
fi

log "descargando menú interactivo (máx. 60s)…"
MV="$(mktemp "${TMPDIR:-/tmp}/orquesta-install.XXXXXX").mjs"
cleanup() { rm -f "$MV"; }
trap cleanup EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL --connect-timeout 15 --max-time 60 "$RAW" -o "$MV" \
    || die "No pude bajar install.mjs ($RAW)."
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$MV" --timeout=60 "$RAW" \
    || die "No pude bajar install.mjs ($RAW)."
else
  die "Instalá curl o wget."
fi

log "abriendo menú (↑/↓ · Enter · espacio en agentes)…"
run_node "$MV" "$@"
exit $?
