/**
 * Ponto único que o drizzle-kit lê para gerar migrations. Reexporta o
 * schema de cada peça de fundação — nunca declare tabelas aqui
 * diretamente.
 *
 * Este projeto (BaseERP) não tem nenhum módulo de negócio ainda (ver
 * src/modules/README.md) — quando um vertical nascer daqui e criar seus
 * primeiros módulos, adicione `export * from "@/modules/<modulo>/schema";`
 * abaixo, na ordem de dependência de FKs.
 */

export * from "./schema/tenancy";
export * from "./schema/live-support";
export * from "./schema/backup";
export * from "./schema/notifications";
