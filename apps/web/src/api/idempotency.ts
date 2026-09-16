export interface PurchaseAttempt {
  key: string;
  fingerprint: string;
}

/**
 * Identifica um pedido de compra (não a tentativa) para decidir se uma nova
 * chave deve ser gerada. Trocar productId ou quantity é um pedido diferente,
 * mesmo que a tentativa anterior tenha falhado.
 */
export function checkoutFingerprint(productId: string, quantity: number): string {
  return `${productId}:${quantity}`;
}

/**
 * Resolve a chave de idempotência (Idempotency-Key) a ser usada numa tentativa
 * de compra.
 *
 * Reusa a chave da tentativa corrente quando o pedido é o mesmo — assim um
 * retry após erro de rede/timeout/indisponibilidade reenvia a mesma chave e a
 * API pode devolver o resultado já processado em vez de comprar de novo.
 * Gera uma chave nova quando não há tentativa em aberto ou o pedido mudou
 * (ex.: usuário alterou a quantidade antes de tentar de novo).
 */
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
