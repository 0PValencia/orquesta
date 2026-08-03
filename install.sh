#!/usr/bin/env bash
# Un solo comando (sin clonar):
#   curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
#
# Lee menús desde /dev/tty para que funcione con curl|bash.
set -euo pipefail

REPO="${ORQUESTA_SKILLS_REPO:-0PValencia/orquesta}"
REPO_URL="${ORQUESTA_SKILLS_URL:-https://github.com/${REPO}.git}"
RAW_BASE="${ORQUESTA_SKILLS_RAW:-https://raw.githubusercontent.com/${REPO}/master}"

# Si se ejecuta desde un clone local
_SELF="${BASH_SOURCE[0]:-}"
if [[ -n "$_SELF" && -f "$_SELF" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$_SELF")" && pwd)"
else
  SCRIPT_DIR=""
fi

AGENTS=(
  "cursor|Cursor"
  "claude-code|Claude Code"
  "opencode|OpenCode"
  "codex|Codex"
  "windsurf|Windsurf"
  "antigravity|Gemini Antigravity"
  "amp|Amp / Universal"
)

c_reset=$'\033[0m'
c_bold=$'\033[1m'
c_dim=$'\033[2m'
c_green=$'\033[38;2;57;255;20m'
c_muted=$'\033[38;2;120;160;120m'

# Entrada del usuario aunque el script venga por pipe (curl | bash)
TTY=/dev/tty
if [[ ! -r "$TTY" ]]; then
  TTY=/dev/stdin
fi

prompt_read() {
  # usage: prompt_read VAR "texto "
  local __var="$1" __msg="$2" __val=""
  printf '%s' "$__msg" >"$TTY"
  IFS= read -r __val <"$TTY" || true
  printf -v "$__var" '%s' "$__val"
}

banner() {
  printf '%s\n' "${c_green}${c_bold}"
  cat <<'EOF'
   ___                            _
  / _ \ _ __ __ _ _   _  ___  ___| |_ __ _
 | | | | '__/ _` | | | |/ _ \/ __| __/ _` |
 | |_| | | | (_| | |_| |  __/\__ \ || (_| |
  \___/|_|  \__, |\__,_|\___||___/\__\__,_|
               |_|   skills
EOF
  printf '%s\n\n' "${c_reset}${c_muted}Instalador · ${REPO}${c_reset}"
}

ask_yn() {
  local prompt="$1" default="${2:-y}" ans hint="[Y/n]"
  [[ "$default" == "n" ]] && hint="[y/N]"
  prompt_read ans "${prompt} ${hint} "
  ans="${ans:-$default}"
  [[ "$ans" =~ ^[YySs] ]]
}

multi_select() {
  local title="$1"; shift
  local -a items=("$@")
  SELECTED_IDS=()
  echo "${c_bold}${title}${c_reset}"
  echo "${c_dim}  Números separados por espacio, o: all${c_reset}"
  local i=1
  for it in "${items[@]}"; do
    printf "  %2d) %s\n" "$i" "${it#*|}"
    i=$((i + 1))
  done
  local choice
  prompt_read choice "> "
  [[ -z "${choice:-}" ]] && return 1
  if [[ "$choice" =~ ^[Aa][Ll][Ll]$ ]]; then
    for it in "${items[@]}"; do SELECTED_IDS+=("${it%%|*}"); done
    return 0
  fi
  local n
  for n in $choice; do
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    (( n >= 1 && n <= ${#items[@]} )) || continue
    SELECTED_IDS+=("${items[$((n - 1))]%%|*}")
  done
  ((${#SELECTED_IDS[@]} > 0))
}

# Fuente para npx: siempre el repo remoto (no hace falta clonar)
# Si hay clone local con skills/, se puede usar para desarrollo.
skills_source() {
  if [[ -n "${SCRIPT_DIR}" && -d "${SCRIPT_DIR}/skills/google-documents" ]]; then
    printf '%s' "$SCRIPT_DIR"
  else
    printf '%s' "$REPO"
  fi
}

ensure_local_skills() {
  # Para fallback sin npx: clonar a temp
  if [[ -n "${SCRIPT_DIR}" && -d "${SCRIPT_DIR}/skills/google-documents" ]]; then
    LOCAL_SKILLS="$SCRIPT_DIR/skills"
    return 0
  fi
  if [[ -n "${LOCAL_SKILLS:-}" && -d "${LOCAL_SKILLS}/google-documents" ]]; then
    return 0
  fi
  echo "${c_muted}Clonando ${REPO} (temporal)…${c_reset}"
  WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/orquesta-skills.XXXXXX")"
  cleanup_work() { rm -rf "$WORK_DIR"; }
  trap cleanup_work EXIT
  if ! git clone --depth 1 "$REPO_URL" "$WORK_DIR" 2>/dev/null; then
    echo "No pude clonar $REPO_URL. ¿Hay git y red?" >&2
    exit 1
  fi
  LOCAL_SKILLS="$WORK_DIR/skills"
  SCRIPT_DIR="$WORK_DIR"
}

install_skills_cli() {
  local -a args=()
  [[ "$SCOPE" == "global" ]] && args+=(-g)
  local s a
  for s in "${SELECTED_SKILLS[@]}"; do args+=(-s "$s"); done
  for a in "${SELECTED_AGENTS[@]}"; do args+=(-a "$a"); done

  local source
  source="$(skills_source)"

  echo
  echo "${c_green}→ npx skills add ${source} ${args[*]} -y --copy${c_reset}"
  echo
  npx --yes skills add "$source" "${args[@]}" -y --copy
}

copy_manual() {
  local agent="$1" dest_root
  case "$agent" in
    cursor)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.cursor/skills" || dest_root="$(pwd)/.cursor/skills"
      ;;
    claude-code)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.claude/skills" || dest_root="$(pwd)/.claude/skills"
      ;;
    opencode)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.config/opencode/skills" || dest_root="$(pwd)/.agents/skills"
      ;;
    codex)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.codex/skills" || dest_root="$(pwd)/.codex/skills"
      ;;
    windsurf)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.codeium/windsurf/skills" || dest_root="$(pwd)/.windsurf/skills"
      ;;
    antigravity)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.gemini/antigravity/skills" || dest_root="$(pwd)/.agent/skills"
      ;;
    amp)
      [[ "$SCOPE" == "global" ]] && dest_root="${HOME}/.config/agents/skills" || dest_root="$(pwd)/.agents/skills"
      ;;
    *)
      echo "Agente no mapeado: $agent (omitido)" >&2
      return 0
      ;;
  esac

  ensure_local_skills
  mkdir -p "$dest_root"
  local s
  for s in "${SELECTED_SKILLS[@]}"; do
    local src="${LOCAL_SKILLS}/$s"
    [[ -d "$src" ]] || { echo "Falta $src" >&2; continue; }
    rm -rf "${dest_root:?}/$s"
    cp -a "$src" "$dest_root/$s"
    echo "  ✓ $s → $dest_root/$s"
  done
}

mirror_cursor() {
  printf '%s\n' "${SELECTED_AGENTS[@]}" | grep -qx cursor || return 0
  mkdir -p "${HOME}/.cursor/skills"
  local s
  for s in "${SELECTED_SKILLS[@]}"; do
    if [[ -d "${HOME}/.agents/skills/$s" ]]; then
      rm -rf "${HOME}/.cursor/skills/$s"
      cp -a "${HOME}/.agents/skills/$s" "${HOME}/.cursor/skills/$s"
    fi
  done
}

usage() {
  cat <<EOF
Instalar skills Orquesta (interactivo, sin clonar):

  curl -fsSL ${RAW_BASE}/install.sh | bash

Opciones:
  -g, --global     Alcance global
  --project        Proyecto actual
  -s NAME          google-documents | informe-angelica
  -a AGENT         cursor | claude-code | opencode | …
  -y               Sin preguntas

También:
  npx skills add ${REPO} -g -a cursor -y --copy
EOF
}

main() {
  SCOPE=""
  SELECTED_SKILLS=()
  SELECTED_AGENTS=()
  NONINTERACTIVE=0
  LOCAL_SKILLS=""
  WORK_DIR=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -g|--global) SCOPE="global"; shift ;;
      --project) SCOPE="project"; shift ;;
      -s|--skill) SELECTED_SKILLS+=("$2"); shift 2 ;;
      -a|--agent) SELECTED_AGENTS+=("$2"); shift 2 ;;
      -y|--yes) NONINTERACTIVE=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Opción desconocida: $1" >&2; usage; exit 1 ;;
    esac
  done

  banner

  if [[ "$NONINTERACTIVE" -eq 0 ]]; then
    echo "${c_bold}1) ¿Dónde instalar?${c_reset}"
    echo "  1) Global  (recomendado — todos tus proyectos)"
    echo "  2) Solo este proyecto  ($(pwd))"
    local sc
    prompt_read sc "> "
    [[ "${sc:-1}" == "2" ]] && SCOPE="project" || SCOPE="global"
    echo

    echo "${c_bold}2) ¿Qué skills?${c_reset}"
    echo "  1) google-documents   (MCP Google Docs)"
    echo "  2) informe-angelica   (informes SI I / Angélica)"
    echo "  3) Ambas"
    local sk
    prompt_read sk "> "
    case "${sk:-3}" in
      1) SELECTED_SKILLS=(google-documents) ;;
      2) SELECTED_SKILLS=(informe-angelica) ;;
      *) SELECTED_SKILLS=(google-documents informe-angelica) ;;
    esac
    echo

    multi_select "3) ¿En qué entornos / agentes?" "${AGENTS[@]}" || {
      echo "Cancelado."; exit 1
    }
    SELECTED_AGENTS=("${SELECTED_IDS[@]}")
  else
    SCOPE="${SCOPE:-global}"
    ((${#SELECTED_SKILLS[@]})) || SELECTED_SKILLS=(google-documents informe-angelica)
    ((${#SELECTED_AGENTS[@]})) || SELECTED_AGENTS=(cursor)
  fi

  echo
  echo "${c_bold}Resumen${c_reset}"
  echo "  Alcance: $SCOPE"
  echo "  Skills:  ${SELECTED_SKILLS[*]}"
  echo "  Agentes: ${SELECTED_AGENTS[*]}"
  echo
  if [[ "$NONINTERACTIVE" -eq 0 ]]; then
    ask_yn "¿Instalar ahora?" y || { echo "Cancelado."; exit 1; }
  fi

  if ! command -v npx >/dev/null 2>&1; then
    echo "Necesitás Node.js (npx). Instalalo y volvé a correr el mismo comando." >&2
    echo "  https://nodejs.org/" >&2
    # Igual intentamos copia vía git clone
    echo "${c_muted}Intentando instalación manual con git…${c_reset}"
    for a in "${SELECTED_AGENTS[@]}"; do copy_manual "$a"; done
    mirror_cursor
    echo "${c_green}${c_bold}✓ Listo${c_reset}"
    exit 0
  fi

  if install_skills_cli; then
    mirror_cursor
    echo
    echo "${c_green}${c_bold}✓ Skills instaladas${c_reset}"
    echo "${c_muted}Reiniciá el agente (Cursor/OpenCode/…) para que las tome.${c_reset}"
    exit 0
  fi

  echo "${c_muted}npx skills falló → copia manual…${c_reset}"
  for a in "${SELECTED_AGENTS[@]}"; do copy_manual "$a"; done
  mirror_cursor
  echo
  echo "${c_green}${c_bold}✓ Listo${c_reset}"
}

main "$@"
