export interface CheckoutResult {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  remainingStock: number;
}
