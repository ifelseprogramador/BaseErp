#!/usr/bin/env bash
# Sincronização REAL (copia arquivos, não só compara) da fundação do
# BaseERP para um vertical nascido dele. É o motor por trás do hook
# `post-commit` (ver `scripts/install-sync-hook.sh`): toda vez que um
# commit no BaseERP mexe em algo de `FOUNDATION_PATHS`, o hook chama
# este script pra cada vertical cadastrado em `scripts/verticals.txt`.
#
# Nunca copia por cima de nada específico do vertical (nome, ícone,
# tagline etc.) porque esses arquivos já foram extraídos pra
# `core/brand.ts` (ver docs/decisoes.md) — os únicos arquivos aqui
# dentro são os que devem ficar byte-idênticos entre BaseERP e todo
# vertical.
#
# Este script só COPIA e faz `git add` dentro do vertical — nunca
# commita nem dá push sozinho. Quem chama decide se commita/dá push
# (o hook local faz o commit automaticamente pra manter o histórico
# rastreável; o push fica sempre manual, é uma mudança que afeta
# produção).
#
# Uso: ./scripts/sync-to-vertical.sh /home/eduardo/code/prisma [arquivo1 arquivo2 ...]
#      (sem lista de arquivos = sincroniza tudo de FOUNDATION_PATHS)
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:?Uso: sync-to-vertical.sh <caminho-do-vertical> [arquivos...]}"
shift || true

if [ ! -d "$TARGET_DIR/src/core" ]; then
  echo "Erro: $TARGET_DIR não parece um projeto nascido do BaseERP (sem src/core/)." >&2
  exit 1
fi

# Fonte única de `FOUNDATION_PATHS`/`FOUNDATION_EXCLUDE_PATHS` —
# compartilhada com `sync-foundation-commit.sh`. Ver o comentário lá
# dentro para o porquê da lista ser file-level, não diretórios amplos.
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

# Se chamado com uma lista explícita de arquivos (o hook faz isso,
# restringindo aos arquivos que o commit realmente tocou), sincroniza
# só esses; senão, sincroniza a lista inteira de FOUNDATION_PATHS.
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

  base_path="$BASE_DIR/$rel"
  target_path="$TARGET_DIR/$rel"

  if [ ! -e "$base_path" ]; then
    # Arquivo foi apagado no BaseERP — apaga também no vertical.
    if [ -e "$target_path" ]; then
      rm -rf "$target_path"
      echo "REMOVIDO: $rel"
      synced=1
    fi
    continue
  fi

  mkdir -p "$(dirname "$target_path")"
  if [ -d "$base_path" ]; then
    # SEM --delete de propósito: um vertical pode ter arquivos PRÓPRIOS
    # dentro de uma pasta de fundação compartilhada (ex.: prisma tem
    # src/core/privacy/, src/core/business-type-presets.ts,
    # src/core/audit-log.ts que o BaseERP não tem) — um --delete aqui
    # apagaria esses arquivos do vertical toda vez que a fundação
    # sincronizasse. Só adiciona/atualiza o que existe no BaseERP; nunca
    # remove o que só existe no vertical.
    rsync -a "$base_path/" "$target_path/"
  else
    cp "$base_path" "$target_path"
  fi
  echo "SINCRONIZADO: $rel"
  synced=1
done

if [ "$synced" -eq 1 ]; then
  (cd "$TARGET_DIR" && git add -A -- "${TO_SYNC[@]}" 2>/dev/null || true)
fi

exit 0
