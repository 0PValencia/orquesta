#!/usr/bin/env bash
# Compat: redirige al instalador raíz
exec bash "$(cd "$(dirname "$0")/../../.." && pwd)/install.sh" "$@"
