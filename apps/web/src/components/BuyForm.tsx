import { useRef, useState, type FormEvent } from 'react';
import { createQuantitySchema } from '../api/schemas';
import { postCheckout, ApiError } from '../api/client';
import type { CheckoutResult } from '../api/schemas';
import { checkoutFingerprint, resolveAttempt, type PurchaseAttempt } from '../api/idempotency';
import styles from './BuyForm.module.css';

interface BuyFormProps {
  productId: string;
  stock: number;
  onSuccess: (result: CheckoutResult) => void;
  onError: (message: string) => void;
}

export function BuyForm({ productId, stock, onSuccess, onError }: BuyFormProps) {
  const [quantity, setQuantity] = useState('1');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Tentativa de compra em aberto: reusada num retry para que a mesma
  // Idempotency-Key seja enviada e a API não processe a compra duas vezes.
  const attemptRef = useRef<PurchaseAttempt | null>(null);

  const isSoldOut = stock === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Trava contra envio duplicado: se já existe uma compra em
    // processamento, ignora novos submits (ex.: duplo clique/Enter).
    if (isSubmitting) {
      return;
    }

    const quantitySchema = createQuantitySchema(stock);
    const parsed = quantitySchema.safeParse(Number(quantity));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Quantidade inválida');
      return;
    }
    setFieldError(null);

    const attempt = resolveAttempt(
      attemptRef.current,
      checkoutFingerprint(productId, parsed.data),
      () => crypto.randomUUID(),
    );
    attemptRef.current = attempt;

    setIsSubmitting(true);
    try {
      const result = await postCheckout(productId, parsed.data, attempt.key);
      attemptRef.current = null; // sucesso: a próxima compra é uma tentativa nova
      onSuccess(result);
      setQuantity('1');
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retryable) {
        // Desfecho definitivo (erro de negócio, 4xx): a próxima tentativa é
        // um pedido novo, não um retry da mesma compra.
        attemptRef.current = null;
      }
      // Erro "retryable" (rede/timeout/servidor indisponível): mantém a
      // chave para que um novo clique reenvie a mesma Idempotency-Key.
      const message =
        error instanceof ApiError
          ? error.message
          : 'Não foi possível concluir a compra. Tente novamente.';
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <input
          className={styles.input}
          type="number"
          min={1}
          max={stock}
          value={quantity}
          disabled={isSoldOut || isSubmitting}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label="Quantidade"
        />
        {fieldError && <span className={styles.error}>{fieldError}</span>}
      </div>
      <button className={styles.button} type="submit" disabled={isSoldOut || isSubmitting}>
        {isSoldOut ? 'Esgotado' : isSubmitting ? 'Comprando…' : 'Comprar'}
      </button>
    </form>
  );
}
