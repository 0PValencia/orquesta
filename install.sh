#!/usr/bin/env bash
# Instalador Orquesta (estilo OpenCode: curl | bash)
#
# Uso (tras subir el repo a GitHub):
#   curl -fsSL https://raw.githubusercontent.com/USER/REPO/main/install.sh | bash
#
# Opcional:
#   curl -fsSL .../install.sh | bash -s -- --repo https://github.com/USER/REPO.git
#   ORQUESTA_REPO=... bash install.sh
#
set -euo pipefail

APP=orquesta
MUTED='\033[0;2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[38;5;214m'
NC='\033[0m'

# ─── Cambia esto cuando tengas el repo público ───
DEFAULT_REPO="${ORQUESTA_REPO:-}"

INSTALL_ROOT="${ORQUESTA_HOME:-$HOME/.orquesta}"
INSTALL_DIR="$INSTALL_ROOT/bin"
SRC_DIR="$INSTALL_ROOT/src"
BRANCH="${ORQUESTA_BRANCH:-main}"

requested_repo=""
no_modify_path=false

usage() {
  cat <<EOF
Instala Orquesta CLI en \$HOME/.orquesta/bin

Usage:
  curl -fsSL <URL>/install.sh | bash
  curl -fsSL <URL>/install.sh | bash -s -- [options]

Options:
  -h, --help              Ayuda
  -r, --repo <url>        Git del monorepo (https://github.com/USER/REPO.git)
  --no-modify-path        No tocar .bashrc / .zshrc

Examples:
  curl -fsSL https://raw.githubusercontent.com/USER/pipeeline/main/install.sh | bash
  curl -fsSL .../install.sh | bash -s -- --repo https://github.com/USER/pipeeline.git
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -r|--repo)
      [[ -n "${2:-}" ]] || { echo -e "${RED}--repo requiere URL${NC}"; exit 1; }
      requested_repo="$2"
      shift 2
      ;;
    --no-modify-path) no_modify_path=true; shift ;;
    *)
      echo -e "${ORANGE}Opción desconocida: $1${NC}" >&2
      shift
      ;;
  esac
done

REPO="${requested_repo:-$DEFAULT_REPO}"

if [[ -z "$REPO" || "$REPO" == *"OWNER"* || "$REPO" == *"USER/REPO"* ]]; then
  echo -e "${RED}Falta la URL del repo de GitHub.${NC}"
  echo ""
  echo "1) Sube este proyecto a GitHub (público o con acceso)."
  echo "2) Instala así:"
  echo ""
  echo -e "  ${GREEN}curl -fsSL https://raw.githubusercontent.com/TU_USER/TU_REPO/main/install.sh | bash -s -- --repo https://github.com/TU_USER/TU_REPO.git${NC}"
  echo ""
  echo "O exporta ORQUESTA_REPO=https://github.com/TU_USER/TU_REPO.git"
  exit 1
fi

need() { command -v "$1" >/dev/null 2>&1 || { echo -e "${RED}Falta '$1'. Instálalo y reintenta.${NC}"; exit 1; }; }
need git
need node
need npm
need curl

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo -e "${RED}Se requiere Node >= 20 (tienes $(node -v))${NC}"
  exit 1
fi

echo -e "${MUTED}Instalando ${NC}${APP}${MUTED} desde ${NC}$REPO"

mkdir -p "$INSTALL_DIR" "$SRC_DIR"

if [[ -d "$SRC_DIR/.git" ]]; then
  echo -e "${MUTED}Actualizando código en ${NC}$SRC_DIR"
  git -C "$SRC_DIR" remote set-url origin "$REPO" 2>/dev/null || true
  git -C "$SRC_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC_DIR" checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null \
    || git -C "$SRC_DIR" pull --ff-only origin "$BRANCH"
else
  # carpeta puede existir vacía
  rm -rf "$SRC_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$SRC_DIR"
fi

CLI="$SRC_DIR/packages/orquesta-cli"
if [[ ! -d "$CLI" ]]; then
  echo -e "${RED}No encontré packages/orquesta-cli en el repo.${NC}"
  exit 1
fi

echo -e "${MUTED}npm install + build...${NC}"
(
  cd "$CLI"
  npm install --silent
  npm run build
)

# Wrapper estable en ~/.orquesta/bin/orquesta (no depende de npm link global)
cat > "$INSTALL_DIR/orquesta" <<EOF
#!/usr/bin/env bash
exec node "$CLI/bin/orquesta.js" "\$@"
EOF
chmod 755 "$INSTALL_DIR/orquesta"

# PATH
add_to_path() {
  local config_file=$1
  local command=$2
  if [[ ! -f "$config_file" ]]; then
    return 1
  fi
  if grep -Fq "$INSTALL_DIR" "$config_file" 2>/dev/null; then
    echo -e "${MUTED}PATH ya incluye orquesta en ${NC}$config_file"
    return 0
  fi
  if [[ -w "$config_file" ]]; then
    {
      echo ""
      echo "# orquesta"
      echo "$command"
    } >> "$config_file"
    echo -e "${MUTED}Añadido PATH en ${NC}$config_file"
    return 0
  fi
  return 1
}

if [[ "$no_modify_path" != "true" ]]; then
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    current_shell=$(basename "${SHELL:-bash}")
    case "$current_shell" in
      zsh)  cfg="${ZDOTDIR:-$HOME}/.zshrc" ;;
      fish) cfg="$HOME/.config/fish/config.fish" ;;
      *)    cfg="$HOME/.bashrc" ;;
    esac
    case "$current_shell" in
      fish) add_to_path "$cfg" "fish_add_path $INSTALL_DIR" || true ;;
      *)    add_to_path "$cfg" "export PATH=\"$INSTALL_DIR:\$PATH\"" || true ;;
    esac
    export PATH="$INSTALL_DIR:$PATH"
  fi
fi

echo ""
echo -e "${GREEN}✓ Orquesta instalado${NC}"
echo -e "${MUTED}Binario:${NC} $INSTALL_DIR/orquesta"
echo ""
echo -e "${MUTED}Siguiente:${NC}"
echo "  export ORQUESTA_BASE_URL='https://TU--orquesta-informes-serve.modal.run/v1'"
echo "  orquesta doctor"
echo "  orquesta mcp add"
echo "  orquesta"
echo ""
if ! command -v orquesta >/dev/null 2>&1; then
  echo -e "${ORANGE}Abre una terminal nueva o ejecuta:${NC}"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
fi
echo -e "${MUTED}Versión:${NC} $($INSTALL_DIR/orquesta --version 2>/dev/null || echo '?')"
echo ""
