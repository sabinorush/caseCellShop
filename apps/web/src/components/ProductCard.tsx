import type { CheckoutResult, Product } from '../api/schemas';
import { BuyForm } from './BuyForm';
import styles from './ProductCard.module.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface ProductCardProps {
  product: Product;
  onPurchaseSuccess: (result: CheckoutResult) => void;
  onPurchaseError: (message: string) => void;
}

export function ProductCard({
  product,
  onPurchaseSuccess,
  onPurchaseError,
}: ProductCardProps) {
  return (
    <article className={styles.card}>
      <span className={styles.model}>{product.model}</span>
      <h2 className={styles.name}>{product.name}</h2>
      <span className={styles.price}>
        {currencyFormatter.format(product.priceCents / 100)}
      </span>
      <span
        className={`${styles.stock} ${product.stock === 0 ? styles.stockZero : ''}`}
      >
        {product.stock === 0
          ? 'Sem estoque'
          : `${product.stock} em estoque`}
      </span>
      <BuyForm
        productId={product.id}
        stock={product.stock}
        onSuccess={onPurchaseSuccess}
        onError={onPurchaseError}
      />
    </article>
  );
}
