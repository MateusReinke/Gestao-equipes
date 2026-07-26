import { describe, expect, it } from 'vitest';
import { isValidCnpj, onlyDigits } from '../lookup.service';

describe('onlyDigits', () => {
  it('remove máscara de CNPJ', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('remove máscara de CEP', () => {
    expect(onlyDigits('01310-100')).toBe('01310100');
  });
});

describe('isValidCnpj', () => {
  it('aceita CNPJ válido com máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('aceita CNPJ válido sem máscara', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
  });

  it('rejeita quantidade errada de dígitos', () => {
    expect(isValidCnpj('112223330001')).toBe(false);
    expect(isValidCnpj('112223330001812')).toBe(false);
  });

  it('rejeita sequências repetidas, que passam no cálculo mas não são CNPJs reais', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('rejeita string vazia ou não numérica', () => {
    expect(isValidCnpj('')).toBe(false);
    expect(isValidCnpj('abcdefghijklmn')).toBe(false);
  });
});
