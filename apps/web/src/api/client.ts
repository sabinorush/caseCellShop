import {
  checkoutResultSchema,
  productListSchema,
  type CheckoutResult,
  type Product,
} from './schemas';

export class ApiError extends Error {}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.message === 'string') {
      return body.message;
    }
  } catch {
    // resposta sem corpo JSON legível
  }
  return `Erro inesperado (HTTP ${response.status})`;
}

export async function getProducts(): Promise<Product[]> {
  const response = await fetch('/api/products');
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response));
  }
  const data = await response.json();
  return productListSchema.parse(data);
}

export async function postCheckout(
  productId: string,
  quantity: number,
): Promise<CheckoutResult> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response));
  }

  const data = await response.json();
  return checkoutResultSchema.parse(data);
}
