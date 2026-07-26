/**
 * Validação dos dígitos verificadores do CPF.
 *
 * Existe pelo mesmo motivo da validação de CNPJ: pegar erro de digitação no
 * cadastro, antes que ele vire um dado errado difícil de rastrear. Não
 * confirma que o CPF existe na Receita — só que o número é bem formado.
 */
export function isValidCpf(valor: string): boolean {
  const digits = valor.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Sequências repetidas passam no cálculo mas não são CPFs reais.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const digitoVerificador = (base: string, pesoInicial: number) => {
    const soma = base
      .split('')
      .reduce((acc, char, index) => acc + Number(char) * (pesoInicial - index), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    digitoVerificador(digits.slice(0, 9), 10) === Number(digits[9]) &&
    digitoVerificador(digits.slice(0, 10), 11) === Number(digits[10])
  );
}

/// Máscara para exibição: 123.456.789-09
export function formatCpf(valor?: string | null): string | null {
  if (!valor) return null;
  const digits = valor.replace(/\D/g, '');
  if (digits.length !== 11) return valor;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}
