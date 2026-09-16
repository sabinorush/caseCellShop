import { z } from 'zod';

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string(),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
});

export type Product = z.infer<typeof productSchema>;

export const productListSchema = z.array(productSchema);

export const checkoutResultSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  remainingStock: z.number().int().nonnegative(),
});

export type CheckoutResult = z.infer<typeof checkoutResultSchema>;

export function createQuantitySchema(stock: number) {
  return z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .positive('A quantidade deve ser maior que zero')
    .max(stock, 'Quantidade maior que o estoque disponível');
}
