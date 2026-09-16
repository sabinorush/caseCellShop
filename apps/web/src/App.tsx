import { useEffect, useState } from 'react';
import { getProducts, ApiError } from './api/client';
import type { CheckoutResult, Product } from './api/schemas';
import { ProductCard } from './components/ProductCard';
import styles from './App.module.css';

type Banner = { type: 'success' | 'error'; message: string };

function App() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    let cancelled = false;

    getProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Não foi possível carregar os produtos.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          className={`${styles.banner} ${
            banner.type === 'success' ? styles.bannerSuccess : styles.bannerError
          }`}
        >
          {banner.message}
        </p>
      )}

      {loadError && <p className={styles.status}>{loadError}</p>}
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
