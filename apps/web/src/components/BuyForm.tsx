import { useState, type FormEvent } from 'react';
import { createQuantitySchema } from '../api/schemas';
import { postCheckout, ApiError } from '../api/client';
import type { CheckoutResult } from '../api/schemas';
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

    setIsSubmitting(true);
    try {
      const result = await postCheckout(productId, parsed.data);
      onSuccess(result);
      setQuantity('1');
    } catch (error) {
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
