import { z } from 'zod';

export const checkoutSchema = z.object({
  productId: z.string().min(1, 'productId é obrigatório'),
  quantity: z
    .number()
    .int('quantity deve ser um número inteiro')
    .positive('quantity deve ser maior que zero')
    .max(999, 'quantity é maior do que o permitido'),
});

export type CheckoutDto = z.infer<typeof checkoutSchema>;

export const idempotencyKeySchema = z.uuid('Idempotency-Key deve ser um UUID');
