import { Injectable, NotFoundException } from '@nestjs/common';
import { createInitialProducts } from './products.data.js';
import type { Product } from './product.types.js';

@Injectable()
export class ProductsService {
  private readonly products: Product[] = createInitialProducts();

  findAll(): Product[] {
    return this.products.map((product) => ({ ...product }));
  }

  findOne(id: string): Product {
    const product = this.products.find((item) => item.id === id);
    if (!product) {
      throw new NotFoundException(`Produto "${id}" não encontrado`);
    }
    return { ...product };
  }

  decreaseStock(id: string, quantity: number): Product {
    const product = this.products.find((item) => item.id === id);
    if (!product) {
      throw new NotFoundException(`Produto "${id}" não encontrado`);
    }
    if (quantity > product.stock) {
      throw new InsufficientStockError(product, quantity);
    }

    product.stock -= quantity;
    return { ...product };
  }
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly product: Product,
    public readonly requestedQuantity: number,
  ) {
    super(
      `Estoque insuficiente para "${product.name}": solicitado ${requestedQuantity}, disponível ${product.stock}`,
    );
    this.name = 'InsufficientStockError';
  }
}
