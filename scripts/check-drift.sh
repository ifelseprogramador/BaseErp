#!/usr/bin/env bash
# Compara as pastas de fundação (core/, components/ui não entra — é
# gerado pelo shadcn — mas components/theme-provider.tsx,
# components/org-branding-style.tsx etc. sim) do BaseERP contra um
# vertical, pra achar onde eles divergiram desde que o vertical nasceu
# (ou desde a última sincronização manual). NÃO aplica nada sozinho —
# só mostra a lista de arquivos diferentes/faltando, pra decidir o que
# replicar em cada direção (ver regra de manutenção em AGENTS.md/CLAUDE.md
# de cada projeto).
#
# Uso: ./scripts/check-drift.sh /home/eduardo/code/prisma
#      ./scripts/check-drift.sh /home/eduardo/code/mecano-erp
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:?Uso: check-drift.sh <caminho-do-vertical>}"

if [ ! -d "$TARGET_DIR/src/core" ]; then
  echo "Erro: $TARGET_DIR não parece um projeto nascido do BaseERP (sem src/core/)." >&2
  exit 1
fi

# Pastas de fundação — mesma lista em espírito do que docs/arquitetura.md
# descreve como "core, nunca conhece um módulo específico". Ajuste aqui
# se uma pasta nova de core/ nascer.
FOUNDATION_PATHS=(
  "src/core"
  "src/components/theme-provider.tsx"
  "src/components/org-branding-style.tsx"
  "src/components/action-link.tsx"
  "src/components/list-filter-bar.tsx"
  "src/components/back-button.tsx"
  "src/components/confirm-delete-button.tsx"
  "src/components/hint.tsx"
  "src/components/row-actions.tsx"
  "src/components/search-box.tsx"
  "src/components/stale-service-worker-cleanup.tsx"
  "src/components/version-badge.tsx"
  "src/components/layout"
  "src/components/ui/password-input.tsx"
  "src/db/schema/tenancy.ts"
  "src/db/schema/backup.ts"
  "src/db/schema/notifications.ts"
  "src/db/schema/live-support.ts"
  "src/app/(auth)"
  "src/app/(admin)"
  "src/app/(app)/layout.tsx"
  "src/app/(app)/perfil"
  "src/app/layout.tsx"
)

echo "Comparando fundação: $BASE_DIR  vs  $TARGET_DIR"
echo

any_diff=0
for rel in "${FOUNDATION_PATHS[@]}"; do
  base_path="$BASE_DIR/$rel"
  target_path="$TARGET_DIR/$rel"

  if [ ! -e "$base_path" ]; then
    continue # peça específica de um vertical que o BaseERP nem tem (ok)
  fi
  if [ ! -e "$target_path" ]; then
    echo "SÓ NO BASEERP (falta no vertical): $rel"
    any_diff=1
    continue
  fi

  if [ -d "$base_path" ]; then
    if ! diff -rq "$base_path" "$target_path" >/tmp/check-drift-diff.$$ 2>&1; then
      echo "--- $rel ---"
      cat /tmp/check-drift-diff.$$
      any_diff=1
    fi
    rm -f /tmp/check-drift-diff.$$
  else
    if ! diff -q "$base_path" "$target_path" >/dev/null 2>&1; then
      echo "DIFERENTE: $rel"
      any_diff=1
    fi
  fi
done

echo
if [ "$any_diff" -eq 0 ]; then
  echo "Nenhuma divergência encontrada nos caminhos verificados."
else
  echo "Divergências encontradas acima. Decida caso a caso (ver regra de"
  echo "manutenção): correção de core/tenancy/RLS/admin vai pros dois"
  echo "lados; personalização de marca (nome, ícone, favicon) do vertical"
  echo "fica só nele, mesmo aparecendo aqui como \"diferente\"."
fi
