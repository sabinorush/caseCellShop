import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
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

    const result = checkoutService.purchase({
      productId: product.id,
      quantity: 2,
    });

    expect(result.orderId).toBeTruthy();
    expect(result.productId).toBe(product.id);
    expect(result.quantity).toBe(2);
    expect(result.unitPriceCents).toBe(product.priceCents);
    expect(result.totalCents).toBe(product.priceCents * 2);
    expect(result.remainingStock).toBe(product.stock - 2);
  });

  it('reduz o estoque do produto após a compra (regra: só cai em compra bem-sucedida)', () => {
    const before = productsService.findOne('case-iphone-15-silicone');
    checkoutService.purchase({ productId: before.id, quantity: 1 });
    const after = productsService.findOne(before.id);
    expect(after.stock).toBe(before.stock - 1);
  });

  it('lança 409 quando a quantidade excede o estoque e não altera o estoque', () => {
    const before = productsService.findOne('case-galaxy-s24-carteira'); // stock: 3

    expect(() =>
      checkoutService.purchase({
        productId: before.id,
        quantity: before.stock + 1,
      }),
    ).toThrow(ConflictException);

    const after = productsService.findOne(before.id);
    expect(after.stock).toBe(before.stock);
  });

  it('lança 404 para produto inexistente', () => {
    expect(() =>
      checkoutService.purchase({ productId: 'inexistente', quantity: 1 }),
    ).toThrow(NotFoundException);
  });

  it('permite comprar até esgotar o estoque, e a compra seguinte falha', () => {
    const product = productsService.findOne('case-galaxy-s24-carteira'); // stock: 3

    const result = checkoutService.purchase({
      productId: product.id,
      quantity: product.stock,
    });
    expect(result.remainingStock).toBe(0);

    expect(() =>
      checkoutService.purchase({ productId: product.id, quantity: 1 }),
    ).toThrow(ConflictException);
  });
});
