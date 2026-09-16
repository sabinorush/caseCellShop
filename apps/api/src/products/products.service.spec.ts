import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProductsService, InsufficientStockError } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(() => {
    service = new ProductsService();
  });

  it('findAll devolve o catálogo completo', () => {
    const products = service.findAll();
    expect(products.length).toBeGreaterThan(0);
  });

  it('findAll devolve cópias, não a referência interna', () => {
    const products = service.findAll();
    products[0].stock = 999999;
    expect(service.findAll()[0].stock).not.toBe(999999);
  });

  it('findOne lança NotFoundException para id inexistente', () => {
    expect(() => service.findOne('id-que-nao-existe')).toThrow(
      NotFoundException,
    );
  });

  it('decreaseStock reduz o estoque corretamente', () => {
    const before = service.findOne('case-iphone-15-silicone');
    const updated = service.decreaseStock('case-iphone-15-silicone', 3);
    expect(updated.stock).toBe(before.stock - 3);
    expect(service.findOne('case-iphone-15-silicone').stock).toBe(
      before.stock - 3,
    );
  });

  it('decreaseStock rejeita quantidade maior que o estoque e não altera nada', () => {
    const before = service.findOne('case-galaxy-s24-carteira'); // stock: 3
    expect(() =>
      service.decreaseStock('case-galaxy-s24-carteira', 4),
    ).toThrow(InsufficientStockError);
    expect(service.findOne('case-galaxy-s24-carteira').stock).toBe(
      before.stock,
    );
  });

  it('decreaseStock lança NotFoundException para produto inexistente', () => {
    expect(() => service.decreaseStock('id-que-nao-existe', 1)).toThrow(
      NotFoundException,
    );
  });

  it('permite zerar o estoque exatamente na última unidade', () => {
    const before = service.findOne('case-galaxy-s24-carteira'); // stock: 3
    const updated = service.decreaseStock(
      'case-galaxy-s24-carteira',
      before.stock,
    );
    expect(updated.stock).toBe(0);
  });
});
