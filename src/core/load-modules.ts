/**
 * Único arquivo que conhece a lista de módulos instalados — importa cada
 * `modules/<modulo>/module.ts` pelo efeito colateral de chamar
 * `registerModule(...)` (ver `core/registry.ts`).
 *
 * Adicionar um módulo novo = criar a pasta + adicionar uma linha aqui.
 * Remover um módulo = apagar a pasta + tirar a linha daqui.
 *
 * Importado uma vez em `app/(app)/layout.tsx`, antes de qualquer leitura
 * de `getEnabledModules()`.
 *
 * BaseERP (este projeto) não tem nenhum módulo de negócio ainda —
 * propositalmente (ver docs/decisoes.md, "módulos vazios nesta fase"). A
 * lista abaixo fica vazia/comentada; um vertical nascido deste template
 * adiciona aqui suas próprias linhas conforme cria `src/modules/<modulo>/`.
 */

// import "@/modules/exemplo/module";

export {};
