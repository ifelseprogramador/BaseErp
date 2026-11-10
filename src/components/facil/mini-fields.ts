import type { MiniField } from "@/components/facil/facil-search";

/**
 * Campos do cadastro rápido de CLIENTE ("＋ Cadastrar novo cliente"), iguais em
 * todo assistente que precisa dele. Nome (e telefone, onde a validação exige)
 * ficam à vista; o resto é opcional e só aparece em "Mais dados (opcional)".
 * Os `key` são os `name` do cadastro completo (`type`, `document`, `email`…),
 * porque o servidor passa por `parse*FormData`.
 */
export function customerMiniFields(
  options: { phoneRequired?: boolean; withNotes?: boolean } = {},
): MiniField[] {
  const phoneRequired = options.phoneRequired ?? false;
  return [
    { key: "name", label: "Nome", required: true },
    {
      key: "phone",
      label: phoneRequired ? "Telefone ou WhatsApp (com DDD)" : "Telefone ou WhatsApp",
      type: "tel",
      required: phoneRequired,
    },
    {
      key: "type",
      label: "É uma",
      advanced: true,
      defaultValue: "pf",
      choices: [
        { value: "pf", label: "Pessoa" },
        { value: "pj", label: "Empresa" },
      ],
    },
    { key: "document", label: "CPF ou CNPJ", advanced: true },
    { key: "email", label: "E-mail", type: "email", advanced: true },
    { key: "legalName", label: "Razão social", advanced: true },
    { key: "tradeName", label: "Nome fantasia", advanced: true },
    {
      key: "ieIndicator",
      label: "Inscrição Estadual",
      advanced: true,
      defaultValue: "nao_contribuinte",
      choices: [
        { value: "nao_contribuinte", label: "Não contribuinte" },
        { value: "isento", label: "Isento" },
        { value: "contribuinte", label: "Contribuinte" },
      ],
    },
    { key: "ie", label: "Número da Inscrição Estadual", advanced: true },
    { key: "im", label: "Inscrição Municipal", advanced: true },
    { key: "zip", label: "CEP", advanced: true },
    { key: "street", label: "Rua", advanced: true },
    { key: "number", label: "Número", advanced: true },
    { key: "complement", label: "Complemento", advanced: true },
    { key: "district", label: "Bairro", advanced: true },
    { key: "city", label: "Cidade", advanced: true },
    { key: "state", label: "UF", placeholder: "ex.: SP", advanced: true },
    { key: "ibgeCode", label: "Código IBGE da cidade", advanced: true },
    ...(options.withNotes ? [{ key: "notes", label: "Observações", advanced: true }] : []),
  ];
}

/** `name` de todo campo do cadastro rápido de cliente (o servidor monta o FormData com eles). */
export const CUSTOMER_QUICK_KEYS = customerMiniFields({ withNotes: true }).map((f) => f.key);

const FUELS = [
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "flex", label: "Flex" },
  { value: "diesel", label: "Diesel" },
  { value: "eletrico", label: "Elétrico" },
  { value: "gnv", label: "GNV" },
];

/**
 * Campos do cadastro rápido de VEÍCULO. Só a placa é obrigatória; marca e
 * modelo ficam à vista; ano, cor, combustível, km e chassi são opcionais e só
 * aparecem em "Mais dados (opcional)". `key` = `name` do cadastro completo.
 */
export function vehicleMiniFields(): MiniField[] {
  return [
    { key: "plate", label: "Placa", required: true },
    { key: "brand", label: "Marca" },
    { key: "model", label: "Modelo" },
    { key: "year", label: "Ano", type: "number", placeholder: "ex.: 2019", advanced: true },
    { key: "color", label: "Cor", advanced: true },
    { key: "fuel", label: "Combustível", advanced: true, clearable: true, choices: FUELS },
    { key: "currentKm", label: "Quilometragem atual", type: "number", advanced: true },
    { key: "chassis", label: "Chassi", advanced: true },
  ];
}

/**
 * Campos do cadastro rápido de PRODUTO do catálogo de bordado (prisma). Produto
 * e preço à vista; o resto (inclusive os dados fiscais) em "Mais dados".
 */
export function catalogoBordadoMiniFields(): MiniField[] {
  return [
    { key: "tipoProduto", label: "Produto", required: true },
    { key: "price", label: "Preço (R$)", type: "money", placeholder: "0,00" },
    { key: "modeloPadrao", label: "Modelo padrão", advanced: true },
    {
      key: "tamanhosAceitos",
      label: "Tamanhos aceitos (separe por vírgula)",
      placeholder: "P, M, G",
      advanced: true,
    },
    {
      key: "coresAceitas",
      label: "Cores aceitas (separe por vírgula)",
      placeholder: "branco, preto",
      advanced: true,
    },
    { key: "unidade", label: "Unidade", defaultValue: "UN", advanced: true },
    { key: "ncm", label: "NCM (8 dígitos)", advanced: true },
    { key: "cfop", label: "CFOP", advanced: true },
    { key: "origem", label: "Origem da mercadoria (0 a 8)", defaultValue: "0", advanced: true },
    { key: "cst", label: "CST/CSOSN", advanced: true },
  ];
}

/** `name` do cadastro completo de cada campo extra do produto (além do preço). */
export const CATALOGO_QUICK_KEYS = catalogoBordadoMiniFields()
  .map((f) => f.key)
  .filter((k) => k !== "price");
