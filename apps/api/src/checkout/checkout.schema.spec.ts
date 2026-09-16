import { describe, it, expect } from 'vitest';
import { checkoutSchema, idempotencyKeySchema } from './checkout.schema.js';

describe('checkoutSchema', () => {
  it('aceita um payload válido', () => {
    const result = checkoutSchema.safeParse({
      productId: 'case-iphone-15-silicone',
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita quantity igual a zero', () => {
    const result = checkoutSchema.safeParse({
      productId: 'case-iphone-15-silicone',
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita quantity negativa', () => {
    const result = checkoutSchema.safeParse({
      productId: 'case-iphone-15-silicone',
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita quantity fracionária', () => {
    const result = checkoutSchema.safeParse({
      productId: 'case-iphone-15-silicone',
      quantity: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita quantity não numérica', () => {
    const result = checkoutSchema.safeParse({
      productId: 'case-iphone-15-silicone',
      quantity: '2',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita productId ausente', () => {
    const result = checkoutSchema.safeParse({ quantity: 1 });
    expect(result.success).toBe(false);
  });

  it('rejeita productId vazio', () => {
    const result = checkoutSchema.safeParse({ productId: '', quantity: 1 });
    expect(result.success).toBe(false);
  });
});

describe('idempotencyKeySchema', () => {
  it('aceita um UUID válido', () => {
    const result = idempotencyKeySchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
    expect(result.success).toBe(true);
  });

  it('rejeita uma string que não é UUID', () => {
    const result = idempotencyKeySchema.safeParse('minha-chave-qualquer');
    expect(result.success).toBe(false);
  });

  it('rejeita valor ausente', () => {
    const result = idempotencyKeySchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});
