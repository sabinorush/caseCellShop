import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { ProductsService } from '../products/products.service.js';

describe('CheckoutService', () => {
  let productsService: ProductsService;
  let checkoutService: CheckoutService;

  beforeEach(() => {
    productsService = new ProductsService();
    checkoutService = new CheckoutService(productsService);
  });

  it('realiza uma compra válida e devolve o total correto', () => {
    const product = productsService.findOne('case-iphone-15-silicone');

    const result = checkoutService.purchase(
      { productId: product.id, quantity: 2 },
      randomUUID(),
    );

    expect(result.orderId).toBeTruthy();
    expect(result.productId).toBe(product.id);
    expect(result.quantity).toBe(2);
    expect(result.unitPriceCents).toBe(product.priceCents);
    expect(result.totalCents).toBe(product.priceCents * 2);
    expect(result.remainingStock).toBe(product.stock - 2);
  });

  it('reduz o estoque do produto após a compra (regra: só cai em compra bem-sucedida)', () => {
    const before = productsService.findOne('case-iphone-15-silicone');
    checkoutService.purchase({ productId: before.id, quantity: 1 }, randomUUID());
    const after = productsService.findOne(before.id);
    expect(after.stock).toBe(before.stock - 1);
  });

  it('lança 409 quando a quantidade excede o estoque e não altera o estoque', () => {
    const before = productsService.findOne('case-galaxy-s24-carteira'); // stock: 3

    expect(() =>
      checkoutService.purchase(
        { productId: before.id, quantity: before.stock + 1 },
        randomUUID(),
      ),
    ).toThrow(ConflictException);

    const after = productsService.findOne(before.id);
    expect(after.stock).toBe(before.stock);
  });

  it('lança 404 para produto inexistente', () => {
    expect(() =>
      checkoutService.purchase({ productId: 'inexistente', quantity: 1 }, randomUUID()),
    ).toThrow(NotFoundException);
  });

  it('permite comprar até esgotar o estoque, e a compra seguinte falha', () => {
    const product = productsService.findOne('case-galaxy-s24-carteira'); // stock: 3

    const result = checkoutService.purchase(
      { productId: product.id, quantity: product.stock },
      randomUUID(),
    );
    expect(result.remainingStock).toBe(0);

    expect(() =>
      checkoutService.purchase({ productId: product.id, quantity: 1 }, randomUUID()),
    ).toThrow(ConflictException);
  });

  describe('idempotência', () => {
    it('repetir a mesma Idempotency-Key devolve o mesmo pedido e não decrementa o estoque de novo', () => {
      const product = productsService.findOne('case-iphone-15-silicone');
      const key = randomUUID();
      const dto = { productId: product.id, quantity: 1 };

      const first = checkoutService.purchase(dto, key);
      const second = checkoutService.purchase(dto, key);

      expect(second.orderId).toBe(first.orderId);
      expect(second.remainingStock).toBe(first.remainingStock);

      const after = productsService.findOne(product.id);
      expect(after.stock).toBe(product.stock - 1);
    });

    it('chaves diferentes geram compras independentes', () => {
      const product = productsService.findOne('case-iphone-15-silicone');
      const dto = { productId: product.id, quantity: 1 };

      const first = checkoutService.purchase(dto, randomUUID());
      const second = checkoutService.purchase(dto, randomUUID());

      expect(second.orderId).not.toBe(first.orderId);

      const after = productsService.findOne(product.id);
      expect(after.stock).toBe(product.stock - 2);
    });

    it('reusar a chave com um pedido diferente lança 422 e não altera o estoque', () => {
      const product = productsService.findOne('case-iphone-15-silicone');
      const key = randomUUID();

      checkoutService.purchase({ productId: product.id, quantity: 1 }, key);
      const stockAfterFirst = productsService.findOne(product.id).stock;

      expect(() =>
        checkoutService.purchase({ productId: product.id, quantity: 2 }, key),
      ).toThrow(UnprocessableEntityException);

      expect(productsService.findOne(product.id).stock).toBe(stockAfterFirst);
    });

    it('uma compra que falha por estoque insuficiente libera a chave para uma nova tentativa', () => {
      const product = productsService.findOne('case-galaxy-s24-carteira'); // stock: 3
      const key = randomUUID();

      expect(() =>
        checkoutService.purchase(
          { productId: product.id, quantity: product.stock + 1 },
          key,
        ),
      ).toThrow(ConflictException);

      const result = checkoutService.purchase(
        { productId: product.id, quantity: 1 },
        key,
      );

      expect(result.remainingStock).toBe(product.stock - 1);
    });
  });
});
