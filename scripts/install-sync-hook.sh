#!/usr/bin/env bash
# Instala o hook `post-commit` que dispara a sincronização automática
# de fundação pros verticais (ver scripts/sync-foundation-commit.sh).
#
# Este repo usa Husky (`core.hooksPath` aponta pra `.husky/_`, não pra
# `.git/hooks/`) — um hook em `.git/hooks/post-commit` NUNCA dispara
# aqui. Por isso este instalador escreve em `.husky/post-commit`
# (formato Husky v9: script puro, sem o boilerplate antigo de
# `. "$(dirname -- "$0")/_/husky.sh"`, que o próprio husky marca como
# deprecated/removido no v10).
#
# Rodar uma vez por clone/checkout — `.husky/` é versionado (fica no
# git), mas manter o instalador idempotente é mais simples do que
# lembrar de nunca editar o arquivo à mão.
#
# Uso: ./scripts/install-sync-hook.sh
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_PATH="$BASE_DIR/.husky/post-commit"

cat > "$HOOK_PATH" <<'EOF'
# Instalado por scripts/install-sync-hook.sh — não editar direto, edite
# scripts/sync-foundation-commit.sh e rode o instalador de novo.
./scripts/sync-foundation-commit.sh || {
  echo "[post-commit] sync-foundation-commit.sh falhou — o commit no BaseERP" >&2
  echo "[post-commit] foi feito normalmente, mas a propagação automática não" >&2
  echo "[post-commit] rodou. Rode manualmente: ./scripts/sync-foundation-commit.sh" >&2
}
EOF

chmod +x "$HOOK_PATH"
echo "Hook post-commit instalado em $HOOK_PATH"
