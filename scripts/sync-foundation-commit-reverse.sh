#!/usr/bin/env bash
# Lógica do hook `post-commit` REVERSO: instalado dentro de um
# vertical (não do BaseERP) por `install-sync-hook.sh`, roda depois de
# todo `git commit` LÁ. Olha o que aquele commit mudou, filtra pro que é
# "fundação segura" (mesma lista de `foundation-paths.sh`, que só existe
# no BaseERP — este script vive no BaseERP e é chamado por caminho
# absoluto a partir do vertical) e, se algo bateu, copia de volta pro
# BaseERP e commita localmente lá.
#
# Por quê o script mora no BaseERP em vez de ser copiado pra dentro de
# cada vertical: fonte única de verdade — um ajuste na lógica de sync só
# precisa ser feito aqui, nunca replicado manualmente pra cada vertical
# (o que seria irônico, precisar sincronizar manualmente o PRÓPRIO
# mecanismo de sincronização). Funciona porque BaseERP e todo vertical
# vivem na mesma máquina, caminho fixo — mesma decisão já registrada em
# docs/decisoes.md pro hook direto (BaseERP → vertical).
#
# Roda com $PWD = raiz do vertical (é como o Husky invoca um hook).
set -euo pipefail

VERTICAL_DIR="$(pwd)"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$VERTICAL_DIR" = "$BASE_DIR" ]; then
  # Proteção óbvia: nunca deveria acontecer (o hook reverso só é
  # instalado em vertical, nunca no próprio BaseERP), mas se acontecer
  # por engano de instalação, não faz nada em vez de sincronizar consigo
  # mesmo.
  exit 0
fi

cd "$VERTICAL_DIR"
COMMIT_SHA="$(git rev-parse HEAD)"
COMMIT_MSG_SUBJECT="$(git log -1 --pretty=%s "$COMMIT_SHA")"

# Mesma trava contra loop do hook direto: nunca propagar um commit que
# já é ele mesmo fruto da sincronização (evita BaseERP → vertical →
# BaseERP → vertical → ... infinito).
case "$COMMIT_MSG_SUBJECT" in
  sync\(*)
    exit 0
    ;;
esac

# shellcheck source=./foundation-paths.sh
source "$BASE_DIR/scripts/foundation-paths.sh"

mapfile -t changed_files < <(git diff-tree --no-commit-id --name-only -r --root "$COMMIT_SHA")

touched=()
for f in "${changed_files[@]}"; do
  excluded=0
  for ex in "${FOUNDATION_EXCLUDE_PATHS[@]}"; do
    if [ "$f" = "$ex" ] || [[ "$f" == "$ex"/* ]]; then
      excluded=1
      break
    fi
  done
  [ "$excluded" -eq 1 ] && continue

  for fp in "${FOUNDATION_PATHS[@]}"; do
    if [ "$f" = "$fp" ] || [[ "$f" == "$fp"/* ]]; then
      touched+=("$f")
      break
    fi
  done
done

if [ "${#touched[@]}" -eq 0 ]; then
  exit 0
fi

mapfile -t touched < <(printf "%s\n" "${touched[@]}" | sort -u)

VERTICAL_NAME="$(basename "$VERTICAL_DIR")"

echo ""
echo "[sync-foundation-reverse] Commit $COMMIT_SHA em $VERTICAL_NAME tocou fundação: ${touched[*]}"

"$BASE_DIR/scripts/sync-to-base.sh" "$VERTICAL_DIR" "${touched[@]}"

(
  cd "$BASE_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "$(cat <<EOF
sync($VERTICAL_NAME): $COMMIT_MSG_SUBJECT

Sincronizado automaticamente a partir de $VERTICAL_NAME@$COMMIT_SHA pelo
hook post-commit reverso (scripts/sync-foundation-commit-reverse.sh).
Revise e rode \`npm run check\` antes de dar push.
EOF
)"
    echo "[sync-foundation-reverse] Commit local criado no BaseERP (push é manual)."
  else
    echo "[sync-foundation-reverse] BaseERP já estava em dia, nada pra commitar."
  fi
)

echo "[sync-foundation-reverse] Concluído. Lembrete: rode 'npm run check' no BaseERP e dê push manual."
echo ""
