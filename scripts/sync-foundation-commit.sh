#!/usr/bin/env bash
# Lógica do hook `post-commit`: olha o que o commit que acabou de
# acontecer no BaseERP mudou, filtra pra só o que é "fundação segura"
# (`scripts/foundation-paths.sh`) e, se algo bateu, chama
# `sync-to-vertical.sh` pra cada vertical cadastrado em
# `scripts/verticals.txt` e commita localmente lá (nunca dá push —
# isso é sempre manual, ver AGENTS.md).
#
# Não é chamado direto — `git commit` no BaseERP dispara isso sozinho
# depois que `scripts/install-sync-hook.sh` for rodado uma vez.
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

COMMIT_SHA="$(git rev-parse HEAD)"
COMMIT_MSG_SUBJECT="$(git log -1 --pretty=%s "$COMMIT_SHA")"

# Fonte única de FOUNDATION_PATHS/FOUNDATION_EXCLUDE_PATHS — mesma usada
# por sync-to-vertical.sh.
# shellcheck source=./foundation-paths.sh
source "$BASE_DIR/scripts/foundation-paths.sh"

# Arquivos que o commit realmente tocou (added/copied/modified/renamed/deleted).
mapfile -t changed_files < <(git diff-tree --no-commit-id --name-only -r --root "$COMMIT_SHA")

# Filtra pra só os que caem dentro de algum FOUNDATION_PATHS (arquivo
# exato ou dentro de uma pasta da lista, ex. `src/core/profile/`) e que
# não estejam em FOUNDATION_EXCLUDE_PATHS. Guarda o ARQUIVO exato que
# mudou (nunca a entrada de FOUNDATION_PATHS inteira) — sincroniza só o
# que o commit realmente tocou, nunca mais que isso.
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
  exit 0 # commit não mexeu em nada de fundação — nada a propagar
fi

# Remove duplicados (uma pasta como src/core pode aparecer várias vezes).
mapfile -t touched < <(printf "%s\n" "${touched[@]}" | sort -u)

echo ""
echo "[sync-foundation] Commit $COMMIT_SHA tocou fundação: ${touched[*]}"

if [ ! -f "scripts/verticals.txt" ]; then
  echo "[sync-foundation] scripts/verticals.txt não existe — nada a fazer."
  exit 0
fi

while IFS= read -r vertical; do
  # ignora linhas em branco/comentário
  [[ -z "$vertical" || "$vertical" == \#* ]] && continue
  if [ ! -d "$vertical" ]; then
    echo "[sync-foundation] AVISO: $vertical não existe, pulando." >&2
    continue
  fi

  echo "[sync-foundation] Sincronizando -> $vertical"
  ./scripts/sync-to-vertical.sh "$vertical" "${touched[@]}"

  (
    cd "$vertical"
    if ! git diff --cached --quiet; then
      git commit -m "$(cat <<EOF
sync(base-erp): $COMMIT_MSG_SUBJECT

Sincronizado automaticamente a partir de base-erp@$COMMIT_SHA pelo hook
post-commit (scripts/sync-foundation-commit.sh). Revise e rode
\`npm run check\` antes de dar push.
EOF
)"
      echo "[sync-foundation] Commit local criado em $vertical (push é manual)."
    else
      echo "[sync-foundation] $vertical já estava em dia, nada pra commitar."
    fi
  )
done < "scripts/verticals.txt"

echo "[sync-foundation] Concluído. Lembrete: rode 'npm run check' e dê push manual em cada vertical alterado."
echo ""
