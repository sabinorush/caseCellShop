import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  InsufficientStockError,
  ProductsService,
} from '../products/products.service.js';
import type { CheckoutDto } from './checkout.schema.js';
import type { CheckoutResult } from './checkout-result.types.js';

@Injectable()
export class CheckoutService {
  constructor(private readonly productsService: ProductsService) {}

  purchase(dto: CheckoutDto): CheckoutResult {
    const product = this.productsService.findOne(dto.productId);

    let updated;
    try {
      updated = this.productsService.decreaseStock(dto.productId, dto.quantity);
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    return {
      orderId: randomUUID(),
      productId: updated.id,
      productName: product.name,
      quantity: dto.quantity,
      unitPriceCents: product.priceCents,
      totalCents: product.priceCents * dto.quantity,
      remainingStock: updated.stock,
    };
  }
}
