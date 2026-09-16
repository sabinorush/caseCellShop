export interface PurchaseAttempt {
  key: string;
  fingerprint: string;
}

export function checkoutFingerprint(productId: string, quantity: number): string {
  return `${productId}:${quantity}`;
}

export function resolveAttempt(
  current: PurchaseAttempt | null,
  fingerprint: string,
  newKey: () => string,
): PurchaseAttempt {
  if (current && current.fingerprint === fingerprint) {
    return current;
  }
  return { key: newKey(), fingerprint };
}
