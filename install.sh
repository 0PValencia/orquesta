#!/usr/bin/env bash
# Instalador interactivo de skills Orquesta (ecosistema npx skills)
# https://github.com/0PValencia/orquesta
set -euo pipefail

REPO="${ORQUESTA_SKILLS_REPO:-0PValencia/orquesta}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
  printf '%s\n\n' "${c_reset}${c_muted}${REPO}${c_reset}"
}

ask_yn() {
  local prompt="$1" default="${2:-y}" ans hint="[Y/n]"
  [[ "$default" == "n" ]] && hint="[y/N]"
  read -r -p "${prompt} ${hint} " ans || true
  ans="${ans:-$default}"
  [[ "$ans" =~ ^[YySs] ]]
}

# Rellena SELECTED_IDS con ids elegidos
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
  read -r -p "> " choice || true
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

install_skills_cli() {
  local -a args=()
  [[ "$SCOPE" == "global" ]] && args+=(-g)
  local s a
  for s in "${SELECTED_SKILLS[@]}"; do args+=(-s "$s"); done
  for a in "${SELECTED_AGENTS[@]}"; do args+=(-a "$a"); done

  local source="$REPO"
  [[ -d "$SCRIPT_DIR/skills/google-documents" ]] && source="$SCRIPT_DIR"

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

  mkdir -p "$dest_root"
  local s
  for s in "${SELECTED_SKILLS[@]}"; do
    local src="$SCRIPT_DIR/skills/$s"
    [[ -d "$src" ]] || { echo "Falta $src" >&2; continue; }
    rm -rf "${dest_root:?}/$s"
    cp -a "$src" "$dest_root/$s"
    echo "  ✓ $s → $dest_root/$s"
  done
}

usage() {
  cat <<EOF
Uso: ./install.sh [opciones]

  -g, --global     Alcance global (usuario)
  --project        Alcance proyecto actual
  -s NAME          Skill: google-documents | informe-angelica
  -a AGENT         cursor | claude-code | opencode | codex | windsurf | …
  -y               Sin prompts

Interactivo (sin flags):
  1) global o proyecto
  2) qué skills
  3) a qué agentes/entornos

Equivalente ecosystem:
  npx skills add 0PValencia/orquesta -g -a cursor -a opencode
EOF
}

main() {
  SCOPE=""
  SELECTED_SKILLS=()
  SELECTED_AGENTS=()
  NONINTERACTIVE=0

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
    echo "  1) Global  (~/.cursor/skills, ~/.config/opencode/skills, …)"
    echo "  2) Proyecto actual  ($(pwd)/…)"
    local sc
    read -r -p "> " sc || true
    [[ "${sc:-1}" == "2" ]] && SCOPE="project" || SCOPE="global"
    echo

    echo "${c_bold}2) ¿Qué skills?${c_reset}"
    echo "  1) google-documents"
    echo "  2) informe-angelica"
    echo "  3) Ambas"
    local sk
    read -r -p "> " sk || true
    case "${sk:-3}" in
      1) SELECTED_SKILLS=(google-documents) ;;
      2) SELECTED_SKILLS=(informe-angelica) ;;
      *) SELECTED_SKILLS=(google-documents informe-angelica) ;;
    esac
    echo

    multi_select "3) ¿En qué entornos?" "${AGENTS[@]}" || {
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
    ask_yn "¿Instalar?" y || { echo "Cancelado."; exit 1; }
  fi

  if command -v npx >/dev/null 2>&1; then
    if install_skills_cli; then
      # Cursor a veces resuelve desde ~/.cursor/skills además de ~/.agents/skills
      if printf '%s\n' "${SELECTED_AGENTS[@]}" | grep -qx cursor; then
        mkdir -p "${HOME}/.cursor/skills"
        for s in "${SELECTED_SKILLS[@]}"; do
          if [[ -d "${HOME}/.agents/skills/$s" ]]; then
            rm -rf "${HOME}/.cursor/skills/$s"
            cp -a "${HOME}/.agents/skills/$s" "${HOME}/.cursor/skills/$s"
          elif [[ -d "$SCRIPT_DIR/skills/$s" ]]; then
            rm -rf "${HOME}/.cursor/skills/$s"
            cp -a "$SCRIPT_DIR/skills/$s" "${HOME}/.cursor/skills/$s"
          fi
        done
      fi
      echo
      echo "${c_green}${c_bold}✓ Instalado con npx skills${c_reset}"
      exit 0
    fi
    echo "${c_muted}Fallback: copia manual…${c_reset}"
  else
    echo "${c_muted}Sin npx → copia manual…${c_reset}"
  fi

  local a
  for a in "${SELECTED_AGENTS[@]}"; do
    copy_manual "$a"
  done
  echo
  echo "${c_green}${c_bold}✓ Listo${c_reset}"
}

main "$@"
