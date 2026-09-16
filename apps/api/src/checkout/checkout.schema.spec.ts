import { describe, it, expect } from 'vitest';
import { checkoutSchema } from './checkout.schema.js';

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
