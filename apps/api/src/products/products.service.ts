import { Injectable, NotFoundException } from '@nestjs/common';
import { createInitialProducts } from './products.data.js';
import type { Product } from './product.types.js';

/**
 * Dono do estoque. É o único lugar do sistema que muta o catálogo em
 * memória, garantindo:
 *  - regra 1: a quantidade solicitada não pode ser maior que o estoque.
 *  - regra 2: o estoque só é reduzido em uma compra bem-sucedida.
 *
 * `decreaseStock` verifica e decrementa no mesmo bloco síncrono (sem
 * `await` no meio). Como o event loop do Node processa cada requisição
 * de forma cooperativa e não há ponto de suspensão aqui, duas chamadas
 * concorrentes nunca intercalam entre a checagem e a escrita — a
 * operação é efetivamente atômica.
 */
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

  /**
   * Reduz o estoque do produto em `quantity` unidades.
   * Lança se o produto não existir ou se o estoque for insuficiente;
   * em ambos os casos nada é alterado.
   */
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
