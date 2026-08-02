#!/usr/bin/env bash
# Instalador Orquesta (estilo OpenCode: curl | bash)
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
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

# ─── Repo público ───
DEFAULT_REPO="${ORQUESTA_REPO:-https://github.com/0PValencia/orquesta.git}"

INSTALL_ROOT="${ORQUESTA_HOME:-$HOME/.orquesta}"
INSTALL_DIR="$INSTALL_ROOT/bin"
SRC_DIR="$INSTALL_ROOT/src"
BRANCH="${ORQUESTA_BRANCH:-master}"

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
  curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
  curl -fsSL .../install.sh | bash -s -- --repo https://github.com/0PValencia/orquesta.git
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

if [[ -z "$REPO" ]]; then
  echo -e "${RED}Falta la URL del repo de GitHub.${NC}"
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
  # Copia de instalación: siempre igualar al remoto (tolera force-push / ramas divergentes)
  git -C "$SRC_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
  git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
  git -C "$SRC_DIR" clean -fd
else
  # carpeta puede existir vacía o sin .git
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
echo -e "${GREEN}✓ Orquesta listo${NC}"
echo -e "${MUTED}Comando:${NC} orquesta"
echo ""

# Config por defecto (modelo Modal) — solo si no existe (no pisar ajustes del usuario)
mkdir -p "$INSTALL_ROOT"
if [[ ! -f "$INSTALL_ROOT/config.json" ]]; then
  cat > "$INSTALL_ROOT/config.json" <<'JSON'
{
  "baseUrl": "https://pvalencia--orquesta-informes-serve.modal.run/v1",
  "model": "informes",
  "apiKey": "not-needed",
  "maxToolRounds": 16,
  "maxTokens": 2048
}
JSON
fi
if [[ ! -f "$INSTALL_ROOT/mcp.json" ]]; then
  echo '{"mcpServers":{}}' > "$INSTALL_ROOT/mcp.json"
fi

echo -e "${GREEN}Ya puedes usarlo:${NC}"
echo "  orquesta ayuda"
echo "  orquesta"
echo "  orquesta update     # tras subir cambios a GitHub"
echo ""
if ! command -v orquesta >/dev/null 2>&1; then
  echo -e "${ORANGE}Si no encuentra el comando, abre una terminal nueva o ejecuta:${NC}"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
fi
echo -e "${MUTED}Versión:${NC} $($INSTALL_DIR/orquesta --version 2>/dev/null || echo '?')"
echo ""
