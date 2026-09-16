import { useCallback, useEffect, useRef, useState } from 'react';
import { getProducts, ApiError } from './api/client';
import type { CheckoutResult, Product } from './api/schemas';
import { ProductCard } from './components/ProductCard';
import styles from './App.module.css';

type Banner = { type: 'success' | 'error'; message: string };
type LoadError = { message: string; retryable: boolean };

function App() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const cancelledRef = useRef(false);

  const loadProducts = useCallback(async () => {
    try {
      const data = await getProducts();
      if (!cancelledRef.current) {
        setProducts(data);
        setLoadError(null);
      }
    } catch (error: unknown) {
      if (cancelledRef.current) return;
      setLoadError(
        error instanceof ApiError
          ? { message: error.message, retryable: error.retryable }
          : { message: 'Não foi possível carregar os produtos.', retryable: true },
      );
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void loadProducts();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadProducts]);

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await loadProducts();
    } finally {
      setIsRetrying(false);
    }
  }

  function handlePurchaseSuccess(result: CheckoutResult) {
    setProducts(
      (current) =>
        current?.map((product) =>
          product.id === result.productId
            ? { ...product, stock: result.remainingStock }
            : product,
        ) ?? current,
    );
    setBanner({
      type: 'success',
      message: `Compra realizada! ${result.quantity}x ${result.productName} — pedido ${result.orderId.slice(0, 8)}.`,
    });
  }

  function handlePurchaseError(message: string) {
    setBanner({ type: 'error', message });
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>CaseCellShop</h1>
      <p className={styles.subtitle}>Capas de celular para todos os modelos.</p>

      {banner && (
        <p
          role="alert"
          className={`${styles.banner} ${
            banner.type === 'success' ? styles.bannerSuccess : styles.bannerError
          }`}
        >
          {banner.message}
        </p>
      )}

      {loadError && (
        <p role="alert" className={`${styles.banner} ${styles.bannerError}`}>
          <span>{loadError.message}</span>
          {loadError.retryable && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          )}
        </p>
      )}
      {!products && !loadError && (
        <p className={styles.status}>Carregando produtos…</p>
      )}

      {products && (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPurchaseSuccess={handlePurchaseSuccess}
              onPurchaseError={handlePurchaseError}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default App;
