#!/usr/bin/env bash
# Instala os hooks `post-commit` dos DOIS sentidos da sincronização
# automática de fundação:
#
#   1. BaseERP -> vertical  (scripts/sync-foundation-commit.sh)
#   2. vertical -> BaseERP  (scripts/sync-foundation-commit-reverse.sh)
#
# Sem os dois, a "regra de manutenção" (AGENTS.md: uma correção de
# core/tenancy feita enquanto se trabalha NUM VERTICAL também precisa
# voltar pro BaseERP) continuaria manual. Os dois hooks se protegem
# contra loop infinito checando se o commit já é ele mesmo um commit de
# sincronização (mensagem começa com `sync(`) — ver o comentário no
# topo de cada script `sync-foundation-commit*.sh`.
#
# Este repo (e todo vertical nascido dele) usa Husky
# (`core.hooksPath` aponta pra `.husky/_`, não pra `.git/hooks/`) — um
# hook em `.git/hooks/post-commit` NUNCA dispara nesse caso. Por isso
# este instalador escreve em `.husky/post-commit` (formato Husky v9:
# script puro, sem o boilerplate antigo de
# `. "$(dirname -- "$0")/_/husky.sh"`, que o próprio Husky marca como
# deprecated/removido no v10).
#
# Rodar uma vez por clone/checkout (deste repo E de cada vertical novo
# adicionado a `scripts/verticals.txt`) — `.husky/` é versionado (fica
# no git), mas manter o instalador idempotente é mais simples do que
# lembrar de nunca editar os arquivos à mão.
#
# Uso: ./scripts/install-sync-hook.sh
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install_husky_post_commit() {
  local repo_dir="$1"
  local body="$2"
  local hook_path="$repo_dir/.husky/post-commit"

  if [ ! -d "$repo_dir/.husky" ]; then
    echo "AVISO: $repo_dir não tem .husky/ — pulando (hook não instalado lá)." >&2
    return
  fi

  printf '%s\n' "$body" > "$hook_path"
  chmod +x "$hook_path"
  echo "Hook post-commit instalado em $hook_path"
}

install_husky_post_commit "$BASE_DIR" "$(cat <<'EOF'
# Instalado por scripts/install-sync-hook.sh — não editar direto, edite
# scripts/sync-foundation-commit.sh e rode o instalador de novo.
./scripts/sync-foundation-commit.sh || {
  echo "[post-commit] sync-foundation-commit.sh falhou — o commit no BaseERP" >&2
  echo "[post-commit] foi feito normalmente, mas a propagação automática não" >&2
  echo "[post-commit] rodou. Rode manualmente: ./scripts/sync-foundation-commit.sh" >&2
}
EOF
)"

if [ -f "$BASE_DIR/scripts/verticals.txt" ]; then
  while IFS= read -r vertical; do
    [[ -z "$vertical" || "$vertical" == \#* ]] && continue
    if [ ! -d "$vertical" ]; then
      echo "AVISO: $vertical não existe, pulando." >&2
      continue
    fi

    reverse_body="$(cat <<EOF
# Instalado por $BASE_DIR/scripts/install-sync-hook.sh — não editar
# direto, edite scripts/sync-foundation-commit-reverse.sh (no BaseERP)
# e rode o instalador de novo lá.
"$BASE_DIR/scripts/sync-foundation-commit-reverse.sh" || {
  echo "[post-commit] sync-foundation-commit-reverse.sh falhou — o commit" >&2
  echo "[post-commit] aqui foi feito normalmente, mas a propagação de volta" >&2
  echo "[post-commit] pro BaseERP não rodou. Rode manualmente a partir daqui:" >&2
  echo "[post-commit] $BASE_DIR/scripts/sync-foundation-commit-reverse.sh" >&2
}
EOF
)"
    install_husky_post_commit "$vertical" "$reverse_body"
  done < "$BASE_DIR/scripts/verticals.txt"
fi
