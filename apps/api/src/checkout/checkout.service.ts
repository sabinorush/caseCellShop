import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  InsufficientStockError,
  ProductsService,
} from '../products/products.service.js';
import { IdempotencyStore } from '../common/idempotency-store.js';
import type { CheckoutDto } from './checkout.schema.js';
import type { CheckoutResult } from './checkout-result.types.js';

@Injectable()
export class CheckoutService {
  private readonly idempotency = new IdempotencyStore<CheckoutResult>();

  constructor(private readonly productsService: ProductsService) {}

  purchase(dto: CheckoutDto, idempotencyKey: string): CheckoutResult {
    const fingerprint = `${dto.productId}:${dto.quantity}`;
    const begin = this.idempotency.begin(idempotencyKey, fingerprint);

    if (begin.status === 'replayed') {
      return begin.value;
    }
    if (begin.status === 'in-flight') {
      throw new ConflictException('Esta compra já está em processamento');
    }
    if (begin.status === 'fingerprint-mismatch') {
      throw new UnprocessableEntityException(
        'Este Idempotency-Key já foi usado para outra compra',
      );
    }

    try {
      const result = this.execute(dto);
      this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (error) {
      // Falha não "queima" a chave: uma nova tentativa com a mesma chave deve
      // poder ser processada de novo (ex.: cliente corrige a quantidade).
      this.idempotency.release(idempotencyKey);
      throw error;
    }
  }

  private execute(dto: CheckoutDto): CheckoutResult {
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
