/** Validação e formatação de CPF/CNPJ — infraestrutura genérica para
 * qualquer módulo futuro que precise de documento de pessoa física/jurídica
 * (ex.: cadastro de clientes/fornecedores num vertical). */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function hasAllSameDigits(value: string): boolean {
  return /^(\d)\1*$/.test(value);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || hasAllSameDigits(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const checkDigit = (sliceEnd: number, weightStart: number) => {
    const sum = digits
      .slice(0, sliceEnd)
      .reduce((acc, digit, i) => acc + digit * (weightStart - i), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9, 10) === digits[9] && checkDigit(10, 11) === digits[10];
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || hasAllSameDigits(cnpj)) return false;

  const digits = cnpj.split("").map(Number);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const checkDigit = (slice: number[], weights: number[]) => {
    const sum = slice.reduce((acc, digit, i) => acc + digit * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return (
    checkDigit(digits.slice(0, 12), weights1) === digits[12] &&
    checkDigit(digits.slice(0, 13), weights2) === digits[13]
  );
}

/** Aceita CPF (11 dígitos) ou CNPJ (14 dígitos), já sabendo distinguir pelo tamanho. */
export function isValidDocument(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function formatDocument(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}
