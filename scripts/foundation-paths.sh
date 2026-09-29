#!/usr/bin/env bash
# Lista ÚNICA de caminhos considerados seguros pra sincronização
# AUTOMÁTICA (sync-to-vertical.sh / sync-foundation-commit.sh). Fonte
# única de propósito — as duas ferramentas fazem `source` deste arquivo
# em vez de manter cópias próprias da lista, depois de um bug real
# encontrado nesta sessão (ver docs/decisoes.md, "core/brand.ts:
# extração..."): a primeira versão tratava `src/core` inteiro como uma
# unidade sincronizável, e um commit qualquer tocando qualquer arquivo
# dentro de `src/core` disparava um `rsync` do DIRETÓRIO INTEIRO — que
# sobrescreveu no Prisma arquivos como `core/admin/actions.ts`,
# `core/registry.ts`, `core/logger.ts`, páginas de `(admin)`/`(auth)`
# etc., que legitimamente DIVERGEM entre BaseERP e um vertical maduro
# (ex.: `admin/actions.ts` tem lógica de cascata específica do Prisma
# nas tabelas de negócio; comentários de vários arquivos mencionam
# "este projeto (BaseERP)" ou o histórico de correções de cada projeto).
#
# Regra ao adicionar um item aqui: só um ARQUIVO específico (nunca um
# diretório amplo), e só depois de confirmar com `diff` que o mesmo
# arquivo hoje é IDÊNTICO nos dois lados — nunca por suposição. Uma
# pasta de propósito único e genérico (ex. `core/profile/`, sem nenhuma
# lógica de negócio, sem histórico de divergência) pode entrar como
# diretório, mas com essa mesma verificação feita antes (`diff -rq`).
#
# Divergência legítima e conhecida que NUNCA deve entrar aqui (fica só
# no `check-drift.sh`, pra revisão manual caso a caso):
# `core/admin/actions.ts`, `core/admin/queries.ts`,
# `core/admin/components/new-organization-form.tsx`,
# `core/admin/components/reset-member-password-button.tsx` (esse em
# especial só diverge no texto do comentário, mas ainda assim é
# específico o bastante pra não valer a pena arriscar),
# `core/registry.ts`, `core/logger.ts`, `core/format.ts`,
# `core/changelog.ts`, `core/load-modules.ts`,
# `core/live-support/*` (implementação, não o schema),
# `core/supabase/middleware.ts`, `app/(admin)/admin/layout.tsx` e as
# demais páginas de `(admin)` além da já confirmada,
# `app/(auth)/actions.ts`, `components/layout/*` (segundo bug real
# encontrado ao testar este mecanismo: `mobile-nav.tsx` tem o nome do
# vertical hardcoded — "Prisma"/"BaseERP" — ainda não extraído pra
# `core/brand.ts`, e `sidebar-nav.tsx` do Prisma tem o item de menu de
# LGPD, que o BaseERP nem tem módulo pra ter).
FOUNDATION_PATHS=(
  "src/core/auth.ts"
  "src/core/backup.ts"
  "src/core/db.ts"
  "src/core/admin-auth.ts"
  "src/core/platform-admin.ts"
  "src/core/impersonation.ts"
  "src/core/user-lookup.ts"
  "src/core/registry.ts"
  "src/core/module-settings.ts"
  "src/core/logger.ts"
  "src/core/document.ts"
  "src/core/csv.ts"
  "src/core/csv-import.ts"
  "src/core/env.ts"
  "src/core/supabase/admin.ts"
  "src/core/supabase/client.ts"
  "src/core/supabase/middleware.ts"
  "src/core/supabase/realtime-sender.ts"
  "src/core/profile"
  "src/core/admin/validation.ts"
  "src/core/admin/components/organization-name-form.tsx"
  "src/app/(auth)/actions.ts"
  "src/components/theme-provider.tsx"
  "src/components/org-branding-style.tsx"
  "src/components/brand-icon.tsx"
  "src/components/action-link.tsx"
  "src/components/list-filter-bar.tsx"
  "src/components/back-button.tsx"
  "src/components/confirm-delete-button.tsx"
  "src/components/hint.tsx"
  "src/components/row-actions.tsx"
  "src/components/search-box.tsx"
  "src/components/stale-service-worker-cleanup.tsx"
  "src/components/version-badge.tsx"
  "src/components/ui/password-input.tsx"
  "src/db/schema/tenancy.ts"
  "src/db/schema/backup.ts"
  "src/db/schema/notifications.ts"
  "src/db/schema/live-support.ts"
  "src/app/(auth)/login/page.tsx"
  "src/app/(auth)/login/login-form.tsx"
  "src/app/(admin)/admin/organizacoes/[id]/page.tsx"
  "src/app/(app)/layout.tsx"
  "src/app/(app)/perfil"
  "src/app/layout.tsx"
  "src/app/icon.tsx"
  "src/app/apple-icon.tsx"
  "src/app/opengraph-image.tsx"
)

# `core/brand.ts` NUNCA sincroniza — é o arquivo que diferencia cada
# vertical (nome, cor, ícone, tagline). Mantido fora mesmo se algum dia
# entrar sem querer numa entrada acima.
FOUNDATION_EXCLUDE_PATHS=(
  "src/core/brand.ts"
)

# Exceções POR VERTICAL: caminhos que estão em FOUNDATION_PATHS (servem
# BaseERP/outros verticais normalmente) mas que, num vertical específico,
# têm uma divergência REAL de comportamento — nunca sincronizados NEM
# PRA NEM DE aquele vertical em particular. Chave = nome da pasta do
# vertical (basename do caminho em verticals.txt).
#
# mecano-erp: `stale-service-worker-cleanup.tsx` desregistra QUALQUER
# service worker encontrado — seguro no BaseERP/Prisma, que não têm
# nenhum de verdade, mas destruiria o service worker real do mecano-erp
# (`public/sw.js`, modo offline). `app/layout.tsx` só diverge por causa
# do import/uso desse componente — o resto (metadata via `core/brand.ts`
# etc.) já é idêntico. `login/page.tsx`: texto de UI voltado a oficina
# mecânica ("Acesse o painel da sua oficina."), deliberadamente
# diferente do genérico "organização" do BaseERP/Prisma — bug real já
# aconteceu aqui (commit de reconciliação vazou "oficina" pro BaseERP
# via sync reverso antes desta exceção existir, revertido na hora).
declare -A VERTICAL_PATH_EXCLUDES=(
  [mecano-erp]="src/components/stale-service-worker-cleanup.tsx src/app/layout.tsx src/app/(admin)/admin/organizacoes/[id]/page.tsx src/app/(app)/layout.tsx src/app/(app)/perfil/page.tsx src/app/(auth)/login/page.tsx src/db/schema/tenancy.ts src/core/admin/validation.ts src/core/profile/actions.ts"
)

is_vertical_excluded() {
  local vertical_name="$1" rel="$2" ex
  for ex in ${VERTICAL_PATH_EXCLUDES[$vertical_name]:-}; do
    if [ "$rel" = "$ex" ] || [[ "$rel" == "$ex"/* ]]; then
      return 0
    fi
  done
  return 1
}
