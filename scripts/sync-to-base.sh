#!/usr/bin/env bash
# Sincronização REVERSA: copia arquivos de um vertical DE VOLTA pro
# BaseERP. Espelho de `sync-to-vertical.sh` — mesma lista
# (`foundation-paths.sh`), mesma regra de nunca usar `--delete` num
# diretório (um vertical não deve ter arquivo apagado no BaseERP só
# porque um diretório inteiro foi escolhido como unidade sincronizável).
#
# Motor do hook reverso (`sync-foundation-commit-reverse.sh`), que roda
# DENTRO de um vertical (`$VERTICAL_DIR` = onde o commit aconteceu) e
# copia pro BaseERP (`$BASE_DIR`, sempre fixo — é o único BaseERP que
# existe na máquina).
#
# Este script só COPIA e faz `git add` dentro do BaseERP — nunca
# commita nem dá push sozinho (mesmo contrato de `sync-to-vertical.sh`).
#
# Uso: ./scripts/sync-to-base.sh <caminho-do-vertical> [arquivos...]
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERTICAL_DIR="${1:?Uso: sync-to-base.sh <caminho-do-vertical> [arquivos...]}"
shift || true

if [ ! -d "$VERTICAL_DIR/src/core" ]; then
  echo "Erro: $VERTICAL_DIR não parece um projeto nascido do BaseERP (sem src/core/)." >&2
  exit 1
fi

# shellcheck source=./foundation-paths.sh
source "$BASE_DIR/scripts/foundation-paths.sh"

is_excluded() {
  local rel="$1"
  for ex in "${FOUNDATION_EXCLUDE_PATHS[@]}"; do
    if [ "$rel" = "$ex" ] || [[ "$rel" == "$ex"/* ]]; then
      return 0
    fi
  done
  return 1
}

if [ "$#" -gt 0 ]; then
  TO_SYNC=("$@")
else
  TO_SYNC=("${FOUNDATION_PATHS[@]}")
fi

synced=0
for rel in "${TO_SYNC[@]}"; do
  if is_excluded "$rel"; then
    continue
  fi

  vertical_path="$VERTICAL_DIR/$rel"
  base_path="$BASE_DIR/$rel"

  if [ ! -e "$vertical_path" ]; then
    # Arquivo foi apagado no vertical — apaga também no BaseERP.
    if [ -e "$base_path" ]; then
      rm -rf "$base_path"
      echo "REMOVIDO: $rel"
      synced=1
    fi
    continue
  fi

  mkdir -p "$(dirname "$base_path")"
  if [ -d "$vertical_path" ]; then
    # SEM --delete — mesmo motivo de sync-to-vertical.sh: o BaseERP não
    # deve perder nada por causa de uma pasta cujo conteúdo, do lado do
    # vertical, tenha mais arquivos do que o esperado.
    rsync -a "$vertical_path/" "$base_path/"
  else
    cp "$vertical_path" "$base_path"
  fi
  echo "SINCRONIZADO (reverso): $rel"
  synced=1
done

if [ "$synced" -eq 1 ]; then
  (cd "$BASE_DIR" && git add -A -- "${TO_SYNC[@]}" 2>/dev/null || true)
fi

exit 0
